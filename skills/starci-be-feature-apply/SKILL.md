---
name: starci-be-feature-apply
description: Build exactly the StarCi/nivo backend capability an approved architecture record describes — inherits the Context Lock, reconfirms the production write boundary, writes the named files and no others, mirrors the sibling family rather than inventing a shape, and proves the result with the twin specs, the flow e2e and a live call before calling it done. Use it after starci-be-feature-plan records an approved architecture. Never reopens a shape decision in a handler; a shape that turns out wrong returns to Plan.
---

# StarCi BE Feature Apply

The architecture is settled. This half writes it, and its whole discipline is that it writes THAT
and not something adjacent that occurred to the author while typing.

The failure it prevents is not a bad file. It is the one that arrives quietly: a second entity
nobody reviewed, a rule moved into the service because the handler was getting long, an operation
that grew a fourth door. Each is defensible on its own and none of them was ever approved.

## Admission

Use this only with an approved `architecture-record` from `$starci-be-feature-plan`. No record is
not a small gap to fill in passing — the record IS the review, so building without one means the
shape ships unreviewed and the file list becomes whatever the first draft happened to contain.

## 1 · Inherit, redetect, and stop on drift

Read the inherited `context-lock.plan.json` and the architecture record. Redetect the target's
git state, app and database, and print the lock.

Compare inherited against detected: trust root, target root, branch, worktree, HEAD, remote, app,
database connection, artifact root. Any difference is drift. Print a drift table, stop, and ask
whether to relock or return to Plan. Never switch app, connection, branch or boundary
automatically, even when the new value looks equivalent — an entity written against the wrong
connection compiles and writes to a table nobody reads.

## 2 · Confirm the write boundary explicitly

Print the exact paths that will be created or modified and stop for the user's confirmation. Record
their words as evidence and move the record from `awaiting-confirmation` to `confirmed`.

Detection is not authorization. A correct architecture and a correct lock still do not say that now
is the moment to write into a repository somebody else may be working in.

## 3 · Build the named files, and only those

One operation, one folder, every file named for it — CQRS-1. The work goes in the handler; the
service dispatches; the resolver is a door. A failure is a domain exception that names itself, never
a `null` and never an `{ ok: false }` shape.

**A file not in the record does not get written.** If the work turns out to need one, that is the
architecture being wrong, which is worth knowing: say so, and return to Plan for that one
addition. The cost is a paragraph. The cost of the other path is a shape nobody reviewed, discovered
by whoever needs it next.

When the sibling family does something canon's prose forbids — auth operations doing their work in
the service rather than a handler, for example — **mirror the family the record named**, rather than
making this one operation the exception. The divergence was recorded in Plan; do not re-decide it
here, in one file, at the end of a long day.

Check what the enforceable artifact actually says before calling something a violation. The rules
under [`../../sources/be/`](../../sources/be/) are narrower than the prose, and a rule that never
fires on a shape is not endorsing it — but it does mean the shape is common enough that changing one
instance fixes nothing.

## 4 · Prove it

A handler has its twin spec beside it. A flow has an e2e that walks it the way a caller does.

Run them and paste the result. A command named in a summary is not a command anybody ran, and
"should work" is the phrase that precedes every one of these being wrong:

- **the unit spec for the handler's decisions, EXHAUSTIVELY.** Enumerate every case the handler can
  reach before writing the first `it`, and write the list down: each guard both ways, each boundary
  at and either side of it, the empty set, the already-done, the not-permitted, the not-found, the
  concurrent second writer, and every member of every enum the handler switches on. Then count the
  list against the cases in the file. A spec is finished when nothing is left over, not when the
  happy path and one refusal are green.

  This is the rule that gets skipped because the code already works. It works for the cases the
  author was thinking about, and the ones they were not thinking about are precisely the ones with
  no test — so the suite is green exactly where the risk is. An enumeration written before the
  cases is the only version of this that is honest; written afterwards it is a description of what
  was convenient to test.

  A branch nobody can reach is not an excuse to skip it. Either it is reachable and it needs a case,
  or it is unreachable and it should not be in the handler.

  A spec whose every assertion is `toHaveBeenCalled*` restates the source and is not a proof of
  anything: rewrite the handler correctly and it goes red, break the rule while keeping the call
  shape and it stays green.
- **the e2e for the flow, including the refusals** — an auth flow that only proves success has
  proved the half that was never in doubt. It enters through the production boundary: GraphQL, HTTP,
  a real socket, a real broker message or the scheduler. Calling a handler, a resolver or the bus
  starts after routing, guards, validation and serialization have already succeeded.
- **a live call against the running API** — a passing test and a reachable endpoint are two
  different claims, and the second one is the one a client makes.

A projection is proved through the broker or it is not proved. Publishing a source row and polling
until the projection settles exercises serialization, the consumer group and delivery; calling
`recomputeTarget` exercises a method. The difference is the whole subject of the lane, and it is
also the trap that makes a seeded number look broken: writing the source table changes nothing
visible until the listener has run.

## 5 · Report what is still owed

Say plainly what is not done: the state nothing covers, the migration not written, the enabler the
frontend still cannot use, the assumption that was taken rather than answered.

A summary that reads as finished when it is not is the one artifact that makes the next session
slower rather than faster — it spends the next reader's time proving that something is missing,
which the person who left it out already knew.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Build without an approved architecture record | The record is the review; without it the shape ships unreviewed | Run Plan |
| Write a file the record does not name | It is a shape nobody approved, found by whoever needs it next | Return to Plan for that one addition |
| Re-decide a family divergence while writing | The decision moves from a record into a file, where nobody looks for it | Mirror what the record named |
| Treat a clean lock as permission to write | Correct detection is not the same as being authorized now | Stop for explicit confirmation |
| Invent a shape the folder family does not use | The odd one out costs every later reader | Mirror the siblings |
| Put the work in the resolver or the service | One door can reach it; the CLI, the job and the test cannot | Dispatch a message, work in the handler |
| Return `null` or `{ ok: false }` for a failure | The caller guesses with less information than the handler had | Throw the domain exception |
| Call it done with the spec unwritten | The decisions live in the handler, so an untested handler is an untested decision | Write the twin, run it, paste the output |
| Prove a projection by calling its recompute | It removes broker serialization and consumer-group behaviour, which is the lane's whole subject | Publish through the real broker and poll |
| Paste a command instead of its output | A command in a summary is a command nobody ran | Run it; paste what it said |

## Examples

### The addition that goes back

```
The handler needs a lookup the record did not name, so it needs a second query folder.
Stopping here: this is one paragraph in Plan, and a folder nobody reviewed otherwise.
```

```ts
// Wrong: it was small, so it was added. Nothing in the record says this folder exists,
// and the next reader finds it by tripping over it.
```

They differ in one thing: whether the file list still describes the feature.

### The proof that proves the lane

```ts
await world.graphql(learner).submitCourseReview({ courseId: COURSE, score: 5 })
await until(() => world.db.reviewStats(COURSE).then((s) => s.count === 1),
    { timeout: 10_000, describe: "the review projection to rebuild after the source write" })
expect((await world.db.reviewStats(COURSE)).average).toBe(5)
```

```ts
// Wrong: the source row is written and the projection is recomputed by hand. Serialization,
// the consumer group and delivery are all absent, and those are what CDC is.
await entityManager.save(review)
await listener.recomputeTarget({ courseId: COURSE })
```

They differ in one thing: whether CDC itself was under test.
