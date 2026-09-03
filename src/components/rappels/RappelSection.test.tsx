import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RappelSection from './RappelSection'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

vi.mock('../../hooks/useAgence', () => ({ useAgence: () => ({ data: { id: 'agence-1' } }) }))

let queryClient: QueryClient

const pelerin = { id: 'pel1', prenom: 'Awa', nom: 'Ndiaye', telephone: '+221 77 123 45 67' }

const tranche3 = { id: 't3', numero_tranche: 3, montant_prevu: 100000, date_echeance: '2026-09-03', statut: 'a_venir', plan_paiement: { montant_total: 1000000 } }
const tranche4 = { id: 't4', numero_tranche: 4, montant_prevu: 100000, date_echeance: '2026-10-03', statut: 'a_venir', plan_paiement: { montant_total: 1000000 } }

function rappelTranche(id: string, trancheId: string, statut_envoi: string) {
  return {
    id,
    statut_envoi,
    date_envoi_prevue: '2026-09-03T12:00:00Z',
    tranche: { id: trancheId, numero_tranche: 3, montant_prevu: 100000, date_echeance: '2026-09-03', plan_paiement: { pelerin_id: 'pel1', montant_total: 1000000 } },
    document: null,
  }
}

function mockQueries({ tranches = [], rappels = [] }: { tranches?: unknown[]; rappels?: unknown[] }) {
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation((table: string) => {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'limit']) builder[m] = () => builder
    builder.single = () => builder
    builder.then = (resolve: (r: { data: unknown; error: null }) => unknown) => {
      let data: unknown = []
      if (table === 'pelerins') data = pelerin
      else if (table === 'tranches') data = tranches
      else if (table === 'documents') data = []
      else if (table === 'rappels') data = rappels
      return resolve({ data, error: null })
    }
    return builder
  })
}

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <RappelSection pelerinId="pel1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

describe('RappelSection — boutons de création', () => {
  it('masque le bouton d’une tranche dont le rappel est déjà envoyé', async () => {
    mockQueries({ tranches: [tranche3, tranche4], rappels: [rappelTranche('r1', 't3', 'envoye')] })
    rendre()
    expect(await screen.findByText('Tranche 3 — 100 000 FCFA')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rappel tranche 3/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rappel tranche 4/ })).toBeInTheDocument()
  })

  it('masque le bouton d’une tranche avec un rappel en attente', async () => {
    mockQueries({ tranches: [tranche3, tranche4], rappels: [rappelTranche('r1', 't3', 'en_attente')] })
    rendre()
    expect(await screen.findByText('Tranche 3 — 100 000 FCFA')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rappel tranche 3/ })).not.toBeInTheDocument()
  })

  it('laisse le bouton si le seul rappel de la tranche est en échec (relance possible)', async () => {
    mockQueries({ tranches: [tranche3, tranche4], rappels: [rappelTranche('r1', 't3', 'echec')] })
    rendre()
    expect(await screen.findByText('Tranche 3 — 100 000 FCFA')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rappel tranche 3/ })).toBeInTheDocument()
  })
})