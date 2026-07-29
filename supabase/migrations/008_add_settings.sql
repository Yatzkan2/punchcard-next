-- Adds a key/value settings table for studio-wide configuration.
-- RLS restricts all access to authenticated (admin) users only.
-- Seeded with the four initial config keys.

CREATE TABLE settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read settings" ON settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can manage settings" ON settings FOR ALL USING (auth.role() = 'authenticated');

INSERT INTO settings (key, value) VALUES
  ('studio_name', ''),
  ('client_app_url', ''),
  ('admin_email', ''),
  ('cancellation_cutoff_default', '12');
