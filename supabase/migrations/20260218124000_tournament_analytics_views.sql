begin;

create or replace view public.tournament_analytics_match_index as
with match_phase as (
  select
    m.tournament_id,
    m.id as match_id,
    m.match_date,
    m.match_time,
    case
      when pg.id is null then 'regular'
      when lower(coalesce(ps.round_name, '')) like '%final%' then 'finals'
      else 'playoffs'
    end as phase
  from public.matches m
  left join public.playoff_games pg
    on pg.match_id = m.id
  left join public.playoff_series ps
    on ps.id = pg.series_id
)
select
  mp.tournament_id,
  mp.match_id,
  mp.match_date,
  mp.match_time,
  mp.phase,
  row_number() over (
    partition by mp.tournament_id, mp.phase
    order by mp.match_date asc nulls last, mp.match_time asc nulls last, mp.match_id asc
  )::int as game_order
from match_phase mp;

create or replace view public.tournament_analytics_player_game as
select
  ps.tournament_id,
  ps.match_id,
  mi.match_date,
  mi.match_time,
  mi.phase,
  mi.game_order,
  ps.player_id,
  p.names,
  p.lastnames,
  p.photo,
  case
    when mp.team = 'A' then m.team_a
    when mp.team = 'B' then m.team_b
    else null
  end as team_name,
  ps.points,
  ps.rebounds,
  ps.assists,
  ps.steals,
  ps.blocks,
  ps.turnovers,
  ps.fouls,
  ps.fgm,
  ps.fga,
  case
    when ps.fga > 0 then round((ps.fgm::numeric / ps.fga::numeric) * 100, 2)
    else 0
  end as fg_pct
from public.player_stats ps
join public.matches m
  on m.id = ps.match_id
left join public.tournament_analytics_match_index mi
  on mi.tournament_id = ps.tournament_id
 and mi.match_id = ps.match_id
left join public.players p
  on p.id = ps.player_id
left join public.match_players mp
  on mp.match_id = ps.match_id
 and mp.player_id = ps.player_id;

create or replace view public.tournament_analytics_player_totals as
select
  pag.tournament_id,
  pag.phase,
  pag.player_id,
  max(pag.names) as names,
  max(pag.lastnames) as lastnames,
  max(pag.photo) as photo,
  max(pag.team_name) as team_name,
  count(distinct pag.match_id)::int as games_played,
  coalesce(sum(pag.points), 0)::int as points,
  coalesce(sum(pag.rebounds), 0)::int as rebounds,
  coalesce(sum(pag.assists), 0)::int as assists,
  coalesce(sum(pag.steals), 0)::int as steals,
  coalesce(sum(pag.blocks), 0)::int as blocks,
  coalesce(sum(pag.turnovers), 0)::int as turnovers,
  coalesce(sum(pag.fouls), 0)::int as fouls,
  coalesce(sum(pag.fgm), 0)::int as fgm,
  coalesce(sum(pag.fga), 0)::int as fga,
  case
    when coalesce(sum(pag.fga), 0) > 0 then round((sum(pag.fgm)::numeric / sum(pag.fga)::numeric) * 100, 2)
    else 0
  end as fg_pct,
  case
    when count(distinct pag.match_id) > 0 then round(sum(pag.points)::numeric / count(distinct pag.match_id)::numeric, 2)
    else 0
  end as ppg,
  case
    when count(distinct pag.match_id) > 0 then round(sum(pag.rebounds)::numeric / count(distinct pag.match_id)::numeric, 2)
    else 0
  end as rpg,
  case
    when count(distinct pag.match_id) > 0 then round(sum(pag.assists)::numeric / count(distinct pag.match_id)::numeric, 2)
    else 0
  end as apg,
  case
    when count(distinct pag.match_id) > 0 then round(sum(pag.steals)::numeric / count(distinct pag.match_id)::numeric, 2)
    else 0
  end as spg,
  case
    when count(distinct pag.match_id) > 0 then round(sum(pag.blocks)::numeric / count(distinct pag.match_id)::numeric, 2)
    else 0
  end as bpg,
  case
    when count(distinct pag.match_id) > 0 then round(sum(pag.turnovers)::numeric / count(distinct pag.match_id)::numeric, 2)
    else 0
  end as topg,
  case
    when count(distinct pag.match_id) > 0 then round(sum(pag.fouls)::numeric / count(distinct pag.match_id)::numeric, 2)
    else 0
  end as fpg
from public.tournament_analytics_player_game pag
group by
  pag.tournament_id,
  pag.phase,
  pag.player_id;

create or replace view public.tournament_analytics_team_factor as
with match_phase as (
  select
    m.tournament_id,
    m.id as match_id,
    m.team_a,
    m.team_b,
    m.winner_team,
    case
      when pg.id is null then 'regular'
      when lower(coalesce(ps.round_name, '')) like '%final%' then 'finals'
      else 'playoffs'
    end as phase
  from public.matches m
  left join public.playoff_games pg
    on pg.match_id = m.id
  left join public.playoff_series ps
    on ps.id = pg.series_id
  where m.winner_team is not null
),
team_games as (
  select
    tournament_id,
    phase,
    team_a as team_name,
    case when winner_team = team_a then 1 else 0 end as win
  from match_phase
  where team_a is not null

  union all

  select
    tournament_id,
    phase,
    team_b as team_name,
    case when winner_team = team_b then 1 else 0 end as win
  from match_phase
  where team_b is not null
)
select
  tg.tournament_id,
  tg.team_name,
  tg.phase,
  count(*)::int as games_played,
  coalesce(sum(tg.win), 0)::int as wins,
  case
    when count(*) = 0 then 0
    else round(sum(tg.win)::numeric / count(*)::numeric, 4)
  end as win_pct
from team_games tg
group by
  tg.tournament_id,
  tg.team_name,
  tg.phase;

grant select on public.tournament_analytics_match_index to anon, authenticated;
grant select on public.tournament_analytics_player_game to anon, authenticated;
grant select on public.tournament_analytics_player_totals to anon, authenticated;
grant select on public.tournament_analytics_team_factor to anon, authenticated;

commit;
