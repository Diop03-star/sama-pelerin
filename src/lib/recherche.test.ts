import { describe, expect, it } from 'vitest'
import { filtrerRecherche } from './recherche'

describe('filtrerRecherche', () => {
  const items = [
    { id: '1', libelle: 'Moussa Diop', sousLibelle: '77 123 45 67', to: '/x/1' },
  ]

  it('retourne les éléments dont le libellé contient le terme (insensible à la casse)', () => {
    expect(filtrerRecherche('moussa', items)).toHaveLength(1)
  })

  it('retourne les éléments dont le sous-libellé contient le terme', () => {
    expect(filtrerRecherche('77 123', items)).toHaveLength(1)
  })

  it('retourne une liste vide pour un terme vide ou sans correspondance', () => {
    expect(filtrerRecherche('', items)).toEqual([])
    expect(filtrerRecherche('zzz', items)).toEqual([])
  })

  it('limite le nombre de résultats', () => {
    const dix = Array.from({ length: 10 }, (_, i) => ({ id: String(i), libelle: `Diop ${i}`, sousLibelle: '', to: `/x/${i}` }))
    expect(filtrerRecherche('diop', dix, 5)).toHaveLength(5)
  })
})