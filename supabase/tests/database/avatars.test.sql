-- Run with: npm run db:test
begin;
select * from no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@t.local', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@t.local', '{"username":"bob"}');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('avatars', '00000000-0000-0000-0000-0000000000a1/a.webp', '00000000-0000-0000-0000-0000000000a1')$$,
  'users upload avatars to their own folder'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner) values ('avatars', '00000000-0000-0000-0000-0000000000b2/a.webp', '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'users cannot upload avatars into another folder'
);
reset role;

-- Deletes go through the Storage API (direct SQL deletes are blocked), so assert the policy scope instead.
select is(
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'users delete their own avatars' and qual like '%avatars%' and qual like '%auth.uid()%'),
  1::bigint,
  'avatar deletes are scoped to the owner folder'
);

select * from finish();
rollback;
