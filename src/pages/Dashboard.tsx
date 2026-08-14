import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  LIBELLES_DOCUMENT, LIBELLES_RAPPEL, TONE_RAPPEL,
  formatDate, formatFCFA, messageDocument, messageTranche, whatsappUrl,
} from '../lib/format'
import type { Pelerin, Tranche } from '../lib/types'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import StatCard from '../components/ui/StatCard'
import AlertLink from '../components/ui/AlertLink'
import ProgressBar from '../components/ui/ProgressBar'

interface TrancheAvecPelerin extends Tranche {
  plan_paiement: { pelerin: Pelerin }
}

interface RappelAvecCible {
  id: string
  statut_envoi: string
  date_envoi_prevue: string
  tranche: (Tranche & { plan_paiement: { pelerin: Pelerin } }) | null
  document: { id: string; type_document: string; statut: string; pelerin: Pelerin } | null
}

export default function Dashboard() {
  const { data: rappels = [] } = useQuery({
    queryKey: ['dashboard-rappels'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rappels')
        .select('id, statut_envoi, date_envoi_prevue, tranche:tranches(numero_tranche, montant_prevu, date_echeance, plan_paiement:plans_paiement(pelerin:pelerins(*))), document:documents(type_document, statut, pelerin:pelerins(*))')
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

  const { data: passeports = 0 } = useQuery({
    queryKey: ['dashboard-passeports'],
    queryFn: async () => {
      const debut = new Date()
      debut.setHours(0, 0, 0, 0)
      const fin = new Date(debut)
      fin.setDate(fin.getDate() + 90)
      const { count } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('type_document', 'passeport')
        .gte('date_expiration', debut.toISOString())
        .lte('date_expiration', fin.toISOString())
      return count ?? 0
    },
  })

  const { data: pelerins = [] } = useQuery({
    queryKey: ['dashboard-pelerins'],
    queryFn: async () => {
      const { data } = await supabase.from('pelerins').select('statut_dossier')
      return data as { statut_dossier: string }[]
    },
  })

  const { data: echeanciers = [] } = useQuery({
    queryKey: ['dashboard-encaissements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans_paiement')
        .select('montant_total, tranches(paiements(montant_paye))')
      return data as unknown as { montant_total: number; tranches: { paiements: { montant_paye: number }[] }[] }[]
    },
  })

  const valides = pelerins.filter((p) => p.statut_dossier === 'valide').length
  const totalPelerins = pelerins.length
  const totalAttendu = echeanciers.reduce((s, p) => s + p.montant_total, 0)
  const totalPaye = echeanciers.reduce(
    (s, p) => s + p.tranches.reduce((x, t) => x + t.paiements.reduce((y, pa) => y + pa.montant_paye, 0), 0),
    0
  )
  const resteGlobal = totalAttendu - totalPaye
  const progression = totalAttendu > 0 ? Math.round((totalPaye / totalAttendu) * 100) : 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Tableau de bord</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Vue d’ensemble de la saison Hajj 2026</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-primary bg-surface-container-lowest px-4 py-2 text-label-md text-primary shadow-sm hover:bg-surface-container-low"
          >
            <Icon name="download" size={18} />
            Rapport Global
          </button>
          <Link
            to="/liste-des-pelerins?nouveau=1"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md text-on-primary shadow-sm hover:bg-primary-container"
          >
            <Icon name="add" size={18} />
            Nouveau Pèlerin
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <h2 className="sr-only">Alertes à traiter</h2>
        <AlertLink
          tone="rouge"
          icon="warning"
          titre={`${dossiersIncomplets.length} Pèlerins`}
          description="Dossiers incomplets à compléter"
          to="/liste-des-pelerins?statut=incomplet"
        />
        <AlertLink
          tone="gold"
          icon="schedule"
          titre={`${tranchesRetard.length} Paiements`}
          description="En retard sur l’échéancier"
          to="/paiements-echeanciers?statut=en_retard"
        />
        <AlertLink
          tone="rouge"
          icon="assignment_late"
          titre={`${passeports} Document${passeports > 1 ? 's' : ''}`}
          description="Passeport expirant bientôt"
          to="/gestion-des-documents?alerte=passeport"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <StatCard label="Total Pèlerins" valeur={totalPelerins} icon="group" tendance={{ texte: `${valides} dossiers validés`, positif: true }} />
        <StatCard label="Total encaissé" valeur={formatFCFA(totalPaye)} icon="payments" tone="gold" />
        <StatCard label="Reste global" valeur={formatFCFA(resteGlobal)} icon="account_balance_wallet" tone={resteGlobal > 0 ? 'error' : 'vert'} />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="savings" size={20} className="text-primary" />
              <h3 className="text-headline-sm text-primary">Progression financière</h3>
            </div>
            <span className="text-data-mono text-on-surface-variant">{progression}%</span>
          </div>
          <ProgressBar valeur={progression} tone="gold" />
          <div className="mt-3 flex flex-wrap gap-6 text-body-md">
            <p className="text-on-surface-variant">Encaissé : <span className="font-semibold text-vert">{formatFCFA(totalPaye)}</span></p>
            <p className="text-on-surface-variant">Attendu : <span className="font-semibold text-on-surface">{formatFCFA(totalAttendu)}</span></p>
            <p className="text-on-surface-variant">Reste : <span className={`font-semibold ${resteGlobal > 0 ? 'text-error' : 'text-vert'}`}>{formatFCFA(resteGlobal)}</span></p>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="notifications_active" size={20} className="text-secondary" />
            <h3 className="text-headline-sm text-primary">Rappels à envoyer</h3>
          </div>
          {rappels.length === 0 && <EmptyState message="Aucun rappel en attente." />}
          <ul className="space-y-3">
            {rappels.map((r) => {
              const cible = r.tranche
                ? `Tranche ${r.tranche.numero_tranche} — ${formatFCFA(r.tranche.montant_prevu)}`
                : r.document
                  ? LIBELLES_DOCUMENT[r.document.type_document]
                  : '—'
              const pelerin = r.tranche?.plan_paiement.pelerin ?? r.document?.pelerin
              if (!pelerin) return null
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant p-3 hover:bg-surface-container-low">
                  <div className="min-w-0">
                    <Link to={`/details-du-pelerin/${pelerin.id}`} className="text-body-md font-medium text-primary hover:underline">
                      {pelerin.prenom} {pelerin.nom}
                    </Link>
                    <p className="text-label-md text-on-surface-variant">{cible} · prévu {formatDate(r.date_envoi_prevue)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={TONE_RAPPEL[r.statut_envoi]}>{LIBELLES_RAPPEL[r.statut_envoi]}</Badge>
                    <a
                      href={whatsappUrl(
                        pelerin.telephone,
                        r.tranche
                          ? messageTranche(pelerin.prenom, pelerin.nom, r.tranche.numero_tranche, r.tranche.montant_prevu, r.tranche.date_echeance)
                          : r.document
                            ? messageDocument(pelerin.prenom, pelerin.nom, r.document.type_document, r.document.statut)
                            : ''
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                      title="Envoyer sur WhatsApp"
                    >
                      <Icon name="whatsapp" size={18} />
                    </a>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}