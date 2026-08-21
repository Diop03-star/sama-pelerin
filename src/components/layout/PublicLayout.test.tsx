import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PublicLayout from './PublicLayout'

const mockAuth = vi.hoisted(() => ({ session: null, loading: false }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => mockAuth }))

function rendre() {
  return render(
    <MemoryRouter initialEntries={['/tutoriels']}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<div>Landing</div>} />
          <Route path="/tutoriels" element={<div>Tutoriels</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicLayout', () => {
  it('pointe les ancres du menu et du pied de page vers la landing avec l’ancre complète', () => {
    rendre()
    const cibles: Record<string, string> = { Avantages: '/#avantages', Tarifs: '/#tarifs', Contact: '/#contact' }
    for (const [label, hrefAttendu] of Object.entries(cibles)) {
      const liens = screen.getAllByRole('link').filter((l) => l.textContent === label)
      expect(liens.length).toBeGreaterThanOrEqual(1)
      liens.forEach((l) => expect(l).toHaveAttribute('href', hrefAttendu))
    }
  })

  it('pointe le lien Tutoriels vers la galerie', () => {
    rendre()
    const liens = screen.getAllByRole('link').filter((l) => l.textContent === 'Tutoriels')
    expect(liens.length).toBeGreaterThanOrEqual(1)
    liens.forEach((l) => expect(l).toHaveAttribute('href', '/tutoriels'))
  })
})