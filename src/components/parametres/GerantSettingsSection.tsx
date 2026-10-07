import { useEffect, useState, type FormEvent } from 'react'
import type { Utilisateur } from '../../lib/types'
import { Field, Input } from '../ui/Field'
import Button from '../ui/Button'
import ImageUploadField from './ImageUploadField'

export interface ChampsProfilGerant {
  nom: string
  telephone: string
}

export interface ChampsMotDePasse {
  actuel: string
  nouveau: string
}

interface GerantSettingsSectionProps {
  profil: Utilisateur
  avatarUrl: string | null
  isSavingProfil: boolean
  messageProfil: string
  erreurProfil: string
  isSavingAvatar: boolean
  messageAvatar: string
  erreurAvatar: string
  isChangingPassword: boolean
  messagePassword: string
  erreurPassword: string
  onSaveProfil: (champs: ChampsProfilGerant) => Promise<void>
  onSaveAvatar: (fichier: File) => Promise<string>
  onChangePassword: (champs: ChampsMotDePasse) => Promise<void>
}

export default function GerantSettingsSection(props: GerantSettingsSectionProps) {
  const [profil, setProfil] = useState<ChampsProfilGerant>({ nom: props.profil.nom, telephone: props.profil.telephone })
  const [avatar, setAvatar] = useState<File | null>(null)
  const [motDePasseActuel, setMotDePasseActuel] = useState('')
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreurLocale, setErreurLocale] = useState('')

  useEffect(() => {
    setProfil({ nom: props.profil.nom, telephone: props.profil.telephone })
  }, [props.profil.id, props.profil.nom, props.profil.telephone])

  async function sauvegarderProfil(event: FormEvent) {
    event.preventDefault()
    try {
      await props.onSaveProfil({ nom: profil.nom.trim(), telephone: profil.telephone.trim() })
    } catch {
      // The parent mutation keeps and displays the save error.
    }
  }

  async function sauvegarderAvatar() {
    if (!avatar) return
    try {
      await props.onSaveAvatar(avatar)
      setAvatar(null)
    } catch {
      // The parent mutation keeps the selected file available for retry.
    }
  }

  async function changerMotDePasse(event: FormEvent) {
    event.preventDefault()
    setErreurLocale('')
    if (nouveauMotDePasse.length < 8) {
      setErreurLocale('Le nouveau mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (nouveauMotDePasse !== confirmation) {
      setErreurLocale('La confirmation ne correspond pas au nouveau mot de passe.')
      return
    }
    try {
      await props.onChangePassword({ actuel: motDePasseActuel, nouveau: nouveauMotDePasse })
      setMotDePasseActuel('')
      setNouveauMotDePasse('')
      setConfirmation('')
    } catch {
      // The parent mutation keeps and displays the authentication error.
    }
  }

  return (
    <section className="space-y-6 rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-headline-sm font-semibold text-primary">Compte du gérant</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Modifiez votre profil personnel et vos identifiants de connexion.</p>
      </div>

      <form onSubmit={sauvegarderProfil} className="space-y-4">
        <h3 className="font-semibold text-on-surface">Profil personnel</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet" htmlFor="parametres-gerant-nom">
            <Input id="parametres-gerant-nom" required maxLength={120} value={profil.nom} onChange={(e) => setProfil({ ...profil, nom: e.target.value })} />
          </Field>
          <Field label="Téléphone" htmlFor="parametres-gerant-telephone">
            <Input id="parametres-gerant-telephone" type="tel" maxLength={40} value={profil.telephone} onChange={(e) => setProfil({ ...profil, telephone: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={props.isSavingProfil || !profil.nom.trim()}>{props.isSavingProfil ? 'Enregistrement…' : 'Enregistrer le profil'}</Button>
        </div>
        {props.erreurProfil && <p role="alert" className="text-sm text-error">{props.erreurProfil}</p>}
        {props.messageProfil && <p role="status" className="text-sm text-vert">{props.messageProfil}</p>}
      </form>

      <div className="border-t border-outline-variant pt-5">
        <h3 className="mb-3 font-semibold text-on-surface">Photo de profil</h3>
        <ImageUploadField key={props.avatarUrl ?? 'sans-photo'} label="Photo du gérant" value={props.avatarUrl} disabled={props.isSavingAvatar} onChange={setAvatar} />
        {props.erreurAvatar && <p role="alert" className="mt-3 text-sm text-error">{props.erreurAvatar}</p>}
        {props.messageAvatar && <p role="status" className="mt-3 text-sm text-vert">{props.messageAvatar}</p>}
        <div className="mt-3 flex justify-end">
          <Button type="button" disabled={props.isSavingAvatar || !avatar} onClick={sauvegarderAvatar}>{props.isSavingAvatar ? 'Enregistrement…' : 'Enregistrer la photo'}</Button>
        </div>
      </div>

      <form onSubmit={changerMotDePasse} className="space-y-4 border-t border-outline-variant pt-5">
        <div>
          <h3 className="font-semibold text-on-surface">Mot de passe</h3>
          <p className="mt-1 text-sm text-on-surface-variant">Confirmez votre mot de passe actuel avant de le remplacer.</p>
        </div>
        <Field label="Mot de passe actuel" htmlFor="parametres-password-actuel">
          <Input id="parametres-password-actuel" type="password" autoComplete="current-password" required value={motDePasseActuel} onChange={(e) => setMotDePasseActuel(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nouveau mot de passe" htmlFor="parametres-password-nouveau">
            <Input id="parametres-password-nouveau" type="password" autoComplete="new-password" minLength={8} required value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)} />
          </Field>
          <Field label="Confirmer le nouveau mot de passe" htmlFor="parametres-password-confirmation">
            <Input id="parametres-password-confirmation" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </Field>
        </div>
        {erreurLocale && <p role="alert" className="text-sm text-error">{erreurLocale}</p>}
        {props.erreurPassword && <p role="alert" className="text-sm text-error">{props.erreurPassword}</p>}
        {props.messagePassword && <p role="status" className="text-sm text-vert">{props.messagePassword}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={props.isChangingPassword || !motDePasseActuel || !nouveauMotDePasse || !confirmation}>{props.isChangingPassword ? 'Modification…' : 'Modifier le mot de passe'}</Button>
        </div>
      </form>
    </section>
  )
}
