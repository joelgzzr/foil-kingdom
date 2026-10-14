-- When a sale trims other buyers' open cards to the remaining stock, remember what they asked for so cancelling or
-- revoking the order can give those copies back.

alter table public.conversation_items add column requested_quantity integer;
alter table public.conversation_items add constraint conversation_items_requested_range
  check (requested_quantity is null or requested_quantity > quantity);

create or replace function public.trim_listing_in_other_conversations(p_listing_id uuid, p_except_conversation uuid, p_remaining integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry record;
begin
  for entry in
    select i.id as item_id, i.conversation_id, i.quantity, c.seller_id
    from public.conversation_items i
    join public.conversations c on c.id = i.conversation_id
    where i.listing_id = p_listing_id and i.order_id is null
      and i.conversation_id <> p_except_conversation and i.quantity > p_remaining
    for update of i
  loop
    perform public.reset_conversation_pricing(entry.conversation_id, entry.item_id);
    if p_remaining <= 0 then
      delete from public.conversation_items where id = entry.item_id;
      perform public.refresh_conversation_title(entry.conversation_id);
      insert into public.messages (conversation_id, sender_id, kind, body)
      values (entry.conversation_id, entry.seller_id, 'system', 'item_sold');
    else
      update public.conversation_items
      set quantity = p_remaining, requested_quantity = coalesce(requested_quantity, entry.quantity)
      where id = entry.item_id;
      insert into public.messages (conversation_id, sender_id, kind, body)
      values (entry.conversation_id, entry.seller_id, 'system', 'item_changed');
    end if;
  end loop;
end;
$$;

create or replace function public.release_order_items(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry record;
  trimmed record;
  conv_id uuid;
  stock_now integer;
  new_quantity integer;
begin
  select conversation_id into conv_id from public.orders where id = p_order_id;

  for entry in
    select oi.listing_id, oi.quantity, l.kind
    from public.order_items oi
    join public.listings l on l.id = oi.listing_id
    where oi.order_id = p_order_id
    order by l.id
    for update of l
  loop
    if entry.kind = 'single' then
      update public.listing_items set quantity = least(quantity + entry.quantity, 999)
      where listing_id = entry.listing_id
      returning quantity into stock_now;

      -- Other buyers' cards that were trimmed by this sale grow back as far as the stock allows.
      for trimmed in
        select i.id as item_id, i.conversation_id, i.quantity, i.requested_quantity, c.seller_id
        from public.conversation_items i
        join public.conversations c on c.id = i.conversation_id
        where i.listing_id = entry.listing_id and i.order_id is null and i.requested_quantity is not null
          and i.conversation_id <> conv_id
        for update of i
      loop
        new_quantity := least(trimmed.requested_quantity, stock_now);
        if new_quantity > trimmed.quantity then
          perform public.reset_conversation_pricing(trimmed.conversation_id, trimmed.item_id);
          update public.conversation_items
          set quantity = new_quantity,
              requested_quantity = case when new_quantity >= trimmed.requested_quantity then null else trimmed.requested_quantity end
          where id = trimmed.item_id;
          insert into public.messages (conversation_id, sender_id, kind, body)
          values (trimmed.conversation_id, trimmed.seller_id, 'system', 'item_changed');
        end if;
      end loop;
    end if;
    update public.listings set status = 'active' where id = entry.listing_id and status = 'sold';
  end loop;

  update public.conversation_items ci set order_id = null
  where ci.order_id = p_order_id
    and not exists (
      select 1 from public.conversation_items x
      where x.conversation_id = ci.conversation_id and x.listing_id = ci.listing_id and x.order_id is null
    );
  perform public.refresh_conversation_title(conv_id);
end;
$$;

-- A quantity the buyer sets by hand replaces whatever the sale trimmed.
create or replace function public.set_conversation_item_quantity(p_item_id uuid, p_quantity integer)
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
    update public.conversation_items set quantity = p_quantity, requested_quantity = null where id = item.id;
    insert into public.messages (conversation_id, sender_id, kind, body) values (conv.id, uid, 'system', 'item_changed');
  elsif item.requested_quantity is not null then
    update public.conversation_items set requested_quantity = null where id = item.id;
  end if;
end;
$$;

create or replace function public.add_conversation_items_internal(
  p_conversation_id uuid, p_seller_id uuid, p_listing_ids uuid[], p_added_by uuid, p_quantities integer[] default null
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
  if p_quantities is not null and cardinality(p_quantities) <> cardinality(p_listing_ids) then
    raise exception 'Invalid items' using errcode = 'check_violation';
  end if;

  select count(*) into available from public.listings
  where id = any (p_listing_ids) and seller_id = p_seller_id and status = 'active';
  if available <> wanted then
    raise exception 'Listing not available' using errcode = 'no_data_found';
  end if;

  create temporary table wanted_items on commit drop as
  select distinct on (w.id) w.id as listing_id, coalesce(q.qty, 1) as qty
  from unnest(p_listing_ids) with ordinality as w(id, n)
  left join unnest(coalesce(p_quantities, array[]::integer[])) with ordinality as q(qty, n) on q.n = w.n
  order by w.id, w.n desc;

  if exists (
    select 1
    from wanted_items w
    join public.listings l on l.id = w.listing_id
    left join public.listing_items li on li.listing_id = l.id
    where w.qty < 1 or w.qty > case when l.kind = 'single' then coalesce(li.quantity, 0) else 1 end
  ) then
    raise exception 'Not enough stock' using errcode = 'check_violation';
  end if;

  if p_quantities is null then
    insert into public.conversation_items (conversation_id, listing_id, title, added_by)
    select p_conversation_id, l.id, l.title, p_added_by
    from public.listings l
    where l.id = any (p_listing_ids)
    on conflict (conversation_id, listing_id) where order_id is null do nothing;
  else
    insert into public.conversation_items (conversation_id, listing_id, title, added_by, quantity)
    select p_conversation_id, l.id, l.title, p_added_by, w.qty
    from public.listings l
    join wanted_items w on w.listing_id = l.id
    on conflict (conversation_id, listing_id) where order_id is null
      do update set quantity = excluded.quantity, requested_quantity = null
      where public.conversation_items.quantity <> excluded.quantity;
  end if;
  get diagnostics added = row_count;

  drop table wanted_items;

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
