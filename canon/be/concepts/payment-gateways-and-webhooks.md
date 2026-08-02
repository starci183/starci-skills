# Payment gateways and webhooks — five gateways

Source: `src/modules/payos/`, `src/modules/sepay/`, `src/modules/stripe/`, `src/modules/paypal/`,
`src/modules/nowpayments/`, each with its own webhook controller under
`src/features/api/core/http/{payos,sepay,stripe,paypal,nowpayments}/` — see the webhook section of
[rest-controller-pattern](rest-controller-pattern.md).

## The five

- **PayOS** — domestic Vietnam, `@payos/node` v2, S3 for snapshots, client configured in
  `payos.providers.ts`.
- **Sepay** — domestic Vietnam, bank transfer. `sepay.client.ts`; its webhook payload is nested and
  needs its own parsing step.
- **Stripe / PayPal / NowPayments** — international and crypto. Each is one three-file module wrapping
  the vendor SDK, and each verifies its webhook signature the vendor's own way: a Stripe signing
  secret, a PayPal webhook id, a NowPayments IPN HMAC.

## One place records the money

Tracking is shared: the `transaction.entity.ts` entity plus the domain service under
`src/modules/bussiness/transactions/`. After verification **every** gateway writes its transaction
through that domain service. No vendor module writes its own recording logic — five copies of "what
counts as paid" is how two gateways end up disagreeing about the same order.

Alongside it: `payment-gateway.entity.ts` holds the per-gateway configuration and
`pricing-phase.entity.ts` the phase-based pricing.

## A webhook is untrusted input

Verify the signature **before** touching a transaction or granting anything, and make the handler
idempotent — vendors retry, and a retry that grants twice is a real bug rather than a theoretical one.

After verification, either grant inline (granting an AI tier, say) or hand the heavy work off — a
[CQRS event](cqrs-commands-events.md) or a [BullMQ job](background-jobs-bullmq.md) — for the
confirmation email or the enrolment sync. The vendor is waiting on the HTTP response; do not make it
wait on an SMTP round trip.
