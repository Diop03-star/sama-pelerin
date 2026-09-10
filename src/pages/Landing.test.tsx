import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Landing from './Landing'
import type { Tutos } from '../lib/types'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const mockAuth = vi.hoisted(() => ({ session: null as { user: { id: string } } | null, loading: false }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => mockAuth }))

const tutosPreview: Tutos[] = [
  {
    id: 't1', titre: 'Suivre les encaissements d’une campagne', description: 'Étape par étape',
    url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ordre: 1, actif: true,
    created_at: '2026-08-01T00:00:00Z',
  },
]

function rendre() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function simulerTutos(data: Tutos[]) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table !== 'tutos') return {}
    return {
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data, error: null }) }),
        }),
      }),
    }
  })
}

beforeEach(() => {
  mockSupabase.from.mockReset()
  simulerTutos(tutosPreview)
})

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
    expect(screen.getByText('1 500 FCFA')).toBeInTheDocument()
    expect(screen.getByText('1 000 FCFA')).toBeInTheDocument()
    expect(screen.getByText('750 FCFA')).toBeInTheDocument()
  })

  it('n’affiche que les deux témoignages réels', () => {
    rendre()
    expect(screen.getByText('Al Hidjah Travel')).toBeInTheDocument()
    expect(screen.getByText('Voyages Al-Barakah')).toBeInTheDocument()
    expect(screen.queryByText('Agence pilote 3')).not.toBeInTheDocument()
    expect(screen.getByText('Agences pilotes — Dakar')).toBeInTheDocument()
  })

  it('affiche la bande sécurité avec ses trois garanties', () => {
    rendre()
    expect(screen.getByText('Vos données, prises au sérieux')).toBeInTheDocument()
    expect(screen.getByText('Chiffré en transit')).toBeInTheDocument()
    expect(screen.getByText('Accès cloisonné')).toBeInTheDocument()
    expect(screen.getByText('Hébergement sécurisé')).toBeInTheDocument()
  })

  it('affiche le tarif dégressif comme argument de closing', () => {
    rendre()
    expect(screen.getByText('Plus vous inscrivez de pèlerins, moins vous payez par pèlerin.')).toBeInTheDocument()
  })

  it('propose une demande de démo depuis la carte tarif dégressif', () => {
    rendre()
    const carte = screen.getByText('Plus vous inscrivez de pèlerins, moins vous payez par pèlerin.').closest('div')!
    const liens = within(carte).getAllByRole('link', { name: /Demander une démo/ })
    expect(liens).toHaveLength(1)
    expect(liens[0]).toHaveAttribute('href', expect.stringContaining('https://wa.me/'))
  })

  it('affiche l’aperçu des tutoriels avec le lien vers la galerie', async () => {
    rendre()
    expect(await screen.findByText('Suivre les encaissements d’une campagne')).toBeInTheDocument()
    expect(screen.queryByText(/\d+ min/)).not.toBeInTheDocument()
    const lien = screen.getByText('Voir tous les tutoriels').closest('a')
    expect(lien).toHaveAttribute('href', '/tutoriels')
  })

  it('affiche trois cartes d’aperçu quand aucun tuto n’est publié', async () => {
    simulerTutos([])
    rendre()
    const badges = await screen.findAllByText(/\d+ min/)
    expect(badges).toHaveLength(3)
    const carte = screen.getByText('Suivre les documents d’un pèlerin').closest('a')
    expect(carte).toHaveAttribute('href', '/tutoriels')
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