import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { StatsAgence } from '../lib/types'
import { formatFCFA } from '../lib/format'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

export default function SuperAdminGlobal() {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stats_globales')
      if (error) throw error
      return (data ?? []) as StatsAgence[]
    },
  })

  const totaux = stats.reduce(
    (acc, s) => ({
      pelerins: acc.pelerins + Number(s.pelerins_total),
      valides: acc.valides + Number(s.dossiers_valides),
      encaisses30: acc.encaisses30 + Number(s.encaissements_30j),
      rappels: acc.rappels + Number(s.rappels_attente),
      actives: acc.actives + (s.agence_active ? 1 : 0),
    }),
    { pelerins: 0, valides: 0, encaisses30: 0, rappels: 0, actives: 0 }
  )

  if (isLoading) return <div className="text-navy">Chargement…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-lg text-on-surface">Vue d’ensemble</h1>
        <p className="text-body-lg mt-1 text-on-surface-variant">Indicateurs globaux de toutes les agences</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Pèlerins" valeur={totaux.pelerins} icon="person" tone="primary" />
        <StatCard label="Dossiers valides" valeur={totaux.valides} icon="verified" tone="vert" />
        <StatCard label="Encaissés (30 j)" valeur={formatFCFA(totaux.encaisses30)} icon="payments" tone="gold" />
        <StatCard label="Rappels en attente" valeur={totaux.rappels} icon="notifications" tone="error" />
        <StatCard label="Agences actives" valeur={`${totaux.actives}/${stats.length}`} icon="business" tone="primary" />
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Agence</th>
                <th className="px-4 py-3">Pèlerins</th>
                <th className="px-4 py-3">Dossiers</th>
                <th className="px-4 py-3">Groupes</th>
                <th className="px-4 py-3">Encaissé</th>
                <th className="px-4 py-3">Retards</th>
                <th className="px-4 py-3">Rappels</th>
                <th className="px-4 py-3">Membres</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.agence_id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary">{s.agence_nom}</span>
                      {!s.agence_active && <Badge tone="rouge">Désactivée</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-4">{s.pelerins_total}</td>
                  <td className="px-4 py-4">
                    <span className="text-vert">{s.dossiers_valides} valides</span>
                    <span className="text-on-surface-variant"> · </span>
                    <span className="text-ambre">{s.dossiers_complets} complets</span>
                    <span className="text-on-surface-variant"> · {s.dossiers_incomplets} incomplets</span>
                  </td>
                  <td className="px-4 py-4">{s.groupes_total} groupes · {s.places_restantes} places libres</td>
                  <td className="px-4 py-4">{formatFCFA(Number(s.encaissements_total))}</td>
                  <td className="px-4 py-4">{s.tranches_en_retard}</td>
                  <td className="px-4 py-4">{s.rappels_attente} attente / {s.rappels_echec} échec</td>
                  <td className="px-4 py-4">{Number(s.gerants) + Number(s.agents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.length === 0 && <EmptyState message="Aucune agence." />}
        </div>
      </div>
    </div>
  )
}