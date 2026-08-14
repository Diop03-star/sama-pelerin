import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAgence, useProfil } from '../../hooks/useAgence'
import Icon from '../ui/Icon'

export default function AppLayout() {
  const { data: profil, isLoading } = useProfil()
  const { data: agence, isLoading: agenceChargement } = useAgence()
  const [menuOuvert, setMenuOuvert] = useState(false)

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }
  if (!profil) {
    return <div className="flex h-screen items-center justify-center text-error">Profil introuvable.</div>
  }
  if (profil.role === 'superadmin') return <Navigate to="/superadmin" replace />
  if (!profil.agence_id) return <Navigate to="/onboarding" replace />
  if (agenceChargement) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }
  if (!agence || !agence.active) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center shadow-sm">
          <Icon name="block" size={40} className="mx-auto mb-4 text-error" />
          <h1 className="text-headline-md mb-2 text-on-surface">Agence désactivée</h1>
          <p className="text-body-md text-on-surface-variant">Votre agence a été désactivée. Contactez votre administrateur.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar ouverte={menuOuvert} onFermer={() => setMenuOuvert(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOuvrirMenu={() => setMenuOuvert(true)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}