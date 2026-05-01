import React, { useState, useEffect, useMemo, Fragment } from "react"

import { useLocation, useNavigate, useParams } from "react-router-dom"
import RenderRooms from "./TpiSoutenanceRooms"
import { showNotification } from "../Tools"
import { useSoutenanceData } from "./useSoutenanceData"
import {
  formatDate,
  formatTimeRange,
  getRoomClassFilterLabel,
  getRoomClassLabel,
  getRoomSlotCount,
  getRoomSlots
} from "./TpiSoutenanceParts"
import {
  MobileMesTpiFilter,
  MobileRoomFilter,
  SoutenanceDesktopHeader
} from "./TpiSoutenanceParts"

import "../../css/tpiSoutenance/tpiSoutenance.css"

// Pour accéder à la variable d'environnement REACT_APP_API_URL
const isDemo = process.env.REACT_APP_DEBUG === "true" // affiche version démonstration
const PDF_MARGIN_MM = 10
const PDF_MAX_FONT = 9
const PDF_MIN_FONT = 5.8
const PDF_MIN_FONT_FALLBACK = 4.8
const PDF_HEADER_FONT = 15
const PDF_META_FONT = 8.5
const PDF_LINE_PADDING = 2
const PDF_FOOTER_HEIGHT = 7
const PDF_MAX_CELL_LINES = 3
const PDF_POINT_TO_MM = 0.3528
const PDF_VIEW_MODES = {
  GENERAL: "general",
  ROOMS: "rooms",
  ROOM_GRID: "roomGrid",
  PEOPLE: "people"
}
const PDF_VIEW_LABELS = {
  [PDF_VIEW_MODES.GENERAL]: "Vue générale",
  [PDF_VIEW_MODES.ROOMS]: "Vue salles",
  [PDF_VIEW_MODES.ROOM_GRID]: "Vue écran salles",
  [PDF_VIEW_MODES.PEOPLE]: "Vue experts/CDP"
}
const PDF_COLORS = {
  ink: [15, 23, 42],
  muted: [71, 85, 105],
  subtle: [100, 116, 139],
  line: [203, 213, 225],
  softLine: [226, 232, 240],
  page: [248, 250, 252],
  panel: [255, 255, 255],
  panelSoft: [241, 245, 249],
  primary: [37, 99, 235],
  primaryDark: [30, 64, 175],
  teal: [13, 148, 136],
  rose: [225, 29, 72],
  amber: [245, 158, 11],
  white: [255, 255, 255]
}
const PDF_MODE_ACCENTS = {
  [PDF_VIEW_MODES.GENERAL]: PDF_COLORS.primary,
  [PDF_VIEW_MODES.ROOMS]: PDF_COLORS.teal,
  [PDF_VIEW_MODES.ROOM_GRID]: PDF_COLORS.primary,
  [PDF_VIEW_MODES.PEOPLE]: PDF_COLORS.rose
}

const loadJsPdfConstructor = async () => {
  const jsPdfModule = await import("jspdf")

  return jsPdfModule.jsPDF || jsPdfModule.default?.jsPDF || jsPdfModule.default
}

const PDF_COLUMN_DEFINITIONS = {
  [PDF_VIEW_MODES.GENERAL]: {
    landscape: [
      { label: "Date", key: "date", ratio: 0.12 },
      { label: "Horaire", key: "horaire", ratio: 0.1 },
      { label: "Site", key: "site", ratio: 0.08 },
      { label: "Salle", key: "salle", ratio: 0.13 },
      { label: "Candidat", key: "candidat", ratio: 0.2 },
      { label: "Experts", key: "experts", ratio: 0.24 },
      { label: "CDP", key: "cdp", ratio: 0.13 }
    ],
    portrait: [
      { label: "Date", key: "date", ratio: 0.15 },
      { label: "Horaire", key: "horaire", ratio: 0.13 },
      { label: "Site", key: "site", ratio: 0.08 },
      { label: "Salle", key: "salle", ratio: 0.14 },
      { label: "Candidat", key: "candidat", ratio: 0.22 },
      { label: "Experts", key: "experts", ratio: 0.16 },
      { label: "CDP", key: "cdp", ratio: 0.12 }
    ]
  },
  [PDF_VIEW_MODES.ROOMS]: {
    portrait: [
      { label: "Horaire", key: "horaire", ratio: 0.16 },
      { label: "Candidat", key: "candidat", ratio: 0.28 },
      { label: "Expert 1", key: "expert1", ratio: 0.2 },
      { label: "Expert 2", key: "expert2", ratio: 0.2 },
      { label: "CDP", key: "cdp", ratio: 0.16 }
    ],
    landscape: [
      { label: "Horaire", key: "horaire", ratio: 0.12 },
      { label: "Candidat", key: "candidat", ratio: 0.28 },
      { label: "Expert 1", key: "expert1", ratio: 0.22 },
      { label: "Expert 2", key: "expert2", ratio: 0.22 },
      { label: "CDP", key: "cdp", ratio: 0.16 }
    ]
  },
  [PDF_VIEW_MODES.PEOPLE]: {
    landscape: [
      { label: "Date", key: "date", ratio: 0.14 },
      { label: "Horaire", key: "horaire", ratio: 0.1 },
      { label: "Salle", key: "salle", ratio: 0.16 },
      { label: "Candidat", key: "candidat", ratio: 0.22 },
      { label: "Rôle", key: "role", ratio: 0.14 },
      { label: "Avec", key: "participants", ratio: 0.24 }
    ],
    portrait: [
      { label: "Date", key: "date", ratio: 0.16 },
      { label: "Horaire", key: "horaire", ratio: 0.12 },
      { label: "Salle", key: "salle", ratio: 0.18 },
      { label: "Candidat", key: "candidat", ratio: 0.22 },
      { label: "Rôle", key: "role", ratio: 0.14 },
      { label: "Avec", key: "participants", ratio: 0.18 }
    ]
  }
}

const normalizePdfViewMode = (value) =>
  Object.values(PDF_VIEW_MODES).includes(value)
    ? value
    : PDF_VIEW_MODES.GENERAL

const sanitizeFileNamePart = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "export"

const buildExportDocumentTitle = (filters = [], year = "", viewMode = PDF_VIEW_MODES.GENERAL) => {
  const safeYear = sanitizeFileNamePart(year)
  const normalizedViewMode = normalizePdfViewMode(viewMode)
  const viewPrefix = normalizedViewMode === PDF_VIEW_MODES.GENERAL
    ? ""
    : `${sanitizeFileNamePart(PDF_VIEW_LABELS[normalizedViewMode]).toLowerCase()}_`

  if (!filters.length) {
    return `soutenances_${safeYear}_${viewPrefix}toutes`
  }

  const safeFilters = filters
    .map((filter) => sanitizeFileNamePart(filter))
    .join("_")
    .toLowerCase()

  return `soutenances_${safeYear}_${viewPrefix}${safeFilters}`
}

const buildPdfSummary = (filters = []) => {
  if (!filters.length) {
    return "Sans filtre (toutes les données)"
  }

  return filters.join(" · ")
}

const getActiveFilterEntries = (filters = {}) =>
  Object.entries(filters)
    .map(([key, value]) => ({ key, value: String(value || "").trim() }))
    .filter((entry) => entry.value)

const shouldShowEmptySlotsForFilters = (filters = {}) => {
  const structuralFilterKeys = new Set(["date", "nameRoom", "classType"])
  const activeFilters = getActiveFilterEntries(filters)

  return (
    activeFilters.length === 0 ||
    activeFilters.every((entry) => structuralFilterKeys.has(entry.key))
  )
}

const PERSONAL_VIEW_RESET_FILTERS = [
  "date",
  "site",
  "nameRoom",
  "classType",
  "reference",
  "candidate",
  "experts",
  "projectManagerButton",
  "projectManager"
]

const getSinglePersonIcalFilter = (filters = {}) => {
  const activeFilters = getActiveFilterEntries(filters)
  if (activeFilters.length !== 1) {
    return null
  }

  const [activeFilter] = activeFilters
  if (activeFilter.key === "experts") {
    return {
      name: activeFilter.value,
      role: "expert"
    }
  }

  if (
    activeFilter.key === "projectManager" ||
    activeFilter.key === "projectManagerButton"
  ) {
    return {
      name: activeFilter.value,
      role: "projectManager"
    }
  }

  return null
}

const getMagicLinkViewerName = (viewer = null) =>
  String(viewer?.name || "").trim() || "Collaborateur"

const getSortableDateValue = (date) => {
  const time = new Date(date).getTime()
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER
}

const getSortableTimeValue = (time) => {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})/)
  if (!match) {
    return Number.MAX_SAFE_INTEGER
  }

  return Number(match[1]) * 60 + Number(match[2])
}

const compareText = (left, right) =>
  String(left || "").localeCompare(String(right || ""), "fr", { sensitivity: "base" })

const compareExportSlots = (left, right) =>
  left.dateSort - right.dateSort ||
  left.timeSort - right.timeSort ||
  compareText(left.site, right.site) ||
  compareText(left.salle, right.salle) ||
  left.slotIndex - right.slotIndex ||
  compareText(left.candidat, right.candidat)

const getVisibleRoomSlotCount = (room, schedule = [], showEmptySlots = true) => {
  if (showEmptySlots) {
    return getRoomSlotCount(room, schedule)
  }

  return (Array.isArray(room?.tpiDatas) ? room.tpiDatas : [])
    .filter((tpiData) => Boolean(tpiData?.refTpi))
    .length
}

const buildExportSlots = (filteredData, schedule = [], showEmptySlots = true) =>
  (Array.isArray(filteredData) ? filteredData : []).flatMap((room) => {
    const roomSlots = getRoomSlots(room, schedule)
    const exportRoomSlots = showEmptySlots
      ? roomSlots
      : roomSlots.filter(({ tpiData }) => Boolean(tpiData?.refTpi))

    return (Array.isArray(exportRoomSlots) ? exportRoomSlots : []).map(({ tpiData, displayedSlot, index }) => {
      const hasPublishedTpi = Boolean(tpiData?.refTpi)
      const expertNames = hasPublishedTpi
        ? [tpiData?.expert1?.name, tpiData?.expert2?.name].filter(Boolean).join(" / ")
        : ""
      const startTime = displayedSlot?.startTime || ""
      const endTime = displayedSlot?.endTime || ""
      const site = room?.site || ""
      const salle = room?.name || ""
      const roomClassLabel = getRoomClassLabel(room)
      const slotIndex = Number.isInteger(index) ? index : 0

      return {
        roomKey: `${getSortableDateValue(room.date)}|${site}|${salle}`,
        dateSort: getSortableDateValue(room.date),
        timeSort: getSortableTimeValue(startTime),
        slotIndex,
        date: formatDate(room.date),
        horaire: formatTimeRange(startTime, endTime),
        site,
        salle,
        roomClassLabel,
        salleLabel: `${salle}${site ? ` (${site})` : ""}`,
        hasPublishedTpi,
        candidat: hasPublishedTpi ? tpiData?.candidat || "" : "",
        refTpi: hasPublishedTpi ? tpiData?.refTpi || "" : "",
        expert1: hasPublishedTpi ? tpiData?.expert1?.name || "" : "",
        expert2: hasPublishedTpi ? tpiData?.expert2?.name || "" : "",
        experts: expertNames,
        cdp: hasPublishedTpi ? tpiData?.boss?.name || "" : ""
      }
    })
  }).sort(compareExportSlots)

const buildGeneralExportRows = (exportSlots) =>
  exportSlots.map((slot) => ({
    date: slot.date,
    horaire: slot.horaire,
    site: slot.site,
    salle: slot.salle,
    candidat: slot.candidat,
    experts: slot.experts,
    cdp: slot.cdp
  }))

const buildRoomExportSections = (exportSlots) => {
  const sections = new Map()

  exportSlots.forEach((slot) => {
    if (!sections.has(slot.roomKey)) {
      sections.set(slot.roomKey, {
        key: slot.roomKey,
        title: `Salle ${slot.salle}`,
        subtitle: `${slot.date}${slot.site ? ` · ${slot.site}` : ""}`,
        sortDate: slot.dateSort,
        sortSite: slot.site,
        sortRoom: slot.salle,
        roomClassLabel: slot.roomClassLabel,
        slots: []
      })
    }

    sections.get(slot.roomKey).slots.push(slot)
  })

  return Array.from(sections.values())
    .sort((left, right) =>
      left.sortDate - right.sortDate ||
      compareText(left.sortSite, right.sortSite) ||
      compareText(left.sortRoom, right.sortRoom)
    )
    .map((section) => {
      const publishedCount = section.slots.filter((slot) => slot.hasPublishedTpi).length
      return {
        key: section.key,
        title: section.title,
        subtitle: `${section.subtitle} · ${publishedCount} défense${publishedCount > 1 ? "s" : ""}`,
        roomName: section.sortRoom,
        site: section.sortSite,
        date: section.subtitle.split(" · ")[0] || "",
        roomClassLabel: section.roomClassLabel,
        publishedCount,
        rows: section.slots.map((slot) => ({
          horaire: slot.horaire,
          candidat: slot.candidat,
          expert1: slot.expert1,
          expert2: slot.expert2,
          cdp: slot.cdp
        }))
      }
    })
}

const buildPersonSectionRoleSummary = (rows = []) => {
  const roles = new Set()

  rows.forEach((row) => {
    String(row.role || "")
      .split("/")
      .map((role) => role.trim())
      .filter(Boolean)
      .forEach((role) => {
        if (role.startsWith("Expert")) {
          roles.add("Expert")
        } else if (role === "Chef de projet") {
          roles.add("Chef de projet")
        }
      })
  })

  const orderedRoles = ["Expert", "Chef de projet"].filter((role) => roles.has(role))
  return orderedRoles.length ? orderedRoles.join(" / ") : "Expert / Chef de projet"
}

const buildPersonExportSections = (exportSlots) => {
  const sections = new Map()

  exportSlots
    .filter((slot) => slot.hasPublishedTpi)
    .forEach((slot) => {
      const participants = [
        { name: slot.expert1, role: "Expert 1" },
        { name: slot.expert2, role: "Expert 2" },
        { name: slot.cdp, role: "Chef de projet" }
      ].filter((participant) => participant.name)
      const rolesByName = new Map()

      participants.forEach((participant) => {
        const key = participant.name.trim()
        if (!rolesByName.has(key)) {
          rolesByName.set(key, new Set())
        }
        rolesByName.get(key).add(participant.role)
      })

      rolesByName.forEach((roles, personName) => {
        if (!sections.has(personName)) {
          sections.set(personName, {
            key: personName,
            title: personName,
            rows: []
          })
        }

        const otherParticipants = participants
          .map((participant) => participant.name)
          .filter((name, index, values) => name !== personName && values.indexOf(name) === index)
          .join(" / ")

        sections.get(personName).rows.push({
          dateSort: slot.dateSort,
          timeSort: slot.timeSort,
          date: slot.date,
          horaire: slot.horaire,
          salle: slot.salleLabel,
          candidat: slot.candidat,
          role: Array.from(roles).join(" / "),
          participants: otherParticipants
        })
      })
    })

  return Array.from(sections.values())
    .sort((left, right) => compareText(left.title, right.title))
    .map((section) => {
      const rows = section.rows.sort((left, right) =>
        left.dateSort - right.dateSort ||
        left.timeSort - right.timeSort ||
        compareText(left.salle, right.salle) ||
        compareText(left.candidat, right.candidat)
      )

      return {
        ...section,
        subtitle: `${buildPersonSectionRoleSummary(rows)} · ${rows.length} défense${rows.length > 1 ? "s" : ""}`,
        rows
      }
    })
}

const getPdfExportItemCount = (viewMode, exportSlots) => {
  const normalizedViewMode = normalizePdfViewMode(viewMode)

  if (
    normalizedViewMode === PDF_VIEW_MODES.ROOMS ||
    normalizedViewMode === PDF_VIEW_MODES.ROOM_GRID
  ) {
    return buildRoomExportSections(exportSlots).reduce(
      (count, section) => count + section.rows.length,
      0
    )
  }

  if (normalizedViewMode === PDF_VIEW_MODES.PEOPLE) {
    return buildPersonExportSections(exportSlots).reduce(
      (count, section) => count + section.rows.length,
      0
    )
  }

  return exportSlots.length
}

const getPdfColumnDefinitions = (viewMode, orientation) => {
  const normalizedViewMode = normalizePdfViewMode(viewMode)
  return (
    PDF_COLUMN_DEFINITIONS[normalizedViewMode]?.[orientation] ||
    PDF_COLUMN_DEFINITIONS[normalizedViewMode]?.landscape ||
    PDF_COLUMN_DEFINITIONS[PDF_VIEW_MODES.GENERAL].landscape
  )
}

const buildPdfExportPayload = (viewMode, exportSlots) => {
  const normalizedViewMode = normalizePdfViewMode(viewMode)

  if (
    normalizedViewMode === PDF_VIEW_MODES.ROOMS ||
    normalizedViewMode === PDF_VIEW_MODES.ROOM_GRID
  ) {
    const sections = buildRoomExportSections(exportSlots)
    return {
      isSectioned: true,
      sections,
      rowCount: sections.reduce((count, section) => count + section.rows.length, 0)
    }
  }

  if (normalizedViewMode === PDF_VIEW_MODES.PEOPLE) {
    const sections = buildPersonExportSections(exportSlots)
    return {
      isSectioned: true,
      sections,
      rowCount: sections.reduce((count, section) => count + section.rows.length, 0)
    }
  }

  const rows = buildGeneralExportRows(exportSlots)
  return {
    isSectioned: false,
    rows,
    rowCount: rows.length
  }
}

const truncatePdfLines = (lines, maxLines = PDF_MAX_CELL_LINES) => {
  const safeLines = Array.isArray(lines) && lines.length ? lines : [""]

  if (safeLines.length <= maxLines) {
    return safeLines
  }

  const truncatedLines = safeLines.slice(0, maxLines)
  truncatedLines[maxLines - 1] = `${String(truncatedLines[maxLines - 1]).trimEnd()}...`
  return truncatedLines
}

const estimatePdfTextWidth = (text, fontSize) =>
  Math.max(0, String(text || "").length * fontSize * 0.42)

const getPdfTextWidth = (pdf, text, fontSize) => {
  if (fontSize) {
    pdf.setFontSize(fontSize)
  }

  if (typeof pdf.getTextWidth === "function") {
    return pdf.getTextWidth(String(text || ""))
  }

  return estimatePdfTextWidth(text, fontSize || PDF_META_FONT)
}

const getPdfLineHeight = (fontSize) =>
  Math.max(3.1, fontSize * PDF_POINT_TO_MM * 1.22)

const trimPdfTextToWidth = (pdf, value, width, fontSize = PDF_META_FONT) => {
  const text = String(value || "—").replace(/\s+/g, " ").trim()
  const safeWidth = Math.max(4, width)

  if (getPdfTextWidth(pdf, text, fontSize) <= safeWidth) {
    return text
  }

  const suffix = "..."
  let low = 0
  let high = text.length
  let best = suffix

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidate = `${text.slice(0, middle).trimEnd()}${suffix}`

    if (getPdfTextWidth(pdf, candidate, fontSize) <= safeWidth) {
      best = candidate
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return best
}

const setPdfFillColor = (pdf, color) => {
  pdf.setFillColor(...color)
}

const setPdfTextColor = (pdf, color) => {
  pdf.setTextColor(...color)
}

const setPdfDrawColor = (pdf, color) => {
  pdf.setDrawColor(...color)
}

const drawPdfRect = (pdf, x, y, width, height, style = "F", radius = 0) => {
  if (radius > 0 && typeof pdf.roundedRect === "function") {
    pdf.roundedRect(x, y, width, height, radius, radius, style)
    return
  }

  pdf.rect(x, y, width, height, style)
}

const buildPdfTextLines = (pdf, value, width, maxLines = 2, fontSize = PDF_META_FONT) =>
  truncatePdfLines(
    pdf.splitTextToSize(String(value || "—"), Math.max(10, width)),
    maxLines
  ).map((line) => trimPdfTextToWidth(pdf, line, width, fontSize))

const drawPdfPill = ({
  pdf,
  text,
  x,
  y,
  fillColor = PDF_COLORS.panelSoft,
  textColor = PDF_COLORS.ink,
  drawColor = null,
  fontSize = 6.8,
  align = "left",
  minWidth = 15,
  maxWidth = 58
}) => {
  const safeText = String(text || "—")
  const width = Math.min(
    maxWidth,
    Math.max(minWidth, estimatePdfTextWidth(safeText, fontSize) + 5.5)
  )
  const pillX = align === "right" ? x - width : x

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(fontSize)
  const fittedText = trimPdfTextToWidth(pdf, safeText, width - 4, fontSize)

  setPdfFillColor(pdf, fillColor)
  if (drawColor) {
    setPdfDrawColor(pdf, drawColor)
    pdf.setLineWidth(0.15)
    drawPdfRect(pdf, pillX, y, width, 6.2, "FD", 2.8)
  } else {
    drawPdfRect(pdf, pillX, y, width, 6.2, "F", 2.8)
  }

  setPdfTextColor(pdf, textColor)
  pdf.text(fittedText, pillX + width / 2, y + 4.1, { align: "center" })

  return width
}

const drawPdfFooter = ({
  pdf,
  contentX,
  contentWidth,
  pageHeight,
  generatedAtLabel,
  pageIndex,
  pageCount
}) => {
  setPdfDrawColor(pdf, PDF_COLORS.softLine)
  pdf.setLineWidth(0.2)
  pdf.line(contentX, pageHeight - 9, contentX + contentWidth, pageHeight - 9)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(PDF_MIN_FONT)
  setPdfTextColor(pdf, PDF_COLORS.subtle)
  pdf.text(
    trimPdfTextToWidth(pdf, `Généré le ${generatedAtLabel}`, contentWidth - 42, PDF_MIN_FONT),
    contentX,
    pageHeight - 4
  )
  pdf.text(
    `Page ${pageIndex + 1} / ${pageCount}`,
    contentX + contentWidth,
    pageHeight - 4,
    { align: "right" }
  )
}

const drawPdfHeroHeader = ({
  pdf,
  contentX,
  contentY,
  contentWidth,
  title,
  subtitle,
  accentColor,
  height = 23,
  titleFontSize = PDF_HEADER_FONT,
  subtitleFontSize = PDF_META_FONT
}) => {
  setPdfFillColor(pdf, PDF_COLORS.ink)
  drawPdfRect(pdf, contentX, contentY, contentWidth, height, "F", 2.5)
  setPdfFillColor(pdf, accentColor)
  drawPdfRect(pdf, contentX, contentY, 4, height, "F", 2.5)

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(titleFontSize)
  setPdfTextColor(pdf, PDF_COLORS.white)
  pdf.text(
    trimPdfTextToWidth(pdf, title, contentWidth - 14, titleFontSize),
    contentX + 7,
    contentY + (height <= 18 ? 7 : 8.2)
  )

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(subtitleFontSize)
  setPdfTextColor(pdf, [203, 213, 225])
  pdf.text(
    trimPdfTextToWidth(pdf, subtitle, contentWidth - 14, subtitleFontSize),
    contentX + 7,
    contentY + (height <= 18 ? 13 : 15.3)
  )
}

const buildPdfColumns = (contentWidth, columnDefinitions) => {
  const totalRatio = columnDefinitions.reduce(
    (sum, column) => sum + (Number(column.ratio) || 1),
    0
  )

  return columnDefinitions.map((column) => ({
    label: column.label,
    key: column.key,
    width: Math.max(
      column.minWidth || 14,
      Number((contentWidth * ((Number(column.ratio) || 1) / totalRatio)).toFixed(2))
    )
  }))
}

const buildPdfRowsDimensions = (doc, rows, columns, fontSize, lineHeightOverride) => {
  doc.setFont("helvetica", "normal")
  doc.setFontSize(fontSize)

  const lineHeight = lineHeightOverride || getPdfLineHeight(fontSize)
  const rowCellLines = rows.map((row) =>
    columns.map((column) =>
      truncatePdfLines(
        doc.splitTextToSize(
          String(row[column.key] ?? "—"),
          Math.max(10, column.width - PDF_LINE_PADDING)
        )
      ).map((line) =>
        trimPdfTextToWidth(
          doc,
          line,
          Math.max(10, column.width - PDF_LINE_PADDING),
          fontSize
        )
      )
    )
  )

  const rowHeights = rowCellLines.map((cellLines) => {
    let maxLines = 1
    cellLines.forEach((lines) => {
      if (lines.length > maxLines) {
        maxLines = lines.length
      }
    })

    return Math.max(6, maxLines * lineHeight + 2.4)
  })

  return {
    rowHeights,
    rowCellLines,
    lineHeight
  }
}

const buildPdfDocumentPlan = ({
  pdf,
  orientation,
  rows,
  summaryLabel,
  generatedAtLabel,
  fontSize,
  columnDefinitions,
  lineHeightOverride = null
}) => {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - PDF_MARGIN_MM * 2
  const contentX = PDF_MARGIN_MM
  const contentY = PDF_MARGIN_MM
  const columns = buildPdfColumns(
    contentWidth,
    columnDefinitions || getPdfColumnDefinitions(PDF_VIEW_MODES.GENERAL, orientation)
  )
  const tableWidth = columns.reduce((acc, column) => acc + column.width, 0)
  const maxCellWidths = columns.map((column) =>
    Math.max(10, column.width - PDF_LINE_PADDING)
  )

  const titleHeight = 18
  const metaHeight = 10
  const firstTableStartY = contentY + titleHeight + metaHeight + 4
  const nextTableStartY = contentY + titleHeight + 4

  const { rowHeights, rowCellLines, lineHeight } = buildPdfRowsDimensions(
    pdf,
    rows,
    columns,
    fontSize,
    lineHeightOverride
  )

  const headerLines = columns.map((column) =>
    Math.max(
      1,
      pdf.splitTextToSize(column.label, Math.max(10, column.width - PDF_LINE_PADDING)).length
    )
  )
  const headerHeight = Math.max(6.2, Math.max(...headerLines) * lineHeight + 2.6)
  const pages = []
  let rowIndex = 0
  let isFirstPage = true

  while (rowIndex < rows.length) {
    const tableStartY = isFirstPage ? firstTableStartY : nextTableStartY
    const maxRowsHeight =
      pageHeight - PDF_MARGIN_MM - PDF_FOOTER_HEIGHT - tableStartY - headerHeight
    const startIndex = rowIndex
    let usedHeight = 0

    while (
      rowIndex < rows.length &&
      (usedHeight + rowHeights[rowIndex] <= maxRowsHeight || rowIndex === startIndex)
    ) {
      usedHeight += rowHeights[rowIndex]
      rowIndex += 1
    }

    pages.push({
      startIndex,
      endIndex: rowIndex,
      tableStartY,
      rowsHeight: usedHeight
    })
    isFirstPage = false
  }

  return {
    pdf,
    pageHeight,
    contentWidth,
    contentX,
    contentY,
    tableWidth,
    columns,
    maxCellWidths,
    fontSize,
    lineHeight,
    headerHeight,
    rowHeights,
    rowCellLines,
    pages
  }
}

const renderPdfDocument = ({
  docPlan,
  rows,
  year,
  generatedAtLabel,
  title = `Export des défenses ${year}`,
  subtitle = "Plateforme planning soutenances",
  summaryLabel = "Sans filtre (toutes les données)",
  viewMode = PDF_VIEW_MODES.GENERAL
}) => {
  const {
    pdf,
    pageHeight,
    contentWidth,
    contentX,
    contentY,
    tableWidth,
    columns,
    maxCellWidths,
    fontSize,
    lineHeight,
    headerHeight,
    rowHeights,
    rowCellLines,
    pages
  } = docPlan
  const normalizedViewMode = normalizePdfViewMode(viewMode)
  const accentColor = PDF_MODE_ACCENTS[normalizedViewMode]
  const xPositions = []
  let pointer = contentX

  columns.forEach((column) => {
    xPositions.push(pointer)
    pointer += column.width
  })

  const renderDocumentHeader = (pageIndex) => {
    drawPdfHeroHeader({
      pdf,
      contentX,
      contentY,
      contentWidth,
      title: pageIndex === 0 ? title : `${title} (suite)`,
      subtitle,
      accentColor,
      height: normalizedViewMode === PDF_VIEW_MODES.GENERAL ? 17 : 23,
      titleFontSize: normalizedViewMode === PDF_VIEW_MODES.GENERAL ? 12.5 : PDF_HEADER_FONT,
      subtitleFontSize: normalizedViewMode === PDF_VIEW_MODES.GENERAL ? 7.6 : PDF_META_FONT
    })

    if (pageIndex !== 0) {
      return
    }

    const panelY = contentY + 20
    const panelHeight = 8.5
    setPdfFillColor(pdf, PDF_COLORS.page)
    setPdfDrawColor(pdf, PDF_COLORS.softLine)
    pdf.setLineWidth(0.2)
    drawPdfRect(pdf, contentX, panelY, contentWidth, panelHeight, "FD", 2)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7.2)
    setPdfTextColor(pdf, PDF_COLORS.ink)
    pdf.text(`${rows.length} défense${rows.length > 1 ? "s" : ""}`, contentX + 4, panelY + 5.5)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    setPdfTextColor(pdf, PDF_COLORS.muted)
    pdf.text(
      trimPdfTextToWidth(pdf, `Filtres : ${summaryLabel}`, contentWidth - 96, 7),
      contentX + 32,
      panelY + 5.5
    )

    setPdfTextColor(pdf, PDF_COLORS.subtle)
    pdf.text(
      trimPdfTextToWidth(pdf, `Généré le ${generatedAtLabel}`, 54, 7),
      contentX + contentWidth - 4,
      panelY + 5.5,
      { align: "right" }
    )
  }

  const renderTableHeader = (tableStartY) => {
    setPdfFillColor(pdf, PDF_COLORS.ink)
    pdf.rect(contentX, tableStartY, tableWidth, headerHeight, "F")
    setPdfDrawColor(pdf, PDF_COLORS.ink)
    pdf.setLineWidth(0.2)
    pdf.setFont("helvetica", "bold")
    const headerFontSize = Math.max(fontSize - 0.5, PDF_MIN_FONT_FALLBACK)
    const headerLineHeight = getPdfLineHeight(headerFontSize)
    pdf.setFontSize(headerFontSize)
    setPdfTextColor(pdf, PDF_COLORS.white)

    xPositions.forEach((currentX, index) => {
      const column = columns[index]
      const lines = pdf
        .splitTextToSize(column.label, maxCellWidths[index])
        .map((line) =>
          trimPdfTextToWidth(
            pdf,
            line,
            maxCellWidths[index],
            headerFontSize
          )
        )
      const textY =
        tableStartY +
        (headerHeight - lines.length * headerLineHeight) / 2 +
        headerLineHeight * 0.74
      lines.forEach((line, lineIndex) => {
        pdf.text(line, currentX + 1.2, textY + lineIndex * headerLineHeight)
      })
    })
  }

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      pdf.addPage()
    }

    renderDocumentHeader(pageIndex)
    renderTableHeader(page.tableStartY)

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(fontSize)
    let rowY = page.tableStartY + headerHeight

    for (let rowIndex = page.startIndex; rowIndex < page.endIndex; rowIndex += 1) {
      const rowHeight = rowHeights[rowIndex]

      setPdfFillColor(pdf, rowIndex % 2 === 1 ? PDF_COLORS.page : PDF_COLORS.panel)
      pdf.rect(contentX, rowY, tableWidth, rowHeight, "F")

      xPositions.forEach((currentX, index) => {
        const column = columns[index]
        const lines = rowCellLines[rowIndex][index]
        const textY =
          rowY +
          (rowHeight - lines.length * lineHeight) / 2 +
          lineHeight * 0.76
        const isTimeColumn = column.key === "horaire" || column.key === "date"

        pdf.setFont("helvetica", isTimeColumn ? "bold" : "normal")
        pdf.setFontSize(fontSize)
        setPdfTextColor(pdf, isTimeColumn ? PDF_COLORS.ink : PDF_COLORS.muted)
        lines.forEach((line, lineIndex) => {
          pdf.text(line, currentX + 1.2, textY + lineIndex * lineHeight)
        })
      })

      setPdfDrawColor(pdf, PDF_COLORS.softLine)
      pdf.line(contentX, rowY + rowHeight, contentX + tableWidth, rowY + rowHeight)
      rowY += rowHeight
    }

    setPdfDrawColor(pdf, PDF_COLORS.line)
    pdf.setLineWidth(0.2)
    pdf.line(contentX, page.tableStartY, contentX + tableWidth, page.tableStartY)
    pdf.line(contentX, rowY, contentX + tableWidth, rowY)
    pdf.line(contentX, page.tableStartY, contentX, rowY)
    pdf.line(contentX + tableWidth, page.tableStartY, contentX + tableWidth, rowY)
    xPositions.slice(1).forEach((position) => {
      pdf.line(position, page.tableStartY + headerHeight, position, rowY)
    })

    drawPdfFooter({
      pdf,
      contentX,
      contentWidth,
      pageHeight,
      generatedAtLabel,
      pageIndex,
      pageCount: pages.length
    })
  })

  return pdf
}

const getPdfPageLayout = (pdf) => {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  return {
    pageWidth,
    pageHeight,
    contentX: PDF_MARGIN_MM,
    contentY: PDF_MARGIN_MM,
    contentWidth: pageWidth - PDF_MARGIN_MM * 2
  }
}

const buildFixedSizePdfPages = (sections, pageCapacity) =>
  sections.flatMap((section) => {
    const rows = section.rows.length ? section.rows : [{}]
    const pages = []

    for (let index = 0; index < rows.length; index += pageCapacity) {
      pages.push({
        section,
        rows: rows.slice(index, index + pageCapacity),
        startIndex: index
      })
    }

    return pages
  })

const renderPdfMetaLine = ({
  pdf,
  contentX,
  y,
  contentWidth,
  summaryLabel,
  generatedAtLabel
}) => {
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(7)
  setPdfTextColor(pdf, PDF_COLORS.subtle)
  const generatedText = `Généré ${generatedAtLabel}`
  const generatedWidth = Math.min(58, Math.max(42, getPdfTextWidth(pdf, generatedText, 7) + 2))
  const filtersWidth = Math.max(38, contentWidth - generatedWidth - 8)
  pdf.text(
    trimPdfTextToWidth(
      pdf,
      `Filtres : ${summaryLabel}`,
      filtersWidth,
      7
    ),
    contentX,
    y + 4.5
  )
  pdf.text(
    trimPdfTextToWidth(pdf, generatedText, generatedWidth, 7),
    contentX + contentWidth,
    y + 4.5,
    { align: "right" }
  )
}

const renderRoomPosterPdf = ({
  pdf,
  sections,
  summaryLabel,
  generatedAtLabel,
  year
}) => {
  const { pageHeight, contentX, contentY, contentWidth } = getPdfPageLayout(pdf)
  const accentColor = PDF_MODE_ACCENTS[PDF_VIEW_MODES.ROOMS]
  const cardHeight = 20
  const cardGap = 3
  const cardsStartY = contentY + 48
  const pageCapacity = Math.max(
    1,
    Math.floor((pageHeight - 16 - cardsStartY + cardGap) / (cardHeight + cardGap))
  )
  const pages = buildFixedSizePdfPages(sections, pageCapacity)

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      pdf.addPage()
    }

    const title = `${page.section.title}${page.startIndex > 0 ? " (suite)" : ""}`

    drawPdfHeroHeader({
      pdf,
      contentX,
      contentY,
      contentWidth,
      title,
      subtitle: `${page.section.subtitle} · ${year}`,
      accentColor
    })

    renderPdfMetaLine({
      pdf,
      contentX,
      y: contentY + 29,
      contentWidth,
      summaryLabel,
      generatedAtLabel
    })

    let rowY = cardsStartY
    page.rows.forEach((row) => {
      const hasCandidate = Boolean(String(row.candidat || "").trim())
      const candidateLabel = hasCandidate ? row.candidat : "Créneau libre"
      const cardFill = hasCandidate ? PDF_COLORS.panel : PDF_COLORS.panelSoft
      const cardAccent = hasCandidate ? accentColor : PDF_COLORS.amber

      setPdfFillColor(pdf, cardFill)
      setPdfDrawColor(pdf, PDF_COLORS.softLine)
      pdf.setLineWidth(0.25)
      drawPdfRect(pdf, contentX, rowY, contentWidth, cardHeight, "FD", 2.2)
      setPdfFillColor(pdf, cardAccent)
      drawPdfRect(pdf, contentX, rowY, 3, cardHeight, "F", 2.2)

      drawPdfPill({
        pdf,
        text: row.horaire || "Horaire à confirmer",
        x: contentX + 8,
        y: rowY + 3.1,
        fillColor: hasCandidate ? PDF_COLORS.ink : PDF_COLORS.white,
        textColor: hasCandidate ? PDF_COLORS.white : PDF_COLORS.ink,
        minWidth: 28,
        maxWidth: 42
      })

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10.4)
      setPdfTextColor(pdf, hasCandidate ? PDF_COLORS.ink : PDF_COLORS.subtle)
      buildPdfTextLines(pdf, candidateLabel, contentWidth - 58, 1, 10.4).forEach((line, lineIndex) => {
        pdf.text(line, contentX + 54, rowY + 7 + lineIndex * 4)
      })

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7.3)
      setPdfTextColor(pdf, PDF_COLORS.muted)
      const detailLines = [
        `Expert 1 : ${row.expert1 || "—"}`,
        `Expert 2 : ${row.expert2 || "—"}`,
        `CDP : ${row.cdp || "—"}`
      ]
      detailLines.forEach((detail, detailIndex) => {
        pdf.text(
          buildPdfTextLines(pdf, detail, contentWidth - 58, 1, 7.3)[0],
          contentX + 54,
          rowY + 12.6 + detailIndex * 3.2
        )
      })

      rowY += cardHeight + cardGap
    })

    drawPdfFooter({
      pdf,
      contentX,
      contentWidth,
      pageHeight,
      generatedAtLabel,
      pageIndex,
      pageCount: pages.length
    })
  })

  return pdf
}

const getPdfRoomAccentColor = (site = "") => {
  const normalizedSite = String(site || "").toUpperCase()

  if (normalizedSite.includes("CFPV")) {
    return [222, 32, 146]
  }

  if (normalizedSite.includes("ETML") || normalizedSite.includes("VENNES")) {
    return [103, 0, 227]
  }

  return PDF_COLORS.primary
}

const getPdfRoomClassTagColors = (label = "") => {
  const normalizedLabel = String(label || "").toLowerCase()

  if (normalizedLabel === "special") {
    return {
      fill: [254, 243, 199],
      text: [120, 53, 15],
      stroke: [251, 191, 36]
    }
  }

  return {
    fill: PDF_COLORS.white,
    text: PDF_COLORS.ink,
    stroke: [226, 232, 240]
  }
}

const getRoomGridCardHeight = (section) => {
  const slotCount = Math.max(1, section.rows.length)
  return 15 + slotCount * 21 + 3
}

const getRoomGridMaxCardHeight = (section) => {
  const slotCount = Math.max(1, section.rows.length)
  return 15 + slotCount * 24 + 3
}

const getRoomGridColumnCount = ({ sections, orientation, layoutColumns }) => {
  const roomCount = Math.max(1, sections.length)
  const preferredColumns = Math.max(1, Number(layoutColumns) || 1)

  if (orientation === "portrait") {
    return Math.min(roomCount, Math.max(1, Math.min(2, preferredColumns)))
  }

  if (roomCount <= 2) {
    return roomCount
  }

  const largestSlotCount = Math.max(
    1,
    ...sections.map((section) => Math.max(1, section.rows.length))
  )
  const maxLandscapeColumns = largestSlotCount > 10 ? 3 : 4
  const targetColumns = roomCount >= maxLandscapeColumns ? maxLandscapeColumns : roomCount

  return Math.min(
    roomCount,
    Math.max(
      2,
      Math.min(maxLandscapeColumns, Math.max(preferredColumns, targetColumns))
    )
  )
}

const buildRoomGridPages = ({ sections, contentX, contentY, contentWidth, pageHeight, orientation, layoutColumns }) => {
  const startY = contentY
  const bottomY = pageHeight - 10
  const columnCount = getRoomGridColumnCount({ sections, orientation, layoutColumns })
  const gap = columnCount >= 4 ? 3 : 4
  const rawCardWidth = (contentWidth - gap * (columnCount - 1)) / columnCount
  const maxCardWidth = orientation === "portrait" ? 92 : 96
  const cardWidth = Math.min(rawCardWidth, maxCardWidth)
  const gridWidth = cardWidth * columnCount + gap * (columnCount - 1)
  const gridX = contentX + Math.max(0, (contentWidth - gridWidth) / 2)
  const pages = [[]]
  let currentPageIndex = 0
  let columnCursors = Array.from({ length: columnCount }, () => startY)

  const stretchPageItems = (items) => {
    if (!items.length) {
      return
    }

    const itemsByColumn = new Map()
    items.forEach((item) => {
      if (!itemsByColumn.has(item.columnIndex)) {
        itemsByColumn.set(item.columnIndex, [])
      }
      itemsByColumn.get(item.columnIndex).push(item)
    })

    itemsByColumn.forEach((columnItems) => {
      const sortedItems = columnItems.sort((left, right) => left.y - right.y)
      const totalGap = gap * Math.max(0, sortedItems.length - 1)
      const availableHeight = bottomY - startY - totalGap
      const baseHeight = sortedItems.reduce((sum, item) => sum + item.height, 0)
      const stretchCapacity = sortedItems.reduce(
        (sum, item) => sum + Math.max(0, item.maxHeight - item.height),
        0
      )
      const appliedStretch = Math.min(Math.max(0, availableHeight - baseHeight), stretchCapacity)
      let nextY = startY

      sortedItems.forEach((item) => {
        const itemCapacity = Math.max(0, item.maxHeight - item.height)
        const itemStretch = stretchCapacity > 0
          ? appliedStretch * (itemCapacity / stretchCapacity)
          : 0

        item.y = nextY
        item.height += itemStretch
        nextY += item.height + gap
      })
    })
  }

  const getNextColumnIndex = (cardHeight) => {
    const fittingColumns = columnCursors
      .map((cursor, index) => ({ cursor, index }))
      .filter(({ cursor }) => cursor + cardHeight <= bottomY)

    if (!fittingColumns.length) {
      return -1
    }

    return fittingColumns.sort((left, right) => left.cursor - right.cursor || left.index - right.index)[0].index
  }

  sections.forEach((section) => {
    const cardHeight = Math.min(getRoomGridCardHeight(section), bottomY - startY)
    const maxCardHeight = Math.min(getRoomGridMaxCardHeight(section), bottomY - startY)
    let columnIndex = getNextColumnIndex(cardHeight)

    if (columnIndex === -1 && pages[currentPageIndex].length > 0) {
      stretchPageItems(pages[currentPageIndex])
      pages.push([])
      currentPageIndex += 1
      columnCursors = Array.from({ length: columnCount }, () => startY)
      columnIndex = getNextColumnIndex(cardHeight)
    }

    const safeColumnIndex = columnIndex === -1 ? 0 : columnIndex
    const cursorY = columnCursors[safeColumnIndex]

    pages[currentPageIndex].push({
      section,
      x: gridX + safeColumnIndex * (cardWidth + gap),
      y: cursorY,
      width: cardWidth,
      height: cardHeight,
      maxHeight: maxCardHeight,
      columnIndex: safeColumnIndex
    })

    columnCursors[safeColumnIndex] = cursorY + cardHeight + gap
  })

  stretchPageItems(pages[currentPageIndex])

  return pages
}

const renderRoomGridCard = ({ pdf, item }) => {
  const { section, x, y, width, height } = item
  const accentColor = getPdfRoomAccentColor(section.site)
  const headerHeight = 14
  const slotCount = Math.max(1, section.rows.length)
  const rowHeight = Math.max(20.5, (height - headerHeight - 3) / slotCount)
  const innerX = x + 3
  const timeColumnWidth = Math.min(23, Math.max(17, width * 0.24))
  const textX = x + timeColumnWidth + 6
  const textWidth = Math.max(22, width - timeColumnWidth - 9)
  const siteWidth = Math.min(24, Math.max(16, width * 0.26))
  const roomClassLabel = String(section.roomClassLabel || "").trim()
  const roomClassTag = roomClassLabel ? roomClassLabel.toUpperCase() : ""
  const roomClassTagWidth = roomClassTag
    ? Math.min(24, Math.max(13, estimatePdfTextWidth(roomClassTag, 5.5) + 5))
    : 0

  setPdfFillColor(pdf, PDF_COLORS.panel)
  setPdfDrawColor(pdf, PDF_COLORS.line)
  pdf.setLineWidth(0.25)
  drawPdfRect(pdf, x, y, width, height, "FD", 2.2)

  setPdfFillColor(pdf, accentColor)
  drawPdfRect(pdf, x, y, width, headerHeight, "F", 2.2)

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8.2)
  setPdfTextColor(pdf, PDF_COLORS.white)
  pdf.text(
    trimPdfTextToWidth(pdf, section.roomName || section.title, width - siteWidth - 9, 8.2),
    innerX,
    y + 5.7
  )

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(6.4)
  setPdfTextColor(pdf, [226, 232, 240])
  pdf.text(
    trimPdfTextToWidth(
      pdf,
      section.date || section.subtitle,
      width - 7 - (roomClassTagWidth ? roomClassTagWidth + 3 : 0),
      6.4
    ),
    innerX,
    y + 10.8
  )

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(6.2)
  setPdfTextColor(pdf, PDF_COLORS.white)
  pdf.text(
    trimPdfTextToWidth(pdf, section.site || "Site", siteWidth, 6.2),
    x + width - 3,
    y + 5.7,
    { align: "right" }
  )

  if (roomClassTag) {
    const tagColors = getPdfRoomClassTagColors(roomClassTag)
    const tagX = x + width - 3 - roomClassTagWidth
    const tagY = y + 8.1

    setPdfFillColor(pdf, tagColors.fill)
    setPdfDrawColor(pdf, tagColors.stroke)
    pdf.setLineWidth(0.15)
    drawPdfRect(pdf, tagX, tagY, roomClassTagWidth, 4.6, "FD", 1.6)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(5.5)
    setPdfTextColor(pdf, tagColors.text)
    pdf.text(
      trimPdfTextToWidth(pdf, roomClassTag, roomClassTagWidth - 3, 5.5),
      tagX + roomClassTagWidth / 2,
      tagY + 3.3,
      { align: "center" }
    )
  }

  let rowY = y + headerHeight
  section.rows.forEach((row, index) => {
    if (rowY + rowHeight > y + height - 2) {
      return
    }

    const hasCandidate = Boolean(String(row.candidat || "").trim())
    setPdfFillColor(pdf, index % 2 === 0 ? PDF_COLORS.panel : PDF_COLORS.page)
    pdf.rect(x, rowY, width, rowHeight, "F")
    setPdfDrawColor(pdf, PDF_COLORS.softLine)
    pdf.line(x + 2, rowY, x + width - 2, rowY)

    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(6.4)
    setPdfTextColor(pdf, PDF_COLORS.ink)
    pdf.text(
      trimPdfTextToWidth(pdf, row.horaire || "Horaire", timeColumnWidth, 6.4),
      innerX,
      rowY + Math.max(5.2, rowHeight / 2 - 2.2)
    )

    const lineGap = Math.max(3.5, Math.min(4.2, rowHeight / 5.2))
    const firstLineY = rowY + Math.max(5.5, (rowHeight - lineGap * 3) / 2 + 2.4)

    pdf.setFont("helvetica", hasCandidate ? "bold" : "normal")
    pdf.setFontSize(6.8)
    setPdfTextColor(pdf, hasCandidate ? PDF_COLORS.ink : PDF_COLORS.subtle)
    pdf.text(
      trimPdfTextToWidth(pdf, hasCandidate ? row.candidat : "Créneau libre", textWidth, 6.8),
      textX,
      firstLineY
    )

    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(5.8)
    setPdfTextColor(pdf, PDF_COLORS.muted)
    pdf.text(
      trimPdfTextToWidth(pdf, `E1 ${row.expert1 || "—"}`, textWidth, 5.8),
      textX,
      firstLineY + lineGap
    )
    pdf.text(
      trimPdfTextToWidth(pdf, `E2 ${row.expert2 || "—"}`, textWidth, 5.8),
      textX,
      firstLineY + lineGap * 2
    )
    pdf.text(
      trimPdfTextToWidth(pdf, `CDP ${row.cdp || "—"}`, textWidth, 5.8),
      textX,
      firstLineY + lineGap * 3
    )

    rowY += rowHeight
  })
}

const renderRoomGridPdf = ({
  pdf,
  sections,
  generatedAtLabel,
  orientation,
  layoutColumns
}) => {
  const { pageHeight, contentX, contentY, contentWidth } = getPdfPageLayout(pdf)
  const pages = buildRoomGridPages({
    sections,
    contentX,
    contentY,
    contentWidth,
    pageHeight,
    orientation,
    layoutColumns
  })

  pages.forEach((items, pageIndex) => {
    if (pageIndex > 0) {
      pdf.addPage()
    }

    items.forEach((item) => renderRoomGridCard({ pdf, item }))

    drawPdfFooter({
      pdf,
      contentX,
      contentWidth,
      pageHeight,
      generatedAtLabel,
      pageIndex,
      pageCount: pages.length
    })
  })

  return pdf
}

const renderPeopleSchedulePdf = ({
  pdf,
  sections,
  summaryLabel,
  generatedAtLabel,
  year
}) => {
  const { pageHeight, contentX, contentY, contentWidth } = getPdfPageLayout(pdf)
  const accentColor = PDF_MODE_ACCENTS[PDF_VIEW_MODES.PEOPLE]
  const cardHeight = 21
  const cardGap = 3
  const cardsStartY = contentY + 47
  const pageCapacity = Math.max(
    1,
    Math.floor((pageHeight - 16 - cardsStartY + cardGap) / (cardHeight + cardGap))
  )
  const pages = buildFixedSizePdfPages(sections, pageCapacity)

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      pdf.addPage()
    }

    const title = `${page.section.title}${page.startIndex > 0 ? " (suite)" : ""}`

    drawPdfHeroHeader({
      pdf,
      contentX,
      contentY,
      contentWidth,
      title,
      subtitle: `${page.section.subtitle} · ${year}`,
      accentColor
    })

    renderPdfMetaLine({
      pdf,
      contentX,
      y: contentY + 28.5,
      contentWidth,
      summaryLabel,
      generatedAtLabel
    })

    let rowY = cardsStartY
    page.rows.forEach((row) => {
      setPdfFillColor(pdf, PDF_COLORS.panel)
      setPdfDrawColor(pdf, PDF_COLORS.softLine)
      pdf.setLineWidth(0.25)
      drawPdfRect(pdf, contentX, rowY, contentWidth, cardHeight, "FD", 2.2)
      setPdfFillColor(pdf, accentColor)
      drawPdfRect(pdf, contentX, rowY, 3, cardHeight, "F", 2.2)

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8.2)
      setPdfTextColor(pdf, PDF_COLORS.ink)
      pdf.text(
        trimPdfTextToWidth(
          pdf,
          `${row.date || "Date à confirmer"} · ${row.horaire || "Horaire à confirmer"}`,
          contentWidth - 16,
          8.2
        ),
        contentX + 8,
        rowY + 6
      )

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7.4)
      setPdfTextColor(pdf, PDF_COLORS.muted)
      pdf.text(buildPdfTextLines(pdf, row.salle || "Salle à confirmer", 72, 1, 7.4)[0], contentX + 8, rowY + 11)

      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(9.5)
      setPdfTextColor(pdf, PDF_COLORS.ink)
      buildPdfTextLines(pdf, row.candidat || "Candidat à confirmer", contentWidth - 102, 1, 9.5)
        .forEach((line, lineIndex) => {
          pdf.text(line, contentX + 86, rowY + 11 + lineIndex * 4)
        })

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7.1)
      setPdfTextColor(pdf, PDF_COLORS.subtle)
      pdf.text(
        buildPdfTextLines(pdf, `Avec : ${row.participants || "—"}`, contentWidth - 102, 1, 7.1)[0],
        contentX + 86,
        rowY + 16.2
      )

      rowY += cardHeight + cardGap
    })

    drawPdfFooter({
      pdf,
      contentX,
      contentWidth,
      pageHeight,
      generatedAtLabel,
      pageIndex,
      pageCount: pages.length
    })
  })

  return pdf
}

const TpiSoutenance = () => {
  const { year } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [isOn, setIsOn] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activeMobileFilter, setActiveMobileFilter] = useState("all")
  const [layoutColumns, setLayoutColumns] = useState(1)
  const [pdfOrientationMode, setPdfOrientationMode] = useState("auto")
  const [pdfViewMode, setPdfViewMode] = useState(PDF_VIEW_MODES.GENERAL)

  const {
    token,
    magicLinkToken,
    magicLinkViewer,
    soutenanceData,
    expertOrBoss,
    listOfExpertsOrBoss,
    isLoading,
    error,
    filters,
    filteredData,
    uniqueSalles,
    uniqueDates,
    uniqueSites,
    uniqueCandidates,
    uniqueExperts,
    uniqueProjectManagers,
    loadData,
    updateFilter,
    updateSoutenanceData,
    schedule,
    isFilterApplied,
    aggregatedICalPersonLabel
  } = useSoutenanceData(year)
  const hasMagicLinkPersonalView = Boolean(
    magicLinkToken ||
    magicLinkViewer?.personId ||
    magicLinkViewer?.name
  )
  const magicLinkViewerName = hasMagicLinkPersonalView
    ? getMagicLinkViewerName(magicLinkViewer)
    : ""
  const headerExpertOrBoss = hasMagicLinkPersonalView
    ? {
        name: magicLinkViewerName,
        role: "viewer"
      }
    : expertOrBoss
  const focusReference = String(filters.reference || '').trim()
  const hasFocusedResults = filteredData.length > 0
  const clearFocusQueryParam = () => {
    const params = new URLSearchParams(location.search)
    if (!params.has("focus")) {
      return
    }

    params.delete("focus")
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : ""
      },
      { replace: true }
    )
  }
  const clearFocusedView = () => {
    clearFocusQueryParam()
    updateFilter("reference", "")
  }
  const clearPersonFilters = () => {
    setIsOn(false)
    updateFilter("experts", "")
    updateFilter("projectManagerButton", "")
    updateFilter("projectManager", "")
  }
  const showPersonalView = () => {
    clearFocusQueryParam()
    setIsOn(true)
    PERSONAL_VIEW_RESET_FILTERS.forEach((filterName) => updateFilter(filterName, ""))
  }

  const getResponsiveColumns = (width) => {
    if (width <= 680) {
      return 1
    }

    if (width <= 980) {
      return 2
    }

    if (width <= 1280) {
      return 3
    }

    if (width <= 1660) {
      return 4
    }

    return 5
  }

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 500)

    window.addEventListener("resize", handleResize)
    handleResize()

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  useEffect(() => {
    const updateLayoutColumns = () => {
      setLayoutColumns(getResponsiveColumns(window.innerWidth))
    }

    window.addEventListener("resize", updateLayoutColumns)
    updateLayoutColumns()

    return () => {
      window.removeEventListener("resize", updateLayoutColumns)
    }
  }, [])

  const showEmptySlots = hasMagicLinkPersonalView
    ? false
    : shouldShowEmptySlotsForFilters(filters)
  const totalSlots = filteredData?.reduce(
    (acc, room) => acc + getVisibleRoomSlotCount(room, schedule, showEmptySlots),
    0
  ) || 0
  const exportSlots = useMemo(
    () => buildExportSlots(filteredData, schedule, showEmptySlots),
    [filteredData, schedule, showEmptySlots]
  )
  const rowCount = useMemo(
    () => getPdfExportItemCount(pdfViewMode, exportSlots),
    [pdfViewMode, exportSlots]
  )
  const isPrintEnabled = rowCount > 0
  const isCompactMode = totalSlots > 20
  const personIcalFilter = hasMagicLinkPersonalView
    ? {
        name: magicLinkViewerName,
        role: "viewer"
      }
    : getSinglePersonIcalFilter(filters)
  const effectiveAggregatedICalPersonLabel = hasMagicLinkPersonalView
    ? magicLinkViewerName
    : aggregatedICalPersonLabel

  if (isLoading) {
    return <div>Chargement...</div>
  }
  if (error) {
    return <div>Erreur : {error}</div>
  }

  //Permet d'orienter l'appel du composant React pour la version mobile
  const handleClickFiltersSmartphone = (filter) => {
    setActiveMobileFilter(filter)
  }

  const activeFilterSummary = () => {
    const items = []

    if (filters.date) {
      items.push(`Date : ${filters.date}`)
    }

    if (filters.site) {
      items.push(`Site : ${filters.site}`)
    }

    if (filters.nameRoom) {
      items.push(`Salle : ${filters.nameRoom}`)
    }

    if (filters.classType) {
      const classTypeLabel = getRoomClassFilterLabel(filters.classType)
      if (classTypeLabel) {
        items.push(`Type de classe : ${classTypeLabel}`)
      }
    }

    if (filters.experts) {
      items.push(`Expert : ${filters.experts}`)
    }

    if (filters.projectManager || filters.projectManagerButton) {
      items.push(
        `Chef de projet : ${filters.projectManager || filters.projectManagerButton}`
      )
    }

    if (filters.candidate) {
      items.push(`Candidat : ${filters.candidate}`)
    }

    return items
  }

  const printFilters = activeFilterSummary()
  const getDefaultPdfOrientation = (viewMode, columnCount) => {
    const normalizedViewMode = normalizePdfViewMode(viewMode)

    if (normalizedViewMode === PDF_VIEW_MODES.ROOMS) {
      return "portrait"
    }

    if (normalizedViewMode === PDF_VIEW_MODES.ROOM_GRID) {
      return "landscape"
    }

    if (normalizedViewMode === PDF_VIEW_MODES.PEOPLE) {
      return "landscape"
    }

    return "landscape"
  }
  const getPdfOrientationCandidates = (viewMode, orientationMode, columnCount) => {
    const autoOrientation = getDefaultPdfOrientation(viewMode, columnCount)
    const normalizedMode = String(orientationMode || "auto").toLowerCase()
    const forcedOrientation =
      normalizedMode === "portrait" || normalizedMode === "landscape"
        ? normalizedMode
        : autoOrientation
    const fallbackOrientation =
      forcedOrientation === "landscape" ? "portrait" : "landscape"

    const candidates = [forcedOrientation]
    if (fallbackOrientation !== forcedOrientation) {
      candidates.push(fallbackOrientation)
    }

    return candidates
  }

  const handleGeneratePdf = async (options = {}) => {
    const {
      previewOnly = false,
      forcedOrientation = pdfOrientationMode,
      viewMode = pdfViewMode
    } = options
    const normalizedViewMode = normalizePdfViewMode(viewMode)

    if (!isPrintEnabled) {
      showNotification(`Aucune donnée à exporter pour ${PDF_VIEW_LABELS[normalizedViewMode]}.`, "error")
      return
    }

    if (!rowCount) {
      showNotification(`Aucune donnée à exporter pour ${PDF_VIEW_LABELS[normalizedViewMode]}.`, "error")
      return
    }

    const summaryLabel = buildPdfSummary(printFilters)
    const filename = `${sanitizeFileNamePart(buildExportDocumentTitle(printFilters, year, normalizedViewMode))}.pdf`
    const generatedAt = new Date()
    const generatedAtLabel = `${generatedAt.toLocaleDateString("fr-FR")} à ${generatedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
    const preferredColumnCount = Math.max(1, layoutColumns || 1)
    const orientationCandidates = getPdfOrientationCandidates(
      normalizedViewMode,
      forcedOrientation,
      preferredColumnCount
    )
    const selectedOrientation = orientationCandidates[0]
    const columnDefinitions = getPdfColumnDefinitions(normalizedViewMode, selectedOrientation)
    const exportPayload = buildPdfExportPayload(normalizedViewMode, exportSlots)
    let previewWindow = null

    if (!exportPayload.rowCount) {
      showNotification(`Aucune donnée à exporter pour ${PDF_VIEW_LABELS[normalizedViewMode]}.`, "error")
      return
    }

    if (previewOnly) {
      previewWindow = window.open("about:blank", "_blank")

      if (!previewWindow) {
        showNotification("Impossible d'ouvrir l'aperçu PDF (popup bloquée).", "error")
        return
      }

      try {
        previewWindow.opener = null
        previewWindow.document.title = "Génération du PDF"
        previewWindow.document.body.textContent = "Génération du PDF en cours..."
      } catch (previewWindowError) {
        console.warn("Préparation de l'onglet d'aperçu impossible :", previewWindowError)
      }
    }

    showNotification("Génération du PDF en cours...", "info")
    try {
      const JsPDF = await loadJsPdfConstructor()
      const documentPdf = new JsPDF({
        orientation: selectedOrientation,
        unit: "mm",
        format: "a4",
        compress: true
      })
      let generatedPdf = documentPdf

      if (normalizedViewMode === PDF_VIEW_MODES.ROOMS) {
        generatedPdf = renderRoomPosterPdf({
          pdf: documentPdf,
          sections: exportPayload.sections,
          summaryLabel,
          generatedAtLabel,
          year
        })
      } else if (normalizedViewMode === PDF_VIEW_MODES.ROOM_GRID) {
        generatedPdf = renderRoomGridPdf({
          pdf: documentPdf,
          sections: exportPayload.sections,
          summaryLabel,
          generatedAtLabel,
          year,
          orientation: selectedOrientation,
          layoutColumns: preferredColumnCount
        })
      } else if (normalizedViewMode === PDF_VIEW_MODES.PEOPLE) {
        generatedPdf = renderPeopleSchedulePdf({
          pdf: documentPdf,
          sections: exportPayload.sections,
          summaryLabel,
          generatedAtLabel,
          year
        })
      } else if (exportPayload.isSectioned) {
        exportPayload.sections.forEach((section, sectionIndex) => {
          if (sectionIndex > 0) {
            documentPdf.addPage()
          }

          const docPlan = buildPdfDocumentPlan({
            pdf: documentPdf,
            orientation: selectedOrientation,
            rows: section.rows,
            summaryLabel,
            generatedAtLabel,
            fontSize: normalizedViewMode === PDF_VIEW_MODES.ROOMS ? PDF_MAX_FONT : 8.2,
            columnDefinitions
          })
          generatedPdf = renderPdfDocument({
            docPlan,
            rows: section.rows,
            year,
            generatedAtLabel,
            title: section.title,
            subtitle: section.subtitle,
            summaryLabel,
            viewMode: normalizedViewMode
          })
        })
      } else {
        const docPlan = buildPdfDocumentPlan({
          pdf: documentPdf,
          orientation: selectedOrientation,
          rows: exportPayload.rows,
          summaryLabel,
          generatedAtLabel,
          fontSize: 8.2,
          columnDefinitions
        })
        generatedPdf = renderPdfDocument({
          docPlan,
          rows: exportPayload.rows,
          year,
          generatedAtLabel,
          title: `Export des défenses ${year}`,
          subtitle: PDF_VIEW_LABELS[normalizedViewMode],
          summaryLabel,
          viewMode: normalizedViewMode
        })
      }

      if (previewOnly) {
        try {
          const previewBlob = generatedPdf.output("blob")
          const previewUrl = URL.createObjectURL(previewBlob)
          previewWindow.location.href = previewUrl
          setTimeout(() => URL.revokeObjectURL(previewUrl), 120000)

          showNotification("Aperçu PDF ouvert dans un nouvel onglet.", "success")
        } catch (previewError) {
          console.error("Erreur lors de l'aperçu PDF :", previewError)
          showNotification("Impossible d'ouvrir l'aperçu PDF.", "error")
          return
        }
      } else {
        try {
          generatedPdf.save(filename)
          showNotification("PDF généré avec succès.", "success")
        } catch (downloadError) {
          console.error("Téléchargement PDF natif bloqué, fallback blob.", downloadError)
          const fallbackBlob = generatedPdf.output("blob")
          const fallbackUrl = URL.createObjectURL(fallbackBlob)
          const link = document.createElement("a")
          link.href = fallbackUrl
          link.download = filename
          link.rel = "noopener"
          link.style.display = "none"

          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          setTimeout(() => URL.revokeObjectURL(fallbackUrl), 120000)
          showNotification("PDF généré avec succès.", "success")
        }
      }
    } catch (error) {
      console.error("Erreur lors de la génération PDF :", error)
      if (previewWindow && !previewWindow.closed) {
        previewWindow.close()
      }
      showNotification("Erreur lors de la génération du PDF.", "error")
    }
  }

  return (
    <div className={`tpi-soutenance-page ${isCompactMode ? "is-compact" : ""}`}>
      {isMobile && (
        <Fragment>
          <div className='message-smartphone'>
            <p>
              Vue mobile limitée. Utilisez un ordinateur pour l&apos;agenda complet.
            </p>
          </div>

          {/* Render filters for smartphone */}
          <div className='filters-smartphone'>
            <button
              type='button'
              className='smartphone'
              aria-label='Afficher mes TPI'
              title='Afficher mes TPI'
              onClick={() => handleClickFiltersSmartphone("MesTPI")}
            >
              Mes TPI
            </button>
            <button
              type='button'
              className='smartphone'
              aria-label='Afficher la vue salle et classe'
              title='Afficher la vue salle et classe'
              onClick={() => handleClickFiltersSmartphone("SalleClasse")}
            >
              Salle
              <br />
              Classe
            </button>
          </div>

          {focusReference && (
            <section className={`soutenance-focus-banner ${hasFocusedResults ? "is-ready" : "is-missing"}`}>
              <div>
                <strong>Focus actif: {focusReference}</strong>
                <p>
                  {hasFocusedResults
                    ? "Vue filtrée sur la fiche."
                    : "Aucune défense publiée."}
                </p>
              </div>
              <button
                type='button'
                onClick={clearFocusedView}
                aria-label='Effacer le focus'
                title='Effacer le focus'
              >
                Effacer le focus
              </button>
            </section>
          )}

          {activeMobileFilter === "MesTPI" && (
            <MobileMesTpiFilter
              mesTpi={filteredData}
              hasToken={Boolean(token || hasMagicLinkPersonalView)}
              year={year}
              focusReference={focusReference}
            />
          )}

          {activeMobileFilter === "SalleClasse" && (
            // Rendu pour le filtre 'SalleClasse'
            <MobileRoomFilter
              rooms={filteredData}
              schedule={schedule}
              year={year}
              focusReference={focusReference}
              showEmptySlots={showEmptySlots}
            />
          )}
        </Fragment>
      )}

      {!isMobile && (
        <Fragment>
          <SoutenanceDesktopHeader
            isDemo={isDemo}
            year={year}
            expertOrBoss={headerExpertOrBoss}
            isOn={isOn || hasMagicLinkPersonalView}
            setIsOn={setIsOn}
            updateFilter={updateFilter}
            filters={filters}
            onGeneratePdf={() => handleGeneratePdf()}
            isPrintEnabled={isPrintEnabled}
            uniqueExperts={uniqueExperts}
            uniqueProjectManagers={uniqueProjectManagers}
            uniqueCandidates={uniqueCandidates}
            uniqueDates={uniqueDates}
            uniqueSites={uniqueSites}
            uniqueSalles={uniqueSalles}
            hasToken={Boolean(token || hasMagicLinkPersonalView)}
            onPreviewPdf={() => handleGeneratePdf({ previewOnly: true })}
            pdfOrientationMode={pdfOrientationMode}
            onPdfOrientationModeChange={setPdfOrientationMode}
            pdfViewMode={pdfViewMode}
            onPdfViewModeChange={setPdfViewMode}
            onShowPersonalView={showPersonalView}
          />

          {focusReference && (
            <section className={`soutenance-focus-banner ${hasFocusedResults ? "is-ready" : "is-missing"}`}>
              <div>
                <strong>Focus actif: {focusReference}</strong>
                <p>
                  {hasFocusedResults
                    ? "Vue filtrée sur la fiche."
                    : `Aucune défense publiée ne correspond à ${focusReference} pour ${year}.`}
                </p>
              </div>
              <button
                type='button'
                onClick={clearFocusedView}
                aria-label='Effacer le focus'
                title='Effacer le focus'
              >
                Effacer le focus
              </button>
            </section>
          )}

          <div id='soutenances' className={`soutenances ${isFilterApplied ? "filterActive" : ""}`}>
              <section className='soutenance-main-area'>
              {filteredData.length === 0 ? (
                <div className='soutenance-empty-state'>
                  <strong>Aucune défense à afficher.</strong>
                  <p>
                    {focusReference
                      ? `${focusReference} n'est pas visible avec ces filtres.`
                      : "Aucun résultat pour ces filtres."}
                  </p>
                </div>
              ) : null}

              <RenderRooms
                year={year}
                tpiDatas={filteredData}
                schedule={schedule}
                listOfPerson={listOfExpertsOrBoss}
                aggregatedICalPersonLabel={effectiveAggregatedICalPersonLabel}
                focusReference={focusReference}
                layoutColumns={layoutColumns}
                isAnyFilterApplied={isFilterApplied}
                showEmptySlots={showEmptySlots}
                personIcalFilter={personIcalFilter}
                onClearPersonFilters={hasMagicLinkPersonalView ? undefined : clearPersonFilters}
                loadData={loadData}
                token={token}
                isOn={isOn}
                updateSoutenanceData={updateSoutenanceData}
              />
            </section>
          </div>
        </Fragment>
      )}
    </div>
  )
}
export default TpiSoutenance
