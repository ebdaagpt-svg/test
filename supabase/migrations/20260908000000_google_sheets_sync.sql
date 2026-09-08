create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create table if not exists public.google_sheet_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spreadsheet_id text not null,
  spreadsheet_name text not null,
  sheet_name text not null,
  field_mapping jsonb not null default '{}'::jsonb,
  encrypted_access_token text,
  last_synced_row integer not null default 1 check (last_synced_row >= 1),
  last_synced_at timestamptz,
  sync_status text not null default 'active' check (sync_status in ('active', 'paused', 'error', 'reconnect_required')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, spreadsheet_id, sheet_name)
);

alter table public.google_sheet_connections enable row level security;
create policy "Users manage their own sheet connections"
  on public.google_sheet_connections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.leads add column if not exists google_sheet_connection_id uuid references public.google_sheet_connections(id) on delete set null;
alter table public.leads add column if not exists google_sheet_row integer;
create unique index if not exists leads_sheet_row_unique
  on public.leads (google_sheet_connection_id, google_sheet_row)
  where google_sheet_connection_id is not null;

-- Configure app.settings.supabase_url and app.settings.service_role_key in the
-- Supabase Vault/project settings before enabling this schedule.
select cron.schedule(
  'sync-google-sheets-every-five-minutes', '*/5 * * * *',
  $$select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/google-sheets-sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );$$
);
