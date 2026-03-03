-- Indexes de estabilidad para consultas frecuentes en frontend.
-- Objetivo: reducir timeouts en listados por torneo, equipos y jugadores.

create index if not exists idx_teams_tournament_id
  on public.teams (tournament_id);

create index if not exists idx_teams_tournament_id_id
  on public.teams (tournament_id, id);

create index if not exists idx_team_players_team_id
  on public.team_players (team_id);

create index if not exists idx_team_players_player_id
  on public.team_players (player_id);

create index if not exists idx_team_players_team_player
  on public.team_players (team_id, player_id);

create index if not exists idx_matches_tournament_id
  on public.matches (tournament_id);

create index if not exists idx_matches_tournament_schedule
  on public.matches (tournament_id, match_date, match_time, id);

create index if not exists idx_players_is_guest_id
  on public.players (is_guest, id);
