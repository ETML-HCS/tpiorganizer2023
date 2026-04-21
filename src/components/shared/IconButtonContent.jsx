import React from 'react'

const renderIcon = (icon, className) => {
  if (!icon) {
    return null
  }

  if (React.isValidElement(icon)) {
    return React.cloneElement(icon, {
      className: [icon.props.className, className].filter(Boolean).join(' ')
    })
  }

  if (typeof icon === 'function') {
    const Icon = icon
    return <Icon className={className} />
  }

  return icon
}

const IconButtonContent = ({
  label,
  icon,
  iconClassName = 'ui-button-icon',
  showLabel = false,
  labelClassName = 'ui-button-label',
  badge = null,
  badgeClassName = 'ui-button-badge'
}) => (
  <>
    {renderIcon(icon, iconClassName)}
    {showLabel ? (
      <span className={labelClassName}>{label}</span>
    ) : (
      <span className='sr-only'>{label}</span>
    )}
    {badge !== null && badge !== undefined && badge !== '' ? (
      <span className={badgeClassName} aria-hidden='true'>
        {badge}
      </span>
    ) : null}
  </>
)

export default IconButtonContent
