begin;

alter table public.matches
  add column if not exists team_a_manual_points integer,
  add column if not exists team_b_manual_points integer,
  add column if not exists result_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matches_manual_points_non_negative_chk'
      and conrelid = 'public.matches'::regclass
  ) then
    alter table public.matches
      add constraint matches_manual_points_non_negative_chk
      check (
        (team_a_manual_points is null or team_a_manual_points >= 0)
        and (team_b_manual_points is null or team_b_manual_points >= 0)
      );
  end if;
end $$;

create or replace view public.tournament_match_scoreboard as
with stat_scores as (
  select
    m.id as match_id,
    coalesce(sum(case when mp.team = 'A' then ps.points else 0 end), 0)::int as team_a_points,
    coalesce(sum(case when mp.team = 'B' then ps.points else 0 end), 0)::int as team_b_points,
    (count(ps.id) > 0) as has_stats
  from public.matches m
  left join public.match_players mp
    on mp.match_id = m.id
  left join public.player_stats ps
    on ps.match_id = m.id
   and ps.player_id = mp.player_id
  group by m.id
)
select
  m.tournament_id,
  m.id as match_id,
  m.match_date,
  m.match_time,
  m.team_a,
  m.team_b,
  m.winner_team,
  case
    when m.team_a_manual_points is not null and m.team_b_manual_points is not null then m.team_a_manual_points
    else coalesce(ss.team_a_points, 0)
  end as team_a_points,
  case
    when m.team_a_manual_points is not null and m.team_b_manual_points is not null then m.team_b_manual_points
    else coalesce(ss.team_b_points, 0)
  end as team_b_points,
  coalesce(ss.has_stats, false) as has_stats,
  (
    (m.team_a_manual_points is not null and m.team_b_manual_points is not null)
    or coalesce(ss.has_stats, false)
  ) as has_score,
  m.result_note
from public.matches m
left join stat_scores ss
  on ss.match_id = m.id
where m.winner_team is not null;

grant select on public.tournament_match_scoreboard to anon, authenticated;

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

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
),
team_ids as (
  select
    tt.tournament_id,
    max(tm.id) filter (where lower(trim(tm.name)) = 'team pitillo') as pitillo_id,
    max(tm.id) filter (where lower(trim(tm.name)) = 'team medina') as medina_id,
    max(tm.id) filter (where lower(trim(tm.name)) = 'team hector') as hector_id,
    max(tm.id) filter (where lower(trim(tm.name)) = 'team rodrigo') as rodrigo_id
  from target_tournament tt
  join public.teams tm
    on tm.tournament_id = tt.tournament_id
  group by tt.tournament_id
),
series_to_create as (
  select *
  from (
    values
      ('semi_1v4'::text, 1, 'Round 1'::text, 'pitillo'::text, 'medina'::text, 1, 4, 1, 2, 'active'::text),
      ('semi_2v3'::text, 1, 'Round 1'::text, 'hector'::text, 'rodrigo'::text, 2, 3, 2, 2, 'active'::text),
      ('finals'::text, 2, 'Finals'::text, null::text, null::text, null::integer, null::integer, 2, 2, 'pending'::text)
  ) as s(matchup_key, round_order, round_name, team_a_key, team_b_key, seed_a, seed_b, target_wins_a, target_wins_b, status)
)
insert into public.playoff_series (
  tournament_id,
  round_order,
  round_name,
  matchup_key,
  team_a_id,
  team_b_id,
  seed_a,
  seed_b,
  target_wins_a,
  target_wins_b,
  status
)
select
  ti.tournament_id,
  stc.round_order,
  stc.round_name,
  stc.matchup_key,
  case stc.team_a_key
    when 'pitillo' then ti.pitillo_id
    when 'medina' then ti.medina_id
    when 'hector' then ti.hector_id
    when 'rodrigo' then ti.rodrigo_id
    else null
  end,
  case stc.team_b_key
    when 'pitillo' then ti.pitillo_id
    when 'medina' then ti.medina_id
    when 'hector' then ti.hector_id
    when 'rodrigo' then ti.rodrigo_id
    else null
  end,
  stc.seed_a,
  stc.seed_b,
  stc.target_wins_a,
  stc.target_wins_b,
  stc.status
from team_ids ti
cross join series_to_create stc
where ti.tournament_id is not null
on conflict on constraint playoff_series_unique_matchup do nothing;

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
),
series_map as (
  select ps.id as series_id, ps.tournament_id, ps.matchup_key
  from public.playoff_series ps
  join target_tournament tt
    on tt.tournament_id = ps.tournament_id
  where ps.matchup_key in ('semi_1v4', 'semi_2v3')
),
candidate_games as (
  select
    'semi_1v4'::text as matchup_key,
    1 as game_number,
    m.id as match_id,
    m.match_date as scheduled_date,
    m.match_time as scheduled_time
  from target_tournament tt
  join lateral (
    select m.*
    from public.matches m
    where m.tournament_id = tt.tournament_id
      and lower(trim(m.team_a)) = 'team pitillo'
      and lower(trim(m.team_b)) = 'team medina'
      and (
        m.id = 25
        or (m.match_date = '2026-03-22'::date and m.match_time = '18:15'::time)
      )
    order by case when m.id = 25 then 0 else 1 end, m.id
    limit 1
  ) m on true

  union all

  select
    'semi_1v4'::text as matchup_key,
    2 as game_number,
    m.id as match_id,
    m.match_date as scheduled_date,
    m.match_time as scheduled_time
  from target_tournament tt
  join lateral (
    select m.*
    from public.matches m
    where m.tournament_id = tt.tournament_id
      and lower(trim(m.team_a)) = 'team pitillo'
      and lower(trim(m.team_b)) = 'team medina'
      and (
        m.id = 26
        or (m.match_date = '2026-03-29'::date and m.match_time = '18:15'::time)
      )
    order by case when m.id = 26 then 0 else 1 end, m.id
    limit 1
  ) m on true

  union all

  select
    'semi_2v3'::text as matchup_key,
    1 as game_number,
    m.id as match_id,
    m.match_date as scheduled_date,
    m.match_time as scheduled_time
  from target_tournament tt
  join lateral (
    select m.*
    from public.matches m
    where m.tournament_id = tt.tournament_id
      and lower(trim(m.team_a)) = 'team hector'
      and lower(trim(m.team_b)) = 'team rodrigo'
      and (
        m.id = 27
        or (m.match_date = '2026-03-22'::date and m.match_time = '19:15'::time)
        or m.match_date = '2026-04-06'::date
      )
    order by case when m.id = 27 then 0 else 1 end, m.id
    limit 1
  ) m on true

  union all

  select
    'semi_2v3'::text as matchup_key,
    2 as game_number,
    m.id as match_id,
    m.match_date as scheduled_date,
    m.match_time as scheduled_time
  from target_tournament tt
  join lateral (
    select m.*
    from public.matches m
    where m.tournament_id = tt.tournament_id
      and lower(trim(m.team_a)) = 'team hector'
      and lower(trim(m.team_b)) = 'team rodrigo'
      and (
        m.id = 28
        or (m.match_date = '2026-03-29'::date and m.match_time = '19:15'::time)
        or m.match_date = '2026-04-09'::date
      )
    order by case when m.id = 28 then 0 else 1 end, m.id
    limit 1
  ) m on true

  union all

  select
    'semi_2v3'::text as matchup_key,
    3 as game_number,
    m.id as match_id,
    m.match_date as scheduled_date,
    m.match_time as scheduled_time
  from target_tournament tt
  join lateral (
    select m.*
    from public.matches m
    where m.tournament_id = tt.tournament_id
      and lower(trim(m.team_a)) = 'team hector'
      and lower(trim(m.team_b)) = 'team rodrigo'
      and (
        m.id = 29
        or (m.match_date = '2026-04-05'::date and m.match_time = '19:15'::time)
      )
    order by case when m.id = 29 then 0 else 1 end, m.id
    limit 1
  ) m on true
)
insert into public.playoff_games (
  tournament_id,
  series_id,
  match_id,
  game_number,
  scheduled_date,
  scheduled_time,
  status
)
select
  sm.tournament_id,
  sm.series_id,
  cg.match_id,
  cg.game_number,
  cg.scheduled_date,
  cg.scheduled_time,
  'scheduled'
from candidate_games cg
join series_map sm
  on sm.matchup_key = cg.matchup_key
on conflict on constraint playoff_games_match_unique do update
set
  tournament_id = excluded.tournament_id,
  series_id = excluded.series_id,
  game_number = excluded.game_number,
  scheduled_date = excluded.scheduled_date,
  scheduled_time = excluded.scheduled_time;

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
),
pitillo_medina_game_one as (
  select pg.match_id
  from public.playoff_games pg
  join public.playoff_series ps
    on ps.id = pg.series_id
  join target_tournament tt
    on tt.tournament_id = ps.tournament_id
  where ps.matchup_key = 'semi_1v4'
    and pg.game_number = 1
  limit 1
)
update public.matches m
set winner_team = case
    when lower(trim(m.team_a)) = 'team pitillo' then m.team_a
    when lower(trim(m.team_b)) = 'team pitillo' then m.team_b
    else 'Team Pitillo'
  end
from pitillo_medina_game_one pm
where m.id = pm.match_id
  and m.winner_team is null;

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
)
update public.playoff_games pg
set status = 'completed'
from public.playoff_series ps
join target_tournament tt
  on tt.tournament_id = ps.tournament_id
where pg.series_id = ps.id
  and ps.matchup_key = 'semi_1v4'
  and pg.game_number = 1;

with target_series as (
  select
    ps.id as series_id,
    ps.tournament_id
  from public.playoff_series ps
  join public.teams ta
    on ta.id = ps.team_a_id
  join public.teams tb
    on tb.id = ps.team_b_id
  join public.tournaments t
    on t.id = ps.tournament_id
  where ps.round_order = 1
    and (
      (lower(trim(ta.name)) = 'team hector' and lower(trim(tb.name)) = 'team rodrigo')
      or (lower(trim(ta.name)) = 'team rodrigo' and lower(trim(tb.name)) = 'team hector')
    )
    and lower(trim(t.name)) = 'intramuro 2'
    and coalesce(t.created_at, '2026-01-01'::timestamptz) >= '2026-01-01'::timestamptz
),
scored_games as (
  select
    pg.id as playoff_game_id,
    pg.match_id,
    pg.game_number,
    case pg.game_number
      when 1 then 55
      when 2 then 42
    end as hector_points,
    case pg.game_number
      when 1 then 58
      when 2 then 54
    end as rodrigo_points,
    case pg.game_number
      when 1 then '2026-04-06'::date
      when 2 then '2026-04-09'::date
    end as played_date
  from target_series ts
  join public.playoff_games pg
    on pg.series_id = ts.series_id
  where pg.game_number in (1, 2)
),
updated_matches as (
  update public.matches m
  set
    winner_team = case
      when lower(trim(m.team_a)) = 'team rodrigo' then m.team_a
      when lower(trim(m.team_b)) = 'team rodrigo' then m.team_b
      else 'Team Rodrigo'
    end,
    team_a_manual_points = case
      when lower(trim(m.team_a)) = 'team hector' then sg.hector_points
      when lower(trim(m.team_a)) = 'team rodrigo' then sg.rodrigo_points
      else m.team_a_manual_points
    end,
    team_b_manual_points = case
      when lower(trim(m.team_b)) = 'team hector' then sg.hector_points
      when lower(trim(m.team_b)) = 'team rodrigo' then sg.rodrigo_points
      else m.team_b_manual_points
    end,
    match_date = sg.played_date,
    result_note = 'Marcador total cargado desde publicacion oficial; no hay boxscore por jugador para este juego.'
  from scored_games sg
  where m.id = sg.match_id
  returning m.id
)
update public.playoff_games pg
set
  status = 'completed',
  scheduled_date = sg.played_date
from scored_games sg
where pg.id = sg.playoff_game_id;

do $$
declare
  v_match_id bigint;
begin
  for v_match_id in
    select pg.match_id
    from public.playoff_games pg
    join public.playoff_series ps
      on ps.id = pg.series_id
    join public.tournaments t
      on t.id = ps.tournament_id
    where ps.round_order = 1
      and (
        (ps.matchup_key = 'semi_1v4' and pg.game_number = 1)
        or (ps.matchup_key = 'semi_2v3' and pg.game_number in (1, 2))
      )
      and lower(trim(t.name)) = 'intramuro 2'
    order by ps.matchup_key, pg.game_number
  loop
    perform public.sync_playoff_series_from_match(v_match_id);
  end loop;
end $$;

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
),
team_ids as (
  select
    tt.tournament_id,
    max(tm.id) filter (where lower(trim(tm.name)) = 'team pitillo') as pitillo_id,
    max(tm.id) filter (where lower(trim(tm.name)) = 'team rodrigo') as rodrigo_id
  from target_tournament tt
  join public.teams tm
    on tm.tournament_id = tt.tournament_id
  group by tt.tournament_id
)
update public.playoff_series ps
set
  wins_a = case when ps.team_a_id = ti.pitillo_id then 1 else 0 end,
  wins_b = case when ps.team_b_id = ti.pitillo_id then 1 else 0 end,
  status = 'completed',
  winner_team_id = ti.pitillo_id
from team_ids ti
where ps.tournament_id = ti.tournament_id
  and ps.matchup_key = 'semi_1v4';

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
),
team_ids as (
  select
    tt.tournament_id,
    max(tm.id) filter (where lower(trim(tm.name)) = 'team rodrigo') as rodrigo_id
  from target_tournament tt
  join public.teams tm
    on tm.tournament_id = tt.tournament_id
  group by tt.tournament_id
)
update public.playoff_series ps
set
  wins_a = case when ps.team_a_id = ti.rodrigo_id then 2 else 0 end,
  wins_b = case when ps.team_b_id = ti.rodrigo_id then 2 else 0 end,
  status = 'completed',
  winner_team_id = ti.rodrigo_id
from team_ids ti
where ps.tournament_id = ti.tournament_id
  and ps.matchup_key = 'semi_2v3';

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
)
update public.playoff_games pg
set status = 'cancelled'
from public.playoff_series ps
join target_tournament tt
  on tt.tournament_id = ps.tournament_id
cross join public.matches m
where pg.series_id = ps.id
  and m.id = pg.match_id
  and m.winner_team is null
  and (
    (ps.matchup_key = 'semi_1v4' and pg.game_number = 2)
    or (ps.matchup_key = 'semi_2v3' and pg.game_number = 3)
  );

do $$
declare
  v_tournament_id uuid;
  v_finals_series_id bigint;
  v_team_a_id bigint;
  v_team_b_id bigint;
  v_team_a_name text;
  v_team_b_name text;
  v_match_id bigint;
  i int;
begin
  select t.id
  into v_tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1;

  if v_tournament_id is null then
    return;
  end if;

  select ps.id
  into v_finals_series_id
  from public.playoff_series ps
  where ps.tournament_id = v_tournament_id
    and ps.matchup_key = 'finals'
  limit 1;

  if v_finals_series_id is null then
    return;
  end if;

  select id, name
  into v_team_a_id, v_team_a_name
  from public.teams
  where tournament_id = v_tournament_id
    and lower(trim(name)) = 'team pitillo'
  limit 1;

  select id, name
  into v_team_b_id, v_team_b_name
  from public.teams
  where tournament_id = v_tournament_id
    and lower(trim(name)) = 'team rodrigo'
  limit 1;

  update public.playoff_series
  set
    team_a_id = coalesce(team_a_id, v_team_a_id),
    team_b_id = coalesce(team_b_id, v_team_b_id),
    status = case when status = 'pending' then 'active' else status end
  where id = v_finals_series_id;

  if not exists (
    select 1
    from public.playoff_games pg
    where pg.series_id = v_finals_series_id
  ) then
    for i in 1..3 loop
      insert into public.matches (
        tournament_id,
        team_a,
        team_b,
        match_date,
        match_time,
        winner_team
      )
      values (
        v_tournament_id,
        v_team_a_name,
        v_team_b_name,
        '2026-04-12'::date + ((i - 1) * 7),
        '18:15',
        null
      )
      returning id into v_match_id;

      insert into public.playoff_games (
        tournament_id,
        series_id,
        match_id,
        game_number,
        scheduled_date,
        scheduled_time,
        status
      )
      values (
        v_tournament_id,
        v_finals_series_id,
        v_match_id,
        i,
        '2026-04-12'::date + ((i - 1) * 7),
        '18:15',
        'scheduled'
      );
    end loop;
  end if;
end $$;

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
),
final_game as (
  select pg.match_id
  from public.playoff_games pg
  join public.playoff_series ps
    on ps.id = pg.series_id
  join target_tournament tt
    on tt.tournament_id = ps.tournament_id
  where ps.matchup_key = 'finals'
    and pg.game_number = 1
  limit 1
)
update public.matches m
set
  winner_team = case
    when lower(trim(m.team_a)) = 'team pitillo' then m.team_a
    when lower(trim(m.team_b)) = 'team pitillo' then m.team_b
    else 'Team Pitillo'
  end,
  team_a_manual_points = null,
  team_b_manual_points = null,
  result_note = null
from final_game fg
where m.id = fg.match_id;

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
)
update public.playoff_games pg
set status = 'completed'
from public.playoff_series ps
join target_tournament tt
  on tt.tournament_id = ps.tournament_id
where pg.series_id = ps.id
  and ps.matchup_key = 'finals'
  and pg.game_number = 1;

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
),
team_ids as (
  select
    tt.tournament_id,
    max(tm.id) filter (where lower(trim(tm.name)) = 'team pitillo') as pitillo_id
  from target_tournament tt
  join public.teams tm
    on tm.tournament_id = tt.tournament_id
  group by tt.tournament_id
)
update public.playoff_series ps
set
  wins_a = case when ps.team_a_id = ti.pitillo_id then 1 else 0 end,
  wins_b = case when ps.team_b_id = ti.pitillo_id then 1 else 0 end,
  status = 'active',
  winner_team_id = null
from team_ids ti
where ps.tournament_id = ti.tournament_id
  and ps.matchup_key = 'finals';

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
),
final_game as (
  select pg.match_id
  from public.playoff_games pg
  join public.playoff_series ps
    on ps.id = pg.series_id
  join target_tournament tt
    on tt.tournament_id = ps.tournament_id
  where ps.matchup_key = 'finals'
    and pg.game_number = 1
  limit 1
),
participants as (
  select *
  from (
    values
      (4::bigint, 'A'::text),
      (7::bigint, 'A'::text),
      (1::bigint, 'A'::text),
      (8::bigint, 'A'::text),
      (5::bigint, 'A'::text),
      (10::bigint, 'A'::text),
      (11::bigint, 'A'::text),
      (6::bigint, 'A'::text),
      (34::bigint, 'B'::text),
      (44::bigint, 'B'::text),
      (39::bigint, 'B'::text),
      (42::bigint, 'B'::text),
      (37::bigint, 'B'::text),
      (40::bigint, 'B'::text),
      (35::bigint, 'B'::text),
      (41::bigint, 'B'::text),
      (36::bigint, 'B'::text)
  ) as p(player_id, team_side)
)
insert into public.match_players (
  match_id,
  player_id,
  team,
  played
)
select
  fg.match_id,
  p.player_id,
  p.team_side,
  true
from final_game fg
cross join participants p
on conflict on constraint match_players_match_player_unique do update
set
  team = excluded.team,
  played = true;

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
),
final_game as (
  select pg.match_id
  from public.playoff_games pg
  join public.playoff_series ps
    on ps.id = pg.series_id
  join target_tournament tt
    on tt.tournament_id = ps.tournament_id
  where ps.matchup_key = 'finals'
    and pg.game_number = 1
  limit 1
),
participants as (
  select *
  from (
    values
      (4::bigint),
      (7::bigint),
      (1::bigint),
      (8::bigint),
      (5::bigint),
      (10::bigint),
      (11::bigint),
      (6::bigint),
      (34::bigint),
      (44::bigint),
      (39::bigint),
      (42::bigint),
      (37::bigint),
      (40::bigint),
      (35::bigint),
      (41::bigint),
      (36::bigint)
  ) as p(player_id)
)
delete from public.player_stats ps
using final_game fg, participants p
where ps.match_id = fg.match_id
  and ps.player_id = p.player_id;

with target_tournament as (
  select t.id as tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1
),
final_game as (
  select pg.match_id
  from public.playoff_games pg
  join public.playoff_series ps
    on ps.id = pg.series_id
  join target_tournament tt
    on tt.tournament_id = ps.tournament_id
  where ps.matchup_key = 'finals'
    and pg.game_number = 1
  limit 1
),
stats as (
  select *
  from (
    values
      (4::bigint, 16, 14, 4, 1, 0, 1, 0, 7, 15, 0, 4, 0, 0),
      (7::bigint, 33, 1, 4, 0, 0, 4, 0, 10, 16, 4, 5, 4, 11),
      (1::bigint, 4, 11, 3, 3, 3, 0, 0, 2, 8, 0, 2, 0, 1),
      (8::bigint, 4, 10, 1, 1, 0, 1, 0, 2, 3, 0, 0, 0, 0),
      (5::bigint, 0, 0, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2),
      (10::bigint, 3, 0, 1, 1, 0, 1, 0, 1, 2, 1, 1, 0, 0),
      (11::bigint, 2, 2, 3, 0, 0, 1, 0, 1, 2, 0, 0, 0, 1),
      (6::bigint, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      (34::bigint, 33, 2, 4, 3, 0, 2, 0, 10, 15, 1, 2, 5, 15),
      (44::bigint, 5, 4, 1, 0, 0, 2, 0, 2, 3, 1, 6, 0, 2),
      (39::bigint, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      (42::bigint, 17, 8, 0, 0, 0, 0, 0, 4, 7, 0, 0, 3, 6),
      (37::bigint, 0, 8, 3, 1, 6, 1, 0, 0, 1, 0, 1, 0, 1),
      (40::bigint, 0, 2, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 1),
      (35::bigint, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
      (41::bigint, 2, 2, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 1),
      (36::bigint, 0, 1, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0)
  ) as s(player_id, points, rebounds, assists, steals, blocks, turnovers, fouls, fgm, fga, ftm, fta, tpm, tpa)
)
insert into public.player_stats (
  tournament_id,
  match_id,
  player_id,
  points,
  rebounds,
  assists,
  steals,
  blocks,
  turnovers,
  fouls,
  fgm,
  fga,
  ftm,
  fta,
  tpm,
  tpa
)
select
  tt.tournament_id,
  fg.match_id,
  s.player_id,
  s.points,
  s.rebounds,
  s.assists,
  s.steals,
  s.blocks,
  s.turnovers,
  s.fouls,
  s.fgm,
  s.fga,
  s.ftm,
  s.fta,
  s.tpm,
  s.tpa
from target_tournament tt
cross join final_game fg
cross join stats s;

do $$
declare
  v_tournament_id uuid;
  v_final_match_id bigint;
begin
  select t.id
  into v_tournament_id
  from public.tournaments t
  where lower(trim(t.name)) = 'intramuro 2'
  order by t.created_at desc nulls last
  limit 1;

  select pg.match_id
  into v_final_match_id
  from public.playoff_games pg
  join public.playoff_series ps
    on ps.id = pg.series_id
  where ps.tournament_id = v_tournament_id
    and ps.matchup_key = 'finals'
    and pg.game_number = 1
  limit 1;

  if v_final_match_id is not null then
    perform public.sync_playoff_series_from_match(v_final_match_id);
  end if;

  if v_tournament_id is not null then
    begin
      perform public.refresh_tournament_player_totals_cache(v_tournament_id);
    exception
      when undefined_function then
        null;
    end;
  end if;
end $$;

commit;
