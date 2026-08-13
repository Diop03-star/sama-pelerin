import { useRef, type ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAgence } from '../../hooks/useAgence'
import { LIBELLES_DOCUMENT, TONE_DOCUMENT, formatDate } from '../../lib/format'
import type { Document } from '../../lib/types'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'

const TYPES_DOCUMENT = ['passeport', 'visa', 'certificat_vaccination', 'photo', 'autre'] as const

export default function DocumentSection({ pelerinId }: { pelerinId: string }) {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const typeChoisi = useRef<string>('passeport')

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

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-sm font-semibold text-navy">Documents du dossier</h2>
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
        <input ref={inputRef} type="file" hidden onChange={onChangeFichier} />
        <Button type="button" variant="secondary" disabled={televerser.isPending} onClick={() => inputRef.current?.click()}>
          {televerser.isPending ? 'Upload…' : 'Téléverser un fichier'}
        </Button>
      </div>

      {documents.length === 0 && <EmptyState message="Aucun document pour ce pèlerin." />}
      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-navy">{LIBELLES_DOCUMENT[doc.type_document]}</p>
              <p className="text-xs text-gray-500">
                {doc.fichier_url ? 'Fichier joint' : 'Aucun fichier'} · Expire le {formatDate(doc.date_expiration)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={TONE_DOCUMENT[doc.statut]}>{doc.statut}</Badge>
              {doc.fichier_url && (
                <button onClick={() => voirFichier(doc)} className="text-xs text-navy hover:underline">Voir</button>
              )}
              {doc.statut !== 'valide' && (
                <button
                  onClick={() => majStatut.mutate({ id: doc.id, statut: 'valide' })}
                  className="text-xs text-green-700 hover:underline"
                >
                  Valider
                </button>
              )}
              {doc.statut === 'soumis' && (
                <button
                  onClick={() => majStatut.mutate({ id: doc.id, statut: 'rejete' })}
                  className="text-xs text-error hover:underline"
                >
                  Rejeter
                </button>
              )}
              <button onClick={() => supprimer.mutate(doc)} className="text-xs text-gray-400 hover:text-error">Suppr.</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}