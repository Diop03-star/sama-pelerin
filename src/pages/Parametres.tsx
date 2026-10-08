import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAgence, useProfil } from '../hooks/useAgence'
import type { ProfilGerant } from '../lib/types'
import { obtenirUrlImageAgence, supprimerImageAgence, uploadImageAgence } from '../lib/agenceImages'
import type { ChampsAgence } from '../components/parametres/AgenceSettingsSection'
import AgenceSettingsSection from '../components/parametres/AgenceSettingsSection'
import type { ChampsMotDePasse, ChampsProfilGerant } from '../components/parametres/GerantSettingsSection'
import GerantSettingsSection from '../components/parametres/GerantSettingsSection'

interface MiseAJourAgence {
  champs: ChampsAgence
  logo: File | null
}

function messageErreur(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function Parametres() {
  const queryClient = useQueryClient()
  const { data: profil, isLoading: profilEnChargement } = useProfil()
  const { data: agence, isLoading: agenceEnChargement } = useAgence()
  const [messageAgence, setMessageAgence] = useState('')
  const [erreurAgence, setErreurAgence] = useState('')
  const [messageProfil, setMessageProfil] = useState('')
  const [erreurProfil, setErreurProfil] = useState('')
  const [messageAvatar, setMessageAvatar] = useState('')
  const [erreurAvatar, setErreurAvatar] = useState('')
  const [messagePassword, setMessagePassword] = useState('')
  const [erreurPassword, setErreurPassword] = useState('')

  const avatarQuery = useQuery({
    queryKey: ['profil-gerant-photo', profil?.id],
    enabled: !!profil?.id && profil.role === 'gerant',
    queryFn: async (): Promise<ProfilGerant | null> => {
      const { data, error } = await supabase
        .from('profils_gerants')
        .select('utilisateur_id, avatar_url')
        .eq('utilisateur_id', profil!.id)
        .maybeSingle()
      if (error) throw error
      return data as ProfilGerant | null
    },
  })

  const logoUrlQuery = useQuery({
    queryKey: ['agence-logo', agence?.id, agence?.logo_url],
    enabled: !!agence?.logo_url,
    queryFn: () => obtenirUrlImageAgence(agence!.logo_url),
  })

  const avatarUrlQuery = useQuery({
    queryKey: ['agence-image-profil', avatarQuery.data?.avatar_url],
    enabled: !!avatarQuery.data?.avatar_url,
    queryFn: () => obtenirUrlImageAgence(avatarQuery.data?.avatar_url),
  })

  const sauverAgence = useMutation({
    mutationFn: async ({ champs, logo }: MiseAJourAgence) => {
      if (!agence) throw new Error('Agence introuvable.')
      let nouveauChemin: string | null = null
      if (logo) {
        if (!profil?.user_id) throw new Error('Compte gérant introuvable.')
        nouveauChemin = await uploadImageAgence({ agenceId: agence.id, utilisateurId: profil.user_id, type: 'logo', fichier: logo })
      }

      const { data: agenceModifiee, error } = await supabase.from('agences').update({
        nom: champs.nom,
        telephone: champs.telephone,
        email: champs.email,
        adresse: champs.adresse,
        ...(nouveauChemin ? { logo_url: nouveauChemin } : {}),
      }).eq('id', agence.id).select('id').maybeSingle()

      if (error || !agenceModifiee) {
        if (nouveauChemin) await supprimerImageAgence(nouveauChemin).catch(() => undefined)
        throw new Error('Impossible d’enregistrer les informations de l’agence.')
      }

      if (nouveauChemin && agence.logo_url && agence.logo_url !== nouveauChemin) {
        try {
          await supprimerImageAgence(agence.logo_url)
        } catch {
          return 'Informations enregistrées. L’ancien logo n’a pas pu être supprimé.'
        }
      }
      return 'Informations de l’agence enregistrées.'
    },
    onMutate: () => { setErreurAgence(''); setMessageAgence('') },
    onSuccess: async (message) => {
      setMessageAgence(message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['agence'] }),
        queryClient.invalidateQueries({ queryKey: ['agence-logo'] }),
      ])
    },
    onError: (error) => setErreurAgence(messageErreur(error, 'Une erreur est survenue pendant la sauvegarde.')),
  })

  const sauverProfil = useMutation({
    mutationFn: async (champs: ChampsProfilGerant) => {
      if (!profil) throw new Error('Profil gérant introuvable.')
      const { data: profilModifie, error } = await supabase.from('utilisateurs').update({ nom: champs.nom, telephone: champs.telephone }).eq('id', profil.id).select('id').maybeSingle()
      if (error || !profilModifie) throw new Error('Impossible d’enregistrer votre profil.')
    },
    onMutate: () => { setErreurProfil(''); setMessageProfil('') },
    onSuccess: async () => {
      setMessageProfil('Profil enregistré.')
      await queryClient.invalidateQueries({ queryKey: ['profil'] })
    },
    onError: (error) => setErreurProfil(messageErreur(error, 'Une erreur est survenue pendant la sauvegarde.')),
  })

  const sauverAvatar = useMutation({
    mutationFn: async (fichier: File) => {
      if (!agence || !profil?.id || !profil.user_id) throw new Error('Profil gérant introuvable.')
      const nouveauChemin = await uploadImageAgence({ agenceId: agence.id, utilisateurId: profil.user_id, type: 'profil', fichier })
      const ancienChemin = avatarQuery.data?.avatar_url ?? null
      const { data: profilPhoto, error } = await supabase.from('profils_gerants').upsert({ utilisateur_id: profil.id, avatar_url: nouveauChemin }, { onConflict: 'utilisateur_id' }).select('utilisateur_id').maybeSingle()
      if (error || !profilPhoto) {
        await supprimerImageAgence(nouveauChemin).catch(() => undefined)
        throw new Error('Impossible d’enregistrer la photo du gérant.')
      }
      if (ancienChemin && ancienChemin !== nouveauChemin) {
        try {
          await supprimerImageAgence(ancienChemin)
        } catch {
          return 'Photo enregistrée. L’ancienne photo n’a pas pu être supprimée.'
        }
      }
      return 'Photo de profil enregistrée.'
    },
    onMutate: () => { setErreurAvatar(''); setMessageAvatar('') },
    onSuccess: async (message) => {
      setMessageAvatar(message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profil-gerant-photo', profil?.id] }),
        queryClient.invalidateQueries({ queryKey: ['agence-image-profil'] }),
      ])
    },
    onError: (error) => setErreurAvatar(messageErreur(error, 'Une erreur est survenue pendant la sauvegarde.')),
  })

  const changerMotDePasse = useMutation({
    mutationFn: async ({ actuel, nouveau }: ChampsMotDePasse) => {
      const { data: { user }, error: erreurUtilisateur } = await supabase.auth.getUser()
      if (erreurUtilisateur || !user?.email) throw new Error('Impossible de vérifier le compte gérant.')

      const { error: erreurVerification } = await supabase.auth.signInWithPassword({ email: user.email, password: actuel })
      if (erreurVerification) throw new Error('Le mot de passe actuel est incorrect ou n’a pas pu être vérifié.')

      const { error } = await supabase.auth.updateUser({ password: nouveau })
      if (error) throw new Error('Impossible de modifier le mot de passe.')
    },
    onMutate: () => { setErreurPassword(''); setMessagePassword('') },
    onSuccess: () => setMessagePassword('Mot de passe modifié.'),
    onError: (error) => setErreurPassword(messageErreur(error, 'Une erreur est survenue pendant le changement de mot de passe.')),
  })

  if (profilEnChargement || agenceEnChargement || avatarQuery.isLoading) {
    return <div className="flex min-h-64 items-center justify-center text-on-surface-variant">Chargement des paramètres…</div>
  }
  if (!profil || profil.role !== 'gerant' || !agence) {
    return <div role="alert" className="text-error">Impossible de charger les paramètres de l’agence.</div>
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-display-lg text-on-surface">Paramètres</h1>
        <p className="mt-1 text-body-lg text-on-surface-variant">Gérez les informations de votre agence et votre compte gérant.</p>
      </header>
      {(avatarQuery.error || logoUrlQuery.error || avatarUrlQuery.error) && <p role="alert" className="rounded-lg border border-error/30 bg-error-container px-4 py-3 text-sm text-error">Certaines images enregistrées n’ont pas pu être chargées. Vérifiez votre connexion et actualisez la page.</p>}
      <AgenceSettingsSection
        agence={agence}
        logoUrl={logoUrlQuery.data ?? null}
        isSaving={sauverAgence.isPending}
        message={messageAgence}
        erreur={erreurAgence}
        onSave={(champs, logo) => sauverAgence.mutateAsync({ champs, logo })}
      />
      <GerantSettingsSection
        profil={profil}
        avatarUrl={avatarUrlQuery.data ?? null}
        isSavingProfil={sauverProfil.isPending}
        messageProfil={messageProfil}
        erreurProfil={erreurProfil}
        isSavingAvatar={sauverAvatar.isPending}
        messageAvatar={messageAvatar}
        erreurAvatar={erreurAvatar}
        isChangingPassword={changerMotDePasse.isPending}
        messagePassword={messagePassword}
        erreurPassword={erreurPassword}
        onSaveProfil={(champs) => sauverProfil.mutateAsync(champs)}
        onSaveAvatar={(fichier) => sauverAvatar.mutateAsync(fichier)}
        onChangePassword={(champs) => changerMotDePasse.mutateAsync(champs)}
      />
    </div>
  )
}
