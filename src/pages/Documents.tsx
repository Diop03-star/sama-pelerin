import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_DOCUMENT, TONE_DOCUMENT, formatDate } from '../lib/format'
import type { Document } from '../lib/types'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

interface DocumentAvecPelerin extends Document {
  pelerin: { id: string; prenom: string; nom: string; telephone: string }
}

export default function Documents() {
  const queryClient = useQueryClient()
  const [filtre, setFiltre] = useState('')

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

  const filtres = filtre ? documents.filter((d) => d.statut === filtre) : documents

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-headline text-navy">Gestion des documents</h1>
        <select className="input max-w-xs" value={filtre} onChange={(e) => setFiltre(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="manquant">Manquant</option>
          <option value="soumis">Soumis</option>
          <option value="valide">Validé</option>
          <option value="rejete">Rejeté</option>
        </select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link to={`/details-du-pelerin/${d.pelerin.id}`} className="font-medium text-navy hover:underline">
                      {d.pelerin.prenom} {d.pelerin.nom}
                    </Link>
                    <p className="text-xs text-gray-500">{d.pelerin.telephone}</p>
                  </td>
                  <td className="px-4 py-3">{LIBELLES_DOCUMENT[d.type_document]}</td>
                  <td className="px-4 py-3">
                    <Badge tone={TONE_DOCUMENT[d.statut]}>{d.statut}</Badge>
                  </td>
                  <td className="px-4 py-3">{formatDate(d.date_expiration)}</td>
                  <td className="px-4 py-3 text-right">
                    {d.statut !== 'valide' && (
                      <button
                        onClick={() => majStatut.mutate({ id: d.id, statut: 'valide' })}
                        className="mr-3 text-xs text-green-700 hover:underline"
                      >
                        Valider
                      </button>
                    )}
                    {d.statut === 'soumis' && (
                      <button
                        onClick={() => majStatut.mutate({ id: d.id, statut: 'rejete' })}
                        className="text-xs text-error hover:underline"
                      >
                        Rejeter
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtres.length === 0 && <EmptyState message="Aucun document pour ce filtre." />}
        </div>
      </Card>
    </div>
  )
}