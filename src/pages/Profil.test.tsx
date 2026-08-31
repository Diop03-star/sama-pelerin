import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Profil from './Profil'

const mockUseProfil = vi.hoisted(() => vi.fn())
const mockUseAgence = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useAgence', () => ({
  useProfil: () => mockUseProfil(),
  useAgence: () => mockUseAgence(),
}))

beforeEach(() => {
  mockUseProfil.mockReset()
  mockUseAgence.mockReset()
})

describe('Profil', () => {
  it('affiche les informations de l’utilisateur', () => {
    mockUseProfil.mockReturnValue({
      data: {
        id: 'u1',
        user_id: 'auth1',
        agence_id: 'a1',
        nom: 'Moussa Ndiaye',
        telephone: '77 123 45 67',
        email: 'moussa@alhidjah.sn',
        role: 'gerant',
        created_at: '2026-01-15T12:00:00Z',
      },
      isLoading: false,
    })
    mockUseAgence.mockReturnValue({ data: { id: 'a1', nom: 'Al Hidjah' }, isLoading: false })
    render(<Profil />)
    expect(screen.getByText('Moussa Ndiaye')).toBeInTheDocument()
    expect(screen.getByText('Gérant')).toBeInTheDocument()
    expect(screen.getByText('moussa@alhidjah.sn')).toBeInTheDocument()
    expect(screen.getByText('77 123 45 67')).toBeInTheDocument()
    expect(screen.getByText('Al Hidjah')).toBeInTheDocument()
    expect(screen.getByText('15/01/2026')).toBeInTheDocument()
  })

  it('affiche un message quand le profil est introuvable', () => {
    mockUseProfil.mockReturnValue({ data: null, isLoading: false })
    mockUseAgence.mockReturnValue({ data: undefined, isLoading: false })
    render(<Profil />)
    expect(screen.getByText('Profil introuvable.')).toBeInTheDocument()
  })
})