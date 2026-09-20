-- 04-recur.sql — recurrence rules covering every RuleFrequency and the calendar edges that make
-- generation interesting. Per the fixture contract (neverSeeds), no occurrences rows are written:
-- a materialised occurrence is an outcome under test, so seeds provide only the rules a generator
-- or journey would run against.
--
-- Frequency shapes (data.recur.rule invariant):
--   every-weekday : n = NULL, day_of_month = NULL
--   every-n-days  : n = positive integer, day_of_month = NULL
--   monthly-day   : day_of_month in 1..31, n = NULL

INSERT INTO recurrence_rules (id, owner, title, frequency, n, day_of_month, time_zone, time, start_date, ended_at) VALUES
  -- baseline: one rule per frequency for the walkthrough owner
  ('seed-rule-weekday',  'uat-recur', 'Standup notes',            'every-weekday', NULL, NULL, 'Asia/Ho_Chi_Minh',     '09:00', '2026-09-01', NULL),
  ('seed-rule-n-days',   'uat-recur', 'Water the plants',         'every-n-days',  3,    NULL, 'Asia/Ho_Chi_Minh',     '18:30', '2026-09-01', NULL),
  ('seed-rule-monthly',  'uat-recur', 'Pay the rent',             'monthly-day',   NULL, 5,    'Asia/Ho_Chi_Minh',     '08:00', '2026-09-01', NULL),

  -- edge: monthly-day-31 — February can never fire; the impossible-date decision says skip, never clamp
  ('seed-rule-dom31',    'uat-recur', 'Month-end review (31st)',  'monthly-day',   NULL, 31,   'UTC',                 '17:00', '2026-01-01', NULL),

  -- edge: leap-day start_date — 2024-02-29 exists, the next anniversaries must not invent 02-29/02-30
  ('seed-rule-leap',     'uat-recur', 'Leap-day checklist',       'every-n-days',  1,    NULL, 'UTC',                 '00:00', '2024-02-29', NULL),

  -- edge: DST-boundary zones — a local 09:00 in America/New_York crosses UTC-4/-5 twice a year,
  -- and Pacific/Kiritimati (UTC+14) is the earliest wall clock on earth
  ('seed-rule-dst',      'uat-recur', 'New York morning sync',    'every-weekday', NULL, NULL, 'America/New_York',     '09:00', '2026-09-01', NULL),
  ('seed-rule-kiritimati','uat-recur','First timezone standup',   'every-weekday', NULL, NULL, 'Pacific/Kiritimati',  '08:00', '2026-09-01', NULL),

  -- edge: an ended rule — ended_at is a local date that stays set forever; materialised rows after
  -- it are orphaned by end-recurrence, which is exactly why seeds carry no occurrence rows
  ('seed-rule-ended',    'uat-recur', 'Finished pilot (ended)',   'every-n-days',  2,    NULL, 'Asia/Ho_Chi_Minh',     '10:00', '2026-08-01', '2026-09-10')
ON CONFLICT (id) DO UPDATE SET
  owner = EXCLUDED.owner,
  title = EXCLUDED.title,
  frequency = EXCLUDED.frequency,
  n = EXCLUDED.n,
  day_of_month = EXCLUDED.day_of_month,
  time_zone = EXCLUDED.time_zone,
  time = EXCLUDED.time,
  start_date = EXCLUDED.start_date,
  ended_at = EXCLUDED.ended_at;
