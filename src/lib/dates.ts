export type Periode = 'jour' | 'semaine' | 'mois' | 'annee'

export const LIBELLES_PERIODE: Record<Periode, string> = {
  jour: 'Jour',
  semaine: 'Semaine',
  mois: 'Mois',
  annee: 'Année',
}

export function debutPeriode(periode: Periode): Date {
  const debut = new Date()
  if (periode === 'jour') {
    debut.setHours(0, 0, 0, 0)
  } else if (periode === 'semaine') {
    debut.setDate(debut.getDate() - 7)
  } else if (periode === 'mois') {
    debut.setDate(1)
    debut.setHours(0, 0, 0, 0)
  } else {
    debut.setMonth(0, 1)
    debut.setHours(0, 0, 0, 0)
  }
  return debut
}

export function nomPeriode(periode: Periode): string {
  if (periode === 'jour') return "aujourd'hui"
  if (periode === 'semaine') return '7 derniers jours'
  if (periode === 'mois') return 'ce mois-ci'
  return 'cette année'
}
