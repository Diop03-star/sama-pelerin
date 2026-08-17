import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ModifierDocumentModal from './ModifierDocumentModal'

const queryClient = new QueryClient()

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

const update = vi.fn()
const eq = vi.fn()

const doc = {
  id: 'doc1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  type_document: 'passeport',
  fichier_url: null,
  date_expiration: '2027-01-15',
  numero_document: 'AB123',
  statut: 'valide',
  date_upload: null,
} as const

beforeEach(() => {
  update.mockReset()
  eq.mockReset()
  update.mockReturnValue({ eq })
  eq.mockResolvedValue({ error: null })
  mockSupabase.from.mockReset()
  mockSupabase.from.mockReturnValue({ update })
})

describe('ModifierDocumentModal', () => {
  it('préremplit les champs avec les valeurs du document', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ModifierDocumentModal doc={doc} open onClose={() => {}} onSaved={() => {}} />
      </QueryClientProvider>
    )
    expect(screen.getByLabelText('Date d’expiration')).toHaveValue('2027-01-15')
    expect(screen.getByLabelText('N° de document')).toHaveValue('AB123')
  })

  it('enregistre les nouvelles valeurs puis appelle onSaved et onClose', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(
      <QueryClientProvider client={queryClient}>
        <ModifierDocumentModal doc={doc} open onClose={onClose} onSaved={onSaved} />
      </QueryClientProvider>
    )
    fireEvent.change(screen.getByLabelText('Date d’expiration'), { target: { value: '2028-02-20' } })
    fireEvent.change(screen.getByLabelText('N° de document'), { target: { value: 'CD456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({ date_expiration: '2028-02-20', numero_document: 'CD456' })
      expect(eq).toHaveBeenCalledWith('id', 'doc1')
    })
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('convertit les champs vidés en null', async () => {
    const onSaved = vi.fn()
    render(
      <QueryClientProvider client={queryClient}>
        <ModifierDocumentModal doc={doc} open onClose={() => {}} onSaved={onSaved} />
      </QueryClientProvider>
    )
    fireEvent.change(screen.getByLabelText('Date d’expiration'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('N° de document'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({ date_expiration: null, numero_document: null })
    })
  })

  it('annule sans enregistrer', () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(
      <QueryClientProvider client={queryClient}>
        <ModifierDocumentModal doc={doc} open onClose={onClose} onSaved={onSaved} />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(update).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('affiche l’erreur si la mise à jour échoue', async () => {
    eq.mockResolvedValue({ error: new Error('boom') })
    render(
      <QueryClientProvider client={queryClient}>
        <ModifierDocumentModal doc={doc} open onClose={() => {}} onSaved={() => {}} />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })
})
