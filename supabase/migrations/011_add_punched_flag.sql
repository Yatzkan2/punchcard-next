-- 011_add_punched_flag.sql
-- Date: 2026-06-05
-- Reason: track whether a pass was deducted for a given registration to prevent double-punching the same client in the same class
-- Status: PENDING

ALTER TABLE slot_registrations ADD COLUMN punched boolean DEFAULT false;
