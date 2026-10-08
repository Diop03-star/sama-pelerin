-- Paramètres réservés aux gérants: profil, agence et images de marque.
create table if not exists public.profils_gerants (
  utilisateur_id uuid primary key references public.utilisateurs(id) on delete cascade,
  avatar_url text
);

alter table public.profils_gerants enable row level security;
revoke all on public.profils_gerants from anon;
grant select, insert, update, delete on public.profils_gerants to authenticated;

create or replace function public.is_current_gerant()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.utilisateurs u
    where u.user_id = auth.uid() and u.role = 'gerant'
  )
$$;

create or replace function public.is_current_gerant_profile(p_utilisateur_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
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

drop policy if exists profils_gerants_select on public.profils_gerants;
create policy profils_gerants_select on public.profils_gerants for select
  using (public.is_current_gerant_profile(utilisateur_id));
drop policy if exists profils_gerants_insert on public.profils_gerants;
create policy profils_gerants_insert on public.profils_gerants for insert
  with check (public.is_current_gerant_profile(utilisateur_id));
drop policy if exists profils_gerants_update on public.profils_gerants;
create policy profils_gerants_update on public.profils_gerants for update
  using (public.is_current_gerant_profile(utilisateur_id))
  with check (public.is_current_gerant_profile(utilisateur_id));
drop policy if exists profils_gerants_delete on public.profils_gerants;
create policy profils_gerants_delete on public.profils_gerants for delete
  using (public.is_current_gerant_profile(utilisateur_id));

drop policy if exists agences_update on public.agences;
create policy agences_update on public.agences for update
  using (
    public.is_superadmin()
    or (id = public.current_agence_id() and public.is_current_gerant())
  )
  with check (
    public.is_superadmin()
    or (id = public.current_agence_id() and public.is_current_gerant() and active = true)
  );

drop policy if exists logos_write on storage.objects;
drop policy if exists logos_insert on storage.objects;
create policy logos_insert on storage.objects for insert
  with check (
    bucket_id = 'logos_agences'
    and (storage.foldername(name))[1] = public.current_agence_id()::text
    and public.is_current_gerant()
  );
drop policy if exists logos_update on storage.objects;
create policy logos_update on storage.objects for update
  using (
    bucket_id = 'logos_agences'
    and (storage.foldername(name))[1] = public.current_agence_id()::text
    and public.is_current_gerant()
  )
  with check (
    bucket_id = 'logos_agences'
    and (storage.foldername(name))[1] = public.current_agence_id()::text
    and public.is_current_gerant()
  );
drop policy if exists logos_delete on storage.objects;
create policy logos_delete on storage.objects for delete
  using (
    bucket_id = 'logos_agences'
    and (storage.foldername(name))[1] = public.current_agence_id()::text
    and public.is_current_gerant()
  );
