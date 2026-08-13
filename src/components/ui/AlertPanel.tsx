import type { ReactNode } from 'react'

const TONES: Record<string, string> = {
  rouge: 'border-red-500 bg-red-50',
  ambre: 'border-amber-500 bg-amber-50',
  vert: 'border-green-500 bg-green-50',
}

export default function AlertPanel({ tone = 'ambre', title, children }: { tone?: string; title: string; children: ReactNode }) {
  return (
    <div className={`border-l-4 ${TONES[tone] ?? TONES.ambre} rounded-md p-4`}>
      <p className="text-sm font-semibold text-navy">{title}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}
