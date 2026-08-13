import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Signup() {
  const [params] = useSearchParams()
  const inviteToken = params.get('invite')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setEnCours(true)
    setErreur('')
    const meta: Record<string, string> = { nom }
    if (inviteToken) meta.invite_token = inviteToken
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: meta },
    })
    setEnCours(false)
    if (error) {
      setErreur(error.message)
      return
    }
    setMessage('Compte créé. Vous pouvez vous connecter.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-8">
        <h1 className="text-headline mb-6 text-navy">Créer un compte</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label mb-1 block" htmlFor="nom">Nom complet</label>
            <input id="nom" required value={nom} onChange={(e) => setNom(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="label mb-1 block" htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="label mb-1 block" htmlFor="password">Mot de passe</label>
            <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" />
          </div>
          {inviteToken && (
            <p className="text-sm text-gold">Invitation détectée : votre agence vous sera rattachée automatiquement.</p>
          )}
          {message && <p className="text-sm text-green-700">{message}</p>}
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <button type="submit" disabled={enCours} className="btn-primary w-full">
            {enCours ? 'Création…' : 'Créer le compte'}
          </button>
        </form>
        <p className="mt-4 text-sm">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-navy underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}