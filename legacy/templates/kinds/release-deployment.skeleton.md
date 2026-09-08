# release-deployment — release:2026.01.10-1

One paragraph: which immutable release reached which target, under which authorization, and what the
steady state rests on. Written by `release.deploy` as `response/response.md`. A rolled-back run is a
terminal outcome of its own and never reads as delivery of the release it rejected.

## Binding

| Field | Value |
| --- | --- |
| Operator | `release.deploy` |
| Step | `step-1/parallel-1` |
| Project | `project` |
| Release | `release:2026.01.10-1` |
| Artifact | `@remote/ghcr/project/api` |
| Digest | `sha256:1111111111111111111111111111111111111111111111111111111111111111` |
| Target | `production/api` |
| Environment | production |
| Replaced release | `release:2026.01.03-2` |
| Approval | `@worktrees/businesses/features/release/model.json#deploy-grant` |
| Manifest | `.stacks/production/api.manifest.json` |
| Steady deadline | 600 |
| Rollback identity | `release:2026.01.03-2` |

## Outcome

| Field | Value |
| --- | --- |
| Outcome | deployed |
| Branch | none |

## Steps

| Step | State | Revision before | Revision after | Statement |
| --- | --- | --- | --- | --- |
| `authorize` | applied | — | — | the declared grant covers this project, environment and target |
| `rollout` | applied | 4 | 5 | the target moved to the immutable digest |
| `monitor` | applied | — | — | the window was observed to its end |

## Monitoring

| Field | Value |
| --- | --- |
| Deadline | 600 |
| Elapsed | 420 |
| Backoff | 30 |
| Final condition | steady |

## Steady state

| Metric | Value |
| --- | --- |
| Active digest | `sha256:1111111111111111111111111111111111111111111111111111111111111111` |
| Available targets | 1 of 1 |
| Superseded active | 0 |
| Window elapsed | 300 |

## Findings

| Code | Step | Statement |
| --- | --- | --- |
| `IDEMPOTENT_NO_OP` | `host-prepare` | the host already matched the declaration |

## Fallbacks taken

| Code | Action |
| --- | --- |
