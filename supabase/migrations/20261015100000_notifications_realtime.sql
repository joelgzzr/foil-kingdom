-- The navbar badges and the inbox update live; RLS already limits notifications to their owner.
alter publication supabase_realtime add table public.notifications;
