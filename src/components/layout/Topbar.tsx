import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAgence, useProfil } from '../../hooks/useAgence'

export default function Topbar() {
  const navigate = useNavigate()
  const { data: profil } = useProfil()
  const { data: agence } = useAgence()

  async function deconnexion() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-6">
      <p className="text-sm font-semibold text-navy md:hidden">Stitch Sama Pèlerin</p>
      <div className="hidden md:block" />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-navy">{profil?.nom}</p>
          <p className="text-xs text-gray-500">{agence?.nom ?? profil?.role === 'gerant' ? 'Gérant' : 'Agent'}</p>
        </div>
        <button onClick={deconnexion} className="btn-secondary text-xs">Déconnexion</button>
      </div>
    </header>
  )
}
