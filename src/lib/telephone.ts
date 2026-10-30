// Numéros stockés au format international sans espaces (+221771234567),
// affichés groupés (+221 77 123 45 67). Les numéros sénégalais sont contrôlés
// strictement ; les autres pays doivent simplement commencer par « + ».

const INDICATIF_SENEGAL = '221'

export const MESSAGE_TELEPHONE_INVALIDE =
  'Numéro invalide : saisissez 9 chiffres (ex. 77 123 45 67) ou un numéro international commençant par +.'

function numeroSenegalValide(neufChiffres: string): boolean {
  return /^[37]\d{8}$/.test(neufChiffres)
}

export function normaliserTelephone(saisie: string): string | null {
  let brut = saisie.trim().replace(/[\s.\-()]/g, '')
  if (brut.startsWith('00')) brut = `+${brut.slice(2)}`

  if (brut.startsWith('+')) {
    const chiffres = brut.slice(1)
    if (!/^\d{8,15}$/.test(chiffres)) return null
    if (chiffres.startsWith(INDICATIF_SENEGAL)) {
      const local = chiffres.slice(INDICATIF_SENEGAL.length)
      return numeroSenegalValide(local) ? `+${chiffres}` : null
    }
    return `+${chiffres}`
  }

  if (!/^\d+$/.test(brut)) return null
  if (brut.length === 9 && numeroSenegalValide(brut)) return `+${INDICATIF_SENEGAL}${brut}`
  if (brut.length === 12 && brut.startsWith(INDICATIF_SENEGAL) && numeroSenegalValide(brut.slice(3))) return `+${brut}`
  return null
}

export function formatTelephone(valeur: string | null | undefined): string {
  if (!valeur) return ''
  const numero = normaliserTelephone(valeur)
  if (!numero) return valeur
  if (numero.startsWith(`+${INDICATIF_SENEGAL}`)) {
    const l = numero.slice(4)
    return `+221 ${l.slice(0, 2)} ${l.slice(2, 5)} ${l.slice(5, 7)} ${l.slice(7)}`
  }
  return numero
}

// Pour la recherche : « 77 123 » doit retrouver « +221771234567 ».
export function chiffresTelephone(valeur: string): string {
  return valeur.replace(/\D/g, '')
}
