-- Correctifs de sécurité : escalade de privilèges, jeton d'invitation,
-- cohérence multi-agence des références et limites des fichiers téléversés.

-- ---------- 1. ESCALADE DE PRIVILÈGES SUR utilisateurs ----------
-- Seul le superadmin pré-crée des comptes (gérant d'une nouvelle agence) ;
-- les membres d'une agence arrivent uniquement par invitation.
drop policy if exists utilisateurs_insert on public.utilisateurs;
create policy utilisateurs_insert on public.utilisateurs for insert
  with check (public.is_superadmin() and role in ('gerant','agent'));

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

drop trigger if exists proteger_rattachement_utilisateur on public.utilisateurs;
create trigger proteger_rattachement_utilisateur
  before update on public.utilisateurs
  for each row execute function public.proteger_rattachement_utilisateur();

-- ---------- 2. JETON D'INVITATION VÉRIFIÉ À L'INSCRIPTION ----------
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

-- ---------- 3. RÉFÉRENCES LIMITÉES À LA MÊME AGENCE ----------
-- Les clés étrangères ignorent la RLS : sans ce contrôle, une agence pourrait
-- rattacher ses lignes aux groupes, tranches ou plans d'une autre agence.
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

-- Préfixe « agence_coherente_ » : les triggers BEFORE s'exécutent par ordre
-- alphabétique, ce contrôle passe donc avant bloquer_encaissement_excedent.
drop trigger if exists agence_coherente_groupe on public.pelerins;
create trigger agence_coherente_groupe
  before insert or update of groupe_id, agence_id on public.pelerins
  for each row execute function public.verifier_agence_parent('groupes', 'groupe_id');

drop trigger if exists agence_coherente_pelerin on public.documents;
create trigger agence_coherente_pelerin
  before insert or update of pelerin_id, agence_id on public.documents
  for each row execute function public.verifier_agence_parent('pelerins', 'pelerin_id');

drop trigger if exists agence_coherente_pelerin on public.plans_paiement;
create trigger agence_coherente_pelerin
  before insert or update of pelerin_id, agence_id on public.plans_paiement
  for each row execute function public.verifier_agence_parent('pelerins', 'pelerin_id');

drop trigger if exists agence_coherente_plan on public.tranches;
create trigger agence_coherente_plan
  before insert or update of plan_paiement_id, agence_id on public.tranches
  for each row execute function public.verifier_agence_parent('plans_paiement', 'plan_paiement_id');

drop trigger if exists agence_coherente_tranche on public.paiements;
create trigger agence_coherente_tranche
  before insert or update of tranche_id, agence_id on public.paiements
  for each row execute function public.verifier_agence_parent('tranches', 'tranche_id');

drop trigger if exists agence_coherente_plan on public.paiements;
create trigger agence_coherente_plan
  before insert or update of plan_paiement_id, agence_id on public.paiements
  for each row execute function public.verifier_agence_parent('plans_paiement', 'plan_paiement_id');

drop trigger if exists agence_coherente_utilisateur on public.paiements;
create trigger agence_coherente_utilisateur
  before insert or update of enregistre_par, agence_id on public.paiements
  for each row execute function public.verifier_agence_parent('utilisateurs', 'enregistre_par');

drop trigger if exists agence_coherente_tranche on public.rappels;
create trigger agence_coherente_tranche
  before insert or update of tranche_id, agence_id on public.rappels
  for each row execute function public.verifier_agence_parent('tranches', 'tranche_id');

drop trigger if exists agence_coherente_document on public.rappels;
create trigger agence_coherente_document
  before insert or update of document_id, agence_id on public.rappels
  for each row execute function public.verifier_agence_parent('documents', 'document_id');

-- ---------- 4. LIMITES DES FICHIERS TÉLÉVERSÉS ----------
update storage.buckets
  set file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp']
  where id = 'documents_pelerins';
update storage.buckets
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg','image/png','image/webp']
  where id = 'logos_agences';

-- Lignes existantes incohérentes (doit renvoyer 0 ligne) :
-- select 'pelerins' t, p.id from public.pelerins p join public.groupes g on g.id = p.groupe_id where g.agence_id <> p.agence_id
-- union all select 'documents', d.id from public.documents d join public.pelerins p on p.id = d.pelerin_id where p.agence_id <> d.agence_id
-- union all select 'tranches', t.id from public.tranches t join public.plans_paiement pp on pp.id = t.plan_paiement_id where pp.agence_id <> t.agence_id
-- union all select 'paiements', pa.id from public.paiements pa join public.tranches t on t.id = pa.tranche_id where t.agence_id <> pa.agence_id;
