function toPlanningTpiResponseObject(tpi) {
  if (!tpi || typeof tpi !== 'object') {
    return tpi
  }

  if (typeof tpi.toObject === 'function') {
    return tpi.toObject()
  }

  return { ...tpi }
}

module.exports = {
  toPlanningTpiResponseObject
}
