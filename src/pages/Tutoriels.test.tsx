import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Tutoriels from './Tutoriels'
import type { Tutos } from '../lib/types'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const queryClient = new QueryClient()

const tutosFixture: Tutos[] = [
  {
    id: 't1', titre: 'Créer un plan de paiement', description: 'Étape par étape',
    url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ordre: 1, actif: true,
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 't2', titre: 'Encaisser un versement', description: null,
    url_youtube: 'https://youtu.be/dQw4w9WgXcQ', ordre: 2, actif: true,
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 't3', titre: 'Vidéo cachée', description: null,
    url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ordre: 3, actif: false,
    created_at: '2026-08-01T00:00:00Z',
  },
]

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table !== 'tutos') return {}
    return {
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: tutosFixture.filter((t) => t.actif), error: null }) }),
      }),
    }
  })
})

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Tutoriels />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Tutoriels', () => {
  it('affiche la grille des vidéos actives avec leur lien YouTube', async () => {
    rendre()
    expect(await screen.findByText('Créer un plan de paiement')).toBeInTheDocument()
    expect(screen.getByText('Encaisser un versement')).toBeInTheDocument()
    expect(screen.queryByText('Vidéo cachée')).not.toBeInTheDocument()
    expect(screen.getByAltText('Créer un plan de paiement')).toHaveAttribute(
      'src',
      'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
    const lien = screen.getByText('Créer un plan de paiement').closest('a')
    expect(lien).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('affiche un état vide quand il n’y a aucune vidéo', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table !== 'tutos') return {}
      return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }
    })
    rendre()
    expect(await screen.findByText('Aucun tutoriel pour le moment.')).toBeInTheDocument()
  })
})