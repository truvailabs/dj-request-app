-- Custom pricing tiers: replaces the hardcoded free/boost/front tiers with
-- DJ-editable rows (name + price in cents) per event.

create table tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  amount int not null default 0 check (amount >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index tiers_event_id_idx on tiers(event_id);

alter table tiers enable row level security;

-- Public read (attendee page + DJ dashboard both just need the current list).
-- Writes only via the Node backend (service role), gated by requireDj.
create policy "tiers_select_all" on tiers
  for select
  to public
  using (true);

grant select on tiers to anon, authenticated;

-- requests.tier used to be constrained to a fixed 3-value enum. It's now a
-- denormalized label snapshot of whatever tier was picked at request time
-- (so it stays correct even if the tier is later renamed/deleted).
alter table requests drop constraint if exists requests_tier_check;
alter table requests alter column tier set default 'Free';
alter table requests add column tier_id uuid references tiers(id) on delete set null;

-- Seed the three tiers that were previously hardcoded, so existing events
-- keep working with no manual step.
insert into tiers (event_id, name, amount, sort_order)
select id, 'Free', 0, 0 from events
union all
select id, 'Boost', 500, 1 from events
union all
select id, 'Front of line', 2000, 2 from events;
