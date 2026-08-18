import { describe, it, expect } from 'vitest'
import {
  statutDossierDepuisDocuments,
  statutDocumentParType,
  proposerAcompte,
  proposerDateLimite,
  genererEcheancier,
  validerEcheancier,
  ajouterMois,
  ajouterJours,
} from './plan'

describe('statutDossierDepuisDocuments', () => {
  const docs = (arr: Array<[string, string]>) =>
    arr.map(([type_document, statut]) => ({ type_document, statut }))

  it('retourne valide si les 4 types requis sont validés', () => {
    expect(statutDossierDepuisDocuments(docs([
      ['passeport', 'valide'], ['visa', 'valide'],
      ['certificat_vaccination', 'valide'], ['photo', 'valide'],
    ]))).toBe('valide')
  })

  it('retourne valide même si un document « autre » n’est pas validé', () => {
    expect(statutDossierDepuisDocuments(docs([
      ['passeport', 'valide'], ['visa', 'valide'],
      ['certificat_vaccination', 'valide'], ['photo', 'valide'],
      ['autre', 'manquant'],
    ]))).toBe('valide')
  })

  it('retourne incomplet si un type requis manque ou n’est pas validé', () => {
    expect(statutDossierDepuisDocuments(docs([
      ['passeport', 'valide'], ['visa', 'soumis'],
      ['certificat_vaccination', 'valide'], ['photo', 'valide'],
    ]))).toBe('incomplet')
    expect(statutDossierDepuisDocuments(docs([
      ['passeport', 'valide'], ['visa', 'valide'],
    ]))).toBe('incomplet')
  })

  it('retourne incomplet sans aucun document', () => {
    expect(statutDossierDepuisDocuments([])).toBe('incomplet')
  })
})

describe('statutDocumentParType', () => {
  const docs = (arr: Array<[string, string]>) =>
    arr.map(([type_document, statut]) => ({ type_document, statut }))

  it('retourne valide si le type a un document validé', () => {
    expect(statutDocumentParType(docs([
      ['passeport', 'valide'], ['visa', 'soumis'],
    ]), 'passeport')).toBe('valide')
  })

  it('retourne manquant si le type n’est pas validé ou absent', () => {
    expect(statutDocumentParType(docs([
      ['passeport', 'valide'], ['visa', 'soumis'],
    ]), 'visa')).toBe('manquant')
    expect(statutDocumentParType(docs([
      ['passeport', 'valide'],
    ]), 'photo')).toBe('manquant')
  })
})

describe('proposerAcompte', () => {
  it('propose 60 % du total pour une Omra', () => {
    expect(proposerAcompte(1000000, 'omra')).toBe(600000)
  })

  it('propose 40 % du total pour un Hajj', () => {
    expect(proposerAcompte(1000000, 'hajj')).toBe(400000)
  })
})

describe('proposerDateLimite', () => {
  it('propose 30 jours avant le départ pour une Omra', () => {
    expect(proposerDateLimite('2026-06-15', 'omra')).toBe('2026-05-16')
  })

  it('propose 60 jours avant le départ pour un Hajj', () => {
    expect(proposerDateLimite('2026-06-15', 'hajj')).toBe('2026-04-16')
  })
})

describe('ajouterMois', () => {
  it('gère les fins de mois', () => {
    expect(ajouterMois('2026-01-31', 1)).toBe('2026-02-28')
    expect(ajouterMois('2026-03-31', 1)).toBe('2026-04-30')
  })

  it('gère le changement d’année', () => {
    expect(ajouterMois('2026-11-10', 2)).toBe('2027-01-10')
  })
})

describe('ajouterJours', () => {
  it('retranche des jours en traversant les mois', () => {
    expect(ajouterJours('2026-06-15', -60)).toBe('2026-04-16')
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('genererEcheancier', () => {
  it('répartit le reste en tranches égales, dernière ajustée', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-02-01', '2026-04-15')
    expect(tranches.map((t) => t.montant_prevu)).toEqual([200000, 200000, 200000])
    expect(tranches[2].montant_prevu).toBe(200000)
  })

  it('génère des dates mensuelles depuis le début', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-02-01', '2026-04-15')
    expect(tranches.map((t) => t.date_echeance)).toEqual(['2026-02-01', '2026-03-01', '2026-04-01'])
  })

  it('borne la dernière échéance à la date limite', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-03-20', '2026-03-31')
    expect(tranches.map((t) => t.date_echeance)).toEqual(['2026-03-20', '2026-03-31', '2026-03-31'])
  })

  it('répartit un reste non divisible', () => {
    const tranches = genererEcheancier(1000000, 200000, 3, '2026-02-01', '2026-04-15')
    expect(tranches.map((t) => t.montant_prevu)).toEqual([266666, 266666, 266668])
  })

  it('retourne un échéancier vide si aucun montant à répartir', () => {
    expect(genererEcheancier(1000000, 1000000, 3, '2026-02-01', '2026-04-15')).toEqual([
      { numero_tranche: 1, montant_prevu: 0, date_echeance: '2026-02-01' },
      { numero_tranche: 2, montant_prevu: 0, date_echeance: '2026-03-01' },
      { numero_tranche: 3, montant_prevu: 0, date_echeance: '2026-04-01' },
    ])
  })
})

describe('validerEcheancier', () => {
  it('refuse un acompte supérieur au total', () => {
    expect(validerEcheancier(1000000, 1200000, [], '2026-04-15')).not.toBeNull()
  })

  it('refuse une somme répartie différente du reste', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-02-01', '2026-04-15')
    tranches[0].montant_prevu = 250000
    expect(validerEcheancier(1000000, 400000, tranches, '2026-04-15')).toBe('La répartition doit totaliser 600 000 FCFA.')
  })

  it('refuse une échéance après la date limite', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-03-20', '2026-03-31')
    tranches[1].date_echeance = '2026-04-01'
    expect(validerEcheancier(1000000, 400000, tranches, '2026-03-31')).toBe('Chaque échéance doit être avant la date limite du solde.')
  })

  it('accepte un échéancier valide', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-02-01', '2026-04-15')
    expect(validerEcheancier(1000000, 400000, tranches, '2026-04-15')).toBeNull()
  })
})