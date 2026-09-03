# frontend.source.apply

## Job

Write one already-resolved tree into product source on the session branch, inside a frozen owner
ceiling and a declared file set, emitting only values the bound resolution already contains, and
account for every byte that entered the repository in one commit.

## The single writer

This is the only operator in the frontend pipeline that writes product source. Direction decides what
to build and writes nothing; resolution decides every value and writes only its own artifact; the
audit observes and writes nothing. One writer exists so that one receipt can account for every byte
that entered the repository, which is impossible when three operators each write a little. Because it
is the only writer, it is also the only place a fabricated value could enter source, and it has no way
to produce one.

## The session branch

The operator never writes on the person's checked-out branch. It writes only on `session/<sessionId>`
of the routed checkout, in the git worktree the orchestrator prepared from the frozen head, and it
holds an exclusive lease on that worktree while it writes. The declared write set is committed exactly
once; `response.json` carries that one sha under `commits`, the `changes.md` Binding row reads
`@workspaces/fe` at the base head then the new sha on `session/<sessionId>`, and the next requests pin
`@workspaces/fe` at that sha. Nothing is pushed and nothing is merged here: `git.publish` owns both.

## No invented value

Every class the write produces already appears in the bound resolution's class inventory, and every
identifier it carries into a claim already appears in the applied rule inventory. Both lists are
complete and frozen. A class absent from the resolution is `WRITE_REJECTED`: there is no rounding to a
nearby value, no copying from a neighbouring file, and no reformatting that changes a step. A file the
write would touch that the write set does not declare is `WRITE_REJECTED` too, even when it plainly
needs the change; the correct next step is a corrected write set, not a wider write. A declared path
whose owner root does not contain it is `OWNER_CONFLICT`, because owner membership alone is not the
ceiling. The inventory check runs on the projection, before anything is written, so a rejected
application leaves source untouched.

## An application-owned node becomes an empty leaf

When the direction marks a node as owned by the application, a canvas for instance, the projection
writes an empty leaf file that carries that node's contract, its props and its states, so the tree
compiles and the surface can be rendered and measured. The operator never writes that leaf's logic:
the contract is what the direction decided, and the behaviour behind it belongs to whoever owns the
node.

## Unchanged is a measurement

Every declared path is hashed before the projection and after the commit. A path whose projection
differs from its current content is created or modified; a path whose projection equals it is recorded
`unchanged`. After the commit the tree is read back and compared against the resolved tree, and a
difference is `WRITE_REJECTED` rather than a silent success. Under `mode = dry` nothing is written at
all: the branch emits the plan in `response/data/writes.json` with a null commit and stops there.

## Boundary

The operator writes the declared write-set paths on the session branch of `@workspaces/fe`, each under
a mutable owner root, and its own `response/`. It does not write a class, value or rule identifier
absent from the bound resolution, decide a presentation value, choose a Grammar component, restructure
the tree, write the logic of an application-owned leaf, touch a file outside the declared write set,
commit to any other branch, push, merge, edit knowledge, publish Grammar, change the resolution, start
or reconfigure runtime services, or record a verdict, score or pass claim on the applied source. It
knows what it wrote, never how it renders.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/fe` | the routed frontend checkout at the frozen head; the write lands on its session branch and nowhere else | yes |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `frontend-presentation-resolution` | `frontend.presentation.resolve`, the resolved tree and, beside it, the frozen class and rule inventory | yes |
| `frontend-direction-decision` | `frontend.direction.decide`, the intent and the owner ceiling; never a source of values | yes |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `mode` | choice | apply | `apply` writes and commits, `dry` emits the plan and writes nothing |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate and resume, and confirm the head | `resume`, `mode` | `request/request.json`, input `frontend-presentation-resolution`, @workspaces/fe at the frozen head | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind the resolution, the direction and the declared write set | — | inputs `frontend-presentation-resolution` (tree fingerprint, class and rule inventory, resolved tree) and `frontend-direction-decision` (intent and owner ceiling), @workspaces/fe (the declared paths and their owner roots) | — | `RESOLUTION_STALE`, `OWNER_CONFLICT` |
| 3 | Project the resolved tree onto the declared paths | — | input `frontend-presentation-resolution` (the resolved tree), @workspaces/fe (the declared write set) | — | — |
| 4 | Check every produced value against the inventory | `mode` | input `frontend-presentation-resolution` (the inventory beside the receipt) | `response/data/writes.json` | `WRITE_REJECTED` |
| 5 | Write atomically on the session branch and commit once | — | @workspaces/fe (the current content of each declared path, under an exclusive lease) | @workspaces/fe/branch/session, `response/data/writes.json`, @tools/sourcewrite, @tools/git, image assets the direction judged, @tools/imagegen | — |
| 6 | Read the tree back at the commit | — | @workspaces/fe at the commit | — | `WRITE_REJECTED` |
| 7 | Emit | — | everything above | `response/response.md`, `response/changes.md`, `response/response.json` | — |

Under `mode = dry` the branch stops after step 4 with the plan alone: `writes.json` carries a null
commit, `response.json` carries no commit, and the checkout is untouched. Under `apply`, step 5 writes
and commits exactly once and step 6 proves that the committed tree is the resolved tree. `changes.md`
is the record the next steps read: which paths moved, which claims they carry, which gates the
checkout pins for them, and which surfaces must now be observed.

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
| `SOURCE_DRIFT` | terminate |
| `OWNER_CONFLICT` | terminate |
| `RESOLUTION_STALE` | terminate |
| `WRITE_REJECTED` | terminate |
| `NO_PROGRESS` | terminate |

## Next

| When | Operator |
| --- | --- |
| the source is committed and the rendered surface must be measured | `frontend.surface.audit` |
| the source is committed and the checkout's own gates must run | `quality.verify` |
