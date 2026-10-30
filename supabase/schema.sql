-- ============================================================
-- SCHÉMA « SamaPèlerin » — appliquer via SQL Editor
-- ============================================================

-- ---------- TABLES ----------
create table public.agences (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text not null default '',
  email text,
  adresse text,
  logo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.utilisateurs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  agence_id uuid references public.agences(id) on delete set null,
  nom text not null,
  telephone text not null default '',
  email text,
  role text not null default 'agent' check (role in ('gerant','agent','superadmin')),
  created_at timestamptz not null default now()
);

create table public.profils_gerants (
  utilisateur_id uuid primary key references public.utilisateurs(id) on delete cascade,
  avatar_url text
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
  statut_dossier text not null default 'incomplet' check (statut_dossier in ('incomplet','valide')),
  date_inscription timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  agence_id uuid not null references public.agences(id) on delete cascade,
  pelerin_id uuid not null references public.pelerins(id) on delete cascade,
  type_document text not null check (type_document in ('passeport','visa','certificat_vaccination','photo','autre')),
  fichier_url text,
  date_expiration date,
  numero_document text,
  statut text not null default 'manquant' check (statut in ('manquant','soumis','valide','rejete')),
  date_upload timestamptz,
  unique (pelerin_id, type_document)
);

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
  tranche_id uuid references public.tranches(id) on delete cascade,
  plan_paiement_id uuid references public.plans_paiement(id) on delete cascade,
  montant_paye numeric(12,0) not null check (montant_paye >= 0),
  date_paiement timestamptz not null default now(),
  type_paiement text not null default 'tranche' check (type_paiement in ('acompte','tranche')),
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

create table public.tutos (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  description text,
  url_youtube text not null,
  ordre int not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- FONCTIONS ----------
create or replace function public.current_agence_id()
returns uuid language sql stable security definer set search_path = public as $$
  select case when a.active then u.agence_id end
  from public.utilisateurs u
  left join public.agences a on a.id = u.agence_id
  where u.user_id = auth.uid()
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.utilisateurs where user_id = auth.uid() and role = 'superadmin')
$$;

create or replace function public.is_current_gerant()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.utilisateurs u
    where u.user_id = auth.uid() and u.role = 'gerant'
  )
$$;

create or replace function public.is_current_gerant_profile(p_utilisateur_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.utilisateurs u
    where u.id = p_utilisateur_id
      and u.user_id = auth.uid()
      and u.role = 'gerant'
  )
$$;

revoke all on function public.is_current_gerant() from public;
revoke all on function public.is_current_gerant_profile(uuid) from public;
grant execute on function public.is_current_gerant() to authenticated;
grant execute on function public.is_current_gerant_profile(uuid) to authenticated;

-- Inscription : crée la ligne utilisateurs, gère l'invitation (jeton + email), relie les comptes pré-créés
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_invite public.invitations%rowtype;
  v_token text := new.raw_user_meta_data->>'invite_token';
begin
  if v_token is not null then
    select * into v_invite from public.invitations
      where token = v_token
        and lower(email) = lower(new.email)
        and used_at is null and expires_at > now()
      for update;
  end if;

  if v_invite.id is null and exists (
    select 1 from public.utilisateurs
    where lower(email) = lower(new.email) and user_id is null and role <> 'superadmin'
  ) then
    update public.utilisateurs set user_id = new.id
      where lower(email) = lower(new.email) and user_id is null and role <> 'superadmin';
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

-- Le rattachement d'un compte (user_id) n'est fait que par le trigger
-- d'inscription (aucun JWT), jamais par une requête API.
create or replace function public.proteger_rattachement_utilisateur()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is distinct from old.user_id and auth.uid() is not null then
    raise exception 'Modification du compte rattaché interdite.';
  end if;
  return new;
end $$;

-- Les clés étrangères ignorent la RLS : refuse une référence vers une ligne d'une autre agence.
-- tg_argv[0] = table parente, tg_argv[1] = colonne de référence.
create or replace function public.verifier_agence_parent()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_parent_id uuid := (to_jsonb(new) ->> tg_argv[1])::uuid;
  v_agence uuid;
begin
  if v_parent_id is null then
    return new;
  end if;
  execute format('select agence_id from public.%I where id = $1', tg_argv[0])
    into v_agence using v_parent_id;
  if v_agence is distinct from new.agence_id then
    raise exception 'Référence invalide : % n''appartient pas à cette agence.', tg_argv[1];
  end if;
  return new;
end $$;

revoke all on function public.verifier_agence_parent() from public;

-- Création d'agence en self-service : insère l'agence et rattache l'utilisateur courant comme gérant
create or replace function public.creer_agence(p_nom text, p_telephone text, p_adresse text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.utilisateurs
             where user_id = auth.uid()
               and (agence_id is not null or role = 'superadmin')) then
    raise exception 'Déjà rattaché à une agence';
  end if;
  insert into public.agences (nom, telephone, adresse)
  values (p_nom, coalesce(p_telephone, ''), p_adresse)
  returning id into v_id;
  update public.utilisateurs set agence_id = v_id, role = 'gerant'
    where user_id = auth.uid();
  if not found then
    raise exception 'utilisateur introuvable';
  end if;
  return v_id;
end $$;

-- Recalcule le statut d'une tranche après modification des paiements
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
  elsif v_echeance < current_date then v_statut := 'en_retard';
  elsif v_verse > 0 then v_statut := 'partielle';
  else v_statut := 'a_venir';
  end if;
  update public.tranches set statut = v_statut where id = v_id;
  return coalesce(new, old);
end $$;

-- Passe en retard les tranches et plans dont l'échéance est dépassée.
-- Appelée chaque nuit par pg_cron (voir fin du fichier) ; renvoie le nombre de tranches basculées.
create or replace function public.maj_statuts_retard()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_tranches integer;
begin
  update public.tranches set statut = 'en_retard'
    where statut in ('a_venir', 'partielle') and date_echeance < current_date;
  get diagnostics v_tranches = row_count;
  update public.plans_paiement set statut = 'en_retard'
    where statut = 'en_cours' and date_limite_solde < current_date;
  return v_tranches;
end $$;

revoke all on function public.maj_statuts_retard() from public, anon, authenticated;

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

-- Refuse un encaissement qui ferait dépasser le montant total du plan (plan soldé ou montant excédentaire)
create or replace function public.bloquer_encaissement_excedent()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan_id uuid; v_plan_total numeric; v_paye numeric;
begin
  if coalesce(new.type_paiement, old.type_paiement) = 'acompte' then
    select p.id, p.montant_total
      into v_plan_id, v_plan_total
      from public.plans_paiement p
      where p.id = new.plan_paiement_id
      for update of p;
  else
    select t.plan_paiement_id, p.montant_total
      into v_plan_id, v_plan_total
      from public.tranches t
      join public.plans_paiement p on p.id = t.plan_paiement_id
      where t.id = new.tranche_id
      for update of p;
  end if;
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

-- ---------- TRIGGERS ----------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger proteger_rattachement_utilisateur
  before update on public.utilisateurs
  for each row execute function public.proteger_rattachement_utilisateur();

-- Préfixe « agence_coherente_ » : les triggers BEFORE s'exécutent par ordre
-- alphabétique, ce contrôle passe donc avant bloquer_encaissement_excedent.
create trigger agence_coherente_groupe
  before insert or update of groupe_id, agence_id on public.pelerins
  for each row execute function public.verifier_agence_parent('groupes', 'groupe_id');
create trigger agence_coherente_pelerin
  before insert or update of pelerin_id, agence_id on public.documents
  for each row execute function public.verifier_agence_parent('pelerins', 'pelerin_id');
create trigger agence_coherente_pelerin
  before insert or update of pelerin_id, agence_id on public.plans_paiement
  for each row execute function public.verifier_agence_parent('pelerins', 'pelerin_id');
create trigger agence_coherente_plan
  before insert or update of plan_paiement_id, agence_id on public.tranches
  for each row execute function public.verifier_agence_parent('plans_paiement', 'plan_paiement_id');
create trigger agence_coherente_tranche
  before insert or update of tranche_id, agence_id on public.paiements
  for each row execute function public.verifier_agence_parent('tranches', 'tranche_id');
create trigger agence_coherente_plan
  before insert or update of plan_paiement_id, agence_id on public.paiements
  for each row execute function public.verifier_agence_parent('plans_paiement', 'plan_paiement_id');
create trigger agence_coherente_utilisateur
  before insert or update of enregistre_par, agence_id on public.paiements
  for each row execute function public.verifier_agence_parent('utilisateurs', 'enregistre_par');
create trigger agence_coherente_tranche
  before insert or update of tranche_id, agence_id on public.rappels
  for each row execute function public.verifier_agence_parent('tranches', 'tranche_id');
create trigger agence_coherente_document
  before insert or update of document_id, agence_id on public.rappels
  for each row execute function public.verifier_agence_parent('documents', 'document_id');

create trigger trg_paiement_maj_tranche
  after insert or update or delete on public.paiements
  for each row execute function public.trg_maj_statut_tranche();

create trigger bloquer_encaissement_excedent
  before insert on public.paiements
  for each row execute function public.bloquer_encaissement_excedent();

create trigger trg_paiement_maj_plan
  after insert or update or delete on public.paiements
  for each row execute function public.trg_maj_statut_plan();

create trigger trg_plan_maj_plan
  after insert on public.plans_paiement
  for each row execute function public.trg_maj_statut_plan();

create trigger trg_document_maj_dossier
  after insert or update or delete on public.documents
  for each row execute function public.trg_maj_statut_dossier();

-- ---------- RPC : STATS GLOBALES (superadmin) ----------
-- drop obligatoire : create or replace ne peut pas changer le type de retour
-- (returns table) d'une fonction existante (erreur 42P13)
drop function if exists public.stats_globales();
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

-- ---------- RLS ----------
alter table public.agences enable row level security;
alter table public.utilisateurs enable row level security;
alter table public.profils_gerants enable row level security;
alter table public.groupes enable row level security;
alter table public.pelerins enable row level security;
alter table public.documents enable row level security;
alter table public.plans_paiement enable row level security;
alter table public.tranches enable row level security;
alter table public.paiements enable row level security;
alter table public.rappels enable row level security;
alter table public.invitations enable row level security;
alter table public.tutos enable row level security;

revoke all on public.profils_gerants from anon;
grant select, insert, update, delete on public.profils_gerants to authenticated;

create policy profils_gerants_select on public.profils_gerants for select
  using (public.is_current_gerant_profile(utilisateur_id));
create policy profils_gerants_insert on public.profils_gerants for insert
  with check (public.is_current_gerant_profile(utilisateur_id));
create policy profils_gerants_update on public.profils_gerants for update
  using (public.is_current_gerant_profile(utilisateur_id))
  with check (public.is_current_gerant_profile(utilisateur_id));
create policy profils_gerants_delete on public.profils_gerants for delete
  using (public.is_current_gerant_profile(utilisateur_id));

create policy tutos_select on public.tutos for select using (true);
create policy tutos_insert on public.tutos for insert with check (public.is_superadmin());
create policy tutos_update on public.tutos for update using (public.is_superadmin());
create policy tutos_delete on public.tutos for delete using (public.is_superadmin());

create policy agences_select on public.agences for select
  using (id = public.current_agence_id() or public.is_superadmin());
create policy agences_insert on public.agences for insert
  with check (public.is_superadmin());
create policy agences_update on public.agences for update
  using (public.is_superadmin()
    or (id = public.current_agence_id() and public.is_current_gerant()))
  with check (public.is_superadmin()
    or (id = public.current_agence_id() and public.is_current_gerant() and active = true));

create policy utilisateurs_select on public.utilisateurs for select
  using (agence_id = public.current_agence_id() or user_id = auth.uid() or public.is_superadmin());
-- Seul le superadmin pré-crée des comptes ; les membres arrivent par invitation.
create policy utilisateurs_insert on public.utilisateurs for insert
  with check (public.is_superadmin() and role in ('gerant','agent'));
create policy utilisateurs_update on public.utilisateurs for update
  using (user_id = auth.uid()
    or (agence_id = public.current_agence_id()
        and exists (select 1 from public.utilisateurs u
                    where u.user_id = auth.uid() and u.role = 'gerant')))
  with check (
    (user_id = auth.uid()
     and role = (select u.role from public.utilisateurs u where u.user_id = auth.uid())
     and agence_id = (select u.agence_id from public.utilisateurs u where u.user_id = auth.uid()))
    or
    (agence_id = public.current_agence_id()
     and exists (select 1 from public.utilisateurs u
                 where u.user_id = auth.uid() and u.role = 'gerant')
     and role in ('gerant','agent')
     and agence_id = public.current_agence_id()
     and user_id <> auth.uid())
  );
create policy utilisateurs_delete on public.utilisateurs for delete
  using (agence_id = public.current_agence_id()
    and exists (select 1 from public.utilisateurs u
                where u.user_id = auth.uid() and u.role = 'gerant')
    and user_id <> auth.uid());

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
  using (agence_id = public.current_agence_id() or public.is_superadmin())
  with check (agence_id = public.current_agence_id());
create policy pelerins_all on public.pelerins for all
  using (agence_id = public.current_agence_id() or public.is_superadmin())
  with check (agence_id = public.current_agence_id());
create policy documents_all on public.documents for all
  using (agence_id = public.current_agence_id() or public.is_superadmin())
  with check (agence_id = public.current_agence_id());
create policy plans_all on public.plans_paiement for all
  using (agence_id = public.current_agence_id() or public.is_superadmin())
  with check (agence_id = public.current_agence_id());
create policy tranches_all on public.tranches for all
  using (agence_id = public.current_agence_id() or public.is_superadmin())
  with check (agence_id = public.current_agence_id());
create policy paiements_all on public.paiements for all
  using (agence_id = public.current_agence_id() or public.is_superadmin())
  with check (agence_id = public.current_agence_id());
create policy rappels_all on public.rappels for all
  using (agence_id = public.current_agence_id() or public.is_superadmin())
  with check (agence_id = public.current_agence_id());

-- ---------- STORAGE ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents_pelerins', 'documents_pelerins', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos_agences', 'logos_agences', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
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
create policy logos_insert on storage.objects for insert
  with check (bucket_id = 'logos_agences'
    and (storage.foldername(name))[1] = public.current_agence_id()::text
    and public.is_current_gerant());
create policy logos_update on storage.objects for update
  using (bucket_id = 'logos_agences'
    and (storage.foldername(name))[1] = public.current_agence_id()::text
    and public.is_current_gerant())
  with check (bucket_id = 'logos_agences'
    and (storage.foldername(name))[1] = public.current_agence_id()::text
    and public.is_current_gerant());
create policy logos_delete on storage.objects for delete
  using (bucket_id = 'logos_agences'
    and (storage.foldername(name))[1] = public.current_agence_id()::text
    and public.is_current_gerant());

-- ---------- TÂCHES PLANIFIÉES ----------
-- Statuts « en retard » recalculés chaque nuit à 00:05 UTC (00:05 à Dakar)
create extension if not exists pg_cron;
select cron.schedule('maj-statuts-retard', '5 0 * * *', $$select public.maj_statuts_retard()$$);
