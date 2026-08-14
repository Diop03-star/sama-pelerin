import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useProfil } from '../../hooks/useAgence'

export default function AppLayout() {
  const { data: profil, isLoading } = useProfil()
  const [menuOuvert, setMenuOuvert] = useState(false)

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }
  if (!profil) {
    return <div className="flex h-screen items-center justify-center text-error">Profil introuvable.</div>
  }
  if (!profil.agence_id) return <Navigate to="/onboarding" replace />

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