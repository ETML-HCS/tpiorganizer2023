const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const mongoose = require('mongoose')

const {
  buildStaticVoteCampaignPayload,
  buildStaticVoteHtml,
  buildStaticVotePhp,
  buildStaticVoteSyncPhp,
  fetchStaticVoteRecords,
  generateStaticVotesSite,
  getStaticVotePublicationStatus,
  getStaticVoteLinkTarget,
  importStaticVoteRecord,
  listStaticVoteAccessLinks,
  normalizeVotePublicPath,
  normalizeVoteRemoteDir
} = require('../services/staticVotePublicationService')
const TpiPlanning = require('../models/tpiPlanningModel')
const Vote = require('../models/voteModel')
const { MagicLink } = require('../models/magicLinkModel')
const schedulingService = require('../services/schedulingService')
const { makeQueryResult, replaceProperty } = require('./helpers/stubSandbox')

const STATIC_VOTE_ENV_KEYS = [
  'FTP_HOST',
  'FTP_PASSWORD',
  'FTP_PORT',
  'FTP_PROTOCOL',
  'FTP_REMOTE_DIR',
  'FTP_STATIC_VOTE_PUBLIC_PATH',
  'FTP_STATIC_VOTE_REMOTE_DIR',
  'FTP_USER',
  'PUBLICATION_FTP_PROTOCOL',
  'PUBLIC_SITE_BASE_URL',
  'STATIC_PUBLIC_BASE_URL',
  'STATIC_PUBLICATION_DIR',
  'STATIC_VOTE_PUBLICATION_DIR',
  'STATIC_VOTE_PUBLICATION_PUBLIC_PATH',
  'STATIC_VOTE_PUBLIC_BASE_URL',
  'STATIC_VOTE_PUBLIC_PATH',
  'STATIC_VOTE_SYNC_SECRET',
  'STATIC_VOTE_SYNC_URL'
]

async function withVoteEnv(values, run) {
  const previousValues = new Map(
    STATIC_VOTE_ENV_KEYS.map((key) => [key, process.env[key]])
  )

  for (const key of STATIC_VOTE_ENV_KEYS) {
    delete process.env[key]
  }

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      process.env[key] = value
    }
  }

  try {
    return await run()
  } finally {
    for (const key of STATIC_VOTE_ENV_KEYS) {
      const previousValue = previousValues.get(key)
      if (previousValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = previousValue
      }
    }
  }
}

test('normalizeVotePublicPath and normalizeVoteRemoteDir keep votes isolated from defenses', async () => {
  await withVoteEnv({
    FTP_REMOTE_DIR: '/home/account/domains/tpi26.ch/public_html',
    STATIC_PUBLIC_BASE_URL: 'https://tpi26.ch'
  }, async () => {
    assert.equal(normalizeVotePublicPath(2026), '/votes-2026')
    assert.equal(
      normalizeVoteRemoteDir(2026),
      '/home/account/domains/tpi26.ch/public_html/votes-2026'
    )

    const status = await getStaticVotePublicationStatus(2026)
    assert.equal(status.publicUrl, 'https://tpi26.ch/votes-2026/')
    assert.equal(status.remoteDir, '/home/account/domains/tpi26.ch/public_html/votes-2026')
  })
})

test('getStaticVoteLinkTarget builds magic-link targets for the vote mini-site', async () => {
  const target = await getStaticVoteLinkTarget(2026, 'https://tpi26.ch/votes-2026/')

  assert.deepEqual(target, {
    baseUrl: 'https://tpi26.ch',
    redirectPath: '/votes-2026/'
  })
})

test('listStaticVoteAccessLinks only exports vote magic links', async () => {
  let receivedQuery = null
  const restore = replaceProperty(MagicLink, 'find', (query) => {
    receivedQuery = query
    return makeQueryResult([
      {
        tokenHash: 'a'.repeat(64),
        personId: '507f1f77bcf86cd799439011',
        personName: 'Alice Expert',
        recipientEmail: 'alice@example.test',
        scope: { kind: 'stakeholder_votes', tpiId: '507f1f77bcf86cd799439012' },
        expiresAt: new Date('2026-06-01T10:00:00.000Z'),
        maxUses: 10,
        usageCount: 0
      }
    ])
  })

  try {
    const links = await listStaticVoteAccessLinks(2026)

    assert.equal(receivedQuery.type, 'vote')
    assert.equal(receivedQuery.year, 2026)
    assert.equal(links.length, 1)
    assert.equal(links[0].hash, 'a'.repeat(64))
    assert.equal(links[0].scope.tpiId, '507f1f77bcf86cd799439012')
  } finally {
    restore()
  }
})

test('buildStaticVoteCampaignPayload groups pending votes by voter and TPI', async () => {
  const personId = new mongoose.Types.ObjectId()
  const tpiId = new mongoose.Types.ObjectId()
  const fixedSlotId = new mongoose.Types.ObjectId()
  const altSlotId = new mongoose.Types.ObjectId()
  const fixedVoteId = new mongoose.Types.ObjectId()
  const altVoteId = new mongoose.Types.ObjectId()
  const tpis = [
    {
      _id: tpiId,
      reference: 'TPI-2026-001',
      sujet: 'Sujet planning',
      status: 'voting',
      candidat: { firstName: 'Cara', lastName: 'Candidate' },
      proposedSlots: [
        { slot: { _id: fixedSlotId } },
        { slot: { _id: altSlotId } }
      ]
    }
  ]
  const votes = [
    {
      _id: fixedVoteId,
      tpiPlanning: tpiId,
      voter: { _id: personId, firstName: 'Alice', lastName: 'Expert', email: 'alice@example.test' },
      voterRole: 'expert1',
      slot: {
        _id: fixedSlotId,
        date: new Date('2026-06-10T00:00:00.000Z'),
        period: 1,
        startTime: '08:00',
        endTime: '09:00',
        room: { name: 'A101', site: 'ETML' }
      }
    },
    {
      _id: altVoteId,
      tpiPlanning: tpiId,
      voter: { _id: personId, firstName: 'Alice', lastName: 'Expert', email: 'alice@example.test' },
      voterRole: 'expert1',
      slot: {
        _id: altSlotId,
        date: new Date('2026-06-11T00:00:00.000Z'),
        period: 2,
        startTime: '09:15',
        endTime: '10:15',
        room: { name: 'B202', site: 'ETML' }
      }
    }
  ]

  const restore = [
    replaceProperty(TpiPlanning, 'find', () => makeQueryResult(tpis)),
    replaceProperty(Vote, 'find', () => makeQueryResult(votes))
  ]

  try {
    const payload = await buildStaticVoteCampaignPayload(2026, '2026-05-01T10:00:00.000Z')

    assert.equal(payload.year, 2026)
    assert.equal(payload.groups.length, 1)
    assert.equal(payload.groups[0].personId, String(personId))
    assert.equal(payload.groups[0].tpi.reference, 'TPI-2026-001')
    assert.equal(payload.groups[0].fixedVoteId, String(fixedVoteId))
    assert.equal(payload.groups[0].fixedSlotId, String(fixedSlotId))
    assert.equal(payload.groups[0].proposalOptions.length, 1)
    assert.equal(payload.groups[0].proposalOptions[0].slotId, String(altSlotId))
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('generateStaticVotesSite writes PHP, sync endpoint and manifest in the vote folder', async (t) => {
  const publicationRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tpiorganizer-static-votes-'))
  const personId = new mongoose.Types.ObjectId()
  const tpiId = new mongoose.Types.ObjectId()
  const fixedSlotId = new mongoose.Types.ObjectId()
  const fixedVoteId = new mongoose.Types.ObjectId()
  const tpis = [
    {
      _id: tpiId,
      reference: 'TPI-2026-001',
      sujet: 'Sujet planning',
      status: 'voting',
      candidat: { firstName: 'Cara', lastName: 'Candidate' },
      proposedSlots: [{ slot: { _id: fixedSlotId } }]
    }
  ]
  const votes = [
    {
      _id: fixedVoteId,
      tpiPlanning: tpiId,
      voter: { _id: personId, firstName: 'Alice', lastName: 'Expert', email: 'alice@example.test' },
      voterRole: 'expert1',
      slot: {
        _id: fixedSlotId,
        date: new Date('2026-06-10T00:00:00.000Z'),
        period: 1,
        startTime: '08:00',
        endTime: '09:00',
        room: { name: 'A101', site: 'ETML' }
      }
    }
  ]

  t.after(() => fs.rmSync(publicationRoot, { recursive: true, force: true }))

  await withVoteEnv({
    STATIC_VOTE_PUBLICATION_DIR: publicationRoot,
    STATIC_VOTE_SYNC_SECRET: 'sync-secret',
    STATIC_PUBLIC_BASE_URL: 'https://tpi26.ch'
  }, async () => {
    const restore = [
      replaceProperty(TpiPlanning, 'find', () => makeQueryResult(tpis)),
      replaceProperty(Vote, 'find', () => makeQueryResult(votes)),
      replaceProperty(MagicLink, 'find', () => makeQueryResult([
        {
          tokenHash: 'd'.repeat(64),
          personId,
          personName: 'Alice Expert',
          recipientEmail: 'alice@example.test',
          expiresAt: new Date('2026-06-01T10:00:00.000Z'),
          maxUses: 20,
          usageCount: 0
        }
      ]))
    ]

    try {
      const result = await generateStaticVotesSite(2026)

      assert.equal(result.publicUrl, 'https://tpi26.ch/votes-2026/')
      assert.equal(result.groupCount, 1)
      assert.equal(result.accessLinkCount, 1)
      assert.equal(result.syncSecretConfigured, true)
      assert.equal(fs.existsSync(result.phpIndexPath), true)
      assert.equal(fs.existsSync(result.syncPhpPath), true)
      assert.equal(fs.existsSync(result.htaccessPath), true)
      assert.equal(fs.existsSync(result.manifestPath), true)
      assert.match(fs.readFileSync(result.phpIndexPath, 'utf8'), /window\.__STATIC_VOTE_BOOTSTRAP__/)
      assert.match(fs.readFileSync(result.syncPhpPath, 'utf8'), /HTTP_X_SYNC_SECRET/)
    } finally {
      while (restore.length > 0) {
        restore.pop()()
      }
    }
  })
})

test('buildStaticVotePhp gates the vote UI with token hashes and writes JSONL submissions', () => {
  const payload = {
    year: 2026,
    generatedAt: '2026-05-01T10:00:00.000Z',
    campaignId: 'vote-2026-test',
    groups: [
      {
        personId: 'person-1',
        personName: 'Alice Expert',
        tpi: { id: 'tpi-1', reference: 'TPI-2026-001' },
        fixedVoteId: 'vote-fixed',
        fixedSlotId: 'slot-fixed',
        fixedSlot: { id: 'slot-fixed', label: '10.06.2026 | A101' },
        proposalOptions: []
      }
    ]
  }
  const html = buildStaticVoteHtml(payload)
  const php = buildStaticVotePhp({
    html,
    year: 2026,
    campaignPayload: payload,
    accessLinks: [
      {
        hash: 'b'.repeat(64),
        personId: 'person-1',
        name: 'Alice Expert',
        email: 'alice@example.test',
        expiresAt: '2026-06-01T10:00:00.000Z'
      }
    ]
  })

  assert.match(php, /^<\?php/)
  assert.match(php, /hash\('sha256', \$staticVoteToken\)/)
  assert.match(php, /hash_equals\(\$candidateHash, \$tokenHash\)/)
  assert.match(php, /staticVoteFilteredGroups/)
  assert.match(php, /scopeTpiId/)
  assert.match(php, /Vote deja transmis pour ce TPI/)
  assert.match(php, /staticVoteHandleSubmit/)
  assert.match(php, /votes\.jsonl/)
  assert.match(php, /window\.__STATIC_VOTE_BOOTSTRAP__/)
  assert.doesNotMatch(php, /STATIC_VOTE_BOOTSTRAP -->/)
})

test('buildStaticVoteSyncPhp requires the dedicated sync secret', () => {
  const php = buildStaticVoteSyncPhp({
    year: 2026,
    syncSecret: 'secret-value'
  })

  assert.match(php, /HTTP_X_SYNC_SECRET/)
  assert.match(php, /hash_equals\(\$staticVoteSyncSecret, \$providedSecret\)/)
  assert.match(php, /votes\.jsonl/)
  assert.match(php, /'year' => 2026/)
  assert.doesNotMatch(php, /STATIC_VOTE_ACCESS_JSON/)
})

test('fetchStaticVoteRecords calls remote sync.php with X-Sync-Secret', async () => {
  await withVoteEnv({
    STATIC_VOTE_SYNC_SECRET: 'sync-secret'
  }, async () => {
    let receivedUrl = ''
    let receivedHeaders = null

    const result = await fetchStaticVoteRecords({
      year: 2026,
      remoteUrl: 'https://tpi26.ch/votes-2026/sync.php',
      fetchImpl: async (url, options) => {
        receivedUrl = url
        receivedHeaders = options.headers
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            records: [{ id: 'record-1', year: 2026 }]
          })
        }
      }
    })

    assert.equal(receivedUrl, 'https://tpi26.ch/votes-2026/sync.php')
    assert.equal(receivedHeaders['X-Sync-Secret'], 'sync-secret')
    assert.equal(result.records.length, 1)
  })
})

test('importStaticVoteRecord applies a static proposal response idempotently', async () => {
  const year = 2026
  const personId = new mongoose.Types.ObjectId()
  const tpiId = new mongoose.Types.ObjectId()
  const fixedSlotId = new mongoose.Types.ObjectId()
  const altSlotId = new mongoose.Types.ObjectId()
  const fixedVoteId = new mongoose.Types.ObjectId()
  const altVoteId = new mongoose.Types.ObjectId()
  const savedVotes = []
  let validationInput = null
  const fixedVote = {
    _id: fixedVoteId,
    slot: fixedSlotId,
    voterRole: 'expert1',
    async save() {
      savedVotes.push({ id: String(this._id), decision: this.decision, magicLinkUsed: this.magicLinkUsed })
    }
  }
  const altVote = {
    _id: altVoteId,
    slot: altSlotId,
    voterRole: 'expert1',
    async save() {
      savedVotes.push({ id: String(this._id), decision: this.decision, priority: this.priority, magicLinkUsed: this.magicLinkUsed })
    }
  }
  const tpi = {
    _id: tpiId,
    year,
    status: 'voting',
    expert1: personId,
    expert2: new mongoose.Types.ObjectId(),
    chefProjet: new mongoose.Types.ObjectId(),
    proposedSlots: [
      { slot: { _id: fixedSlotId } },
      { slot: { _id: altSlotId } }
    ]
  }
  const restore = [
    replaceProperty(Vote, 'exists', async () => null),
    replaceProperty(TpiPlanning, 'findOne', () => makeQueryResult(tpi)),
    replaceProperty(Vote, 'find', () => makeQueryResult([fixedVote, altVote])),
    replaceProperty(schedulingService, 'registerVoteAndCheckValidation', async (voteId, decision, comment) => {
      validationInput = { voteId: String(voteId), decision, comment }
      return { success: true }
    })
  ]

  try {
    const result = await importStaticVoteRecord({
      id: 'submission-1',
      year,
      personId: String(personId),
      tpiId: String(tpiId),
      fixedVoteId: String(fixedVoteId),
      mode: 'proposal',
      proposedSlotIds: [String(altSlotId)],
      submittedAt: '2026-05-10T08:00:00.000Z',
      tokenHash: 'c'.repeat(64)
    }, year)

    assert.equal(result.imported, true)
    assert.equal(savedVotes.length, 2)
    assert.equal(savedVotes.find((vote) => vote.id === String(fixedVoteId)).decision, 'rejected')
    assert.equal(savedVotes.find((vote) => vote.id === String(altVoteId)).decision, 'preferred')
    assert.equal(savedVotes.find((vote) => vote.id === String(altVoteId)).priority, 1)
    assert.equal(validationInput.decision, 'rejected')
    assert.equal(validationInput.voteId, String(fixedVoteId))
    assert.match(savedVotes[0].magicLinkUsed, /^static-vote:2026:submission-1$/)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('importStaticVoteRecord rejects incomplete proposal payloads', async () => {
  const year = 2026
  const result = await importStaticVoteRecord({
    id: 'submission-incomplete',
    year,
    personId: String(new mongoose.Types.ObjectId()),
    tpiId: String(new mongoose.Types.ObjectId()),
    fixedVoteId: String(new mongoose.Types.ObjectId()),
    mode: 'proposal',
    proposedSlotIds: [],
    specialRequest: {
      reason: 'Pas disponible'
    },
    submittedAt: '2026-05-10T08:00:00.000Z'
  }, year)

  assert.equal(result.imported, false)
  assert.equal(result.skipped, true)
  assert.equal(result.reason, 'invalid_record')
})

test('importStaticVoteRecord refuses records for a TPI no longer open for voting', async () => {
  const year = 2026
  const personId = new mongoose.Types.ObjectId()
  const tpiId = new mongoose.Types.ObjectId()
  const fixedVoteId = new mongoose.Types.ObjectId()
  const restore = [
    replaceProperty(Vote, 'exists', async () => null),
    replaceProperty(TpiPlanning, 'findOne', () => makeQueryResult({
      _id: tpiId,
      year,
      status: 'confirmed',
      expert1: personId,
      proposedSlots: []
    }))
  ]

  try {
    const result = await importStaticVoteRecord({
      id: 'submission-closed',
      year,
      personId: String(personId),
      tpiId: String(tpiId),
      fixedVoteId: String(fixedVoteId),
      mode: 'ok',
      submittedAt: '2026-05-10T08:00:00.000Z'
    }, year)

    assert.equal(result.imported, false)
    assert.equal(result.skipped, false)
    assert.equal(result.reason, 'tpi_not_open')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})
