import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'

const mockSupabase = vi.hoisted(() => ({ auth: { signInWithPassword: vi.fn() } }))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

describe('Login', () => {
  it('affiche le logo SamaPèlerin', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    )
    expect(screen.getByAltText('SamaPèlerin')).toBeInTheDocument()
  })
})