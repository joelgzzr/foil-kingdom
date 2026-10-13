-- Orders, shipping quotes, payments and shipments (Phase 1: the item itself is paid off-platform;
-- the platform only charges the shipping fee and buys the label).
-- Clients read through RLS and mutate through security definer functions; quotes, payments,
-- shipments and status changes after payment are written only by trusted server code.

create type public.order_status as enum (
  'awaiting_buyer', 'awaiting_payment', 'paid', 'label_ready', 'in_transit', 'delivered', 'label_failed', 'cancelled'
);

-- Fee configuration; no client policies, read only from security definer code.
create table public.platform_settings (
  key text primary key,
  int_value integer not null
);

insert into public.platform_settings (key, int_value) values ('shipping_handling_fee_cents', 0);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  listing_title text not null,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  -- Agreed item price, informational only (paid off-platform).
  item_price_cents integer not null,
  package_preset text not null,
  weight_grams integer not null,
  length_cm integer not null,
  width_cm integer not null,
  height_cm integer not null,
  -- Coarse location only; full addresses live in order_addresses.
  origin_summary text not null,
  destination_summary text,
  status public.order_status not null default 'awaiting_buyer',
  selected_quote_id uuid,
  total_cents integer,
  label_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_distinct_parties check (buyer_id <> seller_id),
  constraint orders_item_price_range check (item_price_cents between 100 and 100000000),
  constraint orders_package_preset_valid check (package_preset in ('envelope', 'small_box', 'medium_box'))
);

create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_seller_idx on public.orders (seller_id, created_at desc);
create index orders_conversation_idx on public.orders (conversation_id, created_at desc);
-- One open order per conversation.
create unique index orders_one_open_per_conversation on public.orders (conversation_id)
  where status not in ('cancelled', 'delivered');

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- Address snapshots. Each party can read only their own; the label carries both.
create table public.order_addresses (
  order_id uuid not null references public.orders (id) on delete cascade,
  party text not null,
  recipient_name text not null,
  phone text not null,
  street text not null,
  exterior_number text not null,
  interior_number text,
  neighborhood text not null,
  municipality text not null,
  state text not null,
  postal_code text not null,
  reference text,
  primary key (order_id, party),
  constraint order_addresses_party_valid check (party in ('origin', 'destination'))
);

create table public.order_charges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null,
  description text not null,
  amount_cents integer not null,
  constraint order_charges_kind_valid check (kind in ('shipping', 'handling_fee')),
  constraint order_charges_amount_nonneg check (amount_cents >= 0)
);

create index order_charges_order_idx on public.order_charges (order_id);

create table public.shipping_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null,
  provider_rate_id text not null,
  carrier text not null,
  service text not null,
  price_cents integer not null,
  estimated_days integer,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint shipping_quotes_price_nonneg check (price_cents >= 0)
);

create index shipping_quotes_order_idx on public.shipping_quotes (order_id);

alter table public.orders
  add constraint orders_selected_quote_fk foreign key (selected_quote_id)
  references public.shipping_quotes (id) on delete set null;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  status text not null default 'pending',
  amount_cents integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_status_valid check (status in ('pending', 'approved', 'rejected', 'refunded')),
  constraint payments_amount_positive check (amount_cents > 0),
  unique (provider, provider_payment_id)
);

create index payments_order_idx on public.payments (order_id);

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  provider text not null,
  provider_shipment_id text,
  carrier text not null,
  service text not null,
  tracking_number text not null,
  label_url text,
  status text not null default 'label_created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipments_status_valid check (status in ('label_created', 'in_transit', 'delivered', 'exception')),
  unique (provider, tracking_number)
);

create trigger shipments_set_updated_at
before update on public.shipments
for each row execute function public.set_updated_at();

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  status text not null,
  description text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (shipment_id, status, occurred_at)
);

-- Row Level Security
alter table public.platform_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_addresses enable row level security;
alter table public.order_charges enable row level security;
alter table public.shipping_quotes enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;

create policy "participants read their orders"
on public.orders for select
to authenticated
using ((select auth.uid()) in (buyer_id, seller_id));

create policy "parties read their own order address"
on public.order_addresses for select
to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id
    and ((party = 'origin' and o.seller_id = (select auth.uid()))
      or (party = 'destination' and o.buyer_id = (select auth.uid())))
));

create policy "participants read order charges"
on public.order_charges for select
to authenticated
using (exists (
  select 1 from public.orders o where o.id = order_id and (select auth.uid()) in (o.buyer_id, o.seller_id)
));

create policy "buyer reads order quotes"
on public.shipping_quotes for select
to authenticated
using (exists (
  select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid())
));

create policy "buyer reads order payments"
on public.payments for select
to authenticated
using (exists (
  select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid())
));

create policy "participants read order shipments"
on public.shipments for select
to authenticated
using (exists (
  select 1 from public.orders o where o.id = order_id and (select auth.uid()) in (o.buyer_id, o.seller_id)
));

create policy "participants read shipment events"
on public.shipment_events for select
to authenticated
using (exists (
  select 1 from public.shipments s
  join public.orders o on o.id = s.order_id
  where s.id = shipment_id and (select auth.uid()) in (o.buyer_id, o.seller_id)
));

revoke all on public.platform_settings from authenticated, anon;
revoke insert, update, delete on
  public.orders, public.order_addresses, public.order_charges, public.shipping_quotes,
  public.payments, public.shipments, public.shipment_events
from authenticated, anon;
revoke all on public.shipping_quotes from anon;
-- Provider-internal ids stay server-side.
revoke select on public.shipping_quotes, public.payments, public.shipments from authenticated;
grant select (id, order_id, carrier, service, price_cents, estimated_days, expires_at, created_at)
  on public.shipping_quotes to authenticated;
grant select (id, order_id, provider, status, amount_cents, created_at, updated_at)
  on public.payments to authenticated;
grant select (id, order_id, carrier, service, tracking_number, status, created_at, updated_at)
  on public.shipments to authenticated;

-- Package presets are fixed server-side so clients cannot tamper with weight/dimensions.
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
    conversation_id, listing_id, listing_title, buyer_id, seller_id, item_price_cents,
    package_preset, weight_grams, length_cm, width_cm, height_cm, origin_summary
  ) values (
    conv.id, conv.listing_id, conv.listing_title, conv.buyer_id, conv.seller_id, p_item_price_cents,
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

-- Buyer picks the delivery address; previous quotes and the selected rate are discarded.
create function public.set_order_destination(p_order_id uuid, p_address_id uuid)
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

-- Buyer picks one of the stored quotes; the total is computed here from the quote plus the handling fee.
create function public.select_order_quote(p_order_id uuid, p_quote_id uuid)
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

-- Either party can cancel before payment.
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

  other := case when uid = ord.buyer_id then ord.seller_id else ord.buyer_id end;
  insert into public.notifications (user_id, type, conversation_id, data)
  values (other, 'order', ord.conversation_id, jsonb_build_object('status', 'cancelled', 'listing_title', ord.listing_title));
end;
$$;

revoke execute on function
  public.create_order(uuid, integer, text, uuid), public.set_order_destination(uuid, uuid),
  public.select_order_quote(uuid, uuid), public.cancel_order(uuid)
from public, anon;
grant execute on function
  public.create_order(uuid, integer, text, uuid), public.set_order_destination(uuid, uuid),
  public.select_order_quote(uuid, uuid), public.cancel_order(uuid)
to authenticated;

alter publication supabase_realtime add table public.orders;
