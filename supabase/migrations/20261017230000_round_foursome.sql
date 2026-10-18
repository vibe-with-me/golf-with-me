-- Golf With Me: a round is a foursome at most.
--
-- The starter's capacity (20261017203000) is optional, 2..500, counting the
-- host. A round of golf is at most four players, so here every round has a
-- capacity and it is 2..4:
--   * a missing capacity (an RPC call without p_capacity, an edit that clears
--     it) becomes 4, by trigger, so "no limit" cannot happen even straight
--     through PostgREST;
--   * the CHECK allows 2..4 only, so no client can make a round of five.
-- The contract's GATHERING_CAPACITY_MAX (4) mirrors it. join_gathering's
-- row lock and 'gathering is full' (P0007) are the starter's and unchanged.
-- Lowering a capacity below the headcount keeps everyone already going, as
-- in the starter; an existing round over four keeps its players and takes
-- no new ones.

create function private.round_capacity_default()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.capacity := coalesce(new.capacity, 4);
  return new;
end
$$;

create trigger gatherings_round_capacity_default
  before insert or update of capacity on public.gatherings
  for each row execute function private.round_capacity_default();

-- Existing rounds: none without a limit, none above four.
update public.gatherings set capacity = 4 where capacity is null or capacity > 4;

-- The column stays nullable, as in the starter (so the generated types and a
-- client's "clear the capacity" edit are unchanged); the trigger fills in 4
-- before the CHECK runs, and the CHECK itself refuses a null, so none lands.
alter table public.gatherings
  alter column capacity set default 4,
  drop constraint gatherings_capacity_range,
  add constraint gatherings_capacity_foursome check (capacity is not null and capacity between 2 and 4);
