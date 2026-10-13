-- Binder scanner: print embeddings for visual matching, reference prices, scan usage caps and bulk listing creation.

create extension if not exists vector with schema extensions;

-- Embeddings of the self-hosted catalog images. Written by scripts/embed-prints.mts (service role only).
create table public.print_embeddings (
  print_id uuid primary key references public.card_prints (id) on delete cascade,
  model text not null,
  embedding extensions.vector(1024) not null,
  source_sha256 text not null,
  updated_at timestamptz not null default now()
);

create index print_embeddings_hnsw_idx on public.print_embeddings using hnsw (embedding extensions.vector_cosine_ops);

alter table public.print_embeddings enable row level security;
revoke all on public.print_embeddings from anon, authenticated;

-- Nearest prints to a crop. With a code the candidate set is tiny, so it skips the ANN index (which post-filters).
create function public.match_prints(
  p_embedding extensions.vector(1024),
  p_model text,
  p_code text default null,
  p_limit integer default 5
)
returns table (print_id uuid, slug text, code text, similarity real)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_code is not null then
    return query
    select e.print_id, p.slug, c.code, (1 - (e.embedding operator(extensions.<=>) p_embedding))::real
    from public.cards c
    join public.card_prints p on p.card_id = c.id
    join public.print_embeddings e on e.print_id = p.id and e.model = p_model
    where c.code = p_code
    order by (e.embedding operator(extensions.<=>) p_embedding) + 0
    limit least(p_limit, 20);
  else
    return query
    select e.print_id, p.slug, c.code, (1 - (e.embedding operator(extensions.<=>) p_embedding))::real
    from public.print_embeddings e
    join public.card_prints p on p.id = e.print_id
    join public.cards c on c.id = p.card_id
    where e.model = p_model
    order by e.embedding operator(extensions.<=>) p_embedding
    limit least(p_limit, 20);
  end if;
end;
$$;

revoke execute on function public.match_prints(extensions.vector, text, text, integer) from public, anon, authenticated;
grant execute on function public.match_prints(extensions.vector, text, text, integer) to service_role;

-- TCGplayer market reference prices (USD cents) per print and finish. Written by the catalog sync.
create table public.print_prices (
  print_id uuid not null references public.card_prints (id) on delete cascade,
  sub_type text not null check (sub_type in ('normal', 'foil')),
  market_usd_cents integer check (market_usd_cents >= 0),
  low_usd_cents integer check (low_usd_cents >= 0),
  updated_at timestamptz not null default now(),
  primary key (print_id, sub_type)
);

alter table public.print_prices enable row level security;
create policy "signed-in users read reference prices" on public.print_prices for select to authenticated using (true);
revoke insert, update, delete on public.print_prices from anon, authenticated;
revoke select on public.print_prices from anon;

-- Per-user daily scan counters: abuse cap on paid AI calls plus accuracy telemetry.
create table public.scan_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  pages integer not null default 0,
  cards_detected integer not null default 0,
  cards_corrected integer not null default 0,
  primary key (user_id, day)
);

alter table public.scan_usage enable row level security;
revoke all on public.scan_usage from anon, authenticated;

-- Counts one scanned page unless the daily cap is reached. Returns false when over the cap.
create function public.record_scan_page(p_user_id uuid, p_cards integer, p_max_pages integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  counted integer;
begin
  insert into public.scan_usage as u (user_id, day, pages, cards_detected)
  values (p_user_id, current_date, 1, greatest(p_cards, 0))
  on conflict (user_id, day) do update
    set pages = u.pages + 1, cards_detected = u.cards_detected + greatest(p_cards, 0)
    where u.pages < p_max_pages
  returning u.pages into counted;
  return counted is not null;
end;
$$;

create function public.record_scan_corrections(p_user_id uuid, p_corrected integer)
returns void
language sql
set search_path = ''
as $$
  update public.scan_usage set cards_corrected = cards_corrected + greatest(p_corrected, 0)
  where user_id = p_user_id and day = current_date;
$$;

revoke execute on function public.record_scan_page(uuid, integer, integer), public.record_scan_corrections(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.record_scan_page(uuid, integer, integer), public.record_scan_corrections(uuid, integer)
  to service_role;

-- Listings created from scans have their own, higher daily cap; the source can only be set by the bulk function below.
alter table public.listings
  add column source text not null default 'manual' check (source in ('manual', 'scan'));

create or replace function public.limit_listing_creation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  daily_cap integer := 30;
begin
  if new.source = 'scan' then
    if current_user in ('anon', 'authenticated') then
      raise exception 'Scan listings are created through the scanner only' using errcode = '42501';
    end if;
    daily_cap := 500;
  end if;
  if (select count(*) from public.listings
      where seller_id = new.seller_id and source = new.source and created_at > now() - interval '1 day') >= daily_cap then
    raise exception 'Too many listings' using errcode = '54000';
  end if;
  return new;
end;
$$;

-- Creates one draft single listing per item in a single transaction. Runs as definer so it can set source = 'scan',
-- but only for the caller, and the titles come from the catalog, never from the client.
create function public.create_listings_from_scan(p_items jsonb)
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

    insert into public.listings (seller_id, game_id, kind, title, price_cents, accepts_offers, status, source)
    values (
      uid,
      card.game_id,
      'single',
      left(card.name || ' (' || card.code || ')' || coalesce(' · ' || card.variant_label, ''), 100),
      (item ->> 'price_cents')::integer,
      coalesce((item ->> 'accepts_offers')::boolean, true),
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
