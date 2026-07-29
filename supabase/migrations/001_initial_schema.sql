-- Initial schema — clients table with a single integer passes column.
-- This predates the products table and the separate passes join table.
-- Punches were recorded by decrementing clients.passes directly.

create table clients (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  passes     integer not null default 0,
  code       text unique not null,
  created_at timestamptz not null default now()
);

alter table clients enable row level security;

create policy "clients_select_public"
  on clients for select
  using (true);

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
