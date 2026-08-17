export type Role = 'superadmin' | 'gerant' | 'agent'
export type TypeVoyage = 'hajj' | 'omra'
export type StatutDossier = 'incomplet' | 'complet' | 'valide'
export type TypeDocument = 'passeport' | 'visa' | 'certificat_vaccination' | 'photo' | 'autre'
export type StatutDocument = 'manquant' | 'soumis' | 'valide' | 'rejete'
export type StatutTranche = 'a_venir' | 'payee' | 'partielle' | 'en_retard'
export type TypePaiement = 'acompte' | 'tranche'
export type StatutPlan = 'acompte_en_attente' | 'en_cours' | 'en_retard' | 'solde'
export type ModePaiement = 'especes' | 'wave' | 'orange_money' | 'virement' | 'autre'
export type StatutRappel = 'en_attente' | 'envoye' | 'echec'

export interface Agence {
  id: string; nom: string; telephone: string; email: string | null
  adresse: string | null; logo_url: string | null; created_at: string; active: boolean
}
export interface Utilisateur {
  id: string; user_id: string | null; agence_id: string | null
  nom: string; telephone: string; email: string | null; role: Role; created_at: string
}
export interface Groupe {
  id: string; agence_id: string; nom: string; type_voyage: TypeVoyage
  date_depart: string; date_retour: string; nb_places_max: number; created_at: string
}
export interface Pelerin {
  id: string; agence_id: string; groupe_id: string; nom: string; prenom: string
  telephone: string; email: string | null; date_naissance: string | null
  sexe: 'M' | 'F' | null; contact_urgence_nom: string | null
  contact_urgence_telephone: string | null; statut_dossier: StatutDossier
  date_inscription: string
}
export interface Document {
  id: string; agence_id: string; pelerin_id: string; type_document: TypeDocument
  fichier_url: string | null; date_expiration: string | null; numero_document: string | null
  statut: StatutDocument; date_upload: string | null
}
export interface PlanPaiement {
  id: string; agence_id: string; pelerin_id: string
  montant_total: number; devise: string; nombre_tranches: number; created_at: string
  montant_acompte: number; date_limite_solde: string | null; statut: StatutPlan
}
export interface Tranche {
  id: string; agence_id: string; plan_paiement_id: string; numero_tranche: number
  montant_prevu: number; date_echeance: string; statut: StatutTranche
}
export interface Paiement {
  id: string; agence_id: string; tranche_id: string | null; montant_paye: number
  date_paiement: string; mode: ModePaiement; reference: string | null; enregistre_par: string | null
  type_paiement: TypePaiement; plan_paiement_id: string | null
}
export interface Rappel {
  id: string; agence_id: string; tranche_id: string | null; document_id: string | null
  canal: 'whatsapp' | 'sms'; date_envoi_prevue: string
  date_envoi_reelle: string | null; statut_envoi: StatutRappel
}
export interface Invitation {
  id: string; agence_id: string; email: string; role: Role; token: string
  created_by: string | null
  created_at: string; expires_at: string; used_at: string | null
}

export interface StatsAgence {
  agence_id: string; agence_nom: string; agence_active: boolean
  pelerins_total: number; dossiers_valides: number; dossiers_complets: number; dossiers_incomplets: number
  groupes_total: number; places_restantes: number
  gerants: number; agents: number
  encaissements_total: number; encaissements_30j: number
  tranches_en_retard: number; rappels_attente: number; rappels_echec: number
}