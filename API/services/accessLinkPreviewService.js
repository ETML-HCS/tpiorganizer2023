const Person = require('../models/personModel')
const TpiPlanning = require('../models/tpiPlanningModel')
const Vote = require('../models/voteModel')
const magicLinkV2Service = require('./magicLinkV2Service')
const { getActivePublicationVersion } = require('./publishedSoutenanceService')
const { buildDefensePublicPath } = require('../utils/publicRoutes')

const ADMIN_ACCESS_LINK_SOURCE = 'admin_access_generated'
const ADMIN_ACCESS_REVOKE_SOURCES = ['admin_access_preview', ADMIN_ACCESS_LINK_SOURCE]

function formatPersonName(person) {
  return [person?.firstName, person?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
}

function formatRoleLabel(role) {
  if (role === 'expert1') {
    return 'Expert 1'
  }

  if (role === 'expert2') {
    return 'Expert 2'
  }

  if (role === 'chef_projet') {
    return 'Chef de projet'
  }

  if (role === 'expert') {
    return 'Expert'
  }

  if (role === 'candidat') {
    return 'Candidat'
  }

  return String(role || '').trim()
}

function buildPersonSnapshot(person) {
  return {
    id: person?._id ? String(person._id) : '',
    name: formatPersonName(person),
    email: typeof person?.email === 'string' ? person.email : '',
    roles: Array.isArray(person?.roles) ? person.roles : [],
    site: typeof person?.site === 'string' ? person.site : ''
  }
}

function ensurePersonEntry(map, person) {
  const personId = person?._id ? String(person._id) : ''

  if (!personId) {
    return null
  }

  if (!map.has(personId)) {
    map.set(personId, {
      person: buildPersonSnapshot(person),
      voteLinks: [],
      soutenanceLinks: []
    })
  }

  return map.get(personId)
}

function sortPeople(entries = []) {
  return [...entries].sort((left, right) => {
    const leftName = String(left?.person?.name || left?.person?.email || '').toLowerCase()
    const rightName = String(right?.person?.name || right?.person?.email || '').toLowerCase()

    if (leftName !== rightName) {
      return leftName.localeCompare(rightName)
    }

    return String(left?.person?.email || '').localeCompare(String(right?.person?.email || ''))
  })
}

function sortVoteLinks(links = []) {
  return [...links].sort((left, right) => {
    const leftReference = String(left?.reference || '')
    const rightReference = String(right?.reference || '')

    if (leftReference !== rightReference) {
      return leftReference.localeCompare(rightReference)
    }

    return String(left?.role || '').localeCompare(String(right?.role || ''))
  })
}

function addVotePreviewTpi(target, vote, tpi) {
  const tpiId = tpi?._id ? String(tpi._id) : ''
  if (!tpiId) {
    return
  }

  if (!target.tpisById.has(tpiId)) {
    target.tpisById.set(tpiId, {
      tpiId,
      reference: tpi.reference || '',
      subject: tpi.sujet || '',
      candidateName: formatPersonName(tpi.candidat),
      status: tpi.status || '',
      roleLabels: new Set()
    })
  }

  const entry = target.tpisById.get(tpiId)
  if (vote?.voterRole) {
    entry.roleLabels.add(formatRoleLabel(vote.voterRole))
  }
}

function sortSoutenanceLinks(links = []) {
  return [...links].sort((left, right) => {
    return Number(right?.publicationVersion || 0) - Number(left?.publicationVersion || 0)
  })
}

function buildPendingLink({ redirectPath }) {
  return {
    redirectPath,
    expiresAt: null,
    token: null,
    url: null,
    generated: false
  }
}

async function revokeAdminAccessLinks({ magicLinks, year, type, person, excludeLinkIds = [] }) {
  if (typeof magicLinks.revokeActiveMagicLinks !== 'function') {
    throw new Error('Revocation des anciens magic links indisponible.')
  }

  return await magicLinks.revokeActiveMagicLinks({
    year,
    type,
    person,
    sources: ADMIN_ACCESS_REVOKE_SOURCES,
    excludeIds: excludeLinkIds
  })
}

async function buildVoteAccessLink({ year, baseUrl, person, generateLinks, magicLinks }) {
  const redirectPath = `/planning/${year}`

  if (!generateLinks) {
    return buildPendingLink({ redirectPath })
  }

  const link = await magicLinks.createVoteMagicLink({
    year,
    person,
    role: null,
    scope: {
      year,
      kind: 'stakeholder_votes',
      source: ADMIN_ACCESS_LINK_SOURCE
    },
    baseUrl,
    redirectPath
  })

  await revokeAdminAccessLinks({
    magicLinks,
    year,
    type: 'vote',
    person,
    excludeLinkIds: link?.id ? [link.id] : []
  })

  return {
    ...link,
    generated: true
  }
}

async function buildSoutenanceAccessLink({
  year,
  baseUrl,
  person,
  publicationVersion,
  generateLinks,
  magicLinks
}) {
  const redirectPath = buildDefensePublicPath(year)

  if (!generateLinks) {
    return buildPendingLink({ redirectPath })
  }

  const link = await magicLinks.createSoutenanceMagicLink({
    year,
    person,
    scope: {
      kind: 'published_soutenances',
      publicationVersion: publicationVersion || null,
      source: ADMIN_ACCESS_LINK_SOURCE
    },
    baseUrl,
    redirectPath
  })

  await revokeAdminAccessLinks({
    magicLinks,
    year,
    type: 'soutenance',
    person,
    excludeLinkIds: link?.id ? [link.id] : []
  })

  return {
    ...link,
    generated: true
  }
}

async function buildVoteLinkPreview(year, baseUrl, peopleMap, dependencies) {
  const {
    TpiPlanningModel,
    VoteModel,
    magicLinks,
    generateLinks
  } = dependencies

  const votingTpis = await TpiPlanningModel.find({
    year,
    status: { $in: ['voting', 'pending_validation'] }
  })
    .populate('candidat', 'firstName lastName')
    .select('reference sujet year status candidat')
    .sort({ reference: 1 })

  if (!Array.isArray(votingTpis) || votingTpis.length === 0) {
    return {
      linkCount: 0,
      recipientCount: 0,
      tpiCount: 0
    }
  }

  const tpiById = new Map(
    votingTpis.map((tpi) => [String(tpi._id), tpi])
  )

  const pendingVotes = await VoteModel.find({
    tpiPlanning: { $in: votingTpis.map((tpi) => tpi._id) },
    decision: 'pending'
  })
    .populate('voter', 'firstName lastName email roles site')
    .select('tpiPlanning voter voterRole')

  const groupedPendingVotes = new Map()

  for (const vote of pendingVotes || []) {
    const tpiId = vote?.tpiPlanning ? String(vote.tpiPlanning) : ''
    const voterId = vote?.voter?._id ? String(vote.voter._id) : ''

    if (!tpiId || !voterId) {
      continue
    }

    const tpi = tpiById.get(tpiId) || null
    if (!tpi) {
      continue
    }

    if (!groupedPendingVotes.has(voterId)) {
      groupedPendingVotes.set(voterId, {
        voter: vote.voter,
        tpisById: new Map()
      })
    }

    addVotePreviewTpi(groupedPendingVotes.get(voterId), vote, tpi)
  }

  const uniqueRecipients = new Set()
  const uniqueTpis = new Set()
  let linkCount = 0

  for (const item of groupedPendingVotes.values()) {
    if (!item?.voter?.email || item.tpisById.size === 0) {
      continue
    }

    const entry = ensurePersonEntry(peopleMap, item.voter)
    if (!entry) {
      continue
    }

    const link = await buildVoteAccessLink({
      year,
      person: item.voter,
      baseUrl,
      generateLinks,
      magicLinks
    })

    const tpis = Array.from(item.tpisById.values())
      .map((tpiEntry) => ({
        ...tpiEntry,
        roleLabel: Array.from(tpiEntry.roleLabels).filter(Boolean).join(', '),
        roleLabels: undefined
      }))
      .sort((left, right) => String(left.reference).localeCompare(String(right.reference)))

    entry.voteLinks.push({
      type: 'vote',
      role: null,
      roleLabel: 'Partie prenante',
      reference: tpis.map((tpiEntry) => tpiEntry.reference).filter(Boolean).join(', '),
      subject: tpis.length > 1 ? `${tpis.length} TPI à traiter` : (tpis[0]?.subject || ''),
      candidateName: tpis.length > 1 ? '' : (tpis[0]?.candidateName || ''),
      status: '',
      tpiId: null,
      tpis,
      redirectPath: link.redirectPath || `/planning/${year}`,
      expiresAt: link.expiresAt,
      token: link.token,
      url: link.url,
      generated: link.generated === true
    })

    uniqueRecipients.add(String(item.voter._id))
    for (const tpiEntry of tpis) {
      uniqueTpis.add(String(tpiEntry.tpiId))
    }
    linkCount += 1
  }

  return {
    linkCount,
    recipientCount: uniqueRecipients.size,
    tpiCount: uniqueTpis.size
  }
}

function collectPublicationPersonIds(rooms = []) {
  const personIds = new Set()

  for (const room of Array.isArray(rooms) ? rooms : []) {
    for (const tpiData of Array.isArray(room?.tpiDatas) ? room.tpiDatas : []) {
      const candidates = [
        tpiData?.candidatPersonId,
        tpiData?.expert1?.personId,
        tpiData?.expert2?.personId,
        tpiData?.boss?.personId
      ]

      for (const personId of candidates) {
        if (personId) {
          personIds.add(String(personId))
        }
      }
    }
  }

  return Array.from(personIds)
}

async function buildSoutenanceLinkPreview(year, baseUrl, peopleMap, dependencies) {
  const {
    PersonModel,
    magicLinks,
    getActivePublication,
    generateLinks
  } = dependencies

  const publicationVersion = await getActivePublication(year)

  if (!publicationVersion?.rooms?.length) {
    return {
      linkCount: 0,
      recipientCount: 0,
      publicationVersion: null,
      roomsCount: 0
    }
  }

  const recipientIds = collectPublicationPersonIds(publicationVersion.rooms)

  if (recipientIds.length === 0) {
    return {
      linkCount: 0,
      recipientCount: 0,
      publicationVersion: publicationVersion.version || null,
      roomsCount: publicationVersion.rooms.length
    }
  }

  const recipients = await PersonModel.find({
    _id: { $in: recipientIds },
    isActive: true
  })
    .select('firstName lastName email roles site')
    .lean()

  let linkCount = 0
  const linkedRecipientIds = new Set()

  for (const recipient of recipients || []) {
    if (!recipient?._id || !recipient?.email) {
      continue
    }

    const entry = ensurePersonEntry(peopleMap, recipient)
    if (!entry) {
      continue
    }

    const link = await buildSoutenanceAccessLink({
      year,
      person: recipient,
      baseUrl,
      publicationVersion: publicationVersion.version || null,
      generateLinks,
      magicLinks
    })

    entry.soutenanceLinks.push({
      type: 'soutenance',
      publicationVersion: publicationVersion.version || null,
      redirectPath: link.redirectPath || buildDefensePublicPath(year),
      expiresAt: link.expiresAt,
      token: link.token,
      url: link.url,
      generated: link.generated === true
    })

    linkedRecipientIds.add(String(recipient._id))
    linkCount += 1
  }

  return {
    linkCount,
    recipientCount: linkedRecipientIds.size,
    publicationVersion: publicationVersion.version || null,
    roomsCount: Array.isArray(publicationVersion.rooms) ? publicationVersion.rooms.length : 0
  }
}

async function buildAccessLinkPreview({ year, baseUrl, generateLinks = false, dependencies = {} }) {
  const normalizedYear = Number.parseInt(year, 10)
  const peopleMap = new Map()
  const resolvedDependencies = {
    PersonModel: dependencies.PersonModel || Person,
    TpiPlanningModel: dependencies.TpiPlanningModel || TpiPlanning,
    VoteModel: dependencies.VoteModel || Vote,
    magicLinks: dependencies.magicLinks || magicLinkV2Service,
    getActivePublication: dependencies.getActivePublication || getActivePublicationVersion,
    generateLinks: generateLinks === true
  }

  const votePreview = await buildVoteLinkPreview(
    normalizedYear,
    baseUrl,
    peopleMap,
    resolvedDependencies
  )
  const soutenancePreview = await buildSoutenanceLinkPreview(
    normalizedYear,
    baseUrl,
    peopleMap,
    resolvedDependencies
  )

  const people = sortPeople(Array.from(peopleMap.values()))
    .map((entry) => ({
      ...entry,
      voteLinks: sortVoteLinks(entry.voteLinks),
      soutenanceLinks: sortSoutenanceLinks(entry.soutenanceLinks)
    }))

  return {
    year: normalizedYear,
    linksGenerated: generateLinks === true,
    generatedAt: new Date().toISOString(),
    summary: {
      peopleCount: people.length,
      votePeopleCount: votePreview.recipientCount,
      voteLinkCount: votePreview.linkCount,
      soutenancePeopleCount: soutenancePreview.recipientCount,
      soutenanceLinkCount: soutenancePreview.linkCount
    },
    contexts: {
      vote: {
        tpiCount: votePreview.tpiCount,
        recipientCount: votePreview.recipientCount,
        linkCount: votePreview.linkCount
      },
      soutenance: {
        publicationVersion: soutenancePreview.publicationVersion,
        roomsCount: soutenancePreview.roomsCount,
        recipientCount: soutenancePreview.recipientCount,
        linkCount: soutenancePreview.linkCount
      }
    },
    people
  }
}

module.exports = {
  buildAccessLinkPreview
}
