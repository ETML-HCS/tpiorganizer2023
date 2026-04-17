const test = require('node:test')
const assert = require('node:assert/strict')
const { Types } = require('mongoose')

const Person = require('../models/personModel')
const TpiPlanning = require('../models/tpiPlanningModel')

const {
  detectDelimiter,
  findOrCreatePerson,
  importTpisFromCSV,
  parseCSVContent,
  validateCSV
} = require('../services/csvImportService')

test('detectDelimiter prefers semicolon for Excel exports', () => {
  assert.equal(
    detectDelimiter('A;B;C\n1;2;3'),
    ';'
  )
})

test('detectDelimiter detects comma separated content', () => {
  assert.equal(
    detectDelimiter('A,B,C\n1,2,3'),
    ','
  )
})

test('parseCSVContent maps the stakeholder columns and ignores extras', () => {
  const content = [
    'N;Eleve;Classe;Ent TPI;Lieu;Chef de projet;Expert1;Expert2;Sujet;Client;Début TPI;Mots clés;Domaine',
    '1001;Alice Martin;6P;ETML;Vennes;Chef Projet;Expert Un;Expert Deux;Sujet A;Client X;10.06.2026;React,API;Web'
  ].join('\n')

  const parsed = parseCSVContent(content)

  assert.equal(parsed.delimiter, ';')
  assert.equal(parsed.data.length, 1)
  assert.equal(parsed.data[0].candidat, 'Alice Martin')
  assert.equal(parsed.data[0].expert1, 'Expert Un')
  assert.equal(parsed.data[0].expert2, 'Expert Deux')
  assert.equal(parsed.data[0].chefProjet, 'Chef Projet')
  assert.equal(parsed.data[0].classe, '6P')
  assert.equal(parsed.data[0].reference, '1001')
  assert.equal(parsed.data[0].site, 'Vennes')
  assert.equal(parsed.data[0].domaine, 'Web')
  assert.equal(parsed.data[0].tags, 'React,API')
})

test('parseCSVContent preserves quoted separators', () => {
  const content = [
    'N;Eleve;Classe;Ent TPI;Lieu;Chef de projet;Expert1;Expert2;Sujet;Mots clés;Domaine',
    '1002;"Alice; Martin";6P;ETML;Vennes;Chef Projet;Expert Un;Expert Deux;"Sujet; avec point-virgule";"Vue, API";Mobile'
  ].join('\n')

  const parsed = parseCSVContent(content)

  assert.equal(parsed.data[0].candidat, 'Alice; Martin')
  assert.equal(parsed.data[0].sujet, 'Sujet; avec point-virgule')
})

test('validateCSV returns an error for incomplete CSV content', () => {
  const result = validateCSV('N;Eleve\n1001;Alice')

  assert.equal(result.valid, false)
  assert.match(result.error, /Colonnes requises manquantes|en-tête/i)
})

test('parseCSVContent rejects files without chef de projet column', () => {
  assert.throws(
    () => parseCSVContent([
      'N;Eleve;Expert1;Expert2',
      '1001;Alice Martin;Expert Un;Expert Deux'
    ].join('\n')),
    /chefProjet/i
  )
})

test('findOrCreatePerson resolves only active people by email', async () => {
  const originalFindOne = Person.findOne
  const originalFind = Person.find

  const activePerson = {
    _id: 'person-1',
    email: 'alice@example.com',
    roles: ['expert'],
    isActive: true
  }

  try {
    Person.findOne = async (query) => {
      if (query.email === 'alice@example.com' && query.isActive === true) {
        return activePerson
      }

      return null
    }
    Person.find = async () => []

    const resolved = await findOrCreatePerson(' Alice@Example.com ', 'expert')

    assert.equal(resolved, activePerson)
  } finally {
    Person.findOne = originalFindOne
    Person.find = originalFind
  }
})

test('importTpisFromCSV creates a TPI when all stakeholders exist', async () => {
  const originalFindOne = Person.findOne
  const originalFind = Person.find
  const originalTpiFindOne = TpiPlanning.findOne
  const originalGenerateReference = TpiPlanning.generateReference
  const originalSave = TpiPlanning.prototype.save

  const candidate = { _id: new Types.ObjectId(), firstName: 'Alice', lastName: 'Martin', roles: ['candidat'], candidateYears: [2026], isActive: true }
  const expert1 = { _id: new Types.ObjectId(), firstName: 'Expert', lastName: 'Un', roles: ['expert'], isActive: true }
  const expert2 = { _id: new Types.ObjectId(), firstName: 'Expert', lastName: 'Deux', roles: ['expert'], isActive: true }
  const chefProjet = { _id: new Types.ObjectId(), firstName: 'Chef', lastName: 'Projet', roles: ['chef_projet'], isActive: true }
  const savedDocs = []

  const matchNameQuery = (query, firstName, lastName) =>
    query?.firstName?.source === `^${firstName}$` && query?.lastName?.source === `^${lastName}$`

  try {
    Person.findOne = async () => null
    Person.find = async (query) => {
      if (matchNameQuery(query, 'Alice', 'Martin')) return [candidate]
      if (matchNameQuery(query, 'Expert', 'Un')) return [expert1]
      if (matchNameQuery(query, 'Expert', 'Deux')) return [expert2]
      if (matchNameQuery(query, 'Chef', 'Projet')) return [chefProjet]
      return []
    }

    TpiPlanning.findOne = async () => null
    TpiPlanning.generateReference = async () => 'TPI-2026-001'
    TpiPlanning.prototype.save = async function save() {
      savedDocs.push({
        reference: this.reference,
        year: this.year,
        candidat: String(this.candidat),
        expert1: String(this.expert1),
        expert2: String(this.expert2),
        chefProjet: String(this.chefProjet),
        sujet: this.sujet,
        description: this.description,
        entreprise: this.entreprise?.nom,
        classe: this.classe,
        site: this.site,
        tags: Array.isArray(this.tags) ? [...this.tags] : this.tags
      })

      return this
    }

    const parsed = parseCSVContent([
      'N;Eleve;Classe;Ent TPI;Lieu;Chef de projet;Expert1;Expert2;Titre;Sujet;Mots clés;Domaine',
      '1001;Alice Martin;6P;ETML;Vennes;Chef Projet;Expert Un;Expert Deux;Titre A;Sujet A;React,API;Web'
    ].join('\n'))

    const result = await importTpisFromCSV(parsed, 2026, 'Vennes', 'admin-1')

    assert.equal(result.created, 1)
    assert.equal(result.updated, 0)
    assert.equal(result.skipped, 0)
    assert.equal(result.errors.length, 0)
    assert.equal(savedDocs.length, 1)
    assert.equal(savedDocs[0].reference, '1001')
    assert.equal(savedDocs[0].year, 2026)
    assert.equal(savedDocs[0].candidat, String(candidate._id))
    assert.equal(savedDocs[0].expert1, String(expert1._id))
    assert.equal(savedDocs[0].expert2, String(expert2._id))
    assert.equal(savedDocs[0].chefProjet, String(chefProjet._id))
    assert.equal(savedDocs[0].sujet, 'Titre A')
    assert.equal(savedDocs[0].description, 'Sujet A')
    assert.equal(savedDocs[0].entreprise, 'ETML')
    assert.equal(savedDocs[0].classe, '6P')
    assert.equal(savedDocs[0].site, 'Vennes')
    assert.deepEqual(savedDocs[0].tags, ['React', 'API', 'Web'])
  } finally {
    Person.findOne = originalFindOne
    Person.find = originalFind
    TpiPlanning.findOne = originalTpiFindOne
    TpiPlanning.generateReference = originalGenerateReference
    TpiPlanning.prototype.save = originalSave
  }
})

test('importTpisFromCSV skips rows when a stakeholder is missing from the referential', async () => {
  const originalFindOne = Person.findOne
  const originalFind = Person.find
  const originalTpiFindOne = TpiPlanning.findOne
  const originalGenerateReference = TpiPlanning.generateReference
  const originalSave = TpiPlanning.prototype.save

  const candidate = { _id: new Types.ObjectId(), firstName: 'Alice', lastName: 'Martin', roles: ['candidat'], candidateYears: [2026], isActive: true }
  const expert1 = { _id: new Types.ObjectId(), firstName: 'Expert', lastName: 'Un', roles: ['expert'], isActive: true }
  const savedDocs = []

  const matchNameQuery = (query, firstName, lastName) =>
    query?.firstName?.source === `^${firstName}$` && query?.lastName?.source === `^${lastName}$`

  try {
    Person.findOne = async () => null
    Person.find = async (query) => {
      if (matchNameQuery(query, 'Alice', 'Martin')) return [candidate]
      if (matchNameQuery(query, 'Expert', 'Un')) return [expert1]
      return []
    }

    TpiPlanning.findOne = async () => null
    TpiPlanning.generateReference = async () => 'TPI-2026-002'
    TpiPlanning.prototype.save = async function save() {
      savedDocs.push(this)
      return this
    }

    const parsed = parseCSVContent([
      'N;Eleve;Classe;Ent TPI;Lieu;Chef de projet;Expert1;Expert2;Titre;Sujet;Mots clés;Domaine',
      '1002;Alice Martin;6P;ETML;Vennes;Chef Projet;Expert Un;Expert Deux;Titre B;Sujet B;React,API;Web'
    ].join('\n'))

    const result = await importTpisFromCSV(parsed, 2026, 'Vennes', 'admin-1')

    assert.equal(result.created, 0)
    assert.equal(result.updated, 0)
    assert.equal(result.skipped, 1)
    assert.equal(result.errors.length, 1)
    assert.match(result.errors[0].error, /Parties prenantes absentes|inactives/i)
    assert.equal(savedDocs.length, 0)
  } finally {
    Person.findOne = originalFindOne
    Person.find = originalFind
    TpiPlanning.findOne = originalTpiFindOne
    TpiPlanning.generateReference = originalGenerateReference
    TpiPlanning.prototype.save = originalSave
  }
})

test('importTpisFromCSV updates an existing TPI instead of creating a duplicate', async () => {
  const originalFindOne = Person.findOne
  const originalFind = Person.find
  const originalTpiFindOne = TpiPlanning.findOne
  const originalGenerateReference = TpiPlanning.generateReference
  const originalSave = TpiPlanning.prototype.save

  const candidate = { _id: new Types.ObjectId(), firstName: 'Alice', lastName: 'Martin', roles: ['candidat'], candidateYears: [2026], isActive: true }
  const expert1 = { _id: new Types.ObjectId(), firstName: 'Expert', lastName: 'Un', roles: ['expert'], isActive: true }
  const expert2 = { _id: new Types.ObjectId(), firstName: 'Expert', lastName: 'Deux', roles: ['expert'], isActive: true }
  const chefProjet = { _id: new Types.ObjectId(), firstName: 'Chef', lastName: 'Projet', roles: ['chef_projet'], isActive: true }

  const existingTpi = {
    _id: new Types.ObjectId(),
    reference: '1003',
    year: 2026,
    candidat: candidate._id,
    expert1: null,
    expert2: null,
    chefProjet: null,
    sujet: 'Ancien titre',
    description: 'Ancienne description',
    entreprise: { nom: 'Ancienne entreprise' },
    classe: '5P',
    site: 'Ancien site',
    dates: {
      debut: null,
      fin: null
    },
    tags: ['Old'],
    soutenanceRoom: 'Ancienne salle',
    save: async function save() {
      return this
    }
  }

  const matchNameQuery = (query, firstName, lastName) =>
    query?.firstName?.source === `^${firstName}$` && query?.lastName?.source === `^${lastName}$`

  try {
    Person.findOne = async () => null
    Person.find = async (query) => {
      if (matchNameQuery(query, 'Alice', 'Martin')) return [candidate]
      if (matchNameQuery(query, 'Expert', 'Un')) return [expert1]
      if (matchNameQuery(query, 'Expert', 'Deux')) return [expert2]
      if (matchNameQuery(query, 'Chef', 'Projet')) return [chefProjet]
      return []
    }

    TpiPlanning.findOne = async (query) => {
      if (query.reference === '1003' && query.year === 2026) {
        return existingTpi
      }

      return null
    }
    TpiPlanning.generateReference = async () => {
      throw new Error('generateReference should not be called when the TPI already exists')
    }
    TpiPlanning.prototype.save = originalSave

    const parsed = parseCSVContent([
      'N;Eleve;Classe;Ent TPI;Lieu;Chef de projet;Expert1;Expert2;Sujet;Mots clés;Domaine;Début TPI;Date fin',
      '1003;Alice Martin;6P;ETML;Vennes;Chef Projet;Expert Un;Expert Deux;Sujet mis à jour;React,API;Web;10.06.2026;11.06.2026'
    ].join('\n'))

    const result = await importTpisFromCSV(parsed, 2026, 'Vennes', 'admin-1')

    assert.equal(result.created, 0)
    assert.equal(result.updated, 1)
    assert.equal(result.skipped, 0)
    assert.equal(result.errors.length, 0)
    assert.equal(existingTpi.expert1, expert1._id)
    assert.equal(existingTpi.expert2, expert2._id)
    assert.equal(existingTpi.chefProjet, chefProjet._id)
    assert.equal(existingTpi.sujet, 'Ancien titre')
    assert.equal(existingTpi.description, 'Sujet mis à jour')
    assert.deepEqual(existingTpi.tags, ['React', 'API', 'Web'])
    assert.equal(existingTpi.entreprise.nom, 'ETML')
    assert.equal(existingTpi.classe, '6P')
    assert.equal(existingTpi.site, 'Ancien site')
    assert.ok(existingTpi.dates.debut instanceof Date)
    assert.ok(existingTpi.dates.fin instanceof Date)
  } finally {
    Person.findOne = originalFindOne
    Person.find = originalFind
    TpiPlanning.findOne = originalTpiFindOne
    TpiPlanning.generateReference = originalGenerateReference
    TpiPlanning.prototype.save = originalSave
  }
})
