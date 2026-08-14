# Reconstruction Supabase + Vite/React — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruire de zéro le SaaS « Stitch Sama Pèlerin » (gestion d'agences Hajj & Omra sénégalaises) sur Supabase hébergé + Vite/React/TypeScript, conforme à la spec `docs/superpowers/specs/2026-08-13-rebuild-supabase-design.md` et à la maquette `maquette/`.

**Architecture:** Supabase hébergé fournit Postgres (9 tables métier + `utilisateurs` + `invitations`, RLS multi-tenant par `agence_id`, triggers pour statuts tranche/dossier et inscription), Auth email/mot de passe et Storage. Le frontend est une SPA Vite + React + TypeScript (React Router, TanStack Query, Tailwind CSS) qui parle à Supabase via le SDK JS ; la logique de calcul vit dans des fonctions SQL + triggers côté base.

**Tech Stack:** Vite 6+, React 18/19, TypeScript 5, Tailwind CSS v4 (`@tailwindcss/vite`), @supabase/supabase-js v2, @tanstack/react-query v5, react-router-dom v7, Vitest + Testing Library (tests), Vercel (déploiement).

## Global Constraints

- Stack 100 % gratuite : Supabase free tier hébergé, Vercel free tier, aucune API payante.
- Routes en français : `/login`, `/signup`, `/onboarding`, `/tableau-de-bord`, `/liste-des-groupes`, `/liste-des-pelerins`, `/details-du-pelerin/:id`, `/gestion-des-documents`, `/paiements-echeanciers`, `/membres`.
- Montants : suffixe « FCFA » (ex. `2 500 000 FCFA`). Dates : `DD/MM/YYYY`. Langue UI : français.
- Design system maquette : navy `#09152E`, gold `#775928`, fond `#F9F9F7`, cartes `#FFFFFF`, bordures 1px `#E2E8F0`, Inter, boutons 8px, cartes 16px, badges pill, alert panels (bordure gauche 4px).
- Multi-tenant : toute table métier porte `agence_id` ; politique RLS `agence_id = current_agence_id()`.
- Rôles : `gerant` (tout, membres compris) / `agent` (dossiers, documents, paiements, rappels).
- Rappels WhatsApp gratuits : ouverture `https://wa.me/<téléphone>?text=<message>` + suivi manuel `en_attente/envoye/echec`.
- Aucun secret commité : `.env` et `.env.local` dans `.gitignore` ; `SUPABASE_SERVICE_ROLE_KEY` jamais dans le frontend.

---

### Task 1: Nettoyage, maquette, scaffold Vite, dépendances

**Files:**
- Delete: `core/`, `saas_hajj/`, `manage.py`, `db.sqlite3`, `front.html`, `generate_test_data.py`, `verify_test_data.py`, `requirements.txt`
- Create: `maquette/` (extraction du zip), projet Vite à la racine, `.env`, `.env.example`, `.gitignore` (complété), `vite.config.ts`, `src/test/setup.ts`, `package.json` (scripts)

**Interfaces:**
- Consumes: rien (première tâche)
- Produces: projet Vite exécutable ; variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` attendues dans `.env` ; `npm run dev`, `npm run build`, `npm run test` fonctionnels

- [ ] **Step 1: Supprimer le code Django (gardé en git)**

Run: `git rm -r core saas_hajj manage.py db.sqlite3 front.html generate_test_data.py verify_test_data.py requirements.txt`
Expected: 10 suppressions, `docs/` et le zip conservés.

- [ ] **Step 2: Extraire la maquette**

Run:
```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory("stitch_sama_p_lerin_saas.zip", ".")
Rename-Item "stitch_sama_p_lerin_saas" "maquette"
```
Expected: dossier `maquette/` avec 6 pages (screens + code.html) et `pilgrim_management_system/DESIGN.md`.

- [ ] **Step 3: Scaffolder Vite dans un sous-dossier puis le remonter**

Run:
```powershell
npm create vite@latest tmp-vite -- --template react-ts
Move-Item -Path "tmp-vite\*" -Destination "." -Force
Get-ChildItem -Path "tmp-vite" -Force -Filter ".*" | Move-Item -Destination "." -Force
Remove-Item -Recurse -Force tmp-vite
```
Expected: `package.json`, `index.html`, `src/`, `tsconfig*.json`, `vite.config.ts` à la racine. `docs/` et `maquette/` restent intacts.

- [ ] **Step 4: Installer les dépendances**

Run:
```powershell
npm install
npm install @supabase/supabase-js @tanstack/react-query react-router-dom
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/node
```
Expected: installation sans erreur ; `tailwindcss` et `@tailwindcss/vite` en v4+ dans `package.json`.

- [ ] **Step 5: Compléter `.gitignore`**

Add to `.gitignore` (à la suite du contenu généré par Vite) :
```
.env
.env.local
*.local
```

- [ ] **Step 6: Créer `.env` et `.env.example`**

Create `.env.example` :
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon
SUPABASE_SERVICE_ROLE_KEY=votre-cle-service-role
```
Create `.env` avec les mêmes clés (valeurs réelles remplies à l'étape 7).

- [ ] **Step 7: Créer le projet Supabase et renseigner `.env` (action utilisateur)**

Instructions à suivre par l'utilisateur (à lui transmettre si exécution par agent) :
1. Créer un compte sur https://supabase.com et créer un projet (région proche, ex. `eu-west-1`).
2. Dashboard → Project Settings → API : copier **Project URL** et **anon public key** dans `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. Dashboard → Project Settings → API → `service_role` secret : copier dans `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`) — jamais commité.
4. Dashboard → Authentication → Sign In / Providers → Email : désactiver **Confirm email** (connexion immédiate après inscription).
5. Vérifier avec `npm run dev` que la page Vite s'affiche.

- [ ] **Step 8: Configurer Vite (plugin Tailwind + Vitest)**

Write `vite.config.ts` :
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
```

- [ ] **Step 9: Créer le setup de test**

Create `src/test/setup.ts` :
```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 10: Ajouter les scripts npm**

Edit `package.json` → `"scripts"` :
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 11: Vérifier le build**

Run: `npm run build`
Expected: `tsc -b && vite build` se termine sans erreur, `dist/` créé.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: nettoyage Django, maquette, scaffold Vite + Tailwind + Supabase"
```

---

### Task 2: Schéma SQL, triggers et RLS

**Files:**
- Create: `supabase/schema.sql`

**Interfaces:**
- Consumes: projet Supabase créé (Task 1, Step 7)
- Produces: toutes les tables/fonctions/politiques consommées par l'app : `agences`, `utilisateurs`, `groupes`, `pelerins`, `documents`, `plans_paiement`, `tranches`, `paiements`, `rappels`, `invitations`, `current_agence_id()`, triggers `on_auth_user_created`, `trg_paiement_maj_tranche`, `trg_document_maj_dossier`, buckets `documents_pelerins` et `logos_agences`

- [ ] **Step 1: Écrire `supabase/schema.sql`**

Write `supabase/schema.sql` :
```sql
-- ============================================================
-- SCHÉMA « Stitch Sama Pèlerin » — appliquer via SQL Editor
-- ============================================================

-- ---------- TABLES ----------
create table public.agences (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text not null default '',
  email text,
  adresse text,
  logo_url text,
  created_at timestamptz not null default now()
);

create table public.utilisateurs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  agence_id uuid references public.agences(id) on delete set null,
  nom text not null,
  telephone text not null default '',
  email text,
  role text not null default 'agent' check (role in ('gerant','agent')),
  created_at timestamptz not null default now()
);

create table public.groupes (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id) on delete cascade,
  nom text not null,
  type_voyage text not null check (type_voyage in ('hajj','omra')),
  date_depart date not null,
  date_retour date not null,
  nb_places_max int not null default 0,
  created_at timestamptz not null default now()
);

create table public.pelerins (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id) on delete cascade,
  groupe_id uuid not null references public.groupes(id) on delete cascade,
  nom text not null,
  prenom text not null,
  telephone text not null,
  email text,
  date_naissance date,
  sexe text check (sexe in ('M','F')),
  contact_urgence_nom text,
  contact_urgence_telephone text,
  statut_dossier text not null default 'incomplet' check (statut_dossier in ('incomplet','complet','valide')),
  date_inscription timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id) on delete cascade,
  pelerin_id uuid not null references public.pelerins(id) on delete cascade,
  type_document text not null check (type_document in ('passeport','visa','certificat_vaccination','photo','autre')),
  fichier_url text,
  date_expiration date,
  statut text not null default 'manquant' check (statut in ('manquant','soumis','valide','rejete')),
  date_upload timestamptz,
  unique (pelerin_id, type_document)
);

create table public.plans_paiement (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id) on delete cascade,
  pelerin_id uuid not null unique references public.pelerins(id) on delete cascade,
  montant_total numeric(12,0) not null check (montant_total >= 0),
  devise text not null default 'FCFA',
  nombre_tranches int not null default 1,
  created_at timestamptz not null default now()
);

create table public.tranches (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id) on delete cascade,
  plan_paiement_id uuid not null references public.plans_paiement(id) on delete cascade,
  numero_tranche int not null,
  montant_prevu numeric(12,0) not null,
  date_echeance date not null,
  statut text not null default 'a_venir' check (statut in ('a_venir','payee','partielle','en_retard')),
  unique (plan_paiement_id, numero_tranche)
);

create table public.paiements (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id) on delete cascade,
  tranche_id uuid not null references public.tranches(id) on delete cascade,
  montant_paye numeric(12,0) not null check (montant_paye >= 0),
  date_paiement timestamptz not null default now(),
  mode text not null default 'especes' check (mode in ('especes','wave','orange_money','virement','autre')),
  reference text,
  enregistre_par uuid references public.utilisateurs(id)
);

create table public.rappels (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id) on delete cascade,
  tranche_id uuid references public.tranches(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  canal text not null default 'whatsapp' check (canal in ('whatsapp','sms')),
  date_envoi_prevue timestamptz not null,
  date_envoi_reelle timestamptz,
  statut_envoi text not null default 'en_attente' check (statut_envoi in ('en_attente','envoye','echec'))
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id) on delete cascade,
  email text not null,
  role text not null default 'agent' check (role in ('gerant','agent')),
  token text not null unique,
  created_by uuid references public.utilisateurs(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  used_at timestamptz
);

-- ---------- FONCTIONS ----------
create or replace function public.current_agence_id()
returns uuid language sql stable security definer set search_path = public as $$
  select agence_id from public.utilisateurs where user_id = auth.uid()
$$;

-- Inscription : crée la ligne utilisateurs, gère l'invitation, relie les comptes seedés
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_invite public.invitations%rowtype;
begin
  select * into v_invite from public.invitations
    where lower(email) = lower(new.email) and used_at is null and expires_at > now()
    order by created_at desc limit 1;

  if exists (select 1 from public.utilisateurs where lower(email) = lower(new.email) and user_id is null) then
    update public.utilisateurs set user_id = new.id
      where lower(email) = lower(new.email) and user_id is null;
    return new;
  end if;

  insert into public.utilisateurs (user_id, agence_id, nom, email, role)
  values (
    new.id,
    v_invite.agence_id,
    coalesce(new.raw_user_meta_data->>'nom', split_part(new.email, '@', 1)),
    new.email,
    coalesce(v_invite.role, 'agent')
  );

  if v_invite.id is not null then
    update public.invitations set used_at = now() where id = v_invite.id;
  end if;
  return new;
end $$;

-- Recalcule le statut d'une tranche après modification des paiements
create or replace function public.trg_maj_statut_tranche()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_verse numeric; v_prevu numeric; v_echeance date; v_statut text;
begin
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

-- Recalcule le statut du dossier d'un pèlerin après modification des documents
create or replace function public.trg_maj_statut_dossier()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pelerin uuid; v_statut text;
begin
  v_pelerin := coalesce(new.pelerin_id, old.pelerin_id);
  select case
    when count(*) = 0 then 'incomplet'
    when bool_and(statut = 'valide') then 'valide'
    when bool_and(statut in ('soumis','valide')) then 'complet'
    else 'incomplet'
  end into v_statut from public.documents where pelerin_id = v_pelerin;
  update public.pelerins set statut_dossier = v_statut where id = v_pelerin;
  return coalesce(new, old);
end $$;

-- ---------- TRIGGERS ----------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger trg_paiement_maj_tranche
  after insert or update or delete on public.paiements
  for each row execute function public.trg_maj_statut_tranche();

create trigger trg_document_maj_dossier
  after insert or update or delete on public.documents
  for each row execute function public.trg_maj_statut_dossier();

-- ---------- RLS ----------
alter table public.agences enable row level security;
alter table public.utilisateurs enable row level security;
alter table public.groupes enable row level security;
alter table public.pelerins enable row level security;
alter table public.documents enable row level security;
alter table public.plans_paiement enable row level security;
alter table public.tranches enable row level security;
alter table public.paiements enable row level security;
alter table public.rappels enable row level security;
alter table public.invitations enable row level security;

create policy agences_select on public.agences for select
  using (id = public.current_agence_id());
create policy agences_insert on public.agences for insert
  with check (true);
create policy agences_update on public.agences for update
  using (id = public.current_agence_id());

create policy utilisateurs_select on public.utilisateurs for select
  using (agence_id = public.current_agence_id() or user_id = auth.uid());
create policy utilisateurs_insert on public.utilisateurs for insert
  with check (agence_id = public.current_agence_id());
create policy utilisateurs_update on public.utilisateurs for update
  using (user_id = auth.uid()
    or (agence_id = public.current_agence_id()
        and exists (select 1 from public.utilisateurs u
                    where u.user_id = auth.uid() and u.role = 'gerant')));
create policy utilisateurs_delete on public.utilisateurs for delete
  using (agence_id = public.current_agence_id()
    and exists (select 1 from public.utilisateurs u
                where u.user_id = auth.uid() and u.role = 'gerant'));

create policy invitations_select on public.invitations for select
  using (agence_id = public.current_agence_id());
create policy invitations_insert on public.invitations for insert
  with check (agence_id = public.current_agence_id()
    and exists (select 1 from public.utilisateurs u
                where u.user_id = auth.uid() and u.role = 'gerant'));
create policy invitations_delete on public.invitations for delete
  using (agence_id = public.current_agence_id()
    and exists (select 1 from public.utilisateurs u
                where u.user_id = auth.uid() and u.role = 'gerant'));

create policy groupes_all on public.groupes for all
  using (agence_id = public.current_agence_id())
  with check (agence_id = public.current_agence_id());
create policy pelerins_all on public.pelerins for all
  using (agence_id = public.current_agence_id())
  with check (agence_id = public.current_agence_id());
create policy documents_all on public.documents for all
  using (agence_id = public.current_agence_id())
  with check (agence_id = public.current_agence_id());
create policy plans_all on public.plans_paiement for all
  using (agence_id = public.current_agence_id())
  with check (agence_id = public.current_agence_id());
create policy tranches_all on public.tranches for all
  using (agence_id = public.current_agence_id())
  with check (agence_id = public.current_agence_id());
create policy paiements_all on public.paiements for all
  using (agence_id = public.current_agence_id())
  with check (agence_id = public.current_agence_id());
create policy rappels_all on public.rappels for all
  using (agence_id = public.current_agence_id())
  with check (agence_id = public.current_agence_id());

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public)
values ('documents_pelerins', 'documents_pelerins', false)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('logos_agences', 'logos_agences', false)
on conflict (id) do nothing;

create policy doc_pelerins_read on storage.objects for select
  using (bucket_id = 'documents_pelerins'
    and (storage.foldername(name))[1] = public.current_agence_id()::text);
create policy doc_pelerins_write on storage.objects for insert
  with check (bucket_id = 'documents_pelerins'
    and (storage.foldername(name))[1] = public.current_agence_id()::text);
create policy doc_pelerins_update on storage.objects for update
  using (bucket_id = 'documents_pelerins'
    and (storage.foldername(name))[1] = public.current_agence_id()::text);
create policy doc_pelerins_delete on storage.objects for delete
  using (bucket_id = 'documents_pelerins'
    and (storage.foldername(name))[1] = public.current_agence_id()::text);
create policy logos_read on storage.objects for select
  using (bucket_id = 'logos_agences'
    and (storage.foldername(name))[1] = public.current_agence_id()::text);
create policy logos_write on storage.objects for insert
  with check (bucket_id = 'logos_agences'
    and (storage.foldername(name))[1] = public.current_agence_id()::text);
```

- [ ] **Step 2: Appliquer le schéma (action utilisateur)**

Instructions : Dashboard Supabase → SQL Editor → coller tout `supabase/schema.sql` → Run. Expected: « Success. No rows returned » (les `create policy` ne renvoient rien).

- [ ] **Step 3: Vérifier le schéma**

Run dans le SQL Editor :
```sql
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
select name from storage.buckets order by name;
select tgname from pg_trigger where not tgisinternal order by tgname;
```
Expected: 10 tables (agences, documents, groupes, invitations, paiements, pelerins, plans_paiement, rappels, tranches, utilisateurs), 2 buckets, 3 triggers.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(supabase): schema SQL, triggers et RLS multi-tenant"
```

---

### Task 3: Fondations — client Supabase, types, format & logique pure (TDD)

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/types.ts`, `src/lib/format.ts`, `src/lib/plan.ts`, `src/lib/format.test.ts`, `src/lib/plan.test.ts`

**Interfaces:**
- Consumes: rien (pur TS)
- Produces:
  - `supabase` (client unique) — utilisé par toutes les tâches suivantes
  - Types `Agence, Utilisateur, Groupe, Pelerin, Document, PlanPaiement, Tranche, Paiement, Rappel, Invitation`
  - `formatFCFA(n: number): string`, `formatDate(iso: string | null | undefined): string`, `whatsappUrl(telephone: string, message: string): string`, `messageTranche(prenom, nom, numero, montant, echeance): string`, `messageDocument(prenom, nom, typeDoc, statut): string`, `LIBELLES_DOCUMENT`, `LIBELLES_DOC_STATUT`, `LIBELLES_DOSSIER`, `LIBELLES_TRANCHE`, `LIBELLES_MODE`, `LIBELLES_RAPPEL`, `LIBELLES_TYPE_VOYAGE`, `LIBELLES_SEXE`, `TONE_DOCUMENT`, `TONE_DOSSIER`, `TONE_TRANCHE`, `TONE_RAPPEL`
  - `genererTranches(montantTotal: number, nombreTranches: number, premiereEcheance: string): { numero_tranche: number; montant_prevu: number; date_echeance: string }[]`

- [ ] **Step 1: Écrire le test qui échoue — format.ts**

Write `src/lib/format.test.ts` :
```ts
import { describe, it, expect } from 'vitest'
import {
  formatFCFA, formatDate, whatsappUrl,
  messageTranche, messageDocument,
  LIBELLES_DOCUMENT, TONE_TRANCHE,
} from './format'

describe('formatFCFA', () => {
  it('formate avec le suffixe FCFA', () => {
    expect(formatFCFA(2500000)).toBe('2 500 000 FCFA')
    expect(formatFCFA(750000)).toBe('750 000 FCFA')
    expect(formatFCFA(0)).toBe('0 FCFA')
  })
})

describe('formatDate', () => {
  it('formate une date ISO date-only en DD/MM/YYYY sans décalage de fuseau', () => {
    expect(formatDate('2027-05-15')).toBe('15/05/2027')
  })
  it('retourne un tiret pour une valeur nulle', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })
})

describe('whatsappUrl', () => {
  it('nettoie le téléphone et encode le message', () => {
    expect(whatsappUrl('+221 77 123 45 67', 'Bonjour Awa')).toBe(
      'https://wa.me/221771234567?text=Bonjour%20Awa'
    )
  })
})

describe('messageTranche', () => {
  it('construit le message de rappel de tranche', () => {
    const msg = messageTranche('Awa', 'Ndiaye', 2, 500000, '2026-10-01')
    expect(msg).toContain('Awa Ndiaye')
    expect(msg).toContain('tranche 2')
    expect(msg).toContain('500 000 FCFA')
    expect(msg).toContain('01/10/2026')
  })
})

describe('messageDocument', () => {
  it('construit le message de rappel de document', () => {
    const msg = messageDocument('Awa', 'Ndiaye', 'passeport', 'manquant')
    expect(msg).toContain('Passeport')
    expect(msg).toContain('Awa Ndiaye')
  })
})

describe('libellés et tons', () => {
  it('expose les libellés de documents', () => {
    expect(LIBELLES_DOCUMENT.passeport).toBe('Passeport')
    expect(LIBELLES_DOCUMENT.certificat_vaccination).toBe('Certificat de vaccination')
  })
  it('expose les tons de tranches', () => {
    expect(TONE_TRANCHE.en_retard).toBe('rouge')
    expect(TONE_TRANCHE.payee).toBe('vert')
  })
})
```

- [ ] **Step 2: Écrire le test qui échoue — plan.ts**

Write `src/lib/plan.test.ts` :
```ts
import { describe, it, expect } from 'vitest'
import { genererTranches } from './plan'

describe('genererTranches', () => {
  it('répartit équitablement et met le reste sur la dernière tranche', () => {
    const tranches = genererTranches(2500000, 5, '2027-01-15')
    expect(tranches).toHaveLength(5)
    expect(tranches[0]).toEqual({ numero_tranche: 1, montant_prevu: 500000, date_echeance: '2027-01-15' })
    expect(tranches[4].montant_prevu).toBe(500000)
    expect(tranches.reduce((s, t) => s + t.montant_prevu, 0)).toBe(2500000)
  })
  it("met le reste sur la dernière tranche quand le total n'est pas divisible", () => {
    const tranches = genererTranches(1000, 3, '2026-09-01')
    expect(tranches.map(t => t.montant_prevu)).toEqual([333, 333, 334])
  })
  it('gère une seule tranche', () => {
    const tranches = genererTranches(800000, 1, '2026-09-01')
    expect(tranches).toEqual([{ numero_tranche: 1, montant_prevu: 800000, date_echeance: '2026-09-01' }])
  })
})
```

- [ ] **Step 3: Lancer les tests pour vérifier l'échec**

Run: `npm run test`
Expected: FAIL — `Cannot find module './format'` / `'./plan'`.

- [ ] **Step 4: Implémenter `src/lib/types.ts`**

Write `src/lib/types.ts` :
```ts
export type Role = 'gerant' | 'agent'
export type TypeVoyage = 'hajj' | 'omra'
export type StatutDossier = 'incomplet' | 'complet' | 'valide'
export type TypeDocument = 'passeport' | 'visa' | 'certificat_vaccination' | 'photo' | 'autre'
export type StatutDocument = 'manquant' | 'soumis' | 'valide' | 'rejete'
export type StatutTranche = 'a_venir' | 'payee' | 'partielle' | 'en_retard'
export type ModePaiement = 'especes' | 'wave' | 'orange_money' | 'virement' | 'autre'
export type StatutRappel = 'en_attente' | 'envoye' | 'echec'

export interface Agence {
  id: string; nom: string; telephone: string; email: string | null
  adresse: string | null; logo_url: string | null; created_at: string
}
export interface Utilisateur {
  id: string; user_id: string | null; agence_id: string | null
  nom: string; telephone: string; email: string | null; role: Role; created_at: string
}
export interface Groupe {
  id: string; agence_id: string; nom: string; type_voyage: TypeVoyage
  date_depart: string; date_retour: string; nb_places_max: number; created_at: string
}
export interface Pelerin {
  id: string; agence_id: string; groupe_id: string; nom: string; prenom: string
  telephone: string; email: string | null; date_naissance: string | null
  sexe: 'M' | 'F' | null; contact_urgence_nom: string | null
  contact_urgence_telephone: string | null; statut_dossier: StatutDossier
  date_inscription: string
}
export interface Document {
  id: string; agence_id: string; pelerin_id: string; type_document: TypeDocument
  fichier_url: string | null; date_expiration: string | null
  statut: StatutDocument; date_upload: string | null
}
export interface PlanPaiement {
  id: string; agence_id: string; pelerin_id: string
  montant_total: number; devise: string; nombre_tranches: number; created_at: string
}
export interface Tranche {
  id: string; agence_id: string; plan_paiement_id: string; numero_tranche: number
  montant_prevu: number; date_echeance: string; statut: StatutTranche
}
export interface Paiement {
  id: string; agence_id: string; tranche_id: string; montant_paye: number
  date_paiement: string; mode: ModePaiement; reference: string | null; enregistre_par: string | null
}
export interface Rappel {
  id: string; agence_id: string; tranche_id: string | null; document_id: string | null
  canal: 'whatsapp' | 'sms'; date_envoi_prevue: string
  date_envoi_reelle: string | null; statut_envoi: StatutRappel
}
export interface Invitation {
  id: string; agence_id: string; email: string; role: Role; token: string
  created_by: string | null
  created_at: string; expires_at: string; used_at: string | null
}
```

- [ ] **Step 5: Implémenter `src/lib/format.ts`**

Write `src/lib/format.ts` :
```ts
export function formatFCFA(montant: number): string {
  return new Intl.NumberFormat('fr-FR').format(montant) + ' FCFA'
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  return new Date(value).toLocaleDateString('fr-FR')
}

export function whatsappUrl(telephone: string, message: string): string {
  const digits = telephone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function messageTranche(
  prenom: string, nom: string, numeroTranche: number, montant: number, echeance: string
): string {
  return `Assalamou alaykoum ${prenom} ${nom}, rappel : la tranche ${numeroTranche} de ${formatFCFA(montant)} arrive à échéance le ${formatDate(echeance)}. Merci de régler auprès de votre agence.`
}

export function messageDocument(
  prenom: string, nom: string, typeDoc: string, statut: string
): string {
  return `Assalamou alaykoum ${prenom} ${nom}, rappel : votre document « ${LIBELLES_DOCUMENT[typeDoc] ?? typeDoc} » est ${LIBELLES_DOC_STATUT[statut] ?? statut}. Merci de le régulariser auprès de votre agence.`
}

export const LIBELLES_DOCUMENT: Record<string, string> = {
  passeport: 'Passeport',
  visa: 'Visa',
  certificat_vaccination: 'Certificat de vaccination',
  photo: "Photo d'identité",
  autre: 'Autre',
}

export const LIBELLES_DOC_STATUT: Record<string, string> = {
  manquant: 'manquant',
  soumis: 'soumis',
  valide: 'validé',
  rejete: 'rejeté',
}

export const LIBELLES_DOSSIER: Record<string, string> = {
  incomplet: 'Incomplet',
  complet: 'Complet',
  valide: 'Validé',
}

export const LIBELLES_TRANCHE: Record<string, string> = {
  a_venir: 'À venir',
  payee: 'Payée',
  partielle: 'Partielle',
  en_retard: 'En retard',
}

export const LIBELLES_MODE: Record<string, string> = {
  especes: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  virement: 'Virement bancaire',
  autre: 'Autre',
}

export const LIBELLES_RAPPEL: Record<string, string> = {
  en_attente: 'En attente',
  envoye: 'Envoyé',
  echec: 'Échec',
}

export const LIBELLES_TYPE_VOYAGE: Record<string, string> = {
  hajj: 'Hajj',
  omra: 'Omra',
}

export const LIBELLES_SEXE: Record<string, string> = {
  M: 'Homme',
  F: 'Femme',
}

export const TONE_DOCUMENT: Record<string, string> = {
  manquant: 'rouge',
  soumis: 'ambre',
  valide: 'vert',
  rejete: 'rouge',
}

export const TONE_DOSSIER: Record<string, string> = {
  incomplet: 'rouge',
  complet: 'ambre',
  valide: 'vert',
}

export const TONE_TRANCHE: Record<string, string> = {
  a_venir: 'neutre',
  payee: 'vert',
  partielle: 'ambre',
  en_retard: 'rouge',
}

export const TONE_RAPPEL: Record<string, string> = {
  en_attente: 'ambre',
  envoye: 'vert',
  echec: 'rouge',
}
```

- [ ] **Step 6: Implémenter `src/lib/plan.ts`**

Write `src/lib/plan.ts` :
```ts
export interface TrancheDraft {
  numero_tranche: number
  montant_prevu: number
  date_echeance: string
}

export function genererTranches(
  montantTotal: number,
  nombreTranches: number,
  premiereEcheance: string
): TrancheDraft[] {
  if (nombreTranches < 1) return []
  const base = Math.floor(montantTotal / nombreTranches)
  const tranches: TrancheDraft[] = []
  for (let i = 1; i <= nombreTranches; i++) {
    const dernier = i === nombreTranches
    tranches.push({
      numero_tranche: i,
      montant_prevu: dernier ? montantTotal - base * (nombreTranches - 1) : base,
      date_echeance: premiereEcheance,
    })
  }
  return tranches
}
```

- [ ] **Step 7: Implémenter `src/lib/supabase.ts`**

Write `src/lib/supabase.ts` :
```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 8: Lancer les tests**

Run: `npm run test`
Expected: PASS — tous les tests de `format.test.ts` et `plan.test.ts`.

- [ ] **Step 9: Vérifier le build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 10: Commit**

```bash
git add src/lib
git commit -m "feat: fondations — client Supabase, types, format, génération de tranches"
```

### Task 4: Auth — contexte, routes protégées, Login, Signup

**Files:**
- Create: `src/auth/AuthContext.tsx`, `src/auth/ProtectedRoute.tsx`, `src/pages/Login.tsx`, `src/pages/Signup.tsx`, `src/auth/AuthContext.test.tsx`, `src/main.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 3)
- Produces: `useAuth()` → `{ session, loading }` ; `<ProtectedRoute />` (rend `<Outlet />` si session, sinon redirige vers `/login`) ; pages `Login` et `Signup` branchées sur `supabase.auth`

- [ ] **Step 1: Écrire le test qui échoue — AuthContext**

Write `src/auth/AuthContext.test.tsx` :
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}))

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}

function Probe() {
  const { session, loading } = useAuth()
  return <div>{loading ? 'chargement' : session ? 'connecte' : 'anonyme'}</div>
}

beforeEach(() => {
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mockSupabase.auth.onAuthStateChange.mockImplementation(
    (cb: (e: string, s: unknown) => void) => {
      setTimeout(() => cb('SIGNED_IN', { user: { id: 'u1' } }), 0)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }
  )
})

describe('AuthProvider', () => {
  it('passe de chargement à session', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    expect(screen.getByText('chargement')).toBeInTheDocument()
    expect(await screen.findByText('connecte')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npm run test -- AuthContext`
Expected: FAIL — `Cannot find module './AuthContext'`.

- [ ] **Step 3: Implémenter `src/auth/AuthContext.tsx`**

Write `src/auth/AuthContext.tsx` :
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 4: Implémenter `src/auth/ProtectedRoute.tsx`**

Write `src/auth/ProtectedRoute.tsx` :
```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

export default function ProtectedRoute() {
  const { session, loading } = useAuth()
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}
```

- [ ] **Step 5: Implémenter `src/pages/Login.tsx`**

Write `src/pages/Login.tsx` :
```tsx
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-8">
        <h1 className="text-headline mb-6 text-navy">Stitch Sama Pèlerin</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label mb-1 block" htmlFor="email">Email</label>
            <input
              id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="label mb-1 block" htmlFor="password">Mot de passe</label>
            <input
              id="password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full"
            />
          </div>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <button type="submit" disabled={enCours} className="btn-primary w-full">
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <p className="mt-4 text-sm">
          Pas encore de compte ?{' '}
          <Link to="/signup" className="text-navy underline">Créer un compte</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Implémenter `src/pages/Signup.tsx`**

Write `src/pages/Signup.tsx` :
```tsx
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
      <div className="w-full max-w-md rounded-lg border border-border bg-white p-8">
        <h1 className="text-headline mb-6 text-navy">Créer un compte</h1>
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
          <Link to="/login" className="text-navy underline">Se connecter</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Implémenter `src/App.tsx` et `src/main.tsx`**

Write `src/App.tsx` :
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import ProtectedRoute from './auth/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route element={<ProtectedRoute />}>
              <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

Write `src/main.tsx` :
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 8: Lancer les tests**

Run: `npm run test`
Expected: PASS — AuthContext + format + plan.

- [ ] **Step 9: Commit**

```bash
git add src/auth src/pages src/App.tsx src/main.tsx
git commit -m "feat: auth — contexte de session, routes protégées, login et signup"
```

---

### Task 5: Layout, design system et hooks d'agence

**Files:**
- Create: `src/hooks/useAgence.ts`, `src/index.css` (réécrit avec les tokens maquette), `index.html` (police Inter), `src/components/ui/Button.tsx`, `src/components/ui/Badge.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Field.tsx`, `src/components/ui/AlertPanel.tsx`, `src/components/ui/Modal.tsx`, `src/components/ui/EmptyState.tsx`, `src/components/layout/AppLayout.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Topbar.tsx`

**Interfaces:**
- Consumes: `supabase`, types, `useAuth` (Tasks 3-4)
- Produces: `useProfil()` → `Utilisateur | null` ; `useAgence()` → `Agence | null` ; composants `Button` (variants `primary|secondary|danger`), `Badge` (props `tone`, `children`), `Card`, `Field` (label + input), `AlertPanel` (props `tone`, `title`, `children`), `Modal` (props `open`, `title`, `onClose`, `children`), `EmptyState` (prop `message`) ; `AppLayout` (sidebar + topbar, redirige vers `/onboarding` si l'utilisateur n'a pas d'agence) ; classes utilitaires `input`, `label`, `btn-primary`, `btn-secondary`, `btn-danger`, `text-headline`, `text-error`, `border-border`, `bg-surface`, `text-navy`, `text-gold`, `bg-navy`

- [ ] **Step 1: Écrire les tokens Tailwind et les utilitaires CSS**

Write `src/index.css` :
```css
@import "tailwindcss";

@theme {
  --color-surface: #f9f9f7;
  --color-surface-dim: #dadad8;
  --color-navy: #09152e;
  --color-navy-light: #1f2a44;
  --color-gold: #775928;
  --color-gold-container: #ffd79b;
  --color-border: #e2e8f0;
  --color-error: #ba1a1a;
  --color-vert: #2e7d32;
  --color-ambre: #b26a00;
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --radius-card: 1rem;
}

@layer components {
  .input {
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    background: #ffffff;
  }
  .input:focus {
    outline: none;
    border-color: var(--color-navy);
  }
  .label {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--color-navy);
  }
  .btn-primary {
    background: var(--color-navy);
    color: #ffffff;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-weight: 600;
    font-size: 0.875rem;
  }
  .btn-primary:hover { background: var(--color-navy-light); }
  .btn-primary:disabled { opacity: 0.5; }
  .btn-secondary {
    background: #ffffff;
    color: var(--color-navy);
    border: 1px solid var(--color-navy);
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-weight: 600;
    font-size: 0.875rem;
  }
  .btn-danger {
    background: #ffffff;
    color: var(--color-error);
    border: 1px solid var(--color-error);
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-weight: 600;
    font-size: 0.875rem;
  }
  .text-headline {
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 2rem;
  }
}
```

- [ ] **Step 2: Ajouter la police Inter**

Edit `index.html` → dans `<head>`, ajouter :
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 3: Écrire les hooks**

Write `src/hooks/useAgence.ts` :
```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Agence, Utilisateur } from '../lib/types'

export function useProfil() {
  return useQuery({
    queryKey: ['profil'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      return data as Utilisateur | null
    },
  })
}

export function useAgence() {
  const { data: profil } = useProfil()
  return useQuery({
    queryKey: ['agence', profil?.agence_id],
    enabled: !!profil?.agence_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('agences')
        .select('*')
        .eq('id', profil!.agence_id!)
        .single()
      return data as Agence
    },
  })
}
```

- [ ] **Step 4: Écrire les composants UI**

Write `src/components/ui/Button.tsx` :
```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  children: ReactNode
}

export default function Button({ variant = 'primary', children, className = '', ...rest }: Props) {
  const cls = variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : 'btn-secondary'
  return (
    <button className={`${cls} ${className}`} {...rest}>
      {children}
    </button>
  )
}
```

Write `src/components/ui/Badge.tsx` :
```tsx
import type { ReactNode } from 'react'

const TONES: Record<string, string> = {
  rouge: 'bg-red-50 text-error border border-red-200',
  ambre: 'bg-amber-50 text-ambre border border-amber-200',
  vert: 'bg-green-50 text-vert border border-green-200',
  neutre: 'bg-gray-100 text-gray-600 border border-gray-200',
}

export default function Badge({ tone = 'neutre', children }: { tone?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone] ?? TONES.neutre}`}>
      {children}
    </span>
  )
}
```

Write `src/components/ui/Card.tsx` :
```tsx
import type { ReactNode } from 'react'

export default function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-border bg-white ${className}`}>{children}</div>
}
```

Write `src/components/ui/Field.tsx` :
```tsx
import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label mb-1 block">{label}</label>
      {children}
    </div>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input w-full ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input w-full ${props.className ?? ''}`} />
}
```

Write `src/components/ui/AlertPanel.tsx` :
```tsx
import type { ReactNode } from 'react'

const TONES: Record<string, string> = {
  rouge: 'border-red-500 bg-red-50',
  ambre: 'border-amber-500 bg-amber-50',
  vert: 'border-green-500 bg-green-50',
}

export default function AlertPanel({ tone = 'ambre', title, children }: { tone?: string; title: string; children: ReactNode }) {
  return (
    <div className={`border-l-4 ${TONES[tone] ?? TONES.ambre} rounded-md p-4`}>
      <p className="text-sm font-semibold text-navy">{title}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  )
}
```

Write `src/components/ui/Modal.tsx` :
```tsx
import type { ReactNode } from 'react'

export default function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-card border border-border bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-navy" aria-label="Fermer">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

Write `src/components/ui/EmptyState.tsx` :
```tsx
export default function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-gray-500">{message}</p>
}
```

- [ ] **Step 5: Écrire le layout**

Write `src/components/layout/Sidebar.tsx` :
```tsx
import { NavLink } from 'react-router-dom'
import { useProfil } from '../../hooks/useAgence'

const NAVIGATION = [
  { section: 'Vue d’ensemble', items: [{ to: '/tableau-de-bord', label: 'Tableau de bord' }] },
  {
    section: 'Gestion des pèlerins',
    items: [
      { to: '/liste-des-groupes', label: 'Groupes' },
      { to: '/liste-des-pelerins', label: 'Pèlerins' },
      { to: '/gestion-des-documents', label: 'Documents' },
    ],
  },
  { section: 'Finances', items: [{ to: '/paiements-echeanciers', label: 'Paiements & échéanciers' }] },
]

export default function Sidebar() {
  const { data: profil } = useProfil()
  const sections = profil?.role === 'gerant'
    ? [...NAVIGATION, { section: 'Administration', items: [{ to: '/membres', label: 'Membres' }] }]
    : NAVIGATION

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-border bg-white md:block">
      <div className="flex h-16 items-center border-b border-border px-6">
        <span className="text-lg font-bold text-navy">Stitch Sama Pèlerin</span>
      </div>
      <nav className="p-4">
        {sections.map((s) => (
          <div key={s.section} className="mb-4">
            <p className="label mb-2 px-3 text-gray-400">{s.section}</p>
            {s.items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                className={({ isActive }) =>
                  `mb-1 block rounded-md px-3 py-2 text-sm ${
                    isActive ? 'border-l-4 border-gold bg-navy/5 font-semibold text-navy' : 'text-gray-600 hover:bg-surface'
                  }`
                }
              >
                {i.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
```

Write `src/components/layout/Topbar.tsx` :
```tsx
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAgence, useProfil } from '../../hooks/useAgence'

export default function Topbar() {
  const navigate = useNavigate()
  const { data: profil } = useProfil()
  const { data: agence } = useAgence()

  async function deconnexion() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-6">
      <p className="text-sm font-semibold text-navy md:hidden">Stitch Sama Pèlerin</p>
      <div className="hidden md:block" />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-navy">{profil?.nom}</p>
          <p className="text-xs text-gray-500">{agence?.nom ?? profil?.role === 'gerant' ? 'Gérant' : 'Agent'}</p>
        </div>
        <button onClick={deconnexion} className="btn-secondary text-xs">Déconnexion</button>
      </div>
    </header>
  )
}
```

Write `src/components/layout/AppLayout.tsx` :
```tsx
import { Navigate, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useProfil } from '../../hooks/useAgence'

export default function AppLayout() {
  const { data: profil, isLoading } = useProfil()

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-navy">Chargement…</div>
  }
  if (!profil) {
    return <div className="flex h-screen items-center justify-center text-error">Profil introuvable.</div>
  }
  if (!profil.agence_id) return <Navigate to="/onboarding" replace />

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Vérifier le build**

Run: `npm run build`
Expected: build OK (composants non encore routés, mais TypeScript valide).

- [ ] **Step 7: Commit**

```bash
git add src/hooks src/index.css index.html src/components
git commit -m "feat: design system maquette, layout sidebar/topbar, hooks d'agence"
```

---

### Task 6: Onboarding — création de l'agence (gérant)

**Files:**
- Create: `src/pages/Onboarding.tsx`
- Modify: `src/App.tsx` (route `/onboarding`)

**Interfaces:**
- Consumes: `supabase`, `useProfil`, `Card`, `Field`, `Input`, `Button` (Tasks 3-5)
- Produces: page `Onboarding` (crée `agences` puis met à jour `utilisateurs.agence_id` + `role = 'gerant'` ; redirige vers `/tableau-de-bord` ; si déjà lié à une agence, redirige directement)

- [ ] **Step 1: Implémenter `src/pages/Onboarding.tsx`**

Write `src/pages/Onboarding.tsx` :
```tsx
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfil } from '../hooks/useAgence'
import Card from '../components/ui/Card'
import { Field, Input } from '../components/ui/Field'
import Button from '../components/ui/Button'

export default function Onboarding() {
  const navigate = useNavigate()
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
      .eq('user_id', profil.user_id)
    setEnCours(false)
    if (e2) {
      setErreur('Agence créée mais rattachement impossible. Rechargez la page.')
      return
    }
    navigate('/tableau-de-bord')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-lg p-8">
        <h1 className="text-headline mb-2 text-navy">Créer votre agence</h1>
        <p className="mb-6 text-sm text-gray-600">
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
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Ajouter la route**

Edit `src/App.tsx` :
```tsx
import Onboarding from './pages/Onboarding'
```
et dans les routes protégées :
```tsx
<Route path="/onboarding" element={<Onboarding />} />
```

- [ ] **Step 3: Vérification manuelle**

Instructions : `npm run dev` → créer un compte sur `/signup` → l'app doit rediriger vers `/onboarding` → créer l'agence → arrivée sur `/tableau-de-bord` (page vide, à implémenter en Task 12 — vérifier la redirection seulement, sans erreur console).

- [ ] **Step 4: Commit**

```bash
git add src/pages/Onboarding.tsx src/App.tsx
git commit -m "feat: onboarding — création de l'agence et promotion en gérant"
```

### Task 7: Membres — invitations d'agents (gérant)

**Files:**
- Create: `src/pages/Membres.tsx`
- Modify: `src/App.tsx` (route `/membres`)

**Interfaces:**
- Consumes: `supabase`, `useProfil`, composants UI (Tasks 3-6)
- Produces: page `Membres` (liste des `utilisateurs` de l'agence ; création d'`invitations` avec token `crypto.randomUUID()` ; affichage du lien `/signup?invite=<token>` à copier ; suppression d'un membre par le gérant)

- [ ] **Step 1: Implémenter `src/pages/Membres.tsx`**

Write `src/pages/Membres.tsx` :
```tsx
import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useProfil } from '../hooks/useAgence'
import Card from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import type { Invitation, Utilisateur } from '../lib/types'

export default function Membres() {
  const { data: profil } = useProfil()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'gerant' | 'agent'>('agent')
  const [lienInvitation, setLienInvitation] = useState('')
  const [erreur, setErreur] = useState('')

  const { data: membres = [] } = useQuery({
    queryKey: ['membres'],
    enabled: !!profil?.agence_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('agence_id', profil!.agence_id!)
        .order('nom')
      return data as Utilisateur[]
    },
  })

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    enabled: !!profil?.agence_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('invitations')
        .select('*')
        .eq('agence_id', profil!.agence_id!)
        .order('created_at', { ascending: false })
      return data as Invitation[]
    },
  })

  const inviter = useMutation({
    mutationFn: async () => {
      const token = crypto.randomUUID()
      const { error } = await supabase.from('invitations').insert({
        agence_id: profil!.agence_id!,
        email,
        role,
        token,
        created_by: profil!.id,
      })
      if (error) throw error
      return token
    },
    onSuccess: (token) => {
      setLienInvitation(`${window.location.origin}/signup?invite=${token}`)
      setEmail('')
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
    },
    onError: () => setErreur('Impossible de créer l’invitation.'),
  })

  const supprimer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('utilisateurs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['membres'] }),
  })

  const supprimerInvitation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invitations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    inviter.mutate()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-headline text-navy">Membres</h1>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-navy">Inviter un membre</h2>
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
          <div className="mt-4 rounded-md border border-gold bg-gold-container/30 p-3">
            <p className="mb-1 text-sm font-semibold text-navy">Lien d’invitation à partager (WhatsApp, email…) :</p>
            <p className="break-all text-sm text-navy">{lienInvitation}</p>
            <button
              type="button"
              className="btn-secondary mt-2 text-xs"
              onClick={() => navigator.clipboard.writeText(lienInvitation)}
            >
              Copier le lien
            </button>
          </div>
        )}
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {membres.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium text-navy">{m.nom}</td>
                  <td className="px-4 py-3">{m.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={m.role === 'gerant' ? 'ambre' : 'neutre'}>{m.role === 'gerant' ? 'Gérant' : 'Agent'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.user_id !== profil?.user_id && (
                      <button
                        onClick={() => supprimer.mutate(m.id)}
                        className="text-xs text-error hover:underline"
                      >
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {membres.length === 0 && <EmptyState message="Aucun membre pour le moment." />}
        </div>
      </Card>

      {invitations.filter((i) => !i.used_at).length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Email invité</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Expire le</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {invitations.filter((i) => !i.used_at).map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-4 py-3">{i.email}</td>
                    <td className="px-4 py-3">{i.role === 'gerant' ? 'Gérant' : 'Agent'}</td>
                    <td className="px-4 py-3">{new Date(i.expires_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => supprimerInvitation.mutate(i.id)} className="text-xs text-error hover:underline">
                        Annuler
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Ajouter la route**

Edit `src/App.tsx` :
```tsx
import Membres from './pages/Membres'
```
et dans les routes protégées :
```tsx
<Route path="/membres" element={<Membres />} />
```

- [ ] **Step 3: Vérification manuelle**

Instructions : connecté en gérant → `/membres` → générer un lien → ouvrir dans une fenêtre privée → s'inscrire avec l'email invité → le nouveau compte doit être rattaché à l'agence (visible dans la liste, badge Agent) et la fiche profil du nouvel utilisateur doit avoir `agence_id` renseigné.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Membres.tsx src/App.tsx
git commit -m "feat: membres — invitations par lien et gestion des agents (gérant)"
```

---

### Task 8: Groupes — liste et CRUD

**Files:**
- Create: `src/pages/Groupes.tsx`
- Modify: `src/App.tsx` (route `/liste-des-groupes`)

**Interfaces:**
- Consumes: `supabase`, `useAgence`, `genererTranches` non requis ici ; composants UI (Tasks 3-6)
- Produces: page `Groupes` (liste avec places inscrites/max ; création/édition via Modal ; suppression ; lien vers `/liste-des-pelerins?groupe=<id>`)

- [ ] **Step 1: Implémenter `src/pages/Groupes.tsx`**

Write `src/pages/Groupes.tsx` :
```tsx
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAgence } from '../hooks/useAgence'
import { LIBELLES_TYPE_VOYAGE } from '../lib/format'
import type { Groupe } from '../lib/types'
import Card from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'

interface GroupeAvecCompte extends Groupe {
  pelerins: { count: number }[]
}

export default function Groupes() {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()
  const [modalOuverte, setModalOuverte] = useState(false)
  const [enEdition, setEnEdition] = useState<Groupe | null>(null)
  const [form, setForm] = useState({ nom: '', type_voyage: 'hajj', date_depart: '', date_retour: '', nb_places_max: '0' })
  const [erreur, setErreur] = useState('')

  const { data: groupes = [] } = useQuery({
    queryKey: ['groupes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('groupes')
        .select('*, pelerins(count)')
        .order('date_depart', { ascending: false })
      return data as GroupeAvecCompte[]
    },
  })

  const ouvrirCreation = () => {
    setEnEdition(null)
    setForm({ nom: '', type_voyage: 'hajj', date_depart: '', date_retour: '', nb_places_max: '0' })
    setModalOuverte(true)
  }

  const ouvrirEdition = (g: GroupeAvecCompte) => {
    setEnEdition(g)
    setForm({
      nom: g.nom,
      type_voyage: g.type_voyage,
      date_depart: g.date_depart,
      date_retour: g.date_retour,
      nb_places_max: String(g.nb_places_max),
    })
    setModalOuverte(true)
  }

  const sauver = useMutation({
    mutationFn: async () => {
      const valeurs = {
        agence_id: agence!.id,
        nom: form.nom,
        type_voyage: form.type_voyage,
        date_depart: form.date_depart,
        date_retour: form.date_retour,
        nb_places_max: parseInt(form.nb_places_max, 10) || 0,
      }
      if (enEdition) {
        const { error } = await supabase.from('groupes').update(valeurs).eq('id', enEdition.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('groupes').insert(valeurs)
        if (error) throw error
      }
    },
    onSuccess: () => {
      setModalOuverte(false)
      queryClient.invalidateQueries({ queryKey: ['groupes'] })
    },
    onError: () => setErreur('Impossible d’enregistrer le groupe.'),
  })

  const supprimer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('groupes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groupes'] }),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    sauver.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-headline text-navy">Groupes</h1>
        <Button onClick={ouvrirCreation}>Nouveau groupe</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Départ</th>
                <th className="px-4 py-3">Retour</th>
                <th className="px-4 py-3">Places</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupes.map((g) => {
                const inscrits = g.pelerins[0]?.count ?? 0
                return (
                  <tr key={g.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-navy">
                      <Link to={`/liste-des-pelerins?groupe=${g.id}`} className="hover:underline">{g.nom}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={g.type_voyage === 'hajj' ? 'ambre' : 'neutre'}>{LIBELLES_TYPE_VOYAGE[g.type_voyage]}</Badge>
                    </td>
                    <td className="px-4 py-3">{new Date(g.date_depart).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">{new Date(g.date_retour).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3">
                      <span className={inscrits >= g.nb_places_max && g.nb_places_max > 0 ? 'font-semibold text-error' : ''}>
                        {inscrits} / {g.nb_places_max}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => ouvrirEdition(g)} className="mr-3 text-xs text-navy hover:underline">Modifier</button>
                      <button onClick={() => supprimer.mutate(g.id)} className="text-xs text-error hover:underline">Supprimer</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {groupes.length === 0 && <EmptyState message="Aucun groupe. Créez votre premier groupe Hajj ou Omra." />}
        </div>
      </Card>

      <Modal open={modalOuverte} title={enEdition ? 'Modifier le groupe' : 'Nouveau groupe'} onClose={() => setModalOuverte(false)}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nom">
            <Input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex : Hajj 2027" />
          </Field>
          <Field label="Type de voyage">
            <Select value={form.type_voyage} onChange={(e) => setForm({ ...form, type_voyage: e.target.value })}>
              <option value="hajj">Hajj</option>
              <option value="omra">Omra</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date de départ">
              <Input type="date" required value={form.date_depart} onChange={(e) => setForm({ ...form, date_depart: e.target.value })} />
            </Field>
            <Field label="Date de retour">
              <Input type="date" required value={form.date_retour} onChange={(e) => setForm({ ...form, date_retour: e.target.value })} />
            </Field>
          </div>
          <Field label="Nombre de places maximum">
            <Input type="number" min={0} value={form.nb_places_max} onChange={(e) => setForm({ ...form, nb_places_max: e.target.value })} />
          </Field>
          {erreur && <p className="text-sm text-error">{erreur}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setModalOuverte(false)}>Annuler</Button>
            <Button type="submit" disabled={sauver.isPending}>{enEdition ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 2: Ajouter la route**

Edit `src/App.tsx` :
```tsx
import Groupes from './pages/Groupes'
```
et :
```tsx
<Route path="/liste-des-groupes" element={<Groupes />} />
```

- [ ] **Step 3: Vérification manuelle**

Instructions : créer un groupe (Hajj 2027, départ/retour, 40 places) → le voir dans la liste → modifier → supprimer. RLS : vérifier qu'un compte d'une autre agence ne voit aucune ligne.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Groupes.tsx src/App.tsx
git commit -m "feat: groupes — liste et CRUD"
```

---

### Task 9: Pèlerins — liste, recherche, création, fiche

**Files:**
- Create: `src/pages/Pelerins.tsx`, `src/pages/PelerinDetail.tsx`
- Modify: `src/App.tsx` (routes `/liste-des-pelerins`, `/details-du-pelerin/:id`)

**Interfaces:**
- Consumes: `supabase`, `useAgence`, `formatFCFA`/`LIBELLES_*`, composants UI (Tasks 3-6)
- Produces: page `Pelerins` (recherche nom/téléphone, filtre `?groupe=`, table avec statut dossier et reste dû, création/édition) ; page `PelerinDetail` (identité + contact urgence + documents — complété en Task 10 — + plan de paiement — complété en Task 11)

- [ ] **Step 1: Implémenter `src/pages/Pelerins.tsx`**

Write `src/pages/Pelerins.tsx` :
```tsx
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAgence } from '../hooks/useAgence'
import { LIBELLES_DOSSIER, TONE_DOSSIER, formatFCFA } from '../lib/format'
import type { Groupe, Pelerin } from '../lib/types'
import Card from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import EmptyState from '../components/ui/EmptyState'

interface PelerinAvecJointures extends Pelerin {
  groupe: Groupe
  plan_paiement: {
    montant_total: number
    nombre_tranches: number
    tranches: { paiements: { montant_paye: number }[] }[]
  } | null
}

export default function Pelerins() {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const groupeFiltre = params.get('groupe') ?? ''
  const [recherche, setRecherche] = useState('')
  const [modalOuverte, setModalOuverte] = useState(false)
  const [erreur, setErreur] = useState('')
  const [form, setForm] = useState({ groupe_id: '', nom: '', prenom: '', telephone: '', email: '', sexe: 'M' })

  const { data: groupes = [] } = useQuery({
    queryKey: ['groupes'],
    queryFn: async () => {
      const { data } = await supabase.from('groupes').select('*').order('date_depart', { ascending: false })
      return data as Groupe[]
    },
  })

  const { data: pelerins = [] } = useQuery({
    queryKey: ['pelerins'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pelerins')
        .select('*, groupe:groupes(*), plan_paiement:plans_paiement(montant_total, nombre_tranches, tranches(paiements(montant_paye)))')
        .order('nom')
      return data as unknown as PelerinAvecJointures[]
    },
  })

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    return pelerins.filter((p) => {
      if (groupeFiltre && p.groupe_id !== groupeFiltre) return false
      if (!terme) return true
      return `${p.prenom} ${p.nom}`.toLowerCase().includes(terme) || p.telephone.includes(terme)
    })
  }, [pelerins, recherche, groupeFiltre])

  const sauver = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('pelerins').insert({
        agence_id: agence!.id,
        groupe_id: form.groupe_id,
        nom: form.nom,
        prenom: form.prenom,
        telephone: form.telephone,
        email: form.email || null,
        sexe: form.sexe as 'M' | 'F',
      })
      if (error) throw error
    },
    onSuccess: () => {
      setModalOuverte(false)
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: () => setErreur('Impossible d’inscrire le pèlerin.'),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    sauver.mutate()
  }

  const montantPaye = (p: PelerinAvecJointures) => {
    const paiements = p.plan_paiement?.tranches.flatMap((t) => t.paiements) ?? []
    return paiements.reduce((s, p) => s + p.montant_paye, 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-headline text-navy">Pèlerins</h1>
        <Button onClick={() => { setForm({ ...form, groupe_id: groupes[0]?.id ?? '' }); setModalOuverte(true) }}>
          Inscrire un pèlerin
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <Input
          placeholder="Rechercher par nom ou téléphone…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="max-w-xs"
        />
        <Select value={groupeFiltre} onChange={(e) => setParams(e.target.value ? { groupe: e.target.value } : {})} className="max-w-xs">
          <option value="">Tous les groupes</option>
          {groupes.map((g) => (
            <option key={g.id} value={g.id}>{g.nom}</option>
          ))}
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-navy">{p.prenom} {p.nom}</td>
                    <td className="px-4 py-3">{p.groupe?.nom ?? '—'}</td>
                    <td className="px-4 py-3">{p.telephone}</td>
                    <td className="px-4 py-3">
                      <Badge tone={TONE_DOSSIER[p.statut_dossier]}>{LIBELLES_DOSSIER[p.statut_dossier]}</Badge>
                    </td>
                    <td className="px-4 py-3">{p.plan_paiement ? formatFCFA(reste) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/details-du-pelerin/${p.id}`} className="text-xs text-navy hover:underline">Voir la fiche</Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtres.length === 0 && <EmptyState message="Aucun pèlerin trouvé." />}
        </div>
      </Card>

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
}
```

- [ ] **Step 2: Implémenter `src/pages/PelerinDetail.tsx` (identité — socle)**

Write `src/pages/PelerinDetail.tsx` :
```tsx
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_DOSSIER, LIBELLES_SEXE, TONE_DOSSIER, formatDate } from '../lib/format'
import type { Pelerin } from '../lib/types'
import Card from '../components/ui/Card'
import { Field, Input, Select } from '../components/ui/Field'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'

export default function PelerinDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [enEdition, setEnEdition] = useState(false)
  const [form, setForm] = useState<Pelerin | null>(null)
  const [erreur, setErreur] = useState('')

  const { data: pelerin, isLoading } = useQuery({
    queryKey: ['pelerin', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from('pelerins').select('*').eq('id', id!).single()
      return data as Pelerin
    },
  })

  const enregistrer = useMutation({
    mutationFn: async () => {
      if (!form) return
      const { error } = await supabase
        .from('pelerins')
        .update({
          nom: form.nom,
          prenom: form.prenom,
          telephone: form.telephone,
          email: form.email,
          date_naissance: form.date_naissance,
          sexe: form.sexe,
          contact_urgence_nom: form.contact_urgence_nom,
          contact_urgence_telephone: form.contact_urgence_telephone,
        })
        .eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      setEnEdition(false)
      queryClient.invalidateQueries({ queryKey: ['pelerin', id] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: () => setErreur('Impossible d’enregistrer.'),
  })

  if (isLoading) return <p className="text-navy">Chargement…</p>
  if (!pelerin) return <p className="text-error">Pèlerin introuvable.</p>

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/liste-des-pelerins" className="text-sm text-navy hover:underline">← Pèlerins</Link>
          <h1 className="text-headline mt-1 text-navy">{pelerin.prenom} {pelerin.nom}</h1>
          <div className="mt-1">
            <Badge tone={TONE_DOSSIER[pelerin.statut_dossier]}>Dossier {LIBELLES_DOSSIER[pelerin.statut_dossier]}</Badge>
          </div>
        </div>
        <Button variant="secondary" onClick={ouvrirEdition}>Modifier la fiche</Button>
      </div>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-navy">Identité</h2>
        {enEdition && form ? (
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <div className="flex gap-3 md:col-span-2">
              <Button type="submit" disabled={enregistrer.isPending}>Enregistrer</Button>
              <Button type="button" variant="secondary" onClick={() => setEnEdition(false)}>Annuler</Button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <div><dt className="label">Téléphone</dt><dd className="mt-1">{pelerin.telephone}</dd></div>
            <div><dt className="label">Email</dt><dd className="mt-1">{pelerin.email ?? '—'}</dd></div>
            <div><dt className="label">Naissance</dt><dd className="mt-1">{formatDate(pelerin.date_naissance)}</dd></div>
            <div><dt className="label">Sexe</dt><dd className="mt-1">{pelerin.sexe ? LIBELLES_SEXE[pelerin.sexe] : '—'}</dd></div>
            <div><dt className="label">Inscrit le</dt><dd className="mt-1">{formatDate(pelerin.date_inscription)}</dd></div>
            <div><dt className="label">Contact urgence</dt><dd className="mt-1">{pelerin.contact_urgence_nom ?? '—'} {pelerin.contact_urgence_telephone ? `(${pelerin.contact_urgence_telephone})` : ''}</dd></div>
          </dl>
        )}
      </Card>

      {/* Sections Documents (Task 10) et Plan de paiement (Task 11) ajoutées ci-dessous */}
    </div>
  )
}
```

- [ ] **Step 3: Ajouter les routes**

Edit `src/App.tsx` :
```tsx
import Pelerins from './pages/Pelerins'
import PelerinDetail from './pages/PelerinDetail'
```
et :
```tsx
<Route path="/liste-des-pelerins" element={<Pelerins />} />
<Route path="/details-du-pelerin/:id" element={<PelerinDetail />} />
```

- [ ] **Step 4: Vérifier le build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Pelerins.tsx src/pages/PelerinDetail.tsx src/App.tsx
git commit -m "feat: pèlerins — liste, recherche, inscription et fiche identité"
```

### Task 10: Documents — upload Storage, statuts, page dédiée

**Files:**
- Create: `src/components/documents/DocumentSection.tsx`, `src/pages/Documents.tsx`
- Modify: `src/App.tsx` (route `/gestion-des-documents`), `src/pages/PelerinDetail.tsx` (insérer `<DocumentSection />`)

**Interfaces:**
- Consumes: `supabase`, `useAgence`, `LIBELLES_DOCUMENT`/`TONE_DOCUMENT`/`formatDate`, composants UI (Tasks 3-6)
- Produces: `<DocumentSection pelerinId={...} />` (liste des documents du pèlerin, upload → bucket `documents_pelerins/{agence_id}/{pelerin_id}/`, changement de statut soumis/valide/rejete, suppression) ; page `Documents` (tous les documents de l'agence avec pèlerin, filtres par statut, actions valider/rejeter)

- [ ] **Step 1: Écrire le test qui échoue — logique de statut de dossier**

Le statut du dossier est recalculé par trigger SQL (Task 2) ; on teste ici la logique équivalente côté client pour l'affichage anticipé. Write `src/lib/plan.test.ts` — ajouter au fichier existant :
```ts
import { statutDossierDepuisDocuments } from './plan'

describe('statutDossierDepuisDocuments', () => {
  it('retourne valide si tous les documents sont valides', () => {
    expect(statutDossierDepuisDocuments(['valide', 'valide'])).toBe('valide')
  })
  it('retourne complet si tous sont soumis ou valides', () => {
    expect(statutDossierDepuisDocuments(['soumis', 'valide'])).toBe('complet')
  })
  it('retourne incomplet sinon', () => {
    expect(statutDossierDepuisDocuments(['manquant', 'valide'])).toBe('incomplet')
    expect(statutDossierDepuisDocuments([])).toBe('incomplet')
  })
})
```

- [ ] **Step 2: Implémenter `statutDossierDepuisDocuments` dans `src/lib/plan.ts`**

Ajouter à `src/lib/plan.ts` :
```ts
export function statutDossierDepuisDocuments(statuts: string[]): 'incomplet' | 'complet' | 'valide' {
  if (statuts.length === 0) return 'incomplet'
  if (statuts.every((s) => s === 'valide')) return 'valide'
  if (statuts.every((s) => s === 'soumis' || s === 'valide')) return 'complet'
  return 'incomplet'
}
```

- [ ] **Step 3: Lancer les tests**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Implémenter `src/components/documents/DocumentSection.tsx`**

Write `src/components/documents/DocumentSection.tsx` :
```tsx
import { useRef, type ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAgence } from '../../hooks/useAgence'
import { LIBELLES_DOCUMENT, TONE_DOCUMENT, formatDate } from '../../lib/format'
import type { Document } from '../../lib/types'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'

const TYPES_DOCUMENT = ['passeport', 'visa', 'certificat_vaccination', 'photo', 'autre'] as const

export default function DocumentSection({ pelerinId }: { pelerinId: string }) {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const typeChoisi = useRef<string>('passeport')

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', pelerinId],
    enabled: !!pelerinId,
    queryFn: async () => {
      const { data } = await supabase.from('documents').select('*').eq('pelerin_id', pelerinId).order('type_document')
      return data as Document[]
    },
  })

  const majStatut = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const { error } = await supabase.from('documents').update({ statut }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerin', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
  })

  const supprimer = useMutation({
    mutationFn: async (doc: Document) => {
      if (doc.fichier_url) {
        await supabase.storage.from('documents_pelerins').remove([doc.fichier_url])
      }
      const { error } = await supabase.from('documents').delete().eq('id', doc.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerin', pelerinId] })
    },
  })

  const televerser = useMutation({
    mutationFn: async ({ fichier, typeDocument }: { fichier: File; typeDocument: string }) => {
      const chemin = `${agence!.id}/${pelerinId}/${Date.now()}-${fichier.name}`
      const { error: eUpload } = await supabase.storage
        .from('documents_pelerins')
        .upload(chemin, fichier)
      if (eUpload) throw eUpload
      const { error: eInsert } = await supabase.from('documents').insert({
        agence_id: agence!.id,
        pelerin_id: pelerinId,
        type_document: typeDocument,
        fichier_url: chemin,
        statut: 'soumis',
        date_upload: new Date().toISOString(),
      })
      if (eInsert) throw eInsert
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerin', pelerinId] })
    },
  })

  async function voirFichier(doc: Document) {
    if (!doc.fichier_url) return
    const { data } = await supabase.storage
      .from('documents_pelerins')
      .createSignedUrl(doc.fichier_url, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function onChangeFichier(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (fichier) televerser.mutate({ fichier, typeDocument: typeChoisi.current })
    e.target.value = ''
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-sm font-semibold text-navy">Documents du dossier</h2>
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
          {televerser.isPending ? 'Upload…' : 'Téléverser un fichier'}
        </Button>
      </div>

      {documents.length === 0 && <EmptyState message="Aucun document pour ce pèlerin." />}
      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
            <div>
              <p className="text-sm font-medium text-navy">{LIBELLES_DOCUMENT[doc.type_document]}</p>
              <p className="text-xs text-gray-500">
                {doc.fichier_url ? 'Fichier joint' : 'Aucun fichier'} · Expire le {formatDate(doc.date_expiration)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={TONE_DOCUMENT[doc.statut]}>{doc.statut}</Badge>
              {doc.fichier_url && (
                <button onClick={() => voirFichier(doc)} className="text-xs text-navy hover:underline">Voir</button>
              )}
              {doc.statut !== 'valide' && (
                <button
                  onClick={() => majStatut.mutate({ id: doc.id, statut: 'valide' })}
                  className="text-xs text-green-700 hover:underline"
                >
                  Valider
                </button>
              )}
              {doc.statut === 'soumis' && (
                <button
                  onClick={() => majStatut.mutate({ id: doc.id, statut: 'rejete' })}
                  className="text-xs text-error hover:underline"
                >
                  Rejeter
                </button>
              )}
              <button onClick={() => supprimer.mutate(doc)} className="text-xs text-gray-400 hover:text-error">Suppr.</button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
```

- [ ] **Step 5: Insérer la section dans la fiche pèlerin**

Edit `src/pages/PelerinDetail.tsx` :
```tsx
import DocumentSection from '../components/documents/DocumentSection'
```
et remplacer le commentaire `{/* Sections Documents (Task 10) et Plan de paiement (Task 11) ajoutées ci-dessous */}` par :
```tsx
<DocumentSection pelerinId={pelerin.id} />
```

- [ ] **Step 6: Implémenter `src/pages/Documents.tsx`**

Write `src/pages/Documents.tsx` :
```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_DOCUMENT, TONE_DOCUMENT, formatDate } from '../lib/format'
import type { Document } from '../lib/types'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'

interface DocumentAvecPelerin extends Document {
  pelerin: { id: string; prenom: string; nom: string; telephone: string }
}

export default function Documents() {
  const queryClient = useQueryClient()
  const [filtre, setFiltre] = useState('')

  const { data: documents = [] } = useQuery({
    queryKey: ['documents-tous'],
    queryFn: async () => {
      const { data } = await supabase
        .from('documents')
        .select('*, pelerin:pelerins(id, prenom, nom, telephone)')
        .order('date_upload', { ascending: false })
      return data as unknown as DocumentAvecPelerin[]
    },
  })

  const filtres = filtre ? documents.filter((d) => d.statut === filtre) : documents

  const majStatut = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const { error } = await supabase.from('documents').update({ statut }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents-tous'] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-headline text-navy">Gestion des documents</h1>
        <select className="input max-w-xs" value={filtre} onChange={(e) => setFiltre(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="manquant">Manquant</option>
          <option value="soumis">Soumis</option>
          <option value="valide">Validé</option>
          <option value="rejete">Rejeté</option>
        </select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link to={`/details-du-pelerin/${d.pelerin.id}`} className="font-medium text-navy hover:underline">
                      {d.pelerin.prenom} {d.pelerin.nom}
                    </Link>
                    <p className="text-xs text-gray-500">{d.pelerin.telephone}</p>
                  </td>
                  <td className="px-4 py-3">{LIBELLES_DOCUMENT[d.type_document]}</td>
                  <td className="px-4 py-3">
                    <Badge tone={TONE_DOCUMENT[d.statut]}>{d.statut}</Badge>
                  </td>
                  <td className="px-4 py-3">{formatDate(d.date_expiration)}</td>
                  <td className="px-4 py-3 text-right">
                    {d.statut !== 'valide' && (
                      <button
                        onClick={() => majStatut.mutate({ id: d.id, statut: 'valide' })}
                        className="mr-3 text-xs text-green-700 hover:underline"
                      >
                        Valider
                      </button>
                    )}
                    {d.statut === 'soumis' && (
                      <button
                        onClick={() => majStatut.mutate({ id: d.id, statut: 'rejete' })}
                        className="text-xs text-error hover:underline"
                      >
                        Rejeter
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtres.length === 0 && <EmptyState message="Aucun document pour ce filtre." />}
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 7: Ajouter la route**

Edit `src/App.tsx` :
```tsx
import Documents from './pages/Documents'
```
et :
```tsx
<Route path="/gestion-des-documents" element={<Documents />} />
```

- [ ] **Step 8: Vérifications**

Run: `npm run build` puis `npm run test` — les deux doivent passer. Vérification manuelle : sur la fiche pèlerin, téléverser un PDF → statut « soumis » → Valider → le badge Dossier passe à « Validé » (trigger SQL). Vérifier dans le Dashboard Supabase → Storage que le fichier est sous `documents_pelerins/{agence_id}/{pelerin_id}/`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/plan.ts src/lib/plan.test.ts src/components/documents src/pages/Documents.tsx src/pages/PelerinDetail.tsx src/App.tsx
git commit -m "feat: documents — upload Storage, statuts avec trigger, page dédiée"
```

---

### Task 11: Paiements — plan, tranches, encaissements, échéanciers

**Files:**
- Create: `src/components/paiements/PlanPaiementSection.tsx`, `src/pages/Paiements.tsx`
- Modify: `src/pages/PelerinDetail.tsx` (insérer `<PlanPaiementSection />`), `src/App.tsx` (route `/paiements-echeanciers`)

**Interfaces:**
- Consumes: `supabase`, `useAgence`, `genererTranches`, `formatFCFA`/`LIBELLES_TRANCHE`/`LIBELLES_MODE`/`TONE_TRANCHE`/`formatDate`, composants UI (Tasks 3-6)
- Produces: `<PlanPaiementSection pelerinId={...} />` (création plan + tranches, timeline de paiement, encaissement, rappels — liste des tranches et encaissement) ; page `Paiements` (échéancier global : plans avec payé/reste dû, barre de progression, tranches en retard mises en avant)

- [ ] **Step 1: Implémenter `src/components/paiements/PlanPaiementSection.tsx`**

Write `src/components/paiements/PlanPaiementSection.tsx` :
```tsx
import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAgence } from '../../hooks/useAgence'
import { genererTranches } from '../../lib/plan'
import { LIBELLES_MODE, LIBELLES_TRANCHE, TONE_TRANCHE, formatDate, formatFCFA } from '../../lib/format'
import type { Paiement, PlanPaiement, Tranche } from '../../lib/types'
import Card from '../ui/Card'
import { Field, Input, Select } from '../ui/Field'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'

interface PlanAvecDonnees extends PlanPaiement {
  tranches: (Tranche & { paiements: Paiement[] })[]
}

export default function PlanPaiementSection({ pelerinId }: { pelerinId: string }) {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()
  const [creation, setCreation] = useState(false)
  const [montantTotal, setMontantTotal] = useState('')
  const [nombreTranches, setNombreTranches] = useState('3')
  const [premiereEcheance, setPremiereEcheance] = useState('')
  const [encaissement, setEncaissement] = useState<{ tranche: Tranche; ouvert: boolean }>({ tranche: null!, ouvert: false })
  const [montantPaiement, setMontantPaiement] = useState('')
  const [modePaiement, setModePaiement] = useState('especes')
  const [reference, setReference] = useState('')
  const [erreur, setErreur] = useState('')

  const { data: plan, isLoading } = useQuery({
    queryKey: ['plan', pelerinId],
    enabled: !!pelerinId,
    queryFn: async () => {
      const { data } = await supabase
        .from('plans_paiement')
        .select('*, tranches(*, paiements(*))')
        .eq('pelerin_id', pelerinId)
        .maybeSingle()
      return data as PlanAvecDonnees | null
    },
  })

  const creerPlan = useMutation({
    mutationFn: async () => {
      const total = parseInt(montantTotal, 10)
      const nombre = parseInt(nombreTranches, 10)
      if (!total || total <= 0 || !nombre || nombre <= 0 || !premiereEcheance) {
        throw new Error('Champs invalides')
      }
      const { data: nouveauPlan, error: e1 } = await supabase
        .from('plans_paiement')
        .insert({ agence_id: agence!.id, pelerin_id: pelerinId, montant_total: total, nombre_tranches: nombre })
        .select('id')
        .single()
      if (e1 || !nouveauPlan) throw e1
      const tranches = genererTranches(total, nombre, premiereEcheance).map((t) => ({
        agence_id: agence!.id,
        plan_paiement_id: nouveauPlan.id,
        ...t,
      }))
      const { error: e2 } = await supabase.from('tranches').insert(tranches)
      if (e2) throw e2
    },
    onSuccess: () => {
      setCreation(false)
      setMontantTotal('')
      setPremiereEcheance('')
      queryClient.invalidateQueries({ queryKey: ['plan', pelerinId] })
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: (e: Error) => setErreur(e.message === 'Champs invalides' ? 'Renseignez un montant, un nombre de tranches et une première échéance.' : 'Impossible de créer le plan.'),
  })

  const encaisser = useMutation({
    mutationFn: async () => {
      const montant = parseInt(montantPaiement, 10)
      if (!montant || montant <= 0) throw new Error('Montant invalide')
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
      queryClient.invalidateQueries({ queryKey: ['pelerins'] })
    },
    onError: (e: Error) => setErreur(e.message === 'Montant invalide' ? 'Saisissez un montant positif.' : 'Encaissement impossible.'),
  })

  if (isLoading) return <Card className="p-6"><p className="text-sm text-navy">Chargement…</p></Card>

  if (!plan) {
    return (
      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-navy">Plan de paiement</h2>
        {creation ? (
          <form
            onSubmit={(e: FormEvent) => { e.preventDefault(); setErreur(''); creerPlan.mutate() }}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <Field label="Montant total (FCFA)">
              <Input required type="number" min={1} value={montantTotal} onChange={(e) => setMontantTotal(e.target.value)} />
            </Field>
            <Field label="Nombre de tranches">
              <Input required type="number" min={1} value={nombreTranches} onChange={(e) => setNombreTranches(e.target.value)} />
            </Field>
            <Field label="Première échéance">
              <Input required type="date" value={premiereEcheance} onChange={(e) => setPremiereEcheance(e.target.value)} />
            </Field>
            {erreur && <p className="text-sm text-error md:col-span-3">{erreur}</p>}
            <div className="flex gap-3 md:col-span-3">
              <Button type="submit" disabled={creerPlan.isPending}>Créer le plan</Button>
              <Button type="button" variant="secondary" onClick={() => setCreation(false)}>Annuler</Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Aucun plan de paiement pour ce pèlerin.</p>
            <Button variant="secondary" onClick={() => setCreation(true)}>Créer un plan</Button>
          </div>
        )}
      </Card>
    )
  }

  const paye = plan.tranches.reduce((s, t) => s + t.paiements.reduce((x, p) => x + p.montant_paye, 0), 0)
  const reste = plan.montant_total - paye
  const progression = plan.montant_total > 0 ? Math.round((paye / plan.montant_total) * 100) : 0

  function ouvrirEncaissement(tranche: Tranche) {
    setMontantPaiement('')
    setReference('')
    setEncaissement({ tranche, ouvert: true })
  }

  return (
    <Card className="p-6">
      <h2 className="mb-2 text-sm font-semibold text-navy">Plan de paiement</h2>
      <div className="mb-4 flex flex-wrap items-center gap-6 text-sm">
        <p>Total : <span className="font-semibold text-navy">{formatFCFA(plan.montant_total)}</span></p>
        <p>Payé : <span className="font-semibold text-green-700">{formatFCFA(paye)}</span></p>
        <p>Reste dû : <span className={`font-semibold ${reste > 0 ? 'text-error' : 'text-green-700'}`}>{formatFCFA(reste)}</span></p>
        <div className="h-2 w-48 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-gold" style={{ width: `${progression}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {plan.tranches.map((t) => {
          const verse = t.paiements.reduce((s, p) => s + p.montant_paye, 0)
          return (
            <div key={t.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-navy">Tranche {t.numero_tranche} — {formatFCFA(t.montant_prevu)}</p>
                  <p className="text-xs text-gray-500">Échéance {formatDate(t.date_echeance)} · Versé {formatFCFA(verse)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={TONE_TRANCHE[t.statut]}>{LIBELLES_TRANCHE[t.statut]}</Badge>
                  {verse < t.montant_prevu && (
                    <Button variant="secondary" onClick={() => ouvrirEncaissement(t)}>Encaisser</Button>
                  )}
                </div>
              </div>
              {t.paiements.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-gray-600">
                  {t.paiements.map((p) => (
                    <li key={p.id}>
                      {formatDate(p.date_paiement)} — {formatFCFA(p.montant_paye)} ({LIBELLES_MODE[p.mode]}{p.reference ? ` — réf. ${p.reference}` : ''})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {encaissement.ouvert && (
        <div className="mt-4 rounded-md border border-navy bg-surface p-4">
          <p className="mb-3 text-sm font-semibold text-navy">
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
    </Card>
  )
}
```

- [ ] **Step 2: Insérer la section dans la fiche pèlerin**

Edit `src/pages/PelerinDetail.tsx` :
```tsx
import PlanPaiementSection from '../components/paiements/PlanPaiementSection'
```
et juste après `<DocumentSection pelerinId={pelerin.id} />` :
```tsx
<PlanPaiementSection pelerinId={pelerin.id} />
```

- [ ] **Step 3: Implémenter `src/pages/Paiements.tsx`**

Write `src/pages/Paiements.tsx` :
```tsx
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_TRANCHE, TONE_TRANCHE, formatDate, formatFCFA } from '../lib/format'
import type { Paiement, PlanPaiement, Tranche } from '../lib/types'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import AlertPanel from '../components/ui/AlertPanel'
import EmptyState from '../components/ui/EmptyState'

interface PlanEcheancier extends PlanPaiement {
  pelerin: { id: string; prenom: string; nom: string; telephone: string }
  tranches: (Tranche & { paiements: Paiement[] })[]
}

export default function Paiements() {
  const { data: plans = [] } = useQuery({
    queryKey: ['echeanciers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('plans_paiement')
        .select('*, pelerin:pelerins(id, prenom, nom, telephone), tranches(*, paiements(*))')
        .order('created_at', { ascending: false })
      return data as unknown as PlanEcheancier[]
    },
  })

  const enRetard = plans.flatMap((p) =>
    p.tranches.filter((t) => t.statut === 'en_retard').map((t) => ({ p, t }))
  )

  const totals = plans.reduce(
    (acc, p) => {
      const paye = p.tranches.reduce((s, t) => s + t.paiements.reduce((x, y) => x + y.montant_paye, 0), 0)
      return { total: acc.total + p.montant_total, paye: acc.paye + paye }
    },
    { total: 0, paye: 0 }
  )

  return (
    <div className="space-y-6">
      <h1 className="text-headline text-navy">Paiements & échéanciers</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="label">Total attendu</p>
          <p className="mt-1 text-lg font-semibold text-navy">{formatFCFA(totals.total)}</p>
        </Card>
        <Card className="p-5">
          <p className="label">Total encaissé</p>
          <p className="mt-1 text-lg font-semibold text-green-700">{formatFCFA(totals.paye)}</p>
        </Card>
        <Card className="p-5">
          <p className="label">Reste global</p>
          <p className="mt-1 text-lg font-semibold text-error">{formatFCFA(totals.total - totals.paye)}</p>
        </Card>
      </div>

      {enRetard.length > 0 && (
        <AlertPanel tone="rouge" title={`${enRetard.length} tranche(s) en retard`}>
          {enRetard.map(({ p, t }) => (
            <p key={t.id}>
              {p.pelerin.prenom} {p.pelerin.nom} — tranche {t.numero_tranche} ({formatFCFA(t.montant_prevu)}), échéance {formatDate(t.date_echeance)}.
            </p>
          ))}
        </AlertPanel>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link to={`/details-du-pelerin/${p.pelerin.id}`} className="font-medium text-navy hover:underline">
                        {p.pelerin.prenom} {p.pelerin.nom}
                      </Link>
                      <p className="text-xs text-gray-500">{p.pelerin.telephone}</p>
                    </td>
                    <td className="px-4 py-3">{formatFCFA(p.montant_total)} · {p.nombre_tranches} tranches</td>
                    <td className="px-4 py-3 text-green-700">{formatFCFA(paye)}</td>
                    <td className={`px-4 py-3 font-medium ${reste > 0 ? 'text-error' : 'text-green-700'}`}>{formatFCFA(reste)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${progression}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{progression}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.tranches.filter((t) => t.statut === 'en_retard').length > 0 && (
                        <Badge tone="rouge">{p.tranches.filter((t) => t.statut === 'en_retard').length} en retard</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {plans.length === 0 && <EmptyState message="Aucun plan de paiement." />}
        </div>
      </Card>

      <Card>
        <h2 className="px-6 pt-5 text-sm font-semibold text-navy">Détail des tranches</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f1f5f9] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Pèlerin</th>
                <th className="px-4 py-3">Tranche</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Échéance</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {plans.flatMap((p) =>
                p.tranches.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-4 py-3">{p.pelerin.prenom} {p.pelerin.nom}</td>
                    <td className="px-4 py-3">Tranche {t.numero_tranche}</td>
                    <td className="px-4 py-3">{formatFCFA(t.montant_prevu)}</td>
                    <td className="px-4 py-3">{formatDate(t.date_echeance)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={TONE_TRANCHE[t.statut]}>{LIBELLES_TRANCHE[t.statut]}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Ajouter la route**

Edit `src/App.tsx` :
```tsx
import Paiements from './pages/Paiements'
```
et :
```tsx
<Route path="/paiements-echeanciers" element={<Paiements />} />
```

- [ ] **Step 5: Vérifications**

Run: `npm run build` puis `npm run test` — les deux doivent passer. Vérification manuelle : créer un plan 750 000 FCFA / 3 tranches sur un pèlerin → 3 tranches visibles → encaisser 250 000 sur la tranche 1 → statut « Partielle », reste dû 500 000 → encaisser le solde → statut « Payée ». Dans SQL Editor, vérifier le trigger :
```sql
select id, statut from public.tranches order by numero_tranche;
```

- [ ] **Step 6: Commit**

```bash
git add src/components/paiements src/pages/Paiements.tsx src/pages/PelerinDetail.tsx src/App.tsx
git commit -m "feat: paiements — plans, tranches, encaissements et échéancier global"
```

### Task 12: Rappels WhatsApp + Dashboard

**Files:**
- Create: `src/components/rappels/RappelSection.tsx`, `src/pages/Dashboard.tsx`
- Modify: `src/pages/PelerinDetail.tsx` (insérer `<RappelSection />`), `src/App.tsx` (route `/tableau-de-bord`)

**Interfaces:**
- Consumes: `supabase`, `whatsappUrl`/`messageTranche`/`messageDocument`/`LIBELLES_RAPPEL`/`TONE_RAPPEL`/`formatDate`/`formatFCFA`, composants UI (Tasks 3-6)
- Produces: `<RappelSection pelerinId={...} />` (création d'un rappel manuel par tranche ou document, bouton « Envoyer sur WhatsApp » → `wa.me`, marquer envoyé/échec) ; page `Dashboard` (compteurs : rappels en attente, tranches en retard, dossiers incomplets ; alert panels avec actions directes)

`messageDocument` et `LIBELLES_DOC_STATUT` sont déjà définis et testés en Task 3 — pas de TDD à refaire ici.

- [ ] **Step 1: Implémenter `src/components/rappels/RappelSection.tsx`**

Write `src/components/rappels/RappelSection.tsx` :
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAgence } from '../../hooks/useAgence'
import {
  LIBELLES_DOCUMENT, LIBELLES_RAPPEL, TONE_RAPPEL,
  formatDate, formatFCFA, messageDocument, messageTranche, whatsappUrl,
} from '../../lib/format'
import type { Document, Rappel, Tranche } from '../../lib/types'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'

interface RappelAvecCible extends Rappel {
  tranche: (Tranche & { plan_paiement: { pelerin_id: string; montant_total: number } }) | null
  document: (Document & { pelerin_id: string }) | null
}

export default function RappelSection({ pelerinId }: { pelerinId: string }) {
  const { data: agence } = useAgence()
  const queryClient = useQueryClient()

  const { data: pelerin } = useQuery({
    queryKey: ['pelerin', pelerinId],
    queryFn: async () => {
      const { data } = await supabase.from('pelerins').select('*').eq('id', pelerinId).single()
      return data as { id: string; prenom: string; nom: string; telephone: string }
    },
  })

  const { data: tranches = [] } = useQuery({
    queryKey: ['tranches-sans-plan', pelerinId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tranches')
        .select('*, plan_paiement:plans_paiement!inner(montant_total)')
        .eq('plan_paiement.pelerin_id', pelerinId)
      return data as unknown as (Tranche & { plan_paiement: { montant_total: number } })[]
    },
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', pelerinId],
    queryFn: async () => {
      const { data } = await supabase.from('documents').select('*').eq('pelerin_id', pelerinId)
      return data as Document[]
    },
  })

  const { data: rappels = [] } = useQuery({
    queryKey: ['rappels', pelerinId],
    queryFn: async () => {
      const { data } = await supabase
        .from('rappels')
        .select('*, tranche:tranches(plan_paiement:plans_paiement(pelerin_id, montant_total)), document:documents(*)')
        .order('date_envoi_prevue', { ascending: false })
      const tous = (data as unknown as RappelAvecCible[]) ?? []
      return tous.filter((r) => {
        const pelerinTranche = r.tranche?.plan_paiement?.pelerin_id
        const pelerinDocument = r.document?.pelerin_id
        return pelerinTranche === pelerinId || pelerinDocument === pelerinId
      })
    },
  })

  const creerRappel = useMutation({
    mutationFn: async (cible: { trancheId?: string; documentId?: string }) => {
      const { error } = await supabase.from('rappels').insert({
        agence_id: agence!.id,
        tranche_id: cible.trancheId ?? null,
        document_id: cible.documentId ?? null,
        canal: 'whatsapp',
        date_envoi_prevue: new Date().toISOString(),
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rappels', pelerinId] }),
  })

  const majStatutRappel = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const { error } = await supabase
        .from('rappels')
        .update({
          statut_envoi: statut,
          date_envoi_reelle: statut === 'envoye' ? new Date().toISOString() : null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rappels', pelerinId] }),
  })

  function messagePour(r: RappelAvecCible): string {
    if (!pelerin) return ''
    if (r.tranche) {
      return messageTranche(pelerin.prenom, pelerin.nom, r.tranche.numero_tranche, r.tranche.montant_prevu, r.tranche.date_echeance)
    }
    if (r.document) {
      return messageDocument(pelerin.prenom, pelerin.nom, r.document.type_document, r.document.statut)
    }
    return ''
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-sm font-semibold text-navy">Rappels WhatsApp</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {tranches.filter((t) => t.statut !== 'payee').map((t) => (
          <Button
            key={t.id}
            variant="secondary"
            disabled={creerRappel.isPending}
            onClick={() => creerRappel.mutate({ trancheId: t.id })}
          >
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
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium text-navy">{libelle}</p>
                <p className="text-xs text-gray-500">Prévu le {formatDate(r.date_envoi_prevue)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={TONE_RAPPEL[r.statut_envoi]}>{LIBELLES_RAPPEL[r.statut_envoi]}</Badge>
                {pelerin && r.statut_envoi !== 'envoye' && (
                  <a
                    href={whatsappUrl(pelerin.telephone, messagePour(r))}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary text-xs"
                  >
                    Envoyer sur WhatsApp
                  </a>
                )}
                {r.statut_envoi === 'en_attente' && (
                  <button
                    onClick={() => majStatutRappel.mutate({ id: r.id, statut: 'envoye' })}
                    className="text-xs text-green-700 hover:underline"
                  >
                    Marquer envoyé
                  </button>
                )}
                {r.statut_envoi !== 'echec' && r.statut_envoi !== 'envoye' && (
                  <button
                    onClick={() => majStatutRappel.mutate({ id: r.id, statut: 'echec' })}
                    className="text-xs text-error hover:underline"
                  >
                    Échec
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
```

- [ ] **Step 2: Insérer la section dans la fiche pèlerin**

Edit `src/pages/PelerinDetail.tsx` :
```tsx
import RappelSection from '../components/rappels/RappelSection'
```
et après `<PlanPaiementSection pelerinId={pelerin.id} />` :
```tsx
<RappelSection pelerinId={pelerin.id} />
```

- [ ] **Step 3: Implémenter `src/pages/Dashboard.tsx`**

Write `src/pages/Dashboard.tsx` :
```tsx
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { LIBELLES_DOCUMENT, LIBELLES_DOSSIER, TONE_DOSSIER, formatDate, formatFCFA } from '../lib/format'
import type { Pelerin, Tranche } from '../lib/types'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import AlertPanel from '../components/ui/AlertPanel'
import EmptyState from '../components/ui/EmptyState'

interface TrancheAvecPelerin extends Tranche {
  plan_paiement: { pelerin: Pelerin }
}

interface RappelAvecCible {
  id: string
  statut_envoi: string
  date_envoi_prevue: string
  tranche: (Tranche & { plan_paiement: { pelerin: Pelerin } }) | null
  document: { id: string; type_document: string; pelerin: Pelerin } | null
}

export default function Dashboard() {
  const { data: rappels = [] } = useQuery({
    queryKey: ['dashboard-rappels'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rappels')
        .select('id, statut_envoi, date_envoi_prevue, tranche:tranches(numero_tranche, montant_prevu, date_echeance, plan_paiement:plans_paiement(pelerin:pelerins(*))), document:documents(type_document, pelerin:pelerins(*))')
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

  return (
    <div className="space-y-6">
      <h1 className="text-headline text-navy">Tableau de bord</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="label">Rappels en attente</p>
          <p className="mt-1 text-lg font-semibold text-navy">{rappels.length}</p>
        </Card>
        <Card className="p-5">
          <p className="label">Tranches en retard</p>
          <p className="mt-1 text-lg font-semibold text-error">{tranchesRetard.length}</p>
        </Card>
        <Card className="p-5">
          <p className="label">Dossiers incomplets</p>
          <p className="mt-1 text-lg font-semibold text-ambre">{dossiersIncomplets.length}</p>
        </Card>
      </div>

      {rappels.length > 0 && (
        <AlertPanel tone="ambre" title="Rappels à envoyer">
          {rappels.map((r) => {
            const cible = r.tranche
              ? `Tranche ${r.tranche.numero_tranche} — ${formatFCFA(r.tranche.montant_prevu)}`
              : r.document
                ? LIBELLES_DOCUMENT[r.document.type_document]
                : '—'
            const pelerin = r.tranche?.plan_paiement.pelerin ?? r.document?.pelerin
            if (!pelerin) return null
            return (
              <p key={r.id}>
                <Link to={`/details-du-pelerin/${pelerin.id}`} className="font-medium text-navy hover:underline">
                  {pelerin.prenom} {pelerin.nom}
                </Link>{' '}
                — {cible} (prévu {formatDate(r.date_envoi_prevue)})
              </p>
            )
          })}
        </AlertPanel>
      )}

      {tranchesRetard.length > 0 && (
        <AlertPanel tone="rouge" title="Tranches en retard">
          {tranchesRetard.map((t) => (
            <p key={t.id}>
              <Link to={`/details-du-pelerin/${t.plan_paiement.pelerin.id}`} className="font-medium text-navy hover:underline">
                {t.plan_paiement.pelerin.prenom} {t.plan_paiement.pelerin.nom}
              </Link>{' '}
              — tranche {t.numero_tranche} ({formatFCFA(t.montant_prevu)}), échéance {formatDate(t.date_echeance)}
            </p>
          ))}
        </AlertPanel>
      )}

      {dossiersIncomplets.length > 0 && (
        <AlertPanel tone="ambre" title="Dossiers à compléter">
          {dossiersIncomplets.map((p) => (
            <p key={p.id}>
              <Link to={`/details-du-pelerin/${p.id}`} className="font-medium text-navy hover:underline">
                {p.prenom} {p.nom}
              </Link>{' '}
              — <Badge tone={TONE_DOSSIER[p.statut_dossier]}>{LIBELLES_DOSSIER[p.statut_dossier]}</Badge>
            </p>
          ))}
        </AlertPanel>
      )}

      {rappels.length === 0 && tranchesRetard.length === 0 && dossiersIncomplets.length === 0 && (
        <Card>
          <EmptyState message="Tout est à jour. Rien à traiter aujourd’hui." />
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Ajouter la route**

Edit `src/App.tsx` :
```tsx
import Dashboard from './pages/Dashboard'
```
et :
```tsx
<Route path="/tableau-de-bord" element={<Dashboard />} />
```

- [ ] **Step 5: Vérifications**

Run: `npm run build` puis `npm run test` — les deux doivent passer. Vérification manuelle : fiche pèlerin → « Rappel tranche 1 » → bouton « Envoyer sur WhatsApp » ouvre `wa.me/<téléphone>?text=<message encodé>` → « Marquer envoyé » → le rappel disparaît du dashboard.

- [ ] **Step 6: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts src/components/rappels src/pages/Dashboard.tsx src/pages/PelerinDetail.tsx src/App.tsx
git commit -m "feat: rappels WhatsApp (wa.me + suivi) et tableau de bord"
```

---

### Task 13: Seed, vérification finale et déploiement Vercel

**Files:**
- Create: `supabase/seed.sql`, `scripts/seed-auth.mjs`, `README.md`
- Modify: `package.json` (script `seed:auth`), `.env.example` (déjà créé en Task 1)

**Interfaces:**
- Consumes: schéma (Task 2), comptes auth (Task 4), trigger `handle_new_user` (Task 2)
- Produces: jeu de données sénégalais de démonstration (2 agences, 3 groupes, 4 pèlerins, documents, plans FCFA, tranche partielle, rappels) ; 4 comptes auth reliés aux `utilisateurs` seedés ; README d'installation et de déploiement

- [ ] **Step 1: Écrire `supabase/seed.sql`**

Write `supabase/seed.sql` :
```sql
-- ============================================================
-- SEED « Stitch Sama Pèlerin » — données de démonstration
-- Appliquer après schema.sql. Comptes auth créés ensuite par
-- scripts/seed-auth.mjs (le trigger les relie aux emails).
-- ============================================================

insert into public.agences (id, nom, telephone, email, adresse) values
  ('10000000-0000-4000-8000-000000000001', 'Al Hidjah Travel Dakar', '+221 33 821 45 67', 'contact@alhidjah.sn', 'Sacré Cœur 3, Dakar'),
  ('10000000-0000-4000-8000-000000000002', 'Voyages Al-Barakah', '+221 77 640 12 89', 'info@albarakah.sn', 'Parcelles Assainies, Dakar');

insert into public.utilisateurs (id, user_id, agence_id, nom, email, role) values
  ('20000000-0000-4000-8000-000000000001', null, '10000000-0000-4000-8000-000000000001', 'Moussa Ndiaye', 'moussa@alhidjah.sn', 'gerant'),
  ('20000000-0000-4000-8000-000000000002', null, '10000000-0000-4000-8000-000000000001', 'Fatou Diop', 'fatou@alhidjah.sn', 'agent'),
  ('20000000-0000-4000-8000-000000000003', null, '10000000-0000-4000-8000-000000000002', 'Omar Fall', 'omar@albarakah.sn', 'gerant'),
  ('20000000-0000-4000-8000-000000000004', null, '10000000-0000-4000-8000-000000000002', 'Aissatou Sy', 'aissatou@albarakah.sn', 'agent');

insert into public.groupes (id, agence_id, nom, type_voyage, date_depart, date_retour, nb_places_max) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Hajj 2027', 'hajj', '2027-05-10', '2027-06-15', 40),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Omra Ramadan 2027', 'omra', '2027-02-01', '2027-02-20', 30),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Omra Décembre 2026', 'omra', '2026-12-10', '2026-12-25', 25);

insert into public.pelerins (id, agence_id, groupe_id, nom, prenom, telephone, email, date_naissance, sexe, contact_urgence_nom, contact_urgence_telephone) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Ndiaye', 'Awa', '+221 77 123 45 67', 'awa.ndiaye@mail.sn', '1985-03-12', 'F', 'Mamadou Ndiaye', '+221 77 111 22 33'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Diop', 'Cheikh', '+221 76 234 56 78', 'cheikh.diop@mail.sn', '1979-07-25', 'M', 'Aminata Diop', '+221 76 444 55 66'),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Fall', 'Ousmane', '+221 70 345 67 89', 'ousmane.fall@mail.sn', '1990-01-05', 'M', 'Khady Fall', '+221 70 777 88 99'),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'Sy', 'Mariama', '+221 78 456 78 90', 'mariama.sy@mail.sn', '1988-11-19', 'F', 'Ibrahima Sy', '+221 78 999 00 11');

insert into public.documents (id, agence_id, pelerin_id, type_document, date_expiration, statut) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'passeport', '2027-04-30', 'valide'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'visa', null, 'manquant'),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'certificat_vaccination', '2027-05-01', 'soumis'),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'passeport', '2026-10-15', 'rejete'),
  ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'passeport', '2027-01-20', 'valide'),
  ('50000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004', 'passeport', '2027-02-10', 'valide'),
  ('50000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004', 'visa', null, 'manquant');

insert into public.plans_paiement (id, agence_id, pelerin_id, montant_total, nombre_tranches) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 2500000, 5),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 2500000, 5),
  ('60000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 800000, 3),
  ('60000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000004', 750000, 3);

insert into public.tranches (id, agence_id, plan_paiement_id, numero_tranche, montant_prevu, date_echeance) values
  ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 1, 500000, '2026-09-15'),
  ('70000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 2, 500000, '2026-12-15'),
  ('70000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 3, 500000, '2027-02-15'),
  ('70000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 4, 500000, '2027-03-15'),
  ('70000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 5, 500000, '2027-04-15'),
  ('70000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 1, 500000, '2026-08-01'),
  ('70000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 2, 500000, '2026-11-01'),
  ('70000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 3, 500000, '2027-01-01'),
  ('70000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 4, 500000, '2027-02-01'),
  ('70000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000002', 5, 500000, '2027-03-01'),
  ('70000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003', 1, 266667, '2026-10-01'),
  ('70000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003', 2, 266667, '2026-11-01'),
  ('70000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000003', 3, 266666, '2026-12-01'),
  ('70000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004', 1, 250000, '2026-09-01'),
  ('70000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004', 2, 250000, '2026-10-01'),
  ('70000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000004', 3, 250000, '2026-11-01');

insert into public.paiements (id, agence_id, tranche_id, montant_paye, mode, reference, enregistre_par) values
  ('80000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 250000, 'wave', 'WAVE-2026-0813-A1', '20000000-0000-4000-8000-000000000001'),
  ('80000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000006', 500000, 'especes', null, '20000000-0000-4000-8000-000000000002'),
  ('80000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000014', 250000, 'orange_money', 'OM-88001', '20000000-0000-4000-8000-000000000003');

insert into public.rappels (id, agence_id, tranche_id, document_id, canal, date_envoi_prevue, statut_envoi) values
  ('90000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', null, 'whatsapp', now() - interval '1 day', 'en_attente'),
  ('90000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', null, '50000000-0000-4000-8000-000000000007', 'whatsapp', now(), 'en_attente');
```

- [ ] **Step 2: Écrire `scripts/seed-auth.mjs`**

Write `scripts/seed-auth.mjs` :
```js
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const comptes = [
  { email: 'moussa@alhidjah.sn', password: 'Hajj2027!', nom: 'Moussa Ndiaye' },
  { email: 'fatou@alhidjah.sn', password: 'Hajj2027!', nom: 'Fatou Diop' },
  { email: 'omar@albarakah.sn', password: 'Hajj2027!', nom: 'Omar Fall' },
  { email: 'aissatou@albarakah.sn', password: 'Hajj2027!', nom: 'Aissatou Sy' },
]

for (const c of comptes) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: c.email,
    password: c.password,
    email_confirm: true,
    user_metadata: { nom: c.nom },
  })
  if (error) {
    if (error.message.includes('already registered')) {
      console.log('Déjà existant :', c.email)
    } else {
      console.error('Échec :', c.email, error.message)
    }
    continue
  }
  console.log('OK :', c.email, '→', data.user.id)
}

console.log('Terminé. Les comptes sont reliés aux utilisateurs seedés par le trigger handle_new_user.')
```

- [ ] **Step 3: Ajouter le script npm et la dépendance dotenv**

Edit `package.json` → `"scripts"` ajouter :
```json
"seed:auth": "node scripts/seed-auth.mjs"
```
Run: `npm install -D dotenv`
Et ajouter `SUPABASE_SERVICE_ROLE_KEY=` dans `.env.local` (valeur copiée en Task 1).

- [ ] **Step 4: Appliquer le seed et créer les comptes (action utilisateur)**

Instructions : SQL Editor → coller `supabase/seed.sql` → Run. Puis Run: `npm run seed:auth`. Expected: 4 lignes « OK » ou « Déjà existant ».

- [ ] **Step 5: Vérification finale complète**

Vérifications (en suivant l'ordre de la spec) :
1. Run: `npm run test` puis `npm run build` — les deux PASS.
2. SQL Editor :
   ```sql
   select p.prenom, p.nom, p.statut_dossier from public.pelerins p order by p.nom;
   select numero_tranche, statut from public.tranches order by plan_paiement_id, numero_tranche;
   ```
   Expected: dossiers « incomplet / valide / incomplet / incomplet » (ordre par nom : Diop → passeport rejeté → incomplet ; Fall → passeport valide seul → valide ; Ndiaye → visa manquant → incomplet ; Sy → visa manquant → incomplet — triggers appliqués), tranche 1 d'Awa Ndiaye « partielle », tranche 1 de Cheikh Diop « payée » (payée car versée 500 000).
3. Se connecter comme `moussa@alhidjah.sn` / `Hajj2027!` → l'agence « Al Hidjah Travel Dakar » doit être affichée, 2 groupes, 3 pèlerins visibles, dashboard avec 1 rappel en attente.
4. Se connecter comme `omar@albarakah.sn` / `Hajj2027!` → 1 groupe, 1 pèlerin (Mariama Sy) — **aucune donnée d'Al Hidjah visible** (test RLS).
5. Parcours complet : encaisser la tranche 2 d'Awa Ndiaye → statut « À venir » ; téléverser un document → statut « Soumis ».

- [ ] **Step 6: Écrire `README.md`**

Write `README.md` :
```markdown
# Stitch Sama Pèlerin — SaaS de gestion Hajj & Omra

Gestion d'agences de voyage (Hajj/Omra) : groupes, pèlerins, documents, paiements
échelonnés FCFA et rappels WhatsApp. Stack : Supabase (Postgres + Auth + Storage + RLS)
+ Vite/React/TypeScript.

## Démarrage local

1. Créer un projet sur https://supabase.com (free tier).
2. Copier `.env.example` vers `.env` et renseigner `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY` ; copier la clé `service_role` dans `.env.local`
   (jamais commitée).
3. Authentication → Email : désactiver « Confirm email ».
4. SQL Editor : exécuter `supabase/schema.sql` puis `supabase/seed.sql`.
5. `npm install` puis `npm run seed:auth` (créé les comptes de démo).
6. `npm run dev`.

Comptes de démo (mot de passe `Hajj2027!`) :
- `moussa@alhidjah.sn` (gérant, Al Hidjah Travel Dakar)
- `fatou@alhidjah.sn` (agent, Al Hidjah Travel Dakar)
- `omar@albarakah.sn` (gérant, Voyages Al-Barakah)
- `aissatou@albarakah.sn` (agent, Voyages Al-Barakah)

## Déploiement (Vercel)

1. Pousser le dépôt sur GitHub.
2. https://vercel.com → New Project → importer le dépôt (framework détecté : Vite).
3. Environment Variables : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Chaque push déploie automatiquement.

## Tests

`npm run test` — logique métier (format, tranches, statuts) en Vitest.
```

- [ ] **Step 7: Commit final**

```bash
git add supabase/seed.sql scripts/seed-auth.mjs README.md package.json .env.example
git commit -m "feat: seed de démonstration, comptes auth et documentation de déploiement"
```

---

## Vérification finale de la spec (self-review du plan)

- **Couverture spec** : ✅ tables/RLS/triggers (Task 2) ; auth + onboarding (Tasks 4, 6) ; membres/invitations (Task 7) ; groupes (Task 8) ; pèlerins (Task 9) ; documents + Storage (Task 10) ; paiements/échéanciers (Task 11) ; rappels wa.me + dashboard (Task 12) ; seed + RLS test + Vercel (Task 13) ; design system maquette (Task 5) ; format FCFA/DD-MM-YYYY/français (Task 3).
- **Placeholders** : aucun — chaque step contient le code complet ou la commande exacte.
- **Cohérence des types** : `genererTranches`, `messageTranche`, `messageDocument`, `whatsappUrl`, `formatFCFA`, `formatDate`, `LIBELLES_*`/`TONE_*` définis en Task 3, consommés à l'identique en Tasks 10-12 ; `useProfil`/`useAgence` (Task 5) consommés partout ; composants UI (Task 5) utilisés dans toutes les pages.

**Plan complete and saved to `docs/superpowers/plans/2026-08-13-rebuild-supabase.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?