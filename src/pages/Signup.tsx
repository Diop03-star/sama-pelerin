import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo-sama-pelerin.png'

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
    setMessage('Compte créé. Confirmez votre email pour activer votre compte, puis connectez-vous.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
        <h1 className="mb-6">
          <img src={logo} alt="SamaPèlerin" className="h-12 w-auto" />
        </h1>
        <h2 className="text-headline-md mb-6 text-primary">Créer un compte</h2>
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
          <Link to="/login" className="text-primary underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}