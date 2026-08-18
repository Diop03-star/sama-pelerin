import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Documents from './Documents'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const pelerins = [
  {
    id: 'p1', prenom: 'Awa', nom: 'Ndiaye', telephone: '77 123 45 67',
    documents: [
      { type_document: 'passeport', statut: 'valide' },
      { type_document: 'visa', statut: 'valide' },
      { type_document: 'certificat_vaccination', statut: 'valide' },
      { type_document: 'photo', statut: 'valide' },
    ],
  },
  {
    id: 'p2', prenom: 'Fatou', nom: 'Sy', telephone: '77 999 88 77',
    documents: [
      { type_document: 'passeport', statut: 'valide' },
      { type_document: 'visa', statut: 'soumis' },
    ],
  },
]

function rendre(initialEntries = ['/gestion-des-documents']) {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'pelerins') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: pelerins, error: null }) }),
      }
    }
    return { select: () => Promise.resolve({ data: [], error: null }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Documents />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Documents', () => {
  it('affiche une ligne par pèlerin avec le statut du dossier', async () => {
    rendre()
    expect(await screen.findByText('Awa Ndiaye')).toBeInTheDocument()
    expect(screen.getByText('Fatou Sy')).toBeInTheDocument()
    const tableau = within(screen.getByRole('table'))
    expect(tableau.getAllByText('Validé').length).toBe(1)
    expect(tableau.getAllByText('Incomplet').length).toBe(1)
  })

  it('affiche les cartes Total Pèlerins / Dossiers validés / Dossiers incomplets', async () => {
    rendre()
    await screen.findByText('Awa Ndiaye')
    expect(screen.getByText('Total Pèlerins')).toBeInTheDocument()
    expect(screen.getByText('Dossiers validés')).toBeInTheDocument()
    expect(screen.getByText('Dossiers incomplets')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('filtre par type : statut Validé / Manquant pour ce document', async () => {
    rendre()
    await screen.findByText('Awa Ndiaye')
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'visa' } })
    const tableau = within(screen.getByRole('table'))
    expect(tableau.getAllByText('Validé').length).toBe(1)
    expect(tableau.getAllByText('Manquant').length).toBe(1)
  })

  it('filtre par statut', async () => {
    rendre()
    await screen.findByText('Awa Ndiaye')
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'incomplet' } })
    expect(screen.getByText('Fatou Sy')).toBeInTheDocument()
    expect(screen.queryByText('Awa Ndiaye')).not.toBeInTheDocument()
  })

  it('active le filtre passeport via ?alerte=passeport', async () => {
    rendre(['/gestion-des-documents?alerte=passeport'])
    expect(await screen.findByText('Awa Ndiaye')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getAllByText('Validé').length).toBe(2)
  })

  it('ne propose plus le panneau « Valider sans fichier »', async () => {
    rendre()
    await screen.findByText('Awa Ndiaye')
    expect(screen.queryByText('Valider sans fichier')).not.toBeInTheDocument()
  })

  it('lie chaque ligne à la fiche du pèlerin', async () => {
    rendre()
    const lien = await screen.findByRole('link', { name: 'Awa Ndiaye' })
    expect(lien).toHaveAttribute('href', '/details-du-pelerin/p1')
  })
})