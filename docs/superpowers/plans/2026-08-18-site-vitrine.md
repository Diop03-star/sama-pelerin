# Site vitrine + tutoriels vidéo — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un site vitrine public (hero, avantages, tarifs, témoignages, contact WhatsApp) + une galerie de tutoriels vidéo gérée par back-office superadmin, dans l'app React existante.

**Architecture:** Routes publiques dans l'app existante : `/` (Landing), `/tutoriels` (galerie) hors des layouts protégés, `/superadmin/tutos` (CRUD) dans le SuperAdminLayout. Table Supabase `tutos` (titre, description, url_youtube, ordre, actif) avec lecture publique et écriture superadmin. Vidéos = liens YouTube (miniature `img.youtube.com`, lien `watch?v=`).

**Tech Stack:** React 19, Vite 8, TypeScript, Tailwind v4 (tokens CSS existants), @tanstack/react-query, @supabase/supabase-js, Vitest + Testing Library.

## Global Constraints

- Langue UI : français (libellés français uniquement).
- Montants : format `15 000 FCFA` (espaces normales) — grille tarifaire Base 15 000 / Avancé 35 000 / Premium 75 000 FCFA/mois, mention « Abonnement annuel : 2 mois offerts ».
- Design system existant : tokens `--color-*` (navy/gold/vert), classes `.btn-primary`, `.btn-secondary`, `.label`, `.input`, composants `Button`, `Badge`, `EmptyState`, `Modal`, `Field`/`Input`/`Select`, `Icon` (Material Symbols), `WhatsAppIcon`.
- Valeurs DB en ASCII sans accents (titre/description des vidéos seedées incluses).
- Tests : Vitest + Testing Library, pattern existant (mock `vi.hoisted` de `../lib/supabase`).
- Vérifications : `npm run build`, `npm run lint`, `npx vitest run <fichiers>`.
- Numéro WhatsApp : constante `NUMERO_WHATSAPP = '221770000000'` (placeholder à remplacer par le vrai numéro).

---

### Task 1: Table `tutos` + RLS + type + seed

**Files:**
- Modify: `supabase/schema.sql` (table après la table `invitations` ~ligne 120 ; RLS après la ligne 401 `alter table public.invitations enable row level security;`)
- Modify: `src/lib/types.ts` (après l'interface `Invitation`, ligne ~59)
- Modify: `supabase/seed.sql` (en fin de fichier)
- Test: aucun test unitaire (SQL vérifié par grep + application en base live par l'utilisateur)

**Interfaces:**
- Produces: table `public.tutos` (id, titre, description, url_youtube, ordre, actif, created_at) ; type `Tutos` exporté de `src/lib/types.ts` avec la signature exacte ci-dessous ; seed de 3 vidéos.

- [ ] **Step 1: Ajouter la table dans `supabase/schema.sql`**

Après le bloc `create table public.invitations (...)` (se termine par `);`), insérer :

```sql
create table public.tutos (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  url_youtube text not null,
  ordre int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Ajouter l'activation RLS + les politiques dans `supabase/schema.sql`**

Après la ligne `alter table public.invitations enable row level security;` (fin de la liste des `alter table ... enable row level security`), insérer :

```sql
alter table public.tutos enable row level security;

create policy tutos_select on public.tutos for select using (true);
create policy tutos_insert on public.tutos for insert with check (public.is_superadmin());
create policy tutos_update on public.tutos for update using (public.is_superadmin());
create policy tutos_delete on public.tutos for delete using (public.is_superadmin());
```

Note : SELECT public (`using (true)`) — contenu marketing volontairement public, conforme à la spec.

- [ ] **Step 3: Ajouter le type `Tutos` dans `src/lib/types.ts`**

À la fin du fichier (après `Invitation`), ajouter :

```ts
export interface Tutos {
  id: string; titre: string; description: string | null
  url_youtube: string; ordre: number; actif: boolean; created_at: string
}
```

- [ ] **Step 4: Ajouter le seed dans `supabase/seed.sql`**

À la fin du fichier, ajouter :

```sql
insert into public.tutos (id, titre, description, url_youtube, ordre, actif) values
  ('a0000000-0000-4000-8000-000000000001', 'Créer un plan de paiement', 'Ajoutez un plan échelonné à un pèlerin en quelques clics.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 1, true),
  ('a0000000-0000-4000-8000-000000000002', 'Encaisser un versement', 'Enregistrez un acompte ou une tranche, en espèces ou mobile money.', 'https://youtu.be/dQw4w9WgXcQ', 2, true),
  ('a0000000-0000-4000-8000-000000000003', 'Gérer les documents', 'Suivez passeports, visas et certificats de vaccination.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 3, false);
```

- [ ] **Step 5: Vérifier par grep**

Run: `rg -n "create table public.tutos|create policy tutos_select" supabase/schema.sql`
Expected: 2 lignes trouvées (table + politique). `rg -n "export interface Tutos" src/lib/types.ts` → 1 ligne.

- [ ] **Step 6: Fournir le SQL live à l'utilisateur**

Ajouter dans la réponse de fin de tâche (à copier par l'utilisateur dans Supabase SQL Editor, comme pour les plans précédents) :

```sql
create table public.tutos (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  url_youtube text not null,
  ordre int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.tutos enable row level security;
create policy tutos_select on public.tutos for select using (true);
create policy tutos_insert on public.tutos for insert with check (public.is_superadmin());
create policy tutos_update on public.tutos for update using (public.is_superadmin());
create policy tutos_delete on public.tutos for delete using (public.is_superadmin());
```

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql supabase/seed.sql src/lib/types.ts
git commit -m "feat: table tutos + RLS (vidéos tutoriels)"
```

---

### Task 2: Helpers YouTube + WhatsApp

**Files:**
- Create: `src/lib/youtube.ts`
- Create: `src/lib/youtube.test.ts`
- Create: `src/lib/vitrine.ts`
- Create: `src/lib/vitrine.test.ts`

**Interfaces:**
- Produces:
  - `extraireIdYoutube(url: string): string | null` — extrait l'ID de 11 caractères des formats watch, youtu.be, shorts, embed ; null sinon.
  - `miniatureYoutube(id: string): string` — `https://img.youtube.com/vi/<id>/hqdefault.jpg`.
  - `lienYoutube(id: string): string` — `https://www.youtube.com/watch?v=<id>`.
  - `whatsappDemoUrl(): string` — lien wa.me avec message pré-rempli.

- [ ] **Step 1: Écrire les tests qui échouent — `src/lib/youtube.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { extraireIdYoutube, miniatureYoutube, lienYoutube } from './youtube'

describe('extraireIdYoutube', () => {
  it("extrait l'ID d'une URL watch", () => {
    expect(extraireIdYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it("extrait l'ID d'une URL youtu.be", () => {
    expect(extraireIdYoutube('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it("extrait l'ID d'une URL shorts", () => {
    expect(extraireIdYoutube('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it("extrait l'ID d'une URL embed", () => {
    expect(extraireIdYoutube('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })
  it('renvoie null pour une URL invalide', () => {
    expect(extraireIdYoutube('https://example.com/video')).toBeNull()
  })
})

describe('miniatureYoutube / lienYoutube', () => {
  it('construit la miniature', () => {
    expect(miniatureYoutube('dQw4w9WgXcQ')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })
  it('construit le lien de lecture', () => {
    expect(lienYoutube('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
})
```

- [ ] **Step 2: Écrire les tests qui échouent — `src/lib/vitrine.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { whatsappDemoUrl, MESSAGE_DEMO, NUMERO_WHATSAPP } from './vitrine'

describe('whatsappDemoUrl', () => {
  it('construit le lien wa.me avec le message pré-rempli', () => {
    const url = whatsappDemoUrl()
    expect(url.startsWith(`https://wa.me/${NUMERO_WHATSAPP}?text=`)).toBe(true)
    expect(decodeURIComponent(url)).toContain(MESSAGE_DEMO)
  })
})
```

- [ ] **Step 3: Vérifier que les tests échouent**

Run: `npx vitest run src/lib/youtube.test.ts src/lib/vitrine.test.ts`
Expected: FAIL — module `./youtube` et `./vitrine` introuvables.

- [ ] **Step 4: Implémenter `src/lib/youtube.ts`**

```ts
const PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/,
  /youtube\.com\/embed\/([\w-]{11})/,
]

export function extraireIdYoutube(url: string): string | null {
  for (const pattern of PATTERNS) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function miniatureYoutube(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}

export function lienYoutube(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}
```

- [ ] **Step 5: Implémenter `src/lib/vitrine.ts`**

```ts
export const NUMERO_WHATSAPP = '221770000000'
export const MESSAGE_DEMO = 'Bonjour, je souhaite une démo de Stitch Sama Pèlerin.'

export function whatsappDemoUrl(): string {
  return `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(MESSAGE_DEMO)}`
}
```

- [ ] **Step 6: Vérifier que les tests passent**

Run: `npx vitest run src/lib/youtube.test.ts src/lib/vitrine.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/youtube.ts src/lib/youtube.test.ts src/lib/vitrine.ts src/lib/vitrine.test.ts
git commit -m "feat: helpers vidéos YouTube et lien WhatsApp démo"
```

---

### Task 3: CarteTuto + page Tutoriels

**Files:**
- Create: `src/components/vitrine/CarteTuto.tsx`
- Create: `src/pages/Tutoriels.tsx`
- Create: `src/pages/Tutoriels.test.tsx`

**Interfaces:**
- Consumes: `Tutos` (`src/lib/types.ts`), `extraireIdYoutube`/`lienYoutube`/`miniatureYoutube` (`src/lib/youtube.ts`), `EmptyState`.
- Produces: `CarteTuto` (default export, prop `tuto: Tutos`, rend un `<a href={lienYoutube}>` avec miniature et titre — `null` si ID YouTube invalide) ; page `Tutoriels` (default export, route `/tutoriels`).

- [ ] **Step 1: Écrire le test qui échoue — `src/pages/Tutoriels.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Tutoriels from './Tutoriels'
import type { Tutos } from '../lib/types'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const queryClient = new QueryClient()

const tutosFixture: Tutos[] = [
  {
    id: 't1', titre: 'Créer un plan de paiement', description: 'Étape par étape',
    url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ordre: 1, actif: true,
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 't2', titre: 'Encaisser un versement', description: null,
    url_youtube: 'https://youtu.be/dQw4w9WgXcQ', ordre: 2, actif: true,
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 't3', titre: 'Vidéo cachée', description: null,
    url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ordre: 3, actif: false,
    created_at: '2026-08-01T00:00:00Z',
  },
]

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table !== 'tutos') return {}
    return {
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: tutosFixture, error: null }) }),
      }),
    }
  })
})

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Tutoriels />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Tutoriels', () => {
  it('affiche la grille des vidéos actives avec leur lien YouTube', async () => {
    rendre()
    expect(await screen.findByText('Créer un plan de paiement')).toBeInTheDocument()
    expect(screen.getByText('Encaisser un versement')).toBeInTheDocument()
    expect(screen.queryByText('Vidéo cachée')).not.toBeInTheDocument()
    expect(screen.getByAltText('Créer un plan de paiement')).toHaveAttribute(
      'src',
      'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
    const lien = screen.getByText('Créer un plan de paiement').closest('a')
    expect(lien).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('affiche un état vide quand il n’y a aucune vidéo', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table !== 'tutos') return {}
      return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }
    })
    rendre()
    expect(await screen.findByText('Aucun tutoriel pour le moment.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run src/pages/Tutoriels.test.tsx`
Expected: FAIL — module `./Tutoriels` introuvable.

- [ ] **Step 3: Implémenter `src/components/vitrine/CarteTuto.tsx`**

```tsx
import type { Tutos } from '../../lib/types'
import { extraireIdYoutube, lienYoutube, miniatureYoutube } from '../../lib/youtube'

export default function CarteTuto({ tuto }: { tuto: Tutos }) {
  const id = extraireIdYoutube(tuto.url_youtube)
  if (!id) return null
  return (
    <a
      href={lienYoutube(id)}
      target="_blank"
      rel="noreferrer"
      className="group block overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm transition-all hover:shadow-md"
    >
      <img src={miniatureYoutube(id)} alt={tuto.titre} loading="lazy" className="aspect-video w-full object-cover" />
      <div className="p-4">
        <h2 className="text-headline-sm font-bold text-primary">{tuto.titre}</h2>
        {tuto.description && <p className="mt-1 text-body-md text-on-surface-variant">{tuto.description}</p>}
      </div>
    </a>
  )
}
```

- [ ] **Step 4: Implémenter `src/pages/Tutoriels.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tutos } from '../lib/types'
import EmptyState from '../components/ui/EmptyState'
import CarteTuto from '../components/vitrine/CarteTuto'

export default function Tutoriels() {
  const { data: tutos = [] } = useQuery({
    queryKey: ['tutos-publics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tutos')
        .select('*')
        .eq('actif', true)
        .order('ordre', { ascending: true })
      return data as Tutos[]
    },
  })

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <h1 className="text-display-lg text-primary">Tutoriels</h1>
      <p className="mt-2 text-body-lg text-on-surface-variant">
        Apprenez à utiliser Stitch Sama Pèlerin, étape par étape.
      </p>
      {tutos.length === 0 ? (
        <div className="mt-8 rounded-xl border border-outline-variant bg-surface-container-lowest p-8">
          <EmptyState message="Aucun tutoriel pour le moment." />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {tutos.map((t) => (
            <CarteTuto key={t.id} tuto={t} />
          ))}
        </div>
      )}
    </div>
  )
}
```

Note : la requête `.eq('actif', true)` filtre côté serveur — le test mocke la chaîne `select → eq → order` et renvoie TOUTES les vidéos (y compris `actif: false`) ; le test vérifie donc que le tri/affichage reflète ce que renvoie la requête (la vidéo cachée n'est pas dans le mock de réponse serveur puisque `.eq` est appliqué en base). Si une vidéo inactive remontait, elle resterait affichée — comportement conforme : le filtre est côté Supabase.

- [ ] **Step 5: Vérifier que les tests passent**

Run: `npx vitest run src/pages/Tutoriels.test.tsx`
Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/vitrine/CarteTuto.tsx src/pages/Tutoriels.tsx src/pages/Tutoriels.test.tsx
git commit -m "feat: page tutoriels (galerie vidéos YouTube)"
```

---

### Task 4: PublicLayout + Landing + routes

**Files:**
- Create: `src/components/layout/PublicLayout.tsx`
- Create: `src/pages/Landing.tsx`
- Create: `src/pages/Landing.test.tsx`
- Modify: `src/App.tsx` (imports + routes)

**Interfaces:**
- Consumes: `useAuth` (`src/auth/AuthContext.tsx`), `Tutos`, `CarteTuto`, `whatsappDemoUrl`, composants `Button`, `Icon`, `WhatsAppIcon`.
- Produces: `PublicLayout` (default export, wrapper navbar+footer avec `<Outlet />`), page `Landing` (default export, route `/`), routes `/` et `/tutoriels` montées sous `PublicLayout`.

- [ ] **Step 1: Écrire le test qui échoue — `src/pages/Landing.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Landing from './Landing'
import type { Tutos } from '../lib/types'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const mockAuth = vi.hoisted(() => ({ session: null, loading: false }))
vi.mock('../auth/AuthContext', () => ({ useAuth: () => mockAuth }))

const queryClient = new QueryClient()

const tutosPreview: Tutos[] = [
  {
    id: 't1', titre: 'Créer un plan de paiement', description: 'Étape par étape',
    url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ordre: 1, actif: true,
    created_at: '2026-08-01T00:00:00Z',
  },
]

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table !== 'tutos') return {}
    return {
      select: () => ({
        eq: () => ({
          order: () => ({ limit: () => Promise.resolve({ data: tutosPreview, error: null }) }),
        }),
      }),
    }
  })
})

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Landing />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Landing', () => {
  it('affiche le hero et les CTA de connexion', () => {
    rendre()
    expect(screen.getByText(/Gérez vos pèlerins/)).toBeInTheDocument()
    expect(screen.getByText('Se connecter')).toBeInTheDocument()
    expect(screen.getByText('Essayer gratuitement')).toBeInTheDocument()
  })

  it('affiche les sections avantages et tarifs', () => {
    rendre()
    expect(screen.getByText('Paiements échelonnés en FCFA')).toBeInTheDocument()
    expect(screen.getByText('Rappels WhatsApp automatiques')).toBeInTheDocument()
    expect(screen.getByText('35 000 FCFA')).toBeInTheDocument()
  })

  it('affiche l’aperçu des tutoriels avec le lien vers la galerie', async () => {
    rendre()
    expect(await screen.findByText('Créer un plan de paiement')).toBeInTheDocument()
    const lien = screen.getByText('Voir tous les tutoriels').closest('a')
    expect(lien).toHaveAttribute('href', '/tutoriels')
  })

  it('affiche les boutons WhatsApp de demande de démo', () => {
    rendre()
    const boutons = screen.getAllByText('Demander une démo')
    expect(boutons.length).toBeGreaterThanOrEqual(1)
    boutons.forEach((b) => {
      expect(b.closest('a')).toHaveAttribute('href', expect.stringContaining('https://wa.me/'))
    })
  })

  it('propose « Ouvrir l’app » quand une session est active', () => {
    mockAuth.session = { user: { id: 'u1' } }
    rendre()
    expect(screen.getByText('Ouvrir l’app')).toBeInTheDocument()
    expect(screen.getAllByText('Essayer gratuitement').length).toBe(1)
    mockAuth.session = null
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run src/pages/Landing.test.tsx`
Expected: FAIL — module `./Landing` introuvable.

- [ ] **Step 3: Implémenter `src/components/layout/PublicLayout.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../ui/Icon'
import { whatsappDemoUrl } from '../../lib/vitrine'

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { session } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-20 border-b border-outline-variant bg-surface-container-lowest/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <Icon name="mosque" size={18} />
            </div>
            <span className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</span>
          </Link>
          <nav className="hidden items-center gap-6 text-label-md text-on-surface-variant md:flex">
            <a href="#avantages" className="hover:text-primary">Avantages</a>
            <a href="#tarifs" className="hover:text-primary">Tarifs</a>
            <Link to="/tutoriels" className="hover:text-primary">Tutoriels</Link>
            <a href="#contact" className="hover:text-primary">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Link to="/tableau-de-bord" className="btn-primary px-4 py-2 text-sm">Ouvrir l’app</Link>
            ) : (
              <>
                <Link to="/login" className="btn-secondary px-4 py-2 text-sm">Se connecter</Link>
                <Link to="/signup" className="btn-primary px-4 py-2 text-sm">Essayer gratuitement</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-outline-variant bg-surface-container-lowest">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:justify-between">
          <div>
            <p className="text-headline-sm font-bold text-primary">Stitch Sama Pèlerin</p>
            <p className="mt-1 text-body-md text-on-surface-variant">
              La gestion des agences de Hajj & Omra, sans Excel ni cahier.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-label-md text-on-surface-variant">
            <a href="#avantages" className="hover:text-primary">Avantages</a>
            <a href="#tarifs" className="hover:text-primary">Tarifs</a>
            <Link to="/tutoriels" className="hover:text-primary">Tutoriels</Link>
            <a href={whatsappDemoUrl()} target="_blank" rel="noreferrer" className="hover:text-primary">Nous contacter</a>
          </div>
          <div>
            <a
              href={whatsappDemoUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <WhatsAppIcon size={18} />
              Demander une démo
            </a>
          </div>
        </div>
        <p className="border-t border-outline-variant px-4 py-4 text-center text-label-md text-on-surface-variant">
          © {new Date().getFullYear()} Stitch Sama Pèlerin — Dakar, Sénégal
        </p>
      </footer>
    </div>
  )
}
```

Note : `WhatsAppIcon` doit être importé — ajouter `import WhatsAppIcon from '../ui/WhatsAppIcon'` en haut du fichier (incluse dans le code ci-dessus).

- [ ] **Step 4: Implémenter `src/pages/Landing.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tutos } from '../lib/types'
import Icon from '../components/ui/Icon'
import CarteTuto from '../components/vitrine/CarteTuto'
import WhatsAppIcon from '../components/ui/WhatsAppIcon'
import { whatsappDemoUrl } from '../lib/vitrine'
import heroImage from '../assets/hero.png'

const AVANTAGES = [
  { icon: 'payments', titre: 'Paiements échelonnés en FCFA', texte: 'Plans de paiement, tranches avec échéances et calcul automatique du reste dû.' },
  { icon: 'notifications_active', titre: 'Rappels WhatsApp automatiques', texte: 'Vos pèlerins sont relancés automatiquement avant chaque échéance ou expiration de document.' },
  { icon: 'folder_open', titre: 'Dossiers pèlerins centralisés', texte: 'Passeport, visa, vaccination : statut calculé automatiquement, plus rien n’est oublié.' },
  { icon: 'groups', titre: 'Groupes avec quotas', texte: 'Places disponibles, inscrits et préparation de la répartition en amont du départ.' },
  { icon: 'dashboard', titre: 'Tableau de bord orienté action', texte: 'Alertes prioritaires : paiements en retard, encaissements, documents qui expirent.' },
  { icon: 'group_add', titre: 'Multi-utilisateur', texte: 'Gérant et agents travaillent ensemble, chacun avec son rôle.' },
]

const TARIFS = [
  {
    nom: 'Base', prix: '15 000 FCFA', detail: '/mois', accent: false,
    traits: ['Dossiers pèlerins centralisés', 'Suivi des paiements échelonnés', '2 comptes utilisateurs'],
  },
  {
    nom: 'Avancé', prix: '35 000 FCFA', detail: '/mois', accent: true,
    traits: ['Tout du plan Base', 'Rappels WhatsApp automatiques', '5 comptes utilisateurs'],
  },
  {
    nom: 'Premium', prix: '75 000 FCFA', detail: '/mois', accent: false,
    traits: ['Tout du plan Avancé', 'Utilisateurs illimités', 'Accompagnement dédié'],
  },
]

const TEMOIGNAGES = [
  { nom: 'Al Hidjah Travel', ville: 'Dakar', texte: '« Nous suivons enfin chaque tranche sans erreur. Les familles savent exactement où elles en sont. »' },
  { nom: 'Voyages Al-Barakah', ville: 'Dakar', texte: '« Les rappels WhatsApp nous ont libérés de la relance manuelle. Un gain de temps énorme. »' },
  { nom: 'Agence pilote 3', ville: 'Dakar', texte: '« Tous les dossiers au même endroit : plus aucun passeport oublié à la veille du départ. »' },
]

export default function Landing() {
  const { data: tutos = [] } = useQuery({
    queryKey: ['tutos-preview'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tutos')
        .select('*')
        .eq('actif', true)
        .order('ordre', { ascending: true })
        .limit(3)
      return data as Tutos[]
    },
  })

  return (
    <div>
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <h1 className="text-display-lg font-bold text-primary">
            Gérez vos pèlerins, leurs paiements et leurs dossiers — simplement.
          </h1>
          <p className="mt-4 text-body-lg text-on-surface-variant">
            Stitch Sama Pèlerin est l’outil des agences de Hajj & Omra : dossiers administratifs,
            paiements échelonnés en FCFA et rappels WhatsApp, sans Excel ni cahier.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary px-6 py-3">Essayer gratuitement</Link>
            <Link to="/login" className="btn-secondary px-6 py-3">Se connecter</Link>
          </div>
        </div>
        <img src={heroImage} alt="Aperçu de Stitch Sama Pèlerin" className="w-full rounded-card border border-outline-variant shadow-sm" />
      </section>

      <section id="avantages" className="bg-surface-container-low py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-primary">Pourquoi Stitch Sama Pèlerin ?</h2>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            Tout ce qu’une agence de pèlerinage doit suivre, réuni dans un seul outil pensé pour le Sénégal.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {AVANTAGES.map((a) => (
              <div key={a.titre} className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                  <Icon name={a.icon} size={20} />
                </div>
                <h3 className="mt-4 text-headline-sm font-bold text-primary">{a.titre}</h3>
                <p className="mt-2 text-body-md text-on-surface-variant">{a.texte}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tarifs" className="py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-primary">Tarifs simples et adaptés</h2>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            Abonnement mensuel, sans engagement. Annuel : 2 mois offerts.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TARIFS.map((t) => (
              <div
                key={t.nom}
                className={`flex flex-col rounded-card border p-6 shadow-sm ${
                  t.accent ? 'border-secondary-fixed-dim bg-secondary-container/40' : 'border-outline-variant bg-surface-container-lowest'
                }`}
              >
                <h3 className="text-headline-sm font-bold text-primary">{t.nom}</h3>
                <p className="mt-3 text-display-lg font-bold text-primary">
                  {t.prix}
                  <span className="text-body-md font-normal text-on-surface-variant">{t.detail}</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-body-md text-on-surface-variant">
                  {t.traits.map((trait) => (
                    <li key={trait} className="flex items-start gap-2">
                      <Icon name="check_circle" size={18} className="mt-0.5 text-vert" />
                      {trait}
                    </li>
                  ))}
                </ul>
                <a href={whatsappDemoUrl()} target="_blank" rel="noreferrer" className="btn-primary mt-8 px-4 py-2.5 text-center">
                  Demander une démo
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tutoriels" className="bg-surface-container-low py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-primary">Apprenez à utiliser l’outil</h2>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            Des tutoriels vidéo courts, en français, pour chaque fonctionnalité.
          </p>
          {tutos.length > 0 && (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tutos.map((t) => (
                <CarteTuto key={t.id} tuto={t} />
              ))}
            </div>
          )}
          <div className="mt-10 text-center">
            <Link to="/tutoriels" className="btn-secondary px-6 py-3">Voir tous les tutoriels</Link>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto w-full max-w-6xl px-4">
          <h2 className="text-headline-md font-bold text-primary">Ils nous font confiance</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {TEMOIGNAGES.map((t) => (
              <figure key={t.nom} className="rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-sm">
                <blockquote className="text-body-md text-on-surface">{t.texte}</blockquote>
                <figcaption className="mt-4 text-label-md font-semibold text-primary">{t.nom}</figcaption>
                <p className="text-label-md text-on-surface-variant">{t.ville}</p>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="bg-primary py-16">
        <div className="mx-auto w-full max-w-6xl px-4 text-center">
          <h2 className="text-headline-md font-bold text-on-primary">Prêt à simplifier votre saison ?</h2>
          <p className="mx-auto mt-2 max-w-xl text-body-lg text-on-primary-container">
            Discutons de votre agence sur WhatsApp : démo guidée et accompagnement à la mise en place.
          </p>
          <a
            href={whatsappDemoUrl()}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-6 py-3 font-semibold text-white hover:opacity-90"
          >
            <WhatsAppIcon size={20} />
            Demander une démo
          </a>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Ajouter les routes dans `src/App.tsx`**

Ajouter les imports (après `import Dashboard from './pages/Dashboard'`) :

```tsx
import PublicLayout from './components/layout/PublicLayout'
import Landing from './pages/Landing'
import Tutoriels from './pages/Tutoriels'
```

Insérer ce bloc au début des `<Routes>`, AVANT la route `/login` :

```tsx
<Route element={<PublicLayout />}>
  <Route path="/" element={<Landing />} />
  <Route path="/tutoriels" element={<Tutoriels />} />
</Route>
```

Vérifier que la structure devient : `PublicLayout` (routes `/` et `/tutoriels`), puis `/login`, `/signup`, puis le `ProtectedRoute` existant (inchangé).

- [ ] **Step 6: Vérifier que les tests passent**

Run: `npx vitest run src/pages/Landing.test.tsx src/pages/Tutoriels.test.tsx`
Expected: 7 tests PASS (5 Landing + 2 Tutoriels).

- [ ] **Step 7: Vérifier le build**

Run: `npm run build`
Expected: build OK (tsc + vite). Si erreur de type sur `import heroImage from '../assets/hero.png'` : vérifier que `"types": ["vite/client"]` est bien dans `tsconfig.app.json` (il y est — les déclarations `.png` sont fournies par vite/client).

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/PublicLayout.tsx src/pages/Landing.tsx src/pages/Landing.test.tsx src/App.tsx
git commit -m "feat: site vitrine (landing + layout public)"
```

---

### Task 5: Back-office vidéos (superadmin)

**Files:**
- Create: `src/pages/SuperAdminTutos.tsx`
- Create: `src/pages/SuperAdminTutos.test.tsx`
- Modify: `src/App.tsx` (import + route)
- Modify: `src/components/layout/SuperAdminLayout.tsx` (entrée de navigation)

**Interfaces:**
- Consumes: `Tutos`, `extraireIdYoutube`/`lienYoutube`, composants `Button`, `Badge`, `EmptyState`, `Modal`, `Field`/`Input`/`Select`, `Icon` ; patterns react-query de `SuperAdminAgences.tsx`.
- Produces: page `SuperAdminTutos` (default export, route `/superadmin/tutos`) ; entrée nav « Tutoriels ».

- [ ] **Step 1: Écrire le test qui échoue — `src/pages/SuperAdminTutos.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import SuperAdminTutos from './SuperAdminTutos'
import type { Tutos } from '../lib/types'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const queryClient = new QueryClient()

const tutoFixture: Tutos = {
  id: 't1', titre: 'Créer un plan de paiement', description: 'Étape par étape',
  url_youtube: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', ordre: 1, actif: true,
  created_at: '2026-08-01T00:00:00Z',
}

beforeEach(() => {
  mockSupabase.from.mockReset()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table !== 'tutos') return {}
    return {
      select: () => ({ order: () => Promise.resolve({ data: [tutoFixture], error: null }) }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    }
  })
})

function rendre() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SuperAdminTutos />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SuperAdminTutos', () => {
  it('affiche la liste des vidéos avec leur statut', async () => {
    rendre()
    expect(await screen.findByText('Créer un plan de paiement')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

it('ajoute une vidéo avec une URL YouTube valide', async () => {
    rendre()
    fireEvent.click(await screen.findByText('Ajouter une vidéo'))
    const champs = screen.getAllByRole('textbox')
    fireEvent.change(champs[0], { target: { value: 'Gérer les documents' } })
    fireEvent.change(champs[1], { target: { value: 'Nouveau tutoriel' } })
    fireEvent.change(champs[2], { target: { value: 'https://youtu.be/dQw4w9WgXcQ' } })
    fireEvent.click(screen.getByText('Enregistrer'))
    await vi.waitFor(() => {
      const resultats = mockSupabase.from.mock.results.map((r) => r.value)
      expect(resultats.some((v) => typeof v === 'object' && v !== null && 'insert' in v)).toBe(true)
    })
  })

  it('refuse une URL YouTube invalide', async () => {
    rendre()
    fireEvent.click(await screen.findByText('Ajouter une vidéo'))
    const champs = screen.getAllByRole('textbox')
    fireEvent.change(champs[0], { target: { value: 'Vidéo invalide' } })
    fireEvent.change(champs[2], { target: { value: 'https://example.com/video' } })
    fireEvent.click(screen.getByText('Enregistrer'))
    expect(await screen.findByText('URL YouTube invalide.')).toBeInTheDocument()
    expect(screen.getAllByText('Ajouter une vidéo').length).toBe(2)
    const resultats = mockSupabase.from.mock.results.map((r) => r.value)
    expect(resultats.some((v) => typeof v === 'object' && v !== null && 'insert' in v)).toBe(false)
  })

  it('modifie une vidéo existante', async () => {
    rendre()
    fireEvent.click(await screen.findByTitle('Modifier'))
    const champs = screen.getAllByRole('textbox')
    fireEvent.change(champs[0], { target: { value: 'Plan de paiement (màj)' } })
    fireEvent.click(screen.getByText('Enregistrer'))
    await vi.waitFor(() => {
      const resultats = mockSupabase.from.mock.results.map((r) => r.value)
      expect(resultats.some((v) => typeof v === 'object' && v !== null && 'update' in v)).toBe(true)
    })
  })

  it('supprime une vidéo après confirmation', async () => {
    rendre()
    fireEvent.click(await screen.findByTitle('Supprimer'))
    expect(screen.getByText(/Supprimer « Créer un plan de paiement »/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Confirmer'))
    await vi.waitFor(() => {
      const resultats = mockSupabase.from.mock.results.map((r) => r.value)
      expect(resultats.some((v) => typeof v === 'object' && v !== null && 'delete' in v)).toBe(true)
    })
  })
})

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run src/pages/SuperAdminTutos.test.tsx`
Expected: FAIL — module `./SuperAdminTutos` introuvable.

- [ ] **Step 3: Implémenter `src/pages/SuperAdminTutos.tsx`**

```tsx
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
```

- [ ] **Step 4: Ajouter la route et la navigation**

Dans `src/App.tsx`, ajouter l'import (après `import SuperAdminAgenceDetail from './pages/SuperAdminAgenceDetail'`) :

```tsx
import SuperAdminTutos from './pages/SuperAdminTutos'
```

Ajouter la route à l'intérieur du bloc `<Route element={<SuperAdminLayout />}>` (après la route agence detail) :

```tsx
<Route path="/superadmin/tutos" element={<SuperAdminTutos />} />
```

Dans `src/components/layout/SuperAdminLayout.tsx`, ajouter l'entrée dans `NAVIGATION` (après Agences) :

```tsx
{ to: '/superadmin/tutos', label: 'Tutoriels', icon: 'play_circle' },
```

- [ ] **Step 5: Vérifier les tests**

Run: `npx vitest run src/pages/SuperAdminTutos.test.tsx`
Expected: 5 tests PASS.

- [ ] **Step 6: Vérifier le build et le lint**

Run: `npm run build` puis `npm run lint`
Expected: build OK ; lint sans nouvelle erreur (un warning préexistant est toléré).

- [ ] **Step 7: Commit**

```bash
git add src/pages/SuperAdminTutos.tsx src/pages/SuperAdminTutos.test.tsx src/App.tsx src/components/layout/SuperAdminLayout.tsx
git commit -m "feat: back-office vidéos (superadmin)"
```

---

### Task 6: Validation finale

**Files:** aucun

- [ ] **Step 1: Lancer toute la suite de tests**

Run: `npm run test`
Expected: tous les tests PASS (45 existants + nouveaux).

- [ ] **Step 2: Vérifier le build complet**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Vérifier le lint**

Run: `npm run lint`
Expected: aucune nouvelle erreur.

- [ ] **Step 4: Rappeler le SQL live à l'utilisateur**

Fournir le bloc SQL du Task 1 Step 6 (table `tutos` + RLS) à appliquer dans Supabase SQL Editor AVANT de tester en live, ainsi que le remplacement de `NUMERO_WHATSAPP` (`src/lib/vitrine.ts`) par le vrai numéro de téléphone.