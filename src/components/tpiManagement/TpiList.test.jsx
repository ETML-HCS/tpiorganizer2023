import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import TpiList from './TpiList.jsx'

const renderWithRouter = (ui) => {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  )
}

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
      <TpiList tpiList={completeList} onSave={() => {}} year={2026} />
    )

    expect(screen.queryByRole('button', { name: /manquantes/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /incorrectes/i })).not.toBeInTheDocument()

    rerender(
      <MemoryRouter>
        <TpiList tpiList={listWithMissingExpert} onSave={() => {}} year={2025} />
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
      <TpiList tpiList={listWithLinkIssueOnly} onSave={() => {}} year={2026} />
    )

    expect(screen.queryByRole('button', { name: /manquantes/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /incorrectes/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /manquantes/i })).not.toBeInTheDocument()
    expect(screen.getByText('Chasi Sanchez Dario Jhesuanj')).toBeInTheDocument()
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
      />
    )

    expect(screen.getByText('CID4A')).toBeInTheDocument()
    expect(screen.getByText('CFC')).toBeInTheDocument()
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
      />
    )

    expect(screen.getByRole('link', { name: /ouvrir la fiche/i })).toHaveAttribute('href', '/tpi/2026/2163')
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
      />
    )

    expect(screen.getByText(/fiche ciblée/i)).toBeInTheDocument()
    expect(screen.getByText('Sujet test').closest('article')).toHaveClass('is-focused')
  })
})
