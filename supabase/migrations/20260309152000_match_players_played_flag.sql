begin;

alter table public.match_players
  add column if not exists played boolean not null default false;

update public.match_players mp
set played = true
where exists (
  select 1
  from public.player_stats ps
  where ps.match_id = mp.match_id
    and ps.player_id = mp.player_id
);

create index if not exists idx_match_players_match_played
  on public.match_players (match_id, played);

create or replace function public.sync_match_player_played_from_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.match_players mp
    set played = exists (
      select 1
      from public.player_stats ps
      where ps.match_id = old.match_id
        and ps.player_id = old.player_id
    )
    where mp.match_id = old.match_id
      and mp.player_id = old.player_id;

    return old;
  end if;

  update public.match_players mp
  set played = true
  where mp.match_id = new.match_id
    and mp.player_id = new.player_id;

  if tg_op = 'UPDATE'
     and (
       new.match_id is distinct from old.match_id
       or new.player_id is distinct from old.player_id
     ) then
    update public.match_players mp
    set played = exists (
      select 1
      from public.player_stats ps
      where ps.match_id = old.match_id
        and ps.player_id = old.player_id
    )
    where mp.match_id = old.match_id
      and mp.player_id = old.player_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_match_player_played_from_stats on public.player_stats;

create trigger trg_sync_match_player_played_from_stats
after insert or update or delete on public.player_stats
for each row execute function public.sync_match_player_played_from_stats();

commit;
