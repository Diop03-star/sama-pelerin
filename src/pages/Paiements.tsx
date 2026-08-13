import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_TRANCHE, TONE_TRANCHE, formatDate, formatFCFA } from '../lib/format'
import type { Paiement, PlanPaiement, Tranche } from '../lib/types'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import AlertPanel from '../components/ui/AlertPanel'
import EmptyState from '../components/ui/EmptyState'

interface PlanEcheancier extends PlanPaiement {
  pelerin: { id: string; prenom: string; nom: string; telephone: string }
  tranches: (Tranche & { paiements: Paiement[] })[]
}

export default function Paiements() {
  const { data: plans = [] } = useQuery({
    queryKey: ['echeanciers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans_paiement')
        .select('*, pelerin:pelerins(id, prenom, nom, telephone), tranches(*, paiements(*))')
        .order('created_at', { ascending: false })
      return data as unknown as PlanEcheancier[]
    },
  })

  const enRetard = plans.flatMap((p) =>
    p.tranches.filter((t) => t.statut === 'en_retard').map((t) => ({ p, t }))
  )

  const totals = plans.reduce(
    (acc, p) => {
      const paye = p.tranches.reduce((s, t) => s + t.paiements.reduce((x, y) => x + y.montant_paye, 0), 0)
      return { total: acc.total + p.montant_total, paye: acc.paye + paye }
    },
    { total: 0, paye: 0 }
  )

  return (
    <div className="space-y-6">
      <h1 className="text-headline text-navy">Paiements & échéanciers</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="label">Total attendu</p>
          <p className="mt-1 text-lg font-semibold text-navy">{formatFCFA(totals.total)}</p>
        </Card>
        <Card className="p-5">
          <p className="label">Total encaissé</p>
          <p className="mt-1 text-lg font-semibold text-green-700">{formatFCFA(totals.paye)}</p>
        </Card>
        <Card className="p-5">
          <p className="label">Reste global</p>
          <p className="mt-1 text-lg font-semibold text-error">{formatFCFA(totals.total - totals.paye)}</p>
        </Card>
      </div>

      {enRetard.length > 0 && (
        <AlertPanel tone="rouge" title={`${enRetard.length} tranche(s) en retard`}>
          {enRetard.map(({ p, t }) => (
            <p key={t.id}>
              {p.pelerin.prenom} {p.pelerin.nom} — tranche {t.numero_tranche} ({formatFCFA(t.montant_prevu)}), échéance {formatDate(t.date_echeance)}.
            </p>
          ))}
        </AlertPanel>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                const reste = p.montant_total - paye
                const progression = p.montant_total > 0 ? Math.round((paye / p.montant_total) * 100) : 0
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link to={`/details-du-pelerin/${p.pelerin.id}`} className="font-medium text-navy hover:underline">
                        {p.pelerin.prenom} {p.pelerin.nom}
                      </Link>
                      <p className="text-xs text-gray-500">{p.pelerin.telephone}</p>
                    </td>
                    <td className="px-4 py-3">{formatFCFA(p.montant_total)} · {p.nombre_tranches} tranches</td>
                    <td className="px-4 py-3 text-green-700">{formatFCFA(paye)}</td>
                    <td className={`px-4 py-3 font-medium ${reste > 0 ? 'text-error' : 'text-green-700'}`}>{formatFCFA(reste)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${progression}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{progression}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.tranches.filter((t) => t.statut === 'en_retard').length > 0 && (
                        <Badge tone="rouge">{p.tranches.filter((t) => t.statut === 'en_retard').length} en retard</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {plans.length === 0 && <EmptyState message="Aucun plan de paiement." />}
        </div>
      </Card>

      <Card>
        <h2 className="px-6 pt-5 text-sm font-semibold text-navy">Détail des tranches</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Tranche</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Échéance</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {plans.flatMap((p) =>
                p.tranches.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-4 py-3">{p.pelerin.prenom} {p.pelerin.nom}</td>
                    <td className="px-4 py-3">Tranche {t.numero_tranche}</td>
                    <td className="px-4 py-3">{formatFCFA(t.montant_prevu)}</td>
                    <td className="px-4 py-3">{formatDate(t.date_echeance)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={TONE_TRANCHE[t.statut]}>{LIBELLES_TRANCHE[t.statut]}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}