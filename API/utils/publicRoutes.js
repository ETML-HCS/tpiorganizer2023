const DEFENSES_PUBLIC_PATH = '/defenses'

function buildDefensePublicPath(year) {
  return `${DEFENSES_PUBLIC_PATH}/${encodeURIComponent(String(year))}`
}

module.exports = {
  DEFENSES_PUBLIC_PATH,
  buildDefensePublicPath
}
