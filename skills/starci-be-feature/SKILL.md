---
name: starci-be-feature
description: Add or extend a backend capability on a StarCi/nivo NestJS API so it matches this tree's canon rather than the shape the author already had in mind. Locks context, reads the governing be/canon laws before writing, takes the live schema and the sibling operations as evidence, builds one operation per folder with its twin spec, and proves the flow end to end before it is called done. Use it whenever a mutation, query, resolver, handler or module is being added — including when a frontend need turns out to require a backend enabler.
---

# StarCi BE Feature

Backend work is where a wrong guess is cheapest to make and dearest to keep: a resolver compiles, a
service runs, and the shape only turns out to be wrong when a second door needs it. This procedure
exists to spend the first ten minutes reading rather than typing.

## Admission

Use this when a capability is being ADDED or EXTENDED: a new mutation or query, a new module, a
handler that grows a decision, or a frontend case that produced a backend enabler proposal.

Do not use it to change a value, fix a typo, or repair something whose intended result is already
proven — that is a bounded repair and it needs evidence, not a procedure.

**A frontend that cannot do something is not evidence that the backend should do it.** Read the live
schema first. Half the time the capability is there under a name nobody searched for; the other half
it is genuinely missing, and then it is worth building.

## 1 · Context lock

Read [`../../CONTEXT-LOCK.md`](../../CONTEXT-LOCK.md), detect and print the lock table before the
first write. Backend targets are ordinary targets: the repository holding trust is usually not the
repository being changed, and two API apps can live in one repo with different capabilities.

Two lock rows matter more here than in frontend work:

- **Which APP.** A monorepo backend can build several apps from one source tree — `nest-cli.json`
  names them. `src/features/core/` and `src/features/expert/` are different products with different
  auth surfaces, and putting an operation in the wrong one is invisible until a customer cannot
  reach it.
- **Which DATABASE.** A repository can own more than one, and an entity imported from the wrong
  connection resolves, compiles and writes to a table nobody is reading.

## 2 · Read the law before writing the code

Read the governing files completely, not the one that sounds relevant:

[`cqrs`](../../be/canon/patterns/cqrs.md) ·
[`module-layering`](../../be/canon/patterns/module-layering.md) ·
[`data-access`](../../be/canon/patterns/data-access.md) ·
[`exceptions`](../../be/canon/patterns/exceptions.md) ·
[`naming`](../../be/canon/patterns/naming.md) ·
[`type-safety`](../../be/canon/patterns/type-safety.md) ·
[`transport`](../../be/canon/patterns/transport.md) ·
[`testing`](../../be/canon/patterns/testing.md) ·
[`e2e-flow`](../../be/canon/patterns/e2e-flow.md) ·
[`observability`](../../be/canon/patterns/observability.md) ·
[`comments`](../../be/canon/patterns/comments.md)

Reading them afterwards turns the work into rework. A handler that overrides `execute`, a service
that grew a rule, a message with a default — each compiles, runs and reviews cleanly, and each is
refused by canon.

## 3 · Evidence before design

**Dump the schema UNFILTERED.** A grep with a regex is how a capability gets declared missing when
it is present under another name.

```bash
curl -s -X POST <api>/graphql -H 'Content-Type: application/json' \
  -d '{"query":"query{__schema{mutationType{fields{name}}}}"}'
```

Print every name and read the list. `createMember` beside `setMemberRole` and `removeMember` is an
owner administering members; it is not self-registration, and only the neighbours say so.

**Then read the sibling operations.** The folder next door is the strongest available statement of
how this repository writes this kind of thing. Mirror it. An operation that is the odd one out in
its own folder family costs a reader more than any elegance gains them.

**Copy is not capability.** A message catalogue, a contract table or a type copied from another
repository will happily describe features this backend does not have. Two independent artifacts
agreeing means nothing when one was copied from the other; ask the schema and the resolver folder.

## 4 · Build the operation

One operation, one folder, every file named for it — see CQRS-1. The work goes in the handler; the
service dispatches; the resolver is a door. A failure is a domain exception that names itself, never
a `null` and never an `{ ok: false }` shape.

When the sibling family does something canon's prose forbids — auth operations doing their work in
the service rather than a handler, for example — **say so and mirror the family**, rather than making
this one operation the exception. Then record the disagreement: canon and source have diverged, and
which one is wrong is a finding, not a thing to settle silently in one file.

Check what the enforceable artifact actually says before calling something a violation. The rules
under [`../../sources/be/`](../../sources/be/) are narrower than the prose, and a rule that never
fires on a shape is not endorsing it — but it does mean the shape is common enough that changing one
instance fixes nothing.

## 5 · Prove it

A handler has its twin spec beside it. A flow has an e2e that walks it the way a caller does.

Run them and paste the result. A command named in a summary is not a command anybody ran, and
"should work" is the phrase that precedes every one of these being wrong:

- the unit spec for the handler's decisions
- the e2e for the flow, including the refusals — an auth flow that only proves success has proved
  the half that was never in doubt
- a live call against the running API, because a passing test and a reachable endpoint are two
  different claims

## 6 · Report what is still owed

Say plainly what is not done: the state nothing covers, the migration not written, the enabler the
frontend still cannot use. A summary that reads as finished when it is not is the one artifact that
makes the next session slower rather than faster.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Declare a capability missing from a filtered grep | The regex, not the schema, decided the answer | Dump every name and read them |
| Design around a missing capability without asking | "The API cannot" becomes "the product should not", which is backwards | Name the gap; let the owner decide whether to fill it |
| Invent a shape the folder family does not use | The odd one out costs every later reader | Mirror the siblings, and record the tension if canon disagrees |
| Trust a copied catalogue, contract or type as evidence | It describes the repository it came from | Ask the schema and the resolver folder |
| Put the work in the resolver or the service | One door can reach it; the CLI, the job and the test cannot | Dispatch a message, work in the handler |
| Return `null` or `{ ok: false }` for a failure | The caller guesses with less information than the handler had | Throw the domain exception |
| Call it done with the spec unwritten | The decisions live in the handler, so an untested handler is an untested decision | Write the twin, run it, paste the output |
