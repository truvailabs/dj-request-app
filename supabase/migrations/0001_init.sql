-- DJ song request app — tonight's schema (Phase 1 + Phase 2 flag).
-- Table shape follows dj-request-build-spec.md §2; payments_enabled is the
-- tonight-only delta. dj_stripe_account_id / platform_fee_bps are included
-- for forward-compatibility with the full spec's Connect flow, but unused
-- tonight (no Connect — plain PaymentIntents on your own account).

create extension if not exists pgcrypto;

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dj_stripe_account_id text,
  vip_code text not null,
  itunes_search_enabled boolean not null default true,
  public_queue_mode text not null default 'top3' check (public_queue_mode in ('full', 'top3', 'hidden')),
  platform_fee_bps int,
  payments_enabled boolean not null default false,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now()
);

create table songs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  artist text not null,
  bpm int,
  created_at timestamptz not null default now()
);

create index songs_event_id_idx on songs(event_id);

create table requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  song_id uuid references songs(id),
  title text not null,
  artist text not null,
  bpm int,
  tier text not null default 'free' check (tier in ('free', 'boost', 'front')),
  amount int not null default 0,
  is_vip boolean not null default false,
  requester_name text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create index requests_event_id_status_idx on requests(event_id, status);

-- ---------------------------------------------------------------------
-- Row-Level Security
--
-- Writes never happen via anon/authenticated grants — POST /requests and
-- accept/reject go through the Node backend using the service role key,
-- which bypasses RLS entirely. These policies only govern reads.
-- ---------------------------------------------------------------------

alter table events enable row level security;
alter table songs enable row level security;
alter table requests enable row level security;

-- events: readable by anyone while active, but vip_code / dj_stripe_account_id
-- / platform_fee_bps are withheld from anon+authenticated via column grants below.
create policy "events_select_active" on events
  for select
  to public
  using (status = 'active');

revoke all on events from anon, authenticated;
grant select (id, name, itunes_search_enabled, public_queue_mode, payments_enabled, status, created_at)
  on events to anon, authenticated;

-- songs: fully public (custom setlist only, no sensitive data).
create policy "songs_select_all" on songs
  for select
  to public
  using (true);

grant select on songs to anon, authenticated;

-- requests: DJ (authenticated) sees everything. Attendees (anon) only see
-- the top-3 non-VIP pending song groups — matches tonight's
-- public_queue_mode='top3'. Grouping key mirrors the backend's normalize()
-- (trim + lowercase) so RLS and the accept/reject grouping logic agree.
create policy "requests_select_authenticated_full" on requests
  for select
  to authenticated
  using (true);

create policy "requests_select_public_top3" on requests
  for select
  to anon
  using (
    is_vip = false
    and status = 'pending'
    and (lower(trim(title)), lower(trim(artist))) in (
      select lower(trim(r2.title)), lower(trim(r2.artist))
      from requests r2
      where r2.event_id = requests.event_id
        and r2.is_vip = false
        and r2.status = 'pending'
      group by lower(trim(r2.title)), lower(trim(r2.artist))
      order by sum(r2.amount) desc, count(*) desc
      limit 3
    )
  );

revoke all on requests from anon, authenticated;
-- Anon: no requester_name, no stripe_payment_intent_id.
grant select (id, event_id, song_id, title, artist, bpm, tier, amount, is_vip, status, created_at)
  on requests to anon;
-- Authenticated (DJ): everything.
grant select on requests to authenticated;
