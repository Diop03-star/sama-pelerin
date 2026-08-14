import type { ReactNode } from 'react'
import Icon from './Icon'
import { formatFCFA } from '../../lib/format'

interface StatCardProps {
  label: string
  valeur: ReactNode
  icon: string
  tone?: 'primary' | 'gold' | 'vert' | 'error'
  tendance?: { texte: string; positif?: boolean; suffixe?: string }
  grande?: boolean
  monetaire?: boolean
  actions?: ReactNode
}

const TONES: Record<string, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  gold: 'bg-secondary-container text-on-secondary-container',
  vert: 'bg-green-50 text-green-700',
  error: 'bg-error-container text-on-error-container',
}

function decoupeFCFA(texte: string): { montant: string; unite: string } {
  const idx = texte.lastIndexOf(' FCFA')
  return { montant: texte.slice(0, idx), unite: texte.slice(idx + 1) }
}

export default function StatCard({
  label, valeur, icon, tone = 'primary', tendance, grande = false, monetaire = false, actions,
}: StatCardProps) {
  const pieces = monetaire && typeof valeur === 'number' ? decoupeFCFA(formatFCFA(valeur)) : null
  const suffixeTendance = tendance?.suffixe ?? 'cette semaine'
  return (
    <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="pointer-events-none absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-primary/5" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant">{label}</p>
          <h3 className={`mt-2 text-on-surface ${grande ? (monetaire ? 'text-headline-md' : 'text-display-lg') : 'text-headline-md'}`}>
            {pieces ? (
              <span className="flex flex-wrap items-baseline gap-x-1 whitespace-nowrap tabular-nums">
                {pieces.montant}
                <span className="text-body-md text-on-surface-variant">{pieces.unite}</span>
              </span>
            ) : (
              valeur
            )}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${TONES[tone]}`}>
            <Icon name={icon} size={24} />
          </div>
        </div>
      </div>
      {tendance && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className={`flex items-center rounded-md px-2 py-1 text-label-md ${tendance.positif === false ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            <Icon name={tendance.positif === false ? 'trending_down' : 'trending_up'} size={16} className="mr-1" />
            {tendance.texte}
          </span>
          {suffixeTendance && <span className="text-body-md text-on-surface-variant">{suffixeTendance}</span>}
        </div>
      )}
    </div>
  )
}