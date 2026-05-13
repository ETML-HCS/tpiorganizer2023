import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import TpiSlot from './TpiSlot'

let mockLastDropConfig = null

jest.mock('react-dnd', () => ({
  useDrop: (config) => {
    mockLastDropConfig = config
    return [{ isOver: false }, jest.fn()]
  }
}))

jest.mock('./TpiCard', () => ({
  __esModule: true,
  default: ({
    roomPeriod,
    isSwapSelected,
    isSwapCandidate,
    hasValidationError,
    hasValidationWarning,
    validationIssueTypes,
    primaryValidationIssueType,
    validationTone,
    validationErrorMessages,
    onActivateTpi
  }) => (
    <button
      type="button"
      data-testid="tpi-card"
      data-room-period={roomPeriod ?? ''}
      data-swap-selected={isSwapSelected ? 'true' : 'false'}
      data-swap-candidate={isSwapCandidate ? 'true' : 'false'}
      data-validation-error={hasValidationError ? 'true' : 'false'}
      data-validation-warning={hasValidationWarning ? 'true' : 'false'}
      data-validation-issue-types={Array.isArray(validationIssueTypes) ? validationIssueTypes.join(' ') : ''}
      data-primary-validation-issue-type={primaryValidationIssueType || ''}
      data-validation-tone={validationTone || ''}
      data-validation-messages={Array.isArray(validationErrorMessages) ? validationErrorMessages.join('|') : ''}
      onClick={onActivateTpi}
    />
  )
}))

const makeTpi = (period) => ({
  id: 'tpi-1',
  refTpi: 'TPI-001',
  candidat: 'Alice Martin',
  period,
  expert1: { name: 'Expert 1', offres: { isValidated: false, submit: [] } },
  expert2: { name: 'Expert 2', offres: { isValidated: false, submit: [] } },
  boss: { name: 'Chef', offres: { isValidated: false, submit: [] } }
})

describe('TpiSlot', () => {
  beforeEach(() => {
    mockLastDropConfig = null
  })

  it('transmet le créneau de la grille à la carte TPI', () => {
    render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        roomPeriod={6}
      />
    )

    expect(screen.getByTestId('tpi-card')).toHaveAttribute('data-room-period', '6')
  })

  it('utilise le créneau du TPI en fallback', () => {
    render(
      <TpiSlot
        tpiData={makeTpi(3)}
        isEditTPICard={false}
        timeValues={['10:20', '11:20']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
      />
    )

    expect(screen.getByTestId('tpi-card')).toHaveAttribute('data-room-period', '3')
  })

  it('transmet les couleurs et messages de validation à la carte TPI', () => {
    render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        validationMarker={{
          hasError: true,
          hasWarning: false,
          issueTypes: ['consecutive_limit', 'room_class_mismatch'],
          primaryIssueType: 'consecutive_limit',
          tone: 'sequence',
          messages: ['Grace Hopper a 5 TPI consécutifs.']
        }}
      />
    )

    const card = screen.getByTestId('tpi-card')
    expect(card).toHaveAttribute('data-validation-error', 'true')
    expect(card).toHaveAttribute('data-validation-warning', 'false')
    expect(card).toHaveAttribute('data-validation-issue-types', 'consecutive_limit room_class_mismatch')
    expect(card).toHaveAttribute('data-primary-validation-issue-type', 'consecutive_limit')
    expect(card).toHaveAttribute('data-validation-tone', 'sequence')
    expect(card).toHaveAttribute('data-validation-messages', 'Grace Hopper a 5 TPI consécutifs.')
  })

  it('affiche le bouton de sync sous l heure uniquement en mode édition', () => {
    const onSyncTpiFromGestion = jest.fn()
    const syncEntry = {
      refTpi: 'TPI-001',
      changedLabels: ['candidat', 'expert 1']
    }

    const { rerender } = render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        tpiSyncEntry={syncEntry}
        onSyncTpiFromGestion={onSyncTpiFromGestion}
      />
    )

    expect(screen.queryByRole('button', { name: /Synchroniser TPI-001/i })).not.toBeInTheDocument()

    rerender(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        tpiSyncEntry={syncEntry}
        onSyncTpiFromGestion={onSyncTpiFromGestion}
      />
    )

    const syncButton = screen.getByRole('button', { name: /Synchroniser TPI-001/i })
    expect(syncButton.querySelector('svg')).not.toBeNull()

    fireEvent.click(syncButton)

    expect(onSyncTpiFromGestion).toHaveBeenCalledTimes(1)
  })

  it('garde le swap existant pour une carte venant de la grille', () => {
    const onSwapTpiCards = jest.fn()

    render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={onSwapTpiCards}
      />
    )

    mockLastDropConfig.drop({ tpi: { id: 'dragged-tpi' } })

    expect(onSwapTpiCards).toHaveBeenCalledWith('dragged-tpi', 'tpi-1')
  })

  it('redirige un TPI non attribué vers le callback de placement', () => {
    const onDropUnassignedTpi = jest.fn()
    const unassignedTpi = {
      refTpi: 'TPI-404',
      candidat: 'Nora Queue'
    }

    render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        onDropUnassignedTpi={onDropUnassignedTpi}
      />
    )

    mockLastDropConfig.drop({ source: 'unassigned', tpi: unassignedTpi })

    expect(onDropUnassignedTpi).toHaveBeenCalledWith(unassignedTpi, 'tpi-1')
  })

  it('permet de sceller un TPI depuis le menu contextuel du slot', () => {
    const onUpdateTpi = jest.fn()
    const { container } = render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={onUpdateTpi}
        onSwapTpiCardsProp={jest.fn()}
      />
    )

    const slot = container.querySelector('.tpiSlot')
    slot.getBoundingClientRect = jest.fn(() => ({
      left: 10,
      top: 20,
      width: 300,
      height: 140,
      right: 310,
      bottom: 160
    }))

    fireEvent.contextMenu(slot, { clientX: 80, clientY: 66 })
    expect(screen.getByRole('menu')).toHaveStyle({
      left: '70px',
      top: '46px'
    })

    fireEvent.click(screen.getByRole('menuitem', { name: /Verrouiller ce TPI/i }))

    expect(onUpdateTpi).toHaveBeenCalledWith(expect.objectContaining({
      refTpi: 'TPI-001',
      isPlanningSealed: true
    }))
  })

  it('affiche un bouton cadenas discret en mode édition sans marquer le slot comme scellé', () => {
    const onUpdateTpi = jest.fn()
    const { container } = render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard
        timeValues={['13:00', '14:00']}
        onUpdateTpi={onUpdateTpi}
        onSwapTpiCardsProp={jest.fn()}
      />
    )

    const slot = container.querySelector('.tpiSlot')
    const sealButton = screen.getByRole('button', { name: /Verrouiller ce TPI/i })

    expect(slot).not.toHaveAttribute('data-planning-sealed')
    expect(container.querySelector('.timeSlot')).toHaveClass('has-seal-control')
    expect(sealButton).toHaveAttribute('aria-pressed', 'false')
    expect(sealButton).not.toHaveClass('is-sealed')

    fireEvent.click(sealButton)

    expect(onUpdateTpi).toHaveBeenCalledWith(expect.objectContaining({
      isPlanningSealed: true
    }))
  })

  it('affiche un cadenas rouge pour un TPI scellé et bloque le drop', () => {
    const onSwapTpiCards = jest.fn()
    const onDropUnassignedTpi = jest.fn()

    const { container } = render(
      <TpiSlot
        tpiData={{ ...makeTpi(2), isPlanningSealed: true }}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={onSwapTpiCards}
        onDropUnassignedTpi={onDropUnassignedTpi}
      />
    )

    expect(container.querySelector('.tpiSlot')).toHaveAttribute('data-planning-sealed', 'true')
    const sealButton = screen.getByRole('button', { name: /Déverrouiller ce TPI/i })
    expect(sealButton).toHaveAttribute('aria-pressed', 'true')
    expect(sealButton).toHaveClass('is-sealed')
    expect(sealButton.querySelector('svg')).not.toBeNull()

    mockLastDropConfig.drop({ tpi: { id: 'dragged-tpi' } })
    mockLastDropConfig.drop({ source: 'unassigned', tpi: { refTpi: 'TPI-404' } })

    expect(onSwapTpiCards).not.toHaveBeenCalled()
    expect(onDropUnassignedTpi).not.toHaveBeenCalled()
  })

  it('ignore une carte scellée glissée vers un autre slot', () => {
    const onSwapTpiCards = jest.fn()

    render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={onSwapTpiCards}
      />
    )

    mockLastDropConfig.drop({ tpi: { id: 'dragged-tpi', isPlanningSealed: true } })

    expect(onSwapTpiCards).not.toHaveBeenCalled()
  })

  it('sélectionne une carte comme source de swap assisté', () => {
    const onSelectTpiForSwap = jest.fn()

    render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        onSelectTpiForSwap={onSelectTpiForSwap}
      />
    )

    fireEvent.click(screen.getByTestId('tpi-card'))

    expect(onSelectTpiForSwap).toHaveBeenCalledWith({
      tpi: expect.objectContaining({ refTpi: 'TPI-001' }),
      slotId: 'tpi-1'
    })
  })

  it('ne sélectionne pas une carte scellée comme source de swap assisté', () => {
    const onSelectTpiForSwap = jest.fn()

    render(
      <TpiSlot
        tpiData={{ ...makeTpi(2), isPlanningSealed: true }}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        onSelectTpiForSwap={onSelectTpiForSwap}
      />
    )

    fireEvent.click(screen.getByTestId('tpi-card'))

    expect(onSelectTpiForSwap).not.toHaveBeenCalled()
  })

  it('ne déclenche pas de swap assisté vers une cible scellée', () => {
    const onAssistedSwapToSlot = jest.fn()

    render(
      <TpiSlot
        tpiData={{ ...makeTpi(2), isPlanningSealed: true }}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        isSwapAssistActive
        swapAssistState="target"
        onAssistedSwapToSlot={onAssistedSwapToSlot}
      />
    )

    expect(screen.getByTestId('tpi-card')).toHaveAttribute('data-swap-candidate', 'false')

    fireEvent.click(screen.getByTestId('tpi-card'))

    expect(onAssistedSwapToSlot).not.toHaveBeenCalled()
  })

  it('déclenche le swap assisté quand un slot cible est cliqué', () => {
    const onAssistedSwapToSlot = jest.fn()

    render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        isSwapAssistActive
        swapAssistState="target"
        onAssistedSwapToSlot={onAssistedSwapToSlot}
      />
    )

    expect(screen.getByTestId('tpi-card')).toHaveAttribute('data-swap-candidate', 'true')

    fireEvent.click(screen.getByTestId('tpi-card'))

    expect(onAssistedSwapToSlot).toHaveBeenCalledWith('tpi-1')
  })

  it('ignore une cible bloquée en mode swap assisté', () => {
    const onAssistedSwapToSlot = jest.fn()
    const onSelectTpiForSwap = jest.fn()

    render(
      <TpiSlot
        tpiData={makeTpi(2)}
        isEditTPICard={false}
        timeValues={['13:00', '14:00']}
        onUpdateTpi={jest.fn()}
        onSwapTpiCardsProp={jest.fn()}
        isSwapAssistActive
        swapAssistState="blocked"
        onAssistedSwapToSlot={onAssistedSwapToSlot}
        onSelectTpiForSwap={onSelectTpiForSwap}
      />
    )

    fireEvent.click(screen.getByTestId('tpi-card'))

    expect(onAssistedSwapToSlot).not.toHaveBeenCalled()
    expect(onSelectTpiForSwap).not.toHaveBeenCalled()
  })
})
