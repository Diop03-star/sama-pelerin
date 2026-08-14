import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../hooks/useAgence'
import Icon from '../ui/Icon'

interface NavItem {
  to: string
  label: string
  icon: string
}

interface NavSection {
  section: string
  items: NavItem[]
}

const NAVIGATION: NavSection[] = [
  { section: 'Vue d’ensemble', items: [{ to: '/tableau-de-bord', label: 'Tableau de bord', icon: 'dashboard' }] },
  {
    section: 'Gestion des pèlerins',
    items: [
      { to: '/liste-des-pelerins', label: 'Pèlerins', icon: 'person' },
      { to: '/liste-des-groupes', label: 'Groupes', icon: 'group' },
      { to: '/gestion-des-documents', label: 'Documents', icon: 'description' },
    ],
  },
  { section: 'Finances', items: [{ to: '/paiements-echeanciers', label: 'Paiements & échéanciers', icon: 'payments' }] },
]

interface SidebarProps {
  ouverte: boolean
  onFermer: () => void
}

export default function Sidebar({ ouverte, onFermer }: SidebarProps) {
  const navigate = useNavigate()
  const { data: profil } = useProfil()
  const sections: NavSection[] =
    profil?.role === 'gerant'
      ? [...NAVIGATION, { section: 'Administration', items: [{ to: '/membres', label: 'Membres', icon: 'settings' }] }]
      : NAVIGATION

  async function deconnexion() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const contenu = (
    <div className="flex h-full flex-col">
      <div className="mb-10 flex items-center gap-3 px-2 pt-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-on-primary-container">
          <Icon name="mosque" size={20} />
        </div>
        <div>
          <h1 className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</h1>
          <p className="text-label-md text-on-surface-variant">Portail Administrateur</p>
        </div>
      </div>
      <ul className="flex-1 space-y-4 overflow-y-auto">
        {sections.map((s) => (
          <li key={s.section}>
            <p className="text-label-md mb-1 px-3 text-on-surface-variant">{s.section}</p>
            <ul className="space-y-1">
              {s.items.map((i) => (
                <li key={i.to}>
                  <NavLink
                    to={i.to}
                    onClick={onFermer}
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
                        <Icon name={i.icon} fill={isActive} size={20} />
                        {i.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-1 border-t border-outline-variant pt-4">
        <li>
          <a className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-low">
            <Icon name="help_outline" size={20} />
            Aide
          </a>
        </li>
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
    <>
      <aside className="hidden w-[260px] shrink-0 border-r border-outline-variant bg-surface-container-lowest px-4 py-6 md:block">
        {contenu}
      </aside>
      {ouverte && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/30" onClick={onFermer} />
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-surface-container-lowest px-4 py-6 shadow-lg">
            {contenu}
          </aside>
        </div>
      )}
    </>
  )
}