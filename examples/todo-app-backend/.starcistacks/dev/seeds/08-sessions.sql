-- 08-sessions.sql — session rows in both expiry states. Tokens are opaque uuids; a live session for a
-- uat-* person is a precondition for anything that reads sessions directly. The expired row exercises
-- the "session is not active" path without waiting for real time to pass.

INSERT INTO sessions (token, person_id, issued_at, expires_at) VALUES
  -- expired: issued long ago, expiry already in the past
  ('00000000-0000-4000-8000-00000000e001', 'uat-owner', '2026-08-01T08:00:00Z', '2026-08-01T09:00:00Z'),
  -- live: far-future expiry so it stays valid no matter when the seed runs
  ('00000000-0000-4000-8000-00000000e002', 'uat-owner', '2026-09-19T08:00:00Z', '2100-01-01T00:00:00Z')
ON CONFLICT (token) DO UPDATE SET
  person_id = EXCLUDED.person_id,
  issued_at = EXCLUDED.issued_at,
  expires_at = EXCLUDED.expires_at;
