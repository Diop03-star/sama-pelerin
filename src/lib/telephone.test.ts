import { describe, expect, it } from 'vitest'
import { formatTelephone, normaliserTelephone } from './telephone'

describe('normaliserTelephone', () => {
  it('accepte un numéro sénégalais sous toutes ses formes courantes', () => {
    expect(normaliserTelephone('77 123 45 67')).toBe('+221771234567')
    expect(normaliserTelephone('771234567')).toBe('+221771234567')
    expect(normaliserTelephone('+221 77 123 45 67')).toBe('+221771234567')
    expect(normaliserTelephone('00221 77-123-45-67')).toBe('+221771234567')
    expect(normaliserTelephone('221771234567')).toBe('+221771234567')
    expect(normaliserTelephone('33 821 00 00')).toBe('+221338210000')
  })

  it('refuse un indicatif répété ou un numéro sénégalais incomplet', () => {
    expect(normaliserTelephone('+221221773788')).toBeNull()
    expect(normaliserTelephone('77 123 45')).toBeNull()
    expect(normaliserTelephone('+221 57 123 45 67')).toBeNull()
  })

  it('accepte un numéro étranger au format international', () => {
    expect(normaliserTelephone('+33 6 12 34 56 78')).toBe('+33612345678')
    expect(normaliserTelephone('06 12 34 56 78')).toBeNull()
  })

  it('refuse les lettres', () => {
    expect(normaliserTelephone('77 ABC 45 67')).toBeNull()
  })
})

describe('formatTelephone', () => {
  it('affiche tous les numéros sénégalais de la même façon', () => {
    expect(formatTelephone('+221771234567')).toBe('+221 77 123 45 67')
    expect(formatTelephone('+221 70 345 67 89')).toBe('+221 70 345 67 89')
  })

  it('laisse tel quel un ancien numéro invalide plutôt que de le masquer', () => {
    expect(formatTelephone('+221221773788')).toBe('+221221773788')
    expect(formatTelephone(null)).toBe('')
  })
})
