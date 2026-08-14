import { Link } from 'react-router-dom'
import Icon from './Icon'

interface AlertLinkProps {
  tone: 'rouge' | 'gold'
  titre: string
  description: string
  icon: string
  to: string
}

const STYLES = {
  rouge: {
    bande: 'border-error',
    fond: 'bg-error-container/20 hover:bg-error-container/40',
    icone: 'bg-error/10 text-error',
    texte: 'text-error',
    fleche: 'text-error',
  },
  gold: {
    bande: 'border-secondary',
    fond: 'bg-secondary-container/20 hover:bg-secondary-container/40',
    icone: 'bg-secondary/10 text-secondary',
    texte: 'text-secondary',
    fleche: 'text-secondary',
  },
}

export default function AlertLink({ tone, titre, description, icon, to }: AlertLinkProps) {
  const s = STYLES[tone]
  return (
    <Link to={to} className={`group relative block overflow-hidden rounded-r-lg border-l-4 p-4 transition-colors ${s.bande} ${s.fond}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded-full p-2 ${s.icone}`}>
          <Icon name={icon} fill size={20} />
        </div>
        <div>
          <p className={`text-headline-sm ${s.texte}`}>{titre}</p>
          <p className="text-body-md mt-1 text-on-surface-variant">{description}</p>
        </div>
      </div>
      <Icon
        name="arrow_forward"
        size={20}
        className={`absolute right-4 top-4 translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 ${s.fleche}`}
      />
    </Link>
  )
}
