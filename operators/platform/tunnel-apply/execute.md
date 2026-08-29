# Execute `platform/tunnel-apply`

## Context

Read only the exact approved plan, matching approval, opaque credential capability, and pre-mutation resource fingerprint in `context`.

## Input

Use `input.execution` to bind the expected plan hash, one bounded helper, and the approved hostname's public HTTPS probe.

## Action

Recheck the resource fingerprint, apply only the approved effects through the coordinator, and verify the four declared postconditions. An already-converged ingress is a successful no-op. Do not enumerate adjacent Cloudflare resources, expose credentials, route the workflow, or manage cleanup.

## Output

Return `proved` with a fresh receipt and four passing checks, or `blocked` with one reason. Report every partial mutation with before and after revisions.

## Stop

Stop before mutation on authority or concurrency drift. Never hide a partial mutation or failed postcondition.
