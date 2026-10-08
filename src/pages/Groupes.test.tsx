import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Groupes from './Groupes'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
  delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
}))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const mockAgence = vi.hoisted(() => ({ data: { id: 'a1', nom: 'Al Hidjah' }, isLoading: false }))
vi.mock('../hooks/useAgence', () => ({ useAgence: () => mockAgence }))

const groupeFixture = {
  id: 'g1', agence_id: 'a1', nom: 'Hajj 2027', type_voyage: 'hajj',
  date_depart: '2027-04-01', date_retour: '2027-04-30', nb_places_max: 10, created_at: '2026-01-01T00:00:00Z',
  pelerins: [{ count: 7 }],
}

function rendre(data: unknown[] = [groupeFixture]) {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'groupes') {
      return {
        select: () => ({ order: () => Promise.resolve({ data, error: null }) }),
        update: mockSupabase.update,
        delete: mockSupabase.delete,
      }
    }
    return {}
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Groupes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Groupes', () => {
  it('affiche les informations du groupe dans la liste', async () => {
    rendre()
    expect((await screen.findAllByText('Hajj 2027')).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText('Hajj')).length).toBeGreaterThanOrEqual(1)
    const tableau = within(screen.getByRole('table'))
    expect(tableau.getByText('01/04/2027')).toBeInTheDocument()
    expect(tableau.getByText('30/04/2027')).toBeInTheDocument()
    expect(tableau.getByText('7 / 10')).toBeInTheDocument()
    expect(tableau.getByText('70%')).toBeInTheDocument()
    expect(tableau.getByRole('progressbar', { name: 'Remplissage de Hajj 2027' })).toHaveAttribute('aria-valuenow', '70')
  })

  it('affiche les boutons Modifier et Supprimer sur les cartes', async () => {
    rendre()
    expect((await screen.findAllByTitle('Modifier')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTitle('Supprimer').length).toBeGreaterThanOrEqual(1)
  })

  it('affiche un état vide sur les cartes', async () => {
    rendre([])
    expect((await screen.findAllByText('Aucun groupe. Créez votre premier groupe Hajj ou Omra.')).length).toBeGreaterThanOrEqual(1)
  })

  it('filtre la liste selon le type de voyage choisi', async () => {
    const user = userEvent.setup()
    rendre([
      groupeFixture,
      { ...groupeFixture, id: 'g2', nom: 'Omra Ramadan', type_voyage: 'omra' },
    ])

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrer par type' }), 'hajj')

    expect(screen.getAllByText('Hajj 2027').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Omra Ramadan')).not.toBeInTheDocument()
  })

  it('permet de parcourir les groupes avec la pagination', async () => {
    const user = userEvent.setup()
    rendre([
      groupeFixture,
      { ...groupeFixture, id: 'g2', nom: 'Groupe 2' },
      { ...groupeFixture, id: 'g3', nom: 'Groupe 3' },
      { ...groupeFixture, id: 'g4', nom: 'Groupe 4' },
    ])

    expect((await screen.findAllByText('Hajj 2027')).length).toBeGreaterThanOrEqual(1)

    await user.click(screen.getByRole('button', { name: 'Page 2' }))

    expect(screen.getAllByText('Groupe 4').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryAllByText('Hajj 2027')).toHaveLength(0)
    expect(screen.getByText('Affichage de 4 à 4 sur 4 groupes')).toBeInTheDocument()
  })

  it('bascule vers les cartes de groupes', async () => {
    const user = userEvent.setup()
    rendre()

    await user.click(screen.getByRole('button', { name: 'Affichage en cartes' }))

    expect(screen.getByRole('button', { name: 'Affichage en cartes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('7 / 10')).toBeInTheDocument()
  })

  it('demande confirmation avant de supprimer un groupe et permet d’annuler', async () => {
    const user = userEvent.setup()
    rendre()

    await user.click(await screen.findByTitle('Supprimer'))

    expect(screen.getByText(/Les pèlerins, documents et paiements associés seront également supprimés définitivement/i)).toBeInTheDocument()
    expect(mockSupabase.delete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByText(/Les pèlerins, documents et paiements associés/i)).not.toBeInTheDocument()
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })

  it('supprime le groupe uniquement après confirmation', async () => {
    const user = userEvent.setup()
    rendre()

    await user.click(await screen.findByTitle('Supprimer'))
    await user.click(screen.getByRole('button', { name: 'Confirmer la suppression' }))

    await waitFor(() => expect(mockSupabase.delete).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('heading', { name: 'Supprimer le groupe' })).not.toBeInTheDocument()
  })
})
