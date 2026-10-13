-- Bundles: one conversation per buyer/seller pair holds the cards under negotiation (conversation_items);
-- an order carries several items (order_items) and a single shipping charge.

create table public.conversation_items (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- Snapshot so the chat stays readable once the listing is no longer public.
  title text not null,
  -- Copies wanted; always 1 for lots and sealed product.
  quantity integer not null default 1,
  -- Total agreed for this line (all copies) through an accepted per-card offer.
  agreed_price_cents integer,
  added_by uuid references public.profiles (id) on delete set null,
  -- Set once an order takes the item; null while it is still being negotiated.
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint conversation_items_quantity_range check (quantity between 1 and 999),
  constraint conversation_items_agreed_range check (agreed_price_cents is null or agreed_price_cents between 100 and 100000000)
);

create unique index conversation_items_open_listing_idx on public.conversation_items (conversation_id, listing_id)
where order_id is null;
create index conversation_items_conversation_idx on public.conversation_items (conversation_id);
create index conversation_items_order_idx on public.conversation_items (order_id) where order_id is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  title text not null,
  quantity integer not null,
  -- List price per copy when the order was created.
  unit_price_cents integer not null,
  -- Total agreed for the line (informational, paid off-platform).
  agreed_price_cents integer not null,
  condition text,
  language text,
  finish text,
  created_at timestamptz not null default now(),
  constraint order_items_quantity_range check (quantity between 1 and 999),
  constraint order_items_prices_positive check (unit_price_cents > 0 and agreed_price_cents > 0)
);

create index order_items_order_idx on public.order_items (order_id);

-- Backfill existing data ---------------------------------------------------------------------------------------------

insert into public.order_items (order_id, listing_id, title, quantity, unit_price_cents, agreed_price_cents, condition, language, finish)
select o.id, o.listing_id, o.listing_title, o.quantity,
  greatest(1, round(o.item_price_cents::numeric / o.quantity))::integer, o.item_price_cents,
  li.condition, li.language, li.finish
from public.orders o
left join public.listing_items li on li.listing_id = o.listing_id and o.listing_id is not null
  and (select count(*) from public.listing_items x where x.listing_id = o.listing_id) = 1;

insert into public.conversation_items (conversation_id, listing_id, title, quantity, added_by, order_id)
select c.id, c.listing_id, c.listing_title, coalesce(o.quantity, 1), c.buyer_id, o.id
from public.conversations c
left join lateral (
  select o.id, o.quantity from public.orders o
  where o.conversation_id = c.id and o.status <> 'cancelled'
  order by o.created_at desc limit 1
) o on true
where c.listing_id is not null;

-- Offers made so far were about the conversation's single listing.
alter table public.messages add column offer_scope text;
alter table public.messages add column offer_item_id uuid references public.conversation_items (id) on delete set null;

update public.messages m
set offer_scope = 'item',
    offer_item_id = (select i.id from public.conversation_items i where i.conversation_id = m.conversation_id order by i.created_at limit 1)
where m.kind = 'offer';

-- One conversation per buyer/seller pair: fold duplicates into the oldest one.
create temporary table conversation_merge as
select id, first_value(id) over (partition by buyer_id, seller_id order by created_at, id) as keep_id
from public.conversations;

update public.messages m set conversation_id = cm.keep_id from conversation_merge cm where m.conversation_id = cm.id and cm.id <> cm.keep_id;
update public.orders o set conversation_id = cm.keep_id from conversation_merge cm where o.conversation_id = cm.id and cm.id <> cm.keep_id;
update public.notifications n set conversation_id = cm.keep_id from conversation_merge cm where n.conversation_id = cm.id and cm.id <> cm.keep_id;
update public.whatsapp_reveals w set conversation_id = cm.keep_id from conversation_merge cm where w.conversation_id = cm.id and cm.id <> cm.keep_id;
update public.conversation_items i set conversation_id = cm.keep_id from conversation_merge cm where i.conversation_id = cm.id and cm.id <> cm.keep_id;

update public.conversations c
set last_message_at = m.created_at,
    last_message_sender_id = m.sender_id,
    last_message_kind = m.kind,
    last_message_preview = case m.kind when 'text' then left(m.body, 80) when 'offer' then m.offer_cents::text else m.body end
from (select distinct on (conversation_id) * from public.messages order by conversation_id, created_at desc) m
where m.conversation_id = c.id and c.id in (select keep_id from conversation_merge where id <> keep_id);

delete from public.conversations where id in (select id from conversation_merge where id <> keep_id);
drop table conversation_merge;

-- Schema changes ---------------------------------------------------------------------------------------------------

alter table public.conversations drop column listing_id;
alter table public.conversations add constraint conversations_pair_unique unique (buyer_id, seller_id);
-- Total accepted for the whole bundle; cleared whenever the item set changes.
alter table public.conversations add column agreed_bundle_cents integer;
alter table public.conversations add constraint conversations_agreed_bundle_range
  check (agreed_bundle_cents is null or agreed_bundle_cents between 100 and 100000000);

alter table public.orders drop column listing_id;
alter table public.orders drop column quantity;

-- Only an order still waiting for checkout blocks the next one; shipped orders do not.
drop index public.orders_one_open_per_conversation;
create unique index orders_one_pending_per_conversation on public.orders (conversation_id)
where status in ('awaiting_buyer', 'awaiting_payment');

alter table public.messages drop constraint messages_shape;
alter table public.messages add constraint messages_shape check (
  (kind = 'text' and body is not null and char_length(body) between 1 and 1000
    and offer_cents is null and offer_status is null and offer_scope is null)
  or (kind = 'offer' and body is null and offer_cents between 100 and 100000000
    and offer_status in ('pending', 'accepted', 'rejected', 'withdrawn')
    and (offer_scope = 'item' or (offer_scope = 'bundle' and offer_item_id is null)))
  or (kind = 'system'
    and body in ('offer_accepted', 'offer_rejected', 'offer_withdrawn', 'item_added', 'item_removed', 'item_changed')
    and offer_cents is null and offer_status is null and offer_scope is null)
);

-- Row Level Security -----------------------------------------------------------------------------------------------

alter table public.conversation_items enable row level security;
alter table public.order_items enable row level security;

create policy "participants read conversation items"
on public.conversation_items for select
to authenticated
using (exists (
  select 1 from public.conversations c
  where c.id = conversation_id and (select auth.uid()) in (c.buyer_id, c.seller_id)
));

create policy "participants read order items"
on public.order_items for select
to authenticated
using (exists (
  select 1 from public.orders o where o.id = order_id and (select auth.uid()) in (o.buyer_id, o.seller_id)
));

revoke all on public.conversation_items, public.order_items from anon;
revoke insert, update, delete on public.conversation_items, public.order_items from authenticated;

-- Internal helpers (not callable by clients) -----------------------------------------------------------------------

create function public.conversation_has_pending_order(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders
    where conversation_id = p_conversation_id and status in ('awaiting_buyer', 'awaiting_payment')
  );
$$;

-- The conversation title summarises the open items: the first title plus a count of the rest.
create function public.refresh_conversation_title(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_count integer;
  first_title text;
begin
  select count(*), (array_agg(title order by created_at, id))[1]
  into item_count, first_title
  from public.conversation_items
  where conversation_id = p_conversation_id and order_id is null;

  if item_count > 0 then
    update public.conversations
    set listing_title = case when item_count > 1 then first_title || ' +' || (item_count - 1) else first_title end
    where id = p_conversation_id;
  end if;
end;
$$;

-- Any change to the item set invalidates bundle prices and the pending offers that depended on it.
create function public.reset_conversation_pricing(p_conversation_id uuid, p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages set offer_status = 'withdrawn'
  where conversation_id = p_conversation_id and kind = 'offer' and offer_status = 'pending'
    and (offer_scope = 'bundle' or offer_item_id = p_item_id);

  update public.conversations set agreed_bundle_cents = null where id = p_conversation_id;

  if p_item_id is not null then
    update public.conversation_items set agreed_price_cents = null where id = p_item_id;
  end if;
end;
$$;

create function public.add_conversation_items_internal(
  p_conversation_id uuid, p_seller_id uuid, p_listing_ids uuid[], p_added_by uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted integer := (select count(distinct id) from unnest(p_listing_ids) as id);
  available integer;
  added integer;
  open_total integer;
begin
  select count(*) into available from public.listings
  where id = any (p_listing_ids) and seller_id = p_seller_id and status = 'active';
  if available <> wanted then
    raise exception 'Listing not available' using errcode = 'no_data_found';
  end if;

  insert into public.conversation_items (conversation_id, listing_id, title, added_by)
  select p_conversation_id, l.id, l.title, p_added_by
  from public.listings l
  where l.id = any (p_listing_ids)
  on conflict (conversation_id, listing_id) where order_id is null do nothing;
  get diagnostics added = row_count;

  select count(*) into open_total from public.conversation_items
  where conversation_id = p_conversation_id and order_id is null;
  if open_total > 50 then
    raise exception 'Too many items' using errcode = '54000';
  end if;

  if added > 0 then
    perform public.reset_conversation_pricing(p_conversation_id, null);
    perform public.refresh_conversation_title(p_conversation_id);
  end if;
  return added;
end;
$$;

revoke execute on function
  public.conversation_has_pending_order(uuid), public.refresh_conversation_title(uuid),
  public.reset_conversation_pricing(uuid, uuid), public.add_conversation_items_internal(uuid, uuid, uuid[], uuid)
from public, anon, authenticated;

-- Conversations ----------------------------------------------------------------------------------------------------

drop function public.start_conversation(uuid);

-- Opens (or reuses) the conversation with the seller of the given listings and adds them as items.
create function public.start_conversation(p_listing_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  seller uuid;
  first_title text;
  conv_id uuid;
  existed boolean;
  added integer;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_listing_ids is null or cardinality(p_listing_ids) not between 1 and 50 then
    raise exception 'Invalid items' using errcode = 'check_violation';
  end if;

  select seller_id, title into seller, first_title from public.listings
  where id = p_listing_ids[1] and status = 'active';
  if not found then
    raise exception 'Listing not available' using errcode = 'no_data_found';
  end if;
  if seller = uid then
    raise exception 'Cannot contact yourself' using errcode = 'check_violation';
  end if;

  select id into conv_id from public.conversations where buyer_id = uid and seller_id = seller;
  existed := found;

  if not existed then
    insert into public.conversations (buyer_id, seller_id, listing_title)
    values (uid, seller, first_title)
    on conflict (buyer_id, seller_id) do nothing
    returning id into conv_id;
    if conv_id is null then
      select id into conv_id from public.conversations where buyer_id = uid and seller_id = seller;
      existed := true;
    end if;
  end if;

  if existed and public.conversation_has_pending_order(conv_id) then
    raise exception 'Order pending' using errcode = 'check_violation';
  end if;

  added := public.add_conversation_items_internal(conv_id, seller, p_listing_ids, uid);

  if existed and added > 0 then
    insert into public.messages (conversation_id, sender_id, kind, body) values (conv_id, uid, 'system', 'item_added');
  end if;
  return conv_id;
end;
$$;

-- The buyer adds more cards from the same seller while no order is waiting for checkout.
create function public.add_conversation_items(p_conversation_id uuid, p_listing_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  conv public.conversations;
  added integer;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_listing_ids is null or cardinality(p_listing_ids) not between 1 and 50 then
    raise exception 'Invalid items' using errcode = 'check_violation';
  end if;

  select * into conv from public.conversations where id = p_conversation_id and buyer_id = uid for update;
  if not found then
    raise exception 'Only the buyer can add items' using errcode = '42501';
  end if;
  if public.conversation_has_pending_order(conv.id) then
    raise exception 'Order pending' using errcode = 'check_violation';
  end if;

  added := public.add_conversation_items_internal(conv.id, conv.seller_id, p_listing_ids, uid);
  if added > 0 then
    insert into public.messages (conversation_id, sender_id, kind, body) values (conv.id, uid, 'system', 'item_added');
  end if;
end;
$$;

-- Either party can take a card out of the negotiation.
create function public.remove_conversation_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  item public.conversation_items;
  conv public.conversations;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into item from public.conversation_items where id = p_item_id and order_id is null;
  if not found then
    raise exception 'Item not found' using errcode = 'no_data_found';
  end if;
  select * into conv from public.conversations where id = item.conversation_id and uid in (buyer_id, seller_id) for update;
  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if public.conversation_has_pending_order(conv.id) then
    raise exception 'Order pending' using errcode = 'check_violation';
  end if;

  perform public.reset_conversation_pricing(conv.id, item.id);
  delete from public.conversation_items where id = item.id;
  perform public.refresh_conversation_title(conv.id);
  insert into public.messages (conversation_id, sender_id, kind, body) values (conv.id, uid, 'system', 'item_removed');
end;
$$;

create function public.set_conversation_item_quantity(p_item_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  item public.conversation_items;
  conv public.conversations;
  listing public.listings;
  stock integer;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into item from public.conversation_items where id = p_item_id and order_id is null;
  if not found then
    raise exception 'Item not found' using errcode = 'no_data_found';
  end if;
  select * into conv from public.conversations where id = item.conversation_id and buyer_id = uid for update;
  if not found then
    raise exception 'Only the buyer can change quantities' using errcode = '42501';
  end if;
  if public.conversation_has_pending_order(conv.id) then
    raise exception 'Order pending' using errcode = 'check_violation';
  end if;

  select * into listing from public.listings where id = item.listing_id and status = 'active';
  if not found then
    raise exception 'Listing not available' using errcode = 'no_data_found';
  end if;

  if listing.kind = 'single' then
    select quantity into stock from public.listing_items where listing_id = listing.id;
    if p_quantity not between 1 and coalesce(stock, 0) then
      raise exception 'Not enough stock' using errcode = 'check_violation';
    end if;
  elsif p_quantity <> 1 then
    raise exception 'Invalid quantity' using errcode = 'check_violation';
  end if;

  if p_quantity <> item.quantity then
    perform public.reset_conversation_pricing(conv.id, item.id);
    update public.conversation_items set quantity = p_quantity where id = item.id;
    insert into public.messages (conversation_id, sender_id, kind, body) values (conv.id, uid, 'system', 'item_changed');
  end if;
end;
$$;

-- Offers ------------------------------------------------------------------------------------------------------------

drop function public.make_offer(uuid, integer);

-- p_scope 'item' offers a total for one card line; 'bundle' offers a total for every open item.
create function public.make_offer(p_conversation_id uuid, p_amount_cents integer, p_scope text, p_item_id uuid default null)
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
  if p_scope not in ('item', 'bundle') or (p_scope = 'item') <> (p_item_id is not null) then
    raise exception 'Invalid offer' using errcode = 'check_violation';
  end if;

  select * into conv from public.conversations where id = p_conversation_id and buyer_id = uid for update;
  if not found then
    raise exception 'Only the buyer can make offers' using errcode = '42501';
  end if;
  if public.conversation_has_pending_order(conv.id) then
    raise exception 'Order pending' using errcode = 'check_violation';
  end if;

  if p_scope = 'item' then
    select l.price_cents::bigint * i.quantity into ceiling
    from public.conversation_items i
    join public.listings l on l.id = i.listing_id and l.status = 'active' and l.accepts_offers
    where i.id = p_item_id and i.conversation_id = conv.id and i.order_id is null;
  else
    select count(*), count(*) filter (where l.id is null or l.status <> 'active' or not l.accepts_offers),
      sum(l.price_cents::bigint * i.quantity)
    into open_count, blocking, ceiling
    from public.conversation_items i
    left join public.listings l on l.id = i.listing_id
    where i.conversation_id = conv.id and i.order_id is null;
    if open_count < 2 or blocking > 0 then
      ceiling := null;
    end if;
  end if;

  if ceiling is null then
    raise exception 'Listing does not accept offers' using errcode = 'check_violation';
  end if;
  if p_amount_cents < 100 or p_amount_cents > ceiling then
    raise exception 'Invalid offer amount' using errcode = 'check_violation';
  end if;

  update public.messages set offer_status = 'withdrawn'
  where conversation_id = conv.id and kind = 'offer' and offer_status = 'pending'
    and offer_scope = p_scope and offer_item_id is not distinct from p_item_id;

  insert into public.messages (conversation_id, sender_id, kind, offer_cents, offer_status, offer_scope, offer_item_id)
  values (conv.id, uid, 'offer', p_amount_cents, 'pending', p_scope, p_item_id)
  returning id into message_id;

  return message_id;
end;
$$;

-- The seller accepts or rejects a pending offer; the buyer can withdraw it. Accepting records the agreed price.
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

  if p_action in ('accept', 'reject') and uid = conv.seller_id then
    new_status := case p_action when 'accept' then 'accepted' else 'rejected' end;
  elsif p_action = 'withdraw' and uid = conv.buyer_id then
    new_status := 'withdrawn';
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if new_status = 'accepted' then
    if public.conversation_has_pending_order(conv.id) then
      raise exception 'Order pending' using errcode = 'check_violation';
    end if;
    if msg.offer_scope = 'bundle' then
      update public.conversations set agreed_bundle_cents = msg.offer_cents where id = conv.id;
    else
      update public.conversation_items set agreed_price_cents = msg.offer_cents
      where id = msg.offer_item_id and conversation_id = conv.id and order_id is null;
      if not found then
        raise exception 'Item not found' using errcode = 'no_data_found';
      end if;
      update public.conversations set agreed_bundle_cents = null where id = conv.id;
    end if;
  end if;

  update public.messages set offer_status = new_status where id = msg.id;
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (conv.id, uid, 'system', 'offer_' || new_status);
end;
$$;

-- Orders ------------------------------------------------------------------------------------------------------------

drop function public.create_order(uuid, integer, text, uuid, integer);
drop function public.cancel_order(uuid);

-- Takes every open item of the conversation into one order. p_item_price_cents is the total agreed for all of them.
create function public.create_order(
  p_conversation_id uuid,
  p_item_price_cents integer,
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

  if p_item_price_cents < 100 or p_item_price_cents > 100000000 then
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

  insert into public.orders (
    conversation_id, listing_title, buyer_id, seller_id, item_price_cents,
    package_preset, weight_grams, length_cm, width_cm, height_cm, origin_summary
  ) values (
    conv.id, conv.listing_title, conv.buyer_id, conv.seller_id, p_item_price_cents,
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
    if entry.kind = 'single' then
      select * into stock from public.listing_items where listing_id = entry.listing_id for update;
      if not found or stock.quantity < entry.quantity then
        raise exception 'Not enough stock' using errcode = 'check_violation';
      end if;
      update public.listing_items set quantity = quantity - entry.quantity where id = stock.id;
      if stock.quantity - entry.quantity = 0 then
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

-- Either party can cancel before payment; reserved stock goes back and the cards return to the conversation.
create function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ord public.orders;
  entry record;
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

  for entry in
    select oi.listing_id, oi.quantity, l.kind
    from public.order_items oi
    join public.listings l on l.id = oi.listing_id
    where oi.order_id = ord.id
    order by l.id
    for update of l
  loop
    if entry.kind = 'single' then
      update public.listing_items set quantity = least(quantity + entry.quantity, 999) where listing_id = entry.listing_id;
    end if;
    update public.listings set status = 'active' where id = entry.listing_id and status = 'sold';
  end loop;

  update public.conversation_items ci set order_id = null
  where ci.order_id = ord.id
    and not exists (
      select 1 from public.conversation_items x
      where x.conversation_id = ci.conversation_id and x.listing_id = ci.listing_id and x.order_id is null
    );
  perform public.refresh_conversation_title(ord.conversation_id);

  other := case when uid = ord.buyer_id then ord.seller_id else ord.buyer_id end;
  insert into public.notifications (user_id, type, conversation_id, data)
  values (other, 'order', ord.conversation_id, jsonb_build_object('status', 'cancelled', 'listing_title', ord.listing_title));
end;
$$;

revoke execute on function
  public.start_conversation(uuid[]), public.add_conversation_items(uuid, uuid[]), public.remove_conversation_item(uuid),
  public.set_conversation_item_quantity(uuid, integer), public.make_offer(uuid, integer, text, uuid),
  public.respond_to_offer(uuid, text), public.create_order(uuid, integer, text, uuid), public.cancel_order(uuid)
from public, anon;
grant execute on function
  public.start_conversation(uuid[]), public.add_conversation_items(uuid, uuid[]), public.remove_conversation_item(uuid),
  public.set_conversation_item_quantity(uuid, integer), public.make_offer(uuid, integer, text, uuid),
  public.respond_to_offer(uuid, text), public.create_order(uuid, integer, text, uuid), public.cancel_order(uuid)
to authenticated;

alter publication supabase_realtime add table public.conversation_items;
