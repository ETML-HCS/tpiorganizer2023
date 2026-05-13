const Person = require('../../models/personModel')
const TpiPlanning = require('../../models/tpiCoordinationModel')
const Vote = require('../../models/voteModel')
const {
  ResolutionProposal
} = require('../../models/resolutionProposalModel')
const accessLinkTokenService = require('./tokenService')
const resolutionProposalService = require('../../services/resolutionProposalService')
const {
  ensureVoteRecordsForTpis: defaultEnsureVoteRecordsForTpis
} = require('../../services/votingCampaignService')
const {
  getActivePublicationVersion,
  getPublicationVersion,
  listPublicationVersions,
  publishConfirmedPlanningSoutenances: defaultPublishConfirmedPlanningSoutenances
} = require('../../services/publishedSoutenanceService')
const { buildDefensePublicPath } = require('../../utils/publicRoutes')
const {
  ADMIN_ACCESS_LINK_SOURCE,
  ADMIN_ACCESS_REVOKE_SOURCES,
  getVoteAccessLinkSource,
  getVoteAccessRevokeSources,
  getSoutenanceAccessLinkSource,
  getSoutenanceAccessRevokeSources,
  normalizeVoteLinkTarget,
  normalizeSoutenanceLinkTarget
} = require('./constants')
const {
  COORDINATION_PROPOSAL_READY_STATUSES,
  COORDINATION_VOTE_STATUSES,
  COORDINATION_WORKFLOW_FREE_VOTE_STATUSES,
  normalizeCoordinationStatus
} = require('../coordination/status')
const {
  formatTpiStakeholderRoleLabel
} = require('../stakeholders/stakeholderDefinitions')

function compactText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function parsePublicationVersion(value) {
  if (value === null || value === undefined || value === '' || value === 'active') {
    return null
  }

  const parsed = Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function formatPersonName(person) {
  return [person?.firstName, person?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function buildPersonSnapshot(person) {
  return {
    id: person?._id ? String(person._id) : '',
    name: formatPersonName(person) || compactText(person?.name || person?.fullName),
    email: typeof person?.email === 'string' ? person.email : '',
    roles: Array.isArray(person?.roles) ? person.roles : [],
    site: typeof person?.site === 'string' ? person.site : ''
  }
}

function ensurePersonEntry(map, person) {
  const personId = person?._id ? String(person._id) : ''

  if (!personId) {
    return null
  }

  if (!map.has(personId)) {
    map.set(personId, {
      person: buildPersonSnapshot(person),
      voteLinks: [],
      soutenanceLinks: [],
      arbitrageLinks: []
    })
  }

  return map.get(personId)
}

function sortPeople(entries = []) {
  return [...entries].sort((left, right) => {
    const leftName = String(left?.person?.name || left?.person?.email || '').toLowerCase()
    const rightName = String(right?.person?.name || right?.person?.email || '').toLowerCase()

    if (leftName !== rightName) {
      return leftName.localeCompare(rightName)
    }

    return String(left?.person?.email || '').localeCompare(String(right?.person?.email || ''))
  })
}

function sortVoteLinks(links = []) {
  return [...links].sort((left, right) => {
    const leftReference = String(left?.reference || '')
    const rightReference = String(right?.reference || '')

    if (leftReference !== rightReference) {
      return leftReference.localeCompare(rightReference)
    }

    return String(left?.role || '').localeCompare(String(right?.role || ''))
  })
}

function addVotePreviewTpi(target, vote, tpi) {
  const tpiId = tpi?._id ? String(tpi._id) : ''
  if (!tpiId) {
    return
  }

  if (!target.tpisById.has(tpiId)) {
    target.tpisById.set(tpiId, {
      tpiId,
      reference: tpi.reference || '',
      subject: tpi.sujet || '',
      candidateName: formatPersonName(tpi.candidat),
      status: tpi.status || '',
      roleLabels: new Set()
    })
  }

  const entry = target.tpisById.get(tpiId)
  if (vote?.voterRole) {
    entry.roleLabels.add(formatTpiStakeholderRoleLabel(vote.voterRole))
  }
}

function canPrepareVoteAccessForPerson(person) {
  return Boolean(person?._id && person?.email) && person.sendEmails !== false
}

function canPrepareSoutenanceAccessForPerson(person) {
  return Boolean(person?._id && person?.email) && person.sendEmails !== false
}

function listPlanningVoteParticipants(tpi) {
  return [
    { person: tpi?.chefProjet, role: 'chef_projet' },
    { person: tpi?.expert1, role: 'expert1' },
    { person: tpi?.expert2, role: 'expert2' }
  ].filter((entry) => canPrepareVoteAccessForPerson(entry.person))
}

function addWorkflowFreeVotePreviewTargets({
  tpis = [],
  groupedPendingVotes,
  coveredVoteKeys
}) {
  for (const tpi of Array.isArray(tpis) ? tpis : []) {
    if (!COORDINATION_PROPOSAL_READY_STATUSES.includes(normalizeCoordinationStatus(tpi?.status))) {
      continue
    }

    if (!Array.isArray(tpi?.proposedSlots) || tpi.proposedSlots.length === 0) {
      continue
    }

    const tpiId = tpi?._id ? String(tpi._id) : ''
    if (!tpiId) {
      continue
    }

    for (const { person, role } of listPlanningVoteParticipants(tpi)) {
      const voterId = person?._id ? String(person._id) : ''
      const voteKey = `${tpiId}|${voterId}|${role}`

      if (!voterId || coveredVoteKeys.has(voteKey)) {
        continue
      }

      if (!groupedPendingVotes.has(voterId)) {
        groupedPendingVotes.set(voterId, {
          voter: person,
          tpisById: new Map()
        })
      }

      addVotePreviewTpi(groupedPendingVotes.get(voterId), { voterRole: role }, tpi)
      coveredVoteKeys.add(voteKey)
    }
  }
}

function sortSoutenanceLinks(links = []) {
  return [...links].sort((left, right) => {
    return Number(right?.publicationVersion || 0) - Number(left?.publicationVersion || 0)
  })
}

function sortArbitrageLinks(links = []) {
  return [...links].sort((left, right) => {
    const leftCreatedAt = left?.createdAt ? new Date(left.createdAt).getTime() : 0
    const rightCreatedAt = right?.createdAt ? new Date(right.createdAt).getTime() : 0

    if (leftCreatedAt !== rightCreatedAt) {
      return rightCreatedAt - leftCreatedAt
    }

    return String(left?.reference || '').localeCompare(String(right?.reference || ''))
  })
}

function normalizePublicationVersions(versions = []) {
  return (Array.isArray(versions) ? versions : [])
    .map((entry) => {
      const publishedAt = entry?.publishedAt ? new Date(entry.publishedAt) : null

      return {
        version: Number.parseInt(entry?.version, 10),
        isActive: entry?.isActive === true,
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt.toISOString() : null,
        roomsCount: Number.isFinite(Number(entry?.source?.roomsCount))
          ? Number(entry.source.roomsCount)
          : null,
        confirmedTpiCount: Number.isFinite(Number(entry?.source?.confirmedTpiCount))
          ? Number(entry.source.confirmedTpiCount)
          : null,
        generatedLinkCount: 0,
        recoverableGeneratedLinkCount: 0,
        totalGeneratedLinkCount: 0,
        unrecoverableGeneratedLinkCount: 0,
        expiredGeneratedLinkCount: 0,
        revokedGeneratedLinkCount: 0,
        exhaustedGeneratedLinkCount: 0,
        generatedLinkEarliestExpiry: null,
        generatedLinkLatestExpiry: null
      }
    })
    .filter((entry) => Number.isInteger(entry.version) && entry.version > 0)
    .sort((left, right) => right.version - left.version)
}

function buildPublicationLinkStatsMap(stats = []) {
  const map = new Map()

  for (const entry of Array.isArray(stats) ? stats : []) {
    const version = Number.parseInt(entry?.publicationVersion, 10)
    if (!Number.isInteger(version) || version <= 0) {
      continue
    }

    map.set(version, {
      generatedLinkCount: Number(entry?.generatedLinkCount || 0),
      recoverableGeneratedLinkCount: Number(entry?.recoverableGeneratedLinkCount || 0),
      totalGeneratedLinkCount: Number(entry?.totalGeneratedLinkCount || 0),
      unrecoverableGeneratedLinkCount: Number(entry?.unrecoverableGeneratedLinkCount || 0),
      expiredGeneratedLinkCount: Number(entry?.expiredGeneratedLinkCount || 0),
      revokedGeneratedLinkCount: Number(entry?.revokedGeneratedLinkCount || 0),
      exhaustedGeneratedLinkCount: Number(entry?.exhaustedGeneratedLinkCount || 0),
      generatedLinkEarliestExpiry: entry?.earliestExpiry || null,
      generatedLinkLatestExpiry: entry?.latestExpiry || null
    })
  }

  return map
}

async function getSoutenancePublicationLinkStats(year, magicLinks, sources = [ADMIN_ACCESS_LINK_SOURCE]) {
  if (typeof magicLinks?.listSoutenancePublicationAccessLinkStats !== 'function') {
    return new Map()
  }

  const stats = await magicLinks.listSoutenancePublicationAccessLinkStats({
    year,
    sources
  })

  return buildPublicationLinkStatsMap(stats)
}

function applyPublicationLinkStats(versions = [], statsByVersion = new Map()) {
  return versions
    .map((entry) => ({
      ...entry,
      ...(statsByVersion.get(entry.version) || {})
    }))
    .filter((entry) =>
      entry.isActive === true ||
      Number(entry.recoverableGeneratedLinkCount || 0) > 0
    )
}

function buildPendingLink({ redirectPath }) {
  return {
    redirectPath,
    expiresAt: null,
    token: null,
    url: null,
    generated: false
  }
}

const ACCESS_PREVIEW_PHASES = Object.freeze(['vote', 'soutenance', 'arbitrage'])

function normalizePreviewPhases(phases) {
  const source = Array.isArray(phases)
    ? phases
    : typeof phases === 'string'
      ? phases.split(',')
      : []
  const normalized = source
    .map((phase) => compactText(phase).toLowerCase())
    .filter((phase) => ACCESS_PREVIEW_PHASES.includes(phase))

  return new Set(normalized.length > 0 ? normalized : ACCESS_PREVIEW_PHASES)
}

function getLinkAvailabilityStatus(link = {}) {
  if (link.availabilityStatus) {
    return link.availabilityStatus
  }

  if (link.url) {
    return 'available'
  }

  if (link.generated === true && link.recoverable === false) {
    return 'unrecoverable'
  }

  return link.generated === true ? 'unavailable' : 'missing'
}

function createLinkAvailabilityCounters() {
  return {
    unavailableGeneratedLinkCount: 0,
    unrecoverableGeneratedLinkCount: 0,
    expiredGeneratedLinkCount: 0,
    revokedGeneratedLinkCount: 0,
    exhaustedGeneratedLinkCount: 0
  }
}

function updateLinkAvailabilityCounters(counters, link = {}) {
  if (link.generated !== true || link.url) {
    return
  }

  const status = getLinkAvailabilityStatus(link)
  counters.unavailableGeneratedLinkCount += 1

  if (status === 'expired') {
    counters.expiredGeneratedLinkCount += 1
  } else if (status === 'revoked') {
    counters.revokedGeneratedLinkCount += 1
  } else if (status === 'exhausted') {
    counters.exhaustedGeneratedLinkCount += 1
  } else if (status === 'unrecoverable' || link.recoverable === false) {
    counters.unrecoverableGeneratedLinkCount += 1
  }
}

function copyLinkStatusFields(link = {}) {
  return {
    availabilityStatus: getLinkAvailabilityStatus(link),
    revokedAt: link.revokedAt || null,
    maxUses: Number.isFinite(Number(link.maxUses)) ? Number(link.maxUses) : null,
    usageCount: Number.isFinite(Number(link.usageCount)) ? Number(link.usageCount) : null,
    lastUsedAt: link.lastUsedAt || null
  }
}

async function findReusableAdminAccessLink({
  magicLinks,
  year,
  type,
  person,
  scope = {},
  baseUrl,
  sources = [ADMIN_ACCESS_LINK_SOURCE]
}) {
  if (typeof magicLinks.findReusableMagicLink !== 'function') {
    return null
  }

  return await magicLinks.findReusableMagicLink({
    year,
    type,
    person,
    scope,
    sources,
    baseUrl
  })
}

async function findLatestAdminAccessLinkStatus({
  magicLinks,
  year,
  type,
  person,
  scope = {},
  baseUrl,
  sources = [ADMIN_ACCESS_LINK_SOURCE]
}) {
  if (typeof magicLinks.findLatestMagicLinkStatus !== 'function') {
    return null
  }

  return await magicLinks.findLatestMagicLinkStatus({
    year,
    type,
    person,
    scope,
    sources,
    baseUrl
  })
}

async function revokeAdminAccessLinks({
  magicLinks,
  year,
  type,
  person,
  scope = {},
  excludeLinkIds = [],
  sources = ADMIN_ACCESS_REVOKE_SOURCES
}) {
  if (typeof magicLinks.revokeActiveMagicLinks !== 'function') {
    throw new Error('Revocation des anciens magic links indisponible.')
  }

  return await magicLinks.revokeActiveMagicLinks({
    year,
    type,
    person,
    scope,
    sources,
    excludeIds: excludeLinkIds
  })
}

async function revokeSoutenanceAdminAccessLinks({
  magicLinks,
  year,
  person,
  scope = {},
  excludeLinkIds = [],
  target = 'app'
}) {
  if (typeof magicLinks.revokeActiveMagicLinks !== 'function') {
    throw new Error('Revocation des anciens magic links indisponible.')
  }

  return await magicLinks.revokeActiveMagicLinks({
    year,
    type: 'soutenance',
    person,
    scope,
    sources: getSoutenanceAccessRevokeSources(target),
    excludeIds: excludeLinkIds
  })
}

async function buildVoteAccessLink({
  year,
  baseUrl,
  redirectPath = null,
  person,
  generateLinks,
  magicLinks,
  target = 'app',
  generateMissingOnly = false
}) {
  const resolvedRedirectPath = redirectPath || `/coordination/${year}`
  const normalizedTarget = normalizeVoteLinkTarget(target)
  const source = getVoteAccessLinkSource(normalizedTarget)
  const scope = {
    year,
    kind: 'stakeholder_votes',
    source
  }
  const reusableScope = {
    year,
    kind: 'stakeholder_votes',
    tpiId: null,
    voterRole: null
  }

  if (!generateLinks || generateMissingOnly) {
    const existingLink = await findReusableAdminAccessLink({
      magicLinks,
      year,
      type: 'vote',
      person,
      scope: reusableScope,
      baseUrl,
      sources: getVoteAccessRevokeSources(normalizedTarget)
    })

    if (existingLink && (!generateLinks || existingLink.url)) {
      return existingLink
    }

    if (!generateLinks) {
      const latestLinkStatus = await findLatestAdminAccessLinkStatus({
        magicLinks,
        year,
        type: 'vote',
        person,
        scope: reusableScope,
        baseUrl,
        sources: getVoteAccessRevokeSources(normalizedTarget)
      })

      return latestLinkStatus || buildPendingLink({ redirectPath: resolvedRedirectPath })
    }
  }

  const link = await magicLinks.createVoteMagicLink({
    year,
    person,
    role: null,
    scope,
    baseUrl,
    redirectPath: resolvedRedirectPath,
    persistToken: true
  })

  await revokeAdminAccessLinks({
    magicLinks,
    year,
    type: 'vote',
    person,
    scope: {
      year,
      kind: 'stakeholder_votes'
    },
    excludeLinkIds: link?.id ? [link.id] : [],
    sources: getVoteAccessRevokeSources(normalizedTarget)
  })

  return {
    ...link,
    generated: true
  }
}

async function buildSoutenanceAccessLink({
  year,
  baseUrl,
  redirectPath = null,
  person,
  publicationVersion,
  generateLinks,
  magicLinks,
  target = 'app',
  generateMissingOnly = false
}) {
  const resolvedRedirectPath = redirectPath || buildDefensePublicPath(year)
  const scopedPublicationVersion = publicationVersion || null
  const source = getSoutenanceAccessLinkSource(target)
  const sourceScope = {
    kind: 'published_soutenances',
    publicationVersion: scopedPublicationVersion,
    source
  }

  if (!generateLinks || generateMissingOnly) {
    const existingLink = await findReusableAdminAccessLink({
      magicLinks,
      year,
      type: 'soutenance',
      person,
      scope: {
        publicationVersion: scopedPublicationVersion
      },
      baseUrl,
      sources: [source]
    })

    if (existingLink && (!generateLinks || existingLink.url)) {
      return existingLink
    }

    if (!generateLinks) {
      const latestLinkStatus = await findLatestAdminAccessLinkStatus({
        magicLinks,
        year,
        type: 'soutenance',
        person,
        scope: {
          publicationVersion: scopedPublicationVersion
        },
        baseUrl,
        sources: [source]
      })

      return latestLinkStatus || buildPendingLink({ redirectPath: resolvedRedirectPath })
    }
  }

  const link = await magicLinks.createSoutenanceMagicLink({
    year,
    person,
    scope: sourceScope,
    baseUrl,
    redirectPath: resolvedRedirectPath,
    persistToken: true
  })

  await revokeSoutenanceAdminAccessLinks({
    magicLinks,
    year,
    person,
    scope: {
      publicationVersion: scopedPublicationVersion
    },
    excludeLinkIds: link?.id ? [link.id] : [],
    target
  })

  return {
    ...link,
    generated: true
  }
}

async function buildVoteLinkPreview(year, baseUrl, peopleMap, dependencies) {
  const {
    TpiPlanningModel,
    VoteModel,
    magicLinks,
    generateLinks,
    voteBaseUrl,
    voteRedirectPath,
    voteLinkTarget,
    workflowFreeModeEnabled,
    ensureVoteRecordsForTpis,
    generateMissingOnly
  } = dependencies
  const normalizedVoteLinkTarget = normalizeVoteLinkTarget(voteLinkTarget)
  const voteStatuses = workflowFreeModeEnabled === true
    ? COORDINATION_WORKFLOW_FREE_VOTE_STATUSES
    : COORDINATION_VOTE_STATUSES

  const votingTpis = await TpiPlanningModel.find({
    year,
    status: { $in: voteStatuses }
  })
    .populate('candidat expert1 expert2 chefProjet', 'firstName lastName email roles site sendEmails')
    .populate('proposedSlots.slot')
    .select('reference sujet year status candidat expert1 expert2 chefProjet proposedSlots')
    .sort({ reference: 1 })

  if (!Array.isArray(votingTpis) || votingTpis.length === 0) {
    return {
      linkCount: 0,
      recipientCount: 0,
      tpiCount: 0
    }
  }

  let preparedVoteRecords = null
  if (
    generateLinks === true &&
    workflowFreeModeEnabled === true &&
    typeof ensureVoteRecordsForTpis === 'function'
  ) {
    preparedVoteRecords = await ensureVoteRecordsForTpis(
      votingTpis.filter((tpi) =>
        COORDINATION_PROPOSAL_READY_STATUSES.includes(normalizeCoordinationStatus(tpi?.status)) &&
        Array.isArray(tpi?.proposedSlots) &&
        tpi.proposedSlots.length > 0
      )
    )
  }

  const tpiById = new Map(
    votingTpis.map((tpi) => [String(tpi._id), tpi])
  )

  const pendingVotes = await VoteModel.find({
    tpiPlanning: { $in: votingTpis.map((tpi) => tpi._id) },
    decision: 'pending'
  })
    .populate('voter', 'firstName lastName email roles site')
    .select('tpiPlanning voter voterRole')

  const groupedPendingVotes = new Map()
  const coveredVoteKeys = new Set()

  for (const vote of pendingVotes || []) {
    const tpiId = vote?.tpiPlanning ? String(vote.tpiPlanning) : ''
    const voterId = vote?.voter?._id ? String(vote.voter._id) : ''

    if (!tpiId || !voterId) {
      continue
    }

    const tpi = tpiById.get(tpiId) || null
    if (!tpi) {
      continue
    }

    if (!groupedPendingVotes.has(voterId)) {
      groupedPendingVotes.set(voterId, {
        voter: vote.voter,
        tpisById: new Map()
      })
    }

    addVotePreviewTpi(groupedPendingVotes.get(voterId), vote, tpi)
    coveredVoteKeys.add(`${tpiId}|${voterId}|${vote.voterRole || ''}`)
  }

  if (workflowFreeModeEnabled === true) {
    addWorkflowFreeVotePreviewTargets({
      tpis: votingTpis,
      groupedPendingVotes,
      coveredVoteKeys
    })
  }

  const uniqueRecipients = new Set()
  const uniqueTpis = new Set()
  let linkCount = 0
  let generatedLinkCount = 0
  let availableLinkCount = 0
  const availabilityCounters = createLinkAvailabilityCounters()

  for (const item of groupedPendingVotes.values()) {
    if (!item?.voter?.email || item.tpisById.size === 0) {
      continue
    }

    const entry = ensurePersonEntry(peopleMap, item.voter)
    if (!entry) {
      continue
    }

    const tpis = Array.from(item.tpisById.values())
      .map((tpiEntry) => ({
        ...tpiEntry,
        roleLabel: Array.from(tpiEntry.roleLabels).filter(Boolean).join(', '),
        roleLabels: undefined
      }))
      .sort((left, right) => String(left.reference).localeCompare(String(right.reference)))

    const link = await buildVoteAccessLink({
      year,
      person: item.voter,
      baseUrl: voteBaseUrl || baseUrl,
      redirectPath: voteRedirectPath,
      target: normalizedVoteLinkTarget,
      generateLinks,
      magicLinks,
      generateMissingOnly
    })

    entry.voteLinks.push({
      id: link.id || null,
      type: 'vote',
      role: null,
      roleLabel: 'Partie prenante',
      reference: tpis.map((tpiEntry) => tpiEntry.reference).filter(Boolean).join(', '),
      subject: tpis.length > 1 ? `${tpis.length} TPI à traiter` : (tpis[0]?.subject || ''),
      candidateName: tpis.length > 1 ? '' : (tpis[0]?.candidateName || ''),
      status: '',
      tpiId: null,
      tpis,
      redirectPath: link.redirectPath || voteRedirectPath || `/coordination/${year}`,
      expiresAt: link.expiresAt,
      token: link.token,
      url: link.url,
      generated: link.generated === true,
      recoverable: link.recoverable !== false,
      ...copyLinkStatusFields(link)
    })

    uniqueRecipients.add(String(item.voter._id))
    for (const tpiEntry of tpis) {
      uniqueTpis.add(String(tpiEntry.tpiId))
    }
    linkCount += 1
    if (link.generated === true) {
      generatedLinkCount += 1
    }
    if (link.url) {
      availableLinkCount += 1
    }
    updateLinkAvailabilityCounters(availabilityCounters, link)
  }

  return {
    linkCount,
    generatedLinkCount,
    availableLinkCount,
    pendingLinkCount: Math.max(linkCount - availableLinkCount, 0),
    ...availabilityCounters,
    recipientCount: uniqueRecipients.size,
    tpiCount: uniqueTpis.size,
    linkTarget: normalizedVoteLinkTarget,
    baseUrl: voteBaseUrl || baseUrl,
    redirectPath: voteRedirectPath || `/coordination/${year}`,
    workflowFreeModeEnabled: workflowFreeModeEnabled === true,
    preparedVoteRecordCount: preparedVoteRecords?.voteCount || 0
  }
}

function collectPublicationPersonIds(rooms = []) {
  const personIds = new Set()

  for (const room of Array.isArray(rooms) ? rooms : []) {
    for (const tpiData of Array.isArray(room?.tpiDatas) ? room.tpiDatas : []) {
      const candidates = [
        tpiData?.candidatPersonId,
        tpiData?.expert1?.personId,
        tpiData?.expert2?.personId,
        tpiData?.boss?.personId
      ]

      for (const personId of candidates) {
        if (personId) {
          personIds.add(String(personId))
        }
      }
    }
  }

  return Array.from(personIds)
}

async function listAdminSoutenanceRecipients(PersonModel) {
  const admins = await PersonModel.find({
    roles: 'admin',
    isActive: true
  })
    .select('firstName lastName email roles site sendEmails')
    .lean()

  return (Array.isArray(admins) ? admins : [])
    .filter((person) => (
      canPrepareSoutenanceAccessForPerson(person) &&
      Array.isArray(person.roles) &&
      person.roles.includes('admin')
    ))
}

function mergeRecipientsById(recipients = [], additionalRecipients = []) {
  const byId = new Map()

  for (const person of [...(Array.isArray(recipients) ? recipients : []), ...(Array.isArray(additionalRecipients) ? additionalRecipients : [])]) {
    const personId = person?._id ? String(person._id) : ''
    if (!personId || !person?.email) {
      continue
    }

    byId.set(personId, {
      ...(byId.get(personId) || {}),
      ...person
    })
  }

  return Array.from(byId.values())
}

async function buildSoutenanceLinkPreview(year, baseUrl, peopleMap, dependencies) {
  const {
    PersonModel,
    magicLinks,
    getActivePublication,
    getPublication,
    listPublicationVersions: listVersions,
    publicationVersion: requestedPublicationVersion,
    generateLinks,
    soutenanceRedirectPath,
    soutenanceLinkTarget,
    autoPublishSoutenance,
    publicationUser,
    publishConfirmedPlanningSoutenances,
    generateMissingOnly
  } = dependencies
  const normalizedSoutenanceLinkTarget = normalizeSoutenanceLinkTarget(soutenanceLinkTarget)
  const source = getSoutenanceAccessLinkSource(normalizedSoutenanceLinkTarget)

  const normalizedRequestedVersion = parsePublicationVersion(requestedPublicationVersion)
  let publicationVersion = normalizedRequestedVersion
    ? await getPublication(year, normalizedRequestedVersion)
    : await getActivePublication(year)
  let autoPublishedPublicationVersion = null
  let autoPublishedRoomsCount = 0

  if (
    generateLinks === true &&
    autoPublishSoutenance === true &&
    !normalizedRequestedVersion &&
    !publicationVersion?.rooms?.length &&
    typeof publishConfirmedPlanningSoutenances === 'function'
  ) {
    const publishedResult = await publishConfirmedPlanningSoutenances(year, publicationUser)
    const publishedVersion = publishedResult?.publicationVersion || null

    if (publishedVersion?.rooms?.length) {
      publicationVersion = publishedVersion
      autoPublishedPublicationVersion = publishedVersion.version || null
      autoPublishedRoomsCount = publishedVersion.rooms.length
    }
  }

  const publicationLinkStats = await getSoutenancePublicationLinkStats(year, magicLinks, [source])
  const availableVersions = applyPublicationLinkStats(
    normalizePublicationVersions(await listVersions(year)),
    publicationLinkStats
  )

  if (!publicationVersion?.rooms?.length) {
    return {
      linkCount: 0,
      recipientCount: 0,
      publicationVersion: null,
      requestedPublicationVersion: normalizedRequestedVersion,
      availableVersions,
      roomsCount: 0,
      autoPublishedPublicationVersion,
      autoPublishedRoomsCount
    }
  }

  const recipientIds = collectPublicationPersonIds(publicationVersion.rooms)
  const adminRecipients = await listAdminSoutenanceRecipients(PersonModel)

  if (recipientIds.length === 0 && adminRecipients.length === 0) {
    return {
      linkCount: 0,
      recipientCount: 0,
      publicationVersion: publicationVersion.version || null,
      requestedPublicationVersion: normalizedRequestedVersion,
      availableVersions,
      roomsCount: publicationVersion.rooms.length,
      autoPublishedPublicationVersion,
      autoPublishedRoomsCount
    }
  }

  const publicationRecipients = recipientIds.length > 0
    ? await PersonModel.find({
      _id: { $in: recipientIds },
      isActive: true
    })
      .select('firstName lastName email roles site sendEmails')
      .lean()
    : []
  const recipients = mergeRecipientsById(publicationRecipients, adminRecipients)

  let linkCount = 0
  let generatedLinkCount = 0
  let availableLinkCount = 0
  const availabilityCounters = createLinkAvailabilityCounters()
  const linkedRecipientIds = new Set()

  for (const recipient of recipients || []) {
    if (!recipient?._id || !recipient?.email) {
      continue
    }

    const entry = ensurePersonEntry(peopleMap, recipient)
    if (!entry) {
      continue
    }

    const link = await buildSoutenanceAccessLink({
      year,
      person: recipient,
      baseUrl,
      redirectPath: soutenanceRedirectPath || buildDefensePublicPath(year),
      publicationVersion: publicationVersion.version || null,
      generateLinks,
      magicLinks,
      target: normalizedSoutenanceLinkTarget,
      generateMissingOnly
    })

    entry.soutenanceLinks.push({
      id: link.id || null,
      type: 'soutenance',
      publicationVersion: publicationVersion.version || null,
      redirectPath: link.redirectPath || buildDefensePublicPath(year),
      expiresAt: link.expiresAt,
      token: link.token,
      url: link.url,
      generated: link.generated === true,
      recoverable: link.recoverable !== false,
      ...copyLinkStatusFields(link)
    })

    linkedRecipientIds.add(String(recipient._id))
    linkCount += 1
    if (link.generated === true) {
      generatedLinkCount += 1
    }
    if (link.url) {
      availableLinkCount += 1
    }
    updateLinkAvailabilityCounters(availabilityCounters, link)
  }

  return {
    linkCount,
    generatedLinkCount,
    availableLinkCount,
    pendingLinkCount: Math.max(linkCount - availableLinkCount, 0),
    ...availabilityCounters,
    recipientCount: linkedRecipientIds.size,
    publicationVersion: publicationVersion.version || null,
    requestedPublicationVersion: normalizedRequestedVersion,
    availableVersions,
    roomsCount: Array.isArray(publicationVersion.rooms) ? publicationVersion.rooms.length : 0,
    autoPublishedPublicationVersion,
    autoPublishedRoomsCount
  }
}

function buildArbitragePersonSnapshot(recipient) {
  const personId = compactText(recipient?.personId || recipient?.person)

  if (!personId) {
    return null
  }

  return {
    _id: personId,
    name: compactText(recipient?.name),
    email: compactText(recipient?.email),
    roles: recipient?.role ? [recipient.role] : [],
    site: ''
  }
}

function getArbitrageLinkAvailabilityStatus(proposal, recipient) {
  if (!recipient?.publicUrl) {
    return 'unrecoverable'
  }

  if (proposal?.status === 'expired') {
    return 'expired'
  }

  if (proposal?.status === 'cancelled' || proposal?.status === 'failed') {
    return 'unavailable'
  }

  return 'available'
}

async function buildResolutionProposalLinkPreview(year, peopleMap, dependencies = {}) {
  const { ResolutionProposalModel } = dependencies

  if (!ResolutionProposalModel || typeof ResolutionProposalModel.find !== 'function') {
    return {
      linkCount: 0,
      generatedLinkCount: 0,
      pendingResponseCount: 0,
      acceptedResponseCount: 0,
      rejectedResponseCount: 0,
      recipientCount: 0,
      proposalCount: 0
    }
  }

  const proposals = await ResolutionProposalModel.find({ year })
    .sort({ createdAt: -1 })

  const recipientIds = new Set()
  const proposalIds = new Set()
  let linkCount = 0
  let generatedLinkCount = 0
  let pendingResponseCount = 0
  let acceptedResponseCount = 0
  let rejectedResponseCount = 0

  for (const rawProposal of Array.isArray(proposals) ? proposals : []) {
    const proposal = resolutionProposalService.serializeProposal(rawProposal)

    if (!proposal?.id) {
      continue
    }

    proposalIds.add(proposal.id)

    for (const recipient of Array.isArray(proposal.recipients) ? proposal.recipients : []) {
      const person = buildArbitragePersonSnapshot(recipient)
      const entry = ensurePersonEntry(peopleMap, person)

      if (!entry) {
        continue
      }

      const responseStatus = compactText(recipient.responseStatus) || 'pending'
      const publicUrl = compactText(recipient.publicUrl)

      entry.arbitrageLinks.push({
        type: 'arbitrage',
        proposalId: proposal.id,
        tpiId: proposal.tpiId,
        reference: proposal.tpiReference,
        subject: proposal.subject,
        candidateName: proposal.candidateName,
        role: recipient.role,
        roleLabel: recipient.roleLabel,
        status: proposal.status,
        responseStatus,
        responseReason: recipient.responseReason,
        alternativeProposal: recipient.alternativeProposal,
        proposedSlotId: proposal.proposedSlotId,
        proposedSlotLabel: proposal.proposedSlotLabel,
        message: proposal.message,
        devMode: proposal.devMode === true,
        deliveryStatus: recipient.deliveryStatus,
        deliveryError: recipient.deliveryError,
        sentAt: recipient.sentAt || proposal.sentAt,
        createdAt: proposal.createdAt,
        expiresAt: proposal.expiresAt,
        url: publicUrl || null,
        generated: true,
        recoverable: Boolean(publicUrl),
        availabilityStatus: getArbitrageLinkAvailabilityStatus(proposal, recipient)
      })

      recipientIds.add(person._id)
      linkCount += 1
      if (publicUrl) {
        generatedLinkCount += 1
      }
      if (responseStatus === 'accepted') {
        acceptedResponseCount += 1
      } else if (responseStatus === 'rejected') {
        rejectedResponseCount += 1
      } else {
        pendingResponseCount += 1
      }
    }
  }

  return {
    linkCount,
    generatedLinkCount,
    pendingResponseCount,
    acceptedResponseCount,
    rejectedResponseCount,
    recipientCount: recipientIds.size,
    proposalCount: proposalIds.size
  }
}

async function buildAccessLinkPreview({
  year,
  baseUrl,
  voteBaseUrl = null,
  voteRedirectPath = null,
  voteLinkTarget = 'app',
  soutenanceBaseUrl = null,
  soutenanceRedirectPath = null,
  soutenanceLinkTarget = 'app',
  publicationVersion = null,
  autoPublishSoutenance = false,
  publicationUser = null,
  generateLinks = false,
  generateMissingOnly = false,
  phases = null,
  workflowFreeModeEnabled = false,
  dependencies = {}
}) {
  const normalizedYear = Number.parseInt(year, 10)
  const normalizedSoutenanceLinkTarget = normalizeSoutenanceLinkTarget(soutenanceLinkTarget)
  const resolvedSoutenanceBaseUrl = typeof soutenanceBaseUrl === 'string' && soutenanceBaseUrl.trim()
    ? soutenanceBaseUrl.trim()
    : baseUrl
  const selectedPhases = normalizePreviewPhases(phases)
  const peopleMap = new Map()
  const hasInjectedDependencies = Object.keys(dependencies || {}).length > 0
  const resolvedDependencies = {
    PersonModel: dependencies.PersonModel || Person,
    TpiPlanningModel: dependencies.TpiPlanningModel || TpiPlanning,
    VoteModel: dependencies.VoteModel || Vote,
    ResolutionProposalModel: dependencies.ResolutionProposalModel || (hasInjectedDependencies ? null : ResolutionProposal),
    magicLinks: dependencies.magicLinks || accessLinkTokenService,
    getActivePublication: dependencies.getActivePublication || getActivePublicationVersion,
    getPublication: dependencies.getPublication || getPublicationVersion,
    listPublicationVersions: dependencies.listPublicationVersions || listPublicationVersions,
    publishConfirmedPlanningSoutenances: dependencies.publishConfirmedPlanningSoutenances ||
      (hasInjectedDependencies ? null : defaultPublishConfirmedPlanningSoutenances),
    publicationVersion,
    autoPublishSoutenance: autoPublishSoutenance === true,
    publicationUser,
    generateLinks: generateLinks === true,
    generateMissingOnly: generateMissingOnly === true,
    workflowFreeModeEnabled: workflowFreeModeEnabled === true,
    ensureVoteRecordsForTpis: dependencies.ensureVoteRecordsForTpis || defaultEnsureVoteRecordsForTpis,
    voteBaseUrl: typeof voteBaseUrl === 'string' && voteBaseUrl.trim()
      ? voteBaseUrl.trim()
      : baseUrl,
    voteRedirectPath: typeof voteRedirectPath === 'string' && voteRedirectPath.trim()
      ? voteRedirectPath.trim()
      : `/coordination/${normalizedYear}`,
    voteLinkTarget: normalizeVoteLinkTarget(voteLinkTarget),
    soutenanceRedirectPath: typeof soutenanceRedirectPath === 'string' && soutenanceRedirectPath.trim()
      ? soutenanceRedirectPath.trim()
      : buildDefensePublicPath(normalizedYear),
    soutenanceLinkTarget: normalizedSoutenanceLinkTarget
  }

  const votePreview = selectedPhases.has('vote')
    ? await buildVoteLinkPreview(
      normalizedYear,
      baseUrl,
      peopleMap,
      resolvedDependencies
    )
    : {
        linkCount: 0,
        generatedLinkCount: 0,
        availableLinkCount: 0,
        pendingLinkCount: 0,
        ...createLinkAvailabilityCounters(),
        recipientCount: 0,
        tpiCount: 0,
        linkTarget: resolvedDependencies.voteLinkTarget,
        baseUrl: resolvedDependencies.voteBaseUrl,
        redirectPath: resolvedDependencies.voteRedirectPath,
        workflowFreeModeEnabled: resolvedDependencies.workflowFreeModeEnabled,
        preparedVoteRecordCount: 0
      }
  const soutenancePreview = selectedPhases.has('soutenance')
    ? await buildSoutenanceLinkPreview(
      normalizedYear,
      resolvedSoutenanceBaseUrl,
      peopleMap,
      resolvedDependencies
    )
    : {
        linkCount: 0,
        generatedLinkCount: 0,
        availableLinkCount: 0,
        pendingLinkCount: 0,
        ...createLinkAvailabilityCounters(),
        recipientCount: 0,
        publicationVersion: null,
        requestedPublicationVersion: parsePublicationVersion(publicationVersion),
        availableVersions: [],
        roomsCount: 0,
        autoPublishedPublicationVersion: null,
        autoPublishedRoomsCount: 0
      }
  const arbitragePreview = selectedPhases.has('arbitrage')
    ? await buildResolutionProposalLinkPreview(
      normalizedYear,
      peopleMap,
      resolvedDependencies
    )
    : {
        linkCount: 0,
        generatedLinkCount: 0,
        pendingResponseCount: 0,
        acceptedResponseCount: 0,
        rejectedResponseCount: 0,
        recipientCount: 0,
        proposalCount: 0
      }

  const people = sortPeople(Array.from(peopleMap.values()))
    .map((entry) => ({
      ...entry,
      voteLinks: sortVoteLinks(entry.voteLinks),
      soutenanceLinks: sortSoutenanceLinks(entry.soutenanceLinks),
      arbitrageLinks: sortArbitrageLinks(entry.arbitrageLinks)
    }))
  const totalLinkCount = (votePreview.linkCount || 0) + (soutenancePreview.linkCount || 0)
  const availableLinkCount = (votePreview.availableLinkCount || 0) + (soutenancePreview.availableLinkCount || 0)
  const unrecoverableGeneratedLinkCount =
    (votePreview.unrecoverableGeneratedLinkCount || 0) +
    (soutenancePreview.unrecoverableGeneratedLinkCount || 0)
  const unavailableGeneratedLinkCount =
    (votePreview.unavailableGeneratedLinkCount || 0) +
    (soutenancePreview.unavailableGeneratedLinkCount || 0)
  const expiredGeneratedLinkCount =
    (votePreview.expiredGeneratedLinkCount || 0) +
    (soutenancePreview.expiredGeneratedLinkCount || 0)
  const revokedGeneratedLinkCount =
    (votePreview.revokedGeneratedLinkCount || 0) +
    (soutenancePreview.revokedGeneratedLinkCount || 0)
  const exhaustedGeneratedLinkCount =
    (votePreview.exhaustedGeneratedLinkCount || 0) +
    (soutenancePreview.exhaustedGeneratedLinkCount || 0)

  return {
    year: normalizedYear,
    linksGenerated: totalLinkCount > 0 && availableLinkCount === totalLinkCount,
    hasGeneratedLinks: availableLinkCount > 0,
    generatedAt: new Date().toISOString(),
    summary: {
      peopleCount: people.length,
      votePeopleCount: votePreview.recipientCount,
      voteLinkCount: votePreview.linkCount,
      voteGeneratedLinkCount: votePreview.availableLinkCount || 0,
      soutenancePeopleCount: soutenancePreview.recipientCount,
      soutenanceLinkCount: soutenancePreview.linkCount,
      soutenanceGeneratedLinkCount: soutenancePreview.availableLinkCount || 0,
      arbitragePeopleCount: arbitragePreview.recipientCount,
      arbitrageProposalCount: arbitragePreview.proposalCount,
      arbitrageLinkCount: arbitragePreview.linkCount,
      arbitrageGeneratedLinkCount: arbitragePreview.generatedLinkCount,
      arbitragePendingResponseCount: arbitragePreview.pendingResponseCount,
      arbitrageAcceptedResponseCount: arbitragePreview.acceptedResponseCount,
      arbitrageRejectedResponseCount: arbitragePreview.rejectedResponseCount,
      generatedLinkCount: availableLinkCount,
      pendingLinkCount: Math.max(totalLinkCount - availableLinkCount, 0),
      unavailableGeneratedLinkCount,
      unrecoverableGeneratedLinkCount,
      expiredGeneratedLinkCount,
      revokedGeneratedLinkCount,
      exhaustedGeneratedLinkCount
    },
    contexts: {
      phases: Array.from(selectedPhases),
      vote: {
        linkTarget: votePreview.linkTarget,
        workflowFreeModeEnabled: votePreview.workflowFreeModeEnabled === true,
        baseUrl: votePreview.baseUrl,
        redirectPath: votePreview.redirectPath,
        tpiCount: votePreview.tpiCount,
        recipientCount: votePreview.recipientCount,
        linkCount: votePreview.linkCount,
        generatedLinkCount: votePreview.availableLinkCount || 0,
        preparedVoteRecordCount: votePreview.preparedVoteRecordCount || 0,
        pendingLinkCount: votePreview.pendingLinkCount || 0,
        unavailableGeneratedLinkCount: votePreview.unavailableGeneratedLinkCount || 0,
        unrecoverableGeneratedLinkCount: votePreview.unrecoverableGeneratedLinkCount || 0,
        expiredGeneratedLinkCount: votePreview.expiredGeneratedLinkCount || 0,
        revokedGeneratedLinkCount: votePreview.revokedGeneratedLinkCount || 0,
        exhaustedGeneratedLinkCount: votePreview.exhaustedGeneratedLinkCount || 0
      },
      soutenance: {
        linkTarget: normalizedSoutenanceLinkTarget,
        baseUrl: resolvedSoutenanceBaseUrl,
        redirectPath: resolvedDependencies.soutenanceRedirectPath,
        publicationVersion: soutenancePreview.publicationVersion,
        requestedPublicationVersion: soutenancePreview.requestedPublicationVersion,
        autoPublishedPublicationVersion: soutenancePreview.autoPublishedPublicationVersion || null,
        autoPublishedRoomsCount: soutenancePreview.autoPublishedRoomsCount || 0,
        availableVersions: soutenancePreview.availableVersions,
        roomsCount: soutenancePreview.roomsCount,
        recipientCount: soutenancePreview.recipientCount,
        linkCount: soutenancePreview.linkCount,
        generatedLinkCount: soutenancePreview.availableLinkCount || 0,
        pendingLinkCount: soutenancePreview.pendingLinkCount || 0,
        unavailableGeneratedLinkCount: soutenancePreview.unavailableGeneratedLinkCount || 0,
        unrecoverableGeneratedLinkCount: soutenancePreview.unrecoverableGeneratedLinkCount || 0,
        expiredGeneratedLinkCount: soutenancePreview.expiredGeneratedLinkCount || 0,
        revokedGeneratedLinkCount: soutenancePreview.revokedGeneratedLinkCount || 0,
        exhaustedGeneratedLinkCount: soutenancePreview.exhaustedGeneratedLinkCount || 0
      },
      arbitrage: {
        proposalCount: arbitragePreview.proposalCount,
        recipientCount: arbitragePreview.recipientCount,
        linkCount: arbitragePreview.linkCount,
        generatedLinkCount: arbitragePreview.generatedLinkCount,
        pendingResponseCount: arbitragePreview.pendingResponseCount,
        acceptedResponseCount: arbitragePreview.acceptedResponseCount,
        rejectedResponseCount: arbitragePreview.rejectedResponseCount
      }
    },
    people
  }
}

module.exports = {
  buildAccessLinkPreview
}
