import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import SuperAdminTutos from './SuperAdminTutos'
import type { Tutos } from '../lib/types'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
  update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
  delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
}))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const queryClient = new QueryClient()

const tutoFixture: Tutos = {
  id: 't1', titre: 'Créer un plan de paiement', description: 'Étape par étape',
  url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ordre: 1, actif: true,
  created_at: '2026-08-01T00:00:00Z',
}

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.insert.mockClear()
  mockSupabase.update.mockClear()
  mockSupabase.delete.mockClear()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table !== 'tutos') return {}
    return {
      select: () => ({ order: () => Promise.resolve({ data: [tutoFixture], error: null }) }),
      insert: mockSupabase.insert,
      update: mockSupabase.update,
      delete: mockSupabase.delete,
    }
  })
})

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SuperAdminTutos />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SuperAdminTutos', () => {
  it('affiche la liste des vidéos avec leur statut', async () => {
    rendre()
    expect(await screen.findByText('Créer un plan de paiement')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

it('ajoute une vidéo avec une URL YouTube valide', async () => {
    rendre()
    fireEvent.click(await screen.findByText('Ajouter une vidéo'))
    const champs = screen.getAllByRole('textbox')
    fireEvent.change(champs[0], { target: { value: 'Gérer les documents' } })
    fireEvent.change(champs[1], { target: { value: 'Nouveau tutoriel' } })
    fireEvent.change(champs[2], { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } })
    fireEvent.click(screen.getByText('Enregistrer'))
    await vi.waitFor(() => {
      expect(mockSupabase.insert).toHaveBeenCalled()
    })
  })

  it('refuse une URL YouTube invalide', async () => {
    rendre()
    fireEvent.click(await screen.findByText('Ajouter une vidéo'))
    const champs = screen.getAllByRole('textbox')
    fireEvent.change(champs[0], { target: { value: 'Vidéo invalide' } })
    fireEvent.change(champs[2], { target: { value: 'https://example.com/video' } })
    fireEvent.click(screen.getByText('Enregistrer'))
    expect(await screen.findByText('URL YouTube invalide.')).toBeInTheDocument()
    expect(screen.getAllByText('Ajouter une vidéo').length).toBe(2)
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('modifie une vidéo existante', async () => {
    rendre()
    fireEvent.click(await screen.findByTitle('Modifier'))
    const champs = screen.getAllByRole('textbox')
    fireEvent.change(champs[0], { target: { value: 'Plan de paiement (màj)' } })
    fireEvent.click(screen.getByText('Enregistrer'))
    await vi.waitFor(() => {
      expect(mockSupabase.update).toHaveBeenCalled()
    })
  })

  it('supprime une vidéo après confirmation', async () => {
    rendre()
    fireEvent.click(await screen.findByTitle('Supprimer'))
    expect(screen.getByText(/Supprimer « Créer un plan de paiement »/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Confirmer'))
    await vi.waitFor(() => {
      expect(mockSupabase.delete).toHaveBeenCalled()
    })
  })
})