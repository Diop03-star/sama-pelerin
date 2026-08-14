import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from './AppLayout'

const mockUseProfil = vi.hoisted(() => vi.fn())
const mockUseAgence = vi.hoisted(() => vi.fn())

vi.mock('../../hooks/useAgence', () => ({
  useProfil: () => mockUseProfil(),
  useAgence: () => mockUseAgence(),
}))

const queryClient = new QueryClient()

function renderer(chemin: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/tableau-de-bord" element={<div>Dashboard agence</div>} />
          </Route>
          <Route path="/onboarding" element={<div>Onboarding</div>} />
          <Route path="/superadmin" element={<div>Page superadmin</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockUseProfil.mockReset()
  mockUseAgence.mockReset()
  mockUseProfil.mockReturnValue({ data: null, isLoading: false })
  mockUseAgence.mockReturnValue({ data: undefined, isLoading: false })
})

describe('AppLayout', () => {
  it('redirige le superadmin vers /superadmin', async () => {
    mockUseProfil.mockReturnValue({ data: { role: 'superadmin', agence_id: null }, isLoading: false })
    renderer('/tableau-de-bord')
    expect(await screen.findByText('Page superadmin')).toBeInTheDocument()
  })

  it("affiche l'écran de blocage quand l'agence est désactivée", async () => {
    mockUseProfil.mockReturnValue({ data: { role: 'gerant', agence_id: 'a1' }, isLoading: false })
    mockUseAgence.mockReturnValue({ data: { active: false }, isLoading: false })
    renderer('/tableau-de-bord')
    expect(await screen.findByText('Agence désactivée')).toBeInTheDocument()
  })

  it('redirige vers /onboarding quand aucun agence_id', async () => {
    mockUseProfil.mockReturnValue({ data: { role: 'agent', agence_id: null }, isLoading: false })
    renderer('/tableau-de-bord')
    expect(await screen.findByText('Onboarding')).toBeInTheDocument()
  })
})
