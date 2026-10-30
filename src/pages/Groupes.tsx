import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAgence } from '../hooks/useAgence'
import { LIBELLES_TYPE_VOYAGE, formatDate } from '../lib/format'
import type { Groupe } from '../lib/types'
import Icon from '../components/ui/Icon'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'
import BoutonFiltres from '../components/ui/BoutonFiltres'

interface GroupeAvecCompte extends Groupe {
  pelerins: { count: number }[]
}

export default function Groupes() {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()
  const [modalOuverte, setModalOuverte] = useState(false)
  const [enEdition, setEnEdition] = useState<Groupe | null>(null)
  const [aSupprimer, setASupprimer] = useState<GroupeAvecCompte | null>(null)
  const [form, setForm] = useState({ nom: '', type_voyage: 'hajj', date_depart: '', date_retour: '', nb_places_max: '0' })
  const [erreur, setErreur] = useState('')
  const [erreurSuppression, setErreurSuppression] = useState('')
  const [recherche, setRecherche] = useState('')
  const [typeFiltre, setTypeFiltre] = useState('')
  const [statutFiltre, setStatutFiltre] = useState('')
  const [periodeFiltre, setPeriodeFiltre] = useState('')
  const [modeAffichage, setModeAffichage] = useState<'liste' | 'cartes'>('liste')
  const [page, setPage] = useState(1)
  const [filtresOuverts, setFiltresOuverts] = useState(false)

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

  const groupesFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    const aujourdHui = new Date()
    aujourdHui.setHours(0, 0, 0, 0)
    const dansTrenteJours = new Date(aujourdHui)
    dansTrenteJours.setDate(dansTrenteJours.getDate() + 30)

    return groupes.filter((g) => {
      const inscrits = g.pelerins[0]?.count ?? 0
      const depart = new Date(`${g.date_depart}T00:00:00`)
      const retour = new Date(`${g.date_retour}T00:00:00`)
      const complet = g.nb_places_max > 0 && inscrits >= g.nb_places_max
      if (terme && !g.nom.toLowerCase().includes(terme)) return false
      if (typeFiltre && g.type_voyage !== typeFiltre) return false
      if (statutFiltre === 'ouvert' && (complet || depart < aujourdHui)) return false
      if (statutFiltre === 'complet' && !complet) return false
      if (statutFiltre === 'encours' && !(depart <= aujourdHui && retour >= aujourdHui)) return false
      if (periodeFiltre === 'avenir' && depart < aujourdHui) return false
      if (periodeFiltre === 'passe' && depart >= aujourdHui) return false
      if (periodeFiltre === '30jours' && (depart < aujourdHui || depart > dansTrenteJours)) return false
      return true
    })
  }, [groupes, recherche, typeFiltre, statutFiltre, periodeFiltre])

  const groupesParPage = 3
  const nombrePages = Math.max(1, Math.ceil(groupesFiltres.length / groupesParPage))
  const groupesAffiches = groupesFiltres.slice((page - 1) * groupesParPage, page * groupesParPage)

  useEffect(() => {
    setPage((current) => Math.min(current, nombrePages))
  }, [nombrePages])

  function reinitialiserPage(action: () => void) {
    action()
    setPage(1)
  }

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
    onSuccess: () => {
      setASupprimer(null)
      setErreurSuppression('')
      queryClient.invalidateQueries({ queryKey: ['groupes'] })
    },
    onError: () => setErreurSuppression('Impossible de supprimer le groupe.'),
  })

  function demanderSuppression(groupe: GroupeAvecCompte) {
    setErreurSuppression('')
    setASupprimer(groupe)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    sauver.mutate()
  }

  return (
    <div className="space-y-6 md:space-y-7">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-display-lg text-primary">Liste des groupes</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Gérez les départs, suivez le remplissage et organisez vos pèlerins.</p>
        </div>
        <Button onClick={ouvrirCreation} className="whitespace-nowrap">
          <Icon name="add" size={20} className="mr-2" />
          Ajouter un groupe
        </Button>
      </div>

      <section className="flex flex-col items-stretch justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="flex w-full gap-2 lg:w-1/3">
          <div className="relative flex-1">
            <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant" />
            <Input
              aria-label="Rechercher par nom de groupe"
              placeholder="Rechercher par nom de groupe…"
              value={recherche}
              onChange={(e) => reinitialiserPage(() => setRecherche(e.target.value))}
              className="w-full rounded-lg bg-surface-container-low pl-10"
            />
          </div>
          <BoutonFiltres ouverts={filtresOuverts} actifs={[typeFiltre, statutFiltre, periodeFiltre].filter(Boolean).length} controle="filtres-groupes" onClick={() => setFiltresOuverts((o) => !o)} />
        </div>
        <div id="filtres-groupes" className={`${filtresOuverts ? 'flex' : 'hidden'} w-full flex-wrap items-center gap-3 md:flex lg:w-auto`}>
          <Select aria-label="Filtrer par type" value={typeFiltre} onChange={(e) => reinitialiserPage(() => setTypeFiltre(e.target.value))} className="min-w-36">
            <option value="">Tous les types</option>
            <option value="hajj">Hajj</option>
            <option value="omra">Omra</option>
          </Select>
          <Select aria-label="Filtrer par statut" value={statutFiltre} onChange={(e) => reinitialiserPage(() => setStatutFiltre(e.target.value))} className="min-w-36">
            <option value="">Statut : Tous</option>
            <option value="ouvert">Ouvert</option>
            <option value="complet">Complet</option>
            <option value="encours">En cours</option>
          </Select>
          <div className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-body-md">
            <Icon name="calendar_month" size={18} className="text-on-surface-variant" />
            <Select aria-label="Filtrer par période" value={periodeFiltre} onChange={(e) => reinitialiserPage(() => setPeriodeFiltre(e.target.value))} className="min-w-36 border-0 bg-transparent p-0 shadow-none focus:ring-0">
              <option value="">Période</option>
              <option value="30jours">30 prochains jours</option>
              <option value="avenir">Départs à venir</option>
              <option value="passe">Départs passés</option>
            </Select>
          </div>
          <div className="ml-auto hidden rounded-lg border border-outline-variant bg-surface-container-low p-1 md:flex" aria-label="Mode d’affichage">
            <button type="button" aria-label="Affichage en liste" aria-pressed={modeAffichage === 'liste'} onClick={() => setModeAffichage('liste')} className={`rounded-md p-2 ${modeAffichage === 'liste' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
              <Icon name="menu" size={20} />
            </button>
            <button type="button" aria-label="Affichage en cartes" aria-pressed={modeAffichage === 'cartes'} onClick={() => setModeAffichage('cartes')} className={`rounded-md p-2 ${modeAffichage === 'cartes' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}>
              <Icon name="dashboard" size={20} />
            </button>
          </div>
        </div>
      </section>

      {modeAffichage === 'liste' ? (
        <div className="md:overflow-hidden md:rounded-xl md:border md:border-outline-variant md:bg-surface-container-lowest md:shadow-sm">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[780px] text-body-md">
              <thead>
                <tr className="bg-surface-container-low text-left text-label-md text-on-surface-variant">
                  <th className="px-6 py-4 font-medium">Nom du groupe</th>
                  <th className="px-5 py-4 font-medium">Type</th>
                  <th className="px-5 py-4 font-medium">Dates (Départ/Retour)</th>
                  <th className="px-5 py-4 font-medium">Remplissage</th>
                  <th className="px-5 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupesAffiches.map((g) => {
                  const inscrits = g.pelerins[0]?.count ?? 0
                  const capacite = g.nb_places_max
                  const complet = capacite > 0 && inscrits >= capacite
                  const pourcentage = capacite > 0 ? Math.min(100, Math.round((inscrits / capacite) * 100)) : 0
                  return (
                    <tr key={g.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low/60">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-container text-lg font-semibold text-on-primary-container">{g.nom.trim().charAt(0).toUpperCase() || 'G'}</span>
                          <div className="font-semibold text-primary"><Link to={`/liste-des-pelerins?groupe=${g.id}`} className="hover:underline">{g.nom}</Link><p className="mt-0.5 text-sm font-normal text-on-surface-variant">{agence?.nom}</p></div>
                        </div>
                      </td>
                      <td className="px-5 py-5"><Badge tone={g.type_voyage === 'hajj' ? 'ambre' : 'vert'}>{LIBELLES_TYPE_VOYAGE[g.type_voyage]}</Badge></td>
                      <td className="px-5 py-5"><div className="space-y-1.5"><p className="flex items-center gap-2"><Icon name="flight" size={18} className="text-on-surface-variant" />{formatDate(g.date_depart)}</p><p className="flex items-center gap-2"><Icon name="flight" size={18} className="rotate-180 text-on-surface-variant" />{formatDate(g.date_retour)}</p></div></td>
                      <td className="px-5 py-5">
                        <div className="max-w-60 space-y-1.5">
                          <div className="flex justify-between gap-4 text-sm font-medium"><span>{inscrits} / {capacite}</span><span className={complet ? 'text-vert' : ''}>{complet ? 'Complet' : `${pourcentage}%`}</span></div>
                          <div role="progressbar" aria-label={`Remplissage de ${g.nom}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pourcentage} className="h-2 overflow-hidden rounded-full bg-surface-container"><div className={`h-full rounded-full ${complet ? 'bg-vert' : pourcentage >= 80 ? 'bg-secondary-fixed-dim' : 'bg-primary'}`} style={{ width: `${pourcentage}%` }} /></div>
                          <p className="text-sm text-on-surface-variant">{complet ? 'Liste d’attente' : `${Math.max(0, capacite - inscrits)} places restantes`}</p>
                        </div>
                      </td>
                      <td className="px-5 py-5 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => ouvrirEdition(g)} title="Modifier" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"><Icon name="edit" size={18} /></button>
                          <button onClick={() => demanderSuppression(g)} title="Supprimer" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"><Icon name="delete" size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {groupesFiltres.length === 0 && <EmptyState message={groupes.length === 0 ? 'Aucun groupe. Créez votre premier groupe Hajj ou Omra.' : 'Aucun groupe ne correspond à ces filtres.'} />}
          </div>
          {groupesFiltres.length > 0 && (
            <div className="hidden flex-col items-center justify-between gap-3 border-t border-outline-variant px-6 py-4 sm:flex-row md:flex">
              <p className="text-body-md text-on-surface-variant">Affichage de {(page - 1) * groupesParPage + 1} à {Math.min(page * groupesParPage, groupesFiltres.length)} sur {groupesFiltres.length} groupes</p>
              <nav aria-label="Pagination des groupes" className="flex items-center gap-1">
                <button type="button" aria-label="Page précédente" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container disabled:opacity-40"><Icon name="chevron_right" size={20} className="rotate-180" /></button>
                {Array.from({ length: nombrePages }, (_, i) => i + 1).map((numero) => <button key={numero} type="button" aria-label={`Page ${numero}`} aria-current={page === numero ? 'page' : undefined} onClick={() => setPage(numero)} className={`h-10 min-w-10 rounded-lg px-3 ${page === numero ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container-low'}`}>{numero}</button>)}
                <button type="button" aria-label="Page suivante" disabled={page === nombrePages} onClick={() => setPage((p) => Math.min(nombrePages, p + 1))} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container disabled:opacity-40"><Icon name="chevron_right" size={20} /></button>
              </nav>
            </div>
          )}
          <div className="space-y-3 md:hidden">
            {groupesAffiches.map((g) => {
              const inscrits = g.pelerins[0]?.count ?? 0
              const capacite = g.nb_places_max
              const complet = capacite > 0 && inscrits >= capacite
              const pourcentage = capacite > 0 ? Math.min(100, Math.round((inscrits / capacite) * 100)) : 0
              return <article key={g.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><Link to={`/liste-des-pelerins?groupe=${g.id}`} className="break-words font-semibold text-primary">{g.nom}</Link></div>
                  <Badge tone={g.type_voyage === 'hajj' ? 'ambre' : 'vert'}>{LIBELLES_TYPE_VOYAGE[g.type_voyage]}</Badge>
                </div>
                <div className="my-3 grid grid-cols-2 gap-3 text-sm"><div><p className="text-on-surface-variant">Départ</p><p className="flex items-center gap-1 font-medium"><Icon name="flight" size={16} />{formatDate(g.date_depart)}</p></div><div><p className="text-on-surface-variant">Retour</p><p className="flex items-center gap-1 font-medium"><Icon name="flight" size={16} className="rotate-180" />{formatDate(g.date_retour)}</p></div></div>
                <div className="space-y-1"><div className="flex justify-between gap-2 text-sm"><span>{inscrits} / {capacite} pèlerins</span><span>{complet ? 'Complet' : `${pourcentage}%`}</span></div><div role="progressbar" aria-label={`Remplissage de ${g.nom}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pourcentage} className="h-2 overflow-hidden rounded-full bg-surface-container"><div className={`h-full rounded-full ${complet ? 'bg-vert' : 'bg-primary'}`} style={{ width: `${pourcentage}%` }} /></div><p className="text-sm text-on-surface-variant">{complet ? 'Liste d’attente' : `${Math.max(0, capacite - inscrits)} places restantes`}</p></div>
                <div className="mt-3 flex justify-end gap-2 border-t border-outline-variant pt-3"><button onClick={() => ouvrirEdition(g)} aria-label={`Modifier ${g.nom}`} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"><Icon name="edit" size={18} /></button><button onClick={() => demanderSuppression(g)} aria-label={`Supprimer ${g.nom}`} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"><Icon name="delete" size={18} /></button></div>
              </article>
            })}
            {groupesFiltres.length === 0 && <EmptyState message={groupes.length === 0 ? 'Aucun groupe. Créez votre premier groupe Hajj ou Omra.' : 'Aucun groupe ne correspond à ces filtres.'} />}
            {groupesFiltres.length > 0 && <nav aria-label="Pagination des groupes" className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest px-2 py-2"><button type="button" aria-label="Page précédente" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg p-2 disabled:opacity-40"><Icon name="chevron_right" size={20} className="rotate-180" /></button><span className="text-sm text-on-surface-variant">Page {page} sur {nombrePages}</span><button type="button" aria-label="Page suivante" disabled={page === nombrePages} onClick={() => setPage((p) => Math.min(nombrePages, p + 1))} className="rounded-lg p-2 disabled:opacity-40"><Icon name="chevron_right" size={20} /></button></nav>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {groupesAffiches.map((g) => {
            const inscrits = g.pelerins[0]?.count ?? 0
            const complet = g.nb_places_max > 0 && inscrits >= g.nb_places_max
            const pourcentage = g.nb_places_max > 0 ? Math.min(100, Math.round((inscrits / g.nb_places_max) * 100)) : 0
            return <article key={g.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-container text-lg font-semibold text-on-primary-container">{g.nom.trim().charAt(0).toUpperCase() || 'G'}</span><div><Link to={`/liste-des-pelerins?groupe=${g.id}`} className="font-semibold text-primary hover:underline">{g.nom}</Link><p className="text-sm text-on-surface-variant">{agence?.nom}</p></div></div><Badge tone={g.type_voyage === 'hajj' ? 'ambre' : 'vert'}>{LIBELLES_TYPE_VOYAGE[g.type_voyage]}</Badge></div>
              <div className="my-4 space-y-2 text-body-md text-on-surface-variant"><p className="flex items-center gap-2"><Icon name="flight" size={18} />Départ : {formatDate(g.date_depart)}</p><p className="flex items-center gap-2"><Icon name="flight" size={18} className="rotate-180" />Retour : {formatDate(g.date_retour)}</p></div>
              <div className="space-y-1.5"><div className="flex justify-between text-sm font-medium"><span>{inscrits} / {g.nb_places_max}</span><span>{complet ? 'Complet' : `${pourcentage}%`}</span></div><div role="progressbar" aria-label={`Remplissage de ${g.nom}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pourcentage} className="h-2 overflow-hidden rounded-full bg-surface-container"><div className={`h-full rounded-full ${complet ? 'bg-vert' : 'bg-primary'}`} style={{ width: `${pourcentage}%` }} /></div><p className="text-sm text-on-surface-variant">{complet ? 'Liste d’attente' : `${Math.max(0, g.nb_places_max - inscrits)} places restantes`}</p></div>
              <div className="mt-4 flex justify-end gap-1 border-t border-outline-variant pt-3"><button onClick={() => ouvrirEdition(g)} title="Modifier" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"><Icon name="edit" size={18} /></button><button onClick={() => demanderSuppression(g)} title="Supprimer" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"><Icon name="delete" size={18} /></button></div>
            </article>
          })}
          {groupesFiltres.length === 0 && <EmptyState message={groupes.length === 0 ? 'Aucun groupe. Créez votre premier groupe Hajj ou Omra.' : 'Aucun groupe ne correspond à ces filtres.'} />}
          {groupesFiltres.length > 0 && <nav aria-label="Pagination des groupes" className="col-span-full flex justify-center gap-1 pt-2"><button type="button" aria-label="Page précédente" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg p-2 text-on-surface-variant disabled:opacity-40"><Icon name="chevron_right" size={20} className="rotate-180" /></button>{Array.from({ length: nombrePages }, (_, i) => i + 1).map((numero) => <button key={numero} type="button" aria-label={`Page ${numero}`} aria-current={page === numero ? 'page' : undefined} onClick={() => setPage(numero)} className={`h-10 min-w-10 rounded-lg px-3 ${page === numero ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container-low'}`}>{numero}</button>)}<button type="button" aria-label="Page suivante" disabled={page === nombrePages} onClick={() => setPage((p) => Math.min(nombrePages, p + 1))} className="rounded-lg p-2 text-on-surface-variant disabled:opacity-40"><Icon name="chevron_right" size={20} /></button></nav>}
        </div>
      )}

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

      <Modal
        open={!!aSupprimer}
        title="Supprimer le groupe"
        onClose={() => {
          setASupprimer(null)
          setErreurSuppression('')
        }}
      >
        <p className="text-body-md text-on-surface-variant">
          Supprimer « {aSupprimer?.nom} » ? Les pèlerins, documents et paiements associés seront également supprimés définitivement.
        </p>
        {erreurSuppression && <p className="mt-2 text-sm text-error">{erreurSuppression}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setASupprimer(null)
              setErreurSuppression('')
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={supprimer.isPending}
            onClick={() => aSupprimer && supprimer.mutate(aSupprimer.id)}
          >
            Confirmer la suppression
          </Button>
        </div>
      </Modal>
    </div>
  )
}
