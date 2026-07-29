-- DO NOT RUN — already applied manually on 2026-05-25.
-- This file documents the migration for historical reference only.

-- ─── Section 1: Schema changes ────────────────────────────────────────────────
-- Added the products and passes tables, and backed up the old integer passes
-- column before it was removed.

-- alter table clients add column passes_backup integer;
-- update clients set passes_backup = passes;

-- create table products (
--   id         uuid primary key default gen_random_uuid(),
--   name       text not null unique,
--   created_at timestamptz default now()
-- );

-- create table passes (
--   id         uuid primary key default gen_random_uuid(),
--   client_id  uuid references clients(id) on delete cascade,
--   product_id uuid references products(id) on delete cascade,
--   remaining  integer default 0,
--   created_at timestamptz default now(),
--   unique(client_id, product_id)
-- );

-- alter table products enable row level security;
-- alter table passes enable row level security;

-- create policy "Anyone can read products" on products for select using (true);
-- create policy "Admins can manage products" on products for all using (auth.role() = 'authenticated');
-- create policy "Anyone can read passes" on passes for select using (true);
-- create policy "Admins can manage passes" on passes for all using (auth.role() = 'authenticated');


-- ─── Section 2: Data migration ────────────────────────────────────────────────
-- No automated data transfer was written.
-- Existing client pass counts were re-entered manually via the admin UI
-- after the new products and passes tables were in place.


-- ─── Section 3: Cleanup ───────────────────────────────────────────────────────
-- Dropped the original integer passes column from clients once data was
-- confirmed correct in the new passes table.

-- alter table clients drop column passes;
-- alter table clients drop column passes_backup;
