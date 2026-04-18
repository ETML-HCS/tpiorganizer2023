import React from 'react'

const renderIcon = (Icon, className) => {
  if (!Icon) {
    return null
  }

  if (React.isValidElement(Icon)) {
    return React.cloneElement(Icon, {
      className: [Icon.props.className, className].filter(Boolean).join(' ')
    })
  }

  if (typeof Icon === 'function') {
    const ResolvedIcon = Icon
    return <ResolvedIcon className={className} />
  }

  return null
}

const BinaryToggle = ({
  value,
  onChange,
  name,
  className = '',
  trueLabel,
  falseLabel,
  trueIcon = null,
  falseIcon = null,
  ariaLabel,
  disabled = false,
  iconOnly = false,
  compact = false
}) => {
  const buildOptionClassName = (optionValue) => {
    const optionKey = optionValue ? 'true' : 'false'
    return [
      'page-tools-toggle-option',
      `page-tools-toggle-option--${optionKey}`,
      compact ? 'page-tools-toggle-option--compact' : '',
      iconOnly ? 'page-tools-toggle-option--icon-only' : '',
      value === optionValue ? 'active' : '',
      disabled ? 'disabled' : ''
    ]
      .filter(Boolean)
      .join(' ')
  }

  const renderOption = (optionValue, label, icon) => (
    <label
      className={buildOptionClassName(optionValue)}
      title={iconOnly && label ? label : undefined}
    >
      <input
        type='radio'
        name={name}
        checked={value === optionValue}
        onChange={() => onChange(optionValue)}
        disabled={disabled}
      />
      {renderIcon(icon, 'page-tools-toggle-icon')}
      {label ? (
        <span className={iconOnly ? 'page-tools-toggle-label sr-only' : 'page-tools-toggle-label'}>
          {label}
        </span>
      ) : null}
    </label>
  )

  return (
    <div
      className={['page-tools-toggle', compact ? 'page-tools-toggle--compact' : '', className]
        .filter(Boolean)
        .join(' ')}
      role='radiogroup'
      aria-label={ariaLabel}
    >
      {renderOption(true, trueLabel, trueIcon)}
      {renderOption(false, falseLabel, falseIcon)}
    </div>
  )
}

export default BinaryToggle
