
-- backfill d'abord : les dossiers « complet » existants (produits par l'ancien trigger)
-- feraient échouer l'ajout de contrainte (validation immédiate sur les lignes présentes).
-- Le backfill n'écrit que 'valide'/'incomplet', légaux sous l'ancienne contrainte,
-- et le trigger ne se déclenche que sur documents (pas pelerins), donc aucune interférence.
update public.pelerins pel set statut_dossier = case
  when (select count(distinct type_document)
        from public.documents d
        where d.pelerin_id = pel.id
          and d.type_document in ('passeport','visa','certificat_vaccination','photo')
          and d.statut = 'valide') = 4
  then 'valide' else 'incomplet'
end;

alter table public.pelerins drop constraint if exists pelerins_statut_dossier_check;
alter table public.pelerins add constraint pelerins_statut_dossier_check check (statut_dossier in ('incomplet','valide'));

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
