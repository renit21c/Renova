create table if not exists public.renova_workspace (
  id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.renova_workspace enable row level security;

revoke all on public.renova_workspace from anon, authenticated;
grant select, insert, update, delete on public.renova_workspace to authenticated;

create policy "Users can access their own Renova workspace"
  on public.renova_workspace
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
