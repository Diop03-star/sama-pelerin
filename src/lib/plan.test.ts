import { describe, it, expect } from 'vitest'
import { genererTranches } from './plan'

describe('genererTranches', () => {
  it('répartit équitablement et met le reste sur la dernière tranche', () => {
    const tranches = genererTranches(2500000, 5, '2027-01-15')
    expect(tranches).toHaveLength(5)
    expect(tranches[0]).toEqual({ numero_tranche: 1, montant_prevu: 500000, date_echeance: '2027-01-15' })
    expect(tranches[4].montant_prevu).toBe(500000)
    expect(tranches.reduce((s, t) => s + t.montant_prevu, 0)).toBe(2500000)
  })
  it("met le reste sur la dernière tranche quand le total n'est pas divisible", () => {
    const tranches = genererTranches(1000, 3, '2026-09-01')
    expect(tranches.map(t => t.montant_prevu)).toEqual([333, 333, 334])
  })
  it('gère une seule tranche', () => {
    const tranches = genererTranches(800000, 1, '2026-09-01')
    expect(tranches).toEqual([{ numero_tranche: 1, montant_prevu: 800000, date_echeance: '2026-09-01' }])
  })
})