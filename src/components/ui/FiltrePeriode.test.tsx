import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FiltrePeriode from './FiltrePeriode'

describe('FiltrePeriode', () => {
  it('affiche les 4 périodes et le bouton actif', () => {
    render(<FiltrePeriode periode="mois" onChange={() => {}} />)
    for (const libelle of ['Jour', 'Semaine', 'Mois', 'Année']) {
      expect(screen.getByRole('button', { name: libelle })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Mois' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'Jour' })).not.toHaveClass('bg-primary')
  })

  it('notifie le changement de période', () => {
    const onChange = vi.fn()
    render(<FiltrePeriode periode="annee" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }))
    expect(onChange).toHaveBeenCalledWith('semaine')
  })
})
