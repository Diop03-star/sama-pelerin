import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../hooks/useAgence'
import Icon from '../ui/Icon'

const NAVIGATION = [
  { to: '/superadmin', label: 'Vue d’ensemble', icon: 'dashboard' },
  { to: '/superadmin/agences', label: 'Agences', icon: 'business' },
  { to: '/superadmin/tutos', label: 'Tutoriels', icon: 'play_circle' },
]

export default function SuperAdminLayout() {
  const navigate = useNavigate()
  const { data: profil, isLoading } = useProfil()
  const [menuOuvert, setMenuOuvert] = useState(false)

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }
  if (!profil) {
    return <div className="flex h-screen items-center justify-center text-error">Profil introuvable.</div>
  }
  if (profil.role !== 'superadmin') return <Navigate to="/tableau-de-bord" replace />

  async function deconnexion() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const contenu = (
    <div className="flex h-full flex-col">
      <div className="mb-10 flex items-center gap-3 px-2 pt-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-on-primary-container">
          <Icon name="admin_panel_settings" size={20} />
        </div>
        <div>
          <h1 className="text-headline-sm font-bold text-primary">SamaPèlerin</h1>
          <p className="text-label-md text-on-surface-variant">Superadmin</p>
        </div>
      </div>
      <ul className="flex-1 space-y-4 overflow-y-auto">
        {NAVIGATION.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={() => setMenuOuvert(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-label-md transition-all ${
                  isActive
                    ? 'translate-x-1 border-l-4 border-secondary-fixed-dim bg-surface-container font-bold text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} fill={isActive} size={20} />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-1 border-t border-outline-variant pt-4">
        <li>
          <button
            type="button"
            onClick={deconnexion}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-label-md text-error hover:bg-error-container"
          >
            <Icon name="logout" size={20} />
            Déconnexion
          </button>
        </li>
      </ul>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-[260px] shrink-0 border-r border-outline-variant bg-surface-container-lowest px-4 py-6 md:block">
        {contenu}
      </aside>
      {menuOuvert && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/30" onClick={() => setMenuOuvert(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-surface-container-lowest px-4 py-6 shadow-lg">
            {contenu}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Ouvrir le menu"
              onClick={() => setMenuOuvert(true)}
              className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low md:hidden"
            >
              <Icon name="menu" size={20} />
            </button>
            <h2 className="text-headline-sm font-bold text-primary">Superadmin</h2>
          </div>
          <div className="flex items-center gap-3 border-l border-outline-variant pl-4">
            <div className="hidden text-right lg:block">
              <p className="text-label-md text-on-surface">Superadmin</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-label-md font-bold text-on-primary-container">
              {profil.nom?.charAt(0).toUpperCase() ?? '?'}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}