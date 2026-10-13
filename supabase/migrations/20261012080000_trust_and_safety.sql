-- Ratings, wishlists with alerts, reports and moderation.
-- Clients read through RLS and mutate through security definer functions.

create function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('moderator', 'admin') and banned_at is null
  );
$$;

revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- Ratings ------------------------------------------------------------------

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  ratee_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint ratings_stars_range check (stars between 1 and 5),
  constraint ratings_comment_len check (char_length(comment) <= 500),
  constraint ratings_distinct_parties check (rater_id <> ratee_id),
  unique (order_id, rater_id)
);

create index ratings_ratee_idx on public.ratings (ratee_id, created_at desc);

alter table public.ratings enable row level security;

create policy "ratings are publicly readable"
on public.ratings for select
using (true);

revoke insert, update, delete on public.ratings from authenticated, anon;

-- Keeps the denormalized profile rating in sync; profile rating columns are not user-editable.
create function public.handle_new_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set rating_count = r.cnt, rating_avg = r.avg_stars
  from (
    select count(*)::integer as cnt, round(avg(stars), 2) as avg_stars
    from public.ratings where ratee_id = new.ratee_id
  ) r
  where p.id = new.ratee_id;

  insert into public.notifications (user_id, type, data)
  values (new.ratee_id, 'rating', jsonb_build_object('stars', new.stars));
  return new;
end;
$$;

create trigger ratings_after_insert
after insert on public.ratings
for each row execute function public.handle_new_rating();

create function public.submit_rating(p_order_id uuid, p_stars integer, p_comment text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ord public.orders;
  rating_id uuid;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into ord from public.orders
  where id = p_order_id and uid in (buyer_id, seller_id) and status = 'delivered';
  if not found then
    raise exception 'Order not ratable' using errcode = 'no_data_found';
  end if;

  insert into public.ratings (order_id, rater_id, ratee_id, stars, comment)
  values (
    ord.id, uid,
    case when uid = ord.buyer_id then ord.seller_id else ord.buyer_id end,
    p_stars, nullif(btrim(p_comment), '')
  )
  returning id into rating_id;

  return rating_id;
end;
$$;

-- Wishlists ----------------------------------------------------------------

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  max_price_cents integer,
  created_at timestamptz not null default now(),
  constraint wishlist_max_price_range check (max_price_cents is null or max_price_cents between 100 and 100000000),
  unique (user_id, card_id)
);

alter table public.wishlist_items enable row level security;

create policy "users manage their own wishlist"
on public.wishlist_items for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and public.is_in_good_standing());

revoke update on public.wishlist_items from authenticated, anon;
grant update (max_price_cents) on public.wishlist_items to authenticated;

create function public.limit_wishlist_items()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.wishlist_items where user_id = new.user_id) >= 200 then
    raise exception 'Wishlist is full' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger wishlist_items_limit
before insert on public.wishlist_items
for each row execute function public.limit_wishlist_items();

-- Alerts users when a listing containing a wishlisted card is published for the first time.
create function public.notify_wishlist_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, data)
  select distinct on (w.user_id) w.user_id, 'wishlist',
    jsonb_build_object('listing_id', new.id, 'title', new.title, 'price_cents', new.price_cents)
  from public.wishlist_items w
  join public.listing_items li on li.card_id = w.card_id and li.listing_id = new.id
  where w.user_id <> new.seller_id
    and (w.max_price_cents is null or (new.kind = 'single' and new.price_cents <= w.max_price_cents))
  order by w.user_id;
  return new;
end;
$$;

create trigger listings_notify_wishlist
after update of status on public.listings
for each row
when (new.status = 'active' and old.published_at is null)
execute function public.notify_wishlist_matches();

-- Marks alert-style notifications (not tied to a conversation) as read.
create function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and conversation_id is null and read_at is null;
$$;

revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- Reports and moderation ---------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  -- Snapshots so the queue stays useful after the target is removed.
  target_label text not null,
  target_owner_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  resolution text,
  resolution_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_target_type_valid check (target_type in ('listing', 'user')),
  constraint reports_reason_valid check (reason in ('fraud', 'counterfeit', 'inappropriate', 'spam', 'other')),
  constraint reports_details_len check (char_length(details) <= 1000),
  constraint reports_status_valid check (status in ('open', 'resolved', 'dismissed')),
  constraint reports_note_len check (char_length(resolution_note) <= 500)
);

create index reports_status_idx on public.reports (status, created_at);
create unique index reports_one_open_per_reporter_target on public.reports (reporter_id, target_type, target_id)
  where status = 'open';

alter table public.reports enable row level security;

create policy "reporters read their reports, moderators read all"
on public.reports for select
to authenticated
using ((select auth.uid()) = reporter_id or public.is_moderator());

revoke insert, update, delete on public.reports from authenticated, anon;

create function public.submit_report(p_target_type text, p_target_id uuid, p_reason text, p_details text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  label text;
  owner uuid;
  report_id uuid;
begin
  if uid is null or not public.is_in_good_standing() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if (select count(*) from public.reports where reporter_id = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily report limit reached' using errcode = '54000';
  end if;

  if p_target_type = 'listing' then
    select title, seller_id into label, owner from public.listings where id = p_target_id and status = 'active';
  elsif p_target_type = 'user' then
    select username, id into label, owner from public.profiles where id = p_target_id;
  end if;
  if label is null then
    raise exception 'Target not found' using errcode = 'no_data_found';
  end if;
  if owner = uid then
    raise exception 'Cannot report yourself' using errcode = 'check_violation';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_label, target_owner_id, reason, details)
  values (uid, p_target_type, p_target_id, label, owner, p_reason, nullif(btrim(p_details), ''))
  returning id into report_id;

  return report_id;
end;
$$;

-- Moderators dismiss a report, remove the reported listing, or suspend the owner.
create function public.resolve_report(p_report_id uuid, p_action text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  rep public.reports;
  owner_role public.user_role;
  outcome text;
begin
  if uid is null or not public.is_moderator() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into rep from public.reports where id = p_report_id and status = 'open' for update;
  if not found then
    raise exception 'Report not open' using errcode = 'no_data_found';
  end if;

  if p_action = 'dismiss' then
    outcome := 'dismissed';
  elsif p_action = 'remove_listing' and rep.target_type = 'listing' then
    update public.listings set status = 'removed' where id = rep.target_id;
    outcome := 'listing_removed';
  elsif p_action = 'ban_user' then
    select role into owner_role from public.profiles where id = rep.target_owner_id;
    if rep.target_owner_id = uid or owner_role <> 'user' then
      raise exception 'Cannot suspend staff' using errcode = '42501';
    end if;
    update public.profiles set banned_at = coalesce(banned_at, now()) where id = rep.target_owner_id;
    update public.listings set status = 'removed'
    where seller_id = rep.target_owner_id and status in ('active', 'paused', 'draft');
    outcome := 'user_banned';
  else
    raise exception 'Invalid action' using errcode = 'check_violation';
  end if;

  -- Other open reports about the same target get the same outcome.
  update public.reports
  set status = case when outcome = 'dismissed' then 'dismissed' else 'resolved' end,
      resolution = outcome,
      resolution_note = nullif(btrim(p_note), ''),
      resolved_by = uid,
      resolved_at = now()
  where status = 'open' and target_type = rep.target_type and target_id = rep.target_id;

  insert into public.notifications (user_id, type, data)
  select reporter_id, 'report_resolved', jsonb_build_object('resolution', outcome, 'target', target_label)
  from public.reports
  where target_type = rep.target_type and target_id = rep.target_id
    and resolved_by = uid and resolved_at >= now() - interval '1 second';
end;
$$;

create function public.unban_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.profiles set banned_at = null where id = p_user_id;
end;
$$;

revoke execute on function
  public.submit_rating(uuid, integer, text), public.submit_report(text, uuid, text, text),
  public.resolve_report(uuid, text, text), public.unban_user(uuid)
from public, anon;
grant execute on function
  public.submit_rating(uuid, integer, text), public.submit_report(text, uuid, text, text),
  public.resolve_report(uuid, text, text), public.unban_user(uuid)
to authenticated;
