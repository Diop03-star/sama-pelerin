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
