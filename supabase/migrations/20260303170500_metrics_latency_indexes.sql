begin;

-- Indices parciales para acelerar vistas de calendario/resultados
-- y rutas de detalle por jugador en analitica.

create index if not exists idx_matches_tournament_pending_schedule
  on public.matches (tournament_id, match_date, match_time, id)
  where winner_team is null;

create index if not exists idx_matches_tournament_completed_schedule
  on public.matches (tournament_id, match_date desc, match_time desc, id)
  where winner_team is not null;

create index if not exists idx_player_stats_tournament_player_id
  on public.player_stats (tournament_id, player_id, id);

commit;
