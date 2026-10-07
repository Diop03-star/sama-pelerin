import { Navigate, Outlet } from 'react-router-dom'
import { useProfil } from '../hooks/useAgence'

export default function GerantRoute() {
  const { data: profil, isLoading } = useProfil()

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }

  if (profil?.role !== 'gerant') {
    return <Navigate to="/tableau-de-bord" replace />
  }

  return <Outlet />
}
