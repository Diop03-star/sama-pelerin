# Design — Refonte du modèle de paiement (acompte, date limite, échéancier, statut plan)

Date : 2026-08-17

## Objectif

Repenser le modèle de paiement pour refléter la réalité métier : acompte de réservation exigé dès l'inscription, versements intermédiaires sur un échéancier éditable, solde intégral à régler avant une date limite de rigueur liée au départ, règles différentes Omra/Hajj, et un statut de plan dérivé avec alertes. Les flux d'encaissement restent ceux d'aujourd'hui (formulaire unique, par tranche ou acompte). Blocage d'encaissement conservé (plan soldé / montant excédentaire) et étendu aux acomptes.

## Contexte actuel

- `groupes` porte `type_voyage` (`hajj`/`omra`) et `date_depart` — non utilisés par les paiements.
- `plans_paiement` : `montant_total`, `nombre_tranches` — pas d'acompte, pas de date limite.
- `tranches` : montants égaux générés par `genererTranches`, **toutes à la même échéance** (pas de calendrier réel).
- `paiements` : rattachés à `tranche_id` ; trigger `bloquer_encaissement_excedent` (refuse tout insert faisant dépasser `montant_total`), trigger `trg_maj_statut_tranche`.
- V2 (hors périmètre) : rééchelonnement après création, assistant d'inscription, autres types de paiement (supplément visa…), ergonomie avancée.

## Conception

### 1. Modèle de données

**`plans_paiement`** — 3 nouvelles colonnes :
- `montant_acompte numeric(12,0) not null default 0` — proposé à la création : **60 % du total pour Omra, 40 % pour Hajj** (milieu des fourchettes métier 50-70 % / 30-50 %), ajustable.
- `date_limite_solde date` — proposée automatiquement : `groupe.date_depart − 30 j` (Omra) ou `− 60 j` (Hajj) (extrémités hautes des fourchettes 15-30 j / 45-60 j), ajustable.
- `statut text not null default 'en_cours'` — calculé par trigger (section 2) : `acompte_en_attente` / `en_cours` / `en_retard` / `soldé`.

**`paiements`** — 2 nouvelles colonnes :
- `type_paiement text not null default 'tranche' check (type_paiement in ('acompte','tranche'))`
- `plan_paiement_id uuid nullable references plans_paiement(id) on delete cascade` — rempli pour les acomptes ; `tranche_id` reste requis pour les paiements de tranche, `null` pour l'acompte.

**`tranches`** : inchangées (montant + date par tranche, édités à la création uniquement).

### 2. Logique serveur (triggers, dans `supabase/schema.sql`)

**Nouveau : `trg_maj_statut_plan`** — sur `paiements` (insert/update/delete) et `plans_paiement` (insert). Recalcule `plans_paiement.statut` :
1. `montant_acompte > 0` et acompte payé < `montant_acompte` → `acompte_en_attente`
2. sinon payé total (acompte + tranches) ≥ `montant_total` → `soldé`
3. sinon `date_limite_solde` non null et < current_date → `en_retard`
4. sinon → `en_cours`

**Adaptation : `trg_maj_statut_tranche`** — si `new.type_paiement = 'acompte'` (ou old), retourner immédiatement (rien à recalculer sur une tranche).

**Adaptation : `bloquer_encaissement_excedent`** — la somme du payé inclut les acomptes du plan (via `plan_paiement_id`) + les paiements des tranches du plan (via join). Le blocage s'applique aussi aux acomptes (un acompte qui ferait dépasser le total → refus).

### 3. Génération de l'échéancier (`src/lib/plan.ts`)

Nouvelle fonction `genererEcheancier(montantTotal, montantAcompte, nombreTranches, debut, dateLimite)` :
- Montant à répartir = `montantTotal − montantAcompte`, base = quotient arrondi (Math.floor), dernière tranche absorbe le reste (logique actuelle).
- Dates mensuelles depuis `debut` (date d'inscription) jusqu'à `dateLimite` (dernière échéance ≤ date limite).
- Validation : somme des tranches + acompte = montant total ; échéances ≤ date limite ; acompte ≤ total ; nombre de tranches ≥ 1.

`genererTranches` est remplacé par cette fonction (plus d'usage de l'ancienne — tranches toutes à la même date).

### 4. Interface

**Création du plan** (formulaire actuel étendu) : montant total, acompte (pré-rempli 60 % Omra / 40 % Hajj, ajustable), date limite (pré-remplie depuis `groupe.date_depart` − 30 j / 60 j, ajustable), nombre de tranches → échéancier éditable (table : montant + date par ligne, ajout/suppression), contrôle de somme en temps réel (« Reste à répartir : 0 FCFA »), erreurs de validation affichées.

**Fiche pèlerin (`PlanPaiementSection`)** :
- En-tête : acompte (payé/restant), date limite (« Solde à régler avant le … »), badge de statut du plan (`soldé` / `en_retard` / `acompte en attente` / `en cours`).
- **Le « Payé » affiché et le reste du plan incluent l'acompte** : payé = somme des paiements de tranches + acomptes du plan (le calcul actuel `tranches.flatMap(paiements)` est étendu aux acomptes du plan). Le plafond d'encaissement par tranche (`min(reste tranche, reste plan)`) en tient compte automatiquement.
- Bouton « Encaisser l'acompte » tant qu'il reste dû : panneau type Acompte (montant plafonné au reste d'acompte dû, mode, référence) → insert `paiements` avec `type_paiement: 'acompte'`, `plan_paiement_id`, `tranche_id: null`.
- Bouton « Encaisser » par tranche : insert avec `type_paiement: 'tranche'` (plafond actuel `min(reste tranche, reste plan)` conservé).

**Page « Paiements & échéanciers » (`Paiements.tsx`)** :
- Badge de statut du plan dans la table des plans ; encart d'alerte « solde à régler » pour les plans `en_retard` (coexiste avec l'encart « tranches en retard » actuel).

**Dashboard / stats** : les acomptes comptent dans les encaissements. Les requêtes qui joignent `tranches` doivent inclure les paiements sans tranche (à adapter : dashboard `paiements`, RPC `stats_globales`, encaissements récents).

### 5. Tests & migration

**Tests Vitest** :
- `src/lib/plan.test.ts` — `genererEcheancier` : répartition (base + dernière ajustée), dates mensuelles bornées par la date limite, validation (somme, échéances), bord (1 tranche, acompte = total).
- `PlanPaiementSection.test.tsx` — création avec acompte + échéancier éditable ; encaissement de l'acompte (payload `type_paiement: 'acompte'`, `tranche_id: null`, plafond au reste d'acompte) ; badge statut plan.
- `Paiements.test.tsx` (nouveau) — badge statut plan + encart « solde à régler ».
- Triggers : pas de framework SQL — application live + cas manuels.

**Migration live** (SQL editor Supabase) :
- `alter table public.plans_paiement add column montant_acompte numeric(12,0) not null default 0, add column date_limite_solde date, add column statut text not null default 'en_cours';`
- `alter table public.paiements add column type_paiement text not null default 'tranche', add column plan_paiement_id uuid references public.plans_paiement(id) on delete cascade;`
- Fonctions/triggers : `trg_maj_statut_plan` (création), adaptation `trg_maj_statut_tranche` et `bloquer_encaissement_excedent`.
- Données existantes : `montant_acompte = 0` et `date_limite_solde = null` → statut calculé sans acompte exigé (`acompte_en_attente` seulement si `montant_acompte > 0`), pas de régression.

Vérifications finales : `npm test`, `npm run lint`, `npm run build`.

## Fichiers touchés

| Fichier | Action |
|---|---|
| `supabase/schema.sql` | colonnes plans_paiement/paiements, triggers (nouveau + 2 adaptations) |
| `src/lib/plan.ts` | `genererEcheancier` (remplace `genererTranches`) + tests |
| `src/components/paiements/PlanPaiementSection.tsx` | création étendue, encaissement acompte, badges statut + tests |
| `src/pages/Paiements.tsx` | badge statut plan, encart « solde à régler » + tests |
| Dashboard / `SuperAdminGlobal` / stats | inclusion des acomptes dans les encaissements |
| `src/lib/types.ts` | types `PlanPaiement` (montant_acompte, date_limite_solde, statut), `Paiement` (type_paiement, plan_paiement_id) |

Base live : requêtes SQL fournies à l'utilisateur (SQL editor Supabase).