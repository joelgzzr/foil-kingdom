-- Offers cover every open card of the conversation; per-card offers are no longer created.
-- Accepted per-card prices (conversation_items.agreed_price_cents) still apply until the order is created.

update public.messages set offer_status = 'withdrawn'
where kind = 'offer' and offer_status = 'pending' and offer_scope = 'item';

drop function public.make_offer(uuid, integer, text, uuid);

create function public.make_offer(p_conversation_id uuid, p_amount_cents integer)
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

  select count(*), count(*) filter (where l.id is null or l.status <> 'active' or not l.accepts_offers),
    sum(l.price_cents::bigint * i.quantity)
  into open_count, blocking, ceiling
  from public.conversation_items i
  left join public.listings l on l.id = i.listing_id
  where i.conversation_id = conv.id and i.order_id is null;
  if open_count < 1 or blocking > 0 then
    ceiling := null;
  end if;

  if ceiling is null then
    raise exception 'Listing does not accept offers' using errcode = 'check_violation';
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

revoke execute on function public.make_offer(uuid, integer) from public, anon;
grant execute on function public.make_offer(uuid, integer) to authenticated;
