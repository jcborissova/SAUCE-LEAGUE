begin;

alter function public.generate_tournament_playoffs(uuid)
  security definer
  set search_path = public;

alter function public.sync_playoff_series_from_match(bigint)
  security definer
  set search_path = public;

revoke all on function public.generate_tournament_playoffs(uuid) from public;
revoke all on function public.sync_playoff_series_from_match(bigint) from public;

grant execute on function public.generate_tournament_playoffs(uuid) to anon, authenticated;
grant execute on function public.sync_playoff_series_from_match(bigint) to anon, authenticated;

commit;
