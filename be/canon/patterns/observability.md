# observability

## Definition

A log is a **structured event with a stable name**, not a sentence. It leaves through one service,
its first argument is an enum member, and everything variable rides beside that name as data.

The reason is what happens after the log leaves the process. A line reading
`handling order 4f2a for user 91` is legible to a person and opaque to everything else: it cannot
be counted, grouped, alerted on, or filtered by user without a regular expression that breaks the
first time somebody rewords the sentence. The same event as `ORDER_HANDLED` plus
`{ orderId, userId }` can be counted the moment it exists.

The question that settles it: **would you want to know how many times this happened?** If yes — and
for anything worth logging the answer is yes — it needs a name that survives being reworded.

What holds this law is [`sources/be/observability.mjs`](../../../sources/be/observability.mjs).

## Rules

**OBSERVABILITY-1 · Logs leave through the house logging service, and nothing else.**

Not the framework's own logger, not `console`. The house service is where the correlation id, the
transport configuration and the redaction live; anything logging past it produces lines that arrive
somewhere else, or nowhere, and that carry none of the context every other line has.

This is not about formatting. A framework logger writes to stdout in the right shape and still
loses the request it belonged to.

**OBSERVABILITY-2 · The event name is an enum member, never an interpolated string.**

The first argument names WHAT happened and is drawn from a closed set. A template literal is the
failure this rule exists for: it fuses the name and the data into one string, so the name stops
being groupable and the data stops being queryable, in one move.

**OBSERVABILITY-3 · The variable part travels as structured data beside the name.**

Ids, counts, durations, the outcome. Passing them as a second argument keeps them typed and keeps
them searchable, and it means adding a field later does not reword the event.

**OBSERVABILITY-4 · Log the decision, not the arrival.**

`ENROLLMENT_OPENED` earns its place; "entering method X" does not. A log that records that code ran
tells a reader what they could have got from the source; a log that records what the code DECIDED —
and on what evidence — is the thing nobody can reconstruct afterwards.

**OBSERVABILITY-5 · A failure logs its exception's identity, not its rendered message.**

The code and the metadata, so the alert groups by what actually broke. A stringified message groups
by wording, which means one failure becomes several the day somebody improves the English.

**OBSERVABILITY-6 · A standalone program is the one sanctioned exit, and it is scoped by path.**

An agent or CLI that runs outside the request lifecycle has no request to correlate and no transport
configured — the house service would give it nothing but a dependency. Those programs may use a
plain logger, and the exit is declared once in the lint config against their folder rather than as a
suppression on each line.

The distinction is not "it is a small program". It is whether a request exists to attach the line
to: everything served over HTTP or a queue has one, and everything with one uses the house service.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| The framework's own `Logger` | It bypasses the correlation id and the transport configuration, so the line arrives without the context every other line has | Inject the house logging service |
| `console.log` / `console.error` | Same, plus it never reaches the log pipeline at all | Same |
| A template literal as the event name | It fuses the name and the data, so neither can be grouped or queried | An enum member, plus a data object |
| String concatenation as the event name | The same thing with a different operator | Same |
| A bare string as the event name | It is one reword away from being a different event to every dashboard | Add the member to the enum |
| Logging method entry and exit | It says the code ran, which the source already said | Log the decision and its evidence |
| Logging a stringified exception message | Alerts then group by wording, so improving the English splits one failure into several | Log the code and the metadata |

## Examples

### The ordinary case — a name and its data

```ts
this.winstonService.info(WinstonLog.EnrollmentOpened,
    {
        userId: user.id,
        courseId,
        source: "checkout",
    })
```

```ts
// Wrong: one string. Nothing can count enrollments, nothing can filter by course, and the day
// somebody rewords this line every dashboard built on it goes quiet.
this.winstonService.info(`opened enrollment for ${user.id} on ${courseId}`)
```

They differ in one thing: whether the event can be counted.

### The logger trap

```ts
constructor(private readonly winstonService: WinstonService) {}
```

```ts
// Wrong: it writes in the right shape and still loses the request it belonged to, because the
// correlation id lives in the service this bypasses.
private readonly logger = new Logger(AddToCartHandler.name)
```

They differ in one thing: whether the line can be tied back to the request that produced it.

### The failure trap

```ts
this.winstonService.error(WinstonLog.EnrollmentFailed,
    {
        code: error.code,
        courseId,
        userId: user.id,
    })
```

```ts
// Wrong: the alert now groups by wording. Rewording the exception's message splits one alert
// into two, and nobody notices because both are quiet.
this.winstonService.error(`enrollment failed: ${error.message}`)
```

They differ in one thing: whether the grouping key survives an edit to the English.

### The noise trap

```ts
// the decision, and what it was made on
this.winstonService.info(WinstonLog.TrialGranted,
    {
        userId: user.id,
        reason: "no prior enrollment",
    })
```

```ts
// Wrong: this says the function was called, which the call site already said.
this.winstonService.info(WinstonLog.MethodEntered,
    {
        method: "grantTrial",
    })
```

They differ in one thing: whether a reader learns something the source could not tell them.
