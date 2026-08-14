import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAgence } from '../hooks/useAgence'
import { LIBELLES_TYPE_VOYAGE, formatDate } from '../lib/format'
import type { Groupe } from '../lib/types'
import Icon from '../components/ui/Icon'
import StatCard from '../components/ui/StatCard'
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
  const [recherche, setRecherche] = useState('')

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

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    if (!terme) return groupes
    return groupes.filter((g) => g.nom.toLowerCase().includes(terme))
  }, [groupes, recherche])

  const totaux = useMemo(() => {
    const inscrits = groupes.reduce((s, g) => s + (g.pelerins[0]?.count ?? 0), 0)
    const capacite = groupes.reduce((s, g) => s + g.nb_places_max, 0)
    return { groupes: groupes.length, inscrits, placesLibres: Math.max(0, capacite - inscrits) }
  }, [groupes])

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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Groupes</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Organisez vos départs Hajj et Omra</p>
        </div>
        <Button onClick={ouvrirCreation}>
          <Icon name="group_add" size={18} className="mr-2" />
          Nouveau groupe
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Groupes" valeur={totaux.groupes} icon="group" />
        <StatCard label="Pèlerins inscrits" valeur={totaux.inscrits} icon="person" tone="vert" />
        <StatCard label="Places libres" valeur={totaux.placesLibres} icon="event_seat" tone={totaux.placesLibres === 0 ? 'error' : 'gold'} />
      </section>

      <div className="relative max-w-xs">
        <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <Input placeholder="Rechercher un groupe…" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="pl-10" />
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Départ</th>
                <th className="px-4 py-3">Retour</th>
                <th className="px-4 py-3">Places</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((g) => {
                const inscrits = g.pelerins[0]?.count ?? 0
                return (
                  <tr key={g.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                    <td className="px-4 py-4 font-medium text-primary">
                      <Link to={`/liste-des-pelerins?groupe=${g.id}`} className="hover:underline">{g.nom}</Link>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={g.type_voyage === 'hajj' ? 'ambre' : 'neutre'}>{LIBELLES_TYPE_VOYAGE[g.type_voyage]}</Badge>
                    </td>
                    <td className="px-4 py-4">{formatDate(g.date_depart)}</td>
                    <td className="px-4 py-4">{formatDate(g.date_retour)}</td>
                    <td className="px-4 py-4">
                      <span className={inscrits >= g.nb_places_max && g.nb_places_max > 0 ? 'font-semibold text-error' : ''}>
                        {inscrits} / {g.nb_places_max}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => ouvrirEdition(g)}
                          title="Modifier"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"
                        >
                          <Icon name="edit" size={18} />
                        </button>
                        <button
                          onClick={() => supprimer.mutate(g.id)}
                          title="Supprimer"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtres.length === 0 && <EmptyState message="Aucun groupe. Créez votre premier groupe Hajj ou Omra." />}
        </div>
      </div>

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