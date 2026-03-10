begin;

create or replace function public.sync_team_name_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.name is null or old.name is null then
    return new;
  end if;

  if new.name is not distinct from old.name then
    return new;
  end if;

  if new.tournament_id is distinct from old.tournament_id then
    return new;
  end if;

  -- Propaga renombres de equipos en partidos existentes para conservar integridad logica.
  update public.matches
  set
    team_a = case when team_a = old.name then new.name else team_a end,
    team_b = case when team_b = old.name then new.name else team_b end,
    winner_team = case when winner_team = old.name then new.name else winner_team end
  where tournament_id = new.tournament_id
    and (
      team_a = old.name
      or team_b = old.name
      or winner_team = old.name
    );

  -- Mantiene cache de totales consistente con el nombre actualizado.
  update public.tournament_player_totals_cache
  set team_name = new.name
  where tournament_id = new.tournament_id
    and team_name = old.name;

  return new;
end;
$$;

drop trigger if exists trg_sync_team_name_references on public.teams;

create trigger trg_sync_team_name_references
after update of name on public.teams
for each row
when (old.name is distinct from new.name)
execute function public.sync_team_name_references();

revoke all on function public.sync_team_name_references() from public;

commit;
