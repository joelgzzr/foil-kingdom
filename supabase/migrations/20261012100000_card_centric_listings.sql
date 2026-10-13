-- Card-centric marketplace: per-copy price, stock on listing items, per-card stats and stock-aware orders.

alter table public.listing_items drop constraint listing_items_quantity_range;
alter table public.listing_items add constraint listing_items_quantity_range check (quantity between 0 and 999);

alter table public.orders add column quantity integer not null default 1;
alter table public.orders add constraint orders_quantity_range check (quantity between 1 and 999);

-- Public per-card offer summary; security_invoker keeps RLS (only active listings are visible to anon).
create view public.card_listing_stats
with (security_invoker = true) as
select
  li.card_id,
  min(l.price_cents)::integer as min_price_cents,
  sum(li.quantity)::integer as total_copies,
  count(distinct l.seller_id)::integer as seller_count
from public.listing_items li
join public.listings l on l.id = li.listing_id
where l.kind = 'single' and l.status = 'active' and li.quantity > 0
group by li.card_id;

grant select on public.card_listing_stats to anon, authenticated;

drop function public.create_order(uuid, integer, text, uuid);

-- p_item_price_cents is the total agreed price for p_quantity copies.
create function public.create_order(
  p_conversation_id uuid,
  p_item_price_cents integer,
  p_package_preset text,
  p_origin_address_id uuid,
  p_quantity integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  conv public.conversations;
  addr public.addresses;
  item public.listing_items;
  weight integer;
  len integer;
  wid integer;
  hgt integer;
  order_id uuid;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into conv from public.conversations where id = p_conversation_id and seller_id = uid;
  if not found then
    raise exception 'Only the seller can create the order' using errcode = '42501';
  end if;

  if p_item_price_cents < 100 or p_item_price_cents > 100000000 or p_quantity not between 1 and 999 then
    raise exception 'Invalid price' using errcode = 'check_violation';
  end if;

  select * into weight, len, wid, hgt from (
    select case p_package_preset
      when 'envelope' then 100 when 'small_box' then 500 when 'medium_box' then 1500 end,
    case p_package_preset
      when 'envelope' then 22 when 'small_box' then 25 when 'medium_box' then 30 end,
    case p_package_preset
      when 'envelope' then 12 when 'small_box' then 18 when 'medium_box' then 25 end,
    case p_package_preset
      when 'envelope' then 1 when 'small_box' then 10 when 'medium_box' then 15 end
  ) as preset;
  if weight is null then
    raise exception 'Invalid package' using errcode = 'check_violation';
  end if;

  select * into addr from public.addresses where id = p_origin_address_id and user_id = uid;
  if not found then
    raise exception 'Address not found' using errcode = 'no_data_found';
  end if;

  -- Reserve stock; the listing is marked sold when it runs out.
  if conv.listing_id is not null then
    select li.* into item
    from public.listing_items li
    join public.listings l on l.id = li.listing_id
    where li.listing_id = conv.listing_id and l.kind = 'single'
    for update of li;

    if found then
      if item.quantity < p_quantity then
        raise exception 'Not enough stock' using errcode = 'check_violation';
      end if;
      update public.listing_items set quantity = quantity - p_quantity where id = item.id;
      if item.quantity - p_quantity = 0 then
        update public.listings set status = 'sold' where id = conv.listing_id and status = 'active';
      end if;
    end if;
  end if;

  insert into public.orders (
    conversation_id, listing_id, listing_title, buyer_id, seller_id, item_price_cents, quantity,
    package_preset, weight_grams, length_cm, width_cm, height_cm, origin_summary
  ) values (
    conv.id, conv.listing_id, conv.listing_title, conv.buyer_id, conv.seller_id, p_item_price_cents, p_quantity,
    p_package_preset, weight, len, wid, hgt, addr.municipality || ', ' || addr.state
  ) returning id into order_id;

  insert into public.order_addresses (
    order_id, party, recipient_name, phone, street, exterior_number, interior_number,
    neighborhood, municipality, state, postal_code, reference
  ) values (
    order_id, 'origin', addr.recipient_name, addr.phone, addr.street, addr.exterior_number, addr.interior_number,
    addr.neighborhood, addr.municipality, addr.state, addr.postal_code, addr.reference
  );

  insert into public.notifications (user_id, type, conversation_id, data)
  values (conv.buyer_id, 'order', conv.id, jsonb_build_object('status', 'awaiting_buyer', 'listing_title', conv.listing_title));

  return order_id;
end;
$$;

drop function public.cancel_order(uuid);

-- Either party can cancel before payment; reserved stock goes back to the listing.
create function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ord public.orders;
  other uuid;
begin
  if uid is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into ord from public.orders
  where id = p_order_id and uid in (buyer_id, seller_id) and status in ('awaiting_buyer', 'awaiting_payment')
  for update;
  if not found then
    raise exception 'Order not cancellable' using errcode = 'no_data_found';
  end if;

  update public.orders set status = 'cancelled' where id = ord.id;

  if ord.listing_id is not null then
    update public.listing_items li
    set quantity = least(li.quantity + ord.quantity, 999)
    from public.listings l
    where li.listing_id = ord.listing_id and l.id = li.listing_id and l.kind = 'single';

    update public.listings set status = 'active' where id = ord.listing_id and kind = 'single' and status = 'sold';
  end if;

  other := case when uid = ord.buyer_id then ord.seller_id else ord.buyer_id end;
  insert into public.notifications (user_id, type, conversation_id, data)
  values (other, 'order', ord.conversation_id, jsonb_build_object('status', 'cancelled', 'listing_title', ord.listing_title));
end;
$$;

revoke execute on function public.create_order(uuid, integer, text, uuid, integer), public.cancel_order(uuid)
from public, anon;
grant execute on function public.create_order(uuid, integer, text, uuid, integer), public.cancel_order(uuid)
to authenticated;
