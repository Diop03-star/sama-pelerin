# Valider un document sans téléverser — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au gérant/agent de valider un document de dossier pèlerin au statut « validé » sans téléverser de fichier (agences sans scanner), depuis la fiche pèlerin et la page Gestion des documents.

**Architecture:** Une fonction partagée `validerSansFichier` dans `src/lib/documents.ts` fait l'upsert au statut `valide` sans `fichier_url` (le upsert `onConflict: 'pelerin_id,type_document'` ne touche que les colonnes fournies → un fichier existant est préservé). Deux mutations `useMutation` l'utilisent : un bouton dans `DocumentSection.tsx`, un formulaire (select pèlerin + select type) dans `Documents.tsx`. Aucun changement SQL ni schéma.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind 4, @tanstack/react-query, Supabase, Vitest + Testing Library.

## Global Constraints

- Texte UI en français, apostrophes typographiques (ex. « Valider sans fichier », « Choisir un pèlerin »).
- Le upsert ne doit JAMAIS fournir `fichier_url` (champ absent de l'objet → préservé par `onConflict`).
- Statut écrit : `'valide'` ; `date_upload` : `new Date().toISOString()`.
- Les tests de `src/lib/documents.test.ts` doivent mocker `./supabase` (le fichier `src/lib/supabase.ts` appelle `import.meta.env` et `createClient` — sans mock, il échoue en test).
- Composants rendant des `Link` → wrapper `MemoryRouter` dans les tests.
- Vérifications : `npm test`, `npm run lint`, `npm run build`.

---

### Task 1: Fonction `validerSansFichier` + tests

**Files:**
- Modify: `src/lib/documents.ts`
- Modify: `src/lib/documents.test.ts`

**Interfaces:**
- Produces: `export async function validerSansFichier(agenceId: string, pelerinId: string, typeDocument: string): Promise<void>` — throw si erreur Supabase. Consommée par Tasks 2 et 3.

- [ ] **Step 1: Écrire le test qui échoue**

Replace `src/lib/documents.test.ts` with:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { expirantDans, validerSansFichier } from './documents'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('./supabase', () => ({ supabase: mockSupabase }))

describe('expirantDans', () => {
  const reference = new Date('2026-08-14T10:00:00')

  it('vrai si l’expiration tombe dans la fenêtre', () => {
    expect(expirantDans('2026-10-01', 90, reference)).toBe(true)
  })

  it('vrai si l’expiration tombe exactement sur la borne de la fenêtre (inclusif)', () => {
    const reference = new Date('2026-08-14T10:00:00')
    expect(expirantDans('2026-11-12', 90, reference)).toBe(true)
  })

  it('faux si l’expiration dépasse la fenêtre', () => {
    expect(expirantDans('2027-01-01', 90, reference)).toBe(false)
  })

  it('faux si le document est déjà expiré', () => {
    expect(expirantDans('2026-07-01', 90, reference)).toBe(false)
  })

  it('faux pour une date invalide', () => {
    expect(expirantDans('pas-une-date', 90, reference)).toBe(false)
  })
})

describe('validerSansFichier', () => {
  const upsert = vi.fn()

  beforeEach(() => {
    upsert.mockReset()
    upsert.mockResolvedValue({ error: null })
    mockSupabase.from.mockReset()
    mockSupabase.from.mockReturnValue({ upsert })
  })

  it('crée la ligne au statut valide sans fichier_url', async () => {
    await validerSansFichier('ag1', 'pel1', 'passeport')
    expect(mockSupabase.from).toHaveBeenCalledWith('documents')
    const [ligne, options] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({
      agence_id: 'ag1',
      pelerin_id: 'pel1',
      type_document: 'passeport',
      statut: 'valide',
    })
    expect(ligne.fichier_url).toBeUndefined()
    expect(options).toEqual({ onConflict: 'pelerin_id,type_document' })
  })

  it('propage une erreur Supabase', async () => {
    upsert.mockResolvedValue({ error: new Error('boom') })
    await expect(validerSansFichier('ag1', 'pel1', 'visa')).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run src/lib/documents.test.ts`
Expected: FAIL — `validerSansFichier` is not exported from `./documents`

- [ ] **Step 3: Implémenter**

Replace the top of `src/lib/documents.ts` and append the function:

```ts
import { supabase } from './supabase'

export function expirantDans(dateExpiration: string, jours: number, reference = new Date()): boolean {
  const exp = new Date(dateExpiration)
  if (Number.isNaN(exp.getTime())) return false
  const debut = new Date(reference)
  debut.setHours(0, 0, 0, 0)
  const fin = new Date(debut)
  fin.setDate(fin.getDate() + jours)
  return exp >= debut && exp <= fin
}

export async function validerSansFichier(agenceId: string, pelerinId: string, typeDocument: string) {
  const { error } = await supabase.from('documents').upsert(
    {
      agence_id: agenceId,
      pelerin_id: pelerinId,
      type_document: typeDocument,
      statut: 'valide',
      date_upload: new Date().toISOString(),
    },
    { onConflict: 'pelerin_id,type_document' }
  )
  if (error) throw error
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run src/lib/documents.test.ts`
Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/documents.ts src/lib/documents.test.ts
git commit -m "feat: fonction validerSansFichier (upsert document valide sans fichier)"
```

---

### Task 2: Bouton « Valider sans fichier » dans la fiche pèlerin

**Files:**
- Modify: `src/components/documents/DocumentSection.tsx`
- Create: `src/components/documents/DocumentSection.test.tsx`

**Interfaces:**
- Consumes: `validerSansFichier(agenceId, pelerinId, typeDocument)` de Task 1, `useAgence()` (`src/hooks/useAgence.ts`), `pelerinId` (prop), `typeChoisi.current` (select type existant).
- Produces: bouton « Valider sans fichier » à côté de « Téléverser un fichier ».

- [ ] **Step 1: Écrire le test qui échoue**

Create `src/components/documents/DocumentSection.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DocumentSection from './DocumentSection'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))
vi.mock('../../hooks/useAgence', () => ({
  useAgence: () => ({ data: { id: 'ag1' } }),
}))

const upsert = vi.fn()

function rendre() {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'documents') {
      return {
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
        upsert,
      }
    }
    return { select: () => Promise.resolve({ data: [], error: null }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DocumentSection pelerinId="pel1" />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  upsert.mockReset()
  upsert.mockResolvedValue({ error: null })
})

describe('DocumentSection', () => {
  it('valide un document sans fichier via le bouton dédié', async () => {
    rendre()
    fireEvent.click(await screen.findByRole('button', { name: 'Valider sans fichier' }))
    await vi.waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('documents')
      expect(upsert).toHaveBeenCalled()
    })
    const [ligne] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({
      agence_id: 'ag1',
      pelerin_id: 'pel1',
      type_document: 'passeport',
      statut: 'valide',
    })
    expect(ligne.fichier_url).toBeUndefined()
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run src/components/documents/DocumentSection.test.tsx`
Expected: FAIL — « Unable to find role "button" with name "Valider sans fichier" »

- [ ] **Step 3: Implémenter**

In `src/components/documents/DocumentSection.tsx`:

1. Add import after line 5 (`import { LIBELLES_DOCUMENT, LIBELLES_DOC_STATUT, formatDate } from '../../lib/format'`):

```tsx
import { validerSansFichier } from '../../lib/documents'
```

2. Add the mutation after `televerser` (after line 100, before `async function voirFichier`):

```tsx
  const majSansFichier = useMutation({
    mutationFn: async () => {
      await validerSansFichier(agence!.id, pelerinId, typeChoisi.current)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerin', pelerinId] })
    },
  })
```

3. Add the button in the toolbar, right after the « Téléverser un fichier » button (after line 145):

```tsx
        <Button type="button" variant="secondary" disabled={majSansFichier.isPending} onClick={() => majSansFichier.mutate()}>
          <Icon name="verified" size={18} className="mr-2" />
          Valider sans fichier
        </Button>
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run src/components/documents/DocumentSection.test.tsx`
Expected: 1 test PASS

- [ ] **Step 5: Suite complète, lint et commit**

Run: `npm test` puis `npm run lint`
Expected: tous les tests passent, oxlint sans erreur.

```bash
git add src/components/documents/DocumentSection.tsx src/components/documents/DocumentSection.test.tsx
git commit -m "feat: bouton valider sans fichier dans la fiche pèlerin"
```

---

### Task 3: Formulaire « Valider sans fichier » dans Gestion des documents

**Files:**
- Modify: `src/pages/Documents.tsx`
- Create: `src/pages/Documents.test.tsx`

**Interfaces:**
- Consumes: `validerSansFichier(agenceId, pelerinId, typeDocument)` de Task 1, `useAgence()` (`src/hooks/useAgence.ts`), `LIBELLES_DOCUMENT` (`src/lib/format.ts`), `Button`/`Icon` (`src/components/ui/`).
- Produces: formulaire select Pèlerin + select Type + bouton « Valider sans fichier » sous la barre des filtres.

- [ ] **Step 1: Écrire le test qui échoue**

Create `src/pages/Documents.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Documents from './Documents'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))
vi.mock('../hooks/useAgence', () => ({
  useAgence: () => ({ data: { id: 'ag1' } }),
}))

const upsert = vi.fn()

function rendre() {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'documents') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
        upsert,
      }
    }
    if (table === 'pelerins') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [{ id: 'p1', prenom: 'Awa', nom: 'Ndiaye' }], error: null }) }),
      }
    }
    return { select: () => Promise.resolve({ data: [], error: null }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Documents />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  upsert.mockReset()
  upsert.mockResolvedValue({ error: null })
})

describe('Documents', () => {
  it('valide un document sans fichier pour le pèlerin choisi', async () => {
    rendre()
    fireEvent.change(await screen.findByLabelText('Pèlerin'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider sans fichier' }))
    await vi.waitFor(() => {
      expect(upsert).toHaveBeenCalled()
    })
    const [ligne] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({ agence_id: 'ag1', pelerin_id: 'p1', statut: 'valide' })
    expect(ligne.fichier_url).toBeUndefined()
  })

  it('désactive le bouton tant qu’aucun pèlerin n’est choisi', async () => {
    rendre()
    expect(await screen.findByRole('button', { name: 'Valider sans fichier' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run src/pages/Documents.test.tsx`
Expected: FAIL — « Unable to find role "button" with name "Valider sans fichier" »

- [ ] **Step 3: Implémenter**

In `src/pages/Documents.tsx`:

1. Add imports after line 6 (`import { expirantDans } from '../lib/documents'`):

```tsx
import { validerSansFichier } from '../lib/documents'
import { useAgence } from '../hooks/useAgence'
```

2. Add state after line 30 (`const [filtreStatut, setFiltreStatut] = useState('')`):

```tsx
  const [pelerinChoisi, setPelerinChoisi] = useState('')
  const [typeSansFichier, setTypeSansFichier] = useState('passeport')
  const { data: agence } = useAgence()
```

3. Add the pelerins query after the `documents` query (after line 41):

```tsx
  const { data: pelerins = [] } = useQuery({
    queryKey: ['pelerins-options'],
    queryFn: async () => {
      const { data } = await supabase.from('pelerins').select('id, prenom, nom').order('nom')
      return data as Array<{ id: string; prenom: string; nom: string }>
    },
  })
```

4. Add the mutation after `majStatut` (after line 71):

```tsx
  const validerSansUpload = useMutation({
    mutationFn: async () => {
      await validerSansFichier(agence!.id, pelerinChoisi, typeSansFichier)
    },
    onSuccess: () => {
      setPelerinChoisi('')
      queryClient.invalidateQueries({ queryKey: ['documents-tous'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins-options'] })
    },
  })
```

5. Add the form after the header block (after line 106, before `<section className="grid grid-cols-1 gap-4 md:grid-cols-3">`):

```tsx
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
        <select
          className="input max-w-sm"
          value={pelerinChoisi}
          onChange={(e) => setPelerinChoisi(e.target.value)}
          aria-label="Pèlerin"
        >
          <option value="">Choisir un pèlerin</option>
          {pelerins.map((p) => (
            <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
          ))}
        </select>
        <select
          className="input max-w-xs"
          value={typeSansFichier}
          onChange={(e) => setTypeSansFichier(e.target.value)}
          aria-label="Type de document"
        >
          {Object.entries(LIBELLES_DOCUMENT).map(([cle, libelle]) => (
            <option key={cle} value={cle}>{libelle}</option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          disabled={!pelerinChoisi || validerSansUpload.isPending}
          onClick={() => validerSansUpload.mutate()}
        >
          <Icon name="verified" size={18} className="mr-2" />
          Valider sans fichier
        </Button>
      </div>
```

6. Add `Button` to the existing imports from `../components/ui/Button` (add after line 8, `import Icon from '../components/ui/Icon'`):

```tsx
import Button from '../components/ui/Button'
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run src/pages/Documents.test.tsx`
Expected: 2 tests PASS

- [ ] **Step 5: Suite complète, lint, build et commit**

Run: `npm test`, `npm run lint`, puis `npm run build`
Expected: tous les tests passent, oxlint sans erreur, `tsc -b` + build vite OK.

```bash
git add src/pages/Documents.tsx src/pages/Documents.test.tsx
git commit -m "feat: formulaire valider sans fichier dans la page documents"
```