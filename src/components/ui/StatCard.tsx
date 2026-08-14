import type { ReactNode } from 'react'
import Icon from './Icon'

interface StatCardProps {
  label: string
  valeur: ReactNode
  icon: string
  tone?: 'primary' | 'gold' | 'vert' | 'error'
  tendance?: { texte: string; positif?: boolean }
}

const TONES: Record<string, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  gold: 'bg-secondary-container text-on-secondary-container',
  vert: 'bg-green-50 text-green-700',
  error: 'bg-error-container text-on-error-container',
}

export default function StatCard({ label, valeur, icon, tone = 'primary', tendance }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="pointer-events-none absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-primary/5" />
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant">{label}</p>
          <h3 className="text-display-lg mt-2 text-on-surface">{valeur}</h3>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <Icon name={icon} size={24} />
        </div>
      </div>
      {tendance && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className={`flex items-center rounded-md px-2 py-1 text-label-md ${tendance.positif === false ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            <Icon name={tendance.positif === false ? 'trending_down' : 'trending_up'} size={16} className="mr-1" />
            {tendance.texte}
          </span>
          <span className="text-body-md text-on-surface-variant">cette semaine</span>
        </div>
      )}
    </div>
  )
}
