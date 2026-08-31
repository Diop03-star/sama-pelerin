import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../hooks/useAgence'
import useDropdown from '../../hooks/useDropdown'
import Icon from '../ui/Icon'

export default function ProfilMenu() {
  const navigate = useNavigate()
  const { data: profil } = useProfil()
  const { ref, ouvert, basculer, fermer } = useDropdown()

  const roleLibelle =
    profil?.role === 'gerant' ? 'Gérant' : profil?.role === 'superadmin' ? 'Super admin' : 'Agent'

  async function deconnexion() {
    fermer()
    await supabase.auth.signOut()
    navigate('/login')
  }

  function aller(to: string) {
    fermer()
    navigate(to)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Menu profil"
        onClick={basculer}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-label-md font-bold text-on-primary-container hover:bg-surface-container-low"
      >
        {profil?.nom?.charAt(0).toUpperCase() ?? '?'}
      </button>
      {ouvert && (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-md">
          <div className="border-b border-outline-variant px-4 py-3">
            <p className="text-body-md font-semibold text-on-surface">{profil?.nom}</p>
            <p className="text-label-md text-on-surface-variant">{roleLibelle}</p>
          </div>
          <ul>
            <li>
              <button
                type="button"
                onClick={() => aller('/profil')}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-label-md text-on-surface hover:bg-surface-container-low"
              >
                <Icon name="person" size={18} />
                Mon profil
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => aller('/tutoriels')}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-label-md text-on-surface hover:bg-surface-container-low"
              >
                <Icon name="help_outline" size={18} />
                Aide
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={deconnexion}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-label-md text-error hover:bg-error-container"
              >
                <Icon name="logout" size={18} />
                Déconnexion
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}