import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import NotifPanel from './NotifPanel'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const rappelTranche = {
  id: 'r1',
  statut_envoi: 'en_attente',
  date_envoi_prevue: '2026-09-01T12:00:00Z',
  tranche: {
    numero_tranche: 2,
    montant_prevu: 500000,
    date_echeance: '2026-09-01',
    plan_paiement: { pelerin: { id: 'p1', prenom: 'Awa', nom: 'Ndiaye' } },
  },
  document: null,
}

const rappelEchec = {
  id: 'r2',
  statut_envoi: 'echec',
  date_envoi_prevue: '2026-09-02T12:00:00Z',
  tranche: null,
  document: { type_document: 'passeport', statut: 'manquant', pelerin: { id: 'p2', prenom: 'Omar', nom: 'Fall' } },
}

function mockRappels(data: unknown[] | null, error: unknown = null) {
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'rappels') {
      return {
        select: () => ({
          in: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data, error }),
            }),
          }),
        }),
      }
    }
    return {}
  })
}

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tableau-de-bord']}>
        <Routes>
          <Route path="/tableau-de-bord" element={<NotifPanel />} />
          <Route path="/details-du-pelerin/:id" element={<div>Fiche pelerin</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockRappels([], null)
})

describe('NotifPanel', () => {
  it('masque le panneau au départ', () => {
    rendre()
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('affiche les rappels en attente au clic sur la cloche', async () => {
    mockRappels([rappelTranche])
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Awa Ndiaye')).toBeInTheDocument()
    expect(screen.getByText(/Tranche 2/)).toBeInTheDocument()
    expect(screen.getByText('En attente')).toBeInTheDocument()
    expect(screen.getByText(/01\/09\/2026/)).toBeInTheDocument()
  })

  it('affiche aussi les rappels en échec avec leur badge', async () => {
    mockRappels([rappelTranche, rappelEchec])
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Omar Fall')).toBeInTheDocument()
    expect(screen.getByText('Échec')).toBeInTheDocument()
    expect(screen.getByText(/Passeport/)).toBeInTheDocument()
  })

  it('affiche le compteur sur la pastille', async () => {
    mockRappels([rappelTranche, rappelEchec])
    rendre()
    expect(await screen.findByText('2')).toBeInTheDocument()
  })

  it('affiche un état vide quand aucun rappel', async () => {
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Aucune notification')).toBeInTheDocument()
  })

  it('affiche un message quand la requête échoue', async () => {
    mockRappels(null, new Error('boom'))
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Impossible de charger les notifications')).toBeInTheDocument()
  })

  it('navigue vers la fiche du pèlerin au clic sur un item', async () => {
    mockRappels([rappelTranche])
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    fireEvent.click(await screen.findByText('Awa Ndiaye'))
    expect(await screen.findByText('Fiche pelerin')).toBeInTheDocument()
  })

  it('ferme le panneau au clic extérieur', async () => {
    mockRappels([rappelTranche])
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Awa Ndiaye')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Awa Ndiaye')).not.toBeInTheDocument()
  })

  it('plafonne la largeur du panneau à la taille de l’écran (mobile)', async () => {
    mockRappels([rappelTranche])
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    const panneau = (await screen.findByText('Notifications')).parentElement
    expect(panneau?.className).toContain('max-w-[calc(100vw-2rem)]')
  })
})