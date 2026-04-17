const test = require('node:test')
const assert = require('node:assert/strict')

const Person = require('../models/personModel')

const {
  importPeopleFromContent,
  mergePersonRecord,
  parsePeopleContent,
  purgeAllPeople
} = require('../services/personImportService')

test('parsePeopleContent maps the expert import columns and ignores extras', () => {
  const parsed = parsePeopleContent([
    'Expert\tExpert mail\tTél\tCommentaire',
    'Alain Pittet\talain.pittet@info-domo.ch\t+41 79 000 00 00\tIgnore'
  ].join('\n'))

  assert.equal(parsed.delimiter, '\t')
  assert.equal(parsed.rows.length, 1)
  assert.equal(parsed.rows[0].name, 'Alain Pittet')
  assert.equal(parsed.rows[0].email, 'alain.pittet@info-domo.ch')
  assert.equal(parsed.rows[0].phone, '+41 79 000 00 00')
})

test('importPeopleFromContent creates new experts and skips duplicate emails', async () => {
  const originalFindOne = Person.findOne
  const originalFind = Person.find
  const originalSave = Person.prototype.save
  const savedDocs = []
  const existingEmail = 'existing@example.com'

  try {
    Person.findOne = async (query) => {
      if (query?.email === existingEmail) {
        return {
          _id: 'existing-person',
          email: existingEmail,
          firstName: 'Alexandre',
          lastName: 'Graf',
          phone: '',
          site: '',
          roles: ['expert'],
          isActive: true
        }
      }

      return null
    }
    Person.find = () => ({
      select() {
        return []
      }
    })

    Person.prototype.save = async function save() {
      savedDocs.push({
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        phone: this.phone,
        site: this.site,
        roles: this.roles
      })
      return this
    }

    const result = await importPeopleFromContent([
      'Expert\tExpert mail\tTél',
      'Alain Pittet\talain.pittet@info-domo.ch\t+41 79 606 33 28',
      'Alexandre Graf\texisting@example.com\t'
    ].join('\n'))

    assert.equal(result.created, 1)
    assert.equal(result.duplicates, 1)
    assert.equal(result.skipped, 1)
    assert.equal(result.errors.length, 0)
    assert.equal(savedDocs.length, 1)
    assert.equal(savedDocs[0].firstName, 'Alain')
    assert.equal(savedDocs[0].lastName, 'Pittet')
    assert.equal(savedDocs[0].email, 'alain.pittet@info-domo.ch')
    assert.equal(savedDocs[0].phone, '+41 79 606 33 28')
    assert.deepEqual(savedDocs[0].roles, ['expert'])
  } finally {
    Person.findOne = originalFindOne
    Person.find = originalFind
    Person.prototype.save = originalSave
  }
})

test('importPeopleFromContent applies the selected role to new people', async () => {
  const originalFindOne = Person.findOne
  const originalFind = Person.find
  const originalSave = Person.prototype.save
  const savedDocs = []

  try {
    Person.findOne = async () => null
    Person.find = () => ({
      select() {
        return []
      }
    })
    Person.prototype.save = async function save() {
      savedDocs.push({
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        roles: this.roles
      })
      return this
    }

    const result = await importPeopleFromContent([
      'Expert\tExpert mail\tTél',
      'Alain Pittet\talain.pittet@info-domo.ch\t'
    ].join('\n'), {
      defaultRoles: ['chef_projet']
    })

    assert.equal(result.created, 1)
    assert.deepEqual(savedDocs[0].roles, ['chef_projet'])
  } finally {
    Person.findOne = originalFindOne
    Person.find = originalFind
    Person.prototype.save = originalSave
  }
})

test('importPeopleFromContent merges chef roles into existing experts', async () => {
  const originalFindOne = Person.findOne
  const originalSave = Person.prototype.save
  const savedDocs = []

  try {
    Person.findOne = async () => ({
      _id: 'existing-person',
      email: 'alain.pittet@info-domo.ch',
      firstName: 'Alain',
      lastName: 'Pittet',
      phone: '',
      site: '',
      roles: ['expert'],
      isActive: true,
      save: async function save() {
        savedDocs.push({
          email: this.email,
          roles: this.roles
        })
        return this
      }
    })

    const result = await importPeopleFromContent([
      'Expert\tExpert mail\tTél',
      'Alain Pittet\talain.pittet@info-domo.ch\t'
    ].join('\n'), {
      defaultRoles: ['chef_projet']
    })

    assert.equal(result.created, 0)
    assert.equal(result.updated, 1)
    assert.equal(result.duplicates, 0)
    assert.equal(savedDocs.length, 1)
    assert.deepEqual(savedDocs[0].roles, ['expert', 'chef_projet'])
  } finally {
    Person.findOne = originalFindOne
    Person.prototype.save = originalSave
  }
})

test('importPeopleFromContent replaces a synthetic organizer email when the name matches', async () => {
  const originalFindOne = Person.findOne
  const originalFind = Person.find
  const originalSave = Person.prototype.save
  const savedDocs = []

  try {
    Person.findOne = async () => null
    Person.find = () => ({
      select() {
        return [
          {
            _id: 'placeholder-person',
            email: 'xy123@tpiOrganizer.ch',
            firstName: 'Alain',
            lastName: 'Pittet',
            phone: '',
            site: '',
            roles: ['expert'],
            isActive: true,
            save: async function save() {
              savedDocs.push({
                email: this.email,
                phone: this.phone,
                roles: this.roles
              })
              return this
            }
          }
        ]
      }
    })

    Person.prototype.save = async function save() {
      savedDocs.push({
        email: this.email,
        phone: this.phone,
        roles: this.roles
      })
      return this
    }

    const result = await importPeopleFromContent([
      'Expert\tExpert mail\tTél',
      'Alain Pittet\talain.pittet@info-domo.ch\t+41 79 606 33 28'
    ].join('\n'))

    assert.equal(result.created, 0)
    assert.equal(result.updated, 1)
    assert.equal(result.duplicates, 0)
    assert.equal(result.skipped, 0)
    assert.equal(savedDocs.length, 1)
    assert.equal(savedDocs[0].email, 'alain.pittet@info-domo.ch')
    assert.equal(savedDocs[0].phone, '+41 79 606 33 28')
    assert.deepEqual(savedDocs[0].roles, ['expert'])
  } finally {
    Person.findOne = originalFindOne
    Person.find = originalFind
    Person.prototype.save = originalSave
  }
})

test('mergePersonRecord keeps one person and merges roles without overwriting existing values', () => {
  const result = mergePersonRecord({
    firstName: 'Alain',
    lastName: 'Pittet',
    phone: '+41 79 000 00 00',
    site: 'Vennes',
    entreprise: '',
    roles: ['expert'],
    isActive: true
  }, {
    firstName: 'Alain',
    lastName: 'Pittet',
    phone: '',
    site: '',
    entreprise: 'EPFL',
    roles: ['chef_projet']
  })

  assert.equal(result.hasChanges, true)
  assert.deepEqual(result.updates.roles, ['expert', 'chef_projet'])
  assert.equal(result.updates.phone, undefined)
  assert.equal(result.updates.site, undefined)
  assert.equal(result.updates.entreprise, 'EPFL')
})

test('importPeopleFromContent keeps both expert and chef roles when requested', async () => {
  const originalFindOne = Person.findOne
  const originalFind = Person.find
  const originalSave = Person.prototype.save
  const savedDocs = []

  try {
    Person.findOne = async () => null
    Person.find = () => ({
      select() {
        return []
      }
    })
    Person.prototype.save = async function save() {
      savedDocs.push({
        email: this.email,
        roles: this.roles
      })
      return this
    }

    const result = await importPeopleFromContent([
      'Expert\tExpert mail\tTél',
      'Alain Pittet\talain.pittet@info-domo.ch\t'
    ].join('\n'), {
      defaultRoles: ['expert', 'chef_projet']
    })

    assert.equal(result.created, 1)
    assert.deepEqual(savedDocs[0].roles, ['expert', 'chef_projet'])
  } finally {
    Person.findOne = originalFindOne
    Person.find = originalFind
    Person.prototype.save = originalSave
  }
})

test('purgeAllPeople removes the whole referential', async () => {
  const originalDeleteMany = Person.deleteMany

  try {
    Person.deleteMany = async () => ({ deletedCount: 31 })

    const result = await purgeAllPeople()
    assert.equal(result.deletedCount, 31)
  } finally {
    Person.deleteMany = originalDeleteMany
  }
})
