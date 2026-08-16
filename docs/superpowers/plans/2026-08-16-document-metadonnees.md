# Métadonnées de document (date d'expiration + numéro) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de renseigner la date d'expiration et le numéro d'un document, à la création (flux « Valider sans fichier ») et en modification des documents existants (modal partagée).

**Architecture:** Fonctions partagées dans `src/lib/documents.ts` (`validerSansFichier` étendue + `majMetadonnees`), un composant modal d'édition réutilisable (`ModifierDocumentModal`) ouvert depuis la fiche pèlerin et la page Gestion des documents, et des champs date + numéro ajoutés aux deux flux « Valider sans fichier ». Une migration SQL ajoute la colonne `numero_document`.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Supabase, @tanstack/react-query 5, vitest + @testing-library/react.

## Global Constraints

- UI et code en français, apostrophes typographiques (`’`) dans les textes affichés.
- `src/lib/supabase.ts` appelle `import.meta.env` + `createClient` → **toujours le mocker** (`vi.mock('.../lib/supabase', () => ({ supabase: mockSupabase }))` avec `mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))`).
- Tests : vitest + testing-library, `QueryClientProvider` autour des composants, `MemoryRouter` pour les pages rendant des `Link`.
- `validerSansFichier` ne doit **jamais** inclure `fichier_url` dans le payload (contrainte existante).
- `input type="date"` produit `YYYY-MM-DD` (compatible colonne `date` SQL). Pas de string vide en base : `''` → clé absente (création) ou `null` (édition).
- Vérifications finales par tâche : `npm test`, `npm run lint` (0 erreur), `npm run build`.

---

### Task 1: Colonne SQL, type Document, fonctions partagées

**Files:**
- Modify: `supabase/schema.sql:61` (après `date_expiration date,`)
- Modify: `src/lib/types.ts:31`
- Modify: `src/lib/documents.ts`
- Test: `src/lib/documents.test.ts`

**Interfaces:**
- Produces :
  - `export interface MetadonneesDocument { date_expiration?: string | null; numero_document?: string | null }` (dans `src/lib/documents.ts`)
  - `export async function validerSansFichier(agenceId: string, pelerinId: string, typeDocument: string, metadonnees?: MetadonneesDocument)` — 4e paramètre optionnel, seules les clés fournies sont ajoutées au payload upsert
  - `export async function majMetadonnees(docId: string, metadonnees: { date_expiration: string | null; numero_document: string | null })` — `update(...).eq('id', docId)`, throw si `error`
  - Type `Document` avec `numero_document: string | null`

- [ ] **Step 1: Migration SQL — `supabase/schema.sql`**

Après la ligne 61 (`date_expiration date,`), insérer :

```sql
  numero_document text,
```

La base live sera migrée par l'utilisateur dans le SQL editor Supabase :

```sql
alter table public.documents add column numero_document text;
```

- [ ] **Step 2: Type `Document` — `src/lib/types.ts`**

Remplacer (ligne 31) :

```ts
  fichier_url: string | null; date_expiration: string | null
```

par :

```ts
  fichier_url: string | null; date_expiration: string | null; numero_document: string | null
```

- [ ] **Step 3: Écrire les tests qui échouent — `src/lib/documents.test.ts`**

Remplacer tout le fichier par :

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { expirantDans, majMetadonnees, validerSansFichier } from './documents'

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

  it('inclut date_expiration et numero_document quand fournis', async () => {
    await validerSansFichier('ag1', 'pel1', 'passeport', {
      date_expiration: '2027-06-15',
      numero_document: 'AB123',
    })
    const [ligne] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({
      date_expiration: '2027-06-15',
      numero_document: 'AB123',
    })
    expect(ligne.fichier_url).toBeUndefined()
  })

  it('ne modifie pas le payload sans métadonnées', async () => {
    await validerSansFichier('ag1', 'pel1', 'visa')
    const [ligne] = upsert.mock.calls[0]
    expect(ligne.date_expiration).toBeUndefined()
    expect(ligne.numero_document).toBeUndefined()
  })
})

describe('majMetadonnees', () => {
  const update = vi.fn()
  const eq = vi.fn()

  beforeEach(() => {
    update.mockReset()
    eq.mockReset()
    update.mockReturnValue({ eq })
    eq.mockResolvedValue({ error: null })
    mockSupabase.from.mockReset()
    mockSupabase.from.mockReturnValue({ update })
  })

  it('met à jour les métadonnées du document', async () => {
    await majMetadonnees('doc1', { date_expiration: '2027-06-15', numero_document: null })
    expect(mockSupabase.from).toHaveBeenCalledWith('documents')
    expect(update).toHaveBeenCalledWith({ date_expiration: '2027-06-15', numero_document: null })
    expect(eq).toHaveBeenCalledWith('id', 'doc1')
  })

  it('propage une erreur Supabase', async () => {
    eq.mockResolvedValue({ error: new Error('boom') })
    await expect(
      majMetadonnees('doc1', { date_expiration: null, numero_document: null })
    ).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 4: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run src/lib/documents.test.ts`
Expected: FAIL sur « include date_expiration » (ligne `majMetadonnees is not defined` / type manquant) et « majMetadonnees » (fonction absente).

- [ ] **Step 5: Implémenter — `src/lib/documents.ts`**

Remplacer tout le fichier par :

```ts
import { supabase } from './supabase'

export interface MetadonneesDocument {
  date_expiration?: string | null
  numero_document?: string | null
}

export function expirantDans(dateExpiration: string, jours: number, reference = new Date()): boolean {
  const exp = new Date(dateExpiration)
  if (Number.isNaN(exp.getTime())) return false
  const debut = new Date(reference)
  debut.setHours(0, 0, 0, 0)
  const fin = new Date(debut)
  fin.setDate(fin.getDate() + jours)
  return exp >= debut && exp <= fin
}

export async function validerSansFichier(
  agenceId: string,
  pelerinId: string,
  typeDocument: string,
  metadonnees?: MetadonneesDocument
) {
  const { error } = await supabase.from('documents').upsert(
    {
      agence_id: agenceId,
      pelerin_id: pelerinId,
      type_document: typeDocument,
      statut: 'valide',
      date_upload: new Date().toISOString(),
      ...metadonnees,
    },
    { onConflict: 'pelerin_id,type_document' }
  )
  if (error) throw error
}

export async function majMetadonnees(
  docId: string,
  metadonnees: { date_expiration: string | null; numero_document: string | null }
) {
  const { error } = await supabase.from('documents').update(metadonnees).eq('id', docId)
  if (error) throw error
}
```

- [ ] **Step 6: Lancer les tests pour vérifier le passage**

Run: `npx vitest run src/lib/documents.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Vérifications globales**

Run: `npm test` (Expected: suite complète PASS), puis `npm run lint` (Expected: 0 erreur).

- [ ] **Step 8: Commit**

```bash
git add supabase/schema.sql src/lib/types.ts src/lib/documents.ts src/lib/documents.test.ts
git commit -m "feat: colonne numero_document + métadonnées document (lib)"
```

---

### Task 2: Modal d'édition partagée

**Files:**
- Create: `src/components/documents/ModifierDocumentModal.tsx`
- Create: `src/components/documents/ModifierDocumentModal.test.tsx`

**Interfaces:**
- Consumes: `majMetadonnees(docId, { date_expiration: string | null; numero_document: string | null })` (Task 1), `Modal` (`src/components/ui/Modal.tsx` : `{ open, title, onClose, children }`), `Button` (`src/components/ui/Button.tsx` : `variant`, `disabled`, `children`), `LIBELLES_DOCUMENT` (`src/lib/format.ts`).
- Produces: `export default function ModifierDocumentModal({ doc, open, onClose, onSaved }: { doc: Document; open: boolean; onClose: () => void; onSaved: () => void })` — la modal fait l'update et appelle `onSaved()` puis `onClose()` en succès ; affiche le message d'erreur en échec. Les parents ne la montent que si `doc` est non nul.

- [ ] **Step 1: Écrire les tests qui échouent — `src/components/documents/ModifierDocumentModal.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ModifierDocumentModal from './ModifierDocumentModal'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

const update = vi.fn()
const eq = vi.fn()

const doc = {
  id: 'doc1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  type_document: 'passeport',
  fichier_url: null,
  date_expiration: '2027-01-15',
  numero_document: 'AB123',
  statut: 'valide',
  date_upload: null,
}

beforeEach(() => {
  update.mockReset()
  eq.mockReset()
  update.mockReturnValue({ eq })
  eq.mockResolvedValue({ error: null })
  mockSupabase.from.mockReset()
  mockSupabase.from.mockReturnValue({ update })
})

describe('ModifierDocumentModal', () => {
  it('préremplit les champs avec les valeurs du document', () => {
    render(<ModifierDocumentModal doc={doc} open onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByLabelText('Date d’expiration')).toHaveValue('2027-01-15')
    expect(screen.getByLabelText('N° de document')).toHaveValue('AB123')
  })

  it('enregistre les nouvelles valeurs puis appelle onSaved et onClose', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<ModifierDocumentModal doc={doc} open onClose={onClose} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText('Date d’expiration'), { target: { value: '2028-02-20' } })
    fireEvent.change(screen.getByLabelText('N° de document'), { target: { value: 'CD456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({ date_expiration: '2028-02-20', numero_document: 'CD456' })
      expect(eq).toHaveBeenCalledWith('id', 'doc1')
    })
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('convertit les champs vidés en null', async () => {
    const onSaved = vi.fn()
    render(<ModifierDocumentModal doc={doc} open onClose={() => {}} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText('Date d’expiration'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('N° de document'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({ date_expiration: null, numero_document: null })
    })
  })

  it('annule sans enregistrer', () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<ModifierDocumentModal doc={doc} open onClose={onClose} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(update).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('affiche l’erreur si la mise à jour échoue', async () => {
    eq.mockResolvedValue({ error: new Error('boom') })
    render(<ModifierDocumentModal doc={doc} open onClose={() => {}} onSaved={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('boom')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run src/components/documents/ModifierDocumentModal.test.tsx`
Expected: FAIL (« Cannot find module './ModifierDocumentModal' »).

- [ ] **Step 3: Implémenter — `src/components/documents/ModifierDocumentModal.tsx`**

```tsx
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { majMetadonnees } from '../../lib/documents'
import { LIBELLES_DOCUMENT } from '../../lib/format'
import type { Document } from '../../lib/types'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

interface Props {
  doc: Document
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function ModifierDocumentModal({ doc, open, onClose, onSaved }: Props) {
  const [dateExpiration, setDateExpiration] = useState(doc.date_expiration ?? '')
  const [numero, setNumero] = useState(doc.numero_document ?? '')
  const [erreur, setErreur] = useState('')

  const sauver = useMutation({
    mutationFn: async () => {
      await majMetadonnees(doc.id, {
        date_expiration: dateExpiration === '' ? null : dateExpiration,
        numero_document: numero === '' ? null : numero,
      })
    },
    onSuccess: () => {
      onSaved()
      onClose()
    },
    onError: (e: Error) => {
      setErreur(e.message)
    },
  })

  return (
    <Modal open={open} title={`Modifier ${LIBELLES_DOCUMENT[doc.type_document]}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="date-expiration" className="text-label-md text-on-surface-variant">
            Date d’expiration
          </label>
          <input
            id="date-expiration"
            type="date"
            className="input mt-1"
            value={dateExpiration}
            onChange={(e) => setDateExpiration(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="numero-document" className="text-label-md text-on-surface-variant">
            N° de document
          </label>
          <input
            id="numero-document"
            type="text"
            className="input mt-1"
            placeholder="Ex. : A1234567"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
        </div>
        {erreur && <p className="text-body-md text-error">{erreur}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" disabled={sauver.isPending} onClick={() => sauver.mutate()}>
            {sauver.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

Note : le composant est remonté à chaque ouverture (les parents ne le rendent que si `doc` est non nul) → `useState` initialisé depuis `doc` suffit, pas de `useEffect` de resynchronisation.

- [ ] **Step 4: Lancer les tests pour vérifier le passage**

Run: `npx vitest run src/components/documents/ModifierDocumentModal.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Vérifications globales**

Run: `npm test` (Expected: PASS), `npm run lint` (Expected: 0 erreur).

- [ ] **Step 6: Commit**

```bash
git add src/components/documents/ModifierDocumentModal.tsx src/components/documents/ModifierDocumentModal.test.tsx
git commit -m "feat: modal d'édition des métadonnées de document"
```

---

### Task 3: Fiche pèlerin — champs, affichage du numéro, bouton Modifier

**Files:**
- Modify: `src/components/documents/DocumentSection.tsx`
- Test: `src/components/documents/DocumentSection.test.tsx` (remplacement complet)

**Interfaces:**
- Consumes: `validerSansFichier` avec 4e paramètre `MetadonneesDocument` (Task 1), `ModifierDocumentModal` (Task 2).
- Produces: composant avec — state `dateExpiration`, `numeroDocument`, `docEnEdition: Document | null` ; mutation `majSansFichier` transmettant les métadonnées (champ vide → clé absente) et réinitialisant les champs ; carte affichant « N° {numero} » si renseigné ; bouton aria-label « Modifier » ouvrant la modal.

- [ ] **Step 1: Écrire les tests qui échouent — `src/components/documents/DocumentSection.test.tsx`**

Remplacer tout le fichier par :

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DocumentSection from './DocumentSection'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))
vi.mock('../../hooks/useAgence', () => ({
  useAgence: () => ({ data: { id: 'ag1' } }),
}))

const upsert = vi.fn()
const update = vi.fn()

const doc1 = {
  id: 'doc1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  type_document: 'passeport',
  fichier_url: null,
  date_expiration: '2027-01-15',
  numero_document: 'AB123',
  statut: 'valide',
  date_upload: null,
}

function rendre() {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'documents') {
      return {
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [doc1], error: null }) }) }),
        upsert,
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
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
  update.mockReset()
  update.mockReturnValue({ eq: () => Promise.resolve({ data: null, error: null }) })
})

describe('DocumentSection', () => {
  it('valide un document sans fichier via le bouton dédié', async () => {
    rendre()
    fireEvent.click(await screen.findByRole('button', { name: 'Valider sans fichier' }))
    await waitFor(() => {
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

  it('transmet la date d’expiration et le numéro saisis lors de la validation sans fichier', async () => {
    rendre()
    fireEvent.change(await screen.findByLabelText('Date d’expiration'), { target: { value: '2027-06-15' } })
    fireEvent.change(screen.getByLabelText('Numéro de document'), { target: { value: 'AB123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider sans fichier' }))
    await waitFor(() => {
      expect(upsert).toHaveBeenCalled()
    })
    const [ligne] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({ date_expiration: '2027-06-15', numero_document: 'AB123' })
  })

  it('réinitialise les champs après la validation', async () => {
    rendre()
    fireEvent.change(await screen.findByLabelText('Date d’expiration'), { target: { value: '2027-06-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider sans fichier' }))
    await waitFor(() => {
      expect(screen.getByLabelText('Date d’expiration')).toHaveValue('')
    })
  })

  it('affiche le numéro du document sur la carte', async () => {
    rendre()
    expect(await screen.findByText('N° AB123 · Expire le 15/01/2027')).toBeInTheDocument()
  })

  it('ouvre la modal d’édition et enregistre les métadonnées', async () => {
    rendre()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    const champDate = await screen.findByDisplayValue('2027-01-15')
    fireEvent.change(champDate, { target: { value: '2028-02-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({ date_expiration: '2028-02-20', numero_document: 'AB123' })
    })
  })
})
```

Note : dans le dernier test, `findByDisplayValue('2027-01-15')` identifie le champ de la **modal** (prérempli), sans ambiguïté avec le champ vide de la barre.

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run src/components/documents/DocumentSection.test.tsx`
Expected: FAIL sur les 4 nouveaux tests (champs absents, numéro absent, bouton Modifier absent).

- [ ] **Step 3: Implémenter — `src/components/documents/DocumentSection.tsx`**

3a. Import (après la ligne 6, `import { validerSansFichier } from '../../lib/documents'`) :

```tsx
import { validerSansFichier, type MetadonneesDocument } from '../../lib/documents'
import ModifierDocumentModal from './ModifierDocumentModal'
```

Et dans le premier import : `import { useState, useRef, type ChangeEvent } from 'react'`.

3b. État (après la ligne 40, `const typeChoisi = useRef<string>('passeport')`) :

```tsx
  const [dateExpiration, setDateExpiration] = useState('')
  const [numeroDocument, setNumeroDocument] = useState('')
  const [docEnEdition, setDocEnEdition] = useState<Document | null>(null)
```

3c. Mutation `majSansFichier` (remplacer les lignes 103-111) :

```tsx
  const majSansFichier = useMutation({
    mutationFn: async () => {
      const metadonnees: MetadonneesDocument = {}
      if (dateExpiration) metadonnees.date_expiration = dateExpiration
      if (numeroDocument) metadonnees.numero_document = numeroDocument
      await validerSansFichier(agence!.id, pelerinId, typeChoisi.current, metadonnees)
    },
    onSuccess: () => {
      setDateExpiration('')
      setNumeroDocument('')
      queryClient.invalidateQueries({ queryKey: ['documents', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerin', pelerinId] })
    },
  })
```

3d. Barre d'actions (après le select type, ligne 151 — insérer entre le select et l'`input type="file"` de la ligne 152) :

```tsx
        <input
          type="date"
          className="input w-auto"
          aria-label="Date d’expiration"
          value={dateExpiration}
          onChange={(e) => setDateExpiration(e.target.value)}
        />
        <input
          type="text"
          className="input w-44"
          placeholder="N° de document"
          aria-label="Numéro de document"
          value={numeroDocument}
          onChange={(e) => setNumeroDocument(e.target.value)}
        />
```

3e. Ligne d'info de la carte (remplacer la ligne 178) :

```tsx
                {doc.fichier_url ? 'Fichier joint' : 'Aucun fichier'}
                {doc.numero_document ? ` · N° ${doc.numero_document}` : ''}
                · Expire le {formatDate(doc.date_expiration)}
```

3f. Bouton Modifier sur la carte (insérer entre le bouton Rejeter — ligne 195 — et le bouton Supprimer — ligne 196) :

```tsx
                <button
                  onClick={() => setDocEnEdition(doc)}
                  aria-label="Modifier"
                  title="Modifier"
                  className="rounded-lg p-1 text-gray-400 hover:text-primary"
                >
                  <Icon name="edit" size={16} />
                </button>
```

3g. Modal en fin de composant (juste après la fermeture de la div racine, ligne 204 — insérer entre `</div>` de la grille et `</div>` racine) :

```tsx
      {docEnEdition && (
        <ModifierDocumentModal
          doc={docEnEdition}
          open
          onClose={() => setDocEnEdition(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['documents', pelerinId] })
            queryClient.invalidateQueries({ queryKey: ['pelerin', pelerinId] })
          }}
        />
      )}
```

- [ ] **Step 4: Lancer les tests pour vérifier le passage**

Run: `npx vitest run src/components/documents/DocumentSection.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Vérifications globales**

Run: `npm test` (Expected: PASS), `npm run lint` (Expected: 0 erreur).

- [ ] **Step 6: Commit**

```bash
git add src/components/documents/DocumentSection.tsx src/components/documents/DocumentSection.test.tsx
git commit -m "feat: métadonnées document dans la fiche pèlerin"
```

---

### Task 4: Gestion des documents — champs, colonne N°, bouton Modifier

**Files:**
- Modify: `src/pages/Documents.tsx`
- Test: `src/pages/Documents.test.tsx` (remplacement complet)

**Interfaces:**
- Consumes: `validerSansFichier` + `MetadonneesDocument` (Task 1), `ModifierDocumentModal` (Task 2).
- Produces: page avec — state `dateExpiration`, `numeroDocument`, `docEnEdition: DocumentAvecPelerin | null` ; mutation `validerSansUpload` transmettant les métadonnées et réinitialisant champs + sélection pèlerin ; colonne « N° document » (« — » si absent) ; bouton aria-label « Modifier » par ligne ; modal avec `onSaved` invalidant `['documents-tous']`, `['pelerins']`, `['pelerin']`.

- [ ] **Step 1: Écrire les tests qui échouent — `src/pages/Documents.test.tsx`**

Remplacer tout le fichier par :

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Documents from './Documents'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))
vi.mock('../hooks/useAgence', () => ({
  useAgence: () => ({ data: { id: 'ag1' } }),
}))

const upsert = vi.fn()
const update = vi.fn()

const docAvecPelerin = {
  id: 'doc1',
  agence_id: 'ag1',
  pelerin_id: 'p1',
  type_document: 'passeport',
  fichier_url: null,
  date_expiration: '2026-09-01',
  numero_document: 'XY789',
  statut: 'valide',
  date_upload: '2026-08-01T10:00:00Z',
  pelerin: { id: 'p1', prenom: 'Awa', nom: 'Ndiaye', telephone: '77 123 45 67' },
}

function rendre() {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'documents') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [docAvecPelerin], error: null }) }),
        upsert,
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
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
  update.mockReset()
  update.mockReturnValue({ eq: () => Promise.resolve({ data: null, error: null }) })
})

describe('Documents', () => {
  it('valide un document sans fichier pour le pèlerin choisi', async () => {
    rendre()
    await screen.findByText('Awa Ndiaye')
    fireEvent.change(screen.getByLabelText('Pèlerin'), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider sans fichier' }))
    await waitFor(() => {
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

  it('transmet la date d’expiration et le numéro saisis', async () => {
    rendre()
    await screen.findByText('Awa Ndiaye')
    fireEvent.change(screen.getByLabelText('Pèlerin'), { target: { value: 'p1' } })
    fireEvent.change(screen.getByLabelText('Date d’expiration'), { target: { value: '2027-06-15' } })
    fireEvent.change(screen.getByLabelText('Numéro de document'), { target: { value: 'AB123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Valider sans fichier' }))
    await waitFor(() => {
      expect(upsert).toHaveBeenCalled()
    })
    const [ligne] = upsert.mock.calls[0]
    expect(ligne).toMatchObject({ date_expiration: '2027-06-15', numero_document: 'AB123' })
  })

  it('affiche le numéro du document dans le tableau', async () => {
    rendre()
    expect(await screen.findByText('XY789')).toBeInTheDocument()
  })

  it('modifie les métadonnées d’un document existant', async () => {
    rendre()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    const champDate = await screen.findByDisplayValue('2026-09-01')
    fireEvent.change(champDate, { target: { value: '2027-03-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({ date_expiration: '2027-03-10', numero_document: 'XY789' })
    })
  })
})
```

Note : le test « modifie les métadonnées » s'appuie sur `findByDisplayValue('2026-09-01')` (préremplissage de la modal), sans ambiguïté avec le champ vide de la barre de formulaire.

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run src/pages/Documents.test.tsx`
Expected: FAIL sur les 3 nouveaux tests (champs absents, colonne absente, bouton Modifier absent).

- [ ] **Step 3: Implémenter — `src/pages/Documents.tsx`**

3a. Import (ligne 6, remplacer) :

```tsx
import { validerSansFichier, type MetadonneesDocument } from '../lib/documents'
```

(ligne 7, supprimer `import { validerSansFichier } from '../lib/documents'`) et ajouter :

```tsx
import ModifierDocumentModal from '../components/documents/ModifierDocumentModal'
```

3b. État (après la ligne 35, `const [typeSansFichier, setTypeSansFichier] = useState('passeport')`) :

```tsx
  const [dateExpiration, setDateExpiration] = useState('')
  const [numeroDocument, setNumeroDocument] = useState('')
  const [docEnEdition, setDocEnEdition] = useState<DocumentAvecPelerin | null>(null)
```

3c. Mutation `validerSansUpload` (remplacer les lignes 87-97) :

```tsx
  const validerSansUpload = useMutation({
    mutationFn: async () => {
      const metadonnees: MetadonneesDocument = {}
      if (dateExpiration) metadonnees.date_expiration = dateExpiration
      if (numeroDocument) metadonnees.numero_document = numeroDocument
      await validerSansFichier(agence!.id, pelerinChoisi, typeSansFichier, metadonnees)
    },
    onSuccess: () => {
      setPelerinChoisi('')
      setDateExpiration('')
      setNumeroDocument('')
      queryClient.invalidateQueries({ queryKey: ['documents-tous'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins-options'] })
    },
  })
```

3d. Barre de formulaire (après le select Type, ligne 155 — insérer entre le select et le bouton) :

```tsx
        <input
          type="date"
          className="input w-auto"
          aria-label="Date d’expiration"
          value={dateExpiration}
          onChange={(e) => setDateExpiration(e.target.value)}
        />
        <input
          type="text"
          className="input w-44"
          placeholder="N° de document"
          aria-label="Numéro de document"
          value={numeroDocument}
          onChange={(e) => setNumeroDocument(e.target.value)}
        />
```

3e. Colonne du tableau (après `<th>Document</th>`, ligne 180 — insérer une ligne) :

```tsx
                <th className="px-4 py-3">N° document</th>
```

Et dans le corps (après le `<td>` Document, ligne 199) :

```tsx
                  <td className="px-4 py-4 text-data-mono text-on-surface-variant">{d.numero_document ?? '—'}</td>
```

3f. Bouton Modifier dans les actions (au début du div actions, ligne 205 — insérer avant le bouton Valider) :

```tsx
                      <button
                        onClick={() => setDocEnEdition(d)}
                        aria-label="Modifier"
                        title="Modifier"
                        className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"
                      >
                        <Icon name="edit" size={18} />
                      </button>
```

3g. Modal en fin de composant (après la fermeture de la div racine, ligne 234 — insérer entre `</div>` final et la fin du return) :

```tsx
      {docEnEdition && (
        <ModifierDocumentModal
          doc={docEnEdition}
          open
          onClose={() => setDocEnEdition(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['documents-tous'] })
            queryClient.invalidateQueries({ queryKey: ['pelerins'] })
            queryClient.invalidateQueries({ queryKey: ['pelerin'] })
          }}
        />
      )}
```

- [ ] **Step 4: Lancer les tests pour vérifier le passage**

Run: `npx vitest run src/pages/Documents.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Vérifications globales complètes**

Run: `npm test` (Expected: suite complète PASS, 60 tests), `npm run lint` (Expected: 0 erreur), `npm run build` (Expected: build OK).

- [ ] **Step 6: Commit**

```bash
git add src/pages/Documents.tsx src/pages/Documents.test.tsx
git commit -m "feat: métadonnées document dans la gestion des documents"
```

---

## Migration base live (utilisateur)

Exécuter dans le SQL editor Supabase (après la Task 1, avant de tester l'app dans le navigateur) :

```sql
alter table public.documents add column numero_document text;
```

## Vérifications finales du plan

- **Couverture spec** : §1 migration/type → Task 1 ; §2 fonctions → Task 1 ; §3 modal → Task 2 ; §4 fiche pèlerin (champs, affichage N°, bouton Modifier, invalidations) → Task 3 ; §5 gestion (champs, colonne, bouton Modifier, invalidation) → Task 4 ; §6 tests → répartis Tasks 1-4. ✓
- **Placeholders** : aucun « TBD/TODO » ; tout le code est fourni. ✓
- **Cohérence des types** : `MetadonneesDocument`, `validerSansFichier(agenceId, pelerinId, typeDocument, metadonnees?)`, `majMetadonnees(docId, { date_expiration, numero_document })`, `ModifierDocumentModal({ doc, open, onClose, onSaved })` identiques entre tasks. ✓