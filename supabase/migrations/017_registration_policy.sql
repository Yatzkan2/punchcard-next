-- Date: 2026-07-29
-- Reason: add registration_policy setting (strict/lenient) controlling whether clients can register without enough passes

INSERT INTO settings (key, value) VALUES ('registration_policy', 'strict') ON CONFLICT (key) DO NOTHING;
