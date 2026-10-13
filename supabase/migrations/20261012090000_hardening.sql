-- Abuse limits enforced in the database (errcode 54000 = program_limit_exceeded)
-- and the helper the upload cleanup job uses.

create function public.limit_message_rate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many messages' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger messages_rate_limit
before insert on public.messages
for each row execute function public.limit_message_rate();

create function public.limit_listing_creation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.listings
      where seller_id = new.seller_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many listings' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger listings_rate_limit
before insert on public.listings
for each row execute function public.limit_listing_creation();

create function public.limit_conversation_creation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.conversations
      where buyer_id = new.buyer_id and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many conversations' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger conversations_rate_limit
before insert on public.conversations
for each row execute function public.limit_conversation_creation();

-- Photos uploaded but never attached to a listing (abandoned forms, failed inserts).
create function public.orphaned_listing_photo_paths(p_older_than interval default interval '1 day')
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'listing-photos'
    and o.created_at < now() - p_older_than
    and not exists (select 1 from public.listing_photos p where p.storage_path = o.name);
$$;

revoke execute on function public.orphaned_listing_photo_paths(interval) from public, anon, authenticated;
grant execute on function public.orphaned_listing_photo_paths(interval) to service_role;
