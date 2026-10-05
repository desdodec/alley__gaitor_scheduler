-- Alley Gaitor Scheduler — Stage 4 draft PostgreSQL schema
-- No production database is connected yet.

create extension if not exists pgcrypto;

create type booking_status as enum ('booked', 'arrived', 'completed', 'cancelled', 'no_show');
create type recording_status as enum ('pending', 'started', 'recorded', 'processed', 'failed');
create type artwork_mode as enum ('individual', 'group');
create type relationship_type as enum ('individual', 'family', 'friends', 'colleagues', 'other');

create table bookings (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes in (5, 10, 15)),
  status booking_status not null default 'booked',
  relationship relationship_type not null,
  artwork_mode artwork_mode not null,

  -- Lead/contact data. Keep this separate from participant recordings so it can
  -- be deleted or anonymised after fulfilment without breaking the art archive.
  lead_name text not null,
  lead_email text not null,
  lead_phone text,
  address_line_1 text not null,
  address_line_2 text,
  town_city text not null,
  county text,
  postcode text not null,
  country_code char(2) not null default 'GB',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  personal_data_delete_after timestamptz
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  artwork_name text not null,
  t_shirt_size text,
  position integer not null check (position between 1 and 4),
  recording_code char(5) not null unique check (recording_code ~ '^[0-9]{5}$'),
  recording_status recording_status not null default 'pending',
  visualisation_id text,
  created_at timestamptz not null default now(),
  unique (booking_id, position)
);

create table recording_events (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  event_type text not null check (event_type in ('start', 'end')),
  occurred_at timestamptz not null default now(),
  source text not null default 'operator_web',
  unique (participant_id, event_type)
);

create table artwork_sources (
  artwork_id uuid not null,
  participant_id uuid not null references participants(id) on delete cascade,
  primary key (artwork_id, participant_id)
);

create index bookings_starts_at_idx on bookings(starts_at);
create index participants_booking_id_idx on participants(booking_id);

-- Retention/anonymisation will be implemented in application code once the
-- final policy is agreed. Production should never expose these tables directly
-- to anonymous browser clients.
