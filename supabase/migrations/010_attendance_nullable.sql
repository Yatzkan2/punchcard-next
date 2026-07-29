-- 010_attendance_nullable.sql
-- Date: 2026-06-05
-- Reason: attended needs three states — NULL (pending), true (attended), false (absent)
-- Status: PENDING
ALTER TABLE slot_registrations ALTER COLUMN attended DROP NOT NULL;
ALTER TABLE slot_registrations ALTER COLUMN attended DROP DEFAULT;
ALTER TABLE slot_registrations ALTER COLUMN attended SET DEFAULT NULL;

UPDATE slot_registrations SET attended = NULL WHERE attended = false;