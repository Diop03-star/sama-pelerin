import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAgence } from '../hooks/useAgence'
import { LIBELLES_DOSSIER, LIBELLES_TYPE_VOYAGE, TONE_DOSSIER, formatDate, formatFCFA } from '../lib/format'
import type { Groupe, Pelerin } from '../lib/types'
import { TYPES_DOCUMENT_REQUIS, resteDu } from '../lib/plan'
import Icon from '../components/ui/Icon'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'

interface PelerinAvecJointures extends Pelerin {
  groupe: Groupe
  documents: { type_document: string; statut: string; numero_document: string | null }[]
  plan_paiement: {
    montant_total: number
    nombre_tranches: number
    tranches: { paiements: { montant_paye: number }[] }[]
    acomptes: { montant_paye: number }[]
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
  const [enEdition, setEnEdition] = useState<PelerinAvecJointures | null>(null)
  const [aSupprimer, setASupprimer] = useState<PelerinAvecJointures | null>(null)
  const [menuOuvert, setMenuOuvert] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { data: groupes = [] } = useQuery({
    queryKey: ['groupes-simple'],
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
        .select('*, groupe:groupes(*), documents(type_document, statut, numero_document), plan_paiement:plans_paiement(montant_total, nombre_tranches, tranches(paiements(montant_paye)), acomptes:paiements!plan_paiement_id(montant_paye))')
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
      return `${p.prenom} ${p.nom}`.toLowerCase().includes(terme)
        || p.telephone.includes(terme)
        || (p.documents ?? []).some((d) => d.numero_document?.toLowerCase().includes(terme))
    })
  }, [pelerins, recherche, groupeFiltre, statutFiltre])

  const elementsParPage = 3
  const nombrePages = Math.max(1, Math.ceil(filtres.length / elementsParPage))
  const pelerinsAffiches = filtres.slice((page - 1) * elementsParPage, page * elementsParPage)

  useEffect(() => {
    setPage((courante) => Math.min(courante, nombrePages))
  }, [nombrePages])

  useEffect(() => {
    setRecherche(rechercheUrl)
    setPage(1)
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

  function modifierParametre(nom: 'groupe' | 'statut', valeur: string) {
    setParams((precedents) => {
      const suivants = new URLSearchParams(precedents)
      if (valeur) suivants.set(nom, valeur)
      else suivants.delete(nom)
      return suivants
    })
    setPage(1)
  }

  const sauver = useMutation({
    mutationFn: async () => {
      const valeurs = {
        groupe_id: form.groupe_id,
        nom: form.nom,
        prenom: form.prenom,
        telephone: form.telephone,
        email: form.email || null,
        sexe: form.sexe as 'M' | 'F',
      }
      const { error } = enEdition
        ? await supabase.from('pelerins').update(valeurs).eq('id', enEdition.id)
        : await supabase.from('pelerins').insert({ ...valeurs, agence_id: agence!.id })
      if (error) throw error
    },
    onSuccess: () => {
      setModalOuverte(false)
      setEnEdition(null)
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: () => setErreur('Impossible d’enregistrer le pèlerin.'),
  })

  const supprimer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pelerins').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setASupprimer(null)
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: () => setErreur('Impossible de supprimer le pèlerin.'),
  })

  function ouvrirEdition(p: PelerinAvecJointures) {
    setForm({
      groupe_id: p.groupe_id,
      nom: p.nom,
      prenom: p.prenom,
      telephone: p.telephone,
      email: p.email ?? '',
      sexe: p.sexe ?? 'M',
    })
    setEnEdition(p)
    setErreur('')
    setModalOuverte(true)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    sauver.mutate()
  }

  const montantPaye = (p: PelerinAvecJointures) => {
    const paiements = p.plan_paiement?.tranches.flatMap((t) => t.paiements) ?? []
    const acomptes = p.plan_paiement?.acomptes ?? []
    return paiements.reduce((s, p) => s + p.montant_paye, 0) + acomptes.reduce((s, a) => s + a.montant_paye, 0)
  }

  return (
    <div className="space-y-6">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-display-lg text-on-surface">Gestion des Pèlerins</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Gérez les dossiers, suivez l’avancement et gérez les paiements.</p>
        </div>
        <Button
          onClick={() => {
            setForm({ ...form, groupe_id: groupeFiltre ?? groupes[0]?.id ?? '' })
            setEnEdition(null)
            setModalOuverte(true)
          }}
        >
          <Icon name="add" size={18} className="mr-2" />
          Ajouter un pèlerin
        </Button>
      </div>

      <section className="flex flex-col items-end gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm lg:flex-row">
        <div className="w-full flex-1">
          <label className="label mb-2 block" htmlFor="recherche-pelerin">Recherche rapide</label>
          <div className="relative">
            <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <Input id="recherche-pelerin" placeholder="Nom, téléphone, passeport…" value={recherche} onChange={(e) => { setRecherche(e.target.value); setPage(1) }} className="border-outline-variant bg-surface pl-10" />
          </div>
        </div>
        <div className="w-full lg:w-48">
          <label className="label mb-2 block" htmlFor="filtre-statut-pelerin">Statut du dossier</label>
          <Select id="filtre-statut-pelerin" value={statutFiltre} onChange={(e) => modifierParametre('statut', e.target.value)} className="border-outline-variant bg-surface">
            <option value="">Tous les statuts</option>
            <option value="valide">Complet</option>
            <option value="incomplet">Incomplet</option>
          </Select>
        </div>
        <div className="w-full lg:w-48">
          <label className="label mb-2 block" htmlFor="filtre-groupe-pelerin">Groupe</label>
          <Select id="filtre-groupe-pelerin" value={groupeFiltre} onChange={(e) => modifierParametre('groupe', e.target.value)} className="border-outline-variant bg-surface">
            <option value="">Tous les groupes</option>
            {groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
          </Select>
        </div>
        <button type="button" title="Réinitialiser les filtres" aria-label="Réinitialiser les filtres" onClick={() => { setRecherche(''); setParams({}); setPage(1) }} className="flex h-11 w-full shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:bg-surface-container-low lg:w-12">
          <Icon name="delete" size={18} />
          <span className="ml-2 lg:hidden">Réinitialiser</span>
        </button>
      </section>

      <div className="hidden overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-body-md">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                <th className="px-6 py-4 font-medium text-on-surface-variant">Pèlerin</th>
                <th className="px-6 py-4 font-medium text-on-surface-variant">Contact</th>
                <th className="px-6 py-4 font-medium text-on-surface-variant">Groupe &amp; type</th>
                <th className="px-6 py-4 font-medium text-on-surface-variant">Progression du dossier</th>
                <th className="px-6 py-4 text-right font-medium text-on-surface-variant">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pelerinsAffiches.map((p) => {
                const documentsValides = TYPES_DOCUMENT_REQUIS.filter((type) => (p.documents ?? []).some((d) => d.type_document === type && d.statut === 'valide')).length
                const progression = Math.round((documentsValides / TYPES_DOCUMENT_REQUIS.length) * 100)
                const initials = `${p.prenom.trim().charAt(0)}${p.nom.trim().charAt(0)}`.toUpperCase()
                return (
                  <tr key={p.id} className="group border-b border-outline-variant transition-colors last:border-0 hover:bg-surface-container-low/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container">{initials}</span>
                        <div><p className="font-medium text-on-surface">{p.prenom} {p.nom}</p><p className="text-sm text-on-surface-variant">Inscrit le {formatDate(p.date_inscription)}</p></div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><p className="text-data-mono text-on-surface">{p.telephone}</p><p className="text-sm text-on-surface-variant">{p.email || 'Sans email'}</p></td>
                    <td className="px-6 py-4"><Badge tone={p.groupe?.type_voyage === 'hajj' ? 'ambre' : 'neutre'}>{p.groupe?.type_voyage ? LIBELLES_TYPE_VOYAGE[p.groupe.type_voyage] : '—'}</Badge><p className="mt-1 text-on-surface">{p.groupe?.nom ?? '—'}</p></td>
                    <td className="px-6 py-4">
                      <div className="flex min-w-48 items-center gap-3">
                        <div role="progressbar" aria-label={`Documents valides pour ${p.prenom} ${p.nom}`} aria-valuemin={0} aria-valuemax={TYPES_DOCUMENT_REQUIS.length} aria-valuenow={documentsValides} className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container"><div className={`h-full rounded-full ${documentsValides === TYPES_DOCUMENT_REQUIS.length ? 'bg-vert' : documentsValides === 0 ? 'bg-error' : 'bg-secondary-fixed-dim'}`} style={{ width: `${progression}%` }} /></div>
                        <span className={`whitespace-nowrap text-sm ${documentsValides === TYPES_DOCUMENT_REQUIS.length ? 'font-medium text-vert' : documentsValides === 0 ? 'text-error' : 'text-on-surface-variant'}`}>{documentsValides}/{TYPES_DOCUMENT_REQUIS.length} docs</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right"><div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Link to={`/details-du-pelerin/${p.id}`} title="Voir la fiche" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"><Icon name="visibility" size={18} /></Link>
                      <button onClick={() => ouvrirEdition(p)} title="Modifier" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"><Icon name="edit" size={18} /></button>
                      <button onClick={() => setASupprimer(p)} title="Supprimer" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"><Icon name="delete" size={18} /></button>
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtres.length === 0 && <EmptyState message="Aucun pèlerin trouvé." />}
        </div>
        {filtres.length > 0 && <div className="flex flex-col items-center justify-between gap-3 border-t border-outline-variant px-6 py-4 sm:flex-row">
          <p className="text-sm text-on-surface-variant">Affichage de {(page - 1) * elementsParPage + 1} à {Math.min(page * elementsParPage, filtres.length)} sur {filtres.length} pèlerins</p>
          <nav aria-label="Pagination des pèlerins" className="flex items-center gap-1">
            <button type="button" aria-label="Page précédente" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container disabled:opacity-40"><Icon name="chevron_right" size={20} className="rotate-180" /></button>
            {nombrePages <= 5 ? Array.from({ length: nombrePages }, (_, index) => index + 1).map((numero) => <button key={numero} type="button" aria-label={`Page ${numero}`} aria-current={page === numero ? 'page' : undefined} onClick={() => setPage(numero)} className={`h-9 min-w-9 rounded-lg px-3 ${page === numero ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container-low'}`}>{numero}</button>) : <>
              <button type="button" aria-label="Page 1" aria-current={page === 1 ? 'page' : undefined} onClick={() => setPage(1)} className={`h-9 min-w-9 rounded-lg px-3 ${page === 1 ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container-low'}`}>1</button>
              {page > 3 && <span className="px-1 text-on-surface-variant">…</span>}
              {Array.from({ length: 3 }, (_, index) => Math.max(2, Math.min(page - 1, nombrePages - 3)) + index).filter((numero) => numero < nombrePages).map((numero) => <button key={numero} type="button" aria-label={`Page ${numero}`} aria-current={page === numero ? 'page' : undefined} onClick={() => setPage(numero)} className={`h-9 min-w-9 rounded-lg px-3 ${page === numero ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container-low'}`}>{numero}</button>)}
              {page < nombrePages - 2 && <span className="px-1 text-on-surface-variant">…</span>}
              <button type="button" aria-label={`Page ${nombrePages}`} aria-current={page === nombrePages ? 'page' : undefined} onClick={() => setPage(nombrePages)} className={`h-9 min-w-9 rounded-lg px-3 ${page === nombrePages ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container-low'}`}>{nombrePages}</button>
            </>}
            <button type="button" aria-label="Page suivante" disabled={page === nombrePages} onClick={() => setPage((current) => Math.min(nombrePages, current + 1))} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container disabled:opacity-40"><Icon name="chevron_right" size={20} /></button>
          </nav>
        </div>}
      </div>

      <div className="space-y-4 md:hidden">
        {pelerinsAffiches.map((p) => {
          const documentsValides = TYPES_DOCUMENT_REQUIS.filter((type) => (p.documents ?? []).some((d) => d.type_document === type && d.statut === 'valide')).length
          const progression = Math.round((documentsValides / TYPES_DOCUMENT_REQUIS.length) * 100)
          const reste = p.plan_paiement ? resteDu(p.plan_paiement.montant_total, montantPaye(p)) : null
          return <div key={p.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-primary">{p.prenom} {p.nom}</p><p className="mt-0.5 flex items-center gap-1 text-body-md text-on-surface-variant"><Icon name="group" size={16} />{p.groupe?.nom ?? '—'}</p></div><Badge tone={TONE_DOSSIER[p.statut_dossier]}>{LIBELLES_DOSSIER[p.statut_dossier]}</Badge></div>
            <div className="mt-3 space-y-1 text-body-md text-on-surface-variant"><p className="flex items-center gap-2"><Icon name="call" size={16} />{p.telephone}</p><p className="flex items-center gap-2"><Icon name="calendar_month" size={16} />Inscrit le {new Date(p.date_inscription).toLocaleDateString('fr-FR')}</p></div>
            <div className="mt-3 flex items-center gap-3"><div role="progressbar" aria-label={`Documents valides pour ${p.prenom} ${p.nom}`} aria-valuemin={0} aria-valuemax={TYPES_DOCUMENT_REQUIS.length} aria-valuenow={documentsValides} className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container"><div className={`h-full rounded-full ${documentsValides === TYPES_DOCUMENT_REQUIS.length ? 'bg-vert' : documentsValides === 0 ? 'bg-error' : 'bg-secondary-fixed-dim'}`} style={{ width: `${progression}%` }} /></div><span className="text-sm text-on-surface-variant">{documentsValides}/{TYPES_DOCUMENT_REQUIS.length} docs</span></div>
            {reste !== null && <p className="mt-2 text-sm text-on-surface-variant">Reste dû : {formatFCFA(reste)}</p>}
            <div className="mt-4 flex items-center gap-2"><Link to={`/details-du-pelerin/${p.id}`} className="btn-secondary px-3 py-1.5 text-sm">Voir</Link><Button variant="secondary" onClick={() => ouvrirEdition(p)} className="px-3 py-1.5 text-sm">Modifier</Button><div className="relative"><button onClick={() => setMenuOuvert(menuOuvert === p.id ? null : p.id)} title="Plus" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"><Icon name="menu" size={18} /></button>{menuOuvert === p.id && <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-lg"><button onClick={() => { setMenuOuvert(null); setASupprimer(p) }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-error hover:bg-surface-container"><Icon name="delete" size={16} />Supprimer</button></div>}</div></div>
          </div>
        })}
        {filtres.length === 0 && <EmptyState message="Aucun pèlerin trouvé." />}
        {filtres.length > 0 && <nav aria-label="Pagination des pèlerins" className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-3">
          <button type="button" aria-label="Page précédente" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg p-2 text-on-surface-variant disabled:opacity-40"><Icon name="chevron_right" size={20} className="rotate-180" /></button>
          <span className="text-sm text-on-surface-variant">Page {page} sur {nombrePages}</span>
          <button type="button" aria-label="Page suivante" disabled={page === nombrePages} onClick={() => setPage((current) => Math.min(nombrePages, current + 1))} className="rounded-lg p-2 text-on-surface-variant disabled:opacity-40"><Icon name="chevron_right" size={20} /></button>
        </nav>}
      </div>

      <Modal open={modalOuverte} title={enEdition ? 'Modifier le pèlerin' : 'Inscrire un pèlerin'} onClose={() => { setModalOuverte(false); setEnEdition(null) }}>
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
            <Button type="button" variant="secondary" onClick={() => { setModalOuverte(false); setEnEdition(null) }}>Annuler</Button>
            <Button type="submit" disabled={sauver.isPending}>{enEdition ? 'Enregistrer' : 'Inscrire'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!aSupprimer} title="Supprimer le pèlerin" onClose={() => setASupprimer(null)}>
        <p className="text-body-md text-on-surface-variant">
          Supprimer « {aSupprimer?.prenom} {aSupprimer?.nom} » ? Ses documents, plan de paiement et versements seront supprimés définitivement.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setASupprimer(null)}>Annuler</Button>
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
