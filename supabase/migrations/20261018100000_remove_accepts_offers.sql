-- Offers are always allowed, so listings no longer carry a per-listing switch.

drop view public.seller_collection_stats;
drop view public.listing_search;

-- One row per active listing with the card facets of its items, so the collection can filter with array operators.
create view public.listing_search
with (security_invoker = true) as
select
  l.id,
  l.seller_id,
  l.kind,
  l.title,
  l.price_cents,
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

create or replace function public.create_listings_from_scan(p_items jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  item jsonb;
  card record;
  new_id uuid;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'Invalid items' using errcode = 'check_violation';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    select p.id, p.game_id, c.name, c.code, p.variant_label into card
    from public.card_prints p join public.cards c on c.id = p.card_id
    where p.id = (item ->> 'print_id')::uuid;
    if not found then
      raise exception 'Unknown print' using errcode = 'no_data_found';
    end if;

    insert into public.listings (seller_id, game_id, kind, title, price_cents, status, source)
    values (
      uid,
      card.game_id,
      'single',
      left(card.name || ' (' || card.code || ')' || coalesce(' · ' || card.variant_label, ''), 100),
      (item ->> 'price_cents')::integer,
      'draft',
      'scan'
    )
    returning id into new_id;

    insert into public.listing_items (listing_id, print_id, condition, language, finish, quantity)
    values (
      new_id,
      card.id,
      item ->> 'condition',
      coalesce(item ->> 'language', 'en'),
      coalesce(item ->> 'finish', 'regular'),
      coalesce((item ->> 'quantity')::integer, 1)
    );

    return next new_id;
  end loop;
end;
$$;

revoke execute on function public.create_listings_from_scan(jsonb) from public, anon;
grant execute on function public.create_listings_from_scan(jsonb) to authenticated;

create or replace function public.make_offer(p_conversation_id uuid, p_amount_cents integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  conv public.conversations;
  ceiling bigint;
  open_count integer;
  blocking integer;
  message_id uuid;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into conv from public.conversations where id = p_conversation_id and buyer_id = uid for update;
  if not found then
    raise exception 'Only the buyer can make offers' using errcode = '42501';
  end if;
  if public.conversation_has_pending_order(conv.id) then
    raise exception 'Order pending' using errcode = 'check_violation';
  end if;

  select count(*), count(*) filter (where l.id is null or l.status <> 'active'),
    sum(l.price_cents::bigint * i.quantity)
  into open_count, blocking, ceiling
  from public.conversation_items i
  left join public.listings l on l.id = i.listing_id
  where i.conversation_id = conv.id and i.order_id is null;
  if open_count < 1 or blocking > 0 then
    ceiling := null;
  end if;

  if ceiling is null then
    raise exception 'Offers unavailable' using errcode = 'check_violation';
  end if;
  if p_amount_cents < 100 or p_amount_cents > ceiling then
    raise exception 'Invalid offer amount' using errcode = 'check_violation';
  end if;

  update public.messages set offer_status = 'withdrawn'
  where conversation_id = conv.id and kind = 'offer' and offer_status = 'pending';

  insert into public.messages (conversation_id, sender_id, kind, offer_cents, offer_status, offer_scope, offer_item_id)
  values (conv.id, uid, 'offer', p_amount_cents, 'pending', 'bundle', null)
  returning id into message_id;

  return message_id;
end;
$$;

alter table public.listings drop column accepts_offers;
