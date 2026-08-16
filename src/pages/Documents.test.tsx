import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Documents from './Documents'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))
vi.mock('../hooks/useAgence', () => ({
  useAgence: () => ({ data: { id: 'ag1' } }),
}))

const upsert = vi.fn()

function rendre() {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'documents') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
        upsert,
      }
    }
    if (table === 'pelerins') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [{ id: 'p1', prenom: 'Awa', nom: 'Ndiaye' }], error: null }) }),
      }
    }
    return { select: () => Promise.resolve({ data: [], error: null }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Documents />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  upsert.mockReset()
  upsert.mockResolvedValue({ error: null })
})

describe('Documents', () => {
  it('valide un document sans fichier pour le pèlerin choisi', async () => {
    rendre()
    await screen.findByText('Awa Ndiaye')
    fireEvent.change(screen.getByLabelText('Pèlerin'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider sans fichier' }))
    await waitFor(() => {
      expect(upsert).toHaveBeenCalled()
    })
    const [ligne] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({ agence_id: 'ag1', pelerin_id: 'p1', statut: 'valide' })
    expect(ligne.fichier_url).toBeUndefined()
  })

  it('désactive le bouton tant qu’aucun pèlerin n’est choisi', async () => {
    rendre()
    expect(await screen.findByRole('button', { name: 'Valider sans fichier' })).toBeDisabled()
  })
})