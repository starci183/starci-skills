-- volume/10-volume-tasks.sql — VOLUME TIER, applied manually (postgres' docker-entrypoint-initdb.d is
-- not recursive, so this file never runs during container init; see ../README.md).
--
-- 40 owners x 100 tasks = 4 000 task rows, evenly distributed (owner = 'uat-vol-' || (g % 40)),
-- ~20% completed with spread completed_at timestamps, titles cycling through realistic shapes
-- including the unicode/emoji edge cases so LIKE/ILIKE and sorting queries stay honest at volume.
-- Fully idempotent: ids are deterministic (vol-<n>), re-running upserts the same rows.

INSERT INTO subscriptions (id, person_id, plan, status, period_end, gateway_customer_id)
SELECT 'vol-sub-' || u, 'uat-vol-' || u, 'free', 'free', NULL, NULL
FROM generate_series(0, 39) AS u
ON CONFLICT (id) DO NOTHING;

INSERT INTO tasks (id, owner, title, complete, completed_at)
SELECT
  'vol-' || g,
  'uat-vol-' || (g % 40),
  CASE g % 6
    WHEN 0 THEN 'Volume task ' || g || ' — mua sắm cuối tuần 🛒'
    WHEN 1 THEN 'Volume task ' || g || ' — review pull request #' || (1000 + g)
    WHEN 2 THEN 'Volume task ' || g || ' — O''Neill report draft'
    WHEN 3 THEN 'Volume task ' || g || ' — 週次レビュー'
    WHEN 4 THEN 'Volume task ' || g || ' — call +84' || (900000000 + g)
    ELSE        'Volume task ' || g || ' — backlog grooming'
  END,
  (g % 5 = 0),
  CASE WHEN g % 5 = 0
       THEN ('2026-06-01T00:00:00Z'::timestamptz + (g || ' hours')::interval)
       ELSE NULL
  END
FROM generate_series(1, 4000) AS g
ON CONFLICT (id) DO UPDATE SET
  owner = EXCLUDED.owner,
  title = EXCLUDED.title,
  complete = EXCLUDED.complete,
  completed_at = EXCLUDED.completed_at;

-- A second volume table so recipient-scoped notification reads are perf-meaningful too:
-- 2 000 notifications across the same 40 owners, ~10% held in a shared digest group.
INSERT INTO notify_notifications (id, kind, recipient_id, payload, digest_group_id, created_at)
SELECT
  'vol-notif-' || g,
  'task-complete',
  'uat-vol-' || (g % 40),
  jsonb_build_object('taskId', 'vol-' || g, 'title', 'Volume task ' || g),
  CASE WHEN g % 10 = 0 THEN 'dg-vol-' || (g % 40) ELSE NULL END,
  '2026-09-01T00:00:00Z'::timestamptz + (g || ' minutes')::interval
FROM generate_series(1, 2000) AS g
ON CONFLICT (id) DO NOTHING;
