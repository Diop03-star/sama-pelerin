import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SuperAdminAgenceDetail from './SuperAdminAgenceDetail'

const mockSupabase = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}))

const update = vi.fn()

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const statsFixture = {
  agence_id: 'a1', agence_nom: 'Al Hidjah', agence_active: true,
  pelerins_total: 12, dossiers_valides: 4, dossiers_complets: 3, dossiers_incomplets: 5,
  groupes_total: 2, places_restantes: 8,
  gerants: 1, agents: 2,
  encaissements_total: 1500000, encaissements_30j: 400000,
  tranches_en_retard: 1, rappels_attente: 2, rappels_echec: 1,
}

const agenceFixture = {
  id: 'a1', nom: 'Al Hidjah', telephone: '771234567', email: 'contact@alhidjah.sn',
  adresse: 'Dakar', logo_url: null, created_at: '2026-01-01', active: true,
}

function rendre(agence: unknown = agenceFixture, stats: unknown[] = [statsFixture]) {
  const queryClient = new QueryClient()
  mockSupabase.rpc.mockResolvedValue({ data: stats, error: null })
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'agences') {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: agence, error: null }) }) }),
        update,
      }
    }
    return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/superadmin/agences/a1']}>
        <Routes>
          <Route path="/superadmin/agences/:id" element={<SuperAdminAgenceDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SuperAdminAgenceDetail', () => {
  beforeEach(() => {
    update.mockReset()
    update.mockReturnValue({ eq: () => Promise.resolve({ data: null, error: null }) })
  })

  it('affiche les infos et les stats de l’agence', async () => {
    rendre()
    expect(await screen.findByText('Al Hidjah')).toBeInTheDocument()
    expect(screen.getByText('771234567')).toBeInTheDocument()
    expect(screen.getByText('contact@alhidjah.sn')).toBeInTheDocument()
    expect(screen.getByText('Dakar')).toBeInTheDocument()
    expect(screen.getByText('01/01/2026')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('1 500 000')).toBeInTheDocument()
    expect(screen.getByText('2 attente / 1 échec')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('affiche le badge Désactivée pour une agence inactive', async () => {
    rendre({ ...agenceFixture, active: false }, [{ ...statsFixture, agence_active: false }])
    expect(await screen.findByText('Désactivée')).toBeInTheDocument()
  })

  it('affiche « Agence introuvable. » quand l’id ne correspond à aucune agence', async () => {
    rendre(null, [])
    expect(await screen.findByText('Agence introuvable.')).toBeInTheDocument()
  })

  it('désactive une agence après confirmation', async () => {
    rendre()
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }))
    expect(screen.getByText(/Désactiver « Al Hidjah »/)).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByText('Confirmer'))
      await vi.waitFor(() => {
        expect(update).toHaveBeenCalledWith({ active: false })
      })
    })
  })
})