-- Run with: npx supabase test db
begin;
select * from no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@t.local', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@t.local', '{"username":"bob"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol@t.local', '{"username":"carol"}');
update public.profiles set phone_verified = true;

insert into public.cards (id, game_id, code, name, color, rarity)
select '00000000-0000-0000-0000-00000000c201', id, 'TEST-201', 'Agumon', 'Red', 'C' from public.games limit 1;
insert into public.cards (id, game_id, code, name, color, rarity)
select '00000000-0000-0000-0000-00000000c202', id, 'TEST-202', 'Gabumon', 'Blue', 'SR' from public.games limit 1;
insert into public.card_prints (id, card_id, game_id, slug, is_default)
select id, id, game_id, code, true from public.cards where code in ('TEST-201', 'TEST-202');

-- e001/e002: alice (stock 2 and 1); e003: carol
insert into public.listings (id, seller_id, game_id, kind, title, price_cents, status)
select v.id::uuid, v.seller::uuid, g.id, 'single', v.title, v.price, 'draft'
from (values
  ('00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-0000000000a1', 'Agumon', 5000),
  ('00000000-0000-0000-0000-00000000e202', '00000000-0000-0000-0000-0000000000a1', 'Gabumon', 3000),
  ('00000000-0000-0000-0000-00000000e203', '00000000-0000-0000-0000-0000000000c3', 'Agumon carol', 4000)
) as v(id, seller, title, price)
cross join (select id from public.games limit 1) g;
insert into public.listing_items (listing_id, print_id, condition, quantity) values
  ('00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-00000000c201', 'nm', 2),
  ('00000000-0000-0000-0000-00000000e202', '00000000-0000-0000-0000-00000000c202', 'lp', 1),
  ('00000000-0000-0000-0000-00000000e203', '00000000-0000-0000-0000-00000000c201', 'nm', 1);
update public.listings set status = 'active';

insert into public.addresses (id, user_id, recipient_name, phone, street, exterior_number, neighborhood, municipality, state, postal_code)
values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1', 'Alice', '5555555555', 'Calle', '1', 'Centro', 'Cuauhtémoc', 'CDMX', '06000');

-- Collection read model ------------------------------------------------------------------------------------------

set local role anon;
select is((select count(*) from public.listing_search where seller_id = '00000000-0000-0000-0000-0000000000a1'), 2::bigint, 'anon sees the active listings of a seller');
select results_eq(
  $$select colors, rarities, conditions from public.listing_search where id = '00000000-0000-0000-0000-00000000e202'$$,
  $$values (array['Blue']::text[], array['SR']::text[], array['lp']::text[])$$,
  'listing_search exposes the card facets'
);
select results_eq(
  $$select listing_count, total_copies from public.seller_collection_stats where seller_id = '00000000-0000-0000-0000-0000000000a1'$$,
  $$values (2, 3)$$,
  'seller stats count listings and copies'
);
select throws_ok($$select public.set_listing_featured('00000000-0000-0000-0000-00000000e201', true)$$, '42501', null, 'anon cannot feature listings');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.set_listing_featured('00000000-0000-0000-0000-00000000e201', true)$$, 'P0002', null, 'only the owner can feature a listing');
select throws_ok($$update public.listings set featured_at = now() where id = '00000000-0000-0000-0000-00000000e201'$$, '42501', null, 'featured_at is not directly writable');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.set_listing_featured('00000000-0000-0000-0000-00000000e201', true)$$, 'the owner can feature a listing');
reset role;
select isnt((select featured_at from public.listings where id = '00000000-0000-0000-0000-00000000e201'), null, 'the listing is pinned');

update public.listings set status = 'paused' where id = '00000000-0000-0000-0000-00000000e201';
select is((select featured_at from public.listings where id = '00000000-0000-0000-0000-00000000e201'), null, 'pausing a listing unpins it');
update public.listings set status = 'active' where id = '00000000-0000-0000-0000-00000000e201';

insert into public.listings (id, seller_id, game_id, kind, title, price_cents, status)
select gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', g.id, 'single', 'Extra ' || n, 1000, 'draft'
from generate_series(1, 12) n cross join (select id from public.games limit 1) g;
insert into public.listing_items (listing_id, print_id, condition)
select id, '00000000-0000-0000-0000-00000000c201', 'nm' from public.listings where title like 'Extra %';
update public.listings set status = 'active' where title like 'Extra %';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($q$do $b$ declare r record; begin for r in select id from public.listings where title like 'Extra %' order by title limit 5 loop perform public.set_listing_featured(r.id, true); end loop; end $b$ $q$, '5 listings can be featured');
select throws_ok($$select public.set_listing_featured('00000000-0000-0000-0000-00000000e201', true)$$, '54000', null, 'a seller cannot feature more than 5');
reset role;

-- Bundles ----------------------------------------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.start_conversation(array['00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-00000000e203']::uuid[])$$,
  'P0002', null, 'a bundle cannot mix sellers'
);
select lives_ok(
  $$select public.start_conversation(array['00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-00000000e202']::uuid[])$$,
  'a buyer can start a conversation about several cards'
);
select lives_ok(
  $$select public.start_conversation(array['00000000-0000-0000-0000-00000000e201']::uuid[])$$,
  'starting again reuses the conversation'
);
select is((select count(*) from public.conversations), 1::bigint, 'one conversation per buyer and seller');
select is((select count(*) from public.conversation_items where order_id is null), 2::bigint, 'both cards are under negotiation');
select is((select listing_title from public.conversations), 'Agumon +1', 'the title summarises the items');
select throws_ok(
  $$select public.make_offer((select id from public.conversations), 9000)$$,
  '23514', null, 'an offer cannot exceed the list total of all cards'
);
select lives_ok(
  $$select public.make_offer((select id from public.conversations), 4000)$$,
  'a buyer can offer for the whole bundle'
);
select lives_ok(
  $$select public.make_offer((select id from public.conversations), 7000)$$,
  'a buyer can replace the offer'
);
select is((select count(*) from public.messages where offer_status = 'pending'), 1::bigint, 'a new offer withdraws the previous pending one');
select is((select offer_scope from public.messages where offer_status = 'pending'), 'bundle', 'offers are always scoped to the bundle');
reset role;
update public.listings set status = 'paused' where id = '00000000-0000-0000-0000-00000000e202';
set local role authenticated;
select throws_ok(
  $$select public.make_offer((select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2'), 4000)$$,
  '23514', null, 'an offer needs every card to be available'
);
reset role;
update public.listings set status = 'active' where id = '00000000-0000-0000-0000-00000000e202';
set local role authenticated;
select throws_ok($$select public.add_conversation_items((select id from public.conversations), array['00000000-0000-0000-0000-00000000e203']::uuid[])$$, 'P0002', null, 'items must belong to the same seller');
reset role;

-- Carol is not a participant
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.conversation_items), 0::bigint, 'outsiders cannot read conversation items');
reset role;

-- Alice answers
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.add_conversation_items((select id from public.conversations), array['00000000-0000-0000-0000-00000000e202']::uuid[])$$, '42501', null, 'the seller cannot add items');
select lives_ok($$select public.respond_to_offer((select id from public.messages where offer_status = 'pending'), 'accept')$$, 'the seller accepts the bundle offer');
reset role;
select is((select agreed_bundle_cents from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2'), 7000, 'an accepted offer records the agreed bundle price');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.set_conversation_item_quantity((select id from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201'), 2)$$, 'the buyer changes a quantity');
reset role;
select is((select agreed_bundle_cents from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2'), null, 'changing a quantity clears the agreed bundle price');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.create_order((select id from public.conversations), 'small_box', '00000000-0000-0000-0000-00000000a001')$$, '23514', null, 'the seller cannot create the order without an accepted offer');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.make_offer((select id from public.conversations))$$, 'the buyer offers the full price');
select is((select offer_cents from public.messages where offer_status = 'pending'), 13000, 'the full price offer is the list total of every card');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.counter_offer((select id from public.messages where offer_status = 'pending'), 11000)$$, 'the seller counters the buyer offer');
select is((select count(*) from public.messages where offer_status = 'countered'), 1::bigint, 'the countered offer is closed');
select is((select sender_id from public.messages where offer_status = 'pending'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'the counter is sent by the seller');
select throws_ok($$select public.counter_offer((select id from public.messages where offer_status = 'pending'), 10000)$$, '42501', null, 'the seller cannot counter their own counter');
select throws_ok($$select public.respond_to_offer((select id from public.messages where offer_status = 'pending'), 'accept')$$, '42501', null, 'the sender cannot accept their own offer');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.counter_offer((select id from public.messages where offer_status = 'pending'), 10000)$$, '42501', null, 'the buyer cannot counter');
select lives_ok($$select public.respond_to_offer((select id from public.messages where offer_status = 'pending'), 'accept')$$, 'the buyer accepts the counter');
reset role;
select is((select agreed_bundle_cents from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2'), 11000, 'the accepted counter is the agreed price');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.create_order((select id from public.conversations), 'small_box', '00000000-0000-0000-0000-00000000a001')$$, 'the seller creates one order for the bundle');
reset role;
select is((select item_price_cents from public.orders where buyer_id = '00000000-0000-0000-0000-0000000000b2'), 11000, 'the order price is the accepted offer');

select is((select count(*) from public.orders), 1::bigint, 'one order for the bundle');
select is((select count(*) from public.order_items), 2::bigint, 'the order carries both cards');
select is((select quantity from public.listing_items where listing_id = '00000000-0000-0000-0000-00000000e201'), 0, 'stock is reserved for every card');
select is((select status::text from public.listings where id = '00000000-0000-0000-0000-00000000e202'), 'sold', 'sold out listings leave the collection');
select is((select count(*) from public.conversation_items where order_id is null), 0::bigint, 'the items belong to the order');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.order_items), 2::bigint, 'the buyer reads the order items');
select throws_ok($$select public.add_conversation_items((select id from public.conversations), array['00000000-0000-0000-0000-00000000e201']::uuid[])$$, '23514', null, 'items are locked while the order waits for checkout');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.order_items), 0::bigint, 'outsiders cannot read order items');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.cancel_order((select id from public.orders), 'Precio mal capturado')$$, 'the seller cancels the order');
reset role;

select is((select quantity from public.listing_items where listing_id = '00000000-0000-0000-0000-00000000e201'), 2, 'cancelling restores the stock of every card');
select is((select status::text from public.listings where id = '00000000-0000-0000-0000-00000000e202'), 'active', 'cancelling reactivates sold out cards');
select is((select count(*) from public.conversation_items where order_id is null), 2::bigint, 'cancelling returns the cards to the conversation');

-- Quantities -------------------------------------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.start_conversation(array['00000000-0000-0000-0000-00000000e201']::uuid[], array[3])$$,
  '23514', null, 'a buyer cannot ask for more copies than the stock'
);
select throws_ok(
  $$select public.start_conversation(array['00000000-0000-0000-0000-00000000e201']::uuid[], array[1, 1])$$,
  '23514', null, 'quantities must match the listings'
);
select lives_ok(
  $$select public.start_conversation(array['00000000-0000-0000-0000-00000000e201', '00000000-0000-0000-0000-00000000e202']::uuid[], array[2, 1])$$,
  'a buyer can start a conversation with several copies'
);
select is(
  (select quantity from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201' and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000c3')),
  2, 'the requested quantity is stored'
);
select lives_ok(
  $$select public.start_conversation(array['00000000-0000-0000-0000-00000000e201']::uuid[], array[1])$$,
  'starting again updates the quantity'
);
select is(
  (select quantity from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201' and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000c3')),
  1, 'the quantity follows the latest request'
);
select lives_ok(
  $$select public.start_conversation(array['00000000-0000-0000-0000-00000000e201']::uuid[])$$,
  'omitting quantities keeps the current ones'
);
select is(
  (select quantity from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201' and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000c3')),
  1, 'quantity stays unchanged without quantities'
);
reset role;

-- Trimmed quantities come back when the sale that trimmed them is cancelled ------------------------------------------

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.set_conversation_item_quantity((select id from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201' and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000c3')), 2)$$, 'carol asks for both copies');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.set_conversation_item_quantity((select id from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201' and order_id is null and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2')), 1)$$, 'bob asks for one copy');
select lives_ok($$select public.make_offer((select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2'))$$, 'bob offers the full price');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.respond_to_offer((select id from public.messages where offer_status = 'pending' and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2')), 'accept')$$, 'the seller accepts the full price offer');
select lives_ok($$select public.create_order((select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2'), 'small_box', '00000000-0000-0000-0000-00000000a001')$$, 'the seller sells one copy to bob');
reset role;
select is((select quantity from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201' and order_id is null and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000c3')), 1, 'carol''s request is trimmed to the remaining stock');
select is((select requested_quantity from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201' and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000c3')), 2, 'the trimmed request is remembered');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.cancel_order((select id from public.orders where conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2') and status = 'awaiting_buyer'), 'Precio mal capturado')$$, 'the seller cancels bob''s order');
reset role;
select is((select quantity from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201' and order_id is null and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000c3')), 2, 'cancelling gives the trimmed copies back to carol');
select is((select requested_quantity from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201' and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000c3')), null, 'the remembered request is cleared');

select * from finish();
rollback;
