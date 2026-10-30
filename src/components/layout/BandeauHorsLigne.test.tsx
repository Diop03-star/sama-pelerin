import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import BandeauHorsLigne from './BandeauHorsLigne'

describe('BandeauHorsLigne', () => {
  afterEach(() => vi.restoreAllMocks())

  it('n’affiche rien quand le réseau est disponible', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    render(<BandeauHorsLigne />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('prévient dès que la connexion est perdue, puis disparaît au retour du réseau', () => {
    const enLigne = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    render(<BandeauHorsLigne />)

    enLigne.mockReturnValue(false)
    act(() => { window.dispatchEvent(new Event('offline')) })
    expect(screen.getByRole('status')).toHaveTextContent('Hors connexion')

    enLigne.mockReturnValue(true)
    act(() => { window.dispatchEvent(new Event('online')) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
