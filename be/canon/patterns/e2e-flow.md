# e2e flow

## Definition

This is the shape of one flow file: how a business sentence becomes a test that fails when the
business breaks and at no other time.

`testing.md` settles WHICH tests belong in this lane and what they must assert. This file settles
how one of them is written — the parts a flow needs, the order they go in, and the four habits that
turn a good flow test into a slow flaky one.

The question it answers: **when this goes red at 3am, will the person reading it know which step
broke and why?** A flow that answers "no" is a flow that gets re-run rather than read, and a test
that gets re-run rather than read has stopped being a test.

What holds the machine-checkable part is [`sources/be/e2e-flow.mjs`](../../../sources/be/e2e-flow.mjs),
and it is **five of the twelve rules below** — FLOW-3, the persisted-state half of FLOW-4,
FLOW-7, the direct-internal-actor half of FLOW-11, and the provider-import half of FLOW-12.
That is the honest number, not a gap.
The rest turn on what a name means, what is being asserted, or who is acting, and a rule that fires
on a judgement is one authors learn to disable — which leaves the law worse off than when nothing
enforced it. The module records what was measured and left alone, so the next reader does not
"finish the job".

## Rules

**FLOW-1 · One file, one flow, and the file is named for the sentence.**

`course-purchase.e2e-spec.ts`, describing "a learner buys a course and can start it". Not a
resolver group, not an endpoint. The name is the promise; the file is the proof.

**FLOW-2 · The flow is a sequence of NAMED steps, not one long case.**

Each step is its own `it`, in order, sharing state through the describe scope. A 300-line single
case gives one red line and no idea which of eleven operations broke; eleven named steps give the
step, and the ones after it are skipped rather than cascading into noise.

The steps are ordered because the business is ordered. That is the one place a test may depend on
the case before it, and it is exactly what a flow is.

**FLOW-3 · Never sleep. Poll until the state settles, with a deadline.**

`await sleep(500)` is the single largest source of flake in a flow suite, and it fails in both
directions at once: too short and the suite goes red for a reason that is not a defect; too long
and every run pays for the worst case. Both get "fixed" by raising the number, which makes the
suite slower without making it correct.

Poll the state instead — `await until(() => enrollmentExists(userId, courseId))` — with a deadline
that fails LOUDLY and says what it was waiting for. A deadline is a real assertion: "this should
settle within N seconds" is a claim about the system.

**FLOW-4 · Assert the consequence, and read it from where it lives.**

The row from the database, the message off the socket, the balance from the next query. Not the
response envelope, which proves only that the server replied.

**FLOW-5 · A realtime step opens a real client, and asserts what arrived — never how many.**

`expect(messages.length).toBe(2)` encodes how many listeners happened to be connected. Add a
third subscriber and a correct system goes red; deliver the wrong payload to the right count of
people and a broken one stays green.

Await the NEXT message matching a predicate, and assert its content and its recipient. The count is
an implementation detail of the fan-out; the content is the promise.

**FLOW-6 · The negative is part of the flow.**

Before the visitor subscribes, they must receive nothing. Before payment settles, the entitlement
must be closed. A flow that only asserts what SHOULD arrive cannot catch a system that sends
everything to everybody — which is the failure that matters most, because it is invisible from the
happy path.

**FLOW-7 · No branch in a test.**

`if (state === NeedWater) { ...assert... }` means the file asserts different things on different
runs, and the run where the branch is skipped is green while proving less. If the condition is part
of the flow, force it and assert unconditionally. If it is not, it does not belong here.

**FLOW-8 · One place stands the world up.**

A testing-infra module that boots the app, the database, the broker and the sockets, so a flow file
opens with what it is testing rather than with two hundred lines of wiring. When the wiring changes,
one file changes.

**FLOW-9 · Actors are named, and they are created by the flow.**

`learner`, `otherLearner`, `company` — not `accountNumber: 8`. A magic ordinal tells a reader
nothing and collides silently when two flows pick the same one. The helper mints a fresh actor per
flow, so flows never share state and can run in any order.

**FLOW-10 · A flow logs nothing.**

`console.log` inside a test is output nobody reads on a green run and noise that buries the
assertion on a red one. What a reader needs when it fails is the step name and the assertion, both
of which the runner already prints.

**FLOW-11 · Operational chains enter at their production boundary and keep every internal hop real.**

A fallback, retry, queue, scheduler, projection, cache-invalidation or realtime-delivery flow is
an E2E only when the test enters through GraphQL/HTTP/socket, publishes to the real broker, or lets
the real scheduler fire. Importing a worker so Nest can register it is correct; resolving that
worker and calling `process`, `finalize` or another internal method is not. The direct call erases
serialization, locking, retry, acknowledgement and competing-consumer behaviour — exactly the
behaviour the operational flow exists to prove.

**FLOW-12 · Override the external result, never the internal policy that chooses it.**

AI E2E keeps `AiInvokeService`, the balancer, key rotation, health cache, entitlement and billing
real; Jest scripts only the concrete provider client's `invoke`/`stream` result or error. Payment
E2E keeps reconciliation, action routing and grants real; Jest scripts only Stripe/PayOS/PayPal/
NOWPayments. The same boundary applies to Keycloak, SMTP, GitHub, Judge0 and FFmpeg. Mocking an
internal orchestrator makes fallback, attribution, rollback and idempotency disappear while the
test remains green.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| `await sleep(ms)` | Flaky when short, slow when long, and both are "fixed" by raising the number | `await until(predicate, { timeout })` |
| One `it` covering the whole flow | A single red line for eleven operations, so nobody knows which broke | One named `it` per step |
| Asserting a message COUNT | It encodes how many listeners exist; a third subscriber reddens a correct system | Await the next matching message; assert content and recipient |
| A mutable recorder reset by hand between steps | One forgotten reset and a later step counts an earlier event | A helper that awaits the next N matching messages |
| `if` around an assertion | The run that skips the branch is green while proving less | Force the condition, or drop the case |
| A magic actor ordinal (`accountNumber: 8`) | It says nothing, and two flows silently collide on it | A named actor minted per flow |
| `console.log` in a test | Unread when green, noise when red | The step name and the assertion |
| Asserting only the response status | It proves the server replied and nothing else | Read the state back |
| Calling a resolved `*Worker` / `*Handler` | It skips the broker/CQRS boundary and all delivery semantics | Register it, then trigger the real queue/transport |
| Mocking an internal fallback/orchestration service | It removes the policy the operational E2E is meant to prove | Mock only the external SDK result/error |

## Examples

### The shape

```ts
describe("a learner buys a course and can start it", () => {
    let learner: Actor
    let orderId: string

    beforeAll(async () => {
        world = await bootE2eWorld()
        learner = await world.mintLearner()
    })

    it("puts the course in the cart", async () => {
        await world.graphql(learner).addToCart({ courseId: COURSE })
        expect(await world.db.cartSize(learner.id)).toBe(1)
    })

    it("checks out and gets an order", async () => {
        orderId = (await world.graphql(learner).checkout()).orderId
        expect(await world.db.orderState(orderId)).toBe(OrderState.Pending)
    })

    it("opens the enrollment when the provider settles", async () => {
        await world.provider.postWebhook({ orderId, status: "PAID" })
        await until(() => world.db.isEnrolled(learner.id, COURSE))
        expect(await world.db.xpTotal(learner.id)).toBe(startingXp + COURSE_ENROLL_XP)
    })
})
```

### The sleep trap

```ts
// the deadline is an assertion: this flow claims the webhook settles within ten seconds
await until(() => world.db.isEnrolled(learner.id, COURSE),
    { timeout: 10_000, describe: "the enrollment to open after the PAID webhook" })
```

```ts
// Wrong: red when the broker is busy, slow on every run that is not, and the fix everybody
// reaches for is to make 500 into 2000 -- which buys neither correctness nor speed.
await sleep(500)
expect(await world.db.isEnrolled(learner.id, COURSE)).toBe(true)
```

They differ in one thing: whether the wait is bounded by the outcome or by a guess.

### The fan-out trap

```ts
// what arrived, and to whom
const delivered = await world.socket(learner).nextMessage("notification")
expect(delivered.type).toBe("ENROLLMENT_OPENED")
expect(delivered.courseId).toBe(COURSE)
```

```ts
// Wrong: two is how many listeners are connected today. A third subscriber reddens a correct
// system, and delivering the wrong payload to two people keeps this green.
expect(messageRecorder[EVENT].length).toBe(2)
```

They differ in one thing: whether the assertion is about the promise or about the plumbing.

### The negative

```ts
it("does not notify a learner who is not watching this course", async () => {
    await world.graphql(learner).markLessonComplete({ lessonId: LESSON })
    await expectNoMessage(world.socket(otherLearner), "notification", { within: 1_000 })
})
```

```ts
// Wrong: the flow only ever asserts what SHOULD arrive, so a system that broadcasts everything
// to everybody passes every case in the file.
it("notifies the learner", async () => { /* ... */ })
```

They differ in one thing: whether over-delivery is detectable.
