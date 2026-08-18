---
title: Direction precedents
---

# Direction precedents

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@direction-precedent-schema` | `brainstorms/directions/precedents/schema.json` | file | Defines the accepted and rejected evidence this module returns. |

You are given accepted visual directions for one project and return the precedent, if any, that each
new candidate answers, plus the material difference between them. A precedent is evidence about this
product's taste. It is not a global style catalogue.

## Law

Read precedents only from the project declared by the verified workspace route. An accepted direction
from another product is inspiration, never precedent. Keep the rejected alternatives and the owner's
reason: the loser is what prevents the same unwanted direction returning under a new name.

## Situations

| Code | Situation | Verdict |
|---|---|---|
| `DIRECTION-PRECEDENT-0` | no accepted direction exists | every candidate cites `none` |
| `DIRECTION-PRECEDENT-1` | the same audience, task and intended feeling recur | cite and state the unchanged roles |
| `DIRECTION-PRECEDENT-2` | the need overlaps but one or more axes differ | cite and state the axis delta |
| `DIRECTION-PRECEDENT-3` | cited tokens no longer exist | mark stale; do not imitate |
| `DIRECTION-PRECEDENT-4` | a valid candidate deliberately departs | cite `none` and state why |
| `DIRECTION-PRECEDENT-5` | the owner reversed the accepted direction | mark overruled and retain both decisions |

## Rules

1. Scope every precedent to one project.
2. Compare reasons before names or screenshots.
3. Verify every reused token against the current inventory.
4. Record the layout hash that made the choice durable, rejected axis sets and the owner's reasons.
5. Never delete stale or overruled evidence; replace it with a named successor.
6. At least one candidate departs when a precedent exists.

## Output

One record conforming to `@direction-precedent-schema`, with the accepted direction referenced from
the parent schema rather than restated here.

## Scope

This module decides how an earlier visual decision is cited. It does not choose a new direction or
store precedents inside the shared trust tree; accepted records belong to the project registry.
