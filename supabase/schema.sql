create table if not exists public.shop_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"prices":{},"bills":[]}'::jsonb
);

alter table public.shop_state enable row level security;
revoke all on public.shop_state from anon;
grant select, insert, update on public.shop_state to authenticated;

create policy "Read own shop state" on public.shop_state
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Create own shop state" on public.shop_state
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Update own shop state" on public.shop_state
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
