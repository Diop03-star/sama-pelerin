import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
})