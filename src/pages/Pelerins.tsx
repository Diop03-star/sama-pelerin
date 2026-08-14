import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAgence } from '../hooks/useAgence'
import { LIBELLES_DOSSIER, TONE_DOSSIER, formatFCFA } from '../lib/format'
import type { Groupe, Pelerin } from '../lib/types'
import Icon from '../components/ui/Icon'
import StatCard from '../components/ui/StatCard'
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
  const statutFiltre = params.get('statut') ?? ''
  const rechercheUrl = params.get('q') ?? ''
  const [recherche, setRecherche] = useState(rechercheUrl)
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
      if (statutFiltre && p.statut_dossier !== statutFiltre) return false
      if (!terme) return true
      return `${p.prenom} ${p.nom}`.toLowerCase().includes(terme) || p.telephone.includes(terme)
    })
  }, [pelerins, recherche, groupeFiltre, statutFiltre])

  const compteurs = useMemo(
    () => ({
      total: pelerins.length,
      valides: pelerins.filter((p) => p.statut_dossier === 'valide').length,
      incomplets: pelerins.filter((p) => p.statut_dossier === 'incomplet').length,
    }),
    [pelerins]
  )

  useEffect(() => {
    setRecherche(rechercheUrl)
  }, [rechercheUrl])

  useEffect(() => {
    if (params.get('nouveau')) {
      if (groupes.length === 0) return
      setForm((f) => ({ ...f, groupe_id: groupeFiltre ?? groupes[0]?.id ?? '' }))
      setModalOuverte(true)
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('nouveau')
        return next
      })
    }
  }, [params, groupeFiltre, groupes, setParams])

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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Pèlerins</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Gérez les dossiers de vos pèlerins</p>
        </div>
        <Button
          onClick={() => {
            setForm({ ...form, groupe_id: groupeFiltre ?? groupes[0]?.id ?? '' })
            setModalOuverte(true)
          }}
        >
          <Icon name="add" size={18} className="mr-2" />
          Nouveau Pèlerin
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Pèlerins" valeur={compteurs.total} icon="group" />
        <StatCard label="Dossiers validés" valeur={compteurs.valides} icon="check_circle" tone="vert" />
        <StatCard label="Dossiers incomplets" valeur={compteurs.incomplets} icon="warning" tone="error" />
      </section>

      <div className="flex flex-wrap gap-4">
        <div className="relative">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input placeholder="Rechercher par nom ou téléphone…" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="max-w-xs pl-10" />
        </div>
        <Select value={groupeFiltre} onChange={(e) => setParams(e.target.value ? { groupe: e.target.value } : {})} className="max-w-xs">
          <option value="">Tous les groupes</option>
          {groupes.map((g) => (
            <option key={g.id} value={g.id}>{g.nom}</option>
          ))}
        </Select>
        <Select value={statutFiltre} onChange={(e) => setParams(e.target.value ? { statut: e.target.value } : {})} className="max-w-xs">
          <option value="">Tous les statuts</option>
          <option value="valide">Validé</option>
          <option value="complet">Complet</option>
          <option value="incomplet">Incomplet</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
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
                  <tr key={p.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                    <td className="px-4 py-4 font-medium text-primary">{p.prenom} {p.nom}</td>
                    <td className="px-4 py-4">{p.groupe?.nom ?? '—'}</td>
                    <td className="px-4 py-4 text-data-mono text-on-surface-variant">{p.telephone}</td>
                    <td className="px-4 py-4">
                      <Badge tone={TONE_DOSSIER[p.statut_dossier]}>{LIBELLES_DOSSIER[p.statut_dossier]}</Badge>
                    </td>
                    <td className={`px-4 py-4 font-medium ${reste > 0 ? 'text-error' : 'text-vert'}`}>
                      {p.plan_paiement ? formatFCFA(reste) : '—'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Link
                          to={`/details-du-pelerin/${p.id}`}
                          title="Voir la fiche"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"
                        >
                          <Icon name="visibility" size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtres.length === 0 && <EmptyState message="Aucun pèlerin trouvé." />}
        </div>
      </div>

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