# Icônes Notifications & Profil Fonctionnelles — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre fonctionnelles la cloche notifications, l'avatar profil et les boutons Aide de la Topbar (layout agences), conformément à la spec `docs/superpowers/specs/2026-08-31-icones-notifications-profil-design.md`.

**Architecture:** Deux composants dropdown autonomes (`NotifPanel`, `ProfilMenu`) partageant un hook `useDropdown` (fermeture au clic extérieur + Échap), une page profil `/profil` en lecture seule, et des liens « Aide » vers `/tutoriels` existant. Les données viennent de Supabase via React Query (même pattern de jointure que `Dashboard.tsx`).

**Tech Stack:** React 19, TypeScript strict, Vite, Tailwind CSS v4 (tokens `--text-*`, classes `text-on-surface`, `bg-surface-container-lowest`…), React Query, React Router v7, Vitest + Testing Library, oxlint.

## Global Constraints

- TDD : écrire le test d'abord, vérifier qu'il échoue, implémenter, vérifier qu'il passe.
- Aucun commentaire dans le code (convention repo).
- Textes en français (libellés identiques à l'existant : « En attente », « Échec », « Aucune notification »).
- Périmètre : layout des agences uniquement (`AppLayout`). Le layout superadmin est inchangé.
- Page profil en lecture seule — aucune édition (YAGNI).
- Pas de nouvelle dépendance npm.
- Commandes de vérification : `npx vitest run <fichier>` pour un fichier, `npm run test` (suite), `npm run lint` (oxlint), `npm run build` (tsc -b && vite build).

---
### Task 1: Hook `useDropdown`

**Files:**
- Create: `src/hooks/useDropdown.ts`
- Test: `src/hooks/useDropdown.test.ts`

**Interfaces:**
- Produces: `useDropdown()` → `{ ref: RefObject<HTMLDivElement>, ouvert: boolean, basculer: () => void, fermer: () => void }`
- Contrat : tant que `ouvert` est vrai, un clic `mousedown` hors du nœud `ref` ou la touche `Escape` positionne `ouvert` à `false`. Les listeners sont posés sur `document` uniquement quand `ouvert` est vrai, et retirés au nettoyage.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useDropdown.test.ts`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import useDropdown from './useDropdown'

function TestComposant() {
  const { ref, ouvert, basculer, fermer } = useDropdown()
  return (
    <div>
      <div ref={ref}>
        <button type="button" onClick={basculer}>Bouton</button>
        {ouvert && <p>Ouvert</p>}
      </div>
      <button type="button" onClick={fermer}>Exterieur</button>
    </div>
  )
}

describe('useDropdown', () => {
  it('ouvre et ferme au clic sur le bouton', () => {
    render(<TestComposant />)
    fireEvent.click(screen.getByText('Bouton'))
    expect(screen.getByText('Ouvert')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Bouton'))
    expect(screen.queryByText('Ouvert')).not.toBeInTheDocument()
  })

  it('ferme au clic extérieur', () => {
    render(<TestComposant />)
    fireEvent.click(screen.getByText('Bouton'))
    expect(screen.getByText('Ouvert')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Exterieur'))
    expect(screen.queryByText('Ouvert')).not.toBeInTheDocument()
  })

  it('ferme avec la touche Échap', () => {
    render(<TestComposant />)
    fireEvent.click(screen.getByText('Bouton'))
    expect(screen.getByText('Ouvert')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Ouvert')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useDropdown.test.ts`
Expected: FAIL — `Cannot find module './useDropdown'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/hooks/useDropdown.ts`:

```ts
import { useEffect, useRef, useState } from 'react'

export default function useDropdown() {
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    function onClicExt(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false)
    }
    function onEchap(e: KeyboardEvent) {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', onClicExt)
    document.addEventListener('keydown', onEchap)
    return () => {
      document.removeEventListener('mousedown', onClicExt)
      document.removeEventListener('keydown', onEchap)
    }
  }, [ouvert])

  return { ref, ouvert, basculer: () => setOuvert((v) => !v), fermer: () => setOuvert(false) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useDropdown.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDropdown.ts src/hooks/useDropdown.test.ts
git commit -m "feat(ui): hook useDropdown pour panneaux déroulants"
```

---
### Task 2: Composant `NotifPanel` (cloche notifications)

**Files:**
- Create: `src/components/layout/NotifPanel.tsx`
- Test: `src/components/layout/NotifPanel.test.tsx`

**Interfaces:**
- Consumes: `useDropdown()` (Task 1), `supabase` (`../../lib/supabase`), `LIBELLES_DOCUMENT`, `LIBELLES_RAPPEL`, `TONE_RAPPEL`, `formatDate`, `formatFCFA` (`../../lib/format`), `Icon`, `Badge`, `EmptyState` (`../ui/*`), types `Document`, `Pelerin`, `Rappel`, `Tranche` (`../../lib/types`).
- Produces: `NotifPanel` (pas de props) — rend un bouton cloche avec pastille compteur + panneau déroulant de rappels. Utilisé par `Topbar` (Task 5).

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/NotifPanel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import NotifPanel from './NotifPanel'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

const queryClient = new QueryClient()

const rappelTranche = {
  id: 'r1',
  statut_envoi: 'en_attente',
  date_envoi_prevue: '2026-09-01T12:00:00Z',
  tranche: {
    numero_tranche: 2,
    montant_prevu: 500000,
    date_echeance: '2026-09-01',
    plan_paiement: { pelerin: { id: 'p1', prenom: 'Awa', nom: 'Ndiaye' } },
  },
  document: null,
}

const rappelEchec = {
  id: 'r2',
  statut_envoi: 'echec',
  date_envoi_prevue: '2026-09-02T12:00:00Z',
  tranche: null,
  document: { type_document: 'passeport', statut: 'manquant', pelerin: { id: 'p2', prenom: 'Omar', nom: 'Fall' } },
}

function mockRappels(data: unknown[], error: unknown = null) {
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'rappels') {
      return {
        select: () => ({
          in: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data, error }),
            }),
          }),
        }),
      }
    }
    return {}
  })
}

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/tableau-de-bord']}>
        <Routes>
          <Route path="/tableau-de-bord" element={<NotifPanel />} />
          <Route path="/details-du-pelerin/:id" element={<div>Fiche pelerin</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockRappels([], null)
})

describe('NotifPanel', () => {
  it('masque le panneau au départ', () => {
    rendre()
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
  })

  it('affiche les rappels en attente au clic sur la cloche', async () => {
    mockRappels([rappelTranche])
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Awa Ndiaye')).toBeInTheDocument()
    expect(screen.getByText(/Tranche 2/)).toBeInTheDocument()
    expect(screen.getByText('En attente')).toBeInTheDocument()
    expect(screen.getByText('01/09/2026')).toBeInTheDocument()
  })

  it('affiche aussi les rappels en échec avec leur badge', async () => {
    mockRappels([rappelTranche, rappelEchec])
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Omar Fall')).toBeInTheDocument()
    expect(screen.getByText('Échec')).toBeInTheDocument()
    expect(screen.getByText('Passeport')).toBeInTheDocument()
  })

  it('affiche le compteur sur la pastille', async () => {
    mockRappels([rappelTranche, rappelEchec])
    rendre()
    expect(await screen.findByText('2')).toBeInTheDocument()
  })

  it('affiche un état vide quand aucun rappel', async () => {
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Aucune notification')).toBeInTheDocument()
  })

  it('affiche un message quand la requête échoue', async () => {
    mockRappels(null, new Error('boom'))
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Impossible de charger les notifications')).toBeInTheDocument()
  })

  it('navigue vers la fiche du pèlerin au clic sur un item', async () => {
    mockRappels([rappelTranche])
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    fireEvent.click(await screen.findByText('Awa Ndiaye'))
    expect(await screen.findByText('Fiche pelerin')).toBeInTheDocument()
  })

  it('ferme le panneau au clic extérieur', async () => {
    mockRappels([rappelTranche])
    rendre()
    fireEvent.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Awa Ndiaye')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Awa Ndiaye')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/NotifPanel.test.tsx`
Expected: FAIL — `Cannot find module './NotifPanel'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/layout/NotifPanel.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import useDropdown from '../../hooks/useDropdown'
import { LIBELLES_DOCUMENT, LIBELLES_RAPPEL, TONE_RAPPEL, formatDate, formatFCFA } from '../../lib/format'
import type { Document, Pelerin, Rappel, Tranche } from '../../lib/types'
import Icon from '../ui/Icon'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'

interface RappelAvecPelerin extends Rappel {
  tranche: (Tranche & { plan_paiement: { pelerin: Pelerin } }) | null
  document: (Document & { pelerin: Pelerin }) | null
}

export default function NotifPanel() {
  const navigate = useNavigate()
  const { ref, ouvert, basculer, fermer } = useDropdown()

  const { data: rappels = [], isError } = useQuery({
    queryKey: ['notifications-rappels'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rappels')
        .select('id, statut_envoi, date_envoi_prevue, tranche:tranches(numero_tranche, montant_prevu, date_echeance, plan_paiement:plans_paiement(pelerin:pelerins(*))), document:documents(type_document, statut, pelerin:pelerins(*))')
        .in('statut_envoi', ['en_attente', 'echec'])
        .order('date_envoi_prevue', { ascending: true })
        .limit(10)
      return (data as unknown as RappelAvecPelerin[]) ?? []
    },
  })

  function pelerinDe(r: RappelAvecPelerin): Pelerin | null {
    return r.tranche?.plan_paiement?.pelerin ?? r.document?.pelerin ?? null
  }

  function libelleDe(r: RappelAvecPelerin): string {
    if (r.tranche) return `Tranche ${r.tranche.numero_tranche} · ${formatFCFA(r.tranche.montant_prevu)}`
    if (r.document) return `Document · ${LIBELLES_DOCUMENT[r.document.type_document] ?? r.document.type_document}`
    return 'Rappel'
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={basculer}
        className="relative rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low"
      >
        <Icon name="notifications" size={20} />
        {rappels.length > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
            {rappels.length}
          </span>
        )}
      </button>
      {ouvert && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-md">
          <p className="border-b border-outline-variant px-4 py-2 text-label-md font-bold text-primary">Notifications</p>
          {isError ? (
            <EmptyState message="Impossible de charger les notifications" />
          ) : rappels.length === 0 ? (
            <EmptyState message="Aucune notification" />
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {rappels.map((r) => {
                const p = pelerinDe(r)
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        fermer()
                        if (p) navigate(`/details-du-pelerin/${p.id}`)
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-container-low"
                    >
                      <span>
                        <span className="block text-body-md font-medium text-on-surface">{p ? `${p.prenom} ${p.nom}` : 'Pèlerin'}</span>
                        <span className="block text-label-md text-on-surface-variant">{libelleDe(r)} · {formatDate(r.date_envoi_prevue)}</span>
                      </span>
                      <Badge tone={TONE_RAPPEL[r.statut_envoi]}>{LIBELLES_RAPPEL[r.statut_envoi]}</Badge>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/NotifPanel.test.tsx`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/NotifPanel.tsx src/components/layout/NotifPanel.test.tsx
git commit -m "feat(ui): panneau de notifications cliquable dans la Topbar"
```

---
### Task 3: Composant `ProfilMenu` (avatar + menu)

**Files:**
- Create: `src/components/layout/ProfilMenu.tsx`
- Test: `src/components/layout/ProfilMenu.test.tsx`

**Interfaces:**
- Consumes: `useDropdown()` (Task 1), `supabase` (`../../lib/supabase`), `useProfil()` (`../../hooks/useAgence`), `Icon` (`../ui/Icon`).
- Produces: `ProfilMenu` (pas de props) — rend un bouton avatar (initiale) + menu « Mon profil » (/profil), « Aide » (/tutoriels), « Déconnexion » (signOut puis /login). Utilisé par `Topbar` (Task 5).

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/ProfilMenu.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProfilMenu from './ProfilMenu'

const mockSignOut = vi.hoisted(() => vi.fn())
const mockSupabase = vi.hoisted(() => ({ auth: { signOut: mockSignOut } }))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

const mockUseProfil = vi.hoisted(() => vi.fn())
vi.mock('../../hooks/useAgence', () => ({ useProfil: () => mockUseProfil() }))

function rendre() {
  return render(
    <MemoryRouter initialEntries={['/tableau-de-bord']}>
      <Routes>
        <Route path="/tableau-de-bord" element={<ProfilMenu />} />
        <Route path="/profil" element={<div>Page profil</div>} />
        <Route path="/tutoriels" element={<div>Page tutoriels</div>} />
        <Route path="/login" element={<div>Page login</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockUseProfil.mockReset()
  mockSignOut.mockReset()
  mockSignOut.mockResolvedValue({ error: null })
  mockUseProfil.mockReturnValue({
    data: { nom: 'Moussa Ndiaye', role: 'gerant' },
    isLoading: false,
  })
})

describe('ProfilMenu', () => {
  it("masque le menu au départ et l'ouvre au clic sur l'avatar", () => {
    rendre()
    expect(screen.queryByText('Moussa Ndiaye')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Menu profil'))
    expect(screen.getByText('Moussa Ndiaye')).toBeInTheDocument()
    expect(screen.getByText('Gérant')).toBeInTheDocument()
  })

  it('navigue vers /profil au clic sur « Mon profil »', () => {
    rendre()
    fireEvent.click(screen.getByLabelText('Menu profil'))
    fireEvent.click(screen.getByText('Mon profil'))
    expect(screen.getByText('Page profil')).toBeInTheDocument()
  })

  it('navigue vers /tutoriels au clic sur « Aide »', () => {
    rendre()
    fireEvent.click(screen.getByLabelText('Menu profil'))
    fireEvent.click(screen.getByText('Aide'))
    expect(screen.getByText('Page tutoriels')).toBeInTheDocument()
  })

  it('se déconnecte et navigue vers /login', async () => {
    rendre()
    fireEvent.click(screen.getByLabelText('Menu profil'))
    fireEvent.click(screen.getByText('Déconnexion'))
    expect(mockSignOut).toHaveBeenCalled()
    expect(await screen.findByText('Page login')).toBeInTheDocument()
  })

  it('ferme le menu au clic extérieur', () => {
    rendre()
    fireEvent.click(screen.getByLabelText('Menu profil'))
    expect(screen.getByText('Mon profil')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Mon profil')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/ProfilMenu.test.tsx`
Expected: FAIL — `Cannot find module './ProfilMenu'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/layout/ProfilMenu.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useProfil } from '../../hooks/useAgence'
import useDropdown from '../../hooks/useDropdown'
import Icon from '../ui/Icon'

export default function ProfilMenu() {
  const navigate = useNavigate()
  const { data: profil } = useProfil()
  const { ref, ouvert, basculer, fermer } = useDropdown()

  const roleLibelle =
    profil?.role === 'gerant' ? 'Gérant' : profil?.role === 'superadmin' ? 'Super admin' : 'Agent'

  async function deconnexion() {
    fermer()
    await supabase.auth.signOut()
    navigate('/login')
  }

  function aller(to: string) {
    fermer()
    navigate(to)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Menu profil"
        onClick={basculer}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-primary-container text-label-md font-bold text-on-primary-container hover:bg-surface-container-low"
      >
        {profil?.nom?.charAt(0).toUpperCase() ?? '?'}
      </button>
      {ouvert && (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-md">
          <div className="border-b border-outline-variant px-4 py-3">
            <p className="text-body-md font-semibold text-on-surface">{profil?.nom}</p>
            <p className="text-label-md text-on-surface-variant">{roleLibelle}</p>
          </div>
          <ul>
            <li>
              <button
                type="button"
                onClick={() => aller('/profil')}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-label-md text-on-surface hover:bg-surface-container-low"
              >
                <Icon name="person" size={18} />
                Mon profil
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => aller('/tutoriels')}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-label-md text-on-surface hover:bg-surface-container-low"
              >
                <Icon name="help_outline" size={18} />
                Aide
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={deconnexion}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-label-md text-error hover:bg-error-container"
              >
                <Icon name="logout" size={18} />
                Déconnexion
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/ProfilMenu.test.tsx`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/ProfilMenu.tsx src/components/layout/ProfilMenu.test.tsx
git commit -m "feat(ui): menu profil déroulant dans la Topbar"
```

---
### Task 4: Page `Profil` (lecture seule)

**Files:**
- Create: `src/pages/Profil.tsx`
- Test: `src/pages/Profil.test.tsx`

**Interfaces:**
- Consumes: `useProfil()`, `useAgence()` (`../hooks/useAgence`), `formatDate` (`../lib/format`), `Icon` (`../components/ui/Icon`).
- Produces: `Profil` (composant page, pas de props) — route `/profil` sous `AppLayout` (câblée en Task 5). Si `profil` est null : rend « Profil introuvable. ».

- [ ] **Step 1: Write the failing test**

Create `src/pages/Profil.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Profil from './Profil'

const mockUseProfil = vi.hoisted(() => vi.fn())
const mockUseAgence = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useAgence', () => ({
  useProfil: () => mockUseProfil(),
  useAgence: () => mockUseAgence(),
}))

beforeEach(() => {
  mockUseProfil.mockReset()
  mockUseAgence.mockReset()
})

describe('Profil', () => {
  it('affiche les informations de l’utilisateur', () => {
    mockUseProfil.mockReturnValue({
      data: {
        id: 'u1',
        user_id: 'auth1',
        agence_id: 'a1',
        nom: 'Moussa Ndiaye',
        telephone: '77 123 45 67',
        email: 'moussa@alhidjah.sn',
        role: 'gerant',
        created_at: '2026-01-15T12:00:00Z',
      },
      isLoading: false,
    })
    mockUseAgence.mockReturnValue({ data: { id: 'a1', nom: 'Al Hidjah' }, isLoading: false })
    render(<Profil />)
    expect(screen.getByText('Moussa Ndiaye')).toBeInTheDocument()
    expect(screen.getByText('Gérant')).toBeInTheDocument()
    expect(screen.getByText('moussa@alhidjah.sn')).toBeInTheDocument()
    expect(screen.getByText('77 123 45 67')).toBeInTheDocument()
    expect(screen.getByText('Al Hidjah')).toBeInTheDocument()
    expect(screen.getByText('15/01/2026')).toBeInTheDocument()
  })

  it('affiche un message quand le profil est introuvable', () => {
    mockUseProfil.mockReturnValue({ data: null, isLoading: false })
    render(<Profil />)
    expect(screen.getByText('Profil introuvable.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Profil.test.tsx`
Expected: FAIL — `Cannot find module './Profil'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/pages/Profil.tsx`:

```tsx
import { useAgence, useProfil } from '../hooks/useAgence'
import { formatDate } from '../lib/format'

export default function Profil() {
  const { data: profil } = useProfil()
  const { data: agence } = useAgence()

  if (!profil) {
    return <div className="flex h-screen items-center justify-center text-error">Profil introuvable.</div>
  }

  const roleLibelle =
    profil.role === 'gerant' ? 'Gérant' : profil.role === 'superadmin' ? 'Super admin' : 'Agent'

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 border-b border-outline-variant pb-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-outline-variant bg-primary-container text-headline-md font-bold text-on-primary-container">
            {profil.nom?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <h1 className="text-headline-sm font-bold text-primary">{profil.nom}</h1>
          <p className="text-label-md text-on-surface-variant">{roleLibelle}</p>
        </div>
        <dl className="space-y-4 pt-4">
          <div>
            <dt className="label text-on-surface-variant">Email</dt>
            <dd className="text-body-md text-on-surface">{profil.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="label text-on-surface-variant">Téléphone</dt>
            <dd className="text-body-md text-on-surface">{profil.telephone || '—'}</dd>
          </div>
          <div>
            <dt className="label text-on-surface-variant">Agence</dt>
            <dd className="text-body-md text-on-surface">{agence?.nom ?? '—'}</dd>
          </div>
          <div>
            <dt className="label text-on-surface-variant">Membre depuis</dt>
            <dd className="text-body-md text-on-surface">{formatDate(profil.created_at)}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/Profil.test.tsx`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Profil.tsx src/pages/Profil.test.tsx
git commit -m "feat(ui): page profil en lecture seule"
```

---
### Task 5: Câblage Topbar, Sidebar et route `/profil`

**Files:**
- Modify: `src/components/layout/Topbar.tsx:132-149` (remplacer cloche décorative, avatar, bouton Aide)
- Modify: `src/components/layout/Sidebar.tsx:92-97` (lien Aide)
- Modify: `src/App.tsx:48-56` (route `/profil`)
- Create: `src/components/layout/Topbar.test.tsx`

**Interfaces:**
- Consumes: `NotifPanel` (Task 2), `ProfilMenu` (Task 3), `Profil` (Task 4), `Link` de `react-router-dom`.

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/Topbar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Topbar from './Topbar'

vi.mock('./NotifPanel', () => ({ default: () => <div data-testid="notif-panel">NotifPanel</div> }))
vi.mock('./ProfilMenu', () => ({ default: () => <div data-testid="profil-menu">ProfilMenu</div> }))

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))

const mockUseProfil = vi.hoisted(() => vi.fn())
const mockUseAgence = vi.hoisted(() => vi.fn())
vi.mock('../../hooks/useAgence', () => ({
  useProfil: () => mockUseProfil(),
  useAgence: () => mockUseAgence(),
}))

const queryClient = new QueryClient()

beforeEach(() => {
  mockUseProfil.mockReset()
  mockUseAgence.mockReset()
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation(() => ({ select: () => Promise.resolve({ data: [], error: null }) }))
  mockUseProfil.mockReturnValue({ data: { role: 'gerant', nom: 'Moussa' }, isLoading: false })
  mockUseAgence.mockReturnValue({ data: { nom: 'Al Hidjah' }, isLoading: false })
})

describe('Topbar', () => {
  it('intègre le panneau de notifications et le menu profil', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Topbar onOuvrirMenu={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByTestId('notif-panel')).toBeInTheDocument()
    expect(screen.getByTestId('profil-menu')).toBeInTheDocument()
  })

  it('lie le bouton Aide vers /tutoriels', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Topbar onOuvrirMenu={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByRole('link', { name: 'Aide' })).toHaveAttribute('href', '/tutoriels')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/Topbar.test.tsx`
Expected: FAIL — le test « lie le bouton Aide vers /tutoriels » échoue (le bouton actuel n'est pas un lien, et il est masqué sur mobile donc toujours présent en jsdom : le `getByRole('link')` échoue car c'est un `button`).

- [ ] **Step 3: Implement the wiring**

Modify `src/components/layout/Topbar.tsx`:

1. Imports (ligne 1-7) — ajouter `Link` à l'import `react-router-dom` et importer les deux composants :

```tsx
import { Link, useNavigate } from 'react-router-dom'
```
```tsx
import NotifPanel from './NotifPanel'
import ProfilMenu from './ProfilMenu'
```

2. Remplacer le bloc droite (lignes 132-149) par :

```tsx
      <div className="flex items-center gap-2">
        <NotifPanel />
        <Link
          to="/tutoriels"
          aria-label="Aide"
          className="hidden rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low md:block"
        >
          <Icon name="help_outline" size={20} />
        </Link>
        <div className="ml-2 flex items-center gap-3 border-l border-outline-variant pl-4">
          <div className="hidden text-right lg:block">
            <p className="text-label-md text-on-surface">{profil?.role === 'gerant' ? 'Gérant' : 'Agent'}</p>
            <p className="text-[10px] text-on-surface-variant">{agence?.nom}</p>
          </div>
          <ProfilMenu />
        </div>
      </div>
```

Modify `src/components/layout/Sidebar.tsx`:

1. Import ligne 1 :

```tsx
import { Link, NavLink, useNavigate } from 'react-router-dom'
```

2. Remplacer le bloc « Aide » (lignes 92-97) par :

```tsx
        <li>
          <Link
            to="/tutoriels"
            onClick={onFermer}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-label-md text-on-surface-variant hover:bg-surface-container-low"
          >
            <Icon name="help_outline" size={20} />
            Aide
          </Link>
        </li>
```

Modify `src/App.tsx`:

1. Ajouter l'import (après `Dashboard`, ligne 20) :

```tsx
import Profil from './pages/Profil'
```

2. Ajouter la route sous `AppLayout` (après la route `/tableau-de-bord`, ligne 54) :

```tsx
                <Route path="/profil" element={<Profil />} />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/layout/Topbar.test.tsx`
Expected: 2 tests PASS.

Run: `npm run test`
Expected: suite complète PASS (tous les tests existants y compris `AppLayout.test.tsx`, `Pelerins.test.tsx`…).

- [ ] **Step 5: Lint et build**

Run: `npm run lint`
Expected: aucune erreur.

Run: `npm run build`
Expected: `tsc -b` OK puis `vite build` OK.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Topbar.tsx src/components/layout/Sidebar.tsx src/App.tsx src/components/layout/Topbar.test.tsx
git commit -m "feat(ui): Aide → /tutoriels et route /profil (Topbar, Sidebar, App)"
```