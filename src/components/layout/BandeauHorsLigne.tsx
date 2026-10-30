import { useSyncExternalStore } from 'react'
import Icon from '../ui/Icon'

function abonner(rappel: () => void) {
  window.addEventListener('online', rappel)
  window.addEventListener('offline', rappel)
  return () => {
    window.removeEventListener('online', rappel)
    window.removeEventListener('offline', rappel)
  }
}

// Sans réseau, l'application affiche encore les dernières données chargées :
// on prévient pour éviter qu'un agent ne se fie à des chiffres périmés ou ne perde une saisie.
export default function BandeauHorsLigne() {
  const enLigne = useSyncExternalStore(abonner, () => navigator.onLine, () => true)
  if (enLigne) return null
  return (
    <div role="status" className="flex items-start gap-2 border-b border-error/30 bg-error-container px-4 py-2 text-body-md text-on-error-container md:px-8">
      <Icon name="warning" size={18} className="mt-0.5 shrink-0" />
      <p>Hors connexion : les données affichées peuvent ne pas être à jour et les modifications ne seront pas enregistrées.</p>
    </div>
  )
}
