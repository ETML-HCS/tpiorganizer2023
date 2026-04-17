import React from "react"
import { Link, useLocation } from "react-router-dom"

const PageToolbar = ({
  id = "tools",
  className = "",
  eyebrow = "",
  title = "",
  description = "",
  meta = null,
  actions = null,
  children = null,
  toggleArrow = null,
  isArrowUp = true,
  ariaLabel = "Outils de page",
  tabs = [],
  activeTab = "",
  onTabChange = null,
  tabListLabel = "Navigation secondaire",
  tabsClassName = "",
  bodyClassName = "",
  navigationLinks = [],
  flatHeader = false,
  collapseLabel = "Réduire les outils",
  expandLabel = "Afficher les outils"
}) => {
  const tabItems = Array.isArray(tabs) ? tabs.filter(Boolean) : []
  const navItems = Array.isArray(navigationLinks) ? navigationLinks.filter(Boolean) : []
  const location = useLocation()
  const hasHeaderCopy = Boolean(eyebrow || title || description)

  const isLinkActive = (link) => {
    if (!link?.to) {
      return false
    }

    const patterns = Array.isArray(link.match)
      ? link.match
      : link.match
        ? [link.match]
        : [link.to]

    return patterns.some((pattern) => {
      if (!pattern) {
        return false
      }

      if (pattern === "/") {
        return location.pathname === "/"
      }

      return pattern.endsWith("/")
        ? location.pathname.startsWith(pattern)
        : location.pathname === pattern
    })
  }

  const handleTabKeyDown = (event, tabIndex) => {
    if (!onTabChange || tabItems.length === 0) {
      return
    }

    let nextIndex = null

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (tabIndex + 1) % tabItems.length
        break
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (tabIndex - 1 + tabItems.length) % tabItems.length
        break
      case "Home":
        nextIndex = 0
        break
      case "End":
        nextIndex = tabItems.length - 1
        break
      default:
        return
    }

    event.preventDefault()

    const nextTab = tabItems[nextIndex]
    if (nextTab && !nextTab.disabled) {
      onTabChange(nextTab.id)
    }
  }

  return (
    <div id={id} className={`page-tools ${className}`.trim()}>
      <div className='page-tools-shell' role='toolbar' aria-label={ariaLabel}>
        {flatHeader ? (
          <div className='page-tools-topline'>
            {hasHeaderCopy ? (
              <>
                {title ? <strong className='page-tools-title'>{title}</strong> : null}
                {description ? (
                  <p className='page-tools-description'>{description}</p>
                ) : null}
              </>
            ) : null}

            {meta ? <div className='page-tools-meta'>{meta}</div> : null}

            {actions ? <div className='page-tools-actions'>{actions}</div> : null}

            {toggleArrow ? (
              <button
                id='upArrowButton'
                type='button'
                className={`collapse-toggle collapse-toggle-mini ${
                  isArrowUp ? "active" : ""
                }`}
                onClick={toggleArrow}
                aria-label={isArrowUp ? collapseLabel : expandLabel}
                aria-expanded={isArrowUp}
                aria-controls={`${id}-body`}
              >
                <span className='collapse-toggle-icon' aria-hidden='true'></span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className='page-tools-header'>
            {hasHeaderCopy ? (
              <>
                {eyebrow ? <span className='page-tools-eyebrow'>{eyebrow}</span> : null}
                {title ? <strong className='page-tools-title'>{title}</strong> : null}
                {description ? (
                  <p className='page-tools-description'>{description}</p>
                ) : null}
              </>
            ) : null}

            {meta ? <div className='page-tools-meta'>{meta}</div> : null}

            {actions ? <div className='page-tools-actions'>{actions}</div> : null}

            {toggleArrow ? (
              <button
                id='upArrowButton'
                type='button'
                className={`collapse-toggle collapse-toggle-mini ${
                  isArrowUp ? "active" : ""
                }`}
                onClick={toggleArrow}
                aria-label={isArrowUp ? collapseLabel : expandLabel}
                aria-expanded={isArrowUp}
                aria-controls={`${id}-body`}
              >
                <span className='collapse-toggle-icon' aria-hidden='true'></span>
              </button>
            ) : null}
          </div>
        )}

        {navItems.length > 0 && isArrowUp ? (
          <div className='page-tools-navigation' role='navigation' aria-label='Navigation rapide'>
            {navItems.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`page-tools-navigation-link ${
                  isLinkActive(link) ? "active" : ""
                }`.trim()}
                title={link.title || link.label}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}

        {tabItems.length > 0 ? (
          <div
            className={`page-tools-tabs ${tabsClassName}`.trim()}
            role='tablist'
            aria-label={tabListLabel}
          >
            {tabItems.map((tab, index) => {
              const isActive = tab.id === activeTab
              const isDisabled = Boolean(tab.disabled || !onTabChange)

              return (
                <button
                  key={tab.id}
                  id={`${id}-tab-${tab.id}`}
                  type='button'
                  role='tab'
                  className={`page-tools-tab ${isActive ? 'active' : ''}`.trim()}
                  aria-selected={isActive}
                  aria-controls={`${id}-panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  disabled={isDisabled}
                  title={tab.title || tab.label}
                  onClick={() => {
                    if (!isDisabled) {
                      onTabChange(tab.id)
                    }
                  }}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  {tab.icon ? (
                    <span className='page-tools-tab-icon' aria-hidden='true'>
                      {tab.icon}
                    </span>
                  ) : null}
                  <span className='page-tools-tab-label'>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge !== null && tab.badge !== '' ? (
                    <span className='page-tools-tab-badge'>{tab.badge}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : null}

        {isArrowUp ? (
          <div id={`${id}-body`} className={`page-tools-body ${bodyClassName}`.trim()}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default PageToolbar
