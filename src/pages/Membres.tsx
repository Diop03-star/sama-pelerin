import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useProfil } from '../hooks/useAgence'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Membres</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Gérez votre équipe et vos invitations</p>
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="person_add" size={20} className="text-primary" />
          <h2 className="text-headline-sm text-primary">Inviter un membre</h2>
        </div>
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
          <div className="mt-4 rounded-md border border-secondary bg-secondary-container/20 p-3">
            <p className="mb-1 text-sm font-semibold text-navy">Lien d’invitation à partager (WhatsApp, email…) :</p>
            <p className="break-all text-sm text-navy">{lienInvitation}</p>
            <button type="button" className="btn-secondary mt-2 text-xs" onClick={() => navigator.clipboard.writeText(lienInvitation)}>
              Copier le lien
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => (
                <tr key={m.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4 font-medium text-primary">{m.nom}</td>
                  <td className="px-4 py-4">{m.email}</td>
                  <td className="px-4 py-4">
                    <Badge tone={m.role === 'gerant' ? 'ambre' : 'neutre'}>{m.role === 'gerant' ? 'Gérant' : 'Agent'}</Badge>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {m.user_id !== profil?.user_id && (
                      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => supprimer.mutate(m.id)}
                          title="Retirer"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {membres.length === 0 && <EmptyState message="Aucun membre pour le moment." />}
        </div>
      </div>

      {invitations.filter((i) => !i.used_at).length > 0 && (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-body-md">
              <thead>
                <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                  <th className="px-4 py-3">Email invité</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Expire le</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invitations.filter((i) => !i.used_at).map((i) => (
                  <tr key={i.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                    <td className="px-4 py-4">{i.email}</td>
                    <td className="px-4 py-4">{i.role === 'gerant' ? 'Gérant' : 'Agent'}</td>
                    <td className="px-4 py-4">{new Date(i.expires_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => supprimerInvitation.mutate(i.id)}
                          title="Annuler"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"
                        >
                          <Icon name="close" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}