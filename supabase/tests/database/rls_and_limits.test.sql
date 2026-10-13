-- Run with: npx supabase test db
begin;
select * from no_plan();

-- Fixtures (as postgres): alice sells, bob buys, mod moderates, spam is a heavy poster.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@t.local', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@t.local', '{"username":"bob"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'mod@t.local', '{"username":"modu"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'spam@t.local', '{"username":"spammer"}');
update public.profiles set phone_verified = true;
update public.profiles set role = 'moderator' where username = 'modu';

insert into public.cards (id, game_id, code, name) select '00000000-0000-0000-0000-00000000c001', id, 'TEST-001', 'Agumon' from public.games limit 1;
insert into public.card_prints (id, card_id, game_id, slug, is_default) select id, id, game_id, code, true from public.cards where code = 'TEST-001';

insert into public.listings (id, seller_id, game_id, kind, title, price_cents, status)
select '00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a1', g.id, 'single', 'Agumon', 5000, 'draft'
from public.games g limit 1;
insert into public.listing_items (listing_id, print_id, condition)
select '00000000-0000-0000-0000-00000000e001', p.id, 'nm' from public.card_prints p where p.slug = 'TEST-001';
update public.listings set status = 'active' where id = '00000000-0000-0000-0000-00000000e001';

insert into public.conversations (id, listing_title, buyer_id, seller_id) values
  ('00000000-0000-0000-0000-00000000f001', 'Agumon',
   '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1');
insert into public.notifications (user_id, type) values ('00000000-0000-0000-0000-0000000000a1', 'rating');

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'every public table has row level security enabled'
);

-- Anonymous visitors
set local role anon;
select throws_ok($$select public.submit_report('listing', '00000000-0000-0000-0000-00000000e001', 'spam', '')$$, '42501', null, 'anon cannot submit reports');
select throws_ok($$select public.is_moderator()$$, '42501', null, 'anon cannot call is_moderator');
reset role;

-- Bob (buyer)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.notifications), 0::bigint, 'users cannot read other users'' notifications');
select is((select count(*) from public.profile_private), 1::bigint, 'users only read their own private profile');
select throws_ok($$update public.profiles set role = 'admin' where username = 'bob'$$, '42501', null, 'users cannot self-promote');
select throws_ok($$update public.profiles set banned_at = null where username = 'bob'$$, '42501', null, 'users cannot edit ban state');
select throws_ok($$update public.profiles set rating_avg = 5 where username = 'bob'$$, '42501', null, 'users cannot edit their rating');
select lives_ok($$update public.profiles set bio = 'hola' where username = 'bob'$$, 'users can edit their bio');
select throws_ok($$insert into public.ratings (order_id, rater_id, ratee_id, stars) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 5)$$, '42501', null, 'ratings are not directly insertable');
select throws_ok($$insert into public.reports (reporter_id, target_type, target_id, target_label, target_owner_id, reason) values ('00000000-0000-0000-0000-0000000000b2', 'user', '00000000-0000-0000-0000-0000000000a1', 'alice', '00000000-0000-0000-0000-0000000000a1', 'spam')$$, '42501', null, 'reports are not directly insertable');
select throws_ok($$insert into public.wishlist_items (user_id, print_id) select '00000000-0000-0000-0000-0000000000a1', id from public.card_prints limit 1$$, '42501', null, 'cannot wishlist on behalf of others');
select lives_ok($$insert into public.wishlist_items (user_id, print_id) select '00000000-0000-0000-0000-0000000000b2', id from public.card_prints limit 1$$, 'users can manage their own wishlist');
select lives_ok($$select public.submit_report('listing', '00000000-0000-0000-0000-00000000e001', 'fraud', 'sospechoso')$$, 'users can report a listing');
select throws_ok($$select public.submit_report('listing', '00000000-0000-0000-0000-00000000e001', 'spam', '')$$, '23505', null, 'duplicate open reports are rejected');
select throws_ok($$select public.submit_report('listing', '00000000-0000-0000-0000-00000000e001', 'nonsense', '')$$, '23514', null, 'invalid report reasons are rejected');
select is((select count(*) from public.reports), 1::bigint, 'reporters read their own reports');
select throws_ok($$select public.resolve_report((select id from public.reports limit 1), 'dismiss', '')$$, '42501', null, 'non-moderators cannot resolve reports');
select throws_ok($$select public.unban_user('00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'non-moderators cannot unban');
select lives_ok($q$do $b$ begin for i in 1..30 loop insert into public.messages (conversation_id, sender_id, kind, body) values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000b2', 'text', 'hola ' || i); end loop; end $b$ $q$, '30 messages per minute are allowed');
select throws_ok($$insert into public.messages (conversation_id, sender_id, kind, body) values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000b2', 'text', 'otro')$$, '54000', null, 'the 31st message in a minute is rejected');
reset role;

-- Alice (seller)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.wishlist_items), 0::bigint, 'wishlists are private');
select is((select count(*) from public.reports), 0::bigint, 'reported users cannot see reports');
reset role;

-- Moderator
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.reports), 1::bigint, 'moderators read all reports');
select lives_ok($$select public.resolve_report((select id from public.reports limit 1), 'remove_listing', 'confirmado')$$, 'moderators resolve reports');
reset role;

select is((select status::text from public.listings where id = '00000000-0000-0000-0000-00000000e001'), 'removed', 'resolving removes the listing');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select is_empty($$update public.listings set status = 'active' where id = '00000000-0000-0000-0000-00000000e001' returning id$$, 'sellers cannot reactivate removed listings');
reset role;

-- Heavy poster hits the daily listing cap
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($q$do $b$ begin for i in 1..30 loop insert into public.listings (seller_id, game_id, kind, title, price_cents) select '00000000-0000-0000-0000-0000000000d4', id, 'lot', 'Lote ' || i, 1000 from public.games limit 1; end loop; end $b$ $q$, '30 listings per day are allowed');
select throws_ok($$insert into public.listings (seller_id, game_id, kind, title, price_cents) select '00000000-0000-0000-0000-0000000000d4', id, 'lot', 'Lote extra', 1000 from public.games limit 1$$, '54000', null, 'the 31st listing in a day is rejected');
reset role;

select * from finish();
rollback;
