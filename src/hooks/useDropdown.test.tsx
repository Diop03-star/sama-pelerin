import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import useDropdown from './useDropdown'

function TestComposant() {
  const { ref, ouvert, basculer, fermer } = useDropdown()
  return (
    <div>
      <div ref={ref}>
        <button type="button" onClick={basculer}>Bouton</button>
        {ouvert && <p>Ouvert</p>}
      </div>
      <button type="button" onClick={fermer}>Exterieur</button>
    </div>
  )
}

describe('useDropdown', () => {
  it('ouvre et ferme au clic sur le bouton', () => {
    render(<TestComposant />)
    fireEvent.click(screen.getByText('Bouton'))
    expect(screen.getByText('Ouvert')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Bouton'))
    expect(screen.queryByText('Ouvert')).not.toBeInTheDocument()
  })

  it('ferme au clic extérieur', () => {
    render(<TestComposant />)
    fireEvent.click(screen.getByText('Bouton'))
    expect(screen.getByText('Ouvert')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Exterieur'))
    expect(screen.queryByText('Ouvert')).not.toBeInTheDocument()
  })

  it('ferme avec la touche Échap', () => {
    render(<TestComposant />)
    fireEvent.click(screen.getByText('Bouton'))
    expect(screen.getByText('Ouvert')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Ouvert')).not.toBeInTheDocument()
  })
})