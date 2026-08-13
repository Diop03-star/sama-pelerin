import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_DOCUMENT, LIBELLES_DOSSIER, TONE_DOSSIER, formatDate, formatFCFA } from '../lib/format'
import type { Pelerin, Tranche } from '../lib/types'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import AlertPanel from '../components/ui/AlertPanel'
import EmptyState from '../components/ui/EmptyState'

interface TrancheAvecPelerin extends Tranche {
  plan_paiement: { pelerin: Pelerin }
}

interface RappelAvecCible {
  id: string
  statut_envoi: string
  date_envoi_prevue: string
  tranche: (Tranche & { plan_paiement: { pelerin: Pelerin } }) | null
  document: { id: string; type_document: string; pelerin: Pelerin } | null
}

export default function Dashboard() {
  const { data: rappels = [] } = useQuery({
    queryKey: ['dashboard-rappels'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rappels')
        .select('id, statut_envoi, date_envoi_prevue, tranche:tranches(numero_tranche, montant_prevu, date_echeance, plan_paiement:plans_paiement(pelerin:pelerins(*))), document:documents(type_document, pelerin:pelerins(*))')
        .eq('statut_envoi', 'en_attente')
        .order('date_envoi_prevue', { ascending: true })
      return data as unknown as RappelAvecCible[]
    },
  })

  const { data: tranchesRetard = [] } = useQuery({
    queryKey: ['dashboard-retard'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tranches')
        .select('*, plan_paiement:plans_paiement(pelerin:pelerins(*))')
        .eq('statut', 'en_retard')
        .order('date_echeance', { ascending: true })
      return data as unknown as TrancheAvecPelerin[]
    },
  })

  const { data: dossiersIncomplets = [] } = useQuery({
    queryKey: ['dashboard-dossiers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pelerins')
        .select('*')
        .eq('statut_dossier', 'incomplet')
        .order('nom')
      return data as Pelerin[]
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-headline text-navy">Tableau de bord</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="label">Rappels en attente</p>
          <p className="mt-1 text-lg font-semibold text-navy">{rappels.length}</p>
        </Card>
        <Card className="p-5">
          <p className="label">Tranches en retard</p>
          <p className="mt-1 text-lg font-semibold text-error">{tranchesRetard.length}</p>
        </Card>
        <Card className="p-5">
          <p className="label">Dossiers incomplets</p>
          <p className="mt-1 text-lg font-semibold text-ambre">{dossiersIncomplets.length}</p>
        </Card>
      </div>

      {rappels.length > 0 && (
        <AlertPanel tone="ambre" title="Rappels à envoyer">
          {rappels.map((r) => {
            const cible = r.tranche
              ? `Tranche ${r.tranche.numero_tranche} — ${formatFCFA(r.tranche.montant_prevu)}`
              : r.document
                ? LIBELLES_DOCUMENT[r.document.type_document]
                : '—'
            const pelerin = r.tranche?.plan_paiement.pelerin ?? r.document?.pelerin
            if (!pelerin) return null
            return (
              <p key={r.id}>
                <Link to={`/details-du-pelerin/${pelerin.id}`} className="font-medium text-navy hover:underline">
                  {pelerin.prenom} {pelerin.nom}
                </Link>{' '}
                — {cible} (prévu {formatDate(r.date_envoi_prevue)})
              </p>
            )
          })}
        </AlertPanel>
      )}

      {tranchesRetard.length > 0 && (
        <AlertPanel tone="rouge" title="Tranches en retard">
          {tranchesRetard.map((t) => (
            <p key={t.id}>
              <Link to={`/details-du-pelerin/${t.plan_paiement.pelerin.id}`} className="font-medium text-navy hover:underline">
                {t.plan_paiement.pelerin.prenom} {t.plan_paiement.pelerin.nom}
              </Link>{' '}
              — tranche {t.numero_tranche} ({formatFCFA(t.montant_prevu)}), échéance {formatDate(t.date_echeance)}
            </p>
          ))}
        </AlertPanel>
      )}

      {dossiersIncomplets.length > 0 && (
        <AlertPanel tone="ambre" title="Dossiers à compléter">
          {dossiersIncomplets.map((p) => (
            <p key={p.id}>
              <Link to={`/details-du-pelerin/${p.id}`} className="font-medium text-navy hover:underline">
                {p.prenom} {p.nom}
              </Link>{' '}
              — <Badge tone={TONE_DOSSIER[p.statut_dossier]}>{LIBELLES_DOSSIER[p.statut_dossier]}</Badge>
            </p>
          ))}
        </AlertPanel>
      )}

      {rappels.length === 0 && tranchesRetard.length === 0 && dossiersIncomplets.length === 0 && (
        <Card>
          <EmptyState message="Tout est à jour. Rien à traiter aujourd’hui." />
        </Card>
      )}
    </div>
  )
}