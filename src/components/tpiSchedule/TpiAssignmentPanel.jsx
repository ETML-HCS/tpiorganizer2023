import React, { useEffect, useMemo, useState } from "react"
import { useDrag } from "react-dnd"

import { ItemTypes } from "./Constants"
import { readStorageValue, writeStorageValue } from "../../utils/storage"
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DragIcon,
  RefreshIcon,
  SearchIcon
} from "../shared/InlineIcons"

const ASSIGNMENT_PANEL_BODY_ID = "planning-assignment-panel-body"
const ASSIGNMENT_PANEL_COLLAPSED_STORAGE_KEY = "tpiOrganizer.planning.assignmentPanelCollapsed"

const compactText = (value) => {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value).trim()
}

const normalizeSearchText = (value) =>
  compactText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

const getEntrySearchText = (entry = {}) => normalizeSearchText([
  entry.refTpi,
  entry.candidat,
  entry.classe,
  entry.site,
  entry.sujet,
  entry.description,
  entry.tpi?.expert1?.name,
  entry.tpi?.expert2?.name,
  entry.tpi?.boss?.name
].filter(Boolean).join(" "))

const buildOptionList = (entries, key) => Array.from(
  new Set(
    (Array.isArray(entries) ? entries : [])
      .map((entry) => compactText(entry?.[key]))
      .filter(Boolean)
  )
).sort((left, right) => left.localeCompare(right, "fr", {
  numeric: true,
  sensitivity: "base"
}))

const TpiQueueCard = ({ entry, disabled = false }) => {
  const [{ isDragging }, dragRef] = useDrag({
    type: ItemTypes.TPI_CARD,
    item: () => ({
      source: "unassigned",
      tpi: entry.tpi
    }),
    canDrag: !disabled,
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  })

  const refTpi = compactText(entry.refTpi || entry.tpi?.refTpi)
  const candidat = compactText(entry.candidat || entry.tpi?.candidat)
  const classe = compactText(entry.classe || entry.tpi?.classe)
  const site = compactText(entry.site || entry.tpi?.site || entry.tpi?.lieu?.site)
  const subject = compactText(entry.sujet || entry.description || entry.tpi?.sujet || entry.tpi?.description)

  return (
    <div
      ref={dragRef}
      className={`planning-assignment-card ${isDragging ? "is-dragging" : ""} ${disabled ? "is-disabled" : ""}`.trim()}
      role="listitem"
      aria-label={refTpi ? `TPI ${refTpi}` : "TPI sans référence"}
      title={subject || candidat || refTpi}
    >
      <div className="planning-assignment-card-drag" aria-hidden="true">
        <DragIcon />
      </div>
      <div className="planning-assignment-card-main">
        <div className="planning-assignment-card-head">
          <strong>{refTpi || "Sans référence"}</strong>
          {classe ? <span>{classe}</span> : null}
        </div>
        {candidat ? (
          <div className="planning-assignment-card-name">{candidat}</div>
        ) : null}
        <div className="planning-assignment-card-meta">
          {site ? <span>{site}</span> : null}
          {subject ? <span>{subject}</span> : null}
        </div>
      </div>
    </div>
  )
}

const ProblemRow = ({ item }) => (
  <div className={`planning-assignment-problem planning-assignment-problem--${item.type || "issue"}`}>
    <div className="planning-assignment-problem-icon" aria-hidden="true">
      <AlertIcon />
    </div>
    <div>
      <strong>{item.label}</strong>
      {item.detail ? <span>{item.detail}</span> : null}
    </div>
  </div>
)

const TpiAssignmentPanel = ({
  unassignedTpis = [],
  problemItems = [],
  isLoading = false,
  isDragDisabled = false,
  onRefresh = null
}) => {
  const [activeView, setActiveView] = useState("unassigned")
  const [isCollapsed, setIsCollapsed] = useState(
    () => readStorageValue(ASSIGNMENT_PANEL_COLLAPSED_STORAGE_KEY, "false") === "true"
  )
  const [query, setQuery] = useState("")
  const [classFilter, setClassFilter] = useState("")
  const [siteFilter, setSiteFilter] = useState("")

  const classOptions = useMemo(
    () => buildOptionList(unassignedTpis, "classe"),
    [unassignedTpis]
  )
  const siteOptions = useMemo(
    () => buildOptionList(unassignedTpis, "site"),
    [unassignedTpis]
  )

  const filteredUnassignedTpis = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query)
    const normalizedClass = compactText(classFilter)
    const normalizedSite = compactText(siteFilter)

    return (Array.isArray(unassignedTpis) ? unassignedTpis : []).filter((entry) => {
      const matchesQuery = !normalizedQuery || getEntrySearchText(entry).includes(normalizedQuery)
      const matchesClass = !normalizedClass || compactText(entry.classe) === normalizedClass
      const matchesSite = !normalizedSite || compactText(entry.site) === normalizedSite

      return matchesQuery && matchesClass && matchesSite
    })
  }, [classFilter, query, siteFilter, unassignedTpis])

  const activeCount = activeView === "unassigned"
    ? filteredUnassignedTpis.length
    : (Array.isArray(problemItems) ? problemItems.length : 0)

  useEffect(() => {
    writeStorageValue(ASSIGNMENT_PANEL_COLLAPSED_STORAGE_KEY, isCollapsed ? "true" : "false")
  }, [isCollapsed])

  return (
    <aside
      className={`planning-assignment-panel ${isCollapsed ? "planning-assignment-panel--collapsed" : ""}`.trim()}
      data-state={isCollapsed ? "collapsed" : "expanded"}
      aria-label="Placement TPI à traiter"
    >
      <div className="planning-assignment-panel-head">
        <div className="planning-assignment-panel-title">
          <span className="planning-assignment-panel-kicker">Placement</span>
          <h3>TPI à traiter</h3>
        </div>
        <div className="planning-assignment-panel-actions">
          <button
            type="button"
            className="planning-assignment-toggle"
            onClick={() => setIsCollapsed((current) => !current)}
            aria-expanded={!isCollapsed}
            aria-controls={ASSIGNMENT_PANEL_BODY_ID}
            aria-label={isCollapsed ? "Ouvrir Placement TPI à traiter" : "Réduire Placement TPI à traiter"}
            title={isCollapsed ? "Ouvrir Placement TPI à traiter" : "Réduire Placement TPI à traiter"}
          >
            {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
          </button>
          {!isCollapsed && typeof onRefresh === "function" ? (
            <button
              type="button"
              className="planning-assignment-refresh"
              onClick={onRefresh}
              aria-label="Rafraîchir les TPI"
              title="Rafraîchir les TPI"
            >
              <RefreshIcon />
            </button>
          ) : null}
        </div>
      </div>

      {!isCollapsed ? (
        <div id={ASSIGNMENT_PANEL_BODY_ID} className="planning-assignment-panel-body">
          <div className="planning-assignment-tabs" role="tablist" aria-label="Vue TPI">
            <button
              type="button"
              className={activeView === "unassigned" ? "active" : ""}
              onClick={() => setActiveView("unassigned")}
              role="tab"
              aria-selected={activeView === "unassigned"}
            >
              À placer
              <span>{unassignedTpis.length}</span>
            </button>
            <button
              type="button"
              className={activeView === "problems" ? "active" : ""}
              onClick={() => setActiveView("problems")}
              role="tab"
              aria-selected={activeView === "problems"}
            >
              Problèmes
              <span>{Array.isArray(problemItems) ? problemItems.length : 0}</span>
            </button>
          </div>

          {activeView === "unassigned" ? (
            <>
              <div className="planning-assignment-search">
                <SearchIcon aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ref, candidat, classe, sujet"
                  aria-label="Rechercher un TPI à placer"
                />
              </div>
              <div className="planning-assignment-filters">
                <select
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                  aria-label="Filtrer par classe"
                >
                  <option value="">Classes</option>
                  {classOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <select
                  value={siteFilter}
                  onChange={(event) => setSiteFilter(event.target.value)}
                  aria-label="Filtrer par site"
                >
                  <option value="">Sites</option>
                  {siteOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="planning-assignment-list" role="list" aria-label="TPI non attribués">
                {isLoading ? (
                  <div className="planning-assignment-empty">Chargement...</div>
                ) : filteredUnassignedTpis.length > 0 ? (
                  filteredUnassignedTpis.map((entry) => (
                    <TpiQueueCard
                      key={entry.key || entry.refTpi}
                      entry={entry}
                      disabled={isDragDisabled}
                    />
                  ))
                ) : (
                  <div className="planning-assignment-empty">
                    {unassignedTpis.length === 0
                      ? "Tous les TPI planifiables sont attribués."
                      : "Aucun résultat."}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="planning-assignment-list planning-assignment-problems" role="list" aria-label="Problèmes de planification">
              {Array.isArray(problemItems) && problemItems.length > 0 ? (
                problemItems.map((item) => (
                  <ProblemRow key={item.key} item={item} />
                ))
              ) : (
                <div className="planning-assignment-empty">Aucun problème actif.</div>
              )}
            </div>
          )}

          <div className="planning-assignment-panel-foot" role="status">
            {activeView === "unassigned"
              ? `${activeCount}/${unassignedTpis.length} affiché(s)`
              : `${activeCount} problème(s)`}
          </div>
        </div>
      ) : null}
    </aside>
  )
}

export default TpiAssignmentPanel
