import { useAgence, useProfil } from '../hooks/useAgence'
import { formatDate } from '../lib/format'

export default function Profil() {
  const { data: profil, isLoading } = useProfil()
  const { data: agence } = useAgence()

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }

  if (!profil) {
    return <div className="flex h-screen items-center justify-center text-error">Profil introuvable.</div>
  }

  const roleLibelle =
    profil.role === 'gerant' ? 'Gérant' : profil.role === 'superadmin' ? 'Super admin' : 'Agent'

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 border-b border-outline-variant pb-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-outline-variant bg-primary-container text-headline-md font-bold text-on-primary-container">
            {profil.nom?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <h1 className="text-headline-sm font-bold text-primary">{profil.nom}</h1>
          <p className="text-label-md text-on-surface-variant">{roleLibelle}</p>
        </div>
        <dl className="space-y-4 pt-4">
          <div>
            <dt className="label text-on-surface-variant">Email</dt>
            <dd className="text-body-md text-on-surface">{profil.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="label text-on-surface-variant">Téléphone</dt>
            <dd className="text-body-md text-on-surface">{profil.telephone || '—'}</dd>
          </div>
          <div>
            <dt className="label text-on-surface-variant">Agence</dt>
            <dd className="text-body-md text-on-surface">{agence?.nom ?? '—'}</dd>
          </div>
          <div>
            <dt className="label text-on-surface-variant">Membre depuis</dt>
            <dd className="text-body-md text-on-surface">{formatDate(profil.created_at)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}