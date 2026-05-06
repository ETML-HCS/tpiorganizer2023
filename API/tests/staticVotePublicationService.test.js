const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const mongoose = require('mongoose')

const {
  buildStaticVoteArbitragePhp,
  buildStaticVoteCampaignPayload,
  buildStaticVoteHtml,
  buildStaticVotePhp,
  buildStaticVoteSyncPhp,
  createStaticVoteArbitrageToken,
  fetchStaticVoteRecords,
  generateStaticVotesSite,
  getStaticVotePublicationStatus,
  getStaticVoteLinkTarget,
  importStaticVoteArbitrageRecord,
  importStaticVoteRecord,
  listStaticVoteAccessLinks,
  normalizeVotePublicPath,
  normalizeVoteRemoteDir
} = require('../services/staticVotePublicationService')
const TpiPlanning = require('../models/tpiCoordinationModel')
const Vote = require('../models/voteModel')
const { MagicLink } = require('../models/magicLinkModel')
const { ResolutionProposal } = require('../models/resolutionProposalModel')
const schedulingService = require('../services/schedulingService')
const { makeQueryResult, replaceProperty } = require('./helpers/stubSandbox')

const STATIC_VOTE_ENV_KEYS = [
  'FTP_HOST',
  'FTP_PASSWORD',
  'FTP_PORT',
  'FTP_PROTOCOL',
  'FTP_REMOTE_DIR',
  'FTP_VOTE_REMOTE_DIR',
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
  'STATIC_VOTE_ARBITRAGE_SECRET',
  'STATIC_VOTE_SYNC_SECRET',
  'STATIC_VOTE_SYNC_TIMEOUT_MS',
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
    assert.equal(normalizeVotePublicPath(2026, { votePublicPath: '/coordination-vote-{year}' }), '/coordination-vote-2026')
    assert.equal(normalizeVotePublicPath(2026, { votePublicationPublicPath: '/coordination-vote-{year}' }), '/coordination-vote-2026')
    assert.equal(
      normalizeVoteRemoteDir(2026, {
        remoteDir: '/home/account/domains/tpi26.ch/public_html',
        voteRemoteDir: 'coordination-vote-{year}'
      }),
      '/home/account/domains/tpi26.ch/public_html/coordination-vote-2026'
    )
    assert.equal(
      normalizeVoteRemoteDir(2026, {
        remoteDir: '/home/account/domains/tpi26.ch/public_html',
        votePublicationRemoteDir: 'coordination-vote-{year}'
      }),
      '/home/account/domains/tpi26.ch/public_html/coordination-vote-2026'
    )
  })
})

test('getStaticVoteLinkTarget builds magic-link targets for the vote mini-site', async () => {
  const target = await getStaticVoteLinkTarget(2026, 'https://tpi26.ch/votes-2026/')

  assert.deepEqual(target, {
    baseUrl: 'https://tpi26.ch',
    redirectPath: '/votes-2026/'
  })
})

test('getStaticVoteLinkTarget appends the vote path when only a site domain is provided', async () => {
  const target = await getStaticVoteLinkTarget(2026, 'tpi26.ch')

  assert.deepEqual(target, {
    baseUrl: 'https://tpi26.ch',
    redirectPath: '/votes-2026/'
  })
})

test('getStaticVoteLinkTarget uses the deployment domain when no explicit vote URL is provided', async () => {
  const target = await getStaticVoteLinkTarget(2026, '', {
    publicBaseUrl: 'publication.example.ch/',
    votePublicPath: '/coordination-vote-{year}'
  })

  assert.deepEqual(target, {
    baseUrl: 'https://publication.example.ch',
    redirectPath: '/coordination-vote-2026/'
  })
})

test('getStaticVoteLinkTarget supports a local static vote target without an explicit path', async () => {
  const target = await getStaticVoteLinkTarget(2026, 'http://localhost:5173')

  assert.deepEqual(target, {
    baseUrl: 'http://localhost:5173',
    redirectPath: '/votes-2026/'
  })
})

test('getStaticVoteLinkTarget uses a local configured base URL when no explicit vote URL is provided', async () => {
  await withVoteEnv({
    STATIC_VOTE_PUBLIC_BASE_URL: 'http://localhost:5001'
  }, async () => {
    const target = await getStaticVoteLinkTarget(2026)

    assert.deepEqual(target, {
      baseUrl: 'http://localhost:5001',
      redirectPath: '/votes-2026/'
    })
  })
})

test('getStaticVotePublicationStatus separates site and local sync secret configuration', async (t) => {
  const publicationRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'static-vote-status-'))
  const outputDir = path.join(publicationRoot, 'votes', '2026')

  t.after(() => fs.rmSync(publicationRoot, { recursive: true, force: true }))

  await fs.promises.mkdir(outputDir, { recursive: true })
  await fs.promises.writeFile(path.join(outputDir, 'index.php'), '<?php echo "ok";', 'utf8')
  await fs.promises.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify({
    year: 2026,
    syncSecretConfigured: true
  }), 'utf8')

  await withVoteEnv({
    STATIC_VOTE_PUBLICATION_DIR: publicationRoot,
    STATIC_VOTE_SYNC_SECRET: ''
  }, async () => {
    const status = await getStaticVotePublicationStatus(2026)

    assert.equal(status.available, true)
    assert.equal(status.siteSyncSecretConfigured, true)
    assert.equal(status.syncSecretConfigured, false)
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
      sujet: 'Sujet coordination',
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

test('buildStaticVoteCampaignPayload conserve tous les TPI pour un lien vote groupe', async () => {
  const personId = new mongoose.Types.ObjectId()
  const fixedSlotId = new mongoose.Types.ObjectId()
  const tpiIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId()
  ]
  const tpis = tpiIds.map((tpiId, index) => ({
    _id: tpiId,
    reference: `TPI-2026-${index + 39}`,
    sujet: `Sujet ${index + 1}`,
    status: 'voting',
    candidat: { firstName: `Candidat${index + 1}`, lastName: 'Test' },
    proposedSlots: [{ slot: { _id: fixedSlotId } }]
  }))
  const votes = tpiIds.map((tpiId, index) => ({
    _id: new mongoose.Types.ObjectId(),
    tpiPlanning: tpiId,
    voter: { _id: personId, firstName: 'Alain', lastName: 'Garraux', email: 'alain@example.test' },
    voterRole: 'chef_projet',
    slot: {
      _id: fixedSlotId,
      date: new Date(`2026-06-${10 + index}T00:00:00.000Z`),
      period: 1,
      startTime: '08:00',
      endTime: '09:00',
      room: { name: `A10${index + 1}`, site: 'ETML' }
    }
  }))

  const restore = [
    replaceProperty(TpiPlanning, 'find', () => makeQueryResult(tpis)),
    replaceProperty(Vote, 'find', () => makeQueryResult(votes))
  ]

  try {
    const payload = await buildStaticVoteCampaignPayload(2026, '2026-05-01T10:00:00.000Z')

    assert.equal(payload.groups.length, 3)
    assert.deepEqual(
      payload.groups.map((group) => group.personId),
      [String(personId), String(personId), String(personId)]
    )
    assert.deepEqual(
      payload.groups.map((group) => group.tpi.reference),
      ['TPI-2026-39', 'TPI-2026-40', 'TPI-2026-41']
    )
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('buildStaticVoteHtml renders a guided stakeholder vote interface', () => {
  const html = buildStaticVoteHtml({
    year: 2026,
    generatedAt: '2026-05-01T10:00:00.000Z',
    campaignId: 'vote-2026-test',
    groups: [
      {
        personId: 'person-1',
        personName: 'Alice Expert',
        tpi: {
          id: 'tpi-1',
          reference: 'TPI-2026-001',
          subject: 'Sujet coordination',
          candidateName: 'Cara Candidate'
        },
        fixedVoteId: 'vote-fixed',
        fixedSlotId: 'slot-fixed',
        fixedSlot: {
          id: 'slot-fixed',
          dateLabel: 'mercredi, 10.06.2026',
          startTime: '08:00',
          endTime: '09:00',
          roomName: 'A101',
          period: 1,
          label: 'mercredi, 10.06.2026 | 08:00 - 09:00 | A101'
        },
        proposalOptions: [
          {
            slotId: 'slot-alt',
            slot: {
              label: 'jeudi, 11.06.2026 | 09:15 - 10:15 | B202',
              roomName: 'B202',
              period: 2
            }
          }
        ]
      }
    ]
  })

  assert.match(html, /class="vote-summary"/)
  assert.match(html, /vote-date-group/)
  assert.match(html, /buildVoteDateGroups/)
  assert.match(html, /vote-period-group/)
  assert.match(html, /buildVotePeriodGroups/)
  assert.match(html, /vote-card-main-grid/)
  assert.match(html, /dataset\.proposalArea/)
  assert.match(html, /updateSummary/)
  assert.match(html, /Transmettre/)
  assert.match(html, /Autres demi-journées/)
  assert.match(html, /Remarque/)
  assert.match(html, /Hors liste/)
  assert.match(html, /vote-sent/)
  assert.match(html, /is-just-sent/)
  assert.match(html, /isAlreadySubmittedError/)
  assert.match(html, /response\.status !== 409/)
  assert.match(html, /Vos informations pour le TPI de/)
  assert.match(html, /Il n’est plus possible de les modifier/)
  assert.doesNotMatch(html, /Aucune date proposée ne convient/)
  assert.doesNotMatch(html, /data-hard-constraint/)
  assert.match(html, /Seule dispo/)
  assert.match(html, /vote-load-chip/)
  assert.match(html, /À coordonner/)
  assert.match(html, /onlyAvailabilitySlotIds/)
  assert.match(html, /voteSettings/)
  assert.doesNotMatch(html, /mode\.innerHTML/)
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
      sujet: 'Sujet coordination',
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
      assert.equal(result.arbitrageConfigured, true)
      assert.equal(fs.existsSync(result.phpIndexPath), true)
      assert.equal(fs.existsSync(result.syncPhpPath), true)
      assert.equal(fs.existsSync(result.arbitragePhpPath), true)
      assert.equal(fs.existsSync(result.htaccessPath), true)
      assert.equal(fs.existsSync(result.manifestPath), true)
      assert.match(fs.readFileSync(result.phpIndexPath, 'utf8'), /window\.__STATIC_VOTE_BOOTSTRAP__/)
      assert.match(fs.readFileSync(result.syncPhpPath, 'utf8'), /HTTP_X_SYNC_SECRET/)
      assert.match(fs.readFileSync(result.arbitragePhpPath, 'utf8'), /STATIC_VOTE_ARBITRAGE_SECRET_JSON/)
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
  assert.match(php, /staticVoteSubmittedTpiIds\(string \$tokenHash, string \$campaignId\)/)
  assert.match(php, /staticVoteSubmittedTpiIds\(\s*\$staticVoteTokenHash,\s*staticVoteText/)
  assert.match(php, /staticVoteAppendUniqueRecord/)
  assert.match(php, /votes\.lock/)
  assert.match(php, /staticVoteHandleSubmit/)
  assert.match(php, /votes\.jsonl/)
  assert.match(php, /window\.__STATIC_VOTE_BOOTSTRAP__/)
  assert.doesNotMatch(php, /STATIC_VOTE_BOOTSTRAP -->/)
})

test('buildStaticVoteArbitragePhp verifies signed arbitration tokens and stores responses', () => {
  const token = createStaticVoteArbitrageToken({
    year: 2026,
    tpiReference: 'TPI-2026-001',
    proposedSlotLabel: '15.06.2026 · Matin',
    recipientName: 'Alice Expert',
    roleLabel: 'Expert 1',
    expiresAt: '2026-06-15T10:00:00.000Z'
  }, 'arbitrage-secret')
  const php = buildStaticVoteArbitragePhp({
    year: 2026,
    tokenSecret: 'arbitrage-secret'
  })

  assert.match(token, /^svra\./)
  assert.match(php, /gzinflate/)
  assert.match(php, /hash_hmac\('sha256', \$body, \$secret, true\)/)
  assert.match(php, /arbitrages\.jsonl/)
  assert.match(php, /Une raison est requise en cas de refus/)
  assert.match(php, /Transmettre ma réponse/)
})

test('buildStaticVoteSyncPhp requires the dedicated sync secret', () => {
  const php = buildStaticVoteSyncPhp({
    year: 2026,
    syncSecret: 'secret-value'
  })

  assert.match(php, /HTTP_X_SYNC_SECRET/)
  assert.match(php, /hash_equals\(\$staticVoteSyncSecret, \$providedSecret\)/)
  assert.match(php, /votes\.jsonl/)
  assert.match(php, /arbitrages\.jsonl/)
  assert.match(php, /arbitrageRecords/)
  assert.match(php, /'year' => 2026/)
  assert.doesNotMatch(php, /STATIC_VOTE_ACCESS_JSON/)
})

test('fetchStaticVoteRecords calls remote sync.php with X-Sync-Secret', async () => {
  await withVoteEnv({
    STATIC_VOTE_SYNC_SECRET: 'sync-secret'
  }, async () => {
    let receivedUrl = ''
    let receivedHeaders = null
    let receivedSignal = null

    const result = await fetchStaticVoteRecords({
      year: 2026,
      remoteUrl: 'https://tpi26.ch/votes-2026/sync.php',
      fetchImpl: async (url, options) => {
        receivedUrl = url
        receivedHeaders = options.headers
        receivedSignal = options.signal
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            records: [{ id: 'record-1', year: 2026 }],
            arbitrageRecords: [{ id: 'arbitrage-1', year: 2026 }]
          })
        }
      }
    })

    assert.equal(receivedUrl, 'https://tpi26.ch/votes-2026/sync.php')
    assert.equal(receivedHeaders['X-Sync-Secret'], 'sync-secret')
    assert.equal(typeof receivedSignal?.aborted, 'boolean')
    assert.equal(result.records.length, 1)
    assert.equal(result.arbitrageRecords.length, 1)
  })
})

test('fetchStaticVoteRecords aborts when the remote sync endpoint times out', async () => {
  await withVoteEnv({
    STATIC_VOTE_SYNC_SECRET: 'sync-secret',
    STATIC_VOTE_SYNC_TIMEOUT_MS: '1'
  }, async () => {
    await assert.rejects(
      fetchStaticVoteRecords({
        year: 2026,
        remoteUrl: 'https://tpi26.ch/votes-2026/sync.php',
        fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
      }),
      (error) => {
        assert.equal(error.statusCode, 504)
        assert.match(error.message, /expiree/)
        return true
      }
    )
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
      savedVotes.push({ id: String(this._id), decision: this.decision, comment: this.comment, hardConstraint: this.hardConstraint, magicLinkUsed: this.magicLinkUsed })
    }
  }
  const altVote = {
    _id: altVoteId,
    slot: altSlotId,
    voterRole: 'expert1',
    async save() {
      savedVotes.push({ id: String(this._id), decision: this.decision, hardConstraint: this.hardConstraint, priority: this.priority, magicLinkUsed: this.magicLinkUsed })
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
      remark: 'Préférence forte pour le matin.',
      submittedAt: '2026-05-10T08:00:00.000Z',
      tokenHash: 'c'.repeat(64)
    }, year)

    assert.equal(result.imported, true)
    assert.equal(savedVotes.length, 2)
    assert.equal(savedVotes.find((vote) => vote.id === String(fixedVoteId)).decision, 'rejected')
    assert.equal(savedVotes.find((vote) => vote.id === String(fixedVoteId)).comment, 'Préférence forte pour le matin.')
    assert.equal(savedVotes.find((vote) => vote.id === String(fixedVoteId)).hardConstraint, false)
    assert.equal(savedVotes.find((vote) => vote.id === String(altVoteId)).decision, 'preferred')
    assert.equal(savedVotes.find((vote) => vote.id === String(altVoteId)).hardConstraint, false)
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

test('importStaticVoteRecord conserve l indication de seule disponibilité', async () => {
  const year = 2026
  const personId = new mongoose.Types.ObjectId()
  const tpiId = new mongoose.Types.ObjectId()
  const fixedSlotId = new mongoose.Types.ObjectId()
  const altSlotId = new mongoose.Types.ObjectId()
  const fixedVoteId = new mongoose.Types.ObjectId()
  const altVoteId = new mongoose.Types.ObjectId()
  const savedVotes = []
  const fixedVote = {
    _id: fixedVoteId,
    slot: fixedSlotId,
    voterRole: 'expert1',
    async save() {
      savedVotes.push({ id: String(this._id), decision: this.decision, comment: this.comment, hardConstraint: this.hardConstraint })
    }
  }
  const altVote = {
    _id: altVoteId,
    slot: altSlotId,
    voterRole: 'expert1',
    async save() {
      savedVotes.push({ id: String(this._id), decision: this.decision, comment: this.comment, hardConstraint: this.hardConstraint, priority: this.priority })
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
    replaceProperty(schedulingService, 'registerVoteAndCheckValidation', async () => ({ success: true }))
  ]

  try {
    const result = await importStaticVoteRecord({
      id: 'submission-only-availability',
      year,
      personId: String(personId),
      tpiId: String(tpiId),
      fixedVoteId: String(fixedVoteId),
      mode: 'proposal',
      proposedSlotIds: [String(altSlotId)],
      onlyAvailabilitySlotIds: [String(altSlotId)],
      submittedAt: '2026-05-10T08:00:00.000Z',
      tokenHash: 'e'.repeat(64)
    }, year)

    assert.equal(result.imported, true)
    assert.match(savedVotes.find((vote) => vote.id === String(fixedVoteId)).comment, /Seule disponibilité signalée/)
    assert.equal(savedVotes.find((vote) => vote.id === String(altVoteId)).decision, 'preferred')
    assert.equal(savedVotes.find((vote) => vote.id === String(altVoteId)).comment, 'Seule disponibilité signalée.')
    assert.equal(savedVotes.find((vote) => vote.id === String(altVoteId)).hardConstraint, true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('importStaticVoteRecord conserve une remarque générale en mode OK', async () => {
  const year = 2026
  const personId = new mongoose.Types.ObjectId()
  const tpiId = new mongoose.Types.ObjectId()
  const fixedSlotId = new mongoose.Types.ObjectId()
  const fixedVoteId = new mongoose.Types.ObjectId()
  const savedVotes = []
  let validationInput = null
  const fixedVote = {
    _id: fixedVoteId,
    slot: fixedSlotId,
    voterRole: 'expert1',
    async save() {
      savedVotes.push({ id: String(this._id), decision: this.decision, comment: this.comment })
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
      { slot: { _id: fixedSlotId } }
    ]
  }
  const restore = [
    replaceProperty(Vote, 'exists', async () => null),
    replaceProperty(TpiPlanning, 'findOne', () => makeQueryResult(tpi)),
    replaceProperty(Vote, 'find', () => makeQueryResult([fixedVote])),
    replaceProperty(schedulingService, 'registerVoteAndCheckValidation', async (voteId, decision, comment) => {
      validationInput = { voteId: String(voteId), decision, comment }
      return { success: true }
    })
  ]

  try {
    const result = await importStaticVoteRecord({
      id: 'submission-ok-remark',
      year,
      personId: String(personId),
      tpiId: String(tpiId),
      fixedVoteId: String(fixedVoteId),
      mode: 'ok',
      remark: 'OK pour moi, mais prévenir si changement de salle.',
      submittedAt: '2026-05-10T08:00:00.000Z',
      tokenHash: 'f'.repeat(64)
    }, year)

    assert.equal(result.imported, true)
    assert.equal(savedVotes.length, 1)
    assert.equal(savedVotes[0].decision, 'accepted')
    assert.equal(savedVotes[0].comment, 'OK pour moi, mais prévenir si changement de salle.')
    assert.equal(validationInput.decision, 'accepted')
    assert.equal(validationInput.comment, 'OK pour moi, mais prévenir si changement de salle.')
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('importStaticVoteRecord applies a hard constraint response', async () => {
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
      savedVotes.push({ id: String(this._id), decision: this.decision, comment: this.comment, hardConstraint: this.hardConstraint })
    }
  }
  const altVote = {
    _id: altVoteId,
    slot: altSlotId,
    voterRole: 'expert1',
    async save() {
      savedVotes.push({ id: String(this._id), decision: this.decision, hardConstraint: this.hardConstraint })
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
      id: 'submission-hard',
      year,
      personId: String(personId),
      tpiId: String(tpiId),
      fixedVoteId: String(fixedVoteId),
      mode: 'proposal',
      proposedSlotIds: [],
      hardConstraint: true,
      submittedAt: '2026-05-10T08:00:00.000Z',
      tokenHash: 'd'.repeat(64)
    }, year)

    assert.equal(result.imported, true)
    assert.equal(savedVotes.length, 2)
    assert.deepEqual(savedVotes.map((vote) => vote.decision), ['rejected', 'rejected'])
    assert.equal(savedVotes.find((vote) => vote.id === String(fixedVoteId)).comment, 'Aucune date proposée ne convient.')
    assert.deepEqual(savedVotes.map((vote) => vote.hardConstraint), [true, true])
    assert.equal(validationInput.decision, 'rejected')
    assert.equal(validationInput.voteId, String(fixedVoteId))
    assert.equal(validationInput.comment, 'Aucune date proposée ne convient.')
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

test('importStaticVoteRecord rejects seule disponibilité hors sélection proposée', async () => {
  const year = 2026
  const result = await importStaticVoteRecord({
    id: 'submission-only-invalid',
    year,
    personId: String(new mongoose.Types.ObjectId()),
    tpiId: String(new mongoose.Types.ObjectId()),
    fixedVoteId: String(new mongoose.Types.ObjectId()),
    mode: 'proposal',
    proposedSlotIds: [String(new mongoose.Types.ObjectId())],
    onlyAvailabilitySlotIds: [String(new mongoose.Types.ObjectId())],
    submittedAt: '2026-05-10T08:00:00.000Z'
  }, year)

  assert.equal(result.imported, false)
  assert.equal(result.skipped, true)
  assert.equal(result.reason, 'invalid_record')
})

test('importStaticVoteRecord refuse une demande hors liste combinée à une date proposée', async () => {
  const year = 2026
  const result = await importStaticVoteRecord({
    id: 'submission-mixed',
    year,
    personId: String(new mongoose.Types.ObjectId()),
    tpiId: String(new mongoose.Types.ObjectId()),
    fixedVoteId: String(new mongoose.Types.ObjectId()),
    mode: 'proposal',
    proposedSlotIds: [String(new mongoose.Types.ObjectId())],
    specialRequest: {
      reason: 'Besoin d’une autre date',
      requestedDate: '2026-06-20'
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

test('importStaticVoteArbitrageRecord applique une réponse d arbitrage statique', async () => {
  const year = 2026
  const tokenHash = 'a'.repeat(64)
  const proposalId = new mongoose.Types.ObjectId()
  const tpiId = new mongoose.Types.ObjectId()
  const personId = new mongoose.Types.ObjectId()
  const proposal = {
    _id: proposalId,
    year,
    tpiPlanning: tpiId,
    status: 'sent',
    recipients: [{
      role: 'expert1',
      person: personId,
      tokenHash,
      responseStatus: 'pending'
    }],
    expiresAt: new Date('2026-06-20T10:00:00.000Z'),
    saved: false,
    async save() {
      this.saved = true
      return this
    }
  }
  const restore = [
    replaceProperty(ResolutionProposal, 'findOne', () => makeQueryResult(proposal))
  ]

  try {
    const result = await importStaticVoteArbitrageRecord({
      id: 'arbitrage-1',
      year,
      tokenHash,
      tpiId: String(tpiId),
      personId: String(personId),
      role: 'expert1',
      decision: 'rejected',
      reason: 'Indisponible',
      alternativeProposal: 'Matin suivant',
      submittedAt: '2026-05-10T08:00:00.000Z'
    }, year)

    assert.equal(result.imported, true)
    assert.equal(proposal.recipients[0].responseStatus, 'rejected')
    assert.equal(proposal.recipients[0].responseReason, 'Indisponible')
    assert.equal(proposal.recipients[0].alternativeProposal, 'Matin suivant')
    assert.equal(proposal.status, 'rejected')
    assert.equal(proposal.saved, true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('importStaticVoteArbitrageRecord ignore une réponse statique après expiration', async () => {
  const year = 2026
  const tokenHash = 'e'.repeat(64)
  const proposalId = new mongoose.Types.ObjectId()
  const tpiId = new mongoose.Types.ObjectId()
  const personId = new mongoose.Types.ObjectId()
  const proposal = {
    _id: proposalId,
    year,
    tpiPlanning: tpiId,
    status: 'sent',
    recipients: [{
      role: 'expert1',
      person: personId,
      tokenHash,
      responseStatus: 'pending'
    }],
    expiresAt: new Date('2020-01-01T10:00:00.000Z'),
    saved: false,
    async save() {
      this.saved = true
      return this
    }
  }
  const restore = [
    replaceProperty(ResolutionProposal, 'findOne', () => makeQueryResult(proposal))
  ]

  try {
    const result = await importStaticVoteArbitrageRecord({
      id: 'arbitrage-expired',
      year,
      tokenHash,
      tpiId: String(tpiId),
      personId: String(personId),
      role: 'expert1',
      decision: 'accepted',
      submittedAt: '2026-05-10T08:00:00.000Z'
    }, year)

    assert.equal(result.imported, false)
    assert.equal(result.skipped, true)
    assert.equal(result.reason, 'proposal_expired')
    assert.equal(result.status, 'expired')
    assert.equal(proposal.status, 'expired')
    assert.equal(proposal.recipients[0].responseStatus, 'pending')
    assert.equal(proposal.saved, true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})

test('importStaticVoteArbitrageRecord accepte une réponse avant expiration synchronisée plus tard', async () => {
  const year = 2026
  const tokenHash = 'f'.repeat(64)
  const proposalId = new mongoose.Types.ObjectId()
  const tpiId = new mongoose.Types.ObjectId()
  const personId = new mongoose.Types.ObjectId()
  const proposal = {
    _id: proposalId,
    year,
    tpiPlanning: tpiId,
    status: 'sent',
    recipients: [{
      role: 'expert1',
      person: personId,
      tokenHash,
      responseStatus: 'pending'
    }],
    expiresAt: new Date('2020-01-02T10:00:00.000Z'),
    saved: false,
    async save() {
      this.saved = true
      return this
    }
  }
  const restore = [
    replaceProperty(ResolutionProposal, 'findOne', () => makeQueryResult(proposal))
  ]

  try {
    const result = await importStaticVoteArbitrageRecord({
      id: 'arbitrage-delayed-sync',
      year,
      tokenHash,
      tpiId: String(tpiId),
      personId: String(personId),
      role: 'expert1',
      decision: 'accepted',
      submittedAt: '2020-01-01T08:00:00.000Z'
    }, year)

    assert.equal(result.imported, true)
    assert.equal(proposal.recipients[0].responseStatus, 'accepted')
    assert.equal(proposal.status, 'accepted')
    assert.equal(proposal.saved, true)
  } finally {
    while (restore.length > 0) {
      restore.pop()()
    }
  }
})
