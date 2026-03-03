begin;

-- Indices adicionales para acelerar listados de jugadores por torneo
-- y consultas de estadisticas filtradas por jugador/fase.

create index if not exists idx_player_stats_tournament_player_match
  on public.player_stats (tournament_id, player_id, match_id);

create index if not exists idx_team_players_tournament_team_player_cover
  on public.team_players (tournament_id, team_id, player_id);

create index if not exists idx_teams_tournament_name_id
  on public.teams (tournament_id, name, id);

commit;
