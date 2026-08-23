# Why index

## LOADS

None.

## Stale signature

A contract entry's `why` describes business or shape instead of stating the need that would retrieve it.
The gate surface may be green while later searches miss the entry and create a duplicate.

## List evidence

Read recorded misses first. Then classify every non-page entry against its own key:

| Finding | Meaning |
|---|---|
| `narrower` | key is reusable but `why` still names a feature |
| `vague` | `why` names a shape rather than a need |
| `wider` | `why` promises more than the key/children can hold; layout owns the key decision |
| `specific` | both key and reason are deliberately narrow; leave it |

Report total entries, page keys, need-shaped reasons and each classification count. Do not edit.

## Repair inventory

A recorded miss outranks a heuristic count. Batch remaining entries by family, compare each reason with
its key, children and real fixed classes, and ask rather than invent a need that evidence cannot support.

## Apply

Change `why` values only. A reason states when a reader needs the entry, usually `if you need ...` or an
equivalent condition. Never make it wider than the key or what the entry fixes. Route-scoped page keys are
excluded by construction.

## Proof

The diff changes only `why` lines, classification moves from stale to need-shaped, recorded misses resolve,
and the contract still typechecks/builds. A changed key, class, child or host reopens the pass.
