import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAgence } from '../../hooks/useAgence'
import { genererEcheancier, proposerAcompte, proposerDateLimite, validerEcheancier, type TrancheDraft } from '../../lib/plan'
import { LIBELLES_MODE, LIBELLES_TRANCHE, TONE_TRANCHE, formatDate, formatFCFA } from '../../lib/format'
import type { Paiement, PlanPaiement, Tranche, TypeVoyage } from '../../lib/types'
import Card from '../ui/Card'
import Icon from '../ui/Icon'
import ProgressBar from '../ui/ProgressBar'
import { Field, Input, Select } from '../ui/Field'
import Button from '../ui/Button'
import Badge from '../ui/Badge'

interface PlanAvecDonnees extends PlanPaiement {
  tranches: (Tranche & { paiements: Paiement[] })[]
}

export default function PlanPaiementSection({ pelerinId, groupe }: { pelerinId: string; groupe?: { type_voyage: TypeVoyage; date_depart: string } | null }) {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()
  const [creation, setCreation] = useState(false)
  const [montantTotal, setMontantTotal] = useState('')
  const [montantAcompte, setMontantAcompte] = useState('')
  const [acompteTouche, setAcompteTouche] = useState(false)
  const [dateLimite, setDateLimite] = useState('')
  const [nombreTranches, setNombreTranches] = useState('3')
  const [drafts, setDrafts] = useState<TrancheDraft[]>([])
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

  function ouvrirCreation() {
    setMontantTotal('')
    setMontantAcompte(groupe ? String(proposerAcompte(0, groupe.type_voyage)) : '')
    setAcompteTouche(false)
    setDateLimite(groupe ? proposerDateLimite(groupe.date_depart, groupe.type_voyage) : '')
    setNombreTranches('3')
    setPremiereEcheance('')
    setDrafts([])
    setErreur('')
    setCreation(true)
  }

  function regenererEcheancier(total: number, debut: string, acompte?: number) {
    const nombre = parseInt(nombreTranches, 10)
    if (total > 0 && nombre > 0 && dateLimite) {
      setDrafts(genererEcheancier(total, acompte ?? (parseInt(montantAcompte, 10) || 0), nombre, debut || dateLimite, dateLimite))
    }
  }

  function changerMontantTotal(valeur: string) {
    setMontantTotal(valeur)
    let acompte = parseInt(montantAcompte, 10) || 0
    if (groupe && !acompteTouche) {
      const total = parseInt(valeur, 10)
      acompte = total > 0 ? proposerAcompte(total, groupe.type_voyage) : 0
      setMontantAcompte(String(acompte))
    }
    regenererEcheancier(parseInt(valeur, 10), premiereEcheance, acompte)
  }

  function changerNombreTranches(valeur: string) {
    setNombreTranches(valeur)
    regenererEcheancier(parseInt(montantTotal, 10), premiereEcheance)
  }

  const creerPlan = useMutation({
    mutationFn: async () => {
      const total = parseInt(montantTotal, 10)
      const acompte = parseInt(montantAcompte, 10) || 0
      const nombre = parseInt(nombreTranches, 10)
      if (!total || total <= 0 || !nombre || nombre <= 0) throw new Error('Champs invalides')
      if (!dateLimite) throw new Error('Champs invalides')
      const erreur = validerEcheancier(total, acompte, drafts, dateLimite)
      if (erreur) throw new Error('Echeancier invalide')
      const { data: nouveauPlan, error: e1 } = await supabase
        .from('plans_paiement')
        .insert({
          agence_id: agence!.id,
          pelerin_id: pelerinId,
          montant_total: total,
          montant_acompte: acompte,
          date_limite_solde: dateLimite,
          nombre_tranches: nombre,
        })
        .select('id')
        .single()
      if (e1 || !nouveauPlan) throw e1
      const tranches = drafts.map((d, i) => ({
        agence_id: agence!.id,
        plan_paiement_id: nouveauPlan.id,
        numero_tranche: i + 1,
        montant_prevu: d.montant_prevu,
        date_echeance: d.date_echeance,
      }))
      const { error: e2 } = await supabase.from('tranches').insert(tranches)
      if (e2) throw e2
    },
    onSuccess: () => {
      setCreation(false)
      setMontantTotal('')
      setMontantAcompte('')
      setDateLimite('')
      setPremiereEcheance('')
      setDrafts([])
      queryClient.invalidateQueries({ queryKey: ['plan', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['echeanciers'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: (e: Error) => {
      if (e.message === 'Champs invalides') setErreur('Renseignez le montant total, l’acompte, la date limite et le nombre de tranches.')
      else if (e.message === 'Echeancier invalide') setErreur(validerEcheancier(parseInt(montantTotal, 10), parseInt(montantAcompte, 10) || 0, drafts, dateLimite) ?? '')
      else setErreur('Impossible de créer le plan.')
    },
  })

  const encaisser = useMutation({
    mutationFn: async () => {
      const montant = parseInt(montantPaiement, 10)
      if (!montant || montant <= 0) throw new Error('Montant invalide')
      const plafond = Math.min(
encaissement.tranche.montant_prevu - encaissement.tranche.paiements.reduce((s, p) => s + p.montant_paye, 0),
        plan!.montant_total - paye
      )
      if (montant > plafond) throw new Error('Montant depasse')
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
      queryClient.invalidateQueries({ queryKey: ['echeanciers'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: (e: Error) => {
      if (e.message === 'Montant invalide') setErreur('Saisissez un montant positif.')
      else if (e.message === 'Montant depasse') setErreur('Le montant dépasse le reste dû.')
      else if (e.message.includes('soldé')) setErreur('Encaissement impossible. Le plan de paiement est soldé ou le montant dépasse le reste dû.')
      else setErreur('Encaissement impossible.')
    },
  })

  if (isLoading) return <Card className="p-6"><p className="text-sm text-navy">Chargement…</p></Card>

  if (!plan) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="payments" size={20} className="text-primary" />
          <h2 className="text-headline-sm text-primary">Plan de paiement</h2>
        </div>
        {creation ? (
          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); setErreur(''); creerPlan.mutate() }}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <Field label="Montant total (FCFA)">
              <Input required aria-label="Montant total (FCFA)" type="number" min={1} value={montantTotal} onChange={(e) => changerMontantTotal(e.target.value)} />
            </Field>
            <Field label="Acompte (FCFA)">
              <Input required aria-label="Acompte (FCFA)" type="number" min={0} value={montantAcompte} onChange={(e) => { setAcompteTouche(true); setMontantAcompte(e.target.value) }} />
            </Field>
            <Field label="Date limite du solde">
              <Input required aria-label="Date limite du solde" type="date" value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} />
            </Field>
            <Field label="Nombre de tranches">
              <Input required aria-label="Nombre de tranches" type="number" min={1} value={nombreTranches} onChange={(e) => changerNombreTranches(e.target.value)} />
            </Field>
            <Field label="Première échéance">
              <Input aria-label="Première échéance" type="date" value={premiereEcheance} onChange={(e) => { setPremiereEcheance(e.target.value); regenererEcheancier(parseInt(montantTotal, 10), e.target.value) }} />
            </Field>
            {drafts.length > 0 && (
              <div className="md:col-span-3">
                <table className="w-full text-body-md">
                  <thead>
                    <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                      <th className="px-4 py-2">Tranche</th>
                      <th className="px-4 py-2">Montant (FCFA)</th>
                      <th className="px-4 py-2">Échéance</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((d, i) => (
                      <tr key={d.numero_tranche} className="border-t border-outline-variant">
                        <td className="px-4 py-2">Tranche {d.numero_tranche}</td>
                        <td className="px-4 py-2">
                          <Input aria-label="Montant de la tranche" type="number" min={1} value={d.montant_prevu} onChange={(e) => setDrafts((prev) => prev.map((x, j) => (j === i ? { ...x, montant_prevu: parseInt(e.target.value, 10) || 0 } : x)))} />
                        </td>
                        <td className="px-4 py-2">
                          <Input aria-label="Échéance de la tranche" type="date" value={d.date_echeance} onChange={(e) => setDrafts((prev) => prev.map((x, j) => (j === i ? { ...x, date_echeance: e.target.value } : x)))} />
                        </td>
                        <td className="px-4 py-2">
                          <Button type="button" variant="secondary" onClick={() => setDrafts((prev) => prev.filter((_, j) => j !== i))}>Retirer</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-label-md text-on-surface-variant">
                  Reste à répartir : {formatFCFA((parseInt(montantTotal, 10) || 0) - (parseInt(montantAcompte, 10) || 0) - drafts.reduce((s, d) => s + d.montant_prevu, 0))}
                </p>
              </div>
            )}
            {erreur && <p className="text-sm text-error md:col-span-3">{erreur}</p>}
            <div className="flex gap-3 md:col-span-3">
              <Button type="submit" disabled={creerPlan.isPending}>Créer le plan</Button>
              <Button type="button" variant="secondary" onClick={() => setCreation(false)}>Annuler</Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Aucun plan de paiement pour ce pèlerin.</p>
            <Button variant="secondary" onClick={ouvrirCreation}>Créer un plan</Button>
          </div>
        )}
      </div>
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

  const plafondEncaissement = encaissement.ouvert
    ? Math.min(
        encaissement.tranche.montant_prevu - encaissement.tranche.paiements.reduce((s, p) => s + p.montant_paye, 0),
        reste
      )
    : 0
  const montantSaisi = parseInt(montantPaiement, 10)

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon name="payments" size={20} className="text-primary" />
        <h2 className="text-headline-sm text-primary">Plan de paiement</h2>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-6 text-body-md">
        <p className="text-on-surface-variant">Total : <span className="font-semibold text-on-surface">{formatFCFA(plan.montant_total)}</span></p>
        <p className="text-on-surface-variant">Payé : <span className="font-semibold text-vert">{formatFCFA(paye)}</span></p>
        <p className="text-on-surface-variant">Reste dû : <span className={`font-semibold ${reste > 0 ? 'text-error' : 'text-vert'}`}>{formatFCFA(reste)}</span></p>
        {reste <= 0 && <Badge tone="vert">Plan soldé</Badge>}
        <div className="w-48">
          <ProgressBar valeur={progression} tone={progression === 100 ? 'vert' : 'gold'} label={`${progression}%`} />
        </div>
      </div>

      <ol className="relative space-y-6 border-l-2 border-outline-variant pl-6">
        {plan.tranches.map((t) => {
          const verse = t.paiements.reduce((s, p) => s + p.montant_paye, 0)
          const payee = verse >= t.montant_prevu
          const partielle = verse > 0 && !payee
          const dotCls = payee
            ? 'bg-green-600'
            : partielle
              ? 'bg-secondary-fixed-dim'
              : 'border-2 border-outline bg-surface-container-lowest'
          return (
            <li key={t.id} className="relative">
              <span className={`absolute -left-8 top-4 flex h-4 w-4 items-center justify-center rounded-full ${dotCls}`}>
                {payee && <Icon name="check" size={12} className="text-white" />}
              </span>
              <div className="rounded-lg border border-outline-variant p-4 transition-colors hover:bg-surface-container-low">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-body-md font-bold text-on-surface">Tranche {t.numero_tranche} — {formatFCFA(t.montant_prevu)}</p>
                    <p className="text-label-md text-on-surface-variant">Échéance {formatDate(t.date_echeance)} · Versé {formatFCFA(verse)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={TONE_TRANCHE[t.statut]}>{LIBELLES_TRANCHE[t.statut]}</Badge>
                    {verse < t.montant_prevu && reste > 0 && (
                      <Button variant="secondary" onClick={() => ouvrirEncaissement(t)}>Encaisser</Button>
                    )}
                  </div>
                </div>
                {t.paiements.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-outline-variant pt-2 text-label-md text-on-surface-variant">
                    {t.paiements.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <Icon name="check_circle" size={14} className="text-green-600" />
                        {formatDate(p.date_paiement)} — {formatFCFA(p.montant_paye)} ({LIBELLES_MODE[p.mode]}{p.reference ? ` — réf. ${p.reference}` : ''})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {encaissement.ouvert && (
        <div className="mt-4 rounded-md border border-primary bg-surface-container-low p-4">
          <p className="mb-3 text-body-md font-semibold text-primary">
            Encaissement — tranche {encaissement.tranche.numero_tranche} (reste {formatFCFA(plafondEncaissement)})
          </p>
          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); setErreur(''); encaisser.mutate() }}
            className="grid grid-cols-1 gap-4 md:grid-cols-4"
          >
            <Field label="Montant (FCFA)">
              <Input required type="number" min={1} max={plafondEncaissement} aria-label="Montant (FCFA)" value={montantPaiement} onChange={(e) => setMontantPaiement(e.target.value)} />
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
              <Button type="submit" disabled={encaisser.isPending || !montantSaisi || montantSaisi <= 0 || montantSaisi > plafondEncaissement}>Encaisser</Button>
              <Button type="button" variant="secondary" onClick={() => setEncaissement({ tranche: null!, ouvert: false })}>Fermer</Button>
            </div>
            {erreur && <p className="text-sm text-error md:col-span-4">{erreur}</p>}
          </form>
        </div>
      )}
    </div>
  )
}