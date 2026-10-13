-- Card catalog cached from digimoncard.io. Read-only for users; written only by the service role (sync script).

create extension if not exists pg_trgm with schema extensions;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.games (slug, name) values ('digimon', 'Digimon Card Game');

create table public.card_sets (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (game_id, name)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  code text not null,
  name text not null,
  card_type text,
  color text,
  color2 text,
  rarity text,
  level integer,
  play_cost integer,
  evolution_cost integer,
  dp integer,
  attribute text,
  form text,
  stage text,
  digi_types text[] not null default '{}',
  main_effect text,
  source_effect text,
  image_path text,
  source text not null default 'digimoncard.io',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (game_id, code)
);

create index cards_name_trgm_idx on public.cards using gin (name extensions.gin_trgm_ops);
create index cards_code_trgm_idx on public.cards using gin (code extensions.gin_trgm_ops);
create index cards_filters_idx on public.cards (game_id, color, rarity, card_type);

create table public.card_set_cards (
  set_id uuid not null references public.card_sets (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  primary key (set_id, card_id)
);

create index card_set_cards_card_id_idx on public.card_set_cards (card_id);

create table public.catalog_sync_runs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  cards_upserted integer not null default 0,
  images_downloaded integer not null default 0,
  error text
);

-- RLS: the catalog is public to read; no write policies exist, so only the service role can modify it.
alter table public.games enable row level security;
alter table public.card_sets enable row level security;
alter table public.cards enable row level security;
alter table public.card_set_cards enable row level security;
alter table public.catalog_sync_runs enable row level security;

create policy "games are publicly readable" on public.games for select using (true);
create policy "card sets are publicly readable" on public.card_sets for select using (true);
create policy "cards are publicly readable" on public.cards for select using (true);
create policy "card set links are publicly readable" on public.card_set_cards for select using (true);

revoke insert, update, delete on public.games, public.card_sets, public.cards, public.card_set_cards from anon, authenticated;
revoke all on public.catalog_sync_runs from anon, authenticated;

-- Self-hosted card images (the source terms forbid hotlinking). Public read, service-role write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png']);

-- Distinct filter values, small enough to avoid the API row cap when listing facets.
create view public.card_facets with (security_invoker = true) as
select 'color' as facet, color as value from public.cards where color is not null group by color
union all
select 'rarity', rarity from public.cards where rarity is not null group by rarity
union all
select 'type', card_type from public.cards where card_type is not null group by card_type;

grant select on public.card_facets to anon, authenticated;
