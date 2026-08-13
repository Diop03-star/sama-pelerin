import type { ReactNode } from 'react'

const TONES: Record<string, string> = {
  rouge: 'bg-red-50 text-error border border-red-200',
  ambre: 'bg-amber-50 text-ambre border border-amber-200',
  vert: 'bg-green-50 text-vert border border-green-200',
  neutre: 'bg-gray-100 text-gray-600 border border-gray-200',
}

export default function Badge({ tone = 'neutre', children }: { tone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone] ?? TONES.neutre}`}>
      {children}
    </span>
  )
}
