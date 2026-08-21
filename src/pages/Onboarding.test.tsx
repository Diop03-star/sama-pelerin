import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Onboarding from './Onboarding'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const mockProfil = vi.hoisted(() => ({
  data: { user_id: 'u1', nom: 'Moussa', agence_id: null, role: 'agent' },
  isLoading: false,
}))
vi.mock('../hooks/useAgence', () => ({ useProfil: () => mockProfil }))

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return { ...original, useNavigate: () => mockNavigate }
})

const queryClient = new QueryClient()

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockNavigate.mockReset()
})

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Onboarding', () => {
  it('crée l’agence via le RPC puis redirige vers le tableau de bord', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 'agence-1', error: null })

    rendre()
    fireEvent.change(screen.getByPlaceholderText('Ex : Al Hidjah Travel Dakar'), { target: { value: 'Al Hidjah Travel' } })
    fireEvent.change(screen.getByPlaceholderText('+221 77 XXX XX XX'), { target: { value: '77 123 45 67' } })
    fireEvent.change(screen.getByPlaceholderText('Dakar, Sénégal'), { target: { value: 'Dakar' } })
    fireEvent.click(screen.getByText('Créer mon agence'))

    await vi.waitFor(() => {
      expect(mockSupabase.rpc).toHaveBeenCalledWith('creer_agence', {
        p_nom: 'Al Hidjah Travel',
        p_telephone: '77 123 45 67',
        p_adresse: 'Dakar',
      })
      expect(mockNavigate).toHaveBeenCalledWith('/tableau-de-bord')
    })
  })
})