function buildDefaultAvailabilityFromPresences(presences) {
  const periodsByDay = new Map()

  for (const [dateStr, presence] of Object.entries(presences || {})) {
    const dayOfWeek = new Date(dateStr).getDay()
    const currentPeriods = periodsByDay.get(dayOfWeek) || new Set()

    if (presence.matin) {
      currentPeriods.add(1)
    }

    if (presence['apres-midi']) {
      currentPeriods.add(2)
    }

    periodsByDay.set(dayOfWeek, currentPeriods)
  }

  return Array.from(periodsByDay.entries())
    .sort(([leftDay], [rightDay]) => leftDay - rightDay)
    .map(([dayOfWeek, periods]) => ({
      dayOfWeek,
      periods: Array.from(periods).sort((left, right) => left - right)
    }))
}

module.exports = {
  buildDefaultAvailabilityFromPresences
}