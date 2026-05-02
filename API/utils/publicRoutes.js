const DEFENSES_PUBLIC_PATH = '/defenses'
const STATIC_VOTES_PUBLIC_PATH_PREFIX = '/votes'

function buildDefensePublicPath(year) {
  return `${DEFENSES_PUBLIC_PATH}/${encodeURIComponent(String(year))}`
}

function buildStaticVotePublicPath(year) {
  return `${STATIC_VOTES_PUBLIC_PATH_PREFIX}-${encodeURIComponent(String(year))}`
}

module.exports = {
  DEFENSES_PUBLIC_PATH,
  STATIC_VOTES_PUBLIC_PATH_PREFIX,
  buildDefensePublicPath,
  buildStaticVotePublicPath
}
