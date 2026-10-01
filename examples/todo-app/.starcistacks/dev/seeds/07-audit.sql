-- 07-audit.sql — audit keys, a real hash-chained set of log lines, and erasure requests in every
-- NON-terminal state. The chain below is genuine: hash = sha256(prevHash|at|action|target|keyId|actor),
-- starting from the service's GENESIS sentinel, so AuditLogService.verifyChain returns valid on a
-- freshly seeded database.
--
-- Erasure states seeded: requested, verified, refused. Per the fixture contract (neverSeeds) a
-- completed erasure is an outcome under test and is never seeded; 'executing' is left to journeys
-- for the same reason. 'refused' is a refusal precondition, not the erasure outcome.

INSERT INTO audit_keys (person_id, key_id, key, created_at) VALUES
  ('uat-owner',      'key-seed-owner', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', '2026-09-01T08:00:00Z'),
  ('uat-cap-below',  'key-seed-cap',   'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210', '2026-09-01T08:00:00Z')
ON CONFLICT (person_id) DO UPDATE SET
  key_id = EXCLUDED.key_id,
  key = EXCLUDED.key,
  created_at = EXCLUDED.created_at;

-- Chain lines are only grafted onto an EMPTY table: appending seed lines under app-written rows would
-- manufacture a broken prev-hash link, which is worse than no seed lines at all. Re-running this file
-- on the seeded database is a no-op for the same reason (the rows already exist).
INSERT INTO audit_log_lines (id, at, action, target, key_id, actor, prev_hash, hash)
SELECT * FROM (VALUES
  (1::bigint, '2026-09-01T08:00:00Z'::timestamptz, 'login.signed-in', NULL::text,                'key-seed-owner', 'uat-owner',
   'GENESIS',                                                                                 'f07aac13a7c964c55c91df2abef42a1797a8ff1f2af560aaa9e87aac850c2f80'),
  (2::bigint, '2026-09-01T08:01:00Z'::timestamptz, 'task.created',    'seed-1',                 'key-seed-owner', 'uat-owner',
   'f07aac13a7c964c55c91df2abef42a1797a8ff1f2af560aaa9e87aac850c2f80',                          '1e584b8430058003beb85d12f746abe58be0887881afca5be5d2b00d1c021a2d'),
  (3::bigint, '2026-09-01T09:30:00Z'::timestamptz, 'task.completed',  'seed-3',                 'key-seed-owner', 'uat-owner',
   '1e584b8430058003beb85d12f746abe58be0887881afca5be5d2b00d1c021a2d',                          'c5e85b8b2db2ff0aadce72dd59f1688eaac2e30632388f987afac2fe444f79e0'),
  (4::bigint, '2026-09-10T12:00:00Z'::timestamptz, 'task.completed',  'seed-cap-below-done',    'key-seed-cap',   'uat-cap-below',
   'c5e85b8b2db2ff0aadce72dd59f1688eaac2e30632388f987afac2fe444f79e0',                          '901c1c2b041c51df21e91836481cea81f6c802d7a38520f3a3d90b0456fe2efe')
) AS seed(id, at, action, target, key_id, actor, prev_hash, hash)
WHERE NOT EXISTS (SELECT 1 FROM audit_log_lines)
ON CONFLICT (id) DO NOTHING;

-- Keep the bigserial sequence above the seeded ids so the next app append does not collide.
SELECT setval('audit_log_lines_id_seq', GREATEST((SELECT max(id) FROM audit_log_lines), 1));

INSERT INTO audit_erasure_requests (request_id, person_id, state, requested_at, verified_at, refused_at, executing_at, completed_at) VALUES
  -- fresh request awaiting verification
  ('seed-erasure-requested', 'uat-owner',    'requested', '2026-09-19T08:00:00Z', NULL,                   NULL, NULL, NULL),
  -- verified and ready for the complete-erasure pickup
  ('seed-erasure-verified',  'uat-cap-below','verified',  '2026-09-18T08:00:00Z', '2026-09-18T09:00:00Z', NULL, NULL, NULL),
  -- refused at verification: terminal refusal state, person_id still bound
  ('seed-erasure-refused',   'uat-pastdue',  'refused',   '2026-09-10T08:00:00Z', NULL, '2026-09-11T08:00:00Z', NULL, NULL)
ON CONFLICT (request_id) DO UPDATE SET
  person_id = EXCLUDED.person_id,
  state = EXCLUDED.state,
  requested_at = EXCLUDED.requested_at,
  verified_at = EXCLUDED.verified_at,
  refused_at = EXCLUDED.refused_at,
  executing_at = EXCLUDED.executing_at,
  completed_at = EXCLUDED.completed_at;
