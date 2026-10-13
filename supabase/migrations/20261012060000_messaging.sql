-- Buyer/seller conversations, offers, notifications and the gated WhatsApp reveal.
-- Conversations, offers and notifications are written only through security definer functions.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  -- Snapshot so the thread stays readable if the listing is deleted.
  listing_title text not null,
  buyer_last_read_at timestamptz not null default now(),
  seller_last_read_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message_sender_id uuid references public.profiles (id) on delete set null,
  last_message_kind text,
  last_message_preview text,
  created_at timestamptz not null default now(),
  constraint conversations_distinct_parties check (buyer_id <> seller_id),
  unique (listing_id, buyer_id)
);

create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'text',
  body text,
  offer_cents integer,
  offer_status text,
  created_at timestamptz not null default now(),
  constraint messages_shape check (
    (kind = 'text' and body is not null and char_length(body) between 1 and 1000
      and offer_cents is null and offer_status is null)
    or (kind = 'offer' and body is null and offer_cents between 100 and 100000000
      and offer_status in ('pending', 'accepted', 'rejected', 'withdrawn'))
    or (kind = 'system' and body in ('offer_accepted', 'offer_rejected', 'offer_withdrawn')
      and offer_cents is null and offer_status is null)
  )
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  conversation_id uuid references public.conversations (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- Audit trail for WhatsApp reveals; never readable by clients.
create table public.whatsapp_reveals (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index whatsapp_reveals_viewer_idx on public.whatsapp_reveals (viewer_id, created_at desc);

-- Row Level Security
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.whatsapp_reveals enable row level security;

create policy "participants read their conversations"
on public.conversations for select
to authenticated
using ((select auth.uid()) in (buyer_id, seller_id));

create policy "participants read conversation messages"
on public.messages for select
to authenticated
using (exists (
  select 1 from public.conversations c
  where c.id = conversation_id and (select auth.uid()) in (c.buyer_id, c.seller_id)
));

-- Plain text only; offers and system messages go through the functions below.
create policy "participants send text messages"
on public.messages for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and kind = 'text'
  and public.is_in_good_standing()
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (select auth.uid()) in (c.buyer_id, c.seller_id)
  )
);

create policy "users read their own notifications"
on public.notifications for select
to authenticated
using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.conversations from authenticated, anon;
revoke update, delete on public.messages from authenticated, anon;
revoke insert, update, delete on public.notifications from authenticated, anon;
revoke all on public.whatsapp_reveals from authenticated, anon;

-- Keeps the conversation summary and the recipient's notification in sync with new messages.
create function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv public.conversations;
  recipient uuid;
begin
  select * into conv from public.conversations where id = new.conversation_id;
  recipient := case when new.sender_id = conv.buyer_id then conv.seller_id else conv.buyer_id end;

  update public.conversations
  set last_message_at = new.created_at,
      last_message_sender_id = new.sender_id,
      last_message_kind = new.kind,
      last_message_preview = case new.kind
        when 'text' then left(new.body, 80)
        when 'offer' then new.offer_cents::text
        else new.body
      end,
      buyer_last_read_at = case when new.sender_id = conv.buyer_id then new.created_at else buyer_last_read_at end,
      seller_last_read_at = case when new.sender_id = conv.seller_id then new.created_at else seller_last_read_at end
  where id = conv.id;

  -- One unread notification per conversation, bumped by newer messages.
  update public.notifications
  set created_at = now(), data = jsonb_build_object('kind', new.kind, 'listing_title', conv.listing_title)
  where user_id = recipient and conversation_id = conv.id and type = 'message' and read_at is null;

  if not found then
    insert into public.notifications (user_id, type, conversation_id, data)
    values (recipient, 'message', conv.id, jsonb_build_object('kind', new.kind, 'listing_title', conv.listing_title));
  end if;

  return new;
end;
$$;

create trigger messages_after_insert
after insert on public.messages
for each row execute function public.handle_new_message();

create function public.start_conversation(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  listing public.listings;
  conversation_id uuid;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into listing from public.listings where id = p_listing_id and status = 'active';
  if not found then
    raise exception 'Listing not available' using errcode = 'no_data_found';
  end if;
  if listing.seller_id = uid then
    raise exception 'Cannot contact yourself' using errcode = 'check_violation';
  end if;

  insert into public.conversations (listing_id, buyer_id, seller_id, listing_title)
  values (listing.id, uid, listing.seller_id, listing.title)
  on conflict (listing_id, buyer_id) do nothing
  returning id into conversation_id;

  if conversation_id is null then
    select id into conversation_id from public.conversations
    where listing_id = listing.id and buyer_id = uid;
  end if;

  return conversation_id;
end;
$$;

create function public.make_offer(p_conversation_id uuid, p_amount_cents integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  conv public.conversations;
  listing public.listings;
  message_id uuid;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into conv from public.conversations where id = p_conversation_id and buyer_id = uid;
  if not found then
    raise exception 'Only the buyer can make offers' using errcode = '42501';
  end if;

  select * into listing from public.listings where id = conv.listing_id and status = 'active';
  if not found or not listing.accepts_offers then
    raise exception 'Listing does not accept offers' using errcode = 'check_violation';
  end if;
  if p_amount_cents < 100 or p_amount_cents > listing.price_cents then
    raise exception 'Invalid offer amount' using errcode = 'check_violation';
  end if;

  update public.messages set offer_status = 'withdrawn'
  where conversation_id = conv.id and kind = 'offer' and offer_status = 'pending';

  insert into public.messages (conversation_id, sender_id, kind, offer_cents, offer_status)
  values (conv.id, uid, 'offer', p_amount_cents, 'pending')
  returning id into message_id;

  return message_id;
end;
$$;

-- Seller accepts or rejects a pending offer; the buyer can withdraw it.
create function public.respond_to_offer(p_message_id uuid, p_action text)
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
  select * into conv from public.conversations where id = msg.conversation_id;

  if p_action in ('accept', 'reject') and uid = conv.seller_id then
    new_status := case p_action when 'accept' then 'accepted' else 'rejected' end;
  elsif p_action = 'withdraw' and uid = conv.buyer_id then
    new_status := 'withdrawn';
  else
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.messages set offer_status = new_status where id = msg.id;
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (conv.id, uid, 'system', 'offer_' || new_status);
end;
$$;

create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  update public.conversations
  set buyer_last_read_at = case when buyer_id = uid then now() else buyer_last_read_at end,
      seller_last_read_at = case when seller_id = uid then now() else seller_last_read_at end
  where id = p_conversation_id and uid in (buyer_id, seller_id);

  update public.notifications set read_at = now()
  where user_id = uid and conversation_id = p_conversation_id and read_at is null;
end;
$$;

-- Returns the other party's WhatsApp number only to verified participants who share a conversation.
create function public.reveal_whatsapp(p_conversation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  conv public.conversations;
  target uuid;
  number text;
begin
  if uid is null or not public.can_publish() then
    raise exception 'Verified phone required' using errcode = '42501';
  end if;

  select * into conv from public.conversations where id = p_conversation_id and uid in (buyer_id, seller_id);
  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  target := case when uid = conv.buyer_id then conv.seller_id else conv.buyer_id end;

  if (select count(*) from public.whatsapp_reveals
      where viewer_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Daily reveal limit reached' using errcode = '54000';
  end if;

  select whatsapp_number into number from public.profile_private where id = target and whatsapp_visible;
  if number is null then
    return null;
  end if;

  insert into public.whatsapp_reveals (conversation_id, viewer_id, target_id) values (conv.id, uid, target);
  return number;
end;
$$;

revoke execute on function
  public.start_conversation(uuid), public.make_offer(uuid, integer), public.respond_to_offer(uuid, text),
  public.mark_conversation_read(uuid), public.reveal_whatsapp(uuid)
from public, anon;
grant execute on function
  public.start_conversation(uuid), public.make_offer(uuid, integer), public.respond_to_offer(uuid, text),
  public.mark_conversation_read(uuid), public.reveal_whatsapp(uuid)
to authenticated;

alter publication supabase_realtime add table public.messages;
