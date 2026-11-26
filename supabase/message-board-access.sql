create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.posts
  add column if not exists user_id uuid references auth.users (id) on delete set null;

alter table public.posts
  add column if not exists visibility text not null default 'public'
  check (visibility in ('public', 'private'));

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  country text not null default '' check (char_length(country) <= 100),
  interests text not null default '' check (char_length(interests) <= 500),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_board_owner (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- Existing accounts get a private profile without changing their login email.
insert into public.profiles (user_id, display_name)
select
  id,
  coalesce(
    nullif(left(trim(raw_user_meta_data ->> 'display_name'), 80), ''),
    left(split_part(coalesce(email, 'Member'), '@', 1), 80)
  )
from auth.users
on conflict (user_id) do nothing;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 80), ''),
      left(split_part(coalesce(new.email, 'Member'), '@', 1), 80)
    )
  )
  on conflict (user_id) do nothing;
  return new;
end
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.set_post_author_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'A post must belong to your signed-in account.';
  end if;

  select profiles.display_name
    into new.name
    from public.profiles
    where profiles.user_id = new.user_id;

  if new.name is null then
    raise exception 'Create your profile before posting a message.';
  end if;

  return new;
end
$$;

drop trigger if exists set_post_author_name_before_insert on public.posts;
create trigger set_post_author_name_before_insert
  before insert on public.posts
  for each row execute function public.set_post_author_name();

create or replace function public.update_profile_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists update_profile_timestamp_before_update on public.profiles;
create trigger update_profile_timestamp_before_update
  before update on public.profiles
  for each row execute function public.update_profile_timestamp();

create or replace function public.sync_profile_name_to_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.display_name is distinct from old.display_name then
    update public.posts
      set name = new.display_name
      where user_id = new.user_id;
  end if;
  return new;
end
$$;

drop trigger if exists sync_profile_name_to_posts_after_update on public.profiles;
create trigger sync_profile_name_to_posts_after_update
  after update of display_name on public.profiles
  for each row execute function public.sync_profile_name_to_posts();

create or replace function public.is_board_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.message_board_owner
    where user_id = auth.uid()
  )
$$;

alter table public.posts enable row level security;
alter table public.profiles enable row level security;
alter table public.message_board_owner enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('posts', 'profiles')
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      existing_policy.policyname,
      existing_policy.tablename
    );
  end loop;
end
$$;

create policy "Anyone can read public posts"
  on public.posts
  for select
  to anon, authenticated
  using (visibility = 'public');

create policy "Authors and site owner can read private posts"
  on public.posts
  for select
  to authenticated
  using (
    visibility = 'private'
    and (auth.uid() = user_id or public.is_board_owner())
  );

create policy "Signed-in users can create their own posts"
  on public.posts
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and visibility in ('public', 'private')
  );

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists posts_user_created_at_idx
  on public.posts (user_id, created_at desc);

revoke all privileges on table public.posts from public, anon, authenticated;
grant select on table public.posts to anon, authenticated;
grant insert on table public.posts to authenticated;
grant select, insert on table public.posts to service_role;

revoke all privileges on table public.profiles from public, anon, authenticated;
grant select, update on table public.profiles to authenticated;
revoke all privileges on table public.message_board_owner from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke all on function public.set_post_author_name() from public, anon, authenticated;
revoke all on function public.update_profile_timestamp() from public, anon, authenticated;
revoke all on function public.sync_profile_name_to_posts() from public, anon, authenticated;
revoke all on function public.is_board_owner() from public, anon;
grant execute on function public.is_board_owner() to authenticated;

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
