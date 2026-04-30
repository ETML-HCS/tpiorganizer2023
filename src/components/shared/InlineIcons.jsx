import React from 'react'

export const buttonIconProps = Object.freeze({
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.95',
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
})

const iconProps = buttonIconProps

export const CalendarIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <rect x='3' y='5' width='18' height='16' rx='3' />
    <path d='M8 3v4M16 3v4M3 10h18' />
  </svg>
)

export const RoomIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M12 21s6-4.2 6-10a6 6 0 0 0-12 0c0 5.8 6 10 6 10z' />
    <circle cx='12' cy='11' r='2.2' />
  </svg>
)

export const RoomAddIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <rect x='4' y='5' width='10' height='14' rx='2' />
    <path d='M9 12h.01' />
    <path d='M18 9v6M15 12h6' />
  </svg>
)

export const PinIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M12 21s6-4.2 6-10a6 6 0 0 0-12 0c0 5.8 6 10 6 10z' />
    <path d='M9.8 10.8h4.4' />
  </svg>
)

export const WrapIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M4 7h10a3 3 0 0 1 3 3v2' />
    <path d='M17 8l2 2-2 2' />
    <path d='M4 17h8a3 3 0 0 0 3-3v-1' />
    <path d='M15 14l2 2-2 2' />
  </svg>
)

export const DragIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01' />
  </svg>
)

export const DocumentIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M7 3h7l4 4v14H7z' />
    <path d='M14 3v5h5' />
  </svg>
)

export const FileTextIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M7 3h7l4 4v14H7z' />
    <path d='M14 3v5h5' />
    <path d='M9 12h6M9 16h4' />
  </svg>
)

export const GestionTpiIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M7 3h7l4 4v14H7z' />
    <path d='M14 3v5h5' />
    <path d='M9 3.8v4.7l2-1.2 2 1.2V3.8' />
    <path d='M9 12h6M9 16h5' />
  </svg>
)

export const FolderIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z' />
  </svg>
)

export const UserIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='12' cy='8' r='3' />
    <path d='M5 19a7 7 0 0 1 14 0' />
  </svg>
)

export const UsersIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='9' cy='8.5' r='2.5' />
    <circle cx='16' cy='9.5' r='2' />
    <path d='M4.5 18.5a5.5 5.5 0 0 1 9 0' />
    <path d='M14 18.5a4.5 4.5 0 0 1 5 0' />
  </svg>
)

export const CandidateIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path
      d='M7 10.6v4.15c1.2 1.3 2.88 1.95 5 1.95s3.8-.65 5-1.95V10.6l-5 2.7-5-2.7Z'
      fill='var(--role-icon-soft, #bfdbfe)'
      stroke='none'
    />
    <path
      d='M12 3.5 2.8 8.2 12 13l9.2-4.8L12 3.5Z'
      fill='var(--role-icon-primary, #60a5fa)'
      stroke='var(--role-icon-stroke, #1d4ed8)'
      strokeWidth='1.35'
      strokeLinejoin='round'
    />
    <path
      d='M5.2 9.45v4.75m13.6-5.95v5.95M7 10.6l5 2.7 5-2.7'
      fill='none'
      stroke='var(--role-icon-stroke, #1d4ed8)'
      strokeWidth='1.45'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <circle cx='18.8' cy='14.2' r='1.15' fill='var(--role-icon-stroke, #1d4ed8)' stroke='none' />
  </svg>
)

export const ExpertIcon = ({ badge, number, ...props }) => {
  const badgeText = badge ?? number

  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
      <path
        d='M5.1 13.55C5.38 9.75 7.75 6.7 10.95 6v4.45h2.1V6c3.2.7 5.57 3.75 5.85 7.55H5.1Z'
        fill='var(--role-icon-soft, #fef08a)'
        stroke='none'
      />
      <path
        d='M4.2 13.3h15.6c.75 0 1.35.6 1.35 1.35S20.55 16 19.8 16H4.2c-.75 0-1.35-.6-1.35-1.35s.6-1.35 1.35-1.35Z'
        fill='var(--role-icon-primary, #facc15)'
        stroke='var(--role-icon-stroke, #854d0e)'
        strokeWidth='1.25'
        strokeLinejoin='round'
      />
      <path
        d='M5.15 13.35C5.5 9.2 8.35 6 12 6s6.5 3.2 6.85 7.35M10.95 6v4.45m2.1-4.45v4.45M4.2 16h15.6'
        fill='none'
        stroke='var(--role-icon-stroke, #854d0e)'
        strokeWidth='1.45'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      {badgeText ? (
        <text
          x='12'
          y='11.25'
          textAnchor='middle'
          dominantBaseline='middle'
          fill='var(--role-icon-stroke, #854d0e)'
          stroke='none'
          fontSize='7.2'
          fontWeight='800'
          fontFamily='Arial, Helvetica, sans-serif'
        >
          {badgeText}
        </text>
      ) : null}
    </svg>
  )
}

export const ProjectLeadIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path
      d='M5.1 13.55C5.38 9.75 7.75 6.7 10.95 6v4.45h2.1V6c3.2.7 5.57 3.75 5.85 7.55H5.1Z'
      fill='var(--role-icon-soft, #fecaca)'
      stroke='none'
    />
    <path
      d='M4.2 13.3h15.6c.75 0 1.35.6 1.35 1.35S20.55 16 19.8 16H4.2c-.75 0-1.35-.6-1.35-1.35s.6-1.35 1.35-1.35Z'
      fill='var(--role-icon-primary, #ef4444)'
      stroke='var(--role-icon-stroke, #7f1d1d)'
      strokeWidth='1.25'
      strokeLinejoin='round'
    />
    <path
      d='M5.15 13.35C5.5 9.2 8.35 6 12 6s6.5 3.2 6.85 7.35M10.95 6v4.45m2.1-4.45v4.45M4.2 16h15.6'
      fill='none'
      stroke='var(--role-icon-stroke, #7f1d1d)'
      strokeWidth='1.45'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
)

export const DashboardIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <rect x='3' y='4' width='7' height='7' rx='2' />
    <rect x='14' y='4' width='7' height='5' rx='2' />
    <rect x='3' y='13' width='5' height='7' rx='2' />
    <rect x='10' y='12' width='11' height='8' rx='2' />
  </svg>
)

export const WorkflowIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='5' cy='6' r='2' />
    <circle cx='12' cy='12' r='2' />
    <circle cx='19' cy='18' r='2' />
    <path d='M7 6h3.5a1.5 1.5 0 0 1 1.5 1.5V10' />
    <path d='M14.5 14h1a2.5 2.5 0 0 1 2.5 2.5V16' />
  </svg>
)

export const ClipboardIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <rect x='6' y='4' width='12' height='16' rx='2' />
    <path d='M9 4.5h6a1 1 0 0 1 1 1V7H8V5.5a1 1 0 0 1 1-1z' />
    <path d='M9 12h6M9 16h4' />
  </svg>
)

export const BriefcaseIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <rect x='3' y='7' width='18' height='12' rx='2' />
    <path d='M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7' />
    <path d='M3 12h18' />
  </svg>
)

export const KeyIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='8' cy='11' r='3' />
    <path d='M11 11h10l-2 2 2 2' />
    <path d='M18 11v3' />
  </svg>
)

export const TestTubeIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M9 3h6' />
    <path d='M10 3v6l-4.5 7.5A3 3 0 0 0 8.1 21h7.8a3 3 0 0 0 2.6-4.5L14 9V3' />
    <path d='M9.5 14h5' />
  </svg>
)

export const TimeIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='12' cy='12' r='8.5' />
    <path d='M12 7.5V12l3 2' />
  </svg>
)

export const CheckIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M20 6 9 17l-5-5' />
  </svg>
)

export const CloseIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='m6 6 12 12M18 6 6 18' />
  </svg>
)

export const AlertIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M10.3 4.8 2.6 18a1.6 1.6 0 0 0 1.4 2.4h16a1.6 1.6 0 0 0 1.4-2.4L13.7 4.8a1.6 1.6 0 0 0-3.4 0z' />
    <path d='M12 9v5' />
    <path d='M12 17h.01' />
  </svg>
)

export const BanIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='12' cy='12' r='8.5' />
    <path d='m8.5 8.5 7 7' />
  </svg>
)

export const QuestionIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='12' cy='12' r='8.5' />
    <path d='M9.7 9.2a2.6 2.6 0 0 1 4.9 1.1c0 1.5-1 2.1-1.9 2.8-.7.5-1.2 1-1.2 1.9' />
    <path d='M12 17h.01' />
  </svg>
)

export const SearchIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='11' cy='11' r='6.5' />
    <path d='m16 16 4 4' />
  </svg>
)

export const RefreshIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M20 11a8 8 0 1 0 1.2 4.3' />
    <path d='M20 4v7h-7' />
  </svg>
)

export const SendIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='m21 3-9 9' />
    <path d='m21 3-6 18-3-9-9-3 18-6Z' />
  </svg>
)

export const MailIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <rect x='3' y='5' width='18' height='14' rx='2.5' />
    <path d='m4.5 7.5 7.5 6 7.5-6' />
  </svg>
)

export const MailOffIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <rect x='3' y='5' width='18' height='14' rx='2.5' />
    <path d='m4.5 7.5 7.5 6 7.5-6' />
    <path d='m4 4 16 16' />
  </svg>
)

export const TrashIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M4 7h16' />
    <path d='M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7' />
    <path d='M8 7l.8 12.2A1.8 1.8 0 0 0 10.6 21h2.8a1.8 1.8 0 0 0 1.8-1.8L16 7' />
    <path d='M10.5 11v5M13.5 11v5' />
  </svg>
)

export const PencilIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z' />
    <path d='m13.5 6.5 4 4' />
    <path d='M4 20l3-1 1 1-1 3z' />
  </svg>
)

export const DownloadIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M12 4v10' />
    <path d='m8.5 10.5 3.5 3.5 3.5-3.5' />
    <path d='M4 18.5h16' />
  </svg>
)

export const UploadIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M12 20V10' />
    <path d='m8.5 13.5 3.5-3.5 3.5 3.5' />
    <path d='M4 5.5h16' />
  </svg>
)

export const PlusIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M12 5v14M5 12h14' />
  </svg>
)

export const SaveIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path
      d='M6.2 4.5h9.3l2.5 2.5v10.8a1.7 1.7 0 0 1-1.7 1.7H7.7A1.7 1.7 0 0 1 6 17.8V6.2a1.7 1.7 0 0 1 .2-.8z'
      fill='currentColor'
      opacity='0.12'
      stroke='none'
    />
    <path d='M6.5 4.5h9.1l2.9 2.9v10.4A1.7 1.7 0 0 1 16.8 19.5H7.2A1.7 1.7 0 0 1 5.5 17.8V6.2A1.7 1.7 0 0 1 7.2 4.5z' />
    <path d='M8.4 4.5v4.2a1 1 0 0 0 1 1h4.8a1 1 0 0 0 1-1V5.3' />
    <rect x='8.2' y='13.2' width='7.6' height='4.3' rx='1.2' />
    <path d='M10 15.4h4' />
  </svg>
)

export const SnowflakeIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M12 3v18M5.6 6.7l12.8 10.6M18.4 6.7 5.6 17.3' />
    <path d='m9.5 3 2.5 2 2.5-2M9.5 21l2.5-2 2.5 2M3.8 8.5l3.2.4-.7 3M20.2 8.5l-3.2.4.7 3M3.8 15.5l3.2-.4-.7-3M20.2 15.5l-3.2-.4.7-3' />
  </svg>
)

export const ArrowRightIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M5 12h14' />
    <path d='m13 7 6 5-6 5' />
  </svg>
)

export const ChevronDownIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='m6 9 6 6 6-6' />
  </svg>
)

export const ChevronRightIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='m9 6 6 6-6 6' />
  </svg>
)

export const ExpandIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M9 4H4v5M15 4h5v5M9 20H4v-5M20 15v5h-5' />
    <path d='m4 9 5-5M15 4l5 5M4 15l5 5M20 15l-5 5' />
  </svg>
)

export const CollapseIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M9 4H4v5M20 4h-5v5M4 20h5v-5M15 20h5v-5' />
    <path d='m9 9-5-5M15 9l5-5M9 15l-5 5M15 15l5 5' />
  </svg>
)

export const InboxIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M4 5h16v10H4z' />
    <path d='M4 15h4l2 3h4l2-3h4' />
  </svg>
)

export const VoteIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M7 11h5' />
    <path d='M9 7l3 4-3 4' />
    <path d='M4 20h16' />
    <path d='M15 7h4v10h-4' />
  </svg>
)

export const StarsIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='m12 4 1.4 2.9 3.2.5-2.3 2.3.5 3.3-2.8-1.5-2.8 1.5.5-3.3-2.3-2.3 3.2-.5z' />
    <path d='m5.5 11 1 2 2.2.3-1.6 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.6-1.6 2.2-.3z' />
    <path d='m18.5 11 1 2 2.2.3-1.6 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.6-1.6 2.2-.3z' />
  </svg>
)

export const ChartIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M5 19V9M12 19V5M19 19v-7M4 19h16' />
  </svg>
)

export const ListIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M8 6h12M8 12h12M8 18h12' />
    <circle cx='4' cy='6' r='0.8' fill='currentColor' stroke='none' />
    <circle cx='4' cy='12' r='0.8' fill='currentColor' stroke='none' />
    <circle cx='4' cy='18' r='0.8' fill='currentColor' stroke='none' />
  </svg>
)

export const RulerIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M4 16 16 4l4 4-12 12H4z' />
    <path d='M11 5.5 13 7.5M8 8.5l2 2M5 11.5l2 2' />
  </svg>
)

export const WrenchIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M14.5 6.5a4 4 0 0 0-5.7 5.4L4 16.7 7.3 20l4.8-4.8a4 4 0 0 0 5.4-5.7l-2.3 2.3-2.5-.2-.2-2.5 2.3-2.3Z' />
  </svg>
)

export const ConfigurationIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <rect x='3' y='5' width='18' height='14' rx='3' />
    <path d='M7 9h10M7 12h10M7 15h10' />
    <circle cx='10' cy='9' r='1.2' fill='currentColor' stroke='none' />
    <circle cx='15' cy='12' r='1.2' fill='currentColor' stroke='none' />
    <circle cx='9' cy='15' r='1.2' fill='currentColor' stroke='none' />
  </svg>
)

export const SettingsIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='12' cy='12' r='3' />
    <path d='M19.4 15a8.8 8.8 0 0 0 .1-6l-2.2-.7a7.8 7.8 0 0 0-1.7-1.7l.7-2.2a8.8 8.8 0 0 0-6-.1l-.7 2.2a7.8 7.8 0 0 0-2.2 0l-.7-2.2a8.8 8.8 0 0 0-6 .1l.7 2.2A7.8 7.8 0 0 0 3.5 8l-2.2.7a8.8 8.8 0 0 0-.1 6l2.2.7c.4.8.9 1.3 1.7 1.7l-.7 2.2a8.8 8.8 0 0 0 6 .1l.7-2.2c.7 0 1.4 0 2.2 0l.7 2.2a8.8 8.8 0 0 0 6-.1l-.7-2.2c.8-.4 1.3-.9 1.7-1.7l2.2-.7Z' />
  </svg>
)
