# Hit the cap, get refused, upgrade, create past it

Flow: `uat.plan.upgrade-after-cap`  Run: `20260919T143402Z-5c10a673`  Outcome: fail

## Steps walked
- `owner-signed-in` (2026-09-19T14:34:02.925Z -> 2026-09-19T14:34:03.573Z)
- `owner-seeded-to-cap` (2026-09-19T14:34:03.625Z -> 2026-09-19T14:34:03.822Z)
- `usage-shows-at-cap` (2026-09-19T14:34:03.872Z -> 2026-09-19T14:34:03.982Z)
- `twenty-first-create-refused` (2026-09-19T14:34:04.022Z -> 2026-09-19T14:34:04.248Z)
- `upgrade-action-refused-at-gateway` (2026-09-19T14:34:04.294Z -> 2026-09-19T14:34:05.902Z)
- `run-tasks-deleted-and-verified-absent` (2026-09-19T14:34:05.939Z -> 2026-09-19T14:34:06.052Z)

## Assertions
- `fr.plan.usage.view`: expected yes, observed yes - planUsage rendered data-state="at-cap" with the cap (20) named in the cap sentence and the "Upgrade plan" action present. This is the record's step-1 expectation: the usage screen shows the at-cap state.
- `ac.plan.caps.limit.refuses-over-cap`: expected yes, observed yes - The 21th create was refused before anything was written: PLAN_CAP_EXCEEDED - "The free plan holds at most 20 active tasks. Upgrade at /plan/usage to create more." - naming the cap of 20 and the upgrade path /plan/usage. The title never appears in the list and a correctly-headed tasks read-back returns no such row.
- `ux.plan.create-refusal-feedback`: expected yes, observed no - The task screen renders no error feedback for the refused create: TaskListBlock.onCreate drops the mutation rejection (src/components/blocks/task-list/index.tsx never reads createTask.error), the submitted title stays in the input and no alert or banner appears - matching ui.task.list's own state vocabulary (empty, one-task, many-tasks, refused-for-read), which names no create-refusal state. The cap-and-upgrade naming a person can actually read is on /plan/usage, which the previous step walked.
- `ux.plan.checkout-refusal-surface`: expected yes, observed yes - The at-cap surface's "Upgrade plan" action was exercised; the app's own upgradePlan call answered SePay create-intent failed: empty body (HTTP 404; no credential is configured; https://my.sepay.vn). The surface rendered its checkout-refusal sentence; psql read-back: payment_intents 0 -> 0, subscription status free -> free (unchanged - the refused start wrote nothing, matching UpgradePlanHandler's gateway-call-first ordering).
- `fr.plan.upgrade`: expected yes, observed not-run - The record's checkout leg - complete at the gateway sandbox, webhook confirms, the cap lifts, the 21st task lands - is not walked: the owner directive forbids simulating the signed webhook, and the live leg cannot complete (the app's own call above carried the gateway's real answer). The upgrade-path surface the app does serve - the at-cap sentence and the exercised Upgrade action's refusal - is what this run proves.
- `integration.plan.sepay`: expected yes, observed not-run - The live SePay leg stays unproven (gap.plan.sepay-not-reachable): this run's upgradePlan call returned "SePay create-intent failed: empty body (HTTP 404; no credential is configured; https://my.sepay.vn)", matching the gap's measured absences - no real credential is configured and the create-intent route is not served by the provider. No webhook was simulated and no fake gateway stood in.

## Redaction
Every screenshot and video frame was reviewed for the password field, which Playwright masks at capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.