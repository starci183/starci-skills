# quality-verification — 1111111111111111111111111111111111111111

One paragraph: which delivery was verified, on which head, and what the verdict rests on. Written by
`quality.verify` as `response/response.md`. A red verdict is a complete invocation; only an inability
to reach any verdict at all is a stop.

## Binding

| Field | Value |
| --- | --- |
| Operator | `quality.verify` |
| Step | `step-1/parallel-1` |
| Checkout | `@workspaces/be` |
| Head | `1111111111111111111111111111111111111111` |
| Session branch | `session/s-1` |
| Predecessors | `step-1/parallel-1/response/response.md`, `step-1/parallel-1/response/changes.md` |

## Gate plan

| Gate | Required | Command | Configuration |
| --- | --- | --- | --- |
| `lint` | yes | `package.json#scripts.lint` | `eslint.config.mjs` |

## Results

| Gate | Status | Exit code | Evidence | Classification | Statement |
| --- | --- | --- | --- | --- | --- |
| `lint` | pass | 0 | `gates/lint.log` | — | zero errors and zero warnings |

## Coverage

| Metric | Measured | Threshold | Verdict |
| --- | --- | --- | --- |
| branches | 81.4 | 80 | at-or-above |

## Sonar

| Field | Value |
| --- | --- |
| Scope | new-code |
| Finding | — |

## Debts

| Debt | Gate | Approval | Owner | Expires | Statement |
| --- | --- | --- | --- | --- | --- |

## Findings

| Code | Gate | Statement |
| --- | --- | --- |
| `PREDECESSOR_CONSUMED` | — | the producer receipt was consumed unchanged at the frozen head |

## Verdict

| Field | Value |
| --- | --- |
| Verdict | `pass` |
