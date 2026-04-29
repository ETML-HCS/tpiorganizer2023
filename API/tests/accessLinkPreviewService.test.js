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
      magicLinks: {
        async createVoteMagicLink({ year, person, scope }) {
          return {
            token: `${person._id}-${scope.kind}`,
            url: `http://localhost:3000/planning/${year}?ml=${person._id}-${scope.kind}`,
            expiresAt: new Date('2026-05-01T12:00:00Z')
          }
        },
        async createSoutenanceMagicLink({ year, person }) {
          return {
            token: `${person._id}-soutenance`,
            url: `http://localhost:3000/defenses/${year}?ml=${person._id}-soutenance`,
            expiresAt: new Date('2026-06-01T12:00:00Z')
          }
        }
      }
    }
  })

  assert.equal(preview.year, 2026)
  assert.equal(preview.summary.peopleCount, 6)
  assert.equal(preview.summary.voteLinkCount, 4)
  assert.equal(preview.summary.soutenanceLinkCount, 6)
  assert.equal(preview.contexts.vote.tpiCount, 2)
  assert.equal(preview.contexts.vote.linkCount, 4)
  assert.equal(preview.contexts.soutenance.publicationVersion, 3)

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
  assert.match(alice.voteLinks[0].url, /planning\/2026\?ml=/)
  assert.equal(eva.soutenanceLinks[0].redirectPath, '/defenses/2026')
  assert.match(eva.soutenanceLinks[0].url, /defenses\/2026\?ml=/)
})
