import { supabase } from './supabase'

export interface MetadonneesDocument {
  date_expiration?: string | null
  numero_document?: string | null
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