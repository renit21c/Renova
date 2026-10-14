create table if not exists public.google_calendar_oauth_states (
  state_hash text primary key,
  expires_at timestamptz not null
);

create table if not exists public.google_calendar_connections (
  google_user_id text primary key,
  email text not null,
  token_bundle_enc text not null,
  token_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.google_calendar_tickets (
  ticket_hash text primary key,
  google_user_id text not null,
  email text not null,
  expires_at timestamptz not null
);

alter table public.google_calendar_oauth_states enable row level security;
alter table public.google_calendar_connections enable row level security;
alter table public.google_calendar_tickets enable row level security;

revoke all on public.google_calendar_oauth_states from anon, authenticated;
revoke all on public.google_calendar_connections from anon, authenticated;
revoke all on public.google_calendar_tickets from anon, authenticated;

grant select, insert, update, delete on public.google_calendar_oauth_states to service_role;
grant select, insert, update, delete on public.google_calendar_connections to service_role;
grant select, insert, update, delete on public.google_calendar_tickets to service_role;
