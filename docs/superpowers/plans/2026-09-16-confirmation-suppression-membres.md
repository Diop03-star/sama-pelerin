# Confirmation avant suppression des membres / annulation des invitations — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher la suppression immédiate : toute action « Retirer » (membre) ou « Annuler » (invitation) dans `Membres.tsx` doit d'abord ouvrir une modale de confirmation.

**Architecture:** Pattern existant de `src/pages/Pelerins.tsx:358-373` réutilisé : un état local `confirmation` + le composant `Modal` (`src/components/ui/Modal.tsx`, props `open`, `title`, `onClose`) + `Button` variant `danger`. Une seule modale gère les deux types via un discriminateur `type: 'membre' | 'invitation'`. Les mutations Supabase restent inchangées ; la fermeture de la modale se fait dans `onSuccess`.

**Tech Stack:** React 19 + Vite + TypeScript, @tanstack/react-query, Supabase, Vitest + Testing Library (jsdom).

## Global Constraints

- Ne pas modifier les mutations, requêtes, gardes RLS ni la logique d'affichage des boutons — uniquement le point d'entrée `onClick` et l'ajout de la modale.
- Chaînes de caractères en français avec apostrophe typographique `’` (convention du fichier : « l’invitation »).
- Composants UI existants uniquement : `Modal` (`src/components/ui/Modal.tsx`), `Button` (`src/components/ui/Button.tsx`, variant `danger`/`secondary`). Ne pas créer de nouveau composant.
- Copier verbatim les messages du spec : membre → « Retirer « [nom] » de votre agence ? Cette action est définitive. » ; invitation → « Annuler l’invitation de « [email] » ? »
- Commandes : tests ciblés `npx vitest run src/pages/Membres.test.tsx`, suite complète `npm test`, lint `npm run lint`, types `npx tsc -b`.

---

### Task 1: Confirmation pour la suppression d'un membre

**Files:**
- Modify: `src/pages/Membres.test.tsx` (mock `eq` lignes 7-10, nouveaux tests en fin de `describe`)
- Modify: `src/pages/Membres.tsx` (import `Modal`, état `confirmation`, 2 `onClick`, modale en fin de JSX, `onSuccess` des mutations)

**Interfaces:**
- Consumes: `Modal` (props `open: boolean; title: string; onClose: () => void; children`), `Button` (props `variant?: 'primary' | 'secondary' | 'danger'`), mutations existantes `supprimer` / `supprimerInvitation` (lignes 69-83 de Membres.tsx).
- Produces: type local `Confirmation = { type: 'membre' | 'invitation'; id: string; nom: string }` et état `confirmation` — le Task 2 branchera les boutons d'invitation sur ce même état.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/pages/Membres.test.tsx`, remplacer le mock (lignes 7-10) :

```tsx
const mockSupabase = vi.hoisted(() => {
  const eq = vi.fn(() => Promise.resolve({ data: null, error: null }))
  return {
    from: vi.fn(),
    delete: vi.fn(() => ({ eq })),
    eq,
  }
})
```

Dans `beforeEach` (ligne 46-50), ajouter après `mockSupabase.delete.mockClear()` :

```tsx
  mockSupabase.eq.mockClear()
```

Mettre à jour l'import Testing Library (ligne 2) :

```tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
```

Ajouter ces 3 tests à la fin du `describe('Membres', ...)` (après le test « Lien copié », ligne 117) :

```tsx
  it('ouvre une modale de confirmation au clic sur Retirer sans supprimer', async () => {
    const autreMembre = { ...membreFixture, id: 'u2', user_id: 'auth2', nom: 'Fatou Diop' }
    rendre({ membres: [membreFixture, autreMembre], invitations: [] })
    fireEvent.click((await screen.findAllByTitle('Retirer'))[0])
    expect(await screen.findByText(/Retirer « Fatou Diop » de votre agence/)).toBeInTheDocument()
    expect(mockSupabase.eq).not.toHaveBeenCalled()
  })

  it('supprime le membre après confirmation dans la modale', async () => {
    const autreMembre = { ...membreFixture, id: 'u2', user_id: 'auth2', nom: 'Fatou Diop' }
    rendre({ membres: [membreFixture, autreMembre], invitations: [] })
    fireEvent.click((await screen.findAllByTitle('Retirer'))[0])
    const modale = screen.getByText(/Retirer « Fatou Diop » de votre agence/).closest('.rounded-card') as HTMLElement
    fireEvent.click(within(modale).getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'u2'))
  })

  it('ne supprime pas le membre si annulation dans la modale', async () => {
    const autreMembre = { ...membreFixture, id: 'u2', user_id: 'auth2', nom: 'Fatou Diop' }
    rendre({ membres: [membreFixture, autreMembre], invitations: [] })
    fireEvent.click((await screen.findAllByTitle('Retirer'))[0])
    const modale = screen.getByText(/Retirer « Fatou Diop » de votre agence/).closest('.rounded-card') as HTMLElement
    fireEvent.click(within(modale).getByRole('button', { name: 'Annuler' }))
    expect(mockSupabase.eq).not.toHaveBeenCalled()
    expect(screen.queryByText(/Retirer « Fatou Diop » de votre agence/)).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run src/pages/Membres.test.tsx`
Expected: FAIL sur les 3 nouveaux tests (aucune modale n'apparaît : `getByText(/Retirer « Fatou Diop…/) introuvable). Les tests existants passent toujours.

- [ ] **Step 3: Implémenter dans `src/pages/Membres.tsx`**

3a. Ajouter l'import Modal (après la ligne 8, `import EmptyState...`) :

```tsx
import Modal from '../components/ui/Modal'
```

3b. Ajouter le type local juste après l'import de types (ligne 10) :

```tsx
type Confirmation = { type: 'membre' | 'invitation'; id: string; nom: string }
```

3c. Ajouter l'état dans le composant (après `const [erreur, setErreur] = useState('')`, ligne 19) :

```tsx
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
```

3d. Fermer la modale dans `onSuccess` des deux mutations existantes :

```tsx
  const supprimer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('utilisateurs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setConfirmation(null)
      queryClient.invalidateQueries({ queryKey: ['membres'] })
    },
  })

  const supprimerInvitation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invitations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setConfirmation(null)
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
    },
  })
```

3e. Remplacer le `onClick` du bouton desktop (ligne 160) :

```tsx
                          onClick={() => setConfirmation({ type: 'membre', id: m.id, nom: m.nom })}
```

3f. Remplacer le `onClick` du bouton mobile (ligne 188) :

```tsx
                  onClick={() => setConfirmation({ type: 'membre', id: m.id, nom: m.nom })}
```

3g. Ajouter la modale en fin de JSX, juste avant la fermeture `</div>` finale (ligne 259) :

```tsx
      <Modal
        open={!!confirmation}
        title={confirmation?.type === 'invitation' ? 'Confirmer l’annulation' : 'Confirmer la suppression'}
        onClose={() => setConfirmation(null)}
      >
        <p className="text-body-md text-on-surface-variant">
          {confirmation?.type === 'invitation'
            ? `Annuler l’invitation de « ${confirmation.nom} » ?`
            : `Retirer « ${confirmation?.nom} » de votre agence ? Cette action est définitive.`}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setConfirmation(null)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={confirmation?.type === 'membre' ? supprimer.isPending : supprimerInvitation.isPending}
            onClick={() => {
              if (!confirmation) return
              if (confirmation.type === 'membre') supprimer.mutate(confirmation.id)
              else supprimerInvitation.mutate(confirmation.id)
            }}
          >
            Confirmer
          </Button>
        </div>
      </Modal>
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run src/pages/Membres.test.tsx`
Expected: PASS (tous les tests, y compris les 7 existants).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Membres.tsx src/pages/Membres.test.tsx
git commit -m "feat: confirmation avant retrait d'un membre"
```

---

### Task 2: Confirmation pour l'annulation d'une invitation

**Files:**
- Modify: `src/pages/Membres.test.tsx` (3 nouveaux tests en fin de `describe`)
- Modify: `src/pages/Membres.tsx` (2 `onClick` des boutons d'invitation : desktop ligne ~223, mobile ligne ~247)

**Interfaces:**
- Consumes: l'état `confirmation` et la modale créés au Task 1 (le discriminateur `type: 'invitation'` affiche déjà le bon titre et le bon message).
- Produces: rien (dernier task fonctionnel).

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin du `describe('Membres', ...)` dans `src/pages/Membres.test.tsx` :

```tsx
  it('ouvre une modale de confirmation au clic sur Annuler d’une invitation sans supprimer', async () => {
    rendre({ membres: [], invitations: [invitationFixture] })
    fireEvent.click((await screen.findAllByTitle('Annuler'))[0])
    expect(await screen.findByText(/Annuler l’invitation de « invite@example.com »/)).toBeInTheDocument()
    expect(mockSupabase.eq).not.toHaveBeenCalled()
  })

  it('annule l’invitation après confirmation dans la modale', async () => {
    rendre({ membres: [], invitations: [invitationFixture] })
    fireEvent.click((await screen.findAllByTitle('Annuler'))[0])
    const modale = screen.getByText(/Annuler l’invitation de « invite@example.com »/).closest('.rounded-card') as HTMLElement
    fireEvent.click(within(modale).getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'i1'))
  })

  it('ne supprime pas l’invitation si annulation dans la modale', async () => {
    rendre({ membres: [], invitations: [invitationFixture] })
    fireEvent.click((await screen.findAllByTitle('Annuler'))[0])
    const modale = screen.getByText(/Annuler l’invitation de « invite@example.com »/).closest('.rounded-card') as HTMLElement
    fireEvent.click(within(modale).getByRole('button', { name: 'Annuler' }))
    expect(mockSupabase.eq).not.toHaveBeenCalled()
    expect(screen.queryByText(/Annuler l’invitation de « invite@example.com »/)).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run src/pages/Membres.test.tsx`
Expected: FAIL sur les 3 nouveaux tests — au clic sur « Annuler », l'invitation est supprimée directement, aucune modale n'apparaît. Les tests du Task 1 passent toujours.

- [ ] **Step 3: Brancher les boutons d'invitation sur la modale**

Dans `src/pages/Membres.tsx`, remplacer le `onClick` du bouton desktop des invitations (dans le `map` sur `invitations.filter(...)` de la table desktop) :

```tsx
                          onClick={() => setConfirmation({ type: 'invitation', id: i.id, nom: i.email })}
```

Remplacer le `onClick` du bouton mobile des invitations (dans la carte mobile) :

```tsx
                  onClick={() => setConfirmation({ type: 'invitation', id: i.id, nom: i.email })}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run src/pages/Membres.test.tsx`
Expected: PASS (tous les tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Membres.tsx src/pages/Membres.test.tsx
git commit -m "feat: confirmation avant annulation d'une invitation"
```

---

### Task 3: Vérification globale

**Files:** aucun fichier modifié (vérification seule).

**Interfaces:**
- Consumes: tout le travail des Tasks 1-2.
- Produces: confirmation que rien d'autre n'est cassé.

- [ ] **Step 1: Lancer la suite complète**

Run: `npm test`
Expected: PASS — aucune régression sur les autres pages.

- [ ] **Step 2: Lancer le lint**

Run: `npm run lint`
Expected: PASS sans erreur sur les fichiers modifiés.

- [ ] **Step 3: Vérifier les types**

Run: `npx tsc -b`
Expected: aucune erreur.

- [ ] **Step 4: Commit si des fichiers sont restés modifiés (sinon rien à faire)**

```bash
git status --short
```
Expected: arbre de travail propre (aucun changement non commité).
