import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import TpiSoutenance from './TpiSoutenance'
import { useSoutenanceData } from './useSoutenanceData'

jest.mock('../Tools', () => ({
  showNotification: jest.fn()
}))

jest.mock('jspdf', () => {
  const mockSave = jest.fn()
  const mockOutput = jest.fn()

  class MockJsPDF {
    constructor(options = {}) {
      this.options = options
      this.pages = [1]
      this.internal = {
        pageSize: {
          getWidth: () => (options.orientation === 'landscape' ? 297 : 210),
          getHeight: () => (options.orientation === 'landscape' ? 210 : 297)
        },
        getNumberOfPages: () => this.pages.length
      }
    }

    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setFillColor() {}
    rect() {}
    roundedRect() {}
    setDrawColor() {}
    setLineWidth() {}
    line() {}
    text() {}
    getTextWidth(text) {
      return String(text || '').length * 2.8
    }
    addPage() {
      this.pages.push(1)
    }
    splitTextToSize(text) {
      return String(text || '').match(/.{1,18}/g) || ['']
    }
    output(type) {
      mockOutput(type)
      return new Blob(['pdf'], { type: 'application/pdf' })
    }
    save(filename) {
      mockSave(filename)
    }
  }

  return {
    jsPDF: MockJsPDF,
    __mockOutput: mockOutput,
    __mockSave: mockSave
  }
})

jest.mock('./useSoutenanceData', () => ({
  useSoutenanceData: jest.fn()
}))

const mockRenderRooms = jest.fn(() => <div>Rooms</div>)

jest.mock('./TpiSoutenanceRooms', () => (props) => mockRenderRooms(props))

jest.mock('./TpiSoutenanceParts', () => ({
  MobileMesTpiFilter: () => <div>Mobile mes TPI</div>,
  MobileRoomFilter: () => <div>Mobile salles</div>,
  SoutenanceDesktopHeader: ({
    onGeneratePdf,
    onPreviewPdf,
    isPrintEnabled,
    pdfViewMode,
    onPdfViewModeChange,
    onShowPersonalView
  }) => (
    <div>
      <select
        aria-label='Vue PDF'
        value={pdfViewMode}
        onChange={(event) => onPdfViewModeChange(event.target.value)}
      >
        <option value='general'>Vue générale</option>
        <option value='rooms'>Par salle</option>
        <option value='roomGrid'>Planning salles</option>
        <option value='people'>Par expert/CDP</option>
      </select>
      <button type='button' onClick={onPreviewPdf} disabled={!isPrintEnabled}>
        Prévisualiser le PDF
      </button>
      <button type='button' onClick={onGeneratePdf} disabled={!isPrintEnabled}>
        Générer le PDF
      </button>
      {onShowPersonalView ? (
        <button type='button' onClick={onShowPersonalView}>
          Mes TPI
        </button>
      ) : null}
    </div>
  ),
  formatDate: () => '10 juin 2026',
  formatTimeRange: (startTime, endTime) => (
    startTime && endTime ? `${startTime} - ${endTime}` : 'Horaire indisponible'
  ),
  getDisplayedSlot: () => ({ startTime: '08:00', endTime: '08:45' }),
  getRoomClassLabel: (room) => (
    room?.roomClassMode === 'matu'
      ? 'matu'
      : room?.roomClassMode === 'special'
        ? 'SPECIAL'
        : ''
  ),
  getRoomClassFilterLabel: (value) => (
    value === 'matu'
      ? 'MATU'
      : value === 'special'
        ? 'SPECIAL'
        : value === 'noBadge'
          ? 'Sans badge'
          : ''
  ),
  getRoomSchedule: () => [],
  getRoomSlotCount: (room) => room?.tpiDatas?.length || 0,
  getRoomSlots: (room) => (
    (room?.tpiDatas || []).map((tpiData) => ({
      tpiData,
      displayedSlot: { startTime: '08:00', endTime: '08:45' }
    }))
  ),
  renderSchedule: jest.fn(() => <div>Schedule</div>)
}))

describe('TpiSoutenance focus UX', () => {
  const defaultFilters = {
    site: '',
    date: '',
    reference: '',
    candidate: '',
    experts: '',
    projectManagerButton: '',
    projectManager: '',
    classType: '',
    nameRoom: ''
  }

  const buildHookData = (overrides = {}) => {
    const room = {
      site: 'ETML',
      date: '2026-06-10',
      name: 'A101',
      tpiDatas: [
        {
          refTpi: '2163',
          candidat: 'Alice',
          expert1: { name: 'Expert 1' },
          expert2: { name: 'Expert 2' },
          boss: { name: 'Chef de projet' }
        }
      ]
    }

    return {
      token: '',
      magicLinkViewer: null,
      soutenanceData: [room],
      expertOrBoss: null,
      listOfExpertsOrBoss: [],
      isLoading: false,
      error: null,
      filters: defaultFilters,
      filteredData: [room],
      uniqueSalles: [],
      uniqueDates: [],
      uniqueSites: [],
      uniqueCandidates: [],
      uniqueExperts: [],
      uniqueProjectManagers: [],
      loadData: jest.fn(),
      updateFilter: jest.fn(),
      updateSoutenanceData: jest.fn(),
      schedule: [],
      displayedSchedule: [],
      isFilterApplied: false,
      aggregatedICalPersonLabel: '',
      ...overrides
    }
  }

  const renderSoutenance = (hookData) => {
    useSoutenanceData.mockReturnValue(hookData)

    render(
      <MemoryRouter initialEntries={['/defenses/2026']}>
        <Routes>
          <Route path='/defenses/:year' element={<TpiSoutenance />} />
        </Routes>
      </MemoryRouter>
    )
  }

  const getLastRenderRoomsProps = () =>
    mockRenderRooms.mock.calls[mockRenderRooms.mock.calls.length - 1][0]

  beforeEach(() => {
    useSoutenanceData.mockReset()
    mockRenderRooms.mockClear()
    require('jspdf').__mockSave.mockClear()
    require('jspdf').__mockOutput.mockClear()
    window.innerWidth = 1200
  })

  test('affiche une bannière de focus et un état vide explicite quand aucune défense ne correspond', async () => {
    useSoutenanceData.mockReturnValue({
      token: '',
      magicLinkViewer: null,
      soutenanceData: [],
      expertOrBoss: null,
      listOfExpertsOrBoss: [],
      isLoading: false,
      error: null,
      filters: {
        site: '',
        date: '',
        reference: '2163',
        candidate: '',
        experts: '',
        projectManagerButton: '',
        projectManager: '',
        nameRoom: ''
      },
      filteredData: [],
      uniqueSalles: [],
      uniqueDates: [],
      uniqueSites: [],
      uniqueCandidates: [],
      uniqueExperts: [],
      uniqueProjectManagers: [],
      loadData: jest.fn(),
      updateFilter: jest.fn(),
      updateSoutenanceData: jest.fn(),
      schedule: [],
      displayedSchedule: [],
      isFilterApplied: true
    })

    render(
      <MemoryRouter initialEntries={['/defenses/2026?focus=2163']}>
        <Routes>
          <Route path='/defenses/:year' element={<TpiSoutenance />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/focus actif: 2163/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/aucune défense à afficher/i)).toBeInTheDocument()
    expect(screen.getByText(/2163 n'est pas visible avec ces filtres/i)).toBeInTheDocument()
  })

  test('permet d effacer le focus courant', async () => {
    const updateFilter = jest.fn()

    useSoutenanceData.mockReturnValue({
      token: '',
      magicLinkViewer: null,
      soutenanceData: [
        {
          site: 'ETML',
          date: '2026-06-10',
          name: 'A101',
          tpiDatas: [{ refTpi: '2163', candidat: 'Alice' }]
        }
      ],
      expertOrBoss: null,
      listOfExpertsOrBoss: [],
      isLoading: false,
      error: null,
      filters: {
        site: '',
        date: '',
        reference: '2163',
        candidate: '',
        experts: '',
        projectManagerButton: '',
        projectManager: '',
        nameRoom: ''
      },
      filteredData: [
        {
          site: 'ETML',
          date: '2026-06-10',
          name: 'A101',
          tpiDatas: [{ refTpi: '2163', candidat: 'Alice' }]
        }
      ],
      uniqueSalles: [],
      uniqueDates: [],
      uniqueSites: [],
      uniqueCandidates: [],
      uniqueExperts: [],
      uniqueProjectManagers: [],
      loadData: jest.fn(),
      updateFilter,
      updateSoutenanceData: jest.fn(),
      schedule: [],
      displayedSchedule: [],
      isFilterApplied: true
    })

    render(
      <MemoryRouter initialEntries={['/defenses/2026?focus=2163']}>
        <Routes>
          <Route path='/defenses/:year' element={<TpiSoutenance />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /effacer le focus/i }))

    expect(updateFilter).toHaveBeenCalledWith('reference', '')
  })

  test('génère le PDF depuis le bouton desktop même avec plusieurs pages', async () => {
    const { __mockSave } = require('jspdf')
    const tpiDatas = Array.from({ length: 45 }, (_, index) => ({
      refTpi: `${2100 + index}`,
      candidat: `Candidate ${index}`,
      expert1: { name: `Expert A ${index}` },
      expert2: { name: `Expert B ${index}` },
      boss: { name: `Chef ${index}` }
    }))

    useSoutenanceData.mockReturnValue({
      token: '',
      magicLinkViewer: null,
      soutenanceData: [
        {
          site: 'ETML',
          date: '2026-06-10',
          name: 'A101',
          tpiDatas
        }
      ],
      expertOrBoss: null,
      listOfExpertsOrBoss: [],
      isLoading: false,
      error: null,
      filters: {
        site: '',
        date: '',
        reference: '',
        candidate: '',
        experts: '',
        projectManagerButton: '',
        projectManager: '',
        nameRoom: ''
      },
      filteredData: [
        {
          site: 'ETML',
          date: '2026-06-10',
          name: 'A101',
          tpiDatas
        }
      ],
      uniqueSalles: [],
      uniqueDates: [],
      uniqueSites: [],
      uniqueCandidates: [],
      uniqueExperts: [],
      uniqueProjectManagers: [],
      loadData: jest.fn(),
      updateFilter: jest.fn(),
      updateSoutenanceData: jest.fn(),
      schedule: [],
      displayedSchedule: [],
      isFilterApplied: false
    })

    render(
      <MemoryRouter initialEntries={['/defenses/2026']}>
        <Routes>
          <Route path='/defenses/:year' element={<TpiSoutenance />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /générer le pdf/i }))

    await waitFor(() => {
      expect(__mockSave).toHaveBeenCalledWith('soutenances_2026_toutes.pdf')
    })
  })

  test('génère les vues PDF par salle et par expert/CDP', async () => {
    const { __mockSave } = require('jspdf')
    const tpiDatas = [
      {
        refTpi: '2101',
        candidat: 'Alice',
        expert1: { name: 'Expert A' },
        expert2: { name: 'Expert B' },
        boss: { name: 'Chef C' }
      },
      {
        refTpi: '2102',
        candidat: 'Bob',
        expert1: { name: 'Expert A' },
        expert2: { name: 'Expert D' },
        boss: { name: 'Chef E' }
      }
    ]

    useSoutenanceData.mockReturnValue({
      token: '',
      magicLinkViewer: null,
      soutenanceData: [
        {
          site: 'ETML',
          date: '2026-06-10',
          name: 'A101',
          tpiDatas
        }
      ],
      expertOrBoss: null,
      listOfExpertsOrBoss: [],
      isLoading: false,
      error: null,
      filters: {
        site: '',
        date: '',
        reference: '',
        candidate: '',
        experts: '',
        projectManagerButton: '',
        projectManager: '',
        nameRoom: ''
      },
      filteredData: [
        {
          site: 'ETML',
          date: '2026-06-10',
          name: 'A101',
          tpiDatas
        }
      ],
      uniqueSalles: [],
      uniqueDates: [],
      uniqueSites: [],
      uniqueCandidates: [],
      uniqueExperts: [],
      uniqueProjectManagers: [],
      loadData: jest.fn(),
      updateFilter: jest.fn(),
      updateSoutenanceData: jest.fn(),
      schedule: [],
      displayedSchedule: [],
      isFilterApplied: false
    })

    render(
      <MemoryRouter initialEntries={['/defenses/2026']}>
        <Routes>
          <Route path='/defenses/:year' element={<TpiSoutenance />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/vue pdf/i), { target: { value: 'rooms' } })
    fireEvent.click(screen.getByRole('button', { name: /générer le pdf/i }))

    await waitFor(() => {
      expect(__mockSave).toHaveBeenCalledWith('soutenances_2026_vue_salles_toutes.pdf')
    })

    __mockSave.mockClear()
    fireEvent.change(screen.getByLabelText(/vue pdf/i), { target: { value: 'roomGrid' } })
    fireEvent.click(screen.getByRole('button', { name: /générer le pdf/i }))

    await waitFor(() => {
      expect(__mockSave).toHaveBeenCalledWith('soutenances_2026_vue_ecran_salles_toutes.pdf')
    })

    __mockSave.mockClear()
    fireEvent.change(screen.getByLabelText(/vue pdf/i), { target: { value: 'people' } })
    fireEvent.click(screen.getByRole('button', { name: /générer le pdf/i }))

    await waitFor(() => {
      expect(__mockSave).toHaveBeenCalledWith('soutenances_2026_vue_experts_cdp_toutes.pdf')
    })
  })

  test('garde les créneaux vides avec un filtre date seul', () => {
    renderSoutenance(
      buildHookData({
        filters: {
          ...defaultFilters,
          date: '10 juin 2026'
        },
        isFilterApplied: true
      })
    )

    const props = getLastRenderRoomsProps()
    expect(props.showEmptySlots).toBe(true)
    expect(props.personIcalFilter).toBeNull()
  })

  test('garde les créneaux vides avec un filtre type de classe seul', () => {
    renderSoutenance(
      buildHookData({
        filters: {
          ...defaultFilters,
          classType: 'matu'
        },
        isFilterApplied: true
      })
    )

    const props = getLastRenderRoomsProps()
    expect(props.showEmptySlots).toBe(true)
    expect(props.personIcalFilter).toBeNull()
  })

  test('active l iCal personne et masque les créneaux vides avec un seul filtre expert', () => {
    renderSoutenance(
      buildHookData({
        filters: {
          ...defaultFilters,
          experts: 'Expert 1'
        },
        isFilterApplied: true,
        aggregatedICalPersonLabel: 'Expert 1'
      })
    )

    const props = getLastRenderRoomsProps()
    expect(props.showEmptySlots).toBe(false)
    expect(props.personIcalFilter).toEqual({
      name: 'Expert 1',
      role: 'expert'
    })
  })

  test('active l iCal personnel et masque les créneaux vides avec un lien magique', () => {
    renderSoutenance(
      buildHookData({
        magicLinkToken: 'magic-token',
        magicLinkViewer: {
          personId: 'person-1',
          name: 'Paul Chef'
        },
        isFilterApplied: false
      })
    )

    const props = getLastRenderRoomsProps()
    expect(props.showEmptySlots).toBe(false)
    expect(props.personIcalFilter).toEqual({
      name: 'Paul Chef',
      role: 'viewer'
    })
    expect(props.aggregatedICalPersonLabel).toBe('Paul Chef')
    expect(props.onClearPersonFilters).toBeUndefined()
  })

  test('le bouton Mes TPI du lien magique réinitialise uniquement les filtres de la page', () => {
    const updateFilter = jest.fn()

    renderSoutenance(
      buildHookData({
        magicLinkToken: 'magic-token',
        magicLinkViewer: {
          personId: 'person-1',
          name: 'Paul Chef'
        },
        filters: {
          ...defaultFilters,
          date: '10 juin 2026',
          site: 'ETML',
          nameRoom: 'A101',
          classType: 'matu',
          reference: '2163',
          candidate: 'Alice',
          experts: 'Paul Chef',
          projectManagerButton: 'Paul Chef',
          projectManager: 'Paul Chef'
        },
        updateFilter
      })
    )

    fireEvent.click(screen.getByRole('button', { name: /mes tpi/i }))

    expect(updateFilter.mock.calls).toEqual([
      ['date', ''],
      ['site', ''],
      ['nameRoom', ''],
      ['classType', ''],
      ['reference', ''],
      ['candidate', ''],
      ['experts', ''],
      ['projectManagerButton', ''],
      ['projectManager', '']
    ])
  })

  test('transmet un handler qui vide les filtres expert et chef de projet', () => {
    const updateFilter = jest.fn()

    renderSoutenance(
      buildHookData({
        filters: {
          ...defaultFilters,
          experts: 'Expert 1'
        },
        isFilterApplied: true,
        updateFilter
      })
    )

    const props = getLastRenderRoomsProps()
    act(() => {
      props.onClearPersonFilters()
    })

    expect(updateFilter).toHaveBeenCalledWith('experts', '')
    expect(updateFilter).toHaveBeenCalledWith('projectManagerButton', '')
    expect(updateFilter).toHaveBeenCalledWith('projectManager', '')
  })

  test('ne bascule pas vers l iCal personne quand plusieurs filtres sont actifs', () => {
    renderSoutenance(
      buildHookData({
        filters: {
          ...defaultFilters,
          date: '10 juin 2026',
          experts: 'Expert 1'
        },
        isFilterApplied: true,
        aggregatedICalPersonLabel: 'Expert 1'
      })
    )

    const props = getLastRenderRoomsProps()
    expect(props.showEmptySlots).toBe(false)
    expect(props.personIcalFilter).toBeNull()
  })
})
