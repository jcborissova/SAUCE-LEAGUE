begin;

create table if not exists public.tournament_activity_feed (
  id bigserial primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  type text not null
    check (
      type in (
        'match_result_updated',
        'match_stats_updated',
        'playoff_series_updated',
        'leader_of_day'
      )
    ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_tournament_activity_feed_tournament_created_at
  on public.tournament_activity_feed (tournament_id, created_at desc);

create index if not exists idx_tournament_activity_feed_type_created_at
  on public.tournament_activity_feed (type, created_at desc);

create or replace function public.insert_tournament_activity_event(
  p_tournament_id uuid,
  p_type text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tournament_id is null then
    return;
  end if;

  insert into public.tournament_activity_feed (
    tournament_id,
    type,
    payload
  )
  values (
    p_tournament_id,
    p_type,
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

create or replace function public.log_tournament_activity_from_match_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.insert_tournament_activity_event(
    new.tournament_id,
    'match_result_updated',
    jsonb_build_object(
      'matchId', new.id,
      'teamA', coalesce(new.team_a, 'Equipo A'),
      'teamB', coalesce(new.team_b, 'Equipo B'),
      'winnerTeam', new.winner_team,
      'previousWinnerTeam', old.winner_team
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_log_tournament_activity_from_match_result on public.matches;

create trigger trg_log_tournament_activity_from_match_result
after update of winner_team on public.matches
for each row
when (
  old.winner_team is distinct from new.winner_team
  and new.winner_team is not null
)
execute function public.log_tournament_activity_from_match_result();

create or replace function public.log_tournament_activity_from_player_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id bigint;
  v_player_id bigint;
  v_tournament_id uuid;
  v_operation text;
  v_leader_player_id bigint;
  v_leader_name text;
  v_leader_team text;
  v_leader_points numeric;
begin
  if tg_op = 'DELETE' then
    v_match_id := old.match_id;
    v_player_id := old.player_id;
    v_tournament_id := old.tournament_id;
    v_operation := 'delete';
  else
    v_match_id := new.match_id;
    v_player_id := new.player_id;
    v_tournament_id := new.tournament_id;
    v_operation := lower(tg_op);
  end if;

  if v_tournament_id is null and v_match_id is not null then
    select m.tournament_id
    into v_tournament_id
    from public.matches m
    where m.id = v_match_id;
  end if;

  if v_tournament_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  if not exists (
    select 1
    from public.tournament_activity_feed taf
    where taf.tournament_id = v_tournament_id
      and taf.type = 'match_stats_updated'
      and taf.created_at >= now() - interval '20 seconds'
      and (taf.payload->>'matchId') ~ '^[0-9]+$'
      and (taf.payload->>'matchId')::bigint = v_match_id
  ) then
    perform public.insert_tournament_activity_event(
      v_tournament_id,
      'match_stats_updated',
      jsonb_build_object(
        'matchId', v_match_id,
        'playerId', v_player_id,
        'operation', v_operation
      )
    );
  end if;

  begin
    select
      cache.player_id,
      trim(concat_ws(' ', cache.names, cache.lastnames)),
      cache.team_name,
      cache.points
    into
      v_leader_player_id,
      v_leader_name,
      v_leader_team,
      v_leader_points
    from public.tournament_player_totals_cache cache
    where cache.tournament_id = v_tournament_id
      and cache.phase = 'regular'
    order by cache.points desc nulls last
    limit 1;
  exception when undefined_table then
    v_leader_player_id := null;
  end;

  if v_leader_player_id is null then
    begin
      select
        totals.player_id,
        trim(concat_ws(' ', totals.names, totals.lastnames)),
        totals.team_name,
        totals.points
      into
        v_leader_player_id,
        v_leader_name,
        v_leader_team,
        v_leader_points
      from public.tournament_analytics_player_totals totals
      where totals.tournament_id = v_tournament_id
        and totals.phase = 'regular'
      order by totals.points desc nulls last
      limit 1;
    exception when undefined_table then
      v_leader_player_id := null;
    end;
  end if;

  if v_leader_player_id is not null
     and not exists (
      select 1
      from public.tournament_activity_feed taf
      where taf.tournament_id = v_tournament_id
        and taf.type = 'leader_of_day'
        and taf.created_at::date = timezone('utc', now())::date
        and (taf.payload->>'playerId') ~ '^[0-9]+$'
        and (taf.payload->>'playerId')::bigint = v_leader_player_id
     ) then
    perform public.insert_tournament_activity_event(
      v_tournament_id,
      'leader_of_day',
      jsonb_build_object(
        'playerId', v_leader_player_id,
        'headline', coalesce(v_leader_name, 'Lider del dia'),
        'teamName', v_leader_team,
        'points', coalesce(v_leader_points, 0)
      )
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_tournament_activity_from_player_stats on public.player_stats;

create trigger trg_log_tournament_activity_from_player_stats
after insert or update or delete on public.player_stats
for each row execute function public.log_tournament_activity_from_player_stats();

create or replace function public.log_tournament_activity_from_playoff_series()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner_team_name text;
begin
  if new.winner_team_id is not null then
    select t.name
    into v_winner_team_name
    from public.teams t
    where t.id = new.winner_team_id;
  end if;

  perform public.insert_tournament_activity_event(
    new.tournament_id,
    'playoff_series_updated',
    jsonb_build_object(
      'seriesId', new.id,
      'roundOrder', new.round_order,
      'roundName', coalesce(new.round_name, 'Playoffs'),
      'matchupKey', coalesce(new.matchup_key, 'serie'),
      'winsA', coalesce(new.wins_a, 0),
      'winsB', coalesce(new.wins_b, 0),
      'status', coalesce(new.status, 'scheduled'),
      'winnerTeamId', new.winner_team_id,
      'winnerTeamName', v_winner_team_name
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_log_tournament_activity_from_playoff_series on public.playoff_series;

create trigger trg_log_tournament_activity_from_playoff_series
after update of wins_a, wins_b, status, winner_team_id on public.playoff_series
for each row
when (
  old.wins_a is distinct from new.wins_a
  or old.wins_b is distinct from new.wins_b
  or old.status is distinct from new.status
  or old.winner_team_id is distinct from new.winner_team_id
)
execute function public.log_tournament_activity_from_playoff_series();

grant select on table public.tournament_activity_feed to anon, authenticated;
revoke all on function public.insert_tournament_activity_event(uuid, text, jsonb) from public;

do $$
declare
  v_matches_rls_enabled boolean;
begin
  select c.relrowsecurity
  into v_matches_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'matches';

  if coalesce(v_matches_rls_enabled, false) then
    alter table public.tournament_activity_feed enable row level security;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'tournament_activity_feed'
        and policyname = 'tournament_activity_feed_select_all'
    ) then
      create policy tournament_activity_feed_select_all
      on public.tournament_activity_feed
      for select
      to anon, authenticated
      using (true);
    end if;
  else
    alter table public.tournament_activity_feed disable row level security;
  end if;
end;
$$;

commit;
