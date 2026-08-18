export function formatFCFA(montant: number): string {
  const groupe = new Intl.NumberFormat('fr-FR').format(montant)
  return groupe.replace(/[\u202F\u00A0]/g, ' ') + ' FCFA'
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  return new Date(value).toLocaleDateString('fr-FR')
}

export function whatsappUrl(telephone: string, message: string): string {
  const digits = telephone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function messageTranche(
  prenom: string, nom: string, numeroTranche: number, montant: number, echeance: string
): string {
  return `Assalamou alaykoum ${prenom} ${nom}, rappel : la tranche ${numeroTranche} de ${formatFCFA(montant)} arrive à échéance le ${formatDate(echeance)}. Merci de régler auprès de votre agence.`
}

export function messageDocument(
  prenom: string, nom: string, typeDoc: string, statut: string
): string {
  return `Assalamou alaykoum ${prenom} ${nom}, rappel : votre document « ${LIBELLES_DOCUMENT[typeDoc] ?? typeDoc} » est ${LIBELLES_DOC_STATUT[statut] ?? statut}. Merci de le régulariser auprès de votre agence.`
}

export const LIBELLES_DOCUMENT: Record<string, string> = {
  passeport: 'Passeport',
  visa: 'Visa',
  certificat_vaccination: 'Certificat de vaccination',
  photo: "Photo d'identité",
  autre: 'Autre',
}

export const LIBELLES_DOC_STATUT: Record<string, string> = {
  manquant: 'manquant',
  soumis: 'soumis',
  valide: 'validé',
  rejete: 'rejeté',
}

export const LIBELLES_DOSSIER: Record<string, string> = {
  incomplet: 'Incomplet',
  valide: 'Validé',
}

export const LIBELLES_TRANCHE: Record<string, string> = {
  a_venir: 'À venir',
  payee: 'Payée',
  partielle: 'Partielle',
  en_retard: 'En retard',
}

export const LIBELLES_MODE: Record<string, string> = {
  especes: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  virement: 'Virement bancaire',
  autre: 'Autre',
}

export const LIBELLES_RAPPEL: Record<string, string> = {
  en_attente: 'En attente',
  envoye: 'Envoyé',
  echec: 'Échec',
}

export const LIBELLES_TYPE_VOYAGE: Record<string, string> = {
  hajj: 'Hajj',
  omra: 'Omra',
}

export const LIBELLES_SEXE: Record<string, string> = {
  M: 'Homme',
  F: 'Femme',
}

export const TONE_DOCUMENT: Record<string, string> = {
  manquant: 'rouge',
  soumis: 'ambre',
  valide: 'vert',
  rejete: 'rouge',
}

export const TONE_DOSSIER: Record<string, string> = {
  incomplet: 'rouge',
  valide: 'vert',
}

export const TONE_TRANCHE: Record<string, string> = {
  a_venir: 'neutre',
  payee: 'vert',
  partielle: 'ambre',
  en_retard: 'rouge',
}

export const LIBELLES_STATUT_PLAN: Record<string, string> = {
  acompte_en_attente: 'Acompte en attente',
  en_cours: 'En cours',
  en_retard: 'En retard',
  solde: 'Soldé',
}

export const TONE_STATUT_PLAN: Record<string, string> = {
  acompte_en_attente: 'ambre',
  en_cours: 'neutre',
  en_retard: 'rouge',
  solde: 'vert',
}

export const TONE_RAPPEL: Record<string, string> = {
  en_attente: 'ambre',
  envoye: 'vert',
  echec: 'rouge',
}