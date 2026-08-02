# API design — naming, versioning, paging, idempotency, and the envelope

This file decides what a service promises to a caller and what it may change later. It is portable:
the concrete idiom below is a code-first GraphQL schema over Nest with a REST minority for webhooks
and admin, but every rule is stated so a different transport can obey it.

The industry ground is Google's API Improvement Proposals (`google.aip.dev`), Stripe's public API
conventions, Roy Fielding's dissertation (2000) for the uniform-interface and statelessness
constraints, and Michael Nygard's *Release It!* (2007/2018) for the failure modes that make paging
and timeouts a design concern rather than an implementation detail.

## Resources are nouns, and the verb set is closed

**Name the thing, then use the standard operation set on it — List, Get, Create, Update, Delete
(AIP-121 and AIP-131 to 135). A custom operation is legal only when the standard set genuinely
cannot express the intent, and it says why in its description.** The reason is not taste: a closed
verb set is what lets a reader predict a field they have never seen. Once `enrollUser`,
`registerUser` and `activateEnrollment` all exist, every operation becomes something to look up.

In a code-first graph the same rule reads: the schema field is `<verb><Resource>` with the verb drawn
from the closed set, `list` returns a page and `get` returns one, and a genuine custom method is
named for the domain event it causes rather than for the row it writes — `refundPayment`, not
`updatePaymentStatus`. A custom method that is really an update in disguise is a field the client has
to be told about.

**Do not encode the transport in the name.** `getUserApi`, `createOrderMutation` and
`fetchInvoiceQuery` repeat what the schema already says.

## Versioning: a breaking change gets a version, never a silent redefinition

Two mechanisms exist and they are not interchangeable.

- **A path- or header-versioned surface** (REST, webhooks) pins the caller to a shape. Stripe's
  date-pinned versions are the reference implementation of the underlying rule: *the caller migrates
  on their schedule, not on yours*. A controller therefore always carries an explicit version rather
  than defaulting to unversioned.
- **A graph has no version segment, so the field is the version.** Evolution is additive: add the
  new field beside the old, mark the old deprecated with the replacement named in the deprecation
  reason, and delete only when telemetry shows nobody selects it. A graph that ships `v2` of itself
  has given up the one property that made it a graph.

**What counts as breaking is wider than "I removed something".** All of these break a client that was
working yesterday: removing a field or an operation; narrowing a return type; making an optional
input required; adding a required input without a default; tightening validation on an existing
input; changing the meaning of an enum member; changing a default page size or a default sort.
Adding an enum member is breaking for any client that switches exhaustively over it, which is why a
returned enum should be documented as open from the day it ships.

This is machine-checkable and should not be left to review: run a schema diff in CI
(`graphql-inspector diff` against the deployed schema, or `buf breaking` for protobuf) and fail the
build on a breaking classification. What is *judgement* is whether a change nobody has adopted yet
counts as breaking — that needs usage data, not a linter.

## Every list is paged, and the server owns the bound

**No operation may return an unbounded set.** This is Nygard's Unbounded Result Set anti-pattern: the
query works for a year on real data, then one account has forty thousand rows and the response
serialises until the process dies. The bound belongs to the server because the client that forgets to
send a limit is exactly the client that will bring the service down.

**Prefer an opaque cursor over an offset (AIP-158).** Offset paging drifts when rows are inserted
between page reads, so a caller walking pages both misses and repeats records, and deep offsets
degrade because the engine still walks the skipped rows. A cursor encodes the sort key of the last
row seen; making it opaque is what keeps the sort key free to change without breaking clients that
stored a page token.

Clamping is the last line of defence and belongs in one shared helper, not copied per handler:

```ts
// One place, so the bound cannot drift between operations.
export const resolvePageSize = (requested?: number): number =>
    Math.min(MAX_PAGE_SIZE, Math.max(1, requested ?? DEFAULT_PAGE_SIZE))
```

Handlers that each hand-roll `Math.min(50, ...)` inline are how one operation quietly ends up with a
cap of 50 and its neighbour with 500. A lint rule can catch the literal (`no-restricted-syntax` on a
`Math.min` whose argument is a numeric literal inside a resolver); it cannot decide what the cap
should be, which is a load question and therefore judgement.

## Idempotency keys on every unsafe write

Networks retry. A client that times out on a create does not know whether the create happened, so it
retries, and without a key the second attempt is a second order. **Every unsafe write that a client
may retry accepts a caller-supplied idempotency key and replays the original result when the same key
arrives again.** Stripe made this the industry expectation for HTTP; Hohpe and Woolf's Idempotent
Receiver (*Enterprise Integration Patterns*, 2003) is the same rule for messaging, and it is the same
rule because both transports deliver at least once.

The part that is usually wrong is the gate. A `SELECT` that finds no record followed by an `INSERT`
is not a gate: two concurrent retries both read nothing and both proceed. **The gate is a unique
index, inside the transaction that performs the effect.**

```ts
// The gate is the UNIQUE INDEX on (key, operation) — not the read that would precede it.
async create(input: CreateOrderInput): Promise<CreateOrderData> {
    try {
        return await this.entityManager.transaction(async (manager) => {
            // Insert FIRST. A concurrent retry carrying the same key blocks on the unique
            // index here until this transaction ends, so the effect below runs exactly once.
            const claim = await manager.insert(IdempotencyKeyEntity, {
                key: input.idempotencyKey,
                operation: CREATE_ORDER,
                userId: input.userId,          // scoped: one caller cannot replay another's key
                requestHash: hashRequest(input),
            })

            const order = await manager.save(manager.create(OrderEntity, {
                userId: input.userId,
                amount: input.amount,
            }))
            const data = { orderId: order.id, amount: order.amount }

            // Result commits atomically with the effect, so a replay can never answer
            // "already done" without being able to say what was done.
            await manager.update(IdempotencyKeyEntity, claim.identifiers[0].id, { result: data })
            return data
        })
    } catch (error) {
        if (!isUniqueViolation(error, "uq_idempotency_key_operation")) throw error

        // The first attempt committed. Replay its stored result rather than reporting a
        // conflict: the caller is retrying, not colliding.
        const settled = await this.entityManager.findOneOrFail(IdempotencyKeyEntity, {
            where: { key: input.idempotencyKey, operation: CREATE_ORDER },
        })
        if (settled.requestHash !== hashRequest(input))
            throw new IdempotencyKeyReusedException({ key: input.idempotencyKey })
        return settled.result as CreateOrderData
    }
}
```

Three properties are doing the work and each is easy to drop by accident. The key is **scoped to the
caller**, or one tenant can read another's result by guessing a key. The **request is hashed** and
compared, so reusing a key with different arguments is an error rather than a silently wrong replay.
And keys **expire** — twenty-four hours is the common window — because an idempotency table that
never sheds rows becomes the largest table in the database.

If the first attempt rolls back, the unique index frees and the retry proceeds normally. That is the
reason to claim inside the transaction rather than in one of its own.

## Errors are a machine-readable code before they are a sentence

**Every failure carries a stable enum code, and the human sentence is a second field** (AIP-193's
canonical error model). A client cannot branch on prose, and prose is exactly what gets reworded for
tone. Localise the sentence; never localise the code.

**Classification is load-bearing beyond the client.** 4xx means the caller can fix it and nobody
should be paged; 5xx means we can fix it and someone should be. Returning validation failures as 500
does not merely mislead a developer, it destroys the error-rate signal that reliability is measured
with (Google SRE, four golden signals). The inverse — swallowing a genuine internal fault as a 400 so
the dashboard stays green — is worse.

**Where the transport pins the status, the code carries the contract.** A graph endpoint answers 200
for a business failure, so the envelope's error code is the status as far as the client is concerned,
and any alerting rule that reads the HTTP status alone will report a perfectly healthy service that
is failing every request. Say which field the metric reads.

Map domain exceptions to codes in exactly one place — a global exception filter — so a handler never
chooses a status, and so an unmapped exception has a defined fallback instead of leaking a stack
trace or an ORM message to the caller.

## One envelope, applied by the framework, never hand-built

**Pick one response shape and apply it to everything through an interceptor.** The shape that holds
up is a success flag, a human message, a machine error code, and the payload:

```ts
{ success: boolean, message: string, error: string | null, data: T | null }
```

The value is that every client writes one unwrap and one error branch. The cost, which must be paid
deliberately, is that the envelope hides the transport status — so an envelope obliges the rules in
the previous section rather than excusing them.

**A handler returns the payload and nothing else.** The moment a handler builds `{ success: true, … }`
itself, two shapes exist and the client's single unwrap is a lie. This is machine-checkable: ban the
literal key in handler files with an ESLint `no-restricted-syntax` rule, or type the handler's return
as the payload type so a hand-built envelope fails `tsc`. The second is better, because a type error
arrives before the lint stage.

Errors go through the same envelope by the same mechanism — a global filter — for the same reason.

## Related

[`data-access.md`](data-access.md) (the transaction the idempotency gate lives in) ·
[`module-layering.md`](module-layering.md) (why the handler is thin enough to have nothing to build
an envelope out of).
