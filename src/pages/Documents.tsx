import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_DOCUMENT } from '../lib/format'
import { statutDossierDepuisDocuments, statutDocumentParType } from '../lib/plan'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

interface PelerinAvecDocuments {
  id: string
  prenom: string
  nom: string
  telephone: string
  documents: { type_document: string; statut: string }[]
}

const LIBELLES_STATUT_LIGNE: Record<string, string> = {
  valide: 'Validé',
  incomplet: 'Incomplet',
  manquant: 'Manquant',
}

const TONE_STATUT_LIGNE: Record<string, string> = {
  valide: 'vert',
  incomplet: 'rouge',
  manquant: 'rouge',
}

export default function Documents() {
  const [params, setParams] = useSearchParams()
  const alerte = params.get('alerte') ?? ''
  const [filtreType, setFiltreType] = useState(alerte ? 'passeport' : '')
  const [filtreStatut, setFiltreStatut] = useState('')

  const { data: pelerins = [] } = useQuery({
    queryKey: ['pelerins-documents'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pelerins')
        .select('id, prenom, nom, telephone, documents(type_document, statut)')
        .order('nom')
      return data as unknown as PelerinAvecDocuments[]
    },
  })

  const lignes = useMemo(() => {
    return pelerins.map((p) => ({
      ...p,
      statut: filtreType
        ? statutDocumentParType(p.documents, filtreType)
        : statutDossierDepuisDocuments(p.documents),
    }))
  }, [pelerins, filtreType])

  const filtrees = useMemo(() => {
    return lignes.filter((l) => !filtreStatut || l.statut === filtreStatut)
  }, [lignes, filtreStatut])

  const compteurs = useMemo(() => {
    const valides = pelerins.filter(
      (p) => statutDossierDepuisDocuments(p.documents) === 'valide'
    ).length
    return { total: pelerins.length, valides, incomplets: pelerins.length - valides }
  }, [pelerins])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Gestion des documents</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Suivez les dossiers de vos pèlerins</p>
        </div>
        <select
          className="input max-w-xs"
          value={filtreType}
          onChange={(e) => {
            setFiltreType(e.target.value)
            if (alerte && e.target.value !== 'passeport') {
              setParams((prev) => {
                const next = new URLSearchParams(prev)
                next.delete('alerte')
                return next
              })
            }
          }}
        >
          <option value="">Tous les types</option>
          {Object.entries(LIBELLES_DOCUMENT).map(([cle, libelle]) => (
            <option key={cle} value={cle}>{libelle}</option>
          ))}
        </select>
        <select className="input max-w-xs" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="valide">Validé</option>
          <option value="incomplet">Incomplet</option>
          <option value="manquant">Manquant</option>
        </select>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Pèlerins" valeur={compteurs.total} icon="group" />
        <StatCard label="Dossiers validés" valeur={compteurs.valides} icon="check_circle" tone="vert" />
        <StatCard label="Dossiers incomplets" valeur={compteurs.incomplets} icon="warning" tone="error" />
      </section>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.map((p) => (
                <tr key={p.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4">
                    <Link to={`/details-du-pelerin/${p.id}`} className="font-medium text-primary hover:underline">
                      {p.prenom} {p.nom}
                    </Link>
                    <p className="text-label-md text-on-surface-variant">{p.telephone}</p>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={TONE_STATUT_LIGNE[p.statut]}>{LIBELLES_STATUT_LIGNE[p.statut]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrees.length === 0 && <EmptyState message="Aucun pèlerin pour ce filtre." />}
        </div>
      </div>
    </div>
  )
}