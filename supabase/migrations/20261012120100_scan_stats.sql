-- The page is counted before the paid provider call (so parallel requests cannot burst past the cap); card counts are
-- added afterwards, together with the later correction telemetry.
drop function public.record_scan_corrections(uuid, integer);

create function public.record_scan_stats(p_user_id uuid, p_detected integer, p_corrected integer)
returns void
language sql
set search_path = ''
as $$
  update public.scan_usage
  set cards_detected = cards_detected + greatest(p_detected, 0),
      cards_corrected = cards_corrected + greatest(p_corrected, 0)
  where user_id = p_user_id and day = current_date;
$$;

revoke execute on function public.record_scan_stats(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.record_scan_stats(uuid, integer, integer) to service_role;
