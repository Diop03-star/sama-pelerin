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
const update = vi.fn()

const docAvecPelerin = {
  id: 'doc1',
  agence_id: 'ag1',
  pelerin_id: 'p1',
  type_document: 'passeport',
  fichier_url: null,
  date_expiration: '2026-09-01',
  numero_document: 'XY789',
  statut: 'valide',
  date_upload: '2026-08-01T10:00:00Z',
  pelerin: { id: 'p1', prenom: 'Awa', nom: 'Ndiaye', telephone: '77 123 45 67' },
}

function rendre() {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'documents') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [docAvecPelerin], error: null }) }),
        upsert,
        update,
      }
    }
    if (table === 'pelerins') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [{ id: 'p1', prenom: 'Fatou', nom: 'Sy' }], error: null }) }),
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
  update.mockReset()
  update.mockReturnValue({ eq: () => Promise.resolve({ data: null, error: null }) })
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

  it('transmet la date d’expiration et le numéro saisis', async () => {
    rendre()
    await screen.findByText('Awa Ndiaye')
    fireEvent.change(screen.getByLabelText('Pèlerin'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('Date d’expiration'), { target: { value: '2027-06-15' } })
    fireEvent.change(screen.getByLabelText('Numéro de document'), { target: { value: 'AB123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider sans fichier' }))
    await waitFor(() => {
      expect(upsert).toHaveBeenCalled()
    })
    const [ligne] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({ date_expiration: '2027-06-15', numero_document: 'AB123' })
  })

  it('affiche le numéro du document dans le tableau', async () => {
    rendre()
    expect(await screen.findByText('XY789')).toBeInTheDocument()
  })

  it('modifie les métadonnées d’un document existant', async () => {
    rendre()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    const champDate = await screen.findByDisplayValue('2026-09-01')
    fireEvent.change(champDate, { target: { value: '2027-03-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({ date_expiration: '2027-03-10', numero_document: 'XY789' })
    })
  })
})
