# Page Superadmin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un rôle `superadmin` avec une vue globale des indicateurs de toutes les agences et la gestion des agences (création, désactivation).

**Architecture:** Données agrégées via une RPC SQL `stats_globales()` (security definer) — aucune donnée brute multi-agence côté client. RLS étendue par policies `or is_superadmin()`. Désactivation d'agence via colonne `agences.active` + `current_agence_id()` qui retourne NULL (blocage RLS total). Front : `SuperAdminLayout` dédié (sans `useAgence`), routes `/superadmin` et `/superadmin/agences`.

**Tech Stack:** React 19, Vite 8, TypeScript, Tailwind 4, @tanstack/react-query 5, Supabase (RLS + RPC), Vitest 4 + Testing Library (jsdom), react-router-dom 7.

## Global Constraints

- `src/lib/format.ts`, `src/lib/plan.ts`, `src/auth/*`, `src/lib/supabase.ts`, `src/hooks/useAgence.ts`, `supabase/seed.sql`, les tests existants : ne pas modifier.
- `src/lib/types.ts` : **exception validée** — uniquement ajouts (étendre `Role`, ajouter `active` à `Agence`, ajouter `StatsAgence`).
- `supabase/schema.sql` : mis à jour comme référence (mêmes changements que le SQL appliqué).
- Conventions UI : conteneurs `rounded-xl border border-outline-variant bg-surface-container-lowest`, thead `bg-[#f1f5f9]`, table rows `border-t border-outline-variant hover:bg-surface-container-low`, Badge (tones `rouge|ambre|vert|neutre` — pas `error`).
- Pas de nouvelle dépendance npm.
- `npm test` = 24 tests existants + nouveaux. `npm run build` doit passer.
- Imports Supabase : `import { supabase } from '../lib/supabase'` (page) / `'../../lib/supabase'` (composant layout).
- Icônes : familles Material Symbols (`dashboard`, `business`, `admin_panel_settings`, `block`, `check_circle`, `add`, `logout`, `menu`).

---

### Task 1: SQL — schéma, policies, RPC (Supabase SQL Editor + `schema.sql`)

**Files:**
- Modify: `supabase/schema.sql` (référence, mêmes instructions SQL)
- Exécution manuelle : SQL Editor du projet Supabase live (`https://zwhdubsdmporkwrkansz.supabase.co`)

**Interfaces:**
- Produces: colonne `agences.active` ; rôle `superadmin` ; fonctions `public.is_superadmin()`, `public.stats_globales()` ; 11 policies `*_superadmin` ; `current_agence_id()` bloquante si agence inactive.

- [ ] **Step 1: Fournir à l'utilisateur le script SQL à exécuter**

```sql
-- 1. Rôle superadmin
alter table public.utilisateurs drop constraint if exists utilisateurs_role_check;
alter table public.utilisateurs add constraint utilisateurs_role_check
  check (role in ('gerant','agent','superadmin'));

-- 2. Colonne active sur agences
alter table public.agences add column if not exists active boolean not null default true;

-- 3. Helper superadmin
create or replace function public.is_superadmin()
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from public.utilisateurs where user_id = auth.uid() and role = 'superadmin')
$$;

-- 4. current_agence_id : NULL si l'agence est inactive (blocage RLS total)
create or replace function public.current_agence_id()
returns uuid language sql stable security definer set search_path = public as $$
  select case when a.active then u.agence_id end
  from public.utilisateurs u
  left join public.agences a on a.id = u.agence_id
  where u.user_id = auth.uid()
$$;

-- 5. Policies superadmin (RLS = OR : agence OU superadmin)
create policy agences_select_superadmin on public.agences for select
  using (public.is_superadmin());
create policy agences_update_superadmin on public.agences for update
  using (public.is_superadmin());
create policy utilisateurs_select_superadmin on public.utilisateurs for select
  using (public.is_superadmin());
create policy utilisateurs_insert_superadmin on public.utilisateurs for insert
  with check (public.is_superadmin());
create policy groupes_select_superadmin on public.groupes for select
  using (public.is_superadmin());
create policy pelerins_select_superadmin on public.pelerins for select
  using (public.is_superadmin());
create policy documents_select_superadmin on public.documents for select
  using (public.is_superadmin());
create policy plans_select_superadmin on public.plans_paiement for select
  using (public.is_superadmin());
create policy tranches_select_superadmin on public.tranches for select
  using (public.is_superadmin());
create policy paiements_select_superadmin on public.paiements for select
  using (public.is_superadmin());
create policy rappels_select_superadmin on public.rappels for select
  using (public.is_superadmin());

-- 6. RPC stats globales (une ligne par agence)
create or replace function public.stats_globales()
returns table (
  agence_id uuid, agence_nom text, agence_active boolean,
  pelerins_total bigint, dossiers_valides bigint, dossiers_complets bigint, dossiers_incomplets bigint,
  groupes_total bigint, places_restantes bigint,
  gerants bigint, agents bigint,
  encaissements_total numeric, encaissements_30j numeric,
  tranches_en_retard bigint, rappels_attente bigint, rappels_echec bigint
) language sql stable security definer set search_path = public as $$
  select
    a.id, a.nom, a.active,
    count(distinct p.id) as pelerins_total,
    count(distinct p.id) filter (where p.statut_dossier = 'valide') as dossiers_valides,
    count(distinct p.id) filter (where p.statut_dossier = 'complet') as dossiers_complets,
    count(distinct p.id) filter (where p.statut_dossier = 'incomplet') as dossiers_incomplets,
    count(distinct g.id) as groupes_total,
    coalesce(sum(g.nb_places_max - coalesce(gd.nb, 0)), 0) as places_restantes,
    count(distinct u.id) filter (where u.role = 'gerant') as gerants,
    count(distinct u.id) filter (where u.role = 'agent') as agents,
    coalesce(sum(pa.montant_paye), 0) as encaissements_total,
    coalesce(sum(pa.montant_paye) filter (where pa.date_paiement >= now() - interval '30 days'), 0) as encaissements_30j,
    count(distinct t.id) filter (where t.statut = 'en_retard') as tranches_en_retard,
    count(distinct r.id) filter (where r.statut_envoi = 'en_attente') as rappels_attente,
    count(distinct r.id) filter (where r.statut_envoi = 'echec') as rappels_echec
  from public.agences a
  left join public.pelerins p on p.agence_id = a.id
  left join public.groupes g on g.agence_id = a.id
  left join (select groupe_id, count(*) as nb from public.pelerins group by groupe_id) gd on gd.groupe_id = g.id
  left join public.utilisateurs u on u.agence_id = a.id
  left join public.paiements pa on pa.agence_id = a.id
  left join public.tranches t on t.agence_id = a.id
  left join public.rappels r on r.agence_id = a.id
  group by a.id, a.nom, a.active
  order by a.nom
$$;
```

- [ ] **Step 2: L'utilisateur exécute le script** dans Supabase → SQL Editor → Run. Signaler toute erreur.
- [ ] **Step 3: Mettre à jour `supabase/schema.sql`** pour refléter les mêmes changements (check role, colonne `active` dans `create table public.agences`, fonctions `is_superadmin`/`current_agence_id`/`stats_globales`, 11 policies).
- [ ] **Step 4: Vérification live** — via Chrome headless (compte connecté) : `supabase.rpc('stats_globales')` renvoie les lignes attendues (2 agences seedées).
- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(superadmin): schema - role superadmin, agences.active, policies, rpc stats_globales"
```

---

### Task 2: Types étendus

**Files:**
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: (rien)
- Produces: `Role` inclut `'superadmin'` ; `Agence.active: boolean` ; `interface StatsAgence` (champs exacts de la RPC).

- [ ] **Step 1: Modifier `src/lib/types.ts`**

```ts
export type Role = 'superadmin' | 'gerant' | 'agent'
```

```ts
export interface Agence {
  id: string; nom: string; telephone: string; email: string | null
  adresse: string | null; logo_url: string | null; created_at: string; active: boolean
}
```

Ajouter en fin de fichier :

```ts
export interface StatsAgence {
  agence_id: string; agence_nom: string; agence_active: boolean
  pelerins_total: number; dossiers_valides: number; dossiers_complets: number; dossiers_incomplets: number
  groupes_total: number; places_restantes: number
  gerants: number; agents: number
  encaissements_total: number; encaissements_30j: number
  tranches_en_retard: number; rappels_attente: number; rappels_echec: number
}
```

- [ ] **Step 2: Vérifier** : `npm run build` OK ; `npm test` 24/24 (aucun test ne caste `Agence` complètement — vérifier aucune erreur TS).
- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(superadmin): types - role superadmin, agences.active, stats globales"
```

---

### Task 3: SuperAdminLayout, redirections, routes, garde agence désactivée

**Files:**
- Create: `src/components/layout/SuperAdminLayout.tsx`
- Modify: `src/components/layout/AppLayout.tsx`, `src/App.tsx`
- Test: `src/components/layout/SuperAdminLayout.test.tsx` (ou via AppLayout.test)

**Interfaces:**
- Consumes: `useProfil()` (`{ data: Utilisateur | null, isLoading }`), `useAgence()` (`{ data: Agence | undefined, isLoading }`), `supabase.auth.signOut()`
- Produces: layout protégeant `/superadmin` et `/superadmin/agences` (non-superadmin → `/tableau-de-bord`) ; AppLayout redirige superadmin → `/superadmin` et affiche l'écran « Agence désactivée ».

- [ ] **Step 1: Écrire le test qui échoue** — `src/components/layout/AppLayout.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppLayout from './AppLayout'

const mockUseProfil = vi.hoisted(() => vi.fn())
const mockUseAgence = vi.hoisted(() => vi.fn())

vi.mock('../../hooks/useAgence', () => ({
  useProfil: () => mockUseProfil(),
  useAgence: () => mockUseAgence(),
}))

const queryClient = new QueryClient()

function renderer(chemin: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[chemin]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/tableau-de-bord" element={<div>Dashboard agence</div>} />
          </Route>
          <Route path="/onboarding" element={<div>Onboarding</div>} />
          <Route path="/superadmin" element={<div>Page superadmin</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  mockUseProfil.mockReset()
  mockUseAgence.mockReset()
})

describe('AppLayout', () => {
  it('redirige le superadmin vers /superadmin', async () => {
    mockUseProfil.mockReturnValue({ data: { role: 'superadmin', agence_id: null }, isLoading: false })
    renderer('/tableau-de-bord')
    expect(await screen.findByText('Page superadmin')).toBeInTheDocument()
  })

  it('affiche l’écran de blocage quand l’agence est désactivée', async () => {
    mockUseProfil.mockReturnValue({ data: { role: 'gerant', agence_id: 'a1' }, isLoading: false })
    mockUseAgence.mockReturnValue({ data: { active: false }, isLoading: false })
    renderer('/tableau-de-bord')
    expect(await screen.findByText('Agence désactivée')).toBeInTheDocument()
  })

  it('redirige vers /onboarding quand aucun agence_id', async () => {
    mockUseProfil.mockReturnValue({ data: { role: 'agent', agence_id: null }, isLoading: false })
    renderer('/tableau-de-bord')
    expect(await screen.findByText('Onboarding')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/components/layout/AppLayout.test.tsx`
Expected: FAIL (AppLayout ne gère pas le rôle superadmin ni `active`).

- [ ] **Step 3: Modifier `src/components/layout/AppLayout.tsx`**

```tsx
import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAgence, useProfil } from '../../hooks/useAgence'
import Icon from '../ui/Icon'

export default function AppLayout() {
  const { data: profil, isLoading } = useProfil()
  const { data: agence, isLoading: agenceChargement } = useAgence()
  const [menuOuvert, setMenuOuvert] = useState(false)

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }
  if (!profil) {
    return <div className="flex h-screen items-center justify-center text-error">Profil introuvable.</div>
  }
  if (profil.role === 'superadmin') return <Navigate to="/superadmin" replace />
  if (!profil.agence_id) return <Navigate to="/onboarding" replace />
  if (agenceChargement || !agence) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }
  if (!agence.active) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center shadow-sm">
          <Icon name="block" size={40} className="mx-auto mb-4 text-error" />
          <h1 className="text-headline-md mb-2 text-on-surface">Agence désactivée</h1>
          <p className="text-body-md text-on-surface-variant">Votre agence a été désactivée. Contactez votre administrateur.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar ouverte={menuOuvert} onFermer={() => setMenuOuvert(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOuvrirMenu={() => setMenuOuvert(true)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Créer `src/components/layout/SuperAdminLayout.tsx`**

```tsx
import { useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../hooks/useAgence'
import Icon from '../ui/Icon'

const NAVIGATION = [
  { to: '/superadmin', label: 'Vue d’ensemble', icon: 'dashboard' },
  { to: '/superadmin/agences', label: 'Agences', icon: 'business' },
]

export default function SuperAdminLayout() {
  const navigate = useNavigate()
  const { data: profil, isLoading } = useProfil()
  const [menuOuvert, setMenuOuvert] = useState(false)

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }
  if (!profil) {
    return <div className="flex h-screen items-center justify-center text-error">Profil introuvable.</div>
  }
  if (profil.role !== 'superadmin') return <Navigate to="/tableau-de-bord" replace />

  async function deconnexion() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const contenu = (
    <div className="flex h-full flex-col">
      <div className="mb-10 flex items-center gap-3 px-2 pt-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-on-primary-container">
          <Icon name="admin_panel_settings" size={20} />
        </div>
        <div>
          <h1 className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</h1>
          <p className="text-label-md text-on-surface-variant">Superadmin</p>
        </div>
      </div>
      <ul className="flex-1 space-y-4 overflow-y-auto">
        {NAVIGATION.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={() => setMenuOuvert(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-label-md transition-all ${
                  isActive
                    ? 'translate-x-1 border-l-4 border-secondary-fixed-dim bg-surface-container font-bold text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} fill={isActive} size={20} />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-1 border-t border-outline-variant pt-4">
        <li>
          <button
            type="button"
            onClick={deconnexion}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-label-md text-error hover:bg-error-container"
          >
            <Icon name="logout" size={20} />
            Déconnexion
          </button>
        </li>
      </ul>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-[260px] shrink-0 border-r border-outline-variant bg-surface-container-lowest px-4 py-6 md:block">
        {contenu}
      </aside>
      {menuOuvert && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/30" onClick={() => setMenuOuvert(false)} />
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-surface-container-lowest px-4 py-6 shadow-lg">
            {contenu}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Ouvrir le menu"
              onClick={() => setMenuOuvert(true)}
              className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low md:hidden"
            >
              <Icon name="menu" size={20} />
            </button>
            <h2 className="text-headline-sm font-bold text-primary">Superadmin</h2>
          </div>
          <div className="flex items-center gap-3 border-l border-outline-variant pl-4">
            <div className="hidden text-right lg:block">
              <p className="text-label-md text-on-surface">Superadmin</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-label-md font-bold text-on-primary-container">
              {profil.nom?.charAt(0).toUpperCase() ?? '?'}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Modifier `src/App.tsx`** — ajouter imports et routes

```tsx
import SuperAdminLayout from './components/layout/SuperAdminLayout'
import SuperAdminGlobal from './pages/SuperAdminGlobal'
import SuperAdminAgences from './pages/SuperAdminAgences'
```

```tsx
<Route element={<ProtectedRoute />}>
  <Route path="/onboarding" element={<Onboarding />} />
  <Route element={<SuperAdminLayout />}>
    <Route path="/superadmin" element={<SuperAdminGlobal />} />
    <Route path="/superadmin/agences" element={<SuperAdminAgences />} />
  </Route>
  <Route element={<AppLayout />}>
    { ... routes existantes inchangées ... }
  </Route>
</Route>
```

- [ ] **Step 6: Lancer les tests** — Run: `npx vitest run src/components/layout/AppLayout.test.tsx`
Expected: 3 PASS.
- [ ] **Step 7: Vérifier global** — Run: `npm test` (24 + 3) ; `npm run build` OK.
- [ ] **Step 8: Commit**

```bash
git add src/components/layout/AppLayout.test.tsx src/components/layout/SuperAdminLayout.tsx src/components/layout/AppLayout.tsx src/App.tsx
git commit -m "feat(superadmin): layout dédié, redirections par rôle, garde agence désactivée"
```

---

### Task 4: Page vue globale

**Files:**
- Create: `src/pages/SuperAdminGlobal.tsx`
- Test: `src/pages/SuperAdminGlobal.test.tsx`

**Interfaces:**
- Consumes: `supabase.rpc('stats_globales')` → `StatsAgence[]` ; `formatFCFA()` ; `StatCard` ; `Badge` ; `EmptyState`
- Produces: page `/superadmin` — StatCards globales + tableau par agence.

- [ ] **Step 1: Écrire le test qui échoue** — `src/pages/SuperAdminGlobal.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SuperAdminGlobal from './SuperAdminGlobal'

const mockSupabase = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const fixture: Array<Record<string, unknown>> = [
  {
    agence_id: 'a1', agence_nom: 'Al Hidjah', agence_active: true,
    pelerins_total: 12, dossiers_valides: 4, dossiers_complets: 3, dossiers_incomplets: 5,
    groupes_total: 2, places_restantes: 8,
    gerants: 1, agents: 2,
    encaissements_total: 1500000, encaissements_30j: 400000,
    tranches_en_retard: 1, rappels_attente: 2, rappels_echec: 1,
  },
]

const queryClient = new QueryClient()

beforeEach(() => {
  mockSupabase.rpc.mockReset()
  mockSupabase.rpc.mockResolvedValue({ data: fixture, error: null })
})

describe('SuperAdminGlobal', () => {
  it('affiche les indicateurs globaux et le tableau des agences', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminGlobal />
      </QueryClientProvider>
    )
    expect(await screen.findByText('Vue d’ensemble')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('400 000 FCFA')).toBeInTheDocument()
    expect(screen.getByText('Al Hidjah')).toBeInTheDocument()
    expect(screen.getByText('1 attente / 1 échec')).toBeInTheDocument()
  })

  it('affiche un badge Désactivée pour une agence inactive', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ ...fixture[0], agence_active: false, agence_nom: 'Agence X' }],
      error: null,
    })
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminGlobal />
      </QueryClientProvider>
    )
    expect(await screen.findByText('Désactivée')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/pages/SuperAdminGlobal.test.tsx`
Expected: FAIL (module `./SuperAdminGlobal` inexistant).

- [ ] **Step 3: Créer `src/pages/SuperAdminGlobal.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { StatsAgence } from '../lib/types'
import { formatFCFA } from '../lib/format'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

export default function SuperAdminGlobal() {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stats_globales')
      if (error) throw error
      return (data ?? []) as StatsAgence[]
    },
  })

  const totaux = stats.reduce(
    (acc, s) => ({
      pelerins: acc.pelerins + Number(s.pelerins_total),
      valides: acc.valides + Number(s.dossiers_valides),
      encaisses30: acc.encaisses30 + Number(s.encaissements_30j),
      rappels: acc.rappels + Number(s.rappels_attente),
      actives: acc.actives + (s.agence_active ? 1 : 0),
    }),
    { pelerins: 0, valides: 0, encaisses30: 0, rappels: 0, actives: 0 }
  )

  if (isLoading) return <div className="text-navy">Chargement…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-lg text-on-surface">Vue d’ensemble</h1>
        <p className="text-body-lg mt-1 text-on-surface-variant">Indicateurs globaux de toutes les agences</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Pèlerins" valeur={totaux.pelerins} icon="person" tone="primary" />
        <StatCard label="Dossiers valides" valeur={totaux.valides} icon="verified" tone="vert" />
        <StatCard label="Encaissés (30 j)" valeur={formatFCFA(totaux.encaisses30)} icon="payments" tone="gold" />
        <StatCard label="Rappels en attente" valeur={totaux.rappels} icon="notifications" tone="error" />
        <StatCard label="Agences actives" valeur={`${totaux.actives}/${stats.length}`} icon="business" tone="primary" />
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Agence</th>
                <th className="px-4 py-3">Pèlerins</th>
                <th className="px-4 py-3">Dossiers</th>
                <th className="px-4 py-3">Groupes</th>
                <th className="px-4 py-3">Encaissé</th>
                <th className="px-4 py-3">Retards</th>
                <th className="px-4 py-3">Rappels</th>
                <th className="px-4 py-3">Membres</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.agence_id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary">{s.agence_nom}</span>
                      {!s.agence_active && <Badge tone="rouge">Désactivée</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-4">{s.pelerins_total}</td>
                  <td className="px-4 py-4">
                    <span className="text-vert">{s.dossiers_valides} valides</span>
                    <span className="text-on-surface-variant"> · </span>
                    <span className="text-ambre">{s.dossiers_complets} complets</span>
                    <span className="text-on-surface-variant"> · {s.dossiers_incomplets} incomplets</span>
                  </td>
                  <td className="px-4 py-4">{s.groupes_total} groupes · {s.places_restantes} places libres</td>
                  <td className="px-4 py-4">{formatFCFA(Number(s.encaissements_total))}</td>
                  <td className="px-4 py-4">{s.tranches_en_retard}</td>
                  <td className="px-4 py-4">{s.rappels_attente} attente / {s.rappels_echec} échec</td>
                  <td className="px-4 py-4">{Number(s.gerants) + Number(s.agents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {stats.length === 0 && <EmptyState message="Aucune agence." />}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Lancer le test** — Run: `npx vitest run src/pages/SuperAdminGlobal.test.tsx`
Expected: 2 PASS.
- [ ] **Step 5: Commit**

```bash
git add src/pages/SuperAdminGlobal.tsx src/pages/SuperAdminGlobal.test.tsx
git commit -m "feat(superadmin): page vue d'ensemble - indicateurs globaux par agence"
```

---

### Task 5: Page gestion des agences

**Files:**
- Create: `src/pages/SuperAdminAgences.tsx`
- Test: `src/pages/SuperAdminAgences.test.tsx`

**Interfaces:**
- Consumes: `supabase.from('agences').select('*').order('nom')` ; insert agences puis utilisateurs ; `Agence` type ; `Modal` ; `Field`/`Input` ; `Button` ; `Badge`
- Produces: page `/superadmin/agences` — liste + création + toggle désactivation (confirmation).

- [ ] **Step 1: Écrire le test qui échoue** — `src/pages/SuperAdminAgences.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SuperAdminAgences from './SuperAdminAgences'

const mockSupabase = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const queryClient = new QueryClient()

function chaine(insertions: unknown) {
  return {
    select: () => ({ single: () => Promise.resolve(insertions) }),
  }
}

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'agences') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [{ id: 'a1', nom: 'Al Hidjah', telephone: '771234567', email: 'contact@alhidjah.sn', adresse: 'Dakar', created_at: '2026-01-01T00:00:00Z', active: true }], error: null }) }),
        insert: () => chaine({ data: { id: 'a2' }, error: null }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      }
    }
    return { insert: () => Promise.resolve({ data: null, error: null }) }
  })
})

describe('SuperAdminAgences', () => {
  it('affiche la liste des agences', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminAgences />
      </QueryClientProvider>
    )
    expect(await screen.findByText('Al Hidjah')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('crée une agence puis le compte gérant', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminAgences />
      </QueryClientProvider>
    )
    fireEvent.click(await screen.findByText('Créer une agence'))
    fireEvent.change(screen.getByLabelText('Nom de l’agence'), { target: { value: 'Agence Test' } })
    fireEvent.change(screen.getByLabelText('Nom du gérant'), { target: { value: 'Gérant Test' } })
    fireEvent.change(screen.getByLabelText('Email du gérant'), { target: { value: 'gerant@test.sn' } })
    fireEvent.click(screen.getByText('Créer'))
    expect(await screen.findByText(/Impossible/)).not.toBeInTheDocument()
    const calls = mockSupabase.from.mock.calls.map((c) => c[0])
    expect(calls).toContain('utilisateurs')
  })

  it('désactive une agence après confirmation', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminAgences />
      </QueryClientProvider>
    )
    fireEvent.click(await screen.findByTitle('Désactiver'))
    expect(screen.getByText(/Désactiver « Al Hidjah »/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Confirmer'))
    expect(await screen.findByText(/Agence désactivée/)).not.toBeInTheDocument()
  })
})
```

Note : `getByLabelText` fonctionne car `Field` lie `label` et `input` par position dans le DOM ? Non — le `Field` actuel n'utilise pas `htmlFor`. Utiliser plutôt un sélecteur : `screen.getByDisplayValue` après `fireEvent.change(screen.getAllByRole('textbox')[0], ...)`. Adapter les assertions en conséquence pendant l'implémentation (3 textbox dans l'ordre : nom, téléphone, email, adresse, nom gérant, email gérant — utiliser `getAllByRole('textbox')`).

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/pages/SuperAdminAgences.test.tsx`
Expected: FAIL (module inexistant).

- [ ] **Step 3: Créer `src/pages/SuperAdminAgences.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Agence } from '../lib/types'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { Field, Input } from '../components/ui/Field'
import Icon from '../components/ui/Icon'

export default function SuperAdminAgences() {
  const queryClient = useQueryClient()
  const [formOuvert, setFormOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')
  const [gerantNom, setGerantNom] = useState('')
  const [gerantEmail, setGerantEmail] = useState('')
  const [erreur, setErreur] = useState('')
  const [aConfirmer, setAConfirmer] = useState<Agence | null>(null)

  const { data: agences = [] } = useQuery({
    queryKey: ['superadmin-agences'],
    queryFn: async () => {
      const { data } = await supabase.from('agences').select('*').order('nom')
      return data as Agence[]
    },
  })

  const creer = useMutation({
    mutationFn: async () => {
      const { data: agence, error: errAgence } = await supabase
        .from('agences')
        .insert({ nom, telephone, email: email || null, adresse: adresse || null })
        .select('id')
        .single()
      if (errAgence) throw errAgence
      const { error: errGerant } = await supabase.from('utilisateurs').insert({
        agence_id: agence.id,
        nom: gerantNom,
        email: gerantEmail,
        telephone: '',
        role: 'gerant',
      })
      if (errGerant) throw errGerant
    },
    onSuccess: () => {
      setFormOuvert(false)
      setNom('')
      setTelephone('')
      setEmail('')
      setAdresse('')
      setGerantNom('')
      setGerantEmail('')
      setErreur('')
      queryClient.invalidateQueries({ queryKey: ['superadmin-agences'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
    },
    onError: () => setErreur('Impossible de créer l’agence. Vérifiez que l’email du gérant est unique.'),
  })

  const basculerActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('agences').update({ active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      setAConfirmer(null)
      queryClient.invalidateQueries({ queryKey: ['superadmin-agences'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-stats'] })
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    creer.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Agences</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Créez et gérez les agences de la plateforme</p>
        </div>
        <Button onClick={() => setFormOuvert(true)}>
          <Icon name="add" size={16} className="mr-2" />
          Créer une agence
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Adresse</th>
                <th className="px-4 py-3">Créée le</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {agences.map((a) => (
                <tr key={a.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4 font-medium text-primary">{a.nom}</td>
                  <td className="px-4 py-4">{a.telephone || '—'}</td>
                  <td className="px-4 py-4">{a.email ?? '—'}</td>
                  <td className="px-4 py-4">{a.adresse ?? '—'}</td>
                  <td className="px-4 py-4">{new Date(a.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-4">
                    {a.active ? <Badge tone="vert">Active</Badge> : <Badge tone="rouge">Désactivée</Badge>}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => setAConfirmer(a)}
                        title={a.active ? 'Désactiver' : 'Réactiver'}
                        className={`rounded-lg p-2 hover:bg-surface-container ${a.active ? 'text-error hover:text-error' : 'text-vert hover:text-vert'}`}
                      >
                        <Icon name={a.active ? 'block' : 'check_circle'} size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {agences.length === 0 && <EmptyState message="Aucune agence." />}
        </div>
      </div>

      <Modal open={formOuvert} title="Créer une agence" onClose={() => setFormOuvert(false)}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nom de l’agence">
            <Input required value={nom} onChange={(e) => setNom(e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Téléphone">
              <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <Field label="Adresse">
            <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </Field>
          <div className="border-t border-outline-variant pt-4">
            <p className="mb-3 text-label-md font-semibold text-primary">Compte gérant</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom du gérant">
                <Input required value={gerantNom} onChange={(e) => setGerantNom(e.target.value)} />
              </Field>
              <Field label="Email du gérant">
                <Input type="email" required value={gerantEmail} onChange={(e) => setGerantEmail(e.target.value)} />
              </Field>
            </div>
            <p className="mt-2 text-label-md text-on-surface-variant">Le gérant s'inscrira avec cet email pour activer son compte.</p>
          </div>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFormOuvert(false)}>Annuler</Button>
            <Button type="submit" disabled={creer.isPending}>Créer</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!aConfirmer}
        title={aConfirmer?.active ? "Désactiver l'agence" : "Réactiver l'agence"}
        onClose={() => setAConfirmer(null)}
      >
        <p className="text-body-md text-on-surface-variant">
          {aConfirmer?.active
            ? `Désactiver « ${aConfirmer.nom} » ? Ses membres ne pourront plus accéder à leurs données.`
            : `Réactiver « ${aConfirmer.nom} » ? Ses membres retrouveront l'accès.`}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setAConfirmer(null)}>Annuler</Button>
          <Button
            type="button"
            variant={aConfirmer?.active ? 'danger' : 'primary'}
            disabled={basculerActive.isPending}
            onClick={() => aConfirmer && basculerActive.mutate({ id: aConfirmer.id, active: !aConfirmer.active })}
          >
            Confirmer
          </Button>
        </div>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 4: Ajuster le test** si nécessaire (sélecteurs `getAllByRole('textbox')` car `Field` n'utilise pas `htmlFor`) puis lancer : `npx vitest run src/pages/SuperAdminAgences.test.tsx`
Expected: 3 PASS.
- [ ] **Step 5: Commit**

```bash
git add src/pages/SuperAdminAgences.tsx src/pages/SuperAdminAgences.test.tsx
git commit -m "feat(superadmin): page gestion des agences - création avec compte gérant, désactivation"
```

---

### Task 6: Compte superadmin + vérification réelle

- [ ] **Step 1: Utilisateur** — s'inscrire via l'app (email dédié, ex. `superadmin@alhidjah.sn`), puis SQL Editor :

```sql
update public.utilisateurs set role = 'superadmin'
where email = '<email utilisé>';
```

- [ ] **Step 2: Vérification Chrome headless (compte superadmin)** :
  1. Login → redirigé vers `/superadmin` (pas `/onboarding`)
  2. Vue d'ensemble : StatCards + tableau avec les 2 agences seedées
  3. `/superadmin/agences` : liste ; créer l'agence test « Agence Test » avec gérant `geranttest@…` ; la ligne apparaît
  4. Désactiver l'agence test → badge « Désactivée »
  5. Se connecter avec le compte gérant de l'agence test (inscription) → écran « Agence désactivée »
  6. Réactiver → l'accès membre fonctionne
  7. Nettoyer : désactiver/supprimer les données de test si besoin
- [ ] **Step 3: Commit si ajustement** (sinon rien).

---

### Task 7: Vérifications finales

- [ ] **Step 1: Run** `npm run build` → ✓ built ; `npm test` → 24 + nouveaux tous verts.
- [ ] **Step 2: Run** `npm run lint` → aucun nouveau problème.
- [ ] **Step 3: Mettre à jour le ledger** `.superpowers/sdd/progress.md` (section superadmin).
- [ ] **Step 4: Commit final** si fichiers non commités.
- [ ] **Step 5: Récapitulatif** à l'utilisateur (étapes manuelles restantes : SQL déjà exécuté, compte superadmin, déploiement, désactivation « Confirm email »).
