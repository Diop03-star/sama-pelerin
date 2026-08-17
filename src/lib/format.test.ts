import { describe, it, expect } from 'vitest'
import {
  formatFCFA, formatDate, whatsappUrl,
  messageTranche, messageDocument,
  LIBELLES_DOCUMENT, TONE_TRANCHE,
  LIBELLES_STATUT_PLAN, TONE_STATUT_PLAN,
} from './format'

describe('formatFCFA', () => {
  it('formate avec le suffixe FCFA', () => {
    expect(formatFCFA(2500000)).toBe('2 500 000 FCFA')
    expect(formatFCFA(750000)).toBe('750 000 FCFA')
    expect(formatFCFA(0)).toBe('0 FCFA')
  })
})

describe('formatDate', () => {
  it('formate une date ISO date-only en DD/MM/YYYY sans décalage de fuseau', () => {
    expect(formatDate('2027-05-15')).toBe('15/05/2027')
  })
  it('retourne un tiret pour une valeur nulle', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })
})

describe('whatsappUrl', () => {
  it('nettoie le téléphone et encode le message', () => {
    expect(whatsappUrl('+221 77 123 45 67', 'Bonjour Awa')).toBe(
      'https://wa.me/221771234567?text=Bonjour%20Awa'
    )
  })
})

describe('messageTranche', () => {
  it('construit le message de rappel de tranche', () => {
    const msg = messageTranche('Awa', 'Ndiaye', 2, 500000, '2026-10-01')
    expect(msg).toContain('Awa Ndiaye')
    expect(msg).toContain('tranche 2')
    expect(msg).toContain('500 000 FCFA')
    expect(msg).toContain('01/10/2026')
  })
})

describe('messageDocument', () => {
  it('construit le message de rappel de document', () => {
    const msg = messageDocument('Awa', 'Ndiaye', 'passeport', 'manquant')
    expect(msg).toContain('Passeport')
    expect(msg).toContain('Awa Ndiaye')
  })
})

describe('libellés et tons', () => {
  it('expose les libellés de documents', () => {
    expect(LIBELLES_DOCUMENT.passeport).toBe('Passeport')
    expect(LIBELLES_DOCUMENT.certificat_vaccination).toBe('Certificat de vaccination')
  })
  it('expose les tons de tranches', () => {
    expect(TONE_TRANCHE.en_retard).toBe('rouge')
    expect(TONE_TRANCHE.payee).toBe('vert')
  })
})

describe('libellés statut plan', () => {
  it('expose les libellés et tons des quatre statuts', () => {
    expect(LIBELLES_STATUT_PLAN).toMatchObject({
      acompte_en_attente: 'Acompte en attente',
      en_cours: 'En cours',
      en_retard: 'En retard',
      solde: 'Soldé',
    })
    expect(TONE_STATUT_PLAN).toEqual({
      acompte_en_attente: 'ambre',
      en_cours: 'neutre',
      en_retard: 'rouge',
      solde: 'vert',
    })
  })
})