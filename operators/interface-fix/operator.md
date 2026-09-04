# interface.fix

## Job

Repair one finding — one audit verdict row, or one UAT verdict — on a generated surface with one small
commit on the session branch: inside the orchestrator's fix size, with no layout change, and with every
value taken from the resolution inventory the surface was generated from.

## Done when

Done when, under mode apply, the `frontend-source-application` and its `changes` account for one commit
on the session branch that repairs the one finding the request bound, whose `writes` record every
declared path with its before and after hash, touch no more than the orchestrator's fix size allows,
create and delete nothing, carry only classes the bound resolution's inventory publishes and a clean
presentation sweep, and whose tree read back at the commit is the projection; or, under mode dry, the
`writes` carry the plan with a null commit and the checkout is untouched.

## One finding, one small commit

A fix is the smallest lawful answer to one finding: a row of the audit's verdict table naming a node
and a rule, or a step of a UAT verdict naming what the journey met. The finding arrives as the receipt
that raised it, and the request names the one row this branch answers; a fix that answers two findings
is two fixes, and a fix that answers a finding nobody raised is a change nobody asked for. The receipt
names the finding under `Finding` of `## Binding`, in the form the raising receipt used, so a reader can
walk from the verdict to the commit and back.

## The size is the orchestrator's

What separates a fix from a regeneration is size, and the number is not this operator's to own: the
orchestrator publishes it as `fixSize` in its own resource, and the validator reads it there when it
is present. Inside that size a repair is a fix; outside it the branch stops with `FIX_TOO_LARGE` and the
finding travels back to `interface.generate`, which decides a direction again instead of patching a
composition three files at a time. This operator hard-codes no threshold: a tree whose orchestrator
publishes none is checked on shape alone, and shape is the second half of the rule.

## No layout change

A fix moves no structure. It creates no path and deletes none: a new leaf or a removed branch is a
composition decision, and a composition decision is `interface.generate`'s. It writes no class the
bound resolution's inventory does not publish: the inventory frozen with the generated tree is the whole
set of values this surface may carry, so a value the finding seems to need and the inventory lacks is
not a fix but a resolution question, and the branch stops with `FIX_TOO_LARGE` rather than inventing
one. The inventory the request bound is read beside the resolved tree it was frozen for, and a
fingerprint that no longer matches that tree is `RESOLUTION_STALE`.

## The same write law as the generator

Everything the generator's write half refuses, this operator refuses too, under the same codes: a path
outside the declared write set or outside its owner root, a class absent from the inventory, a sweep
finding on the projection, a committed tree that is not the projection — each is `WRITE_REJECTED` or
`OWNER_CONFLICT` as the generator defines them, the presentation sweep runs over the projected write
set through `@tools/shell` before anything is written, and the write lands on `session/<sessionId>` of
the routed checkout in exactly one commit whose sha `response.json` carries under `commits`. Nothing is
written outside a session: an invocation with no `step-N/parallel-M` under a session stops with
`SESSION_MISSING`.

## Boundary

The operator writes the declared write-set paths on the session branch of `@workspaces/fe`, each under
a mutable owner root, and `response/` of its own branch. It does not decide a direction, resolve a
value, change the resolved tree or its inventory, create or delete a path, write a class the inventory
does not publish, answer more than one finding, edit knowledge, publish Grammar, push, merge, or record
a verdict, score or pass claim on the repaired source: the surface is audited or walked again after it.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/fe` | the routed frontend checkout at the commit the finding was raised against; the write lands on its session branch and nowhere else | yes |
| `@knowledge/ui/presentation` | the closed rule inventory, read only to confirm the identifiers the bound inventory carries are still published | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `frontend-presentation-resolution` | `interface.generate`, the receipt beside which the inventory and the resolved tree this fix takes its values from were frozen | yes |
| `frontend-source-application` | `interface.generate`, or the prior `interface.fix`; the commit the finding was raised against | yes |
| `frontend-surface-audit` | `interface.audit`, when the finding is a row of its verdict table | no |
| `uat-flow-verification` | `uat.verify`, when the finding is a step of its verdict | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `finding` | id | — | The one finding this fix answers, as the raising receipt names it: `<matrixId>/<node>/<rule>` for an audit verdict row, `<runId>/<step>` for a UAT verdict |
| `mode` | choice | apply | `apply` writes and commits, `dry` emits the plan and writes nothing |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume, confirm the session and the frozen head | `resume`, `mode` | `request/request.json`, the session's `state.json` and this branch's `step-N/parallel-M`, @workspaces/fe at the frozen head | — | `INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind the one finding to the row that raised it, and the inventory to the tree it was frozen for | `finding` | inputs `frontend-surface-audit` or `uat-flow-verification` (the row the finding names), `frontend-source-application` (the commit it was raised against), `frontend-presentation-resolution` (the inventory beside it and its resolved tree), @knowledge/ui/presentation | — | `RESOLUTION_STALE` |
| 3 | Project the smallest repair onto the declared write set and measure it against the fix size | — | @workspaces/fe (the declared paths and their owner roots), the inventory, the orchestrator's `fixSize` when it publishes one | — | `OWNER_CONFLICT`, `FIX_TOO_LARGE` |
| 4 | Check every projected value against the inventory, then sweep the projection | `mode` | the inventory, @workspaces/fe (the projected write set), @tools/shell | `writes` | `WRITE_REJECTED` |
| 5 | Write atomically on the session branch, commit once and read the tree back at the commit | — | @workspaces/fe (the current content of each declared path, under an exclusive lease, then the tree at the commit) | @workspaces/fe/branch/session, `writes`, @tools/sourcewrite, @tools/git | `WRITE_REJECTED` |
| 6 | Emit | — | everything above | `response/response.md`, `response/changes.md`, `response/response.json` | — |

Under `mode = dry` the branch stops after step 4 with the plan alone: `writes.json` carries a null
commit, `response.json` carries no commit, and the checkout is untouched; a dry run is granted neither
`@tools/sourcewrite` nor `@tools/git`. `changes.md` is the record the next steps read: which paths
moved, which claims they carry, and which surface must be measured or walked again.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `frontend-source-application` | `response/response.md` | md | yes |
| `changes` | `response/changes.md` | md | yes |
| `writes` | `response/data/writes.json` | data | yes |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SESSION_MISSING` | terminate |
| `SOURCE_DRIFT` | terminate |
| `RESOLUTION_STALE` | terminate |
| `OWNER_CONFLICT` | terminate |
| `FIX_TOO_LARGE` | terminate |
| `WRITE_REJECTED` | terminate |
| `NO_PROGRESS` | terminate |

## Next

| When | Operator |
| --- | --- |
| the fix is committed and the surface must be measured again | `interface.audit` |
| the fix is committed and the checkout's own gates must run | `quality.verify` |
| the fix answered a UAT verdict and the journey must be walked again | `uat.verify` |
