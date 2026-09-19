# Lane v9-9 — REPORT: implement + run `uat.identity.sign-in` against the live ecommerce stack

Date: 2026-09-19. Scope: `examples/ecommerce-app-fe/uat/flows/uat.identity.sign-in.spec.ts` (new) +
the owning records under `examples/ecommerce-app-be/.starciwork/features/identity/`
(`uat/sign-in/`, `gap/live-proof/`). Read first: `v9/_common.md`, v9-9 brief, `v7-11-REPORT.md`,
`v7-12-REPORT.md`, v9-6/v9-8 reports, the todo `uat.login.sign-in.spec.ts`/`uat.task.create.spec.ts`
style references, `fr.identity.sign-in`, `br.identity.sign-in`, `accounts.yaml`, and the v9-6
SessionForm/`/api/session` contract.

## Verdict: PASS — record settled `done`, gap closed, on a real passing run

`runs/20260919T152145Z-5c10a673/` (under `features/identity/uat/sign-in/`) walked all five authored
steps against the live shop (`npm run dev:shop`, :4069, Next dev) and identity GraphQL service
(:5070), with `result.md` `Outcome: pass`, all 10 assertions `observed: yes`, five step screenshots
(+ `screenshot.png`), a real video (`videos/sign-in.webm`, VP8 800x450 @25fps, 8.28s, 349,624 bytes —
remuxed and frame-decoded with zero errors by Playwright's bundled ffmpeg), `walk.json`,
`cleanup.json`, `readback.json` (notRun empty), `run-ledger.json`, `manifest.yaml` with per-asset
sha256. `evidence.yaml` names that run; `uat.identity.sign-in` is `state: done` with `proves:
[fr.identity.sign-in, br.identity.sign-in]` (both targets were already `done`); the stale `blockedBy`
edge was removed rather than left pointing at a closed gap; `gap.identity.live-proof` is `done`
(`closedBy` resolves, `verificationSource: authored-claim` + `because` per concept 6).

## Wait gate — executed, not skipped

Polled `ex-testing/lint/done/v9-6.done` + `v9-8.done` (plus "shop serves a working sign-in form" +
"uat/ rig exists") until all four were true. v9-8's rig landed first; v9-6's marker landed after its
shop SSR crash fix settled. The hung shop dev server on :4069 (stale `next` process, PID 15816) was
restarted via the sanctioned `npm run dev:shop` before any test ran — the form then rendered and
answered (`/en/account` 200, `form[data-state]`, labeled Email/Password, mode toggle, role="alert").

## The spec (`uat/flows/uat.identity.sign-in.spec.ts`)

Walks the record's five steps through the real UI with `walkStep` per step:

1. `register-pair` — run-scoped disposable email (`uat-person-<runId>@ecommerce.dev`, namespaced per
   the multi-lane rule) registered through the register half of the split; asserts the submit's
   "Registering…" working state (loading check) and that one `POST /api/session` produced the
   server-rendered "Signed in as …" line (completion).
2. `wrong-pair-uniform-refusal` — wrong password on the known email vs. any password on an unknown
   email: both answer 401 `INVALID_CREDENTIALS` at the door and render the *identical*
   `role="alert"` line "That email and password did not open a session." — indistinguishable,
   naming neither half (`br.identity.sign-in` / `ac.identity.sign-in.wrong-pair-is-refused-alike`).
3. `missing-half-refused` — empty password: submit stays disabled; Enter and a forced click produce
   zero `POST /api/session` calls — refused before any credential check (validation).
4. `taken-email-conflict` — re-registering the same email answers 409 `EMAIL_TAKEN` and renders
   "That email already has an account — sign in instead."; then the *first* pair signs back in
   through the sign-in half.
5. `second-sign-in-new-session` — a second sign-in issues a *different* bearer (cookie values
   compared, never written to evidence); the verify door
   (`internal/sessions/verify`, real service) reads it back live for the same personId the account
   page shows.

Honest resource accounting: `cleanup.json` records person + 3 sessions created, sessions 1–2 revoked
by the product's own sign-out and read back `SESSION_INVALID` at the verify door, session-3 and the
person row remain — exactly the record's declared `cleanup: none` (the product exposes no account
deletion; every run registers a fresh address).

## Spec repair during the lane — two failed runs kept append-only

- `runs/20260919T151633Z-5c10a673` (fail): after the 409 conflict the spec clicked
  "Already have an account? Sign in" and expected the "Welcome back" heading; the mode never
  flipped. Root cause is in the test, not the product: the grammar's `TextAction` carries a 300ms
  `pressLockRef` debounce, and on loopback the refusal roundtrip + assertions finish inside it, so
  the second press is silently swallowed. Fixed with a `switchMode` helper that retries the toggle
  while still in the source mode (the label only exists in the mode it switches from, so retries
  are safe) — the record's claims were not weakened.
- `runs/20260919T151937Z-5c10a673` (fail): the previously-restarted dev server wedged and began
  SSR-500ing every route mid-run. Killed PID 90724, restarted via `npm run dev:shop`, verified
  `/en/account` 200, re-ran.

Both folders remain untouched under `runs/` as failed history; neither settles anything.

## Gate

`node scripts/check-example-work.mjs`: **310 records, 3 refused** — none touch anything this lane
wrote. The three refusals are pre-existing, owned by other lanes:

- `checkout/impl/ecommerce-app-be/order-checkout/evidence.yaml` — stale `recordDigest` (impl index
  edited after evidence captured).
- `identity/impl/ecommerce-app-be/identity-account/evidence.yaml` — stale `recordDigest`, same
  shape.
- `identity/contract/internal/sessions/index.yaml` — `done` with no `evidence.yaml` and no
  `verificationSource: authored-claim` + `because`.

My three files (`uat/sign-in/index.yaml`, `uat/sign-in/evidence.yaml`, `gap/live-proof/index.yaml`)
parse and bind clean: `recordDigest` matches the final index bytes, `run:` resolves to a folder with
non-empty `screens/` + `videos/` and a `result.md` reading `Outcome: pass`, `closedBy`'s closer is
`done`, and no `blockedBy` edge remains on the settled record.

## What remains

- `uat.checkout.place-order` is still `todo` — v9-10's lane, gated on the order-side work.
- `ui.identity.sign-in` stays `uninvestigate`/`todo` per v9-6's own report (render proof
  incompletable on brand-record shape) — out of this lane's scope; the UAT proves behavior, not
  visual direction.
- The two failed run folders are retained as append-only history.
