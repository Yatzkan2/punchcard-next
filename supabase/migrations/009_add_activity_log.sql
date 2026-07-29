-- Adds an activity_log table for auditing studio events.
-- INSERT is open to anonymous users so client-side actions (login, class registration)
-- can be logged without authentication. SELECT is restricted to authenticated (admin) users.

CREATE TABLE activity_log (
  id uuid primary key default gen_random_uuid(),
  studio_id text default 'default',
  event_type text not null,
  actor text not null,
  client_name text,
  description text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

CREATE INDEX idx_activity_log_created_at ON activity_log (created_at desc);
CREATE INDEX idx_activity_log_event_type ON activity_log (event_type);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read activity log" ON activity_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Anyone can insert activity log" ON activity_log FOR INSERT WITH CHECK (true);
