import { getPlanningStatusMeta } from './tpiDetailUtils'
import { getCoordinationStatusLabel } from '../../constants/coordinationStatus'

describe('tpiDetailUtils', () => {
  it('utilise les libellés du contrat coordination pour les statuts TPI', () => {
    expect(getPlanningStatusMeta('pending_slots')).toEqual({
      label: getCoordinationStatusLabel('pending_slots'),
      tone: 'warning'
    })

    expect(getPlanningStatusMeta('requires_manual_intervention')).toEqual({
      label: getCoordinationStatusLabel('manual_required'),
      tone: 'warning'
    })
  })

  it('conserve les états workflow legacy encore documentés', () => {
    expect(getPlanningStatusMeta('voting_open')).toEqual({
      label: 'Votes ouverts',
      tone: 'warning'
    })
  })
})
