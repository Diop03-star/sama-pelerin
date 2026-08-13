import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useProfil } from '../hooks/useAgence'
import Card from '../components/ui/Card'
import { Field, Input } from '../components/ui/Field'
import Button from '../components/ui/Button'

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
    const { data: agence, error: e1 } = await supabase
      .from('agences')
      .insert({ nom, telephone, adresse })
      .select('id')
      .single()
    if (e1 || !agence) {
      setErreur('Impossible de créer l’agence.')
      setEnCours(false)
      return
    }
    const { error: e2 } = await supabase
      .from('utilisateurs')
      .update({ agence_id: agence.id, role: 'gerant' })
      .eq('user_id', profil!.user_id)
    setEnCours(false)
    if (e2) {
      setErreur('Agence créée mais rattachement impossible. Rechargez la page.')
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['profil'] })
    await queryClient.invalidateQueries({ queryKey: ['agence'] })
    navigate('/tableau-de-bord')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-lg p-8">
        <h1 className="text-headline mb-2 text-navy">Créer votre agence</h1>
        <p className="mb-6 text-sm text-gray-600">
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
      </Card>
    </div>
  )
}
