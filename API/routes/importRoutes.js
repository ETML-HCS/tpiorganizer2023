/**
 * Routes API pour l'import des données (iCal et CSV)
 */

const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')

// Services
const icalParser = require('../services/icalParserService')
const csvImport = require('../services/csvImportService')
const Person = require('../models/personModel')
const { buildDefaultAvailabilityFromPresences } = require('../utils/availability')
const { extractEmailFromFilename, normalizeEmail, isValidEmail } = require('../services/personIdentityService')

// Configuration multer pour l'upload de fichiers
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 50 // Max 50 fichiers à la fois
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const allowedExts = ['.ics', '.ical', '.csv', '.txt']
    
    if (allowedExts.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`Extension non supportée: ${ext}. Formats acceptés: ${allowedExts.join(', ')}`))
    }
  }
})

// ============================================
// IMPORT iCal (Disponibilités enseignants)
// ============================================

/**
 * POST /api/import/ical
 * Upload et parse un fichier iCal pour extraire les présences
 */
router.post('/ical', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' })
    }
    
    const { email, startDate, endDate } = req.body
    const normalizedEmail = typeof email === 'string' ? normalizeEmail(email) : ''

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Email de l\'enseignant requis' })
    }
    
    const content = req.file.buffer.toString('utf-8')
    const start = startDate ? new Date(startDate) : new Date()
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 jours
    
    // Parser le fichier iCal
    const presences = icalParser.extractPresences(content, start, end)
    
    // Mettre à jour ou créer l'enseignant
    let person = await Person.findOne({ email: normalizedEmail })
    
    if (!person) {
      return res.status(404).json({
        error: 'Partie prenante introuvable dans le référentiel.',
        email: normalizedEmail
      })
    }
    
    const availability = buildDefaultAvailabilityFromPresences(presences)
    
    person.defaultAvailability = availability
    person.lastIcalImport = new Date()
    await person.save()
    
    res.json({
      success: true,
      email: person.email,
      name: `${person.firstName} ${person.lastName}`,
      presencesCount: Object.keys(presences).length,
      presences,
      defaultAvailability: availability
    })
    
  } catch (error) {
    console.error('Erreur import iCal:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/import/ical/batch
 * Upload multiple fichiers iCal (un par enseignant)
 * Accepte optionnellement des dates spécifiques de défenses
 */
router.post('/ical/batch', upload.array('files', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier fourni' })
    }
    
    const { startDate, endDate, specificDates } = req.body
    const start = startDate ? new Date(startDate) : new Date()
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    // Parser les dates spécifiques si fournies
    let targetDates = null
    if (specificDates) {
      try {
        targetDates = JSON.parse(specificDates)
        console.log(`📅 Dates spécifiques de défenses: ${targetDates.length} jours`)
      } catch (e) {
        console.warn('Erreur parsing specificDates:', e)
      }
    }
    
    const results = {
      success: [],
      errors: [],
      skipped: [],
      total: req.files.length,
      targetDates: targetDates || 'all'
    }
    
    for (const file of req.files) {
      try {
        const email = extractEmailFromFilename(file.originalname)

        if (!email) {
          results.skipped.push({
            filename: file.originalname,
            reason: 'Email introuvable dans le nom de fichier. Import ignoré.'
          })
          continue
        }

        const content = file.buffer.toString('utf-8')
        const allPresences = icalParser.extractPresences(content, start, end)
        
        // Filtrer uniquement les dates spécifiques si fournies
        let presences = allPresences
        if (targetDates && targetDates.length > 0) {
          presences = {}
          for (const date of targetDates) {
            if (allPresences[date]) {
              presences[date] = allPresences[date]
            }
          }
        }
        
        // Trouver ou créer l'enseignant
        let person = await Person.findOne({ email, isActive: true })

        if (!person) {
          results.skipped.push({
            filename: file.originalname,
            email,
            reason: 'Partie prenante absente ou inactive dans le référentiel.'
          })
          continue
        }
        
        if (!person.importedPresences) {
          person.importedPresences = new Map()
        }
        
        let presencesCount = 0
        for (const [dateStr, presence] of Object.entries(presences)) {
          person.importedPresences.set(dateStr, {
            matin: presence.matin || false,
            'apres-midi': presence['apres-midi'] || false
          })
          if (presence.matin || presence['apres-midi']) presencesCount++
        }
        
        person.lastIcalImport = new Date()
        await person.save()
        
        results.success.push({
          filename: file.originalname,
          email: person.email,
          name: `${person.firstName} ${person.lastName}`,
          presencesCount,
          totalDatesChecked: Object.keys(presences).length
        })
        
      } catch (error) {
        results.errors.push({
          filename: file.originalname,
          error: error.message
        })
      }
    }
    
    res.json(results)
    
  } catch (error) {
    console.error('Erreur import iCal batch:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/import/ical/analyze
 * Analyse un fichier iCal sans l'importer (prévisualisation)
 */
router.post('/ical/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' })
    }
    
    const { startDate, endDate } = req.body
    const start = startDate ? new Date(startDate) : new Date()
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    const content = req.file.buffer.toString('utf-8')
    
    // Parser et analyser
    const events = icalParser.parseICalContent(content)
    const presences = icalParser.extractPresences(content, start, end)
    
    // Statistiques
    const stats = {
      totalEvents: events.length,
      eventsInRange: Object.values(presences).reduce((sum, p) => sum + p.events.length, 0),
      daysWithPresence: Object.keys(presences).length,
      mornings: Object.values(presences).filter(p => p.matin).length,
      afternoons: Object.values(presences).filter(p => p['apres-midi']).length,
      fullDays: Object.values(presences).filter(p => p.matin && p['apres-midi']).length
    }
    
    res.json({
      filename: req.file.originalname,
      period: { start: start.toISOString(), end: end.toISOString() },
      stats,
      presences,
      sampleEvents: events.slice(0, 10).map(e => ({
        summary: e.summary,
        start: e.dtstart,
        end: e.dtend,
        location: e.location
      }))
    })
    
  } catch (error) {
    console.error('Erreur analyse iCal:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// IMPORT CSV (Liste des TPI)
// ============================================

/**
 * POST /api/import/csv/validate
 * Valide un fichier CSV sans l'importer (prévisualisation)
 */
router.post('/csv/validate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' })
    }
    
    const content = req.file.buffer.toString('utf-8')
    const validation = csvImport.validateCSV(content)
    
    res.json({
      filename: req.file.originalname,
      ...validation
    })
    
  } catch (error) {
    console.error('Erreur validation CSV:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/import/csv/tpi
 * Importe les TPI depuis un fichier CSV
 */
router.post('/csv/tpi', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' })
    }
    
    const { year, site } = req.body
    
    if (!year) {
      return res.status(400).json({ error: 'Année requise' })
    }
    
    const content = req.file.buffer.toString('utf-8')
    const parsed = csvImport.parseCSVContent(content)
    
    const results = await csvImport.importTpisFromCSV(
      parsed,
      parseInt(year),
      site || 'Vennes',
      req.user?.id
    )
    
    res.json({
      filename: req.file.originalname,
      year: parseInt(year),
      ...results
    })
    
  } catch (error) {
    console.error('Erreur import CSV:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================
// CALCUL DES DISPONIBILITÉS COMMUNES
// ============================================

/**
 * POST /api/import/availability/compute
 * Calcule les créneaux disponibles pour un TPI
 */
router.post('/availability/compute', async (req, res) => {
  try {
    const { expert1Email, expert2Email, chefProjetEmail, dates, startDate, endDate } = req.body
    
    if (!expert1Email || !expert2Email) {
      return res.status(400).json({ error: 'expert1Email et expert2Email requis' })
    }
    
    // Récupérer les enseignants
    const expert1 = await Person.findOne({ email: expert1Email.toLowerCase() })
    const expert2 = await Person.findOne({ email: expert2Email.toLowerCase() })
    const chefProjet = chefProjetEmail 
      ? await Person.findOne({ email: chefProjetEmail.toLowerCase() })
      : null
    
    if (!expert1 || !expert2) {
      return res.status(404).json({ 
        error: 'Un ou plusieurs enseignants non trouvés',
        details: {
          expert1Found: !!expert1,
          expert2Found: !!expert2
        }
      })
    }
    
    // Construire les présences
    const allPresences = {
      [expert1Email]: { email: expert1Email, presences: expert1.defaultAvailability || {} },
      [expert2Email]: { email: expert2Email, presences: expert2.defaultAvailability || {} }
    }
    
    if (chefProjet) {
      allPresences[chefProjetEmail] = { 
        email: chefProjetEmail, 
        presences: chefProjet.defaultAvailability || {} 
      }
    }
    
    // Si des dates spécifiques sont fournies, utiliser celles-ci
    let availableDates = dates
    
    if (!availableDates && startDate && endDate) {
      // Générer les dates entre start et end (sauf week-end)
      availableDates = []
      const current = new Date(startDate)
      const end = new Date(endDate)
      
      while (current <= end) {
        const day = current.getDay()
        if (day !== 0 && day !== 6) { // Pas dimanche ni samedi
          availableDates.push(current.toISOString().split('T')[0])
        }
        current.setDate(current.getDate() + 1)
      }
    }
    
    if (!availableDates || availableDates.length === 0) {
      return res.status(400).json({ error: 'Dates ou période requises' })
    }
    
    // Calculer les créneaux communs
    const participantEmails = [expert1Email, expert2Email]
    if (chefProjetEmail) participantEmails.push(chefProjetEmail)
    
    const commonSlots = icalParser.findCommonAvailableSlots(
      participantEmails,
      allPresences,
      availableDates
    )
    
    res.json({
      participants: participantEmails.map(email => ({
        email,
        name: allPresences[email]?.name || email
      })),
      dates: availableDates,
      commonSlots,
      totalSlots: commonSlots.length
    })
    
  } catch (error) {
    console.error('Erreur calcul disponibilités:', error)
    res.status(500).json({ error: error.message })
  }
})

module.exports = router
