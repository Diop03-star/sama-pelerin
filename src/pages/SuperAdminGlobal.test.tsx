import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SuperAdminGlobal from './SuperAdminGlobal'
import { MemoryRouter } from 'react-router-dom'
import { debutPeriode } from '../lib/dates'

const mockSupabase = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const fixture: Array<Record<string, unknown>> = [
  {
    agence_id: 'a1', agence_nom: 'Al Hidjah', agence_active: true,
    pelerins_total: 12, dossiers_valides: 4, dossiers_incomplets: 5,
    groupes_total: 2, places_restantes: 8,
    gerants: 1, agents: 2,
    encaissements_total: 1500000, encaissements_30j: 400000,
    tranches_en_retard: 1, rappels_attente: 2, rappels_echec: 1,
  },
]

const paiements = [
  { montant_paye: 400000, tranche: { plan_paiement: { pelerin: { agence_id: 'a1' } } } },
  { montant_paye: 100000, tranche: { plan_paiement: { pelerin: { agence_id: 'a1' } } } },
  { montant_paye: 50000, tranche: { plan_paiement: { pelerin: { agence_id: 'a2' } } } },
  { montant_paye: 300000, tranche: null, acompte: { pelerin: { agence_id: 'a1' } } },
]

const queryClient = new QueryClient()

beforeEach(() => {
  mockSupabase.rpc.mockReset()
  mockSupabase.from.mockReset()
  mockSupabase.rpc.mockResolvedValue({ data: fixture, error: null })
  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      gte: vi.fn().mockResolvedValue({ data: paiements, error: null }),
    }),
  })
})

describe('SuperAdminGlobal', () => {
  it('affiche les indicateurs globaux, le total encaissé et le tableau des agences', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SuperAdminGlobal />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(await screen.findByText('Vue d’ensemble')).toBeInTheDocument()
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
    expect(screen.getByText('850 000')).toBeInTheDocument()
    expect(screen.getByText('800 000 FCFA')).toBeInTheDocument()
    expect(screen.getByText('Al Hidjah')).toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.textContent === '2 attente / 1 échec')).toBeInTheDocument()
  })

  it('compte les acomptes dans les encaissements par agence', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SuperAdminGlobal />
        </MemoryRouter>
      </QueryClientProvider>
    )
    await screen.findByText('Vue d’ensemble')
    expect(screen.getByText('850 000')).toBeInTheDocument()
  })

  it("affiche un badge Désactivée pour une agence inactive", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ ...fixture[0], agence_active: false, agence_nom: 'Agence X' }],
      error: null,
    })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SuperAdminGlobal />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(await screen.findByText('Désactivée')).toBeInTheDocument()
  })

  it('relance la requête paiements avec la période sélectionnée', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SuperAdminGlobal />
        </MemoryRouter>
      </QueryClientProvider>
    )
    await screen.findByText('Vue d’ensemble')
    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }))
    await waitFor(() => {
      expect(mockSupabase.from.mock.results.length).toBe(2)
    })
    const gte = mockSupabase.from.mock.results[0].value.select().gte
    const datesAppels = gte.mock.calls.map((c: unknown[]) => c[1] as string)
    const reel = new Date(datesAppels[1]).getTime()
    expect(Math.abs(reel - debutPeriode('semaine').getTime())).toBeLessThan(2000)
  })
})