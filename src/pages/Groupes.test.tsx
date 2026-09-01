import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Groupes from './Groupes'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
  delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
}))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const mockAgence = vi.hoisted(() => ({ data: { id: 'a1', nom: 'Al Hidjah' }, isLoading: false }))
vi.mock('../hooks/useAgence', () => ({ useAgence: () => mockAgence }))

const groupeFixture = {
  id: 'g1', agence_id: 'a1', nom: 'Hajj 2027', type_voyage: 'hajj',
  date_depart: '2027-04-01', date_retour: '2027-04-30', nb_places_max: 10, created_at: '2026-01-01T00:00:00Z',
  pelerins: [{ count: 7 }],
}

function rendre(data: unknown[] = [groupeFixture]) {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'groupes') {
      return {
        select: () => ({ order: () => Promise.resolve({ data, error: null }) }),
        update: mockSupabase.update,
        delete: mockSupabase.delete,
      }
    }
    return {}
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Groupes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Groupes', () => {
  it('affiche les cartes mobiles avec nom, type, dates et places', async () => {
    rendre()
    expect((await screen.findAllByText('Hajj 2027')).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText('Hajj')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Départ : 01/04/2027')).toBeInTheDocument()
    expect(screen.getByText('Retour : 30/04/2027')).toBeInTheDocument()
    expect(screen.getByText('Places : 7 / 10')).toBeInTheDocument()
  })

  it('affiche les boutons Modifier et Supprimer sur les cartes', async () => {
    rendre()
    expect((await screen.findAllByTitle('Modifier')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTitle('Supprimer').length).toBeGreaterThanOrEqual(1)
  })

  it('affiche un état vide sur les cartes', async () => {
    rendre([])
    expect((await screen.findAllByText('Aucun groupe. Créez votre premier groupe Hajj ou Omra.')).length).toBeGreaterThanOrEqual(1)
  })
})
