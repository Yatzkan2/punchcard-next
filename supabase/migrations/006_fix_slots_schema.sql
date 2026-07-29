-- DO NOT RUN — already applied manually on 2026-05-27.
-- Fixes slots table that was created from the first draft of 003 which had
-- a required title column instead of product_id + notes.

-- Make title nullable (it is unused; product name comes from the products join)
alter table slots alter column title drop not null;

-- Add the product_id FK and notes column that the final 003 design requires
alter table slots add column if not exists product_id uuid references products(id) on delete set null;
alter table slots add column if not exists notes text;
