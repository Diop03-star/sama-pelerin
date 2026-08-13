import { Navigate, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useProfil } from '../../hooks/useAgence'

export default function AppLayout() {
  const { data: profil, isLoading } = useProfil()

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }
  if (!profil) {
    return <div className="flex h-screen items-center justify-center text-error">Profil introuvable.</div>
  }
  if (!profil.agence_id) return <Navigate to="/onboarding" replace />

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
