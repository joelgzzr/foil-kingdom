-- Seller collection: pinned listings and a flat, filterable read model of active listings.

alter table public.listings add column featured_at timestamptz;

create index listings_featured_idx on public.listings (seller_id, featured_at desc) where featured_at is not null;

-- Listings that stop being active leave the showcase.
create function public.clear_featured_when_inactive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    new.featured_at := null;
  end if;
  return new;
end;
$$;

create trigger listings_clear_featured
before update on public.listings
for each row execute function public.clear_featured_when_inactive();

-- featured_at is not in the column grants above, so pinning goes through this function (at most 12 per seller).
create function public.set_listing_featured(p_listing_id uuid, p_featured boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  listing public.listings;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into listing from public.listings where id = p_listing_id and seller_id = uid for update;
  if not found then
    raise exception 'Listing not found' using errcode = 'no_data_found';
  end if;

  if p_featured then
    if listing.status <> 'active' then
      raise exception 'Only active listings can be featured' using errcode = 'check_violation';
    end if;
    if listing.featured_at is null and (
      select count(*) from public.listings where seller_id = uid and featured_at is not null
    ) >= 12 then
      raise exception 'Too many featured listings' using errcode = '54000';
    end if;
    update public.listings set featured_at = coalesce(featured_at, now()) where id = listing.id;
  else
    update public.listings set featured_at = null where id = listing.id;
  end if;
end;
$$;

revoke execute on function public.set_listing_featured(uuid, boolean) from public, anon;
grant execute on function public.set_listing_featured(uuid, boolean) to authenticated;

-- One row per active listing with the card facets of its items, so the collection can filter with array operators.
create view public.listing_search
with (security_invoker = true) as
select
  l.id,
  l.seller_id,
  l.kind,
  l.title,
  l.price_cents,
  l.accepts_offers,
  l.sealed_type,
  l.published_at,
  l.featured_at,
  coalesce((select sum(li.quantity) from public.listing_items li where li.listing_id = l.id), 0)::integer as total_copies,
  coalesce(a.colors, '{}') as colors,
  coalesce(a.rarities, '{}') as rarities,
  coalesce(a.card_types, '{}') as card_types,
  coalesce(a.conditions, '{}') as conditions,
  coalesce(a.languages, '{}') as languages,
  coalesce(a.finishes, '{}') as finishes,
  array(
    select s.set_id from public.listing_items li
    join public.card_prints p on p.id = li.print_id
    join public.card_set_cards s on s.card_id = p.card_id
    where li.listing_id = l.id
    union
    select l.set_id where l.set_id is not null
  ) as set_ids,
  lower(l.title || ' ' || coalesce(a.card_text, '')) as search_text,
  a.cover_image_path
from public.listings l
left join lateral (
  select
    array_remove(array_agg(distinct col.v), null) as colors,
    array_remove(array_agg(distinct c.rarity), null) as rarities,
    array_remove(array_agg(distinct c.card_type), null) as card_types,
    array_agg(distinct li.condition) as conditions,
    array_agg(distinct li.language) as languages,
    array_agg(distinct li.finish) as finishes,
    string_agg(distinct c.name || ' ' || c.code, ' ') as card_text,
    (array_agg(p.image_path order by li.created_at, li.id) filter (where p.image_path is not null))[1] as cover_image_path
  from public.listing_items li
  join public.card_prints p on p.id = li.print_id
  join public.cards c on c.id = p.card_id
  cross join lateral unnest(array[c.color, c.color2]) as col(v)
  where li.listing_id = l.id
) a on true
where l.status = 'active';

grant select on public.listing_search to anon, authenticated;

create view public.seller_collection_stats
with (security_invoker = true) as
select seller_id, count(*)::integer as listing_count, sum(total_copies)::integer as total_copies
from public.listing_search
group by seller_id;

grant select on public.seller_collection_stats to anon, authenticated;
