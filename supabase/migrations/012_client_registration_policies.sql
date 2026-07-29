-- Date: 2026-06-06
-- Reason: clients are anonymous; RLS blocks their register/cancel. Allow anon INSERT + DELETE only. UPDATE stays admin-only.
-- Status: PENDING

CREATE POLICY "Anyone can register" ON slot_registrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can cancel" ON slot_registrations FOR DELETE USING (true);
