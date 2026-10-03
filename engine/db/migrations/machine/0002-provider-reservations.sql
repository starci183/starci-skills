-- Additive host provider/account admission receipts. Slot units are concurrent launches,
-- never provider tokens, credits or measured spend. Released receipts retain attempt identity.
CREATE TABLE provider_reservations(
  fence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  attempt_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  account TEXT NOT NULL,
  model TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('kernel','op','supervisor','worker','critic')),
  scope_json TEXT,
  state TEXT NOT NULL CHECK(state IN ('reserved','launching','live','unknown','released')),
  slots INTEGER NOT NULL DEFAULT 1 CHECK(slots=1),
  max_parallel INTEGER NOT NULL CHECK(max_parallel>=0),
  quota_json TEXT,
  estimate_json TEXT,
  override_json TEXT,
  launch_identity TEXT,
  host_request_id TEXT,
  handle TEXT,
  pid INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  released_at INTEGER,
  proof_json TEXT
) STRICT;
CREATE INDEX provider_reservations_active ON provider_reservations(provider,account,state);
CREATE TABLE provider_reservation_events(
  id INTEGER PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES provider_reservations(id),
  at INTEGER NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  proof_json TEXT
) STRICT;
