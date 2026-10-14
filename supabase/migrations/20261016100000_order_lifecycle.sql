-- Order lifecycle: cancellation with a reason, completed sales that free the conversation, sold-out propagation to
-- other buyers, order problem reports and admin revocation.

-- Columns ----------------------------------------------------------------------------------------------------------

alter table public.orders
  add column cancel_reason text,
  add column cancelled_by uuid references public.profiles (id) on delete set null,
  add column cancelled_at timestamptz,
  add constraint orders_cancel_reason_len check (cancel_reason is null or char_length(cancel_reason) <= 300);

alter table public.payments drop constraint payments_status_valid;
alter table public.payments add constraint payments_status_valid
  check (status in ('pending', 'approved', 'rejected', 'refunded', 'expired'));
-- Set when money was taken for an order that can no longer be paid; an admin refunds it out of band.
alter table public.payments add column refund_needed boolean not null default false;

alter table public.messages add column note text;
alter table public.messages drop constraint messages_shape;
alter table public.messages add constraint messages_shape check (
  (kind = 'text' and body is not null and char_length(body) between 1 and 1000
    and offer_cents is null and offer_status is null and offer_scope is null and note is null)
  or (kind = 'offer' and body is null and offer_cents between 100 and 100000000
    and offer_status in ('pending', 'accepted', 'rejected', 'withdrawn')
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

-- System messages are written by trusted functions, so they skip the per-user rate limit (a sold-out card can reach
-- many conversations at once).
create or replace function public.limit_message_rate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind = 'system' then
    return new;
  end if;
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many messages' using errcode = '54000';
  end if;
  return new;
end;
$$;

-- Reports about an order --------------------------------------------------------------------------------------------

alter table public.reports drop constraint reports_target_type_valid;
alter table public.reports add constraint reports_target_type_valid check (target_type in ('listing', 'user', 'order'));
alter table public.reports drop constraint reports_reason_valid;
alter table public.reports add constraint reports_reason_valid
  check (reason in ('fraud', 'counterfeit', 'inappropriate', 'spam', 'other', 'order_problem'));

create or replace function public.submit_report(p_target_type text, p_target_id uuid, p_reason text, p_details text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  label text;
  owner uuid;
  report_id uuid;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if (select count(*) from public.reports where reporter_id = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily report limit reached' using errcode = '54000';
  end if;

  if (p_target_type = 'order') <> (p_reason = 'order_problem') then
    raise exception 'Invalid reason' using errcode = 'check_violation';
  end if;

  if p_target_type = 'listing' then
    select title, seller_id into label, owner from public.listings where id = p_target_id and status = 'active';
  elsif p_target_type = 'user' then
    select username, id into label, owner from public.profiles where id = p_target_id;
  elsif p_target_type = 'order' then
    if char_length(btrim(coalesce(p_details, ''))) < 10 then
      raise exception 'Details required' using errcode = '22023';
    end if;
    select o.listing_title, case when o.buyer_id = uid then o.seller_id else o.buyer_id end
    into label, owner
    from public.orders o
    where o.id = p_target_id and uid in (o.buyer_id, o.seller_id)
      and o.status in ('paid', 'label_failed', 'label_ready', 'in_transit', 'delivered');
  end if;
  if label is null then
    raise exception 'Target not found' using errcode = 'no_data_found';
  end if;
  if owner = uid then
    raise exception 'Cannot report yourself' using errcode = 'check_violation';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_label, target_owner_id, reason, details)
  values (uid, p_target_type, p_target_id, label, owner, p_reason, nullif(btrim(p_details), ''))
  returning id into report_id;

  return report_id;
end;
$$;

-- Moderators dismiss a report, remove the reported listing, suspend the owner or close an order report as revoked.
-- Revoking the order itself is done by admin_revoke_order (called by the server before this).
create or replace function public.resolve_report(p_report_id uuid, p_action text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  rep public.reports;
  owner_role public.user_role;
  outcome text;
begin
  if uid is null or not public.is_moderator() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into rep from public.reports where id = p_report_id and status = 'open' for update;
  if not found then
    raise exception 'Report not open' using errcode = 'no_data_found';
  end if;

  if p_action = 'dismiss' then
    outcome := 'dismissed';
  elsif p_action = 'remove_listing' and rep.target_type = 'listing' then
    update public.listings set status = 'removed' where id = rep.target_id;
    outcome := 'listing_removed';
  elsif p_action = 'revoke_order' and rep.target_type = 'order' then
    outcome := 'order_revoked';
  elsif p_action = 'ban_user' then
    select role into owner_role from public.profiles where id = rep.target_owner_id;
    if rep.target_owner_id = uid or owner_role <> 'user' then
      raise exception 'Cannot suspend staff' using errcode = '42501';
    end if;
    update public.profiles set banned_at = coalesce(banned_at, now()) where id = rep.target_owner_id;
    update public.listings set status = 'removed'
    where seller_id = rep.target_owner_id and status in ('active', 'paused', 'draft');
    outcome := 'user_banned';
  else
    raise exception 'Invalid action' using errcode = 'check_violation';
  end if;

  -- Other open reports about the same target get the same outcome.
  update public.reports
  set status = case when outcome = 'dismissed' then 'dismissed' else 'resolved' end,
      resolution = outcome,
      resolution_note = nullif(btrim(p_note), ''),
      resolved_by = uid,
      resolved_at = now()
  where status = 'open' and target_type = rep.target_type and target_id = rep.target_id;

  insert into public.notifications (user_id, type, data)
  select reporter_id, 'report_resolved', jsonb_build_object('resolution', outcome, 'target', target_label)
  from public.reports
  where target_type = rep.target_type and target_id = rep.target_id
    and resolved_by = uid and resolved_at >= now() - interval '1 second';
end;
$$;

-- Internal helpers (not callable by clients) -----------------------------------------------------------------------

-- A pending payment younger than the checkout window may still be completed by the buyer.
create function public.order_payment_in_flight(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payments
    where order_id = p_order_id and status = 'pending' and created_at > now() - interval '30 minutes'
  );
$$;

-- Returns reserved stock, reopens sold-out listings and puts the order's cards back into the conversation.
create function public.release_order_items(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry record;
  conv_id uuid;
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
      update public.listing_items set quantity = least(quantity + entry.quantity, 999) where listing_id = entry.listing_id;
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

-- Once a sale reserves copies, other buyers' open cards for that listing shrink to what is left (or disappear).
create function public.trim_listing_in_other_conversations(p_listing_id uuid, p_except_conversation uuid, p_remaining integer)
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
      update public.conversation_items set quantity = p_remaining where id = entry.item_id;
      insert into public.messages (conversation_id, sender_id, kind, body)
      values (entry.conversation_id, entry.seller_id, 'system', 'item_changed');
    end if;
  end loop;
end;
$$;

revoke execute on function
  public.order_payment_in_flight(uuid), public.release_order_items(uuid),
  public.trim_listing_in_other_conversations(uuid, uuid, integer)
from public, anon, authenticated;

-- Orders -----------------------------------------------------------------------------------------------------------

-- Same as before, plus: refuses while an earlier order is paid but not yet labelled, and trims the sold cards from
-- the other buyers' conversations.
create or replace function public.create_order(
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

-- The destination and the rate fix the amount, so neither can change while the buyer may be paying.
create or replace function public.set_order_destination(p_order_id uuid, p_address_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ord public.orders;
  addr public.addresses;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into ord from public.orders
  where id = p_order_id and buyer_id = uid and status in ('awaiting_buyer', 'awaiting_payment')
  for update;
  if not found then
    raise exception 'Order not editable' using errcode = 'no_data_found';
  end if;
  if public.order_payment_in_flight(ord.id) then
    raise exception 'Payment in progress' using errcode = 'object_in_use';
  end if;

  select * into addr from public.addresses where id = p_address_id and user_id = uid;
  if not found then
    raise exception 'Address not found' using errcode = 'no_data_found';
  end if;

  delete from public.order_addresses where order_id = ord.id and party = 'destination';
  insert into public.order_addresses (
    order_id, party, recipient_name, phone, street, exterior_number, interior_number,
    neighborhood, municipality, state, postal_code, reference
  ) values (
    ord.id, 'destination', addr.recipient_name, addr.phone, addr.street, addr.exterior_number, addr.interior_number,
    addr.neighborhood, addr.municipality, addr.state, addr.postal_code, addr.reference
  );

  delete from public.order_charges where order_id = ord.id;
  delete from public.shipping_quotes where order_id = ord.id;
  update public.orders
  set destination_summary = addr.municipality || ', ' || addr.state,
      selected_quote_id = null,
      total_cents = null,
      status = 'awaiting_buyer'
  where id = ord.id;
end;
$$;

create or replace function public.select_order_quote(p_order_id uuid, p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ord public.orders;
  quote public.shipping_quotes;
  handling integer;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into ord from public.orders
  where id = p_order_id and buyer_id = uid and status in ('awaiting_buyer', 'awaiting_payment')
  for update;
  if not found or ord.destination_summary is null then
    raise exception 'Order not editable' using errcode = 'no_data_found';
  end if;
  if public.order_payment_in_flight(ord.id) then
    raise exception 'Payment in progress' using errcode = 'object_in_use';
  end if;

  select * into quote from public.shipping_quotes
  where id = p_quote_id and order_id = ord.id and expires_at > now();
  if not found then
    raise exception 'Quote not available' using errcode = 'no_data_found';
  end if;

  select int_value into handling from public.platform_settings where key = 'shipping_handling_fee_cents';
  handling := coalesce(handling, 0);

  delete from public.order_charges where order_id = ord.id;
  insert into public.order_charges (order_id, kind, description, amount_cents)
  values (ord.id, 'shipping', quote.carrier || ' ' || quote.service, quote.price_cents);
  if handling > 0 then
    insert into public.order_charges (order_id, kind, description, amount_cents)
    values (ord.id, 'handling_fee', 'Manejo', handling);
  end if;

  update public.orders
  set selected_quote_id = quote.id, total_cents = quote.price_cents + handling, status = 'awaiting_payment'
  where id = ord.id;
end;
$$;

drop function public.cancel_order(uuid);

-- Either party can cancel before the label is paid, with a reason shown in the chat. A payment the buyer may still be
-- completing blocks the cancellation (errcode object_in_use).
create function public.cancel_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ord public.orders;
  reason text := btrim(coalesce(p_reason, ''));
begin
  if uid is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if char_length(reason) not between 5 and 300 then
    raise exception 'Reason required' using errcode = 'invalid_parameter_value';
  end if;

  select * into ord from public.orders
  where id = p_order_id and uid in (buyer_id, seller_id) and status in ('awaiting_buyer', 'awaiting_payment')
  for update;
  if not found then
    raise exception 'Order not cancellable' using errcode = 'no_data_found';
  end if;
  if public.order_payment_in_flight(ord.id) then
    raise exception 'Payment in progress' using errcode = 'object_in_use';
  end if;

  update public.payments set status = 'expired' where order_id = ord.id and status = 'pending';
  update public.orders
  set status = 'cancelled', cancel_reason = reason, cancelled_by = uid, cancelled_at = now()
  where id = ord.id;

  perform public.release_order_items(ord.id);

  insert into public.messages (conversation_id, sender_id, kind, body, note)
  values (ord.conversation_id, uid, 'system', 'order_cancelled', reason);
end;
$$;

-- Moderators revoke an order that already has its label paid (after a report). The server voids the label and
-- refunds before calling this; here the stock and cards go back and both parties are told.
create function public.admin_revoke_order(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ord public.orders;
  reason text := btrim(coalesce(p_reason, ''));
begin
  if uid is null or not public.is_moderator() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if char_length(reason) not between 5 and 300 then
    raise exception 'Reason required' using errcode = 'invalid_parameter_value';
  end if;

  select * into ord from public.orders
  where id = p_order_id and status in ('paid', 'label_failed', 'label_ready', 'in_transit')
  for update;
  if not found then
    raise exception 'Order not revocable' using errcode = 'no_data_found';
  end if;

  update public.orders
  set status = 'cancelled', cancel_reason = reason, cancelled_by = uid, cancelled_at = now()
  where id = ord.id;

  perform public.release_order_items(ord.id);

  insert into public.messages (conversation_id, sender_id, kind, body, note)
  values (ord.conversation_id, ord.seller_id, 'system', 'order_cancelled', reason);
  insert into public.notifications (user_id, type, conversation_id, data)
  values (ord.seller_id, 'order', ord.conversation_id, jsonb_build_object('status', 'cancelled', 'listing_title', ord.listing_title));
end;
$$;

revoke execute on function public.cancel_order(uuid, text), public.admin_revoke_order(uuid, text) from public, anon;
grant execute on function public.cancel_order(uuid, text), public.admin_revoke_order(uuid, text) to authenticated;
