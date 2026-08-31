import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAgence, useProfil } from '../../hooks/useAgence'
import { filtrerRecherche } from '../../lib/recherche'
import Icon from '../ui/Icon'
import NotifPanel from './NotifPanel'
import ProfilMenu from './ProfilMenu'

interface TopbarProps {
  onOuvrirMenu: () => void
}

export default function Topbar({ onOuvrirMenu }: TopbarProps) {
  const navigate = useNavigate()
  const { data: profil } = useProfil()
  const { data: agence } = useAgence()
  const [terme, setTerme] = useState('')
  const [focus, setFocus] = useState(false)
  const timerBlur = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerBlur.current) window.clearTimeout(timerBlur.current)
    }
  }, [])

  const { data: pelerins = [] } = useQuery({
    queryKey: ['recherche-pelerins'],
    queryFn: async () => {
      const { data } = await supabase.from('pelerins').select('id, prenom, nom, telephone')
      return data as { id: string; prenom: string; nom: string; telephone: string }[]
    },
  })

  const { data: groupes = [] } = useQuery({
    queryKey: ['recherche-groupes'],
    queryFn: async () => {
      const { data } = await supabase.from('groupes').select('id, nom')
      return data as { id: string; nom: string }[]
    },
  })

  const resultats = useMemo(() => {
    const pel = filtrerRecherche(
      terme,
      pelerins.map((p) => ({
        id: p.id,
        libelle: `${p.prenom} ${p.nom}`,
        sousLibelle: p.telephone,
        to: `/details-du-pelerin/${p.id}`,
      }))
    )
    const grp = filtrerRecherche(
      terme,
      groupes.map((g) => ({ id: g.id, libelle: g.nom, sousLibelle: '', to: `/liste-des-pelerins?groupe=${g.id}` }))
    )
    return [...pel, ...grp]
  }, [terme, pelerins, groupes])

  function ouvrirResultat(to: string) {
    setTerme('')
    setFocus(false)
    navigate(to)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const t = terme.trim()
    if (!t) return
    ouvrirResultat(`/liste-des-pelerins?q=${encodeURIComponent(t)}`)
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={onOuvrirMenu}
          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low md:hidden"
        >
          <Icon name="menu" size={20} />
        </button>
        <h2 className="text-headline-sm font-bold text-primary">{agence?.nom ?? 'SamaPèlerin'}</h2>
      </div>

      <div className="relative mx-6 hidden max-w-md flex-1 sm:block">
        <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <form onSubmit={onSubmit}>
          <input
            type="text"
            value={terme}
            onChange={(e) => setTerme(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => {
              if (timerBlur.current) window.clearTimeout(timerBlur.current)
              timerBlur.current = window.setTimeout(() => setFocus(false), 150)
            }}
            placeholder="Rechercher pèlerins, groupes…"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-10 pr-4 text-body-md text-on-surface transition-colors placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </form>
        {focus && terme.trim() && resultats.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-md">
            {resultats.map((r) => (
              <li key={r.to}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    ouvrirResultat(r.to)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-low"
                >
                  <Icon name={r.to.startsWith('/details') ? 'person' : 'group'} size={18} className="text-on-surface-variant" />
                  <span>
                    <span className="block text-body-md font-medium text-on-surface">{r.libelle}</span>
                    {r.sousLibelle && <span className="block text-label-md text-on-surface-variant">{r.sousLibelle}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {focus && terme.trim() && resultats.length === 0 && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-label-md text-on-surface-variant shadow-md">
            Aucun résultat pour « {terme.trim()} ».
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <NotifPanel />
        <Link
          to="/tutoriels"
          aria-label="Aide"
          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low"
        >
          <Icon name="help_outline" size={20} />
        </Link>
        <div className="ml-2 flex items-center gap-3 border-l border-outline-variant pl-4">
          <div className="hidden text-right lg:block">
            <p className="text-label-md text-on-surface">{profil?.role === 'gerant' ? 'Gérant' : 'Agent'}</p>
            <p className="text-[10px] text-on-surface-variant">{agence?.nom}</p>
          </div>
          <ProfilMenu />
        </div>
      </div>
    </header>
  )
}