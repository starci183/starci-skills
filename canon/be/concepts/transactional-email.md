# Transactional email

Source: `src/modules/transactional-email/`, `src/modules/mailer/`, `templates/`.

`transactional-email/` is a thin coordination layer deciding the **content** of an email — which
touchpoint, which locale, which recipient. Actually sending it is `@modules/mailer`.

## The files and their touchpoints

- `pick-locale.ts` — picks the locale (vi/en) for a user, shared by every touchpoint. Mail here is
  bilingual by design, not a single hard-coded translation.
- `enqueue-learner-email.ts` — enqueues learner mail (progress, reminders, digests) through
  [background-jobs-bullmq](background-jobs-bullmq.md) and its `send-mail` processor. Nothing is sent
  synchronously in the request path.
- `submission-result-email.ts` — the result of a graded submission (challenge or milestone), fired
  once the AI or reviewer has finished.
- `grant-emails.ts` — confirmation when access is granted (a course purchase, an AI tier upgrade, a
  membership), usually triggered from
  [payment-gateways-and-webhooks](payment-gateways-and-webhooks.md) after verification.

## Templates and de-duplication

Templates are real Pug files under `templates/*.pug`, sent over SMTP through Brevo. Before sending,
check the bloom filter (`bussiness/bloom-filters/` plus
`synchronizer/processors/sync-email-bloom-filter/`) so the same touchpoint is not sent to the same
person twice.

## The boundary

This layer holds no SMTP handling and no Pug rendering — both belong to `@modules/mailer`. It decides
only what to send, to whom, and in which language.
