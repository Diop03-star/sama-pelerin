import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_STATUT_PLAN, LIBELLES_TRANCHE, TONE_STATUT_PLAN, TONE_TRANCHE, formatDate, formatFCFA } from '../lib/format'
import type { Paiement, PlanPaiement, Tranche } from '../lib/types'
import Icon from '../components/ui/Icon'
import StatCard from '../components/ui/StatCard'
import ProgressBar from '../components/ui/ProgressBar'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

interface PlanEcheancier extends PlanPaiement {
  pelerin: { id: string; prenom: string; nom: string; telephone: string }
  tranches: (Tranche & { paiements: Paiement[] })[]
  acomptes: Paiement[]
}

export default function Paiements() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const statutFiltre = params.get('statut') ?? ''

  const { data: plans = [] } = useQuery({
    queryKey: ['echeanciers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans_paiement')
        .select('*, pelerin:pelerins(id, prenom, nom, telephone), tranches(*, paiements(*)), acomptes:paiements!plan_paiement_id(*)')
        .order('created_at', { ascending: false })
      return data as unknown as PlanEcheancier[]
    },
  })

  const enRetard = plans.flatMap((p) =>
    p.tranches.filter((t) => t.statut === 'en_retard').map((t) => ({ p, t }))
  )

  const tranchesFiltrees = plans
    .flatMap((p) => p.tranches.map((t) => ({ p, t })))
    .filter(({ t }) => (statutFiltre === 'en_retard' ? t.statut === 'en_retard' : true))

  const aujourdhui = new Date().toISOString().slice(0, 10)

  const plansSoldeARegler = plans.filter((p) => {
    const paye = p.tranches.reduce((s, t) => s + t.paiements.reduce((x, y) => x + y.montant_paye, 0), 0)
      + p.acomptes.reduce((s, a) => s + a.montant_paye, 0)
    const reste = p.montant_total - paye
    return p.statut === 'en_retard' || (p.date_limite_solde !== null && p.date_limite_solde < aujourdhui && reste > 0)
  })

  const totals = plans.reduce(
    (acc, p) => {
      const paye = p.tranches.reduce((s, t) => s + t.paiements.reduce((x, y) => x + y.montant_paye, 0), 0)
        + p.acomptes.reduce((s, a) => s + a.montant_paye, 0)
      return { total: acc.total + p.montant_total, paye: acc.paye + paye }
    },
    { total: 0, paye: 0 }
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Paiements & échéanciers</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Suivez les encaissements de vos pèlerins</p>
        </div>
        <Button onClick={() => plans[0] && navigate(`/details-du-pelerin/${plans[0].pelerin.id}`)} disabled={plans.length === 0}>
          <Icon name="payments" size={18} className="mr-2" />
          Enregistrer un paiement
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total attendu" valeur={formatFCFA(totals.total)} icon="request_quote" />
        <StatCard label="Total encaissé" valeur={formatFCFA(totals.paye)} icon="payments" tone="vert" />
        <StatCard label="Reste global" valeur={formatFCFA(totals.total - totals.paye)} icon="account_balance_wallet" tone={totals.total - totals.paye > 0 ? 'error' : 'vert'} />
      </section>

      {enRetard.length > 0 && (
        <div className="rounded-r-lg border-l-4 border-error bg-error-container/20 p-4">
          <p className="text-headline-sm text-error">{enRetard.length} tranche(s) en retard</p>
          <ul className="text-body-md mt-1 text-on-surface-variant">
            {enRetard.map(({ p, t }) => (
              <li key={t.id}>
                {p.pelerin.prenom} {p.pelerin.nom} — tranche {t.numero_tranche} ({formatFCFA(t.montant_prevu)}), échéance {formatDate(t.date_echeance)}.
              </li>
            ))}
          </ul>
        </div>
      )}

      {plansSoldeARegler.length > 0 && (
        <div className="rounded-r-lg border-l-4 border-error bg-error-container/20 p-4">
          <p className="text-headline-sm text-error">{plansSoldeARegler.length} plan(s) dont le solde est à régler</p>
          <ul className="text-body-md mt-1 text-on-surface-variant">
            {plansSoldeARegler.map((p) => (
              <li key={p.id}>
                {p.pelerin.prenom} {p.pelerin.nom} — reste {formatFCFA(p.montant_total - (p.tranches.reduce((s, t) => s + t.paiements.reduce((x, y) => x + y.montant_paye, 0), 0) + p.acomptes.reduce((s, a) => s + a.montant_paye, 0)))}, limite le {formatDate(p.date_limite_solde)}.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Payé</th>
                <th className="px-4 py-3">Reste dû</th>
                <th className="px-4 py-3">Progression</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const paye = p.tranches.reduce((s, t) => s + t.paiements.reduce((x, y) => x + y.montant_paye, 0), 0)
                  + p.acomptes.reduce((s, a) => s + a.montant_paye, 0)
                const reste = p.montant_total - paye
                const progression = p.montant_total > 0 ? Math.round((paye / p.montant_total) * 100) : 0
                const retard = p.tranches.filter((t) => t.statut === 'en_retard').length
                return (
                  <tr key={p.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                    <td className="px-4 py-4">
                      <Link to={`/details-du-pelerin/${p.pelerin.id}`} className="font-medium text-primary hover:underline">
                        {p.pelerin.prenom} {p.pelerin.nom}
                      </Link>
                      <p className="text-label-md text-on-surface-variant">{p.pelerin.telephone}</p>
                    </td>
                    <td className="px-4 py-4 text-data-mono">{formatFCFA(p.montant_total)} · {p.nombre_tranches} tranches</td>
                    <td className="px-4 py-4 font-medium text-vert">{formatFCFA(paye)}</td>
                    <td className={`px-4 py-4 font-medium ${reste > 0 ? 'text-error' : 'text-vert'}`}>{formatFCFA(reste)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-32">
                          <ProgressBar valeur={progression} tone={progression === 100 ? 'vert' : 'gold'} />
                        </div>
                        <span className="text-data-mono text-on-surface-variant">{progression}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Badge tone={TONE_STATUT_PLAN[p.statut]}>{LIBELLES_STATUT_PLAN[p.statut]}</Badge>
                        {retard > 0 && <Badge tone="rouge">{retard} en retard</Badge>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {plans.length === 0 && <EmptyState message="Aucun plan de paiement." />}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="flex items-center gap-2 px-6 pt-5">
          <Icon name="event_note" size={20} className="text-primary" />
          <h2 className="text-headline-sm text-primary">Détail des tranches</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Tranche</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Échéance</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {tranchesFiltrees.map(({ p, t }) => (
                  <tr key={t.id} className="border-t border-outline-variant">
                    <td className="px-4 py-4">{p.pelerin.prenom} {p.pelerin.nom}</td>
                    <td className="px-4 py-4">Tranche {t.numero_tranche}</td>
                    <td className="px-4 py-4 text-data-mono">{formatFCFA(t.montant_prevu)}</td>
                    <td className="px-4 py-4">{formatDate(t.date_echeance)}</td>
                    <td className="px-4 py-4">
                      <Badge tone={TONE_TRANCHE[t.statut]}>{LIBELLES_TRANCHE[t.statut]}</Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {tranchesFiltrees.length === 0 && <EmptyState message="Aucune tranche pour ce filtre." />}
        </div>
      </div>
    </div>
  )
}