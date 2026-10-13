-- Profiles, private contact data and shipping addresses.

create type public.user_role as enum ('user', 'moderator', 'admin');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Public profile: safe to expose to everyone.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text,
  avatar_url text,
  bio text,
  state text,
  city text,
  phone_verified boolean not null default false,
  role public.user_role not null default 'user',
  banned_at timestamptz,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_len check (char_length(display_name) <= 60),
  constraint profiles_bio_len check (char_length(bio) <= 500)
);

create unique index profiles_username_key on public.profiles (lower(username));

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Private contact data. Never readable by other users; WhatsApp is revealed through a gated function later.
create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  whatsapp_number text,
  whatsapp_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_private_whatsapp_format check (whatsapp_number is null or whatsapp_number ~ '^\+?[0-9]{10,15}$')
);

create trigger profile_private_set_updated_at
before update on public.profile_private
for each row execute function public.set_updated_at();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  street text not null,
  exterior_number text not null,
  interior_number text,
  neighborhood text not null,
  municipality text not null,
  state text not null,
  postal_code text not null,
  reference text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint addresses_postal_code_format check (postal_code ~ '^[0-9]{5}$'),
  constraint addresses_phone_format check (phone ~ '^[0-9]{10}$')
);

create index addresses_user_id_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;

create trigger addresses_set_updated_at
before update on public.addresses
for each row execute function public.set_updated_at();

-- Create profile rows when a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text := lower(nullif(new.raw_user_meta_data ->> 'username', ''));
  final_username text;
begin
  if requested_username is not null and requested_username ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = requested_username) then
    final_username := requested_username;
  else
    final_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, nullif(new.raw_user_meta_data ->> 'display_name', ''));

  insert into public.profile_private (id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep phone_verified in sync with Supabase Auth.
create function public.sync_phone_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set phone_verified = (new.phone_confirmed_at is not null)
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_phone_confirmed
after update of phone_confirmed_at on auth.users
for each row execute function public.sync_phone_verified();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.addresses enable row level security;

create policy "profiles are publicly readable"
on public.profiles for select
using (true);

create policy "users update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "users read their own private data"
on public.profile_private for select
to authenticated
using ((select auth.uid()) = id);

create policy "users update their own private data"
on public.profile_private for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "users manage their own addresses"
on public.addresses for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Column-level grants: role, ban state, rating and phone_verified are never user-editable.
revoke update on public.profiles from authenticated, anon;
grant update (username, display_name, avatar_url, bio, state, city) on public.profiles to authenticated;

revoke update on public.profile_private from authenticated, anon;
grant update (whatsapp_number, whatsapp_visible) on public.profile_private to authenticated;
