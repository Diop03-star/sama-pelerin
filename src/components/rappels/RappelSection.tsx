import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAgence } from '../../hooks/useAgence'
import {
  LIBELLES_DOCUMENT, LIBELLES_RAPPEL, TONE_RAPPEL,
  formatDate, formatFCFA, messageDocument, messageTranche, whatsappUrl,
} from '../../lib/format'
import type { Document, Rappel, Tranche } from '../../lib/types'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'

interface RappelAvecCible extends Rappel {
  tranche: (Tranche & { plan_paiement: { pelerin_id: string; montant_total: number } }) | null
  document: (Document & { pelerin_id: string }) | null
}

export default function RappelSection({ pelerinId }: { pelerinId: string }) {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()

  const { data: pelerin } = useQuery({
    queryKey: ['pelerin', pelerinId],
    queryFn: async () => {
      const { data } = await supabase.from('pelerins').select('*').eq('id', pelerinId).single()
      return data as { id: string; prenom: string; nom: string; telephone: string }
    },
  })

  const { data: tranches = [] } = useQuery({
    queryKey: ['tranches-sans-plan', pelerinId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tranches')
        .select('*, plan_paiement:plans_paiement!inner(montant_total)')
        .eq('plan_paiement.pelerin_id', pelerinId)
      return data as unknown as (Tranche & { plan_paiement: { montant_total: number } })[]
    },
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', pelerinId],
    queryFn: async () => {
      const { data } = await supabase.from('documents').select('*').eq('pelerin_id', pelerinId)
      return data as Document[]
    },
  })

  const { data: rappels = [] } = useQuery({
    queryKey: ['rappels', pelerinId],
    queryFn: async () => {
      const { data } = await supabase
        .from('rappels')
        .select('*, tranche:tranches(plan_paiement:plans_paiement(pelerin_id, montant_total)), document:documents(*)')
        .order('date_envoi_prevue', { ascending: false })
      const tous = (data as unknown as RappelAvecCible[]) ?? []
      return tous.filter((r) => {
        const pelerinTranche = r.tranche?.plan_paiement?.pelerin_id
        const pelerinDocument = r.document?.pelerin_id
        return pelerinTranche === pelerinId || pelerinDocument === pelerinId
      })
    },
  })

  const creerRappel = useMutation({
    mutationFn: async (cible: { trancheId?: string; documentId?: string }) => {
      const { error } = await supabase.from('rappels').insert({
        agence_id: agence!.id,
        tranche_id: cible.trancheId ?? null,
        document_id: cible.documentId ?? null,
        canal: 'whatsapp',
        date_envoi_prevue: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rappels', pelerinId] }),
  })

  const majStatutRappel = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const { error } = await supabase
        .from('rappels')
        .update({
          statut_envoi: statut,
          date_envoi_reelle: statut === 'envoye' ? new Date().toISOString() : null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rappels', pelerinId] }),
  })

  function messagePour(r: RappelAvecCible): string {
    if (!pelerin) return ''
    if (r.tranche) {
      return messageTranche(pelerin.prenom, pelerin.nom, r.tranche.numero_tranche, r.tranche.montant_prevu, r.tranche.date_echeance)
    }
    if (r.document) {
      return messageDocument(pelerin.prenom, pelerin.nom, r.document.type_document, r.document.statut)
    }
    return ''
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-sm font-semibold text-navy">Rappels WhatsApp</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {tranches.filter((t) => t.statut !== 'payee').map((t) => (
          <Button
            key={t.id}
            variant="secondary"
            disabled={creerRappel.isPending}
            onClick={() => creerRappel.mutate({ trancheId: t.id })}
          >
            Rappel tranche {t.numero_tranche} ({formatFCFA(t.montant_prevu)})
          </Button>
        ))}
        {documents.filter((d) => d.statut !== 'valide').map((d) => (
          <Button
            key={d.id}
            variant="secondary"
            disabled={creerRappel.isPending}
            onClick={() => creerRappel.mutate({ documentId: d.id })}
          >
            Rappel {LIBELLES_DOCUMENT[d.type_document]}
          </Button>
        ))}
      </div>

      {rappels.length === 0 && <EmptyState message="Aucun rappel pour ce pèlerin." />}
      <div className="space-y-2">
        {rappels.map((r) => {
          const libelle = r.tranche
            ? `Tranche ${r.tranche.numero_tranche} — ${formatFCFA(r.tranche.montant_prevu)}`
            : r.document
              ? LIBELLES_DOCUMENT[r.document.type_document]
              : '—'
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-navy">{libelle}</p>
                <p className="text-xs text-gray-500">Prévu le {formatDate(r.date_envoi_prevue)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={TONE_RAPPEL[r.statut_envoi]}>{LIBELLES_RAPPEL[r.statut_envoi]}</Badge>
                {pelerin && r.statut_envoi !== 'envoye' && (
                  <a
                    href={whatsappUrl(pelerin.telephone, messagePour(r))}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary text-xs"
                  >
                    Envoyer sur WhatsApp
                  </a>
                )}
                {r.statut_envoi === 'en_attente' && (
                  <button
                    onClick={() => majStatutRappel.mutate({ id: r.id, statut: 'envoye' })}
                    className="text-xs text-green-700 hover:underline"
                  >
                    Marquer envoyé
                  </button>
                )}
                {r.statut_envoi !== 'echec' && r.statut_envoi !== 'envoye' && (
                  <button
                    onClick={() => majStatutRappel.mutate({ id: r.id, statut: 'echec' })}
                    className="text-xs text-error hover:underline"
                  >
                    Échec
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}