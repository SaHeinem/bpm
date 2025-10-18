create extension if not exists "uuid-ossp";

create type participant_status as enum ('registered', 'cancelled', 'late_joiner');
create type workflow_state as enum ('setup', 'captains_assigned', 'participants_assigned', 'finalized');

create table participants (
  id uuid primary key default uuid_generate_v4(),
  pretix_id text not null unique,
  given_name text not null,
  family_name text not null,
  attendee_name text not null,
  attendee_email text not null unique,
  is_table_captain boolean not null default false,
  captain_phone text,
  captain_preferred_contact text,
  status participant_status not null default 'registered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text not null,
  taxi_time integer check (taxi_time is null or taxi_time >= 0),
  public_transport_time integer check (public_transport_time is null or public_transport_time >= 0),
  public_transport_lines text,
  max_seats integer not null check (max_seats > 0),
  assigned_captain_id uuid references participants (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table assignments (
  id uuid primary key default uuid_generate_v4(),
  participant_id uuid not null references participants (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (participant_id)
);

create index assignments_restaurant_idx on assignments (restaurant_id);

create table event_status (
  id text primary key default 'default',
  state workflow_state not null default 'setup',
  updated_at timestamptz not null default now()
);

insert into event_status (id, state) values ('default', 'setup')
on conflict (id) do nothing;

create table event_activity (
  id uuid primary key default uuid_generate_v4(),
  event_type text not null,
  description text not null,
  actor text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger trg_participants_updated_at
before update on participants
for each row execute function set_updated_at();

create trigger trg_restaurants_updated_at
before update on restaurants
for each row execute function set_updated_at();

create table email_logs (
  id uuid primary key default uuid_generate_v4(),
  participant_id uuid not null references participants (id) on delete cascade,
  restaurant_id uuid references restaurants (id) on delete set null,
  email_type text not null check (email_type in ('initial_assignment', 'final_assignment', 'individual_update')),
  recipient_email text not null,
  subject text not null,
  body_text text not null,
  sent_at timestamptz not null default now(),
  sent_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index email_logs_participant_idx on email_logs (participant_id);
create index email_logs_sent_at_idx on email_logs (sent_at desc);
