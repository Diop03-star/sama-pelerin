import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PlanPaiementSection from './PlanPaiementSection'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), auth: { getUser: vi.fn() } }))

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))
vi.mock('../../hooks/useAgence', () => ({
  useAgence: () => ({ data: { id: 'ag1' } }),
}))

const insertPaiement = vi.fn()

const planSolde = {
  id: 'plan1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  montant_total: 1000000,
  nombre_tranches: 2,
  created_at: '2026-01-01T00:00:00Z',
  tranches: [
    { id: 't1', plan_paiement_id: 'plan1', numero_tranche: 1, montant_prevu: 500000, date_echeance: '2026-02-01', statut: 'payee', paiements: [{ id: 'p1', tranche_id: 't1', montant_paye: 500000, mode: 'especes', reference: null, date_paiement: '2026-01-15T10:00:00Z' }] },
    { id: 't2', plan_paiement_id: 'plan1', numero_tranche: 2, montant_prevu: 500000, date_echeance: '2026-03-01', statut: 'payee', paiements: [{ id: 'p2', tranche_id: 't2', montant_paye: 500000, mode: 'especes', reference: null, date_paiement: '2026-02-15T10:00:00Z' }] },
  ],
}

const planNonSolde = {
  id: 'plan1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  montant_total: 1000000,
  nombre_tranches: 2,
  created_at: '2026-01-01T00:00:00Z',
  tranches: [
    { id: 't1', plan_paiement_id: 'plan1', numero_tranche: 1, montant_prevu: 500000, date_echeance: '2026-02-01', statut: 'payee', paiements: [{ id: 'p1', tranche_id: 't1', montant_paye: 500000, mode: 'especes', reference: null, date_paiement: '2026-01-15T10:00:00Z' }] },
    { id: 't2', plan_paiement_id: 'plan1', numero_tranche: 2, montant_prevu: 500000, date_echeance: '2026-03-01', statut: 'a_venir', paiements: [] },
  ],
}

function rendre(plan: typeof planSolde) {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'plans_paiement') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: plan, error: null }) }) }) }
    }
    if (table === 'paiements') {
      return { insert: insertPaiement }
    }
    if (table === 'utilisateurs') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'u2' }, error: null }) }) }) }
    }
    return { select: () => Promise.resolve({ data: [], error: null }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PlanPaiementSection pelerinId="pel1" />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  insertPaiement.mockReset()
  insertPaiement.mockResolvedValue({ error: null })
  mockSupabase.auth.getUser.mockReset()
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
})

describe('PlanPaiementSection', () => {
  it('affiche le badge « Plan soldé » et aucun bouton Encaisser quand le plan est soldé', async () => {
    rendre(planSolde)
    expect(await screen.findByText('Plan soldé')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encaisser' })).not.toBeInTheDocument()
  })

  it('affiche le bouton Encaisser sur la tranche non payée quand le plan n’est pas soldé', async () => {
    rendre(planNonSolde)
    expect(await screen.findByRole('button', { name: 'Encaisser' })).toBeInTheDocument()
  })

  it('désactive le bouton et refuse le montant qui dépasse le reste dû', async () => {
    rendre(planNonSolde)
    fireEvent.click(await screen.findByRole('button', { name: 'Encaisser' }))
    const champ = await screen.findByLabelText('Montant (FCFA)')
    expect(champ).toHaveAttribute('max', '500000')
    fireEvent.change(champ, { target: { value: '600000' } })
    expect(screen.getAllByRole('button', { name: 'Encaisser' })[1]).toBeDisabled()
    expect(insertPaiement).not.toHaveBeenCalled()
  })

  it('encaissement valide : insère le paiement avec les bonnes valeurs', async () => {
    rendre(planNonSolde)
    fireEvent.click(await screen.findByRole('button', { name: 'Encaisser' }))
    fireEvent.change(await screen.findByLabelText('Montant (FCFA)'), { target: { value: '200000' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Encaisser' })[1])
    await waitFor(() => {
      expect(insertPaiement).toHaveBeenCalled()
    })
    const [ligne] = insertPaiement.mock.calls[0]
    expect(ligne).toMatchObject({
      agence_id: 'ag1',
      tranche_id: 't2',
      montant_paye: 200000,
      mode: 'especes',
      reference: null,
      enregistre_par: 'u2',
    })
  })

  it('affiche le motif explicite quand le serveur refuse pour plan soldé', async () => {
    insertPaiement.mockResolvedValue({
      error: { message: 'Encaissement refusé : le plan de paiement est soldé ou le montant dépasse le reste dû.' },
    })
    rendre(planNonSolde)
    fireEvent.click(await screen.findByRole('button', { name: 'Encaisser' }))
    fireEvent.change(await screen.findByLabelText('Montant (FCFA)'), { target: { value: '200000' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Encaisser' })[1])
    expect(await screen.findByText('Encaissement impossible. Le plan de paiement est soldé ou le montant dépasse le reste dû.')).toBeInTheDocument()
  })
})