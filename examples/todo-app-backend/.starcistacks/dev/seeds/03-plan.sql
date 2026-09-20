-- 03-plan.sql — subscriptions and payment intents. Covers every effective-plan branch the cap guard
-- and usage screens read: no row at all (implicit free, e.g. uat-cap-*), free, active paid, past-due
-- (still effective paid per SubscriptionService), and intents in each gateway outcome
-- (pending / paid / failed).

INSERT INTO subscriptions (id, person_id, plan, status, period_end, gateway_customer_id) VALUES
  ('seed-sub-free',     'uat-owner',   'free', 'free',     NULL,                    NULL),
  ('seed-sub-paid',     'uat-paid',    'paid', 'active',   '2026-10-01T00:00:00Z',  'sepay-cust-demo-1'),
  ('seed-sub-pastdue',  'uat-pastdue', 'paid', 'past-due', '2026-09-15T00:00:00Z',  'sepay-cust-demo-2')
ON CONFLICT (id) DO UPDATE SET
  person_id = EXCLUDED.person_id,
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  period_end = EXCLUDED.period_end,
  gateway_customer_id = EXCLUDED.gateway_customer_id;

INSERT INTO payment_intents (id, subscription_id, gateway, gateway_intent_id, amount, currency, status, applied_at) VALUES
  ('seed-pay-paid',    'seed-sub-paid',    'sepay', 'sepay-intent-demo-paid',    49000, 'VND', 'paid',    '2026-09-01T00:05:00Z'),
  ('seed-pay-pending', 'seed-sub-pastdue', 'sepay', 'sepay-intent-demo-pending', 49000, 'VND', 'pending', NULL),
  ('seed-pay-failed',  'seed-sub-pastdue', 'sepay', 'sepay-intent-demo-failed',  49000, 'VND', 'failed',  NULL)
ON CONFLICT (id) DO UPDATE SET
  subscription_id = EXCLUDED.subscription_id,
  gateway = EXCLUDED.gateway,
  gateway_intent_id = EXCLUDED.gateway_intent_id,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  status = EXCLUDED.status,
  applied_at = EXCLUDED.applied_at;
