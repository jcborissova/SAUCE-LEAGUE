begin;

create or replace view public.tournament_regular_standings as
with regular_matches as (
  select ms.*
  from public.tournament_match_scoreboard ms
  left join public.playoff_games pg on pg.match_id = ms.match_id
  where pg.id is null
    and ms.winner_team is not null
)
select
  t.tournament_id,
  t.id as team_id,
  t.name as team_name,
  count(rm.match_id) filter (where rm.team_a = t.name or rm.team_b = t.name) as games_played,
  count(rm.match_id) filter (where rm.winner_team = t.name) as wins,
  count(rm.match_id) filter (
    where (rm.team_a = t.name or rm.team_b = t.name)
      and rm.winner_team is distinct from t.name
  ) as losses,
  case
    when count(rm.match_id) filter (where rm.team_a = t.name or rm.team_b = t.name) = 0 then 0
    else round(
      count(rm.match_id) filter (where rm.winner_team = t.name)::numeric
      / count(rm.match_id) filter (where rm.team_a = t.name or rm.team_b = t.name)::numeric,
      4
    )
  end as win_pct,
  (
    (
      (count(rm.match_id) filter (where rm.winner_team = t.name)) * 2
      + count(rm.match_id) filter (
          where (rm.team_a = t.name or rm.team_b = t.name)
            and rm.winner_team is distinct from t.name
        )
    )
  )::bigint as classification_points,
  coalesce(
    sum(
      case
        when rm.team_a = t.name then rm.team_a_points
        when rm.team_b = t.name then rm.team_b_points
        else 0
      end
    ),
    0
  )::bigint as points_for,
  coalesce(
    sum(
      case
        when rm.team_a = t.name then rm.team_b_points
        when rm.team_b = t.name then rm.team_a_points
        else 0
      end
    ),
    0
  )::bigint as points_against,
  (
    coalesce(
      sum(
        case
          when rm.team_a = t.name then rm.team_a_points
          when rm.team_b = t.name then rm.team_b_points
          else 0
        end
      ),
      0
    )
    -
    coalesce(
      sum(
        case
          when rm.team_a = t.name then rm.team_b_points
          when rm.team_b = t.name then rm.team_a_points
          else 0
        end
      ),
      0
    )
  )::bigint as point_diff
from public.teams t
left join regular_matches rm
  on rm.tournament_id = t.tournament_id
group by t.tournament_id, t.id, t.name;

create or replace function public.resolve_tournament_tie_group_fiba(
  p_tournament_id uuid,
  p_team_names text[],
  p_classification_points bigint
)
returns table(
  team_name text,
  tie_break_criterion text,
  tie_break_explanation text,
  sort_order integer
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_team_count integer;
  v_ordered text[] := '{}'::text[];
  v_criteria text[] := '{}'::text[];
  v_explanations text[] := '{}'::text[];
  v_bucket_count integer;
  v_bucket record;
  v_sub record;
  v_criterion text;
  v_complete_scores boolean;
  v_label text;
begin
  select coalesce(array_agg(team_name order by lower(team_name), team_name), '{}'::text[])
  into p_team_names
  from (
    select distinct trim(value) as team_name
    from unnest(coalesce(p_team_names, '{}'::text[])) as value
    where value is not null
      and trim(value) <> ''
  ) normalized;

  v_team_count := coalesce(array_length(p_team_names, 1), 0);

  if v_team_count = 0 then
    return;
  end if;

  if v_team_count = 1 then
    return query
    select
      p_team_names[1]::text,
      'none'::text,
      'Sin desempate: mejor récord general en el grupo.'::text,
      1::integer;
    return;
  end if;

  foreach v_criterion in array array[
    'h2h_record',
    'h2h_point_diff',
    'h2h_points_scored',
    'overall_point_diff',
    'overall_points_scored'
  ]
  loop
    if v_criterion in ('h2h_point_diff', 'h2h_points_scored') then
      select coalesce(count(*) > 0 and bool_and(ms.has_stats), false)
      into v_complete_scores
      from public.tournament_match_scoreboard ms
      left join public.playoff_games pg on pg.match_id = ms.match_id
      where ms.tournament_id = p_tournament_id
        and pg.id is null
        and ms.winner_team is not null
        and ms.team_a = any(p_team_names)
        and ms.team_b = any(p_team_names);

      if not coalesce(v_complete_scores, false) then
        continue;
      end if;
    end if;

    with teams_in_group as (
      select unnest(p_team_names)::text as team_name
    ),
    regular_matches as (
      select ms.*
      from public.tournament_match_scoreboard ms
      left join public.playoff_games pg on pg.match_id = ms.match_id
      where ms.tournament_id = p_tournament_id
        and pg.id is null
        and ms.winner_team is not null
    ),
    h2h_matches as (
      select rm.*
      from regular_matches rm
      where rm.team_a = any(p_team_names)
        and rm.team_b = any(p_team_names)
    ),
    h2h_raw as (
      select
        u.team_name,
        count(*)::int as games,
        count(*) filter (where u.winner_team = u.team_name)::int as wins,
        count(*) filter (where u.winner_team is not null and u.winner_team <> u.team_name)::int as losses,
        coalesce(sum(u.points_for), 0)::int as points_for,
        coalesce(sum(u.points_against), 0)::int as points_against
      from (
        select hm.team_a as team_name, hm.winner_team, hm.team_a_points as points_for, hm.team_b_points as points_against
        from h2h_matches hm
        union all
        select hm.team_b as team_name, hm.winner_team, hm.team_b_points as points_for, hm.team_a_points as points_against
        from h2h_matches hm
      ) u
      group by u.team_name
    ),
    h2h as (
      select
        tg.team_name,
        coalesce(hr.games, 0)::int as games,
        coalesce(hr.wins, 0)::int as wins,
        coalesce(hr.losses, 0)::int as losses,
        coalesce(hr.points_for, 0)::int as points_for,
        coalesce(hr.points_against, 0)::int as points_against,
        (coalesce(hr.points_for, 0) - coalesce(hr.points_against, 0))::int as point_diff
      from teams_in_group tg
      left join h2h_raw hr on hr.team_name = tg.team_name
    ),
    overall as (
      select
        trs.team_name,
        coalesce(trs.point_diff, 0)::numeric as overall_point_diff,
        coalesce(trs.points_for, 0)::numeric as overall_points_for
      from public.tournament_regular_standings trs
      where trs.tournament_id = p_tournament_id
        and trs.team_name = any(p_team_names)
    ),
    metrics as (
      select
        tg.team_name,
        case
          when v_criterion = 'h2h_record'
            then case when h.games > 0 then h.wins::numeric / h.games::numeric else 0::numeric end
          when v_criterion = 'h2h_point_diff'
            then h.point_diff::numeric
          when v_criterion = 'h2h_points_scored'
            then h.points_for::numeric
          when v_criterion = 'overall_point_diff'
            then coalesce(o.overall_point_diff, 0::numeric)
          when v_criterion = 'overall_points_scored'
            then coalesce(o.overall_points_for, 0::numeric)
          else 0::numeric
        end as metric_value,
        case
          when v_criterion = 'h2h_record'
            then coalesce(h.wins, 0)::text || '-' || coalesce(h.losses, 0)::text
          when v_criterion = 'h2h_point_diff'
            then case when h.point_diff > 0 then '+' || h.point_diff::text else h.point_diff::text end
          when v_criterion = 'h2h_points_scored'
            then coalesce(h.points_for, 0)::text
          when v_criterion = 'overall_point_diff'
            then case
              when coalesce(o.overall_point_diff, 0::numeric) > 0
                then '+' || coalesce(o.overall_point_diff, 0::numeric)::text
              else coalesce(o.overall_point_diff, 0::numeric)::text
            end
          when v_criterion = 'overall_points_scored'
            then coalesce(o.overall_points_for, 0::numeric)::text
          else '-'
        end as value_label
      from teams_in_group tg
      left join h2h h on h.team_name = tg.team_name
      left join overall o on o.team_name = tg.team_name
    ),
    buckets as (
      select
        m.metric_value,
        array_agg(m.team_name order by lower(m.team_name), m.team_name) as teams,
        jsonb_object_agg(m.team_name, m.value_label) as labels,
        min(lower(m.team_name)) as first_team_name
      from metrics m
      group by m.metric_value
    )
    select count(*)::int
    into v_bucket_count
    from buckets;

    if coalesce(v_bucket_count, 0) <= 1 then
      continue;
    end if;

    for v_bucket in
      with teams_in_group as (
        select unnest(p_team_names)::text as team_name
      ),
      regular_matches as (
        select ms.*
        from public.tournament_match_scoreboard ms
        left join public.playoff_games pg on pg.match_id = ms.match_id
        where ms.tournament_id = p_tournament_id
          and pg.id is null
          and ms.winner_team is not null
      ),
      h2h_matches as (
        select rm.*
        from regular_matches rm
        where rm.team_a = any(p_team_names)
          and rm.team_b = any(p_team_names)
      ),
      h2h_raw as (
        select
          u.team_name,
          count(*)::int as games,
          count(*) filter (where u.winner_team = u.team_name)::int as wins,
          count(*) filter (where u.winner_team is not null and u.winner_team <> u.team_name)::int as losses,
          coalesce(sum(u.points_for), 0)::int as points_for,
          coalesce(sum(u.points_against), 0)::int as points_against
        from (
          select hm.team_a as team_name, hm.winner_team, hm.team_a_points as points_for, hm.team_b_points as points_against
          from h2h_matches hm
          union all
          select hm.team_b as team_name, hm.winner_team, hm.team_b_points as points_for, hm.team_a_points as points_against
          from h2h_matches hm
        ) u
        group by u.team_name
      ),
      h2h as (
        select
          tg.team_name,
          coalesce(hr.games, 0)::int as games,
          coalesce(hr.wins, 0)::int as wins,
          coalesce(hr.losses, 0)::int as losses,
          coalesce(hr.points_for, 0)::int as points_for,
          coalesce(hr.points_against, 0)::int as points_against,
          (coalesce(hr.points_for, 0) - coalesce(hr.points_against, 0))::int as point_diff
        from teams_in_group tg
        left join h2h_raw hr on hr.team_name = tg.team_name
      ),
      overall as (
        select
          trs.team_name,
          coalesce(trs.point_diff, 0)::numeric as overall_point_diff,
          coalesce(trs.points_for, 0)::numeric as overall_points_for
        from public.tournament_regular_standings trs
        where trs.tournament_id = p_tournament_id
          and trs.team_name = any(p_team_names)
      ),
      metrics as (
        select
          tg.team_name,
          case
            when v_criterion = 'h2h_record'
              then case when h.games > 0 then h.wins::numeric / h.games::numeric else 0::numeric end
            when v_criterion = 'h2h_point_diff'
              then h.point_diff::numeric
            when v_criterion = 'h2h_points_scored'
              then h.points_for::numeric
            when v_criterion = 'overall_point_diff'
              then coalesce(o.overall_point_diff, 0::numeric)
            when v_criterion = 'overall_points_scored'
              then coalesce(o.overall_points_for, 0::numeric)
            else 0::numeric
          end as metric_value,
          case
            when v_criterion = 'h2h_record'
              then coalesce(h.wins, 0)::text || '-' || coalesce(h.losses, 0)::text
            when v_criterion = 'h2h_point_diff'
              then case when h.point_diff > 0 then '+' || h.point_diff::text else h.point_diff::text end
            when v_criterion = 'h2h_points_scored'
              then coalesce(h.points_for, 0)::text
            when v_criterion = 'overall_point_diff'
              then case
                when coalesce(o.overall_point_diff, 0::numeric) > 0
                  then '+' || coalesce(o.overall_point_diff, 0::numeric)::text
                else coalesce(o.overall_point_diff, 0::numeric)::text
              end
            when v_criterion = 'overall_points_scored'
              then coalesce(o.overall_points_for, 0::numeric)::text
            else '-'
          end as value_label
        from teams_in_group tg
        left join h2h h on h.team_name = tg.team_name
        left join overall o on o.team_name = tg.team_name
      )
      select
        metric_value,
        array_agg(team_name order by lower(team_name), team_name) as teams,
        jsonb_object_agg(team_name, value_label) as labels,
        min(lower(team_name)) as first_team_name
      from metrics
      group by metric_value
      order by metric_value desc, first_team_name asc
    loop
      if coalesce(array_length(v_bucket.teams, 1), 0) = 1 then
        v_label := coalesce(v_bucket.labels ->> v_bucket.teams[1], '-');

        v_ordered := array_append(v_ordered, v_bucket.teams[1]);
        v_criteria := array_append(v_criteria, v_criterion);
        v_explanations := array_append(
          v_explanations,
          case v_criterion
            when 'h2h_record' then format('Empate con %s equipos en %s pts: mejor récord directo (%s).', v_team_count, p_classification_points, v_label)
            when 'h2h_point_diff' then format('Empate con %s equipos en %s pts: mejor +/- entre empatados (%s).', v_team_count, p_classification_points, v_label)
            when 'h2h_points_scored' then format('Empate con %s equipos en %s pts: más puntos anotados entre empatados (%s).', v_team_count, p_classification_points, v_label)
            when 'overall_point_diff' then format('Empate con %s equipos en %s pts: mejor +/- general (%s).', v_team_count, p_classification_points, v_label)
            when 'overall_points_scored' then format('Empate con %s equipos en %s pts: más puntos anotados en todos los juegos (%s).', v_team_count, p_classification_points, v_label)
            else format('Empate con %s equipos en %s pts: criterio final (%s).', v_team_count, p_classification_points, v_label)
          end
        );
      else
        for v_sub in
          select *
          from public.resolve_tournament_tie_group_fiba(
            p_tournament_id,
            v_bucket.teams,
            p_classification_points
          )
          order by sort_order
        loop
          v_ordered := array_append(v_ordered, v_sub.team_name);
          v_criteria := array_append(v_criteria, coalesce(v_sub.tie_break_criterion, v_criterion));
          v_explanations := array_append(
            v_explanations,
            coalesce(
              v_sub.tie_break_explanation,
              format('Empate con %s equipos en %s pts: criterio aplicado %s.', v_team_count, p_classification_points, v_criterion)
            )
          );
        end loop;
      end if;
    end loop;

    return query
    select
      v_ordered[idx]::text,
      v_criteria[idx]::text,
      v_explanations[idx]::text,
      idx::integer
    from generate_subscripts(v_ordered, 1) as idx
    order by idx;

    return;
  end loop;

  for v_sub in
    select value as team_name
    from unnest(p_team_names) as value
    order by lower(value), value
  loop
    v_ordered := array_append(v_ordered, v_sub.team_name);
    v_criteria := array_append(v_criteria, 'draw');
    v_explanations := array_append(
      v_explanations,
      format('Empate total con %s equipos en %s pts: orden alfabético local.', v_team_count, p_classification_points)
    );
  end loop;

  return query
  select
    v_ordered[idx]::text,
    v_criteria[idx]::text,
    v_explanations[idx]::text,
    idx::integer
  from generate_subscripts(v_ordered, 1) as idx
  order by idx;
end;
$$;

create or replace function public.get_tournament_regular_seeding_fiba(
  p_tournament_id uuid
)
returns table(
  seed integer,
  team_id bigint,
  team_name text,
  games_played integer,
  wins integer,
  losses integer,
  classification_points integer,
  points_for integer,
  points_against integer,
  point_diff integer,
  win_pct numeric,
  tie_break_criterion text,
  tie_break_explanation text
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_seed integer := 1;
  v_group record;
  v_row record;
  v_tie record;
begin
  if p_tournament_id is null then
    return;
  end if;

  for v_group in
    with standings as (
      select *
      from public.tournament_regular_standings trs
      where trs.tournament_id = p_tournament_id
    )
    select
      s.classification_points,
      array_agg(s.team_name order by lower(s.team_name), s.team_name) as team_names
    from standings s
    group by s.classification_points
    order by s.classification_points desc
  loop
    if coalesce(array_length(v_group.team_names, 1), 0) = 1 then
      select
        trs.team_id,
        trs.team_name,
        trs.games_played,
        trs.wins,
        trs.losses,
        trs.classification_points,
        trs.points_for,
        trs.points_against,
        trs.point_diff,
        trs.win_pct
      into v_row
      from public.tournament_regular_standings trs
      where trs.tournament_id = p_tournament_id
        and trs.team_name = v_group.team_names[1]
      limit 1;

      if v_row.team_id is not null then
        return query
        select
          v_seed::integer,
          v_row.team_id::bigint,
          v_row.team_name::text,
          v_row.games_played::integer,
          v_row.wins::integer,
          v_row.losses::integer,
          v_row.classification_points::integer,
          v_row.points_for::integer,
          v_row.points_against::integer,
          v_row.point_diff::integer,
          v_row.win_pct::numeric,
          'none'::text,
          'Sin desempate: mejor récord general en el grupo.'::text;
        v_seed := v_seed + 1;
      end if;
    else
      for v_tie in
        select *
        from public.resolve_tournament_tie_group_fiba(
          p_tournament_id,
          v_group.team_names,
          v_group.classification_points
        )
        order by sort_order
      loop
        select
          trs.team_id,
          trs.team_name,
          trs.games_played,
          trs.wins,
          trs.losses,
          trs.classification_points,
          trs.points_for,
          trs.points_against,
          trs.point_diff,
          trs.win_pct
        into v_row
        from public.tournament_regular_standings trs
        where trs.tournament_id = p_tournament_id
          and trs.team_name = v_tie.team_name
        limit 1;

        if v_row.team_id is null then
          continue;
        end if;

        return query
        select
          v_seed::integer,
          v_row.team_id::bigint,
          v_row.team_name::text,
          v_row.games_played::integer,
          v_row.wins::integer,
          v_row.losses::integer,
          v_row.classification_points::integer,
          v_row.points_for::integer,
          v_row.points_against::integer,
          v_row.point_diff::integer,
          v_row.win_pct::numeric,
          coalesce(v_tie.tie_break_criterion, 'none')::text,
          coalesce(v_tie.tie_break_explanation, 'Sin desempate: mejor récord general en el grupo.')::text;
        v_seed := v_seed + 1;
      end loop;
    end if;
  end loop;
end;
$$;

create or replace function public.generate_tournament_playoffs(p_tournament_id uuid)
returns jsonb
language plpgsql
set search_path = public
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
      s.seed,
      s.team_id,
      s.team_name
    from public.get_tournament_regular_seeding_fiba(p_tournament_id) s
    where s.seed <= 4
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

grant execute on function public.resolve_tournament_tie_group_fiba(uuid, text[], bigint) to anon, authenticated;
grant execute on function public.get_tournament_regular_seeding_fiba(uuid) to anon, authenticated;
grant execute on function public.generate_tournament_playoffs(uuid) to anon, authenticated;

commit;
