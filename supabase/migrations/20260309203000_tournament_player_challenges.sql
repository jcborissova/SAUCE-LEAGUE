begin;

create table if not exists public.tournament_player_challenges (
  id bigserial primary key,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  match_id bigint not null references public.matches(id) on delete cascade,
  player_id bigint not null references public.players(id) on delete cascade,
  team_side text,
  challenge_date date,
  archetype text not null default 'all_around'
    check (archetype in ('scorer', 'creator', 'two_way', 'rim_protector', 'all_around')),
  targets jsonb not null default '[]'::jsonb,
  baseline jsonb not null default '{}'::jsonb,
  actuals jsonb not null default '{}'::jsonb,
  success_count integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'elite', 'failed', 'not_evaluated')),
  settled boolean not null default false,
  settled_at timestamptz,
  locked boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tournament_player_challenges_match_player_unique unique (tournament_id, match_id, player_id)
);

create index if not exists idx_tournament_player_challenges_tournament_match
  on public.tournament_player_challenges (tournament_id, match_id);

create index if not exists idx_tournament_player_challenges_tournament_player
  on public.tournament_player_challenges (tournament_id, player_id);

create index if not exists idx_tournament_player_challenges_tournament_status
  on public.tournament_player_challenges (tournament_id, status);

create index if not exists idx_tournament_player_challenges_match_status
  on public.tournament_player_challenges (match_id, status);

create or replace function public.challenge_compute_valuation(
  p_points numeric,
  p_rebounds numeric,
  p_assists numeric,
  p_steals numeric,
  p_blocks numeric,
  p_turnovers numeric,
  p_fouls numeric,
  p_fgm numeric,
  p_fga numeric,
  p_ftm numeric,
  p_fta numeric,
  p_tpm numeric
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_positive numeric;
  v_negative numeric;
begin
  v_positive :=
    coalesce(p_points, 0) +
    coalesce(p_rebounds, 0) +
    coalesce(p_assists, 0) +
    coalesce(p_steals, 0) +
    coalesce(p_blocks, 0) +
    coalesce(p_fgm, 0) +
    coalesce(p_ftm, 0) +
    coalesce(p_tpm, 0);

  v_negative :=
    greatest(0, coalesce(p_fga, 0) - coalesce(p_fgm, 0)) +
    greatest(0, coalesce(p_fta, 0) - coalesce(p_ftm, 0)) +
    coalesce(p_turnovers, 0) +
    coalesce(p_fouls, 0);

  return round(v_positive - v_negative, 2);
end;
$$;

create or replace function public.challenge_metric_label(p_metric text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  return case p_metric
    when 'points' then 'Puntos'
    when 'rebounds' then 'Rebotes'
    when 'assists' then 'Asistencias'
    when 'steals' then 'Robos'
    when 'blocks' then 'Tapones'
    when 'turnovers_max' then 'Perdidas maximas'
    when 'fouls_max' then 'Faltas maximas'
    when 'valuation' then 'Valoracion'
    when 'fg_pct' then 'FG%'
    when 'ft_pct' then 'FT%'
    when 'tp_pct' then '3P%'
    when 'tpm' then 'Triples'
    else 'Reto'
  end;
end;
$$;

create or replace function public.challenge_metric_op(p_metric text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_metric in ('turnovers_max', 'fouls_max') then
    return 'lte';
  end if;

  return 'gte';
end;
$$;

drop function if exists public.challenge_metric_target(
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean
);

create or replace function public.challenge_metric_target(
  p_metric text,
  p_points numeric,
  p_rebounds numeric,
  p_assists numeric,
  p_steals numeric,
  p_blocks numeric,
  p_turnovers numeric,
  p_fouls numeric,
  p_fgm numeric,
  p_fga numeric,
  p_ftm numeric,
  p_fta numeric,
  p_tpm numeric,
  p_tpa numeric,
  p_valuation numeric,
  p_fg_pct numeric,
  p_ft_pct numeric,
  p_tp_pct numeric,
  p_low_sample boolean default false
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_target numeric := 0;
  v_low_sample_factor numeric := case when p_low_sample then 0.97 else 1 end;
begin
  case p_metric
    when 'points' then
      v_target := ceil(greatest(8, coalesce(p_points, 0) * 1.08 * v_low_sample_factor + 0.75));
    when 'rebounds' then
      v_target := ceil(greatest(3, coalesce(p_rebounds, 0) * 1.06 * v_low_sample_factor + 0.45));
    when 'assists' then
      v_target := ceil(greatest(2, coalesce(p_assists, 0) * 1.06 * v_low_sample_factor + 0.35));
    when 'steals' then
      v_target := ceil(greatest(1, coalesce(p_steals, 0) * 1.02 * v_low_sample_factor + 0.10));
    when 'blocks' then
      v_target := ceil(greatest(1, coalesce(p_blocks, 0) * 1.03 * v_low_sample_factor + 0.08));
    when 'turnovers_max' then
      v_target := floor(
        greatest(
          1,
          least(
            7,
            coalesce(p_turnovers, 0) * 1.08 +
              case when coalesce(p_assists, 0) >= 5 then 0.65 else 0.45 end
          )
        )
      );
    when 'fouls_max' then
      v_target := floor(greatest(1, least(5, coalesce(p_fouls, 0) * 1.08 + 0.45)));
    when 'fg_pct' then
      v_target := round(
        greatest(
          35,
          least(
            80,
            coalesce(p_fg_pct, 0) * (case when p_low_sample then 0.99 else 1.02 end) +
              case when coalesce(p_fga, 0) >= 10 then 1.5 else 0.8 end
          )
        )
      );
    when 'ft_pct' then
      v_target := round(
        greatest(
          58,
          least(
            95,
            coalesce(p_ft_pct, 0) * (case when p_low_sample then 0.99 else 1.01 end) + 1.2
          )
        )
      );
    when 'tp_pct' then
      v_target := round(
        greatest(
          24,
          least(
            70,
            coalesce(p_tp_pct, 0) * (case when p_low_sample then 0.98 else 1.03 end) +
              case when coalesce(p_tpa, 0) >= 6 then 1.8 else 1.1 end
          )
        )
      );
    when 'tpm' then
      v_target := ceil(greatest(1, coalesce(p_tpm, 0) * 1.10 * v_low_sample_factor + 0.2));
    when 'valuation' then
      v_target := ceil(greatest(8, coalesce(p_valuation, 0) * 1.06 * v_low_sample_factor + 0.95));
    else
      v_target := ceil(greatest(1, coalesce(p_points, 0)));
  end case;

  return greatest(0, v_target::int);
end;
$$;

create or replace function public.challenge_metric_value(
  p_metric text,
  p_points numeric,
  p_rebounds numeric,
  p_assists numeric,
  p_steals numeric,
  p_blocks numeric,
  p_turnovers numeric,
  p_fouls numeric,
  p_tpm numeric,
  p_fg_pct numeric,
  p_ft_pct numeric,
  p_tp_pct numeric,
  p_valuation numeric
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
begin
  return case p_metric
    when 'points' then coalesce(p_points, 0)
    when 'rebounds' then coalesce(p_rebounds, 0)
    when 'assists' then coalesce(p_assists, 0)
    when 'steals' then coalesce(p_steals, 0)
    when 'blocks' then coalesce(p_blocks, 0)
    when 'turnovers_max' then coalesce(p_turnovers, 0)
    when 'fouls_max' then coalesce(p_fouls, 0)
    when 'tpm' then coalesce(p_tpm, 0)
    when 'fg_pct' then coalesce(p_fg_pct, 0)
    when 'ft_pct' then coalesce(p_ft_pct, 0)
    when 'tp_pct' then coalesce(p_tp_pct, 0)
    when 'valuation' then coalesce(p_valuation, 0)
    else coalesce(p_points, 0)
  end;
end;
$$;

create or replace function public.challenge_adjust_target_for_consistency(
  p_metric text,
  p_target integer,
  p_avg numeric,
  p_stddev numeric,
  p_low_sample boolean default false
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
declare
  v_target integer := greatest(0, coalesce(p_target, 0));
  v_avg numeric := greatest(abs(coalesce(p_avg, 0)), 0.0001);
  v_stddev numeric := abs(coalesce(p_stddev, 0));
  v_cv numeric := 0;
  v_adjust integer := 0;
begin
  if p_low_sample then
    return v_target;
  end if;

  v_cv := v_stddev / v_avg;

  if v_cv <= 0.22 then
    v_adjust := 1;
  elsif v_cv >= 0.58 then
    v_adjust := -1;
  end if;

  if p_metric in ('turnovers_max', 'fouls_max') then
    v_target := v_target - v_adjust;
  else
    v_target := v_target + v_adjust;
  end if;

  v_target := case p_metric
    when 'turnovers_max' then greatest(1, least(8, v_target))
    when 'fouls_max' then greatest(1, least(6, v_target))
    when 'fg_pct' then greatest(30, least(90, v_target))
    when 'ft_pct' then greatest(50, least(99, v_target))
    when 'tp_pct' then greatest(20, least(80, v_target))
    when 'tpm' then greatest(1, least(12, v_target))
    else greatest(1, least(80, v_target))
  end;

  return v_target;
end;
$$;

create or replace function public.generate_player_match_challenge(
  p_tournament_id uuid,
  p_match_id bigint,
  p_player_id bigint,
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match record;
  v_existing record;
  v_sample_size integer := 0;
  v_low_sample boolean := false;
  v_points numeric := 0;
  v_rebounds numeric := 0;
  v_assists numeric := 0;
  v_steals numeric := 0;
  v_blocks numeric := 0;
  v_turnovers numeric := 0;
  v_fouls numeric := 0;
  v_fgm numeric := 0;
  v_fga numeric := 0;
  v_ftm numeric := 0;
  v_fta numeric := 0;
  v_tpm numeric := 0;
  v_tpa numeric := 0;
  v_fg_pct numeric := 0;
  v_ft_pct numeric := 0;
  v_tp_pct numeric := 0;
  v_sd_points numeric := 0;
  v_sd_rebounds numeric := 0;
  v_sd_assists numeric := 0;
  v_sd_steals numeric := 0;
  v_sd_blocks numeric := 0;
  v_sd_turnovers numeric := 0;
  v_sd_fouls numeric := 0;
  v_sd_tpm numeric := 0;
  v_sd_fg_pct numeric := 0;
  v_sd_ft_pct numeric := 0;
  v_sd_tp_pct numeric := 0;
  v_sd_valuation numeric := 0;
  v_valuation numeric := 0;
  v_archetype text := 'all_around';
  v_metric_1 text := 'points';
  v_metric_2 text := 'rebounds';
  v_metric_3 text := 'assists';
  v_target_1 integer := 0;
  v_target_2 integer := 0;
  v_target_3 integer := 0;
  v_baseline jsonb;
  v_targets jsonb;
begin
  if p_tournament_id is null or p_match_id is null or p_player_id is null then
    return;
  end if;

  select
    m.id,
    m.tournament_id,
    m.match_date,
    m.match_time,
    mp.team as team_side
  into v_match
  from public.matches m
  left join public.match_players mp
    on mp.match_id = m.id
   and mp.player_id = p_player_id
  where m.id = p_match_id
    and m.tournament_id = p_tournament_id
  limit 1;

  if v_match.id is null then
    return;
  end if;

  select id, locked
  into v_existing
  from public.tournament_player_challenges
  where tournament_id = p_tournament_id
    and match_id = p_match_id
    and player_id = p_player_id;

  if v_existing.id is not null and not p_force then
    return;
  end if;

  with previous_games as (
    select
      eps.points::numeric as points,
      eps.rebounds::numeric as rebounds,
      eps.assists::numeric as assists,
      eps.steals::numeric as steals,
      eps.blocks::numeric as blocks,
      eps.turnovers::numeric as turnovers,
      eps.fouls::numeric as fouls,
      eps.fgm::numeric as fgm,
      eps.fga::numeric as fga,
      eps.ftm::numeric as ftm,
      eps.fta::numeric as fta,
      eps.tpm::numeric as tpm,
      eps.tpa::numeric as tpa,
      case
        when coalesce(eps.fga, 0) > 0 then round((eps.fgm::numeric / eps.fga::numeric) * 100, 2)
        else 0
      end as fg_pct,
      case
        when coalesce(eps.fta, 0) > 0 then round((eps.ftm::numeric / eps.fta::numeric) * 100, 2)
        else 0
      end as ft_pct,
      case
        when coalesce(eps.tpa, 0) > 0 then round((eps.tpm::numeric / eps.tpa::numeric) * 100, 2)
        else 0
      end as tp_pct,
      public.challenge_compute_valuation(
        eps.points,
        eps.rebounds,
        eps.assists,
        eps.steals,
        eps.blocks,
        eps.turnovers,
        eps.fouls,
        eps.fgm,
        eps.fga,
        eps.ftm,
        eps.fta,
        eps.tpm
      ) as valuation
    from public.tournament_player_stats_enriched eps
    join public.matches pm
      on pm.id = eps.match_id
    where eps.tournament_id = p_tournament_id
      and eps.player_id = p_player_id
      and (
        coalesce(pm.match_date, '9999-12-31'::date) < coalesce(v_match.match_date, '9999-12-31'::date)
        or (
          coalesce(pm.match_date, '9999-12-31'::date) = coalesce(v_match.match_date, '9999-12-31'::date)
          and coalesce(pm.match_time, '23:59:59'::time) < coalesce(v_match.match_time, '23:59:59'::time)
        )
        or (
          coalesce(pm.match_date, '9999-12-31'::date) = coalesce(v_match.match_date, '9999-12-31'::date)
          and coalesce(pm.match_time, '23:59:59'::time) = coalesce(v_match.match_time, '23:59:59'::time)
          and pm.id < p_match_id
        )
      )
    order by pm.match_date desc nulls last, pm.match_time desc nulls last, pm.id desc
    limit 5
  )
  select
    count(*)::int,
    round(coalesce(avg(points), 0), 2),
    round(coalesce(avg(rebounds), 0), 2),
    round(coalesce(avg(assists), 0), 2),
    round(coalesce(avg(steals), 0), 2),
    round(coalesce(avg(blocks), 0), 2),
    round(coalesce(avg(turnovers), 0), 2),
    round(coalesce(avg(fouls), 0), 2),
    round(coalesce(avg(fgm), 0), 2),
    round(coalesce(avg(fga), 0), 2),
    round(coalesce(avg(ftm), 0), 2),
    round(coalesce(avg(fta), 0), 2),
    round(coalesce(avg(tpm), 0), 2),
    round(coalesce(avg(tpa), 0), 2),
    round(coalesce(avg(fg_pct), 0), 2),
    round(coalesce(avg(ft_pct), 0), 2),
    round(coalesce(avg(tp_pct), 0), 2),
    round(coalesce(stddev_samp(points), 0), 2),
    round(coalesce(stddev_samp(rebounds), 0), 2),
    round(coalesce(stddev_samp(assists), 0), 2),
    round(coalesce(stddev_samp(steals), 0), 2),
    round(coalesce(stddev_samp(blocks), 0), 2),
    round(coalesce(stddev_samp(turnovers), 0), 2),
    round(coalesce(stddev_samp(fouls), 0), 2),
    round(coalesce(stddev_samp(tpm), 0), 2),
    round(coalesce(stddev_samp(fg_pct), 0), 2),
    round(coalesce(stddev_samp(ft_pct), 0), 2),
    round(coalesce(stddev_samp(tp_pct), 0), 2),
    round(coalesce(stddev_samp(valuation), 0), 2),
    round(coalesce(avg(valuation), 0), 2)
  into
    v_sample_size,
    v_points,
    v_rebounds,
    v_assists,
    v_steals,
    v_blocks,
    v_turnovers,
    v_fouls,
    v_fgm,
    v_fga,
    v_ftm,
    v_fta,
    v_tpm,
    v_tpa,
    v_fg_pct,
    v_ft_pct,
    v_tp_pct,
    v_sd_points,
    v_sd_rebounds,
    v_sd_assists,
    v_sd_steals,
    v_sd_blocks,
    v_sd_turnovers,
    v_sd_fouls,
    v_sd_tpm,
    v_sd_fg_pct,
    v_sd_ft_pct,
    v_sd_tp_pct,
    v_sd_valuation,
    v_valuation
  from previous_games;

  v_low_sample := v_sample_size < 3;

  if v_sample_size = 0 then
    v_points := 8;
    v_rebounds := 3;
    v_assists := 2;
    v_steals := 1;
    v_blocks := 1;
    v_turnovers := 2;
    v_fouls := 2;
    v_fgm := 3;
    v_fga := 8;
    v_ftm := 2;
    v_fta := 3;
    v_tpm := 1;
    v_tpa := 3;
    v_fg_pct := 45;
    v_ft_pct := 70;
    v_tp_pct := 33;
    v_sd_points := 2.8;
    v_sd_rebounds := 1.4;
    v_sd_assists := 1.2;
    v_sd_steals := 0.6;
    v_sd_blocks := 0.6;
    v_sd_turnovers := 1.1;
    v_sd_fouls := 1.0;
    v_sd_tpm := 0.9;
    v_sd_fg_pct := 7;
    v_sd_ft_pct := 8;
    v_sd_tp_pct := 10;
    v_sd_valuation := 4.5;
    v_valuation := 8;
  end if;

  if v_blocks >= 1.3 then
    v_archetype := 'rim_protector';
  elsif v_assists >= 5 then
    v_archetype := 'creator';
  elsif v_points >= 14 and (v_steals + v_blocks) >= 1.8 then
    v_archetype := 'two_way';
  elsif v_points >= 12 then
    v_archetype := 'scorer';
  else
    v_archetype := 'all_around';
  end if;

  case v_archetype
    when 'scorer' then
      v_metric_1 := 'points';
      v_metric_2 := case
        when v_tpa >= 5 then 'tpm'
        when v_tpa >= 3 then 'tp_pct'
        else 'fg_pct'
      end;
      v_metric_3 := case
        when v_fta >= 4 then 'ft_pct'
        else 'valuation'
      end;
    when 'creator' then
      v_metric_1 := 'assists';
      v_metric_2 := 'turnovers_max';
      v_metric_3 := case
        when v_fga >= 7 then 'fg_pct'
        else 'valuation'
      end;
    when 'two_way' then
      v_metric_1 := 'points';
      v_metric_2 := case
        when v_steals >= v_blocks then 'steals'
        else 'blocks'
      end;
      v_metric_3 := case
        when v_fouls >= 2.8 then 'fouls_max'
        else 'valuation'
      end;
    when 'rim_protector' then
      v_metric_1 := 'rebounds';
      v_metric_2 := 'blocks';
      v_metric_3 := case
        when v_fouls >= 2.6 then 'fouls_max'
        else 'valuation'
      end;
    else
      v_metric_1 := 'valuation';
      v_metric_2 := case
        when v_assists >= 4 then 'assists'
        else 'rebounds'
      end;
      v_metric_3 := case
        when v_fga >= 8 then 'fg_pct'
        else 'turnovers_max'
      end;
  end case;

  v_target_1 := public.challenge_metric_target(
    v_metric_1,
    v_points,
    v_rebounds,
    v_assists,
    v_steals,
    v_blocks,
    v_turnovers,
    v_fouls,
    v_fgm,
    v_fga,
    v_ftm,
    v_fta,
    v_tpm,
    v_tpa,
    v_valuation,
    v_fg_pct,
    v_ft_pct,
    v_tp_pct,
    v_low_sample
  );
  v_target_1 := public.challenge_adjust_target_for_consistency(
    v_metric_1,
    v_target_1,
    public.challenge_metric_value(
      v_metric_1,
      v_points,
      v_rebounds,
      v_assists,
      v_steals,
      v_blocks,
      v_turnovers,
      v_fouls,
      v_tpm,
      v_fg_pct,
      v_ft_pct,
      v_tp_pct,
      v_valuation
    ),
    public.challenge_metric_value(
      v_metric_1,
      v_sd_points,
      v_sd_rebounds,
      v_sd_assists,
      v_sd_steals,
      v_sd_blocks,
      v_sd_turnovers,
      v_sd_fouls,
      v_sd_tpm,
      v_sd_fg_pct,
      v_sd_ft_pct,
      v_sd_tp_pct,
      v_sd_valuation
    ),
    v_low_sample
  );
  v_target_2 := public.challenge_metric_target(
    v_metric_2,
    v_points,
    v_rebounds,
    v_assists,
    v_steals,
    v_blocks,
    v_turnovers,
    v_fouls,
    v_fgm,
    v_fga,
    v_ftm,
    v_fta,
    v_tpm,
    v_tpa,
    v_valuation,
    v_fg_pct,
    v_ft_pct,
    v_tp_pct,
    v_low_sample
  );
  v_target_2 := public.challenge_adjust_target_for_consistency(
    v_metric_2,
    v_target_2,
    public.challenge_metric_value(
      v_metric_2,
      v_points,
      v_rebounds,
      v_assists,
      v_steals,
      v_blocks,
      v_turnovers,
      v_fouls,
      v_tpm,
      v_fg_pct,
      v_ft_pct,
      v_tp_pct,
      v_valuation
    ),
    public.challenge_metric_value(
      v_metric_2,
      v_sd_points,
      v_sd_rebounds,
      v_sd_assists,
      v_sd_steals,
      v_sd_blocks,
      v_sd_turnovers,
      v_sd_fouls,
      v_sd_tpm,
      v_sd_fg_pct,
      v_sd_ft_pct,
      v_sd_tp_pct,
      v_sd_valuation
    ),
    v_low_sample
  );
  v_target_3 := public.challenge_metric_target(
    v_metric_3,
    v_points,
    v_rebounds,
    v_assists,
    v_steals,
    v_blocks,
    v_turnovers,
    v_fouls,
    v_fgm,
    v_fga,
    v_ftm,
    v_fta,
    v_tpm,
    v_tpa,
    v_valuation,
    v_fg_pct,
    v_ft_pct,
    v_tp_pct,
    v_low_sample
  );
  v_target_3 := public.challenge_adjust_target_for_consistency(
    v_metric_3,
    v_target_3,
    public.challenge_metric_value(
      v_metric_3,
      v_points,
      v_rebounds,
      v_assists,
      v_steals,
      v_blocks,
      v_turnovers,
      v_fouls,
      v_tpm,
      v_fg_pct,
      v_ft_pct,
      v_tp_pct,
      v_valuation
    ),
    public.challenge_metric_value(
      v_metric_3,
      v_sd_points,
      v_sd_rebounds,
      v_sd_assists,
      v_sd_steals,
      v_sd_blocks,
      v_sd_turnovers,
      v_sd_fouls,
      v_sd_tpm,
      v_sd_fg_pct,
      v_sd_ft_pct,
      v_sd_tp_pct,
      v_sd_valuation
    ),
    v_low_sample
  );

  v_baseline := jsonb_build_object(
    'sampleSize', v_sample_size,
    'lowSample', v_low_sample,
    'points', v_points,
    'rebounds', v_rebounds,
    'assists', v_assists,
    'steals', v_steals,
    'blocks', v_blocks,
    'turnovers', v_turnovers,
    'fouls', v_fouls,
    'fgm', v_fgm,
    'fga', v_fga,
    'fgPct', v_fg_pct,
    'ftm', v_ftm,
    'fta', v_fta,
    'ftPct', v_ft_pct,
    'tpm', v_tpm,
    'tpa', v_tpa,
    'tpPct', v_tp_pct,
    'pointsStddev', v_sd_points,
    'reboundsStddev', v_sd_rebounds,
    'assistsStddev', v_sd_assists,
    'stealsStddev', v_sd_steals,
    'blocksStddev', v_sd_blocks,
    'turnoversStddev', v_sd_turnovers,
    'foulsStddev', v_sd_fouls,
    'tpmStddev', v_sd_tpm,
    'fgPctStddev', v_sd_fg_pct,
    'ftPctStddev', v_sd_ft_pct,
    'tpPctStddev', v_sd_tp_pct,
    'valuationStddev', v_sd_valuation,
    'valuation', v_valuation
  );

  v_targets := jsonb_build_array(
    jsonb_build_object(
      'metric', v_metric_1,
      'label', public.challenge_metric_label(v_metric_1),
      'op', public.challenge_metric_op(v_metric_1),
      'target', v_target_1,
      'actual', null,
      'hit', null
    ),
    jsonb_build_object(
      'metric', v_metric_2,
      'label', public.challenge_metric_label(v_metric_2),
      'op', public.challenge_metric_op(v_metric_2),
      'target', v_target_2,
      'actual', null,
      'hit', null
    ),
    jsonb_build_object(
      'metric', v_metric_3,
      'label', public.challenge_metric_label(v_metric_3),
      'op', public.challenge_metric_op(v_metric_3),
      'target', v_target_3,
      'actual', null,
      'hit', null
    )
  );

  if v_existing.id is null then
    insert into public.tournament_player_challenges (
      tournament_id,
      match_id,
      player_id,
      team_side,
      challenge_date,
      archetype,
      targets,
      baseline,
      actuals,
      success_count,
      status,
      settled,
      settled_at,
      locked,
      version
    )
    values (
      p_tournament_id,
      p_match_id,
      p_player_id,
      case when v_match.team_side in ('A', 'B') then v_match.team_side else null end,
      v_match.match_date,
      v_archetype,
      v_targets,
      v_baseline,
      '{}'::jsonb,
      0,
      'pending',
      false,
      null,
      true,
      1
    );
  else
    update public.tournament_player_challenges
    set
      team_side = case when v_match.team_side in ('A', 'B') then v_match.team_side else team_side end,
      challenge_date = v_match.match_date,
      archetype = v_archetype,
      targets = v_targets,
      baseline = v_baseline,
      actuals = '{}'::jsonb,
      success_count = 0,
      status = 'pending',
      settled = false,
      settled_at = null,
      locked = true,
      version = version + 1,
      updated_at = timezone('utc', now())
    where id = v_existing.id;
  end if;
end;
$$;

create or replace function public.generate_match_challenges(
  p_match_id bigint,
  p_force boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_player_id bigint;
  v_count integer := 0;
begin
  if p_match_id is null then
    return 0;
  end if;

  select m.tournament_id
  into v_tournament_id
  from public.matches m
  where m.id = p_match_id;

  if v_tournament_id is null then
    return 0;
  end if;

  for v_player_id in
    select mp.player_id
    from public.match_players mp
    where mp.match_id = p_match_id
      and mp.player_id is not null
  loop
    perform public.generate_player_match_challenge(v_tournament_id, p_match_id, v_player_id, p_force);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.generate_tournament_challenges(
  p_tournament_id uuid,
  p_force boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id bigint;
  v_total integer := 0;
begin
  if p_tournament_id is null then
    return 0;
  end if;

  for v_match_id in
    select distinct m.id
    from public.matches m
    join public.match_players mp
      on mp.match_id = m.id
    where m.tournament_id = p_tournament_id
    order by m.id
  loop
    v_total := v_total + coalesce(public.generate_match_challenges(v_match_id, p_force), 0);
  end loop;

  return v_total;
end;
$$;

create or replace function public.settle_match_challenges(
  p_match_id bigint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_target jsonb;
  v_new_targets jsonb;
  v_status text;
  v_success_count integer;
  v_updated integer := 0;
  v_target_number numeric;
  v_metric text;
  v_op text;
  v_hit boolean;
  v_played boolean;
  v_has_stats boolean;
  v_points numeric;
  v_rebounds numeric;
  v_assists numeric;
  v_steals numeric;
  v_blocks numeric;
  v_turnovers numeric;
  v_fouls numeric;
  v_fgm numeric;
  v_fga numeric;
  v_ftm numeric;
  v_fta numeric;
  v_tpm numeric;
  v_tpa numeric;
  v_fg_pct numeric;
  v_ft_pct numeric;
  v_tp_pct numeric;
  v_valuation numeric;
  v_actual_metric numeric;
  v_actuals jsonb;
begin
  if p_match_id is null then
    return 0;
  end if;

  for v_row in
    select c.id, c.player_id, c.targets
    from public.tournament_player_challenges c
    where c.match_id = p_match_id
  loop
    select
      coalesce(mp.played, false),
      ps.player_id is not null,
      coalesce(ps.points, 0)::numeric,
      coalesce(ps.rebounds, 0)::numeric,
      coalesce(ps.assists, 0)::numeric,
      coalesce(ps.steals, 0)::numeric,
      coalesce(ps.blocks, 0)::numeric,
      coalesce(ps.turnovers, 0)::numeric,
      coalesce(ps.fouls, 0)::numeric,
      coalesce(ps.fgm, 0)::numeric,
      coalesce(ps.fga, 0)::numeric,
      coalesce(ps.ftm, 0)::numeric,
      coalesce(ps.fta, 0)::numeric,
      coalesce(ps.tpm, 0)::numeric,
      coalesce(ps.tpa, 0)::numeric
    into
      v_played,
      v_has_stats,
      v_points,
      v_rebounds,
      v_assists,
      v_steals,
      v_blocks,
      v_turnovers,
      v_fouls,
      v_fgm,
      v_fga,
      v_ftm,
      v_fta,
      v_tpm,
      v_tpa
    from public.match_players mp
    left join public.player_stats ps
      on ps.match_id = mp.match_id
     and ps.player_id = mp.player_id
    where mp.match_id = p_match_id
      and mp.player_id = v_row.player_id
    limit 1;

    if not coalesce(v_played, false) or not coalesce(v_has_stats, false) then
      v_new_targets := '[]'::jsonb;
      for v_target in
        select value
        from jsonb_array_elements(coalesce(v_row.targets, '[]'::jsonb))
      loop
        v_new_targets := v_new_targets || jsonb_build_array(
          v_target || jsonb_build_object('actual', null, 'hit', null)
        );
      end loop;

      update public.tournament_player_challenges
      set
        targets = v_new_targets,
        actuals = jsonb_build_object('played', false),
        success_count = 0,
        status = 'not_evaluated',
        settled = true,
        settled_at = timezone('utc', now()),
        version = version + 1,
        updated_at = timezone('utc', now())
      where id = v_row.id;

      v_updated := v_updated + 1;
      continue;
    end if;

    v_fg_pct := case
      when v_fga > 0 then round((v_fgm / v_fga) * 100, 2)
      else 0
    end;
    v_ft_pct := case
      when v_fta > 0 then round((v_ftm / v_fta) * 100, 2)
      else 0
    end;
    v_tp_pct := case
      when v_tpa > 0 then round((v_tpm / v_tpa) * 100, 2)
      else 0
    end;

    v_valuation := public.challenge_compute_valuation(
      v_points,
      v_rebounds,
      v_assists,
      v_steals,
      v_blocks,
      v_turnovers,
      v_fouls,
      v_fgm,
      v_fga,
      v_ftm,
      v_fta,
      v_tpm
    );

    v_actuals := jsonb_build_object(
      'played', true,
      'points', v_points,
      'rebounds', v_rebounds,
      'assists', v_assists,
      'steals', v_steals,
      'blocks', v_blocks,
      'turnovers', v_turnovers,
      'fouls', v_fouls,
      'fgm', v_fgm,
      'fga', v_fga,
      'fgPct', v_fg_pct,
      'ftm', v_ftm,
      'fta', v_fta,
      'ftPct', v_ft_pct,
      'tpm', v_tpm,
      'tpa', v_tpa,
      'tpPct', v_tp_pct,
      'valuation', v_valuation
    );

    v_new_targets := '[]'::jsonb;
    v_success_count := 0;

    for v_target in
      select value
      from jsonb_array_elements(coalesce(v_row.targets, '[]'::jsonb))
    loop
      v_metric := coalesce(v_target->>'metric', '');
      v_op := coalesce(v_target->>'op', public.challenge_metric_op(v_metric));

      if coalesce(v_target->>'target', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' then
        v_target_number := (v_target->>'target')::numeric;
      else
        v_target_number := 0;
      end if;

      v_actual_metric := case v_metric
        when 'points' then v_points
        when 'rebounds' then v_rebounds
        when 'assists' then v_assists
        when 'steals' then v_steals
        when 'blocks' then v_blocks
        when 'turnovers_max' then v_turnovers
        when 'fouls_max' then v_fouls
        when 'fg_pct' then v_fg_pct
        when 'ft_pct' then v_ft_pct
        when 'tp_pct' then v_tp_pct
        when 'tpm' then v_tpm
        when 'valuation' then v_valuation
        else 0
      end;

      if v_op = 'lte' then
        v_hit := v_actual_metric <= v_target_number;
      else
        v_hit := v_actual_metric >= v_target_number;
      end if;

      if v_hit then
        v_success_count := v_success_count + 1;
      end if;

      v_new_targets := v_new_targets || jsonb_build_array(
        v_target || jsonb_build_object(
          'actual', round(v_actual_metric, 2),
          'hit', v_hit
        )
      );
    end loop;

    if v_success_count >= 3 then
      v_status := 'elite';
    elsif v_success_count >= 2 then
      v_status := 'completed';
    else
      v_status := 'failed';
    end if;

    update public.tournament_player_challenges
    set
      targets = v_new_targets,
      actuals = v_actuals,
      success_count = v_success_count,
      status = v_status,
      settled = true,
      settled_at = timezone('utc', now()),
      version = version + 1,
      updated_at = timezone('utc', now())
    where id = v_row.id;

    v_updated := v_updated + 1;
  end loop;

  return v_updated;
end;
$$;

create or replace function public.tournament_player_challenges_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_tournament_player_challenges_set_updated_at on public.tournament_player_challenges;

create trigger trg_tournament_player_challenges_set_updated_at
before update on public.tournament_player_challenges
for each row execute function public.tournament_player_challenges_set_updated_at();

create or replace function public.trg_generate_challenge_from_match_players()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_old_tournament_id uuid;
begin
  if tg_op = 'UPDATE'
     and (
       new.match_id is distinct from old.match_id
       or new.player_id is distinct from old.player_id
     ) then
    select m.tournament_id
    into v_old_tournament_id
    from public.matches m
    where m.id = old.match_id;

    if v_old_tournament_id is not null then
      delete from public.tournament_player_challenges
      where tournament_id = v_old_tournament_id
        and match_id = old.match_id
        and player_id = old.player_id;
    end if;
  end if;

  select m.tournament_id
  into v_tournament_id
  from public.matches m
  where m.id = new.match_id;

  if v_tournament_id is not null and new.player_id is not null then
    perform public.generate_player_match_challenge(
      v_tournament_id,
      new.match_id,
      new.player_id,
      false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_generate_challenge_from_match_players on public.match_players;

create trigger trg_generate_challenge_from_match_players
after insert or update on public.match_players
for each row execute function public.trg_generate_challenge_from_match_players();

create or replace function public.trg_generate_challenges_from_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.generate_match_challenges(new.id, false);
  return new;
end;
$$;

drop trigger if exists trg_generate_challenges_from_matches on public.matches;

create trigger trg_generate_challenges_from_matches
after insert on public.matches
for each row execute function public.trg_generate_challenges_from_matches();

create or replace function public.trg_settle_challenges_from_player_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.settle_match_challenges(old.match_id);
    return old;
  end if;

  perform public.settle_match_challenges(new.match_id);

  if tg_op = 'UPDATE' and new.match_id is distinct from old.match_id then
    perform public.settle_match_challenges(old.match_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_settle_challenges_from_player_stats on public.player_stats;

create trigger trg_settle_challenges_from_player_stats
after insert or update or delete on public.player_stats
for each row execute function public.trg_settle_challenges_from_player_stats();

create or replace function public.trg_settle_challenges_from_match_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.settle_match_challenges(new.id);
  return new;
end;
$$;

drop trigger if exists trg_settle_challenges_from_match_result on public.matches;

create trigger trg_settle_challenges_from_match_result
after update of winner_team on public.matches
for each row
when (old.winner_team is distinct from new.winner_team)
execute function public.trg_settle_challenges_from_match_result();

grant select on table public.tournament_player_challenges to anon, authenticated;
grant execute on function public.generate_tournament_challenges(uuid, boolean) to anon, authenticated;

revoke all on function public.challenge_compute_valuation(numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public;
revoke all on function public.challenge_metric_label(text) from public;
revoke all on function public.challenge_metric_op(text) from public;
revoke all on function public.challenge_metric_value(text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public;
revoke all on function public.challenge_adjust_target_for_consistency(text, integer, numeric, numeric, boolean) from public;
revoke all on function public.challenge_metric_target(
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  boolean
) from public;
revoke all on function public.generate_player_match_challenge(uuid, bigint, bigint, boolean) from public;
revoke all on function public.generate_match_challenges(bigint, boolean) from public;
revoke all on function public.settle_match_challenges(bigint) from public;
revoke all on function public.trg_generate_challenge_from_match_players() from public;
revoke all on function public.trg_generate_challenges_from_matches() from public;
revoke all on function public.trg_settle_challenges_from_player_stats() from public;
revoke all on function public.trg_settle_challenges_from_match_result() from public;
revoke all on function public.tournament_player_challenges_set_updated_at() from public;

do $$
declare
  v_tournament_id uuid;
  v_matches_rls_enabled boolean;
begin
  for v_tournament_id in
    select t.id
    from public.tournaments t
  loop
    perform public.generate_tournament_challenges(v_tournament_id, false);
  end loop;

  select c.relrowsecurity
  into v_matches_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'matches';

  if coalesce(v_matches_rls_enabled, false) then
    alter table public.tournament_player_challenges enable row level security;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'tournament_player_challenges'
        and policyname = 'tournament_player_challenges_select_all'
    ) then
      create policy tournament_player_challenges_select_all
      on public.tournament_player_challenges
      for select
      to anon, authenticated
      using (true);
    end if;
  else
    alter table public.tournament_player_challenges disable row level security;
  end if;
end;
$$;

commit;
