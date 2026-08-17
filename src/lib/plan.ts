import type { TypeVoyage } from './types'
import { formatFCFA } from './format'

export interface TrancheDraft {
  numero_tranche: number
  montant_prevu: number
  date_echeance: string
}

export function statutDossierDepuisDocuments(statuts: string[]): 'incomplet' | 'complet' | 'valide' {
  if (statuts.length === 0) return 'incomplet'
  if (statuts.every((s) => s === 'valide')) return 'valide'
  if (statuts.every((s) => s === 'soumis' || s === 'valide')) return 'complet'
  return 'incomplet'
}

function joursDansMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate()
}

export function ajouterMois(dateISO: string, mois: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const total = y * 12 + (m - 1) + mois
  const annee = Math.floor(total / 12)
  const moisCible = ((total % 12) + 12) % 12
  const jour = Math.min(d, joursDansMois(annee, moisCible + 1))
  return `${annee}-${String(moisCible + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

export function ajouterJours(dateISO: string, jours: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + jours))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export function proposerAcompte(montantTotal: number, typeVoyage: TypeVoyage): number {
  return Math.round(montantTotal * (typeVoyage === 'omra' ? 0.6 : 0.4))
}

export function proposerDateLimite(dateDepart: string, typeVoyage: TypeVoyage): string {
  return ajouterJours(dateDepart, typeVoyage === 'omra' ? -30 : -60)
}

export function genererEcheancier(
  montantTotal: number,
  montantAcompte: number,
  nombreTranches: number,
  debut: string,
  dateLimite: string
): TrancheDraft[] {
  if (nombreTranches < 1) return []
  const reste = montantTotal - montantAcompte
  const base = Math.floor(reste / nombreTranches)
  const tranches: TrancheDraft[] = []
  for (let i = 1; i <= nombreTranches; i++) {
    const dernier = i === nombreTranches
    const echeance = ajouterMois(debut, i - 1)
    tranches.push({
      numero_tranche: i,
      montant_prevu: dernier ? reste - base * (nombreTranches - 1) : base,
      date_echeance: echeance <= dateLimite ? echeance : dateLimite,
    })
  }
  return tranches
}

export function validerEcheancier(
  montantTotal: number,
  montantAcompte: number,
  tranches: TrancheDraft[],
  dateLimite: string
): string | null {
  if (!montantTotal || montantTotal <= 0) return 'Renseignez un montant total positif.'
  if (montantAcompte < 0 || montantAcompte > montantTotal) return 'L’acompte ne peut pas dépasser le montant total.'
  if (tranches.length === 0 && montantAcompte !== montantTotal) return 'Répartissez le reste en tranches ou augmentez l’acompte.'
  if (tranches.length > 0) {
    const somme = tranches.reduce((s, t) => s + t.montant_prevu, 0)
    if (somme + montantAcompte !== montantTotal) return `La répartition doit totaliser ${formatFCFA(montantTotal - montantAcompte)}.`
    if (tranches.some((t) => t.montant_prevu <= 0)) return 'Chaque tranche doit avoir un montant positif.'
  }
  if (dateLimite && tranches.some((t) => t.date_echeance > dateLimite)) return 'Chaque échéance doit être avant la date limite du solde.'
  return null
}