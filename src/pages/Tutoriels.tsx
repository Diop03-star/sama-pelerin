import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tutos } from '../lib/types'
import EmptyState from '../components/ui/EmptyState'
import CarteTuto from '../components/vitrine/CarteTuto'

export default function Tutoriels() {
  const { data: tutos = [] } = useQuery({
    queryKey: ['tutos-publics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tutos')
        .select('*')
        .eq('actif', true)
        .order('ordre', { ascending: true })
      return data as Tutos[]
    },
  })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-display-lg text-primary">Tutoriels</h1>
      <p className="mt-2 text-body-lg text-on-surface-variant">
        Apprenez à utiliser Stitch Sama Pèlerin, étape par étape.
      </p>
      {tutos.length === 0 ? (
        <div className="mt-8 rounded-xl border border-outline-variant bg-surface-container-lowest p-8">
          <EmptyState message="Aucun tutoriel pour le moment." />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tutos.map((t) => (
            <CarteTuto key={t.id} tuto={t} />
          ))}
        </div>
      )}
    </div>
  )
}