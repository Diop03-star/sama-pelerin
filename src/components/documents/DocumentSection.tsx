import { useState, useRef, type ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAgence } from '../../hooks/useAgence'
import { LIBELLES_DOCUMENT, LIBELLES_DOC_STATUT, formatDate } from '../../lib/format'
import { validerSansFichier, type MetadonneesDocument } from '../../lib/documents'
import ModifierDocumentModal from './ModifierDocumentModal'
import type { Document } from '../../lib/types'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import EmptyState from '../ui/EmptyState'

const TYPES_DOCUMENT = ['passeport', 'visa', 'certificat_vaccination', 'photo', 'autre'] as const

const ICONES_DOCUMENT: Record<string, string> = {
  passeport: 'badge',
  visa: 'flight',
  certificat_vaccination: 'medical_information',
  photo: 'photo_camera',
  autre: 'description',
}

const TINTE_DOCUMENT: Record<string, string> = {
  valide: 'bg-green-50 text-green-700',
  soumis: 'bg-amber-50 text-ambre',
  manquant: 'bg-red-50 text-error',
  rejete: 'bg-red-50 text-error',
}

const CHIP_DOCUMENT: Record<string, string> = {
  valide: 'bg-green-100 text-green-800 border-green-200',
  soumis: 'bg-amber-100 text-ambre border-amber-200',
  manquant: 'bg-red-100 text-error border-red-200',
  rejete: 'bg-red-100 text-error border-red-200',
}

export default function DocumentSection({ pelerinId }: { pelerinId: string }) {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const typeChoisi = useRef<string>('passeport')

  const [dateExpiration, setDateExpiration] = useState('')
  const [numeroDocument, setNumeroDocument] = useState('')
  const [docEnEdition, setDocEnEdition] = useState<Document | null>(null)

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', pelerinId],
    enabled: !!pelerinId,
    queryFn: async () => {
      const { data } = await supabase.from('documents').select('*').eq('pelerin_id', pelerinId).order('type_document')
      return data as Document[]
    },
  })

  const majStatut = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const { error } = await supabase.from('documents').update({ statut }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerin', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
  })

  const supprimer = useMutation({
    mutationFn: async (doc: Document) => {
      if (doc.fichier_url) {
        await supabase.storage.from('documents_pelerins').remove([doc.fichier_url])
      }
      const { error } = await supabase.from('documents').delete().eq('id', doc.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerin', pelerinId] })
    },
  })

  const televerser = useMutation({
    mutationFn: async ({ fichier, typeDocument }: { fichier: File; typeDocument: string }) => {
      const chemin = `${agence!.id}/${pelerinId}/${Date.now()}-${fichier.name}`
      const { error: eUpload } = await supabase.storage
        .from('documents_pelerins')
        .upload(chemin, fichier)
      if (eUpload) throw eUpload
      const { error: eInsert } = await supabase.from('documents').upsert(
        {
          agence_id: agence!.id,
          pelerin_id: pelerinId,
          type_document: typeDocument,
          fichier_url: chemin,
          statut: 'soumis',
          date_upload: new Date().toISOString(),
        },
        { onConflict: 'pelerin_id,type_document' }
      )
      if (eInsert) throw eInsert
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerin', pelerinId] })
    },
  })

  const majSansFichier = useMutation({
    mutationFn: async () => {
      const metadonnees: MetadonneesDocument = {}
      if (dateExpiration) metadonnees.date_expiration = dateExpiration
      if (numeroDocument) metadonnees.numero_document = numeroDocument
      await validerSansFichier(agence!.id, pelerinId, typeChoisi.current, metadonnees)
    },
    onSuccess: () => {
      setDateExpiration('')
      setNumeroDocument('')
      queryClient.invalidateQueries({ queryKey: ['documents', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerin', pelerinId] })
    },
  })

  async function voirFichier(doc: Document) {
    if (!doc.fichier_url) return
    const { data } = await supabase.storage
      .from('documents_pelerins')
      .createSignedUrl(doc.fichier_url, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function onChangeFichier(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (fichier) televerser.mutate({ fichier, typeDocument: typeChoisi.current })
    e.target.value = ''
  }

  const valides = documents.filter((d) => d.statut === 'valide').length

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="folder_open" size={20} className="text-primary" />
          <h4 className="text-headline-sm text-primary">Documents Requis</h4>
        </div>
        <span className="rounded-md bg-surface-container px-2 py-1 text-label-md text-on-surface-variant">
          {valides}/{documents.length} Validés
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className="input max-w-xs"
          defaultValue="passeport"
          onChange={(e) => { typeChoisi.current = e.target.value }}
          aria-label="Type de document"
        >
          {TYPES_DOCUMENT.map((t) => (
            <option key={t} value={t}>{LIBELLES_DOCUMENT[t]}</option>
          ))}
        </select>
        <input
          type="date"
          className="input w-auto"
          aria-label="Date d’expiration"
          value={dateExpiration}
          onChange={(e) => setDateExpiration(e.target.value)}
        />
        <input
          type="text"
          className="input w-44"
          placeholder="N° de document"
          aria-label="Numéro de document"
          value={numeroDocument}
          onChange={(e) => setNumeroDocument(e.target.value)}
        />
        <input ref={inputRef} type="file" hidden onChange={onChangeFichier} />
        <Button type="button" variant="secondary" disabled={televerser.isPending} onClick={() => inputRef.current?.click()}>
          <Icon name="upload_file" size={18} className="mr-2" />
          {televerser.isPending ? 'Upload…' : 'Téléverser un fichier'}
        </Button>
        <Button type="button" variant="secondary" disabled={majSansFichier.isPending} onClick={() => majSansFichier.mutate()}>
          <Icon name="verified" size={18} className="mr-2" />
          Valider sans fichier
        </Button>
      </div>

      {documents.length === 0 && <EmptyState message="Aucun document pour ce pèlerin." />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-start gap-4 rounded-lg border border-outline-variant p-4 transition-colors hover:bg-surface-container-low">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded ${TINTE_DOCUMENT[doc.statut] ?? 'bg-surface-container text-on-surface-variant'}`}>
              <Icon name={ICONES_DOCUMENT[doc.type_document] ?? 'description'} size={20} />
            </div>
            <div className="flex-1">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h5 className="text-body-md font-bold text-on-surface">{LIBELLES_DOCUMENT[doc.type_document]}</h5>
                <span className={`rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${CHIP_DOCUMENT[doc.statut] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {LIBELLES_DOC_STATUT[doc.statut]}
                </span>
              </div>
              <p className="text-label-md mb-2 text-on-surface-variant">
                {doc.fichier_url ? 'Fichier joint' : 'Aucun fichier'}
                {doc.numero_document ? ` · N° ${doc.numero_document}` : ''} · Expire le {formatDate(doc.date_expiration)}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                {doc.fichier_url && (
                  <button onClick={() => voirFichier(doc)} className="flex items-center gap-1 text-label-md text-primary hover:underline">
                    <Icon name="visibility" size={14} /> Voir
                  </button>
                )}
                {doc.statut !== 'valide' && (
                  <button onClick={() => majStatut.mutate({ id: doc.id, statut: 'valide' })} className="flex items-center gap-1 text-label-md text-vert hover:underline">
                    <Icon name="check_circle" size={14} /> Valider
                  </button>
                )}
                {doc.statut === 'soumis' && (
                  <button onClick={() => majStatut.mutate({ id: doc.id, statut: 'rejete' })} className="flex items-center gap-1 text-label-md text-error hover:underline">
                    <Icon name="error" size={14} /> Rejeter
                  </button>
                )}
                <button
                  onClick={() => setDocEnEdition(doc)}
                  aria-label="Modifier"
                  title="Modifier"
                  className="rounded-lg p-1 text-gray-400 hover:text-primary"
                >
                  <Icon name="edit" size={16} />
                </button>
                <button onClick={() => supprimer.mutate(doc)} title="Supprimer" className="rounded-lg p-1 text-gray-400 hover:text-error">
                  <Icon name="delete" size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {docEnEdition && (
        <ModifierDocumentModal
          doc={docEnEdition}
          open
          onClose={() => setDocEnEdition(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['documents', pelerinId] })
            queryClient.invalidateQueries({ queryKey: ['pelerin', pelerinId] })
          }}
        />
      )}
    </div>
  )
}
