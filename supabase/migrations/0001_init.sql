-- =============================================================================
-- BBA Transport – MVP Schema Migration
-- =============================================================================
-- This migration creates the complete MVP data layer:
--   • Extensions (PostGIS, pgcrypto)
--   • Enums & types
--   • All MVP tables with constraints
--   • Indexes (GiST for geo, B-tree for lookups)
--   • Row-Level Security policies
--   • Core functions: nearby_riders, dispatch_delivery, accept_delivery,
--     transition_delivery, verify_pickup_otp, verify_delivery_otp
--   • Delivery transitions (state-machine rules)
--   • pg_cron jobs for wave expansion and expiry
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
create type user_role as enum ('sender', 'rider', 'admin');

create type verification_status as enum ('pending', 'approved', 'rejected');

create type vehicle_type as enum ('bike', 'car', 'van');

create type size_class as enum ('S', 'M', 'L');

create type delivery_status as enum (
  'SEARCHING',
  'ASSIGNED',
  'EN_ROUTE_TO_PICKUP',
  'AT_PICKUP',
  'IN_TRANSIT',
  'AT_DROPOFF',
  'DELIVERED',
  'CANCELLED',
  'EXPIRED',
  'FAILED'
);

create type dispatch_response as enum ('pending', 'accepted', 'rejected', 'expired');

create type payment_provider as enum ('cash', 'manual_transfer');

create type payment_status as enum ('pending', 'confirmed', 'disputed', 'refunded');

create type ledger_entry_type as enum ('commission', 'topup', 'adjustment');

create type report_type as enum ('damage', 'theft', 'misconduct', 'late', 'other');

create type report_status as enum ('open', 'investigating', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- 2.1 Profiles (extends auth.users)
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'sender',
  full_name   text not null,
  phone       text,
  avatar_url  text,
  is_suspended boolean not null default false,
  rating_avg  numeric(3,2) not null default 0,
  rating_count int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2.2 Riders (1:1 with profiles where role = 'rider')
create table riders (
  id                  uuid primary key references profiles(id) on delete cascade,
  verification_status verification_status not null default 'pending',
  cnic_photo_path     text,
  selfie_path         text,
  vehicle_type        vehicle_type not null default 'bike',
  plate_no            text,
  vehicle_photo_path  text,
  max_weight_kg       numeric(5,2) not null default 10,
  max_size_class      size_class not null default 'L',
  cash_balance_pkr    int not null default 0,  -- owed to platform
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 2.3 Rider presence (one row per rider, upserted)
create table rider_presence (
  rider_id   uuid primary key references riders(id) on delete cascade,
  status     text not null check (status in ('online', 'busy')),
  location   geography(Point, 4326) not null,
  accuracy_m real,
  heading    real,
  speed      real,
  updated_at timestamptz not null default now()
);

-- 2.4 Deliveries
create table deliveries (
  id                  uuid primary key default gen_random_uuid(),
  sender_id           uuid not null references profiles(id),
  rider_id            uuid references profiles(id),

  -- Status
  status              delivery_status not null default 'SEARCHING',

  -- Pickup
  pickup_location     geography(Point, 4326) not null,
  pickup_address      text,
  pickup_landmark     text,

  -- Dropoff
  dropoff_location    geography(Point, 4326) not null,
  dropoff_address     text,
  dropoff_landmark    text,

  -- Recipient
  recipient_name      text,
  recipient_phone     text,

  -- Package (inline, no separate table)
  description         text not null,
  weight_kg           numeric(5,2) not null,
  size_class          size_class not null default 'M',
  is_fragile          boolean not null default false,
  declared_value_pkr  int not null default 0,
  photo_paths         text[] not null default '{}',

  -- Pricing
  distance_km         numeric(6,2),
  suggested_price_pkr int not null,
  price_pkr           int not null,

  -- OTPs (hashed)
  pickup_otp_hash     text,
  delivery_otp_hash   text,

  -- Public tracking
  tracking_token      text unique default encode(gen_random_bytes(12), 'hex'),

  -- Cancellation
  cancelled_by        text,  -- 'sender', 'rider', 'admin', 'system'
  cancel_reason       text,

  -- Dispatch
  dispatch_wave       int not null default 0,

  -- Timestamps
  created_at          timestamptz not null default now(),
  assigned_at         timestamptz,
  picked_up_at        timestamptz,
  delivered_at        timestamptz
);

-- 2.5 Delivery offers (accepts are offers at asking price; ready for bidding later)
create table delivery_offers (
  id          uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries(id) on delete cascade,
  rider_id    uuid not null references profiles(id),
  amount_pkr  int not null,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  created_at  timestamptz not null default now()
);

-- 2.6 Delivery dispatches (which riders were notified)
create table delivery_dispatches (
  delivery_id uuid not null references deliveries(id) on delete cascade,
  rider_id    uuid not null references profiles(id),
  wave        int not null default 1,
  sent_at     timestamptz not null default now(),
  seen_at     timestamptz,
  response    dispatch_response not null default 'pending',
  primary key (delivery_id, rider_id)
);

-- 2.7 Delivery events (append-only audit log)
create table delivery_events (
  id          uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries(id) on delete cascade,
  from_status delivery_status not null,
  to_status   delivery_status not null,
  actor_id    uuid references profiles(id),
  meta        jsonb default '{}',
  created_at  timestamptz not null default now()
);

-- 2.8 Delivery tracks (breadcrumbs, purge after 30 days)
create table delivery_tracks (
  id          uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries(id) on delete cascade,
  location    geography(Point, 4326) not null,
  accuracy_m  real,
  recorded_at timestamptz not null default now()
);

-- 2.9 Payments
create table payments (
  id           uuid primary key default gen_random_uuid(),
  delivery_id  uuid not null references deliveries(id) on delete cascade,
  provider     payment_provider not null default 'cash',
  amount_pkr   int not null,
  payer        text not null,  -- 'sender' or 'recipient'
  status       payment_status not null default 'pending',
  provider_ref text,
  confirmed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- 2.10 Ledger entries (commission tracking)
create table ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  rider_id    uuid not null references riders(id) on delete cascade,
  delivery_id uuid references deliveries(id),
  type        ledger_entry_type not null,
  amount_pkr  int not null,  -- positive = rider owes platform
  note        text,
  created_at  timestamptz not null default now()
);

-- 2.11 Ratings
create table ratings (
  id          uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries(id) on delete cascade,
  rater_id    uuid not null references profiles(id),
  ratee_id    uuid not null references profiles(id),
  stars       int not null check (stars >= 1 and stars <= 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (delivery_id, rater_id)
);

-- 2.12 Reports (disputes)
create table reports (
  id              uuid primary key default gen_random_uuid(),
  delivery_id     uuid references deliveries(id),
  reporter_id     uuid not null references profiles(id),
  reported_id     uuid references profiles(id),
  type            report_type not null,
  description     text not null,
  status          report_status not null default 'open',
  resolution_note text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 2.13 Pricing config (single-row, admin-editable)
create table pricing_config (
  id                    int primary key default 1 check (id = 1),  -- singleton
  base_fare_pkr         int not null default 80,
  per_km_pkr            int not null default 25,
  road_factor           numeric(3,2) not null default 1.30,
  weight_free_kg        numeric(5,2) not null default 2,
  per_extra_kg_pkr      int not null default 15,
  size_fee_s_pkr        int not null default 0,
  size_fee_m_pkr        int not null default 40,
  size_fee_l_pkr        int not null default 100,
  urgency_standard      numeric(3,2) not null default 1.00,
  urgency_asap          numeric(3,2) not null default 1.25,
  min_fare_pkr          int not null default 120,
  sender_adjust_min_pct numeric(4,2) not null default -15.00,
  sender_adjust_max_pct numeric(4,2) not null default 50.00,
  night_rain_multiplier numeric(3,2) not null default 1.20,
  night_rain_active     boolean not null default false,
  commission_pct        numeric(5,2) not null default 0.00,  -- start at 0%
  updated_at            timestamptz not null default now()
);

-- Seed the singleton row
insert into pricing_config (id) values (1);

-- 2.14 Push subscriptions (Web Push)
create table push_subscriptions (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references profiles(id) on delete cascade,
  endpoint  text not null,
  keys      jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- 2.15 Delivery transitions (state-machine rules)
create table delivery_transitions (
  from_status delivery_status not null,
  to_status   delivery_status not null,
  actor       text not null,  -- 'rider', 'sender', 'system', 'admin'
  primary key (from_status, to_status, actor)
);

insert into delivery_transitions (from_status, to_status, actor) values
  ('SEARCHING',           'ASSIGNED',            'rider'),
  ('SEARCHING',           'CANCELLED',           'sender'),
  ('SEARCHING',           'EXPIRED',             'system'),
  ('ASSIGNED',            'EN_ROUTE_TO_PICKUP',  'rider'),
  ('ASSIGNED',            'CANCELLED',           'rider'),
  ('ASSIGNED',            'CANCELLED',           'sender'),
  ('EN_ROUTE_TO_PICKUP',  'AT_PICKUP',           'rider'),
  ('EN_ROUTE_TO_PICKUP',  'CANCELLED',           'sender'),
  ('AT_PICKUP',           'IN_TRANSIT',          'rider'),
  ('AT_PICKUP',           'CANCELLED',           'rider'),
  ('IN_TRANSIT',          'AT_DROPOFF',          'rider'),
  ('IN_TRANSIT',          'FAILED',              'rider'),
  ('AT_DROPOFF',          'DELIVERED',           'rider'),
  ('AT_DROPOFF',          'FAILED',              'rider');

-- Admin can force cancel/fail from any active state
insert into delivery_transitions (from_status, to_status, actor)
  select s, 'CANCELLED'::delivery_status, 'admin'
  from unnest(enum_range(null::delivery_status)) s
  where s not in ('DELIVERED', 'CANCELLED', 'EXPIRED', 'FAILED');

insert into delivery_transitions (from_status, to_status, actor)
  select s, 'FAILED'::delivery_status, 'admin'
  from unnest(enum_range(null::delivery_status)) s
  where s not in ('DELIVERED', 'CANCELLED', 'EXPIRED', 'FAILED');


-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------

-- Rider presence: spatial + freshness
create index rider_presence_geo  on rider_presence using gist (location);
create index rider_presence_live on rider_presence (status, updated_at);

-- Deliveries
create index deliveries_status_created   on deliveries (status, created_at);
create index deliveries_pickup_geo       on deliveries using gist (pickup_location);
create index deliveries_rider_active     on deliveries (rider_id) where status not in ('DELIVERED', 'CANCELLED', 'EXPIRED', 'FAILED');
create index deliveries_sender_recent    on deliveries (sender_id, created_at desc);
create index deliveries_tracking_token   on deliveries (tracking_token);

-- Dispatches
create index dispatches_rider_pending    on delivery_dispatches (rider_id) where response = 'pending';

-- Events
create index events_delivery             on delivery_events (delivery_id, created_at);

-- Tracks
create index tracks_delivery_time        on delivery_tracks (delivery_id, recorded_at);

-- Offers
create index offers_delivery             on delivery_offers (delivery_id);

-- Ratings
create index ratings_ratee               on ratings (ratee_id);

-- Reports
create index reports_status              on reports (status) where status in ('open', 'investigating');


-- ---------------------------------------------------------------------------
-- 4. Row-Level Security
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table riders enable row level security;
alter table rider_presence enable row level security;
alter table deliveries enable row level security;
alter table delivery_offers enable row level security;
alter table delivery_dispatches enable row level security;
alter table delivery_events enable row level security;
alter table delivery_tracks enable row level security;
alter table payments enable row level security;
alter table ledger_entries enable row level security;
alter table ratings enable row level security;
alter table reports enable row level security;
alter table pricing_config enable row level security;
alter table push_subscriptions enable row level security;
alter table delivery_transitions enable row level security;

-- Helper: get current user's role
create or replace function public.user_role()
returns user_role
language sql stable security definer
as $$
  select role from profiles where id = auth.uid();
$$;

-- Helper: check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql stable security definer
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---- Profiles ----
create policy "Users can view any profile"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

-- Admins can update any profile (for suspend etc.)
create policy "Admins can update any profile"
  on profiles for update using (public.is_admin());

-- ---- Riders ----
create policy "Anyone can view approved riders"
  on riders for select using (true);

create policy "Riders can insert own record"
  on riders for insert with check (auth.uid() = id);

create policy "Riders can update own record"
  on riders for update using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can update any rider"
  on riders for update using (public.is_admin());

-- ---- Rider Presence ----
-- Only the rider can write their own presence
-- Anyone can read (for nearby riders on map, filtered/snapped in app code)
create policy "Anyone can view presence"
  on rider_presence for select using (true);

create policy "Riders can upsert own presence"
  on rider_presence for insert with check (auth.uid() = rider_id);

create policy "Riders can update own presence"
  on rider_presence for update using (auth.uid() = rider_id);

create policy "Riders can delete own presence"
  on rider_presence for delete using (auth.uid() = rider_id);

-- ---- Deliveries ----
-- Senders see their own; riders see assigned; admin sees all
-- Public tracking via tracking_token is handled by a function, not RLS
create policy "Senders can view own deliveries"
  on deliveries for select using (auth.uid() = sender_id);

create policy "Riders can view assigned deliveries"
  on deliveries for select using (auth.uid() = rider_id);

create policy "Admins can view all deliveries"
  on deliveries for select using (public.is_admin());

create policy "Senders can create deliveries"
  on deliveries for insert with check (auth.uid() = sender_id);

-- Direct updates are blocked; only functions with SECURITY DEFINER modify deliveries
-- (No update policy for non-admins)
create policy "Admins can update deliveries"
  on deliveries for update using (public.is_admin());

-- ---- Delivery Offers ----
create policy "Riders can create offers"
  on delivery_offers for insert with check (auth.uid() = rider_id);

create policy "Participants can view offers"
  on delivery_offers for select using (
    auth.uid() = rider_id
    or auth.uid() in (select sender_id from deliveries where id = delivery_id)
    or public.is_admin()
  );

-- ---- Delivery Dispatches ----
-- Riders see dispatches sent to them
create policy "Riders can view own dispatches"
  on delivery_dispatches for select using (auth.uid() = rider_id);

create policy "Senders can view dispatches for own deliveries"
  on delivery_dispatches for select using (
    auth.uid() in (select sender_id from deliveries where id = delivery_id)
  );

create policy "Admins can view all dispatches"
  on delivery_dispatches for select using (public.is_admin());

-- Insert/update via functions only (SECURITY DEFINER)

-- ---- Delivery Events ----
create policy "Participants can view delivery events"
  on delivery_events for select using (
    auth.uid() in (
      select sender_id from deliveries where id = delivery_id
      union
      select rider_id from deliveries where id = delivery_id and rider_id is not null
    )
    or public.is_admin()
  );

-- Insert via functions only

-- ---- Delivery Tracks ----
create policy "Participants can view tracks"
  on delivery_tracks for select using (
    auth.uid() in (
      select sender_id from deliveries where id = delivery_id
      union
      select rider_id from deliveries where id = delivery_id and rider_id is not null
    )
    or public.is_admin()
  );

-- Insert via functions only

-- ---- Payments ----
create policy "Participants can view payments"
  on payments for select using (
    auth.uid() in (
      select sender_id from deliveries where id = delivery_id
      union
      select rider_id from deliveries where id = delivery_id and rider_id is not null
    )
    or public.is_admin()
  );

-- Insert/update via functions only

-- ---- Ledger Entries ----
create policy "Riders can view own ledger"
  on ledger_entries for select using (auth.uid() = rider_id);

create policy "Admins can view all ledger entries"
  on ledger_entries for select using (public.is_admin());

create policy "Admins can insert ledger entries"
  on ledger_entries for insert with check (public.is_admin());

-- ---- Ratings ----
create policy "Anyone can view ratings"
  on ratings for select using (true);

create policy "Users can create ratings"
  on ratings for insert with check (auth.uid() = rater_id);

-- ---- Reports ----
create policy "Reporters can view own reports"
  on reports for select using (auth.uid() = reporter_id);

create policy "Admins can view all reports"
  on reports for select using (public.is_admin());

create policy "Users can create reports"
  on reports for insert with check (auth.uid() = reporter_id);

create policy "Admins can update reports"
  on reports for update using (public.is_admin());

-- ---- Pricing Config ----
create policy "Anyone can read pricing config"
  on pricing_config for select using (true);

create policy "Admins can update pricing config"
  on pricing_config for update using (public.is_admin());

-- ---- Push Subscriptions ----
create policy "Users can manage own push subscriptions"
  on push_subscriptions for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- Delivery Transitions (read-only reference) ----
create policy "Anyone can read transitions"
  on delivery_transitions for select using (true);


-- ---------------------------------------------------------------------------
-- 5. Core Functions
-- ---------------------------------------------------------------------------

-- 5.1 nearby_riders: find available riders within radius
create or replace function nearby_riders(
  p_lng       float8,
  p_lat       float8,
  p_radius_m  int,
  p_weight    numeric,
  p_size      size_class default 'M'
)
returns table (
  rider_id    uuid,
  distance_m  float8,
  rating_avg  numeric,
  vehicle     vehicle_type
)
language sql stable security definer
as $$
  select
    p.rider_id,
    st_distance(p.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) as distance_m,
    pr.rating_avg,
    r.vehicle_type
  from rider_presence p
  join riders r on r.id = p.rider_id
  join profiles pr on pr.id = p.rider_id
  where p.status = 'online'
    and p.updated_at > now() - interval '60 seconds'
    and r.verification_status = 'approved'
    and not pr.is_suspended
    and r.max_weight_kg >= p_weight
    -- Size ordering: S < M < L
    and case p_size
          when 'S' then true
          when 'M' then r.max_size_class in ('M', 'L')
          when 'L' then r.max_size_class = 'L'
        end
    and st_dwithin(
          p.location,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
          p_radius_m
        )
  order by distance_m
  limit 20;
$$;


-- 5.2 dispatch_delivery: find and notify eligible riders (wave-based)
create or replace function dispatch_delivery(p_delivery_id uuid)
returns int  -- number of riders dispatched
language plpgsql security definer
as $$
declare
  v_delivery  deliveries;
  v_radius    int;
  v_wave      int;
  v_count     int := 0;
  v_pickup_lng float8;
  v_pickup_lat float8;
begin
  select * into v_delivery from deliveries where id = p_delivery_id;

  if v_delivery is null then
    raise exception 'Delivery not found: %', p_delivery_id;
  end if;

  if v_delivery.status != 'SEARCHING' then
    return 0;
  end if;

  v_wave := v_delivery.dispatch_wave + 1;

  -- Wave radii: 2km, 4km, 7km
  v_radius := case v_wave
    when 1 then 2000
    when 2 then 4000
    else 7000
  end;

  -- Extract pickup coordinates
  v_pickup_lng := st_x(v_delivery.pickup_location::geometry);
  v_pickup_lat := st_y(v_delivery.pickup_location::geometry);

  -- Insert dispatches for eligible riders not already dispatched
  insert into delivery_dispatches (delivery_id, rider_id, wave)
  select p_delivery_id, nr.rider_id, v_wave
  from nearby_riders(
    v_pickup_lng,
    v_pickup_lat,
    v_radius,
    v_delivery.weight_kg,
    v_delivery.size_class
  ) nr
  where nr.rider_id not in (
    select dd.rider_id from delivery_dispatches dd
    where dd.delivery_id = p_delivery_id
  )
  -- Limit wave 1 to top 10, later waves take all
  limit case when v_wave = 1 then 10 else 100 end;

  get diagnostics v_count = row_count;

  -- Update wave counter
  update deliveries set dispatch_wave = v_wave where id = p_delivery_id;

  return v_count;
end;
$$;


-- 5.3 accept_delivery: atomic first-accept-wins
create or replace function accept_delivery(p_delivery_id uuid, p_rider_id uuid)
returns deliveries
language plpgsql security definer
as $$
declare
  v_delivery deliveries;
begin
  -- Atomic: lock row and check status
  update deliveries
  set
    status = 'ASSIGNED',
    rider_id = p_rider_id,
    assigned_at = now()
  where id = p_delivery_id
    and status = 'SEARCHING'
  returning * into v_delivery;

  if v_delivery is null then
    raise exception 'Delivery not available for acceptance (already taken or invalid)';
  end if;

  -- Record the offer
  insert into delivery_offers (delivery_id, rider_id, amount_pkr, status)
  values (p_delivery_id, p_rider_id, v_delivery.price_pkr, 'accepted');

  -- Expire other pending dispatches
  update delivery_dispatches
  set response = 'expired'
  where delivery_id = p_delivery_id
    and rider_id != p_rider_id
    and response = 'pending';

  -- Mark this rider's dispatch as accepted
  update delivery_dispatches
  set response = 'accepted'
  where delivery_id = p_delivery_id
    and rider_id = p_rider_id;

  -- Set rider to busy
  update rider_presence
  set status = 'busy'
  where rider_id = p_rider_id;

  -- Log the event
  insert into delivery_events (delivery_id, from_status, to_status, actor_id)
  values (p_delivery_id, 'SEARCHING', 'ASSIGNED', p_rider_id);

  return v_delivery;
end;
$$;


-- 5.4 transition_delivery: enforced state machine
create or replace function transition_delivery(
  p_id       uuid,
  p_to       delivery_status,
  p_actor    text,      -- 'rider', 'sender', 'system', 'admin'
  p_actor_id uuid,
  p_meta     jsonb default '{}'
)
returns deliveries
language plpgsql security definer
as $$
declare
  v_old_status delivery_status;
  v_delivery   deliveries;
begin
  -- Lock the row and capture current status
  select status into v_old_status
  from deliveries
  where id = p_id
  for update;

  if v_old_status is null then
    raise exception 'Delivery not found: %', p_id;
  end if;

  -- Validate transition
  if not exists (
    select 1 from delivery_transitions
    where from_status = v_old_status
      and to_status = p_to
      and actor = p_actor
  ) then
    raise exception 'Illegal transition % -> % by %', v_old_status, p_to, p_actor;
  end if;

  -- Apply the transition with timestamp updates
  update deliveries
  set
    status = p_to,
    picked_up_at = case when p_to = 'IN_TRANSIT' then now() else picked_up_at end,
    delivered_at = case when p_to = 'DELIVERED' then now() else delivered_at end,
    cancelled_by = case when p_to = 'CANCELLED' then p_actor else cancelled_by end,
    cancel_reason = case when p_to = 'CANCELLED' then p_meta->>'reason' else cancel_reason end
  where id = p_id
  returning * into v_delivery;

  -- Audit log
  insert into delivery_events (delivery_id, from_status, to_status, actor_id, meta)
  values (p_id, v_old_status, p_to, p_actor_id, p_meta);

  -- Side effects
  -- If rider cancels before pickup, return delivery to SEARCHING
  if p_actor = 'rider' and p_to = 'CANCELLED' and v_old_status in ('ASSIGNED', 'EN_ROUTE_TO_PICKUP') then
    update deliveries
    set status = 'SEARCHING', rider_id = null, assigned_at = null,
        cancelled_by = null, cancel_reason = null, dispatch_wave = 0
    where id = p_id
    returning * into v_delivery;

    insert into delivery_events (delivery_id, from_status, to_status, actor_id, meta)
    values (p_id, 'CANCELLED', 'SEARCHING', p_actor_id, '{"note": "rider_cancel_requeue"}'::jsonb);
  end if;

  -- Release rider when delivery is terminal
  if p_to in ('DELIVERED', 'CANCELLED', 'FAILED', 'EXPIRED') then
    update rider_presence
    set status = 'online'
    where rider_id = v_delivery.rider_id
      and status = 'busy';
  end if;

  return v_delivery;
end;
$$;


-- 5.5 verify_pickup_otp: validate and transition to IN_TRANSIT
create or replace function verify_pickup_otp(
  p_delivery_id uuid,
  p_otp         text,
  p_rider_id    uuid
)
returns boolean
language plpgsql security definer
as $$
declare
  v_delivery deliveries;
begin
  select * into v_delivery
  from deliveries
  where id = p_delivery_id
  for update;

  if v_delivery is null then
    raise exception 'Delivery not found';
  end if;

  if v_delivery.rider_id != p_rider_id then
    raise exception 'Not the assigned rider';
  end if;

  if v_delivery.status != 'AT_PICKUP' then
    raise exception 'Delivery not at pickup stage';
  end if;

  -- Verify OTP hash
  if v_delivery.pickup_otp_hash != crypt(p_otp, v_delivery.pickup_otp_hash) then
    return false;
  end if;

  -- Transition to IN_TRANSIT
  perform transition_delivery(p_delivery_id, 'IN_TRANSIT', 'rider', p_rider_id, '{"note": "pickup_otp_verified"}'::jsonb);

  return true;
end;
$$;


-- 5.6 verify_delivery_otp: validate and transition to DELIVERED
create or replace function verify_delivery_otp(
  p_delivery_id uuid,
  p_otp         text,
  p_rider_id    uuid
)
returns boolean
language plpgsql security definer
as $$
declare
  v_delivery deliveries;
begin
  select * into v_delivery
  from deliveries
  where id = p_delivery_id
  for update;

  if v_delivery is null then
    raise exception 'Delivery not found';
  end if;

  if v_delivery.rider_id != p_rider_id then
    raise exception 'Not the assigned rider';
  end if;

  if v_delivery.status != 'AT_DROPOFF' then
    raise exception 'Delivery not at dropoff stage';
  end if;

  -- Verify OTP hash
  if v_delivery.delivery_otp_hash != crypt(p_otp, v_delivery.delivery_otp_hash) then
    return false;
  end if;

  -- Transition to DELIVERED
  perform transition_delivery(p_delivery_id, 'DELIVERED', 'rider', p_rider_id, '{"note": "delivery_otp_verified"}'::jsonb);

  return true;
end;
$$;


-- 5.7 generate_otp_hash: create a hashed OTP for storage
create or replace function generate_otp_hash(p_otp text)
returns text
language sql immutable security definer
as $$
  select crypt(p_otp, gen_salt('bf', 8));
$$;


-- 5.8 get_delivery_by_token: public tracking (no auth needed)
create or replace function get_delivery_by_token(p_token text)
returns table (
  id              uuid,
  status          delivery_status,
  rider_first_name text,
  rider_rating    numeric,
  pickup_landmark text,
  dropoff_landmark text,
  created_at      timestamptz,
  assigned_at     timestamptz,
  picked_up_at    timestamptz,
  delivered_at    timestamptz
)
language sql stable security definer
as $$
  select
    d.id,
    d.status,
    left(pr.full_name, strpos(pr.full_name, ' ') - 1) as rider_first_name,
    pr.rating_avg,
    d.pickup_landmark,
    d.dropoff_landmark,
    d.created_at,
    d.assigned_at,
    d.picked_up_at,
    d.delivered_at
  from deliveries d
  left join profiles pr on pr.id = d.rider_id
  where d.tracking_token = p_token;
$$;


-- 5.9 calculate_quote: server-side pricing
create or replace function calculate_quote(
  p_pickup_lng  float8,
  p_pickup_lat  float8,
  p_dropoff_lng float8,
  p_dropoff_lat float8,
  p_weight_kg   numeric,
  p_size_class  size_class,
  p_urgency     text default 'standard'  -- 'standard' or 'asap'
)
returns jsonb
language plpgsql stable security definer
as $$
declare
  v_config       pricing_config;
  v_straight_km  numeric;
  v_est_road_km  numeric;
  v_price        numeric;
  v_size_fee     int;
  v_urgency_mult numeric;
  v_min_price    int;
  v_max_price    int;
begin
  select * into v_config from pricing_config where id = 1;

  -- Straight-line distance in km
  v_straight_km := st_distance(
    st_setsrid(st_makepoint(p_pickup_lng, p_pickup_lat), 4326)::geography,
    st_setsrid(st_makepoint(p_dropoff_lng, p_dropoff_lat), 4326)::geography
  ) / 1000.0;

  -- Estimated road distance
  v_est_road_km := v_straight_km * v_config.road_factor;

  -- Size fee
  v_size_fee := case p_size_class
    when 'S' then v_config.size_fee_s_pkr
    when 'M' then v_config.size_fee_m_pkr
    when 'L' then v_config.size_fee_l_pkr
  end;

  -- Urgency multiplier
  v_urgency_mult := case p_urgency
    when 'asap' then v_config.urgency_asap
    else v_config.urgency_standard
  end;

  -- Night/rain multiplier
  if v_config.night_rain_active then
    v_urgency_mult := v_urgency_mult * v_config.night_rain_multiplier;
  end if;

  -- Calculate price
  v_price := (
    v_config.base_fare_pkr
    + (v_config.per_km_pkr * v_est_road_km)
    + (v_config.per_extra_kg_pkr * greatest(0, p_weight_kg - v_config.weight_free_kg))
    + v_size_fee
  ) * v_urgency_mult;

  -- Round to nearest 10
  v_price := round(v_price / 10.0) * 10;

  -- Floor at min fare
  v_price := greatest(v_price, v_config.min_fare_pkr);

  -- Sender adjustment range
  v_min_price := round(v_price * (1 + v_config.sender_adjust_min_pct / 100.0));
  v_max_price := round(v_price * (1 + v_config.sender_adjust_max_pct / 100.0));

  return jsonb_build_object(
    'distance_km', round(v_est_road_km::numeric, 2),
    'suggested_price_pkr', v_price::int,
    'min_price_pkr', v_min_price,
    'max_price_pkr', v_max_price,
    'breakdown', jsonb_build_object(
      'base', v_config.base_fare_pkr,
      'distance_fee', round(v_config.per_km_pkr * v_est_road_km)::int,
      'weight_fee', round(v_config.per_extra_kg_pkr * greatest(0, p_weight_kg - v_config.weight_free_kg))::int,
      'size_fee', v_size_fee,
      'urgency_multiplier', v_urgency_mult
    )
  );
end;
$$;


-- 5.10 update_rider_rating: recalculate average after a new rating
create or replace function update_rider_rating()
returns trigger
language plpgsql security definer
as $$
begin
  update profiles
  set
    rating_avg = (
      select coalesce(avg(stars), 0) from ratings where ratee_id = NEW.ratee_id
    ),
    rating_count = (
      select count(*) from ratings where ratee_id = NEW.ratee_id
    )
  where id = NEW.ratee_id;
  return NEW;
end;
$$;

create trigger trg_update_rider_rating
after insert on ratings
for each row
execute function update_rider_rating();


-- 5.11 Auto-set updated_at on profiles and riders
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

create trigger trg_profiles_updated_at
before update on profiles
for each row execute function set_updated_at();

create trigger trg_riders_updated_at
before update on riders
for each row execute function set_updated_at();

create trigger trg_pricing_config_updated_at
before update on pricing_config
for each row execute function set_updated_at();

create trigger trg_reports_updated_at
before update on reports
for each row execute function set_updated_at();


-- ---------------------------------------------------------------------------
-- 6. Auto-create profile on signup (auth trigger)
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into profiles (id, full_name, role)
  values (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', 'User'),
    coalesce((NEW.raw_user_meta_data->>'role')::user_role, 'sender')
  );
  return NEW;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();


-- ---------------------------------------------------------------------------
-- 7. pg_cron jobs (run after extension is enabled in Supabase dashboard)
-- ---------------------------------------------------------------------------
-- These are commented out because pg_cron must be enabled in the Supabase
-- dashboard first. Uncomment and run manually after enabling.

-- Widen dispatch waves for SEARCHING deliveries (every 30 seconds)
-- select cron.schedule(
--   'dispatch-wave-expansion',
--   '*/1 * * * *',  -- every minute (pg_cron min granularity)
--   $$
--     select dispatch_delivery(id)
--     from deliveries
--     where status = 'SEARCHING'
--       and dispatch_wave < 3
--       and created_at < now() - interval '45 seconds' * dispatch_wave
--     order by created_at
--     limit 10;
--   $$
-- );

-- Expire SEARCHING deliveries after 15 minutes
-- select cron.schedule(
--   'expire-stale-deliveries',
--   '*/1 * * * *',
--   $$
--     update deliveries
--     set status = 'EXPIRED'
--     where status = 'SEARCHING'
--       and created_at < now() - interval '15 minutes';
--
--     -- Log events for expired deliveries
--     insert into delivery_events (delivery_id, from_status, to_status, actor_id, meta)
--     select id, 'SEARCHING', 'EXPIRED', null, '{"note": "auto_expired"}'::jsonb
--     from deliveries
--     where status = 'EXPIRED'
--       and id not in (
--         select delivery_id from delivery_events where to_status = 'EXPIRED'
--       );
--   $$
-- );

-- Clean up stale rider presence (offline riders with no heartbeat for 5 minutes)
-- select cron.schedule(
--   'cleanup-stale-presence',
--   '*/2 * * * *',
--   $$
--     delete from rider_presence
--     where updated_at < now() - interval '5 minutes';
--   $$
-- );

-- Purge delivery tracks older than 30 days
-- select cron.schedule(
--   'purge-old-tracks',
--   '0 3 * * *',  -- daily at 3 AM
--   $$
--     delete from delivery_tracks
--     where recorded_at < now() - interval '30 days';
--   $$
-- );

-- ---------------------------------------------------------------------------
-- 7. Auth Triggers
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'User'),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'sender')
  );
  
  if new.raw_user_meta_data->>'role' = 'rider' then
    insert into public.riders (id) values (new.id);
  end if;
  
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
