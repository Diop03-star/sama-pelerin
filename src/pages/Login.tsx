import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import logo from '../assets/logo-sama-pelerin.png'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setEnCours(true)
    setErreur('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setEnCours(false)
    if (error) {
      setErreur('Email ou mot de passe incorrect.')
      return
    }
    navigate('/tableau-de-bord')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
        <h1 className="mb-6">
          <img src={logo} alt="SamaPèlerin" className="h-20 w-auto" />
        </h1>
        <h2 className="text-headline-md mb-6 text-primary">Se connecter</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label mb-1 block" htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="label mb-1 block" htmlFor="password">Mot de passe</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" />
          </div>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <button type="submit" disabled={enCours} className="btn-primary w-full">
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <p className="mt-4 text-sm">
          Pas encore de compte ?{' '}
          <Link to="/signup" className="text-primary underline">Créer un compte</Link>
        </p>
      </div>
    </div>
  )
}