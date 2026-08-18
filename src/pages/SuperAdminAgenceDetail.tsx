import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Agence, StatsAgence } from '../lib/types'
import { formatDate } from '../lib/format'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'

export default function SuperAdminAgenceDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [aConfirmer, setAConfirmer] = useState<Agence | null>(null)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stats_globales')
      if (error) throw error
      return (data ?? []) as StatsAgence[]
    },
  })

  const { data: agence, isLoading: agenceEnChargement } = useQuery({
    queryKey: ['superadmin-agence-infos', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from('agences').select('*').eq('id', id!).single()
      return data as Agence | null
    },
  })

  const basculerActive = useMutation({
    mutationFn: async ({ agenceId, active }: { agenceId: string; active: boolean }) => {
      const { error } = await supabase.from('agences').update({ active }).eq('id', agenceId)
      if (error) throw error
    },
    onSuccess: () => {
      setAConfirmer(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-agences'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-agence-infos', id] })
    },
  })

  if (isLoading || agenceEnChargement) return <div className="text-on-surface">Chargement…</div>

  const s = stats?.find((row) => row.agence_id === id)
  if (!agence || !s) return <div className="text-error">Agence introuvable.</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-1 flex items-center gap-2 text-label-md text-on-surface-variant">
            <Link to="/superadmin/agences" className="hover:text-primary">Agences</Link>
            <Icon name="chevron_right" size={16} />
            <span className="font-bold text-primary">Détails</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-display-lg text-on-surface">{agence.nom}</h1>
            {agence.active ? <Badge tone="vert">Active</Badge> : <Badge tone="rouge">Désactivée</Badge>}
          </div>
        </div>
        <Button variant="secondary" onClick={() => setAConfirmer(agence)}>
          <Icon name={agence.active ? 'block' : 'check_circle'} size={18} className="mr-2" />
          {agence.active ? 'Désactiver' : 'Réactiver'}
        </Button>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant">Téléphone</span>
            <span className="text-body-md text-on-surface">{agence.telephone || '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant">Email</span>
            <span className="text-body-md text-on-surface">{agence.email ?? '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant">Adresse</span>
            <span className="text-body-md text-on-surface">{agence.adresse ?? '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant">Créée le</span>
            <span className="text-body-md text-on-surface">{formatDate(agence.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pèlerins" valeur={s.pelerins_total} icon="person" tone="primary" />
        <StatCard
          label="Dossiers"
          valeur={
            <span className="text-body-md text-on-surface">
              <span className="text-vert">{s.dossiers_valides} valides</span>
              <span className="text-on-surface-variant"> · </span>
              {s.dossiers_incomplets} incomplets
            </span>
          }
          icon="verified"
          tone="vert"
        />
        <StatCard
          label="Groupes"
          valeur={`${s.groupes_total} groupes · ${s.places_restantes} places libres`}
          icon="group"
          tone="primary"
        />
        <StatCard label="Total encaissé" valeur={s.encaissements_total} icon="payments" tone="gold" monetaire />
        <StatCard label="Retards" valeur={s.tranches_en_retard} icon="schedule" tone="error" />
        <StatCard label="Rappels" valeur={`${s.rappels_attente} attente / ${s.rappels_echec} échec`} icon="notifications" tone="error" />
        <StatCard label="Membres" valeur={Number(s.gerants) + Number(s.agents)} icon="business" tone="primary" />
      </div>

      <Modal
        open={!!aConfirmer}
        title={aConfirmer?.active ? "Désactiver l'agence" : "Réactiver l'agence"}
        onClose={() => setAConfirmer(null)}
      >
        <p className="text-body-md text-on-surface-variant">
          {aConfirmer?.active
            ? `Désactiver « ${aConfirmer.nom} » ? Ses membres ne pourront plus accéder à leurs données.`
            : `Réactiver « ${aConfirmer?.nom} » ? Ses membres retrouveront l'accès.`}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setAConfirmer(null)}>Annuler</Button>
          <Button
            type="button"
            variant={aConfirmer?.active ? 'danger' : 'primary'}
            disabled={basculerActive.isPending}
            onClick={() => aConfirmer && basculerActive.mutate({ agenceId: aConfirmer.id, active: !aConfirmer.active })}
          >
            Confirmer
          </Button>
        </div>
      </Modal>
    </div>
  )
}