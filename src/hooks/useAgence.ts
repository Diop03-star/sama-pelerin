import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Agence, Utilisateur } from '../lib/types'

export function useProfil() {
  return useQuery({
    queryKey: ['profil'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      return data as Utilisateur | null
    },
  })
}

export function useAgence() {
  const { data: profil } = useProfil()
  return useQuery({
    queryKey: ['agence', profil?.agence_id],
    enabled: !!profil?.agence_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('agences')
        .select('*')
        .eq('id', profil!.agence_id!)
        .single()
      return data as Agence
    },
  })
}
