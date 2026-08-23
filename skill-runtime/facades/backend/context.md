# Backend facade

## LOADS

None.

## Purpose

Make backend discovery cheap while preserving the hard boundary between a read-only brief and approved production implementation.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `plan` | `starci-be-plan` | name files, boundaries, and tests before capability code exists |
| `approve` | `starci-be-approve` | challenge and implement an exact existing backend brief |

## Input

Use the original request, routed backend role, live-schema scope, and the exact brief identity when implementation is requested.

## Output

Return one mode and physical skill, the selection reason, unresolved facts, and the unchanged invocation envelope.

## Permissions

The facade is selection-only and performs no read/write workflow of the selected capability. It transfers no approval.

## Stops

Stop when the backend route is unresolved, implementation lacks an exact brief, the request mixes undisclosed planning and writes, or another capability owns the request.

## Authority boundary

The dispatcher starts the selected physical skill separately. `starci-be-plan` remains no-product-write; `starci-be-approve` retains its explicit approval stop before the first production write. No facade orchestration profile is added.
