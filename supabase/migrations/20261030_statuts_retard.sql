-- Statut « en retard » automatique : jusqu'ici une tranche ne passait en retard
-- que lorsqu'un paiement était enregistré dessus, jamais parce que la date était dépassée.

-- Une échéance dépassée et non soldée est en retard, même partiellement payée.
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
-- Appelée chaque nuit par pg_cron ; renvoie le nombre de tranches basculées.
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

-- Rattrapage immédiat des échéances déjà dépassées
select public.maj_statuts_retard();

-- Tâche quotidienne à 00:05 UTC (00:05 à Dakar)
create extension if not exists pg_cron;
select cron.schedule('maj-statuts-retard', '5 0 * * *', $$select public.maj_statuts_retard()$$);
