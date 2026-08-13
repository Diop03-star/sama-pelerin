import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_DOSSIER, LIBELLES_SEXE, TONE_DOSSIER, formatDate } from '../lib/format'
import type { Pelerin } from '../lib/types'
import Card from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import DocumentSection from '../components/documents/DocumentSection'
import PlanPaiementSection from '../components/paiements/PlanPaiementSection'

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
      const { data } = await supabase.from('pelerins').select('*').eq('id', id!).single()
      return data as Pelerin
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

  if (isLoading) return <p className="text-navy">Chargement…</p>
  if (!pelerin) return <p className="text-error">Pèlerin introuvable.</p>

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/liste-des-pelerins" className="text-sm text-navy hover:underline">← Pèlerins</Link>
          <h1 className="text-headline mt-1 text-navy">{pelerin.prenom} {pelerin.nom}</h1>
          <div className="mt-1">
            <Badge tone={TONE_DOSSIER[pelerin.statut_dossier]}>Dossier {LIBELLES_DOSSIER[pelerin.statut_dossier]}</Badge>
          </div>
        </div>
        <Button variant="secondary" onClick={ouvrirEdition}>Modifier la fiche</Button>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-navy">Identité</h2>
        {enEdition && form ? (
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <div className="flex gap-3 md:col-span-2">
              <Button type="submit" disabled={enregistrer.isPending}>Enregistrer</Button>
              <Button type="button" variant="secondary" onClick={() => setEnEdition(false)}>Annuler</Button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <div><dt className="label">Téléphone</dt><dd className="mt-1">{pelerin.telephone}</dd></div>
            <div><dt className="label">Email</dt><dd className="mt-1">{pelerin.email ?? '—'}</dd></div>
            <div><dt className="label">Naissance</dt><dd className="mt-1">{formatDate(pelerin.date_naissance)}</dd></div>
            <div><dt className="label">Sexe</dt><dd className="mt-1">{pelerin.sexe ? LIBELLES_SEXE[pelerin.sexe] : '—'}</dd></div>
            <div><dt className="label">Inscrit le</dt><dd className="mt-1">{formatDate(pelerin.date_inscription)}</dd></div>
            <div><dt className="label">Contact urgence</dt><dd className="mt-1">{pelerin.contact_urgence_nom ?? '—'} {pelerin.contact_urgence_telephone ? `(${pelerin.contact_urgence_telephone})` : ''}</dd></div>
          </dl>
        )}
      </Card>

      <DocumentSection pelerinId={pelerin.id} />
      <PlanPaiementSection pelerinId={pelerin.id} />
    </div>
  )
}
