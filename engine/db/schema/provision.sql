-- Standalone provider operations live in the project ledger without synthetic workflows.
CREATE TABLE IF NOT EXISTS provision_operations(
  operation_id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  transport TEXT NOT NULL CHECK(transport IN ('http','native')),
  endpoint_identity TEXT NOT NULL CHECK(length(endpoint_identity)=64),
  coordination_key TEXT NOT NULL CHECK(length(coordination_key)=64),
  plan_sha TEXT NOT NULL REFERENCES blobs(sha256),
  state TEXT NOT NULL CHECK(state IN ('planned','accepted','running','applied','verified','failed','unknown','partial')),
  accepted_by TEXT,
  approval_ref TEXT,
  receipt_sha TEXT REFERENCES blobs(sha256),
  metadata_sha TEXT REFERENCES blobs(sha256),
  code TEXT NOT NULL,
  write_ack INTEGER NOT NULL DEFAULT 0 CHECK(write_ack IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  accepted_at INTEGER,
  generation INTEGER NOT NULL DEFAULT 0,
  owner_pid INTEGER) STRICT;
CREATE INDEX IF NOT EXISTS provision_operations_target ON provision_operations(coordination_key,updated_at);
CREATE TABLE IF NOT EXISTS provision_events(
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  operation_id TEXT NOT NULL REFERENCES provision_operations(operation_id),
  kind TEXT NOT NULL,
  state TEXT NOT NULL,
  receipt_sha TEXT REFERENCES blobs(sha256),
  prev_digest TEXT,
  digest TEXT NOT NULL CHECK(length(digest)=64),
  created_at INTEGER NOT NULL) STRICT;
CREATE TRIGGER IF NOT EXISTS provision_events_append_only_update BEFORE UPDATE ON provision_events BEGIN
  SELECT RAISE(ABORT,'provision events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS provision_events_append_only_delete BEFORE DELETE ON provision_events BEGIN
  SELECT RAISE(ABORT,'provision events are append-only');
END;
INSERT OR IGNORE INTO blob_ref_columns(table_name,column_name) VALUES
  ('provision_operations','plan_sha'),('provision_operations','receipt_sha'),
  ('provision_operations','metadata_sha'),('provision_operations','approval_ref'),('provision_events','receipt_sha');
