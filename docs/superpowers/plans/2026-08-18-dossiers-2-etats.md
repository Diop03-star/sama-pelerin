# Dossiers 2 états + Page Documents ligne-par-pèlerin — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplifier le statut de dossier à 2 états (validé / incomplet — validé uniquement si les 4 types requis ont un document validé) et transformer la page Gestion des documents en tableau ligne-par-pèlerin.

**Architecture:** Règle calculée côté lib (`statutDossierDepuisDocuments` / `statutDocumentParType` dans `src/lib/plan.ts`) + trigger SQL `trg_maj_statut_dossier()` recalcule `pelerins.statut_dossier` en base. La page Documents interroge `pelerins` avec leurs documents embarqués et dérive le statut selon le filtre type. `stats_globales()` perd `dossiers_complets`.

**Tech Stack:** React 19 + TS + Supabase/PostgREST + @tanstack/react-query + Vitest/Testing Library. `npm run build` = `tsc -b && vite build` (le typecheck inclut les tests). Pas de framework de tests SQL — le SQL live est fourni à l'utilisateur (SQL editor Supabase).

## Global Constraints

- UI française avec apostrophes typographiques `’` (U+2019) dans les libellés (`Validé`, `Incomplet`, `Manquant`, `Dossiers incomplets`).
- Valeurs DB en ASCII : `valide`, `incomplet`, `manquant`, `complet` (supprimé), types : `passeport`, `visa`, `certificat_vaccination`, `photo`, `autre`.
- Types requis pour un dossier validé (ordre canonique) : `passeport`, `visa`, `certificat_vaccination`, `photo`. Le type `autre` ne compte jamais.
- Un dossier est `valide` ⟺ les 4 types requis ont chacun un document `statut = 'valide'`. Sinon `incomplet`.
- Statut par type : `valide` (document `valide`) ou `manquant` (tout autre cas, y compris absent).
- Badges : `valide` → tone `vert` ; `incomplet` et `manquant` → tone `rouge`.
- La gestion fine des documents (upload, valider, rejeter, modifier, supprimer) reste dans `DocumentSection` (fiche pèlerin) — inchangée.
- TDD : écrire le test, vérifier qu'il échoue, implémenter, vérifier qu'il passe, committer.
- Vérification systématique avant chaque commit : `npm test` puis `npm run lint` puis `npm run build` (tout doit passer).
- Le travail se committe sur la branche courante `refonte-paiement`.
- Commit style : `feat:` / `fix:` / `docs:` + description courte (voir historique git).

---

### Task 1: Lib — types, libellés, règle de dossier (plan.ts, types.ts, format.ts)

**Files:**
- Modify: `src/lib/types.ts:3` (StatutDossier)
- Modify: `src/lib/plan.ts:10-15` (statutDossierDepuisDocuments + 2 nouvelles fonctions)
- Modify: `src/lib/format.ts:47-51,91-95` (LIBELLES_DOSSIER, TONE_DOSSIER)
- Modify: `src/lib/plan.test.ts:12-21` (tests statutDossierDepuisDocuments)

**Interfaces:**
- Consumes: rien (base).
- Produces:
  - `TYPES_DOCUMENT_REQUIS: readonly ['passeport','visa','certificat_vaccination','photo']` (exporté de `src/lib/plan.ts`)
  - `statutDossierDepuisDocuments(documents: Array<{ type_document: string; statut: string }>): 'incomplet' | 'valide'`
  - `statutDocumentParType(documents: Array<{ type_document: string; statut: string }>, type: string): 'valide' | 'manquant'`
  - `StatutDossier = 'incomplet' | 'valide'` (`src/lib/types.ts`)
  - `LIBELLES_DOSSIER` / `TONE_DOSSIER` sans la clé `complet` (`src/lib/format.ts`)

- [ ] **Step 1: Écrire les tests qui échouent** — dans `src/lib/plan.test.ts`, remplacer l'import (lignes 2-10) par :

```ts
import {
  statutDossierDepuisDocuments,
  statutDocumentParType,
  proposerAcompte,
  proposerDateLimite,
  genererEcheancier,
  validerEcheancier,
  ajouterMois,
  ajouterJours,
} from './plan'
```

puis remplacer le bloc `describe('statutDossierDepuisDocuments', ...)` (lignes 12-23) par :

```ts
describe('statutDossierDepuisDocuments', () => {
  const docs = (arr: Array<[string, string]>) =>
    arr.map(([type_document, statut]) => ({ type_document, statut }))

  it('retourne valide si les 4 types requis sont validés', () => {
    expect(statutDossierDepuisDocuments(docs([
      ['passeport', 'valide'], ['visa', 'valide'],
      ['certificat_vaccination', 'valide'], ['photo', 'valide'],
    ]))).toBe('valide')
  })

  it('retourne valide même si un document « autre » n’est pas validé', () => {
    expect(statutDossierDepuisDocuments(docs([
      ['passeport', 'valide'], ['visa', 'valide'],
      ['certificat_vaccination', 'valide'], ['photo', 'valide'],
      ['autre', 'manquant'],
    ]))).toBe('valide')
  })

  it('retourne incomplet si un type requis manque ou n’est pas validé', () => {
    expect(statutDossierDepuisDocuments(docs([
      ['passeport', 'valide'], ['visa', 'soumis'],
      ['certificat_vaccination', 'valide'], ['photo', 'valide'],
    ]))).toBe('incomplet')
    expect(statutDossierDepuisDocuments(docs([
      ['passeport', 'valide'], ['visa', 'valide'],
    ]))).toBe('incomplet')
  })

  it('retourne incomplet sans aucun document', () => {
    expect(statutDossierDepuisDocuments([])).toBe('incomplet')
  })
})

describe('statutDocumentParType', () => {
  const docs = (arr: Array<[string, string]>) =>
    arr.map(([type_document, statut]) => ({ type_document, statut }))

  it('retourne valide si le type a un document validé', () => {
    expect(statutDocumentParType(docs([
      ['passeport', 'valide'], ['visa', 'soumis'],
    ]), 'passeport')).toBe('valide')
  })

  it('retourne manquant si le type n’est pas validé ou absent', () => {
    expect(statutDocumentParType(docs([
      ['passeport', 'valide'], ['visa', 'soumis'],
    ]), 'visa')).toBe('manquant')
    expect(statutDocumentParType(docs([
      ['passeport', 'valide'],
    ]), 'photo')).toBe('manquant')
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npm test -- src/lib/plan.test.ts`
Expected: FAIL — `statutDossierDepuisDocuments` accepte `string[]` (tests passés avec tableaux de `[type, statut]`) et `statutDocumentParType` n'existe pas.

- [ ] **Step 3: Implémenter la lib** — remplacer `src/lib/plan.ts:10-15` par :

```ts
export const TYPES_DOCUMENT_REQUIS = ['passeport', 'visa', 'certificat_vaccination', 'photo'] as const

export function statutDossierDepuisDocuments(
  documents: Array<{ type_document: string; statut: string }>
): 'incomplet' | 'valide' {
  const valides = new Set(
    documents.filter((d) => d.statut === 'valide').map((d) => d.type_document)
  )
  return TYPES_DOCUMENT_REQUIS.every((t) => valides.has(t)) ? 'valide' : 'incomplet'
}

export function statutDocumentParType(
  documents: Array<{ type_document: string; statut: string }>,
  type: string
): 'valide' | 'manquant' {
  return documents.some((d) => d.type_document === type && d.statut === 'valide')
    ? 'valide'
    : 'manquant'
}
```

- [ ] **Step 4: Mettre à jour les types** — `src/lib/types.ts:3` :

```ts
export type StatutDossier = 'incomplet' | 'valide'
```

- [ ] **Step 5: Mettre à jour les libellés** — `src/lib/format.ts` : remplacer le bloc `LIBELLES_DOSSIER` (lignes 47-51) par :

```ts
export const LIBELLES_DOSSIER: Record<string, string> = {
  incomplet: 'Incomplet',
  valide: 'Validé',
}
```

puis remplacer le bloc `TONE_DOSSIER` (lignes 91-95) par :

```ts
export const TONE_DOSSIER: Record<string, string> = {
  incomplet: 'rouge',
  valide: 'vert',
}
```

- [ ] **Step 6: Vérifier tests + lint + build**

Run: `npm test`
Expected: 107 tests passent (104 − 3 anciens statut + 6 nouveaux).
Run: `npm run lint`
Expected: 0 error.
Run: `npm run build`
Expected: OK.

- [ ] **Step 7: Commit**

```bash
git add src/lib/plan.ts src/lib/plan.test.ts src/lib/types.ts src/lib/format.ts
git commit -m "feat: dossier pelerin a 2 etats (valide/incomplet) - regle 4 types requis"
```

---

### Task 2: SQL — contrainte, trigger, stats_globales (schema.sql) + bloc SQL live

**Files:**
- Modify: `supabase/schema.sql:51` (contrainte statut_dossier)
- Modify: `supabase/schema.sql:201-216` (trg_maj_statut_dossier)
- Modify: `supabase/schema.sql:317-388` (stats_globales)
- Docs: bloc « SQL live à exécuter » à ajouter à la fin de CE plan (section dédiée, comme la refonte paiement)

**Interfaces:**
- Consumes: rien (indépendant du front).
- Produces: base avec `pelerins.statut_dossier` ∈ (`incomplet`,`valide`) ; trigger recalculant la règle ; `stats_globales()` sans `dossiers_complets`.

- [ ] **Step 1: Contrainte** — `supabase/schema.sql:51` : remplacer

```sql
  statut_dossier text not null default 'incomplet' check (statut_dossier in ('incomplet','complet','valide')),
```

par

```sql
  statut_dossier text not null default 'incomplet' check (statut_dossier in ('incomplet','valide')),
```

- [ ] **Step 2: Trigger** — remplacer le corps de `trg_maj_statut_dossier()` (`supabase/schema.sql:201-216`) par :

```sql
create or replace function public.trg_maj_statut_dossier()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pelerin uuid; v_statut text;
begin
  v_pelerin := coalesce(new.pelerin_id, old.pelerin_id);
  select case
    when count(distinct type_document) = 4 then 'valide'
    else 'incomplet'
  end into v_statut
  from public.documents
  where pelerin_id = v_pelerin
    and type_document in ('passeport','visa','certificat_vaccination','photo')
    and statut = 'valide';
  update public.pelerins set statut_dossier = v_statut where id = v_pelerin;
  return coalesce(new, old);
end $$;
```

- [ ] **Step 3: stats_globales** — retirer `dossiers_complets` à 3 endroits de `supabase/schema.sql` :
  1. ligne 320 : `pelerins_total bigint, dossiers_valides bigint, dossiers_complets bigint, dossiers_incomplets bigint,` → `pelerins_total bigint, dossiers_valides bigint, dossiers_incomplets bigint,`
  2. ligne 335 : supprimer la ligne `    coalesce(p.complets, 0) as dossiers_complets,`
  3. ligne 351 : supprimer la ligne `      count(*) filter (where pel.statut_dossier = 'complet') as complets,`

- [ ] **Step 4: Ajouter le bloc « SQL live à exécuter »** à la fin de ce plan (`docs/superpowers/plans/2026-08-18-dossiers-2-etats.md`) :

````markdown
## SQL live à exécuter (SQL editor Supabase)

```sql
-- backfill d'abord : les dossiers « complet » existants (produits par l'ancien trigger)
-- feraient échouer l'ajout de contrainte (validation immédiate sur les lignes présentes).
-- Le backfill n'écrit que 'valide'/'incomplet', légaux sous l'ancienne contrainte,
-- et le trigger ne se déclenche que sur documents (pas pelerins), donc aucune interférence.
update public.pelerins pel set statut_dossier = case
  when (select count(distinct type_document)
        from public.documents d
        where d.pelerin_id = pel.id
          and d.type_document in ('passeport','visa','certificat_vaccination','photo')
          and d.statut = 'valide') = 4
  then 'valide' else 'incomplet'
end;

alter table public.pelerins drop constraint if exists pelerins_statut_dossier_check;
alter table public.pelerins add constraint pelerins_statut_dossier_check check (statut_dossier in ('incomplet','valide'));

create or replace function public.trg_maj_statut_dossier()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pelerin uuid; v_statut text;
begin
  v_pelerin := coalesce(new.pelerin_id, old.pelerin_id);
  select case
    when count(distinct type_document) = 4 then 'valide'
    else 'incomplet'
  end into v_statut
  from public.documents
  where pelerin_id = v_pelerin
    and type_document in ('passeport','visa','certificat_vaccination','photo')
    and statut = 'valide';
  update public.pelerins set statut_dossier = v_statut where id = v_pelerin;
  return coalesce(new, old);
end $$;

create or replace function public.stats_globales()
returns table (
  agence_id uuid, agence_nom text, agence_active boolean,
  pelerins_total bigint, dossiers_valides bigint, dossiers_incomplets bigint,
  groupes_total bigint, places_restantes bigint,
  gerants bigint, agents bigint,
  encaissements_total numeric, encaissements_30j numeric,
  tranches_en_retard bigint, rappels_attente bigint, rappels_echec bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_superadmin() then
    raise exception 'Accès refusé : réservé au superadmin';
  end if;
  return query
  select
    a.id, a.nom, a.active,
    coalesce(p.nb, 0) as pelerins_total,
    coalesce(p.valides, 0) as dossiers_valides,
    coalesce(p.incomplets, 0) as dossiers_incomplets,
    coalesce(g.nb, 0) as groupes_total,
    coalesce(gs.places_libres, 0)::bigint as places_restantes,
    coalesce(us.gerants, 0) as gerants,
    coalesce(us.agents, 0) as agents,
    coalesce(ps.total, 0) as encaissements_total,
    coalesce(ps.total_30j, 0) as encaissements_30j,
    coalesce(ts.retards, 0) as tranches_en_retard,
    coalesce(rs.attente, 0) as rappels_attente,
    coalesce(rs.echecs, 0) as rappels_echec
  from public.agences a
  left join (
    select pel.agence_id,
      count(*) as nb,
      count(*) filter (where pel.statut_dossier = 'valide') as valides,
      count(*) filter (where pel.statut_dossier = 'incomplet') as incomplets
    from public.pelerins pel group by pel.agence_id
  ) p on p.agence_id = a.id
  left join (
    select grp.agence_id, count(*) as nb
    from public.groupes grp group by grp.agence_id
  ) g on g.agence_id = a.id
  left join (
    select grp.agence_id, sum(grp.nb_places_max - coalesce(pgn.nb, 0)) as places_libres
    from public.groupes grp
    left join (select pgn.groupe_id, count(*) as nb from public.pelerins pgn group by pgn.groupe_id) pgn on pgn.groupe_id = grp.id
    group by grp.agence_id
  ) gs on gs.agence_id = a.id
  left join (
    select usr.agence_id,
      count(*) filter (where usr.role = 'gerant') as gerants,
      count(*) filter (where usr.role = 'agent') as agents
    from public.utilisateurs usr group by usr.agence_id
  ) us on us.agence_id = a.id
  left join (
    select pay.agence_id,
      coalesce(sum(pay.montant_paye), 0) as total,
      coalesce(sum(pay.montant_paye) filter (where pay.date_paiement >= now() - interval '30 days'), 0) as total_30j
    from public.paiements pay group by pay.agence_id
  ) ps on ps.agence_id = a.id
  left join (
    select trn.agence_id, count(*) filter (where trn.statut = 'en_retard') as retards
    from public.tranches trn group by trn.agence_id
  ) ts on ts.agence_id = a.id
  left join (
    select rp.agence_id,
      count(*) filter (where rp.statut_envoi = 'en_attente') as attente,
      count(*) filter (where rp.statut_envoi = 'echec') as echecs
    from public.rappels rp group by rp.agence_id
  ) rs on rs.agence_id = a.id
  order by a.nom;
end $$;

-- backfill des dossiers existants (le statut « complet » disparaît)
update public.pelerins pel set statut_dossier = case
  when (select count(distinct type_document)
        from public.documents d
        where d.pelerin_id = pel.id
          and d.type_document in ('passeport','visa','certificat_vaccination','photo')
          and d.statut = 'valide') = 4
  then 'valide' else 'incomplet'
end;
```
````

- [ ] **Step 5: Vérifier que schema.sql est cohérent** — relire le fichier : plus aucune occurrence de `'complet'` ni de `dossiers_complets` hors commentaires.

Run: `npm run build`
Expected: OK (aucun impact TS).

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql docs/superpowers/plans/2026-08-18-dossiers-2-etats.md
git commit -m "feat(sql): statut dossier 2 etats (trigger + contrainte) et stats_globales sans complet + SQL live"
```

---

### Task 3: Page Gestion des documents — tableau ligne-par-pèlerin

**Files:**
- Rewrite: `src/pages/Documents.tsx`
- Rewrite: `src/pages/Documents.test.tsx`

**Interfaces:**
- Consumes: `statutDossierDepuisDocuments`, `statutDocumentParType`, `TYPES_DOCUMENT_REQUIS` (Task 1), `LIBELLES_DOCUMENT` (existant), `StatutDossier` (Task 1).
- Produces: page affichant une ligne par pèlerin ; statut `valide`/`incomplet` (tous types) ou `valide`/`manquant` (type précis) ; filtres type + statut ; cartes Total Pèlerins / Dossiers validés / Dossiers incomplets.

- [ ] **Step 1: Écrire les tests qui échouent** — remplacer `src/pages/Documents.test.tsx` par :

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Documents from './Documents'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const pelerins = [
  {
    id: 'p1', prenom: 'Awa', nom: 'Ndiaye', telephone: '77 123 45 67',
    documents: [
      { type_document: 'passeport', statut: 'valide' },
      { type_document: 'visa', statut: 'valide' },
      { type_document: 'certificat_vaccination', statut: 'valide' },
      { type_document: 'photo', statut: 'valide' },
    ],
  },
  {
    id: 'p2', prenom: 'Fatou', nom: 'Sy', telephone: '77 999 88 77',
    documents: [
      { type_document: 'passeport', statut: 'valide' },
      { type_document: 'visa', statut: 'soumis' },
    ],
  },
]

function rendre(initialEntries = ['/gestion-des-documents']) {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'pelerins') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: pelerins, error: null }) }),
      }
    }
    return { select: () => Promise.resolve({ data: [], error: null }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Documents />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Documents', () => {
  it('affiche une ligne par pèlerin avec le statut du dossier', async () => {
    rendre()
    expect(await screen.findByText('Awa Ndiaye')).toBeInTheDocument()
    expect(screen.getByText('Fatou Sy')).toBeInTheDocument()
    expect(screen.getAllByText('Validé').length).toBe(1)
    expect(screen.getAllByText('Incomplet').length).toBe(1)
  })

  it('affiche les cartes Total Pèlerins / Dossiers validés / Dossiers incomplets', async () => {
    rendre()
    expect(await screen.findByText('Total Pèlerins')).toBeInTheDocument()
    expect(screen.getByText('Dossiers validés')).toBeInTheDocument()
    expect(screen.getByText('Dossiers incomplets')).toBeInTheDocument()
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('filtre par type : statut Validé / Manquant pour ce document', async () => {
    rendre()
    await screen.findByText('Awa Ndiaye')
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'visa' } })
    expect(screen.getAllByText('Validé').length).toBe(1)
    expect(screen.getAllByText('Manquant').length).toBe(1)
  })

  it('filtre par statut', async () => {
    rendre()
    await screen.findByText('Awa Ndiaye')
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'incomplet' } })
    expect(screen.getByText('Fatou Sy')).toBeInTheDocument()
    expect(screen.queryByText('Awa Ndiaye')).not.toBeInTheDocument()
  })

  it('active le filtre passeport via ?alerte=passeport', async () => {
    rendre(['/gestion-des-documents?alerte=passeport'])
    expect(await screen.findByText('Awa Ndiaye')).toBeInTheDocument()
    expect(screen.getAllByText('Validé').length).toBe(2)
  })

  it('ne propose plus le panneau « Valider sans fichier »', async () => {
    rendre()
    await screen.findByText('Awa Ndiaye')
    expect(screen.queryByText('Valider sans fichier')).not.toBeInTheDocument()
  })

  it('lie chaque ligne à la fiche du pèlerin', async () => {
    rendre()
    const lien = await screen.findByRole('link', { name: 'Awa Ndiaye' })
    expect(lien).toHaveAttribute('href', '/details-du-pelerin/p1')
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npm test -- src/pages/Documents.test.tsx`
Expected: FAIL — l'ancienne page n'a ni carte « Total Pèlerins », ni filtre par statut avec ces options, ni lien vers la fiche.

- [ ] **Step 3: Réécrire la page** — remplacer `src/pages/Documents.tsx` par :

```tsx
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_DOCUMENT } from '../lib/format'
import { statutDossierDepuisDocuments, statutDocumentParType } from '../lib/plan'
import Icon from '../components/ui/Icon'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

interface PelerinAvecDocuments {
  id: string
  prenom: string
  nom: string
  telephone: string
  documents: { type_document: string; statut: string }[]
}

const LIBELLES_STATUT_LIGNE: Record<string, string> = {
  valide: 'Validé',
  incomplet: 'Incomplet',
  manquant: 'Manquant',
}

const TONE_STATUT_LIGNE: Record<string, string> = {
  valide: 'vert',
  incomplet: 'rouge',
  manquant: 'rouge',
}

export default function Documents() {
  const [params, setParams] = useSearchParams()
  const alerte = params.get('alerte') ?? ''
  const [filtreType, setFiltreType] = useState(alerte ? 'passeport' : '')
  const [filtreStatut, setFiltreStatut] = useState('')

  const { data: pelerins = [] } = useQuery({
    queryKey: ['pelerins-documents'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pelerins')
        .select('id, prenom, nom, telephone, documents(type_document, statut)')
        .order('nom')
      return data as unknown as PelerinAvecDocuments[]
    },
  })

  const lignes = useMemo(() => {
    return pelerins.map((p) => ({
      ...p,
      statut: filtreType
        ? statutDocumentParType(p.documents, filtreType)
        : statutDossierDepuisDocuments(p.documents),
    }))
  }, [pelerins, filtreType])

  const filtrees = useMemo(() => {
    return lignes.filter((l) => !filtreStatut || l.statut === filtreStatut)
  }, [lignes, filtreStatut])

  const compteurs = useMemo(() => {
    const valides = pelerins.filter(
      (p) => statutDossierDepuisDocuments(p.documents) === 'valide'
    ).length
    return { total: pelerins.length, valides, incomplets: pelerins.length - valides }
  }, [pelerins])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-display-lg text-on-surface">Gestion des documents</h1>
          <p className="text-body-lg mt-1 text-on-surface-variant">Suivez les dossiers de vos pèlerins</p>
        </div>
        <select
          className="input max-w-xs"
          value={filtreType}
          onChange={(e) => {
            setFiltreType(e.target.value)
            if (alerte && e.target.value !== 'passeport') {
              setParams((prev) => {
                const next = new URLSearchParams(prev)
                next.delete('alerte')
                return next
              })
            }
          }}
        >
          <option value="">Tous les types</option>
          {Object.entries(LIBELLES_DOCUMENT).map(([cle, libelle]) => (
            <option key={cle} value={cle}>{libelle}</option>
          ))}
        </select>
        <select className="input max-w-xs" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="valide">Validé</option>
          <option value="incomplet">Incomplet</option>
          <option value="manquant">Manquant</option>
        </select>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Total Pèlerins" valeur={compteurs.total} icon="group" />
        <StatCard label="Dossiers validés" valeur={compteurs.valides} icon="check_circle" tone="vert" />
        <StatCard label="Dossiers incomplets" valeur={compteurs.incomplets} icon="warning" tone="error" />
      </section>

      <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-body-md">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.map((p) => (
                <tr key={p.id} className="group border-t border-outline-variant transition-colors hover:bg-surface-container-low">
                  <td className="px-4 py-4">
                    <Link to={`/details-du-pelerin/${p.id}`} className="font-medium text-primary hover:underline">
                      {p.prenom} {p.nom}
                    </Link>
                    <p className="text-label-md text-on-surface-variant">{p.telephone}</p>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={TONE_STATUT_LIGNE[p.statut]}>{LIBELLES_STATUT_LIGNE[p.statut]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrees.length === 0 && <EmptyState message="Aucun pèlerin pour ce filtre." />}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Vérifier tests + lint + build**

Run: `npm test`
Expected: 109 tests passent (107 + 7 nouveaux Documents − 5 anciens Documents).
Run: `npm run lint`
Expected: 0 error.
Run: `npm run build`
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Documents.tsx src/pages/Documents.test.tsx
git commit -m "feat: page documents ligne-par-pelerin avec statuts valide/incomplet/manquant"
```

---

### Task 4: Pages connexes — Pèlerins, SuperAdmin, StatsAgence

**Files:**
- Modify: `src/pages/Pelerins.tsx:161-162` (option « Complet » du filtre)
- Modify: `src/pages/SuperAdminGlobal.tsx:116-121` (cellule Dossiers)
- Modify: `src/pages/SuperAdminAgenceDetail.tsx:97-110` (StatCard Dossiers)
- Modify: `src/lib/types.ts:63` (StatsAgence sans dossiers_complets)
- Modify: `src/pages/SuperAdminGlobal.test.tsx:18` (fixture)
- Modify: `src/pages/SuperAdminAgenceDetail.test.tsx:18` (fixture)

**Interfaces:**
- Consumes: `StatsAgence` (Task 1/type modifié ici), libellés `LIBELLES_DOSSIER` (Task 1).
- Produces: plus aucune référence à `complet`/`dossiers_complets` dans le front.

- [ ] **Step 1: Option de filtre Pèlerins** — `src/pages/Pelerins.tsx:158-163` : remplacer

```tsx
        <Select value={statutFiltre} onChange={(e) => setParams(e.target.value ? { statut: e.target.value } : {})} className="max-w-xs">
          <option value="">Tous les statuts</option>
          <option value="valide">Validé</option>
          <option value="complet">Complet</option>
          <option value="incomplet">Incomplet</option>
        </Select>
```

par

```tsx
        <Select value={statutFiltre} onChange={(e) => setParams(e.target.value ? { statut: e.target.value } : {})} className="max-w-xs">
          <option value="">Tous les statuts</option>
          <option value="valide">Validé</option>
          <option value="incomplet">Incomplet</option>
        </Select>
```

- [ ] **Step 2: SuperAdminGlobal** — `src/pages/SuperAdminGlobal.tsx:116-121` : remplacer la cellule par

```tsx
                  <td className="px-4 py-4">
                    <span className="text-vert">{s.dossiers_valides} valides</span>
                    <span className="text-on-surface-variant"> · {s.dossiers_incomplets} incomplets</span>
                  </td>
```

- [ ] **Step 3: SuperAdminAgenceDetail** — `src/pages/SuperAdminAgenceDetail.tsx:97-110` : remplacer la StatCard par

```tsx
        <StatCard
          label="Dossiers"
          valeur={
            <span className="text-body-md text-on-surface">
              <span className="text-vert">{s.dossiers_valides} valides</span>
              <span className="text-on-surface-variant"> · </span>
              {s.dossiers_incomplets} incomplets
            </span>
          }
          icon="verified"
          tone="vert"
        />
```

- [ ] **Step 4: StatsAgence** — `src/lib/types.ts:63` : remplacer

```ts
  pelerins_total: number; dossiers_valides: number; dossiers_complets: number; dossiers_incomplets: number
```

par

```ts
  pelerins_total: number; dossiers_valides: number; dossiers_incomplets: number
```

- [ ] **Step 5: Fixtures de test** — retirer `dossiers_complets: 3,` de :
  - `src/pages/SuperAdminGlobal.test.tsx:18`
  - `src/pages/SuperAdminAgenceDetail.test.tsx:18`

- [ ] **Step 6: Vérifier tests + lint + build**

Run: `npm test`
Expected: 109 tests passent.
Run: `npm run lint`
Expected: 0 error.
Run: `npm run build`
Expected: OK.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Pelerins.tsx src/pages/SuperAdminGlobal.tsx src/pages/SuperAdminAgenceDetail.tsx src/lib/types.ts src/pages/SuperAdminGlobal.test.tsx src/pages/SuperAdminAgenceDetail.test.tsx
git commit -m "feat: suppression de l'etat complet dans pelerins et vues superadmin"
```

---

### Task 5: Vérification finale de branche

- [ ] **Step 1: Suite complète + lint + build**

Run: `npm test`
Expected: 109 tests / 109, 17 fichiers.
Run: `npm run lint`
Expected: 0 error, 1 warning préexistant (AuthContext).
Run: `npm run build`
Expected: OK.

- [ ] **Step 2: Vérifier qu'il ne reste aucune référence à « complet » (dossier)**

Run: `Get-ChildItem -Recurse src,supabase -Include *.ts,*.tsx,*.sql | Select-String -Pattern "dossiers_complets|'complet'|statut_dossier in \('incomplet'" | Select-Object Path,LineNumber,Line`
Expected: uniquement la contrainte `('incomplet','valide')` dans `supabase/schema.sql`.

- [ ] **Step 3: Commit final si résidus**

```bash
git add -A
git commit -m "chore: derniere verification dossiers 2 etats"
```

- [ ] **Step 4: Remettre le SQL live à l'utilisateur**

Annoncer que le bloc « SQL live à exécuter » (section dédiée de ce plan) doit être exécuté dans le SQL editor Supabase (contrainte + trigger + stats_globales + backfill) avant que les nouveaux statuts ne soient actifs côté base.

---

## SQL live à exécuter (SQL editor Supabase)

```sql
-- backfill d'abord : les dossiers « complet » existants (produits par l'ancien trigger)
-- feraient échouer l'ajout de contrainte (validation immédiate sur les lignes présentes).
-- Le backfill n'écrit que 'valide'/'incomplet', légaux sous l'ancienne contrainte,
-- et le trigger ne se déclenche que sur documents (pas pelerins), donc aucune interférence.
update public.pelerins pel set statut_dossier = case
  when (select count(distinct type_document)
        from public.documents d
        where d.pelerin_id = pel.id
          and d.type_document in ('passeport','visa','certificat_vaccination','photo')
          and d.statut = 'valide') = 4
  then 'valide' else 'incomplet'
end;

alter table public.pelerins drop constraint if exists pelerins_statut_dossier_check;
alter table public.pelerins add constraint pelerins_statut_dossier_check check (statut_dossier in ('incomplet','valide'));

create or replace function public.trg_maj_statut_dossier()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pelerin uuid; v_statut text;
begin
  v_pelerin := coalesce(new.pelerin_id, old.pelerin_id);
  select case
    when count(distinct type_document) = 4 then 'valide'
    else 'incomplet'
  end into v_statut
  from public.documents
  where pelerin_id = v_pelerin
    and type_document in ('passeport','visa','certificat_vaccination','photo')
    and statut = 'valide';
  update public.pelerins set statut_dossier = v_statut where id = v_pelerin;
  return coalesce(new, old);
end $$;

create or replace function public.stats_globales()
returns table (
  agence_id uuid, agence_nom text, agence_active boolean,
  pelerins_total bigint, dossiers_valides bigint, dossiers_incomplets bigint,
  groupes_total bigint, places_restantes bigint,
  gerants bigint, agents bigint,
  encaissements_total numeric, encaissements_30j numeric,
  tranches_en_retard bigint, rappels_attente bigint, rappels_echec bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_superadmin() then
    raise exception 'Accès refusé : réservé au superadmin';
  end if;
  return query
  select
    a.id, a.nom, a.active,
    coalesce(p.nb, 0) as pelerins_total,
    coalesce(p.valides, 0) as dossiers_valides,
    coalesce(p.incomplets, 0) as dossiers_incomplets,
    coalesce(g.nb, 0) as groupes_total,
    coalesce(gs.places_libres, 0)::bigint as places_restantes,
    coalesce(us.gerants, 0) as gerants,
    coalesce(us.agents, 0) as agents,
    coalesce(ps.total, 0) as encaissements_total,
    coalesce(ps.total_30j, 0) as encaissements_30j,
    coalesce(ts.retards, 0) as tranches_en_retard,
    coalesce(rs.attente, 0) as rappels_attente,
    coalesce(rs.echecs, 0) as rappels_echec
  from public.agences a
  left join (
    select pel.agence_id,
      count(*) as nb,
      count(*) filter (where pel.statut_dossier = 'valide') as valides,
      count(*) filter (where pel.statut_dossier = 'incomplet') as incomplets
    from public.pelerins pel group by pel.agence_id
  ) p on p.agence_id = a.id
  left join (
    select grp.agence_id, count(*) as nb
    from public.groupes grp group by grp.agence_id
  ) g on g.agence_id = a.id
  left join (
    select grp.agence_id, sum(grp.nb_places_max - coalesce(pgn.nb, 0)) as places_libres
    from public.groupes grp
    left join (select pgn.groupe_id, count(*) as nb from public.pelerins pgn group by pgn.groupe_id) pgn on pgn.groupe_id = grp.id
    group by grp.agence_id
  ) gs on gs.agence_id = a.id
  left join (
    select usr.agence_id,
      count(*) filter (where usr.role = 'gerant') as gerants,
      count(*) filter (where usr.role = 'agent') as agents
    from public.utilisateurs usr group by usr.agence_id
  ) us on us.agence_id = a.id
  left join (
    select pay.agence_id,
      coalesce(sum(pay.montant_paye), 0) as total,
      coalesce(sum(pay.montant_paye) filter (where pay.date_paiement >= now() - interval '30 days'), 0) as total_30j
    from public.paiements pay group by pay.agence_id
  ) ps on ps.agence_id = a.id
  left join (
    select trn.agence_id, count(*) filter (where trn.statut = 'en_retard') as retards
    from public.tranches trn group by trn.agence_id
  ) ts on ts.agence_id = a.id
  left join (
    select rp.agence_id,
      count(*) filter (where rp.statut_envoi = 'en_attente') as attente,
      count(*) filter (where rp.statut_envoi = 'echec') as echecs
    from public.rappels rp group by rp.agence_id
  ) rs on rs.agence_id = a.id
  order by a.nom;
end $$;
```
