# Supabase Migration Changelog

| Date | Migration | Reason |
|------|-----------|--------|
| 2026-05-25 | 001_initial_schema.sql | Establish clients table with integer passes column as the starting schema |
| 2026-05-25 | 002_add_products_and_passes.sql | Replace single-column pass count with a products catalogue and per-product passes join table |
| 2026-05-27 | 003_add_schedule.sql | Add slots and slot_registrations tables for the studio schedule feature |
| 2026-05-27 | 004_add_attended_to_slot_registrations.sql | Patch: add attended column missing from 003 which was applied before the column was added |
| 2026-05-27 | 005_add_notes_to_slots.sql | Patch: add notes column missing from 003 which was applied before the column was added |
| 2026-05-27 | 006_fix_slots_schema.sql | Patch: slots was created with title not null instead of product_id; make title nullable and add product_id + notes |
| 2026-07-28 | 016_client_debt_rpc.sql | Add SECURITY DEFINER RPC so anonymous clients can read their own unsettled debt by code, without loosening admin-only RLS on debts |
