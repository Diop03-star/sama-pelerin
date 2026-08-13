import { NavLink } from 'react-router-dom'
import { useProfil } from '../../hooks/useAgence'

const NAVIGATION = [
  { section: 'Vue d’ensemble', items: [{ to: '/tableau-de-bord', label: 'Tableau de bord' }] },
  {
    section: 'Gestion des pèlerins',
    items: [
      { to: '/liste-des-groupes', label: 'Groupes' },
      { to: '/liste-des-pelerins', label: 'Pèlerins' },
      { to: '/gestion-des-documents', label: 'Documents' },
    ],
  },
  { section: 'Finances', items: [{ to: '/paiements-echeanciers', label: 'Paiements & échéanciers' }] },
]

export default function Sidebar() {
  const { data: profil } = useProfil()
  const sections = profil?.role === 'gerant'
    ? [...NAVIGATION, { section: 'Administration', items: [{ to: '/membres', label: 'Membres' }] }]
    : NAVIGATION

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-border bg-white md:block">
      <div className="flex h-16 items-center border-b border-border px-6">
        <span className="text-lg font-bold text-navy">Stitch Sama Pèlerin</span>
      </div>
      <nav className="p-4">
        {sections.map((s) => (
          <div key={s.section} className="mb-4">
            <p className="label mb-2 px-3 text-gray-400">{s.section}</p>
            {s.items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                className={({ isActive }) =>
                  `mb-1 block rounded-md px-3 py-2 text-sm ${
                    isActive ? 'border-l-4 border-gold bg-navy/5 font-semibold text-navy' : 'text-gray-600 hover:bg-surface'
                  }`
                }
              >
                {i.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
