-- ============================================================
-- Tests du statut « en retard » — à exécuter dans le SQL Editor
-- (ou psql) sur une base où schema.sql est appliqué.
-- Transaction annulée à la fin : aucune donnée ne reste.
-- ============================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-00000000000a', 'test-retard@exemple.test', '{"nom":"Gérant"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select public.creer_agence('Agence Test Retard', '', null);
insert into public.groupes (id, agence_id, nom, type_voyage, date_depart, date_retour, nb_places_max)
  values ('a1000000-0000-4000-8000-000000000001', public.current_agence_id(), 'Groupe', 'omra', current_date + 60, current_date + 75, 10);
insert into public.pelerins (id, agence_id, groupe_id, nom, prenom, telephone)
  values ('a2000000-0000-4000-8000-000000000001', public.current_agence_id(), 'a1000000-0000-4000-8000-000000000001', 'Diop', 'Awa', '770000000');
insert into public.plans_paiement (id, agence_id, pelerin_id, montant_total, montant_acompte, date_limite_solde)
  values ('a3000000-0000-4000-8000-000000000001', public.current_agence_id(), 'a2000000-0000-4000-8000-000000000001', 300000, 0, current_date - 1);
-- Tranche 1 : dépassée, impayée. Tranche 2 : dépassée, payée en partie. Tranche 3 : à venir.
insert into public.tranches (id, agence_id, plan_paiement_id, numero_tranche, montant_prevu, date_echeance) values
  ('a4000000-0000-4000-8000-000000000001', public.current_agence_id(), 'a3000000-0000-4000-8000-000000000001', 1, 100000, current_date - 10),
  ('a4000000-0000-4000-8000-000000000002', public.current_agence_id(), 'a3000000-0000-4000-8000-000000000001', 2, 100000, current_date - 1),
  ('a4000000-0000-4000-8000-000000000003', public.current_agence_id(), 'a3000000-0000-4000-8000-000000000001', 3, 100000, current_date + 30);
insert into public.paiements (agence_id, tranche_id, montant_paye, type_paiement)
  values (public.current_agence_id(), 'a4000000-0000-4000-8000-000000000002', 40000, 'tranche');

do $$ begin
  if (select statut from public.tranches where id = 'a4000000-0000-4000-8000-000000000002') <> 'en_retard' then
    raise exception 'ÉCHEC : une tranche dépassée et payée en partie n''est pas en retard';
  end if;
end $$;

-- Un utilisateur de l'application ne peut pas lancer la tâche lui-même
do $$ begin
  perform public.maj_statuts_retard();
  raise exception 'ÉCHEC : maj_statuts_retard appelable via l''API';
exception when others then
  if sqlerrm not like '%permission denied%' then raise; end if;
end $$;

-- La tâche planifiée tourne sans JWT (rôle postgres)
reset role;
select set_config('request.jwt.claims', '', true);
do $$ begin
  if public.maj_statuts_retard() <> 1 then
    raise exception 'ÉCHEC : la tâche aurait dû basculer exactement 1 tranche';
  end if;
  if (select statut from public.tranches where id = 'a4000000-0000-4000-8000-000000000001') <> 'en_retard' then
    raise exception 'ÉCHEC : la tranche dépassée et impayée n''est pas en retard';
  end if;
  if (select statut from public.tranches where id = 'a4000000-0000-4000-8000-000000000003') <> 'a_venir' then
    raise exception 'ÉCHEC : une tranche future a changé de statut';
  end if;
  if (select statut from public.plans_paiement where id = 'a3000000-0000-4000-8000-000000000001') <> 'en_retard' then
    raise exception 'ÉCHEC : le plan dont la date limite est dépassée n''est pas en retard';
  end if;
end $$;

select 'Tous les tests de retard sont passés' as resultat;
rollback;
