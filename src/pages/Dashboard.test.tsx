import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

let queryClient: QueryClient

const rappelTranche = {
  id: 'r1',
  statut_envoi: 'en_attente',
  date_envoi_prevue: '2026-09-01T12:00:00Z',
  tranche: {
    numero_tranche: 2,
    montant_prevu: 500000,
    date_echeance: '2026-09-01',
    plan_paiement: { pelerin: { id: 'p1', prenom: 'Awa', nom: 'Ndiaye', telephone: '+221 77 123 45 67' } },
  },
  document: null,
}

const rappelEchec = {
  id: 'r2',
  statut_envoi: 'echec',
  date_envoi_prevue: '2026-09-02T12:00:00Z',
  tranche: null,
  document: { type_document: 'passeport', statut: 'manquant', pelerin: { id: 'p2', prenom: 'Omar', nom: 'Fall', telephone: '+221 76 234 56 78' } },
}

function mockRappels(rows: unknown[]) {
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation((table: string) => {
    const statuts: { valeurs: string[] | null } = { valeurs: null }
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'gte', 'lte', 'limit']) builder[m] = () => builder
    builder.eq = (col: string, val: string) => {
      if (col === 'statut_envoi') statuts.valeurs = [val]
      return builder
    }
    builder.in = (col: string, vals: string[]) => {
      if (col === 'statut_envoi') statuts.valeurs = vals
      return builder
    }
    builder.then = (resolve: (r: { data: unknown; error: null }) => unknown) => {
      const data =
        table === 'rappels'
          ? (rows as { statut_envoi: string }[]).filter((r) => !statuts.valeurs || statuts.valeurs.includes(r.statut_envoi))
          : []
      return resolve({ data, error: null })
    }
    return builder
  })
}

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tableau-de-bord']}>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  mockRappels([])
})

describe('Dashboard — carte Rappels à envoyer', () => {
  it('affiche les rappels en attente', async () => {
    mockRappels([rappelTranche])
    rendre()
    expect(await screen.findByText(/Awa Ndiaye/)).toBeInTheDocument()
  })

  it('affiche aussi les rappels en échec, relançables via WhatsApp', async () => {
    mockRappels([rappelTranche, rappelEchec])
    rendre()
    expect(await screen.findByText(/Awa Ndiaye/)).toBeInTheDocument()
    expect(await screen.findByText(/Omar Fall/)).toBeInTheDocument()
    expect(screen.getByText('Échec')).toBeInTheDocument()
    expect(screen.getAllByTitle('Envoyer sur WhatsApp').length).toBe(2)
  })

  it('affiche l’état vide quand aucun rappel n’est à traiter', async () => {
    rendre()
    expect(await screen.findByText('Aucun rappel à envoyer.')).toBeInTheDocument()
  })
})