-- 06-notify.sql — notification preferences, notifications, delivery attempts and digest windows.
-- Covers every delivery state (queued/sending/delivered/bounced/suppressed) and every failure_class
-- the schema allows, plus a flushed digest window and an open one, and preference rows for the
-- unsubscribed and custom-digest-window branches.

INSERT INTO notify_preferences (person_id, channel, unsubscribed, digest_window_minutes) VALUES
  ('uat-notify',            'email', false, NULL),  -- subscribed, default digest window
  ('uat-notify-unsub',      'email', true,  NULL),  -- unsubscribed: delivery must suppress
  ('uat-notify-digest',     'email', false, 30),    -- custom 30-minute digest window
  ('uat-notify-multichan',  'email', false, NULL),
  ('uat-notify-multichan',  'push',  false, 15)
ON CONFLICT (person_id, channel) DO UPDATE SET
  unsubscribed = EXCLUDED.unsubscribed,
  digest_window_minutes = EXCLUDED.digest_window_minutes;

INSERT INTO notify_notifications (id, kind, recipient_id, payload, digest_group_id, created_at) VALUES
  ('seed-notif-1', 'task-complete', 'uat-notify',        '{"taskId":"seed-3","title":"Book dentist appointment"}',            NULL,            '2026-09-18T10:00:00Z'),
  ('seed-notif-2', 'task-complete', 'uat-notify',        '{"taskId":"seed-5","title":"Archive 2025 tax receipts"}',           'dg-seed-1',     '2026-09-18T10:05:00Z'),
  ('seed-notif-3', 'task-complete', 'uat-notify',        '{"taskId":"seed-1","title":"Read the layout specification"}',       'dg-seed-1',     '2026-09-18T10:06:00Z'),
  ('seed-notif-4', 'task-complete', 'uat-notify-unsub',  '{"taskId":"seed-x","title":"Suppressed by preference"}',            NULL,            '2026-09-18T10:10:00Z'),
  ('seed-notif-5', 'task-complete', 'uat-notify-digest', '{"taskId":"seed-y","title":"Held for digest flush"}',               'dg-seed-open',  '2026-09-18T10:15:00Z')
ON CONFLICT (id) DO UPDATE SET
  kind = EXCLUDED.kind,
  recipient_id = EXCLUDED.recipient_id,
  payload = EXCLUDED.payload,
  digest_group_id = EXCLUDED.digest_group_id,
  created_at = EXCLUDED.created_at;

-- One notification per delivery state; history mirrors the transitions that produced the state.
INSERT INTO notify_delivery_attempts (notification_id, state, attempt, failure_class, started_at, ended_at, history) VALUES
  ('seed-notif-1', 'delivered',  1, NULL,                 '2026-09-18T10:00:01Z', '2026-09-18T10:00:02Z',
   '[{"state":"queued","at":"2026-09-18T10:00:00Z"},{"state":"sending","at":"2026-09-18T10:00:01Z"},{"state":"delivered","at":"2026-09-18T10:00:02Z"}]'),
  ('seed-notif-2', 'queued',     0, NULL,                 NULL,                   NULL,
   '[{"state":"queued","at":"2026-09-18T10:05:00Z"}]'),
  ('seed-notif-3', 'sending',    1, NULL,                 '2026-09-18T10:06:01Z', NULL,
   '[{"state":"queued","at":"2026-09-18T10:06:00Z"},{"state":"sending","at":"2026-09-18T10:06:01Z"}]'),
  ('seed-notif-4', 'suppressed', 0, 'unsubscribed',       NULL,                   '2026-09-18T10:10:01Z',
   '[{"state":"queued","at":"2026-09-18T10:10:00Z"},{"state":"suppressed","at":"2026-09-18T10:10:01Z","failureClass":"unsubscribed"}]'),
  ('seed-notif-5', 'bounced',    3, 'retries-exhausted',  '2026-09-18T10:15:01Z', '2026-09-18T10:20:00Z',
   '[{"state":"queued","at":"2026-09-18T10:15:00Z"},{"state":"sending","at":"2026-09-18T10:15:01Z"},{"state":"queued","at":"2026-09-18T10:15:02Z","failureClass":"transient"},{"state":"sending","at":"2026-09-18T10:17:00Z"},{"state":"queued","at":"2026-09-18T10:17:01Z","failureClass":"transient"},{"state":"sending","at":"2026-09-18T10:19:30Z"},{"state":"bounced","at":"2026-09-18T10:20:00Z","failureClass":"retries-exhausted"}]')
ON CONFLICT (notification_id) DO UPDATE SET
  state = EXCLUDED.state,
  attempt = EXCLUDED.attempt,
  failure_class = EXCLUDED.failure_class,
  started_at = EXCLUDED.started_at,
  ended_at = EXCLUDED.ended_at,
  history = EXCLUDED.history;

INSERT INTO notify_digest_windows (id, person_id, channel, opens_at, closes_at, flushed_at) VALUES
  -- already flushed: dg-seed-1's notifications rode this window out
  ('seed-dgwin-flushed', 'uat-notify',        'email', '2026-09-18T10:00:00Z', '2026-09-18T10:30:00Z', '2026-09-18T10:30:00Z'),
  -- still open: dg-seed-open's notification is waiting for this window to close
  ('seed-dgwin-open',    'uat-notify-digest', 'email', '2026-09-18T10:15:00Z', '2026-09-18T10:45:00Z', NULL)
ON CONFLICT (id) DO UPDATE SET
  person_id = EXCLUDED.person_id,
  channel = EXCLUDED.channel,
  opens_at = EXCLUDED.opens_at,
  closes_at = EXCLUDED.closes_at,
  flushed_at = EXCLUDED.flushed_at;
