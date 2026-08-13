import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAgence } from '../../hooks/useAgence'
import { genererTranches } from '../../lib/plan'
import { LIBELLES_MODE, LIBELLES_TRANCHE, TONE_TRANCHE, formatDate, formatFCFA } from '../../lib/format'
import type { Paiement, PlanPaiement, Tranche } from '../../lib/types'
import Card from '../ui/Card'
import { Field, Input, Select } from '../ui/Field'
import Button from '../ui/Button'
import Badge from '../ui/Badge'

interface PlanAvecDonnees extends PlanPaiement {
  tranches: (Tranche & { paiements: Paiement[] })[]
}

export default function PlanPaiementSection({ pelerinId }: { pelerinId: string }) {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()
  const [creation, setCreation] = useState(false)
  const [montantTotal, setMontantTotal] = useState('')
  const [nombreTranches, setNombreTranches] = useState('3')
  const [premiereEcheance, setPremiereEcheance] = useState('')
  const [encaissement, setEncaissement] = useState<{ tranche: Tranche & { paiements: Paiement[] }; ouvert: boolean }>({ tranche: null!, ouvert: false })
  const [montantPaiement, setMontantPaiement] = useState('')
  const [modePaiement, setModePaiement] = useState('especes')
  const [reference, setReference] = useState('')
  const [erreur, setErreur] = useState('')

  const { data: plan, isLoading } = useQuery({
    queryKey: ['plan', pelerinId],
    enabled: !!pelerinId,
    queryFn: async () => {
      const { data } = await supabase
        .from('plans_paiement')
        .select('*, tranches(*, paiements(*))')
        .eq('pelerin_id', pelerinId)
        .maybeSingle()
      return data as PlanAvecDonnees | null
    },
  })

  const creerPlan = useMutation({
    mutationFn: async () => {
      const total = parseInt(montantTotal, 10)
      const nombre = parseInt(nombreTranches, 10)
      if (!total || total <= 0 || !nombre || nombre <= 0 || !premiereEcheance) {
        throw new Error('Champs invalides')
      }
      const { data: nouveauPlan, error: e1 } = await supabase
        .from('plans_paiement')
        .insert({ agence_id: agence!.id, pelerin_id: pelerinId, montant_total: total, nombre_tranches: nombre })
        .select('id')
        .single()
      if (e1 || !nouveauPlan) throw e1
      const tranches = genererTranches(total, nombre, premiereEcheance).map((t) => ({
        agence_id: agence!.id,
        plan_paiement_id: nouveauPlan.id,
        ...t,
      }))
      const { error: e2 } = await supabase.from('tranches').insert(tranches)
      if (e2) throw e2
    },
    onSuccess: () => {
      setCreation(false)
      setMontantTotal('')
      setPremiereEcheance('')
      queryClient.invalidateQueries({ queryKey: ['plan', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: (e: Error) => setErreur(e.message === 'Champs invalides' ? 'Renseignez un montant, un nombre de tranches et une première échéance.' : 'Impossible de créer le plan.'),
  })

  const encaisser = useMutation({
    mutationFn: async () => {
      const montant = parseInt(montantPaiement, 10)
      if (!montant || montant <= 0) throw new Error('Montant invalide')
      const { data: profil } = await supabase.auth.getUser()
      const { data: utilisateur } = await supabase
        .from('utilisateurs')
        .select('id')
        .eq('user_id', profil.user!.id)
        .maybeSingle()
      const { error } = await supabase.from('paiements').insert({
        agence_id: agence!.id,
        tranche_id: encaissement.tranche.id,
        montant_paye: montant,
        mode: modePaiement,
        reference: reference || null,
        enregistre_par: utilisateur?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setEncaissement({ tranche: null!, ouvert: false })
      setMontantPaiement('')
      setReference('')
      queryClient.invalidateQueries({ queryKey: ['plan', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: (e: Error) => setErreur(e.message === 'Montant invalide' ? 'Saisissez un montant positif.' : 'Encaissement impossible.'),
  })

  if (isLoading) return <Card className="p-6"><p className="text-sm text-navy">Chargement…</p></Card>

  if (!plan) {
    return (
      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-navy">Plan de paiement</h2>
        {creation ? (
          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); setErreur(''); creerPlan.mutate() }}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <Field label="Montant total (FCFA)">
              <Input required type="number" min={1} value={montantTotal} onChange={(e) => setMontantTotal(e.target.value)} />
            </Field>
            <Field label="Nombre de tranches">
              <Input required type="number" min={1} value={nombreTranches} onChange={(e) => setNombreTranches(e.target.value)} />
            </Field>
            <Field label="Première échéance">
              <Input required type="date" value={premiereEcheance} onChange={(e) => setPremiereEcheance(e.target.value)} />
            </Field>
            {erreur && <p className="text-sm text-error md:col-span-3">{erreur}</p>}
            <div className="flex gap-3 md:col-span-3">
              <Button type="submit" disabled={creerPlan.isPending}>Créer le plan</Button>
              <Button type="button" variant="secondary" onClick={() => setCreation(false)}>Annuler</Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Aucun plan de paiement pour ce pèlerin.</p>
            <Button variant="secondary" onClick={() => setCreation(true)}>Créer un plan</Button>
          </div>
        )}
      </Card>
    )
  }

  const paye = plan.tranches.reduce((s, t) => s + t.paiements.reduce((x, p) => x + p.montant_paye, 0), 0)
  const reste = plan.montant_total - paye
  const progression = plan.montant_total > 0 ? Math.round((paye / plan.montant_total) * 100) : 0

  function ouvrirEncaissement(tranche: Tranche & { paiements: Paiement[] }) {
    setMontantPaiement('')
    setReference('')
    setEncaissement({ tranche, ouvert: true })
  }

  return (
    <Card className="p-6">
      <h2 className="mb-2 text-sm font-semibold text-navy">Plan de paiement</h2>
      <div className="mb-4 flex flex-wrap items-center gap-6 text-sm">
        <p>Total : <span className="font-semibold text-navy">{formatFCFA(plan.montant_total)}</span></p>
        <p>Payé : <span className="font-semibold text-green-700">{formatFCFA(paye)}</span></p>
        <p>Reste dû : <span className={`font-semibold ${reste > 0 ? 'text-error' : 'text-green-700'}`}>{formatFCFA(reste)}</span></p>
        <div className="h-2 w-48 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-gold" style={{ width: `${progression}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {plan.tranches.map((t) => {
          const verse = t.paiements.reduce((s, p) => s + p.montant_paye, 0)
          return (
            <div key={t.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-navy">Tranche {t.numero_tranche} — {formatFCFA(t.montant_prevu)}</p>
                  <p className="text-xs text-gray-500">Échéance {formatDate(t.date_echeance)} · Versé {formatFCFA(verse)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={TONE_TRANCHE[t.statut]}>{LIBELLES_TRANCHE[t.statut]}</Badge>
                  {verse < t.montant_prevu && (
                    <Button variant="secondary" onClick={() => ouvrirEncaissement(t)}>Encaisser</Button>
                  )}
                </div>
              </div>
              {t.paiements.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-gray-600">
                  {t.paiements.map((p) => (
                    <li key={p.id}>
                      {formatDate(p.date_paiement)} — {formatFCFA(p.montant_paye)} ({LIBELLES_MODE[p.mode]}{p.reference ? ` — réf. ${p.reference}` : ''})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {encaissement.ouvert && (
        <div className="mt-4 rounded-md border border-navy bg-surface p-4">
          <p className="mb-3 text-sm font-semibold text-navy">
            Encaissement — tranche {encaissement.tranche.numero_tranche} (reste {formatFCFA(encaissement.tranche.montant_prevu - encaissement.tranche.paiements.reduce((s, p) => s + p.montant_paye, 0))})
          </p>
          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); setErreur(''); encaisser.mutate() }}
            className="grid grid-cols-1 gap-4 md:grid-cols-4"
          >
            <Field label="Montant (FCFA)">
              <Input required type="number" min={1} value={montantPaiement} onChange={(e) => setMontantPaiement(e.target.value)} />
            </Field>
            <Field label="Mode">
              <Select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
                <option value="especes">Espèces</option>
                <option value="wave">Wave</option>
                <option value="orange_money">Orange Money</option>
                <option value="virement">Virement bancaire</option>
                <option value="autre">Autre</option>
              </Select>
            </Field>
            <Field label="Référence (optionnel)">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ID transaction…" />
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={encaisser.isPending}>Encaisser</Button>
              <Button type="button" variant="secondary" onClick={() => setEncaissement({ tranche: null!, ouvert: false })}>Fermer</Button>
            </div>
            {erreur && <p className="text-sm text-error md:col-span-4">{erreur}</p>}
          </form>
        </div>
      )}
    </Card>
  )
}