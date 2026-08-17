# Blocage encaissement (pèlerin à jour) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher d'encaisser un paiement qui dépasserait le montant total du plan de paiement d'un pèlerin (plan soldé ou montant excédentaire), via un trigger SQL et un formulaire plafonné.

**Architecture:** Double protection. Base de données : trigger `BEFORE INSERT` sur `public.paiements` (fonction plpgsql `security definer`, pattern de `trg_maj_statut_tranche` déjà présent) qui refuse tout insert si `payé + montant > montant_total` du plan. Interface : `PlanPaiementSection.tsx` masque le bouton « Encaisser » et plafonne le montant saisissable à `min(reste de tranche, reste du plan)`, avec garde côté mutation et erreur serveur enrichie.

**Tech Stack:** SQL (PostgreSQL/plpgsql, Supabase), React 19, TypeScript, @tanstack/react-query, Vitest + Testing Library.

## Global Constraints

- UI et messages en français avec apostrophes typographiques (`’`), pas d'apostrophe droite (`'`) dans les libellés/tests.
- Aucun commentaire dans le code.
- Tests : mock `vi.hoisted` de `../../lib/supabase`, mock `vi.mock('../../hooks/useAgence', ...)` retournant `{ data: { id: 'ag1' } }`, wrapper `QueryClientProvider` (pas de `MemoryRouter` ici — pas de `Link` dans le composant).
- Vérifications finales : `npm test`, `npm run lint`, `npm run build` (build = `tsc -b && vite build`, les fichiers de test sont typecheckés).
- Le projet n'a pas de framework de tests SQL : le trigger est vérifié par application live (SQL editor Supabase), jamais par des tests automatisés.
- `supabase/schema.sql` est la source de vérité ; la base live est mise à jour par requête SQL manuelle fournie à l'utilisateur.

---

### Task 1: Trigger SQL de blocage (`supabase/schema.sql`)

**Files:**
- Modify: `supabase/schema.sql` (fonction après la ligne 208 — après la fin de `trg_maj_statut_dossier` ; trigger après la ligne 217 — après `trg_paiement_maj_tranche`)

**Interfaces:**
- Produces: fonction `public.bloquer_encaissement_excedent()` (trigger `bloquer_encaissement_excedent`), qui est la référence d'intégrité pour le plafond de Task 2. Aucun appel client — le message d'erreur remonte via PostgREST dans `error.message` de l'insert (`raise exception 'Encaissement refusé : le plan de paiement est soldé ou le montant dépasse le reste dû.'`).

- [ ] **Step 1: Ajouter la fonction**

Dans `supabase/schema.sql`, insérer ce bloc **après** la fonction `trg_maj_statut_dossier` (après la ligne 208, juste avant `-- ---------- TRIGGERS ----------`) :

```sql
-- Refuse un encaissement qui ferait dépasser le montant total du plan (plan soldé ou montant excédentaire)
create or replace function public.bloquer_encaissement_excedent()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan_id uuid; v_plan_total numeric; v_paye numeric;
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
end $$;
```

- [ ] **Step 2: Ajouter le trigger**

Dans `supabase/schema.sql`, après la ligne 217 (`create trigger trg_paiement_maj_tranche ... ;`), insérer :

```sql
create trigger bloquer_encaissement_excedent
  before insert on public.paiements
  for each row execute function public.bloquer_encaissement_excedent();
```

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: trigger bloquant l'encaissement au-delà du montant du plan"
```

- [ ] **Step 4: Fournir le SQL live à appliquer** (pas de code — à remettre à l'utilisateur en fin d'implémentation, à exécuter dans le SQL editor Supabase)

```sql
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
    join public.tranches t2 on t2.id = pay.tranche_id
    where t2.plan_paiement_id = v_plan_id;
  if v_paye + new.montant_paye > v_plan_total then
    raise exception 'Encaissement refusé : le plan de paiement est soldé ou le montant dépasse le reste dû.';
  end if;
  return new;
end $$;

create trigger bloquer_encaissement_excedent
  before insert on public.paiements
  for each row execute function public.bloquer_encaissement_excedent();
```

**Cas de test manuel (base live) :** sur un plan où `payé = montant_total`, tenter un insert dans `paiements` → l'erreur « Encaissement refusé : le plan de paiement est soldé ou le montant dépasse le reste dû. » doit être levée.

---

### Task 2: `PlanPaiementSection` — badge soldé, bouton masqué, plafond du montant

**Files:**
- Create: `src/components/paiements/PlanPaiementSection.test.tsx`
- Modify: `src/components/paiements/PlanPaiementSection.tsx` (lignes 147-149 calculs, 167 badge, 196 bouton, 220 titre, 227 champ, 242 bouton submit, 105 onError, 78-96 mutation)

**Interfaces:**
- Consumes: `useAgence()` mock `{ data: { id: 'ag1' } }`, `supabase.from('plans_paiement')`, `supabase.from('paiements')`, `supabase.auth.getUser()`, `supabase.from('utilisateurs')` — voir les mocks ci-dessous.
- Produces: comportement visible — badge « Plan soldé » quand `reste <= 0`, bouton « Encaisser » absent si tranche payée **ou** plan soldé, champ Montant avec `max={plafond}`, bouton submit désactivé si montant invalide, message « Le montant dépasse le reste dû. », erreur serveur « soldé » explicite.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/components/paiements/PlanPaiementSection.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PlanPaiementSection from './PlanPaiementSection'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn(), auth: { getUser: vi.fn() } }))

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }))
vi.mock('../../hooks/useAgence', () => ({
  useAgence: () => ({ data: { id: 'ag1' } }),
}))

const insertPaiement = vi.fn()

const planSolde = {
  id: 'plan1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  montant_total: 1000000,
  nombre_tranches: 2,
  created_at: '2026-01-01T00:00:00Z',
  tranches: [
    { id: 't1', plan_paiement_id: 'plan1', numero_tranche: 1, montant_prevu: 500000, date_echeance: '2026-02-01', statut: 'payee', paiements: [{ id: 'p1', tranche_id: 't1', montant_paye: 500000, mode: 'especes', reference: null, date_paiement: '2026-01-15T10:00:00Z' }] },
    { id: 't2', plan_paiement_id: 'plan1', numero_tranche: 2, montant_prevu: 500000, date_echeance: '2026-03-01', statut: 'payee', paiements: [{ id: 'p2', tranche_id: 't2', montant_paye: 500000, mode: 'especes', reference: null, date_paiement: '2026-02-15T10:00:00Z' }] },
  ],
}

const planNonSolde = {
  id: 'plan1',
  agence_id: 'ag1',
  pelerin_id: 'pel1',
  montant_total: 1000000,
  nombre_tranches: 2,
  created_at: '2026-01-01T00:00:00Z',
  tranches: [
    { id: 't1', plan_paiement_id: 'plan1', numero_tranche: 1, montant_prevu: 500000, date_echeance: '2026-02-01', statut: 'payee', paiements: [{ id: 'p1', tranche_id: 't1', montant_paye: 500000, mode: 'especes', reference: null, date_paiement: '2026-01-15T10:00:00Z' }] },
    { id: 't2', plan_paiement_id: 'plan1', numero_tranche: 2, montant_prevu: 500000, date_echeance: '2026-03-01', statut: 'a_venir', paiements: [] },
  ],
}

function rendre(plan: typeof planSolde) {
  const queryClient = new QueryClient()
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'plans_paiement') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: plan, error: null }) }) }) }
    }
    if (table === 'paiements') {
      return { insert: insertPaiement }
    }
    if (table === 'utilisateurs') {
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'u2' }, error: null }) }) }) }
    }
    return { select: () => Promise.resolve({ data: [], error: null }) }
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PlanPaiementSection pelerinId="pel1" />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  insertPaiement.mockReset()
  insertPaiement.mockResolvedValue({ error: null })
  mockSupabase.auth.getUser.mockReset()
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
})

describe('PlanPaiementSection', () => {
  it('affiche le badge « Plan soldé » et aucun bouton Encaisser quand le plan est soldé', async () => {
    rendre(planSolde)
    expect(await screen.findByText('Plan soldé')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encaisser' })).not.toBeInTheDocument()
  })

  it('affiche le bouton Encaisser sur la tranche non payée quand le plan n’est pas soldé', async () => {
    rendre(planNonSolde)
    expect(await screen.findByRole('button', { name: 'Encaisser' })).toBeInTheDocument()
  })

  it('désactive le bouton et refuse le montant qui dépasse le reste dû', async () => {
    rendre(planNonSolde)
    fireEvent.click(await screen.findByRole('button', { name: 'Encaisser' }))
    const champ = await screen.findByLabelText('Montant (FCFA)')
    expect(champ).toHaveAttribute('max', '500000')
    fireEvent.change(champ, { target: { value: '600000' } })
    expect(screen.getByRole('button', { name: 'Encaisser' })).toBeDisabled()
    expect(insertPaiement).not.toHaveBeenCalled()
  })

  it('encaissement valide : insère le paiement avec les bonnes valeurs', async () => {
    rendre(planNonSolde)
    fireEvent.click(await screen.findByRole('button', { name: 'Encaisser' }))
    fireEvent.change(await screen.findByLabelText('Montant (FCFA)'), { target: { value: '200000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Encaisser' }))
    await waitFor(() => {
      expect(insertPaiement).toHaveBeenCalled()
    })
    const [ligne] = insertPaiement.mock.calls[0]
    expect(ligne).toMatchObject({
      agence_id: 'ag1',
      tranche_id: 't2',
      montant_paye: 200000,
      mode: 'especes',
      reference: null,
      enregistre_par: 'u2',
    })
  })

  it('affiche le motif explicite quand le serveur refuse pour plan soldé', async () => {
    insertPaiement.mockResolvedValue({
      error: { message: 'Encaissement refusé : le plan de paiement est soldé ou le montant dépasse le reste dû.' },
    })
    rendre(planNonSolde)
    fireEvent.click(await screen.findByRole('button', { name: 'Encaisser' }))
    fireEvent.change(await screen.findByLabelText('Montant (FCFA)'), { target: { value: '200000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Encaisser' }))
    expect(await screen.findByText('Encaissement impossible. Le plan de paiement est soldé ou le montant dépasse le reste dû.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Exécuter le test pour vérifier qu'il échoue**

Run: `npx vitest run src/components/paiements/PlanPaiementSection.test.tsx`
Expected: échec de compilation (fichier de test inexistant → `Could not resolve` / fichier créé mais tests rouges : « Plan soldé » introuvable, `max` absent, `toBeDisabled` faux, `insertPaiement` jamais appelé).

- [ ] **Step 3: Implémenter les changements**

Dans `src/components/paiements/PlanPaiementSection.tsx` :

**3a. Mutation `encaisser` (lignes 77-106)** — remplacer le corps `mutationFn` et `onError` :

```tsx
  const encaisser = useMutation({
    mutationFn: async () => {
      const montant = parseInt(montantPaiement, 10)
      if (!montant || montant <= 0) throw new Error('Montant invalide')
      const plafond = Math.min(
        encaissement.tranche.montant_prevu - encaissement.tranche.paiements.reduce((s, p) => s + p.montant_paye, 0),
        plan.montant_total - paye
      )
      if (montant > plafond) throw new Error('Montant depasse')
      const { data: profil } = await supabase.auth.getUser()
      const { data: utilisateur } = await supabase
        .from('utilisateurs')
        .select('id')
        .eq('user_id', profil.user!.id)
        .maybeSingle()
      const { error } = await supabase.from('paiements').insert({
        agence_id: agence!.id,
        tranche_id: encaissement.tranche.id,
        montant_paye: montant,
        mode: modePaiement,
        reference: reference || null,
        enregistre_par: utilisateur?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setEncaissement({ tranche: null!, ouvert: false })
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

Note : `mutationFn` s'exécute au moment de l'appel (après l'initialisation de `paye`/`reste` dans le rendu), les closures sont donc valides.

**3b. Badge « Plan soldé » dans l'en-tête (ligne 167)** — après le `<p>` « Reste dû », dans le `<div className="mb-6 flex flex-wrap items-center gap-6 text-body-md">`, ajouter :

```tsx
        {reste <= 0 && <Badge tone="vert">Plan soldé</Badge>}
```

**3c. Bouton « Encaisser » par tranche (ligne 196)** — étendre la condition :

```tsx
                    {verse < t.montant_prevu && reste > 0 && (
                      <Button variant="secondary" onClick={() => ouvrirEncaissement(t)}>Encaisser</Button>
                    )}
```

**3d. Plafond d'encaissement calculé dans le rendu + titre du panneau** — après la fonction `ouvrirEncaissement` (ligne 155), avant le `return`, ajouter :

```tsx
  const plafondEncaissement = encaissement.ouvert
    ? Math.min(
        encaissement.tranche.montant_prevu - encaissement.tranche.paiements.reduce((s, p) => s + p.montant_paye, 0),
        reste
      )
    : 0
```

puis adapter le titre du panneau (lignes 217-221) :

```tsx
      {encaissement.ouvert && (
        <div className="mt-4 rounded-md border border-primary bg-surface-container-low p-4">
          <p className="mb-3 text-body-md font-semibold text-primary">
            Encaissement — tranche {encaissement.tranche.numero_tranche} (reste {formatFCFA(plafondEncaissement)})
          </p>
```

**3e. Champ Montant (ligne 227)** — ajouter `max={plafondEncaissement}` :

```tsx
              <Input required type="number" min={1} max={plafondEncaissement} value={montantPaiement} onChange={(e) => setMontantPaiement(e.target.value)} />
```

**3f. Bouton Encaisser du formulaire (ligne 242)** — désactiver si montant invalide. Juste après la déclaration de `plafondEncaissement`, ajouter :

```tsx
  const montantSaisi = parseInt(montantPaiement, 10)
```

puis remplacer la ligne 242 :

```tsx
              <Button type="submit" disabled={encaisser.isPending || !montantSaisi || montantSaisi <= 0 || montantSaisi > plafondEncaissement}>Encaisser</Button>
```

Dans les fixtures des tests, `min(reste tranche, reste plan) = 500000 = reste`, le test vérifie donc `max="500000"`.

- [ ] **Step 4: Exécuter les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/components/paiements/PlanPaiementSection.test.tsx`
Expected: 5 tests PASS. Puis `npx vitest run` → les 70 tests existants passent toujours (le composant ne gère pas de nouvelle dépendance).

- [ ] **Step 5: Vérifications complètes**

Run: `npm run lint` (0 erreur) puis `npm run build` (OK, typecheck compris).

- [ ] **Step 6: Commit**

```bash
git add src/components/paiements/PlanPaiementSection.tsx src/components/paiements/PlanPaiementSection.test.tsx
git commit -m "feat: bloquer l'encaissement d'un pèlerin à jour (plafond, badge, trigger UI)"
```