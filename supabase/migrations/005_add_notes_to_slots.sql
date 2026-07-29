-- DO NOT RUN — already applied manually on 2026-05-27.
-- Adds the notes column that was missing when 003 was first applied.
-- 003 was run before notes was added to the slots definition.

alter table slots add column notes text;
