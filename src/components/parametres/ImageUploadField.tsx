import { useEffect, useState } from 'react'
import { validerImageAgence } from '../../lib/agenceImages'

interface ImageUploadFieldProps {
  label: string
  value: string | null
  disabled?: boolean
  onChange: (fichier: File | null) => void
}

export default function ImageUploadField({ label, value, disabled = false, onChange }: ImageUploadFieldProps) {
  const [apercuLocal, setApercuLocal] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const id = `image-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  useEffect(() => () => {
    if (apercuLocal) URL.revokeObjectURL(apercuLocal)
  }, [apercuLocal])

  function choisirFichier(fichier: File | null) {
    setErreur('')
    if (!fichier) {
      setApercuLocal(null)
      onChange(null)
      return
    }

    const erreurValidation = validerImageAgence(fichier)
    if (erreurValidation) {
      setErreur(erreurValidation)
      setApercuLocal(null)
      onChange(null)
      return
    }

    setApercuLocal(URL.createObjectURL(fichier))
    onChange(fichier)
  }

  return (
    <div>
      <label htmlFor={id} className="label mb-2 block">{label}</label>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-outline-variant p-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline-variant bg-surface-container text-center text-xs text-on-surface-variant">
          {apercuLocal || value
            ? <img src={apercuLocal ?? value ?? undefined} alt={`Aperçu : ${label}`} className="h-full w-full object-contain" />
            : 'Aucune image'}
        </div>
        <div className="min-w-0 flex-1">
          <input
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={disabled}
            aria-describedby={erreur ? `${id}-erreur` : undefined}
            onChange={(event) => {
              choisirFichier(event.currentTarget.files?.[0] ?? null)
              event.currentTarget.value = ''
            }}
            className="block w-full text-sm text-on-surface-variant file:mr-3 file:rounded-lg file:border-0 file:bg-primary-container file:px-3 file:py-2 file:font-medium file:text-on-primary-container"
          />
          <p className="mt-2 text-sm text-on-surface-variant">PNG, JPEG ou WebP, 5 Mo maximum.</p>
          {apercuLocal && <button type="button" disabled={disabled} onClick={() => choisirFichier(null)} className="mt-2 text-sm text-primary underline">Annuler le changement</button>}
        </div>
      </div>
      {erreur && <p id={`${id}-erreur`} role="alert" className="mt-2 text-sm text-error">{erreur}</p>}
    </div>
  )
}
