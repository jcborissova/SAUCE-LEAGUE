begin;

grant select on table public.tournament_settings to anon, authenticated;
grant select on table public.playoff_series to anon, authenticated;
grant select on table public.playoff_games to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tournament_settings'
      and policyname = 'tournament_settings_select_all'
  ) then
    create policy tournament_settings_select_all
    on public.tournament_settings
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'playoff_series'
      and policyname = 'playoff_series_select_all'
  ) then
    create policy playoff_series_select_all
    on public.playoff_series
    for select
    to anon, authenticated
    using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'playoff_games'
      and policyname = 'playoff_games_select_all'
  ) then
    create policy playoff_games_select_all
    on public.playoff_games
    for select
    to anon, authenticated
    using (true);
  end if;
end $$;

commit;
