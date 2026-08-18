import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_DOSSIER, TONE_DOSSIER, formatDate } from '../lib/format'
import type { Pelerin } from '../lib/types'
import Icon from '../components/ui/Icon'
import EmptyState from '../components/ui/EmptyState'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import DocumentSection from '../components/documents/DocumentSection'
import PlanPaiementSection from '../components/paiements/PlanPaiementSection'
import RappelSection from '../components/rappels/RappelSection'

type PelerinAvecGroupe = Pelerin & { groupe: { nom: string; type_voyage: 'hajj' | 'omra'; date_depart: string } | null }

export default function PelerinDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [enEdition, setEnEdition] = useState(false)
  const [form, setForm] = useState<Pelerin | null>(null)
  const [erreur, setErreur] = useState('')

  const { data: pelerin, isLoading } = useQuery({
    queryKey: ['pelerin', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from('pelerins').select('*, groupe:groupes(nom, type_voyage, date_depart)').eq('id', id!).single()
      return data as PelerinAvecGroupe
    },
  })

  const enregistrer = useMutation({
    mutationFn: async () => {
      if (!form) return
      const { error } = await supabase
        .from('pelerins')
        .update({
          nom: form.nom,
          prenom: form.prenom,
          telephone: form.telephone,
          email: form.email,
          date_naissance: form.date_naissance,
          sexe: form.sexe,
          contact_urgence_nom: form.contact_urgence_nom,
          contact_urgence_telephone: form.contact_urgence_telephone,
        })
        .eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      setEnEdition(false)
      queryClient.invalidateQueries({ queryKey: ['pelerin', id] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: () => setErreur('Impossible d’enregistrer.'),
  })

  if (isLoading) return <div className="flex h-screen items-center justify-center text-on-surface">Chargement…</div>
  if (!pelerin) return <div className="flex h-screen items-center justify-center text-error">Pèlerin introuvable.</div>

  const ouvrirEdition = () => {
    setForm({ ...pelerin })
    setEnEdition(true)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    enregistrer.mutate()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-label-md text-on-surface-variant">
            <Link to="/liste-des-pelerins" className="hover:text-primary">Pèlerins</Link>
            <Icon name="chevron_right" size={16} />
            <span className="font-bold text-primary">Détails</span>
          </div>
          <h2 className="text-display-lg text-primary">Dossier Pèlerin</h2>
        </div>
        <div className="flex gap-3">
          {!enEdition && (
            <Button variant="secondary" onClick={ouvrirEdition}>
              <Icon name="edit" size={18} className="mr-2" />
              Modifier
            </Button>
          )}
          {enEdition && (
            <Button onClick={onSubmit} disabled={enregistrer.isPending}>
              <Icon name="save" size={18} className="mr-2" />
              Enregistrer
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-4">
          {enEdition && form ? (
            <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
              <Field label="Prénom">
                <Input required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
              </Field>
              <Field label="Nom">
                <Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              </Field>
              <Field label="Téléphone">
                <Input required value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value || null })} />
              </Field>
              <Field label="Date de naissance">
                <Input type="date" value={form.date_naissance ?? ''} onChange={(e) => setForm({ ...form, date_naissance: e.target.value || null })} />
              </Field>
              <Field label="Sexe">
                <Select value={form.sexe ?? 'M'} onChange={(e) => setForm({ ...form, sexe: e.target.value as 'M' | 'F' })}>
                  <option value="M">Homme</option>
                  <option value="F">Femme</option>
                </Select>
              </Field>
              <Field label="Contact urgence — nom">
                <Input value={form.contact_urgence_nom ?? ''} onChange={(e) => setForm({ ...form, contact_urgence_nom: e.target.value || null })} />
              </Field>
              <Field label="Contact urgence — téléphone">
                <Input value={form.contact_urgence_telephone ?? ''} onChange={(e) => setForm({ ...form, contact_urgence_telephone: e.target.value || null })} />
              </Field>
              {erreur && <p className="text-sm text-error">{erreur}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={enregistrer.isPending}>Enregistrer</Button>
                <Button type="button" variant="secondary" onClick={() => setEnEdition(false)}>Annuler</Button>
              </div>
            </form>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center shadow-sm">
                <div className="absolute left-0 top-0 h-24 w-full bg-gradient-to-r from-primary-container to-surface-tint opacity-20" />
                <div className="relative z-10 mb-4 mt-6">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-surface-container-lowest bg-surface-container shadow-sm">
                    <Icon name="person" size={40} className="text-on-surface-variant" />
                  </div>
                </div>
                <h3 className="text-headline-md text-primary">{pelerin.prenom} {pelerin.nom}</h3>
                <p className="text-data-mono mb-4 text-on-surface-variant">ID: {pelerin.id.slice(0, 8).toUpperCase()}</p>
                <span className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed px-3 py-1 text-label-md text-on-secondary-fixed-variant">
                  <Icon name="group" size={14} />
                  Groupe: {pelerin.groupe?.nom ?? '—'}
                </span>
                <div className="w-full border-t border-outline-variant pt-4 text-left">
                  <div className="grid gap-3">
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Date de naissance</span>
                      <span className="text-body-md text-on-surface">{formatDate(pelerin.date_naissance)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Téléphone</span>
                      <span className="text-body-md text-on-surface">{pelerin.telephone}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Email</span>
                      <span className="text-body-md text-on-surface">{pelerin.email ?? '—'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Dossier</span>
                      <span className="mt-1"><Badge tone={TONE_DOSSIER[pelerin.statut_dossier]}>{LIBELLES_DOSSIER[pelerin.statut_dossier]}</Badge></span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 border-b border-outline-variant pb-3">
                  <Icon name="contact_emergency" size={20} className="text-primary" />
                  <h4 className="text-headline-sm text-primary">Contact d’Urgence</h4>
                </div>
                {pelerin.contact_urgence_nom ? (
                  <div className="grid gap-3">
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Nom complet</span>
                      <span className="text-body-md text-on-surface">{pelerin.contact_urgence_nom}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Téléphone</span>
                      <span className="text-body-md text-on-surface">{pelerin.contact_urgence_telephone ?? '—'}</span>
                    </div>
                  </div>
                ) : (
                  <EmptyState message="Aucun contact d’urgence renseigné." />
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-8">
          <DocumentSection pelerinId={pelerin.id} />
          <PlanPaiementSection pelerinId={pelerin.id} groupe={pelerin.groupe} />
          <RappelSection pelerinId={pelerin.id} />
        </div>
      </div>
    </div>
  )
}
