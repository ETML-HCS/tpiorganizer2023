/**
 * Service de parsing des fichiers iCal
 * Extrait les périodes d'enseignement pour déterminer la présence des enseignants
 * 
 * Logique : Si un enseignant a cours pendant une demi-journée, il est présent
 * et donc potentiellement disponible pour une défense TPI
 */

const fs = require('fs')
const path = require('path')

// Périodes de défense standard
const PERIODS = {
  matin: {
    id: 'matin',
    label: 'Matin',
    start: '08:00',
    end: '12:00',
    startHour: 8,
    endHour: 12
  },
  'apres-midi': {
    id: 'apres-midi',
    label: 'Après-midi',
    start: '13:30',
    end: '17:30',
    startHour: 13,
    endHour: 18
  }
}

// Offset pour la Suisse (UTC+1 en hiver, UTC+2 en été)
// Pour simplifier, on utilise +2 pour les défenses TPI (juin)
const SWISS_OFFSET_HOURS = 2

/**
 * Parse une date iCal (format: YYYYMMDDTHHMMSS ou YYYYMMDD)
 * Gère le fuseau UTC (Z) et convertit en heure locale suisse
 */
function parseICalDate(dateStr) {
  if (!dateStr) return null
  
  // Nettoyer la chaîne (enlever TZID, etc.)
  let cleanStr = dateStr
  let isUTC = false
  
  // Gestion du TZID (ex: TZID=Europe/Zurich:20260115T083000)
  if (dateStr.includes(':')) {
    cleanStr = dateStr.split(':').pop()
  }
  
  // Vérifier si c'est UTC
  if (cleanStr.endsWith('Z')) {
    isUTC = true
    cleanStr = cleanStr.slice(0, -1)
  }
  
  // Format YYYYMMDDTHHMMSS
  if (cleanStr.includes('T')) {
    const year = parseInt(cleanStr.substring(0, 4))
    const month = parseInt(cleanStr.substring(4, 6)) - 1
    const day = parseInt(cleanStr.substring(6, 8))
    let hour = parseInt(cleanStr.substring(9, 11))
    const minute = parseInt(cleanStr.substring(11, 13))
    const second = parseInt(cleanStr.substring(13, 15)) || 0
    
    // Convertir UTC en heure suisse
    if (isUTC) {
      hour += SWISS_OFFSET_HOURS
      // Gérer le passage à minuit
      if (hour >= 24) {
        hour -= 24
        // Note: simplification - on ne gère pas le changement de jour ici
        // car les cours ne sont pas à minuit
      }
    }
    
    return new Date(year, month, day, hour, minute, second)
  }
  
  // Format YYYYMMDD (journée entière)
  const year = parseInt(cleanStr.substring(0, 4))
  const month = parseInt(cleanStr.substring(4, 6)) - 1
  const day = parseInt(cleanStr.substring(6, 8))
  
  return new Date(year, month, day)
}

/**
 * Parse un fichier iCal et extrait les événements
 */
function parseICalContent(icalContent) {
  const events = []
  const lines = icalContent.split(/\r?\n/)
  
  let currentEvent = null
  let currentKey = null
  let currentValue = ''
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    
    // Gestion des lignes pliées (continuation avec espace ou tab)
    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentValue += line.substring(1)
      continue
    }
    
    // Traiter la valeur précédente si existante
    if (currentKey && currentEvent) {
      processKeyValue(currentEvent, currentKey, currentValue)
    }
    
    // Nouvelle ligne
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    
    currentKey = line.substring(0, colonIndex)
    currentValue = line.substring(colonIndex + 1)
    
    // Gestion des paramètres (ex: DTSTART;TZID=Europe/Zurich)
    const semiIndex = currentKey.indexOf(';')
    if (semiIndex !== -1) {
      const params = currentKey.substring(semiIndex + 1)
      currentKey = currentKey.substring(0, semiIndex)
      // Conserver le TZID si présent
      if (params.includes('TZID=')) {
        currentValue = params + ':' + currentValue
      }
    }
    
    if (currentKey === 'BEGIN' && currentValue === 'VEVENT') {
      currentEvent = {
        uid: null,
        summary: null,
        dtstart: null,
        dtend: null,
        location: null,
        description: null,
        rrule: null
      }
    } else if (currentKey === 'END' && currentValue === 'VEVENT') {
      if (currentEvent && currentEvent.dtstart) {
        events.push(currentEvent)
      }
      currentEvent = null
    }
  }
  
  return events
}

/**
 * Traite une paire clé/valeur pour un événement
 */
function processKeyValue(event, key, value) {
  switch (key) {
    case 'UID':
      event.uid = value
      break
    case 'SUMMARY':
      event.summary = value
      break
    case 'DTSTART':
      event.dtstart = parseICalDate(value)
      break
    case 'DTEND':
      event.dtend = parseICalDate(value)
      break
    case 'LOCATION':
      event.location = value
      break
    case 'DESCRIPTION':
      event.description = value
      break
    case 'RRULE':
      event.rrule = value
      break
  }
}

/**
 * Détermine si un événement couvre une période donnée (matin ou après-midi)
 */
function eventCoversPeriod(event, period) {
  if (!event.dtstart) return false
  
  const startHour = event.dtstart.getHours()
  const endHour = event.dtend ? event.dtend.getHours() : startHour + 1
  
  // Vérifier si l'événement chevauche la période
  const periodStart = period.startHour
  const periodEnd = period.endHour
  
  // Chevauchement si : début événement < fin période ET fin événement > début période
  return startHour < periodEnd && endHour > periodStart
}

/**
 * Extrait les présences d'un enseignant à partir de son fichier iCal
 * 
 * @param {string} icalContent - Contenu du fichier iCal
 * @param {Date} startDate - Date de début de la période à analyser
 * @param {Date} endDate - Date de fin de la période à analyser
 * @returns {Object} Map des présences par date et période
 */
function extractPresences(icalContent, startDate, endDate) {
  const events = parseICalContent(icalContent)
  const presences = {}
  
  // Filtrer les événements dans la plage de dates
  const relevantEvents = events.filter(event => {
    if (!event.dtstart) return false
    return event.dtstart >= startDate && event.dtstart <= endDate
  })
  
  // Grouper par jour et période
  for (const event of relevantEvents) {
    const dateKey = event.dtstart.toISOString().split('T')[0]
    
    if (!presences[dateKey]) {
      presences[dateKey] = {
        date: dateKey,
        matin: false,
        'apres-midi': false,
        events: []
      }
    }
    
    // Vérifier quelle période est couverte
    if (eventCoversPeriod(event, PERIODS.matin)) {
      presences[dateKey].matin = true
    }
    if (eventCoversPeriod(event, PERIODS['apres-midi'])) {
      presences[dateKey]['apres-midi'] = true
    }
    
    // Stocker le résumé de l'événement pour debug
    presences[dateKey].events.push({
      summary: event.summary,
      start: event.dtstart,
      end: event.dtend,
      location: event.location
    })
  }
  
  return presences
}

/**
 * Génère une règle de récurrence simplifiée
 * (Pour les cours hebdomadaires récurrents)
 */
function expandRecurringEvents(events, startDate, endDate) {
  const expanded = []
  
  for (const event of events) {
    if (!event.rrule) {
      expanded.push(event)
      continue
    }
    
    // Parser la RRULE basique (FREQ=WEEKLY;UNTIL=...)
    const rruleParts = {}
    event.rrule.split(';').forEach(part => {
      const [key, value] = part.split('=')
      rruleParts[key] = value
    })
    
    if (rruleParts.FREQ === 'WEEKLY') {
      let currentDate = new Date(event.dtstart)
      const until = rruleParts.UNTIL ? parseICalDate(rruleParts.UNTIL) : endDate
      const interval = parseInt(rruleParts.INTERVAL) || 1
      
      while (currentDate <= until && currentDate <= endDate) {
        if (currentDate >= startDate) {
          const duration = event.dtend ? (event.dtend - event.dtstart) : 3600000
          expanded.push({
            ...event,
            dtstart: new Date(currentDate),
            dtend: new Date(currentDate.getTime() + duration),
            rrule: null // Déjà expansé
          })
        }
        currentDate.setDate(currentDate.getDate() + (7 * interval))
      }
    } else {
      // Pour les autres types de récurrence, garder l'événement original
      expanded.push(event)
    }
  }
  
  return expanded
}

/**
 * Traite plusieurs fichiers iCal et combine les présences
 * 
 * @param {Array<{email: string, icalContent: string}>} teachers - Liste des enseignants avec leur iCal
 * @param {Date} startDate - Date de début
 * @param {Date} endDate - Date de fin
 * @returns {Object} Map des présences par enseignant et date
 */
function processMultipleTeachers(teachers, startDate, endDate) {
  const result = {}
  
  for (const teacher of teachers) {
    const presences = extractPresences(teacher.icalContent, startDate, endDate)
    result[teacher.email] = {
      email: teacher.email,
      name: teacher.name || teacher.email,
      presences
    }
  }
  
  return result
}

/**
 * Trouve les créneaux où tous les participants sont disponibles
 * 
 * @param {Array<string>} participantEmails - Emails des participants (expert1, expert2, chefProjet)
 * @param {Object} allPresences - Présences de tous les enseignants
 * @param {Array<string>} availableDates - Dates possibles pour les défenses
 * @returns {Array} Liste des créneaux communs disponibles
 */
function findCommonAvailableSlots(participantEmails, allPresences, availableDates) {
  const commonSlots = []
  
  for (const dateStr of availableDates) {
    for (const periodId of ['matin', 'apres-midi']) {
      // Vérifier si tous les participants sont présents
      const allPresent = participantEmails.every(email => {
        const teacherPresences = allPresences[email]
        if (!teacherPresences) return false
        
        const dayPresence = teacherPresences.presences[dateStr]
        return dayPresence && dayPresence[periodId]
      })
      
      if (allPresent) {
        commonSlots.push({
          date: dateStr,
          period: periodId,
          periodLabel: PERIODS[periodId].label,
          startTime: PERIODS[periodId].start,
          endTime: PERIODS[periodId].end,
          participants: participantEmails
        })
      }
    }
  }
  
  return commonSlots
}

/**
 * Génère un rapport de disponibilité pour debug
 */
function generateAvailabilityReport(allPresences, startDate, endDate) {
  const report = {
    generatedAt: new Date().toISOString(),
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    teachers: []
  }
  
  for (const [email, data] of Object.entries(allPresences)) {
    const teacherReport = {
      email,
      name: data.name,
      totalDays: Object.keys(data.presences).length,
      mornings: 0,
      afternoons: 0,
      fullDays: 0,
      presencesByDay: []
    }
    
    for (const [date, presence] of Object.entries(data.presences)) {
      if (presence.matin) teacherReport.mornings++
      if (presence['apres-midi']) teacherReport.afternoons++
      if (presence.matin && presence['apres-midi']) teacherReport.fullDays++
      
      teacherReport.presencesByDay.push({
        date,
        matin: presence.matin,
        'apres-midi': presence['apres-midi']
      })
    }
    
    report.teachers.push(teacherReport)
  }
  
  return report
}

module.exports = {
  parseICalContent,
  parseICalDate,
  extractPresences,
  expandRecurringEvents,
  processMultipleTeachers,
  findCommonAvailableSlots,
  generateAvailabilityReport,
  PERIODS
}
