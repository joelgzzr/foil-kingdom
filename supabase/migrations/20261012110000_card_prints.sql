-- Normalized catalog: `cards` holds one row per card number (gameplay data); `card_prints` holds each physical print
-- (standard art, alternate art, reprint, ...). Listings and wishlists reference a print. Source records keep the raw
-- payload of every imported record so matching can be audited and replayed.

create table public.card_prints (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  slug text not null,
  is_default boolean not null default false,
  variant_label text,
  tcgplayer_product_id bigint unique,
  image_path text,
  image_source text,
  image_sha256 text,
  created_at timestamptz not null default now(),
  unique (game_id, slug),
  constraint card_prints_default_has_no_label check (not is_default or variant_label is null)
);

create index card_prints_card_idx on public.card_prints (card_id);
create unique index card_prints_one_default_idx on public.card_prints (card_id) where is_default;

-- Every existing card becomes the default print with the same id, so existing foreign keys stay valid.
insert into public.card_prints (id, card_id, game_id, slug, is_default, image_path, image_source)
select id, id, game_id, code, true, image_path, case when image_path is not null then 'digimoncard.io' end
from public.cards;

alter table public.cards drop column image_path;

alter table public.card_prints enable row level security;
create policy "card prints are publicly readable" on public.card_prints for select using (true);
revoke insert, update, delete on public.card_prints from anon, authenticated;

-- Listings and wishlists point at a print -------------------------------------------------------------------------

drop view public.card_listing_stats;

alter table public.listing_items rename column card_id to print_id;
alter table public.listing_items drop constraint listing_items_card_id_fkey;
alter table public.listing_items add constraint listing_items_print_id_fkey foreign key (print_id) references public.card_prints (id);
alter index public.listing_items_card_idx rename to listing_items_print_idx;

alter table public.wishlist_items rename column card_id to print_id;
alter table public.wishlist_items drop constraint wishlist_items_card_id_fkey;
alter table public.wishlist_items add constraint wishlist_items_print_id_fkey foreign key (print_id) references public.card_prints (id) on delete cascade;
alter table public.wishlist_items rename constraint wishlist_items_user_id_card_id_key to wishlist_items_user_id_print_id_key;

create or replace function public.replace_listing_items(p_listing_id uuid, p_items jsonb)
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

  insert into public.listing_items (listing_id, print_id, condition, language, finish, quantity)
  select
    p_listing_id,
    (item ->> 'print_id')::uuid,
    item ->> 'condition',
    coalesce(item ->> 'language', 'en'),
    coalesce(item ->> 'finish', 'regular'),
    coalesce((item ->> 'quantity')::integer, 1)
  from jsonb_array_elements(p_items) as item;
end;
$$;

create or replace function public.notify_wishlist_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, data)
  select distinct on (w.user_id) w.user_id, 'wishlist',
    jsonb_build_object('listing_id', new.id, 'title', new.title, 'price_cents', new.price_cents)
  from public.wishlist_items w
  join public.listing_items li on li.print_id = w.print_id and li.listing_id = new.id
  where w.user_id <> new.seller_id
    and (w.max_price_cents is null or (new.kind = 'single' and new.price_cents <= w.max_price_cents))
  order by w.user_id;
  return new;
end;
$$;

-- Public per-print offer summary; security_invoker keeps RLS (only active listings are visible to anon).
create view public.print_listing_stats
with (security_invoker = true) as
select
  li.print_id,
  min(l.price_cents)::integer as min_price_cents,
  sum(li.quantity)::integer as total_copies,
  count(distinct l.seller_id)::integer as seller_count
from public.listing_items li
join public.listings l on l.id = li.listing_id
where l.kind = 'single' and l.status = 'active' and li.quantity > 0
group by li.print_id;

grant select on public.print_listing_stats to anon, authenticated;

-- Flat read model for the catalog: one row per print with its card data, sets and offer flag.
create view public.catalog_prints
with (security_invoker = true) as
select
  p.id,
  p.card_id,
  p.game_id,
  p.slug,
  p.is_default,
  p.variant_label,
  p.tcgplayer_product_id,
  p.image_path,
  c.code,
  c.name,
  c.card_type,
  c.color,
  c.color2,
  c.rarity,
  c.level,
  c.play_cost,
  c.evolution_cost,
  c.dp,
  c.attribute,
  c.form,
  c.stage,
  c.digi_types,
  c.main_effect,
  c.source_effect,
  array(select s.set_id from public.card_set_cards s where s.card_id = c.id) as set_ids,
  exists (select 1 from public.print_listing_stats s where s.print_id = p.id) as is_listed
from public.card_prints p
join public.cards c on c.id = p.card_id;

grant select on public.catalog_prints to anon, authenticated;

-- Source ingestion ------------------------------------------------------------------------------------------------

create table public.catalog_source_records (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  source text not null,
  external_id text not null,
  kind text not null check (kind in ('card', 'print')),
  number text,
  card_id uuid references public.cards (id) on delete set null,
  print_id uuid references public.card_prints (id) on delete set null,
  match_method text not null check (match_method in ('code', 'override', 'default_print', 'unmatched', 'ignored')),
  payload jsonb not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source, external_id)
);

create index catalog_source_records_unmatched_idx on public.catalog_source_records (last_seen_at)
where match_method = 'unmatched';

-- Manual corrections: map a source record to a card number, or ignore it. Read by the sync on every run.
create table public.catalog_match_overrides (
  source text not null,
  external_id text not null,
  code text,
  ignore boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  primary key (source, external_id),
  constraint catalog_match_overrides_target check (ignore or code is not null)
);

alter table public.catalog_sync_runs
  add column prints_upserted integer not null default 0,
  add column unmatched_count integer not null default 0,
  add column report jsonb;

-- Service role only: no policies, no grants.
alter table public.catalog_source_records enable row level security;
alter table public.catalog_match_overrides enable row level security;
revoke all on public.catalog_source_records, public.catalog_match_overrides from anon, authenticated;
