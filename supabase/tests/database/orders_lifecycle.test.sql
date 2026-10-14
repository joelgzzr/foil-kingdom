-- Run with: npx supabase test db
begin;
select * from no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@t.local', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@t.local', '{"username":"bob"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol@t.local', '{"username":"carol"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'dave@t.local', '{"username":"dave"}');
update public.profiles set phone_verified = true;
update public.profiles set role = 'admin' where username = 'dave';

insert into public.cards (id, game_id, code, name, color, rarity)
select '00000000-0000-0000-0000-00000000c201', id, 'TEST-301', 'Agumon', 'Red', 'C' from public.games limit 1;
insert into public.card_prints (id, card_id, game_id, slug, is_default)
select id, id, game_id, code, true from public.cards where code = 'TEST-301';

-- e301: stock 1, e302: stock 3 (alice)
insert into public.listings (id, seller_id, game_id, kind, title, price_cents, status)
select v.id::uuid, '00000000-0000-0000-0000-0000000000a1', g.id, 'single', v.title, v.price, 'draft'
from (values
  ('00000000-0000-0000-0000-00000000e301', 'Agumon uno', 5000),
  ('00000000-0000-0000-0000-00000000e302', 'Agumon tres', 3000)
) as v(id, title, price)
cross join (select id from public.games limit 1) g;
insert into public.listing_items (listing_id, print_id, condition, quantity) values
  ('00000000-0000-0000-0000-00000000e301', '00000000-0000-0000-0000-00000000c201', 'nm', 1),
  ('00000000-0000-0000-0000-00000000e302', '00000000-0000-0000-0000-00000000c201', 'nm', 3);
update public.listings set status = 'active';

insert into public.addresses (id, user_id, recipient_name, phone, street, exterior_number, neighborhood, municipality, state, postal_code)
values ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-0000000000a1', 'Alice', '5555555555', 'Calle', '1', 'Centro', 'Cuauhtémoc', 'CDMX', '06000');

-- Bob and Carol both want the only copy of e301
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.start_conversation(array['00000000-0000-0000-0000-00000000e301']::uuid[])$$, 'bob starts a conversation');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.start_conversation(array['00000000-0000-0000-0000-00000000e301']::uuid[])$$, 'carol starts a conversation');
reset role;

-- Alice sells it to Bob: Carol loses the card and is told
update public.conversations set agreed_bundle_cents = 5000 where buyer_id = '00000000-0000-0000-0000-0000000000b2';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select public.create_order((select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2'), 'envelope', '00000000-0000-0000-0000-00000000a001')$$,
  'the seller creates the order for bob'
);
reset role;
select is(
  (select count(*) from public.conversation_items where conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000c3')),
  0::bigint, 'the sold-out card leaves the other buyer''s conversation'
);
select is(
  (select count(*) from public.messages where kind = 'system' and body = 'item_sold'
    and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000c3')),
  1::bigint, 'the other buyer is told the card was sold'
);

-- Cancelling needs a reason and a free payment window
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.cancel_order((select id from public.orders), '  ')$$, '22023', null, 'cancelling requires a reason');
reset role;

insert into public.payments (order_id, provider, provider_payment_id, amount_cents)
select id, 'mock', 'p-1', 5000 from public.orders;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.cancel_order((select id from public.orders), 'Ya no la quiero')$$, '55006', null, 'cancelling is blocked while a payment is in flight');
reset role;
update public.payments set created_at = now() - interval '2 hours';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.cancel_order((select id from public.orders), 'Ya no la quiero')$$, 'the buyer cancels with a reason');
reset role;
select is((select status::text from public.orders), 'cancelled', 'the order is cancelled');
select is((select cancel_reason from public.orders), 'Ya no la quiero', 'the reason is stored');
select is((select status from public.payments), 'expired', 'the abandoned payment expires');
select is((select quantity from public.listing_items where listing_id = '00000000-0000-0000-0000-00000000e301'), 1, 'stock is restored');
select is((select count(*) from public.messages where body = 'order_cancelled' and note = 'Ya no la quiero'), 1::bigint, 'the chat shows the cancellation reason');
select is(
  (select count(*) from public.conversation_items where order_id is null
    and conversation_id = (select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2')),
  1::bigint, 'the card returns to the conversation'
);

-- A new order, paid: it can no longer be cancelled and blocks another one until labelled
update public.conversations set agreed_bundle_cents = 5000 where buyer_id = '00000000-0000-0000-0000-0000000000b2';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select public.create_order((select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2'), 'envelope', '00000000-0000-0000-0000-00000000a001')$$,
  'the seller creates a new order after a cancellation'
);
reset role;
update public.orders set status = 'paid' where status = 'awaiting_buyer';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.cancel_order((select id from public.orders where status = 'paid'), 'Ya no la quiero')$$, 'P0002', null, 'a paid order cannot be cancelled');
select lives_ok($$select public.add_conversation_items((select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2'), array['00000000-0000-0000-0000-00000000e302']::uuid[])$$, 'the buyer can add cards while an order is paid');
reset role;
update public.conversations set agreed_bundle_cents = 3000 where buyer_id = '00000000-0000-0000-0000-0000000000b2';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.create_order((select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2'), 'envelope', '00000000-0000-0000-0000-00000000a001')$$,
  '23505', null, 'no new order until the paid one has its label'
);
reset role;

-- The label exists: the sale is complete and the conversation is free again
update public.orders set status = 'label_ready' where status = 'paid';
update public.conversations set agreed_bundle_cents = 3000 where buyer_id = '00000000-0000-0000-0000-0000000000b2';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$select public.create_order((select id from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000b2'), 'envelope', '00000000-0000-0000-0000-00000000a001')$$,
  'a second sale with the same buyer works once the label exists'
);
reset role;
select is((select count(*) from public.orders where status <> 'cancelled'), 2::bigint, 'both sales exist');

-- Reports about an order
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.submit_report('order', (select id from public.orders where status = 'label_ready'), 'order_problem', 'corto')$$, '22023', null, 'an order report needs details');
select throws_ok($$select public.submit_report('order', (select id from public.orders where status = 'label_ready'), 'fraud', 'Los detalles son suficientes')$$, '23514', null, 'an order report uses its own reason');
select throws_ok($$select public.submit_report('order', (select id from public.orders where status = 'awaiting_buyer'), 'order_problem', 'Los detalles son suficientes')$$, 'P0002', null, 'a pending order cannot be reported');
select lives_ok($$select public.submit_report('order', (select id from public.orders where status = 'label_ready'), 'order_problem', 'La carta llegó dañada')$$, 'a participant reports an order');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.submit_report('order', (select id from public.orders limit 1), 'order_problem', 'Los detalles son suficientes')$$, 'P0002', null, 'outsiders cannot report an order');
select throws_ok($$select public.admin_revoke_order((select id from public.orders limit 1), 'Motivo suficiente')$$, '42501', null, 'only moderators revoke orders');
reset role;

-- A moderator revokes the labelled order (moderators are not order participants, so the id is passed along)
select set_config('t.order', (select id::text from public.orders where status = 'label_ready'), true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.admin_revoke_order(current_setting('t.order')::uuid, 'Carta dañada en envío')$$, 'a moderator revokes the order');
select lives_ok($$select public.resolve_report((select id from public.reports), 'revoke_order', 'Se revocó')$$, 'the report closes as revoked');
reset role;
select is((select resolution from public.reports), 'order_revoked', 'the report records the outcome');
select is((select quantity from public.listing_items where listing_id = '00000000-0000-0000-0000-00000000e301'), 1, 'revoking restores stock');

select * from finish();
rollback;
