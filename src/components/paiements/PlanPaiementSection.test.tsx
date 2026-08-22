import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PlanPaiementSection from './PlanPaiementSection'
import { proposerDateLimite } from '../../lib/plan'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), auth: { getUser: vi.fn() } }))

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))
vi.mock('../../hooks/useAgence', () => ({
  useAgence: () => ({ data: { id: 'ag1' } }),
}))

const insertPaiement = vi.fn()
const insertPlan = vi.fn()
const insertTranches = vi.fn()

const planSolde = {
  id: 'plan1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  montant_total: 1000000,
  montant_acompte: 400000,
  date_limite_solde: '2026-03-16',
  statut: 'solde',
  nombre_tranches: 2,
  created_at: '2026-01-01T00:00:00Z',
  acomptes: [{ id: 'ac1', tranche_id: null, plan_paiement_id: 'plan1', montant_paye: 400000, date_paiement: '2026-01-15T10:00:00Z', mode: 'especes', reference: null, type_paiement: 'acompte', agence_id: 'ag1' }],
  tranches: [
    { id: 't1', plan_paiement_id: 'plan1', numero_tranche: 1, montant_prevu: 500000, date_echeance: '2026-02-01', statut: 'payee', paiements: [{ id: 'p1', tranche_id: 't1', montant_paye: 500000, mode: 'especes', reference: null, date_paiement: '2026-01-15T10:00:00Z', type_paiement: 'tranche', plan_paiement_id: 'plan1', agence_id: 'ag1' }] },
    { id: 't2', plan_paiement_id: 'plan1', numero_tranche: 2, montant_prevu: 500000, date_echeance: '2026-03-01', statut: 'payee', paiements: [{ id: 'p2', tranche_id: 't2', montant_paye: 500000, mode: 'especes', reference: null, date_paiement: '2026-02-15T10:00:00Z', type_paiement: 'tranche', plan_paiement_id: 'plan1', agence_id: 'ag1' }] },
  ],
}

const planNonSolde = {
  id: 'plan1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  montant_total: 1000000,
  montant_acompte: 400000,
  date_limite_solde: '2026-03-16',
  statut: 'en_cours',
  nombre_tranches: 2,
  created_at: '2026-01-01T00:00:00Z',
  acomptes: [],
  tranches: [
    { id: 't1', plan_paiement_id: 'plan1', numero_tranche: 1, montant_prevu: 500000, date_echeance: '2026-02-01', statut: 'payee', paiements: [{ id: 'p1', tranche_id: 't1', montant_paye: 500000, mode: 'especes', reference: null, date_paiement: '2026-01-15T10:00:00Z', type_paiement: 'tranche', plan_paiement_id: 'plan1', agence_id: 'ag1' }] },
    { id: 't2', plan_paiement_id: 'plan1', numero_tranche: 2, montant_prevu: 500000, date_echeance: '2026-03-01', statut: 'a_venir', paiements: [] },
  ],
}

function rendre(plan: typeof planSolde | null, groupe?: { type_voyage: 'hajj' | 'omra'; date_depart: string }) {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'plans_paiement') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: plan, error: null }) }) }), insert: insertPlan }
    }
    if (table === 'paiements') {
      return { insert: insertPaiement }
    }
    if (table === 'tranches') {
      return { insert: insertTranches }
    }
    if (table === 'utilisateurs') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'u2' }, error: null }) }) }) }
    }
    return { select: () => Promise.resolve({ data: [], error: null }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PlanPaiementSection pelerinId="pel1" groupe={groupe ?? null} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  insertPaiement.mockReset()
  insertPaiement.mockResolvedValue({ error: null })
  insertPlan.mockReset()
  insertPlan.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'plan1' }, error: null }) }) })
  insertTranches.mockReset()
  insertTranches.mockResolvedValue({ error: null })
  mockSupabase.auth.getUser.mockReset()
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
})

describe('PlanPaiementSection', () => {
  it('affiche le badge « Soldé » et aucun bouton Encaisser quand le plan est soldé', async () => {
    rendre(planSolde)
    expect(await screen.findByText('Soldé')).toBeInTheDocument()
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

  it('affiche le badge statut du plan et la date limite du solde', async () => {
    rendre({ ...planNonSolde, statut: 'en_retard', date_limite_solde: '2026-01-01' })
    expect(await screen.findByText('En retard')).toBeInTheDocument()
    expect(screen.getByText((_, node) => node?.textContent === 'Solde à régler avant le 01/01/2026')).toBeInTheDocument()
  })

  it('affiche le badge « Acompte en attente » quand l’acompte n’est pas payé', async () => {
    rendre({ ...planNonSolde, statut: 'acompte_en_attente', montant_acompte: 400000 })
    expect(await screen.findByText('Acompte en attente')).toBeInTheDocument()
  })

  it('encaissement de l’acompte : payload avec type_paiement acompte et tranche_id null', async () => {
    rendre({ ...planNonSolde, montant_acompte: 400000 })
    fireEvent.click(await screen.findByRole('button', { name: 'Encaisser l’acompte' }))
    const champ = await screen.findByLabelText('Montant (FCFA)')
    expect(champ).toHaveAttribute('max', '400000')
    fireEvent.change(champ, { target: { value: '400000' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Encaisser' })[1])
    await waitFor(() => {
      expect(insertPaiement).toHaveBeenCalled()
    })
    const [ligne] = insertPaiement.mock.calls[0]
    expect(ligne).toMatchObject({
      agence_id: 'ag1',
      tranche_id: null,
      plan_paiement_id: 'plan1',
      montant_paye: 400000,
      type_paiement: 'acompte',
    })
  })

  it('le payé inclut l’acompte : plan soldé avec acompte + tranches payées', async () => {
    rendre({
      ...planNonSolde,
      statut: 'solde',
      montant_acompte: 400000,
      acomptes: [{ id: 'ac1', tranche_id: null, plan_paiement_id: 'plan1', montant_paye: 400000, date_paiement: '2026-01-15T10:00:00Z', mode: 'especes', reference: null, type_paiement: 'acompte', agence_id: 'ag1' }],
      tranches: [
        planNonSolde.tranches[0],
        { ...planNonSolde.tranches[1], paiements: [{ id: 'p3', tranche_id: 't2', montant_paye: 100000, mode: 'especes', reference: null, date_paiement: '2026-02-01T10:00:00Z', type_paiement: 'tranche', plan_paiement_id: 'plan1', agence_id: 'ag1' }] },
      ],
    })
    expect(await screen.findByText('Soldé')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encaisser' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encaisser l’acompte' })).not.toBeInTheDocument()
  })

  it('plafonne l’encaissement de tranche au reste du plan incluant l’acompte', async () => {
    rendre({ ...planNonSolde, montant_acompte: 400000 })
    fireEvent.click((await screen.findAllByRole('button', { name: 'Encaisser' }))[0])
    const champ = await screen.findByLabelText('Montant (FCFA)')
    expect(champ).toHaveAttribute('max', '500000')
  })

  it('pré-remplit l’acompte et la date limite selon le groupe (Hajj)', async () => {
    rendre(null, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    expect(await screen.findByLabelText('Montant total (FCFA)')).toHaveValue(null)
    expect(screen.getByLabelText('Acompte (FCFA)')).toHaveValue(0)
    expect(screen.getByLabelText('Date limite du solde')).toHaveValue(proposerDateLimite('2026-05-15', 'hajj'))
  })

  it('propose l’acompte et la date limite après saisie du montant total (Omra)', async () => {
    rendre(null, { type_voyage: 'omra', date_depart: '2026-06-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    expect(screen.getByLabelText('Acompte (FCFA)')).toHaveValue(600000)
    expect(screen.getByLabelText('Date limite du solde')).toHaveValue('2026-05-16')
  })

  it('affiche un échéancier éditable et répartit le reste', async () => {
    rendre(null, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    fireEvent.change(screen.getByLabelText('Acompte (FCFA)'), { target: { value: '400000' } })
    fireEvent.change(screen.getByLabelText('Nombre de tranches'), { target: { value: '3' } })
    const montants = within(screen.getByRole('table')).getAllByLabelText('Montant de la tranche')
    expect(montants).toHaveLength(3)
    expect(montants[0]).toHaveValue(200000)
    expect(screen.getByText('Reste à répartir : 0 FCFA')).toBeInTheDocument()
  })

  it('régénère l’échéancier avec le nouveau nombre de tranches', async () => {
    rendre(null, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    fireEvent.change(screen.getByLabelText('Acompte (FCFA)'), { target: { value: '400000' } })
    fireEvent.change(screen.getByLabelText('Nombre de tranches'), { target: { value: '2' } })
    expect(within(screen.getByRole('table')).getAllByLabelText('Montant de la tranche')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Créer le plan' }))
    await waitFor(() => {
      expect(insertPlan).toHaveBeenCalled()
    })
    const [ligne] = insertPlan.mock.calls[0]
    expect(ligne).toMatchObject({ nombre_tranches: 2 })
    const [tranches] = insertTranches.mock.calls[0]
    expect(tranches).toHaveLength(2)
  })

  it('bloque la création quand la répartition est incorrecte', async () => {
    rendre(null, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    fireEvent.change(screen.getByLabelText('Acompte (FCFA)'), { target: { value: '400000' } })
    fireEvent.change(screen.getByLabelText('Nombre de tranches'), { target: { value: '3' } })
    fireEvent.change(screen.getAllByLabelText('Montant de la tranche')[0], { target: { value: '250000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le plan' }))
    expect(await screen.findByText('La répartition doit totaliser 600 000 FCFA.')).toBeInTheDocument()
  })

  it('crée le plan et ses tranches avec acompte et date limite', async () => {
    rendre(null, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    fireEvent.change(screen.getByLabelText('Acompte (FCFA)'), { target: { value: '400000' } })
    fireEvent.change(screen.getByLabelText('Date limite du solde'), { target: { value: '2026-03-16' } })
    fireEvent.change(screen.getByLabelText('Première échéance'), { target: { value: '2026-02-01' } })
    fireEvent.change(screen.getByLabelText('Nombre de tranches'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le plan' }))
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('plans_paiement')
    })
    const [ligne] = insertPlan.mock.calls[0]
    expect(ligne).toMatchObject({
      agence_id: 'ag1',
      pelerin_id: 'pel1',
      montant_total: 1000000,
      montant_acompte: 400000,
      date_limite_solde: '2026-03-16',
      nombre_tranches: 3,
    })
    const [tranches] = insertTranches.mock.calls[0]
    expect(tranches).toHaveLength(3)
    expect(tranches[0]).toMatchObject({ plan_paiement_id: 'plan1', numero_tranche: 1, montant_prevu: 200000, date_echeance: '2026-02-01' })
  })

  it('affiche les tranches en cartes mobiles avec icône poubelle discrète', async () => {
    rendre(null, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    fireEvent.change(screen.getByLabelText('Acompte (FCFA)'), { target: { value: '400000' } })
    fireEvent.change(screen.getByLabelText('Nombre de tranches'), { target: { value: '3' } })
    const cartes = within(screen.getByTestId('cartes-tranches'))
    expect(cartes.getAllByLabelText('Montant de la tranche')).toHaveLength(3)
    expect(cartes.getByText('Tranche 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Retirer la tranche 1')).toBeInTheDocument()
  })

  it('retire une tranche depuis la carte mobile avec la poubelle', async () => {
    rendre(null, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    fireEvent.change(screen.getByLabelText('Acompte (FCFA)'), { target: { value: '400000' } })
    fireEvent.change(screen.getByLabelText('Nombre de tranches'), { target: { value: '3' } })
    fireEvent.click(screen.getByLabelText('Retirer la tranche 1'))
    const cartes = within(screen.getByTestId('cartes-tranches'))
    expect(cartes.getAllByLabelText('Montant de la tranche')).toHaveLength(2)
  })

  it('affiche le bandeau « Reste à répartir » vert à l’équilibre puis orange sinon', async () => {
    rendre(null, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    fireEvent.change(screen.getByLabelText('Acompte (FCFA)'), { target: { value: '400000' } })
    fireEvent.change(screen.getByLabelText('Nombre de tranches'), { target: { value: '3' } })
    const bandeauEquilibre = screen.getByText('Reste à répartir : 0 FCFA').closest('div')
    expect(bandeauEquilibre).toHaveClass('bg-green-50')
    fireEvent.change(screen.getAllByLabelText('Montant de la tranche')[0], { target: { value: '100000' } })
    const bandeauOrange = screen.getByText('Reste à répartir : 100 000 FCFA').closest('div')
    expect(bandeauOrange).toHaveClass('bg-amber-50')
  })
})