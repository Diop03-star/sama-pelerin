import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SuperAdminAgences from './SuperAdminAgences'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const queryClient = new QueryClient()

const agenceFixture = {
  id: 'a1', nom: 'Al Hidjah', telephone: '771234567', email: 'contact@alhidjah.sn',
  adresse: 'Dakar', created_at: '2026-01-01T00:00:00Z', active: true,
}

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'agences') {
      return {
        select: (cols: string) =>
          cols === 'id'
            ? { single: () => Promise.resolve({ data: { id: 'a2' }, error: null }) }
            : { order: () => Promise.resolve({ data: [agenceFixture], error: null }) },
        insert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: { id: 'a2' }, error: null }) }),
        }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      }
    }
    return {
      insert: () => Promise.resolve({ data: null, error: null }),
    }
  })
})

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <SuperAdminAgences />
    </QueryClientProvider>
  )
}

describe('SuperAdminAgences', () => {
  it('affiche la liste des agences', async () => {
    rendre()
    expect(await screen.findByText('Al Hidjah')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('crée une agence puis le compte gérant', async () => {
    rendre()
    fireEvent.click(await screen.findByText('Créer une agence'))
    const champs = screen.getAllByRole('textbox')
    fireEvent.change(champs[0], { target: { value: 'Agence Test' } })
    fireEvent.change(champs[4], { target: { value: 'Gérant Test' } })
    fireEvent.change(champs[5], { target: { value: 'gerant@test.sn' } })
    fireEvent.click(screen.getByText('Créer'))
    await vi.waitFor(() => {
      const tables = mockSupabase.from.mock.calls.map((c) => c[0])
      expect(tables).toContain('agences')
      expect(tables).toContain('utilisateurs')
    })
  })

  it('désactive une agence après confirmation', async () => {
    rendre()
    fireEvent.click(await screen.findByTitle('Désactiver'))
    expect(screen.getByText(/Désactiver « Al Hidjah »/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Confirmer'))
    await vi.waitFor(() => {
      const insertions = mockSupabase.from.mock.calls
      expect(insertions.some((c) => c[0] === 'agences')).toBe(true)
    })
  })
})
