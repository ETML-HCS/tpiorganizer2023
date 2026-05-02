const test = require('node:test')
const assert = require('node:assert/strict')

const { buildAccessLinkPreview } = require('../services/accessLinkPreviewService')

function createQuery(result) {
  return {
    populate() {
      return this
    },
    select() {
      return this
    },
    sort() {
      return this
    },
    lean() {
      return this
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject)
    },
    catch(reject) {
      return Promise.resolve(result).catch(reject)
    },
    finally(onFinally) {
      return Promise.resolve(result).finally(onFinally)
    }
  }
}

function createPerson(id, firstName, lastName, email, roles = ['expert']) {
  return {
    _id: id,
    firstName,
    lastName,
    email,
    roles,
    site: 'ETML'
  }
}

test('buildAccessLinkPreview groups vote and défense links by person', async () => {
  const expert1 = createPerson('p1', 'Alice', 'Expert', 'alice@example.com', ['expert'])
  const expert2A = createPerson('p2', 'Bob', 'Expert', 'bob@example.com', ['expert'])
  const boss = createPerson('p3', 'Carla', 'Boss', 'carla@example.com', ['chef_projet'])
  const expert2B = createPerson('p4', 'David', 'Expert', 'david@example.com', ['expert'])
  const candidate1 = createPerson('p5', 'Eva', 'Candidate', 'eva@example.com', ['candidat'])
  const candidate2 = createPerson('p6', 'Fiona', 'Candidate', 'fiona@example.com', ['candidat'])

  const tpis = [
    {
      _id: 'tpi-1',
      reference: 'TPI-2026-001',
      sujet: 'Sujet 1',
      status: 'voting',
      candidat: candidate1
    },
    {
      _id: 'tpi-2',
      reference: 'TPI-2026-002',
      sujet: 'Sujet 2',
      status: 'pending_validation',
      candidat: candidate2
    }
  ]

  const votes = [
    { tpiPlanning: 'tpi-1', voter: expert1, voterRole: 'expert1' },
    { tpiPlanning: 'tpi-1', voter: expert2A, voterRole: 'expert2' },
    { tpiPlanning: 'tpi-1', voter: boss, voterRole: 'chef_projet' },
    { tpiPlanning: 'tpi-2', voter: expert1, voterRole: 'expert1' },
    { tpiPlanning: 'tpi-2', voter: expert2B, voterRole: 'expert2' },
    { tpiPlanning: 'tpi-2', voter: boss, voterRole: 'chef_projet' }
  ]

  const publication = {
    version: 3,
    rooms: [
      {
        tpiDatas: [
          {
            candidatPersonId: candidate1._id,
            expert1: { personId: expert1._id },
            expert2: { personId: expert2A._id },
            boss: { personId: boss._id }
          },
          {
            candidatPersonId: candidate2._id,
            expert1: { personId: expert1._id },
            expert2: { personId: expert2B._id },
            boss: { personId: boss._id }
          }
        ]
      }
    ]
  }

  const preview = await buildAccessLinkPreview({
    year: 2026,
    baseUrl: 'http://localhost:3000',
    dependencies: {
      TpiPlanningModel: {
        find() {
          return createQuery(tpis)
        }
      },
      VoteModel: {
        find() {
          return createQuery(votes)
        }
      },
      PersonModel: {
        find() {
          return createQuery([expert1, expert2A, boss, expert2B, candidate1, candidate2])
        }
      },
      getActivePublication: async () => publication,
      listPublicationVersions: async () => [
        { version: 3, isActive: true, publishedAt: '2026-05-01T12:00:00Z', source: { roomsCount: 1 } }
      ],
      magicLinks: {
        async createVoteMagicLink() {
          throw new Error('Preview should not create vote links')
        },
        async createSoutenanceMagicLink() {
          throw new Error('Preview should not create soutenance links')
        }
      }
    }
  })

  assert.equal(preview.year, 2026)
  assert.equal(preview.linksGenerated, false)
  assert.equal(preview.summary.peopleCount, 6)
  assert.equal(preview.summary.voteLinkCount, 4)
  assert.equal(preview.summary.soutenanceLinkCount, 6)
  assert.equal(preview.contexts.vote.tpiCount, 2)
  assert.equal(preview.contexts.vote.linkCount, 4)
  assert.equal(preview.contexts.soutenance.publicationVersion, 3)
  assert.deepEqual(
    preview.contexts.soutenance.availableVersions.map((entry) => entry.version),
    [3]
  )

  const alice = preview.people.find((entry) => entry.person.id === 'p1')
  const eva = preview.people.find((entry) => entry.person.id === 'p5')

  assert.ok(alice)
  assert.ok(eva)
  assert.equal(alice.voteLinks.length, 1)
  assert.equal(alice.voteLinks[0].roleLabel, 'Partie prenante')
  assert.equal(alice.voteLinks[0].tpis.length, 2)
  assert.deepEqual(
    alice.voteLinks[0].tpis.map((tpi) => tpi.reference),
    ['TPI-2026-001', 'TPI-2026-002']
  )
  assert.equal(alice.soutenanceLinks.length, 1)
  assert.equal(eva.voteLinks.length, 0)
  assert.equal(eva.soutenanceLinks.length, 1)
  assert.equal(alice.voteLinks[0].url, null)
  assert.equal(alice.voteLinks[0].generated, false)
  assert.equal(alice.voteLinks[0].redirectPath, '/planning/2026')
  assert.equal(eva.soutenanceLinks[0].redirectPath, '/defenses/2026')
  assert.equal(eva.soutenanceLinks[0].url, null)
  assert.equal(eva.soutenanceLinks[0].generated, false)
})

test('buildAccessLinkPreview generates links and revokes previous admin links when requested', async () => {
  const expert = createPerson('p1', 'Alice', 'Expert', 'alice@example.com', ['expert'])
  const candidate = createPerson('p2', 'Eva', 'Candidate', 'eva@example.com', ['candidat'])
  const tpis = [
    {
      _id: 'tpi-1',
      reference: 'TPI-2026-001',
      sujet: 'Sujet 1',
      status: 'voting',
      candidat: candidate
    }
  ]
  const votes = [
    { tpiPlanning: 'tpi-1', voter: expert, voterRole: 'expert1' }
  ]
  const publication = {
    version: 3,
    rooms: [
      {
        tpiDatas: [
          {
            candidatPersonId: candidate._id,
            expert1: { personId: expert._id }
          }
        ]
      }
    ]
  }
  const revokeCalls = []
  const voteCreateCalls = []
  const soutenanceCreateCalls = []

  const preview = await buildAccessLinkPreview({
    year: 2026,
    baseUrl: 'http://localhost:3000',
    generateLinks: true,
    dependencies: {
      TpiPlanningModel: {
        find() {
          return createQuery(tpis)
        }
      },
      VoteModel: {
        find() {
          return createQuery(votes)
        }
      },
      PersonModel: {
        find() {
          return createQuery([expert, candidate])
        }
      },
      getActivePublication: async () => publication,
      listPublicationVersions: async () => [
        { version: 3, isActive: true, publishedAt: '2026-05-01T12:00:00Z', source: { roomsCount: 1 } }
      ],
      magicLinks: {
        async revokeActiveMagicLinks(params) {
          revokeCalls.push(params)
          return { modifiedCount: 1 }
        },
        async createVoteMagicLink(params) {
          voteCreateCalls.push(params)
          return {
            id: 'new-vote-link',
            token: 'vote-token',
            redirectPath: `/planning/${params.year}`,
            url: `http://localhost:3000/planning/${params.year}?ml=vote-token`,
            expiresAt: new Date('2026-05-01T12:00:00Z')
          }
        },
        async createSoutenanceMagicLink(params) {
          soutenanceCreateCalls.push(params)
          return {
            id: `new-soutenance-link-${soutenanceCreateCalls.length}`,
            token: 'soutenance-token',
            redirectPath: `/defenses/${params.year}`,
            url: `http://localhost:3000/defenses/${params.year}?ml=soutenance-token`,
            expiresAt: new Date('2026-06-01T12:00:00Z')
          }
        }
      }
    }
  })

  assert.equal(preview.linksGenerated, true)
  assert.equal(preview.summary.voteLinkCount, 1)
  assert.equal(preview.summary.soutenanceLinkCount, 2)
  assert.equal(voteCreateCalls.length, 1)
  assert.equal(soutenanceCreateCalls.length, 2)
  assert.equal(revokeCalls.length, 3)
  assert.deepEqual(
    revokeCalls.map((call) => call.type).sort(),
    ['soutenance', 'soutenance', 'vote']
  )
  assert.equal(
    revokeCalls.every((call) => call.sources.includes('admin_access_preview') && call.sources.includes('admin_access_generated')),
    true
  )
  assert.deepEqual(revokeCalls[0].excludeIds, ['new-vote-link'])
  assert.equal(
    revokeCalls
      .filter((call) => call.type === 'soutenance')
      .every((call) => call.excludeIds.length === 1 && call.excludeIds[0].startsWith('new-soutenance-link-')),
    true
  )
  assert.equal(
    revokeCalls
      .filter((call) => call.type === 'soutenance')
      .every((call) => call.scope?.publicationVersion === 3),
    true
  )
  assert.equal(voteCreateCalls[0].scope.source, 'admin_access_generated')
  assert.equal(soutenanceCreateCalls[0].scope.source, 'admin_access_generated')

  const alice = preview.people.find((entry) => entry.person.id === expert._id)
  assert.match(alice.voteLinks[0].url, /planning\/2026\?ml=vote-token/)
  assert.equal(alice.voteLinks[0].generated, true)
  assert.match(alice.soutenanceLinks[0].url, /defenses\/2026\?ml=soutenance-token/)
  assert.equal(alice.soutenanceLinks[0].generated, true)
})

test('buildAccessLinkPreview recharges les liens admin existants sans regenerer', async () => {
  const expert = createPerson('p1', 'Alice', 'Expert', 'alice@example.com', ['expert'])
  const candidate = createPerson('p2', 'Eva', 'Candidate', 'eva@example.com', ['candidat'])
  const tpis = [
    {
      _id: 'tpi-1',
      reference: 'TPI-2026-001',
      sujet: 'Sujet 1',
      status: 'voting',
      candidat: candidate
    }
  ]
  const votes = [
    { tpiPlanning: 'tpi-1', voter: expert, voterRole: 'expert1' }
  ]
  const publication = {
    version: 3,
    rooms: [
      {
        tpiDatas: [
          {
            candidatPersonId: candidate._id,
            expert1: { personId: expert._id }
          }
        ]
      }
    ]
  }
  const reusableCalls = []

  const preview = await buildAccessLinkPreview({
    year: 2026,
    baseUrl: 'http://localhost:3000',
    dependencies: {
      TpiPlanningModel: {
        find() {
          return createQuery(tpis)
        }
      },
      VoteModel: {
        find() {
          return createQuery(votes)
        }
      },
      PersonModel: {
        find() {
          return createQuery([expert, candidate])
        }
      },
      getActivePublication: async () => publication,
      listPublicationVersions: async () => [
        { version: 3, isActive: true, publishedAt: '2026-05-01T12:00:00Z', source: { roomsCount: 1 } }
      ],
      magicLinks: {
        async findReusableMagicLink(params) {
          reusableCalls.push(params)
          const personId = params.person?._id || 'unknown'
          const path = params.type === 'vote' ? '/planning/2026' : '/defenses/2026'
          const token = `${params.type}-stored-${personId}`

          return {
            id: `link-${params.type}-${personId}`,
            token,
            redirectPath: path,
            url: `http://localhost:3000${path}?ml=${token}`,
            expiresAt: new Date('2026-06-01T12:00:00Z'),
            type: params.type,
            generated: true,
            recoverable: true
          }
        },
        async createVoteMagicLink() {
          throw new Error('Preview should reuse vote links')
        },
        async createSoutenanceMagicLink() {
          throw new Error('Preview should reuse soutenance links')
        }
      }
    }
  })

  assert.equal(preview.linksGenerated, true)
  assert.equal(preview.hasGeneratedLinks, true)
  assert.equal(preview.summary.generatedLinkCount, 3)
  assert.equal(preview.summary.pendingLinkCount, 0)
  assert.equal(reusableCalls.length, 3)
  assert.deepEqual(
    reusableCalls.map((call) => call.type).sort(),
    ['soutenance', 'soutenance', 'vote']
  )
  assert.equal(reusableCalls[0].sources.includes('admin_access_generated'), true)

  const alice = preview.people.find((entry) => entry.person.id === expert._id)
  const eva = preview.people.find((entry) => entry.person.id === candidate._id)

  assert.match(alice.voteLinks[0].url, /planning\/2026\?ml=vote-stored-p1/)
  assert.match(alice.soutenanceLinks[0].url, /defenses\/2026\?ml=soutenance-stored-p1/)
  assert.match(eva.soutenanceLinks[0].url, /defenses\/2026\?ml=soutenance-stored-p2/)
})

test('buildAccessLinkPreview cible une version de publication explicite', async () => {
  const candidate = createPerson('p2', 'Eva', 'Candidate', 'eva@example.com', ['candidat'])
  let requestedVersion = null

  const preview = await buildAccessLinkPreview({
    year: 2026,
    baseUrl: 'http://localhost:3000',
    publicationVersion: 2,
    dependencies: {
      TpiPlanningModel: {
        find() {
          return createQuery([])
        }
      },
      VoteModel: {
        find() {
          return createQuery([])
        }
      },
      PersonModel: {
        find() {
          return createQuery([candidate])
        }
      },
      getActivePublication: async () => {
        throw new Error('Version explicite: la publication active ne doit pas être utilisée')
      },
      getPublication: async (_year, version) => {
        requestedVersion = version
        return {
          version,
          rooms: [
            {
              tpiDatas: [
                {
                  candidatPersonId: candidate._id
                }
              ]
            }
          ]
        }
      },
      listPublicationVersions: async () => [
        { version: 3, isActive: true, publishedAt: '2026-05-03T12:00:00Z', source: { roomsCount: 2 } },
        { version: 2, isActive: false, publishedAt: '2026-05-02T12:00:00Z', source: { roomsCount: 1 } }
      ],
      magicLinks: {
        async createVoteMagicLink() {
          throw new Error('Aucun lien de vote attendu')
        },
        async createSoutenanceMagicLink() {
          throw new Error('Preview should not create soutenance links')
        }
      }
    }
  })

  assert.equal(requestedVersion, 2)
  assert.equal(preview.contexts.soutenance.publicationVersion, 2)
  assert.equal(preview.contexts.soutenance.requestedPublicationVersion, 2)
  assert.deepEqual(
    preview.contexts.soutenance.availableVersions.map((entry) => entry.version),
    [3, 2]
  )
  assert.equal(preview.people[0].soutenanceLinks[0].publicationVersion, 2)
})
