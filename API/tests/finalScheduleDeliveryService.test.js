const test = require('node:test')
const assert = require('node:assert/strict')

const Person = require('../models/personModel')
const PublicationVersion = require('../models/publicationVersionModel')
const { FinalScheduleDelivery } = require('../models/finalScheduleDeliveryModel')
const coordinationCatalogService = require('../services/coordinationCatalogService')
const emailService = require('../services/emailService')
const publishedSoutenanceService = require('../services/publishedSoutenanceService')
const {
  makeQueryResult,
  replaceProperty: patchMethod
} = require('./helpers/stubSandbox')

const PERSON_IDS = Object.freeze({
  candidate1: '64f000000000000000000001',
  candidate2: '64f000000000000000000002',
  expert1: '64f000000000000000000003',
  expert2: '64f000000000000000000004',
  expert3: '64f000000000000000000005',
  boss1: '64f000000000000000000006',
  missingPerson: '64f000000000000000000007'
})

function buildRooms() {
  return [
    {
      site: 'ETML',
      name: 'A101',
      date: '2026-06-10',
      tpiDatas: [
        {
          refTpi: 'TPI-2026-001',
          period: 1,
          startTime: '08:00',
          endTime: '09:00',
          candidat: 'Alice Candidate',
          candidatPersonId: PERSON_IDS.candidate1,
          expert1: { name: 'Eva Expert', personId: PERSON_IDS.expert1 },
          expert2: { name: 'No Mail', personId: PERSON_IDS.expert2 },
          boss: { name: 'Paul Chef', personId: PERSON_IDS.boss1 }
        },
        {
          refTpi: 'TPI-2026-002',
          period: 2,
          startTime: '09:15',
          endTime: '10:15',
          candidat: 'Bob Candidate',
          candidatPersonId: PERSON_IDS.candidate2,
          expert1: { name: 'Eva Expert', personId: PERSON_IDS.expert1 },
          expert2: { name: 'Nina Expert', personId: PERSON_IDS.expert3 },
          boss: { name: 'Paul Chef', personId: PERSON_IDS.boss1 }
        }
      ]
    }
  ]
}

function patchPublicationContext({ rooms = buildRooms(), deliveries = [] } = {}) {
  const people = [
    {
      _id: PERSON_IDS.candidate1,
      firstName: 'Alice',
      lastName: 'Candidate',
      email: 'alice@example.test',
      sendEmails: true
    },
    {
      _id: PERSON_IDS.candidate2,
      firstName: 'Bob',
      lastName: 'Candidate',
      email: 'bob@example.test',
      sendEmails: true
    },
    {
      _id: PERSON_IDS.expert1,
      firstName: 'Eva',
      lastName: 'Expert',
      email: 'eva@example.test',
      sendEmails: true
    },
    {
      _id: PERSON_IDS.expert2,
      firstName: 'No',
      lastName: 'Mail',
      email: '',
      sendEmails: true
    },
    {
      _id: PERSON_IDS.expert3,
      firstName: 'Nina',
      lastName: 'Expert',
      email: 'nina@example.test',
      sendEmails: false
    },
    {
      _id: PERSON_IDS.boss1,
      firstName: 'Paul',
      lastName: 'Chef',
      email: 'paul@example.test',
      sendEmails: true
    }
  ]

  return [
    patchMethod(PublicationVersion, 'findOne', () => makeQueryResult({
      year: 2026,
      version: 7,
      isActive: true,
      publishedAt: new Date('2026-05-18T10:00:00.000Z')
    })),
    patchMethod(publishedSoutenanceService, 'listPublishedSoutenances', async (_year, options) => {
      assert.equal(options.version, 7)
      return rooms
    }),
    patchMethod(Person, 'find', (query) => {
      const requestedIds = new Set((query?._id?.$in || []).map(String))
      return makeQueryResult(people.filter((person) => requestedIds.has(String(person._id))))
    }),
    patchMethod(FinalScheduleDelivery, 'find', () => makeQueryResult(deliveries)),
    patchMethod(coordinationCatalogService, 'getSharedEmailSettingsIfAvailable', async () => ({}))
  ]
}

test('previewFinalScheduleDelivery prepares one recipient with multiple TPI events', async () => {
  const finalScheduleDeliveryService = require('../services/finalScheduleDeliveryService')
  const restore = patchPublicationContext()

  try {
    const preview = await finalScheduleDeliveryService.previewFinalScheduleDelivery({ year: 2026 })

    assert.equal(preview.available, true)
    assert.equal(preview.publicationVersion, 7)
    assert.equal(preview.roomCount, 1)
    assert.equal(preview.tpiCount, 2)
    assert.equal(preview.summary.recipientCount, 6)
    assert.equal(preview.summary.sendableCount, 4)
    assert.equal(preview.summary.pendingSendCount, 4)
    assert.equal(preview.summary.missingEmailCount, 1)
    assert.equal(preview.summary.disabledEmailCount, 1)

    const expert = preview.recipients.find((recipient) => recipient.personId === PERSON_IDS.expert1)
    assert.equal(expert.personName, 'Eva Expert')
    assert.equal(expert.recipientEmail, 'eva@example.test')
    assert.equal(expert.tpiCount, 2)
    assert.equal(expert.canSendEmail, true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('previewFinalScheduleDelivery reports invalid or missing stakeholders without making them sendable', async () => {
  const finalScheduleDeliveryService = require('../services/finalScheduleDeliveryService')
  const rooms = buildRooms()
  rooms[0].tpiDatas[0] = {
    ...rooms[0].tpiDatas[0],
    expert1: { name: 'Legacy Expert', personId: 'legacy-expert' },
    expert2: { name: 'Missing Expert', personId: PERSON_IDS.missingPerson }
  }
  const restore = patchPublicationContext({ rooms })

  try {
    const preview = await finalScheduleDeliveryService.previewFinalScheduleDelivery({ year: 2026 })

    assert.equal(preview.summary.invalidPersonIdCount, 1)
    assert.equal(preview.summary.personNotFoundCount, 1)
    assert.equal(preview.summary.pendingSendCount, 4)

    const invalidRecipient = preview.recipients.find((recipient) => recipient.personId === 'legacy-expert')
    assert.equal(invalidRecipient.canSendEmail, false)
    assert.equal(invalidRecipient.skippedReason, 'invalid_person_id')

    const missingRecipient = preview.recipients.find((recipient) => recipient.personId === PERSON_IDS.missingPerson)
    assert.equal(missingRecipient.canSendEmail, false)
    assert.equal(missingRecipient.skippedReason, 'person_not_found')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('previewFinalScheduleDelivery keeps pending deliveries out of the sendable queue', async () => {
  const finalScheduleDeliveryService = require('../services/finalScheduleDeliveryService')
  const restore = patchPublicationContext({
    deliveries: [
      {
        year: 2026,
        publicationVersion: 7,
        personId: PERSON_IDS.expert1,
        status: 'pending',
        updatedAt: new Date()
      }
    ]
  })

  try {
    const preview = await finalScheduleDeliveryService.previewFinalScheduleDelivery({ year: 2026 })

    assert.equal(preview.summary.inProgressCount, 1)
    assert.equal(preview.summary.pendingSendCount, 3)

    const expert = preview.recipients.find((recipient) => recipient.personId === PERSON_IDS.expert1)
    assert.equal(expert.canSendEmail, true)
    assert.equal(expert.inProgress, true)
    assert.equal(expert.deliveryStatus, 'pending')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('sendFinalScheduleDelivery sends PDF and iCal attachments once per publication', async () => {
  const finalScheduleDeliveryService = require('../services/finalScheduleDeliveryService')
  const sentEmails = []
  const deliveryRecords = []
  const restore = [
    ...patchPublicationContext({ deliveries: deliveryRecords }),
    patchMethod(emailService, 'sendEmail', async (email, template, data, options) => {
      sentEmails.push({ email, template, data, attachments: options.attachments })
      return {
        success: true,
        messageId: `message-${sentEmails.length}`
      }
    }),
    patchMethod(FinalScheduleDelivery, 'findOneAndUpdate', async (filter, update) => {
      const existingIndex = deliveryRecords.findIndex((record) => (
        String(record.personId) === String(filter.personId)
      ))
      const nextRecord = {
        year: filter.year,
        publicationVersion: filter.publicationVersion,
        personId: filter.personId,
        ...(existingIndex >= 0 ? deliveryRecords[existingIndex] : {}),
        ...(update?.$set || {})
      }

      if (existingIndex >= 0) {
        deliveryRecords[existingIndex] = nextRecord
      } else {
        deliveryRecords.push(nextRecord)
      }

      return nextRecord
    })
  ]

  try {
    const firstResult = await finalScheduleDeliveryService.sendFinalScheduleDelivery({ year: 2026 })

    assert.equal(firstResult.success, true)
    assert.equal(firstResult.summary.sentCount, 4)
    assert.equal(firstResult.summary.skippedCount, 2)
    assert.equal(sentEmails.length, 4)
    assert.equal(sentEmails[0].template, 'soutenanceSchedulePackage')
    assert.equal(sentEmails[0].attachments.length, 3)
    assert.ok(sentEmails[0].attachments.some((attachment) => attachment.filename.endsWith('.ics')))
    assert.ok(sentEmails[0].attachments.some((attachment) => attachment.filename.endsWith('_horaire_personnel.pdf')))
    assert.ok(sentEmails[0].attachments.some((attachment) => attachment.filename.endsWith('_planification_salles.pdf')))
    assert.equal(deliveryRecords.filter((record) => record.status === 'sent').length, 4)

    const secondResult = await finalScheduleDeliveryService.sendFinalScheduleDelivery({ year: 2026 })

    assert.equal(secondResult.summary.sentCount, 0)
    assert.equal(secondResult.summary.alreadySentCount, 4)
    assert.equal(sentEmails.length, 4)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('buildManualFinalSchedulePackage creates a zip without sending SMTP email', async () => {
  const finalScheduleDeliveryService = require('../services/finalScheduleDeliveryService')
  let smtpCalled = false
  const restore = [
    ...patchPublicationContext(),
    patchMethod(emailService, 'sendEmail', async () => {
      smtpCalled = true
      return { success: false }
    })
  ]

  try {
    const result = await finalScheduleDeliveryService.buildManualFinalSchedulePackage({ year: 2026 })

    assert.equal(result.success, true)
    assert.equal(result.available, true)
    assert.equal(result.publicationVersion, 7)
    assert.equal(result.summary.packagedCount, 4)
    assert.equal(smtpCalled, false)
    assert.ok(Buffer.isBuffer(result.buffer))
    assert.equal(result.buffer.slice(0, 2).toString('utf8'), 'PK')
    assert.equal(result.buffer.includes(Buffer.from('manifest.csv')), true)
    assert.equal(result.buffer.includes(Buffer.from('message.txt')), true)
    assert.equal(result.buffer.includes(Buffer.from('_outlook.eml')), true)
    assert.equal(result.buffer.includes(Buffer.from('X-Unsent: 1')), true)
    assert.equal(result.buffer.includes(Buffer.from('Content-Disposition: attachment')), true)
    assert.match(result.filename, /horaires_definitifs.*outlook\.zip$/)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('sendFinalScheduleDelivery does not mark a sent email as failed when delivery logging fails', async () => {
  const finalScheduleDeliveryService = require('../services/finalScheduleDeliveryService')
  const sentEmails = []
  const deliveryRecords = []
  const restore = [
    ...patchPublicationContext({ deliveries: deliveryRecords }),
    patchMethod(emailService, 'sendEmail', async (email, template, data, options) => {
      sentEmails.push({ email, template, data, attachments: options.attachments })
      return {
        success: true,
        messageId: `message-${sentEmails.length}`
      }
    }),
    patchMethod(FinalScheduleDelivery, 'findOneAndUpdate', async (filter, update) => {
      if (update?.$set?.status === 'sent') {
        throw new Error('database write failed')
      }

      const existingIndex = deliveryRecords.findIndex((record) => (
        String(record.personId) === String(filter.personId)
      ))
      const nextRecord = {
        year: filter.year,
        publicationVersion: filter.publicationVersion,
        personId: filter.personId,
        ...(existingIndex >= 0 ? deliveryRecords[existingIndex] : {}),
        ...(update?.$set || {})
      }

      if (existingIndex >= 0) {
        deliveryRecords[existingIndex] = nextRecord
      } else {
        deliveryRecords.push(nextRecord)
      }

      return nextRecord
    })
  ]

  try {
    const result = await finalScheduleDeliveryService.sendFinalScheduleDelivery({ year: 2026 })

    assert.equal(result.success, false)
    assert.equal(result.summary.sentCount, 4)
    assert.equal(result.summary.failedCount, 0)
    assert.equal(result.summary.recordingFailedCount, 4)
    assert.equal(sentEmails.length, 4)
    assert.equal(deliveryRecords.filter((record) => record.status === 'pending').length, 4)
    assert.equal(deliveryRecords.filter((record) => record.status === 'failed').length, 0)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})
