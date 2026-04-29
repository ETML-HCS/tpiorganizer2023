import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import RenderRooms from './TpiSoutenanceRooms'

jest.mock('./CreneauPropositionPopup', () => () => null)
jest.mock('./TpiSoutenanceActionButtons', () => () => null)

describe('TpiSoutenanceRooms', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  let clickSpy

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:ical')
    URL.revokeObjectURL = jest.fn()
    clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    clickSpy.mockRestore()
  })

  test('ajoute un accès secondaire vers la fiche TPI publiée', () => {
    render(
      <MemoryRouter>
        <RenderRooms
          year={2026}
          tpiDatas={[
            {
              site: 'ETML',
              date: '2026-06-10',
              name: 'A101',
              tpiDatas: [
                {
                  id: 'tpi-1',
                  refTpi: '2163',
                  candidat: 'Alice Martin',
                  expert1: { name: 'Expert 1' },
                  expert2: { name: 'Expert 2' },
                  boss: { name: 'Chef de projet' }
                }
              ]
            }
          ]}
          schedule={[
            {
              startTime: '08:00',
              endTime: '09:00'
            }
          ]}
          listOfPerson={[
            { name: 'Expert 1', token: 'exp-1' },
            { name: 'Expert 2', token: 'exp-2' },
            { name: 'Chef de projet', token: 'cdp-1' }
          ]}
          isAnyFilterApplied={false}
          loadData={jest.fn()}
          token=''
          isOn={false}
          updateSoutenanceData={jest.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('Alice Martin')).toBeInTheDocument()
  })

  test('applique la couleur de défense configurée sur une salle publiée', () => {
    const { container } = render(
      <MemoryRouter>
        <RenderRooms
          year={2026}
          tpiDatas={[
            {
              site: 'ETML',
              date: '2026-06-10',
              name: 'A101',
              configSite: {
                soutenanceColor: '#0f766e',
                stakeholderIcons: {
                  candidate: 'candidate',
                  expert1: 'participant',
                  expert2: 'participant',
                  projectManager: 'participant'
                }
              },
              tpiDatas: [
                {
                  id: 'tpi-1',
                  refTpi: '2163',
                  candidat: 'Alice Martin',
                  expert1: { name: 'Expert 1' },
                  expert2: { name: 'Expert 2' },
                  boss: { name: 'Chef de projet' }
                }
              ]
            }
          ]}
          schedule={[
            {
              startTime: '08:00',
              endTime: '09:00'
            }
          ]}
          listOfPerson={[]}
          isAnyFilterApplied={false}
          loadData={jest.fn()}
          token=''
          isOn={false}
          updateSoutenanceData={jest.fn()}
        />
      </MemoryRouter>
    )

    const room = container.querySelector('.salle')
    expect(room).toHaveClass('has-soutenance-color')
    expect(room.style.getPropertyValue('--soutenance-room-accent')).toBe('#0F766E')
  })

  test('affiche tous les créneaux configurés et laisse les créneaux sans TPI vides', () => {
    const { container } = render(
      <MemoryRouter>
        <RenderRooms
          year={2026}
          tpiDatas={[
            {
              site: 'ETML',
              date: '2026-06-10',
              name: 'A101',
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
                  candidat: 'Alice Martin',
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
          listOfPerson={[]}
          isAnyFilterApplied={false}
          loadData={jest.fn()}
          token=''
          isOn={false}
          updateSoutenanceData={jest.fn()}
        />
      </MemoryRouter>
    )

    expect(container.querySelectorAll('.tpi-slot')).toHaveLength(3)
    expect(container.querySelectorAll('.tpi-slot.is-slot-empty')).toHaveLength(2)
    expect(screen.getByText('Alice Martin')).toBeInTheDocument()
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getAllByText('10:00').length).toBeGreaterThan(0)
  })

  test('tronque les noms des slots TPI à 28 caractères avec le nom complet en hover', () => {
    const longCandidateName = 'Alice Martin Dupont Très Long'
    const longExpertName = 'Expert Principal Avec Nom Très Long'

    render(
      <MemoryRouter>
        <RenderRooms
          year={2026}
          tpiDatas={[
            {
              site: 'ETML',
              date: '2026-06-10',
              name: 'A101',
              tpiDatas: [
                {
                  id: 'room-a_0',
                  refTpi: '2163',
                  candidat: longCandidateName,
                  expert1: { name: longExpertName },
                  expert2: { name: 'Expert 2' },
                  boss: { name: 'Chef de projet' }
                }
              ]
            }
          ]}
          schedule={[
            { startTime: '08:00', endTime: '09:00' }
          ]}
          listOfPerson={[]}
          isAnyFilterApplied={false}
          loadData={jest.fn()}
          token=''
          isOn={false}
          updateSoutenanceData={jest.fn()}
        />
      </MemoryRouter>
    )

    const truncatedCandidate = screen.getByText('Alice Martin Dupont Très ...')
    const truncatedExpert = screen.getByText('Expert Principal Avec Nom...')

    expect(truncatedCandidate.textContent).toHaveLength(28)
    expect(truncatedCandidate).toHaveAttribute('title', longCandidateName)
    expect(truncatedExpert.textContent).toHaveLength(28)
    expect(truncatedExpert).toHaveAttribute('title', longExpertName)
  })

  test('masque les créneaux vides quand le filtre ne doit garder que les défenses', () => {
    const { container } = render(
      <MemoryRouter>
        <RenderRooms
          year={2026}
          tpiDatas={[
            {
              site: 'ETML',
              date: '2026-06-10',
              name: 'A101',
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
                  candidat: 'Alice Martin',
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
          listOfPerson={[]}
          isAnyFilterApplied={true}
          showEmptySlots={false}
          loadData={jest.fn()}
          token=''
          isOn={false}
          updateSoutenanceData={jest.fn()}
        />
      </MemoryRouter>
    )

    expect(container.querySelectorAll('.tpi-slot')).toHaveLength(1)
    expect(container.querySelectorAll('.tpi-slot.is-slot-empty')).toHaveLength(0)
    expect(screen.getByText('Alice Martin')).toBeInTheDocument()
    expect(screen.queryByLabelText(/créneau vide/i)).not.toBeInTheDocument()
  })

  test('permet d exporter un iCal par TPI et par salle', () => {
    render(
      <MemoryRouter>
        <RenderRooms
          year={2026}
          tpiDatas={[
            {
              site: 'ETML',
              date: '2026-06-10',
              name: 'A101',
              tpiDatas: [
                {
                  id: 'room-a_0',
                  refTpi: '2163',
                  candidat: 'Alice Martin',
                  expert1: { name: 'Expert 1' },
                  expert2: { name: 'Expert 2' },
                  boss: { name: 'Chef de projet' }
                }
              ]
            }
          ]}
          schedule={[
            { startTime: '08:00', endTime: '09:00' }
          ]}
          listOfPerson={[]}
          isAnyFilterApplied={false}
          loadData={jest.fn()}
          token=''
          isOn={false}
          updateSoutenanceData={jest.fn()}
        />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /exporter ical du tpi 2163/i }))
    fireEvent.click(screen.getByRole('button', { name: /exporter ical de la salle a101/i }))

    expect(screen.queryByText(/iCal salle/i)).not.toBeInTheDocument()
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(clickSpy).toHaveBeenCalledTimes(2)
  })

  test('affiche un iCal Outlook en bas pour un seul filtre personne', () => {
    const clearPersonFilters = jest.fn()

    render(
      <MemoryRouter>
        <RenderRooms
          year={2026}
          tpiDatas={[
            {
              site: 'ETML',
              date: '2026-06-10',
              name: 'A101',
              tpiDatas: [
                {
                  id: 'room-a_0',
                  refTpi: '2163',
                  candidat: 'Alice Martin',
                  expert1: { name: 'Expert 1' },
                  expert2: { name: 'Expert 2' },
                  boss: { name: 'Chef de projet' }
                }
              ]
            }
          ]}
          schedule={[
            { startTime: '08:00', endTime: '09:00' }
          ]}
          listOfPerson={[]}
          isAnyFilterApplied={true}
          personIcalFilter={{ name: 'Expert 1', role: 'expert' }}
          aggregatedICalPersonLabel='Expert 1'
          onClearPersonFilters={clearPersonFilters}
          loadData={jest.fn()}
          token=''
          isOn={false}
          updateSoutenanceData={jest.fn()}
        />
      </MemoryRouter>
    )

    expect(
      screen.getByText(/Télécharger votre iCal pour insérer vos défenses dans votre agenda Outlook/i)
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /exporter ical du tpi 2163/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /exporter ical de la salle a101/i })).not.toBeInTheDocument()

    const clearFiltersButton = screen.getByRole('button', {
      name: /désactiver le filtre sur expert 1 et afficher toutes les défenses/i
    })
    expect(clearFiltersButton).not.toHaveAttribute('title')
    expect(clearFiltersButton).toHaveAttribute(
      'data-tooltip',
      'Désactiver le filtre sur Expert 1 et afficher toutes les défenses'
    )

    fireEvent.click(screen.getByRole('button', { name: /télécharger votre ical outlook/i }))
    fireEvent.click(clearFiltersButton)

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(clearPersonFilters).toHaveBeenCalledTimes(1)
  })
})
