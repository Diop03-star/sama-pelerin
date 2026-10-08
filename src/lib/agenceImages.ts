import { supabase } from './supabase'

export type ImageAgence = 'logo' | 'profil'

const TYPES_IMAGE_ACCEPTES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const TAILLE_MAX_IMAGE = 5 * 1024 * 1024
const DUREE_URL_SIGNEE_SECONDES = 60 * 60

export function validerImageAgence(fichier: File): string | null {
  if (!TYPES_IMAGE_ACCEPTES.has(fichier.type)) {
    return 'Choisissez une image PNG, JPEG ou WebP.'
  }
  if (fichier.size > TAILLE_MAX_IMAGE) {
    return 'L’image ne doit pas dépasser 5 Mo.'
  }
  return null
}

function extensionImage(fichier: File) {
  if (fichier.type === 'image/jpeg') return 'jpg'
  if (fichier.type === 'image/png') return 'png'
  return 'webp'
}

export async function uploadImageAgence({
  agenceId,
  utilisateurId,
  type,
  fichier,
}: {
  agenceId: string
  utilisateurId: string
  type: ImageAgence
  fichier: File
}): Promise<string> {
  const erreurValidation = validerImageAgence(fichier)
  if (erreurValidation) throw new Error(erreurValidation)

  const chemin = type === 'logo'
    ? `${agenceId}/logo/${crypto.randomUUID()}.${extensionImage(fichier)}`
    : `${agenceId}/profil/${utilisateurId}/${crypto.randomUUID()}.${extensionImage(fichier)}`
  const { error } = await supabase.storage
    .from('logos_agences')
    .upload(chemin, fichier, { upsert: false, contentType: fichier.type })
  if (error) throw new Error('Impossible de téléverser cette image.')
  return chemin
}

export async function supprimerImageAgence(chemin: string | null | undefined): Promise<void> {
  if (!chemin) return
  const { error } = await supabase.storage.from('logos_agences').remove([chemin])
  if (error) throw new Error('Impossible de supprimer l’ancienne image.')
}

export async function obtenirUrlImageAgence(chemin: string | null | undefined): Promise<string | null> {
  if (!chemin) return null
  const { data, error } = await supabase.storage
    .from('logos_agences')
    .createSignedUrl(chemin, DUREE_URL_SIGNEE_SECONDES)
  if (error) throw new Error('Impossible d’afficher cette image.')
  return data.signedUrl
}
