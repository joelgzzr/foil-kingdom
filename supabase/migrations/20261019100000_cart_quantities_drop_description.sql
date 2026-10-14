-- The cart adds listings with a quantity, and listings no longer carry a free-text description.

alter table public.listings drop column description;

drop function public.start_conversation(uuid[]);
drop function public.add_conversation_items(uuid, uuid[]);
drop function public.add_conversation_items_internal(uuid, uuid, uuid[], uuid);

-- p_quantities (optional) is parallel to p_listing_ids. Without it, cards already in the conversation keep their quantity.
create function public.add_conversation_items_internal(
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
      do update set quantity = excluded.quantity
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

revoke execute on function public.add_conversation_items_internal(uuid, uuid, uuid[], uuid, integer[])
from public, anon, authenticated;

create function public.start_conversation(p_listing_ids uuid[], p_quantities integer[] default null)
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

  added := public.add_conversation_items_internal(conv_id, seller, p_listing_ids, uid, p_quantities);

  if existed and added > 0 then
    insert into public.messages (conversation_id, sender_id, kind, body) values (conv_id, uid, 'system', 'item_added');
  end if;
  return conv_id;
end;
$$;

create function public.add_conversation_items(p_conversation_id uuid, p_listing_ids uuid[], p_quantities integer[] default null)
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

  added := public.add_conversation_items_internal(conv.id, conv.seller_id, p_listing_ids, uid, p_quantities);
  if added > 0 then
    insert into public.messages (conversation_id, sender_id, kind, body) values (conv.id, uid, 'system', 'item_added');
  end if;
end;
$$;

revoke execute on function public.start_conversation(uuid[], integer[]), public.add_conversation_items(uuid, uuid[], integer[])
from public, anon;
grant execute on function public.start_conversation(uuid[], integer[]), public.add_conversation_items(uuid, uuid[], integer[])
to authenticated;
