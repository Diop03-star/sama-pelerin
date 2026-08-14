import { describe, it, expect, vi, afterEach } from 'vitest'
import { debutPeriode, nomPeriode } from './dates'

afterEach(() => vi.useRealTimers())

describe('debutPeriode', () => {
  it('jour : début de la journée', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T15:30:00'))
    const d = debutPeriode('jour')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)
    expect(d.getDate()).toBe(14)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it('semaine : 7 jours glissants', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T15:30:00'))
    expect(debutPeriode('semaine').toISOString()).toBe(new Date('2026-08-07T15:30:00').toISOString())
  })

  it('mois : 1er du mois à 00:00', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T15:30:00'))
    expect(debutPeriode('mois').toISOString()).toBe(new Date('2026-08-01T00:00:00').toISOString())
  })

  it('annee : 1er janvier à 00:00', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T15:30:00'))
    expect(debutPeriode('annee').toISOString()).toBe(new Date('2026-01-01T00:00:00').toISOString())
  })
})

describe('nomPeriode', () => {
  it('retourne le libellé de chaque période', () => {
    expect(nomPeriode('jour')).toBe("aujourd'hui")
    expect(nomPeriode('semaine')).toBe('7 derniers jours')
    expect(nomPeriode('mois')).toBe('ce mois-ci')
    expect(nomPeriode('annee')).toBe('cette année')
  })
})
