# Execute `platform/tunnel-plan`

## Context

Read only `context.authority` and `context.observedState` for the declared account, zone, owner, tunnel, hostname, DNS record, and route. Credential values and zone-wide discovery are forbidden.

## Input

Use exactly one `input.requestedIngress` containing one tunnel, hostname, origin, HTTP(S) protocol, and proxied-DNS requirement.

## Action

Compare the requested ingress with the observed resources once and derive the minimal value-free effects required for convergence. Do not mutate Cloudflare, invoke helpers, select another operator, route the workflow, or manage session cleanup.

## Output

Return `ready` with one exact plan reference/hash and minimal effects, or `blocked` with conflicts and no applicable plan. Include only value-safe evidence references.

## Stop

Reject context outside the requested identity. Report ownership or revision conflicts without repairing them.
