import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tutos } from '../lib/types'
import { extraireIdYoutube, lienYoutube } from '../lib/youtube'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { Field, Input, Select } from '../components/ui/Field'
import Icon from '../components/ui/Icon'

interface FormulaireTuto {
  id: string | null
  titre: string
  description: string
  url_youtube: string
  ordre: number
  actif: boolean
}

const FORMULAIRE_VIDE: FormulaireTuto = { id: null, titre: '', description: '', url_youtube: '', ordre: 0, actif: true }

export default function SuperAdminTutos() {
  const queryClient = useQueryClient()
  const [formOuvert, setFormOuvert] = useState(false)
  const [form, setForm] = useState<FormulaireTuto>(FORMULAIRE_VIDE)
  const [erreur, setErreur] = useState('')
  const [aSupprimer, setASupprimer] = useState<Tutos | null>(null)

  const { data: tutos = [] } = useQuery({
    queryKey: ['superadmin-tutos'],
    queryFn: async () => {
      const { data } = await supabase.from('tutos').select('*').order('ordre', { ascending: true })
      return data as Tutos[]
    },
  })

  const sauvegarder = useMutation({
    mutationFn: async () => {
      if (!extraireIdYoutube(form.url_youtube)) throw new Error('url_invalide')
      const valeurs = {
        titre: form.titre,
        description: form.description || null,
        url_youtube: form.url_youtube,
        ordre: form.ordre,
        actif: form.actif,
      }
      const { error } = form.id
        ? await supabase.from('tutos').update(valeurs).eq('id', form.id)
        : await supabase.from('tutos').insert(valeurs)
      if (error) throw error
    },
    onSuccess: () => {
      setFormOuvert(false)
      setForm(FORMULAIRE_VIDE)
      setErreur('')
      queryClient.invalidateQueries({ queryKey: ['superadmin-tutos'] })
    },
    onError: (err: Error) =>
      setErreur(err.message === 'url_invalide' ? 'URL YouTube invalide.' : 'Impossible d’enregistrer la vidéo.'),
  })

  const supprimer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tutos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setASupprimer(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-tutos'] })
    },
  })

  function ouvrirAjout() {
    setForm(FORMULAIRE_VIDE)
    setErreur('')
    setFormOuvert(true)
  }

  function ouvrirEdition(t: Tutos) {
    setForm({
      id: t.id,
      titre: t.titre,
      description: t.description ?? '',
      url_youtube: t.url_youtube,
      ordre: t.ordre,
      actif: t.actif,
    })
    setErreur('')
    setFormOuvert(true)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    sauvegarder.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Tutoriels vidéo</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">
            Les vidéos actives sont visibles sur le site vitrine et la page /tutoriels.
          </p>
        </div>
        <Button onClick={ouvrirAjout}>
          <Icon name="add" size={16} className="mr-2" />
          Ajouter une vidéo
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Titre</th>
                <th className="px-4 py-3">Ordre</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Lien</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {tutos.map((t) => {
                const id = extraireIdYoutube(t.url_youtube)
                return (
                  <tr key={t.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                    <td className="px-4 py-4">
                      <p className="font-medium text-on-surface">{t.titre}</p>
                      {t.description && <p className="text-sm text-on-surface-variant">{t.description}</p>}
                    </td>
                    <td className="px-4 py-4">{t.ordre}</td>
                    <td className="px-4 py-4">
                      {t.actif ? <Badge tone="vert">Active</Badge> : <Badge tone="neutre">Inactive</Badge>}
                    </td>
                    <td className="px-4 py-4">
                      {id ? (
                        <a href={lienYoutube(id)} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
                          Voir la vidéo
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => ouvrirEdition(t)}
                          title="Modifier"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"
                        >
                          <Icon name="edit" size={18} />
                        </button>
                        <button
                          onClick={() => setASupprimer(t)}
                          title="Supprimer"
                          className="rounded-lg p-2 text-error hover:bg-surface-container"
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {tutos.length === 0 && <EmptyState message="Aucune vidéo. Ajoutez votre premier tutoriel." />}
        </div>
      </div>

      <Modal open={formOuvert} title={form.id ? 'Modifier la vidéo' : 'Ajouter une vidéo'} onClose={() => setFormOuvert(false)}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Titre">
            <Input required value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea
              className="input w-full"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="URL YouTube">
            <Input
              required
              placeholder="https://www.youtube.com/watch?v=…"
              value={form.url_youtube}
              onChange={(e) => setForm({ ...form, url_youtube: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ordre d’affichage">
              <Input
                type="number"
                value={form.ordre}
                onChange={(e) => setForm({ ...form, ordre: Number(e.target.value) })}
              />
            </Field>
            <Field label="Visible sur le site">
              <Select value={form.actif ? 'oui' : 'non'} onChange={(e) => setForm({ ...form, actif: e.target.value === 'oui' })}>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </Select>
            </Field>
          </div>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOuvert(false)}>Annuler</Button>
            <Button type="submit" disabled={sauvegarder.isPending}>Enregistrer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!aSupprimer} title="Supprimer la vidéo" onClose={() => setASupprimer(null)}>
        <p className="text-body-md text-on-surface-variant">
          Supprimer « {aSupprimer?.titre} » ? Elle disparaîtra du site vitrine et de la page /tutoriels.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setASupprimer(null)}>Annuler</Button>
          <Button
            type="button"
            variant="danger"
            disabled={supprimer.isPending}
            onClick={() => aSupprimer && supprimer.mutate(aSupprimer.id)}
          >
            Confirmer
          </Button>
        </div>
      </Modal>
    </div>
  )
}