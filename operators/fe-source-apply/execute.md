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

## Execution sequence

1. **Validate input and resume.** Apply `input.schema.json` and semantic validation. Reject a stale
   source binding, a resolution named but not bound, owner overlap, a duplicated path, a path outside
   its owner root, and unchanged progress.
2. **Bind authority.** Bind the resolution receipt with its fingerprint, class inventory, and rule
   inventory; the resolved tree with its fingerprint; the routed source head; and the declared write
   set with its owner roots.
3. **Confirm the head.** Observe the routed checkout. A head that differs from `input.project.sourceHead`
   is `SOURCE_DRIFT`, and no file is opened.
4. **Fingerprint before.** Record the current fingerprint of every declared path that exists. This is
   what makes "unchanged" a measurement instead of an opinion.
5. **Project the resolved tree onto the declared paths.** For each path, produce the content the
   resolution already determined. A path the resolution says nothing about produces nothing.
6. **Check every produced value against the inventory.** A class or identifier outside the resolution
   stops the invocation before the first byte is written. The check runs on the projection, not after
   the write, so a rejected application leaves source untouched.
7. **Write, then fingerprint after.** Create or modify each path whose projection differs from its
   current content. A path whose projection equals its current content is recorded `unchanged` and
   emits no classes.
8. **Report every declared path.** A declared path with no write is reported `WRITE_SET_PATH_UNUSED`.
   A created file is reported `FILE_CREATED`. Nothing in the write set is dropped silently.
9. **Emit and stop.** Write the application receipt under `input.project.artifactRootRef`, register
   every written path in `artifactRefs`, and bind every fingerprint. Do not claim visual, quality, or
   UAT proof: this operator knows what it wrote, never how it renders.

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
