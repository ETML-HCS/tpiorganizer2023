import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import TpiList from './TpiList.jsx'

const mockTpiForm = jest.fn(() => <div data-testid='mock-tpi-form' />)

jest.mock('./TpiForm.jsx', () => {
  const React = require('react')

  return function MockTpiForm(props) {
    mockTpiForm(props)
    return React.createElement('div', { 'data-testid': 'mock-tpi-form' })
  }
})

const renderWithRouter = (ui) => {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  )
}

const defaultPlanningSiteConfigs = [
  { siteCode: 'Site', label: 'Site', active: true }
]

const buildTpi = ({
  refTpi,
  candidat,
  expert1,
  expert2,
  boss = 'Boss Test',
  sujet = 'Sujet test',
  classe = 'CID4A',
  site = 'Site'
}) => ({
  refTpi,
  candidat,
  candidatPersonId: `${refTpi}-candidat`,
  experts: {
    1: expert1,
    2: expert2
  },
  expert1PersonId: expert1 ? `${refTpi}-expert1` : null,
  expert2PersonId: expert2 ? `${refTpi}-expert2` : null,
  boss,
  bossPersonId: `${refTpi}-boss`,
  sujet,
  site,
  classe,
  lieu: {
    entreprise: 'Entreprise',
    site
  },
  tags: []
})

describe('TpiList', () => {
  beforeEach(() => {
    mockTpiForm.mockClear()
  })

  it('reactivates the missing stakeholder filter when the year changes to a list with gaps', async () => {
    const completeList = [
      buildTpi({
        refTpi: '2163',
        candidat: 'Chasi Sanchez Dario Jhesuanj',
        expert1: 'Alain Pittet',
        expert2: 'Karim Bourahla'
      })
    ]

    const listWithMissingExpert = [
      buildTpi({
        refTpi: '2060',
        candidat: 'Scordato Alessio',
        expert1: '',
        expert2: 'Volkan Sutcu'
      }),
      buildTpi({
        refTpi: '2163',
        candidat: 'Chasi Sanchez Dario Jhesuanj',
        expert1: 'Alain Pittet',
        expert2: 'Karim Bourahla'
      })
    ]

    const { rerender } = renderWithRouter(
      <TpiList
        tpiList={completeList}
        onSave={() => {}}
        year={2026}
        planningSiteConfigs={defaultPlanningSiteConfigs}
      />
    )

    expect(screen.queryByRole('button', { name: /manquantes/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /incorrectes/i })).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <TpiList
          tpiList={listWithMissingExpert}
          onSave={() => {}}
          year={2025}
          planningSiteConfigs={defaultPlanningSiteConfigs}
        />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /manquantes/i })).toHaveClass('active')
    })

    expect(screen.getByText('Scordato Alessio')).toBeInTheDocument()
    expect(screen.queryByText('Chasi Sanchez Dario Jhesuanj')).not.toBeInTheDocument()
  })

  it('shows the incorrect stakeholder filter when links are missing but names are complete', () => {
    const listWithLinkIssueOnly = [
      {
        ...buildTpi({
          refTpi: '2163',
          candidat: 'Chasi Sanchez Dario Jhesuanj',
          expert1: 'Alain Pittet',
          expert2: 'Karim Bourahla'
        }),
        candidatPersonId: null
      }
    ]

    renderWithRouter(
      <TpiList
        tpiList={listWithLinkIssueOnly}
        onSave={() => {}}
        year={2026}
        planningSiteConfigs={defaultPlanningSiteConfigs}
      />
    )

    expect(screen.queryByRole('button', { name: /manquantes/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /incorrectes/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /manquantes/i })).not.toBeInTheDocument()
    expect(screen.getByText('Chasi Sanchez Dario Jhesuanj')).toBeInTheDocument()
  })

  it('does not flag a link issue when the API already marks stakeholders as resolved', () => {
    const listWithDerivedStakeholderState = [
      {
        ...buildTpi({
          refTpi: '2163',
          candidat: 'Chasi Sanchez Dario Jhesuanj',
          expert1: 'Alain Pittet',
          expert2: 'Karim Bourahla'
        }),
        candidatPersonId: null,
        expert1PersonId: null,
        expert2PersonId: null,
        bossPersonId: null,
        stakeholderState: {
          isComplete: true,
          isResolved: true,
          isValidated: true,
          missingRoles: [],
          unresolvedRoles: []
        }
      }
    ]

    renderWithRouter(
      <TpiList
        tpiList={listWithDerivedStakeholderState}
        onSave={() => {}}
        year={2026}
        planningSiteConfigs={defaultPlanningSiteConfigs}
      />
    )

    expect(screen.queryByRole('button', { name: /incorrectes/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/liaison pp à compléter/i)).not.toBeInTheDocument()
  })

  it('resolves the class from the site catalog without case sensitivity', () => {
    const planningCatalogSites = [
      {
        code: 'SEBEILLON',
        label: 'Sébeillon',
        classGroups: [
          {
            baseType: 'CFC',
            label: 'CFC',
            classes: [
              {
                code: 'CID4A',
                label: 'CID4A'
              }
            ]
          }
        ]
      }
    ]

    renderWithRouter(
      <TpiList
        tpiList={[
          buildTpi({
            refTpi: '2163',
            candidat: 'Chasi Sanchez Dario Jhesuanj',
            expert1: 'Alain Pittet',
            expert2: 'Karim Bourahla',
            classe: 'cid4a',
            site: 'sebeillon'
          })
        ]}
        onSave={() => {}}
        year={2026}
        planningCatalogSites={planningCatalogSites}
        planningSiteConfigs={[
          { siteCode: 'SEBEILLON', label: 'Sébeillon', active: true }
        ]}
      />
    )

    expect(screen.getByText('CID4A')).toBeInTheDocument()
    expect(screen.getByText('CFC')).toBeInTheDocument()
  })

  it('transmet la configuration annuelle au formulaire quand une fiche passe en mode édition', async () => {
    const planningCatalogSites = [
      {
        code: 'ETML',
        label: 'ETML',
        roomDetails: [{ code: 'A101', label: 'A101', active: true }]
      }
    ]
    const planningClassTypes = [
      {
        code: 'CFC',
        prefix: 'C',
        label: 'CFC',
        soutenanceDates: [{ date: '2026-06-10', special: true, classes: ['CFC', 'C'] }]
      }
    ]
    const planningSoutenanceDates = [{ date: '2026-06-10', special: true, classes: ['CFC', 'C'] }]

    renderWithRouter(
      <TpiList
        tpiList={[
          buildTpi({
            refTpi: '2163',
            candidat: 'Chasi Sanchez Dario Jhesuanj',
            expert1: 'Alain Pittet',
            expert2: 'Karim Bourahla',
            site: 'ETML'
          })
        ]}
        onSave={() => {}}
        year={2026}
        planningCatalogSites={planningCatalogSites}
        planningClassTypes={planningClassTypes}
        planningSoutenanceDates={planningSoutenanceDates}
        planningSiteConfigs={[{ siteCode: 'ETML', label: 'ETML', active: true }]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /modifier la fiche/i }))

    await waitFor(() => {
      const lastFormProps = mockTpiForm.mock.calls[mockTpiForm.mock.calls.length - 1]?.[0]
      expect(lastFormProps?.year).toBe(2026)
      expect(lastFormProps?.planningCatalogSites).toEqual(planningCatalogSites)
      expect(lastFormProps?.planningClassTypes).toEqual(planningClassTypes)
      expect(lastFormProps?.planningSoutenanceDates).toEqual(planningSoutenanceDates)
      expect(lastFormProps?.tpiToLoad).toEqual(expect.objectContaining({ refTpi: '2163' }))
    })
  })

  it('shows the class label in the GestionTPI badge when the catalog provides a human name', () => {
    const planningCatalogSites = [
      {
        code: 'SEBEILLON',
        label: 'Sébeillon',
        classGroups: [
          {
            baseType: 'CFC',
            label: 'CFC',
            classes: [
              {
                code: 'CID4A',
                label: 'Informatique de gestion'
              }
            ]
          }
        ]
      }
    ]

    renderWithRouter(
      <TpiList
        tpiList={[
          buildTpi({
            refTpi: '2163',
            candidat: 'Chasi Sanchez Dario Jhesuanj',
            expert1: 'Alain Pittet',
            expert2: 'Karim Bourahla',
            classe: 'cid4a',
            site: 'sebeillon'
          })
        ]}
        onSave={() => {}}
        year={2026}
        planningCatalogSites={planningCatalogSites}
        planningSiteConfigs={[
          { siteCode: 'SEBEILLON', label: 'Sébeillon', active: true }
        ]}
      />
    )

    expect(screen.getByText('Informatique de gestion')).toBeInTheDocument()
    expect(screen.getByText('CFC')).toBeInTheDocument()
    expect(screen.queryByText('CID4A')).not.toBeInTheDocument()
  })

  it('links each card to the dedicated TPI dossier page', () => {
    renderWithRouter(
      <TpiList
        tpiList={[
          buildTpi({
            refTpi: '2163',
            candidat: 'Chasi Sanchez Dario Jhesuanj',
            expert1: 'Alain Pittet',
            expert2: 'Karim Bourahla'
          })
        ]}
        onSave={() => {}}
        year={2026}
        planningSiteConfigs={defaultPlanningSiteConfigs}
      />
    )

    expect(screen.getByRole('link', { name: /ouvrir la fiche/i })).toHaveAttribute('href', '/tpi/2026/2163')
  })

  it('passes return context to the stakeholder link toward Parties prenantes', () => {
    renderWithRouter(
      <TpiList
        tpiList={[
          buildTpi({
            refTpi: '2163',
            candidat: 'Chasi Sanchez Dario Jhesuanj',
            expert1: 'Alain Pittet',
            expert2: 'Karim Bourahla'
          })
        ]}
        onSave={() => {}}
        year={2026}
        planningSiteConfigs={defaultPlanningSiteConfigs}
      />
    )

    expect(screen.getByRole('link', { name: 'Chasi Sanchez Dario Jhesuanj' })).toHaveAttribute(
      'href',
      '/partiesPrenantes?personId=2163-candidat&name=Chasi+Sanchez+Dario+Jhesuanj&role=candidat&tab=create&year=2026&returnTo=%2FgestionTPI%3Fyear%3D2026%26focus%3D2163%26edit%3D1'
    )
  })

  it('highlights the focused TPI card coming from the detail page', () => {
    renderWithRouter(
      <TpiList
        tpiList={[
          buildTpi({
            refTpi: '2163',
            candidat: 'Chasi Sanchez Dario Jhesuanj',
            expert1: 'Alain Pittet',
            expert2: 'Karim Bourahla'
          })
        ]}
        onSave={() => {}}
        year={2026}
        focusedTpiRef='2163'
        planningSiteConfigs={defaultPlanningSiteConfigs}
      />
    )

    expect(screen.getByText(/fiche ciblée/i)).toBeInTheDocument()
    expect(screen.getByText('Sujet test').closest('article')).toHaveClass('is-focused')
  })

  it('marks out-of-scope TPIs without stakeholder warnings', () => {
    renderWithRouter(
      <TpiList
        tpiList={[
          {
            ...buildTpi({
              refTpi: '3001',
              candidat: 'Alice Hors Scope',
              expert1: 'Alain Pittet',
              expert2: 'Karim Bourahla',
              site: 'CFPV'
            }),
            candidatPersonId: null,
            expert1PersonId: null,
            expert2PersonId: null,
            bossPersonId: null
          }
        ]}
        onSave={() => {}}
        year={2026}
        planningSiteConfigs={[
          { siteCode: 'ETML', label: 'ETML', active: true }
        ]}
      />
    )

    expect(screen.getByText(/elles restent éditables ici/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /incorrectes/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/liaison pp à compléter/i)).not.toBeInTheDocument()
  })

  it('filters the list by planning perimeter', () => {
    renderWithRouter(
      <TpiList
        tpiList={[
          buildTpi({
            refTpi: '3001',
            candidat: 'Alice ETML',
            expert1: 'Alain Pittet',
            expert2: 'Karim Bourahla',
            site: 'ETML'
          }),
          buildTpi({
            refTpi: '3002',
            candidat: 'Bruno CFPV',
            expert1: 'Alain Pittet',
            expert2: 'Karim Bourahla',
            site: 'CFPV'
          })
        ]}
        onSave={() => {}}
        year={2026}
        planningSiteConfigs={[
          { siteCode: 'ETML', label: 'ETML', active: true }
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /hors périmètre/i }))

    expect(screen.getByText('Bruno CFPV')).toBeInTheDocument()
    expect(screen.queryByText('Alice ETML')).not.toBeInTheDocument()
  })

  it('applies a bulk edit on the selected TPIs from the current filter', async () => {
    const onBulkSave = jest.fn().mockResolvedValue({
      total: 2,
      successCount: 2,
      failureCount: 0,
      failures: []
    })

    renderWithRouter(
      <TpiList
        tpiList={[
          buildTpi({
            refTpi: '2163',
            candidat: 'Alice Martin',
            expert1: 'Alain Pittet',
            expert2: 'Karim Bourahla'
          }),
          buildTpi({
            refTpi: '2164',
            candidat: 'Bob Martin',
            expert1: 'Alain Pittet',
            expert2: 'Karim Bourahla'
          })
        ]}
        onSave={() => {}}
        onBulkSave={onBulkSave}
        year={2026}
        planningSiteConfigs={defaultPlanningSiteConfigs}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /édition multiple/i }))
    fireEvent.click(screen.getByRole('button', { name: /prendre visibles/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Classe' }))
    fireEvent.change(screen.getByPlaceholderText('CID4A'), { target: { value: 'MID4B' } })
    fireEvent.click(screen.getByRole('button', { name: /appliquer à la sélection/i }))

    await waitFor(() => {
      expect(onBulkSave).toHaveBeenCalledTimes(1)
    })

    expect(onBulkSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          refTpi: '2163',
          classe: 'MID4B'
        }),
        expect.objectContaining({
          refTpi: '2164',
          classe: 'MID4B'
        })
      ])
    )
    expect(await screen.findByText(/2 fiche\(s\) mises à jour d'un coup/i)).toBeInTheDocument()
  })
})
