-- data.upload.upload's table, seeded the same belt-and-braces way 01-schema.sql seeds `tasks`: the
-- container initdb runs this before the api ever boots, and the matching TypeORM migration
-- (1758300000000-create-uploads-table.ts) is idempotent, so the two agree instead of fighting.
-- No row seeds on purpose: an upload row points at bytes behind the storage adapter, and SQL initdb
-- cannot write into the api's upload directory - a seeded row with no object would be fake evidence.
CREATE TABLE IF NOT EXISTS uploads (
  id text PRIMARY KEY,
  owner text NOT NULL,
  task_id text,
  filename text NOT NULL,
  mime text NOT NULL,
  size_bytes integer NOT NULL,
  storage_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS uploads_owner_idx ON uploads (owner);
CREATE INDEX IF NOT EXISTS uploads_task_id_idx ON uploads (task_id);
