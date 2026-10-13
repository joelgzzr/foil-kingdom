-- Marketplace listings: singles, lots and sealed product, with items and photos.

create type public.listing_kind as enum ('single', 'lot', 'sealed');
create type public.listing_status as enum ('draft', 'active', 'paused', 'sold', 'removed');

-- Standing checks used by RLS; security definer so they can read protected profile columns.
create function public.is_in_good_standing()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and banned_at is null
  );
$$;

create function public.can_publish()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and banned_at is null and phone_verified
  );
$$;

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id),
  kind public.listing_kind not null,
  title text not null,
  description text,
  -- Total price for the whole listing, in MXN centavos.
  price_cents integer not null,
  accepts_offers boolean not null default true,
  sealed_type text,
  set_id uuid references public.card_sets (id),
  status public.listing_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_title_len check (char_length(title) between 3 and 100),
  constraint listings_description_len check (char_length(description) <= 2000),
  constraint listings_price_range check (price_cents between 100 and 100000000),
  constraint listings_sealed_type_valid check (
    (kind = 'sealed' and sealed_type in ('booster_box', 'booster_pack', 'starter_deck', 'other'))
    or (kind <> 'sealed' and sealed_type is null)
  )
);

create index listings_status_published_idx on public.listings (status, published_at desc);
create index listings_seller_idx on public.listings (seller_id, created_at desc);
create index listings_price_idx on public.listings (price_cents);
create index listings_title_trgm_idx on public.listings using gin (title extensions.gin_trgm_ops);

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

create table public.listing_items (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  card_id uuid not null references public.cards (id),
  condition text not null,
  language text not null default 'en',
  finish text not null default 'regular',
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  constraint listing_items_condition_valid check (condition in ('nm', 'lp', 'mp', 'hp', 'dmg')),
  constraint listing_items_language_valid check (language in ('en', 'ja', 'ko', 'zh')),
  constraint listing_items_finish_valid check (finish in ('regular', 'foil', 'parallel')),
  constraint listing_items_quantity_range check (quantity between 1 and 999)
);

create index listing_items_listing_idx on public.listing_items (listing_id);
create index listing_items_card_idx on public.listing_items (card_id);

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null unique,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index listing_photos_listing_idx on public.listing_photos (listing_id, position);

create function public.limit_listing_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.listing_photos where listing_id = new.listing_id) >= 8 then
    raise exception 'A listing can have at most 8 photos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger listing_photos_limit
before insert on public.listing_photos
for each row execute function public.limit_listing_photos();

-- A listing can only be active when its contents match its kind (and it has photos if not a single).
create function public.enforce_listing_publishable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  item_count integer;
  photo_count integer;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select count(*) into item_count from public.listing_items where listing_id = new.id;
  select count(*) into photo_count from public.listing_photos where listing_id = new.id;

  if (new.kind = 'single' and item_count <> 1)
     or (new.kind = 'lot' and item_count < 1)
     or (new.kind = 'sealed' and item_count <> 0) then
    raise exception 'Listing items do not match its kind' using errcode = 'check_violation';
  end if;
  if new.kind <> 'single' and photo_count < 1 then
    raise exception 'Lots and sealed product need at least one photo' using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' or old.status <> 'active' then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create trigger listings_enforce_publishable
before insert or update on public.listings
for each row execute function public.enforce_listing_publishable();

-- Replaces all items of a listing atomically. Runs as the caller, so RLS applies.
create function public.replace_listing_items(p_listing_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  listing public.listings;
  item_total integer := coalesce(jsonb_array_length(p_items), 0);
begin
  select * into listing from public.listings where id = p_listing_id;
  if not found then
    raise exception 'Listing not found' using errcode = 'no_data_found';
  end if;

  if (listing.kind = 'single' and item_total <> 1)
     or (listing.kind = 'lot' and item_total not between 1 and 50)
     or (listing.kind = 'sealed' and item_total <> 0) then
    raise exception 'Listing items do not match its kind' using errcode = 'check_violation';
  end if;

  delete from public.listing_items where listing_id = p_listing_id;

  insert into public.listing_items (listing_id, card_id, condition, language, finish, quantity)
  select
    p_listing_id,
    (item ->> 'card_id')::uuid,
    item ->> 'condition',
    coalesce(item ->> 'language', 'en'),
    coalesce(item ->> 'finish', 'regular'),
    coalesce((item ->> 'quantity')::integer, 1)
  from jsonb_array_elements(p_items) as item;
end;
$$;

revoke execute on function public.replace_listing_items(uuid, jsonb) from public, anon;
grant execute on function public.replace_listing_items(uuid, jsonb) to authenticated;

-- Row Level Security
alter table public.listings enable row level security;
alter table public.listing_items enable row level security;
alter table public.listing_photos enable row level security;

create policy "active listings are public, sellers see their own"
on public.listings for select
using (status = 'active' or (select auth.uid()) = seller_id);

create policy "sellers create their own draft listings"
on public.listings for insert
to authenticated
with check (
  (select auth.uid()) = seller_id
  and status = 'draft'
  and public.is_in_good_standing()
);

create policy "sellers update their own listings"
on public.listings for update
to authenticated
using ((select auth.uid()) = seller_id and status <> 'removed')
with check (
  (select auth.uid()) = seller_id
  and status <> 'removed'
  and (status <> 'active' or public.can_publish())
);

create policy "sellers delete their own unpublished listings"
on public.listings for delete
to authenticated
using ((select auth.uid()) = seller_id and status in ('draft', 'paused'));

create policy "items follow listing visibility"
on public.listing_items for select
using (exists (select 1 from public.listings l where l.id = listing_id));

create policy "sellers manage items of their listings"
on public.listing_items for all
to authenticated
using (exists (
  select 1 from public.listings l
  where l.id = listing_id and l.seller_id = (select auth.uid()) and l.status <> 'removed'
))
with check (exists (
  select 1 from public.listings l
  where l.id = listing_id and l.seller_id = (select auth.uid()) and l.status <> 'removed'
));

create policy "photos follow listing visibility"
on public.listing_photos for select
using (exists (select 1 from public.listings l where l.id = listing_id));

create policy "sellers manage photos of their listings"
on public.listing_photos for all
to authenticated
using (exists (
  select 1 from public.listings l
  where l.id = listing_id and l.seller_id = (select auth.uid()) and l.status <> 'removed'
))
with check (exists (
  select 1 from public.listings l
  where l.id = listing_id and l.seller_id = (select auth.uid()) and l.status <> 'removed'
));

-- Sellers cannot reassign ownership, kind or timestamps.
revoke update on public.listings from authenticated, anon;
grant update (title, description, price_cents, accepts_offers, sealed_type, set_id, status)
on public.listings to authenticated;

-- Listing photos: public read, writes only inside the owner's folder (<user id>/<listing id>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']);

create policy "users upload listing photos to their own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_in_good_standing()
);

create policy "users delete their own listing photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
