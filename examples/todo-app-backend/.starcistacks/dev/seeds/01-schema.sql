-- 01-schema.sql — full schema for the primary database, kept statement-for-statement identical to the
-- app's own migrations (src/modules/platform/databases/postgresql/primary/migrations/*). Every
-- statement is idempotent so this file may run in /docker-entrypoint-initdb.d on a fresh volume AND be
-- re-applied over a migrated database without drifting: the app still boots with migrationsRun: true
-- and each migration's IF NOT EXISTS / IF EXISTS clauses agree with what is already here.

CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  person_id text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_person_id_idx ON sessions (person_id);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  owner text NOT NULL,
  title text NOT NULL,
  complete boolean NOT NULL DEFAULT false
);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
CREATE INDEX IF NOT EXISTS tasks_owner_idx ON tasks (owner);

CREATE TABLE IF NOT EXISTS invitations (
  id text PRIMARY KEY,
  task_id text NOT NULL,
  owner_id text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  person_id text
);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_task_email_idx ON invitations (task_id, email);
CREATE INDEX IF NOT EXISTS invitations_task_idx ON invitations (task_id);
CREATE INDEX IF NOT EXISTS invitations_person_idx ON invitations (person_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY,
  person_id text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'free',
  period_end timestamptz,
  gateway_customer_id text
);
CREATE INDEX IF NOT EXISTS subscriptions_person_id_idx ON subscriptions (person_id);

CREATE TABLE IF NOT EXISTS payment_intents (
  id text PRIMARY KEY,
  subscription_id text NOT NULL,
  gateway text NOT NULL DEFAULT 'sepay',
  gateway_intent_id text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'VND',
  status text NOT NULL DEFAULT 'pending',
  applied_at timestamptz
);
CREATE INDEX IF NOT EXISTS payment_intents_subscription_id_idx ON payment_intents (subscription_id);
CREATE INDEX IF NOT EXISTS payment_intents_gateway_intent_id_idx ON payment_intents (gateway_intent_id);

CREATE TABLE IF NOT EXISTS notify_notifications (
  id text PRIMARY KEY,
  kind text NOT NULL,
  recipient_id text NOT NULL,
  payload jsonb NOT NULL,
  digest_group_id text,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS notify_notifications_recipient_idx ON notify_notifications (recipient_id);
CREATE INDEX IF NOT EXISTS notify_notifications_digest_group_idx ON notify_notifications (digest_group_id);

CREATE TABLE IF NOT EXISTS notify_delivery_attempts (
  notification_id text PRIMARY KEY REFERENCES notify_notifications (id),
  state text NOT NULL,
  attempt integer NOT NULL DEFAULT 0,
  failure_class text,
  started_at timestamptz,
  ended_at timestamptz,
  history jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS notify_delivery_attempts_state_idx ON notify_delivery_attempts (state);

CREATE TABLE IF NOT EXISTS notify_preferences (
  person_id text NOT NULL,
  channel text NOT NULL,
  unsubscribed boolean NOT NULL DEFAULT false,
  digest_window_minutes integer,
  PRIMARY KEY (person_id, channel)
);

CREATE TABLE IF NOT EXISTS notify_digest_windows (
  id text PRIMARY KEY,
  person_id text NOT NULL,
  channel text NOT NULL,
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  flushed_at timestamptz
);
CREATE INDEX IF NOT EXISTS notify_digest_windows_open_idx ON notify_digest_windows (person_id, channel) WHERE flushed_at IS NULL;

CREATE TABLE IF NOT EXISTS audit_log_lines (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL,
  action text NOT NULL,
  target text,
  key_id text NOT NULL,
  actor text NOT NULL,
  prev_hash text NOT NULL,
  hash text NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_log_lines_key_id_idx ON audit_log_lines (key_id);

CREATE TABLE IF NOT EXISTS audit_keys (
  person_id text PRIMARY KEY,
  key_id text NOT NULL UNIQUE,
  key text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_erasure_requests (
  request_id text PRIMARY KEY,
  person_id text,
  state text NOT NULL,
  requested_at timestamptz NOT NULL,
  verified_at timestamptz,
  refused_at timestamptz,
  executing_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS recurrence_rules (
  id text PRIMARY KEY,
  owner text NOT NULL,
  title text NOT NULL,
  frequency text NOT NULL,
  n integer,
  day_of_month integer,
  time_zone text NOT NULL,
  time text NOT NULL,
  start_date text NOT NULL,
  ended_at text
);
CREATE INDEX IF NOT EXISTS recurrence_rules_owner_idx ON recurrence_rules (owner);

CREATE TABLE IF NOT EXISTS occurrences (
  id text PRIMARY KEY,
  rule_id text NOT NULL,
  window_key text NOT NULL,
  local_date text NOT NULL,
  due_at_utc timestamptz NOT NULL,
  status text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS occurrences_window_key_key ON occurrences (window_key);
CREATE INDEX IF NOT EXISTS occurrences_rule_id_idx ON occurrences (rule_id);
