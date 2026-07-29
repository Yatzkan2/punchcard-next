-- Date: 2026-06-30
-- Reason: track pass debts for clients who attend a class without a valid pass, to be settled later
-- Status: PENDING

CREATE TABLE debts (
  id uuid primary key default gen_random_uuid(),
  studio_id text default 'default',
  client_id uuid references clients(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  slot_id uuid,
  created_at timestamptz default now(),
  settled boolean default false,
  settled_at timestamptz
);

CREATE INDEX idx_debts_client ON debts (client_id);
CREATE INDEX idx_debts_unsettled ON debts (client_id, settled);

ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read debts" ON debts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage debts" ON debts FOR ALL USING (auth.role() = 'authenticated');
