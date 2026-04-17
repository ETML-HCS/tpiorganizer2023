import React from 'react'

const iconProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.8',
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
}

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

export const UserIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='12' cy='8' r='3' />
    <path d='M5 19a7 7 0 0 1 14 0' />
  </svg>
)

export const CandidateIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M4 9l8-4 8 4-8 4-8-4Z' />
    <path d='M8.5 10.8V14c0 1.7 1.9 3 3.5 3s3.5-1.3 3.5-3v-3.2' />
    <path d='M6 11.5v3.8c0 .8.5 1.4 1.2 1.7L12 19l4.8-2c.7-.3 1.2-.9 1.2-1.7v-3.8' />
  </svg>
)

export const ExpertIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='12' cy='8' r='3' />
    <path d='M5.5 19a6.5 6.5 0 0 1 13 0' />
    <path d='M18.5 10.5l1 .7 1-.7-.3 1.2.9.8-1.2.1-.4 1.1-.4-1.1-1.2-.1.9-.8z' />
  </svg>
)

export const ProjectLeadIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M7 7.5V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.5' />
    <path d='M4 9.5h16v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9.5Z' />
    <path d='M9 9.5V8h6v1.5' />
    <path d='M9 13h6' />
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

export const AlertIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M10.3 4.8 2.6 18a1.6 1.6 0 0 0 1.4 2.4h16a1.6 1.6 0 0 0 1.4-2.4L13.7 4.8a1.6 1.6 0 0 0-3.4 0z' />
    <path d='M12 9v5' />
    <path d='M12 17h.01' />
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

export const ListIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M8 6h12M8 12h12M8 18h12' />
    <circle cx='4' cy='6' r='0.8' fill='currentColor' stroke='none' />
    <circle cx='4' cy='12' r='0.8' fill='currentColor' stroke='none' />
    <circle cx='4' cy='18' r='0.8' fill='currentColor' stroke='none' />
  </svg>
)

export const WrenchIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <path d='M14.5 6.5a4 4 0 0 0-5.7 5.4L4 16.7 7.3 20l4.8-4.8a4 4 0 0 0 5.4-5.7l-2.3 2.3-2.5-.2-.2-2.5 2.3-2.3Z' />
  </svg>
)

export const SettingsIcon = (props) => (
  <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false' {...iconProps} {...props}>
    <circle cx='12' cy='12' r='3' />
    <path d='M19.4 15a8.8 8.8 0 0 0 .1-6l-2.2-.7a7.8 7.8 0 0 0-1.7-1.7l.7-2.2a8.8 8.8 0 0 0-6-.1l-.7 2.2a7.8 7.8 0 0 0-2.2 0l-.7-2.2a8.8 8.8 0 0 0-6 .1l.7 2.2A7.8 7.8 0 0 0 3.5 8l-2.2.7a8.8 8.8 0 0 0-.1 6l2.2.7c.4.8.9 1.3 1.7 1.7l-.7 2.2a8.8 8.8 0 0 0 6 .1l.7-2.2c.7 0 1.4 0 2.2 0l.7 2.2a8.8 8.8 0 0 0 6-.1l-.7-2.2c.8-.4 1.3-.9 1.7-1.7l2.2-.7Z' />
  </svg>
)
