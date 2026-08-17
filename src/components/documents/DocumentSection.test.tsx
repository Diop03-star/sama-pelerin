import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DocumentSection from './DocumentSection'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))
vi.mock('../../hooks/useAgence', () => ({
  useAgence: () => ({ data: { id: 'ag1' } }),
}))

const upsert = vi.fn()
const update = vi.fn()

const doc1 = {
  id: 'doc1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  type_document: 'passeport',
  fichier_url: null,
  date_expiration: '2027-01-15',
  numero_document: 'AB123',
  statut: 'valide',
  date_upload: null,
}

function rendre() {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'documents') {
      return {
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [doc1], error: null }) }) }),
        upsert,
        update,
      }
    }
    return { select: () => Promise.resolve({ data: [], error: null }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentSection pelerinId="pel1" />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  upsert.mockReset()
  upsert.mockResolvedValue({ error: null })
  update.mockReset()
  update.mockReturnValue({ eq: () => Promise.resolve({ data: null, error: null }) })
})

describe('DocumentSection', () => {
  it('valide un document sans fichier via le bouton dédié', async () => {
    rendre()
    fireEvent.click(await screen.findByRole('button', { name: 'Valider sans fichier' }))
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('documents')
      expect(upsert).toHaveBeenCalled()
    })
    const [ligne] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({
      agence_id: 'ag1',
      pelerin_id: 'pel1',
      type_document: 'passeport',
      statut: 'valide',
    })
    expect(ligne.fichier_url).toBeUndefined()
  })

  it('transmet la date d’expiration et le numéro saisis lors de la validation sans fichier', async () => {
    rendre()
    fireEvent.change(await screen.findByLabelText('Date d’expiration'), { target: { value: '2027-06-15' } })
    fireEvent.change(screen.getByLabelText('Numéro de document'), { target: { value: 'AB123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider sans fichier' }))
    await waitFor(() => {
      expect(upsert).toHaveBeenCalled()
    })
    const [ligne] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({ date_expiration: '2027-06-15', numero_document: 'AB123' })
  })

  it('réinitialise les champs après la validation', async () => {
    rendre()
    fireEvent.change(await screen.findByLabelText('Date d’expiration'), { target: { value: '2027-06-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider sans fichier' }))
    await waitFor(() => {
      expect(screen.getByLabelText('Date d’expiration')).toHaveValue('')
    })
  })

  it('affiche le numéro du document sur la carte', async () => {
    rendre()
    expect(await screen.findByText(/N° AB123 · Expire le 15\/01\/2027/)).toBeInTheDocument()
  })

  it('ouvre la modal d’édition et enregistre les métadonnées', async () => {
    rendre()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    const champDate = await screen.findByDisplayValue('2027-01-15')
    fireEvent.change(champDate, { target: { value: '2028-02-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({ date_expiration: '2028-02-20', numero_document: 'AB123' })
    })
  })
})
