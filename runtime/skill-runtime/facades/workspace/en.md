# Workspace facade

## LOADS

None.

## Purpose

Keep Source and machine readiness distinct from product repair and runtime operations.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `init` | `starci-init` | decrypt identity, bootstrap, workspace declaration compile/hydration, or worktree/session readiness |

## Input

Use the original request, Source identity, machine/project/role target, and the specific readiness root that is missing or stale.

## Output

Return the mode and physical skill, selection reason, unresolved facts, and the unchanged invocation envelope.

## Permissions

The facade performs no initialization write, target-repository edit, credential intake, or approval transfer.

## Stops

Stop when Source identity is unresolved, the request includes target product edits, the intent is deployment or product repair, or another capability owns it.

## Authority boundary

The dispatcher starts `starci-init` separately. Its independently approved readiness roots and no-target-repository-edit boundary remain unchanged. The facade has no orchestration profile.
