/**
 * Service d'import des TPI depuis fichier CSV
 * Format attendu : Référence;Candidat;Classe;Expert1;Expert2;ChefProjet;Titre;Sujet;Entreprise
 */

const Person = require('../models/personModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const {
  buildNameVariants,
  splitNameParts,
  isValidEmail,
  normalizeEmail,
  normalizeText
} = require('./personIdentityService')
const {
  personHasRole
} = require('./personRegistryService')

/**
 * Normalise un texte pour usage dans un email (enleve accents, espaces, caracteres speciaux)
 */
function normalizeForEmail(text) {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enleve accents
    .replace(/[^a-zA-Z0-9]/g, '')    // Garde seulement lettres et chiffres
    .toLowerCase()
}

/**
 * Délimiteurs supportés pour le CSV
 */
const DELIMITERS = [';', ',', '\t']

const normalizeStr = (value = '') => normalizeText(value)

/**
 * Détecte automatiquement le délimiteur utilisé dans le CSV
 */
function detectDelimiter(content) {
  const firstLine = content.split(/\r?\n/)[0]
  
  let bestDelimiter = ';'
  let maxCount = 0
  
  for (const delimiter of DELIMITERS) {
    const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
    if (count > maxCount) {
      maxCount = count
      bestDelimiter = delimiter
    }
  }
  
  return bestDelimiter
}

/**
 * Normalise les noms de colonnes (accents, casse, espaces)
 */
function normalizeColumnName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
    .replace(/[^a-z0-9]/g, '') // Enlever caractères spéciaux
    .trim()
}

/**
 * Mapping des colonnes possibles vers les champs internes
 */
const COLUMN_MAPPINGS = {
  // Référence
  'reference': 'reference',
  'ref': 'reference',
  'n': 'reference',
  'ndetpi': 'reference',
  'numero': 'reference',
  'notpi': 'reference',
  'tpiref': 'reference',
  
  // Candidat
  'candidat': 'candidat',
  'etudiant': 'candidat',
  'eleve': 'candidat',
  'apprenti': 'candidat',
  'nomcandidat': 'candidat',
  
  // Classe
  'classe': 'classe',
  'class': 'classe',
  
  // Expert 1
  'expert1': 'expert1',
  'experttechnique': 'expert1',
  'expertmetier': 'expert1',
  
  // Expert 2
  'expert2': 'expert2',
  'expertpedagogique': 'expert2',
  
  // Chef de projet
  'chefprojet': 'chefProjet',
  'chefdeprojet': 'chefProjet',
  'chefdeprogjet': 'chefProjet',
  'responsable': 'chefProjet',
  'maitre': 'chefProjet',
  'maitreapprentissage': 'chefProjet',
  'ma': 'chefProjet',
  'boss': 'chefProjet',
  
  // Titre
  'titre': 'titre',
  'title': 'titre',
  'intitule': 'titre',
  
  // Sujet
  'sujet': 'sujet',
  'description': 'sujet',
  'descriptionprojet': 'sujet',
  
  // Entreprise
  'entreprise': 'entreprise',
  'enttpi': 'entreprise',
  'societe': 'entreprise',
  'company': 'entreprise',
  'lieuentreprise': 'entreprise',
  
  // Site
  'site': 'site',
  'lieu': 'site',
  'ecole': 'site',
  'lieusite': 'site',

  // Dates et méta
  'datedepart': 'dateDepart',
  'datedebut': 'dateDepart',
  'debuttpi': 'dateDepart',
  'datefin': 'dateFin',
  'datedefense': 'dateSoutenance',
  'datedefence': 'dateSoutenance',
  'datesoutenance': 'dateSoutenance',
  'soutenance': 'dateSoutenance',
  'remarques': 'remarques',
  'remarque': 'remarques',
  'remarquesdomaine': 'remarques',
  'salle': 'salle',
  'tags': 'tags',
  'motscles': 'tags',
  'domaine': 'domaine',
  'typeapp': 'typeApp'
}

function parseDate(value) {
  if (!value) return null
  const v = value.toString().trim()
  // Formats attendus: dd.mm.yyyy ou dd.mm.yy
  const parts = v.split(/[./-]/).filter(Boolean)
  if (parts.length === 3) {
    let [d, m, y] = parts
    if (y.length === 2) y = `20${y}`
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    const date = new Date(iso)
    if (!isNaN(date.getTime())) return date
  }
  const date = new Date(v)
  return isNaN(date.getTime()) ? null : date
}

function parseTags(value, domaine) {
  const tags = []
  if (value) {
    value
      .toString()
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => tags.push(t))
  }
  if (domaine) tags.push(domaine.toString().trim())
  return Array.from(new Set(tags))
}

/**
 * Parse une ligne CSV en tenant compte des guillemets
 */
function parseCSVLine(line, delimiter) {
  const result = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Double guillemet = guillemet échappé
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

/**
 * Parse le contenu CSV et retourne un tableau d'objets
 */
function parseCSVContent(content) {
  const delimiter = detectDelimiter(content)
  const lines = content.split(/\r?\n/).filter(line => line.trim())
  
  if (lines.length < 2) {
    throw new Error('Le fichier CSV doit contenir au moins un en-tête et une ligne de données')
  }
  
  // Parser l'en-tête
  const headerLine = lines[0]
  const headers = parseCSVLine(headerLine, delimiter)
  
  // Mapper les colonnes
  const columnMap = {}
  headers.forEach((header, index) => {
    const normalized = normalizeColumnName(header)
    const mappedField = COLUMN_MAPPINGS[normalized]
    if (mappedField) {
      columnMap[index] = mappedField
    }
  })
  
  // Vérifier les colonnes requises
  const requiredFields = ['candidat', 'expert1', 'expert2', 'chefProjet']
  const mappedFields = Object.values(columnMap)
  const missingFields = requiredFields.filter(f => !mappedFields.includes(f))
  
  if (missingFields.length > 0) {
    throw new Error(`Colonnes requises manquantes : ${missingFields.join(', ')}`)
  }
  
  // Parser les données
  const data = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], delimiter)
    const row = {}
    
    Object.entries(columnMap).forEach(([index, field]) => {
      row[field] = values[parseInt(index)] || ''
    })
    
    // Ignorer les lignes vides
    if (row.candidat) {
      row._lineNumber = i + 1
      data.push(row)
    }
  }
  
  return {
    delimiter,
    headers,
    columnMap,
    data
  }
}

/**
 * Résout une personne existante par email ou nom.
 * Un email réel peut créer une fiche; un simple nom ne crée rien.
 */
function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function findUniquePersonByName(name, role, options = {}) {
  const variants = buildNameVariants(name)

  if (variants.length === 0) {
    return null
  }

  const matches = []

  for (const variant of variants) {
    const firstNamePattern = new RegExp(`^${escapeRegex(variant.firstName)}$`, 'i')
    const lastNamePattern = new RegExp(`^${escapeRegex(variant.lastName)}$`, 'i')

    const found = await Person.find({
      firstName: firstNamePattern,
      lastName: lastNamePattern,
      isActive: true
    })

    for (const person of found) {
      if (!matches.some((candidate) => String(candidate._id) === String(person._id))) {
        matches.push(person)
      }
    }
  }

  if (matches.length !== 1) {
    return null
  }

  return personHasRole(matches[0], role, options) ? matches[0] : null
}

async function findOrCreatePerson(nameOrEmail, role, site = 'Vennes', options = {}) {
  if (!nameOrEmail || nameOrEmail.trim() === '') {
    return null
  }

  const trimmed = nameOrEmail.trim()
  const looksLikeEmail = isValidEmail(trimmed)

  // Chercher par email
  if (looksLikeEmail) {
    const email = normalizeEmail(trimmed)
    const person = await Person.findOne({ email, isActive: true })
    return personHasRole(person, role, options) ? person : null
  }

  // Chercher par nom
  const person = await findUniquePersonByName(trimmed, role, options)
  if (!person) {
    return null  // Ne crée pas automatiquement - la personne doit exister dans le référentiel
  }

  return person
}

/**
 * Importe les TPI depuis les données CSV parsées
 */
async function importTpisFromCSV(parsedData, year, site = 'Vennes', createdBy = null) {
  const results = {
    success: [],
    errors: [],
    created: 0,
    updated: 0,
    skipped: 0
  }

  for (const row of parsedData.data) {
    try {
      // Trouver ou créer les personnes
      const resolutionOptions = { year }
      const candidat = await findOrCreatePerson(row.candidat, 'candidat', site, resolutionOptions)
      const expert1 = await findOrCreatePerson(row.expert1, 'expert', site, resolutionOptions)
      const expert2 = await findOrCreatePerson(row.expert2, 'expert', site, resolutionOptions)
      const chefProjet = await findOrCreatePerson(row.chefProjet, 'chef_projet', site, resolutionOptions)

      const missingParticipants = []
      if (!candidat) missingParticipants.push('candidat')
      if (!expert1) missingParticipants.push('expert1')
      if (!expert2) missingParticipants.push('expert2')
      if (!chefProjet) missingParticipants.push('chefProjet')

      if (missingParticipants.length > 0) {
        results.errors.push({
          line: row._lineNumber,
          error: `Parties prenantes absentes ou inactives dans le référentiel: ${missingParticipants.join(', ')}`,
          data: row
        })
        results.skipped++
        continue
      }
      
      // Vérifier si le TPI existe déjà (par référence ou par candidat+année)
      let existingTpi = null
      
      if (row.reference) {
        existingTpi = await TpiPlanning.findOne({ 
          reference: row.reference, 
          year 
        })
      }
      
      if (!existingTpi) {
        existingTpi = await TpiPlanning.findOne({ 
          candidat: candidat._id, 
          year 
        })
      }
      
      if (existingTpi) {
        // Mettre à jour le TPI existant
        existingTpi.expert1 = expert1._id
        existingTpi.expert2 = expert2._id
        existingTpi.chefProjet = chefProjet._id
        if (row.titre) existingTpi.sujet = row.titre
        if (row.sujet) existingTpi.description = row.sujet
        if (row.remarques) existingTpi.description = `${existingTpi.description || ''}\n${row.remarques}`.trim()
        if (row.entreprise) existingTpi.entreprise = { nom: row.entreprise }
        if (row.classe) existingTpi.classe = row.classe
        if (row.dateSoutenance || row.dateDepart || row.dateFin) {
          existingTpi.dates = existingTpi.dates || {}
          if (row.dateSoutenance) existingTpi.dates.soutenance = parseDate(row.dateSoutenance)
          if (row.dateDepart) existingTpi.dates.debut = parseDate(row.dateDepart)
          if (row.dateFin) existingTpi.dates.fin = parseDate(row.dateFin)
        }
        if (row.tags || row.domaine) {
          existingTpi.tags = parseTags(row.tags, row.domaine)
        }
        if (row.salle) existingTpi.soutenanceRoom = row.salle
        
        await existingTpi.save()
        results.updated++
        results.success.push({
          line: row._lineNumber,
          action: 'updated',
          reference: existingTpi.reference,
          candidat: row.candidat
        })
      } else {
        // Créer un nouveau TPI
        const reference = row.reference || await TpiPlanning.generateReference(year)
        
        const newTpi = new TpiPlanning({
          reference,
          year,
          candidat: candidat._id,
          expert1: expert1._id,
          expert2: expert2._id,
          chefProjet: chefProjet._id,
          sujet: row.titre || 'Sujet non défini',
          description: [row.sujet, row.remarques].filter(Boolean).join('\n'),
          entreprise: row.entreprise ? { nom: row.entreprise } : undefined,
          classe: row.classe || '',
          site,
          dates: {
            soutenance: parseDate(row.dateSoutenance),
            debut: parseDate(row.dateDepart),
            fin: parseDate(row.dateFin)
          },
          tags: parseTags(row.tags, row.domaine),
          soutenanceRoom: row.salle,
          status: 'draft',
          createdBy
        })
        
        await newTpi.save()
        results.created++
        results.success.push({
          line: row._lineNumber,
          action: 'created',
          reference: newTpi.reference,
          candidat: row.candidat
        })
      }
      
    } catch (error) {
      results.errors.push({
        line: row._lineNumber,
        error: error.message,
        data: row
      })
      results.skipped++
    }
  }
  
  return results
}

/**
 * Valide un fichier CSV sans l'importer (prévisualisation)
 */
function validateCSV(content) {
  try {
    const parsed = parseCSVContent(content)
    
    return {
      valid: true,
      delimiter: parsed.delimiter,
      headers: parsed.headers,
      mappedColumns: Object.entries(parsed.columnMap).map(([idx, field]) => ({
        index: parseInt(idx),
        original: parsed.headers[parseInt(idx)],
        mappedTo: field
      })),
      rowCount: parsed.data.length,
      preview: parsed.data.slice(0, 5).map(row => ({
        candidat: row.candidat,
        expert1: row.expert1,
        expert2: row.expert2,
        chefProjet: row.chefProjet,
        titre: row.titre
      }))
    }
  } catch (error) {
    return {
      valid: false,
      error: error.message
    }
  }
}

module.exports = {
  parseCSVContent,
  parseCSVLine,
  detectDelimiter,
  validateCSV,
  importTpisFromCSV,
  findOrCreatePerson,
  COLUMN_MAPPINGS
}
