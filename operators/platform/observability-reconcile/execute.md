# Execute `platform/observability-reconcile`

## Context

Read only the exact approval, opaque remote-write capability, and current fingerprint/resource metadata in `context`.

## Input

Use one `input.desiredState` containing exactly cAdvisor, Prometheus, Grafana, bounded scrape targets and dashboards, one remote-write destination, one sensitive-data policy, and approved effects.

## Action

Recheck the fingerprint, apply only the approved delta through the coordinator, and prove all seven declared postconditions. Treat an already-converged stack as success. Do not discover adjacent services or destinations, expose credentials, diagnose product behavior, route the workflow, or manage cleanup.

## Output

Return `proved` with a fresh receipt and seven passing checks, or `blocked` with one reason. Report every partial mutation with before and after revisions.

## Stop

Stop before mutation on authority or concurrency drift. A green dashboard alone never proves the remote-write and data-boundary postconditions.
