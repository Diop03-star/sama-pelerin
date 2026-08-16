import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_DOCUMENT, LIBELLES_DOC_STATUT, TONE_DOCUMENT, formatDate } from '../lib/format'
import { expirantDans } from '../lib/documents'
import { validerSansFichier } from '../lib/documents'
import { useAgence } from '../hooks/useAgence'
import type { Document } from '../lib/types'
import Icon from '../components/ui/Icon'
import Button from '../components/ui/Button'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

interface DocumentAvecPelerin extends Document {
  pelerin: { id: string; prenom: string; nom: string; telephone: string }
}

const ICONES_DOCUMENT: Record<string, string> = {
  passeport: 'badge',
  visa: 'flight',
  certificat_vaccination: 'medical_information',
  photo: 'photo_camera',
  autre: 'description',
}

export default function Documents() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const alerte = params.get('alerte') ?? ''
  const [filtreType, setFiltreType] = useState(alerte ? 'passeport' : '')
  const [filtreStatut, setFiltreStatut] = useState('')
  const [pelerinChoisi, setPelerinChoisi] = useState('')
  const [typeSansFichier, setTypeSansFichier] = useState('passeport')
  const { data: agence } = useAgence()

  const { data: documents = [] } = useQuery({
    queryKey: ['documents-tous'],
    queryFn: async () => {
      const { data } = await supabase
        .from('documents')
        .select('*, pelerin:pelerins(id, prenom, nom, telephone)')
        .order('date_upload', { ascending: false })
      return data as unknown as DocumentAvecPelerin[]
    },
  })

  const { data: pelerins = [] } = useQuery({
    queryKey: ['pelerins-options'],
    queryFn: async () => {
      const { data } = await supabase.from('pelerins').select('id, prenom, nom').order('nom')
      return data as Array<{ id: string; prenom: string; nom: string }>
    },
  })

  const filtres = useMemo(() => {
    return documents.filter((d) => {
      if (filtreType && d.type_document !== filtreType) return false
      if (filtreStatut && d.statut !== filtreStatut) return false
      if (alerte === 'passeport' && !(d.type_document === 'passeport' && expirantDans(d.date_expiration ?? '', 90))) return false
      return true
    })
  }, [documents, alerte, filtreType, filtreStatut])

  const compteurs = useMemo(
    () => ({
      total: documents.length,
      valides: documents.filter((d) => d.statut === 'valide').length,
      manquants: documents.filter((d) => d.statut === 'manquant').length,
    }),
    [documents]
  )

  const majStatut = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const { error } = await supabase.from('documents').update({ statut }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-tous'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
      queryClient.invalidateQueries({ queryKey: ['pelerin'] })
    },
  })

  const validerSansUpload = useMutation({
    mutationFn: async () => {
      await validerSansFichier(agence!.id, pelerinChoisi, typeSansFichier)
    },
    onSuccess: () => {
      setPelerinChoisi('')
      queryClient.invalidateQueries({ queryKey: ['documents-tous'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins-options'] })
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Gestion des documents</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Suivez les pièces de vos dossiers</p>
        </div>
        <select
          className="input max-w-xs"
          value={filtreType}
          onChange={(e) => {
            setFiltreType(e.target.value)
            if (alerte && e.target.value !== 'passeport') {
              setParams((prev) => {
                const next = new URLSearchParams(prev)
                next.delete('alerte')
                return next
              })
            }
          }}
        >
          <option value="">Tous les types</option>
          {Object.entries(LIBELLES_DOCUMENT).map(([cle, libelle]) => (
            <option key={cle} value={cle}>{libelle}</option>
          ))}
        </select>
        <select className="input max-w-xs" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="manquant">Manquant</option>
          <option value="soumis">Soumis</option>
          <option value="valide">Validé</option>
          <option value="rejete">Rejeté</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
        <select
          className="input max-w-sm"
          value={pelerinChoisi}
          onChange={(e) => setPelerinChoisi(e.target.value)}
          aria-label="Pèlerin"
        >
          <option value="">Choisir un pèlerin</option>
          {pelerins.map((p) => (
            <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
          ))}
        </select>
        <select
          className="input max-w-xs"
          value={typeSansFichier}
          onChange={(e) => setTypeSansFichier(e.target.value)}
          aria-label="Type de document"
        >
          {Object.entries(LIBELLES_DOCUMENT).map(([cle, libelle]) => (
            <option key={cle} value={cle}>{libelle}</option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          disabled={!pelerinChoisi || validerSansUpload.isPending}
          onClick={() => validerSansUpload.mutate()}
        >
          <Icon name="verified" size={18} className="mr-2" />
          Valider sans fichier
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Documents" valeur={compteurs.total} icon="description" />
        <StatCard label="Validés" valeur={compteurs.valides} icon="check_circle" tone="vert" />
        <StatCard label="Manquants" valeur={compteurs.manquants} icon="error" tone="error" />
      </section>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((d) => (
                <tr key={d.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4">
                    <Link to={`/details-du-pelerin/${d.pelerin.id}`} className="font-medium text-primary hover:underline">
                      {d.pelerin.prenom} {d.pelerin.nom}
                    </Link>
                    <p className="text-label-md text-on-surface-variant">{d.pelerin.telephone}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-2">
                      <Icon name={ICONES_DOCUMENT[d.type_document] ?? 'description'} size={18} className="text-on-surface-variant" />
                      {LIBELLES_DOCUMENT[d.type_document]}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={TONE_DOCUMENT[d.statut]}>{LIBELLES_DOC_STATUT[d.statut]}</Badge>
                  </td>
                  <td className="px-4 py-4 text-data-mono text-on-surface-variant">{formatDate(d.date_expiration)}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {d.statut !== 'valide' && (
                        <button
                          onClick={() => majStatut.mutate({ id: d.id, statut: 'valide' })}
                          title="Valider"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-vert"
                        >
                          <Icon name="check_circle" size={18} />
                        </button>
                      )}
                      {d.statut === 'soumis' && (
                        <button
                          onClick={() => majStatut.mutate({ id: d.id, statut: 'rejete' })}
                          title="Rejeter"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"
                        >
                          <Icon name="error" size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtres.length === 0 && <EmptyState message="Aucun document pour ce filtre." />}
        </div>
      </div>
    </div>
  )
}