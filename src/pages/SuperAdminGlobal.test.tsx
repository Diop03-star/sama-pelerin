import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SuperAdminGlobal from './SuperAdminGlobal'

const mockSupabase = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const fixture: Array<Record<string, unknown>> = [
  {
    agence_id: 'a1', agence_nom: 'Al Hidjah', agence_active: true,
    pelerins_total: 12, dossiers_valides: 4, dossiers_complets: 3, dossiers_incomplets: 5,
    groupes_total: 2, places_restantes: 8,
    gerants: 1, agents: 2,
    encaissements_total: 1500000, encaissements_30j: 400000,
    tranches_en_retard: 1, rappels_attente: 2, rappels_echec: 1,
  },
]

const queryClient = new QueryClient()

beforeEach(() => {
  mockSupabase.rpc.mockReset()
  mockSupabase.rpc.mockResolvedValue({ data: fixture, error: null })
})

describe('SuperAdminGlobal', () => {
  it('affiche les indicateurs globaux et le tableau des agences', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminGlobal />
      </QueryClientProvider>
    )
    expect(await screen.findByText('Vue d’ensemble')).toBeInTheDocument()
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
    expect(screen.getByText('400 000 FCFA')).toBeInTheDocument()
    expect(screen.getByText('Al Hidjah')).toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.textContent === '2 attente / 1 échec')).toBeInTheDocument()
  })

  it("affiche un badge Désactivée pour une agence inactive", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ ...fixture[0], agence_active: false, agence_nom: 'Agence X' }],
      error: null,
    })
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminGlobal />
      </QueryClientProvider>
    )
    expect(await screen.findByText('Désactivée')).toBeInTheDocument()
  })
})
