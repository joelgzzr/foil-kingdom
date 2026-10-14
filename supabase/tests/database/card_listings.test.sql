-- Run with: npx supabase test db
begin;
select * from no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@t.local', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@t.local', '{"username":"bob"}');
update public.profiles set phone_verified = true;

insert into public.cards (id, game_id, code, name)
select '00000000-0000-0000-0000-00000000c001', id, 'TEST-100', 'Gabumon' from public.games limit 1;
insert into public.card_prints (id, card_id, game_id, slug, is_default)
select '00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000c001', id, 'TEST-100', true from public.games limit 1;

insert into public.listings (id, seller_id, game_id, kind, title, price_cents, status)
select '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a1', g.id, 'single', 'Gabumon', 5000, 'draft'
from public.games g limit 1;
insert into public.listing_items (listing_id, print_id, condition, quantity)
values ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 'nm', 2);

insert into public.addresses (id, user_id, recipient_name, phone, street, exterior_number, neighborhood, municipality, state, postal_code)
values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1', 'Alice', '5555555555', 'Calle', '1', 'Centro', 'Cuauhtémoc', 'CDMX', '06000');

insert into public.conversations (id, listing_title, buyer_id, seller_id) values
  ('00000000-0000-0000-0000-00000000f001', 'Gabumon',
   '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');
insert into public.conversation_items (id, conversation_id, listing_id, title, added_by) values
  ('00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f001',
   '00000000-0000-0000-0000-00000000e001', 'Gabumon', '00000000-0000-0000-0000-0000000000b2');

-- Draft listings are invisible in the public stats
set local role anon;
select is((select count(*) from public.print_listing_stats), 0::bigint, 'drafts do not appear in card stats');
reset role;

update public.listings set status = 'active' where id = '00000000-0000-0000-0000-00000000e001';

set local role anon;
select results_eq(
  $$select min_price_cents, total_copies, seller_count from public.print_listing_stats$$,
  $$values (5000, 2, 1)$$,
  'anon sees stats for active single listings'
);
reset role;

-- Bob asks for copies; the quantity is capped by the stock
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.set_conversation_item_quantity('00000000-0000-0000-0000-00000000f101', 3)$$,
  '23514', null, 'a buyer cannot ask for more copies than the stock'
);
reset role;

-- Alice creates orders as the seller
update public.conversations set agreed_bundle_cents = 5000 where id = '00000000-0000-0000-0000-00000000f001';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select public.create_order('00000000-0000-0000-0000-00000000f001', 'envelope', '00000000-0000-0000-0000-00000000a001')$$,
  'creating an order reserves stock'
);
reset role;

select is((select quantity from public.listing_items where listing_id = '00000000-0000-0000-0000-00000000e001'), 1, 'stock decrements on order');
select is((select status::text from public.listings where id = '00000000-0000-0000-0000-00000000e001'), 'active', 'listing stays active with stock left');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select public.cancel_order((select id from public.orders limit 1), 'Precio mal capturado')$$,
  'the seller can cancel the order'
);
reset role;
select is((select quantity from public.listing_items where listing_id = '00000000-0000-0000-0000-00000000e001'), 2, 'cancelling restores stock');
select is((select count(*) from public.conversation_items where order_id is null), 1::bigint, 'cancelling returns the card to the conversation');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.set_conversation_item_quantity('00000000-0000-0000-0000-00000000f101', 2)$$, 'a buyer can ask for all the copies');
reset role;

update public.conversations set agreed_bundle_cents = 9000 where id = '00000000-0000-0000-0000-00000000f001';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select public.create_order('00000000-0000-0000-0000-00000000f001', 'envelope', '00000000-0000-0000-0000-00000000a001')$$,
  'an order can take all remaining stock'
);
reset role;
select is((select status::text from public.listings where id = '00000000-0000-0000-0000-00000000e001'), 'sold', 'listing is sold at zero stock');

set local role anon;
select is((select count(*) from public.print_listing_stats), 0::bigint, 'sold out listings leave the card stats');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.cancel_order((select id from public.orders where status = 'awaiting_buyer' limit 1), 'Ya no la quiero')$$, 'cancelling the last order');
reset role;
select is((select status::text from public.listings where id = '00000000-0000-0000-0000-00000000e001'), 'active', 'cancelling reactivates a sold out listing');

-- Prints: a card can have several, but only one default, and slugs are unique per game.
insert into public.card_prints (card_id, game_id, slug, variant_label, tcgplayer_product_id)
select '00000000-0000-0000-0000-00000000c001', id, 'TEST-100-999', 'Alternate Art', 999 from public.games limit 1;
select results_eq(
  $$select slug from public.card_prints where card_id = '00000000-0000-0000-0000-00000000c001' order by is_default desc, slug$$,
  $$values ('TEST-100'), ('TEST-100-999')$$,
  'a card has its default print and its variants'
);
select throws_ok(
  $$insert into public.card_prints (card_id, game_id, slug, is_default) select '00000000-0000-0000-0000-00000000c001', id, 'TEST-100-other', true from public.games limit 1$$,
  '23505', null, 'a card has at most one default print'
);
select throws_ok(
  $$insert into public.card_prints (card_id, game_id, slug) select '00000000-0000-0000-0000-00000000c001', id, 'TEST-100-999' from public.games limit 1$$,
  '23505', null, 'print slugs are unique'
);
select results_eq(
  $$select count(*)::int from public.catalog_prints where code = 'TEST-100'$$,
  $$values (2)$$,
  'the catalog view exposes every print with its card data'
);

-- Source records and overrides are service-role only.
set local role anon;
select throws_ok($$select * from public.catalog_source_records$$, '42501', null, 'anon cannot read source records');
select throws_ok($$select * from public.catalog_match_overrides$$, '42501', null, 'anon cannot read match overrides');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select * from public.catalog_source_records$$, '42501', null, 'users cannot read source records');
select throws_ok($$insert into public.card_prints (card_id, game_id, slug) select '00000000-0000-0000-0000-00000000c001', id, 'HACK-1' from public.games limit 1$$, '42501', null, 'users cannot write prints');
reset role;

select * from finish();
rollback;
