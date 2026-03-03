begin;

-- Vinculo directo torneo-equipo-jugador para consultas mas rapidas y consistentes.

alter table public.team_players
  add column if not exists tournament_id uuid;

-- Asegura llave candidata para FK compuesta (tournament_id, id) en teams.
create unique index if not exists uq_teams_tournament_id_id
  on public.teams (tournament_id, id);

-- Limpia huellas huerfanas (si existen) y rellena tournament_id desde teams.
delete from public.team_players tp
where not exists (
  select 1
  from public.teams t
  where t.id = tp.team_id
);

update public.team_players tp
set tournament_id = t.tournament_id
from public.teams t
where t.id = tp.team_id
  and (tp.tournament_id is null or tp.tournament_id is distinct from t.tournament_id);

alter table public.team_players
  alter column tournament_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_players_tournament_fkey'
      and conrelid = 'public.team_players'::regclass
  ) then
    alter table public.team_players
      add constraint team_players_tournament_fkey
      foreign key (tournament_id)
      references public.tournaments(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_players_tournament_team_fkey'
      and conrelid = 'public.team_players'::regclass
  ) then
    alter table public.team_players
      add constraint team_players_tournament_team_fkey
      foreign key (tournament_id, team_id)
      references public.teams(tournament_id, id)
      on delete cascade;
  end if;
end $$;

-- Mantiene tournament_id consistente ante inserts/updates.
create or replace function public.team_players_sync_tournament_id()
returns trigger
language plpgsql
as $$
declare
  linked_tournament uuid;
begin
  select t.tournament_id
  into linked_tournament
  from public.teams t
  where t.id = new.team_id;

  if linked_tournament is null then
    raise exception 'team_id % no existe en public.teams', new.team_id;
  end if;

  if new.tournament_id is null then
    new.tournament_id := linked_tournament;
  elsif new.tournament_id is distinct from linked_tournament then
    raise exception 'tournament_id % no coincide con el team_id %', new.tournament_id, new.team_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_team_players_sync_tournament_id on public.team_players;
create trigger trg_team_players_sync_tournament_id
before insert or update of team_id, tournament_id
on public.team_players
for each row
execute function public.team_players_sync_tournament_id();

create index if not exists idx_team_players_tournament
  on public.team_players (tournament_id);

create index if not exists idx_team_players_tournament_team
  on public.team_players (tournament_id, team_id);

create index if not exists idx_team_players_tournament_player
  on public.team_players (tournament_id, player_id);

commit;
