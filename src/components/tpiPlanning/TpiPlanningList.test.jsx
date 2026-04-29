import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import TpiPlanningList from './TpiPlanningList'

describe('TpiPlanningList', () => {
  test('marque les TPI en erreur après une vérification', () => {
    const tpis = [
      {
        _id: 'tpi-1',
        reference: 'TPI-2026-001',
        status: 'draft',
        candidat: { firstName: 'Ada', lastName: 'Lovelace' },
        expert1: { firstName: 'Grace', lastName: 'Hopper' },
        expert2: { firstName: 'Alan', lastName: 'Turing' },
        chefProjet: { firstName: 'Linus', lastName: 'Torvalds' },
        proposedSlots: []
      },
      {
        _id: 'tpi-2',
        reference: 'TPI-2026-002',
        status: 'confirmed',
        candidat: { firstName: 'Margaret', lastName: 'Hamilton' },
        expert1: { firstName: 'Barbara', lastName: 'Liskov' },
        expert2: { firstName: 'Donald', lastName: 'Knuth' },
        chefProjet: { firstName: 'Ken', lastName: 'Thompson' },
        proposedSlots: []
      }
    ]

    render(
      <TpiPlanningList
        tpis={tpis}
        selectedTpi={null}
        onSelectTpi={() => {}}
        onProposeSlots={() => {}}
        isAdmin
        validationIssuesByTpiId={{
          'tpi-1': {
            count: 2,
            labels: ['Sans créneau', 'Parties prenantes incomplètes'],
            reasons: [
              'Aucune date de défense configuree pour cette classe.'
            ],
            messages: [
              "TPI-2026-001 n'a aucun créneau proposé ou confirmé dans Planning. Raison: Aucune date de défense configuree pour cette classe.",
              'TPI-2026-001 ne peut pas être synchronisé: parties prenantes incomplètes.'
            ]
          }
        }}
        prioritizeValidationIssues
      />
    )

    expect(screen.getByText('À corriger')).toBeInTheDocument()
    expect(screen.getByText(/2 anomalies/i)).toBeInTheDocument()
    expect(screen.getByText(/Aucune date de défense configuree pour cette classe\./i)).toBeInTheDocument()
    expect(screen.getByText('TPI-2026-001').closest('tr')).toHaveClass('has-validation-issues')
    expect(screen.getByText('TPI-2026-002').closest('tr')).not.toHaveClass('has-validation-issues')
  })

  test("affiche l'aperçu des créneaux avec les informations de classe", () => {
    const tpis = [
      {
        _id: 'tpi-3',
        reference: 'TPI-2026-003',
        status: 'voting',
        classe: 'M3A',
        site: 'Lausanne',
        candidat: { firstName: 'Katherine', lastName: 'Johnson' },
        expert1: { firstName: 'Mary', lastName: 'Jackson' },
        expert2: { firstName: 'Dorothy', lastName: 'Vaughan' },
        chefProjet: { firstName: 'Annie', lastName: 'Easley' },
        proposedSlots: [
          {
            score: 3,
            slot: {
              _id: 'slot-1',
              date: '2026-05-12T00:00:00.000Z',
              startTime: '09:00',
              room: { name: 'A101' }
            }
          }
        ]
      }
    ]

    render(
      <TpiPlanningList
        tpis={tpis}
        selectedTpi={null}
        onSelectTpi={() => {}}
        onProposeSlots={() => {}}
        isAdmin
        classTypes={[
          {
            code: 'MATU',
            prefix: 'M',
            label: 'MATU',
            startDate: '2026-05-01',
            endDate: '2026-05-31'
          }
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /afficher l'aperçu tpi-2026-003/i }))

    expect(screen.getByText('Date fixée + alternatives')).toBeInTheDocument()
    expect(screen.getByText('Date fixée')).toBeInTheDocument()
    expect(screen.getAllByText('09:00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('A101').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MATU').length).toBeGreaterThan(0)
  })
})
