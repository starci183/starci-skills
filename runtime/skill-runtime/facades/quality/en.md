# Quality facade

## LOADS

None.

## Purpose

Route quality requests without letting a read-only audit quietly become repair or provider mutation.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `stale-list` | `starci-stale-list` | broad routed stale and check-only inventory |
| `diagnose-skill` | `starci-diagnose` | trace one skill and locate its correct stop |
| `repair` | `starci-repair` | return a measured red or incompletely assured Source to green |
| `debt` | `starci-debt-repay` | repay an existing owner-approved debt record |

## Input

Use the original request, Source/project and role routes, requested measurement or mutation, and exact repair/debt/provider scope when relevant.

## Output

Return one mode and physical skill, selection reason, risk class, unresolved facts, and the unchanged invocation envelope.

## Permissions

The facade is read-only selection metadata. It transfers no approval, credentials, mutation authority, or proof claim.

## Stops

Stop when measurement versus mutation is unclear, routes are unresolved, repair or debt scope is undisclosed, provider credentials lack authority, or another capability owns the request.

## Authority boundary

The dispatcher starts the selected physical skill separately. Read-only skills remain read-only; repair and debt retain their existing approvals, gates, and source boundaries. The facade needs no orchestration profile.
