// Traduit les erreurs renvoyées par Supabase Auth (en anglais) en messages pour l'utilisateur.
const MESSAGES_PAR_CODE: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  email_not_confirmed: 'Confirmez d’abord votre email : ouvrez le lien reçu dans votre boîte de réception.',
  user_already_exists: 'Un compte existe déjà avec cet email. Connectez-vous.',
  email_exists: 'Un compte existe déjà avec cet email. Connectez-vous.',
  weak_password: 'Mot de passe trop faible : choisissez-en un plus long, avec lettres et chiffres.',
  email_address_invalid: 'Adresse email invalide.',
  email_address_not_authorized: 'Impossible d’envoyer l’email de confirmation pour le moment. Réessayez dans quelques minutes.',
  over_email_send_rate_limit: 'Trop d’emails envoyés. Réessayez dans quelques minutes.',
  over_request_rate_limit: 'Trop de tentatives. Réessayez dans quelques minutes.',
  signup_disabled: 'Les inscriptions sont temporairement fermées.',
}

export function messageErreurAuth(
  error: { code?: string; message?: string },
  parDefaut = 'Une erreur est survenue. Réessayez dans quelques minutes.',
): string {
  if (error.code && MESSAGES_PAR_CODE[error.code]) return MESSAGES_PAR_CODE[error.code]
  if (/sending .*email/i.test(error.message ?? '')) {
    return 'Impossible d’envoyer l’email de confirmation pour le moment. Réessayez dans quelques minutes.'
  }
  return parDefaut
}
