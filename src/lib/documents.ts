import { supabase } from './supabase'

export interface MetadonneesDocument {
  date_expiration?: string | null
  numero_document?: string | null
}

// Doit rester aligné sur les limites du bucket documents_pelerins (schema.sql)
export const TYPES_FICHIER_ACCEPTES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const TAILLE_MAX_FICHIER = 10 * 1024 * 1024

const EXTENSIONS_FICHIER: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function validerFichierDocument(fichier: File): string | null {
  if (!TYPES_FICHIER_ACCEPTES.includes(fichier.type)) {
    return 'Choisissez un fichier PDF, JPEG, PNG ou WebP.'
  }
  if (fichier.size > TAILLE_MAX_FICHIER) {
    return 'Le fichier ne doit pas dépasser 10 Mo.'
  }
  return null
}

// Le nom d'origine n'entre pas dans le chemin : seul un identifiant aléatoire est utilisé.
export function cheminFichierDocument(agenceId: string, pelerinId: string, fichier: File): string {
  return `${agenceId}/${pelerinId}/${crypto.randomUUID()}.${EXTENSIONS_FICHIER[fichier.type]}`
}

export function expirantDans(dateExpiration: string, jours: number, reference = new Date()): boolean {
  const exp = new Date(dateExpiration)
  if (Number.isNaN(exp.getTime())) return false
  const debut = new Date(reference)
  debut.setHours(0, 0, 0, 0)
  const fin = new Date(debut)
  fin.setDate(fin.getDate() + jours)
  return exp >= debut && exp <= fin
}

export async function validerSansFichier(
  agenceId: string,
  pelerinId: string,
  typeDocument: string,
  metadonnees?: MetadonneesDocument
) {
  const { error } = await supabase.from('documents').upsert(
    {
      agence_id: agenceId,
      pelerin_id: pelerinId,
      type_document: typeDocument,
      statut: 'valide',
      date_upload: new Date().toISOString(),
      ...metadonnees,
    },
    { onConflict: 'pelerin_id,type_document' }
  )
  if (error) throw error
}

export async function majMetadonnees(
  docId: string,
  metadonnees: { date_expiration: string | null; numero_document: string | null }
) {
  const { error } = await supabase.from('documents').update(metadonnees).eq('id', docId)
  if (error) throw error
}