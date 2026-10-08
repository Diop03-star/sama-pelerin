import { useEffect, useState, type FormEvent } from 'react'
import type { Agence } from '../../lib/types'
import { Field, Input } from '../ui/Field'
import Button from '../ui/Button'
import ImageUploadField from './ImageUploadField'

export interface ChampsAgence {
  nom: string
  telephone: string
  email: string | null
  adresse: string | null
}

interface AgenceSettingsSectionProps {
  agence: Agence
  logoUrl: string | null
  isSaving: boolean
  message: string
  erreur: string
  onSave: (champs: ChampsAgence, logo: File | null) => Promise<string>
}

export default function AgenceSettingsSection({ agence, logoUrl, isSaving, message, erreur, onSave }: AgenceSettingsSectionProps) {
  const [champs, setChamps] = useState<ChampsAgence>({
    nom: agence.nom,
    telephone: agence.telephone,
    email: agence.email ?? '',
    adresse: agence.adresse ?? '',
  })
  const [logo, setLogo] = useState<File | null>(null)

  useEffect(() => {
    setChamps({ nom: agence.nom, telephone: agence.telephone, email: agence.email ?? '', adresse: agence.adresse ?? '' })
  }, [agence.id, agence.nom, agence.telephone, agence.email, agence.adresse])

  async function soumettre(event: FormEvent) {
    event.preventDefault()
    try {
      await onSave({
        ...champs,
        nom: champs.nom.trim(),
        telephone: champs.telephone.trim(),
        email: champs.email?.trim() || null,
        adresse: champs.adresse?.trim() || null,
      }, logo)
      setLogo(null)
    } catch {
      // The parent mutation displays the error and keeps this form's selected values.
    }
  }

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-headline-sm font-semibold text-primary">Informations de l’agence</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Mettez à jour les coordonnées et l’identité visuelle de votre agence.</p>
      </div>
      <form onSubmit={soumettre} className="space-y-4">
        <Field label="Nom de l’agence" htmlFor="parametres-agence-nom">
          <Input id="parametres-agence-nom" required maxLength={120} value={champs.nom} onChange={(e) => setChamps({ ...champs, nom: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Téléphone" htmlFor="parametres-agence-telephone">
            <Input id="parametres-agence-telephone" type="tel" maxLength={40} value={champs.telephone} onChange={(e) => setChamps({ ...champs, telephone: e.target.value })} />
          </Field>
          <Field label="Email de contact" htmlFor="parametres-agence-email">
            <Input id="parametres-agence-email" type="email" maxLength={254} value={champs.email ?? ''} onChange={(e) => setChamps({ ...champs, email: e.target.value })} />
          </Field>
        </div>
        <Field label="Adresse" htmlFor="parametres-agence-adresse">
          <Input id="parametres-agence-adresse" maxLength={250} value={champs.adresse ?? ''} onChange={(e) => setChamps({ ...champs, adresse: e.target.value })} />
        </Field>
        <ImageUploadField key={logoUrl ?? 'sans-logo'} label="Logo de l’agence" value={logoUrl} disabled={isSaving} onChange={setLogo} />
        {erreur && <p role="alert" className="text-sm text-error">{erreur}</p>}
        {message && <p role="status" className="text-sm text-vert">{message}</p>}
        <div className="flex justify-end border-t border-outline-variant pt-4">
          <Button type="submit" disabled={isSaving || !champs.nom.trim()}>{isSaving ? 'Enregistrement…' : 'Enregistrer les informations'}</Button>
        </div>
      </form>
    </section>
  )
}
