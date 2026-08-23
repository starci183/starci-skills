# Analysis facade

## LOADS

None.

## Purpose

Route pre-implementation analysis to the correct technical-decision or business-authority capability.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `architecture` | `starci-architecture-analyze` | compare viable cross-system technical solutions and trade-offs |
| `business` | `starci-business-analyze` | establish evidence-backed actors, flows, rules, states, and feature heads |

## Input

Use the original question, routed project, known evidence boundaries, and whether the missing authority is technical choice or business truth.

## Output

Return one mode and physical skill, the discriminating fact, unresolved facts, and the unchanged invocation envelope.

## Permissions

The facade performs selection only, writes nothing, and transfers no decision or source authority.

## Stops

Stop when technical decision and business truth remain conflated, project routing is unresolved, source writes are undisclosed, or another capability owns the request.

## Authority boundary

The dispatcher starts the selected physical skill separately. Each physical skill retains its own record boundary, owner decisions, stops, and output. The facade has no orchestration profile.
