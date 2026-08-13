import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useProfil } from '../hooks/useAgence'
import Card from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import type { Invitation, Utilisateur } from '../lib/types'

export default function Membres() {
  const { data: profil } = useProfil()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'gerant' | 'agent'>('agent')
  const [lienInvitation, setLienInvitation] = useState('')
  const [erreur, setErreur] = useState('')

  const { data: membres = [] } = useQuery({
    queryKey: ['membres'],
    enabled: !!profil?.agence_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('agence_id', profil!.agence_id!)
        .order('nom')
      return data as Utilisateur[]
    },
  })

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    enabled: !!profil?.agence_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('invitations')
        .select('*')
        .eq('agence_id', profil!.agence_id!)
        .order('created_at', { ascending: false })
      return data as Invitation[]
    },
  })

  const inviter = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID()
      const { error } = await supabase.from('invitations').insert({
        agence_id: profil!.agence_id!,
        email,
        role,
        token,
        created_by: profil!.id,
      })
      if (error) throw error
      return token
    },
    onSuccess: (token) => {
      setLienInvitation(`${window.location.origin}/signup?invite=${token}`)
      setEmail('')
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
    },
    onError: () => setErreur('Impossible de créer l’invitation.'),
  })

  const supprimer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('utilisateurs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['membres'] }),
  })

  const supprimerInvitation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invitations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    inviter.mutate()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-headline text-navy">Membres</h1>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-navy">Inviter un membre</h2>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
          <div className="min-w-64 flex-1">
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <div className="w-40">
            <Field label="Rôle">
              <Select value={role} onChange={(e) => setRole(e.target.value as 'gerant' | 'agent')}>
                <option value="agent">Agent</option>
                <option value="gerant">Gérant</option>
              </Select>
            </Field>
          </div>
          <Button type="submit" disabled={inviter.isPending}>Générer le lien</Button>
        </form>
        {erreur && <p className="mt-2 text-sm text-error">{erreur}</p>}
        {lienInvitation && (
          <div className="mt-4 rounded-md border border-gold bg-gold-container/30 p-3">
            <p className="mb-1 text-sm font-semibold text-navy">Lien d’invitation à partager (WhatsApp, email…) :</p>
            <p className="break-all text-sm text-navy">{lienInvitation}</p>
            <button
              type="button"
              className="btn-secondary mt-2 text-xs"
              onClick={() => navigator.clipboard.writeText(lienInvitation)}
            >
              Copier le lien
            </button>
          </div>
        )}
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-navy">{m.nom}</td>
                  <td className="px-4 py-3">{m.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={m.role === 'gerant' ? 'ambre' : 'neutre'}>{m.role === 'gerant' ? 'Gérant' : 'Agent'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.user_id !== profil?.user_id && (
                      <button
                        onClick={() => supprimer.mutate(m.id)}
                        className="text-xs text-error hover:underline"
                      >
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {membres.length === 0 && <EmptyState message="Aucun membre pour le moment." />}
        </div>
      </Card>

      {invitations.filter((i) => !i.used_at).length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Email invité</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Expire le</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invitations.filter((i) => !i.used_at).map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-4 py-3">{i.email}</td>
                    <td className="px-4 py-3">{i.role === 'gerant' ? 'Gérant' : 'Agent'}</td>
                    <td className="px-4 py-3">{new Date(i.expires_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => supprimerInvitation.mutate(i.id)} className="text-xs text-error hover:underline">
                        Annuler
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}