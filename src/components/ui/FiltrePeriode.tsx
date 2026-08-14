import type { Periode } from '../../lib/dates'
import { LIBELLES_PERIODE } from '../../lib/dates'

interface FiltrePeriodeProps {
  periode: Periode
  onChange: (periode: Periode) => void
}

const ORDRE: Periode[] = ['jour', 'semaine', 'mois', 'annee']

export default function FiltrePeriode({ periode, onChange }: FiltrePeriodeProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-outline-variant bg-surface-container-lowest p-1"
      role="group"
      aria-label="Filtrer par période"
    >
      {ORDRE.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-md px-3 py-1.5 text-label-md transition-colors ${
            p === periode
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
          }`}
        >
          {LIBELLES_PERIODE[p]}
        </button>
      ))}
    </div>
  )
}
