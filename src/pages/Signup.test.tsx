import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Signup from './Signup'

const mockSupabase = vi.hoisted(() => ({ auth: { signUp: vi.fn() } }))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

describe('Signup', () => {
  it('affiche le logo SamaPèlerin', () => {
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>,
    )
    expect(screen.getByAltText('SamaPèlerin')).toHaveClass('h-20')
  })

  it('envoie un emailRedirectTo vers la page courante lors de la création du compte', async () => {
    const user = userEvent.setup()
    mockSupabase.auth.signUp.mockResolvedValue({ error: null })
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('Nom complet'), 'Awa Diop')
    await user.type(screen.getByLabelText('Email'), 'awa@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1')
    await user.click(screen.getByRole('button', { name: 'Créer le compte' }))
    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining(window.location.origin),
        }),
      }),
    )
  })

  it('n’affiche pas l’ancien succès à côté d’une nouvelle erreur', async () => {
    const user = userEvent.setup()
    mockSupabase.auth.signUp
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { code: 'unexpected_failure', message: 'Error sending confirmation email' } })
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('Nom complet'), 'Awa Diop')
    await user.type(screen.getByLabelText('Email'), 'awa@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'motdepasse1')
    await user.click(screen.getByRole('button', { name: 'Créer le compte' }))
    expect(await screen.findByText(/Compte créé/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Créer le compte' }))
    expect(await screen.findByText(/Impossible d’envoyer l’email de confirmation/)).toBeInTheDocument()
    expect(screen.queryByText(/Compte créé/)).not.toBeInTheDocument()
  })
})