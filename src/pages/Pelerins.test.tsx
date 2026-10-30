import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Pelerins from './Pelerins'
import type { Pelerin } from '../lib/types'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
  delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
}))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const mockAgence = vi.hoisted(() => ({ data: { id: 'a1', nom: 'Al Hidjah' }, isLoading: false }))
vi.mock('../hooks/useAgence', () => ({ useAgence: () => mockAgence }))

const queryClient = new QueryClient()

const pelerinFixture: Pelerin = {
  id: 'p1', agence_id: 'a1', groupe_id: 'g1', nom: 'Ndiaye', prenom: 'Awa',
  telephone: '77 123 45 67', email: null, date_naissance: null,
  sexe: 'F', contact_urgence_nom: null, contact_urgence_telephone: null,
  statut_dossier: 'valide', date_inscription: '2026-08-01T00:00:00Z',
}

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.update.mockClear()
  mockSupabase.delete.mockClear()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'groupes') {
      return { select: () => ({ order: () => Promise.resolve({ data: [{ id: 'g1', nom: 'Hajj 2027' }], error: null }) }) }
    }
    if (table === 'pelerins') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [{ ...pelerinFixture, groupe: { id: 'g1', nom: 'Hajj 2027' }, plan_paiement: null }], error: null }) }),
        update: mockSupabase.update,
        delete: mockSupabase.delete,
      }
    }
    return {}
  })
})

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Pelerins />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Pelerins', () => {
  it('compte l’acompte payé dans le reste dû', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'groupes') {
        return { select: () => ({ order: () => Promise.resolve({ data: [{ id: 'g1', nom: 'Hajj 2027' }], error: null }) }) }
      }
      if (table === 'pelerins') {
        return {
          select: () => ({
            order: () => Promise.resolve({
              data: [{
                ...pelerinFixture,
                groupe: { id: 'g1', nom: 'Hajj 2027' },
                plan_paiement: {
                  montant_total: 1000000,
                  nombre_tranches: 4,
                  tranches: [{ paiements: [{ montant_paye: 311000 }] }],
                  acomptes: [{ montant_paye: 600000 }],
                },
              }],
              error: null,
            }),
          }),
          update: mockSupabase.update,
          delete: mockSupabase.delete,
        }
      }
      return {}
    })
    rendre()
    expect(await screen.findByText(/89 000 FCFA/)).toBeInTheDocument()
  })

  it('affiche la carte mobile avec les informations essentielles', async () => {
    rendre()
    expect((await screen.findAllByText('Awa Ndiaye')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Hajj 2027').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('+221 77 123 45 67').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/01\/08\/2026/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Validé').length).toBeGreaterThanOrEqual(1)
  })

  it('ouvre la modale d’édition préremplie et enregistre les modifications', async () => {
    rendre()
    fireEvent.click(await screen.findAllByTitle('Modifier').then((b) => b[0]))
    expect(screen.getByText('Modifier le pèlerin')).toBeInTheDocument()
    const champs = screen.getAllByRole('textbox')
    expect(champs[1]).toHaveValue('Awa')
    fireEvent.change(champs[1], { target: { value: 'Fatou' } })
    fireEvent.click(screen.getByText('Enregistrer'))
    await vi.waitFor(() => {
      expect(mockSupabase.update).toHaveBeenCalledWith({
        groupe_id: 'g1', nom: 'Ndiaye', prenom: 'Fatou', telephone: '+221771234567',
        email: null, sexe: 'F',
      })
    })
  })

  it('refuse un numéro de téléphone invalide sans rien enregistrer', async () => {
    rendre()
    mockSupabase.update.mockClear()
    fireEvent.click(await screen.findAllByTitle('Modifier').then((b) => b[0]))
    fireEvent.change(screen.getByPlaceholderText('77 123 45 67'), { target: { value: '+221221773788' } })
    fireEvent.click(screen.getByText('Enregistrer'))
    expect(await screen.findByText(/Numéro invalide/)).toBeInTheDocument()
    expect(mockSupabase.update).not.toHaveBeenCalled()
  })

  it('supprime un pèlerin après confirmation via le menu ⋮ Plus', async () => {
    rendre()
    fireEvent.click(await screen.findAllByRole('button', { name: /Plus d’actions/ }).then((b) => b[0]))
    fireEvent.click(screen.getByText('Supprimer'))
    expect(screen.getByText(/Supprimer « Awa Ndiaye »/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Confirmer la suppression'))
    await vi.waitFor(() => {
      expect(mockSupabase.delete).toHaveBeenCalled()
    })
  })
})