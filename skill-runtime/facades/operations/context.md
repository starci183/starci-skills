# Operations facade

## LOADS

None.

## Purpose

Route provider and runtime operations to one exact existing owner without merging credentials, publication, deployment, quality-service, or proof boundaries.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `tunnel` | `starci-cloudflare-tunnel-set` | approved public HTTP(S) tunnel and DNS route |
| `deploy` | `starci-deploy` | declared stack adoption, release, monitoring, recovery, or rollback |
| `mcp` | `starci-setup-mcp` | Source-wide read-only source-context MCP setup or refresh |
| `sonar` | `starci-setup-sonar` | shared SonarQube service and strict quality-gate reconciliation |

## Input

Use the original request, verified Source/project routes, declared service or stack identity, provider target, and known credential authority without credential values.

## Output

Return one mode and physical skill, selection reason, risk class, unresolved facts, and the unchanged invocation envelope.

## Permissions

The facade is read-only selection metadata. It cannot acquire credentials, mutate provider state, publish a hostname, deploy a release, or transfer approval.

## Stops

Stop when routing is unresolved, more than one provider owner applies, credential authority is missing, a destructive/publication boundary is undisclosed, or the request is local development startup.

## Authority boundary

The dispatcher starts one physical skill separately. That skill alone owns credential intake, exact provider boundary, approval, mutation, retry, rollback, and steady-state proof. The facade has no orchestration profile.
