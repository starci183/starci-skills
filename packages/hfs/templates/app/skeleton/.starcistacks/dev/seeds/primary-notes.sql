-- DEMO-ONLY note for the primary database (connection `primary`). Run after `npm run migrate` with `npm run cli -- seed run`.
-- Idempotent: an existing note is left as it is.
INSERT INTO notes (id, body, created_at) VALUES
    ('00000000-0000-4000-8000-000000000001', 'Welcome to {{project}}', '2026-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
