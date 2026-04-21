import React from 'react'
import { render, screen } from '@testing-library/react'

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
              'Aucune date de soutenance configuree pour cette classe.'
            ],
            messages: [
              "TPI-2026-001 n'a aucun créneau proposé ou confirmé dans Planning. Raison: Aucune date de soutenance configuree pour cette classe.",
              'TPI-2026-001 ne peut pas être synchronisé: parties prenantes incomplètes.'
            ]
          }
        }}
        prioritizeValidationIssues
      />
    )

    expect(screen.getByText('À corriger')).toBeInTheDocument()
    expect(screen.getByText(/2 anomalies/i)).toBeInTheDocument()
    expect(screen.getByText(/Aucune date de soutenance configuree pour cette classe\./i)).toBeInTheDocument()
    expect(screen.getByText('TPI-2026-001').closest('tr')).toHaveClass('has-validation-issues')
    expect(screen.getByText('TPI-2026-002').closest('tr')).not.toHaveClass('has-validation-issues')
  })
})
