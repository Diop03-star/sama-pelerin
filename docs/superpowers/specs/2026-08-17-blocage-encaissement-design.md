# Design — Bloquer l'encaissement d'un pèlerin à jour de paiement

Date : 2026-08-17

## Objectif

Empêcher d'encaisser un paiement pour un pèlerin dont le plan de paiement est **soldé** (total payé ≥ montant total), même si les échéances ne sont pas toutes passées — et empêcher tout montant qui **dépasserait le reste dû** du plan. La protection est double : interface (formulaire) et base de données (trigger SQL).

## Approche retenue

Un trigger `BEFORE INSERT` sur `paiements` (pattern du trigger existant `recalculer_statut_tranche`, déjà branché sur cette table) qui refuse toute écriture faisant dépasser `montant_total` du plan — un seul trigger couvre les deux cas (plan soldé et montant excédentaire). Côté UI, le formulaire de `PlanPaiementSection` est plafonné au reste dû et le bouton « Encaisser » disparaît quand le plan est soldé. Les policies RLS ne conviennent pas (impossibilité d'interroger d'autres tables) ; une RPC serait plus invasive (changement des appels, permissions).

## Conception

### 1. Base de données — `supabase/schema.sql`

Fonction `security definer` (pattern `is_superadmin()`) + `set search_path = public` :

```sql
create or replace function public.bloquer_encaissement_excedent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_plan_total numeric;
  v_paye numeric;
begin
  select t.plan_paiement_id, p.montant_total
    into v_plan_id, v_plan_total
    from public.tranches t
    join public.plans_paiement p on p.id = t.plan_paiement_id
   where t.id = new.tranche_id;
  if v_plan_id is null then
    raise exception 'Tranche inconnue.';
  end if;
  select coalesce(sum(pay.montant_paye), 0)
    into v_paye
    from public.paiements pay
    join public.tranches t2 on t2.id = pay.tranche_id
   where t2.plan_paiement_id = v_plan_id;
  if v_paye + new.montant_paye > v_plan_total then
    raise exception 'Encaissement refusé : le plan de paiement est soldé ou le montant dépasse le reste dû.';
  end if;
  return new;
end;
$$;

create trigger bloquer_encaissement_excedent
before insert on public.paiements
for each row execute function public.bloquer_encaissement_excedent();
```

- Inséré dans `supabase/schema.sql` à côté du trigger existant (`recalculer_statut_tranche`, ~ligne 216).
- **UPDATE/DELETE non concernés** : aucun flux d'édition/suppression de paiement dans l'app.
- Base live : requête fournie à l'utilisateur pour le SQL editor Supabase (mêmes étapes que les migrations précédentes).

### 2. Fiche pèlerin — `src/components/paiements/PlanPaiementSection.tsx`

- **En-tête du plan** : quand `reste <= 0`, afficher un badge vert « Plan soldé » à côté de « Reste dû : 0 FCFA ».
- **Bouton « Encaisser »** (par tranche) : masqué quand `verse >= t.montant_prevu` **ou** quand `reste <= 0` (condition actuelle étendue).
- **Formulaire d'encaissement** :
  - Titre du panneau : « reste : X FCFA » avec **X = min(reste de tranche, reste du plan)** — c'est le plafond saisissable.
  - Champ « Montant » : `max={plafond}` ; la mutation refuse si `montant > plafond` → message « Le montant dépasse le reste dû. » (garde cliente avant l'insert, même règle que le serveur).
  - Bouton « Encaisser » : désactivé si `montant <= 0 || montant > plafond`.
  - Erreur serveur : message actuel « Encaissement impossible. » enrichi du motif si l'erreur Supabase contient « soldé » (message du trigger).

### 3. Tests

Nouveau `src/components/paiements/PlanPaiementSection.test.tsx` (aucun test existant pour ce composant ; conventions : mock `vi.hoisted` de `../../lib/supabase`, mock de `../../hooks/useAgence`, `QueryClientProvider`) :

1. Plan soldé (payé = montant_total) → badge « Plan soldé » affiché, bouton « Encaisser » absent.
2. Plan non soldé → bouton « Encaisser » présent.
3. Formulaire ouvert : montant > plafond → bouton Encaisser désactivé, et à la soumission message « Le montant dépasse le reste dû. » sans insert.
4. Montant valide → insert `paiements` avec les bonnes valeurs (tranche_id, montant_paye, mode, reference).
5. Erreur serveur contenant « soldé » → message explicite affiché.

Le trigger n'a pas de tests automatisés (pas de framework SQL dans le projet) : vérifié par application live + cas manuel (encaisser après solde complet → refus).

Vérifications : `npm test`, `npm run lint`, `npm run build`.

## Fichiers touchés

| Fichier | Action |
|---|---|
| `supabase/schema.sql` | + fonction + trigger |
| `src/components/paiements/PlanPaiementSection.tsx` | badge soldé, bouton masqué, plafond montant, erreurs |
| `src/components/paiements/PlanPaiementSection.test.tsx` | nouveau |

Base live : requête SQL fournie à l'utilisateur (SQL editor Supabase).