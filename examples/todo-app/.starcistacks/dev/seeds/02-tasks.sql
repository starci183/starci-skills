-- 02-tasks.sql — baseline + edge-case task rows. All owners live in the fixture namespace
-- (owner LIKE 'uat-%', see .starciwork/_resources/fixtures/todo-app-seed/resource.yaml) so journeys
-- running as realm users never collide with seeded rows. Re-runnable: every insert upserts on the
-- primary key, so a re-applied seed converges drifted rows back to the seed-owned shape.

-- Baseline: the original smoke row plus a realistic mixed list for the walkthrough owner.
INSERT INTO tasks (id, owner, title, complete, completed_at) VALUES
  ('seed-1',        'uat-owner', 'Read the layout specification', false, NULL),
  ('seed-2',        'uat-owner', 'Water the balcony plants',      false, NULL),
  ('seed-3',        'uat-owner', 'Book dentist appointment',      true,  '2026-09-01T09:30:00Z'),
  ('seed-4',        'uat-owner', 'Renew domain before expiry',    false, NULL),
  ('seed-5',        'uat-owner', 'Archive 2025 tax receipts',     true,  '2026-08-20T15:04:11Z')
ON CONFLICT (id) DO UPDATE SET
  owner = EXCLUDED.owner,
  title = EXCLUDED.title,
  complete = EXCLUDED.complete,
  completed_at = EXCLUDED.completed_at;

-- Edge cases owned by uat-edge: unicode/emoji, max-length, whitespace-padded, quotes/backslashes,
-- and a completion timestamp sitting exactly on a UTC day boundary.
INSERT INTO tasks (id, owner, title, complete, completed_at) VALUES
  ('seed-edge-unicode',   'uat-edge', 'Hôm nay học tiếng Việt — д и 中文 — العربية', false, NULL),
  ('seed-edge-emoji',     'uat-edge', 'Ship release 🚀🎉 — review ✅ tests 🧪',        false, NULL),
  ('seed-edge-maxlength', 'uat-edge',
   repeat('x', 400), false, NULL),
  ('seed-edge-padded',    'uat-edge', '   title stored verbatim, padding kept   ',     false, NULL),
  ('seed-edge-quotes',    'uat-edge', 'O''Brian said "merge \features\w8" <today>',    false, NULL),
  ('seed-edge-boundary',  'uat-edge', 'Completed exactly at a UTC day boundary',       true,  '2026-09-19T00:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  owner = EXCLUDED.owner,
  title = EXCLUDED.title,
  complete = EXCLUDED.complete,
  completed_at = EXCLUDED.completed_at;

-- Plan-cap boundary (free cap = 20 open tasks, br.plan.active-scope: completed rows never count):
--   uat-cap-below : 19 open + 1 complete -> next create still allowed (under-cap seam)
--   uat-cap-at    : exactly 20 open      -> next create is refused (precondition for the fired cap;
--                                          the refusal itself is a runtime outcome, never seeded)
--   uat-paid      : 25 open under a paid subscription -> proves the cap does not bind paid owners
INSERT INTO tasks (id, owner, title, complete, completed_at)
SELECT 'seed-cap-below-' || g, 'uat-cap-below', 'Open task ' || g || ' (under cap)', false, NULL
FROM generate_series(1, 19) AS g
ON CONFLICT (id) DO UPDATE SET owner = EXCLUDED.owner, title = EXCLUDED.title,
  complete = EXCLUDED.complete, completed_at = EXCLUDED.completed_at;

INSERT INTO tasks (id, owner, title, complete, completed_at) VALUES
  ('seed-cap-below-done', 'uat-cap-below', 'Already done - does not count toward the cap', true, '2026-09-10T12:00:00Z')
ON CONFLICT (id) DO UPDATE SET owner = EXCLUDED.owner, title = EXCLUDED.title,
  complete = EXCLUDED.complete, completed_at = EXCLUDED.completed_at;

INSERT INTO tasks (id, owner, title, complete, completed_at)
SELECT 'seed-cap-at-' || g, 'uat-cap-at', 'Open task ' || g || ' (at free cap)', false, NULL
FROM generate_series(1, 20) AS g
ON CONFLICT (id) DO UPDATE SET owner = EXCLUDED.owner, title = EXCLUDED.title,
  complete = EXCLUDED.complete, completed_at = EXCLUDED.completed_at;

INSERT INTO tasks (id, owner, title, complete, completed_at)
SELECT 'seed-paid-' || g, 'uat-paid', 'Paid-tier task ' || g, false, NULL
FROM generate_series(1, 25) AS g
ON CONFLICT (id) DO UPDATE SET owner = EXCLUDED.owner, title = EXCLUDED.title,
  complete = EXCLUDED.complete, completed_at = EXCLUDED.completed_at;
