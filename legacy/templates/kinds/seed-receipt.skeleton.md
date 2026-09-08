# seed-receipt — flow-id

One paragraph: which flow's seed was placed against which account and store, at which volume, and
what undoes it. Written by `data.seed` as `response/response.md`; read by `interface.audit`
and `uat.verify`, which measure at the volume it placed and roll back only what it lists.

## Binding

| Field | Value |
| --- | --- |
| Operator | `data.seed` |
| Step | `step-1/parallel-1` |
| Flow | `flow-id` |
| Environment | `dev` |
| Route | `project/role` |
| Account | `uat-flow-id-learner` |
| Operation | apply |
| Approval | `.stacks/dev/environment.json#sha256:0000000000000000000000000000000000000000000000000000000000000000` |
| Namespace | `uat-flow-id` |
| Seed fingerprint | `sha256:0000000000000000000000000000000000000000000000000000000000000000` |
| Drafted | no |

## Records

| Id | Store | Attribution | Rollback |
| --- | --- | --- | --- |
| `uat-flow-id-course-1` | `courses` | prefix | yes |
| `enrolment:uat-flow-id-learner` | `enrolments` | owner | yes |

## Checks

| Check | Status | Evidence |
| --- | --- | --- |
| `store-reachable` | passed | `probes/store.json` |
| `rows-attributable` | passed | every row is owned by the flow's account or carries its prefix |
| `expected-state` | passed | `db/after.json` equals `seed/expected.json` |
| `rollback-listed` | passed | the rollback set is a subset of the rows placed |

## Findings

| Code | Statement |
| --- | --- |
| `SEED_ALREADY_APPLIED` | the rows already stood in the store under this namespace; placing them again changed nothing |
