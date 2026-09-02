# Execute `fe.source.apply`

## Single job

Write one already-resolved tree into product source, inside a frozen owner ceiling and a declared file
set, and nothing else. This is one linear operator invocation. It does not call another operator,
route a workflow, pause internally, or return control instructions.

Structure, ordering, Grammar component selection, copy, behaviour, every presentation value, and every
contract claim arrive decided in the resolution receipt. This operator only answers where those bytes
land and proves that nothing else moved.

## The mutation boundary

This is the only operator in the frontend pipeline that writes product source. Direction decides what
to build and writes nothing. Resolution decides every value and writes only its own artifact. Audit
observes and writes nothing. The single writer exists so that one receipt can account for every byte
that entered the repository, which is impossible when three operators each write a little.

Because it is the only writer, it is also the only place a fabricated value could enter source. That
is why it has no way to produce one.

## No invented value

Every class the write produces must already appear in `context.resolution.classNames`, and every rule
identifier it carries into a contract attribute must already appear in
`context.resolution.appliedRuleIds`. Both lists are complete and frozen by fingerprint.

Three prohibitions carry this, and each is enforced rather than advised:

1. A class absent from the resolution is `WRITE_REJECTED`. There is no rounding to a nearby value, no
   copying from a neighbouring file, and no reformatting that changes a step.
2. A file the write would touch that the write set does not declare is `WRITE_REJECTED`, even when it
   plainly needs the change. The correct next step is a corrected write set, not a wider write.
3. A declared path whose owner root does not contain it is `OWNER_CONFLICT`. Owner membership alone
   is not the ceiling.

The operator never edits the resolution. A tree that resolves to something source cannot express is
returned to the resolver, and the same source is applied again once a new resolution is published and
its fingerprint is rebound.

## Sequence

| # | Step | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- |
| 1 | Validate input and resume | input, `@receipt/fe-presentation-resolution/<invocationId>`, `@workspaces/fe` (the frozen head binding) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Bind authority | `@receipt/fe-presentation-resolution/<invocationId>` (fingerprint, `classNames` inventory, rule inventory, resolved tree), `@workspaces/fe` (routed head, declared write set and its owner roots), `@receipt/fe-direction-decision/<invocationId>` (intent) | — | `RESOLUTION_STALE`, `OWNER_CONFLICT` |
| 3 | Confirm the head | `@workspaces/fe` (the observed checkout at the routed route) | — | — |
| 4 | Fingerprint before | `@workspaces/fe` (every declared path that already exists) | — | — |
| 5 | Project the resolved tree onto the declared paths | `@receipt/fe-presentation-resolution/<invocationId>` (the resolved tree), `@workspaces/fe` (the declared paths) | — | — |
| 6 | Check every produced value against the inventory | `@receipt/fe-presentation-resolution/<invocationId>` (the frozen class and rule inventories) | — | `WRITE_REJECTED` |
| 7 | Write, then fingerprint after | `@workspaces/fe` (the current content of each path) | `@workspaces/fe` (`<declared write-set path>`) | — |
| 8 | Report every declared path | `@workspaces/fe` (the write set and every write outcome) | — | — |
| 9 | Emit and stop | everything above | `@artifacts/application-receipt.json` | — |

Validation rejects a stale source binding, a resolution named but not bound, owner overlap, a
duplicated path, a path outside its owner root, and unchanged progress. The head is observed again at
step 3 before anything is opened, and a head that differs from `input.project.sourceHead` returns the
same drift failure with no file touched.

Fingerprinting before the write is what makes "unchanged" a measurement instead of an opinion. The
projection produces, for each path, the content the resolution already determined; a path the
resolution says nothing about produces nothing. The inventory check runs on the projection rather than
after the write, so a rejected application leaves source untouched: a class absent from the resolution
is rejected with no rounding to a nearby value, no copying from a neighbouring file, and no
reformatting that changes a step, and a file the write set does not declare is rejected even when it
plainly needs the change.

Each path whose projection differs from its current content is created or modified; a path whose
projection equals its current content is recorded `unchanged` and emits no classes. Nothing in the
write set is dropped silently: a declared path with no write is reported `WRITE_SET_PATH_UNUSED` and a
created file is reported `FILE_CREATED`. Emission writes the application receipt under
`input.project.artifactRootRef`, registers every written path in `artifactRefs`, binds every
fingerprint, and claims no visual, quality, or UAT proof: this operator knows what it wrote, never how
it renders.

## Contract emission is inherited

`contractEmission` is copied from the resolution and never re-decided here. Under `attribute`, every
write that carries resolved classes also carries the matching `data-contract` claims. Under
`receipt-only`, no write carries the attribute at all and the resolution receipt remains the durable
record.

A write that carries resolved classes without their claims is rejected, because the later audit would
then find a value with no stated intention to contradict.

## Resume execution

A resume begins again at validation, reuses only unchanged fingerprinted observations, and consumes the
exact delta. A resume that adds no resolution, write set, or scope change returns `NO_PROGRESS`. A
re-resolved tree must arrive as a new resolution fingerprint; the same fingerprint cannot produce a
different write.

## Mandatory attacks

The operator cannot report an application while any applicable item remains unresolved:

- a produced class or identifier is absent from the resolution inventory;
- a file needs the change and the write set does not declare it;
- a declared path lies outside the root of the owner that declares it;
- a declared path produced nothing and nothing says so;
- a write reports a modification whose fingerprint did not move;
- resolved classes were written without their contract claims;
- every declared path came back unchanged and the invocation still reports success.
