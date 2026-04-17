function normalizeClassValue(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeRoomMode(value) {
  const normalized = normalizeClassValue(value)

  if (!normalized) {
    return null
  }

  if (['MATU', 'M', 'MIN', 'MATURITE'].includes(normalized)) {
    return 'matu'
  }

  if (['NONM', 'NON_M', 'AUTRE', 'OTHER', 'SPECIAL'].includes(normalized)) {
    return 'nonM'
  }

  return null
}

function isMatuClass(value) {
  return normalizeClassValue(value).startsWith('M')
}

function inferTpiClassMode(tpiOrClass) {
  const rawClass = typeof tpiOrClass === 'string'
    ? tpiOrClass
    : tpiOrClass?.classe
  const normalizedClass = normalizeClassValue(rawClass)

  if (!normalizedClass) {
    return null
  }

  return normalizedClass.startsWith('M') ? 'matu' : 'nonM'
}

function inferRoomClassMode(room = {}) {
  const explicitMode = normalizeRoomMode(
    room.classMode ||
    room.roomClassMode ||
    room.type
  )

  if (explicitMode) {
    return explicitMode
  }

  if (room.min === true || room.isMatu === true) {
    return 'matu'
  }

  if (room.special === true) {
    return 'nonM'
  }

  const allowedClasses = Array.isArray(room.allowedClasses)
    ? room.allowedClasses
    : Array.isArray(room.classes)
      ? room.classes
      : []

  if (allowedClasses.some(isMatuClass)) {
    return 'matu'
  }

  if (allowedClasses.length > 0) {
    return 'nonM'
  }

  const normalizedRoomName = normalizeClassValue(room.name || room.roomName)
  if (normalizedRoomName.startsWith('M')) {
    return 'matu'
  }

  return null
}

function getRoomCompatibilityReport(room, tpiOrClass) {
  const roomClassMode = inferRoomClassMode(room)
  const tpiClassMode = inferTpiClassMode(tpiOrClass)

  return {
    roomClassMode,
    tpiClassMode,
    compatible:
      !roomClassMode ||
      !tpiClassMode ||
      roomClassMode === tpiClassMode
  }
}

module.exports = {
  inferRoomClassMode,
  inferTpiClassMode,
  getRoomCompatibilityReport,
  isMatuClass,
  normalizeClassValue
}
