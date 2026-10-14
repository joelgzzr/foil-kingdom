-- Offers go both ways: the buyer can offer the full price, the seller can counter a pending buyer offer, and the
-- shipment can only be created once an offer was accepted, at exactly that price.

alter table public.messages drop constraint messages_shape;
alter table public.messages add constraint messages_shape check (
  (kind = 'text' and body is not null and char_length(body) between 1 and 1000
    and offer_cents is null and offer_status is null and offer_scope is null and note is null)
  or (kind = 'offer' and body is null and offer_cents between 100 and 100000000
    and offer_status in ('pending', 'accepted', 'rejected', 'withdrawn', 'countered')
    and (offer_scope = 'item' or (offer_scope = 'bundle' and offer_item_id is null))
    and note is null)
  or (kind = 'system'
    and body in (
      'offer_accepted', 'offer_rejected', 'offer_withdrawn', 'item_added', 'item_removed', 'item_changed',
      'item_sold', 'order_cancelled', 'sale_completed'
    )
    and offer_cents is null and offer_status is null and offer_scope is null
    and (note is null or char_length(note) <= 300))
);

-- List total of the open cards, or null when offers are not possible (no cards or one is no longer active).
create function public.conversation_offer_ceiling(p_conversation_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case when count(*) >= 1 and count(*) filter (where l.id is null or l.status <> 'active') = 0
    then sum(l.price_cents::bigint * i.quantity) end
  from public.conversation_items i
  left join public.listings l on l.id = i.listing_id
  where i.conversation_id = p_conversation_id and i.order_id is null;
$$;

revoke execute on function public.conversation_offer_ceiling(uuid) from public, anon, authenticated;

-- A null amount offers the full list price.
create or replace function public.make_offer(p_conversation_id uuid, p_amount_cents integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  conv public.conversations;
  ceiling bigint;
  amount integer;
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

  ceiling := public.conversation_offer_ceiling(conv.id);
  if ceiling is null then
    raise exception 'Offers unavailable' using errcode = 'check_violation';
  end if;
  amount := coalesce(p_amount_cents, ceiling);
  if amount < 100 or amount > ceiling then
    raise exception 'Invalid offer amount' using errcode = 'check_violation';
  end if;

  update public.messages set offer_status = 'withdrawn'
  where conversation_id = conv.id and kind = 'offer' and offer_status = 'pending';

  insert into public.messages (conversation_id, sender_id, kind, offer_cents, offer_status, offer_scope, offer_item_id)
  values (conv.id, uid, 'offer', amount, 'pending', 'bundle', null)
  returning id into message_id;

  return message_id;
end;
$$;

-- The seller answers a pending buyer offer with a different amount, never above the list total.
create function public.counter_offer(p_message_id uuid, p_amount_cents integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  msg public.messages;
  conv public.conversations;
  ceiling bigint;
  message_id uuid;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into msg from public.messages where id = p_message_id and kind = 'offer' and offer_status = 'pending';
  if not found then
    raise exception 'Offer not pending' using errcode = 'no_data_found';
  end if;
  select * into conv from public.conversations where id = msg.conversation_id and seller_id = uid for update;
  if not found or msg.sender_id <> conv.buyer_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if public.conversation_has_pending_order(conv.id) then
    raise exception 'Order pending' using errcode = 'check_violation';
  end if;

  ceiling := public.conversation_offer_ceiling(conv.id);
  if ceiling is null then
    raise exception 'Offers unavailable' using errcode = 'check_violation';
  end if;
  if p_amount_cents < 100 or p_amount_cents > ceiling then
    raise exception 'Invalid offer amount' using errcode = 'check_violation';
  end if;

  update public.messages set offer_status = 'countered' where id = msg.id;
  update public.messages set offer_status = 'withdrawn'
  where conversation_id = conv.id and kind = 'offer' and offer_status = 'pending';

  insert into public.messages (conversation_id, sender_id, kind, offer_cents, offer_status, offer_scope, offer_item_id)
  values (conv.id, uid, 'offer', p_amount_cents, 'pending', 'bundle', null)
  returning id into message_id;

  return message_id;
end;
$$;

-- The other party accepts or rejects a pending offer; its sender can withdraw it. Accepting records the agreed price.
create or replace function public.respond_to_offer(p_message_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  msg public.messages;
  conv public.conversations;
  new_status text;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into msg from public.messages where id = p_message_id and kind = 'offer' and offer_status = 'pending';
  if not found then
    raise exception 'Offer not pending' using errcode = 'no_data_found';
  end if;
  select * into conv from public.conversations where id = msg.conversation_id for update;

  if uid not in (conv.buyer_id, conv.seller_id) then
    raise exception 'Not allowed' using errcode = '42501';
  elsif p_action in ('accept', 'reject') and uid <> msg.sender_id then
    new_status := case p_action when 'accept' then 'accepted' else 'rejected' end;
  elsif p_action = 'withdraw' and uid = msg.sender_id then
    new_status := 'withdrawn';
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if new_status = 'accepted' then
    if public.conversation_has_pending_order(conv.id) then
      raise exception 'Order pending' using errcode = 'check_violation';
    end if;
    update public.conversations set agreed_bundle_cents = msg.offer_cents where id = conv.id;
  end if;

  update public.messages set offer_status = new_status where id = msg.id;
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (conv.id, uid, 'system', 'offer_' || new_status);
end;
$$;

revoke execute on function public.counter_offer(uuid, integer) from public, anon;
grant execute on function public.counter_offer(uuid, integer) to authenticated;

-- The price is the accepted offer, so the seller no longer types one.
drop function public.create_order(uuid, integer, text, uuid);

create function public.create_order(
  p_conversation_id uuid,
  p_package_preset text,
  p_origin_address_id uuid
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
  entry record;
  stock public.listing_items;
  remaining integer;
  weight integer;
  len integer;
  wid integer;
  hgt integer;
  new_order_id uuid;
  item_count integer := 0;
  first_title text;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into conv from public.conversations where id = p_conversation_id and seller_id = uid for update;
  if not found then
    raise exception 'Only the seller can create the order' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.orders where conversation_id = conv.id and status in ('paid', 'label_failed')
  ) then
    raise exception 'Order in progress' using errcode = 'unique_violation';
  end if;

  -- The agreed price is the accepted offer; without one there is nothing to ship.
  if conv.agreed_bundle_cents is null then
    raise exception 'No accepted offer' using errcode = 'check_violation';
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

  insert into public.orders (
    conversation_id, listing_title, buyer_id, seller_id, item_price_cents,
    package_preset, weight_grams, length_cm, width_cm, height_cm, origin_summary
  ) values (
    conv.id, conv.listing_title, conv.buyer_id, conv.seller_id, conv.agreed_bundle_cents,
    p_package_preset, weight, len, wid, hgt, addr.municipality || ', ' || addr.state
  ) returning id into new_order_id;

  -- Listings are locked in id order so concurrent bundles cannot deadlock; stock is reserved per item.
  for entry in
    select i.id as item_id, i.quantity, i.agreed_price_cents, i.title as item_title,
      l.id as listing_id, l.kind, l.status, l.price_cents
    from public.conversation_items i
    join public.listings l on l.id = i.listing_id
    where i.conversation_id = conv.id and i.order_id is null
    order by l.id
    for update of l
  loop
    if entry.status <> 'active' then
      raise exception 'Item unavailable' using errcode = 'check_violation';
    end if;

    stock := null;
    remaining := 0;
    if entry.kind = 'single' then
      select * into stock from public.listing_items where listing_id = entry.listing_id for update;
      if not found or stock.quantity < entry.quantity then
        raise exception 'Not enough stock' using errcode = 'check_violation';
      end if;
      remaining := stock.quantity - entry.quantity;
      update public.listing_items set quantity = remaining where id = stock.id;
      if remaining = 0 then
        update public.listings set status = 'sold' where id = entry.listing_id;
      end if;
    else
      update public.listings set status = 'sold' where id = entry.listing_id;
    end if;

    insert into public.order_items (
      order_id, listing_id, title, quantity, unit_price_cents, agreed_price_cents, condition, language, finish
    ) values (
      new_order_id, entry.listing_id, entry.item_title, entry.quantity, entry.price_cents,
      coalesce(entry.agreed_price_cents, entry.price_cents::bigint * entry.quantity), stock.condition, stock.language, stock.finish
    );
    update public.conversation_items set order_id = new_order_id where id = entry.item_id;
    perform public.trim_listing_in_other_conversations(entry.listing_id, conv.id, remaining);

    item_count := item_count + 1;
    first_title := coalesce(first_title, entry.item_title);
  end loop;

  if item_count = 0 then
    raise exception 'No items' using errcode = 'no_data_found';
  end if;

  update public.orders
  set listing_title = case when item_count > 1 then first_title || ' +' || (item_count - 1) else first_title end
  where id = new_order_id;
  update public.conversations set agreed_bundle_cents = null where id = conv.id;

  insert into public.order_addresses (
    order_id, party, recipient_name, phone, street, exterior_number, interior_number,
    neighborhood, municipality, state, postal_code, reference
  ) values (
    new_order_id, 'origin', addr.recipient_name, addr.phone, addr.street, addr.exterior_number, addr.interior_number,
    addr.neighborhood, addr.municipality, addr.state, addr.postal_code, addr.reference
  );

  insert into public.notifications (user_id, type, conversation_id, data)
  values (
    conv.buyer_id, 'order', conv.id,
    jsonb_build_object('status', 'awaiting_buyer', 'listing_title', (select listing_title from public.orders where id = new_order_id))
  );

  return new_order_id;
end;
$$;

revoke execute on function public.create_order(uuid, text, uuid) from public, anon;
grant execute on function public.create_order(uuid, text, uuid) to authenticated;
