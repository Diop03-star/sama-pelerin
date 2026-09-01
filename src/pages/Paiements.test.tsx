import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Paiements from './Paiements'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const planAvecAcompte = {
  id: 'plan1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  montant_total: 1000000,
  montant_acompte: 400000,
  date_limite_solde: '2026-01-01',
  statut: 'en_retard',
  nombre_tranches: 2,
  created_at: '2026-01-01T00:00:00Z',
  pelerin: { id: 'pel1', prenom: 'Fatou', nom: 'Sy', telephone: '771234567' },
  tranches: [
    { id: 't1', plan_paiement_id: 'plan1', numero_tranche: 1, montant_prevu: 300000, date_echeance: '2026-02-01', statut: 'payee', paiements: [{ id: 'p1', tranche_id: 't1', montant_paye: 300000, date_paiement: '2026-01-15T10:00:00Z', mode: 'especes', reference: null, type_paiement: 'tranche', plan_paiement_id: 'plan1', agence_id: 'ag1' }] },
    { id: 't2', plan_paiement_id: 'plan1', numero_tranche: 2, montant_prevu: 300000, date_echeance: '2026-03-01', statut: 'a_venir', paiements: [] },
  ],
  acomptes: [{ id: 'ac1', tranche_id: null, plan_paiement_id: 'plan1', montant_paye: 200000, date_paiement: '2026-01-10T10:00:00Z', mode: 'especes', reference: null, type_paiement: 'acompte', agence_id: 'ag1' }],
}

const planSansAcompte = {
  id: 'plan2',
  agence_id: 'ag1',
  pelerin_id: 'pel2',
  montant_total: 500000,
  montant_acompte: 0,
  date_limite_solde: null,
  statut: 'en_cours',
  nombre_tranches: 1,
  created_at: '2026-01-01T00:00:00Z',
  pelerin: { id: 'pel2', prenom: 'Awa', nom: 'Ndiaye', telephone: '770000000' },
  tranches: [
    { id: 't3', plan_paiement_id: 'plan2', numero_tranche: 1, montant_prevu: 500000, date_echeance: '2026-04-01', statut: 'a_venir', paiements: [] },
  ],
  acomptes: [],
}

const planDateLimitePassee = {
  id: 'plan3',
  agence_id: 'ag1',
  pelerin_id: 'pel3',
  montant_total: 800000,
  montant_acompte: 200000,
  date_limite_solde: '2026-01-01',
  statut: 'en_cours',
  nombre_tranches: 2,
  created_at: '2026-01-01T00:00:00Z',
  pelerin: { id: 'pel3', prenom: 'Moussa', nom: 'Diop', telephone: '770000001' },
  tranches: [
    { id: 't4', plan_paiement_id: 'plan3', numero_tranche: 1, montant_prevu: 300000, date_echeance: '2026-02-01', statut: 'a_venir', paiements: [] },
    { id: 't5', plan_paiement_id: 'plan3', numero_tranche: 2, montant_prevu: 300000, date_echeance: '2026-03-01', statut: 'a_venir', paiements: [] },
  ],
  acomptes: [{ id: 'ac2', tranche_id: null, plan_paiement_id: 'plan3', montant_paye: 200000, date_paiement: '2026-01-10T10:00:00Z', mode: 'especes', reference: null, type_paiement: 'acompte', agence_id: 'ag1' }],
}

function rendre(plans: unknown[] = [planAvecAcompte, planSansAcompte]) {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'plans_paiement') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: plans, error: null }) }),
      }
    }
    return { select: () => Promise.resolve({ data: [], error: null }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Paiements />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Paiements', () => {
  it('affiche le badge statut du plan et l’encart « solde à régler »', async () => {
    rendre()
    expect((await screen.findAllByText('En retard')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('1 plan(s) dont le solde est à régler')).toBeInTheDocument()
  })

  it('les totaux incluent les acomptes', async () => {
    rendre()
    expect(await screen.findByText('1 500 000 FCFA')).toBeInTheDocument()
    expect(screen.getByText('Total encaissé').nextElementSibling?.textContent).toBe('500 000 FCFA')
    expect(screen.getByText('1 000 000 FCFA')).toBeInTheDocument()
  })

  it('l’encart « solde à régler » inclut les plans à date limite passée même en statut en_cours', async () => {
    rendre([planAvecAcompte, planSansAcompte, planDateLimitePassee])
    expect(await screen.findByText('2 plan(s) dont le solde est à régler')).toBeInTheDocument()
    expect(screen.getByText('Moussa Diop — reste 600 000 FCFA, limite le 01/01/2026.')).toBeInTheDocument()
  })

  it('affiche les cartes mobiles avec plan, payé, reste et tranches', async () => {
    rendre()
    expect((await screen.findAllByText(/Plan : 1 000 000 FCFA · 2 tranches/)).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText(/Payé : 500 000 FCFA/)).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText(/Reste : 500 000 FCFA/)).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText(/Tranche 1 · 300 000 FCFA/)).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText(/Échéance : 01\/02\/2026/)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Voir').length).toBeGreaterThanOrEqual(1)
  })
})
