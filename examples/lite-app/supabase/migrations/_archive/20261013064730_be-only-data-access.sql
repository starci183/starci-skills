-- The front end reads and writes no table any more (owner ruling 2026-10-13: Supabase on the front end is Auth only; data goes
-- through the back end's GraphQL API). Every authenticated (PostgREST) policy and grant is withdrawn, so RLS denies the browser
-- roles by default, and the dedicated app_be role gets exactly what the back end's capabilities run.

-- profiles: the back end owns the row of each user.
drop policy profiles_authenticated_select on public.profiles;
drop policy profiles_authenticated_insert on public.profiles;
drop policy profiles_authenticated_update on public.profiles;

revoke all on table public.profiles from public, anon, authenticated;

create policy profiles_app_be_select
on public.profiles
for select
to app_be
using (id is not null);

create policy profiles_app_be_insert
on public.profiles
for insert
to app_be
with check (id is not null);

create policy profiles_app_be_update
on public.profiles
for update
to app_be
using (id is not null)
with check (id is not null);

grant select, insert on table public.profiles to app_be;
grant update (display_name) on table public.profiles to app_be;

-- resources: get-resource reads and create-resource inserts one owner's row.
drop policy "resources_authenticated_select" on public.resources;
drop policy "resources_authenticated_insert" on public.resources;
drop policy "resources_authenticated_update" on public.resources;
drop policy "resources_authenticated_delete" on public.resources;

revoke all on table public.resources from public, anon, authenticated;

create policy "resources_app_be_insert"
on public.resources
for insert
to app_be
with check (owner_id is not null);

grant select on table public.resources to app_be;
grant insert (owner_id) on table public.resources to app_be;

-- calendars: get-calendar reads and create-calendar inserts one owner's row; the calendar webhook resolves a delivery target.
drop policy "calendars_authenticated_select" on public.calendars;
drop policy "calendars_authenticated_insert" on public.calendars;
drop policy "calendars_authenticated_update" on public.calendars;
drop policy "calendars_authenticated_delete" on public.calendars;

revoke all on table public.calendars from public, anon, authenticated;

create policy "calendars_app_be_insert"
on public.calendars
for insert
to app_be
with check (owner_id is not null);

grant select on table public.calendars to app_be;
grant insert (owner_id) on table public.calendars to app_be;

-- bookings: create-booking inserts, booking-status reads and the confirm-booking job updates the status (granted earlier).
drop policy "bookings_authenticated_select" on public.bookings;
drop policy "bookings_authenticated_insert" on public.bookings;
drop policy "bookings_authenticated_update" on public.bookings;
drop policy "bookings_authenticated_delete" on public.bookings;

revoke all on table public.bookings from public, anon, authenticated;

grant select on table public.bookings to app_be;
grant insert (owner_id, resource_id, starts_at, ends_at) on table public.bookings to app_be;
grant update (status) on table public.bookings to app_be;
