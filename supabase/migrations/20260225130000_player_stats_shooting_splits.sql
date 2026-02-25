begin;

alter table public.player_stats
  add column if not exists ftm bigint not null default 0,
  add column if not exists fta bigint not null default 0,
  add column if not exists tpm bigint not null default 0,
  add column if not exists tpa bigint not null default 0;

update public.player_stats
set
  ftm = coalesce(ftm, 0),
  fta = coalesce(fta, 0),
  tpm = coalesce(tpm, 0),
  tpa = coalesce(tpa, 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_stats_shooting_splits_non_negative_chk'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_shooting_splits_non_negative_chk check (
        ftm >= 0 and fta >= 0 and tpm >= 0 and tpa >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_stats_ftm_lte_fta_chk'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_ftm_lte_fta_chk check (ftm <= fta);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_stats_tpm_lte_tpa_chk'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_tpm_lte_tpa_chk check (tpm <= tpa);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_stats_tpa_lte_fga_chk'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_tpa_lte_fga_chk check (tpa <= fga);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_stats_tpm_lte_fgm_chk'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_tpm_lte_fgm_chk check (tpm <= fgm);
  end if;
end $$;

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

create or replace view public.tournament_player_stats_enriched as
select
  ps.id as player_stats_id,
  ps.tournament_id,
  ps.match_id,
  m.match_date,
  m.match_time,
  ps.player_id,
  p.names,
  p.lastnames,
  p.photo,
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
  end as fg_pct,
  mp.team as team_side,
  case
    when mp.team = 'A' then m.team_a
    when mp.team = 'B' then m.team_b
    else null
  end as team_name,
  case
    when pg.id is null then 'regular'
    when lower(coalesce(ser.round_name, '')) like '%final%' then 'finals'
    else 'playoffs'
  end as phase,
  ser.id as playoff_series_id,
  ser.round_order,
  ser.round_name,
  ser.matchup_key,
  pg.game_number,
  ps.ftm,
  ps.fta,
  case
    when ps.fta > 0 then round((ps.ftm::numeric / ps.fta::numeric) * 100, 2)
    else 0
  end as ft_pct,
  ps.tpm,
  ps.tpa,
  case
    when ps.tpa > 0 then round((ps.tpm::numeric / ps.tpa::numeric) * 100, 2)
    else 0
  end as tp_pct
from public.player_stats ps
join public.matches m on m.id = ps.match_id
left join public.match_players mp
  on mp.match_id = ps.match_id and mp.player_id = ps.player_id
left join public.players p on p.id = ps.player_id
left join public.playoff_games pg on pg.match_id = ps.match_id
left join public.playoff_series ser on ser.id = pg.series_id;

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
  end as fg_pct,
  ps.ftm,
  ps.fta,
  case
    when ps.fta > 0 then round((ps.ftm::numeric / ps.fta::numeric) * 100, 2)
    else 0
  end as ft_pct,
  ps.tpm,
  ps.tpa,
  case
    when ps.tpa > 0 then round((ps.tpm::numeric / ps.tpa::numeric) * 100, 2)
    else 0
  end as tp_pct
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
  end as fpg,
  coalesce(sum(pag.ftm), 0)::int as ftm,
  coalesce(sum(pag.fta), 0)::int as fta,
  case
    when coalesce(sum(pag.fta), 0) > 0 then round((sum(pag.ftm)::numeric / sum(pag.fta)::numeric) * 100, 2)
    else 0
  end as ft_pct,
  coalesce(sum(pag.tpm), 0)::int as tpm,
  coalesce(sum(pag.tpa), 0)::int as tpa,
  case
    when coalesce(sum(pag.tpa), 0) > 0 then round((sum(pag.tpm)::numeric / sum(pag.tpa)::numeric) * 100, 2)
    else 0
  end as tp_pct
from public.tournament_analytics_player_game pag
group by
  pag.tournament_id,
  pag.phase,
  pag.player_id;

grant select on public.tournament_player_stats_enriched to anon, authenticated;
grant select on public.tournament_analytics_match_index to anon, authenticated;
grant select on public.tournament_analytics_player_game to anon, authenticated;
grant select on public.tournament_analytics_player_totals to anon, authenticated;

commit;
