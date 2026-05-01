import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  MobileRoomFilter,
  SoutenanceDesktopHeader,
  getRoomClassFilterValue,
  getRoomSlots
} from './TpiSoutenanceParts'

const buildRoom = (name, date, candidat, refTpi = '2163') => ({
  site: 'ETML',
  date,
  name,
  tpiDatas: [
    {
      id: `${name}-tpi-1`,
      refTpi,
      candidat,
      expert1: { name: 'Expert 1' },
      expert2: { name: 'Expert 2' },
      boss: { name: 'Chef de projet' }
    }
  ]
})

describe('MobileRoomFilter', () => {
  test('normalise les badges de salle pour le filtre type de classe', () => {
    expect(getRoomClassFilterValue({ roomClassMode: 'matu' })).toBe('matu')
    expect(getRoomClassFilterValue({ roomClassMode: 'special' })).toBe('special')
    expect(getRoomClassFilterValue({ roomClassMode: null })).toBe('noBadge')
    expect(getRoomClassFilterValue({ roomClassMode: 'nonM' })).toBe('noBadge')
  })

  test('getRoomSlots complète les trous jusqu au nombre total de créneaux', () => {
    const slots = getRoomSlots(
      {
        configSite: {
          breakline: 0,
          tpiTime: 1,
          firstTpiStart: 8,
          numSlots: 3
        },
        tpiDatas: [
          {
            id: 'room-a_1',
            period: 2,
            refTpi: '2163',
            candidat: 'Alice Durand'
          }
        ]
      },
      [
        { startTime: '08:00', endTime: '09:00' },
        { startTime: '09:00', endTime: '10:00' },
        { startTime: '10:00', endTime: '11:00' }
      ]
    )

    expect(slots).toHaveLength(3)
    expect(slots.map((slot) => slot.tpiData?.refTpi || '')).toEqual(['', '2163', ''])
  })

  test('reste stable si la liste des salles se réduit après navigation', () => {
    const rooms = [
      buildRoom('Salle A', '2026-06-10', 'Alice Durand'),
      buildRoom('Salle B', '2026-06-11', 'Bob Martin')
    ]

    const { rerender } = render(
      <MemoryRouter>
        <MobileRoomFilter rooms={rooms} schedule={[]} year={2026} />
      </MemoryRouter>
    )

    expect(screen.getByText('Salle A')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /salle suivante/i }))
    expect(screen.getByText('Salle B')).toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <MobileRoomFilter rooms={[rooms[0]]} schedule={[]} year={2026} />
      </MemoryRouter>
    )

    expect(screen.getByText('Salle A')).toBeInTheDocument()
    expect(screen.queryByText('Salle B')).not.toBeInTheDocument()
  })

  test('affiche le badge MATU quand la salle est marquée matu', () => {
    const rooms = [
      {
        ...buildRoom('Salle SPECIAL', '2026-06-10', 'Alice Durand'),
        roomClassMode: 'matu'
      }
    ]

    render(
      <MemoryRouter>
        <MobileRoomFilter rooms={rooms} schedule={[]} year={2026} />
      </MemoryRouter>
    )

    expect(screen.getByLabelText(/Salle matu/i)).toBeInTheDocument()
  })

  test('affiche le badge SPECIAL quand la salle est marquée spécial', () => {
    const rooms = [
      {
        ...buildRoom('Salle SPECIAL', '2026-06-10', 'Alice Durand'),
        roomClassMode: 'special'
      }
    ]

    render(
      <MemoryRouter>
        <MobileRoomFilter rooms={rooms} schedule={[]} year={2026} />
      </MemoryRouter>
    )

    expect(screen.getByLabelText(/Salle SPECIAL/i)).toBeInTheDocument()
  })

  test('ajoute un lien fiche dans la vue mobile des salles', () => {
    render(
      <MemoryRouter>
        <MobileRoomFilter
          rooms={[buildRoom('Salle A', '2026-06-10', 'Alice Durand', '3001')]}
          schedule={[]}
          year={2026}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: /fiche/i })).toHaveAttribute('href', '/tpi/2026/3001')
  })

  test('masque les créneaux vides dans la vue mobile des salles quand demandé', () => {
    const { container } = render(
      <MemoryRouter>
        <MobileRoomFilter
          rooms={[
            {
              site: 'ETML',
              date: '2026-06-10',
              name: 'Salle A',
              configSite: {
                breakline: 0,
                tpiTime: 1,
                firstTpiStart: 8,
                numSlots: 3
              },
              tpiDatas: [
                {
                  id: 'room-a_1',
                  period: 2,
                  refTpi: '3001',
                  candidat: 'Alice Durand',
                  expert1: { name: 'Expert 1' },
                  expert2: { name: 'Expert 2' },
                  boss: { name: 'Chef de projet' }
                }
              ]
            }
          ]}
          schedule={[
            { startTime: '08:00', endTime: '09:00' },
            { startTime: '09:00', endTime: '10:00' },
            { startTime: '10:00', endTime: '11:00' }
          ]}
          year={2026}
          showEmptySlots={false}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('Alice Durand')).toBeInTheDocument()
    expect(container.querySelectorAll('.tpi-data')).toHaveLength(1)
    expect(container.querySelectorAll('.is-slot-empty')).toHaveLength(0)
  })
})

describe('SoutenanceDesktopHeader', () => {
  const originalRequestFullscreen = Element.prototype.requestFullscreen
  const originalExitFullscreen = document.exitFullscreen
  const originalFullscreenElementDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement')

  const renderHeader = (props = {}) => render(
    <SoutenanceDesktopHeader
      isDemo
      year={2026}
      expertOrBoss={null}
      isOn={false}
      setIsOn={jest.fn()}
      updateFilter={jest.fn()}
      filters={{
        date: '',
        site: '',
        nameRoom: '',
        experts: '',
        projectManager: '',
        classType: '',
        candidate: ''
      }}
      onGeneratePdf={jest.fn()}
      onPreviewPdf={jest.fn()}
      isPrintEnabled
      pdfViewMode='general'
      onPdfViewModeChange={jest.fn()}
      pdfOrientationMode='auto'
      onPdfOrientationModeChange={jest.fn()}
      hasToken={false}
      uniqueExperts={[]}
      uniqueProjectManagers={[]}
      uniqueCandidates={[]}
      uniqueDates={[]}
      uniqueSites={[]}
      uniqueSalles={[]}
      {...props}
    />
  )

  beforeEach(() => {
    Element.prototype.requestFullscreen = jest.fn(() => Promise.resolve())
    document.exitFullscreen = jest.fn(() => Promise.resolve())
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => null
    })
  })

  afterEach(() => {
    Element.prototype.requestFullscreen = originalRequestFullscreen
    document.exitFullscreen = originalExitFullscreen

    if (originalFullscreenElementDescriptor) {
      Object.defineProperty(document, 'fullscreenElement', originalFullscreenElementDescriptor)
    }
  })

  test('affiche un bouton plein écran SVG au-dessus du badge démo', () => {
    renderHeader()

    const button = screen.getByRole('button', { name: /passer en plein écran/i })
    expect(button).toHaveClass('soutenance-hero-fullscreen-action')
    expect(button).toHaveTextContent('')
    expect(button.querySelector('svg')).not.toBeNull()
  })

  test('affiche un titre court sans salutation visiteur', () => {
    renderHeader()

    expect(screen.getByText('Défenses 2026')).toBeInTheDocument()
    expect(screen.queryByText(/bonjour visiteur/i)).not.toBeInTheDocument()
  })

  test('place le badge démo sous le titre', () => {
    renderHeader()

    const title = screen.getByText('Défenses 2026')
    const demoBadge = screen.getByText('Version démo active')
    const heroContent = title.closest('.soutenance-toolbar-hero-content')

    expect(heroContent).not.toBeNull()
    expect(demoBadge.parentElement).toBe(heroContent)
  })

  test('conserve la salutation pour une personne identifiée', () => {
    renderHeader({
      hasToken: true,
      expertOrBoss: { name: 'Alice Martin', role: 'expert' }
    })

    expect(screen.getByText('Bonjour Alice Martin')).toBeInTheDocument()
  })

  test('le bouton Mes TPI d un lien magique rétablit la vue personnelle', () => {
    const onShowPersonalView = jest.fn()

    renderHeader({
      hasToken: true,
      expertOrBoss: { name: 'Alice Martin', role: 'viewer' },
      isOn: true,
      onShowPersonalView,
      filters: {
        date: '10 juin 2026',
        site: 'ETML',
        nameRoom: 'A101',
        classType: 'matu',
        reference: '2163',
        candidate: 'Alice',
        experts: 'Alice Martin',
        projectManagerButton: 'Alice Martin',
        projectManager: 'Alice Martin'
      }
    })

    fireEvent.click(screen.getByRole('button', { name: /mes tpi/i }))

    expect(onShowPersonalView).toHaveBeenCalledTimes(1)
  })

  test('utilise des libellés courts pour les options par défaut des filtres', () => {
    renderHeader()

    expect(screen.getByRole('option', { name: 'Date' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Site' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Salle' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Type' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Expert' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'CDP' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Candidat' })).toBeInTheDocument()
  })

  test('le bouton plein écran demande le plein écran', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: /passer en plein écran/i }))

    expect(Element.prototype.requestFullscreen).toHaveBeenCalledTimes(1)
  })

  test('le bouton plein écran cible la zone des soutenances sans le hero', () => {
    const soutenancesTarget = document.createElement('div')
    soutenancesTarget.id = 'soutenances'
    soutenancesTarget.requestFullscreen = jest.fn(() => Promise.resolve())
    document.body.appendChild(soutenancesTarget)

    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: /passer en plein écran/i }))

    expect(soutenancesTarget.requestFullscreen).toHaveBeenCalledTimes(1)

    soutenancesTarget.remove()
  })

  test('le bouton plein écran quitte le plein écran quand il est actif', () => {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => document.documentElement
    })

    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: /quitter le plein écran/i }))

    expect(document.exitFullscreen).toHaveBeenCalledTimes(1)
  })

  test('permet de filtrer par type de classe', () => {
    const updateFilter = jest.fn()

    renderHeader({ updateFilter })

    const select = screen.getByLabelText(/filtrer par type de classe/i)
    expect(select).toHaveTextContent('MATU')
    expect(select).toHaveTextContent('SPECIAL')
    expect(select).toHaveTextContent('Sans badge')

    fireEvent.change(select, { target: { value: 'special' } })

    expect(updateFilter).toHaveBeenCalledWith('classType', 'special')
  })
})
