-- DO NOT RUN — already applied manually on 2026-05-27.
-- Adds the attended column that was missing when 003 was first applied.
-- 003 was run before attended was added to the slot_registrations definition.

alter table slot_registrations add column attended boolean not null default false;
