# backend-plan — feature-id

One paragraph: which frozen decision was read and at which fingerprint, how many operations it
carries, how many modules the plan groups them into, and which module runs after which. Written by
`backend.plan` as `response/response.md`; every Modules row has an entry with the same id and goal in
`response/data/units.json`, every contract operation sits in exactly one row, and each module is
filled on its own branch by the generator under scope full.

## Modules

| Module | Goal | Operations | Stores | Proofs | Migrations |
| --- | --- | --- | --- | --- | --- |
| `enrolment` | a viewer's enrolment is created and cancelled inside the enrolment writer | `enrol-course`, `cancel-enrolment` | `enrolments` | `unit`, `integration` | — |
| `access` | paid access is granted from an enrolment through the access writer | `grant-access` | `access` | `unit`, `migration-replay` | `migrations/grant-access` |

## Order

| Module | After |
| --- | --- |
| `access` | `enrolment` |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |
