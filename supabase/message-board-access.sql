create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.posts
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.posts enable row level security;

-- Replace existing policies so no earlier permissive write policy remains.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
  loop
    execute format('drop policy if exists %I on public.posts', existing_policy.policyname);
  end loop;
end
$$;

create policy "Public can read posts"
  on public.posts
  for select
  to anon, authenticated
  using (true);

create policy "Signed-in users can create posts"
  on public.posts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

revoke all privileges on table public.posts from public, anon, authenticated;
grant select on table public.posts to anon, authenticated;
grant insert on table public.posts to authenticated;
grant select, insert on table public.posts to service_role;
grant usage on schema public to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table public.posts;
  end if;
end
$$;
