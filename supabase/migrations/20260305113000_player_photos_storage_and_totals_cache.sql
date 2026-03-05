begin;

-- Bucket publico para fotos de jugadores (evita guardar blobs base64 en la tabla players).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-photos',
  'player-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists public_read_player_photos on storage.objects;
create policy public_read_player_photos
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'player-photos');

drop policy if exists public_insert_player_photos on storage.objects;
create policy public_insert_player_photos
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'player-photos');

drop policy if exists public_update_player_photos on storage.objects;
create policy public_update_player_photos
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'player-photos')
  with check (bucket_id = 'player-photos');

drop policy if exists public_delete_player_photos on storage.objects;
create policy public_delete_player_photos
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'player-photos');

-- Cache SQL de totales por torneo/fase/jugador para evitar agregaciones pesadas en caliente.
create table if not exists public.tournament_player_totals_cache (
  tournament_id uuid not null,
  phase text not null check (phase in ('regular', 'playoffs', 'finals')),
  player_id bigint not null,
  names text null,
  lastnames text null,
  team_name text null,
  games_played integer not null default 0,
  points integer not null default 0,
  rebounds integer not null default 0,
  assists integer not null default 0,
  steals integer not null default 0,
  blocks integer not null default 0,
  turnovers integer not null default 0,
  fouls integer not null default 0,
  fgm integer not null default 0,
  fga integer not null default 0,
  fg_pct numeric not null default 0,
  ftm integer not null default 0,
  fta integer not null default 0,
  ft_pct numeric not null default 0,
  tpm integer not null default 0,
  tpa integer not null default 0,
  tp_pct numeric not null default 0,
  ppg numeric not null default 0,
  rpg numeric not null default 0,
  apg numeric not null default 0,
  spg numeric not null default 0,
  bpg numeric not null default 0,
  topg numeric not null default 0,
  fpg numeric not null default 0,
  updated_at timestamp with time zone not null default now(),
  constraint tournament_player_totals_cache_pkey primary key (tournament_id, phase, player_id)
);

create index if not exists idx_tournament_player_totals_cache_tournament_phase_points
  on public.tournament_player_totals_cache (tournament_id, phase, points desc);

create index if not exists idx_tournament_player_totals_cache_tournament_player
  on public.tournament_player_totals_cache (tournament_id, player_id);

create or replace function public.refresh_tournament_player_totals_cache(
  p_tournament_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tournament_id is null then
    truncate table public.tournament_player_totals_cache;
  else
    delete from public.tournament_player_totals_cache
    where tournament_id = p_tournament_id;
  end if;

  insert into public.tournament_player_totals_cache (
    tournament_id,
    phase,
    player_id,
    names,
    lastnames,
    team_name,
    games_played,
    points,
    rebounds,
    assists,
    steals,
    blocks,
    turnovers,
    fouls,
    fgm,
    fga,
    fg_pct,
    ftm,
    fta,
    ft_pct,
    tpm,
    tpa,
    tp_pct,
    ppg,
    rpg,
    apg,
    spg,
    bpg,
    topg,
    fpg,
    updated_at
  )
  select
    pag.tournament_id,
    pag.phase,
    pag.player_id,
    max(pag.names) as names,
    max(pag.lastnames) as lastnames,
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
    end as tp_pct,
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
    now() as updated_at
  from public.tournament_analytics_player_game pag
  where p_tournament_id is null
     or pag.tournament_id = p_tournament_id
  group by
    pag.tournament_id,
    pag.phase,
    pag.player_id;
end;
$$;

grant select on public.tournament_player_totals_cache to anon, authenticated;
grant execute on function public.refresh_tournament_player_totals_cache(uuid) to anon, authenticated;

-- Bootstrap inicial del cache.
select public.refresh_tournament_player_totals_cache(null);

commit;
