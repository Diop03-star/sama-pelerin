# Refonte UI/UX fidèle à la maquette — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Porter fidèlement les 6 écrans de la maquette (`maquette/*/code.html` + `screen.png`) en composants React branchés sur les données réelles, et décliner le langage visuel sur les 4 écrans non mockés.

**Architecture:** Refonte présentatoire uniquement. Les requêtes Supabase, mutations, hooks, types, RLS et tests existants ne sont PAS modifiés (seule exception : ajout additif du join `groupe:groupes(nom)` sur la fiche pèlerin). Ajout : tokens Tailwind v4 (palette Material du DESIGN.md), composant `Icon` (Material Symbols), composants partagés (StatCard, AlertLink, ProgressBar), refonte du shell et des 11 pages.

**Tech Stack:** Vite + React + TypeScript strict, Tailwind CSS v4 (`@theme`), TanStack Query v5, react-router-dom v7, Material Symbols Outlined (Google Fonts), Vitest.

**Convention plan:** pour chaque page, « LOGIQUE INCHANGÉE » signifie : conserver exactement l'état React, les `useQuery`, `useMutation`, handlers et le contenu des formulaires/modals du fichier actuel (l'implémenteur a le fichier sous les yeux) ; seuls les blocs JSX fournis remplacent le rendu actuel.

## Global Constraints

- `src/index.css` : conserver les alias `--color-navy`, `--color-gold`, `--color-border`, `--color-vert`, `--color-ambre` et les classes `.input`, `.label`, `.btn-*`, `.text-headline` (encore utilisées) ; ajouter les nouveaux tokens SANS les supprimer.
- Icônes : uniquement Material Symbols Outlined via Google Fonts (aucune nouvelle dépendance npm).
- Montants : toujours via `formatFCFA()` ; dates : toujours via `formatDate()`. Libellés français via `LIBELLES_*` de `src/lib/format.ts` (ne jamais afficher les clés anglaises).
- Ne JAMAIS modifier : `src/lib/plan.ts`, `src/lib/format.ts`, `src/lib/types.ts`, `src/auth/*`, `src/hooks/useAgence.ts`, `src/lib/supabase.ts`, `supabase/*`, les 3 tests existants.
- Rendu de référence : `maquette/*/screen.png` ; classes transcrites de `maquette/*/code.html`.
- Commandes : `npm test` (Vitest), `npm run build` (tsc -b && vite build), `npm run lint` (oxlint — 1 warning préexistant AuthContext.tsx à ignorer).
- `useProfil()` → `{ id, user_id, agence_id, nom, role: 'gerant' | 'agent', email }` ; `useAgence()` → `{ id, nom, telephone, adresse }`.
- Commit à la fin de chaque tâche sur `rebuild-supabase` : `feat(ui): <résumé>`.

---

### Task 1: Fondations — tokens, polices, Icon, utilitaire de recherche

**Files:** Modify `index.html:9` · Modify `src/index.css:3-16` · Create `src/components/ui/Icon.tsx` · Create `src/lib/recherche.ts` · Create `src/lib/recherche.test.ts`

**Produces:** `Icon({ name: string; fill?: boolean; size?: number; className?: string })` ; `filtrerRecherche<T extends { libelle: string; sousLibelle: string }>(terme, items, limite = 5): T[]` ; classes Tailwind `text-display-lg/headline-md/headline-sm/body-lg/body-md/label-md/data-mono` + couleurs `surface-container-lowest/low/high/highest`, `on-surface(-variant)`, `outline(-variant)`, `primary`, `on-primary`, `primary-container`, `on-primary-container`, `surface-tint`, `secondary`, `secondary-container`, `secondary-fixed-dim`, `on-secondary-fixed-variant`, `error-container`, `on-error-container`.

- [ ] **Step 1: Test qui échoue**

Create `src/lib/recherche.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { filtrerRecherche } from './recherche'

describe('filtrerRecherche', () => {
  const items = [
    { id: '1', libelle: 'Moussa Diop', sousLibelle: '77 123 45 67', to: '/x/1' },
  ]

  it('retourne les éléments dont le libellé contient le terme (insensible à la casse)', () => {
    expect(filtrerRecherche('moussa', items)).toHaveLength(1)
  })

  it('retourne les éléments dont le sous-libellé contient le terme', () => {
    expect(filtrerRecherche('77 123', items)).toHaveLength(1)
  })

  it('retourne une liste vide pour un terme vide ou sans correspondance', () => {
    expect(filtrerRecherche('', items)).toEqual([])
    expect(filtrerRecherche('zzz', items)).toEqual([])
  })

  it('limite le nombre de résultats', () => {
    const dix = Array.from({ length: 10 }, (_, i) => ({ id: String(i), libelle: `Diop ${i}`, sousLibelle: '', to: `/x/${i}` }))
    expect(filtrerRecherche('diop', dix, 5)).toHaveLength(5)
  })
})
```

- [ ] **Step 2:** Run `npm test` → FAIL (`Cannot find module './recherche'`)
- [ ] **Step 3: Implémenter**

`src/lib/recherche.ts` :

```ts
export function filtrerRecherche<T extends { libelle: string; sousLibelle: string }>(
  terme: string,
  items: T[],
  limite = 5
): T[] {
  const t = terme.trim().toLowerCase()
  if (!t) return []
  return items
    .filter((i) => i.libelle.toLowerCase().includes(t) || i.sousLibelle.toLowerCase().includes(t))
    .slice(0, limite)
}
```

`src/components/ui/Icon.tsx` :

```tsx
interface IconProps {
  name: string
  fill?: boolean
  size?: number
  className?: string
}

export default function Icon({ name, fill = false, size = 20, className = '' }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined inline-block select-none leading-none ${className}`}
      style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1, 'wght' 500" : undefined }}
    >
      {name}
    </span>
  )
}
```

`index.html` — remplacer la ligne 9 par :

```html
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
```

`src/index.css` — remplacer le bloc `@theme` (lignes 3-16) par :

```css
@theme {
  --color-surface: #f9f9f7;
  --color-surface-bright: #f9f9f7;
  --color-surface-dim: #dadad8;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #f4f4f2;
  --color-surface-container: #eeeeec;
  --color-surface-container-high: #e8e8e6;
  --color-surface-container-highest: #e2e3e1;
  --color-on-surface: #1a1c1b;
  --color-on-surface-variant: #45464d;
  --color-outline: #76777e;
  --color-outline-variant: #c6c6ce;
  --color-primary: #09152e;
  --color-on-primary: #ffffff;
  --color-primary-container: #1f2a44;
  --color-on-primary-container: #8691b0;
  --color-surface-tint: #535e7b;
  --color-secondary: #775928;
  --color-on-secondary: #ffffff;
  --color-secondary-container: #ffd79b;
  --color-on-secondary-container: #7a5c2b;
  --color-secondary-fixed: #ffdeae;
  --color-secondary-fixed-dim: #e8c086;
  --color-on-secondary-fixed-variant: #5d4213;
  --color-error: #ba1a1a;
  --color-on-error: #ffffff;
  --color-error-container: #ffdad6;
  --color-on-error-container: #93000a;
  --color-navy: #09152e;
  --color-navy-light: #1f2a44;
  --color-gold: #775928;
  --color-gold-container: #ffd79b;
  --color-border: #e2e8f0;
  --color-vert: #2e7d32;
  --color-ambre: #b26a00;
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --radius-card: 1rem;
  --text-display-lg: 32px;
  --text-display-lg--line-height: 40px;
  --text-display-lg--letter-spacing: -0.02em;
  --text-display-lg--font-weight: 700;
  --text-headline-md: 24px;
  --text-headline-md--line-height: 32px;
  --text-headline-md--font-weight: 600;
  --text-headline-sm: 20px;
  --text-headline-sm--line-height: 28px;
  --text-headline-sm--font-weight: 600;
  --text-body-lg: 16px;
  --text-body-lg--line-height: 24px;
  --text-body-md: 14px;
  --text-body-md--line-height: 20px;
  --text-label-md: 12px;
  --text-label-md--line-height: 16px;
  --text-label-md--letter-spacing: 0.05em;
  --text-label-md--font-weight: 600;
  --text-data-mono: 14px;
  --text-data-mono--line-height: 20px;
  --text-data-mono--letter-spacing: -0.01em;
  --text-data-mono--font-weight: 500;
}
```

- [ ] **Step 4:** Run `npm test` → PASS (19) ; Run `npm run build` → succès.
- [ ] **Step 5: Commit**

```bash
git add index.html src/index.css src/components/ui/Icon.tsx src/lib/recherche.ts src/lib/recherche.test.ts
git commit -m "feat(ui): fondations design system (tokens Material, Inter, Icon, recherche)"
```

---

### Task 2: Shell — Sidebar, Topbar avec recherche fonctionnelle, AppLayout

**Files:** Modify `src/components/layout/Sidebar.tsx` · `src/components/layout/Topbar.tsx` (réécritures complètes) · Modify `src/components/layout/AppLayout.tsx`

**Produces:** `Sidebar({ ouverte: boolean; onFermer: () => void })` — la déconnexion est DÉPLACÉE du Topbar vers le bas de la Sidebar ; `Topbar({ onOuvrirMenu: () => void })` — recherche qui navigue vers `/liste-des-pelerins?q=<terme>` (Entrée) ou `/details-du-pelerin/:id` / `/liste-des-pelerins?groupe=<id>` (menu déroulant) ; AppLayout gère le tiroir mobile.
**Référence:** `maquette/tableau_de_bord/code.html` lignes 108-157 (sidebar) et 161-194 (topbar).

- [ ] **Step 1: Réécrire `Sidebar.tsx`** — contenu complet :

```tsx
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../hooks/useAgence'
import Icon from '../ui/Icon'

interface NavItem {
  to: string
  label: string
  icon: string
}

interface NavSection {
  section: string
  items: NavItem[]
}

const NAVIGATION: NavSection[] = [
  { section: 'Vue d’ensemble', items: [{ to: '/tableau-de-bord', label: 'Tableau de bord', icon: 'dashboard' }] },
  {
    section: 'Gestion des pèlerins',
    items: [
      { to: '/liste-des-pelerins', label: 'Pèlerins', icon: 'person' },
      { to: '/liste-des-groupes', label: 'Groupes', icon: 'group' },
      { to: '/gestion-des-documents', label: 'Documents', icon: 'description' },
    ],
  },
  { section: 'Finances', items: [{ to: '/paiements-echeanciers', label: 'Paiements & échéanciers', icon: 'payments' }] },
]

interface SidebarProps {
  ouverte: boolean
  onFermer: () => void
}

export default function Sidebar({ ouverte, onFermer }: SidebarProps) {
  const navigate = useNavigate()
  const { data: profil } = useProfil()
  const sections: NavSection[] =
    profil?.role === 'gerant'
      ? [...NAVIGATION, { section: 'Administration', items: [{ to: '/membres', label: 'Membres', icon: 'settings' }] }]
      : NAVIGATION

  async function deconnexion() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const contenu = (
    <div className="flex h-full flex-col">
      <div className="mb-10 flex items-center gap-3 px-2 pt-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-on-primary-container">
          <Icon name="mosque" size={20} />
        </div>
        <div>
          <h1 className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</h1>
          <p className="text-label-md text-on-surface-variant">Portail Administrateur</p>
        </div>
      </div>
      <ul className="flex-1 space-y-4 overflow-y-auto">
        {sections.map((s) => (
          <li key={s.section}>
            <p className="text-label-md mb-1 px-3 text-on-surface-variant">{s.section}</p>
            <ul className="space-y-1">
              {s.items.map((i) => (
                <li key={i.to}>
                  <NavLink
                    to={i.to}
                    onClick={onFermer}
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
                        <Icon name={i.icon} fill={isActive} size={20} />
                        {i.label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <ul className="mt-4 space-y-1 border-t border-outline-variant pt-4">
        <li>
          <a className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-low">
            <Icon name="help_outline" size={20} />
            Aide
          </a>
        </li>
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
    <>
      <aside className="hidden w-[260px] shrink-0 border-r border-outline-variant bg-surface-container-lowest px-4 py-6 md:block">
        {contenu}
      </aside>
      {ouverte && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/30" onClick={onFermer} />
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-surface-container-lowest px-4 py-6 shadow-lg">
            {contenu}
          </aside>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Réécrire `Topbar.tsx`** — contenu complet :

```tsx
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAgence, useProfil } from '../../hooks/useAgence'
import { filtrerRecherche } from '../../lib/recherche'
import Icon from '../ui/Icon'

interface TopbarProps {
  onOuvrirMenu: () => void
}

export default function Topbar({ onOuvrirMenu }: TopbarProps) {
  const navigate = useNavigate()
  const { data: profil } = useProfil()
  const { data: agence } = useAgence()
  const [terme, setTerme] = useState('')
  const [focus, setFocus] = useState(false)
  const timerBlur = useRef<number | null>(null)

  const { data: pelerins = [] } = useQuery({
    queryKey: ['recherche-pelerins'],
    queryFn: async () => {
      const { data } = await supabase.from('pelerins').select('id, prenom, nom, telephone')
      return data as { id: string; prenom: string; nom: string; telephone: string }[]
    },
  })

  const { data: groupes = [] } = useQuery({
    queryKey: ['recherche-groupes'],
    queryFn: async () => {
      const { data } = await supabase.from('groupes').select('id, nom')
      return data as { id: string; nom: string }[]
    },
  })

  const resultats = useMemo(() => {
    const pel = filtrerRecherche(
      terme,
      pelerins.map((p) => ({
        id: p.id,
        libelle: `${p.prenom} ${p.nom}`,
        sousLibelle: p.telephone,
        to: `/details-du-pelerin/${p.id}`,
      }))
    )
    const grp = filtrerRecherche(
      terme,
      groupes.map((g) => ({ id: g.id, libelle: g.nom, sousLibelle: '', to: `/liste-des-pelerins?groupe=${g.id}` }))
    )
    return [...pel, ...grp]
  }, [terme, pelerins, groupes])

  function ouvrirResultat(to: string) {
    setTerme('')
    setFocus(false)
    navigate(to)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const t = terme.trim()
    if (!t) return
    ouvrirResultat(`/liste-des-pelerins?q=${encodeURIComponent(t)}`)
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={onOuvrirMenu}
          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low md:hidden"
        >
          <Icon name="menu" size={20} />
        </button>
        <h2 className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</h2>
      </div>

      <div className="relative mx-6 hidden max-w-md flex-1 sm:block">
        <Icon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="text"
          value={terme}
          onChange={(e) => setTerme(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            if (timerBlur.current) window.clearTimeout(timerBlur.current)
            timerBlur.current = window.setTimeout(() => setFocus(false), 150)
          }}
          placeholder="Rechercher pèlerins, groupes…"
          className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-10 pr-4 text-body-md text-on-surface transition-colors placeholder:text-on-surface-variant focus:border-primary focus:ring-1 focus:ring-primary"
        />
        {focus && terme.trim() && resultats.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-md">
            {resultats.map((r) => (
              <li key={r.to}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    ouvrirResultat(r.to)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-container-low"
                >
                  <Icon name={r.to.startsWith('/details') ? 'person' : 'group'} size={18} className="text-on-surface-variant" />
                  <span>
                    <span className="block text-body-md font-medium text-on-surface">{r.libelle}</span>
                    {r.sousLibelle && <span className="block text-label-md text-on-surface-variant">{r.sousLibelle}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {focus && terme.trim() && resultats.length === 0 && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 text-label-md text-on-surface-variant shadow-md">
            Aucun résultat pour « {terme.trim()} ».
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" aria-label="Notifications" className="relative rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low">
          <Icon name="notifications" size={20} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-error" />
        </button>
        <button type="button" aria-label="Aide" className="hidden rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low md:block">
          <Icon name="help_outline" size={20} />
        </button>
        <div className="ml-2 flex items-center gap-3 border-l border-outline-variant pl-4">
          <div className="hidden text-right lg:block">
            <p className="text-label-md text-on-surface">{profil?.role === 'gerant' ? 'Gérant' : 'Agent'}</p>
            <p className="text-[10px] text-on-surface-variant">{agence?.nom}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-label-md font-bold text-on-primary-container">
            {profil?.nom?.charAt(0).toUpperCase() ?? '?'}
          </div>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Réécrire `AppLayout.tsx`** — contenu complet :

```tsx
import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useProfil } from '../../hooks/useAgence'

export default function AppLayout() {
  const { data: profil, isLoading } = useProfil()
  const [menuOuvert, setMenuOuvert] = useState(false)

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }
  if (!profil) {
    return <div className="flex h-screen items-center justify-center text-error">Profil introuvable.</div>
  }
  if (!profil.agence_id) return <Navigate to="/onboarding" replace />

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

- [ ] **Step 4:** Run `npm run build` → succès ; `npm run lint` → 1 warning préexistant uniquement.
Contrôle navigateur (http://localhost:5173/, `moussa@alhidjah.sn` / `Hajj2027!`) : sidebar blanche 260px avec logo mosquée, nav groupée à icônes, actif = bordure gold + fond `surface-container`, déconnexion en bas en rouge ; topbar : recherche (« mou » → Moussa Diop, clic → fiche), cloche, avatar initiale + nom agence ; largeur < 768px : bouton menu → tiroir.
- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/Topbar.tsx src/components/layout/AppLayout.tsx
git commit -m "feat(ui): shell maquette (sidebar icones + topbar recherche globale + drawer mobile)"
```

---

### Task 3: Composants partagés (StatCard, AlertLink, ProgressBar) + Tableau de bord

**Files:** Create `src/components/ui/StatCard.tsx` · `src/components/ui/AlertLink.tsx` · `src/components/ui/ProgressBar.tsx` · Modify `src/pages/Dashboard.tsx` (réécriture complète)

**Produces:** `StatCard({ label, valeur: ReactNode, icon, tone?: 'primary'|'gold'|'vert'|'error', tendance?: { texte: string; positif?: boolean } })` ; `AlertLink({ tone: 'rouge'|'gold', titre, description, icon, to })` ; `ProgressBar({ valeur, tone?: 'gold'|'vert'|'primary', label?, className? })` ; routes d'alertes consommées en Task 4 : `/liste-des-pelerins?statut=incomplet`, `/paiements-echeanciers?statut=en_retard`, `/gestion-des-documents?alerte=passeport`, `/liste-des-pelerins?nouveau=1`.
**Référence:** `maquette/tableau_de_bord/code.html` lignes 198-279.

- [ ] **Step 1: Créer `StatCard.tsx`**

```tsx
import type { ReactNode } from 'react'
import Icon from './Icon'

interface StatCardProps {
  label: string
  valeur: ReactNode
  icon: string
  tone?: 'primary' | 'gold' | 'vert' | 'error'
  tendance?: { texte: string; positif?: boolean }
}

const TONES: Record<string, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  gold: 'bg-secondary-container text-on-secondary-container',
  vert: 'bg-green-50 text-green-700',
  error: 'bg-error-container text-on-error-container',
}

export default function StatCard({ label, valeur, icon, tone = 'primary', tendance }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="pointer-events-none absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-primary/5" />
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-label-md uppercase tracking-wider text-on-surface-variant">{label}</p>
          <h3 className="text-display-lg mt-2 text-on-surface">{valeur}</h3>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <Icon name={icon} size={24} />
        </div>
      </div>
      {tendance && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className={`flex items-center rounded-md px-2 py-1 text-label-md ${tendance.positif === false ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            <Icon name={tendance.positif === false ? 'trending_down' : 'trending_up'} size={16} className="mr-1" />
            {tendance.texte}
          </span>
          <span className="text-body-md text-on-surface-variant">cette semaine</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Créer `AlertLink.tsx`**

```tsx
import { Link } from 'react-router-dom'
import Icon from './Icon'

interface AlertLinkProps {
  tone: 'rouge' | 'gold'
  titre: string
  description: string
  icon: string
  to: string
}

const STYLES = {
  rouge: {
    bande: 'border-error',
    fond: 'bg-error-container/20 hover:bg-error-container/40',
    icone: 'bg-error/10 text-error',
    texte: 'text-error',
    fleche: 'text-error',
  },
  gold: {
    bande: 'border-secondary',
    fond: 'bg-secondary-container/20 hover:bg-secondary-container/40',
    icone: 'bg-secondary/10 text-secondary',
    texte: 'text-secondary',
    fleche: 'text-secondary',
  },
}

export default function AlertLink({ tone, titre, description, icon, to }: AlertLinkProps) {
  const s = STYLES[tone]
  return (
    <Link to={to} className={`group relative block overflow-hidden rounded-r-lg border-l-4 p-4 transition-colors ${s.bande} ${s.fond}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 rounded-full p-2 ${s.icone}`}>
          <Icon name={icon} fill size={20} />
        </div>
        <div>
          <p className={`text-headline-sm ${s.texte}`}>{titre}</p>
          <p className="text-body-md mt-1 text-on-surface-variant">{description}</p>
        </div>
      </div>
      <Icon
        name="arrow_forward"
        size={20}
        className={`absolute right-4 top-4 translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 ${s.fleche}`}
      />
    </Link>
  )
}
```

- [ ] **Step 3: Créer `ProgressBar.tsx`**

```tsx
interface ProgressBarProps {
  valeur: number
  tone?: 'gold' | 'vert' | 'primary'
  label?: string
  className?: string
}

const TONES: Record<string, string> = {
  gold: 'bg-secondary-fixed-dim',
  vert: 'bg-green-600',
  primary: 'bg-primary',
}

export default function ProgressBar({ valeur, tone = 'gold', label, className = '' }: ProgressBarProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
        <div className={`h-full rounded-full ${TONES[tone]}`} style={{ width: `${Math.min(100, Math.max(0, valeur))}%` }} />
      </div>
      {label && <span className="text-data-mono text-on-surface-variant">{label}</span>}
    </div>
  )
}
```

- [ ] **Step 4: Réécrire `Dashboard.tsx`** — contenu complet (remplace l'existant) :

```tsx
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  LIBELLES_DOCUMENT, LIBELLES_RAPPEL, TONE_RAPPEL,
  formatDate, formatFCFA, messageDocument, messageTranche, whatsappUrl,
} from '../lib/format'
import type { Pelerin, Tranche } from '../lib/types'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import StatCard from '../components/ui/StatCard'
import AlertLink from '../components/ui/AlertLink'
import ProgressBar from '../components/ui/ProgressBar'

interface TrancheAvecPelerin extends Tranche {
  plan_paiement: { pelerin: Pelerin }
}

interface RappelAvecCible {
  id: string
  statut_envoi: string
  date_envoi_prevue: string
  tranche: (Tranche & { plan_paiement: { pelerin: Pelerin } }) | null
  document: { id: string; type_document: string; statut: string; pelerin: Pelerin } | null
}

export default function Dashboard() {
  const { data: rappels = [] } = useQuery({
    queryKey: ['dashboard-rappels'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rappels')
        .select('id, statut_envoi, date_envoi_prevue, tranche:tranches(numero_tranche, montant_prevu, date_echeance, plan_paiement:plans_paiement(pelerin:pelerins(*))), document:documents(type_document, statut, pelerin:pelerins(*))')
        .eq('statut_envoi', 'en_attente')
        .order('date_envoi_prevue', { ascending: true })
      return data as unknown as RappelAvecCible[]
    },
  })

  const { data: tranchesRetard = [] } = useQuery({
    queryKey: ['dashboard-retard'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tranches')
        .select('*, plan_paiement:plans_paiement(pelerin:pelerins(*))')
        .eq('statut', 'en_retard')
        .order('date_echeance', { ascending: true })
      return data as unknown as TrancheAvecPelerin[]
    },
  })

  const { data: dossiersIncomplets = [] } = useQuery({
    queryKey: ['dashboard-dossiers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pelerins')
        .select('*')
        .eq('statut_dossier', 'incomplet')
        .order('nom')
      return data as Pelerin[]
    },
  })

  const { data: passeports = 0 } = useQuery({
    queryKey: ['dashboard-passeports'],
    queryFn: async () => {
      const debut = new Date()
      debut.setHours(0, 0, 0, 0)
      const fin = new Date(debut)
      fin.setDate(fin.getDate() + 90)
      const { count } = await supabase
        .from('documents')
        .select('id', { count: 'exact', head: true })
        .eq('type_document', 'passeport')
        .gte('date_expiration', debut.toISOString())
        .lte('date_expiration', fin.toISOString())
      return count ?? 0
    },
  })

  const { data: pelerins = [] } = useQuery({
    queryKey: ['dashboard-pelerins'],
    queryFn: async () => {
      const { data } = await supabase.from('pelerins').select('statut_dossier')
      return data as { statut_dossier: string }[]
    },
  })

  const { data: echeanciers = [] } = useQuery({
    queryKey: ['dashboard-encaissements'],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans_paiement')
        .select('montant_total, tranches(paiements(montant_paye))')
      return data as unknown as { montant_total: number; tranches: { paiements: { montant_paye: number }[] }[] }[]
    },
  })

  const valides = pelerins.filter((p) => p.statut_dossier === 'valide').length
  const totalPelerins = pelerins.length
  const totalAttendu = echeanciers.reduce((s, p) => s + p.montant_total, 0)
  const totalPaye = echeanciers.reduce(
    (s, p) => s + p.tranches.reduce((x, t) => x + t.paiements.reduce((y, pa) => y + pa.montant_paye, 0), 0),
    0
  )
  const resteGlobal = totalAttendu - totalPaye
  const progression = totalAttendu > 0 ? Math.round((totalPaye / totalAttendu) * 100) : 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Tableau de bord</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Vue d’ensemble de la saison Hajj 2026</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-primary bg-surface-container-lowest px-4 py-2 text-label-md text-primary shadow-sm hover:bg-surface-container-low"
          >
            <Icon name="download" size={18} />
            Rapport Global
          </button>
          <Link
            to="/liste-des-pelerins?nouveau=1"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-label-md text-on-primary shadow-sm hover:bg-primary-container"
          >
            <Icon name="add" size={18} />
            Nouveau Pèlerin
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <h2 className="sr-only">Alertes à traiter</h2>
        <AlertLink
          tone="rouge"
          icon="warning"
          titre={`${dossiersIncomplets.length} Pèlerins`}
          description="Dossiers incomplets à compléter"
          to="/liste-des-pelerins?statut=incomplet"
        />
        <AlertLink
          tone="gold"
          icon="schedule"
          titre={`${tranchesRetard.length} Paiements`}
          description="En retard sur l’échéancier"
          to="/paiements-echeanciers?statut=en_retard"
        />
        <AlertLink
          tone="rouge"
          icon="assignment_late"
          titre={`${passeports} Document${passeports > 1 ? 's' : ''}`}
          description="Passeport expirant bientôt"
          to="/gestion-des-documents?alerte=passeport"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <StatCard label="Total Pèlerins" valeur={totalPelerins} icon="group" tendance={{ texte: `${valides} dossiers validés`, positif: true }} />
        <StatCard label="Total encaissé" valeur={formatFCFA(totalPaye)} icon="payments" tone="gold" />
        <StatCard label="Reste global" valeur={formatFCFA(resteGlobal)} icon="account_balance_wallet" tone={resteGlobal > 0 ? 'error' : 'vert'} />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="savings" size={20} className="text-primary" />
              <h3 className="text-headline-sm text-primary">Progression financière</h3>
            </div>
            <span className="text-data-mono text-on-surface-variant">{progression}%</span>
          </div>
          <ProgressBar valeur={progression} tone="gold" />
          <div className="mt-3 flex flex-wrap gap-6 text-body-md">
            <p className="text-on-surface-variant">Encaissé : <span className="font-semibold text-vert">{formatFCFA(totalPaye)}</span></p>
            <p className="text-on-surface-variant">Attendu : <span className="font-semibold text-on-surface">{formatFCFA(totalAttendu)}</span></p>
            <p className="text-on-surface-variant">Reste : <span className={`font-semibold ${resteGlobal > 0 ? 'text-error' : 'text-vert'}`}>{formatFCFA(resteGlobal)}</span></p>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="notifications_active" size={20} className="text-secondary" />
            <h3 className="text-headline-sm text-primary">Rappels à envoyer</h3>
          </div>
          {rappels.length === 0 && <EmptyState message="Aucun rappel en attente." />}
          <ul className="space-y-3">
            {rappels.map((r) => {
              const cible = r.tranche
                ? `Tranche ${r.tranche.numero_tranche} — ${formatFCFA(r.tranche.montant_prevu)}`
                : r.document
                  ? LIBELLES_DOCUMENT[r.document.type_document]
                  : '—'
              const pelerin = r.tranche?.plan_paiement.pelerin ?? r.document?.pelerin
              if (!pelerin) return null
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant p-3 hover:bg-surface-container-low">
                  <div className="min-w-0">
                    <Link to={`/details-du-pelerin/${pelerin.id}`} className="text-body-md font-medium text-primary hover:underline">
                      {pelerin.prenom} {pelerin.nom}
                    </Link>
                    <p className="text-label-md text-on-surface-variant">{cible} · prévu {formatDate(r.date_envoi_prevue)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={TONE_RAPPEL[r.statut_envoi]}>{LIBELLES_RAPPEL[r.statut_envoi]}</Badge>
                    <a
                      href={whatsappUrl(
                        pelerin.telephone,
                        r.tranche
                          ? messageTranche(pelerin.prenom, pelerin.nom, r.tranche.numero_tranche, r.tranche.montant_prevu, r.tranche.date_echeance)
                          : r.document
                            ? messageDocument(pelerin.prenom, pelerin.nom, r.document.type_document, r.document.statut)
                            : ''
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                      title="Envoyer sur WhatsApp"
                    >
                      <Icon name="whatsapp" size={18} />
                    </a>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 5:** Run `npm run build` → succès.
Contrôle navigateur (session `moussa@alhidjah.sn`) : en-tête display-lg + 2 boutons ; 3 alertes à bande rouge/gold avec flèche au survol ; 3 cartes bento ; carte Progression financière (barre dorée) ; carte Rappels avec lien WhatsApp. Comparer avec `maquette/tableau_de_bord/screen.png`.
- [ ] **Step 6: Commit**

```bash
git add src/components/ui/StatCard.tsx src/components/ui/AlertLink.tsx src/components/ui/ProgressBar.tsx src/pages/Dashboard.tsx
git commit -m "feat(ui): tableau de bord maquette (alertes cliquables, bento cards, progression, rappels)"
```

---

### Task 4: Listes — Pèlerins, Groupes, Documents, Paiements

**Files:** Create `src/lib/documents.ts` + `src/lib/documents.test.ts` · Modify `src/pages/Pelerins.tsx`, `src/pages/Groupes.tsx`, `src/pages/Documents.tsx`, `src/pages/Paiements.tsx` (réécritures complètes)

**Produces:** `expirantDans(dateExpiration: string, jours: number, reference?: Date): boolean` ; filtres par URL : `?q=` (Pèlerins, recherche pré-remplie), `?statut=` (Pèlerins : statut dossier ; Paiements : `en_retard` = tranches filtrées), `?nouveau=1` (Pèlerins : ouvre le modal), `?groupe=` (existant), `?alerte=passeport` (Documents : type passeport + expiration ≤ 90 j).
**Règles tables maquette :** en-tête `bg-[#f1f5f9]` + `text-label-md uppercase tracking-wider` ; lignes `group border-t border-outline-variant hover:bg-surface-container-low transition-colors` ; cellules `px-4 py-4` ; actions icônes dans `div.opacity-0 group-hover:opacity-100` ; conteneur table : `overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm`.
**Références:** `maquette/liste_des_p_lerins`, `liste_des_groupes`, `gestion_des_documents`, `paiements_et_ch_anciers/code.html`.

- [ ] **Step 1: Test qui échoue**

Create `src/lib/documents.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { expirantDans } from './documents'

describe('expirantDans', () => {
  const reference = new Date('2026-08-14T10:00:00')

  it('vrai si l’expiration tombe dans la fenêtre', () => {
    expect(expirantDans('2026-10-01', 90, reference)).toBe(true)
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
```

- [ ] **Step 2:** Run `npm test` → FAIL (`Cannot find module './documents'`)
- [ ] **Step 3: Implémenter `src/lib/documents.ts`**

```ts
export function expirantDans(dateExpiration: string, jours: number, reference = new Date()): boolean {
  const exp = new Date(dateExpiration)
  if (Number.isNaN(exp.getTime())) return false
  const debut = new Date(reference)
  debut.setHours(0, 0, 0, 0)
  const fin = new Date(debut)
  fin.setDate(fin.getDate() + jours)
  return exp >= debut && exp <= fin
}
```

Run: `npm test` → PASS (23).

- [ ] **Step 4: Réécrire `Pelerins.tsx`**

LOGIQUE INCHANGÉE : imports (sauf suppression de `Card`, ajout de `Icon` et `StatCard`, ajout de `useSearchParams` à l'import `react-router-dom`), interface `PelerinAvecJointures`, état `{ groupeFiltre, statutFiltre, recherche, modalOuverte, erreur, form }`, `useQuery` groupes, `useQuery` pelerins, mutation `sauver`, `onSubmit`, `montantPaye`. AJOUTS : `statutFiltre = params.get('statut') ?? ''` ; `useEffect` ouvrant le modal quand `params.get('nouveau')` (pré-remplir `groupe_id` avec `groupeFiltre`) ; `useMemo compteurs` (total, valides, incomplets). Remplacer le JSX par :

```tsx
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Pèlerins</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Gérez les dossiers de vos pèlerins</p>
        </div>
        <Button
          onClick={() => {
            setForm({ ...form, groupe_id: groupeFiltre ?? groupes[0]?.id ?? '' })
            setModalOuverte(true)
          }}
        >
          <Icon name="add" size={18} className="mr-2" />
          Nouveau Pèlerin
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Pèlerins" valeur={compteurs.total} icon="group" />
        <StatCard label="Dossiers validés" valeur={compteurs.valides} icon="check_circle" tone="vert" />
        <StatCard label="Dossiers incomplets" valeur={compteurs.incomplets} icon="warning" tone="error" />
      </section>

      <div className="flex flex-wrap gap-4">
        <div className="relative">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input placeholder="Rechercher par nom ou téléphone…" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="max-w-xs pl-10" />
        </div>
        <Select value={groupeFiltre} onChange={(e) => setParams(e.target.value ? { groupe: e.target.value } : {})} className="max-w-xs">
          <option value="">Tous les groupes</option>
          {groupes.map((g) => (
            <option key={g.id} value={g.id}>{g.nom}</option>
          ))}
        </Select>
        <Select value={statutFiltre} onChange={(e) => setParams(e.target.value ? { statut: e.target.value } : {})} className="max-w-xs">
          <option value="">Tous les statuts</option>
          <option value="valide">Validé</option>
          <option value="complet">Complet</option>
          <option value="incomplet">Incomplet</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Groupe</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Dossier</th>
                <th className="px-4 py-3">Reste dû</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((p) => {
                const reste = p.plan_paiement ? p.plan_paiement.montant_total - montantPaye(p) : 0
                return (
                  <tr key={p.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                    <td className="px-4 py-4 font-medium text-primary">{p.prenom} {p.nom}</td>
                    <td className="px-4 py-4">{p.groupe?.nom ?? '—'}</td>
                    <td className="px-4 py-4 text-data-mono text-on-surface-variant">{p.telephone}</td>
                    <td className="px-4 py-4">
                      <Badge tone={TONE_DOSSIER[p.statut_dossier]}>{LIBELLES_DOSSIER[p.statut_dossier]}</Badge>
                    </td>
                    <td className={`px-4 py-4 font-medium ${reste > 0 ? 'text-error' : 'text-vert'}`}>
                      {p.plan_paiement ? formatFCFA(reste) : '—'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Link
                          to={`/details-du-pelerin/${p.id}`}
                          title="Voir la fiche"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-primary"
                        >
                          <Icon name="visibility" size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtres.length === 0 && <EmptyState message="Aucun pèlerin trouvé." />}
        </div>
      </div>

      <Modal open={modalOuverte} title="Inscrire un pèlerin" onClose={() => setModalOuverte(false)}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Groupe">
            <Select required value={form.groupe_id} onChange={(e) => setForm({ ...form, groupe_id: e.target.value })}>
              <option value="">Choisir un groupe</option>
              {groupes.map((g) => (
                <option key={g.id} value={g.id}>{g.nom}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom">
              <Input required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
            </Field>
            <Field label="Nom">
              <Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </Field>
          </div>
          <Field label="Téléphone">
            <Input required value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="+221 77 XXX XX XX" />
          </Field>
          <Field label="Email (optionnel)">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Sexe">
            <Select value={form.sexe} onChange={(e) => setForm({ ...form, sexe: e.target.value })}>
              <option value="M">Homme</option>
              <option value="F">Femme</option>
            </Select>
          </Field>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOuverte(false)}>Annuler</Button>
            <Button type="submit" disabled={sauver.isPending}>Inscrire</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
```

- [ ] **Step 5: Réécrire `Groupes.tsx`**

LOGIQUE INCHANGÉE : interface `GroupeAvecCompte`, état, `useQuery groupes`, mutations `sauver`/`supprimer`, `ouvrirCreation`/`ouvrirEdition`, `onSubmit`, contenu du Modal (formulaire). AJOUTS : état `recherche` + `useMemo filtres` (filtre par nom) ; `useMemo totaux` (groupes, inscrits = somme `pelerins[0]?.count`, placesLibres = max(0, Σ nb_places_max − inscrits)). Imports : ajouter `Icon` et `StatCard`, supprimer `Card` (plus utilisé). Remplacer le JSX (hors Modal, inchangé) par :

```tsx
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Groupes</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Organisez vos départs Hajj et Omra</p>
        </div>
        <Button onClick={ouvrirCreation}>
          <Icon name="group_add" size={18} className="mr-2" />
          Nouveau groupe
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Groupes" valeur={totaux.groupes} icon="group" />
        <StatCard label="Pèlerins inscrits" valeur={totaux.inscrits} icon="person" tone="vert" />
        <StatCard label="Places libres" valeur={totaux.placesLibres} icon="event_seat" tone={totaux.placesLibres === 0 ? 'error' : 'gold'} />
      </section>

      <div className="relative max-w-xs">
        <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <Input placeholder="Rechercher un groupe…" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="pl-10" />
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Départ</th>
                <th className="px-4 py-3">Retour</th>
                <th className="px-4 py-3">Places</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((g) => {
                const inscrits = g.pelerins[0]?.count ?? 0
                return (
                  <tr key={g.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                    <td className="px-4 py-4 font-medium text-primary">
                      <Link to={`/liste-des-pelerins?groupe=${g.id}`} className="hover:underline">{g.nom}</Link>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={g.type_voyage === 'hajj' ? 'ambre' : 'neutre'}>{LIBELLES_TYPE_VOYAGE[g.type_voyage]}</Badge>
                    </td>
                    <td className="px-4 py-4">{formatDate(g.date_depart)}</td>
                    <td className="px-4 py-4">{formatDate(g.date_retour)}</td>
                    <td className="px-4 py-4">
                      <span className={inscrits >= g.nb_places_max && g.nb_places_max > 0 ? 'font-semibold text-error' : ''}>
                        {inscrits} / {g.nb_places_max}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtres.length === 0 && <EmptyState message="Aucun groupe. Créez votre premier groupe Hajj ou Omra." />}
        </div>
      </div>
```

- [ ] **Step 6: Réécrire `Documents.tsx`**

LOGIQUE INCHANGÉE : interface `DocumentAvecPelerin`, `useQuery documents-tous`, mutations `majStatut`. Imports : ajouter `Icon`, `StatCard`, `LIBELLES_DOC_STATUT` (depuis `../lib/format`), `expirantDans` (depuis `../lib/documents`), `useSearchParams` ; supprimer `Card` (plus utilisé). AJOUTS : `alerte = params.get('alerte') ?? ''`, état `filtreType` initialisé à `'passeport'` si alerte, `filtreStatut` ; `useMemo filtres` = filtre type + statut + (si alerte : `type_document === 'passeport' && expirantDans(date_expiration, 90)`) ; `useMemo compteurs` (total, valides, manquants). Constantes locales :

```ts
const ICONES_DOCUMENT: Record<string, string> = {
  passeport: 'badge',
  visa: 'flight',
  certificat_vaccination: 'medical_information',
  photo: 'photo_camera',
  autre: 'description',
}
```

Remplacer le JSX par :

```tsx
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Gestion des documents</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Suivez les pièces de vos dossiers</p>
        </div>
        <select className="input max-w-xs" value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
          <option value="">Tous les types</option>
          {Object.entries(LIBELLES_DOCUMENT).map(([cle, libelle]) => (
            <option key={cle} value={cle}>{libelle}</option>
          ))}
        </select>
        <select className="input max-w-xs" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="manquant">Manquant</option>
          <option value="soumis">Soumis</option>
          <option value="valide">Validé</option>
          <option value="rejete">Rejeté</option>
        </select>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Documents" valeur={compteurs.total} icon="description" />
        <StatCard label="Validés" valeur={compteurs.valides} icon="check_circle" tone="vert" />
        <StatCard label="Manquants" valeur={compteurs.manquants} icon="error" tone="error" />
      </section>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((d) => (
                <tr key={d.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4">
                    <Link to={`/details-du-pelerin/${d.pelerin.id}`} className="font-medium text-primary hover:underline">
                      {d.pelerin.prenom} {d.pelerin.nom}
                    </Link>
                    <p className="text-label-md text-on-surface-variant">{d.pelerin.telephone}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-2">
                      <Icon name={ICONES_DOCUMENT[d.type_document] ?? 'description'} size={18} className="text-on-surface-variant" />
                      {LIBELLES_DOCUMENT[d.type_document]}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={TONE_DOCUMENT[d.statut]}>{LIBELLES_DOC_STATUT[d.statut]}</Badge>
                  </td>
                  <td className="px-4 py-4 text-data-mono text-on-surface-variant">{formatDate(d.date_expiration)}</td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {d.statut !== 'valide' && (
                        <button
                          onClick={() => majStatut.mutate({ id: d.id, statut: 'valide' })}
                          title="Valider"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-vert"
                        >
                          <Icon name="check_circle" size={18} />
                        </button>
                      )}
                      {d.statut === 'soumis' && (
                        <button
                          onClick={() => majStatut.mutate({ id: d.id, statut: 'rejete' })}
                          title="Rejeter"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"
                        >
                          <Icon name="error" size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtres.length === 0 && <EmptyState message="Aucun document pour ce filtre." />}
        </div>
      </div>
    </div>
```

- [ ] **Step 7: Réécrire `Paiements.tsx`**

LOGIQUE INCHANGÉE : interfaces `PlanEcheancier`, `useQuery echeanciers`, calculs `enRetard`, `totals`. AJOUTS : `useSearchParams` (`statutFiltre = params.get('statut')`) ; filtrage du tableau « Détail des tranches » : si `statutFiltre === 'en_retard'`, ne montrer que `t.statut === 'en_retard'` ; bouton « Enregistrer un paiement » : `useNavigate`, onClick → `navigate(`/details-du-pelerin/${plans[0].pelerin.id}`)` si `plans.length > 0` (désactivé sinon). Imports ajoutés : `useNavigate`, `Icon`, `StatCard`, `ProgressBar` (supprimer `Card` si plus utilisé — les 3 compteurs deviennent des StatCard ; les 2 tableaux gardent le conteneur maquette). Remplacer le JSX par :

```tsx
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Paiements & échéanciers</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Suivez les encaissements de vos pèlerins</p>
        </div>
        <Button onClick={() => plans[0] && navigate(`/details-du-pelerin/${plans[0].pelerin.id}`)} disabled={plans.length === 0}>
          <Icon name="payments" size={18} className="mr-2" />
          Enregistrer un paiement
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total attendu" valeur={formatFCFA(totals.total)} icon="request_quote" />
        <StatCard label="Total encaissé" valeur={formatFCFA(totals.paye)} icon="payments" tone="vert" />
        <StatCard label="Reste global" valeur={formatFCFA(totals.total - totals.paye)} icon="account_balance_wallet" tone={totals.total - totals.paye > 0 ? 'error' : 'vert'} />
      </section>

      {enRetard.length > 0 && (
        <div className="rounded-r-lg border-l-4 border-error bg-error-container/20 p-4">
          <p className="text-headline-sm text-error">{enRetard.length} tranche(s) en retard</p>
          <ul className="text-body-md mt-1 text-on-surface-variant">
            {enRetard.map(({ p, t }) => (
              <li key={t.id}>
                {p.pelerin.prenom} {p.pelerin.nom} — tranche {t.numero_tranche} ({formatFCFA(t.montant_prevu)}), échéance {formatDate(t.date_echeance)}.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Payé</th>
                <th className="px-4 py-3">Reste dû</th>
                <th className="px-4 py-3">Progression</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const paye = p.tranches.reduce((s, t) => s + t.paiements.reduce((x, y) => x + y.montant_paye, 0), 0)
                const reste = p.montant_total - paye
                const progression = p.montant_total > 0 ? Math.round((paye / p.montant_total) * 100) : 0
                const retard = p.tranches.filter((t) => t.statut === 'en_retard').length
                return (
                  <tr key={p.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                    <td className="px-4 py-4">
                      <Link to={`/details-du-pelerin/${p.pelerin.id}`} className="font-medium text-primary hover:underline">
                        {p.pelerin.prenom} {p.pelerin.nom}
                      </Link>
                      <p className="text-label-md text-on-surface-variant">{p.pelerin.telephone}</p>
                    </td>
                    <td className="px-4 py-4 text-data-mono">{formatFCFA(p.montant_total)} · {p.nombre_tranches} tranches</td>
                    <td className="px-4 py-4 font-medium text-vert">{formatFCFA(paye)}</td>
                    <td className={`px-4 py-4 font-medium ${reste > 0 ? 'text-error' : 'text-vert'}`}>{formatFCFA(reste)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-32">
                          <ProgressBar valeur={progression} tone={progression === 100 ? 'vert' : 'gold'} />
                        </div>
                        <span className="text-data-mono text-on-surface-variant">{progression}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {retard > 0 && <Badge tone="rouge">{retard} en retard</Badge>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {plans.length === 0 && <EmptyState message="Aucun plan de paiement." />}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="flex items-center gap-2 px-6 pt-5">
          <Icon name="event_note" size={20} className="text-primary" />
          <h2 className="text-headline-sm text-primary">Détail des tranches</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Tranche</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Échéance</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {plans
                .flatMap((p) =>
                  p.tranches.map((t) => ({ p, t }))
                )
                .filter(({ t }) => (statutFiltre === 'en_retard' ? t.statut === 'en_retard' : true))
                .map(({ p, t }) => (
                  <tr key={t.id} className="border-t border-outline-variant">
                    <td className="px-4 py-4">{p.pelerin.prenom} {p.pelerin.nom}</td>
                    <td className="px-4 py-4">Tranche {t.numero_tranche}</td>
                    <td className="px-4 py-4 text-data-mono">{formatFCFA(t.montant_prevu)}</td>
                    <td className="px-4 py-4">{formatDate(t.date_echeance)}</td>
                    <td className="px-4 py-4">
                      <Badge tone={TONE_TRANCHE[t.statut]}>{LIBELLES_TRANCHE[t.statut]}</Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
```

- [ ] **Step 8: Vérifier**

Run: `npm run build` → succès ; `npm test` → PASS (23).
Contrôle navigateur : Pèlerins (`?q=moussa`, `?statut=incomplet`, `?nouveau=1` depuis le bouton du dashboard), Groupes (recherche + actions survol), Documents (`?alerte=passeport` depuis l'alerte du dashboard → seuls les passeports expirant sous 90 j ; badges libellés français), Paiements (`?statut=en_retard` → tableau des tranches filtré). Comparer chaque page avec son `screen.png` maquette.

- [ ] **Step 9: Commit**

```bash
git add src/lib/documents.ts src/lib/documents.test.ts src/pages/Pelerins.tsx src/pages/Groupes.tsx src/pages/Documents.tsx src/pages/Paiements.tsx
git commit -m "feat(ui): listes maquette (cartes compteurs, tables actions survol, filtres URL)"
```

---

### Task 5: Fiche pèlerin — PelerinDetail, DocumentSection, PlanPaiementSection, RappelSection

**Files:** Modify `src/pages/PelerinDetail.tsx` (réécriture complète) · `src/components/documents/DocumentSection.tsx` (réécriture complète) · `src/components/paiements/PlanPaiementSection.tsx` (réécriture complète) · `src/components/rappels/RappelSection.tsx` (réécriture complète)

**Produces:** requête fiche avec join additif `groupe:groupes(nom)` ; carte profil maquette (bandeau dégradé navy, avatar, ID en `data-mono`, badge groupe pill, infos, contact d'urgence) ; grille « Documents Requis » avec compteur x/y Validés, cartes par type (icône teintée par statut, chip de statut, bouton Voir) ; timeline verticale de paiement (payée = vert + coche, partielle = doré, en attente = contour, échéance + versé + badge + bouton Encaisser).
**Référence:** `maquette/d_tails_du_p_lerin/code.html` (carte profil lignes 235-267, documents lignes 289-314+, progression/timeline fin de fichier).

- [ ] **Step 1: Réécrire `PelerinDetail.tsx`**

LOGIQUE INCHANGÉE : état `{ enEdition, form, erreur }`, mutation `enregistrer`, `ouvrirEdition`, `onSubmit`, le formulaire d'édition (champs Prénom, Nom, Téléphone, Email, Naissance, Sexe, Contact urgence ×2 — conserver exactement). SEULE MODIFICATION requête : `select('*, groupe:groupes(nom)')` au lieu de `select('*')`, type `PelerinAvecGroupe extends Pelerin { groupe: { nom: string } | null }`. Imports : remplacer `Card` par `Icon` et `EmptyState`, retirer les imports devenus inutilisés (`LIBELLES_SEXE`), conserver `Badge`, `Field`, `Input`, `Select`, `Button`, `formatDate`, `LIBELLES_DOSSIER`, `TONE_DOSSIER`. Contenu complet :

```tsx
  if (isLoading) return <div className="flex h-screen items-center justify-center text-on-surface">Chargement…</div>
  if (!pelerin) return <div className="flex h-screen items-center justify-center text-error">Pèlerin introuvable.</div>

  const ouvrirEdition = () => {
    setForm({ ...pelerin })
    setEnEdition(true)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    enregistrer.mutate()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-label-md text-on-surface-variant">
            <Link to="/liste-des-pelerins" className="hover:text-primary">Pèlerins</Link>
            <Icon name="chevron_right" size={16} />
            <span className="font-bold text-primary">Détails</span>
          </div>
          <h2 className="text-display-lg text-primary">Dossier Pèlerin</h2>
        </div>
        <div className="flex gap-3">
          {!enEdition && (
            <Button variant="secondary" onClick={ouvrirEdition}>
              <Icon name="edit" size={18} className="mr-2" />
              Modifier
            </Button>
          )}
          {enEdition && (
            <Button onClick={onSubmit} disabled={enregistrer.isPending}>
              <Icon name="save" size={18} className="mr-2" />
              Enregistrer
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-4">
          {enEdition && form ? (
            <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
              <Field label="Prénom">
                <Input required value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
              </Field>
              <Field label="Nom">
                <Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              </Field>
              <Field label="Téléphone">
                <Input required value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value || null })} />
              </Field>
              <Field label="Date de naissance">
                <Input type="date" value={form.date_naissance ?? ''} onChange={(e) => setForm({ ...form, date_naissance: e.target.value || null })} />
              </Field>
              <Field label="Sexe">
                <Select value={form.sexe ?? 'M'} onChange={(e) => setForm({ ...form, sexe: e.target.value as 'M' | 'F' })}>
                  <option value="M">Homme</option>
                  <option value="F">Femme</option>
                </Select>
              </Field>
              <Field label="Contact urgence — nom">
                <Input value={form.contact_urgence_nom ?? ''} onChange={(e) => setForm({ ...form, contact_urgence_nom: e.target.value || null })} />
              </Field>
              <Field label="Contact urgence — téléphone">
                <Input value={form.contact_urgence_telephone ?? ''} onChange={(e) => setForm({ ...form, contact_urgence_telephone: e.target.value || null })} />
              </Field>
              {erreur && <p className="text-sm text-error">{erreur}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={enregistrer.isPending}>Enregistrer</Button>
                <Button type="button" variant="secondary" onClick={() => setEnEdition(false)}>Annuler</Button>
              </div>
            </form>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center shadow-sm">
                <div className="absolute left-0 top-0 h-24 w-full bg-gradient-to-r from-primary-container to-surface-tint opacity-20" />
                <div className="relative z-10 mb-4 mt-6">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-surface-container-lowest bg-surface-container shadow-sm">
                    <Icon name="person" size={40} className="text-on-surface-variant" />
                  </div>
                </div>
                <h3 className="text-headline-md text-primary">{pelerin.prenom} {pelerin.nom}</h3>
                <p className="text-data-mono mb-4 text-on-surface-variant">ID: {pelerin.id.slice(0, 8).toUpperCase()}</p>
                <span className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed px-3 py-1 text-label-md text-on-secondary-fixed-variant">
                  <Icon name="group" size={14} />
                  Groupe: {pelerin.groupe?.nom ?? '—'}
                </span>
                <div className="w-full border-t border-outline-variant pt-4 text-left">
                  <div className="grid gap-3">
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Date de naissance</span>
                      <span className="text-body-md text-on-surface">{formatDate(pelerin.date_naissance)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Téléphone</span>
                      <span className="text-body-md text-on-surface">{pelerin.telephone}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Email</span>
                      <span className="text-body-md text-on-surface">{pelerin.email ?? '—'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Dossier</span>
                      <span className="mt-1"><Badge tone={TONE_DOSSIER[pelerin.statut_dossier]}>{LIBELLES_DOSSIER[pelerin.statut_dossier]}</Badge></span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 border-b border-outline-variant pb-3">
                  <Icon name="contact_emergency" size={20} className="text-primary" />
                  <h4 className="text-headline-sm text-primary">Contact d’Urgence</h4>
                </div>
                {pelerin.contact_urgence_nom ? (
                  <div className="grid gap-3">
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Nom complet</span>
                      <span className="text-body-md text-on-surface">{pelerin.contact_urgence_nom}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface-variant">Téléphone</span>
                      <span className="text-body-md text-on-surface">{pelerin.contact_urgence_telephone ?? '—'}</span>
                    </div>
                  </div>
                ) : (
                  <EmptyState message="Aucun contact d’urgence renseigné." />
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-8">
          <DocumentSection pelerinId={pelerin.id} />
          <PlanPaiementSection pelerinId={pelerin.id} />
          <RappelSection pelerinId={pelerin.id} />
        </div>
      </div>
    </div>
  )
```

- [ ] **Step 2: Réécrire `DocumentSection.tsx`**

LOGIQUE INCHANGÉE : `TYPES_DOCUMENT`, `useQuery documents`, mutations `majStatut`/`supprimer`/`televerser`, `voirFichier`, `onChangeFichier`, inputRef/typeChoisi, la barre d'upload (select type + bouton Téléverser). Constantes locales :

```ts
const ICONES_DOCUMENT: Record<string, string> = {
  passeport: 'badge',
  visa: 'flight',
  certificat_vaccination: 'medical_information',
  photo: 'photo_camera',
  autre: 'description',
}

const TINTE_DOCUMENT: Record<string, string> = {
  valide: 'bg-green-50 text-green-700',
  soumis: 'bg-amber-50 text-ambre',
  manquant: 'bg-red-50 text-error',
  rejete: 'bg-red-50 text-error',
}

const CHIP_DOCUMENT: Record<string, string> = {
  valide: 'bg-green-100 text-green-800 border-green-200',
  soumis: 'bg-amber-100 text-ambre border-amber-200',
  manquant: 'bg-red-100 text-error border-red-200',
  rejete: 'bg-red-100 text-error border-red-200',
}
```

Remplacer le JSX (après le calcul `const valides = documents.filter((d) => d.statut === 'valide').length`) par :

```tsx
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="folder_open" size={20} className="text-primary" />
          <h4 className="text-headline-sm text-primary">Documents Requis</h4>
        </div>
        <span className="rounded-md bg-surface-container px-2 py-1 text-label-md text-on-surface-variant">
          {valides}/{documents.length} Validés
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className="input max-w-xs"
          defaultValue="passeport"
          onChange={(e) => { typeChoisi.current = e.target.value }}
          aria-label="Type de document"
        >
          {TYPES_DOCUMENT.map((t) => (
            <option key={t} value={t}>{LIBELLES_DOCUMENT[t]}</option>
          ))}
        </select>
        <input ref={inputRef} type="file" hidden onChange={onChangeFichier} />
        <Button type="button" variant="secondary" disabled={televerser.isPending} onClick={() => inputRef.current?.click()}>
          <Icon name="upload_file" size={18} className="mr-2" />
          {televerser.isPending ? 'Upload…' : 'Téléverser un fichier'}
        </Button>
      </div>

      {documents.length === 0 && <EmptyState message="Aucun document pour ce pèlerin." />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-start gap-4 rounded-lg border border-outline-variant p-4 transition-colors hover:bg-surface-container-low">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded ${TINTE_DOCUMENT[doc.statut] ?? 'bg-surface-container text-on-surface-variant'}`}>
              <Icon name={ICONES_DOCUMENT[doc.type_document] ?? 'description'} size={20} />
            </div>
            <div className="flex-1">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h5 className="text-body-md font-bold text-on-surface">{LIBELLES_DOCUMENT[doc.type_document]}</h5>
                <span className={`rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${CHIP_DOCUMENT[doc.statut] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {LIBELLES_DOC_STATUT[doc.statut]}
                </span>
              </div>
              <p className="text-label-md mb-2 text-on-surface-variant">
                {doc.fichier_url ? 'Fichier joint' : 'Aucun fichier'} · Expire le {formatDate(doc.date_expiration)}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                {doc.fichier_url && (
                  <button onClick={() => voirFichier(doc)} className="flex items-center gap-1 text-label-md text-primary hover:underline">
                    <Icon name="visibility" size={14} /> Voir
                  </button>
                )}
                {doc.statut !== 'valide' && (
                  <button onClick={() => majStatut.mutate({ id: doc.id, statut: 'valide' })} className="flex items-center gap-1 text-label-md text-vert hover:underline">
                    <Icon name="check_circle" size={14} /> Valider
                  </button>
                )}
                {doc.statut === 'soumis' && (
                  <button onClick={() => majStatut.mutate({ id: doc.id, statut: 'rejete' })} className="flex items-center gap-1 text-label-md text-error hover:underline">
                    <Icon name="error" size={14} /> Rejeter
                  </button>
                )}
                <button onClick={() => supprimer.mutate(doc)} title="Supprimer" className="rounded-lg p-1 text-gray-400 hover:text-error">
                  <Icon name="delete" size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
```

Imports : ajouter `Icon`, `LIBELLES_DOC_STATUT` (depuis `../../lib/format`) ; retirer `Card`, `Badge` et `TONE_DOCUMENT` (plus utilisés).

- [ ] **Step 3: Réécrire `PlanPaiementSection.tsx`**

LOGIQUE INCHANGÉE : état (creation, montantTotal, nombreTranches, premiereEcheance, encaissement, montantPaiement, modePaiement, reference, erreur), `useQuery plan`, mutations `creerPlan`/`encaisser`, calculs `paye`, `reste`, `progression`, `ouvrirEncaissement`, le formulaire de création (quand `!plan`), le panneau d'encaissement (reprendre le bloc existant mais remplacer `border border-navy bg-surface` par `border border-primary bg-surface-container-low`). Remplacer le JSX principal (quand `plan`) par :

```tsx
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon name="payments" size={20} className="text-primary" />
        <h2 className="text-headline-sm text-primary">Plan de paiement</h2>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-6 text-body-md">
        <p className="text-on-surface-variant">Total : <span className="font-semibold text-on-surface">{formatFCFA(plan.montant_total)}</span></p>
        <p className="text-on-surface-variant">Payé : <span className="font-semibold text-vert">{formatFCFA(paye)}</span></p>
        <p className="text-on-surface-variant">Reste dû : <span className={`font-semibold ${reste > 0 ? 'text-error' : 'text-vert'}`}>{formatFCFA(reste)}</span></p>
        <div className="w-48">
          <ProgressBar valeur={progression} tone={progression === 100 ? 'vert' : 'gold'} label={`${progression}%`} />
        </div>
      </div>

      <ol className="relative space-y-6 border-l-2 border-outline-variant pl-6">
        {plan.tranches.map((t) => {
          const verse = t.paiements.reduce((s, p) => s + p.montant_paye, 0)
          const payee = verse >= t.montant_prevu
          const partielle = verse > 0 && !payee
          const dotCls = payee
            ? 'bg-green-600'
            : partielle
              ? 'bg-secondary-fixed-dim'
              : 'border-2 border-outline bg-surface-container-lowest'
          return (
            <li key={t.id} className="relative">
              <span className={`absolute -left-8 top-4 flex h-4 w-4 items-center justify-center rounded-full ${dotCls}`}>
                {payee && <Icon name="check" size={12} className="text-white" />}
              </span>
              <div className="rounded-lg border border-outline-variant p-4 transition-colors hover:bg-surface-container-low">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-body-md font-bold text-on-surface">Tranche {t.numero_tranche} — {formatFCFA(t.montant_prevu)}</p>
                    <p className="text-label-md text-on-surface-variant">Échéance {formatDate(t.date_echeance)} · Versé {formatFCFA(verse)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={TONE_TRANCHE[t.statut]}>{LIBELLES_TRANCHE[t.statut]}</Badge>
                    {verse < t.montant_prevu && (
                      <Button variant="secondary" onClick={() => ouvrirEncaissement(t)}>Encaisser</Button>
                    )}
                  </div>
                </div>
                {t.paiements.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-outline-variant pt-2 text-label-md text-on-surface-variant">
                    {t.paiements.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <Icon name="check_circle" size={14} className="text-green-600" />
                        {formatDate(p.date_paiement)} — {formatFCFA(p.montant_paye)} ({LIBELLES_MODE[p.mode]}{p.reference ? ` — réf. ${p.reference}` : ''})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {encaissement.ouvert && (
        <div className="mt-4 rounded-md border border-primary bg-surface-container-low p-4">
          <p className="mb-3 text-body-md font-semibold text-primary">
            Encaissement — tranche {encaissement.tranche.numero_tranche} (reste {formatFCFA(encaissement.tranche.montant_prevu - encaissement.tranche.paiements.reduce((s, p) => s + p.montant_paye, 0))})
          </p>
          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); setErreur(''); encaisser.mutate() }}
            className="grid grid-cols-1 gap-4 md:grid-cols-4"
          >
            <Field label="Montant (FCFA)">
              <Input required type="number" min={1} value={montantPaiement} onChange={(e) => setMontantPaiement(e.target.value)} />
            </Field>
            <Field label="Mode">
              <Select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
                <option value="especes">Espèces</option>
                <option value="wave">Wave</option>
                <option value="orange_money">Orange Money</option>
                <option value="virement">Virement bancaire</option>
                <option value="autre">Autre</option>
              </Select>
            </Field>
            <Field label="Référence (optionnel)">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ID transaction…" />
            </Field>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={encaisser.isPending}>Encaisser</Button>
              <Button type="button" variant="secondary" onClick={() => setEncaissement({ tranche: null!, ouvert: false })}>Fermer</Button>
            </div>
            {erreur && <p className="text-sm text-error md:col-span-4">{erreur}</p>}
          </form>
        </div>
      )}
    </div>
```

Imports : ajouter `Icon`, `ProgressBar` ; le formulaire de création (cas `!plan`) garde sa logique mais remplace `Card className="p-6"` par `<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">…</div>` et le titre `text-sm font-semibold text-navy` par `text-headline-sm text-primary` avec l'icône `payments` (même bloc header que ci-dessus).

- [ ] **Step 4: Réécrire `RappelSection.tsx`**

LOGIQUE INCHANGÉE : requêtes, `creerRappel`, `majStatutRappel`, `messagePour`. Remplacer le JSX par :

```tsx
    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon name="notifications" size={20} className="text-primary" />
        <h2 className="text-headline-sm text-primary">Rappels WhatsApp</h2>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tranches.filter((t) => t.statut !== 'payee').map((t) => (
          <Button
            key={t.id}
            variant="secondary"
            disabled={creerRappel.isPending}
            onClick={() => creerRappel.mutate({ trancheId: t.id })}
          >
            <Icon name="schedule" size={16} className="mr-2" />
            Rappel tranche {t.numero_tranche} ({formatFCFA(t.montant_prevu)})
          </Button>
        ))}
        {documents.filter((d) => d.statut !== 'valide').map((d) => (
          <Button
            key={d.id}
            variant="secondary"
            disabled={creerRappel.isPending}
            onClick={() => creerRappel.mutate({ documentId: d.id })}
          >
            <Icon name="description" size={16} className="mr-2" />
            Rappel {LIBELLES_DOCUMENT[d.type_document]}
          </Button>
        ))}
      </div>

      {rappels.length === 0 && <EmptyState message="Aucun rappel pour ce pèlerin." />}
      <div className="space-y-2">
        {rappels.map((r) => {
          const libelle = r.tranche
            ? `Tranche ${r.tranche.numero_tranche} — ${formatFCFA(r.tranche.montant_prevu)}`
            : r.document
              ? LIBELLES_DOCUMENT[r.document.type_document]
              : '—'
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant p-3 transition-colors hover:bg-surface-container-low">
              <div>
                <p className="text-body-md font-medium text-on-surface">{libelle}</p>
                <p className="text-label-md text-on-surface-variant">Prévu le {formatDate(r.date_envoi_prevue)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={TONE_RAPPEL[r.statut_envoi]}>{LIBELLES_RAPPEL[r.statut_envoi]}</Badge>
                {pelerin && r.statut_envoi !== 'envoye' && (
                  <a href={whatsappUrl(pelerin.telephone, messagePour(r))} target="_blank" rel="noreferrer" className="btn-primary text-xs">
                    Envoyer sur WhatsApp
                  </a>
                )}
                {r.statut_envoi === 'en_attente' && (
                  <button onClick={() => majStatutRappel.mutate({ id: r.id, statut: 'envoye' })} className="text-label-md text-vert hover:underline">
                    Marquer envoyé
                  </button>
                )}
                {r.statut_envoi !== 'echec' && r.statut_envoi !== 'envoye' && (
                  <button onClick={() => majStatutRappel.mutate({ id: r.id, statut: 'echec' })} className="text-label-md text-error hover:underline">
                    Échec
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
```

Imports : ajouter `Icon`, supprimer `Card` si plus utilisé.

- [ ] **Step 5: Vérifier**

Run: `npm run build` → succès ; `npm test` → PASS (23).
Contrôle navigateur (fiche de `Fall` via la liste des pèlerins) : breadcrumbs Pèlerins › Détails, titre « Dossier Pèlerin », carte profil (bandeau dégradé, avatar initiale, ID, badge Groupe: Al Hidjah…, infos, badge dossier), Contact d'Urgence, Documents Requis (compteur x/y, chips français, icônes teintées, Voir/Valider/Rejeter), Plan de paiement (résumé + ProgressBar + timeline verticale : tranche payée verte à coche, partielle dorée), Rappels WhatsApp. Comparer avec `maquette/d_tails_du_p_lerin/screen.png`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PelerinDetail.tsx src/components/documents/DocumentSection.tsx src/components/paiements/PlanPaiementSection.tsx src/components/rappels/RappelSection.tsx
git commit -m "feat(ui): fiche pelerin maquette (carte profil, documents, timeline paiement)"
```

---

### Task 6: Pages restantes — Login, Signup, Onboarding, Membres

**Files:** Modify `src/pages/Login.tsx` · `src/pages/Signup.tsx` · `src/pages/Onboarding.tsx` (réécritures complètes) · `src/pages/Membres.tsx` (rendu refondu, logique inchangée)

**Produces:** pages non maquettées déclinées dans le langage visuel : fond `bg-surface`, carte `rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm`, logo mosquée circulaire navy + nom de l'app, titres `text-headline-md`, champs `.input` avec `.label`, bouton `btn-primary w-full`, liens de bas de carte en `text-primary underline`.
**Référence:** design system §6 de `docs/superpowers/specs/2026-08-14-ui-fidelite-maquette-design.md`.

- [ ] **Step 1: Réécrire `Login.tsx`** — contenu complet (logique inchangée) :

```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Icon from '../components/ui/Icon'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setEnCours(true)
    setErreur('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setEnCours(false)
    if (error) {
      setErreur('Email ou mot de passe incorrect.')
      return
    }
    navigate('/tableau-de-bord')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <Icon name="mosque" size={20} />
          </div>
          <h1 className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</h1>
        </div>
        <h2 className="text-headline-md mb-6 text-primary">Se connecter</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label mb-1 block" htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="label mb-1 block" htmlFor="password">Mot de passe</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" />
          </div>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <button type="submit" disabled={enCours} className="btn-primary w-full">
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <p className="mt-4 text-sm">
          Pas encore de compte ?{' '}
          <Link to="/signup" className="text-primary underline">Créer un compte</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Réécrire `Signup.tsx`** — contenu complet (logique inchangée) :

```tsx
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Icon from '../components/ui/Icon'

export default function Signup() {
  const [params] = useSearchParams()
  const inviteToken = params.get('invite')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setEnCours(true)
    setErreur('')
    const meta: Record<string, string> = { nom }
    if (inviteToken) meta.invite_token = inviteToken
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: meta },
    })
    setEnCours(false)
    if (error) {
      setErreur(error.message)
      return
    }
    setMessage('Compte créé. Vous pouvez vous connecter.')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <Icon name="mosque" size={20} />
          </div>
          <h1 className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</h1>
        </div>
        <h2 className="text-headline-md mb-6 text-primary">Créer un compte</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label mb-1 block" htmlFor="nom">Nom complet</label>
            <input id="nom" required value={nom} onChange={(e) => setNom(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="label mb-1 block" htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="label mb-1 block" htmlFor="password">Mot de passe</label>
            <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="input w-full" />
          </div>
          {inviteToken && (
            <p className="text-sm text-gold">Invitation détectée : votre agence vous sera rattachée automatiquement.</p>
          )}
          {message && <p className="text-sm text-green-700">{message}</p>}
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <button type="submit" disabled={enCours} className="btn-primary w-full">
            {enCours ? 'Création…' : 'Créer le compte'}
          </button>
        </form>
        <p className="mt-4 text-sm">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-primary underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Réécrire `Onboarding.tsx`** — contenu complet (logique inchangée) :

```tsx
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useProfil } from '../hooks/useAgence'
import { Field, Input } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

export default function Onboarding() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: profil, isLoading } = useProfil()
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [adresse, setAdresse] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  if (isLoading) return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  if (!profil) return <Navigate to="/login" replace />
  if (profil.agence_id) return <Navigate to="/tableau-de-bord" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setEnCours(true)
    setErreur('')
    const { data: agence, error: e1 } = await supabase
      .from('agences')
      .insert({ nom, telephone, adresse })
      .select('id')
      .single()
    if (e1 || !agence) {
      setErreur('Impossible de créer l’agence.')
      setEnCours(false)
      return
    }
    const { error: e2 } = await supabase
      .from('utilisateurs')
      .update({ agence_id: agence.id, role: 'gerant' })
      .eq('user_id', profil!.user_id)
    setEnCours(false)
    if (e2) {
      setErreur('Agence créée mais rattachement impossible. Rechargez la page.')
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['profil'] })
    await queryClient.invalidateQueries({ queryKey: ['agence'] })
    navigate('/tableau-de-bord')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <Icon name="mosque" size={20} />
          </div>
          <h1 className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</h1>
        </div>
        <h2 className="text-headline-md mb-2 text-primary">Créer votre agence</h2>
        <p className="text-body-md mb-6 text-on-surface-variant">
          Bienvenue {profil.nom}. Renseignez les informations de votre agence pour commencer.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nom de l’agence">
            <Input required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Al Hidjah Travel Dakar" />
          </Field>
          <Field label="Téléphone">
            <Input required value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+221 77 XXX XX XX" />
          </Field>
          <Field label="Adresse">
            <Input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Dakar, Sénégal" />
          </Field>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <Button type="submit" disabled={enCours} className="w-full">
            {enCours ? 'Création…' : 'Créer mon agence'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Refondre `Membres.tsx`** (logique inchangée : état, `useQuery membres`/`invitations`, mutations `inviter`/`supprimer`/`supprimerInvitation`, `onSubmit`, affichage du lien d'invitation — remplacer `border border-gold bg-gold-container/30` par `border border-secondary bg-secondary-container/20`)

Remplacer l'en-tête et les 2 tableaux par :

```tsx
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Membres</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Gérez votre équipe et vos invitations</p>
        </div>
      </div>

      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Icon name="person_add" size={20} className="text-primary" />
          <h2 className="text-headline-sm text-primary">Inviter un membre</h2>
        </div>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
          <div className="min-w-64 flex-1">
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <div className="w-40">
            <Field label="Rôle">
              <Select value={role} onChange={(e) => setRole(e.target.value as 'gerant' | 'agent')}>
                <option value="agent">Agent</option>
                <option value="gerant">Gérant</option>
              </Select>
            </Field>
          </div>
          <Button type="submit" disabled={inviter.isPending}>Générer le lien</Button>
        </form>
        {erreur && <p className="mt-2 text-sm text-error">{erreur}</p>}
        {lienInvitation && (
          <div className="mt-4 rounded-md border border-secondary bg-secondary-container/20 p-3">
            <p className="mb-1 text-sm font-semibold text-navy">Lien d’invitation à partager (WhatsApp, email…) :</p>
            <p className="break-all text-sm text-navy">{lienInvitation}</p>
            <button type="button" className="btn-secondary mt-2 text-xs" onClick={() => navigator.clipboard.writeText(lienInvitation)}>
              Copier le lien
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => (
                <tr key={m.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4 font-medium text-primary">{m.nom}</td>
                  <td className="px-4 py-4">{m.email}</td>
                  <td className="px-4 py-4">
                    <Badge tone={m.role === 'gerant' ? 'ambre' : 'neutre'}>{m.role === 'gerant' ? 'Gérant' : 'Agent'}</Badge>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {m.user_id !== profil?.user_id && (
                      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => supprimer.mutate(m.id)}
                          title="Retirer"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {membres.length === 0 && <EmptyState message="Aucun membre pour le moment." />}
        </div>
      </div>

      {invitations.filter((i) => !i.used_at).length > 0 && (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-body-md">
              <thead>
                <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                  <th className="px-4 py-3">Email invité</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Expire le</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invitations.filter((i) => !i.used_at).map((i) => (
                  <tr key={i.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                    <td className="px-4 py-4">{i.email}</td>
                    <td className="px-4 py-4">{i.role === 'gerant' ? 'Gérant' : 'Agent'}</td>
                    <td className="px-4 py-4">{new Date(i.expires_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => supprimerInvitation.mutate(i.id)}
                          title="Annuler"
                          className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container hover:text-error"
                        >
                          <Icon name="close" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
```

Imports : ajouter `Icon` (supprimer `Card` si plus utilisé).

- [ ] **Step 5: Vérifier**

Run: `npm run build` → succès ; `npm test` → PASS (23).
Contrôle navigateur : déconnexion (sidebar) → Login conforme (logo, carte 16px) ; `/signup` idem ; `/onboarding` (compte sans agence) ; `/membres` (gérant) : carte d'invitation, tableau membres avec icône Retirer au survol, tableau invitations.
- [ ] **Step 6: Commit**

```bash
git add src/pages/Login.tsx src/pages/Signup.tsx src/pages/Onboarding.tsx src/pages/Membres.tsx
git commit -m "feat(ui): pages auth et membres dans le langage visuel maquette"
```

---

### Task 7: Vérification finale

**Files:** aucun (contrôles uniquement)

- [ ] **Step 1: Suites de contrôle**

Run: `npm test` → Expected: PASS (23 tests : 15 existants + 4 recherche + 4 documents).
Run: `npm run build` → Expected: succès (tsc -b && vite build sans erreur).
Run: `npm run lint` → Expected: uniquement le warning préexistant AuthContext.tsx (fast-refresh).
Run: `git log --oneline -8` → Expected: les 7 commits de refonte en tête (`feat(ui): …`).

- [ ] **Step 2: Revue visuelle complète avec l'utilisateur**

Sur http://localhost:5173/ (compte `moussa@alhidjah.sn` / `Hajj2027!`), parcourir les 7 écrans et comparer aux `maquette/*/screen.png` :
1. Tableau de bord (alertes cliquables, bento, progression, rappels)
2. Liste des pèlerins (compteurs, filtres, actions au survol) + `?nouveau=1`
3. Liste des groupes (recherche, actions survol)
4. Gestion des documents (+ `?alerte=passeport`)
5. Paiements & échéanciers (+ `?statut=en_retard`, timeline sur fiche)
6. Fiche pèlerin (profil, documents, timeline)
7. Login / Signup / Onboarding / Membres + recherche globale topbar + tiroir mobile (largeur < 768px)

Écarts acceptables (définis avec l'utilisateur lors du brainstorming) : contenu réel (noms, montants, groupes) au lieu des exemples de la maquette ; cloche/hi aide/« Rapport Global »/tendance décoratifs ; pas de photo de profil (avatar initiale) ; nom de l'app « Stitch Sama Pèlerin » au lieu de « Al-Haram Manager ».

- [ ] **Step 3: Rapport final**

Mettre à jour `.superpowers/sdd/progress.md` (section « Refonte UI/UX maquette — terminée ») et rappeler à l'utilisateur les actions restantes hors code : désactiver « Confirm email » dans Supabase (Authentication → Sign In / Providers → Email) avant tout déploiement ; puis déploiement Vercel (env vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, README §5).
