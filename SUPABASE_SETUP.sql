create table clients (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  passes     integer not null default 0,
  entries    integer not null default 0,
  code       text unique not null,
  created_at timestamptz not null default now()
);

alter table clients enable row level security;

-- anyone (including unauthenticated) can read
create policy "clients_select_public"
  on clients for select
  using (true);

-- only authenticated users can write
create policy "clients_insert_auth"
  on clients for insert
  to authenticated
  with check (true);

create policy "clients_update_auth"
  on clients for update
  to authenticated
  using (true);

create policy "clients_delete_auth"
  on clients for delete
  to authenticated
  using (true);

CREATE TABLE products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

CREATE TABLE passes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  remaining integer default 0,
  created_at timestamptz default now(),
  unique(client_id, product_id)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read products" ON products FOR SELECT USING (true);
CREATE POLICY "Admins can manage products" ON products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Anyone can read passes" ON passes FOR SELECT USING (true);
CREATE POLICY "Admins can manage passes" ON passes FOR ALL USING (auth.role() = 'authenticated');

-- ─── Migrations (run if you already ran the setup above) ─────────────────────
-- alter table clients add column if not exists entries integer not null default 0;
-- alter table clients add constraint clients_name_unique unique (name);
