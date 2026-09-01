import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Membres from './Membres'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
}))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const mockUseProfil = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useAgence', () => ({ useProfil: () => mockUseProfil() }))

const membreFixture = {
  id: 'u1', user_id: 'auth1', agence_id: 'a1', nom: 'Moussa Ndiaye', telephone: '771234567',
  email: 'moussa@alhidjah.sn', role: 'gerant', created_at: '2026-01-01T00:00:00Z',
}

const invitationFixture = {
  id: 'i1', agence_id: 'a1', email: 'invite@example.com', role: 'agent', token: 'tok',
  created_by: 'u1', created_at: '2026-01-01T00:00:00Z', expires_at: '2026-02-01T12:00:00Z', used_at: null,
}

function rendre({ membres, invitations }: { membres: unknown[]; invitations: unknown[] }) {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'utilisateurs') {
      return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: membres, error: null }) }) }), delete: mockSupabase.delete }
    }
    if (table === 'invitations') {
      return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: invitations, error: null }) }) }), delete: mockSupabase.delete }
    }
    return {}
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Membres />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockUseProfil.mockReset()
  mockSupabase.delete.mockClear()
  mockUseProfil.mockReturnValue({ data: { id: 'u1', user_id: 'auth1', agence_id: 'a1' }, isLoading: false })
})

describe('Membres', () => {
  it('affiche les cartes membres avec nom, email et rôle', async () => {
    rendre({ membres: [membreFixture], invitations: [] })
    expect((await screen.findAllByText('Moussa Ndiaye')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('moussa@alhidjah.sn').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Gérant').length).toBeGreaterThanOrEqual(1)
  })

  it('ne montre pas le bouton Retirer pour soi-même', async () => {
    rendre({ membres: [membreFixture], invitations: [] })
    expect((await screen.findAllByText('Moussa Ndiaye')).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByTitle('Retirer')).not.toBeInTheDocument()
  })

  it('affiche les cartes invitations avec date d’expiration', async () => {
    rendre({ membres: [], invitations: [invitationFixture] })
    expect((await screen.findAllByText('invite@example.com')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Expire le : 01/02/2026')).toBeInTheDocument()
  })

  it('affiche un état vide pour les membres', async () => {
    rendre({ membres: [], invitations: [] })
    expect((await screen.findAllByText('Aucun membre pour le moment.')).length).toBeGreaterThanOrEqual(1)
  })
})
