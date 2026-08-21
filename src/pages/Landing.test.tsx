import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Landing from './Landing'
import type { Tutos } from '../lib/types'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const mockAuth = vi.hoisted(() => ({ session: null as { user: { id: string } } | null, loading: false }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => mockAuth }))

const queryClient = new QueryClient()

const tutosPreview: Tutos[] = [
  {
    id: 't1', titre: 'Créer un plan de paiement', description: 'Étape par étape',
    url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ordre: 1, actif: true,
    created_at: '2026-08-01T00:00:00Z',
  },
]

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table !== 'tutos') return {}
    return {
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: tutosPreview, error: null }) }),
        }),
      }),
    }
  })
})

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Landing', () => {
  it('affiche le hero et les CTA de connexion', () => {
    rendre()
    expect(screen.getByText(/Gérez vos pèlerins/)).toBeInTheDocument()
    expect(screen.getByText('Se connecter')).toBeInTheDocument()
    expect(screen.getByText('Essayer gratuitement')).toBeInTheDocument()
  })

  it('affiche les sections avantages et tarifs', () => {
    rendre()
    expect(screen.getByText('Paiements échelonnés en FCFA')).toBeInTheDocument()
    expect(screen.getAllByText('Rappels WhatsApp automatiques').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('35 000 FCFA')).toBeInTheDocument()
  })

  it('affiche l’aperçu des tutoriels avec le lien vers la galerie', async () => {
    rendre()
    expect(await screen.findByText('Créer un plan de paiement')).toBeInTheDocument()
    const lien = screen.getByText('Voir tous les tutoriels').closest('a')
    expect(lien).toHaveAttribute('href', '/tutoriels')
  })

  it('affiche les boutons WhatsApp de demande de démo', () => {
    rendre()
    const boutons = screen.getAllByText('Demander une démo')
    expect(boutons.length).toBeGreaterThanOrEqual(1)
    boutons.forEach((b) => {
      expect(b.closest('a')).toHaveAttribute('href', expect.stringContaining('https://wa.me/'))
    })
  })

  it('propose « Ouvrir l’app » quand une session est active', () => {
    mockAuth.session = { user: { id: 'u1' } }
    rendre()
    expect(screen.getByText('Ouvrir l’app')).toBeInTheDocument()
    expect(screen.getAllByText('Essayer gratuitement').length).toBe(1)
    mockAuth.session = null
  })
})