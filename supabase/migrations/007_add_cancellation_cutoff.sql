-- Adds cancellation_cutoff_hours to slots.
-- Controls how many hours before a slot starts a client can no longer cancel their registration.
-- Default 0 means cancellation is always allowed.

ALTER TABLE slots ADD COLUMN cancellation_cutoff_hours integer DEFAULT 0;
