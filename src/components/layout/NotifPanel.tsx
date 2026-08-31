import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import useDropdown from '../../hooks/useDropdown'
import { LIBELLES_DOCUMENT, LIBELLES_RAPPEL, TONE_RAPPEL, formatDate, formatFCFA } from '../../lib/format'
import type { Document, Pelerin, Rappel, Tranche } from '../../lib/types'
import Icon from '../ui/Icon'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'

interface RappelAvecPelerin extends Rappel {
  tranche: (Tranche & { plan_paiement: { pelerin: Pelerin } }) | null
  document: (Document & { pelerin: Pelerin }) | null
}

export default function NotifPanel() {
  const navigate = useNavigate()
  const { ref, ouvert, basculer, fermer } = useDropdown()

  const { data: rappels = [], error } = useQuery({
    queryKey: ['notifications-rappels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rappels')
        .select('id, statut_envoi, date_envoi_prevue, tranche:tranches(numero_tranche, montant_prevu, date_echeance, plan_paiement:plans_paiement(pelerin:pelerins(*))), document:documents(type_document, statut, pelerin:pelerins(*))')
        .in('statut_envoi', ['en_attente', 'echec'])
        .order('date_envoi_prevue', { ascending: true })
        .limit(10)
      if (error) throw error
      return (data as unknown as RappelAvecPelerin[]) ?? []
    },
  })

  function pelerinDe(r: RappelAvecPelerin): Pelerin | null {
    return r.tranche?.plan_paiement?.pelerin ?? r.document?.pelerin ?? null
  }

  function libelleDe(r: RappelAvecPelerin): string {
    if (r.tranche) return `Tranche ${r.tranche.numero_tranche} · ${formatFCFA(r.tranche.montant_prevu)}`
    if (r.document) return `Document · ${LIBELLES_DOCUMENT[r.document.type_document] ?? r.document.type_document}`
    return 'Rappel'
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={basculer}
        className="relative rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low"
      >
        <Icon name="notifications" size={20} />
        {rappels.length > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
            {rappels.length}
          </span>
        )}
      </button>
      {ouvert && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-md">
          <p className="border-b border-outline-variant px-4 py-2 text-label-md font-bold text-primary">Notifications</p>
          {error ? (
            <EmptyState message="Impossible de charger les notifications" />
          ) : rappels.length === 0 ? (
            <EmptyState message="Aucune notification" />
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {rappels.map((r) => {
                const p = pelerinDe(r)
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        fermer()
                        if (p) navigate(`/details-du-pelerin/${p.id}`)
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-container-low"
                    >
                      <span>
                        <span className="block text-body-md font-medium text-on-surface">{p ? `${p.prenom} ${p.nom}` : 'Pèlerin'}</span>
                        <span className="block text-label-md text-on-surface-variant">{libelleDe(r)} · {formatDate(r.date_envoi_prevue)}</span>
                      </span>
                      <Badge tone={TONE_RAPPEL[r.statut_envoi]}>{LIBELLES_RAPPEL[r.statut_envoi]}</Badge>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}