-- ============================================================
-- Tests de sécurité RLS / triggers — à exécuter dans le SQL Editor
-- (ou psql) sur une base où schema.sql est appliqué.
-- Tout se passe dans une transaction annulée : aucune donnée ne reste.
-- Chaque bloc lève « ÉCHEC : … » si une protection ne tient pas.
-- ============================================================
begin;

-- ---------- Comptes de test (en tant que postgres) ----------
-- A : gérant de l'agence A, B : gérant de l'agence B, S : superadmin
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-00000000000a', 'test-gerant-a@exemple.test', '{"nom":"Gérant A"}'),
  ('b0000000-0000-4000-8000-00000000000b', 'test-gerant-b@exemple.test', '{"nom":"Gérant B"}'),
  ('c0000000-0000-4000-8000-00000000000c', 'test-super@exemple.test', '{"nom":"Super"}');
update public.utilisateurs set role = 'superadmin'
  where user_id = 'c0000000-0000-4000-8000-00000000000c';

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select public.creer_agence('Agence Test A', '', null);
insert into public.groupes (id, agence_id, nom, type_voyage, date_depart, date_retour, nb_places_max)
  values ('a1000000-0000-4000-8000-000000000001', public.current_agence_id(), 'Groupe A', 'omra', '2027-01-01', '2027-01-15', 10);
insert into public.pelerins (id, agence_id, groupe_id, nom, prenom, telephone)
  values ('a2000000-0000-4000-8000-000000000001', public.current_agence_id(), 'a1000000-0000-4000-8000-000000000001', 'Diop', 'Awa', '770000000');
insert into public.plans_paiement (id, agence_id, pelerin_id, montant_total, montant_acompte)
  values ('a3000000-0000-4000-8000-000000000001', public.current_agence_id(), 'a2000000-0000-4000-8000-000000000001', 100000, 0);
insert into public.tranches (id, agence_id, plan_paiement_id, numero_tranche, montant_prevu, date_echeance)
  values ('a4000000-0000-4000-8000-000000000001', public.current_agence_id(), 'a3000000-0000-4000-8000-000000000001', 1, 100000, '2027-01-01');
insert into public.invitations (agence_id, email, role, token)
  values (public.current_agence_id(), 'test-invite@exemple.test', 'agent', 'jeton-test-valide');

select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
select public.creer_agence('Agence Test B', '', null);
insert into public.groupes (id, agence_id, nom, type_voyage, date_depart, date_retour, nb_places_max)
  values ('b1000000-0000-4000-8000-000000000001', public.current_agence_id(), 'Groupe B', 'omra', '2027-01-01', '2027-01-15', 10);
insert into public.pelerins (id, agence_id, groupe_id, nom, prenom, telephone)
  values ('b2000000-0000-4000-8000-000000000001', public.current_agence_id(), 'b1000000-0000-4000-8000-000000000001', 'Fall', 'Modou', '780000000');

-- ---------- 1. Escalade de privilèges ----------
do $$ begin
  insert into public.utilisateurs (agence_id, nom, email, role)
    values (public.current_agence_id(), 'Pirate', 'pirate@exemple.test', 'superadmin');
  raise exception 'ÉCHEC : un gérant a créé un utilisateur superadmin';
exception when others then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;

do $$ begin
  insert into public.utilisateurs (agence_id, nom, email, role)
    values (public.current_agence_id(), 'Pirate', 'pirate@exemple.test', 'gerant');
  raise exception 'ÉCHEC : un gérant a pré-créé un compte hors invitation';
exception when others then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;

select set_config('request.jwt.claims', '{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
do $$ begin
  insert into public.utilisateurs (agence_id, nom, email, role)
    values (null, 'Autre super', 'autre-super@exemple.test', 'superadmin');
  raise exception 'ÉCHEC : création d''un superadmin via l''API';
exception when others then
  if sqlerrm not like '%row-level security%' then raise; end if;
end $$;
-- Cas légitime : le superadmin pré-crée le gérant d'une agence
insert into public.utilisateurs (agence_id, nom, email, role)
  select id, 'Gérant pré-créé', 'test-precree@exemple.test', 'gerant'
  from public.agences where nom = 'Agence Test A';

-- ---------- 2. Invitations et rattachement à l'inscription ----------
reset role;
-- L'inscription passe par GoTrue, sans JWT
select set_config('request.jwt.claims', '', true);
-- Une ligne superadmin orpheline ne doit jamais être réclamée par email
insert into public.utilisateurs (nom, email, role) values ('Orphelin', 'test-orphelin@exemple.test', 'superadmin');
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-4000-8000-00000000000d', 'test-orphelin@exemple.test', '{}'),
  ('e0000000-0000-4000-8000-00000000000e', 'test-invite@exemple.test', '{"invite_token":"mauvais-jeton"}'),
  ('f0000000-0000-4000-8000-00000000000f', 'test-precree@exemple.test', '{}');

do $$ begin
  if exists (select 1 from public.utilisateurs
             where user_id = 'd0000000-0000-4000-8000-00000000000d' and role = 'superadmin') then
    raise exception 'ÉCHEC : une ligne superadmin a été réclamée par email';
  end if;
  if exists (select 1 from public.utilisateurs
             where user_id = 'e0000000-0000-4000-8000-00000000000e' and agence_id is not null) then
    raise exception 'ÉCHEC : invitation acceptée avec un mauvais jeton';
  end if;
  if not exists (select 1 from public.utilisateurs u join public.agences a on a.id = u.agence_id
                 where u.user_id = 'f0000000-0000-4000-8000-00000000000f'
                   and u.role = 'gerant' and a.nom = 'Agence Test A') then
    raise exception 'ÉCHEC : le gérant pré-créé par le superadmin n''a pas été rattaché';
  end if;
end $$;

delete from public.utilisateurs where user_id = 'e0000000-0000-4000-8000-00000000000e';
delete from auth.users where id = 'e0000000-0000-4000-8000-00000000000e';
insert into auth.users (id, email, raw_user_meta_data) values
  ('e0000000-0000-4000-8000-00000000000e', 'test-invite@exemple.test', '{"invite_token":"jeton-test-valide"}');
do $$ begin
  if not exists (select 1 from public.utilisateurs u join public.agences a on a.id = u.agence_id
                 where u.user_id = 'e0000000-0000-4000-8000-00000000000e'
                   and u.role = 'agent' and a.nom = 'Agence Test A') then
    raise exception 'ÉCHEC : le bon jeton n''a pas rattaché l''invité';
  end if;
  if exists (select 1 from public.invitations where token = 'jeton-test-valide' and used_at is null) then
    raise exception 'ÉCHEC : invitation non marquée comme utilisée';
  end if;
end $$;

-- Un gérant ne peut pas rebrancher le compte d'un membre de son agence
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  update public.utilisateurs set user_id = '99999999-0000-4000-8000-000000000099'
    where user_id = 'e0000000-0000-4000-8000-00000000000e';
  if not found then
    raise exception 'ÉCHEC : la ligne du membre n''est pas visible pour le gérant';
  end if;
  raise exception 'ÉCHEC : user_id modifiable par une requête API';
exception when others then
  if sqlerrm not like '%compte rattaché interdite%' then raise; end if;
end $$;

-- ---------- 3. Références vers une autre agence (en tant que gérant B) ----------
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);

do $$ begin
  insert into public.paiements (agence_id, tranche_id, montant_paye, type_paiement)
    values (public.current_agence_id(), 'a4000000-0000-4000-8000-000000000001', 100000, 'tranche');
  raise exception 'ÉCHEC : paiement rattaché à la tranche d''une autre agence';
exception when others then
  if sqlerrm not like '%Référence invalide%' then raise; end if;
end $$;

do $$ begin
  insert into public.paiements (agence_id, plan_paiement_id, montant_paye, type_paiement)
    values (public.current_agence_id(), 'a3000000-0000-4000-8000-000000000001', 1000, 'acompte');
  raise exception 'ÉCHEC : acompte rattaché au plan d''une autre agence';
exception when others then
  if sqlerrm not like '%Référence invalide%' then raise; end if;
end $$;

do $$ begin
  insert into public.pelerins (agence_id, groupe_id, nom, prenom, telephone)
    values (public.current_agence_id(), 'a1000000-0000-4000-8000-000000000001', 'X', 'Y', '0');
  raise exception 'ÉCHEC : pèlerin rattaché au groupe d''une autre agence';
exception when others then
  if sqlerrm not like '%Référence invalide%' then raise; end if;
end $$;

do $$ begin
  update public.pelerins set groupe_id = 'a1000000-0000-4000-8000-000000000001'
    where id = 'b2000000-0000-4000-8000-000000000001';
  raise exception 'ÉCHEC : pèlerin déplacé vers le groupe d''une autre agence';
exception when others then
  if sqlerrm not like '%Référence invalide%' then raise; end if;
end $$;

do $$ begin
  insert into public.documents (agence_id, pelerin_id, type_document)
    values (public.current_agence_id(), 'a2000000-0000-4000-8000-000000000001', 'passeport');
  raise exception 'ÉCHEC : document rattaché au pèlerin d''une autre agence';
exception when others then
  if sqlerrm not like '%Référence invalide%' then raise; end if;
end $$;

-- Cas légitime : le gérant A encaisse sur sa propre tranche
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
insert into public.paiements (agence_id, tranche_id, montant_paye, type_paiement)
  values (public.current_agence_id(), 'a4000000-0000-4000-8000-000000000001', 100000, 'tranche');
reset role;
do $$ begin
  if (select statut from public.tranches where id = 'a4000000-0000-4000-8000-000000000001') <> 'payee' then
    raise exception 'ÉCHEC : le paiement légitime n''a pas mis à jour la tranche';
  end if;
end $$;

-- ---------- 4. Limites des buckets ----------
do $$ begin
  if not exists (select 1 from storage.buckets
                 where id = 'documents_pelerins' and file_size_limit = 10485760
                   and not ('text/html' = any (allowed_mime_types))) then
    raise exception 'ÉCHEC : limites absentes sur documents_pelerins';
  end if;
end $$;

select 'Tous les tests de sécurité sont passés' as resultat;
rollback;
