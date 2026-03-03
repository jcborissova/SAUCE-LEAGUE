begin;

-- Resumen ligero para KPIs de analytics sin cargar boxscores completos.

create or replace view public.tournament_analytics_summary as
with match_phase as (
  select
    m.tournament_id,
    m.id as match_id,
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
  ps.tournament_id,
  mp.phase,
  count(distinct ps.match_id)::int as games_analyzed,
  count(distinct ps.player_id)::int as players_analyzed
from public.player_stats ps
join match_phase mp
  on mp.tournament_id = ps.tournament_id
 and mp.match_id = ps.match_id
group by
  ps.tournament_id,
  mp.phase;

grant select on public.tournament_analytics_summary to anon, authenticated;

commit;
