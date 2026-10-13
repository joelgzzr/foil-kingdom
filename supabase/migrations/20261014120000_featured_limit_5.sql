-- Showcase ("Destacadas") holds at most 5 listings per seller (was 12).

-- Keep the 5 most recently pinned listings of each seller.
update public.listings l
set featured_at = null
from (
  select id, row_number() over (partition by seller_id order by featured_at desc, id) as rn
  from public.listings
  where featured_at is not null
) ranked
where l.id = ranked.id and ranked.rn > 5;

create or replace function public.set_listing_featured(p_listing_id uuid, p_featured boolean)
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
    ) >= 5 then
      raise exception 'Too many featured listings' using errcode = '54000';
    end if;
    update public.listings set featured_at = coalesce(featured_at, now()) where id = listing.id;
  else
    update public.listings set featured_at = null where id = listing.id;
  end if;
end;
$$;
