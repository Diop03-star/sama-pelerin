import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
  it('affiche l’emblème sur mobile et le logo complet sur desktop', () => {
    rendre()
    const marques = screen.getAllByAltText('SamaPèlerin')
    expect(marques.length).toBe(2)
    expect(marques[0]).toHaveClass('h-9', 'w-9', 'sm:hidden')
    expect(marques[1]).toHaveClass('hidden', 'h-12', 'w-auto', 'sm:inline-block')
  })

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

  it('scrolle vers la section ciblée après navigation par ancre', () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    render(
      <MemoryRouter initialEntries={['/tutoriels']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div id="avantages">Section avantages</div>} />
            <Route path="/tutoriels" element={<div>Tutoriels</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getAllByText('Avantages')[0])
    expect(scroll).toHaveBeenCalled()
  })
})