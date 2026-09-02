import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useProfil } from '../hooks/useAgence'
import { Field, Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import logo from '../assets/logo-sama-pelerin.png'

export default function Onboarding() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: profil, isLoading } = useProfil()
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [adresse, setAdresse] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  if (isLoading) return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  if (!profil) return <Navigate to="/login" replace />
  if (profil.agence_id) return <Navigate to="/tableau-de-bord" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setEnCours(true)
    setErreur('')
    const { error: e1 } = await supabase.rpc('creer_agence', {
      p_nom: nom,
      p_telephone: telephone,
      p_adresse: adresse,
    })
    if (e1) {
      setErreur('Impossible de créer l’agence.')
      setEnCours(false)
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['profil'] })
    await queryClient.invalidateQueries({ queryKey: ['agence'] })
    navigate('/tableau-de-bord')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
        <h1 className="mb-6">
          <img src={logo} alt="SamaPèlerin" className="h-12 w-auto" />
        </h1>
        <h2 className="text-headline-md mb-2 text-primary">Créer votre agence</h2>
        <p className="text-body-md mb-6 text-on-surface-variant">
          Bienvenue {profil.nom}. Renseignez les informations de votre agence pour commencer.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nom de l’agence">
            <Input required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Al Hidjah Travel Dakar" />
          </Field>
          <Field label="Téléphone">
            <Input required value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+221 77 XXX XX XX" />
          </Field>
          <Field label="Adresse">
            <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Dakar, Sénégal" />
          </Field>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <Button type="submit" disabled={enCours} className="w-full">
            {enCours ? 'Création…' : 'Créer mon agence'}
          </Button>
        </form>
      </div>
    </div>
  )
}