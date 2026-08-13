import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAgence } from '../hooks/useAgence'
import { LIBELLES_DOSSIER, TONE_DOSSIER, formatFCFA } from '../lib/format'
import type { Groupe, Pelerin } from '../lib/types'
import Card from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'

interface PelerinAvecJointures extends Pelerin {
  groupe: Groupe
  plan_paiement: {
    montant_total: number
    nombre_tranches: number
    tranches: { paiements: { montant_paye: number }[] }[]
  } | null
}

export default function Pelerins() {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const groupeFiltre = params.get('groupe') ?? ''
  const [recherche, setRecherche] = useState('')
  const [modalOuverte, setModalOuverte] = useState(false)
  const [erreur, setErreur] = useState('')
  const [form, setForm] = useState({ groupe_id: '', nom: '', prenom: '', telephone: '', email: '', sexe: 'M' })

  const { data: groupes = [] } = useQuery({
    queryKey: ['groupes'],
    queryFn: async () => {
      const { data } = await supabase.from('groupes').select('*').order('date_depart', { ascending: false })
      return data as Groupe[]
    },
  })

  const { data: pelerins = [] } = useQuery({
    queryKey: ['pelerins'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pelerins')
        .select('*, groupe:groupes(*), plan_paiement:plans_paiement(montant_total, nombre_tranches, tranches(paiements(montant_paye)))')
        .order('nom')
      return data as unknown as PelerinAvecJointures[]
    },
  })

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    return pelerins.filter((p) => {
      if (groupeFiltre && p.groupe_id !== groupeFiltre) return false
      if (!terme) return true
      return `${p.prenom} ${p.nom}`.toLowerCase().includes(terme) || p.telephone.includes(terme)
    })
  }, [pelerins, recherche, groupeFiltre])

  const sauver = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('pelerins').insert({
        agence_id: agence!.id,
        groupe_id: form.groupe_id,
        nom: form.nom,
        prenom: form.prenom,
        telephone: form.telephone,
        email: form.email || null,
        sexe: form.sexe as 'M' | 'F',
      })
      if (error) throw error
    },
    onSuccess: () => {
      setModalOuverte(false)
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: () => setErreur('Impossible d’inscrire le pèlerin.'),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    sauver.mutate()
  }

  const montantPaye = (p: PelerinAvecJointures) => {
    const paiements = p.plan_paiement?.tranches.flatMap((t) => t.paiements) ?? []
    return paiements.reduce((s, p) => s + p.montant_paye, 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-headline text-navy">Pèlerins</h1>
        <Button onClick={() => { setForm({ ...form, groupe_id: groupeFiltre ?? groupes[0]?.id ?? '' }); setModalOuverte(true) }}>
          Inscrire un pèlerin
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <Input
          placeholder="Rechercher par nom ou téléphone…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="max-w-xs"
        />
        <Select value={groupeFiltre} onChange={(e) => setParams(e.target.value ? { groupe: e.target.value } : {})} className="max-w-xs">
          <option value="">Tous les groupes</option>
          {groupes.map((g) => (
            <option key={g.id} value={g.id}>{g.nom}</option>
          ))}
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Groupe</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Dossier</th>
                <th className="px-4 py-3">Reste dû</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((p) => {
                const reste = p.plan_paiement ? p.plan_paiement.montant_total - montantPaye(p) : 0
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-navy">{p.prenom} {p.nom}</td>
                    <td className="px-4 py-3">{p.groupe?.nom ?? '—'}</td>
                    <td className="px-4 py-3">{p.telephone}</td>
                    <td className="px-4 py-3">
                      <Badge tone={TONE_DOSSIER[p.statut_dossier]}>{LIBELLES_DOSSIER[p.statut_dossier]}</Badge>
                    </td>
                    <td className="px-4 py-3">{p.plan_paiement ? formatFCFA(reste) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/details-du-pelerin/${p.id}`} className="text-xs text-navy hover:underline">Voir la fiche</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtres.length === 0 && <EmptyState message="Aucun pèlerin trouvé." />}
        </div>
      </Card>

      <Modal open={modalOuverte} title="Inscrire un pèlerin" onClose={() => setModalOuverte(false)}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Groupe">
            <Select required value={form.groupe_id} onChange={(e) => setForm({ ...form, groupe_id: e.target.value })}>
              <option value="">Choisir un groupe</option>
              {groupes.map((g) => (
                <option key={g.id} value={g.id}>{g.nom}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom">
              <Input required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </Field>
            <Field label="Nom">
              <Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </Field>
          </div>
          <Field label="Téléphone">
            <Input required value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+221 77 XXX XX XX" />
          </Field>
          <Field label="Email (optionnel)">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Sexe">
            <Select value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
              <option value="M">Homme</option>
              <option value="F">Femme</option>
            </Select>
          </Field>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOuverte(false)}>Annuler</Button>
            <Button type="submit" disabled={sauver.isPending}>Inscrire</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
