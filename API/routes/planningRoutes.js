/**
 * Routes API pour le système de planification des TPI
 */

const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()

// Models
const Person = require('../models/personModel')
const Slot = require('../models/slotModel')
const Vote = require('../models/voteModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const personImportService = require('../services/personImportService')
const personRegistryService = require('../services/personRegistryService')
const { backfillMissingPersonShortIds } = require('../services/personShortIdService')

// Services
const schedulingService = require('../services/schedulingService')
const magicLinkService = require('../services/magicLinkService')
const emailService = require('../services/emailService')
const { filterPlanifiableTpis } = require('../services/tpiPlanningVisibility')
const {
  getPlanningConfig,
  savePlanningConfig
} = require('../services/planningConfigService')
const {
  buildVoteProposalContext,
  filterSlotDocumentsForVoteProposal
} = require('../services/voteProposalOptionsService')
const {
  getSharedPlanningCatalog,
  saveSharedPlanningCatalog
} = require('../services/planningCatalogService')

// Middleware d'authentification
const { authMiddleware, requireRole } = magicLinkService
const {
  requireObjectIdParam,
  requireNonEmptyBody,
  requireYearParam
} = require('../middleware/requestValidation')

const ALLOWED_VOTE_DECISIONS = new Set(['accepted', 'rejected', 'preferred'])
const ALLOWED_VOTE_RESPONSE_MODES = new Set(['ok', 'proposal'])

function getRouteErrorResponse(error, fallbackMessage) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500

  return {
    statusCode,
    payload: {
      error: statusCode === 503
        ? (error?.message || fallbackMessage)
        : fallbackMessage
    }
  }
}

router.get('/catalog', async (req, res) => {
  try {
    const catalog = await getSharedPlanningCatalog()
    return res.json(catalog)
  } catch (error) {
    console.error('Erreur lors du chargement du catalogue partagé:', error)
    const response = getRouteErrorResponse(error, 'Erreur lors du chargement du catalogue partagé.')
    return res.status(response.statusCode).json(response.payload)
  }
})

router.put(
  '/catalog',
  authMiddleware,
  requireRole('admin'),
  requireNonEmptyBody('Catalogue requis.'),
  async (req, res) => {
    try {
      const savedCatalog = await saveSharedPlanningCatalog(req.body)
      return res.json(savedCatalog)
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du catalogue partagé:', error)
      const response = getRouteErrorResponse(error, 'Erreur lors de la sauvegarde du catalogue partagé.')
      return res.status(response.statusCode).json(response.payload)
    }
  }
)

router.get('/config/:year', requireYearParam('year'), async (req, res) => {
  try {
    const { year } = req.validatedParams
    const config = await getPlanningConfig(year)

    if (!config) {
      return res.status(404).json({ error: 'Configuration introuvable.' })
    }

    return res.json(config)
  } catch (error) {
    console.error(`Erreur lors du chargement de la configuration ${req.params.year}:`, error)
    const response = getRouteErrorResponse(error, 'Erreur lors du chargement de la configuration.')
    return res.status(response.statusCode).json(response.payload)
  }
})

router.put(
  '/config/:year',
  authMiddleware,
  requireRole('admin'),
  requireYearParam('year'),
  requireNonEmptyBody('Configuration requise.'),
  async (req, res) => {
    try {
      const { year } = req.validatedParams
      const savedConfig = await savePlanningConfig(year, req.body)

      return res.json(savedConfig)
    } catch (error) {
      console.error(`Erreur lors de la sauvegarde de la configuration ${req.params.year}:`, error)
      const response = getRouteErrorResponse(error, 'Erreur lors de la sauvegarde de la configuration.')
      return res.status(response.statusCode).json(response.payload)
    }
  }
)

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function toInteger(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return null
    }

    const parsed = Number(trimmed)
    return Number.isInteger(parsed) ? parsed : null
  }

  return null
}

function parseShortIdSearch(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '')

  if (!normalized) {
    return null
  }

  const prefixedMatch = normalized.match(/^[A-Z][-:]?(\d{1,3})$/)
  if (prefixedMatch) {
    return toInteger(prefixedMatch[1])
  }

  return toInteger(normalized)
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function toObjectIdOrNull(value) {
  return isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null
}

function toDateOrNull(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getVoteMagicLinkContext(req) {
  const authContext = req.user?.authContext

  if (authContext?.type !== 'vote_magic_link') {
    return null
  }

  const personId = authContext.personId || req.user?.id
  const personObjectId = toObjectIdOrNull(personId)

  if (!personObjectId) {
    return null
  }

  return {
    ...authContext,
    personId: String(personId),
    personObjectId
  }
}

function rejectVoteScope(res, message = 'Acces hors scope du lien de vote.') {
  return res.status(403).json({ error: message })
}

function buildScopedVoteTpiFilter(req, year) {
  const context = getVoteMagicLinkContext(req)

  if (!context) {
    return { year }
  }

  if (Number(context.year) !== Number(year)) {
    return null
  }

  const scopedFilter = {
    year,
    $or: [
      { expert1: context.personObjectId },
      { expert2: context.personObjectId },
      { chefProjet: context.personObjectId }
    ]
  }

  const scopedTpiObjectId = toObjectIdOrNull(context.scope?.tpiId)
  if (scopedTpiObjectId) {
    scopedFilter._id = scopedTpiObjectId
  }

  return scopedFilter
}

function resolveVoteParticipantId(req) {
  const context = getVoteMagicLinkContext(req)

  if (context?.personObjectId) {
    return context.personObjectId
  }

  if (isValidObjectId(req.user?.id)) {
    return new mongoose.Types.ObjectId(req.user.id)
  }

  return null
}

async function getPreferredVoteCountForVoter({ tpiPlanningId, voterId, excludeVoteId = null }) {
  const filter = {
    tpiPlanning: tpiPlanningId,
    voter: voterId,
    decision: 'preferred'
  }

  if (excludeVoteId) {
    filter._id = { $ne: excludeVoteId }
  }

  return await Vote.countDocuments(filter)
}

function getFixedSlotIdFromTpi(tpi) {
  const fixedSlot = Array.isArray(tpi?.proposedSlots)
    ? tpi.proposedSlots.find((proposedSlot) => proposedSlot?.slot)
    : null

  return fixedSlot?.slot?._id
    ? String(fixedSlot.slot._id)
    : fixedSlot?.slot
      ? String(fixedSlot.slot)
      : null
}

function isVoteScopeCompatibleWithTpi(req, tpi, year = null) {
  const context = getVoteMagicLinkContext(req)

  if (!context) {
    return true
  }

  const targetYear = year === null || year === undefined
    ? Number(tpi?.year)
    : Number(year)

  if (Number(context.year) !== targetYear || Number(tpi?.year) !== targetYear) {
    return false
  }

  const scopedTpiId = context.scope?.tpiId
  if (scopedTpiId && String(scopedTpiId) !== String(tpi?._id || '')) {
    return false
  }

  const participantIds = [
    tpi?.expert1,
    tpi?.expert2,
    tpi?.chefProjet
  ]
    .filter(Boolean)
    .map(person => String(person?._id || person))

  return participantIds.includes(String(context.personId))
}

function buildSlotSortKey(slot) {
  const date = new Date(slot?.date || 0).getTime()
  return [
    Number.isFinite(date) ? String(date) : '0',
    String(slot?.period || ''),
    String(slot?.startTime || ''),
    String(slot?.room?.name || '')
  ].join('|')
}

function buildVoteResponseMode(roleStatus) {
  if (!roleStatus || roleStatus.decision === 'pending') {
    return 'pending'
  }

  if (roleStatus.decision === 'accepted') {
    return 'ok'
  }

  if (
    roleStatus.alternativeCount > 0 ||
    roleStatus.availabilityException ||
    roleStatus.specialRequestReason ||
    roleStatus.specialRequestDate
  ) {
    return 'proposal'
  }

  return roleStatus.decision
}

async function buildVoteProposalOptionsForTpi(tpi, groupedSlots = []) {
  const tpiId = String(tpi?._id || '')
  if (!tpiId) {
    return {
      options: [],
      context: {
        candidateClass: '',
        candidateClassLabel: '',
        classCode: '',
        isMatu: false,
        allowedDateKeys: [],
        allowedDateLabels: [],
        source: 'planning_slots'
      }
    }
  }

  let planningConfig = null
  let proposalContext = {
    candidateClass: String(tpi?.classe || '').trim(),
    candidateClassLabel: String(tpi?.classe || '').trim(),
    classCode: '',
    isMatu: false,
    allowedDateKeys: [],
    allowedDateLabels: [],
    source: 'planning_slots'
  }

  try {
    if (mongoose.connection?.readyState === 1) {
      planningConfig = await getPlanningConfig(tpi?.year)
      proposalContext = buildVoteProposalContext(tpi, planningConfig)
    }
  } catch (error) {
    console.warn(`Impossible de charger la configuration de vote ${tpi?.year}:`, error?.message || error)
  }

  const fixedSlotId = getFixedSlotIdFromTpi(tpi)
  const optionsBySlotId = new Map()

  for (const groupedSlot of groupedSlots || []) {
    const slotId = groupedSlot?.slot?._id
      ? String(groupedSlot.slot._id)
      : groupedSlot?.slot
        ? String(groupedSlot.slot)
        : ''

    if (!slotId || slotId === fixedSlotId) {
      continue
    }

    optionsBySlotId.set(slotId, {
      slotId,
      voteId: groupedSlot.voteId ? String(groupedSlot.voteId) : null,
      slot: groupedSlot.slot,
      source: 'existing_vote',
      score: null,
      reason: ''
    })
  }

  const availableSlots = await schedulingService.findAvailableSlotsForTpi(tpiId)
  const availableSlotIds = availableSlots
    .map(slotInfo => slotInfo.slot)
    .filter(Boolean)

  if (availableSlotIds.length === 0) {
    return {
      options: Array.from(optionsBySlotId.values())
        .sort((left, right) => buildSlotSortKey(left.slot).localeCompare(buildSlotSortKey(right.slot))),
      context: proposalContext
    }
  }

  const slotDocuments = await Slot.find({ _id: { $in: availableSlotIds } })
    .select('date period startTime endTime room status')
    .lean()

  const filteredSlotDocuments = filterSlotDocumentsForVoteProposal(slotDocuments, proposalContext)

  const slotById = new Map(
    filteredSlotDocuments.map(slotDocument => [String(slotDocument._id), slotDocument])
  )

  for (const slotInfo of availableSlots) {
    const slotId = String(slotInfo.slot || '')
    if (!slotId || slotId === fixedSlotId || optionsBySlotId.has(slotId)) {
      continue
    }

    const slotDocument = slotById.get(slotId)
    if (!slotDocument) {
      continue
    }

    optionsBySlotId.set(slotId, {
      slotId,
      voteId: null,
      slot: slotDocument,
      source: 'planning_option',
      score: Number.isFinite(Number(slotInfo.score)) ? Number(slotInfo.score) : null,
      reason: typeof slotInfo.reason === 'string' ? slotInfo.reason : ''
    })
  }

  return {
    options: Array.from(optionsBySlotId.values())
      .sort((left, right) => buildSlotSortKey(left.slot).localeCompare(buildSlotSortKey(right.slot))),
    context: proposalContext
  }
}

// ============================================
// ROUTES AUTHENTIFICATION (Magic Link)
// ============================================

/**
 * POST /api/planning/auth/magic-link
 * Génère et envoie un magic link par email
 */
router.post('/auth/magic-link', async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string'
      ? req.body.email.trim()
      : ''
    
    if (email.length === 0) {
      return res.status(400).json({ error: 'Email requis' })
    }
    
    const baseUrl = `${req.protocol}://${req.get('host')}/api/planning`
    const magicLink = await magicLinkService.generateMagicLink(email, baseUrl)
    
    // Envoyer l'email
    await emailService.sendEmail(email, 'voteRequest', {
      recipientName: magicLink.personName,
      magicLinkUrl: magicLink.url,
      // Les autres champs seront vides pour un simple login
      candidateName: 'N/A',
      tpiReference: 'Connexion',
      role: 'Utilisateur',
      slots: [],
      deadline: magicLink.expiresAt.toLocaleDateString('fr-CH')
    })
    
    res.json({ 
      success: true, 
      message: 'Un lien de connexion a été envoyé à votre adresse email' 
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

/**
 * GET /api/planning/auth/verify
 * Vérifie un magic link et retourne un token de session
 */
router.get('/auth/verify', async (req, res) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : ''
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : ''
    
    if (token.length === 0 || email.length === 0) {
      return res.status(400).json({ error: 'Token et email requis' })
    }
    
    const result = await magicLinkService.verifyMagicLink(token, email)
    const sessionToken = magicLinkService.generateSessionToken(result.person)
    
    res.json({
      success: true,
      token: sessionToken,
      user: result.person
    })
  } catch (error) {
    res.status(401).json({ error: error.message })
  }
})

// ============================================
// ROUTES PERSONNES
// ============================================

/**
 * GET /api/planning/persons
 * Liste toutes les personnes (filtrable par rôle)
 */
router.get('/persons', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    await backfillMissingPersonShortIds()

    const { role, site, search, sendEmails } = req.query

    const filter = { isActive: true }

    if (role) {
      filter.roles = role
    }

    if (site) {
      filter.site = site
    }

    if (sendEmails !== undefined) {
      filter.sendEmails = sendEmails === 'true'
    }

    if (search) {
      const parsedShortId = parseShortIdSearch(search)
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]

      if (Number.isInteger(parsedShortId)) {
        filter.$or.push({ shortId: parsedShortId })
      }
    }

    const persons = await Person.find(filter)
      .select('-magicLinkToken -magicLinkExpires')
      .sort({ lastName: 1, firstName: 1 })

    res.json(persons)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/persons
 * Crée une nouvelle personne
 */
router.post('/persons', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const result = await personRegistryService.createOrMergePerson(req.body)
    const statusCode = result.created ? 201 : 200

    res.status(statusCode).json(result)
  } catch (error) {
    if (error instanceof personRegistryService.PersonRegistryError) {
      return res.status(error.statusCode || 400).json({ error: error.message })
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        error: 'Une personne avec cet email existe déjà.'
      })
    }

    res.status(400).json({ error: error.message })
  }
})

/**
 * POST /api/planning/persons/import
 * Importe un lot de parties prenantes depuis un texte CSV/TSV
 */
router.post('/persons/import', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : ''

    if (!content) {
      return res.status(400).json({ error: 'Contenu CSV requis' })
    }

    const defaultSite = typeof req.body?.defaultSite === 'string'
      ? req.body.defaultSite.trim()
      : ''
    const defaultRoles = Array.isArray(req.body?.defaultRoles)
      ? req.body.defaultRoles
      : typeof req.body?.defaultRole === 'string'
        ? [req.body.defaultRole]
        : []

    const results = await personImportService.importPeopleFromContent(content, {
      defaultSite,
      defaultRoles: defaultRoles.length > 0 ? defaultRoles : ['expert']
    })

    res.json({
      success: true,
      ...results
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

/**
 * PUT /api/planning/persons/:id
 * Met à jour une personne
 */
router.put('/persons/:id', authMiddleware, requireRole('admin'), requireObjectIdParam('id', 'Identifiant personne'), async (req, res) => {
  try {
    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'roles',
      'site',
      'entreprise',
      'defaultAvailability',
      'unavailableDates',
      'isActive',
      'sendEmails',
      'candidateYears',
      'preferredSoutenanceDates',
      'preferredSoutenanceChoices'
    ]
    const normalizedUpdate = {}

    for (const field of allowedFields) {
      if (req.body?.[field] !== undefined) {
        normalizedUpdate[field] = req.body[field]
      }
    }

    const person = await personRegistryService.updatePerson(req.params.id, normalizedUpdate)

    if (!person) {
      return res.status(404).json({ error: 'Personne non trouvée' })
    }

    res.json(person)
  } catch (error) {
    if (error instanceof personRegistryService.PersonRegistryError) {
      return res.status(error.statusCode || 400).json({ error: error.message })
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        error: 'Une personne avec cet email existe déjà.'
      })
    }

    res.status(400).json({ error: error.message })
  }
})

/**
 * POST /api/planning/persons/merge
 * Fusionne plusieurs fiches en conservant une fiche cible
 */
router.post('/persons/merge', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const targetPersonId = typeof req.body?.targetPersonId === 'string'
      ? req.body.targetPersonId.trim()
      : ''
    const sourcePersonIds = Array.isArray(req.body?.sourcePersonIds)
      ? req.body.sourcePersonIds
      : []
    const allowDifferentIdentity = req.body?.allowDifferentIdentity === true

    if (!targetPersonId) {
      return res.status(400).json({ error: 'targetPersonId requis' })
    }

    if (sourcePersonIds.length === 0) {
      return res.status(400).json({ error: 'sourcePersonIds requis' })
    }

    const result = await personRegistryService.mergePeopleIntoTarget(targetPersonId, sourcePersonIds, {
      allowDifferentIdentity
    })

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    if (error instanceof personRegistryService.PersonRegistryError) {
      return res.status(error.statusCode || 400).json({ error: error.message, details: error.details || {} })
    }

    res.status(400).json({ error: error.message })
  }
})

/**
 * DELETE /api/planning/persons/:id
 * Désactive une personne
 */
router.delete('/persons/:id', authMiddleware, requireRole('admin'), requireObjectIdParam('id', 'Identifiant personne'), async (req, res) => {
  try {
    const person = await Person.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    )

    if (!person) {
      return res.status(404).json({ error: 'Personne non trouvée' })
    }

    res.json({ success: true, person })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

/**
 * POST /api/planning/persons/purge
 * Supprime tout le référentiel des parties prenantes
 */
router.post('/persons/purge', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    if (req.body?.confirm !== true) {
      return res.status(400).json({ error: 'Confirmation requise' })
    }

    const result = await personImportService.purgeAllPeople()

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

/**
 * PUT /api/planning/persons/:id/availability
 * Met à jour les disponibilités d'une personne
 */
router.put('/persons/:id/availability', authMiddleware, requireRole('admin'), requireObjectIdParam('id', 'Identifiant personne'), async (req, res) => {
  try {
    const { defaultAvailability, unavailableDates } = req.body

    if (
      defaultAvailability === undefined &&
      unavailableDates === undefined
    ) {
      return res.status(400).json({
        error: 'defaultAvailability ou unavailableDates requis'
      })
    }

    if (
      defaultAvailability !== undefined &&
      !Array.isArray(defaultAvailability)
    ) {
      return res
        .status(400)
        .json({ error: 'defaultAvailability doit être un tableau' })
    }

    if (
      unavailableDates !== undefined &&
      !Array.isArray(unavailableDates)
    ) {
      return res
        .status(400)
        .json({ error: 'unavailableDates doit être un tableau' })
    }
    
    const person = await Person.findByIdAndUpdate(
      req.params.id,
      { defaultAvailability, unavailableDates },
      { new: true }
    )
    
    if (!person) {
      return res.status(404).json({ error: 'Personne non trouvée' })
    }
    
    res.json(person)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// ============================================
// ROUTES CRÉNEAUX (SLOTS)
// ============================================

/**
 * POST /api/planning/slots/generate
 * Génère les créneaux pour une période
 */
router.post('/slots/generate', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { year, dates, siteConfig } = req.body

    const parsedYear = toInteger(year)
    
    if (!parsedYear || !Array.isArray(dates) || dates.length === 0 || !isPlainObject(siteConfig)) {
      return res.status(400).json({ error: 'year, dates et siteConfig requis' })
    }

    if (typeof siteConfig.site !== 'string' || siteConfig.site.trim().length === 0) {
      return res.status(400).json({ error: 'siteConfig.site requis' })
    }

    if (!Array.isArray(siteConfig.rooms) || siteConfig.rooms.length === 0) {
      return res.status(400).json({ error: 'siteConfig.rooms doit être un tableau non vide' })
    }
    
    const slots = await schedulingService.generateSlotsForPeriod(parsedYear, dates, siteConfig)
    
    res.json({ 
      success: true, 
      message: `${slots.length} créneaux générés`,
      count: slots.length
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/planning/slots/:year
 * Liste tous les créneaux d'une année
 */
router.get('/slots/:year', authMiddleware, requireYearParam('year'), async (req, res) => {
  try {
    const year = req.validatedParams.year
    const { status, date, site } = req.query

     if (getVoteMagicLinkContext(req)) {
      return rejectVoteScope(res, 'Liste complete des creneaux indisponible avec un lien de vote.')
    }
    
    const filter = { year }
    
    if (status) {
      filter.status = status
    }
    
    if (date) {
      const parsedDate = new Date(date)
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Date invalide.' })
      }
      filter.date = parsedDate
    }
    
    if (site) {
      filter['room.site'] = site
    }
    
    const slots = await Slot.find(filter)
      .populate('assignedTpi', 'reference candidat')
      .sort({ date: 1, period: 1, 'room.name': 1 })
    
    res.json(slots)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/planning/slots/:year/calendar
 * Retourne les créneaux formatés pour un calendrier
 */
router.get('/slots/:year/calendar', authMiddleware, requireYearParam('year'), async (req, res) => {
  try {
    const year = req.validatedParams.year
    const scopedTpiFilter = buildScopedVoteTpiFilter(req, year)

    if (!scopedTpiFilter) {
      return rejectVoteScope(res, 'Annee indisponible pour ce lien de vote.')
    }

    const scopedTpiIds = getVoteMagicLinkContext(req)
      ? await TpiPlanning.find(scopedTpiFilter).distinct('_id')
      : null

    const slotFilter = { year }
    if (Array.isArray(scopedTpiIds)) {
      if (scopedTpiIds.length === 0) {
        return res.json([])
      }
      slotFilter.assignedTpi = { $in: scopedTpiIds }
    }

    const slots = await Slot.find(slotFilter)
      .populate({
        path: 'assignedTpi',
        populate: [
          { path: 'candidat', select: 'firstName lastName' },
          { path: 'expert1', select: 'firstName lastName' },
          { path: 'expert2', select: 'firstName lastName' },
          { path: 'chefProjet', select: 'firstName lastName' }
        ]
      })
    
    // Grouper par date
    const calendar = {}
    
    for (const slot of slots) {
      const dateKey = slot.date.toISOString().split('T')[0]
      
      if (!calendar[dateKey]) {
        calendar[dateKey] = {
          date: dateKey,
          rooms: {}
        }
      }
      
      if (!calendar[dateKey].rooms[slot.room.name]) {
        calendar[dateKey].rooms[slot.room.name] = []
      }
      
      calendar[dateKey].rooms[slot.room.name].push({
        id: slot._id,
        period: slot.period,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
        tpi: slot.assignedTpi ? {
          reference: slot.assignedTpi.reference,
          candidat: slot.assignedTpi.candidat?.firstName + ' ' + slot.assignedTpi.candidat?.lastName
        } : null
      })
    }
    
    res.json(Object.values(calendar))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// ROUTES TPI PLANNING
// ============================================

/**
 * GET /api/planning/tpi/:year
 * Liste tous les TPI d'une année
 */
router.get('/tpi/:year', authMiddleware, requireYearParam('year'), async (req, res) => {
  try {
    const year = req.validatedParams.year
    const { status } = req.query
    const filter = buildScopedVoteTpiFilter(req, year)

    if (!filter) {
      return rejectVoteScope(res, 'Annee indisponible pour ce lien de vote.')
    }
    
    if (status) {
      filter.status = status
    }
    
    const [planningConfig, rawTpis] = await Promise.all([
      getPlanningConfig(year),
      TpiPlanning.find(filter)
        .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email')
        .populate('proposedSlots.slot', 'date period startTime endTime room status')
        .populate('confirmedSlot', 'date period startTime room')
        .sort({ reference: 1 })
    ])

    const tpis = filterPlanifiableTpis(rawTpis, planningConfig)

    if (tpis.length > 0) {
      const tpiIds = tpis.map(tpi => tpi._id)
      const voteStats = await Vote.aggregate([
        { $match: { tpiPlanning: { $in: tpiIds } } },
        {
          $group: {
            _id: '$tpiPlanning',
            totalVotes: { $sum: 1 },
            pendingVotes: {
              $sum: {
                $cond: [{ $eq: ['$decision', 'pending'] }, 1, 0]
              }
            },
            acceptedVotes: {
              $sum: {
                $cond: [{ $eq: ['$decision', 'accepted'] }, 1, 0]
              }
            },
            preferredVotes: {
              $sum: {
                $cond: [{ $eq: ['$decision', 'preferred'] }, 1, 0]
              }
            },
            rejectedVotes: {
              $sum: {
                $cond: [{ $eq: ['$decision', 'rejected'] }, 1, 0]
              }
            },
            respondedVotes: {
              $sum: {
                $cond: [{ $ne: ['$decision', 'pending'] }, 1, 0]
              }
            }
          }
        }
      ])

      const votesByRole = await Vote.find({
        tpiPlanning: { $in: tpiIds }
      })
        .populate('slot', 'date period startTime endTime room')
        .select('tpiPlanning slot voterRole decision votedAt comment availabilityException specialRequestReason specialRequestDate')
        .sort({ createdAt: 1 })

      const statsByTpiId = new Map(
        voteStats.map(stat => [String(stat._id), stat])
      )

      const makeDefaultRoleStatus = () => ({
        decision: 'pending',
        votedAt: null,
        comment: '',
        availabilityException: false,
        specialRequestReason: '',
        specialRequestDate: null,
        alternativeCount: 0,
        rejectedAlternativeCount: 0,
        acceptedAlternativeCount: 0,
        responseMode: 'pending'
      })

      const voteRoleStatusByTpi = new Map(
        tpiIds.map((tpiId) => [
          String(tpiId),
          {
            expert1: makeDefaultRoleStatus(),
            expert2: makeDefaultRoleStatus(),
            chef_projet: makeDefaultRoleStatus()
          }
        ])
      )

      const fixedSlotIdsByTpiId = new Map(
        tpis.map((tpi) => {
          const fixedSlot = Array.isArray(tpi.proposedSlots)
            ? tpi.proposedSlots.find((proposedSlot) => proposedSlot?.slot)
            : null

          return [
            String(tpi._id),
            fixedSlot?.slot?._id ? String(fixedSlot.slot._id) : null
          ]
        })
      )

      for (const vote of votesByRole) {
        const tpiId = String(vote.tpiPlanning)
        const role = vote.voterRole
        const tpiRoleStatus = voteRoleStatusByTpi.get(tpiId)

        if (!tpiRoleStatus || !tpiRoleStatus[role]) {
          continue
        }

        const fixedSlotId = fixedSlotIdsByTpiId.get(tpiId)
        const currentStatus = tpiRoleStatus[role]
        const voteSlotId = vote.slot?._id ? String(vote.slot._id) : String(vote.slot || '')
        const decision = vote.decision || 'pending'

        if (fixedSlotId && voteSlotId === fixedSlotId) {
          currentStatus.decision = decision
          currentStatus.votedAt = vote.votedAt || null
          currentStatus.comment = vote.comment || ''
          currentStatus.availabilityException = Boolean(vote.availabilityException)
          currentStatus.specialRequestReason = vote.specialRequestReason || ''
          currentStatus.specialRequestDate = vote.specialRequestDate || null
          currentStatus.fixedVoteId = String(vote._id)
          continue
        }

        if (decision === 'preferred') {
          currentStatus.alternativeCount += 1
        } else if (decision === 'rejected') {
          currentStatus.rejectedAlternativeCount += 1
        } else if (decision === 'accepted') {
          currentStatus.acceptedAlternativeCount += 1
        }
      }

      for (const tpi of tpis) {
        const roleStatus = voteRoleStatusByTpi.get(String(tpi._id)) || {
          expert1: makeDefaultRoleStatus(),
          expert2: makeDefaultRoleStatus(),
          chef_projet: makeDefaultRoleStatus()
        }

        for (const currentStatus of Object.values(roleStatus)) {
          currentStatus.responseMode = buildVoteResponseMode(currentStatus)
        }

        tpi.voteStats = statsByTpiId.get(String(tpi._id)) || {
          totalVotes: 0,
          pendingVotes: 0,
          acceptedVotes: 0,
          preferredVotes: 0,
          rejectedVotes: 0,
          respondedVotes: 0
        }

        tpi.voteRoleStatus = roleStatus
      }
    }
    
    res.json(tpis)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/planning/tpi/:year/:id
 * Détails d'un TPI
 */
router.get('/tpi/:year/:id', authMiddleware, requireYearParam('year'), requireObjectIdParam('id', 'Identifiant TPI'), async (req, res) => {
  try {
    const year = req.validatedParams.year
    const tpi = await TpiPlanning.findById(req.params.id)
      .populate('candidat expert1 expert2 chefProjet')
      .populate('proposedSlots.slot')
      .populate('confirmedSlot')
    
    if (!tpi) {
      return res.status(404).json({ error: 'TPI non trouvé' })
    }

    if (!isVoteScopeCompatibleWithTpi(req, tpi, year)) {
      return rejectVoteScope(res, 'TPI hors scope du lien de vote.')
    }
    
    // Récupérer les votes associés
    const votes = await Vote.find({ tpiPlanning: tpi._id })
      .populate('slot', 'date period startTime room')
      .populate('voter', 'firstName lastName')
    
    res.json({ tpi, votes })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/tpi
 * Crée un nouveau TPI
 */
router.post('/tpi', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { year, candidat, expert1, expert2, chefProjet, sujet, description, entreprise, classe, site, dates } = req.body
    const createdBy = toObjectIdOrNull(req.user?.id)
    
    // Générer la référence
    const reference = await TpiPlanning.generateReference(year)
    
    const tpi = new TpiPlanning({
      reference,
      year,
      candidat,
      expert1,
      expert2,
      chefProjet,
      sujet,
      description,
      entreprise,
      classe,
      site,
      dates,
      status: 'draft',
      createdBy
    })
    
    await tpi.save()
    await tpi.addHistory('created', createdBy, {
      createdByUsername: req.user?.id || null
    })
    
    res.status(201).json(tpi)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

/**
 * POST /api/planning/tpi/:id/propose-slots
 * Lance la proposition de créneaux et le processus de vote
 */
router.post('/tpi/:id/propose-slots', authMiddleware, requireObjectIdParam('id', 'Identifiant TPI'), requireRole('admin'), async (req, res) => {
  try {
    const maxSlots = req.body?.maxSlots === undefined ? 4 : toInteger(req.body.maxSlots)

    if (!maxSlots || maxSlots < 1 || maxSlots > 4) {
      return res.status(400).json({ error: 'maxSlots doit être un entier entre 1 et 4' })
    }
    
    const result = await schedulingService.proposeSlotsAndInitiateVoting(
      req.params.id,
      maxSlots
    )
    
    if (result.success && result.proposedSlots.length > 0) {
      // Envoyer les emails de demande de vote
      const tpi = await TpiPlanning.findById(req.params.id)
        .populate('candidat expert1 expert2 chefProjet')
        .populate('proposedSlots.slot')
      
      const baseUrl = `${req.protocol}://${req.get('host')}/api/planning`
      
      // Générer les magic links pour chaque votant
      const voters = [
        { person: tpi.expert1, role: 'expert1' },
        { person: tpi.expert2, role: 'expert2' },
        { person: tpi.chefProjet, role: 'chef_projet' }
      ]
      
      const magicLinks = []
      
      for (const voter of voters) {
        const link = await magicLinkService.generateMagicLink(voter.person.email, baseUrl)
        magicLinks.push({
          ...link,
          email: voter.person.email,
          role: voter.role,
          slots: tpi.proposedSlots.map(ps => ({
            date: ps.slot.date.toLocaleDateString('fr-CH'),
            period: ps.slot.period,
            startTime: ps.slot.startTime,
            endTime: ps.slot.endTime,
            room: ps.slot.room.name
          }))
        })
      }
      
      await emailService.sendVoteRequests(tpi, magicLinks)
    }
    
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/tpi/:id/force-slot
 * Force manuellement un créneau (intervention admin)
 */
router.post('/tpi/:id/force-slot', authMiddleware, requireObjectIdParam('id', 'Identifiant TPI'), requireRole('admin'), async (req, res) => {
  try {
    const { slotId, reason } = req.body
    
    if (!slotId || !reason) {
      return res.status(400).json({ error: 'slotId et reason requis' })
    }

    if (!isValidObjectId(slotId)) {
      return res.status(400).json({ error: 'slotId invalide' })
    }

    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'reason doit être une chaîne non vide' })
    }
    
    const result = await schedulingService.forceSlotManually(
      req.params.id,
      slotId,
      toObjectIdOrNull(req.user?.id),
      reason
    )
    
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// ROUTES VOTES
// ============================================

/**
 * GET /api/planning/votes/pending
 * Liste les votes en attente pour l'utilisateur connecté
 */
router.get('/votes/pending', authMiddleware, async (req, res) => {
  try {
    const voterObjectId = resolveVoteParticipantId(req)

    if (!voterObjectId) {
      return res.json([])
    }

    const voteFilter = {
      voter: voterObjectId,
      decision: 'pending'
    }

    const context = getVoteMagicLinkContext(req)
    if (context) {
      const scopedTpiIds = await TpiPlanning.find(
        buildScopedVoteTpiFilter(req, context.year)
      ).distinct('_id')

      if (scopedTpiIds.length === 0) {
        return res.json([])
      }

      voteFilter.tpiPlanning = { $in: scopedTpiIds }
    }

    const votes = await Vote.find(voteFilter)
      .populate({
        path: 'tpiPlanning',
        populate: [
          { path: 'candidat', select: 'firstName lastName' },
          { path: 'proposedSlots.slot', select: 'date period startTime endTime room status' }
        ]
      })
      .populate('slot', 'date period startTime endTime room')
    
    // Grouper par TPI
    const votesByTpi = {}
    
    for (const vote of votes) {
      const tpiId = vote.tpiPlanning._id.toString()
      
      if (!votesByTpi[tpiId]) {
        votesByTpi[tpiId] = {
          tpi: vote.tpiPlanning,
          slots: []
        }
      }
      
      votesByTpi[tpiId].slots.push({
        voteId: vote._id,
        slot: vote.slot,
        voterRole: vote.voterRole
      })
    }

    const groupedVotes = Object.values(votesByTpi)

    for (const group of groupedVotes) {
      const orderedSlotIds = Array.isArray(group.tpi?.proposedSlots)
        ? group.tpi.proposedSlots
          .map((proposedSlot) => proposedSlot?.slot?._id ? String(proposedSlot.slot._id) : null)
          .filter(Boolean)
        : []
      const slotOrder = new Map(orderedSlotIds.map((slotId, index) => [slotId, index]))

      group.slots.sort((a, b) => {
        const slotIdA = a.slot?._id ? String(a.slot._id) : ''
        const slotIdB = b.slot?._id ? String(b.slot._id) : ''
        const orderA = slotOrder.has(slotIdA) ? slotOrder.get(slotIdA) : Number.MAX_SAFE_INTEGER
        const orderB = slotOrder.has(slotIdB) ? slotOrder.get(slotIdB) : Number.MAX_SAFE_INTEGER

        if (orderA !== orderB) {
          return orderA - orderB
        }

        const dateA = new Date(a.slot?.date || 0).getTime()
        const dateB = new Date(b.slot?.date || 0).getTime()
        if (dateA !== dateB) {
          return dateA - dateB
        }

        const periodA = String(a.slot?.period || '')
        const periodB = String(b.slot?.period || '')
        if (periodA !== periodB) {
          return periodA.localeCompare(periodB)
        }

        return String(a.slot?.room?.name || '').localeCompare(String(b.slot?.room?.name || ''))
      })

      group.fixedSlot = group.slots[0] || null
      group.fixedVoteId = group.fixedSlot?.voteId ? String(group.fixedSlot.voteId) : null
    }

    await Promise.all(
      groupedVotes.map(async (group) => {
        const proposalData = await buildVoteProposalOptionsForTpi(group.tpi, group.slots)
        group.proposalOptions = proposalData.options
        group.proposalContext = proposalData.context
      })
    )
    
    res.json(groupedVotes)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/votes/respond/:tpiId
 * Répond au vote d'un TPI avec le nouveau flux OK ou Proposition
 */
router.post('/votes/respond/:tpiId', authMiddleware, requireObjectIdParam('tpiId', 'Identifiant TPI'), async (req, res) => {
  try {
    const voterObjectId = resolveVoteParticipantId(req)

    if (!voterObjectId) {
      return res.status(403).json({ error: 'Non autorisé à voter' })
    }

    const mode = typeof req.body?.mode === 'string'
      ? req.body.mode.trim().toLowerCase()
      : ''
    const fixedVoteId = typeof req.body?.fixedVoteId === 'string'
      ? req.body.fixedVoteId.trim()
      : ''
    const proposedSlotIds = Array.isArray(req.body?.proposedSlotIds)
      ? [...new Set(
          req.body.proposedSlotIds
            .filter(value => typeof value === 'string')
            .map(value => value.trim())
            .filter(Boolean)
        )]
      : []
    const specialRequest = isPlainObject(req.body?.specialRequest)
      ? req.body.specialRequest
      : null
    const specialRequestReason = typeof specialRequest?.reason === 'string'
      ? specialRequest.reason.trim()
      : ''
    const specialRequestDate = toDateOrNull(specialRequest?.requestedDate)
    const hasSpecialRequest = Boolean(specialRequestReason || specialRequest?.requestedDate)

    if (!ALLOWED_VOTE_RESPONSE_MODES.has(mode)) {
      return res.status(400).json({ error: 'mode invalide (ok, proposal)' })
    }

    if (!isValidObjectId(fixedVoteId)) {
      return res.status(400).json({ error: 'fixedVoteId invalide' })
    }

    if (proposedSlotIds.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 créneaux proposés par réponse.' })
    }

    if (proposedSlotIds.some(slotId => !isValidObjectId(slotId))) {
      return res.status(400).json({ error: 'proposedSlotIds contient un identifiant invalide.' })
    }

    if (mode === 'ok' && proposedSlotIds.length > 0) {
      return res.status(400).json({ error: 'Le mode OK ne permet pas de proposer d autres créneaux.' })
    }

    if (mode === 'ok' && hasSpecialRequest) {
      return res.status(400).json({ error: 'La demande spéciale est réservée au mode Proposition.' })
    }

    if (hasSpecialRequest && (!specialRequestReason || !specialRequestDate)) {
      return res.status(400).json({
        error: 'La demande spéciale exige une raison libre et une date demandée.'
      })
    }

    if (mode === 'proposal' && proposedSlotIds.length === 0 && !hasSpecialRequest) {
      return res.status(400).json({
        error: 'Choisissez jusqu à 3 créneaux ou saisissez une demande spéciale.'
      })
    }

    const tpi = await TpiPlanning.findById(req.params.tpiId)
      .populate('proposedSlots.slot', 'date period startTime endTime room status')

    if (!tpi) {
      return res.status(404).json({ error: 'TPI non trouvé' })
    }

    if (!isVoteScopeCompatibleWithTpi(req, tpi, tpi.year)) {
      return rejectVoteScope(res, 'TPI hors scope du lien de vote.')
    }

    const existingVotes = await Vote.find({
      tpiPlanning: tpi._id,
      voter: voterObjectId
    })
      .select('tpiPlanning slot voter voterRole decision comment availabilityException specialRequestReason specialRequestDate priority')
      .sort({ createdAt: 1 })

    if (existingVotes.length === 0) {
      return res.status(404).json({ error: 'Aucun vote disponible pour ce TPI.' })
    }

    const existingVotesById = new Map(
      existingVotes.map(vote => [String(vote._id), vote])
    )
    const existingVotesBySlotId = new Map(
      existingVotes.map(vote => [String(vote.slot), vote])
    )

    const fixedVote = existingVotesById.get(fixedVoteId)
    if (!fixedVote) {
      return res.status(400).json({ error: 'fixedVoteId ne correspond pas à ce TPI.' })
    }

    const fixedSlotId = getFixedSlotIdFromTpi(tpi)
    if (fixedSlotId && String(fixedVote.slot) !== fixedSlotId) {
      return res.status(400).json({ error: 'fixedVoteId doit pointer vers la date fixée du TPI.' })
    }

    const allowedProposalSlotIds = new Set(
      existingVotes
        .map(vote => String(vote.slot))
        .filter(slotId => slotId !== fixedSlotId)
    )

    const additionalProposalData = await buildVoteProposalOptionsForTpi(tpi, [])
    for (const option of additionalProposalData.options) {
      if (option?.slotId && option.slotId !== fixedSlotId) {
        allowedProposalSlotIds.add(option.slotId)
      }
    }

    for (const slotId of proposedSlotIds) {
      if (!allowedProposalSlotIds.has(slotId)) {
        return res.status(400).json({
          error: 'Un créneau proposé ne fait plus partie des options autorisées pour ce vote.'
        })
      }
    }

    const proposalSelectionSet = new Set(proposedSlotIds)
    const fixedDecision = mode === 'ok' ? 'accepted' : 'rejected'
    const fixedComment = mode === 'proposal'
      ? (hasSpecialRequest ? specialRequestReason : 'Proposition de créneaux alternatifs')
      : ''
    const voterRole = fixedVote.voterRole
    const sharedSpecialReason = hasSpecialRequest ? specialRequestReason : ''
    const sharedSpecialDate = hasSpecialRequest ? specialRequestDate : null

    for (const vote of existingVotes) {
      const slotId = String(vote.slot)
      const isFixedSlot = slotId === fixedSlotId
      const isSelectedProposal = proposalSelectionSet.has(slotId)

      vote.decision = isFixedSlot
        ? fixedDecision
        : isSelectedProposal
          ? 'preferred'
          : 'rejected'
      vote.comment = isFixedSlot ? fixedComment : ''
      vote.availabilityException = hasSpecialRequest
      vote.specialRequestReason = sharedSpecialReason
      vote.specialRequestDate = sharedSpecialDate
      vote.priority = isSelectedProposal
        ? proposedSlotIds.indexOf(slotId) + 1
        : undefined
      vote.votedAt = new Date()
      vote.magicLinkUsed = req.headers.authorization
      await vote.save()
    }

    for (const slotId of proposedSlotIds) {
      if (existingVotesBySlotId.has(slotId)) {
        continue
      }

      const createdVote = new Vote({
        tpiPlanning: tpi._id,
        slot: slotId,
        voter: voterObjectId,
        voterRole,
        decision: 'preferred',
        comment: '',
        availabilityException: hasSpecialRequest,
        specialRequestReason: sharedSpecialReason,
        specialRequestDate: sharedSpecialDate,
        priority: proposedSlotIds.indexOf(slotId) + 1,
        votedAt: new Date(),
        magicLinkUsed: req.headers.authorization
      })

      await createdVote.save()
    }

    const validationResult = await schedulingService.registerVoteAndCheckValidation(
      fixedVote._id,
      fixedDecision,
      fixedComment
    )

    return res.json({
      success: true,
      mode,
      proposedCount: proposedSlotIds.length,
      hasSpecialRequest,
      validation: validationResult
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/votes/bulk
 * Soumet plusieurs votes en une fois (pour un TPI)
 */
router.post('/votes/bulk', authMiddleware, async (req, res) => {
  try {
    const { votes } = req.body // [{ voteId, decision, comment, priority, availabilityException }]
    const context = getVoteMagicLinkContext(req)
    const voterObjectId = resolveVoteParticipantId(req)
    
    if (!Array.isArray(votes) || votes.length === 0) {
      return res.status(400).json({ error: 'votes doit être un tableau non vide' })
    }

    if (!voterObjectId) {
      return res.status(403).json({ error: 'Non autorisé à voter' })
    }

    for (const voteData of votes) {
      if (!isPlainObject(voteData)) {
        return res.status(400).json({ error: 'Chaque vote doit être un objet' })
      }

      if (!isValidObjectId(voteData.voteId)) {
        return res.status(400).json({ error: 'voteId invalide dans la liste des votes' })
      }

      if (!ALLOWED_VOTE_DECISIONS.has(voteData.decision)) {
        return res.status(400).json({
          error: 'decision invalide dans la liste des votes (accepted, rejected, preferred)'
        })
      }

      if (voteData.priority !== undefined) {
        const parsedPriority = toInteger(voteData.priority)
        if (!parsedPriority || parsedPriority < 1) {
          return res.status(400).json({ error: 'priority invalide dans la liste des votes' })
        }
      }

      if (voteData.availabilityException !== undefined && typeof voteData.availabilityException !== 'boolean') {
        return res.status(400).json({
          error: 'availabilityException doit être un booléen dans la liste des votes'
        })
      }
    }
    
    const results = []
    let firstSuccessfulVoteId = null
    let firstSuccessfulDecision = null
    
    for (const voteData of votes) {
      const vote = await Vote.findById(voteData.voteId)
        .populate('tpiPlanning', 'year')
      
      if (!vote || vote.voter.toString() !== voterObjectId.toString()) {
        results.push({ voteId: voteData.voteId, success: false, error: 'Non autorisé' })
        continue
      }

      if (context && Number(vote.tpiPlanning?.year) !== Number(context.year)) {
        results.push({ voteId: voteData.voteId, success: false, error: 'Hors scope du lien de vote' })
        continue
      }

      if (context?.scope?.tpiId && String(vote.tpiPlanning?._id || '') !== String(context.scope.tpiId)) {
        results.push({ voteId: voteData.voteId, success: false, error: 'Hors scope du lien de vote' })
        continue
      }

      if (voteData.decision === 'preferred') {
        const preferredCount = await getPreferredVoteCountForVoter({
          tpiPlanningId: vote.tpiPlanning._id || vote.tpiPlanning,
          voterId: voterObjectId,
          excludeVoteId: vote._id
        })

      if (preferredCount + 1 > 3) {
        results.push({
          voteId: voteData.voteId,
          success: false,
          error: 'Maximum 3 créneaux alternatifs par TPI et par votant.'
        })
        continue
      }
      }
      
      vote.decision = voteData.decision
      vote.comment = voteData.comment
      vote.availabilityException = Boolean(voteData.availabilityException)
      vote.priority = voteData.priority === undefined
        ? undefined
        : toInteger(voteData.priority)
      await vote.save()
      
      results.push({ voteId: voteData.voteId, success: true })

      if (!firstSuccessfulVoteId) {
        firstSuccessfulVoteId = vote._id
        firstSuccessfulDecision = voteData.decision
      }
    }
    
    // Vérifier la validation après tous les votes
    if (firstSuccessfulVoteId) {
      const validationResult = await schedulingService.registerVoteAndCheckValidation(
        firstSuccessfulVoteId,
        firstSuccessfulDecision
      )
      
      return res.json({ results, validation: validationResult })
    }
    
    res.json({ results })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/votes/:id
 * Soumet un vote
 */
router.post('/votes/:id', authMiddleware, requireObjectIdParam('id', 'Identifiant de vote'), async (req, res) => {
  try {
    const { decision, comment } = req.body
    const context = getVoteMagicLinkContext(req)
    const voterObjectId = resolveVoteParticipantId(req)
    const priority = req.body?.priority === undefined
      ? undefined
      : toInteger(req.body.priority)
    
    if (!decision || !ALLOWED_VOTE_DECISIONS.has(decision)) {
      return res.status(400).json({ error: 'decision invalide (accepted, rejected, preferred)' })
    }

    if (req.body?.priority !== undefined && (!priority || priority < 1)) {
      return res.status(400).json({ error: 'priority doit être un entier >= 1' })
    }

    if (
      req.body?.availabilityException !== undefined &&
      typeof req.body.availabilityException !== 'boolean'
    ) {
      return res.status(400).json({ error: 'availabilityException doit être un booléen' })
    }

    if (!voterObjectId) {
      return res.status(403).json({ error: 'Non autorisé à voter' })
    }
    
    const vote = await Vote.findById(req.params.id)
      .populate('tpiPlanning', 'year')
    
    if (!vote) {
      return res.status(404).json({ error: 'Vote non trouvé' })
    }
    
    // Vérifier que c'est bien le votant
    if (vote.voter.toString() !== voterObjectId.toString()) {
      return res.status(403).json({ error: 'Non autorisé à voter' })
    }

    if (context && Number(vote.tpiPlanning?.year) !== Number(context.year)) {
      return rejectVoteScope(res, 'Vote hors scope du lien de vote.')
    }

    if (context?.scope?.tpiId && String(vote.tpiPlanning?._id || '') !== String(context.scope.tpiId)) {
      return rejectVoteScope(res, 'Vote hors scope du lien de vote.')
    }

    if (decision === 'preferred') {
      const preferredCount = await getPreferredVoteCountForVoter({
        tpiPlanningId: vote.tpiPlanning._id || vote.tpiPlanning,
        voterId: voterObjectId,
        excludeVoteId: vote._id
      })

      if (preferredCount + 1 > 3) {
        return res.status(400).json({ error: 'Maximum 3 créneaux alternatifs par TPI et par votant.' })
      }
    }
    
    vote.decision = decision
    vote.comment = comment
    vote.availabilityException = Boolean(req.body?.availabilityException)
    vote.priority = priority
    vote.votedAt = new Date()
    vote.magicLinkUsed = req.headers.authorization
    
    await vote.save()
    
    // Vérifier si la validation automatique est possible
    const result = await schedulingService.registerVoteAndCheckValidation(
      vote._id,
      decision,
      comment
    )
    
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// ROUTES DISPONIBILITÉS (pour drag & drop)
// ============================================

/**
 * GET /api/planning/availability/:year/:tpiId
 * Retourne les créneaux disponibles pour un TPI (pour le drag & drop)
 */
router.get('/availability/:year/:tpiId', authMiddleware, requireYearParam('year'), requireObjectIdParam('tpiId', 'Identifiant TPI'), async (req, res) => {
  try {
    if (getVoteMagicLinkContext(req)) {
      return rejectVoteScope(res, 'Disponibilites reservees a l administration.')
    }

    const availableSlots = await schedulingService.findAvailableSlotsForTpi(req.params.tpiId)

    const slotIds = availableSlots
      .map(slotInfo => slotInfo.slot)
      .filter(Boolean)

    const slots = await Slot.find({ _id: { $in: slotIds } })
    const slotsById = new Map(slots.map(slot => [String(slot._id), slot]))

    const enrichedSlots = availableSlots.flatMap(slotInfo => {
      const slot = slotsById.get(String(slotInfo.slot))

      if (!slot) {
        return []
      }

      return [{
        ...slotInfo,
        slotDetails: {
          id: slot._id,
          date: slot.date,
          period: slot.period,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room
        }
      }]
    })
    
    res.json(enrichedSlots)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/assign/:slotId
 * Assigne un TPI à un créneau (drag & drop final)
 */
router.post('/assign/:slotId', authMiddleware, requireObjectIdParam('slotId', 'Identifiant de créneau'), requireRole('admin'), async (req, res) => {
  try {
    const { tpiId } = req.body

    if (!isValidObjectId(tpiId)) {
      return res.status(400).json({ error: 'tpiId invalide' })
    }
    
    const result = await schedulingService.confirmSlotForTpi(tpiId, req.params.slotId)
    
    if (result.success) {
      // Envoyer les confirmations
      const tpi = await TpiPlanning.findById(tpiId)
        .populate('candidat expert1 expert2 chefProjet')
      
      const recipients = [tpi.candidat, tpi.expert1, tpi.expert2, tpi.chefProjet]
      await emailService.sendSoutenanceConfirmations(tpi, result.slot, recipients)
    }
    
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/planning/tpi/:id/resend-votes
 * Renvoie les demandes de vote pour un TPI
 */
router.post('/tpi/:id/resend-votes', authMiddleware, requireObjectIdParam('id', 'Identifiant TPI'), requireRole('admin'), async (req, res) => {
  try {
    const tpi = await TpiPlanning.findById(req.params.id)
      .populate('candidat expert1 expert2 chefProjet')
      .populate('proposedSlots.slot')
    
    if (!tpi) {
      return res.status(404).json({ error: 'TPI non trouvé' })
    }
    
    if (!tpi.proposedSlots || tpi.proposedSlots.length === 0) {
      return res.status(400).json({ error: 'Aucun créneau proposé pour ce TPI' })
    }
    
    const baseUrl = `${req.protocol}://${req.get('host')}/api/planning`
    
    // Générer les magic links pour chaque votant
    const voters = [
      { person: tpi.expert1, role: 'expert1' },
      { person: tpi.expert2, role: 'expert2' },
      { person: tpi.chefProjet, role: 'chef_projet' }
    ]
    
    const magicLinks = []
    
    for (const voter of voters) {
      if (voter.person) {
        const link = await magicLinkService.generateMagicLink(voter.person.email, baseUrl)
        magicLinks.push({
          ...link,
          email: voter.person.email,
          personName: `${voter.person.firstName} ${voter.person.lastName}`,
          role: voter.role,
          slots: tpi.proposedSlots.map(ps => ({
            date: ps.slot.date.toLocaleDateString('fr-CH'),
            period: ps.slot.period,
            startTime: ps.slot.startTime,
            endTime: ps.slot.endTime,
            room: ps.slot.room.name
          }))
        })
      }
    }
    
    // Envoyer les emails
    await emailService.sendVoteRequests(tpi, magicLinks)
    
    res.json({ 
      success: true, 
      message: 'Demandes de vote renvoyées avec succès',
      emailsSent: magicLinks.length 
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
