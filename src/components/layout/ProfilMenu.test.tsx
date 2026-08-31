import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProfilMenu from './ProfilMenu'

const mockSignOut = vi.hoisted(() => vi.fn())
const mockSupabase = vi.hoisted(() => ({ auth: { signOut: mockSignOut } }))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

const mockUseProfil = vi.hoisted(() => vi.fn())
vi.mock('../../hooks/useAgence', () => ({ useProfil: () => mockUseProfil() }))

function rendre() {
  return render(
    <MemoryRouter initialEntries={['/tableau-de-bord']}>
      <Routes>
        <Route path="/tableau-de-bord" element={<ProfilMenu />} />
        <Route path="/profil" element={<div>Page profil</div>} />
        <Route path="/tutoriels" element={<div>Page tutoriels</div>} />
        <Route path="/login" element={<div>Page login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockUseProfil.mockReset()
  mockSignOut.mockReset()
  mockSignOut.mockResolvedValue({ error: null })
  mockUseProfil.mockReturnValue({
    data: { nom: 'Moussa Ndiaye', role: 'gerant' },
    isLoading: false,
  })
})

describe('ProfilMenu', () => {
  it("masque le menu au départ et l'ouvre au clic sur l'avatar", () => {
    rendre()
    expect(screen.queryByText('Moussa Ndiaye')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Menu profil'))
    expect(screen.getByText('Moussa Ndiaye')).toBeInTheDocument()
    expect(screen.getByText('Gérant')).toBeInTheDocument()
  })

  it('navigue vers /profil au clic sur « Mon profil »', () => {
    rendre()
    fireEvent.click(screen.getByLabelText('Menu profil'))
    fireEvent.click(screen.getByText('Mon profil'))
    expect(screen.getByText('Page profil')).toBeInTheDocument()
  })

  it('navigue vers /tutoriels au clic sur « Aide »', () => {
    rendre()
    fireEvent.click(screen.getByLabelText('Menu profil'))
    fireEvent.click(screen.getByText('Aide'))
    expect(screen.getByText('Page tutoriels')).toBeInTheDocument()
  })

  it('se déconnecte et navigue vers /login', async () => {
    rendre()
    fireEvent.click(screen.getByLabelText('Menu profil'))
    fireEvent.click(screen.getByText('Déconnexion'))
    expect(mockSignOut).toHaveBeenCalled()
    expect(await screen.findByText('Page login')).toBeInTheDocument()
  })

  it('ferme le menu au clic extérieur', () => {
    rendre()
    fireEvent.click(screen.getByLabelText('Menu profil'))
    expect(screen.getByText('Mon profil')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Mon profil')).not.toBeInTheDocument()
  })
})