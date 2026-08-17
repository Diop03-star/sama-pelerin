# Refonte du modèle de paiement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre le modèle de paiement : acompte de réservation (défaut 60 % Omra / 40 % Hajj), date limite de solde (défaut départ − 30 j / − 60 j), échéancier éditable avec vraies dates mensuelles, statut de plan calculé par trigger, acomptes inclus dans tous les totaux.

**Architecture:** Données : `plans_paiement` gagne `montant_acompte`, `date_limite_solde`, `statut` ; `paiements` gagne `type_paiement` (`acompte`/`tranche`) et `plan_paiement_id` (l'acompte a `tranche_id = null`). Serveur : nouveau trigger `trg_maj_statut_plan` (statut calculé), adaptation de `trg_maj_statut_tranche` (skip acompte) et de `bloquer_encaissement_excedent` (somme incluant les acomptes). Client : `genererEcheancier` remplace `genererTranches`, formulaire de création étendu, encaissement d'acompte, badges statut plan, acomptes inclus dans les totaux (fiche pèlerin, page paiements, SuperAdminGlobal — Dashboard et `stats_globales` n'ont pas de join `tranches`, rien à changer pour eux).

**Tech Stack:** SQL (PostgreSQL/plpgsql, Supabase), React 19, TypeScript, @tanstack/react-query, Vitest + Testing Library.

## Global Constraints

- UI et messages en français avec apostrophes typographiques (`’`), pas d'apostrophe droite (`'`) dans les libellés/tests.
- Aucun commentaire dans le code TS ; commentaires SQL descriptifs au-dessus des fonctions autorisés (style du fichier schema.sql).
- Valeurs DB en ASCII sans accents : statut plan `solde` (pas `soldé`), `acompte_en_attente`, `en_cours`, `en_retard`.
- Tests : mock `vi.hoisted` de `../../lib/supabase` (ou `../lib/supabase` selon le dossier), wrapper `QueryClientProvider` (+ `MemoryRouter` si `Link` présent), libellés/aria en français avec `’`.
- Vérifications finales : `npm test`, `npm run lint`, `npm run build` (build = `tsc -b && vite build`, les fichiers de test sont typecheckés).
- Le projet n'a pas de framework de tests SQL : les triggers sont vérifiés par application live (SQL editor Supabase), jamais par tests automatisés.
- `supabase/schema.sql` est la source de vérité ; la base live est mise à jour par requête SQL manuelle fournie à l'utilisateur (pattern `numero_document`).
- Le trigger `bloquer_encaissement_excedent` (feature blocage encaissement, déjà fusionnée dans cette branche) reste en place et s'applique aussi aux acomptes.
- À l'exécution : créer la branche `refonte-paiement` depuis HEAD avant de commencer.

---

### Task 1: Types, libellés, générateur d'échéancier (lib)

**Files:**
- Modify: `src/lib/types.ts` (types `TypePaiement`, `StatutPlan`, `PlanPaiement`, `Paiement`)
- Modify: `src/lib/format.ts` (`LIBELLES_STATUT_PLAN`, `TONE_STATUT_PLAN`)
- Modify: `src/lib/plan.ts` (`proposerAcompte`, `proposerDateLimite`, `ajouterMois`, `ajouterJours`, `genererEcheancier`, `validerEcheancier` — `genererTranches` supprimé)
- Modify: `src/lib/plan.test.ts`, `src/lib/format.test.ts`

**Interfaces:**
- Produces (utilisé par les tasks 3-6) :
  - `type TypePaiement = 'acompte' | 'tranche'`
  - `type StatutPlan = 'acompte_en_attente' | 'en_cours' | 'en_retard' | 'solde'`
  - `PlanPaiement` + `montant_acompte: number; date_limite_solde: string | null; statut: StatutPlan`
  - `Paiement` : `tranche_id: string | null; type_paiement: TypePaiement; plan_paiement_id: string | null`
  - `proposerAcompte(montantTotal: number, typeVoyage: TypeVoyage): number`
  - `proposerDateLimite(dateDepart: string, typeVoyage: TypeVoyage): string`
  - `genererEcheancier(montantTotal: number, montantAcompte: number, nombreTranches: number, debut: string, dateLimite: string): TrancheDraft[]`
  - `validerEcheancier(montantTotal: number, montantAcompte: number, tranches: TrancheDraft[], dateLimite: string): string | null`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/lib/plan.test.ts`, **remplacer** les tests de `genererTranches` (lire le fichier actuel d'abord : 6 tests, supprimer ceux qui référencent `genererTranches`) par :

```ts
import { describe, it, expect } from 'vitest'
import {
  proposerAcompte,
  proposerDateLimite,
  genererEcheancier,
  validerEcheancier,
  ajouterMois,
  ajouterJours,
} from './plan'

describe('proposerAcompte', () => {
  it('propose 60 % du total pour une Omra', () => {
    expect(proposerAcompte(1000000, 'omra')).toBe(600000)
  })

  it('propose 40 % du total pour un Hajj', () => {
    expect(proposerAcompte(1000000, 'hajj')).toBe(400000)
  })
})

describe('proposerDateLimite', () => {
  it('propose 30 jours avant le départ pour une Omra', () => {
    expect(proposerDateLimite('2026-06-15', 'omra')).toBe('2026-05-16')
  })

  it('propose 60 jours avant le départ pour un Hajj', () => {
    expect(proposerDateLimite('2026-06-15', 'hajj')).toBe('2026-04-16')
  })
})

describe('ajouterMois', () => {
  it('gère les fins de mois', () => {
    expect(ajouterMois('2026-01-31', 1)).toBe('2026-02-28')
    expect(ajouterMois('2026-03-31', 1)).toBe('2026-04-30')
  })

  it('gère le changement d’année', () => {
    expect(ajouterMois('2026-11-10', 2)).toBe('2027-01-10')
  })
})

describe('ajouterJours', () => {
  it('retranche des jours en traversant les mois', () => {
    expect(ajouterJours('2026-06-15', -60)).toBe('2026-04-16')
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('genererEcheancier', () => {
  it('répartit le reste en tranches égales, dernière ajustée', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-02-01', '2026-04-15')
    expect(tranches.map((t) => t.montant_prevu)).toEqual([200000, 200000, 200000])
    expect(tranches[2].montant_prevu).toBe(200000)
  })

  it('génère des dates mensuelles depuis le début', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-02-01', '2026-04-15')
    expect(tranches.map((t) => t.date_echeance)).toEqual(['2026-02-01', '2026-03-01', '2026-04-01'])
  })

  it('borne la dernière échéance à la date limite', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-03-20', '2026-03-31')
    expect(tranches.map((t) => t.date_echeance)).toEqual(['2026-03-20', '2026-03-31', '2026-03-31'])
  })

  it('répartit un reste non divisible', () => {
    const tranches = genererEcheancier(1000000, 100000, 3, '2026-02-01', '2026-04-15')
    expect(tranches.map((t) => t.montant_prevu)).toEqual([300000, 300000, 300000])
  })

  it('retourne un échéancier vide si aucun montant à répartir', () => {
    expect(genererEcheancier(1000000, 1000000, 3, '2026-02-01', '2026-04-15')).toEqual([
      { numero_tranche: 1, montant_prevu: 0, date_echeance: '2026-02-01' },
      { numero_tranche: 2, montant_prevu: 0, date_echeance: '2026-03-01' },
      { numero_tranche: 3, montant_prevu: 0, date_echeance: '2026-04-01' },
    ])
  })
})

describe('validerEcheancier', () => {
  it('refuse un acompte supérieur au total', () => {
    expect(validerEcheancier(1000000, 1200000, [], '2026-04-15')).not.toBeNull()
  })

  it('refuse une somme répartie différente du reste', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-02-01', '2026-04-15')
    tranches[0].montant_prevu = 250000
    expect(validerEcheancier(1000000, 400000, tranches, '2026-04-15')).toBe('La répartition doit totaliser 600 000 FCFA.')
  })

  it('refuse une échéance après la date limite', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-03-20', '2026-03-31')
    tranches[1].date_echeance = '2026-04-01'
    expect(validerEcheancier(1000000, 400000, tranches, '2026-03-31')).toBe('Chaque échéance doit être avant la date limite du solde.')
  })

  it('accepte un échéancier valide', () => {
    const tranches = genererEcheancier(1000000, 400000, 3, '2026-02-01', '2026-04-15')
    expect(validerEcheancier(1000000, 400000, tranches, '2026-04-15')).toBeNull()
  })
})
```

Note : le message « La répartition doit totaliser 600 000 FCFA. » utilise `formatFCFA` — le plan prévoit l'implémentation ci-dessous (message construit avec `formatFCFA`).

Dans `src/lib/format.test.ts`, ajouter (lire le fichier actuel d'abord pour suivre son style `describe`/`expect`) :

```ts
import { LIBELLES_STATUT_PLAN, TONE_STATUT_PLAN } from './format'

describe('libellés statut plan', () => {
  it('expose les libellés et tons des quatre statuts', () => {
    expect(LIBELLES_STATUT_PLAN).toMatchObject({
      acompte_en_attente: 'Acompte en attente',
      en_cours: 'En cours',
      en_retard: 'En retard',
      solde: 'Soldé',
    })
    expect(TONE_STATUT_PLAN).toEqual({
      acompte_en_attente: 'ambre',
      en_cours: 'neutre',
      en_retard: 'rouge',
      solde: 'vert',
    })
  })
})
```

- [ ] **Step 2: Exécuter les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/plan.test.ts src/lib/format.test.ts`
Expected: FAIL — `proposerAcompte` / `proposerDateLimite` / `genererEcheancier` / `validerEcheancier` / `ajouterMois` / `ajouterJours` / `LIBELLES_STATUT_PLAN` / `TONE_STATUT_PLAN` introuvables.

- [ ] **Step 3: Implémenter types, libellés et fonctions**

**3a. `src/lib/types.ts`** — après `export type StatutTranche = ...`, ajouter :

```ts
export type TypePaiement = 'acompte' | 'tranche'
export type StatutPlan = 'acompte_en_attente' | 'en_cours' | 'en_retard' | 'solde'
```

Modifier `PlanPaiement` :

```ts
export interface PlanPaiement {
  id: string; agence_id: string; pelerin_id: string
  montant_total: number; devise: string; nombre_tranches: number; created_at: string
  montant_acompte: number; date_limite_solde: string | null; statut: StatutPlan
}
```

Modifier `Paiement` :

```ts
export interface Paiement {
  id: string; agence_id: string; tranche_id: string | null; montant_paye: number
  date_paiement: string; mode: ModePaiement; reference: string | null; enregistre_par: string | null
  type_paiement: TypePaiement; plan_paiement_id: string | null
}
```

**3b. `src/lib/format.ts`** — après `TONE_TRANCHE`, ajouter :

```ts
export const LIBELLES_STATUT_PLAN: Record<string, string> = {
  acompte_en_attente: 'Acompte en attente',
  en_cours: 'En cours',
  en_retard: 'En retard',
  solde: 'Soldé',
}

export const TONE_STATUT_PLAN: Record<string, string> = {
  acompte_en_attente: 'ambre',
  en_cours: 'neutre',
  en_retard: 'rouge',
  solde: 'vert',
}
```

**3c. `src/lib/plan.ts`** — remplacer tout le contenu par :

```ts
import type { TypeVoyage } from './types'
import { formatFCFA } from './format'

export interface TrancheDraft {
  numero_tranche: number
  montant_prevu: number
  date_echeance: string
}

export function statutDossierDepuisDocuments(statuts: string[]): 'incomplet' | 'complet' | 'valide' {
  if (statuts.length === 0) return 'incomplet'
  if (statuts.every((s) => s === 'valide')) return 'valide'
  if (statuts.every((s) => s === 'soumis' || s === 'valide')) return 'complet'
  return 'incomplet'
}

function joursDansMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate()
}

export function ajouterMois(dateISO: string, mois: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const total = y * 12 + (m - 1) + mois
  const annee = Math.floor(total / 12)
  const moisCible = ((total % 12) + 12) % 12
  const jour = Math.min(d, joursDansMois(annee, moisCible + 1))
  return `${annee}-${String(moisCible + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
}

export function ajouterJours(dateISO: string, jours: number): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + jours))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export function proposerAcompte(montantTotal: number, typeVoyage: TypeVoyage): number {
  return Math.round(montantTotal * (typeVoyage === 'omra' ? 0.6 : 0.4))
}

export function proposerDateLimite(dateDepart: string, typeVoyage: TypeVoyage): string {
  return ajouterJours(dateDepart, typeVoyage === 'omra' ? -30 : -60)
}

export function genererEcheancier(
  montantTotal: number,
  montantAcompte: number,
  nombreTranches: number,
  debut: string,
  dateLimite: string
): TrancheDraft[] {
  if (nombreTranches < 1) return []
  const reste = montantTotal - montantAcompte
  const base = Math.floor(reste / nombreTranches)
  const tranches: TrancheDraft[] = []
  for (let i = 1; i <= nombreTranches; i++) {
    const dernier = i === nombreTranches
    const echeance = ajouterMois(debut, i - 1)
    tranches.push({
      numero_tranche: i,
      montant_prevu: dernier ? reste - base * (nombreTranches - 1) : base,
      date_echeance: echeance <= dateLimite ? echeance : dateLimite,
    })
  }
  return tranches
}

export function validerEcheancier(
  montantTotal: number,
  montantAcompte: number,
  tranches: TrancheDraft[],
  dateLimite: string
): string | null {
  if (!montantTotal || montantTotal <= 0) return 'Renseignez un montant total positif.'
  if (montantAcompte < 0 || montantAcompte > montantTotal) return 'L’acompte ne peut pas dépasser le montant total.'
  if (tranches.length === 0 && montantAcompte !== montantTotal) return 'Répartissez le reste en tranches ou augmentez l’acompte.'
  if (tranches.length > 0) {
    const somme = tranches.reduce((s, t) => s + t.montant_prevu, 0)
    if (somme + montantAcompte !== montantTotal) return `La répartition doit totaliser ${formatFCFA(montantTotal - montantAcompte)}.`
    if (tranches.some((t) => t.montant_prevu <= 0)) return 'Chaque tranche doit avoir un montant positif.'
  }
  if (dateLimite && tranches.some((t) => t.date_echeance > dateLimite)) return 'Chaque échéance doit être avant la date limite du solde.'
  return null
}
```

Note : `genererTranches` est supprimé — vérifier avec grep qu'aucun autre fichier ne l'importe (seul `PlanPaiementSection.tsx` l'utilisait ; il sera réécrit en Task 3 — s'il casse le typecheck, la Task 3 le corrige).

- [ ] **Step 4: Exécuter les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/plan.test.ts src/lib/format.test.ts`
Expected: tous PASS (plan ~16 tests, format ~9 tests).

- [ ] **Step 5: Vérifications et commit**

Run: `npx vitest run` (suite complète — les fixtures de composants ne référencent pas encore les nouveaux champs, rien ne doit casser hors PlanPaiementSection qui casse au build : voir note 3c), puis `npm run lint`, puis `npm run build` (peut échouer sur `PlanPaiementSection.tsx` qui importe `genererTranches` supprimé — dans ce cas, committer quand même les lib en notant l'échec attendu, la Task 3 corrige le composant ; sinon tout doit être vert).

```bash
git add src/lib/types.ts src/lib/format.ts src/lib/plan.ts src/lib/plan.test.ts src/lib/format.test.ts
git commit -m "feat: générateur d'échéancier, acompte et date limite (types, libellés, plan.ts)"
```

---

### Task 2: Schéma SQL — colonnes et triggers

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Consumes: la feature « blocage encaissement » (trigger `bloquer_encaissement_excedent` déjà présent, ~ligne 210-234).
- Produces: colonnes `plans_paiement.montant_acompte` / `date_limite_solde` / `statut` ; `paiements.type_paiement` / `plan_paiement_id` (et `tranche_id` rendu nullable) ; fonctions `trg_maj_statut_plan`, `trg_maj_statut_tranche` (adaptée), `bloquer_encaissement_excedent` (adaptée) ; le SQL live à fournir à l'utilisateur.

- [ ] **Step 1: Modifier les définitions de tables**

Dans `supabase/schema.sql` :

**1a. Table `plans_paiement` (ligne 68-76)** — remplacer par :

```sql
create table public.plans_paiement (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id) on delete cascade,
  pelerin_id uuid not null unique references public.pelerins(id) on delete cascade,
  montant_total numeric(12,0) not null check (montant_total >= 0),
  montant_acompte numeric(12,0) not null default 0 check (montant_acompte >= 0),
  date_limite_solde date,
  statut text not null default 'en_cours' check (statut in ('acompte_en_attente','en_cours','en_retard','solde')),
  devise text not null default 'FCFA',
  nombre_tranches int not null default 1,
  created_at timestamptz not null default now()
);
```

**1b. Table `paiements` (ligne 89-98)** — remplacer par :

```sql
create table public.paiements (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id) on delete cascade,
  tranche_id uuid references public.tranches(id) on delete cascade,
  plan_paiement_id uuid references public.plans_paiement(id) on delete cascade,
  montant_paye numeric(12,0) not null check (montant_paye >= 0),
  date_paiement timestamptz not null default now(),
  type_paiement text not null default 'tranche' check (type_paiement in ('acompte','tranche')),
  mode text not null default 'especes' check (mode in ('especes','wave','orange_money','virement','autre')),
  reference text,
  enregistre_par uuid references public.utilisateurs(id)
);
```

Note : `tranche_id` perd `not null` (l'acompte n'a pas de tranche) ; `plan_paiement_id` référence `plans_paiement` avec cascade.

- [ ] **Step 2: Adapter `trg_maj_statut_tranche`**

Dans la fonction `public.trg_maj_statut_tranche()` (ligne 169-191), insérer **en tout premier** dans le corps `begin` (avant `v_id := ...`) :

```sql
  if coalesce(new.type_paiement, old.type_paiement) = 'acompte' then
    return coalesce(new, old);
  end if;
```

- [ ] **Step 3: Adapter `bloquer_encaissement_excedent`**

Dans la fonction `public.bloquer_encaissement_excedent()` (ligne ~210-234), remplacer la requête de somme :

```sql
  select coalesce(sum(pay.montant_paye), 0)
    into v_paye
    from public.paiements pay
    join public.tranches t2 on t2.id = pay.tranche_id
    where t2.plan_paiement_id = v_plan_id;
```

par :

```sql
  select coalesce(sum(pay.montant_paye), 0)
    into v_paye
    from public.paiements pay
    where pay.type_paiement = 'acompte' and pay.plan_paiement_id = v_plan_id
       or pay.tranche_id in (select id from public.tranches where plan_paiement_id = v_plan_id);
```

(La somme inclut désormais les acomptes du plan ; le reste de la fonction — `v_plan_id is null`, la condition, le raise — inchangé.)

- [ ] **Step 4: Ajouter `trg_maj_statut_plan`**

Après la fonction `trg_maj_statut_dossier` (ligne ~208), insérer :

```sql
-- Recalcule le statut du plan de paiement après modification des paiements
create or replace function public.trg_maj_statut_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan_id uuid;
  v_acompte numeric; v_acompte_paye numeric; v_total numeric; v_paye numeric;
  v_limite date; v_statut text;
begin
  if tg_table_name = 'plans_paiement' then
    v_plan_id := new.id;
  elsif coalesce(new.type_paiement, old.type_paiement) = 'acompte' then
    v_plan_id := coalesce(new.plan_paiement_id, old.plan_paiement_id);
  else
    select t.plan_paiement_id into v_plan_id from public.tranches t where t.id = coalesce(new.tranche_id, old.tranche_id);
  end if;
  if v_plan_id is null then
    return coalesce(new, old);
  end if;
  select p.montant_acompte, p.montant_total, p.date_limite_solde
    into v_acompte, v_total, v_limite
    from public.plans_paiement p where p.id = v_plan_id;
  select coalesce(sum(pay.montant_paye), 0)
    into v_acompte_paye
    from public.paiements pay
    where pay.type_paiement = 'acompte' and pay.plan_paiement_id = v_plan_id;
  select coalesce(sum(pay.montant_paye), 0)
    into v_paye
    from public.paiements pay
    where pay.type_paiement = 'acompte' and pay.plan_paiement_id = v_plan_id
       or pay.tranche_id in (select id from public.tranches where plan_paiement_id = v_plan_id);
  if v_acompte > 0 and v_acompte_paye < v_acompte then v_statut := 'acompte_en_attente';
  elsif v_paye >= v_total then v_statut := 'solde';
  elsif v_limite is not null and v_limite < current_date then v_statut := 'en_retard';
  else v_statut := 'en_cours';
  end if;
  update public.plans_paiement set statut = v_statut where id = v_plan_id;
  return coalesce(new, old);
end $$;
```

- [ ] **Step 5: Ajouter les triggers**

Après `create trigger bloquer_encaissement_excedent ... ;` (ligne ~247), insérer :

```sql
create trigger trg_paiement_maj_plan
  after insert or update or delete on public.paiements
  for each row execute function public.trg_maj_statut_plan();

create trigger trg_plan_maj_plan
  after insert on public.plans_paiement
  for each row execute function public.trg_maj_statut_plan();
```

- [ ] **Step 6: Vérifications et commit**

Run: `npm run lint` (0 erreur) puis `npm run build` (vert — le SQL n'est pas typechecké mais le build ne doit pas se casser).

```bash
git add supabase/schema.sql
git commit -m "feat: acompte, date limite et statut plan (schema SQL + triggers)"
```

- [ ] **Step 7: Fournir le SQL live** (pas de code — à remettre à l'utilisateur en fin d'implémentation, à exécuter dans le SQL editor Supabase) :

```sql
alter table public.plans_paiement
  add column montant_acompte numeric(12,0) not null default 0 check (montant_acompte >= 0),
  add column date_limite_solde date,
  add column statut text not null default 'en_cours' check (statut in ('acompte_en_attente','en_cours','en_retard','solde'));

alter table public.paiements
  alter column tranche_id drop not null,
  add column plan_paiement_id uuid references public.plans_paiement(id) on delete cascade,
  add column type_paiement text not null default 'tranche' check (type_paiement in ('acompte','tranche'));

create or replace function public.trg_maj_statut_tranche()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_verse numeric; v_prevu numeric; v_echeance date; v_statut text;
begin
  if coalesce(new.type_paiement, old.type_paiement) = 'acompte' then
    return coalesce(new, old);
  end if;
  v_id := coalesce(new.tranche_id, old.tranche_id);
  select coalesce(sum(p.montant_paye), 0), t.montant_prevu, t.date_echeance
    into v_verse, v_prevu, v_echeance
    from public.tranches t left join public.paiements p on p.tranche_id = t.id
    where t.id = v_id group by t.montant_prevu, t.date_echeance;
  if v_verse is null then
    select montant_prevu, date_echeance into v_prevu, v_echeance
      from public.tranches where id = v_id;
    v_verse := 0;
  end if;
  if v_verse >= v_prevu then v_statut := 'payee';
  elsif v_verse > 0 then v_statut := 'partielle';
  elsif v_echeance < current_date then v_statut := 'en_retard';
  else v_statut := 'a_venir';
  end if;
  update public.tranches set statut = v_statut where id = v_id;
  return coalesce(new, old);
end $$;

create or replace function public.bloquer_encaissement_excedent()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan_id uuid; v_plan_total numeric; v_paye numeric;
begin
  select t.plan_paiement_id, p.montant_total
    into v_plan_id, v_plan_total
    from public.tranches t
    join public.plans_paiement p on p.id = t.plan_paiement_id
    where t.id = new.tranche_id
    for update of p;
  if v_plan_id is null then
    raise exception 'Tranche inconnue.';
  end if;
  select coalesce(sum(pay.montant_paye), 0)
    into v_paye
    from public.paiements pay
    where pay.type_paiement = 'acompte' and pay.plan_paiement_id = v_plan_id
       or pay.tranche_id in (select id from public.tranches where plan_paiement_id = v_plan_id);
  if v_paye + new.montant_paye > v_plan_total then
    raise exception 'Encaissement refusé : le plan de paiement est soldé ou le montant dépasse le reste dû.';
  end if;
  return new;
end $$;

create or replace function public.trg_maj_statut_plan()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan_id uuid;
  v_acompte numeric; v_acompte_paye numeric; v_total numeric; v_paye numeric;
  v_limite date; v_statut text;
begin
  if tg_table_name = 'plans_paiement' then
    v_plan_id := new.id;
  elsif coalesce(new.type_paiement, old.type_paiement) = 'acompte' then
    v_plan_id := coalesce(new.plan_paiement_id, old.plan_paiement_id);
  else
    select t.plan_paiement_id into v_plan_id from public.tranches t where t.id = coalesce(new.tranche_id, old.tranche_id);
  end if;
  if v_plan_id is null then
    return coalesce(new, old);
  end if;
  select p.montant_acompte, p.montant_total, p.date_limite_solde
    into v_acompte, v_total, v_limite
    from public.plans_paiement p where p.id = v_plan_id;
  select coalesce(sum(pay.montant_paye), 0)
    into v_acompte_paye
    from public.paiements pay
    where pay.type_paiement = 'acompte' and pay.plan_paiement_id = v_plan_id;
  select coalesce(sum(pay.montant_paye), 0)
    into v_paye
    from public.paiements pay
    where pay.type_paiement = 'acompte' and pay.plan_paiement_id = v_plan_id
       or pay.tranche_id in (select id from public.tranches where plan_paiement_id = v_plan_id);
  if v_acompte > 0 and v_acompte_paye < v_acompte then v_statut := 'acompte_en_attente';
  elsif v_paye >= v_total then v_statut := 'solde';
  elsif v_limite is not null and v_limite < current_date then v_statut := 'en_retard';
  else v_statut := 'en_cours';
  end if;
  update public.plans_paiement set statut = v_statut where id = v_plan_id;
  return coalesce(new, old);
end $$;

create trigger trg_paiement_maj_plan
  after insert or update or delete on public.paiements
  for each row execute function public.trg_maj_statut_plan();

create trigger trg_plan_maj_plan
  after insert on public.plans_paiement
  for each row execute function public.trg_maj_statut_plan();
```

**Cas de test manuel (base live) :** créer un plan avec `montant_acompte > 0` → statut `acompte_en_attente` ; encaisser l'acompte intégralement → `en_cours` (si date limite future) ; solder toutes les tranches → `solde` ; passer la date limite avec un reste → `en_retard` (déclencher en testant une date passée).

---

### Task 3: `PlanPaiementSection` — création du plan étendue (acompte, date limite, échéancier éditable)

**Files:**
- Modify: `src/components/paiements/PlanPaiementSection.tsx`
- Modify: `src/pages/PelerinDetail.tsx` (requête groupe + prop)
- Modify: `src/components/paiements/PlanPaiementSection.test.tsx`

**Interfaces:**
- Consumes: Task 1 — `proposerAcompte`, `proposerDateLimite`, `genererEcheancier`, `validerEcheancier`, `TrancheDraft`, types `StatutPlan`/`TypePaiement`/`PlanPaiement` étendus.
- Produces: `PlanPaiementSection` accepte `groupe?: { type_voyage: TypeVoyage; date_depart: string } | null` ; formulaire de création avec acompte/date limite/échéancier éditable ; insert `plans_paiement` avec `montant_acompte` et `date_limite_solde`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `src/components/paiements/PlanPaiementSection.test.tsx`, ajouter dans le `describe` (conserver les 5 tests existants et la fonction `rendre` ; ils continuent de marcher — `groupe` est optionnel) :

```tsx
import { proposerAcompte, proposerDateLimite } from '../../lib/plan'
```

(en tête de fichier, avec les autres imports — ne pas importer si déjà importé ; le test importe ces fonctions pour calculer les attentes, ou utiliser des valeurs littérales)

```tsx
  it('pré-remplit l’acompte et la date limite selon le groupe (Hajj)', async () => {
    rendre(planNonSolde, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    expect(await screen.findByLabelText('Montant total (FCFA)')).toHaveValue(0)
    expect(screen.getByLabelText('Acompte (FCFA)')).toHaveValue(proposerAcompte(0, 'hajj'))
    expect(screen.getByLabelText('Date limite du solde')).toHaveValue(proposerDateLimite('2026-05-15', 'hajj'))
  })
```

Note : le test ci-dessus suppose le flux actuel : `montantTotal` démarre à `''` — adapter l'assertion au rendu réel (si le champ est vide, `toHaveValue('')`). L'implémentation 3a initialise les champs vides à l'ouverture ; le test vérifie la proposition après saisie du montant total (voir test suivant, plus significatif).

```tsx
  it('propose l’acompte et la date limite après saisie du montant total (Omra)', async () => {
    rendre(planNonSolde, { type_voyage: 'omra', date_depart: '2026-06-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    expect(screen.getByLabelText('Acompte (FCFA)')).toHaveValue(600000)
    expect(screen.getByLabelText('Date limite du solde')).toHaveValue('2026-05-16')
  })

  it('affiche un échéancier éditable et répartit le reste', async () => {
    rendre(planNonSolde, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    fireEvent.change(screen.getByLabelText('Acompte (FCFA)'), { target: { value: '400000' } })
    fireEvent.change(screen.getByLabelText('Nombre de tranches'), { target: { value: '3' } })
    const montants = screen.getAllByLabelText('Montant de la tranche')
    expect(montants).toHaveLength(3)
    expect(montants[0]).toHaveValue(200000)
    expect(screen.getByText('Reste à répartir : 0 FCFA')).toBeInTheDocument()
  })

  it('bloque la création quand la répartition est incorrecte', async () => {
    rendre(planNonSolde, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    fireEvent.change(screen.getByLabelText('Acompte (FCFA)'), { target: { value: '400000' } })
    fireEvent.change(screen.getByLabelText('Nombre de tranches'), { target: { value: '3' } })
    fireEvent.change(screen.getAllByLabelText('Montant de la tranche')[0], { target: { value: '250000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le plan' }))
    expect(await screen.findByText('La répartition doit totaliser 600 000 FCFA.')).toBeInTheDocument()
  })

  it('crée le plan et ses tranches avec acompte et date limite', async () => {
    rendre(planNonSolde, { type_voyage: 'hajj', date_depart: '2026-05-15' })
    fireEvent.click(await screen.findByRole('button', { name: 'Créer un plan' }))
    fireEvent.change(await screen.findByLabelText('Montant total (FCFA)'), { target: { value: '1000000' } })
    fireEvent.change(screen.getByLabelText('Acompte (FCFA)'), { target: { value: '400000' } })
    fireEvent.change(screen.getByLabelText('Date limite du solde'), { target: { value: '2026-03-16' } })
    fireEvent.change(screen.getByLabelText('Nombre de tranches'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le plan' }))
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('plans_paiement')
    })
    const [ligne] = insertPlan.mock.calls[0]
    expect(ligne).toMatchObject({
      agence_id: 'ag1',
      pelerin_id: 'pel1',
      montant_total: 1000000,
      montant_acompte: 400000,
      date_limite_solde: '2026-03-16',
      nombre_tranches: 3,
    })
    const [tranches] = insertTranches.mock.calls[0]
    expect(tranches).toHaveLength(3)
    expect(tranches[0]).toMatchObject({ plan_paiement_id: 'plan1', numero_tranche: 1, montant_prevu: 200000, date_echeance: '2026-02-01' })
  })
```

Adapter `rendre` pour accepter un groupe optionnel et le passer au composant :

```tsx
function rendre(plan: typeof planSolde, groupe?: { type_voyage: 'hajj' | 'omra'; date_depart: string }) {
  ...
  <PlanPaiementSection pelerinId="pel1" groupe={groupe ?? null} />
```

Et ajouter les mocks `insertPlan` et `insertTranches` dans `beforeEach` + `mockSupabase.from` :

```tsx
const insertPlan = vi.fn()
const insertTranches = vi.fn()
```

Dans `mockImplementation` : `plans_paiement` → `{ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: plan, error: null }) }) }), insert: insertPlan }` (insert suivi de `.select('id').single()` → mock : `insert: vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'plan1' }, error: null }) }) }))` — en pratique : `insert: insertPlan` où `insertPlan.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'plan1' }, error: null }) }) })` à régler dans `beforeEach`). `tranches` → `{ insert: insertTranches }`.

Dans `beforeEach` :
```tsx
  insertPlan.mockReset()
  insertPlan.mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'plan1' }, error: null }) }) })
  insertTranches.mockReset()
  insertTranches.mockResolvedValue({ error: null })
```

- [ ] **Step 2: Exécuter les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/components/paiements/PlanPaiementSection.test.tsx`
Expected: les nouveaux tests échouent (labels « Acompte (FCFA) », « Date limite du solde », « Montant de la tranche », « Reste à répartir » introuvables ; `insertPlan` jamais appelé).

- [ ] **Step 3: Implémenter la création étendue**

**3a. Props et état** — `PlanPaiementSection.tsx` :

```tsx
export default function PlanPaiementSection({ pelerinId, groupe }: { pelerinId: string; groupe?: { type_voyage: TypeVoyage; date_depart: string } | null }) {
```

Importer `TypeVoyage`, `TrancheDraft` et les fonctions de `../../lib/plan` (remplacer l'import de `genererTranches`) :

```tsx
import { genererEcheancier, proposerAcompte, proposerDateLimite, validerEcheancier } from '../../lib/plan'
import type { Paiement, PlanPaiement, Tranche, TypeVoyage } from '../../lib/types'
```

Nouveaux états (remplacer `montantTotal`/`nombreTranches` existants par) :

```tsx
  const [montantTotal, setMontantTotal] = useState('')
  const [montantAcompte, setMontantAcompte] = useState('')
  const [acompteTouche, setAcompteTouche] = useState(false)
  const [dateLimite, setDateLimite] = useState('')
  const [nombreTranches, setNombreTranches] = useState('3')
  const [drafts, setDrafts] = useState<TrancheDraft[]>([])
  const [premiereEcheance, setPremiereEcheance] = useState('')
```

**3b. Ouverture du formulaire** — la fonction d'ouverture (actuellement `onClick={() => setCreation(true)}`) devient :

```tsx
  function ouvrirCreation() {
    setMontantTotal('')
    setMontantAcompte(groupe ? String(proposerAcompte(0, groupe.type_voyage)) : '')
    setAcompteTouche(false)
    setDateLimite(groupe ? proposerDateLimite(groupe.date_depart, groupe.type_voyage) : '')
    setNombreTranches('3')
    setPremiereEcheance('')
    setDrafts([])
    setErreur('')
    setCreation(true)
  }
```

**3c. Réactions aux changements** — ajouter après l'état (dans le composant, avant `creerPlan`) :

```tsx
  function changerMontantTotal(valeur: string) {
    setMontantTotal(valeur)
    if (groupe && !acompteTouche) {
      const total = parseInt(valeur, 10)
      setMontantAcompte(total > 0 ? String(proposerAcompte(total, groupe.type_voyage)) : '')
    }
  }

  function changerNombreTranches(valeur: string) {
    setNombreTranches(valeur)
    const total = parseInt(montantTotal, 10)
    const acompte = parseInt(montantAcompte, 10)
    const nombre = parseInt(valeur, 10)
    if (total > 0 && nombre > 0 && dateLimite) {
      setDrafts(genererEcheancier(total, acompte || 0, nombre, premiereEcheance || dateLimite, dateLimite))
    }
  }
```

Note : `genererEcheancier` exige `debut` et `dateLimite` — si `premiereEcheance` est vide, utiliser `dateLimite` comme début (le panneau le précise) ; le formulaire demande « Première échéance » (champ existant conservé).

**3d. Mutation `creerPlan`** — remplacer par :

```tsx
  const creerPlan = useMutation({
    mutationFn: async () => {
      const total = parseInt(montantTotal, 10)
      const acompte = parseInt(montantAcompte, 10) || 0
      const nombre = parseInt(nombreTranches, 10)
      if (!total || total <= 0 || !nombre || nombre <= 0) throw new Error('Champs invalides')
      if (!dateLimite) throw new Error('Champs invalides')
      const erreur = validerEcheancier(total, acompte, drafts, dateLimite)
      if (erreur) throw new Error('Echeancier invalide')
      const { data: nouveauPlan, error: e1 } = await supabase
        .from('plans_paiement')
        .insert({
          agence_id: agence!.id,
          pelerin_id: pelerinId,
          montant_total: total,
          montant_acompte: acompte,
          date_limite_solde: dateLimite,
          nombre_tranches: nombre,
        })
        .select('id')
        .single()
      if (e1 || !nouveauPlan) throw e1
      const tranches = drafts.map((d, i) => ({
        agence_id: agence!.id,
        plan_paiement_id: nouveauPlan.id,
        numero_tranche: i + 1,
        montant_prevu: d.montant_prevu,
        date_echeance: d.date_echeance,
      }))
      const { error: e2 } = await supabase.from('tranches').insert(tranches)
      if (e2) throw e2
    },
    onSuccess: () => {
      setCreation(false)
      setMontantTotal('')
      setMontantAcompte('')
      setDateLimite('')
      setPremiereEcheance('')
      setDrafts([])
      queryClient.invalidateQueries({ queryKey: ['plan', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['echeanciers'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: (e: Error) => {
      if (e.message === 'Champs invalides') setErreur('Renseignez le montant total, l’acompte, la date limite et le nombre de tranches.')
      else if (e.message === 'Echeancier invalide') setErreur(validerEcheancier(parseInt(montantTotal, 10), parseInt(montantAcompte, 10) || 0, drafts, dateLimite) ?? '')
      else setErreur('Impossible de créer le plan.')
    },
  })
```

**3e. Formulaire de création** — remplacer le `<form>` du bloc `creation` (lignes 118-136 actuelles) par :

```tsx
          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); setErreur(''); creerPlan.mutate() }}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <Field label="Montant total (FCFA)">
              <Input required type="number" min={1} value={montantTotal} onChange={(e) => changerMontantTotal(e.target.value)} />
            </Field>
            <Field label="Acompte (FCFA)">
              <Input required type="number" min={0} value={montantAcompte} onChange={(e) => { setAcompteTouche(true); setMontantAcompte(e.target.value) }} />
            </Field>
            <Field label="Date limite du solde">
              <Input required type="date" value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} />
            </Field>
            <Field label="Nombre de tranches">
              <Input required type="number" min={1} value={nombreTranches} onChange={(e) => changerNombreTranches(e.target.value)} />
            </Field>
            <Field label="Première échéance">
              <Input required type="date" value={premiereEcheance} onChange={(e) => { setPremiereEcheance(e.target.value); changerNombreTranches(nombreTranches) }} />
            </Field>
            {drafts.length > 0 && (
              <div className="md:col-span-3">
                <table className="w-full text-body-md">
                  <thead>
                    <tr className="bg-[#f1f5f9] text-left text-label-md uppercase tracking-wider text-on-surface-variant">
                      <th className="px-4 py-2">Tranche</th>
                      <th className="px-4 py-2">Montant (FCFA)</th>
                      <th className="px-4 py-2">Échéance</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((d, i) => (
                      <tr key={d.numero_tranche} className="border-t border-outline-variant">
                        <td className="px-4 py-2">Tranche {d.numero_tranche}</td>
                        <td className="px-4 py-2">
                          <Input aria-label="Montant de la tranche" type="number" min={1} value={d.montant_prevu} onChange={(e) => setDrafts((prev) => prev.map((x, j) => (j === i ? { ...x, montant_prevu: parseInt(e.target.value, 10) || 0 } : x)))} />
                        </td>
                        <td className="px-4 py-2">
                          <Input aria-label="Échéance de la tranche" type="date" value={d.date_echeance} onChange={(e) => setDrafts((prev) => prev.map((x, j) => (j === i ? { ...x, date_echeance: e.target.value } : x)))} />
                        </td>
                        <td className="px-4 py-2">
                          <Button type="button" variant="secondary" onClick={() => setDrafts((prev) => prev.filter((_, j) => j !== i))}>Retirer</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-label-md text-on-surface-variant">
                  Reste à répartir : {formatFCFA((parseInt(montantTotal, 10) || 0) - (parseInt(montantAcompte, 10) || 0) - drafts.reduce((s, d) => s + d.montant_prevu, 0))}
                </p>
              </div>
            )}
            {erreur && <p className="text-sm text-error md:col-span-3">{erreur}</p>}
            <div className="flex gap-3 md:col-span-3">
              <Button type="submit" disabled={creerPlan.isPending}>Créer le plan</Button>
              <Button type="button" variant="secondary" onClick={() => setCreation(false)}>Annuler</Button>
            </div>
          </form>
```

**3f. `PelerinDetail.tsx`** — requête groupe étendue + prop :

```tsx
type PelerinAvecGroupe = Pelerin & { groupe: { nom: string; type_voyage: 'hajj' | 'omra'; date_depart: string } | null }
```

```tsx
      const { data } = await supabase.from('pelerins').select('*, groupe:groupes(nom, type_voyage, date_depart)').eq('id', id!).single()
```

```tsx
          <PlanPaiementSection pelerinId={pelerin.id} groupe={pelerin.groupe} />
```

- [ ] **Step 4: Exécuter les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/components/paiements/PlanPaiementSection.test.tsx`
Expected: 10 tests PASS (5 existants + 5 nouveaux).

- [ ] **Step 5: Vérifications complètes**

Run: `npx vitest run` (toute la suite — les autres composants n'utilisent pas les nouveaux champs), `npm run lint`, `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add src/components/paiements/PlanPaiementSection.tsx src/pages/PelerinDetail.tsx src/components/paiements/PlanPaiementSection.test.tsx
git commit -m "feat: création de plan avec acompte, date limite et échéancier éditable"
```

---

### Task 4: `PlanPaiementSection` — encaissement d'acompte, badges statut, payé incluant les acomptes

**Files:**
- Modify: `src/components/paiements/PlanPaiementSection.tsx`
- Modify: `src/components/paiements/PlanPaiementSection.test.tsx`

**Interfaces:**
- Consumes: Task 1 (types, `LIBELLES_STATUT_PLAN`/`TONE_STATUT_PLAN`, `formatDate`/`formatFCFA`), Task 2 (colonnes DB), Task 3 (états/mutation existants).
- Produces: query plan avec embed `acomptes:paiements!plan_paiement_id(*)` ; payé incluant les acomptes ; bouton « Encaisser l'acompte » ; panneau d'encaissement type `acompte`/`tranche` ; badge statut plan ; « Solde à régler avant le … ».

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `PlanPaiementSection.test.tsx`, mettre à jour les fixtures existantes (`planSolde`/`planNonSolde`) avec les nouveaux champs (sinon les tests existants cassent — `statut` manquant sur le badge) :

```tsx
  montant_acompte: 400000,
  date_limite_solde: '2026-03-16',
  statut: 'en_cours',
  acomptes: [],
```

(pour `planSolde` : `statut: 'solde'`, `montant_acompte: 400000`, `date_limite_solde: '2026-03-16'`, `acomptes: [{ id: 'ac1', tranche_id: null, plan_paiement_id: 'plan1', montant_paye: 400000, date_paiement: '2026-01-15T10:00:00Z', mode: 'especes', reference: null, type_paiement: 'acompte', agence_id: 'ag1' }]`).

Ajouter dans le `describe` :

```tsx
  it('affiche le badge statut du plan et la date limite du solde', async () => {
    rendre({ ...planNonSolde, statut: 'en_retard', date_limite_solde: '2026-01-01' })
    expect(await screen.findByText('En retard')).toBeInTheDocument()
    expect(screen.getByText('Solde à régler avant le 01/01/2026')).toBeInTheDocument()
  })

  it('affiche le badge « Acompte en attente » quand l’acompte n’est pas payé', async () => {
    rendre({ ...planNonSolde, montant_acompte: 400000 })
    expect(await screen.findByText('Acompte en attente')).toBeInTheDocument()
  })

  it('encaissement de l’acompte : payload avec type_paiement acompte et tranche_id null', async () => {
    rendre({ ...planNonSolde, montant_acompte: 400000 })
    fireEvent.click(await screen.findByRole('button', { name: 'Encaisser l’acompte' }))
    const champ = await screen.findByLabelText('Montant (FCFA)')
    expect(champ).toHaveAttribute('max', '400000')
    fireEvent.change(champ, { target: { value: '400000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Encaisser' }))
    await waitFor(() => {
      expect(insertPaiement).toHaveBeenCalled()
    })
    const [ligne] = insertPaiement.mock.calls[0]
    expect(ligne).toMatchObject({
      agence_id: 'ag1',
      tranche_id: null,
      plan_paiement_id: 'plan1',
      montant_paye: 400000,
      type_paiement: 'acompte',
    })
  })

  it('le payé inclut l’acompte : plan soldé avec acompte + tranches payées', async () => {
    rendre({
      ...planNonSolde,
      statut: 'solde',
      montant_acompte: 400000,
      acomptes: [{ id: 'ac1', tranche_id: null, plan_paiement_id: 'plan1', montant_paye: 400000, date_paiement: '2026-01-15T10:00:00Z', mode: 'especes', reference: null, type_paiement: 'acompte', agence_id: 'ag1' }],
    })
    expect(await screen.findByText('Plan soldé')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encaisser' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encaisser l’acompte' })).not.toBeInTheDocument()
  })

  it('plafonne l’encaissement de tranche au reste du plan incluant l’acompte', async () => {
    rendre({ ...planNonSolde, montant_acompte: 400000 })
    fireEvent.click((await screen.findAllByRole('button', { name: 'Encaisser' }))[0])
    const champ = await screen.findByLabelText('Montant (FCFA)')
    expect(champ).toHaveAttribute('max', '100000')
  })
```

Note pour le dernier test : fixture `planNonSolde` (tranche 1 payée 500 000, tranche 2 à 0) avec acompte 400 000 → payé total = 500 000 + 0 (acompte non payé) → reste plan = 1 000 000 − 500 000 = 500 000 ; plafond tranche 2 = min(500 000, 500 000) = 500 000. Le test ci-dessus avec `max=100000` suppose une fixture différente — **ajuster les valeurs à la fixture réelle** : soit fixture acompte 400 000 + tranche 1 payée 500 000 → reste plan 500 000, max = 500 000. Utiliser `'500000'` comme attente (et compléter le titre du test en conséquence). Si l'on veut tester le cas où l'acompte réduit le plafond, fixture acompte 600 000 (reste plan = 400 000) → max = min(500 000, 400 000) = 400 000.

- [ ] **Step 2: Exécuter les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/components/paiements/PlanPaiementSection.test.tsx`
Expected: les nouveaux tests échouent (« Encaisser l’acompte », « Acompte en attente », « Solde à régler avant le … » introuvables ; `max` incorrect).

- [ ] **Step 3: Implémenter**

**3a. Query plan** — ajouter l'embed acomptes :

```tsx
        .select('*, tranches(*, paiements(*)), acomptes:paiements!plan_paiement_id(*)')
```

**3b. Interface locale** :

```tsx
interface PlanAvecDonnees extends PlanPaiement {
  tranches: (Tranche & { paiements: Paiement[] })[]
  acomptes: Paiement[]
}
```

**3c. Calculs (remplacer le bloc `const paye = ...` lignes 147-149)** :

```tsx
  const payeTranches = plan.tranches.reduce((s, t) => s + t.paiements.reduce((x, p) => x + p.montant_paye, 0), 0)
  const payeAcompte = plan.acomptes.reduce((s, p) => s + p.montant_paye, 0)
  const paye = payeTranches + payeAcompte
  const reste = plan.montant_total - paye
  const resteAcompte = Math.max(plan.montant_acompte - payeAcompte, 0)
  const progression = plan.montant_total > 0 ? Math.round((paye / plan.montant_total) * 100) : 0
```

**3d. État d'encaissement typé** — remplacer `encaissement` state :

```tsx
  const [encaissement, setEncaissement] = useState<{ type: 'acompte' | 'tranche'; tranche: (Tranche & { paiements: Paiement[] }) | null; ouvert: boolean }>({ type: 'tranche', tranche: null!, ouvert: false })
```

`ouvrirEncaissement(tranche)` → `setEncaissement({ type: 'tranche', tranche, ouvert: true })` ; nouvelle `ouvrirAcompte()` → `setEncaissement({ type: 'acompte', tranche: null, ouvert: true })`.

**3e. Mutation `encaisser`** — remplacer `mutationFn` et `onError` (plafond par type) :

```tsx
  const encaisser = useMutation({
    mutationFn: async () => {
      const montant = parseInt(montantPaiement, 10)
      if (!montant || montant <= 0) throw new Error('Montant invalide')
      const plafond = encaissement.type === 'acompte'
        ? Math.min(resteAcompte, reste)
        : Math.min(
            encaissement.tranche.montant_prevu - encaissement.tranche.paiements.reduce((s, p) => s + p.montant_paye, 0),
            reste
          )
      if (montant > plafond) throw new Error('Montant depasse')
      const { data: profil } = await supabase.auth.getUser()
      const { data: utilisateur } = await supabase
        .from('utilisateurs')
        .select('id')
        .eq('user_id', profil.user!.id)
        .maybeSingle()
      const { error } = await supabase.from('paiements').insert(
        encaissement.type === 'acompte'
          ? {
              agence_id: agence!.id,
              tranche_id: null,
              plan_paiement_id: plan.id,
              montant_paye: montant,
              type_paiement: 'acompte',
              mode: modePaiement,
              reference: reference || null,
              enregistre_par: utilisateur?.id ?? null,
            }
          : {
              agence_id: agence!.id,
              tranche_id: encaissement.tranche.id,
              montant_paye: montant,
              type_paiement: 'tranche',
              mode: modePaiement,
              reference: reference || null,
              enregistre_par: utilisateur?.id ?? null,
            }
      )
      if (error) throw error
    },
    onSuccess: () => {
      setEncaissement({ type: 'tranche', tranche: null!, ouvert: false })
      setMontantPaiement('')
      setReference('')
      queryClient.invalidateQueries({ queryKey: ['plan', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['echeanciers'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: (e: Error) => {
      if (e.message === 'Montant invalide') setErreur('Saisissez un montant positif.')
      else if (e.message === 'Montant depasse') setErreur('Le montant dépasse le reste dû.')
      else if (e.message.includes('soldé')) setErreur('Encaissement impossible. Le plan de paiement est soldé ou le montant dépasse le reste dû.')
      else setErreur('Encaissement impossible.')
    },
  })
```

**3f. Plafond affiché et champ** — remplacer `plafondEncaissement` (déclaré après `ouvrirEncaissement`) :

```tsx
  const plafondEncaissement = encaissement.ouvert
    ? encaissement.type === 'acompte'
      ? Math.min(resteAcompte, reste)
      : Math.min(
          encaissement.tranche.montant_prevu - encaissement.tranche.paiements.reduce((s, p) => s + p.montant_paye, 0),
          reste
        )
    : 0
```

Titre du panneau :

```tsx
          <p className="mb-3 text-body-md font-semibold text-primary">
            {encaissement.type === 'acompte'
              ? `Encaissement — acompte (reste ${formatFCFA(plafondEncaissement)})`
              : `Encaissement — tranche ${encaissement.tranche.numero_tranche} (reste ${formatFCFA(plafondEncaissement)})`}
          </p>
```

**3g. En-tête du plan** — badge statut + acompte + date limite. Dans le `<div className="mb-6 flex flex-wrap items-center gap-6 text-body-md">` (ligne 164-171), remplacer par :

```tsx
      <div className="mb-6 flex flex-wrap items-center gap-6 text-body-md">
        <p className="text-on-surface-variant">Total : <span className="font-semibold text-on-surface">{formatFCFA(plan.montant_total)}</span></p>
        <p className="text-on-surface-variant">Payé : <span className="font-semibold text-vert">{formatFCFA(paye)}</span></p>
        <p className="text-on-surface-variant">Reste dû : <span className={`font-semibold ${reste > 0 ? 'text-error' : 'text-vert'}`}>{formatFCFA(reste)}</span></p>
        {plan.montant_acompte > 0 && (
          <p className="text-on-surface-variant">Acompte : <span className={`font-semibold ${resteAcompte > 0 ? 'text-error' : 'text-vert'}`}>{formatFCFA(payeAcompte)} / {formatFCFA(plan.montant_acompte)}</span></p>
        )}
        {plan.date_limite_solde && (
          <p className="text-on-surface-variant">Solde à régler avant le <span className="font-semibold text-on-surface">{formatDate(plan.date_limite_solde)}</span></p>
        )}
        <Badge tone={TONE_STATUT_PLAN[plan.statut]}>{LIBELLES_STATUT_PLAN[plan.statut]}</Badge>
        <div className="w-48">
          <ProgressBar valeur={progression} tone={progression === 100 ? 'vert' : 'gold'} label={`${progression}%`} />
        </div>
      </div>
```

**3h. Boutons par tranche et bouton acompte** — dans la liste des tranches (ligne ~196), condition actuelle `verse < t.montant_prevu && reste > 0` conservée ; et dans le `<div className="flex items-center gap-2">` du bloc des tranches, laisser tel quel ; AJOUTER au-dessus de la liste `<ol>` un bouton acompte (dans le bloc `<div className="mb-6 ...">` ou à la fin de l'en-tête) :

```tsx
        {resteAcompte > 0 && (
          <Button variant="secondary" onClick={ouvrirAcompte}>
            <Icon name="payments" size={16} className="mr-1" />
            Encaisser l’acompte
          </Button>
        )}
```

(avec `import { LIBELLES_STATUT_PLAN, TONE_STATUT_PLAN, ... }` ajoutés à l'import de `../../lib/format`).

- [ ] **Step 4: Exécuter les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/components/paiements/PlanPaiementSection.test.tsx`
Expected: tous PASS (10 existants + 5 nouveaux = 15).

- [ ] **Step 5: Vérifications complètes**

Run: `npx vitest run` (toute la suite), `npm run lint`, `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add src/components/paiements/PlanPaiementSection.tsx src/components/paiements/PlanPaiementSection.test.tsx
git commit -m "feat: encaissement d'acompte, badge statut plan, payé incluant les acomptes"
```

---

### Task 5: `Paiements.tsx` — statut plan, encart « solde à régler », acomptes dans les totaux

**Files:**
- Modify: `src/pages/Paiements.tsx`
- Create: `src/pages/Paiements.test.tsx`

**Interfaces:**
- Consumes: Task 1 — `LIBELLES_STATUT_PLAN`/`TONE_STATUT_PLAN`, types étendus (`Paiement.type_paiement`, `PlanPaiement.statut`).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/pages/Paiements.test.tsx` (conventions : mock `vi.hoisted` de `../lib/supabase`, `QueryClientProvider` + `MemoryRouter` car la page utilise `Link` et `useNavigate`) :

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import Paiements from './Paiements'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: mockSupabase }))

const planAvecAcompte = {
  id: 'plan1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  montant_total: 1000000,
  montant_acompte: 400000,
  date_limite_solde: '2026-01-01',
  statut: 'en_retard',
  nombre_tranches: 2,
  created_at: '2026-01-01T00:00:00Z',
  pelerin: { id: 'pel1', prenom: 'Fatou', nom: 'Sy', telephone: '771234567' },
  tranches: [
    { id: 't1', plan_paiement_id: 'plan1', numero_tranche: 1, montant_prevu: 300000, date_echeance: '2026-02-01', statut: 'payee', paiements: [{ id: 'p1', tranche_id: 't1', montant_paye: 300000, date_paiement: '2026-01-15T10:00:00Z', mode: 'especes', reference: null, type_paiement: 'tranche', plan_paiement_id: 'plan1', agence_id: 'ag1' }] },
    { id: 't2', plan_paiement_id: 'plan1', numero_tranche: 2, montant_prevu: 300000, date_echeance: '2026-03-01', statut: 'a_venir', paiements: [] },
  ],
  acomptes: [{ id: 'ac1', tranche_id: null, plan_paiement_id: 'plan1', montant_paye: 200000, date_paiement: '2026-01-10T10:00:00Z', mode: 'especes', reference: null, type_paiement: 'acompte', agence_id: 'ag1' }],
}

const planSansAcompte = {
  id: 'plan2',
  agence_id: 'ag1',
  pelerin_id: 'pel2',
  montant_total: 500000,
  montant_acompte: 0,
  date_limite_solde: null,
  statut: 'en_cours',
  nombre_tranches: 1,
  created_at: '2026-01-01T00:00:00Z',
  pelerin: { id: 'pel2', prenom: 'Awa', nom: 'Ndiaye', telephone: '770000000' },
  tranches: [
    { id: 't3', plan_paiement_id: 'plan2', numero_tranche: 1, montant_prevu: 500000, date_echeance: '2026-04-01', statut: 'a_venir', paiements: [] },
  ],
  acomptes: [],
}

function rendre() {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'plans_paiement') {
      return {
        select: () => ({ order: () => Promise.resolve({ data: [planAvecAcompte, planSansAcompte], error: null }) }),
      }
    }
    return { select: () => Promise.resolve({ data: [], error: null }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Paiements />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Paiements', () => {
  it('affiche le badge statut du plan et l’encart « solde à régler »', async () => {
    rendre()
    expect(await screen.findByText('En retard')).toBeInTheDocument()
    expect(screen.getByText('1 plan(s) à solde à régler')).toBeInTheDocument()
  })

  it('les totaux incluent les acomptes', async () => {
    rendre()
    expect(await screen.findByText('1 500 000 FCFA')).toBeInTheDocument()
    expect(screen.getByText('500 000 FCFA')).toBeInTheDocument()
    expect(screen.getByText('1 000 000 FCFA')).toBeInTheDocument()
  })
})
```

Note : libellés et attentes à ajuster au rendu réel (format des montants, texte de l'encart — voir Step 3).

- [ ] **Step 2: Exécuter le test pour vérifier qu'il échoue**

Run: `npx vitest run src/pages/Paiements.test.tsx`
Expected: FAIL (« En retard »/encart/totaux introuvables).

- [ ] **Step 3: Implémenter**

**3a. Type et query** — dans `Paiements.tsx` :

```tsx
interface PlanEcheancier extends PlanPaiement {
  pelerin: { id: string; prenom: string; nom: string; telephone: string }
  tranches: (Tranche & { paiements: Paiement[] })[]
  acomptes: Paiement[]
}
```

```tsx
        .select('*, pelerin:pelerins(id, prenom, nom, telephone), tranches(*, paiements(*)), acomptes:paiements!plan_paiement_id(*)')
```

**3b. Totaux incluant les acomptes** — remplacer le calcul `paye` (ligne 44) :

```tsx
      const paye = p.tranches.reduce((s, t) => s + t.paiements.reduce((x, y) => x + y.montant_paye, 0), 0)
        + p.acomptes.reduce((s, a) => s + a.montant_paye, 0)
```

et dans le corps de `plans.map` (ligne 97) :

```tsx
                const paye = p.tranches.reduce((s, t) => s + t.paiements.reduce((x, y) => x + y.montant_paye, 0), 0)
                  + p.acomptes.reduce((s, a) => s + a.montant_paye, 0)
```

**3c. Encart « solde à régler »** — après l'encart `enRetard` (ligne 69-80), ajouter :

```tsx
      {plans.some((p) => p.statut === 'en_retard') && (
        <div className="rounded-r-lg border-l-4 border-error bg-error-container/20 p-4">
          <p className="text-headline-sm text-error">{plans.filter((p) => p.statut === 'en_retard').length} plan(s) à solde à régler</p>
          <ul className="text-body-md mt-1 text-on-surface-variant">
            {plans.filter((p) => p.statut === 'en_retard').map((p) => (
              <li key={p.id}>
                {p.pelerin.prenom} {p.pelerin.nom} — reste {formatFCFA(p.montant_total - (p.tranches.reduce((s, t) => s + t.paiements.reduce((x, y) => x + y.montant_paye, 0), 0) + p.acomptes.reduce((s, a) => s + a.montant_paye, 0)))}, limite le {formatDate(p.date_limite_solde)}.
              </li>
            ))}
          </ul>
        </div>
      )}
```

**3d. Badge statut dans la table** — dans la dernière cellule de la ligne (ligne 120-122), avant `retard` :

```tsx
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Badge tone={TONE_STATUT_PLAN[p.statut]}>{LIBELLES_STATUT_PLAN[p.statut]}</Badge>
                        {retard > 0 && <Badge tone="rouge">{retard} en retard</Badge>}
                      </div>
                    </td>
```

Imports : ajouter `LIBELLES_STATUT_PLAN`, `TONE_STATUT_PLAN` à l'import de `../lib/format` (ligne 4).

- [ ] **Step 4: Exécuter le test pour vérifier qu'il passe**

Run: `npx vitest run src/pages/Paiements.test.tsx`
Expected: PASS (ajuster les libellés/attentes du test au rendu réel — l'encart est défini dans l'implémentation 3c).

- [ ] **Step 5: Vérifications complètes**

Run: `npx vitest run` (toute la suite), `npm run lint`, `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Paiements.tsx src/pages/Paiements.test.tsx
git commit -m "feat: statut plan, encart solde à régler et acomptes dans les paiements"
```

---

### Task 6: `SuperAdminGlobal` — acomptes inclus dans les encaissements

**Files:**
- Modify: `src/pages/SuperAdminGlobal.tsx` (query + agrégation)
- Modify: `src/pages/SuperAdminGlobal.test.tsx`

**Interfaces:**
- Consumes: Task 1 (types étendus), Task 2 (colonne `plan_paiement_id` en base).

- [ ] **Step 1: Écrire le test qui échoue**

Dans `src/pages/SuperAdminGlobal.test.tsx` (lire le fichier : 3 tests existants avec fixtures `paiements`), ajouter un acompte à la fixture et un test :

```tsx
const paiements = [
  { montant_paye: 400000, tranche: { plan_paiement: { pelerin: { agence_id: 'a1' } } } },
  { montant_paye: 100000, tranche: { plan_paiement: { pelerin: { agence_id: 'a1' } } } },
  { montant_paye: 50000, tranche: { plan_paiement: { pelerin: { agence_id: 'a2' } } } },
  { montant_paye: 300000, tranche: null, acompte: { pelerin: { agence_id: 'a1' } } },
]
```

(remplacer la fixture existante par celle-ci)

```tsx
  it('compte les acomptes dans les encaissements par agence', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SuperAdminGlobal />
        </MemoryRouter>
      </QueryClientProvider>
    )
    await screen.findByText('Vue d’ensemble')
    expect(screen.getByText('850 000')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Exécuter le test pour vérifier qu'il échoue**

Run: `npx vitest run src/pages/SuperAdminGlobal.test.tsx`
Expected: FAIL — le total affiché reste 550 000 (l'acompte ignoré).

- [ ] **Step 3: Implémenter**

Dans `src/pages/SuperAdminGlobal.tsx` :

**3a. Query** — remplacer la ligne 35 :

```tsx
        .select('montant_paye, tranche:tranches(plan_paiement:plans_paiement(pelerin:pelerins(agence_id))), acompte:plans_paiement!plan_paiement_id(pelerin:pelerins(agence_id))')
```

**3b. Agrégation** — remplacer la boucle (lignes 42-47) :

```tsx
  for (const p of paiements) {
    const agenceId = p.tranche?.plan_paiement?.pelerin?.agence_id ?? p.acompte?.pelerin?.agence_id
    if (!agenceId) continue
    encaissesParAgence.set(agenceId, (encaissesParAgence.get(agenceId) ?? 0) + p.montant_paye)
  }
```

**3c. Type** — adapter le type local (dans le fichier, la définition de `PaiementAgence` — la lire d'abord) :

```ts
interface PaiementAgence {
  montant_paye: number
  tranche: { plan_paiement: { pelerin: { agence_id: string } } } | null
  acompte: { pelerin: { agence_id: string } } | null
}
```

- [ ] **Step 4: Exécuter le test pour vérifier qu'il passe**

Run: `npx vitest run src/pages/SuperAdminGlobal.test.tsx`
Expected: 4 tests PASS.

- [ ] **Step 5: Vérifications complètes**

Run: `npx vitest run` (toute la suite), `npm run lint`, `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/SuperAdminGlobal.tsx src/pages/SuperAdminGlobal.test.tsx
git commit -m "feat: acomptes inclus dans les encaissements (SuperAdmin)"
```