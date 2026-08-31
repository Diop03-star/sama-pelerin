import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Topbar from './Topbar'

vi.mock('./NotifPanel', () => ({ default: () => <div data-testid="notif-panel">NotifPanel</div> }))
vi.mock('./ProfilMenu', () => ({ default: () => <div data-testid="profil-menu">ProfilMenu</div> }))

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

const mockUseProfil = vi.hoisted(() => vi.fn())
const mockUseAgence = vi.hoisted(() => vi.fn())
vi.mock('../../hooks/useAgence', () => ({
  useProfil: () => mockUseProfil(),
  useAgence: () => mockUseAgence(),
}))

const queryClient = new QueryClient()

beforeEach(() => {
  mockUseProfil.mockReset()
  mockUseAgence.mockReset()
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation(() => ({ select: () => Promise.resolve({ data: [], error: null }) }))
  mockUseProfil.mockReturnValue({ data: { role: 'gerant', nom: 'Moussa' }, isLoading: false })
  mockUseAgence.mockReturnValue({ data: { nom: 'Al Hidjah' }, isLoading: false })
})

describe('Topbar', () => {
  it('intègre le panneau de notifications et le menu profil', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Topbar onOuvrirMenu={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByTestId('notif-panel')).toBeInTheDocument()
    expect(screen.getByTestId('profil-menu')).toBeInTheDocument()
  })

  it('lie le bouton Aide vers /tutoriels', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Topbar onOuvrirMenu={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByRole('link', { name: 'Aide' })).toHaveAttribute('href', '/tutoriels')
  })

  it("affiche l'icône Aide sur mobile (pas de classe hidden)", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Topbar onOuvrirMenu={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByRole('link', { name: 'Aide' }).className).not.toContain('hidden')
  })
})