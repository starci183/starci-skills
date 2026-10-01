-- 05-share.sql — shared tasks and invitations in every non-outcome state. Per the fixture contract
-- (neverSeeds) no invitation is seeded 'accepted': acceptance is an outcome under test. Seeds provide
-- the preconditions journeys exercise: a live pending invite, one just inside the 14-day expiry
-- horizon, one already past it (the lazy t-expire read path re-derives 'expired' on read), and a
-- revoked invite (the re-invite precondition — invite() flips a revoked row back to pending).

INSERT INTO tasks (id, owner, title, complete, completed_at) VALUES
  ('seed-share-task-1', 'uat-share', 'Shared: launch checklist',   false, NULL),
  ('seed-share-task-2', 'uat-share', 'Shared: budget worksheet',   false, NULL),
  ('seed-share-task-3', 'uat-share', 'Shared: conference booth',   false, NULL)
ON CONFLICT (id) DO UPDATE SET owner = EXCLUDED.owner, title = EXCLUDED.title,
  complete = EXCLUDED.complete, completed_at = EXCLUDED.completed_at;

INSERT INTO invitations (id, task_id, owner_id, email, role, status, sent_at, accepted_at, revoked_at, person_id) VALUES
  -- live pending, sent just now relative to seed time
  ('seed-inv-pending',    'seed-share-task-1', 'uat-share', 'viewer1@todo.dev',  'viewer', 'pending', '2026-09-18T09:00:00Z', NULL, NULL, NULL),
  -- pending but sent 13 days ago — one day inside the 14-day expiry horizon
  ('seed-inv-nearexpiry', 'seed-share-task-1', 'uat-share', 'editor1@todo.dev',  'editor', 'pending', '2026-09-06T09:00:00Z', NULL, NULL, NULL),
  -- pending but sent 30 days ago — already past EXPIRY_DAYS; reads back as 'expired'
  ('seed-inv-expired',    'seed-share-task-2', 'uat-share', 'ghost@todo.dev',    'viewer', 'pending', '2026-08-20T09:00:00Z', NULL, NULL, NULL),
  -- revoked while still pending: revoked_at set, person_id never bound
  ('seed-inv-revoked',    'seed-share-task-3', 'uat-share', 'former@todo.dev',   'editor', 'revoked', '2026-09-01T09:00:00Z', NULL, '2026-09-05T09:00:00Z', NULL)
ON CONFLICT (id) DO UPDATE SET
  task_id = EXCLUDED.task_id,
  owner_id = EXCLUDED.owner_id,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  sent_at = EXCLUDED.sent_at,
  accepted_at = EXCLUDED.accepted_at,
  revoked_at = EXCLUDED.revoked_at,
  person_id = EXCLUDED.person_id;
