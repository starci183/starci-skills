# testing

## Definition

There are two kinds of test here and they answer different questions. An **e2e** answers *does the
business run?* — one flow, start to finish, the way money and state actually move through the
system. A **unit spec** answers *does this decision come out right?* — one branch, one rule, one
calculation, with nothing real behind it.

An e2e is therefore long on purpose. "The reader adds a course to the cart, checks out, the payment
provider calls back, the enrollment opens, the XP lands" is ONE test, because that sentence is the
promise the business makes. Split into five tests it stops being a promise and becomes five
descriptions of five endpoints, none of which says whether the thing works.

The question that settles which lane a test belongs to: **could this break in production without
the test noticing?** If the answer is yes, the test is not covering the thing it appears to cover —
and for a flow, that usually means it asserted the response instead of the consequence.

What holds the machine-checkable half is [`sources/be/testing.mjs`](../../../sources/be/testing.mjs).
Most of this law is not machine-checkable, which is the reason it is written this carefully.

## Rules

**TESTING-1 · An e2e is one business flow, and its name is the flow.**

`course-enroll`, `courses-checkout`, `rewards-redeem` are flows. `jobs-queries`,
`rewards-queries`, `coding-queries` are not — they are a resolver group wearing a test's clothes,
and no file in that shape can say whether anything works, only that several endpoints replied.

The test is what the file is called after. If the honest name is a noun phrase for a part of the
API rather than a sentence about the business, the file is in the wrong shape.

**TESTING-2 · The assertion is the consequence, never the envelope.**

`status === 200` and `__typename` prove the server is alive. They do not prove a row moved, a
balance changed, an entitlement opened or an event went out. Read the state back — from the
database, from the next query, from the event the flow emits — and assert THAT.

A flow whose test only reads its own response is a flow that can silently stop persisting.

**TESTING-3 · The test travels the way the flow travels.**

Whatever transport the flow uses in production, the test uses. An asynchronous step — a job, a
webhook, an encode — is polled until the state settles rather than asserted on the line after the
call, because asserting immediately tests the scheduler's speed and nothing else. A realtime step
opens a REAL client and waits for the message. A write is read back out of the database.

The CQRS bus, a handler, a resolver and a worker method are application internals, not transports.
Calling `commandBus.execute(...)`, `handler.execute(...)`, `resolver.execute(...)` or
`worker.process(...)` starts after routing, authentication, validation and serialization have
already succeeded, so the flow can stay green while its production door is broken. They belong in
the integration or unit lane. An e2e enters through GraphQL, HTTP, a real socket, a broker message
or the scheduler boundary that production enters through.

There is no prize for a test that only speaks one protocol. A flow that is half HTTP and half
socket, tested over HTTP alone, is half tested — and the untested half is the half that is hard.

**TESTING-4 · The happy path is the subject; an unhappy path earns an e2e by dragging a critical
flow behind it.**

The happy path IS the business, so it is what an e2e is for. An unhappy path belongs here only when
failing sets off something that must also be right: the payment succeeded and the bank then failed,
so a REFUND has to run; a charge arrived twice, so idempotency has to hold; two writers raced, so
the constraint has to catch it.

An unhappy path that merely returns a validation error is a decision, not a flow. It belongs in a
unit spec, where it costs milliseconds instead of a database.

**TESTING-5 · A unit spec covers the decision branches.**

Every branch that can change the outcome gets a case: the boundary, the empty set, the already-done,
the not-permitted. Coverage here means the DECISIONS are covered, not that the lines were executed —
a file can run every line and still never take the branch that matters.

**TESTING-6 · A spec that only asserts a call tests the implementation.**

`expect(service.charge).toHaveBeenCalledWith(...)` with no assertion on the result restates the
handler's own source. Rewrite the handler correctly and the spec goes red; break the business rule
while keeping the call shape and it stays green. That is backwards, and it is the exact reason a
suite can be large and prove little.

Assert what came back, or what changed. A call assertion is legitimate only as a SECOND assertion,
where the call itself is the observable effect — an email sent, an event published.

**TESTING-7 · The lanes are separated by suffix, not by path.**

`*.spec.ts`, `*.int-spec.ts`, `*.e2e-spec.ts`, `*.harness-spec.ts`. This is what lets every lane
live near the code it exercises while the fast unit run stays fast, and it means a test's lane is
visible in its filename rather than inferred from where somebody filed it.

**TESTING-8 · A lane with no files is not a passing lane.**

A suite configured to pass when it finds nothing reports green forever, and green is what everybody
reads. Either the lane has tests or it is removed — a configured, scripted, empty lane is a claim of
coverage that nothing backs.

**TESTING-9 · An e2e never calls a model. The harness is the only lane that does.**

A model call costs money, takes seconds, and answers differently every time. All three properties
are fatal in a flow test: the suite becomes expensive to run, slow enough that people stop running
it, and flaky in a way that trains everybody to re-run rather than read.

So a flow that passes through a model **overrides it with Jest** — a mocked provider, or a testing
module that supplies a stub in its place — and asserts everything around it: that the request was
recorded, the quota was spent, the entitlement was checked, the answer was persisted and returned.
Those are the parts that break. Whether the sentence the model produced was any good is a different
question, asked in a different lane.

**THE STUB RETURNS REALISTIC JSON, IN THE SHAPE THE PARSER EXPECTS.** This is the part that is easy
to get wrong and expensive to get wrong. A stub answering `"stubbed"` skips the strict-JSON parser
entirely — and the parser is the piece most likely to break, because it is where a model's output
meets a schema. A flow whose stub returns a marker proves the plumbing and hides the one seam that
actually fails in production.

So the canned payload carries the real fields, with values a real answer could have: the scores in
range, the arrays non-empty, the enum members ones the schema declares. It is a fixture of the
model's OUTPUT, not a placeholder standing in for one.

**The override is the default, never something a flow author remembers.** The world boots with the
model stubbed; reaching a provider takes a deliberate opt-out. A rule that depends on being
remembered is a rule that is one distracted afternoon from being broken, and the breakage shows up
as a slow, expensive, intermittently-red suite that nobody can explain.

The override is the boundary between the two lanes, and it runs the other way in the harness: there,
a call that is faked proves nothing, so **if it calls, it really calls**.

**TESTING-10 · The harness calls the provider directly, and keeps to one or two cases.**

The harness exists to ask *is the model's answer acceptable?* — so it talks to the provider's own
client and nothing else, and it makes the call for real. A faked call here proves nothing at all:
the whole subject of the lane is what the model actually said.

Every layer between the harness and the provider is a layer that can make the harness pass while
production fails: a tier indirection, a routing override, a house wrapper choosing the model. Each
one means the thing under test is not the thing that ships.

And it stays small. One or two cases per capability, chosen because they are the ones that would
expose a regression — not a matrix. A harness billed per call that grows a case per edge is a
harness somebody eventually stops running, and an eval nobody runs is worth less than no eval,
because its last green result is still on the board.

**TESTING-11 · A demo seed represents a living product world, not one empty account.**

A local seed exists so a reader can inspect real product states through production read paths. It
therefore seeds a deterministic cohort with varied progress: resumed work, consecutive activity,
earned currency, populated aggregates and social outcomes involving several actors. Empty states
still deserve fixtures, but an all-empty world cannot reveal whether lists, counts, rankings,
progress or cross-user joins are correct.

The seed writes source records and invalidates derived projections so normal handlers rebuild them.
It is idempotent and accepts the account being inspected; it never pins screenshot-only JSON or
assumes one hard-coded identity is the person currently signed in.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| An e2e named for a resolver group (`*-queries`) | No file in that shape represents a flow, so passing says only that endpoints replied | Name it for the business sentence and make it one flow |
| Asserting only `status` / `__typename` in an e2e | It proves the server is alive and nothing else; the flow can stop persisting silently | Read the state back and assert the consequence |
| Asserting an async result on the line after the call | It tests how fast the scheduler happened to be, and is flaky by construction | Poll until the state settles, with a bounded wait |
| Testing a realtime flow over HTTP only | The untested half is the half that is hard | Open a real client and wait for the message |
| Calling `CommandBus`, `QueryBus`, a handler, resolver or worker method from an e2e | It enters after production routing, guards, validation and serialization, so those seams can break while the flow stays green | Enter through GraphQL, HTTP, a real socket, broker or scheduler boundary |
| An e2e for a plain validation error | It costs a database to prove a branch | Put it in a unit spec |
| A unit spec whose every assertion is `toHaveBeenCalled*` | It restates the source: correct rewrites go red, broken rules stay green | Assert the returned value or the changed state |
| Splitting one flow into a test per endpoint | The promise disappears; five endpoint descriptions do not add up to one working flow | One file, one flow, start to finish |
| A configured lane with no specs in it | It reports green forever, and green is what gets read | Fill it or delete it |
| Calling a model from an e2e | It costs money, takes seconds and answers differently every time - so the suite becomes expensive, slow and flaky all at once | Stub the model; assert the quota, the persistence and the response around it |
| A stub returning a marker string (`"stubbed"`, `"ok"`) | It skips the strict-JSON parser, which is the seam most likely to break, so the flow proves the plumbing and hides the failure | Return realistic JSON in the shape the parser expects |
| Relying on each flow author to remember the stub | A rule that must be remembered is one distracted afternoon from being broken | Stub by default in the world; make reaching a provider a deliberate opt-out |
| A harness reaching the provider through a tier or routing layer | The thing under test is then not the thing that ships, and the harness can pass while production fails | Call the provider's own client directly |
| A harness that grows a case per edge | It is billed per call, so it becomes something people stop running - and a stale green is worse than no green | One or two cases per capability, chosen to expose a regression |
| A demo seed containing one all-zero learner | It hides populated branches and every relationship involving another actor | Seed an idempotent cohort with varied source data, then let production read models derive the screen |

## Examples

### The ordinary case — a flow says the business runs

```ts
// e2e: one sentence about the business, end to end. The assertion is the consequence.
it("a paid checkout opens the enrollment and lands the XP", async () => {
    await addToCart(courseId)
    const { orderId } = await checkout()
    await postProviderWebhook({ orderId, status: "PAID" })

    // the webhook is asynchronous - wait for the state to settle rather than for a timer
    await until(async () => (await countEnrollments(userId, courseId)) === 1)

    const enrollment = await entityManager.findOneOrFail(EnrollmentEntity, {
        where: { user: { id: userId }, course: { id: courseId } },
    })
    expect(enrollment.isEnrolled).toBe(true)
    expect(await xpTotal(userId)).toBe(startingXp + COURSE_ENROLL_XP)
})
```

```ts
// Wrong: three endpoint checks. Every one passes while nothing is persisted.
it("addToCart returns 200", async () => expect((await addToCart(courseId)).status).toBe(200))
it("checkout returns 200", async () => expect((await checkout()).status).toBe(200))
it("webhook returns 200", async () => expect((await postProviderWebhook({})).status).toBe(200))
```

They differ in one thing: whether a silent failure to persist would be caught.

### The unhappy path that earns its place

```ts
// e2e: the payment succeeded and the bank then failed, so the refund must run and the
// entitlement must close again. This is critical, so it is a flow.
it("a settlement failure after capture refunds and closes the entitlement", async () => {
    const { orderId } = await checkoutAndCapture()
    await postProviderWebhook({ orderId, status: "SETTLEMENT_FAILED" })

    await until(async () => (await refundState(orderId)) === "REFUNDED")

    expect(await walletBalance(userId)).toBe(startingBalance)
    expect(await isEnrolled(userId, courseId)).toBe(false)
})
```

```ts
// Wrong lane: a missing field is a decision, not a flow, and it does not need a database.
it("checkout rejects an empty cart", async () => {
    const response = await checkout()
    expect(response.errors[0].message).toContain("empty")
})
```

They differ in one thing: whether failing sets off something else that must also be right.

### The transport trap

```ts
// e2e: the flow ends on a socket, so the test opens one and waits for the message.
const socket = await connectSocket(token)
const delivered = firstMessage(socket, "notification")

await markLessonComplete(lessonId)

expect((await delivered).type).toBe("STREAK_EXTENDED")
```

```ts
// Wrong: the same flow tested over HTTP alone. The half that is hard - delivery - is untested,
// and the test passes while nothing ever reaches a reader.
await markLessonComplete(lessonId)
expect((await getNotifications()).length).toBe(1)
```

They differ in one thing: whether the delivery half of the flow was exercised at all.

### The call-assertion trap

```ts
// unit: it asserts the DECISION - what the handler concluded from what it was given.
it("charges the discounted price when a coupon applies", async () => {
    const result = await handler.execute(command({ coupon: "HALF" }))
    expect(result.chargedAmount).toBe(5000)
})
```

```ts
// Wrong: it restates the source. Rename the collaborator's method and this goes red; change
// the discount to the wrong number and it stays green.
it("charges the discounted price when a coupon applies", async () => {
    await handler.execute(command({ coupon: "HALF" }))
    expect(payments.charge).toHaveBeenCalledWith(expect.anything())
})
```

They differ in one thing: whether a wrong number would be caught.

### The lane trap — a flow through a model

```ts
// e2e: the model is stubbed with realistic JSON, so the flow still runs the strict parser -- and
// the test asserts what can actually break: the entitlement check, the quota spend, the persistence.
aiInvoke.run.mockResolvedValue({
    text: JSON.stringify({
        answer: "A closure keeps access to its enclosing scope after that scope returns.",
        citations: [{ contentId: CONTENT, quote: "lexical scope" }],
        confidence: 0.82,
    }),
})

await ask(CONTENT, "what is a closure?")

const session = await entityManager.findOneOrFail(ContentAiSessionEntity, { where: { contentId: CONTENT } })
expect(session.turns).toHaveLength(1)
expect(session.turns[0].citations).toHaveLength(1)
expect(await remainingQuota(learner.id)).toBe(startingQuota - 1)
```

```ts
// Wrong: a marker. The parser never runs, so the seam where a model's output meets a schema --
// the piece most likely to break -- is the one piece this flow does not touch.
aiInvoke.run.mockResolvedValue({ text: "stubbed" })
```

They differ in one thing: whether the parser is exercised.

```ts
// Wrong lane entirely: a real model call inside a flow test. It costs money, adds seconds, and the
// assertion has to be loose enough to survive a different wording - so it stops catching anything.
const response = await ask(CONTENT, "what is a closure?")
expect(response.answer.toLowerCase()).toContain("closure")
```

They differ in one thing: whether the test can fail for a reason that is not a defect.

### The harness trap — testing the wrapper instead of the model

```ts
// harness: the provider's own client, one case, chosen because a regression would show here.
const message = await anthropic.messages.create({
    model: HARNESS_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: gradingPrompt(submission) }],
})
expect(scoreFrom(message)).toBeGreaterThanOrEqual(PASSING)
```

```ts
// Wrong: routed through the house tier resolver. If that layer picks a different model in
// production than it picks here, the harness is green about a model nobody ships.
const text = await models.generate("cheap", { prompt: gradingPrompt(submission) })
expect(scoreFrom(text)).toBeGreaterThanOrEqual(PASSING)
```

They differ in one thing: whether the model under test is the model that ships.

### Covering the decision, not the line

```ts
// unit: every branch that changes the outcome has a case.
it.each([
    ["no attempts", 0, "FIRST_TRY"],
    ["at the cap", MAX_ATTEMPTS, "EXHAUSTED"],
    ["past the cap", MAX_ATTEMPTS + 1, "EXHAUSTED"],
])("resolves %s to %s", async (_name, attempts, expected) => {
    expect(await handler.execute(command({ attempts }))).toBe(expected)
})
```

```ts
// Wrong: one case in the middle of the range. Every line runs, the boundary is never taken,
// and an off-by-one at the cap ships.
it("resolves the attempt state", async () => {
    expect(await handler.execute(command({ attempts: 2 }))).toBe("FIRST_TRY")
})
```

They differ in one thing: whether the boundary was taken.

### The seed trap — painting a screenshot instead of building its world

```ts
await seedDemoWorld({
    currentLearner: { resumedLessons, activeDays, earnedCurrency, gradedWork },
    learners: variedLearners,
    challengePassers,
})
await invalidateDerivedProjections(currentLearner.id)
```

```ts
// Wrong: the screen looks populated, but no production join or projection can prove it.
await writeDashboardProjection(currentLearner.id, screenshotShapedJson)
```

They differ in one thing: whether the UI is reading a real world or a painted result.
