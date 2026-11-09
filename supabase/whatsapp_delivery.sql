create table if not exists public.whatsapp_delivery (
  message_id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  bill_id text not null,
  part text not null check (part in ('thank_you', 'pdf')),
  status text not null default 'accepted',
  status_rank smallint not null default 0,
  error_code text,
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_delivery_owner_bill on public.whatsapp_delivery (owner_id, bill_id);
alter table public.whatsapp_delivery enable row level security;
revoke all on public.whatsapp_delivery from anon;
grant select, insert on public.whatsapp_delivery to authenticated;

create policy "Read own WhatsApp delivery" on public.whatsapp_delivery
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Record own WhatsApp message" on public.whatsapp_delivery
  for insert to authenticated with check ((select auth.uid()) = owner_id);
