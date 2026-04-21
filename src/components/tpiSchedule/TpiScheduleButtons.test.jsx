import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TpiScheduleButtons from './TpiScheduleButtons'

jest.mock('../../config/appConfig', () => {
  const actual = jest.requireActual('../../config/appConfig')
  return {
    ...actual,
    IS_DEBUG: true
  }
})

jest.mock('../shared/PageToolbar', () => {
  const React = require('react')

  return function MockPageToolbar({ children, actions, meta, tabs, onTabChange }) {
    return (
      <div data-testid="mock-page-toolbar">
        <div data-testid="toolbar-meta">{meta}</div>
        <div data-testid="toolbar-actions">{actions}</div>
        <div data-testid="toolbar-tabs">
          {Array.isArray(tabs)
            ? tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange?.(tab.id)}
                >
                  {tab.label}
                  {tab.badge ? ` ${tab.badge}` : ''}
                </button>
              ))
            : null}
        </div>
        <div data-testid="toolbar-body">{children}</div>
      </div>
    )
  }
})

const baseProps = {
  onToggleEditing: jest.fn(),
  onSave: jest.fn(),
  onSendBD: jest.fn(),
  onExport: jest.fn(),
  onPublish: jest.fn(),
  configData: {},
  onLoadConfig: jest.fn(),
  toggleArrow: jest.fn(),
  isArrowUp: true,
  onFetchConfig: jest.fn(),
  selectedYear: 2024,
  onYearChange: jest.fn(),
  availableYears: [2023, 2024],
  workflowState: 'planning',
  activeSnapshotVersion: null,
  workflowHint: '',
  workflowActionLoading: false,
  pendingWorkflowAction: '',
  validationResult: null,
  onAutomatePlanification: jest.fn(),
  onValidatePlanification: jest.fn(),
  onFreezeSnapshot: jest.fn(),
  onOpenVotes: jest.fn(),
  onOpenVotesWithoutEmails: jest.fn(),
  onRemindVotes: jest.fn(),
  onCloseVotes: jest.fn(),
  onPublishDefinitive: jest.fn(),
  onSendSoutenanceLinks: jest.fn(),
  onOpenVotesTracking: jest.fn(),
  onOpenSoutenances: jest.fn(),
  roomsCount: 4,
  usedTpiCount: 3,
  totalTpiCount: 10,
  tpiCardDetailLevel: 2,
  onTpiCardDetailLevelChange: jest.fn(),
  roomFilters: { site: '', date: '', room: '' },
  roomSiteOptions: ['ETML'],
  roomDateOptions: ['2026-06-10'],
  roomNameOptions: ['A101'],
  roomCatalogBySite: {
    ETML: ['A101', 'B202']
  },
  onGenerateRoomsFromCatalog: jest.fn(),
  soutenanceDates: [
    { date: '2026-06-10' },
    { date: '2026-06-12', classes: ['MATU', 'M'] }
  ],
  onRoomFiltersChange: jest.fn(),
  onClearRoomFilters: jest.fn()
}

function renderButtons(overrideProps = {}) {
  return render(
    <MemoryRouter initialEntries={['/planification']}>
      <TpiScheduleButtons
        {...baseProps}
        {...overrideProps}
      />
    </MemoryRouter>
  )
}

describe('TpiScheduleButtons - Données', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    document.body.innerHTML = '<div id="planning-header-slot"></div>'
    global.FileReader = class MockFileReader {
      readAsText() {
        if (typeof this.onload === 'function') {
          this.onload({ target: { result: '{"rooms":[{"name":"Salle A"}]}' } })
        }
      }
    }
  })

  afterEach(() => {
    document.body.innerHTML = ''
    delete global.FileReader
  })

  test('bascule le mode édition et met à jour le libellé', () => {
    renderButtons()

    expect(screen.getByRole('button', { name: /Données\s+10/i })).toBeInTheDocument()

    const editButton = screen.getByRole('button', { name: /Mode édition/i })
    fireEvent.click(editButton)

    expect(baseProps.onToggleEditing).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Édition activée/i })).toHaveTextContent('3/10')
  })

  test('importe un fichier JSON via le sélecteur', async () => {
    renderButtons()
    const input = screen.getByTestId('planning-file-input')
    const file = new File(['{"rooms":[{"name":"Salle A"}]}'], 'planning.json', {
      type: 'application/json'
    })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(baseProps.onLoadConfig).toHaveBeenCalledWith('{"rooms":[{"name":"Salle A"}]}')
    })
  })

  test('sauvegarde la configuration courante', () => {
    renderButtons()

    fireEvent.click(screen.getByRole('button', { name: /Sauvegarder localement/i }))

    expect(baseProps.onSave).toHaveBeenCalledTimes(1)
  })

  test('exporte la configuration JSON', () => {
    renderButtons()

    fireEvent.click(screen.getByRole('button', { name: /Exporter JSON/i }))

    expect(baseProps.onExport).toHaveBeenCalledTimes(1)
  })

  test('recharge la configuration BDD de l\'année sélectionnée', () => {
    renderButtons({ selectedYear: 2025 })

    fireEvent.click(screen.getByRole('button', { name: /Charger BDD/i }))

    expect(baseProps.onFetchConfig).toHaveBeenCalledWith(2025)
  })

  test('synchronise la configuration vers la BDD', () => {
    renderButtons()

    fireEvent.click(screen.getByRole('button', { name: /Envoyer BDD/i }))

    expect(baseProps.onSendBD).toHaveBeenCalledTimes(1)
  })

  test('déclenche la vérification de planification depuis l onglet Workflow', () => {
    renderButtons()

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))

    fireEvent.click(screen.getByRole('button', { name: /Vérifier/i }))

    expect(baseProps.onValidatePlanification).toHaveBeenCalledTimes(1)
  })

  test('déclenche l automatisation de planification depuis Workflow > Préparation', () => {
    renderButtons()

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('button', { name: /Automatiser planification/i }))

    expect(baseProps.onAutomatePlanification).toHaveBeenCalledTimes(1)
  })

  test('désactive le bouton Vérifier après une validation réussie sans conflit', () => {
    renderButtons({
      validationResult: {
        year: 2024,
        checkedAt: '2026-04-12T10:00:00.000Z',
        summary: {
          issueCount: 0,
          hardConflictCount: 0,
          personOverlapCount: 0,
          roomOverlapCount: 0,
          sequenceViolationCount: 0
        },
        issues: []
      }
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))

    const validatedButton = screen.getByRole('button', { name: /Vérifié/i })
    expect(validatedButton).toBeDisabled()
    expect(validatedButton).toHaveTextContent('Vérifié')
  })

  test('affiche un badge sur Workflow quand des conflits locaux sont détectés', () => {
    renderButtons({ localConflictCount: 10 })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))

    expect(screen.getByRole('button', { name: /Workflow.*10/i })).toBeInTheDocument()
  })

  test('affiche les erreurs détaillées de la validation dans l onglet Workflow', () => {
    renderButtons({
      validationResult: {
        year: 2024,
        checkedAt: '2026-04-12T10:00:00.000Z',
        summary: {
          issueCount: 2,
          hardConflictCount: 2,
          personOverlapCount: 1,
          roomOverlapCount: 0,
          sequenceViolationCount: 1
        },
        issues: [
          {
            type: 'person_overlap',
            message: 'Ada Lovelace est affecté à plusieurs TPI sur le même créneau (TPI-001, TPI-002).'
          },
          {
            type: 'consecutive_limit',
            message: 'Grace Hopper a 5 TPI consécutifs. Une pause d\'un créneau est obligatoire avant de reprendre.'
          }
        ]
      }
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))

    expect(screen.getByText(/Erreurs détectées: 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Ada Lovelace est affecté/i)).toBeInTheDocument()
    expect(screen.getByText(/Grace Hopper a 5 TPI consécutifs/i)).toBeInTheDocument()
  })

  test('mentionne une incompatibilité de salle dans le tooltip de vérification', () => {
    renderButtons({
      validationResult: {
        year: 2024,
        checkedAt: '2026-04-12T10:00:00.000Z',
        summary: {
          issueCount: 1,
          hardConflictCount: 1,
          personOverlapCount: 0,
          roomOverlapCount: 0,
          classMismatchCount: 1,
          sequenceViolationCount: 0
        },
        issues: [
          {
            type: 'room_class_mismatch',
            message: 'TPI-001 est associé à une salle non compatible.'
          }
        ]
      }
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))

    expect(screen.getByRole('button', { name: /Vérifier/i })).toHaveAttribute(
      'title',
      expect.stringContaining('incompatibilité(s) de salle')
    )
  })

  test('affiche le résumé de configuration dans l onglet Salles', () => {
    renderButtons()

    fireEvent.click(screen.getByRole('button', { name: /Salles/i }))

    expect(screen.getByRole('link', { name: /Ouvrir Configuration/i })).toHaveAttribute(
      'href',
      '/configuration'
    )
    expect(screen.getByRole('heading', { name: 'Dates' })).toBeInTheDocument()
    expect(screen.getAllByText('MATU').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Sites' })).toBeInTheDocument()
    expect(screen.getByLabelText('A101')).toBeInTheDocument()
  })

  test('affiche les dates et les salles par site en lecture seule', () => {
    renderButtons()

    fireEvent.click(screen.getByRole('button', { name: /Salles/i }))

    expect(screen.getByLabelText('mer., 10.06.2026')).toBeInTheDocument()
    expect(screen.getByLabelText('ven., 12.06.2026')).toBeInTheDocument()
    expect(
      screen.getByText('ETML', { selector: '.planning-room-site-overview-head strong' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('A101')).toBeInTheDocument()
    expect(screen.getByLabelText('B202')).toBeInTheDocument()
  })

  test('génère les salles de planning depuis la configuration', () => {
    renderButtons()

    fireEvent.click(screen.getByRole('button', { name: /Salles/i }))
    fireEvent.click(screen.getByRole('button', { name: /Créer les rooms du planning/i }))

    expect(baseProps.onGenerateRoomsFromCatalog).toHaveBeenCalledTimes(1)
  })

  test('affiche le bouton focus dans le panneau des salles et déclenche le callback', () => {
    const onToggleRoomsFocusMode = jest.fn()

    renderButtons({
      onToggleRoomsFocusMode
    })

    fireEvent.click(screen.getByRole('button', { name: /Salles\s+4/i }))

    const focusButton = screen.getByTestId('planning-room-focus-toggle')
    expect(focusButton.querySelector('svg')).not.toBeNull()

    fireEvent.click(focusButton)

    expect(onToggleRoomsFocusMode).toHaveBeenCalledTimes(1)
  })

  test('propose la vue 0 et propage le changement de niveau de détail', () => {
    const onTpiCardDetailLevelChange = jest.fn()

    renderButtons({
      onTpiCardDetailLevelChange
    })

    fireEvent.click(screen.getByRole('button', { name: /Salles/i }))

    fireEvent.click(
      screen.getByRole('radio', {
        name: /Identifiants des parties prenantes sur une ligne/i
      })
    )

    expect(onTpiCardDetailLevelChange).toHaveBeenCalledWith(0)
  })

  test('affiche l état actif du mode focus', () => {
    renderButtons({
      isRoomsFocusMode: true
    })

    expect(screen.queryByTestId('planning-room-focus-toggle')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mode édition/i })).not.toBeInTheDocument()
  })

  test('bloque l ouverture des votes si le planning a changé depuis le snapshot', () => {
    renderButtons({
      activeSnapshotVersion: 3,
      roomsHashAtFreeze: 'hash-freeze',
      currentRoomsHash: 'hash-current'
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Vote/i }))

    const openVotesButton = screen.getByRole('button', { name: /^Ouvrir votes$/i })
    expect(openVotesButton).toBeDisabled()
    expect(openVotesButton).toHaveAttribute(
      'title',
      expect.stringContaining('a changé depuis le dernier snapshot')
    )
  })

  test('déclenche l ouverture des votes sans emails en mode debug', () => {
    const onOpenVotesWithoutEmails = jest.fn()

    renderButtons({
      activeSnapshotVersion: 3,
      onOpenVotesWithoutEmails
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Vote/i }))

    const openVotesWithoutEmailsButton = screen.getByRole('button', {
      name: /Ouvrir votes sans emails/i
    })
    fireEvent.click(openVotesWithoutEmailsButton)

    expect(onOpenVotesWithoutEmails).toHaveBeenCalledTimes(1)
  })
})
