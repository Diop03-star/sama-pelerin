# Filtre de période sur le total encaissé — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un filtre Jour/Semaine/Mois/Année sur le montant total encaissé (dashboard gérant + vue superadmin) et garantir l'affichage des montants sur une seule ligne.

**Architecture:** Type `Periode` + helper `debutPeriode()` dans un nouveau `src/lib/dates.ts`. Filtre = composant segmenté `FiltrePeriode`. `StatCard` gagne 2 props optionnelles (`monetaire`, `actions`) + suffixe de tendance personnalisable — aucun usage existant ne change. Les requêtes encaissements sont filtrées côté serveur (`.gte('date_paiement', ...)`), `queryKey` paramétrée par période. Superadmin : calcul client des encaissements par agence via embedding `tranche:plans_paiement(pelerin:pelerins(agence_id))` — **aucun changement SQL**.

**Tech Stack:** React 18 + Vite, TypeScript, TanStack Query v5, Supabase JS, Vitest + Testing Library (`fireEvent` — pas de userEvent), Tailwind (jetons : `text-display-lg` 32px, `text-headline-md` 24px, `text-headline-sm` 20px — PAS de `headline-lg`).

## Global Constraints

- NE JAMAIS modifier : `src/lib/plan.ts`, `src/lib/format.ts`, `src/auth/*`, `src/hooks/useAgence.ts`, `src/lib/supabase.ts`, `supabase/seed.sql`, tests existants non listés dans ce plan.
- Exception autorisée : `src/components/ui/StatCard.tsx` (props optionnelles uniquement), `src/pages/Dashboard.tsx`, `src/pages/SuperAdminGlobal.tsx`, `src/pages/SuperAdminGlobal.test.tsx`.
- `formatFCFA(n)` renvoie `'X FCFA'` avec espaces normales (les espaces insécables fr-FR sont remplacées) — suffixe découpable via `lastIndexOf(' FCFA')`.
- Environnement : Windows PowerShell, `npm` disponible ; tests : `npx vitest run` ; build : `npm run build` ; lint : `npm run lint` (seul warning préexistant : `src/auth/AuthContext.tsx:31`).
- Commits fréquents, messages courts en français (style du repo : `fix(...)`, `feat(...)`).

---

### Task 1: Helper de périodes — `src/lib/dates.ts`

**Files:**
- Create: `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

**Interfaces:**
- Produces: `export type Periode = 'jour' | 'semaine' | 'mois' | 'annee'` ; `export const LIBELLES_PERIODE: Record<Periode, string>` ; `export function debutPeriode(periode: Periode): Date` ; `export function nomPeriode(periode: Periode): string`. Utilisé par Task 2 (FiltrePeriode), Task 4 (Dashboard), Task 5 (SuperAdminGlobal).

- [ ] **Step 1: Write the failing test** — `src/lib/dates.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { debutPeriode, nomPeriode } from './dates'

afterEach(() => vi.useRealTimers())

describe('debutPeriode', () => {
  it('jour : début de la journée', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T15:30:00'))
    const d = debutPeriode('jour')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)
    expect(d.getDate()).toBe(14)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it('semaine : 7 jours glissants', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T15:30:00'))
    expect(debutPeriode('semaine').toISOString()).toBe(new Date('2026-08-07T15:30:00').toISOString())
  })

  it('mois : 1er du mois à 00:00', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T15:30:00'))
    expect(debutPeriode('mois').toISOString()).toBe(new Date('2026-08-01T00:00:00').toISOString())
  })

  it('annee : 1er janvier à 00:00', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T15:30:00'))
    expect(debutPeriode('annee').toISOString()).toBe(new Date('2026-01-01T00:00:00').toISOString())
  })
})

describe('nomPeriode', () => {
  it('retourne le libellé de chaque période', () => {
    expect(nomPeriode('jour')).toBe("aujourd'hui")
    expect(nomPeriode('semaine')).toBe('7 derniers jours')
    expect(nomPeriode('mois')).toBe('ce mois-ci')
    expect(nomPeriode('annee')).toBe('cette année')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL — `Cannot find module './dates'`

- [ ] **Step 3: Write minimal implementation** — `src/lib/dates.ts`

```ts
export type Periode = 'jour' | 'semaine' | 'mois' | 'annee'

export const LIBELLES_PERIODE: Record<Periode, string> = {
  jour: 'Jour',
  semaine: 'Semaine',
  mois: 'Mois',
  annee: 'Année',
}

export function debutPeriode(periode: Periode): Date {
  const debut = new Date()
  if (periode === 'jour') {
    debut.setHours(0, 0, 0, 0)
  } else if (periode === 'semaine') {
    debut.setDate(debut.getDate() - 7)
  } else if (periode === 'mois') {
    debut.setDate(1)
    debut.setHours(0, 0, 0, 0)
  } else {
    debut.setMonth(0, 1)
    debut.setHours(0, 0, 0, 0)
  }
  return debut
}

export function nomPeriode(periode: Periode): string {
  if (periode === 'jour') return "aujourd'hui"
  if (periode === 'semaine') return '7 derniers jours'
  if (periode === 'mois') return 'ce mois-ci'
  return 'cette année'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat: helper de périodes (jour/semaine/mois/annee)"
```

---

### Task 2: Composant segmenté `FiltrePeriode`

**Files:**
- Create: `src/components/ui/FiltrePeriode.tsx`
- Test: `src/components/ui/FiltrePeriode.test.tsx`

**Interfaces:**
- Consumes: `Periode`, `LIBELLES_PERIODE` from `../../lib/dates` (Task 1).
- Produces: `export default function FiltrePeriode({ periode, onChange }: { periode: Periode; onChange: (periode: Periode) => void }): JSX.Element`. Utilisé par Task 4 et Task 5.

- [ ] **Step 1: Write the failing test** — `src/components/ui/FiltrePeriode.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FiltrePeriode from './FiltrePeriode'

describe('FiltrePeriode', () => {
  it('affiche les 4 périodes et le bouton actif', () => {
    render(<FiltrePeriode periode="mois" onChange={() => {}} />)
    for (const libelle of ['Jour', 'Semaine', 'Mois', 'Année']) {
      expect(screen.getByRole('button', { name: libelle })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Mois' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'Jour' })).not.toHaveClass('bg-primary')
  })

  it('notifie le changement de période', () => {
    const onChange = vi.fn()
    render(<FiltrePeriode periode="annee" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }))
    expect(onChange).toHaveBeenCalledWith('semaine')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/FiltrePeriode.test.tsx`
Expected: FAIL — `Cannot find module './FiltrePeriode'`

- [ ] **Step 3: Write minimal implementation** — `src/components/ui/FiltrePeriode.tsx`

```tsx
import type { Periode } from '../../lib/dates'
import { LIBELLES_PERIODE } from '../../lib/dates'

interface FiltrePeriodeProps {
  periode: Periode
  onChange: (periode: Periode) => void
}

const ORDRE: Periode[] = ['jour', 'semaine', 'mois', 'annee']

export default function FiltrePeriode({ periode, onChange }: FiltrePeriodeProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-outline-variant bg-surface-container-lowest p-1"
      role="group"
      aria-label="Filtrer par période"
    >
      {ORDRE.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-md px-3 py-1.5 text-label-md transition-colors ${
            p === periode
              ? 'bg-primary text-on-primary'
              : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
          }`}
        >
          {LIBELLES_PERIODE[p]}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/FiltrePeriode.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/FiltrePeriode.tsx src/components/ui/FiltrePeriode.test.tsx
git commit -m "feat: composant FiltrePeriode (jour/semaine/mois/annee)"
```

---

### Task 3: `StatCard` — props `monetaire`, `actions`, suffixe de tendance

**Files:**
- Modify: `src/components/ui/StatCard.tsx` (réécriture complète ci-dessous)
- Test: `src/components/ui/StatCard.test.tsx` (nouveau)

**Interfaces:**
- Produces: `StatCardProps` gagne `monetaire?: boolean`, `actions?: ReactNode`, et `tendance.suffixe?: string` (défaut `'cette semaine'` — comportement actuel préservé ; `''` masque le suffixe). Utilisé par Task 4 et Task 5.

- [ ] **Step 1: Write the failing test** — `src/components/ui/StatCard.test.tsx`

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatCard from './StatCard'

describe('StatCard', () => {
  it('affiche une valeur monétaire compacte : une ligne, unité réduite', () => {
    render(<StatCard label="Total encaissé" valeur={5120000000} icon="payments" tone="gold" grande monetaire />)
    const montant = screen.getByText('5 120 000 000')
    expect(montant).toBeInTheDocument()
    expect(screen.getByText('FCFA')).toBeInTheDocument()
    expect(montant.closest('h3')?.className).toContain('text-headline-md')
  })

  it('rend le slot actions', () => {
    render(
      <StatCard label="Total" valeur={1} icon="payments" actions={<button type="button">Filtre</button>} />
    )
    expect(screen.getByRole('button', { name: 'Filtre' })).toBeInTheDocument()
  })

  it('affiche le suffixe de tendance par défaut', () => {
    render(<StatCard label="Pèlerins" valeur={5} icon="group" tendance={{ texte: '3 dossiers validés', positif: true }} />)
    expect(screen.getByText('cette semaine')).toBeInTheDocument()
  })

  it('masque le suffixe de tendance quand il est vide', () => {
    render(<StatCard label="Pèlerins" valeur={5} icon="group" tendance={{ texte: "aujourd'hui", positif: true, suffixe: '' }} />)
    expect(screen.getByText("aujourd'hui")).toBeInTheDocument()
    expect(screen.queryByText('cette semaine')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/StatCard.test.tsx`
Expected: FAIL — le rendu `monetaire` n'existe pas (la valeur est affichée telle quelle), pas de `actions`, pas de `suffixe`

- [ ] **Step 3: Write minimal implementation** — `src/components/ui/StatCard.tsx` (remplacement complet du fichier)

```tsx
import type { ReactNode } from 'react'
import Icon from './Icon'
import { formatFCFA } from '../../lib/format'

interface StatCardProps {
  label: string
  valeur: ReactNode
  icon: string
  tone?: 'primary' | 'gold' | 'vert' | 'error'
  tendance?: { texte: string; positif?: boolean; suffixe?: string }
  grande?: boolean
  monetaire?: boolean
  actions?: ReactNode
}

const TONES: Record<string, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  gold: 'bg-secondary-container text-on-secondary-container',
  vert: 'bg-green-50 text-green-700',
  error: 'bg-error-container text-on-error-container',
}

function decoupeFCFA(texte: string): { montant: string; unite: string } {
  const idx = texte.lastIndexOf(' FCFA')
  return { montant: texte.slice(0, idx), unite: texte.slice(idx + 1) }
}

export default function StatCard({
  label, valeur, icon, tone = 'primary', tendance, grande = false, monetaire = false, actions,
}: StatCardProps) {
  const pieces = monetaire && typeof valeur === 'number' ? decoupeFCFA(formatFCFA(valeur)) : null
  const suffixeTendance = tendance?.suffixe ?? 'cette semaine'
  return (
    <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="pointer-events-none absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-primary/5" />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant">{label}</p>
          <h3 className={`mt-2 text-on-surface ${grande ? (monetaire ? 'text-headline-md' : 'text-display-lg') : 'text-headline-md'}`}>
            {pieces ? (
              <span className="flex flex-wrap items-baseline gap-x-1 whitespace-nowrap tabular-nums">
                {pieces.montant}
                <span className="text-body-md text-on-surface-variant">{pieces.unite}</span>
              </span>
            ) : (
              valeur
            )}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${TONES[tone]}`}>
            <Icon name={icon} size={24} />
          </div>
        </div>
      </div>
      {tendance && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className={`flex items-center rounded-md px-2 py-1 text-label-md ${tendance.positif === false ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            <Icon name={tendance.positif === false ? 'trending_down' : 'trending_up'} size={16} className="mr-1" />
            {tendance.texte}
          </span>
          {suffixeTendance && <span className="text-body-md text-on-surface-variant">{suffixeTendance}</span>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/StatCard.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Regression — tous les tests existants**

Run: `npx vitest run`
Expected: PASS (36 tests : 32 existants + 4 StatCard)

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/StatCard.tsx src/components/ui/StatCard.test.tsx
git commit -m "feat(StatCard): rendu monetaire une ligne, slot actions, suffixe de tendance"
```

---

### Task 4: Dashboard gérant — filtre sur « Total encaissé »

**Files:**
- Modify: `src/pages/Dashboard.tsx` (voir code exact ci-dessous)
- Vérif : `npm run build` + `npx vitest run`

**Interfaces:**
- Consumes: `Periode`, `debutPeriode`, `nomPeriode` (Task 1), `FiltrePeriode` (Task 2), `StatCard monetaire/actions/tendance.suffixe` (Task 3).

- [ ] **Step 1: Mettre à jour les imports** — `src/pages/Dashboard.tsx` (ligne 1-15)

Ajouter après la ligne 2 (`import { useQuery } ...`), et remplacer le bloc d'imports pour inclure :

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  LIBELLES_DOCUMENT, LIBELLES_RAPPEL, TONE_RAPPEL,
  formatDate, formatFCFA, messageDocument, messageTranche, whatsappUrl,
} from '../lib/format'
import { debutPeriode, nomPeriode, type Periode } from '../lib/dates'
import type { Pelerin, Tranche } from '../lib/types'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import WhatsAppIcon from '../components/ui/WhatsAppIcon'
import StatCard from '../components/ui/StatCard'
import AlertLink from '../components/ui/AlertLink'
import ProgressBar from '../components/ui/ProgressBar'
import FiltrePeriode from '../components/ui/FiltrePeriode'
```

- [ ] **Step 2: Remplacer la requête encaissements + ajouter l'état période**

Dans `Dashboard()` (après la déclaration de `rappels`), remplacer l'ancienne query `dashboard-encaissements` (lignes 91-99 actuelles) par :

```tsx
  const [periode, setPeriode] = useState<Periode>('annee')

  const { data: plans = [] } = useQuery({
    queryKey: ['dashboard-attendu'],
    queryFn: async () => {
      const { data } = await supabase.from('plans_paiement').select('montant_total')
      return (data ?? []) as { montant_total: number }[]
    },
  })

  const { data: paiementsFiltres = [] } = useQuery({
    queryKey: ['dashboard-encaissements', periode],
    queryFn: async () => {
      const { data } = await supabase
        .from('paiements')
        .select('montant_paye')
        .gte('date_paiement', debutPeriode(periode).toISOString())
      return (data ?? []) as { montant_paye: number }[]
    },
  })
```

- [ ] **Step 3: Recalculer les totaux** — remplacer les lignes 103-109 par :

```tsx
  const valides = pelerins.filter((p) => p.statut_dossier === 'valide').length
  const totalPelerins = pelerins.length
  const totalAttendu = plans.reduce((s, p) => s + p.montant_total, 0)
  const totalPaye = paiementsFiltres.reduce((s, p) => s + p.montant_paye, 0)
  const resteGlobal = totalAttendu - totalPaye
  const progression = totalAttendu > 0 ? Math.round((totalPaye / totalAttendu) * 100) : 0
```

> Remarque : `resteGlobal` et `progression` restent calculés sur le total encaissé global (saison) — le bloc « Progression financière » n'est pas affecté par le filtre (décision validée).

- [ ] **Step 4: StatCard « Total encaissé » avec filtre** — remplacer la ligne 163 par :

```tsx
        <StatCard
          label="Total encaissé"
          valeur={totalPaye}
          icon="payments"
          tone="gold"
          grande
          monetaire
          actions={<FiltrePeriode periode={periode} onChange={setPeriode} />}
          tendance={{ texte: nomPeriode(periode), positif: true, suffixe: '' }}
        />
```

- [ ] **Step 5: Vérifier** — build + tests + lint

Run: `npm run build; if ($?) { npx vitest run }`
Expected: BUILD OK, 36 tests PASS ; `npm run lint` → uniquement le warning préexistant

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): filtre jour/semaine/mois/annee sur le total encaisse"
```

---

### Task 5: Vue superadmin — total encaissé filtré (calcul client, zéro SQL)

**Files:**
- Modify: `src/pages/SuperAdminGlobal.tsx` (remplacement complet ci-dessous)
- Modify: `src/pages/SuperAdminGlobal.test.tsx` (remplacement complet ci-dessous)

**Interfaces:**
- Consumes: `Periode`, `debutPeriode`, `nomPeriode` (Task 1), `FiltrePeriode` (Task 2), `StatCard` (Task 3), `StatsAgence` (inchangé).
- Produces: aucune dépendance externe ; le tableau affiche `formatFCFA(encaissesParAgence.get(s.agence_id) ?? 0)` au lieu de `encaissements_total` de la RPC (champs RPC conservés dans `StatsAgence`, non affichés).

- [ ] **Step 1: Écrire les tests** — `src/pages/SuperAdminGlobal.test.tsx` (remplacement complet)

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SuperAdminGlobal from './SuperAdminGlobal'
import { debutPeriode } from '../lib/dates'

const mockSupabase = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
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

const paiements = [
  { montant_paye: 400000, tranche: { pelerin: { agence_id: 'a1' } } },
  { montant_paye: 100000, tranche: { pelerin: { agence_id: 'a1' } } },
  { montant_paye: 50000, tranche: { pelerin: { agence_id: 'a2' } } },
]

const queryClient = new QueryClient()

beforeEach(() => {
  mockSupabase.rpc.mockReset()
  mockSupabase.from.mockReset()
  mockSupabase.rpc.mockResolvedValue({ data: fixture, error: null })
  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      gte: vi.fn().mockResolvedValue({ data: paiements, error: null }),
    }),
  })
})

describe('SuperAdminGlobal', () => {
  it('affiche les indicateurs globaux, le total encaissé et le tableau des agences', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminGlobal />
      </QueryClientProvider>
    )
    expect(await screen.findByText('Vue d’ensemble')).toBeInTheDocument()
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
    expect(screen.getByText('550 000')).toBeInTheDocument()
    expect(screen.getByText('500 000 FCFA')).toBeInTheDocument()
    expect(screen.getByText('Al Hidjah')).toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.textContent === '2 attente / 1 échec')).toBeInTheDocument()
  })

  it("affiche un badge Désactivée pour une agence inactive", async () => {
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

  it('relance la requête paiements avec la période sélectionnée', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SuperAdminGlobal />
      </QueryClientProvider>
    )
    await screen.findByText('Vue d’ensemble')
    fireEvent.click(screen.getByRole('button', { name: 'Semaine' }))
    const gteAppels = mockSupabase.from.mock.results
      .map((r) => r.value.select().gte)
      .map((g) => g.mock.calls[0][0])
    expect(gteAppels[1]).toBe(debutPeriode('semaine').toISOString())
  })
})
```

> Note : `queryClient` partagé entre tests — la requête se relance au remontage (staleTime par défaut = 0), donc chaque test consomme le mock courant.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/SuperAdminGlobal.test.tsx`
Expected: FAIL — `'550 000'` introuvable (ancienne carte « Encaissés (30 j) » = `400 000 FCFA`), `from` n'est pas mocké correctement

- [ ] **Step 3: Implémentation** — `src/pages/SuperAdminGlobal.tsx` (remplacement complet)

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { StatsAgence } from '../lib/types'
import { formatFCFA } from '../lib/format'
import { debutPeriode, nomPeriode, type Periode } from '../lib/dates'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import FiltrePeriode from '../components/ui/FiltrePeriode'

interface PaiementAgence {
  montant_paye: number
  tranche: { pelerin: { agence_id: string } | null } | null
}

export default function SuperAdminGlobal() {
  const [periode, setPeriode] = useState<Periode>('annee')

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['superadmin-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('stats_globales')
      if (error) throw error
      return (data ?? []) as StatsAgence[]
    },
  })

  const { data: paiements = [] } = useQuery({
    queryKey: ['superadmin-encaissements', periode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('montant_paye, tranche:plans_paiement(pelerin:pelerins(agence_id))')
        .gte('date_paiement', debutPeriode(periode).toISOString())
      if (error) throw error
      return (data ?? []) as PaiementAgence[]
    },
  })

  const encaissesParAgence = new Map<string, number>()
  for (const p of paiements) {
    const agenceId = p.tranche?.pelerin?.agence_id
    if (!agenceId) continue
    encaissesParAgence.set(agenceId, (encaissesParAgence.get(agenceId) ?? 0) + p.montant_paye)
  }
  const totalEncaisses = [...encaissesParAgence.values()].reduce((s, n) => s + n, 0)

  const totaux = stats.reduce(
    (acc, s) => ({
      pelerins: acc.pelerins + Number(s.pelerins_total),
      valides: acc.valides + Number(s.dossiers_valides),
      rappels: acc.rappels + Number(s.rappels_attente),
      actives: acc.actives + (s.agence_active ? 1 : 0),
    }),
    { pelerins: 0, valides: 0, rappels: 0, actives: 0 }
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
        <StatCard
          label="Total encaissé"
          valeur={totalEncaisses}
          icon="payments"
          tone="gold"
          monetaire
          actions={<FiltrePeriode periode={periode} onChange={setPeriode} />}
          tendance={{ texte: nomPeriode(periode), positif: true, suffixe: '' }}
        />
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
                  <td className="px-4 py-4">{formatFCFA(encaissesParAgence.get(s.agence_id) ?? 0)}</td>
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/SuperAdminGlobal.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Régression complète** — build + tests + lint

Run: `npm run build; if ($?) { npx vitest run }`
Expected: BUILD OK, 39 tests PASS ; `npm run lint` → uniquement le warning préexistant

- [ ] **Step 6: Commit**

```bash
git add src/pages/SuperAdminGlobal.tsx src/pages/SuperAdminGlobal.test.tsx
git commit -m "feat(superadmin): total encaisse filtre par periode (calcul client)"
```

---

### Task 6: Finalisation du travail en suspens + vérifications

**Files:**
- Modify: `src/components/layout/AppLayout.test.tsx` (ajout d'un test)
- (Le fix `AppLayout.tsx:24` — `if (!agence || !agence.active)` — est déjà édité sur le disque, non commité)

**Context:** Fix précédent non commité : le membre d'une agence désactivée voyait « Chargement… » pour toujours (requête `useAgence` en erreur PGRST116 → `agence` undefined). Le correctif : afficher l'écran « Agence désactivée » quand `!agence || !agence.active`.

- [ ] **Step 1: Ajouter le test** — dans `src/components/layout/AppLayout.test.tsx`, après le test existant « affiche l'écran de blocage quand l'agence est désactivée » (ligne 47-52) :

```tsx
  it("affiche l'écran de blocage quand l'agence n'est pas accessible (désactivée)", async () => {
    mockUseProfil.mockReturnValue({ data: { role: 'gerant', agence_id: 'a1' }, isLoading: false })
    mockUseAgence.mockReturnValue({ data: undefined, isLoading: false })
    renderer('/tableau-de-bord')
    expect(await screen.findByText('Agence désactivée')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests + build + lint**

Run: `npx vitest run; if ($?) { npm run build }`
Expected: 40 tests PASS, BUILD OK ; `npm run lint` → uniquement le warning préexistant

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AppLayout.tsx src/components/layout/AppLayout.test.tsx
git commit -m "fix(layout): ecran Agence desactivee quand l'agence est illisible (PGRST116)"
```

- [ ] **Step 4: Vérification headless — dashboard gérant**

Chrome headless (CDP port 9223, profil neuf, scripts Node via fichiers temp dans `C:\Users\Admin\AppData\Local\Temp\opencode\`) :
1. Login `moussa@alhidjah.sn` / `Hajj2027!` → `/tableau-de-bord`.
2. Lire la StatCard « Total encaissé » : montant + vérifier que `h3 > span` contient `whitespace-nowrap` (une seule ligne).
3. Cliquer « Semaine » → montant = somme paiements des 7 derniers jours (attendu : change par rapport à « Année »).
4. Cliquer « Jour » → montant attendu 0 FCFA (aucun paiement aujourd'hui) ou somme du jour.
5. Revenir à « Année » → total global.
Expected : valeurs cohérentes, jamais de retour à la ligne.

- [ ] **Step 5: Vérification headless — superadmin**

1. Login `superadmin@saas.sn` / `Ablaye2019` → `/superadmin`.
2. « Total encaissé » + colonne « Encaissé » du tableau : valeurs = totaux période (Année).
3. Cliquer « Semaine » → valeurs réduites cohérentes ; « Jour » → 0 FCFA attendu.
Expected : total et colonne suivent le filtre.

- [ ] **Step 6: Vérification blocage agence désactivée (reprise)**

1. Login `omar@albarakah.sn` / `Hajj2027!` (Al-Barakah toujours désactivée) → attendu : écran « Agence désactivée » (plus de « Chargement… » bloqué).
2. Superadmin → `/superadmin/agences` → cliquer « Réactiver » sur « Voyages Al-Barakah ».
3. Re-login `omar@albarakah.sn` → attendu : tableau de bord normal.
Expected : blocage effectif puis retour à la normale après réactivation.

- [ ] **Step 7: Nettoyage « Agence Test »** — fournir à l'utilisateur, à exécuter dans le SQL Editor :

```sql
delete from public.utilisateurs where email = 'geranttest@saas.sn';
delete from public.agences where nom = 'Agence Test';
```

- [ ] **Step 8: Récapitulatif final** — mettre à jour `.superpowers/sdd/progress.md` et livrer le récapitulatif (commits, tests 40/40, build, lint, vérifs headless, rappels restants : désactiver « Confirm email », déploiement Vercel, clôture de branche).

---

## Self-Review

- **Couverture spec** : dates.ts ✓ (T1), FiltrePeriode ✓ (T2), StatCard monetaire+actions ✓ (T3), Dashboard ✓ (T4), SuperAdminGlobal zéro SQL ✓ (T5), vérifs + en suspens ✓ (T6). Renommage « Encaissés (30 j) » → « Total encaissé » ✓ (T5). Défaut Année ✓ (T4/T5). « Progression financière » global ✓ (T4 Step 3).
- **Placeholders** : aucun — chaque étape a son code exact.
- **Cohérence des types** : `Periode`, `LIBELLES_PERIODE`, `debutPeriode`, `nomPeriode` définis en T1 et consommés en T2/T4/T5 avec les mêmes noms ; `monetaire`/`actions`/`suffixe` cohérents entre T3 et T4/T5. `text-headline-md` utilisé (pas de jeton `headline-lg` — vérifié dans `src/index.css`). Tests compatibles avec le style maison (`fireEvent`, pas de userEvent).