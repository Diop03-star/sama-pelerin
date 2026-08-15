# Page détails d'agence (superadmin) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer une page `/superadmin/agences/:id` affichant les détails d'une agence (infos + stats) et rendre le nom des agences cliquable depuis la Vue d'ensemble et la page Agences.

**Architecture:** Réutilise le RPC `stats_globales()` existant (filtré côté client sur `agence_id`) et une requête `agences` simple. Aucun changement SQL. Suit les patterns de `PelerinDetail.tsx` (états chargement/introuvable, breadcrumb) et des pages superadmin existantes (StatCard, Badge, formatFCFA, formatDate).

**Tech Stack:** React 19, TypeScript, Vite, Tailwind 4, @tanstack/react-query, react-router-dom 7, Supabase, Vitest + Testing Library.

## Global Constraints

- Textes de l'UI en français, apostrophes typographiques (») comme dans le reste du code (ex. « Vue d'ensemble », « Désactivée », « Agence introuvable. »).
- Type des stats : `StatsAgence` de `src/lib/types.ts` (champs : `agence_id`, `agence_nom`, `agence_active`, `pelerins_total`, `dossiers_valides`, `dossiers_complets`, `dossiers_incomplets`, `groupes_total`, `places_restantes`, `gerants`, `agents`, `encaissements_total`, `encaissements_30j`, `tranches_en_retard`, `rappels_attente`, `rappels_echec`).
- Type `Agence` de `src/lib/types.ts` (champs : `id`, `nom`, `telephone`, `email`, `adresse`, `logo_url`, `created_at`, `active`).
- Toute page qui rend un `Link` doit être testée/wrappée dans un `MemoryRouter`.
- Vérifications : `npm run lint` (oxlint), `npm test` (vitest run), `npm run build` (tsc -b && vite build).

---

### Task 1: Page `SuperAdminAgenceDetail` + route

**Files:**
- Create: `src/pages/SuperAdminAgenceDetail.tsx`
- Create: `src/pages/SuperAdminAgenceDetail.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `supabase` (`src/lib/supabase.ts`), `StatsAgence` et `Agence` (`src/lib/types.ts`), `formatFCFA`/`formatDate` (`src/lib/format.ts`), composants `StatCard`, `Badge`, `Icon` (`src/components/ui/`), `Link`/`useParams` de react-router-dom.
- Produces: route `/superadmin/agences/:id` (utilisée par les `Link` de Task 2).

- [ ] **Step 1: Écrire le test qui échoue**

Create `src/pages/SuperAdminAgenceDetail.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SuperAdminAgenceDetail from './SuperAdminAgenceDetail'

const mockSupabase = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const statsFixture = {
  agence_id: 'a1', agence_nom: 'Al Hidjah', agence_active: true,
  pelerins_total: 12, dossiers_valides: 4, dossiers_complets: 3, dossiers_incomplets: 5,
  groupes_total: 2, places_restantes: 8,
  gerants: 1, agents: 2,
  encaissements_total: 1500000, encaissements_30j: 400000,
  tranches_en_retard: 1, rappels_attente: 2, rappels_echec: 1,
}

const agenceFixture = {
  id: 'a1', nom: 'Al Hidjah', telephone: '771234567', email: 'contact@alhidjah.sn',
  adresse: 'Dakar', logo_url: null, created_at: '2026-01-01T00:00:00Z', active: true,
}

function rendre(agence: unknown = agenceFixture, stats: unknown[] = [statsFixture]) {
  const queryClient = new QueryClient()
  mockSupabase.rpc.mockResolvedValue({ data: stats, error: null })
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'agences') {
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: agence, error: null }) }) }) }
    }
    return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/superadmin/agences/a1']}>
        <Routes>
          <Route path="/superadmin/agences/:id" element={<SuperAdminAgenceDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SuperAdminAgenceDetail', () => {
  it('affiche les infos et les stats de l’agence', async () => {
    rendre()
    expect(await screen.findByText('Al Hidjah')).toBeInTheDocument()
    expect(screen.getByText('771234567')).toBeInTheDocument()
    expect(screen.getByText('contact@alhidjah.sn')).toBeInTheDocument()
    expect(screen.getByText('Dakar')).toBeInTheDocument()
    expect(screen.getByText('01/01/2026')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('1 500 000')).toBeInTheDocument()
    expect(screen.getByText('2 attente / 1 échec')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('affiche le badge Désactivée pour une agence inactive', async () => {
    rendre({ ...agenceFixture, active: false }, [{ ...statsFixture, agence_active: false }])
    expect(await screen.findByText('Désactivée')).toBeInTheDocument()
  })

  it('affiche « Agence introuvable. » quand l’id ne correspond à aucune agence', async () => {
    rendre(null, [])
    expect(await screen.findByText('Agence introuvable.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run src/pages/SuperAdminAgenceDetail.test.tsx`
Expected: FAIL — « Cannot find module './SuperAdminAgenceDetail' »

- [ ] **Step 3: Implémenter la page**

Create `src/pages/SuperAdminAgenceDetail.tsx`:

```tsx
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Agence, StatsAgence } from '../lib/types'
import { formatDate, formatFCFA } from '../lib/format'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import Icon from '../components/ui/Icon'

export default function SuperAdminAgenceDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stats_globales')
      if (error) throw error
      return (data ?? []) as StatsAgence[]
    },
  })

  const { data: agence } = useQuery({
    queryKey: ['superadmin-agence-infos', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from('agences').select('*').eq('id', id!).single()
      return data as Agence | null
    },
  })

  if (isLoading) return <div className="text-on-surface">Chargement…</div>

  const s = stats?.find((row) => row.agence_id === id)
  if (!agence || !s) return <div className="text-error">Agence introuvable.</div>

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-label-md text-on-surface-variant">
          <Link to="/superadmin/agences" className="hover:text-primary">Agences</Link>
          <Icon name="chevron_right" size={16} />
          <span className="font-bold text-primary">Détails</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-display-lg text-on-surface">{agence.nom}</h1>
          {!agence.active && <Badge tone="rouge">Désactivée</Badge>}
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant">Téléphone</span>
            <span className="text-body-md text-on-surface">{agence.telephone || '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant">Email</span>
            <span className="text-body-md text-on-surface">{agence.email ?? '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant">Adresse</span>
            <span className="text-body-md text-on-surface">{agence.adresse ?? '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant">Créée le</span>
            <span className="text-body-md text-on-surface">{formatDate(agence.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pèlerins" valeur={s.pelerins_total} icon="person" tone="primary" />
        <StatCard
          label="Dossiers"
          valeur={
            <span className="text-body-md text-on-surface">
              <span className="text-vert">{s.dossiers_valides} valides</span>
              <span className="text-on-surface-variant"> · </span>
              <span className="text-ambre">{s.dossiers_complets} complets</span>
              <span className="text-on-surface-variant"> · </span>
              {s.dossiers_incomplets} incomplets
            </span>
          }
          icon="verified"
          tone="vert"
        />
        <StatCard
          label="Groupes"
          valeur={`${s.groupes_total} groupes · ${s.places_restantes} places libres`}
          icon="group"
          tone="primary"
        />
        <StatCard label="Total encaissé" valeur={s.encaissements_total} icon="payments" tone="gold" monetaire />
        <StatCard label="Retards" valeur={s.tranches_en_retard} icon="schedule" tone="error" />
        <StatCard label="Rappels" valeur={`${s.rappels_attente} attente / ${s.rappels_echec} échec`} icon="notifications" tone="error" />
        <StatCard label="Membres" valeur={Number(s.gerants) + Number(s.agents)} icon="business" tone="primary" />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Ajouter la route dans `src/App.tsx`**

Add import after line 8 (`import SuperAdminAgences from './pages/SuperAdminAgences'`):

```tsx
import SuperAdminAgenceDetail from './pages/SuperAdminAgenceDetail'
```

Add route after line 34 (`<Route path="/superadmin/agences" element={<SuperAdminAgences />} />`):

```tsx
<Route path="/superadmin/agences/:id" element={<SuperAdminAgenceDetail />} />
```

- [ ] **Step 5: Vérifier que le test passe**

Run: `npx vitest run src/pages/SuperAdminAgenceDetail.test.tsx`
Expected: 3 tests PASS

- [ ] **Step 6: Suite complète, lint et commit**

Run: `npm test` puis `npm run lint`
Expected: tous les tests passent, oxlint sans erreur.

```bash
git add src/pages/SuperAdminAgenceDetail.tsx src/pages/SuperAdminAgenceDetail.test.tsx src/App.tsx
git commit -m "feat: page détails d'agence superadmin + route"
```

---

### Task 2: Rendre les agences cliquables (Vue d'ensemble + Agences)

**Files:**
- Modify: `src/pages/SuperAdminGlobal.tsx:104-110`
- Modify: `src/pages/SuperAdminGlobal.test.tsx`
- Modify: `src/pages/SuperAdminAgences.tsx:112`
- Modify: `src/pages/SuperAdminAgences.test.tsx`

**Interfaces:**
- Consumes: route `/superadmin/agences/:id` de Task 1, `Link` de react-router-dom.
- Produces: nom des agences cliquable sur les deux pages superadmin.

- [ ] **Step 1: Rendre le nom cliquable dans `SuperAdminGlobal.tsx`**

Add import after line 1 (`import { useState } from 'react'`):

```tsx
import { Link } from 'react-router-dom'
```

Replace lines 104-110:

```tsx
              <tr key={s.agence_id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary">{s.agence_nom}</span>
                      {!s.agence_active && <Badge tone="rouge">Désactivée</Badge>}
                    </div>
                  </td>
```

with:

```tsx
              <tr key={s.agence_id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/superadmin/agences/${s.agence_id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                        {s.agence_nom}
                      </Link>
                      {!s.agence_active && <Badge tone="rouge">Désactivée</Badge>}
                    </div>
                  </td>
```

- [ ] **Step 2: Wrapper les tests de `SuperAdminGlobal.test.tsx` dans un `MemoryRouter`**

Add import after line 4 (`import SuperAdminGlobal from './SuperAdminGlobal'`):

```tsx
import { MemoryRouter } from 'react-router-dom'
```

Replace the three `render(...)` calls (lines 46-50, 64-68, 73-77) — each currently:

```tsx
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminGlobal />
      </QueryClientProvider>
    )
```

with:

```tsx
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SuperAdminGlobal />
        </MemoryRouter>
      </QueryClientProvider>
    )
```

- [ ] **Step 3: Rendre le nom cliquable dans `SuperAdminAgences.tsx`**

Add import after line 1 (`import { useState, type FormEvent } from 'react'`):

```tsx
import { Link } from 'react-router-dom'
```

Replace line 112:

```tsx
                  <td className="px-4 py-4 font-medium text-primary">{a.nom}</td>
```

with:

```tsx
                  <td className="px-4 py-4">
                    <Link to={`/superadmin/agences/${a.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                      {a.nom}
                    </Link>
                  </td>
```

- [ ] **Step 4: Wrapper les tests de `SuperAdminAgences.test.tsx` dans un `MemoryRouter`**

Add import after line 4 (`import SuperAdminAgences from './SuperAdminAgences'`):

```tsx
import { MemoryRouter } from 'react-router-dom'
```

Replace the `rendre()` helper (lines 40-46):

```tsx
function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SuperAdminAgences />
      </MemoryRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 5: Suite complète et lint**

Run: `npm test` puis `npm run lint`
Expected: tous les tests passent (les assertions existantes comme `getByText('Al Hidjah')` continuent de matcher dans les `Link`), oxlint sans erreur.

- [ ] **Step 6: Build et commit**

Run: `npm run build`
Expected: `tsc -b` sans erreur de type, build vite OK.

```bash
git add src/pages/SuperAdminGlobal.tsx src/pages/SuperAdminGlobal.test.tsx src/pages/SuperAdminAgences.tsx src/pages/SuperAdminAgences.test.tsx
git commit -m "feat: agences cliquables vers la page détails"
```