import React from "react"
import {
  Link,
  UNSAFE_LocationContext as LocationContext,
  useInRouterContext
} from "react-router-dom"
import { ChevronDownIcon } from "./InlineIcons"

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
  navigationMode = "body",
  flatHeader = false,
  collapseLabel = "Réduire les outils",
  expandLabel = "Afficher les outils",
  hideWhenEmpty = true
}) => {
  const tabItems = Array.isArray(tabs) ? tabs.filter(Boolean) : []
  const navItems = Array.isArray(navigationLinks) ? navigationLinks.filter(Boolean) : []
  const bodyItems = React.Children.toArray(children).filter(
    (child) => child !== null && child !== false && child !== ''
  )
  const isInRouter = useInRouterContext()
  const routerLocation = React.useContext(LocationContext)?.location
  const pathname = routerLocation?.pathname || ""
  const hasHeaderCopy = Boolean(eyebrow || title || description)
  const hasMeta = Boolean(meta)
  const hasActions = Boolean(actions)
  const hasBodyContent = bodyItems.length > 0
  const hasHeaderSection = Boolean(hasHeaderCopy || hasMeta || hasActions || toggleArrow)
  const hasNavigation = navItems.length > 0
  const hasTabs = tabItems.length > 0
  const shouldRenderBody = isArrowUp && hasBodyContent
  const shouldRenderNavigation = hasNavigation && isArrowUp && isInRouter
  const shouldRenderNavigationInHeader =
    shouldRenderNavigation && navigationMode === "header" && hasHeaderSection
  const shouldRenderNavigationStandalone =
    shouldRenderNavigation && !shouldRenderNavigationInHeader
  const hasToolbarContent = hasHeaderSection || hasTabs || shouldRenderNavigation || hasBodyContent

  React.useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    const notifyLayoutChange = () => {
      window.dispatchEvent(new Event("tpi:page-toolbar-layout"))
    }
    const animationFrameId = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame(notifyLayoutChange)
      : null

    notifyLayoutChange()

    return () => {
      if (
        animationFrameId !== null &&
        typeof window.cancelAnimationFrame === "function"
      ) {
        window.cancelAnimationFrame(animationFrameId)
      }
      notifyLayoutChange()
    }
  }, [
    activeTab,
    bodyItems.length,
    className,
    hasHeaderSection,
    id,
    isArrowUp,
    navItems.length,
    tabItems.length
  ])

  if (hideWhenEmpty && !hasToolbarContent) {
    return null
  }

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
        return pathname === "/"
      }

      return pattern.endsWith("/")
        ? pathname.startsWith(pattern)
        : pathname === pattern
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

  const toolbarClassName = [
    "page-tools",
    className,
    hasNavigation && navigationMode === "floating" ? "page-tools--nav-floating" : "",
    hasNavigation && navigationMode === "header" ? "page-tools--nav-header" : "",
    !hasHeaderCopy ? "page-tools--headerless" : "",
    !hasBodyContent ? "page-tools--bodyless" : "",
    !hasTabs ? "page-tools--tabless" : "",
    !hasNavigation ? "page-tools--navless" : ""
  ]
    .filter(Boolean)
    .join(" ")

  const renderNavigation = (extraClassName = "") => (
    <div
      className={`page-tools-navigation ${extraClassName}`.trim()}
      role='navigation'
      aria-label='Navigation rapide'
    >
      {navItems.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className={`page-tools-navigation-link ${isLinkActive(link) ? "active" : ""}`.trim()}
          title={link.title || link.label}
        >
          {link.label}
        </Link>
      ))}
    </div>
  )

  return (
    <div
      id={id}
      className={toolbarClassName}
      data-page-toolbar='true'
      style={{ display: isArrowUp ? "block" : "none" }}
    >
      <div className='page-tools-shell' role='toolbar' aria-label={ariaLabel}>
        {hasHeaderSection && flatHeader ? (
          <div className='page-tools-topline'>
            {hasHeaderCopy ? (
              <>
                {title ? <strong className='page-tools-title'>{title}</strong> : null}
                {description ? (
                  <p className='page-tools-description'>{description}</p>
                ) : null}
              </>
            ) : null}

            {shouldRenderNavigationInHeader ? renderNavigation("page-tools-navigation--header") : null}

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
                <span className='collapse-toggle-icon' aria-hidden='true'>
                  <ChevronDownIcon />
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        {hasHeaderSection && !flatHeader ? (
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

            {shouldRenderNavigationInHeader ? renderNavigation("page-tools-navigation--header") : null}

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
                <span className='collapse-toggle-icon' aria-hidden='true'>
                  <ChevronDownIcon />
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        {shouldRenderNavigationStandalone ? renderNavigation() : null}

        {hasTabs ? (
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

        {shouldRenderBody ? (
          <div id={`${id}-body`} className={`page-tools-body ${bodyClassName}`.trim()}>
            {bodyItems}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default PageToolbar
