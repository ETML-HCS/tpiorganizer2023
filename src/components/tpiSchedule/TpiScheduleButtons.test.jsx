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
  onDeleteAllRooms: jest.fn(),
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
  onOpenVoteAccessPreview: jest.fn(),
  onRemindVotes: jest.fn(),
  onCloseVotes: jest.fn(),
  onPublishDefinitive: jest.fn(),
  onDeactivatePublication: jest.fn(),
  workflowPhases: {
    planning: { active: true },
    votes: { active: false },
    arbitrage: { active: false },
    defenses: { active: false }
  },
  onWorkflowPhaseToggle: jest.fn(),
  onSendSoutenanceLinks: jest.fn(),
  onGenerateStaticPublication: jest.fn(),
  onPreviewStaticPublication: jest.fn(),
  onPublishStaticPublication: jest.fn(),
  staticPublicationInfo: null,
  onGenerateStaticVotePublication: jest.fn(),
  onPublishStaticVotePublication: jest.fn(),
  onSyncStaticVotePublication: jest.fn(),
  staticVotePublicationInfo: null,
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
  onShowNewRoomForm: jest.fn(),
  onCreateRoom: jest.fn(),
  onCancelCreateRoom: jest.fn(),
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

  test('affiche la suppression complète uniquement en mode édition', () => {
    renderButtons()

    expect(screen.queryByRole('button', { name: /Supprimer tout/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Mode édition/i }))
    fireEvent.click(screen.getByRole('button', { name: /Supprimer tout/i }))

    expect(baseProps.onDeleteAllRooms).toHaveBeenCalledTimes(1)
  })

  test('importe un fichier JSON via le sélecteur', async () => {
    renderButtons()
    const input = screen.getByTestId('planning-file-input')
    const file = new File(['{"rooms":[{"name":"Salle A"}]}'], 'planification.json', {
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

  test('permet d activer et désactiver une phase depuis le menu Phases', () => {
    const onWorkflowPhaseToggle = jest.fn()
    renderButtons({ onWorkflowPhaseToggle })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Phases/i }))
    fireEvent.click(screen.getByRole('button', { name: /Activer Votes/i }))

    expect(onWorkflowPhaseToggle).toHaveBeenCalledWith('votes', true)
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

  test('affiche les overrides de contraintes comme avertissements non bloquants', () => {
    renderButtons({
      validationResult: {
        year: 2024,
        checkedAt: '2026-04-12T10:00:00.000Z',
        summary: {
          issueCount: 0,
          hardConflictCount: 0,
          warningCount: 1,
          isValid: true
        },
        issues: [
          {
            type: 'consecutive_limit',
            severity: 'warning',
            isConstraintOverride: true,
            message: 'Grace Hopper a 5 TPI consécutifs, contrainte indiquée sur la carte.'
          }
        ]
      }
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))

    expect(screen.getByText(/Avertissements: 1/i)).toBeInTheDocument()
    expect(screen.getByText(/Grace Hopper a 5 TPI consécutifs/i)).toBeInTheDocument()
    expect(screen.queryByText(/Erreurs détectées/i)).not.toBeInTheDocument()
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

  test('propose les filtres compacts dans l en-tête', () => {
    const onRoomFiltersChange = jest.fn()

    renderButtons({ onRoomFiltersChange })

    fireEvent.click(screen.getByLabelText('Filtres de planification'))
    fireEvent.change(screen.getByLabelText('Filtrer par date'), {
      target: { value: '2026-06-10' }
    })

    expect(onRoomFiltersChange).toHaveBeenCalledWith({ date: '2026-06-10' })
  })

  test('réinitialise les filtres compacts depuis l en-tête', () => {
    const onClearRoomFilters = jest.fn()

    renderButtons({
      roomFilters: { site: '', date: '2026-06-10', room: '' },
      onClearRoomFilters
    })

    fireEvent.click(screen.getByLabelText(/1 filtre actif/i))
    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser les filtres/i }))

    expect(onClearRoomFilters).toHaveBeenCalledTimes(1)
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

  test('génère les salles de planification depuis la configuration', () => {
    renderButtons()

    fireEvent.click(screen.getByRole('button', { name: /Salles/i }))
    fireEvent.click(screen.getByRole('button', { name: /Créer les rooms de la planification/i }))

    expect(baseProps.onGenerateRoomsFromCatalog).toHaveBeenCalledTimes(1)
  })

  test('ouvre le formulaire de création d une room manuelle', () => {
    renderButtons()

    fireEvent.click(screen.getByRole('button', { name: /Salles/i }))
    fireEvent.click(screen.getByRole('button', { name: /Créer une room/i }))

    expect(baseProps.onShowNewRoomForm).toHaveBeenCalledTimes(1)
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

    const densityGroup = screen.getByRole('radiogroup', {
      name: /Niveau de détail des cartes TPI/i
    })
    expect(document.querySelector('.planning-room-form-head-actions')).toContainElement(
      densityGroup
    )
    expect(document.querySelector('.planning-room-form-head-actions')?.firstElementChild).toBe(
      densityGroup
    )
    expect(screen.queryByText('Cartes')).not.toBeInTheDocument()

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

  test('avertit sans bloquer l ouverture des votes si la planification a changé depuis le snapshot', () => {
    renderButtons({
      activeSnapshotVersion: 3,
      roomsHashAtFreeze: 'hash-freeze',
      currentRoomsHash: 'hash-current'
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Vote/i }))

    const openVotesButton = screen.getByRole('button', { name: /^Ouvrir votes$/i })
    expect(openVotesButton).toBeEnabled()
    expect(openVotesButton).toHaveAttribute(
      'title',
      expect.stringContaining('confirmation admin')
    )
  })

  test('avertit sans bloquer l ouverture des votes si la verification courante contient des anomalies', () => {
    renderButtons({
      activeSnapshotVersion: 3,
      validationResult: {
        year: 2024,
        checkedAt: '2026-04-12T10:00:00.000Z',
        summary: {
          issueCount: 2,
          hardConflictCount: 2,
          isValid: false
        },
        issues: [
          {
            type: 'legacy_tpi_missing_reference',
            message: 'TPI sans référence exploitable.'
          }
        ]
      }
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Vote/i }))

    const openVotesButton = screen.getByRole('button', { name: /^Ouvrir votes$/i })
    expect(openVotesButton).toBeEnabled()
    expect(openVotesButton).toHaveAttribute(
      'title',
      expect.stringContaining('confirmation admin')
    )
  })

  test('déclenche l ouverture des votes sans emails', () => {
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

  test('permet la publication directe quand la planification est gelée et valide', () => {
    const onPublishDefinitive = jest.fn()

    renderButtons({
      activeSnapshotVersion: 3,
      onPublishDefinitive
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Finalisation/i }))

    const publishButton = screen.getByRole('button', {
      name: /Publier défenses/i
    })
    expect(publishButton).toBeEnabled()

    fireEvent.click(publishButton)

    expect(onPublishDefinitive).toHaveBeenCalledTimes(1)
  })

  test('permet de desactiver la publication pour revenir aux votes', () => {
    const onDeactivatePublication = jest.fn()

    renderButtons({
      workflowState: 'published',
      onDeactivatePublication
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Finalisation/i }))

    const deactivateButton = screen.getByRole('button', {
      name: /Désactiver défenses/i
    })
    expect(deactivateButton).toBeEnabled()

    fireEvent.click(deactivateButton)

    expect(onDeactivatePublication).toHaveBeenCalledTimes(1)
  })

  test('affiche la publication statique après Finalisation dans le workflow', () => {
    renderButtons({
      staticPublicationInfo: {
        available: true,
        generatedAt: '2026-05-01T10:00:00.000Z',
        publicUrl: 'https://tpi26.ch/defenses/2026/'
      }
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Page statique/i }))

    expect(screen.getByText(/Page publique statique/i)).toBeInTheDocument()
    expect(screen.getByText(/Dernière génération:/i)).toBeInTheDocument()
    expect(screen.getByText(/Publication FTP: en attente/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Générer page statique/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Prévisualiser/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Publier sur tpi26\.ch/i })).toBeEnabled()
  })

  test('déclenche les actions de publication statique', () => {
    renderButtons({
      staticPublicationInfo: {
        available: true,
        generatedAt: '2026-05-01T10:00:00.000Z',
        publicUrl: 'https://tpi26.ch/defenses/2026/'
      }
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Page statique/i }))

    fireEvent.click(screen.getByRole('button', { name: /Générer page statique/i }))
    fireEvent.click(screen.getByRole('button', { name: /Prévisualiser/i }))
    fireEvent.click(screen.getByRole('button', { name: /Publier sur tpi26\.ch/i }))

    expect(baseProps.onGenerateStaticPublication).toHaveBeenCalledTimes(1)
    expect(baseProps.onPreviewStaticPublication).toHaveBeenCalledTimes(1)
    expect(baseProps.onPublishStaticPublication).toHaveBeenCalledTimes(1)
  })

  test('affiche et déclenche les actions du mini-site vote dans la page statique', () => {
    renderButtons({
      staticVotePublicationInfo: {
        available: true,
        generatedAt: '2026-05-01T10:00:00.000Z',
        publicUrl: 'https://tpi26.ch/votes-2026/',
        syncSecretConfigured: true,
        siteSyncSecretConfigured: true
      }
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Page statique/i }))

    expect(screen.getByText(/Mini-site vote/i)).toBeInTheDocument()
    expect(screen.getByText(/Dernière génération vote:/i)).toBeInTheDocument()
    expect(screen.getByText(/Publication FTP vote: en attente/i)).toBeInTheDocument()
    expect(screen.getByText(/Secret sync local configuré/i)).toBeInTheDocument()
    expect(screen.getByText(/Secret sync inclus dans le site généré/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Générer vote web/i }))
    fireEvent.click(screen.getByRole('button', { name: /Liens vote/i }))
    fireEvent.click(screen.getByRole('button', { name: /Publier vote sur tpi26\.ch/i }))
    fireEvent.click(screen.getByRole('button', { name: /Sync vote web/i }))

    expect(baseProps.onGenerateStaticVotePublication).toHaveBeenCalledTimes(1)
    expect(baseProps.onOpenVoteAccessPreview).toHaveBeenCalledTimes(1)
    expect(baseProps.onPublishStaticVotePublication).toHaveBeenCalledTimes(1)
    expect(baseProps.onSyncStaticVotePublication).toHaveBeenCalledTimes(1)
  })

  test('affiche la réussite de publication statique FTP', () => {
    renderButtons({
      staticPublicationInfo: {
        available: true,
        generatedAt: '2026-05-01T10:00:00.000Z',
        publishedAt: '2026-05-01T10:05:00.000Z',
        publicUrl: 'https://tpi26.ch/defenses/2026/'
      }
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Page statique/i }))

    expect(screen.getByText(/Publication FTP réussie:/i)).toBeInTheDocument()
    expect(screen.getByText(/URL publique: https:\/\/tpi26\.ch\/defenses\/2026\//i)).toBeInTheDocument()
  })

  test('affiche l échec de la dernière publication statique FTP', () => {
    renderButtons({
      staticPublicationInfo: {
        available: true,
        generatedAt: '2026-05-01T10:00:00.000Z',
        lastPublishStatus: 'error',
        lastPublishMessage: 'Configuration FTP incomplete.',
        lastPublishAt: '2026-05-01T10:06:00.000Z',
        publicUrl: 'https://tpi26.ch/defenses/2026/'
      }
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Page statique/i }))

    expect(screen.getByText(/Publication FTP échouée/i)).toBeInTheDocument()
    expect(screen.getByText(/Configuration FTP incomplete\./i)).toBeInTheDocument()
  })

  test('déclenche l aperçu des liens de vote', () => {
    const onOpenVoteAccessPreview = jest.fn()

    renderButtons({
      workflowState: 'voting_open',
      onOpenVoteAccessPreview
    })

    fireEvent.click(screen.getByRole('button', { name: /Workflow/i }))
    fireEvent.click(screen.getByRole('tab', { name: /Vote/i }))

    const previewButton = screen.getByRole('button', {
      name: /Aperçu des liens vote/i
    })
    fireEvent.click(previewButton)

    expect(onOpenVoteAccessPreview).toHaveBeenCalledTimes(1)
  })
})
