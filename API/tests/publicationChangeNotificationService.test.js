const test = require('node:test')
const assert = require('node:assert/strict')

const PublicationVersion = require('../models/publicationVersionModel')
const Person = require('../models/personModel')
const { PublicationChangeNotification } = require('../models/publicationChangeNotificationModel')
const accessLinkTokenService = require('../modules/accessLinks/tokenService')
const emailService = require('../services/emailService')
const { replaceProperty: patchMethod } = require('./helpers/stubSandbox')
const {
  buildImpactedRecipientEntries,
  diffPublicationDefenses,
  indexPublicationDefenses,
  sendDefenseChangeNotifications
} = require('../services/publicationChangeNotificationService')

function buildRoom(overrides = {}) {
  return {
    site: 'ETML',
    name: 'A101',
    date: '2026-06-10',
    tpiDatas: [
      {
        refTpi: 'TPI-2026-042',
        period: 1,
        startTime: '08:00',
        endTime: '09:00',
        candidat: 'Alice Candidate',
        candidatPersonId: 'candidate-1',
        expert1: { name: 'Expert One', personId: 'expert-1' },
        expert2: { name: 'Expert Two', personId: 'expert-2' },
        boss: { name: 'Boss One', personId: 'boss-1' },
        ...overrides.tpiData
      }
    ],
    ...overrides.room
  }
}

function makeQueryResult(value) {
  return {
    select() {
      return this
    },
    sort() {
      return this
    },
    lean: async () => value
  }
}

function patchPublicationPair(currentPublication, previousPublication) {
  return patchMethod(PublicationVersion, 'findOne', (query = {}) => ({
    sort() {
      return this
    },
    lean: async () => {
      if (query?.isActive === true || query?.version === currentPublication?.version) {
        return currentPublication
      }

      return previousPublication
    }
  }))
}

function buildCandidateOnlyRoom(overrides = {}) {
  return {
    site: 'ETML',
    name: 'A101',
    date: '2026-06-10',
    tpiDatas: [
      {
        refTpi: 'TPI-2026-050',
        period: 1,
        startTime: '08:00',
        endTime: '09:00',
        candidat: 'Alice Candidate',
        candidatPersonId: 'candidate-1',
        ...overrides.tpiData
      }
    ],
    ...overrides.room
  }
}

test('indexPublicationDefenses ignores empty slots and indexes real defenses by reference', () => {
  const index = indexPublicationDefenses([
    {
      site: 'ETML',
      name: 'A101',
      date: '2026-06-10',
      tpiDatas: [
        { id: 'empty-1', period: 1 },
        {
          id: 'filled-1',
          refTpi: 'TPI-2026-007',
          candidat: 'Alice Candidate'
        }
      ]
    }
  ])

  assert.equal(index.size, 1)
  assert.equal(index.get('7').reference, 'TPI-2026-007')
})

test('diffPublicationDefenses reports no change for identical publications', () => {
  const rooms = [buildRoom()]

  assert.deepEqual(diffPublicationDefenses(rooms, rooms), [])
})

test('diffPublicationDefenses detects a changed defense slot and targets only its stakeholders', () => {
  const previousRooms = [buildRoom()]
  const currentRooms = [
    buildRoom({
      room: { name: 'B204' },
      tpiData: {
        startTime: '10:00',
        endTime: '11:00'
      }
    })
  ]

  const changes = diffPublicationDefenses(previousRooms, currentRooms)

  assert.equal(changes.length, 1)
  assert.equal(changes[0].kind, 'updated')
  assert.deepEqual(changes[0].reasonLabels, ['horaire', 'salle'])

  const impacted = buildImpactedRecipientEntries(changes)

  assert.deepEqual(
    impacted.recipients.map((recipient) => recipient.personId).sort(),
    ['boss-1', 'candidate-1', 'expert-1', 'expert-2']
  )
})

test('diffPublicationDefenses targets old and new stakeholders when a participant changes', () => {
  const previousRooms = [buildRoom()]
  const currentRooms = [
    buildRoom({
      tpiData: {
        expert1: { name: 'Expert New', personId: 'expert-new' }
      }
    })
  ]

  const changes = diffPublicationDefenses(previousRooms, currentRooms)
  const impacted = buildImpactedRecipientEntries(changes)

  assert.equal(changes.length, 1)
  assert.ok(changes[0].reasonLabels.includes('Expert 1'))
  assert.deepEqual(
    impacted.recipients.map((recipient) => recipient.personId).sort(),
    ['boss-1', 'candidate-1', 'expert-1', 'expert-2', 'expert-new']
  )
})

test('diffPublicationDefenses detects added and removed defenses', () => {
  const previousRooms = [buildRoom()]
  const currentRooms = [
    buildRoom({
      tpiData: {
        refTpi: 'TPI-2026-043',
        candidat: 'Bob Candidate',
        candidatPersonId: 'candidate-2'
      }
    })
  ]

  const changes = diffPublicationDefenses(previousRooms, currentRooms)

  assert.equal(changes.length, 2)
  assert.deepEqual(
    changes.map((change) => change.kind).sort(),
    ['added', 'removed']
  )
})

test('sendDefenseChangeNotifications sends one targeted email and marks the notification record', async () => {
  const currentPublication = {
    year: 2026,
    version: 2,
    isActive: true,
    rooms: [
      buildCandidateOnlyRoom({
        tpiData: {
          startTime: '10:00',
          endTime: '11:00'
        }
      })
    ]
  }
  const previousPublication = {
    year: 2026,
    version: 1,
    rooms: [buildCandidateOnlyRoom()]
  }
  const sentEmails = []
  let notificationRecord = null
  const restore = [
    patchPublicationPair(currentPublication, previousPublication),
    patchMethod(Person, 'find', () => makeQueryResult([
      {
        _id: 'candidate-1',
        firstName: 'Alice',
        lastName: 'Candidate',
        email: 'alice@example.test',
        sendEmails: true
      }
    ])),
    patchMethod(PublicationChangeNotification, 'find', () => makeQueryResult(notificationRecord
      ? [notificationRecord]
      : [])),
    patchMethod(PublicationChangeNotification, 'findOneAndUpdate', async (filter, update) => {
      notificationRecord = {
        personId: filter.personId,
        ...(update?.$set || {}),
        createdAt: update?.$setOnInsert?.createdAt || new Date()
      }
      return notificationRecord
    }),
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async (payload) => {
      assert.equal(payload.type, 'soutenance')
      assert.deepEqual(payload.sources, ['admin_access_generated'])
      assert.equal(payload.scope.publicationVersion, 2)
      return {
        id: 'link-1',
        url: 'https://example.test/defenses/2026?ml=token',
        expiresAt: new Date('2026-06-01T10:00:00.000Z')
      }
    }),
    patchMethod(accessLinkTokenService, 'createSoutenanceMagicLink', async () => {
      throw new Error('Le lien existant doit être réutilisé.')
    }),
    patchMethod(accessLinkTokenService, 'markMagicLinkEmailDelivery', async () => {
      throw new Error('Le statut du lien normal ne doit pas servir de suivi de notification de changement.')
    }),
    patchMethod(emailService, 'sendEmail', async (email, template, data) => {
      sentEmails.push({ email, template, data })
      return {
        success: true,
        messageId: 'message-1'
      }
    })
  ]

  try {
    const result = await sendDefenseChangeNotifications({
      year: 2026,
      baseUrl: 'https://example.test',
      linkTarget: 'app'
    })

    assert.equal(result.success, true)
    assert.equal(result.summary.requestedCount, 1)
    assert.equal(result.summary.sentCount, 1)
    assert.equal(sentEmails.length, 1)
    assert.equal(sentEmails[0].email, 'alice@example.test')
    assert.equal(sentEmails[0].template, 'defenseChangeNotification')
    assert.equal(sentEmails[0].data.changes.length, 1)
    assert.deepEqual(sentEmails[0].data.changes[0].reasonLabels, ['horaire'])
    assert.equal(notificationRecord.personId, 'candidate-1')
    assert.equal(notificationRecord.status, 'sent')
    assert.equal(notificationRecord.messageId, 'message-1')
    assert.equal(result.preview.summary.pendingRecipientCount, 0)
    assert.equal(result.preview.summary.sentRecipientCount, 1)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('sendDefenseChangeNotifications fails clearly when a static publication link is missing', async () => {
  const currentPublication = {
    year: 2026,
    version: 2,
    isActive: true,
    rooms: [
      buildCandidateOnlyRoom({
        tpiData: {
          startTime: '10:00',
          endTime: '11:00'
        }
      })
    ]
  }
  const previousPublication = {
    year: 2026,
    version: 1,
    rooms: [buildCandidateOnlyRoom()]
  }
  let notificationRecord = null
  const restore = [
    patchPublicationPair(currentPublication, previousPublication),
    patchMethod(Person, 'find', () => makeQueryResult([
      {
        _id: 'candidate-1',
        firstName: 'Alice',
        lastName: 'Candidate',
        email: 'alice@example.test',
        sendEmails: true
      }
    ])),
    patchMethod(PublicationChangeNotification, 'find', () => makeQueryResult(notificationRecord
      ? [notificationRecord]
      : [])),
    patchMethod(PublicationChangeNotification, 'findOneAndUpdate', async (filter, update) => {
      notificationRecord = {
        personId: filter.personId,
        ...(update?.$set || {}),
        createdAt: update?.$setOnInsert?.createdAt || new Date()
      }
      return notificationRecord
    }),
    patchMethod(accessLinkTokenService, 'findReusableMagicLink', async () => null),
    patchMethod(accessLinkTokenService, 'createSoutenanceMagicLink', async () => {
      throw new Error('Un lien statique manquant ne doit pas être créé pendant l’envoi.')
    }),
    patchMethod(accessLinkTokenService, 'markMagicLinkEmailDelivery', async () => {
      throw new Error('Aucune livraison ne doit être marquée sans lien.')
    }),
    patchMethod(emailService, 'sendEmail', async () => {
      throw new Error('Aucun email ne doit partir sans lien personnel.')
    })
  ]

  try {
    const result = await sendDefenseChangeNotifications({
      year: 2026,
      baseUrl: 'https://publication.example.test',
      redirectPath: '/defenses-2026/',
      linkTarget: 'publication'
    })

    assert.equal(result.success, false)
    assert.equal(result.summary.requestedCount, 1)
    assert.equal(result.summary.failedCount, 1)
    assert.match(result.results[0].error, /Regénérez puis republiez le site statique/)
    assert.equal(notificationRecord.status, 'failed')
    assert.match(notificationRecord.error, /Regénérez puis republiez le site statique/)
    assert.equal(result.preview.summary.pendingRecipientCount, 1)
    assert.equal(result.preview.summary.failedRecipientCount, 1)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})
