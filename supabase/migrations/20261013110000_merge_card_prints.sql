-- Merges a duplicate print into another print of the same card (catalog sync only, service role).
-- Listings and wishlists move to the target; prices and source records follow their own foreign keys.
create or replace function public.merge_card_prints(p_stale uuid, p_target uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_stale = p_target then
    raise exception 'cannot merge a print into itself';
  end if;
  if (select card_id from public.card_prints where id = p_stale)
     is distinct from (select card_id from public.card_prints where id = p_target) then
    raise exception 'prints belong to different cards';
  end if;

  update public.listing_items set print_id = p_target where print_id = p_stale;

  delete from public.wishlist_items w
  where w.print_id = p_stale
    and exists (select 1 from public.wishlist_items o where o.user_id = w.user_id and o.print_id = p_target);
  update public.wishlist_items set print_id = p_target where print_id = p_stale;

  delete from public.card_prints where id = p_stale;
end;
$$;

revoke execute on function public.merge_card_prints(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_card_prints(uuid, uuid) to service_role;
