import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}))

function Probe() {
  const { session, loading } = useAuth()
  return <div>{loading ? 'chargement' : session ? 'connecte' : 'anonyme'}</div>
}

beforeEach(() => {
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mockSupabase.auth.onAuthStateChange.mockImplementation(
    (cb: (e: string, s: unknown) => void) => {
      setTimeout(() => cb('SIGNED_IN', { user: { id: 'u1' } }), 0)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }
  )
})

describe('AuthProvider', () => {
  it('passe de chargement à session', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    expect(screen.getByText('chargement')).toBeInTheDocument()
    expect(await screen.findByText('connecte')).toBeInTheDocument()
  })
})