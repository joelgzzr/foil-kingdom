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
  $$select public.make_offer((select id from public.conversations), 9000, 'item', (select id from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201'))$$,
  '23514', null, 'an item offer cannot exceed the list price'
);
select lives_ok(
  $$select public.make_offer((select id from public.conversations), 4000, 'item', (select id from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201'))$$,
  'a buyer can offer for one card'
);
select lives_ok(
  $$select public.make_offer((select id from public.conversations), 7000, 'bundle')$$,
  'a buyer can offer for the whole bundle'
);
select is((select count(*) from public.messages where offer_status = 'pending'), 2::bigint, 'item and bundle offers can be pending together');
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
select lives_ok($$select public.respond_to_offer((select id from public.messages where offer_scope = 'bundle'), 'accept')$$, 'the seller accepts the bundle offer');
select lives_ok($$select public.respond_to_offer((select id from public.messages where offer_scope = 'item'), 'accept')$$, 'the seller accepts the card offer');
reset role;
select is((select agreed_price_cents from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201'), 4000, 'an accepted card offer records the agreed line price');
select is((select agreed_bundle_cents from public.conversations), null, 'accepting a card offer clears the bundle price');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.set_conversation_item_quantity((select id from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201'), 2)$$, 'the buyer changes a quantity');
reset role;
select is((select agreed_price_cents from public.conversation_items where listing_id = '00000000-0000-0000-0000-00000000e201'), null, 'changing a quantity clears its agreed price');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.create_order((select id from public.conversations), 8000, 'small_box', '00000000-0000-0000-0000-00000000a001')$$, 'the seller creates one order for the bundle');
reset role;

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
select lives_ok($$select public.cancel_order((select id from public.orders))$$, 'the seller cancels the order');
reset role;

select is((select quantity from public.listing_items where listing_id = '00000000-0000-0000-0000-00000000e201'), 2, 'cancelling restores the stock of every card');
select is((select status::text from public.listings where id = '00000000-0000-0000-0000-00000000e202'), 'active', 'cancelling reactivates sold out cards');
select is((select count(*) from public.conversation_items where order_id is null), 2::bigint, 'cancelling returns the cards to the conversation');

select * from finish();
rollback;
