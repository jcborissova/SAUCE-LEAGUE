begin;

create or replace view public.tournament_match_scoreboard as
select
  m.tournament_id,
  m.id as match_id,
  m.match_date,
  m.match_time,
  m.team_a,
  m.team_b,
  m.winner_team,
  coalesce(sum(case when mp.team = 'A' then ps.points else 0 end), 0)::int as team_a_points,
  coalesce(sum(case when mp.team = 'B' then ps.points else 0 end), 0)::int as team_b_points,
  (count(ps.id) > 0) as has_stats
from public.matches m
left join public.match_players mp
  on mp.match_id = m.id
left join public.player_stats ps
  on ps.match_id = m.id
 and ps.player_id = mp.player_id
where m.winner_team is not null
group by
  m.tournament_id,
  m.id,
  m.match_date,
  m.match_time,
  m.team_a,
  m.team_b,
  m.winner_team;

grant select on public.tournament_match_scoreboard to anon, authenticated;

commit;
