# Cartes Mobiles pour les Tableaux (Paiements, Groupes, Membres) — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur mobile (< md), remplacer les tableaux desktop des pages Paiements & échéanciers, Groupes et Membres par des listes de cartes, selon la spec `docs/superpowers/specs/2026-09-01-cartes-mobiles-tableaux-design.md`.

**Architecture:** Double rendu sans logique nouvelle : chaque wrapper de tableau existant reçoit `hidden md:block` (les mêmes données restent en tableau sur desktop) et une liste de cartes `md:hidden` est insérée juste après — exactement le pattern de `src/pages/Pelerins.tsx:198-316`.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS v4 (tokens `bg-surface-container-lowest`, `border-outline-variant`, `text-on-surface-variant`…), React Router, React Query, Vitest + Testing Library (jsdom), oxlint.

## Global Constraints

- TDD : test d'abord, RED vérifié, implémentation minimale, GREEN vérifié.
- Aucun commentaire dans le code (convention repo). Textes en français.
- Wrapper tableau : `hidden overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm md:block`.
- Liste cartes : `<div className="space-y-4 md:hidden">` juste après le wrapper du tableau ; `EmptyState` dupliqué dans la liste mobile (le tableau caché a son EmptyState invisible).
- Lignes « libellé : valeur » des cartes : **un seul nœud texte** (template literal `` {`Libellé : ${valeur}`} ``) pour permettre les assertions `getByText` exactes — les nœuds texte séparés (`Libellé : {valeur}`) cassent les matchers.
- En jsdom, le tableau et les cartes sont **tous deux dans le DOM** (le masquage est CSS pur) : les textes présents dans les deux (noms, emails, badges) se testent avec `findAllByText`/`getAllByText` et `length >= 1`, jamais `getByText`.
- Vérification : `npx vitest run <fichier>` (fichier), `npm run test` (suite complète PASS), `npm run lint` (0 erreur), `npm run build` (OK).
- Shell : Windows PowerShell 5.1 — pas de `&&` ; chaîner avec `;` et `if ($?)`.

---
### Task 1: Page Groupes — cartes mobiles + tests

**Files:**
- Modify: `src/pages/Groupes.tsx` (wrapper tableau ligne 133 + liste cartes après ligne 189)
- Create: `src/pages/Groupes.test.tsx`

**Interfaces:**
- Consumes: `Groupes` (composant existant), `useAgence()` mock (`{ data: { id, nom }, isLoading: false }`), `supabase.from` mock — table `groupes` → `select()` → `order()` → Promise `{ data, error }` ; `update`/`delete` chaînés `eq` → Promise résolue.
- Produces: test file `Groupes.test.tsx` réutilisable ; liste de cartes `md:hidden` dans Groupes.tsx.

- [ ] **Step 1: Write the failing test**

Create `src/pages/Groupes.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Groupes from './Groupes'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
  delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
}))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const mockAgence = vi.hoisted(() => ({ data: { id: 'a1', nom: 'Al Hidjah' }, isLoading: false }))
vi.mock('../hooks/useAgence', () => ({ useAgence: () => mockAgence }))

const groupeFixture = {
  id: 'g1', agence_id: 'a1', nom: 'Hajj 2027', type_voyage: 'hajj',
  date_depart: '2027-04-01', date_retour: '2027-04-30', nb_places_max: 10, created_at: '2026-01-01T00:00:00Z',
  pelerins: [{ count: 7 }],
}

function rendre(data: unknown[] = [groupeFixture]) {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'groupes') {
      return {
        select: () => ({ order: () => Promise.resolve({ data, error: null }) }),
        update: mockSupabase.update,
        delete: mockSupabase.delete,
      }
    }
    return {}
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Groupes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Groupes', () => {
  it('affiche les cartes mobiles avec nom, type, dates et places', async () => {
    rendre()
    expect((await screen.findAllByText('Hajj 2027')).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText('Hajj')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Départ : 01/04/2027')).toBeInTheDocument()
    expect(screen.getByText('Retour : 30/04/2027')).toBeInTheDocument()
    expect(screen.getByText('Places : 7 / 10')).toBeInTheDocument()
  })

  it('affiche les boutons Modifier et Supprimer sur les cartes', async () => {
    rendre()
    expect((await screen.findAllByTitle('Modifier')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTitle('Supprimer').length).toBeGreaterThanOrEqual(1)
  })

  it('affiche un état vide sur les cartes', async () => {
    rendre([])
    expect((await screen.findAllByText('Aucun groupe. Créez votre premier groupe Hajj ou Omra.')).length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Groupes.test.tsx`
Expected: FAIL — « Départ : 01/04/2027 » introuvable (les cartes n'existent pas encore).

- [ ] **Step 3: Write minimal implementation**

Modify `src/pages/Groupes.tsx` :

1. Ligne 133 — ajouter `hidden` et `md:block` au wrapper du tableau :

```tsx
      <div className="hidden overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm md:block">
```

2. Après la fermeture du wrapper du tableau (ligne 189, juste avant `<Modal …>`), insérer :

```tsx
      <div className="space-y-4 md:hidden">
        {filtres.map((g) => {
          const inscrits = g.pelerins[0]?.count ?? 0
          const complet = inscrits >= g.nb_places_max && g.nb_places_max > 0
          return (
            <div key={g.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/liste-des-pelerins?groupe=${g.id}`} className="font-semibold text-primary">
                  {g.nom}
                </Link>
                <Badge tone={g.type_voyage === 'hajj' ? 'ambre' : 'neutre'}>{LIBELLES_TYPE_VOYAGE[g.type_voyage]}</Badge>
              </div>
              <div className="mt-3 space-y-1 text-body-md text-on-surface-variant">
                <p>{`Départ : ${formatDate(g.date_depart)}`}</p>
                <p>{`Retour : ${formatDate(g.date_retour)}`}</p>
                <p className={complet ? 'font-semibold text-error' : ''}>{`Places : ${inscrits} / ${g.nb_places_max}`}</p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => ouvrirEdition(g)}
                  title="Modifier"
                  className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"
                >
                  <Icon name="edit" size={18} />
                </button>
                <button
                  onClick={() => supprimer.mutate(g.id)}
                  title="Supprimer"
                  className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"
                >
                  <Icon name="delete" size={18} />
                </button>
              </div>
            </div>
          )
        })}
        {filtres.length === 0 && <EmptyState message="Aucun groupe. Créez votre premier groupe Hajj ou Omra." />}
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/Groupes.test.tsx`
Expected: 3 tests PASS.

- [ ] **Step 5: Full verification**

Run: `npm run test` — suite complète PASS. `npm run lint` — 0 erreur. `npm run build` — OK.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Groupes.tsx src/pages/Groupes.test.tsx
git commit -m "feat(ui): cartes mobiles pour la page Groupes"
```

---
### Task 2: Page Membres — cartes mobiles + tests

**Files:**
- Modify: `src/pages/Membres.tsx` (wrappers tableaux lignes 131 et 172 + listes cartes après lignes 169 et 205)
- Create: `src/pages/Membres.test.tsx`

**Interfaces:**
- Consumes: `Membres` (composant existant), `useProfil()` mock (`{ data: { id, user_id, agence_id }, isLoading: false }`), `supabase.from` mock — tables `utilisateurs` et `invitations` → `select()` → `eq()` → `order()` → Promise `{ data, error }` ; `delete` chaîné `eq` → Promise résolue.
- Produces: test file `Membres.test.tsx` ; deux listes de cartes `md:hidden` dans Membres.tsx (membres + invitations).

- [ ] **Step 1: Write the failing test**

Create `src/pages/Membres.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Membres from './Membres'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
  delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
}))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const mockUseProfil = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useAgence', () => ({ useProfil: () => mockUseProfil() }))

const membreFixture = {
  id: 'u1', user_id: 'auth1', agence_id: 'a1', nom: 'Moussa Ndiaye', telephone: '771234567',
  email: 'moussa@alhidjah.sn', role: 'gerant', created_at: '2026-01-01T00:00:00Z',
}

const invitationFixture = {
  id: 'i1', agence_id: 'a1', email: 'invite@example.com', role: 'agent', token: 'tok',
  created_by: 'u1', created_at: '2026-01-01T00:00:00Z', expires_at: '2026-02-01T12:00:00Z', used_at: null,
}

function rendre({ membres, invitations }: { membres: unknown[]; invitations: unknown[] }) {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'utilisateurs') {
      return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: membres, error: null }) }) }), delete: mockSupabase.delete }
    }
    if (table === 'invitations') {
      return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: invitations, error: null }) }) }), delete: mockSupabase.delete }
    }
    return {}
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Membres />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockUseProfil.mockReset()
  mockSupabase.delete.mockClear()
  mockUseProfil.mockReturnValue({ data: { id: 'u1', user_id: 'auth1', agence_id: 'a1' }, isLoading: false })
})

describe('Membres', () => {
  it('affiche les cartes membres avec nom, email et rôle', async () => {
    rendre({ membres: [membreFixture], invitations: [] })
    expect((await screen.findAllByText('Moussa Ndiaye')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('moussa@alhidjah.sn').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Gérant').length).toBeGreaterThanOrEqual(1)
  })

  it('ne montre pas le bouton Retirer pour soi-même', async () => {
    rendre({ membres: [membreFixture], invitations: [] })
    expect(await screen.findByText('Moussa Ndiaye')).toBeInTheDocument()
    expect(screen.queryByTitle('Retirer')).not.toBeInTheDocument()
  })

  it('affiche les cartes invitations avec date d’expiration', async () => {
    rendre({ membres: [], invitations: [invitationFixture] })
    expect((await screen.findAllByText('invite@example.com')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Expire le : 01/02/2026')).toBeInTheDocument()
  })

  it('affiche un état vide pour les membres', async () => {
    rendre({ membres: [], invitations: [] })
    expect((await screen.findAllByText('Aucun membre pour le moment.')).length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Membres.test.tsx`
Expected: FAIL — « Expire le : 01/02/2026 » introuvable (les cartes n'existent pas encore).

- [ ] **Step 3: Write minimal implementation**

Modify `src/pages/Membres.tsx` :

1. Ligne 131 — ajouter `hidden` et `md:block` au wrapper du tableau membres :

```tsx
      <div className="hidden overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm md:block">
```

2. Après la fermeture de ce wrapper (ligne 169), insérer la liste des cartes membres :

```tsx
      <div className="space-y-4 md:hidden">
        {membres.map((m) => (
          <div key={m.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-primary">{m.nom}</p>
              <Badge tone={m.role === 'gerant' ? 'ambre' : 'neutre'}>{m.role === 'gerant' ? 'Gérant' : 'Agent'}</Badge>
            </div>
            <p className="mt-0.5 text-body-md text-on-surface-variant">{m.email}</p>
            {m.user_id !== profil?.user_id && (
              <div className="mt-3">
                <button
                  onClick={() => supprimer.mutate(m.id)}
                  title="Retirer"
                  className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"
                >
                  <Icon name="delete" size={18} />
                </button>
              </div>
            )}
          </div>
        ))}
        {membres.length === 0 && <EmptyState message="Aucun membre pour le moment." />}
      </div>
```

3. Ligne 172 — ajouter `hidden` et `md:block` au wrapper du tableau invitations (même classe qu'en 1).

4. Après la fermeture du wrapper invitations (ligne 205), à l'intérieur de la même condition `{invitations.filter((i) => !i.used_at).length > 0 && (`, insérer la liste des cartes invitations :

```tsx
        <div className="space-y-4 md:hidden">
          {invitations.filter((i) => !i.used_at).map((i) => (
            <div key={i.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-primary">{i.email}</p>
                <Badge tone={i.role === 'gerant' ? 'ambre' : 'neutre'}>{i.role === 'gerant' ? 'Gérant' : 'Agent'}</Badge>
              </div>
              <p className="mt-0.5 text-body-md text-on-surface-variant">{`Expire le : ${new Date(i.expires_at).toLocaleDateString('fr-FR')}`}</p>
              <div className="mt-3">
                <button
                  onClick={() => supprimerInvitation.mutate(i.id)}
                  title="Annuler"
                  className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
```

Note : la section invitations étant conditionnelle (non rendue si aucune invitation en attente), aucune liste vide n'est nécessaire — même comportement que le tableau existant.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/Membres.test.tsx`
Expected: 4 tests PASS.

- [ ] **Step 5: Full verification**

Run: `npm run test` — suite complète PASS. `npm run lint` — 0 erreur. `npm run build` — OK.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Membres.tsx src/pages/Membres.test.tsx
git commit -m "feat(ui): cartes mobiles pour la page Membres"
```

---
### Task 3: Page Paiements — cartes mobiles (plans + tranches) + tests

**Files:**
- Modify: `src/pages/Paiements.tsx` (wrappers tableaux lignes 106 et 160 + listes cartes après lignes 158 et 192)
- Modify: `src/pages/Paiements.test.tsx` (assertion « En retard » + nouveau test cartes)

**Interfaces:**
- Consumes: `Paiements` (composant existant, calculs `paye`/`reste`/`progression`/`retard` déjà dans la boucle du tableau), mock supabase existant du test.
- Produces: deux listes de cartes `md:hidden` dans Paiements.tsx ; test file mis à jour.

- [ ] **Step 1: Write the failing test**

Modify `src/pages/Paiements.test.tsx` :

1. Dans le test « affiche le badge statut du plan et l'encart « solde à régler » », remplacer l'assertion (elle trouvera 2 badges après l'ajout des cartes) :

```tsx
    expect((await screen.findAllByText('En retard')).length).toBeGreaterThanOrEqual(1)
```

2. Ajouter ce test à la fin du `describe` :

```tsx
  it('affiche les cartes mobiles avec plan, payé, reste et tranches', async () => {
    rendre()
    expect((await screen.findAllByText(/Plan : 1 000 000 FCFA · 2 tranches/)).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText(/Payé : 500 000 FCFA/)).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText(/Reste : 500 000 FCFA/)).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText(/Tranche 1 · 300 000 FCFA/)).length).toBeGreaterThanOrEqual(1)
    expect((await screen.findAllByText(/Échéance : 01\/02\/2026/)).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Voir').length).toBeGreaterThanOrEqual(1)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Paiements.test.tsx`
Expected: FAIL — le nouveau test échoue (« Plan : 1 000 000 FCFA · 2 tranches » introuvable, les cartes n'existent pas) ; les tests existants passent encore (1 seul badge « En retard » avant l'ajout des cartes).

- [ ] **Step 3: Write minimal implementation**

Modify `src/pages/Paiements.tsx` :

1. Ligne 106 — ajouter `hidden` et `md:block` au wrapper du tableau plans :

```tsx
      <div className="hidden overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm md:block">
```

2. Après la fermeture de ce wrapper (ligne 158), insérer les cartes plans :

```tsx
      <div className="space-y-4 md:hidden">
        {plans.map((p) => {
          const paye = p.tranches.reduce((s, t) => s + t.paiements.reduce((x, y) => x + y.montant_paye, 0), 0)
            + p.acomptes.reduce((s, a) => s + a.montant_paye, 0)
          const reste = p.montant_total - paye
          const progression = p.montant_total > 0 ? Math.round((paye / p.montant_total) * 100) : 0
          const retard = p.tranches.filter((t) => t.statut === 'en_retard').length
          return (
            <div key={p.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <Link to={`/details-du-pelerin/${p.pelerin.id}`} className="font-semibold text-primary">
                  {p.pelerin.prenom} {p.pelerin.nom}
                </Link>
                <Badge tone={TONE_STATUT_PLAN[p.statut]}>{LIBELLES_STATUT_PLAN[p.statut]}</Badge>
              </div>
              <p className="mt-0.5 text-body-md text-on-surface-variant">{p.pelerin.telephone}</p>
              <div className="mt-3 space-y-1 text-body-md text-on-surface-variant">
                <p>{`Plan : ${formatFCFA(p.montant_total)} · ${p.nombre_tranches} tranches`}</p>
                <p className="text-vert">{`Payé : ${formatFCFA(paye)}`}</p>
                <p className={reste > 0 ? 'font-medium text-error' : 'text-vert'}>{`Reste : ${formatFCFA(reste)}`}</p>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="w-32">
                  <ProgressBar valeur={progression} tone={progression === 100 ? 'vert' : 'gold'} />
                </div>
                <span className="text-data-mono text-on-surface-variant">{progression}%</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Link to={`/details-du-pelerin/${p.pelerin.id}`} className="btn-secondary px-3 py-1.5 text-sm">
                  Voir
                </Link>
                {retard > 0 && <Badge tone="rouge">{`${retard} en retard`}</Badge>}
              </div>
            </div>
          )
        })}
        {plans.length === 0 && <EmptyState message="Aucun plan de paiement." />}
      </div>
```

3. Ligne 160 — ajouter `hidden` et `md:block` au wrapper du tableau tranches (même classe qu'en 1).

4. Après la fermeture de ce wrapper (ligne 192), insérer les cartes tranches :

```tsx
      <div className="space-y-4 md:hidden">
        {tranchesFiltrees.map(({ p, t }) => (
          <div key={t.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-primary">{p.pelerin.prenom} {p.pelerin.nom}</p>
              <Badge tone={TONE_TRANCHE[t.statut]}>{LIBELLES_TRANCHE[t.statut]}</Badge>
            </div>
            <div className="mt-3 space-y-1 text-body-md text-on-surface-variant">
              <p>{`Tranche ${t.numero_tranche} · ${formatFCFA(t.montant_prevu)}`}</p>
              <p>{`Échéance : ${formatDate(t.date_echeance)}`}</p>
            </div>
          </div>
        ))}
        {tranchesFiltrees.length === 0 && <EmptyState message="Aucune tranche pour ce filtre." />}
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/Paiements.test.tsx`
Expected: 4 tests PASS.

- [ ] **Step 5: Full verification**

Run: `npm run test` — suite complète PASS. `npm run lint` — 0 erreur. `npm run build` — OK.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Paiements.tsx src/pages/Paiements.test.tsx
git commit -m "feat(ui): cartes mobiles pour la page Paiements et échéanciers"
```