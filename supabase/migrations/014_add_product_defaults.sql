-- Date: 2026-07-09
-- Reason: allow per-product defaults for capacity and refill count, used when creating slots or refilling passes
-- Status: PENDING

ALTER TABLE products ADD COLUMN default_capacity integer DEFAULT 10;
ALTER TABLE products ADD COLUMN default_refill integer DEFAULT 10;
