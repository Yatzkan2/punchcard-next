
# Database Migration Guide for Coding Agents

## Context

This project uses Supabase (Postgres) with manual migrations.
Migrations are plain SQL files run manually in the Supabase SQL editor.
There is no CLI or automated runner — the agent writes the file, the human runs it.

---

## Migration folder structure

```
supabase/
  migrations/
    001_initial_schema.sql
    002_[description].sql
    003_[description].sql
  CHANGELOG.md
  MIGRATION_GUIDE.md
```

---

## Rules — follow every time, no exceptions

1. **Never edit an existing migration file.** If a mistake was made, write a new migration that corrects it.
2. **Never drop a column in the same migration you backed it up.** Always wait for the next migration.
3. **Always back up before altering or dropping.** Add a `_backup` column, copy the data, then make the change.
4. **Always migrate data before destructive changes.** Move data out of old columns before dropping anything.
5. **One migration per feature.** Don't bundle unrelated changes in one file.
6. **Comment the why, not the what.** The SQL explains what happens. The comment explains why.
7. **Mark already-applied migrations.** If documenting a migration that already ran manually, add a warning at the top.

---

## Every migration file follows 3 steps

### Step 1 — Schema change + backup

Add the new structure. If an existing column will be dropped or altered, back it up first.

```sql
-- backup any column being altered or dropped
ALTER TABLE [table] ADD COLUMN [column]_backup [type];
UPDATE [table] SET [column]_backup = [column];

-- new schema changes
ALTER TABLE [table] ADD COLUMN [new_column] [type];
```

### Step 2 — Data migration

Move or transform data from old structure to new. Always do this before any destructive change.

```sql
-- migrate data from old structure to new
UPDATE [table]
SET [new_column] = [transformation of old column]
WHERE [condition];

-- or insert into a new related table
INSERT INTO [new_table] ([col1], [col2])
SELECT [old_col1], [old_col2]
FROM [old_table];
```

### Step 3 — Cleanup (next migration)

Drop backup columns in a separate migration only after the human has verified data is correct.

```sql
-- confirmed previous migration successful
-- dropping backup columns

ALTER TABLE [table] DROP COLUMN [column]_backup;
```

---

## File naming convention

```
001_initial_schema.sql
002_[short_description].sql
003_drop_[something]_backup.sql
```

- Lowercase, underscores, no spaces
- Number prefix determines run order
- Name describes what changes, not why

---

## Required comment header on every file

```sql
-- [number]_[name].sql
-- Date: YYYY-MM-DD
-- Reason: one line explaining why this change exists
-- Status: PENDING | APPLIED MANUALLY on YYYY-MM-DD | DO NOT RUN (already applied)
```

---

## CHANGELOG.md — update on every migration

```
YYYY-MM-DD | 001_initial_schema.sql   | description of what changed and why
YYYY-MM-DD | 002_[name].sql           | description of what changed and why
```

---

## Responsibilities

| Agent                                        | Human                                      |
| -------------------------------------------- | ------------------------------------------ |
| Writes the migration SQL file                | Reviews the file                           |
| Updates CHANGELOG.md                         | Copies and pastes SQL into Supabase editor |
| Marks status in file header                  | Runs it and verifies data in table editor  |
| Updates app code to match new schema         | Confirms backup columns can be dropped     |
| Writes cleanup migration when human confirms | Pushes to GitHub                           |

---

## Documenting a migration that already ran manually

If a schema change was already applied directly in Supabase without a migration file, document it retroactively:

```sql
-- [number]_[name].sql
-- Date: YYYY-MM-DD
-- Reason: [why]
-- Status: DO NOT RUN — already applied manually on YYYY-MM-DD

-- NOTE: describe what was done manually and whether
-- data migration was automated or done by hand.

-- schema changes that were applied:
...
```

---

## When in doubt

- If the migration touches a lot of data → test on a separate Supabase project first
- If unsure whether to drop the backup → wait one more migration
- If the change is complex → split it into more smaller files
- If something already ran manually → document it with DO NOT RUN status, never skip it
