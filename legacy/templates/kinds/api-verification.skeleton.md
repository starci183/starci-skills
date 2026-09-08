# api-verification — paid-enrolment

One paragraph: what triggered this run, which flow's end-to-end suite it ran and at which command,
which served head answered it and which commit that head contains, what authorised its seeding and
its sign-in, and what the three lanes independently concluded. Written by `api.verify` as
`response/response.md`. The shared UAT password never appears here, in a case row, in a run record or
in the runner's output: the credential is named, and it is resolved only where the suite consumes it.

## Binding

| Field | Value |
| --- | --- |
| Run | `20260105-101500-1111111` |
| Approval | `.stacks/dev/environment.json#sha256:1111111111111111111111111111111111111111111111111111111111111111` |
| Flow | `paid-enrolment` |
| Environment | dev |
| Pinned commit | `1111111111111111111111111111111111111111` |
| Served head | `2222222222222222222222222222222222222222` |
| Served contains pinned | yes |
| Endpoint | `http://localhost:8080/api` |
| Namespace | `uat-20260105-101500-1111111` |
| Account | `learner` |
| Credential | `.stacks/dev/secrets/uat.enc`, resolved by name where the suite consumes it |
| Command | `npm run test:e2e` |
| Command source | the route's gate plan, entry `e2e` |
| Exit code | 0 |
| Run record | `.worktrees/e2e/paid-enrolment/runs/20260105-101500-1111111/result.json` |
| Latest | `20260105-101500-1111111` |

## Cases

| Case | Request | Status | Assertion | Duration | Evidence |
| --- | --- | --- | --- | --- | --- |
| `enrolment › creates a paid enrolment` | `POST /graphql createEnrolment` | pass | the enrolment is returned with the paid state | 412ms | `response/artifacts/api-output.txt#L41` |
| `enrolment › refuses a second enrolment` | `POST /graphql createEnrolment` | pass | the second attempt is refused with the conflict error | 118ms | `response/artifacts/api-output.txt#L58` |

## Lanes

| Lane | Verdict | Evidence |
| --- | --- | --- |
| `contract` | pass | `response/data/cases.json` |
| `data` | pass | `response/data/verdicts.json` |
| `lifecycle` | pass | `response/data/verdicts.json` |

## Namespace

| Record | Store | Inside | Read back |
| --- | --- | --- | --- |
| `uat-20260105-101500-1111111-enrolment-1` | `enrolments` | yes | `GET /graphql enrolment(id:)` |

## Printed

| Artifact | Why |
| --- | --- |
| `response/data/cases.json` | the per-case results, printed before the lanes were published |

## Findings

| Code | Statement |
| --- | --- |

## Fallbacks taken

| Code | Action |
| --- | --- |
