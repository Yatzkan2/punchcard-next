-- Adds slots and slot_registrations tables for the studio schedule feature.

-- ─── Slots ────────────────────────────────────────────────────────────────────
-- Each row is a single bookable class or time slot.
-- product_id links the slot to the activity type (e.g. "Pilates", "Yoga").

create table slots (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  starts_at  timestamptz not null,
  capacity   integer not null default 10,
  notes      text,
  created_at timestamptz default now()
);

-- ─── Slot registrations ───────────────────────────────────────────────────────
-- Links clients to slots. One row per (client, slot) pair.
-- attended is set to true by the admin when the client shows up.

create table slot_registrations (
  id         uuid primary key default gen_random_uuid(),
  slot_id    uuid references slots(id) on delete cascade,
  client_id  uuid references clients(id) on delete cascade,
  attended   boolean not null default false,
  created_at timestamptz default now(),
  unique(slot_id, client_id)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table slots              enable row level security;
alter table slot_registrations enable row level security;

create policy "Anyone can read slots"
  on slots for select using (true);

create policy "Admins can manage slots"
  on slots for all using (auth.role() = 'authenticated');

create policy "Anyone can read slot_registrations"
  on slot_registrations for select using (true);

create policy "Admins can manage slot_registrations"
  on slot_registrations for all using (auth.role() = 'authenticated');
