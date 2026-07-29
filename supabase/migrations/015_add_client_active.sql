-- Date: 2026-07-09
-- Reason: activate/deactivate clients; inactive clients hidden from default views and cannot log in
ALTER TABLE clients ADD COLUMN active boolean DEFAULT true;
