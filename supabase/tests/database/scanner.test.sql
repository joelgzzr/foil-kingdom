-- Run with: npm run db:test
begin;
select * from no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@t.local', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@t.local', '{"username":"bob"}');
update public.profiles set phone_verified = true where id = '00000000-0000-0000-0000-0000000000a1';

insert into public.cards (id, game_id, code, name)
select '00000000-0000-0000-0000-00000000d001', id, 'SCAN-001', 'Agumon' from public.games limit 1;
insert into public.card_prints (id, card_id, game_id, slug, is_default, variant_label)
select '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000d001', id, 'SCAN-001', true, null
from public.games limit 1;
insert into public.card_prints (id, card_id, game_id, slug, is_default, variant_label)
select '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000d001', id, 'SCAN-001-p1', false, 'Alt Art'
from public.games limit 1;

set local role authenticated;
select throws_ok($$select record_scan_page('00000000-0000-0000-0000-0000000000a1', 1, 10)$$, '42501', null, 'users cannot count scan pages');
reset role;

-- Scan page cap
set local role service_role;
select is(public.record_scan_page('00000000-0000-0000-0000-0000000000a1', 5, 2), true, 'first page is counted');
select is(public.record_scan_page('00000000-0000-0000-0000-0000000000a1', 5, 2), true, 'second page is counted');
select is(public.record_scan_page('00000000-0000-0000-0000-0000000000a1', 5, 2), false, 'pages over the cap are refused');
select is((select cards_detected from public.scan_usage where user_id = '00000000-0000-0000-0000-0000000000a1'), 10, 'refused pages do not add cards');
select lives_ok($$select public.record_scan_stats('00000000-0000-0000-0000-0000000000a1', 3, 2)$$, 'stats can be recorded');
select is((select cards_corrected from public.scan_usage where user_id = '00000000-0000-0000-0000-0000000000a1'), 2, 'corrections are accumulated');
reset role;

-- Prices: signed-in read, no writes
insert into public.print_prices (print_id, sub_type, market_usd_cents) values ('00000000-0000-0000-0000-00000000d001', 'normal', 125);
set local role anon;
select throws_ok($$select count(*) from public.print_prices$$, '42501', null, 'anonymous users cannot read reference prices');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.print_prices where print_id = '00000000-0000-0000-0000-00000000d001'), 1::bigint, 'signed-in users read prices');
select throws_ok(
  $$insert into public.print_prices (print_id, sub_type, market_usd_cents) values ('00000000-0000-0000-0000-00000000d002', 'normal', 1)$$,
  '42501', null, 'users cannot write prices'
);

-- Bulk creation
select is(
  (select count(*) from public.create_listings_from_scan(
    '[{"print_id":"00000000-0000-0000-0000-00000000d001","condition":"nm","price_cents":5000,"quantity":2},
      {"print_id":"00000000-0000-0000-0000-00000000d002","condition":"lp","price_cents":9000,"finish":"foil"}]'::jsonb)),
  2::bigint,
  'bulk create returns one listing per item'
);
select is(
  (select count(*) from public.listings where seller_id = '00000000-0000-0000-0000-0000000000a1' and source = 'scan' and status = 'draft'),
  2::bigint,
  'scan listings are drafts with source = scan'
);
select is(
  (select title from public.listings l join public.listing_items i on i.listing_id = l.id
   where i.print_id = '00000000-0000-0000-0000-00000000d002'),
  'Agumon (SCAN-001) · Alt Art',
  'titles are built from the catalog'
);
select throws_ok(
  $$select public.create_listings_from_scan('[{"print_id":"00000000-0000-0000-0000-00000000d001","condition":"nm","price_cents":5}]'::jsonb)$$,
  '23514', null, 'bulk create enforces the price range'
);
select throws_ok(
  $$select public.create_listings_from_scan('[{"print_id":"00000000-0000-0000-0000-0000000000ff","condition":"nm","price_cents":500}]'::jsonb)$$,
  'P0002', null, 'bulk create rejects unknown prints'
);
select throws_ok(
  $$insert into public.listings (seller_id, game_id, kind, title, price_cents, source)
    select '00000000-0000-0000-0000-0000000000a1', id, 'single', 'Direct scan', 500, 'scan' from public.games limit 1$$,
  '42501', null, 'users cannot set source = scan directly'
);
reset role;

-- A user cannot create listings for someone else, and anonymous callers are refused
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok(
  $$select public.create_listings_from_scan('[]'::jsonb)$$, '42501', null, 'anonymous users cannot bulk create'
);
reset role;

-- Scan listings have their own daily cap, separate from manual ones
insert into public.listings (seller_id, game_id, kind, title, price_cents, source)
select '00000000-0000-0000-0000-0000000000b2', g.id, 'single', 'Bulk ' || n, 500, 'scan'
from public.games g, generate_series(1, 500) n limit 500;
select throws_ok(
  $$insert into public.listings (seller_id, game_id, kind, title, price_cents, source)
    select '00000000-0000-0000-0000-0000000000b2', id, 'single', 'One too many', 500, 'scan' from public.games limit 1$$,
  '54000', null, 'scan listings are capped per day'
);
select lives_ok(
  $$insert into public.listings (seller_id, game_id, kind, title, price_cents)
    select '00000000-0000-0000-0000-0000000000b2', id, 'single', 'Manual still works', 500 from public.games limit 1$$,
  'manual listings are not affected by the scan cap'
);

select * from finish();
rollback;
