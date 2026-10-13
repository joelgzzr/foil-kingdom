-- The scanner identifies cards from the printed code and name read by the vision model; visual matching is gone.

drop function if exists public.match_prints(extensions.vector, text, text, integer);
drop table if exists public.print_embeddings;
drop extension if exists vector;
