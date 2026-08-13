import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAgence } from '../hooks/useAgence'
import { LIBELLES_TYPE_VOYAGE } from '../lib/format'
import type { Groupe } from '../lib/types'
import Card from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'

interface GroupeAvecCompte extends Groupe {
  pelerins: { count: number }[]
}

export default function Groupes() {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()
  const [modalOuverte, setModalOuverte] = useState(false)
  const [enEdition, setEnEdition] = useState<Groupe | null>(null)
  const [form, setForm] = useState({ nom: '', type_voyage: 'hajj', date_depart: '', date_retour: '', nb_places_max: '0' })
  const [erreur, setErreur] = useState('')

  const { data: groupes = [] } = useQuery({
    queryKey: ['groupes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('groupes')
        .select('*, pelerins(count)')
        .order('date_depart', { ascending: false })
      return data as GroupeAvecCompte[]
    },
  })

  const ouvrirCreation = () => {
    setEnEdition(null)
    setForm({ nom: '', type_voyage: 'hajj', date_depart: '', date_retour: '', nb_places_max: '0' })
    setModalOuverte(true)
  }

  const ouvrirEdition = (g: GroupeAvecCompte) => {
    setEnEdition(g)
    setForm({
      nom: g.nom,
      type_voyage: g.type_voyage,
      date_depart: g.date_depart,
      date_retour: g.date_retour,
      nb_places_max: String(g.nb_places_max),
    })
    setModalOuverte(true)
  }

  const sauver = useMutation({
    mutationFn: async () => {
      const valeurs = {
        agence_id: agence!.id,
        nom: form.nom,
        type_voyage: form.type_voyage,
        date_depart: form.date_depart,
        date_retour: form.date_retour,
        nb_places_max: parseInt(form.nb_places_max, 10) || 0,
      }
      if (enEdition) {
        const { error } = await supabase.from('groupes').update(valeurs).eq('id', enEdition.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('groupes').insert(valeurs)
        if (error) throw error
      }
    },
    onSuccess: () => {
      setModalOuverte(false)
      queryClient.invalidateQueries({ queryKey: ['groupes'] })
    },
    onError: () => setErreur('Impossible d’enregistrer le groupe.'),
  })

  const supprimer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('groupes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groupes'] }),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    sauver.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-headline text-navy">Groupes</h1>
        <Button onClick={ouvrirCreation}>Nouveau groupe</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Départ</th>
                <th className="px-4 py-3">Retour</th>
                <th className="px-4 py-3">Places</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupes.map((g) => {
                const inscrits = g.pelerins[0]?.count ?? 0
                return (
                  <tr key={g.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-navy">
                      <Link to={`/liste-des-pelerins?groupe=${g.id}`} className="hover:underline">{g.nom}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={g.type_voyage === 'hajj' ? 'ambre' : 'neutre'}>{LIBELLES_TYPE_VOYAGE[g.type_voyage]}</Badge>
                    </td>
                    <td className="px-4 py-3">{new Date(g.date_depart).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">{new Date(g.date_retour).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <span className={inscrits >= g.nb_places_max && g.nb_places_max > 0 ? 'font-semibold text-error' : ''}>
                        {inscrits} / {g.nb_places_max}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => ouvrirEdition(g)} className="mr-3 text-xs text-navy hover:underline">Modifier</button>
                      <button onClick={() => supprimer.mutate(g.id)} className="text-xs text-error hover:underline">Supprimer</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {groupes.length === 0 && <EmptyState message="Aucun groupe. Créez votre premier groupe Hajj ou Omra." />}
        </div>
      </Card>

      <Modal open={modalOuverte} title={enEdition ? 'Modifier le groupe' : 'Nouveau groupe'} onClose={() => setModalOuverte(false)}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nom">
            <Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex : Hajj 2027" />
          </Field>
          <Field label="Type de voyage">
            <Select value={form.type_voyage} onChange={(e) => setForm({ ...form, type_voyage: e.target.value })}>
              <option value="hajj">Hajj</option>
              <option value="omra">Omra</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date de départ">
              <Input type="date" required value={form.date_depart} onChange={(e) => setForm({ ...form, date_depart: e.target.value })} />
            </Field>
            <Field label="Date de retour">
              <Input type="date" required value={form.date_retour} onChange={(e) => setForm({ ...form, date_retour: e.target.value })} />
            </Field>
          </div>
          <Field label="Nombre de places maximum">
            <Input type="number" min={0} value={form.nb_places_max} onChange={(e) => setForm({ ...form, nb_places_max: e.target.value })} />
          </Field>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOuverte(false)}>Annuler</Button>
            <Button type="submit" disabled={sauver.isPending}>{enEdition ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
