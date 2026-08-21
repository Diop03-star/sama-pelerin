import type { Tutos } from '../../lib/types'
import { extraireIdYoutube, lienYoutube, miniatureYoutube } from '../../lib/youtube'

export default function CarteTuto({ tuto }: { tuto: Tutos }) {
  const id = extraireIdYoutube(tuto.url_youtube)
  if (!id) return null
  return (
    <a
      href={lienYoutube(id)}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm transition-all hover:shadow-md"
    >
      <img src={miniatureYoutube(id)} alt={tuto.titre} loading="lazy" className="aspect-video w-full object-cover" />
      <div className="p-4">
        <h2 className="text-headline-sm font-bold text-primary">{tuto.titre}</h2>
        {tuto.description && <p className="mt-1 text-body-md text-on-surface-variant">{tuto.description}</p>}
      </div>
    </a>
  )
}