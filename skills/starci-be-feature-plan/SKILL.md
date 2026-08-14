---
name: starci-be-feature-plan
description: Settle what a StarCi/nivo backend capability will BE before any of it is written — locks context down to the app and the database, reads the governing be/canon laws, takes the live schema and the sibling operation folder as evidence, and stops with the exact folder-and-file architecture named file by file, each file traced to the law and the sibling that decide its shape. Writes no product code. Use it whenever a mutation, query, resolver, handler, module, entity or projection is about to be added, including when a frontend need turns out to require a backend enabler. The half that writes the files is starci-be-feature-apply.
---

# StarCi BE Feature Plan

Backend work is where a wrong guess is cheapest to make and dearest to keep: a resolver compiles, a
service runs, and the shape only turns out to be wrong when a second door needs it. By then the
shape has callers.

So this half spends its time reading, and produces one thing: **the file list, before there are any
files.** A folder architecture is reviewable in a minute and arguable in a sentence. The same
decisions embedded in thirty written files are reviewable only by reading thirty files, and by then
nobody argues with them — they merge them.

## Admission

Use this when a capability is being ADDED or EXTENDED: a new mutation or query, a new module, a
handler that grows a decision, an entity, a projection, or a frontend case that produced a backend
enabler proposal.

Do not use it to change a value, fix a typo, or repair something whose intended result is already
proven. That is a bounded repair and it needs evidence, not a procedure — and manufacturing an
architecture record around a settled one-line fix wastes the review that the record exists to buy.

**A frontend that cannot do something is not evidence that the backend should do it.** Read the live
schema first. Half the time the capability is there under a name nobody searched for; the other half
it is genuinely missing, and then it is worth building.

## 1 · Context lock

Read [`../../CONTEXT-LOCK.md`](../../CONTEXT-LOCK.md), detect and print the lock table. Persist
`context-lock.plan.md/json` in the locked artifact root. Backend targets are ordinary targets:
the repository holding trust is usually not the repository being changed.

Two lock rows matter more here than in frontend work, and both are invisible when wrong:

- **Which APP.** A monorepo backend can build several apps from one source tree — `nest-cli.json`
  names them. Two apps are different products with different auth surfaces, and putting an operation
  in the wrong one is invisible until a customer cannot reach it.
- **Which DATABASE.** A repository can own more than one, and an entity imported from the wrong
  connection resolves, compiles and writes to a table nobody is reading.

This half is READ-ONLY over the target. Its write boundary is exactly its artifact root.

## 2 · Read the law before designing the code

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

Add [`cdc`](../../be/canon/patterns/cdc.md) when a read projection is involved and
[`event-delivery`](../../be/canon/patterns/event-delivery.md) when the capability publishes or
consumes. A projection designed without `cdc` is the specific mistake this addition exists to stop:
it produces a listener that increments a delta, and duplicate delivery then doubles the number
nobody is checking.

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

Print every name and read the list. When the API is not running, enumerate every operation folder
instead — the whole list, not a filtered one. A name that sounds like the capability gets OPENED and
ruled in or out by what it returns, never by what it is called. `myLearningFeedbacks` reads exactly
like a course rating and is the platform's feedback TO a learner; only reading it says so.

**Then read the sibling operations.** The folder next door is the strongest available statement of
how this repository writes this kind of thing. Mirror it. An operation that is the odd one out in
its own folder family costs a reader more than any elegance gains them.

**Where the families disagree, say which one you are mirroring and why.** A repository can carry two
conventions at once — one domain writing full CQRS folders while another puts the work in the
service. The architecture record names the family it follows, and records the divergence as a
finding rather than settling it silently inside one new feature.

**Copy is not capability.** A message catalogue, a contract table or a type copied from another
repository will happily describe features this backend does not have. Two independent artifacts
agreeing means nothing when one was copied from the other; ask the schema and the resolver folder.

## 4 · State the architecture, file by file

This is the deliverable. Write `architecture-record.md/json` in the artifact root and show the same
content in the conversation.

**Every file that will exist is named.** Not "the usual CQRS files" — the actual paths, so a reader
can count them, object to one, and notice the one that is missing. A folder listed as a shape rather
than as files is how an operation ships without its twin spec.

For each file, one line: what it holds, and what decides its shape — the law, the sibling it mirrors,
or the product decision behind it. A file that cannot name any of the three is a file somebody
wanted rather than a file the capability needs.

The record also carries:

1. **The operation set** — one folder per operation, and for each, whether it is a command or a
   query, its door, and the failure it can throw.
2. **The persistence** — every entity, its explicit table name, its relations, and which connection
   it belongs to. A migration is named here or its absence is stated as owed.
3. **The read path** — computed per query, or a projection. If a projection: its identity, its
   stable `groupId`, the complete topic set that can invalidate it, and the recompute source.
4. **The failures** — every new exception class, its code, and its metadata fields. A failure a
   caller might act on differently from its neighbour earns its own class.
5. **The decisions the evidence forced**, each with the evidence. A rule taken from a sibling's
   comment is stronger than one taken from a memory of how this usually goes.
6. **The assumptions**, stated as assumptions. A product question the code surfaced — whether a
   trial counts as an enrollment, whether an edit window exists — is written down here and answered
   by the owner, not guessed inside a handler.
7. **The proof plan, with the case list already enumerated.** Not "the handler gets a spec" — the
   actual cases, listed: each guard both ways, each boundary at and either side of it, the empty
   set, the already-done, the not-permitted, the not-found, the concurrent second writer, and every
   member of every enum the handler will switch on. Then the flow the e2e walks, the refusals it
   includes, and the production transport it enters through.

   Enumerating here rather than in Apply is the whole point. After the handler exists, the cases a
   reader thinks of are the cases the code made visible, so the untested ones are exactly the ones
   the author never considered — and the suite ends up green precisely where the risk is. A list
   written against the DECISIONS, before the branches exist to suggest themselves, is the only
   version of this that catches anything.

   If a case on the list turns out unreachable, that is a finding about the handler rather than a
   case to drop: either it is reachable and it needs a test, or the branch should not be written.
8. **What this will NOT do.** The states left uncovered, the migration deferred, the enabler the
   frontend still cannot use.

## 5 · Stop for approval

Show the file list, the decisions and the assumptions, and stop. Do not write product code, do not
create the folders, and do not start "just the entity" — an entity is where the shape lives, so it
is the file most worth arguing about and the last one to write unreviewed.

Record the approval and route to `$starci-be-feature-apply`. An architecture nobody approved is a
plan; Apply builds records, not plans.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Declare a capability missing from a filtered grep | The regex, not the schema, decided the answer | Dump every name and read them |
| Rule a same-sounding operation out by its name | The name is the one part that can lie without failing | Open it and rule it out by what it returns |
| Design around a missing capability without asking | "The API cannot" becomes "the product should not", which is backwards | Name the gap; let the owner decide whether to fill it |
| Trust a copied catalogue, contract or type as evidence | It describes the repository it came from | Ask the schema and the resolver folder |
| Describe a folder as a shape rather than as files | The missing file is invisible, and the missing one is usually the spec | List every path |
| Write product code in this half | The architecture stops being reviewable the moment it is also implemented | Write the record; route to Apply |
| Bury a product question inside a default | A guess in a handler is a decision nobody made and nobody can find | State it as an assumption and get it answered |
| Settle a family divergence inside one new feature | One operation becomes the odd one out, and the disagreement stays unrecorded | Mirror the family, record the divergence as a finding |

## Examples

### The file list earns its place

```
mutations/courses/submit-course-review/
    submit-course-review.command.ts        the message                  CQRS-2
    submit-course-review.handler.ts        the enrollment gate + write  CQRS-3
    submit-course-review.service.ts        one-line dispatch            CQRS-4
    submit-course-review.resolver.ts       the door                     TRANSPORT-1
    submit-course-review.module.ts         wiring                       mirrors add-to-cart
    submit-course-review.module-definition.ts
    submit-course-review.handler.spec.ts   the twin                     CQRS-7
    graphql-types/{request,response}.ts
```

```
mutations/courses/submit-course-review/   the usual CQRS operation folder
```

They differ in one thing: whether a reader can notice the spec is missing.

### The assumption that stays visible

```
ASSUMPTION - a trial enrollment (`isEnrolled: false`) may NOT review. Taken from the
add-to-cart handler's own comment, which distinguishes paid enrollment from a trial row.
Needs the owner's word; it is one predicate to change.
```

```
// in the handler, unreviewed: where: { isEnrolled: true }
```

They differ in one thing: whether the decision is somewhere anybody would look.
