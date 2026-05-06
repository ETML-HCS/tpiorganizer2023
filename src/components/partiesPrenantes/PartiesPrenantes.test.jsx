import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import PartiesPrenantes from './PartiesPrenantes'
import { STORAGE_KEYS } from '../../config/appConfig'
import { personService } from '../../services/coordinationService'

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn()
  }
}))

jest.mock('../../services/coordinationService', () => ({
  personService: {
    getAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    merge: jest.fn(),
    importFromContent: jest.fn()
  }
}))

const renderPage = (initialEntry = '/parties-prenantes?year=2026') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <Routes>
      <Route path='/parties-prenantes' element={<PartiesPrenantes />} />
      <Route path='/tpi/:year/:ref' element={<div data-testid='return-page'>Retour TPI</div>} />
      <Route path='*' element={<div data-testid='not-found'>Route inconnue</div>} />
    </Routes>
  </MemoryRouter>
)

describe('PartiesPrenantes', () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.clearAllMocks()
  })

  it('charge et filtre le référentiel', async () => {
    personService.getAll.mockResolvedValue([
      {
        _id: 'alice-id',
        firstName: 'Alice',
        lastName: 'Martin',
        email: 'alice@example.com',
        roles: ['candidat'],
        candidateYears: [2026],
        site: 'Vennes',
        sendEmails: true,
        isActive: true
      },
      {
        _id: 'bob-id',
        firstName: 'Bob',
        lastName: 'Expert',
        email: 'bob@example.com',
        roles: ['expert'],
        site: 'Sébeillon',
        sendEmails: true,
        isActive: true
      }
    ])

    renderPage()

    expect(await screen.findByText('Alice Martin')).toBeInTheDocument()
    expect(screen.getByText('Bob Expert')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Rôle'), { target: { value: 'expert' } })

    expect(screen.queryByText('Alice Martin')).not.toBeInTheDocument()
    expect(screen.getByText('Bob Expert')).toBeInTheDocument()
  })

  it('met à jour une fiche existante', async () => {
    personService.getAll.mockResolvedValue([
      {
        _id: 'bob-id',
        firstName: 'Bob',
        lastName: 'Expert',
        email: 'bob@example.com',
        roles: ['expert'],
        site: 'Vennes',
        sendEmails: true,
        isActive: true
      }
    ])
    personService.update.mockResolvedValue({
      _id: 'bob-id',
      firstName: 'Bob',
      lastName: 'Expert',
      email: 'bob.updated@example.com',
      roles: ['expert'],
      site: 'Vennes',
      sendEmails: true,
      isActive: true
    })

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Bob Expert/i }))
    fireEvent.change(screen.getByDisplayValue('bob@example.com'), {
      target: { value: 'bob.updated@example.com' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(personService.update).toHaveBeenCalledWith(
        'bob-id',
        expect.objectContaining({
          email: 'bob.updated@example.com',
          roles: ['expert']
        })
      )
    })
  })

  it('ajoute le rôle administrateur sans retirer les rôles TPI', async () => {
    personService.getAll.mockResolvedValue([])
    personService.create.mockResolvedValue({
      person: {
        _id: 'admin-expert-id',
        firstName: 'Ada',
        lastName: 'Admin',
        email: 'ada.admin@example.com',
        roles: ['expert', 'admin'],
        isActive: true,
        sendEmails: true
      }
    })

    renderPage()

    const editor = (await screen.findByRole('heading', { name: 'Rôles et responsabilités' })).closest('form')
    fireEvent.change(within(editor).getByLabelText('Prénom'), { target: { value: 'Ada' } })
    fireEvent.change(within(editor).getByLabelText('Nom'), { target: { value: 'Admin' } })
    fireEvent.change(within(editor).getByLabelText('Email'), { target: { value: 'ada.admin@example.com' } })
    fireEvent.click(within(editor).getByRole('button', { name: /Administrateur/i }))
    fireEvent.click(within(editor).getByRole('button', { name: /^Créer$/ }))

    await waitFor(() => {
      expect(personService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: ['expert', 'admin']
        })
      )
    })
  })

  it('affiche le bloc Lu-Ve uniquement quand le rôle chef de projet est sélectionné', async () => {
    personService.getAll.mockResolvedValue([])

    renderPage()

    expect(await screen.findByRole('heading', { name: 'Rôles et responsabilités' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Disponibilité Lu-Ve' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Chef de projet/i }))

    expect(screen.getByRole('heading', { name: 'Disponibilité Lu-Ve' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Chef de projet/i }))

    expect(screen.queryByRole('heading', { name: 'Disponibilité Lu-Ve' })).not.toBeInTheDocument()
  })

  it('enregistre les disponibilités Lu-Ve du chef de projet dans defaultAvailability', async () => {
    personService.getAll.mockResolvedValue([
      {
        _id: 'paul-id',
        firstName: 'Paul',
        lastName: 'Manager',
        email: 'paul@example.com',
        roles: ['chef_projet'],
        site: 'Vennes',
        sendEmails: true,
        isActive: true
      }
    ])
    personService.update.mockResolvedValue({
      _id: 'paul-id',
      firstName: 'Paul',
      lastName: 'Manager',
      email: 'paul@example.com',
      roles: ['chef_projet'],
      site: 'Vennes',
      sendEmails: true,
      isActive: true,
      defaultAvailability: [
        { dayOfWeek: 1, periods: [] },
        { dayOfWeek: 2, periods: [1, 2] },
        { dayOfWeek: 3, periods: [1, 2] },
        { dayOfWeek: 4, periods: [1, 2] },
        { dayOfWeek: 5, periods: [1, 2] }
      ]
    })

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Paul Manager/i }))
    fireEvent.click(screen.getByRole('button', { name: /Lundi - Disponible/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(personService.update).toHaveBeenCalledWith(
        'paul-id',
        expect.objectContaining({
          roles: ['chef_projet'],
          defaultAvailability: expect.arrayContaining([
            { dayOfWeek: 1, periods: [] },
            { dayOfWeek: 2, periods: [1, 2] }
          ])
        })
      )
    })
  })

  it('crée une fiche depuis un brouillon Gestion TPI et nettoie le brouillon couvert', async () => {
    window.localStorage.setItem(STORAGE_KEYS.PENDING_STAKEHOLDER_IMPORT, JSON.stringify([
      {
        id: 'draft-carla',
        name: 'Carla Expert',
        role: 'expert',
        year: 2026,
        refs: ['TPI-2026-001']
      }
    ]))
    personService.getAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          _id: 'carla-id',
          firstName: 'Carla',
          lastName: 'Expert',
          email: 'd.e.cexpert.26.abc123@tpiorganizer.ch',
          roles: ['expert'],
          isActive: true,
          sendEmails: false
        }
      ])
    personService.create.mockResolvedValue({
      person: {
        _id: 'carla-id',
        firstName: 'Carla',
        lastName: 'Expert',
        email: 'd.e.cexpert.26.abc123@tpiorganizer.ch',
        roles: ['expert'],
        isActive: true,
        sendEmails: false
      }
    })

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Créer fiche' }))
    fireEvent.click(screen.getByRole('button', { name: /^Créer$/ }))

    await waitFor(() => {
      expect(personService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Carla',
          lastName: 'Expert',
          roles: ['expert'],
          sendEmails: false
        })
      )
    })

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.PENDING_STAKEHOLDER_IMPORT))).toEqual([])
    })
  })

  it('redirige vers un returnTo local après création', async () => {
    personService.getAll.mockResolvedValue([])
    personService.create.mockResolvedValue({
      person: {
        _id: 'alice-id',
        firstName: 'Alice',
        lastName: 'Expert',
        email: 'd.e.aexpert.26.abc123@tpiorganizer.ch',
        roles: ['expert'],
        isActive: true,
        sendEmails: false
      }
    })

    renderPage('/parties-prenantes?year=2026&name=Alice%20Expert&role=expert&returnTo=%2Ftpi%2F2026%2FTPI-001')

    expect(await screen.findByDisplayValue('Alice')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Créer$/ }))

    expect(await screen.findByTestId('return-page')).toBeInTheDocument()
  })

  it('ignore un returnTo externe après création', async () => {
    personService.getAll.mockResolvedValue([])
    personService.create.mockResolvedValue({
      person: {
        _id: 'bob-id',
        firstName: 'Bob',
        lastName: 'Expert',
        email: 'd.e.bexpert.26.abc123@tpiorganizer.ch',
        roles: ['expert'],
        isActive: true,
        sendEmails: false
      }
    })

    renderPage('/parties-prenantes?year=2026&name=Bob%20Expert&role=expert&returnTo=https%3A%2F%2Fevil.test%2Ftpi')

    expect(await screen.findByDisplayValue('Bob')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Créer$/ }))

    await waitFor(() => {
      expect(personService.create).toHaveBeenCalled()
    })
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Parties prenantes' })).toBeInTheDocument()
  })

  it('importe un lot de parties prenantes avec les options normalisées', async () => {
    personService.getAll.mockResolvedValue([])
    personService.importFromContent.mockResolvedValue({
      created: 1,
      updated: 0,
      duplicates: 0,
      skipped: 0
    })

    renderPage()

    fireEvent.click(screen.getByRole('tab', { name: 'Import' }))

    fireEvent.change(screen.getByPlaceholderText('Nom;email;tel;site'), {
      target: {
        value: [
          'Expert;email;tel;site',
          'Bob Expert;bob@example.com;079 000 00 00;Vennes'
        ].join('\n')
      }
    })
    const importPanel = screen.getByRole('heading', { name: 'CSV / TSV' }).closest('section')
    fireEvent.click(within(importPanel).getByRole('button', { name: 'Importer' }))

    await waitFor(() => {
      expect(personService.importFromContent).toHaveBeenCalledWith(
        expect.stringContaining('Bob Expert'),
        {
          defaultSite: '',
          defaultRoles: ['expert']
        }
      )
    })
  })
})
