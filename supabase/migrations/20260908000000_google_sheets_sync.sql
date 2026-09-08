create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create table if not exists public.google_oauth_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_encrypted text not null,
  access_token_encrypted text,
  access_token_expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'reconnect_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_origin text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.google_sheet_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  spreadsheet_id text not null,
  spreadsheet_name text not null,
  sheet_name text not null,
  field_mapping jsonb not null default '{}'::jsonb,
  last_synced_row integer not null default 1 check (last_synced_row >= 1),
  last_synced_at timestamptz,
  sync_status text not null default 'active' check (sync_status in ('active', 'paused', 'error', 'reconnect_required')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, spreadsheet_id, sheet_name)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  service text,
  doctor text,
  source text,
  notes text,
  google_sheet_connection_id uuid references public.google_sheet_connections(id) on delete set null,
  google_sheet_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists leads_sheet_row_unique
  on public.leads (google_sheet_connection_id, google_sheet_row)
  where google_sheet_connection_id is not null;
create index if not exists leads_organization_created_idx on public.leads (organization_id, created_at desc);
create index if not exists sheet_connections_organization_idx on public.google_sheet_connections (organization_id);
create index if not exists google_oauth_states_user_idx on public.google_oauth_states (user_id);
create index if not exists leads_user_idx on public.leads (user_id);

alter table public.google_oauth_credentials enable row level security;
alter table public.google_oauth_states enable row level security;
alter table public.google_sheet_connections enable row level security;
alter table public.leads enable row level security;

-- Explicit deny policies keep OAuth secrets inaccessible to browser clients.
drop policy if exists "Deny client access to Google credentials" on public.google_oauth_credentials;
create policy "Deny client access to Google credentials" on public.google_oauth_credentials for all to authenticated using (false) with check (false);
drop policy if exists "Deny client access to OAuth states" on public.google_oauth_states;
create policy "Deny client access to OAuth states" on public.google_oauth_states for all to authenticated using (false) with check (false);

drop policy if exists "Clinic members read sheet connections" on public.google_sheet_connections;
create policy "Clinic members read sheet connections" on public.google_sheet_connections for select to authenticated
using (organization_id = (select organization_id from public.profiles where id = (select auth.uid())));
drop policy if exists "Clinic members create sheet connections" on public.google_sheet_connections;
create policy "Clinic members create sheet connections" on public.google_sheet_connections for insert to authenticated
with check (user_id = (select auth.uid()) and organization_id = (select organization_id from public.profiles where id = (select auth.uid())));
drop policy if exists "Owners update sheet connections" on public.google_sheet_connections;
create policy "Owners update sheet connections" on public.google_sheet_connections for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and organization_id = (select organization_id from public.profiles where id = (select auth.uid())));
drop policy if exists "Owners delete sheet connections" on public.google_sheet_connections;
create policy "Owners delete sheet connections" on public.google_sheet_connections for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Clinic members read leads" on public.leads;
create policy "Clinic members read leads" on public.leads for select to authenticated
using (organization_id = (select organization_id from public.profiles where id = (select auth.uid())));
drop policy if exists "Clinic members create leads" on public.leads;
create policy "Clinic members create leads" on public.leads for insert to authenticated
with check (user_id = (select auth.uid()) and organization_id = (select organization_id from public.profiles where id = (select auth.uid())));
drop policy if exists "Clinic members update leads" on public.leads;
create policy "Clinic members update leads" on public.leads for update to authenticated
using (organization_id = (select organization_id from public.profiles where id = (select auth.uid())))
with check (organization_id = (select organization_id from public.profiles where id = (select auth.uid())));
drop policy if exists "Clinic members delete leads" on public.leads;
create policy "Clinic members delete leads" on public.leads for delete to authenticated
using (organization_id = (select organization_id from public.profiles where id = (select auth.uid())));

grant select, insert, update, delete on public.google_sheet_connections to authenticated;
grant select, insert, update, delete on public.leads to authenticated;
