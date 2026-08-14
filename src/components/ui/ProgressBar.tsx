interface ProgressBarProps {
  valeur: number
  tone?: 'gold' | 'vert' | 'primary'
  label?: string
  className?: string
}

const TONES: Record<string, string> = {
  gold: 'bg-secondary-fixed-dim',
  vert: 'bg-green-600',
  primary: 'bg-primary',
}

export default function ProgressBar({ valeur, tone = 'gold', label, className = '' }: ProgressBarProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
        <div className={`h-full rounded-full ${TONES[tone]}`} style={{ width: `${Math.min(100, Math.max(0, valeur))}%` }} />
      </div>
      {label && <span className="text-data-mono text-on-surface-variant">{label}</span>}
    </div>
  )
}
