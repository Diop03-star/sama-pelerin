import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Agence } from '../lib/types'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { Field, Input } from '../components/ui/Field'
import Icon from '../components/ui/Icon'

export default function SuperAdminAgences() {
  const queryClient = useQueryClient()
  const [formOuvert, setFormOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [gerantNom, setGerantNom] = useState('')
  const [gerantEmail, setGerantEmail] = useState('')
  const [erreur, setErreur] = useState('')
  const [aConfirmer, setAConfirmer] = useState<Agence | null>(null)

  const { data: agences = [] } = useQuery({
    queryKey: ['superadmin-agences'],
    queryFn: async () => {
      const { data } = await supabase.from('agences').select('*').order('nom')
      return data as Agence[]
    },
  })

  const creer = useMutation({
    mutationFn: async () => {
      const { data: agence, error: errAgence } = await supabase
        .from('agences')
        .insert({ nom, telephone, email: email || null, adresse: adresse || null })
        .select('id')
        .single()
      if (errAgence) throw errAgence
      const { error: errGerant } = await supabase.from('utilisateurs').insert({
        agence_id: agence.id,
        nom: gerantNom,
        email: gerantEmail,
        telephone: '',
        role: 'gerant',
      })
      if (errGerant) throw errGerant
    },
    onSuccess: () => {
      setFormOuvert(false)
      setNom('')
      setTelephone('')
      setEmail('')
      setAdresse('')
      setGerantNom('')
      setGerantEmail('')
      setErreur('')
      queryClient.invalidateQueries({ queryKey: ['superadmin-agences'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
    },
    onError: () => setErreur('Impossible de créer l’agence. Vérifiez que l’email du gérant est unique.'),
  })

  const basculerActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('agences').update({ active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setAConfirmer(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-agences'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    creer.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Agences</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Créez et gérez les agences de la plateforme</p>
        </div>
        <Button onClick={() => setFormOuvert(true)}>
          <Icon name="add" size={16} className="mr-2" />
          Créer une agence
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Adresse</th>
                <th className="px-4 py-3">Créée le</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {agences.map((a) => (
                <tr key={a.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4">
                    <Link to={`/superadmin/agences/${a.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                      {a.nom}
                    </Link>
                  </td>
                  <td className="px-4 py-4">{a.telephone || '—'}</td>
                  <td className="px-4 py-4">{a.email ?? '—'}</td>
                  <td className="px-4 py-4">{a.adresse ?? '—'}</td>
                  <td className="px-4 py-4">{new Date(a.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-4">
                    {a.active ? <Badge tone="vert">Active</Badge> : <Badge tone="rouge">Désactivée</Badge>}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => setAConfirmer(a)}
                        title={a.active ? 'Désactiver' : 'Réactiver'}
                        className={`rounded-lg p-2 hover:bg-surface-container ${a.active ? 'text-error hover:text-error' : 'text-vert hover:text-vert'}`}
                      >
                        <Icon name={a.active ? 'block' : 'check_circle'} size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {agences.length === 0 && <EmptyState message="Aucune agence." />}
        </div>
      </div>

      <Modal open={formOuvert} title="Créer une agence" onClose={() => setFormOuvert(false)}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nom de l’agence">
            <Input required value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Téléphone">
              <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <Field label="Adresse">
            <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </Field>
          <div className="border-t border-outline-variant pt-4">
            <p className="mb-3 text-label-md font-semibold text-primary">Compte gérant</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom du gérant">
                <Input required value={gerantNom} onChange={(e) => setGerantNom(e.target.value)} />
              </Field>
              <Field label="Email du gérant">
                <Input type="email" required value={gerantEmail} onChange={(e) => setGerantEmail(e.target.value)} />
              </Field>
            </div>
            <p className="mt-2 text-label-md text-on-surface-variant">Le gérant s'inscrira avec cet email pour activer son compte.</p>
          </div>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOuvert(false)}>Annuler</Button>
            <Button type="submit" disabled={creer.isPending}>Créer</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!aConfirmer}
        title={aConfirmer?.active ? "Désactiver l'agence" : "Réactiver l'agence"}
        onClose={() => setAConfirmer(null)}
      >
        <p className="text-body-md text-on-surface-variant">
          {aConfirmer?.active
            ? `Désactiver « ${aConfirmer.nom} » ? Ses membres ne pourront plus accéder à leurs données.`
            : `Réactiver « ${aConfirmer?.nom} » ? Ses membres retrouveront l'accès.`}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setAConfirmer(null)}>Annuler</Button>
          <Button
            type="button"
            variant={aConfirmer?.active ? 'danger' : 'primary'}
            disabled={basculerActive.isPending}
            onClick={() => aConfirmer && basculerActive.mutate({ id: aConfirmer.id, active: !aConfirmer.active })}
          >
            Confirmer
          </Button>
        </div>
      </Modal>
    </div>
  )
}