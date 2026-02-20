begin;

-- -----------------------------------------------------------------------------
-- 1) Player stats expansion + data integrity
-- -----------------------------------------------------------------------------

alter table public.player_stats
  add column if not exists tournament_id uuid,
  add column if not exists steals bigint not null default 0,
  add column if not exists blocks bigint not null default 0,
  add column if not exists turnovers bigint not null default 0,
  add column if not exists fouls bigint not null default 0,
  add column if not exists fgm bigint not null default 0,
  add column if not exists fga bigint not null default 0;

update public.player_stats ps
set tournament_id = m.tournament_id
from public.matches m
where m.id = ps.match_id
  and ps.tournament_id is null;

update public.player_stats
set
  points = coalesce(points, 0),
  rebounds = coalesce(rebounds, 0),
  assists = coalesce(assists, 0),
  steals = coalesce(steals, 0),
  blocks = coalesce(blocks, 0),
  turnovers = coalesce(turnovers, 0),
  fouls = coalesce(fouls, 0),
  fgm = coalesce(fgm, 0),
  fga = coalesce(fga, 0);

alter table public.player_stats
  alter column points set default 0,
  alter column rebounds set default 0,
  alter column assists set default 0,
  alter column points set not null,
  alter column rebounds set not null,
  alter column assists set not null,
  alter column tournament_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_stats_non_negative_chk'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_non_negative_chk check (
        points >= 0 and rebounds >= 0 and assists >= 0 and steals >= 0 and blocks >= 0
        and turnovers >= 0 and fouls >= 0 and fgm >= 0 and fga >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_stats_fgm_lte_fga_chk'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_fgm_lte_fga_chk check (fgm <= fga);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_stats_tournament_id_fkey'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_tournament_id_fkey
      foreign key (tournament_id) references public.tournaments(id) on delete cascade;
  end if;
end $$;

-- remove duplicate stat rows before enforcing uniqueness
with ranked as (
  select id,
         row_number() over (partition by match_id, player_id order by id desc) as rn
  from public.player_stats
)
delete from public.player_stats ps
using ranked r
where ps.id = r.id
  and r.rn > 1;

-- ensure participation integrity by backfilling missing match_players rows
insert into public.match_players (match_id, player_id, team)
select distinct
  ps.match_id,
  ps.player_id,
  case
    when tpa.player_id is not null then 'A'
    when tpb.player_id is not null then 'B'
    else null
  end as team
from public.player_stats ps
join public.matches m on m.id = ps.match_id
left join public.match_players mp
  on mp.match_id = ps.match_id and mp.player_id = ps.player_id
left join public.teams ta
  on ta.tournament_id = m.tournament_id and ta.name = m.team_a
left join public.teams tb
  on tb.tournament_id = m.tournament_id and tb.name = m.team_b
left join public.team_players tpa
  on tpa.team_id = ta.id and tpa.player_id = ps.player_id
left join public.team_players tpb
  on tpb.team_id = tb.id and tpb.player_id = ps.player_id
where mp.id is null;

-- remove duplicates before adding unique key
with ranked as (
  select id,
         row_number() over (partition by match_id, player_id order by id desc) as rn
  from public.match_players
)
delete from public.match_players mp
using ranked r
where mp.id = r.id
  and r.rn > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'match_players_match_player_unique'
      and conrelid = 'public.match_players'::regclass
  ) then
    alter table public.match_players
      add constraint match_players_match_player_unique unique (match_id, player_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_stats_match_player_fkey'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_match_player_fkey
      foreign key (match_id, player_id)
      references public.match_players(match_id, player_id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_stats_match_player_unique'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_match_player_unique unique (match_id, player_id);
  end if;
end $$;

create index if not exists idx_player_stats_tournament_player
  on public.player_stats (tournament_id, player_id);
create index if not exists idx_player_stats_match_id
  on public.player_stats (match_id);
create index if not exists idx_player_stats_player_id
  on public.player_stats (player_id);
create index if not exists idx_match_players_match_player
  on public.match_players (match_id, player_id);

-- -----------------------------------------------------------------------------
-- 2) Tournament settings + playoffs model
-- -----------------------------------------------------------------------------

create table if not exists public.tournament_settings (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  season_type text not null default 'regular_plus_playoffs',
  playoff_format jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_settings_season_type_chk
    check (season_type in ('regular_only', 'regular_plus_playoffs'))
);

create table if not exists public.playoff_series (
  id bigserial primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_order integer not null,
  round_name text not null,
  matchup_key text not null,
  team_a_id bigint references public.teams(id) on delete set null,
  team_b_id bigint references public.teams(id) on delete set null,
  seed_a integer,
  seed_b integer,
  wins_a integer not null default 0,
  wins_b integer not null default 0,
  target_wins_a integer not null default 1,
  target_wins_b integer not null default 1,
  status text not null default 'pending',
  winner_team_id bigint references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint playoff_series_status_chk
    check (status in ('pending', 'active', 'completed')),
  constraint playoff_series_targets_chk
    check (target_wins_a > 0 and target_wins_b > 0),
  constraint playoff_series_unique_matchup unique (tournament_id, round_order, matchup_key)
);

create table if not exists public.playoff_games (
  id bigserial primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  series_id bigint not null references public.playoff_series(id) on delete cascade,
  match_id bigint not null references public.matches(id) on delete cascade,
  game_number integer not null,
  status text not null default 'scheduled',
  scheduled_date date,
  scheduled_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint playoff_games_status_chk
    check (status in ('scheduled', 'completed', 'cancelled')),
  constraint playoff_games_match_unique unique (match_id),
  constraint playoff_games_series_game_unique unique (series_id, game_number)
);

create index if not exists idx_playoff_series_tournament
  on public.playoff_series (tournament_id, round_order, matchup_key);
create index if not exists idx_playoff_games_series
  on public.playoff_games (series_id, game_number);
create index if not exists idx_playoff_games_tournament
  on public.playoff_games (tournament_id);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tournament_settings_updated_at on public.tournament_settings;
create trigger trg_tournament_settings_updated_at
before update on public.tournament_settings
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_playoff_series_updated_at on public.playoff_series;
create trigger trg_playoff_series_updated_at
before update on public.playoff_series
for each row execute function public.set_updated_at_timestamp();

drop trigger if exists trg_playoff_games_updated_at on public.playoff_games;
create trigger trg_playoff_games_updated_at
before update on public.playoff_games
for each row execute function public.set_updated_at_timestamp();

insert into public.tournament_settings (tournament_id, season_type, playoff_format)
select
  t.id,
  'regular_plus_playoffs',
  jsonb_build_object(
    'enabled', true,
    'format', 'custom_1vN_handicap_2v3_bo3_finals_bo3',
    'rounds', jsonb_build_array(
      jsonb_build_object(
        'name', 'Round 1',
        'series', jsonb_build_array(
          jsonb_build_object(
            'pairing', '1vN',
            'type', 'handicap',
            'targetWins', jsonb_build_object('topSeed', 1, 'bottomSeed', 2)
          ),
          jsonb_build_object(
            'pairing', '2v3',
            'type', 'bestOf',
            'bestOf', 3
          )
        )
      ),
      jsonb_build_object(
        'name', 'Finals',
        'series', jsonb_build_array(
          jsonb_build_object(
            'pairing', 'Winners',
            'type', 'bestOf',
            'bestOf', 3
          )
        )
      )
    )
  )
from public.tournaments t
on conflict (tournament_id) do update
set
  season_type = coalesce(public.tournament_settings.season_type, excluded.season_type),
  playoff_format = case
    when public.tournament_settings.playoff_format = '{}'::jsonb then excluded.playoff_format
    else public.tournament_settings.playoff_format
  end;

-- -----------------------------------------------------------------------------
-- 3) Aggregation views
-- -----------------------------------------------------------------------------

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
  pg.game_number
from public.player_stats ps
join public.matches m on m.id = ps.match_id
left join public.match_players mp
  on mp.match_id = ps.match_id and mp.player_id = ps.player_id
left join public.players p on p.id = ps.player_id
left join public.playoff_games pg on pg.match_id = ps.match_id
left join public.playoff_series ser on ser.id = pg.series_id;

create or replace view public.tournament_regular_standings as
with regular_matches as (
  select m.*
  from public.matches m
  left join public.playoff_games pg on pg.match_id = m.id
  where pg.id is null
    and m.winner_team is not null
)
select
  t.tournament_id,
  t.id as team_id,
  t.name as team_name,
  count(rm.id) filter (where rm.team_a = t.name or rm.team_b = t.name) as games_played,
  count(rm.id) filter (where rm.winner_team = t.name) as wins,
  count(rm.id) filter (
    where (rm.team_a = t.name or rm.team_b = t.name)
      and rm.winner_team is distinct from t.name
  ) as losses,
  case
    when count(rm.id) filter (where rm.team_a = t.name or rm.team_b = t.name) = 0 then 0
    else round(
      count(rm.id) filter (where rm.winner_team = t.name)::numeric
      / count(rm.id) filter (where rm.team_a = t.name or rm.team_b = t.name)::numeric,
      4
    )
  end as win_pct
from public.teams t
left join regular_matches rm
  on rm.tournament_id = t.tournament_id
group by t.tournament_id, t.id, t.name;

-- -----------------------------------------------------------------------------
-- 4) Playoff generation + progression RPCs
-- -----------------------------------------------------------------------------

create or replace function public.generate_tournament_playoffs(p_tournament_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_seeded record;
  v_seed_1_id bigint;
  v_seed_2_id bigint;
  v_seed_3_id bigint;
  v_seed_4_id bigint;
  v_seed_1_name text;
  v_seed_2_name text;
  v_seed_3_name text;
  v_seed_4_name text;
  v_base_date date;
  v_first_sunday date;
  v_semis_1_id bigint;
  v_semis_2_id bigint;
  v_finals_id bigint;
  v_match_id bigint;
  i int;
begin
  if exists (
    select 1
    from public.playoff_series ps
    where ps.tournament_id = p_tournament_id
  ) then
    raise exception 'Playoffs already generated for this tournament.';
  end if;

  with seeded as (
    select
      trs.team_id,
      trs.team_name,
      trs.wins,
      row_number() over (order by trs.wins desc, trs.team_id asc) as seed
    from public.tournament_regular_standings trs
    where trs.tournament_id = p_tournament_id
  )
  select
    max(case when seed = 1 then team_id end),
    max(case when seed = 2 then team_id end),
    max(case when seed = 3 then team_id end),
    max(case when seed = 4 then team_id end),
    max(case when seed = 1 then team_name end),
    max(case when seed = 2 then team_name end),
    max(case when seed = 3 then team_name end),
    max(case when seed = 4 then team_name end)
  into
    v_seed_1_id,
    v_seed_2_id,
    v_seed_3_id,
    v_seed_4_id,
    v_seed_1_name,
    v_seed_2_name,
    v_seed_3_name,
    v_seed_4_name
  from seeded;

  if v_seed_1_id is null or v_seed_2_id is null or v_seed_3_id is null or v_seed_4_id is null then
    raise exception 'At least 4 teams are required to generate playoffs.';
  end if;

  select coalesce(max(m.match_date), current_date)
  into v_base_date
  from public.matches m
  where m.tournament_id = p_tournament_id;

  v_first_sunday := v_base_date + ((7 - extract(dow from v_base_date)::int) % 7);
  if v_first_sunday <= v_base_date then
    v_first_sunday := v_first_sunday + 7;
  end if;

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
  values (
    p_tournament_id,
    1,
    'Round 1',
    'semi_1v4',
    v_seed_1_id,
    v_seed_4_id,
    1,
    4,
    1,
    2,
    'active'
  )
  returning id into v_semis_1_id;

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
  values (
    p_tournament_id,
    1,
    'Round 1',
    'semi_2v3',
    v_seed_2_id,
    v_seed_3_id,
    2,
    3,
    2,
    2,
    'active'
  )
  returning id into v_semis_2_id;

  insert into public.playoff_series (
    tournament_id,
    round_order,
    round_name,
    matchup_key,
    team_a_id,
    team_b_id,
    target_wins_a,
    target_wins_b,
    status
  )
  values (
    p_tournament_id,
    2,
    'Finals',
    'finals',
    null,
    null,
    2,
    2,
    'pending'
  )
  returning id into v_finals_id;

  -- Semi 1 (handicap 1 vs 4): max 2 games
  for i in 1..2 loop
    insert into public.matches (
      tournament_id,
      team_a,
      team_b,
      match_date,
      match_time,
      winner_team
    )
    values (
      p_tournament_id,
      v_seed_1_name,
      v_seed_4_name,
      v_first_sunday + ((i - 1) * 7),
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
      p_tournament_id,
      v_semis_1_id,
      v_match_id,
      i,
      v_first_sunday + ((i - 1) * 7),
      '18:15',
      'scheduled'
    );
  end loop;

  -- Semi 2 (best-of-3 2 vs 3): max 3 games
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
      p_tournament_id,
      v_seed_2_name,
      v_seed_3_name,
      v_first_sunday + ((i - 1) * 7),
      '19:15',
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
      p_tournament_id,
      v_semis_2_id,
      v_match_id,
      i,
      v_first_sunday + ((i - 1) * 7),
      '19:15',
      'scheduled'
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'seriesCreated', 3,
    'gamesCreated', 5,
    'semiSeriesIds', jsonb_build_array(v_semis_1_id, v_semis_2_id),
    'finalSeriesId', v_finals_id
  );
end;
$$;

create or replace function public.sync_playoff_series_from_match(p_match_id bigint)
returns jsonb
language plpgsql
as $$
declare
  v_series_id bigint;
  v_tournament_id uuid;
  v_finals_series_id bigint;
  v_completed_semis int;
  v_winner_1 bigint;
  v_winner_2 bigint;
  v_team_a_name text;
  v_team_b_name text;
  v_last_date date;
  v_first_sunday date;
  v_match_id bigint;
  i int;
begin
  select pg.series_id, pg.tournament_id
  into v_series_id, v_tournament_id
  from public.playoff_games pg
  where pg.match_id = p_match_id;

  if v_series_id is null then
    return jsonb_build_object('ok', false, 'reason', 'match_is_not_playoff_game');
  end if;

  update public.playoff_games pg
  set status = case when m.winner_team is null then 'scheduled' else 'completed' end
  from public.matches m
  where pg.match_id = m.id
    and pg.series_id = v_series_id;

  with wins as (
    select
      ps.id as series_id,
      coalesce(sum(case when m.winner_team = ta.name then 1 else 0 end), 0)::int as wins_a,
      coalesce(sum(case when m.winner_team = tb.name then 1 else 0 end), 0)::int as wins_b
    from public.playoff_series ps
    left join public.teams ta on ta.id = ps.team_a_id
    left join public.teams tb on tb.id = ps.team_b_id
    left join public.playoff_games pg
      on pg.series_id = ps.id and pg.status <> 'cancelled'
    left join public.matches m
      on m.id = pg.match_id and m.winner_team is not null
    where ps.id = v_series_id
    group by ps.id
  )
  update public.playoff_series ps
  set
    wins_a = w.wins_a,
    wins_b = w.wins_b,
    status = case
      when w.wins_a >= ps.target_wins_a or w.wins_b >= ps.target_wins_b then 'completed'
      else 'active'
    end,
    winner_team_id = case
      when w.wins_a >= ps.target_wins_a then ps.team_a_id
      when w.wins_b >= ps.target_wins_b then ps.team_b_id
      else null
    end
  from wins w
  where ps.id = w.series_id;

  -- Cancel remaining unplayed games if the series is complete
  update public.playoff_games pg
  set status = 'cancelled'
  from public.playoff_series ps, public.matches m
  where ps.id = v_series_id
    and pg.series_id = ps.id
    and m.id = pg.match_id
    and ps.status = 'completed'
    and m.winner_team is null
    and pg.status = 'scheduled';

  -- Finals bootstrapping when both semifinals are complete
  select id
  into v_finals_series_id
  from public.playoff_series
  where tournament_id = v_tournament_id
    and round_order = 2
    and matchup_key = 'finals'
  limit 1;

  if v_finals_series_id is not null then
    select count(*)
    into v_completed_semis
    from public.playoff_series
    where tournament_id = v_tournament_id
      and round_order = 1
      and status = 'completed';

    if v_completed_semis = 2 then
      select winner_team_id into v_winner_1
      from public.playoff_series
      where tournament_id = v_tournament_id and matchup_key = 'semi_1v4';

      select winner_team_id into v_winner_2
      from public.playoff_series
      where tournament_id = v_tournament_id and matchup_key = 'semi_2v3';

      if v_winner_1 is not null and v_winner_2 is not null then
        update public.playoff_series
        set
          team_a_id = v_winner_1,
          team_b_id = v_winner_2,
          status = 'active'
        where id = v_finals_series_id;

        if not exists (
          select 1
          from public.playoff_games pg
          where pg.series_id = v_finals_series_id
        ) then
          select name into v_team_a_name from public.teams where id = v_winner_1;
          select name into v_team_b_name from public.teams where id = v_winner_2;

          select coalesce(max(coalesce(pg.scheduled_date, m.match_date)), current_date)
          into v_last_date
          from public.playoff_games pg
          join public.matches m on m.id = pg.match_id
          where pg.tournament_id = v_tournament_id;

          v_first_sunday := v_last_date + ((7 - extract(dow from v_last_date)::int) % 7);
          if v_first_sunday <= v_last_date then
            v_first_sunday := v_first_sunday + 7;
          end if;

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
              v_first_sunday + ((i - 1) * 7),
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
              v_first_sunday + ((i - 1) * 7),
              '18:15',
              'scheduled'
            );
          end loop;
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'seriesId', v_series_id,
    'tournamentId', v_tournament_id
  );
end;
$$;

grant execute on function public.generate_tournament_playoffs(uuid) to anon, authenticated;
grant execute on function public.sync_playoff_series_from_match(bigint) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5) RLS alignment with existing tournament tables
-- -----------------------------------------------------------------------------

do $$
declare
  v_matches_rls_enabled boolean;
begin
  select c.relrowsecurity
  into v_matches_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'matches';

  if coalesce(v_matches_rls_enabled, false) then
    alter table public.tournament_settings enable row level security;
    alter table public.playoff_series enable row level security;
    alter table public.playoff_games enable row level security;
  else
    alter table public.tournament_settings disable row level security;
    alter table public.playoff_series disable row level security;
    alter table public.playoff_games disable row level security;
  end if;
end $$;

commit;
