begin;

-- Indices para acelerar cargas de analytics y resultados en torneos grandes.

create index if not exists idx_matches_tournament_id_id
  on public.matches (tournament_id, id);

create index if not exists idx_player_stats_tournament_match_player
  on public.player_stats (tournament_id, match_id, player_id);

create index if not exists idx_player_stats_tournament_id_id
  on public.player_stats (tournament_id, id);

create index if not exists idx_match_players_match_team_player
  on public.match_players (match_id, team, player_id);

commit;
