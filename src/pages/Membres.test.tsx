import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Membres from './Membres'

const mockSupabase = vi.hoisted(() => {
  const eq = vi.fn<() => Promise<{ data: null; error: { message: string } | null }>>(() => Promise.resolve({ data: null, error: null }))
  return {
    from: vi.fn(),
    delete: vi.fn(() => ({ eq })),
    eq,
  }
})
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
  mockSupabase.eq.mockClear()
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

  it('affiche le bouton Retirer pour un autre membre', async () => {
    const autreMembre = { ...membreFixture, id: 'u2', user_id: 'auth2', nom: 'Fatou Diop' }
    rendre({ membres: [membreFixture, autreMembre], invitations: [] })
    expect((await screen.findAllByText('Fatou Diop')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTitle('Retirer').length).toBeGreaterThanOrEqual(1)
  })

  it('affiche les cartes invitations avec date d’expiration', async () => {
    rendre({ membres: [], invitations: [invitationFixture] })
    expect((await screen.findAllByText('invite@example.com')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Expire le : 01/02/2026')).toBeInTheDocument()
  })

  it('affiche le bouton Annuler sur les invitations en attente', async () => {
    rendre({ membres: [], invitations: [invitationFixture] })
    expect((await screen.findAllByText('invite@example.com')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTitle('Annuler').length).toBeGreaterThanOrEqual(1)
  })

  it('affiche un état vide pour les membres', async () => {
    rendre({ membres: [], invitations: [] })
    expect((await screen.findAllByText('Aucun membre pour le moment.')).length).toBeGreaterThanOrEqual(1)
  })

  it('affiche « Lien copié » après la copie du lien d’invitation', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    vi.stubGlobal('crypto', { randomUUID: () => 'tok-test' })
    const queryClient = new QueryClient()
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'utilisateurs') {
        return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }), delete: mockSupabase.delete }
      }
      if (table === 'invitations') {
        return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }), insert: () => Promise.resolve({ data: null, error: null }), delete: mockSupabase.delete }
      }
      return {}
    })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Membres />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'agent@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Générer le lien' }))
    await screen.findByText(/Lien d’invitation à partager/)
    fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/signup?invite=tok-test'))
    await screen.findByRole('button', { name: 'Lien copié' })
  })

  it('ouvre une modale de confirmation au clic sur Retirer sans supprimer', async () => {
    const autreMembre = { ...membreFixture, id: 'u2', user_id: 'auth2', nom: 'Fatou Diop' }
    rendre({ membres: [membreFixture, autreMembre], invitations: [] })
    fireEvent.click((await screen.findAllByTitle('Retirer'))[0])
    expect(await screen.findByText(/Retirer « Fatou Diop » de votre agence/)).toBeInTheDocument()
    expect(mockSupabase.eq).not.toHaveBeenCalled()
  })

  it('supprime le membre après confirmation dans la modale', async () => {
    const autreMembre = { ...membreFixture, id: 'u2', user_id: 'auth2', nom: 'Fatou Diop' }
    rendre({ membres: [membreFixture, autreMembre], invitations: [] })
    fireEvent.click((await screen.findAllByTitle('Retirer'))[0])
    const modale = screen.getByText(/Retirer « Fatou Diop » de votre agence/).closest('.rounded-card') as HTMLElement
    fireEvent.click(within(modale).getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'u2'))
    await waitFor(() => expect(screen.queryByText(/Retirer « Fatou Diop » de votre agence/)).not.toBeInTheDocument())
  })

  it('ne supprime pas le membre si annulation dans la modale', async () => {
    const autreMembre = { ...membreFixture, id: 'u2', user_id: 'auth2', nom: 'Fatou Diop' }
    rendre({ membres: [membreFixture, autreMembre], invitations: [] })
    fireEvent.click((await screen.findAllByTitle('Retirer'))[0])
    const modale = screen.getByText(/Retirer « Fatou Diop » de votre agence/).closest('.rounded-card') as HTMLElement
    fireEvent.click(within(modale).getByRole('button', { name: 'Annuler' }))
    expect(mockSupabase.eq).not.toHaveBeenCalled()
    expect(screen.queryByText(/Retirer « Fatou Diop » de votre agence/)).not.toBeInTheDocument()
  })

  it('ouvre une modale de confirmation au clic sur Annuler d’une invitation sans supprimer', async () => {
    rendre({ membres: [], invitations: [invitationFixture] })
    fireEvent.click((await screen.findAllByTitle('Annuler'))[0])
    expect(await screen.findByText(/Annuler l’invitation de « invite@example.com »/)).toBeInTheDocument()
    expect(mockSupabase.eq).not.toHaveBeenCalled()
  })

  it('annule l’invitation après confirmation dans la modale', async () => {
    rendre({ membres: [], invitations: [invitationFixture] })
    fireEvent.click((await screen.findAllByTitle('Annuler'))[0])
    const modale = screen.getByText(/Annuler l’invitation de « invite@example.com »/).closest('.rounded-card') as HTMLElement
    fireEvent.click(within(modale).getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'i1'))
    await waitFor(() => expect(screen.queryByText(/Annuler l’invitation de « invite@example.com »/)).not.toBeInTheDocument())
  })

  it('ne supprime pas l’invitation si annulation dans la modale', async () => {
    rendre({ membres: [], invitations: [invitationFixture] })
    fireEvent.click((await screen.findAllByTitle('Annuler'))[0])
    const modale = screen.getByText(/Annuler l’invitation de « invite@example.com »/).closest('.rounded-card') as HTMLElement
    fireEvent.click(within(modale).getByRole('button', { name: 'Annuler' }))
    expect(mockSupabase.eq).not.toHaveBeenCalled()
    expect(screen.queryByText(/Annuler l’invitation de « invite@example.com »/)).not.toBeInTheDocument()
  })

  it('affiche une erreur dans la modale si la suppression du membre échoue', async () => {
    const autreMembre = { ...membreFixture, id: 'u2', user_id: 'auth2', nom: 'Fatou Diop' }
    rendre({ membres: [membreFixture, autreMembre], invitations: [] })
    mockSupabase.eq.mockReturnValueOnce(Promise.resolve({ data: null, error: { message: 'FK violation' } }))
    fireEvent.click((await screen.findAllByTitle('Retirer'))[0])
    const modale = screen.getByText(/Retirer « Fatou Diop » de votre agence/).closest('.rounded-card') as HTMLElement
    fireEvent.click(within(modale).getByRole('button', { name: 'Confirmer' }))
    expect(await screen.findByText('Impossible de supprimer le membre.')).toBeInTheDocument()
    expect(screen.getByText(/Retirer « Fatou Diop » de votre agence/)).toBeInTheDocument()
  })
})
