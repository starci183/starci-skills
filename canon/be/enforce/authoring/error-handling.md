# Error handling (BE)

> Scope: how a server-side application REPRESENTS a failure, where it TRANSLATES one, and what
> finally crosses the wire. Not logging volume, not alerting thresholds, not retry tuning for a
> specific broker.
>
> Anchors here are public sources, not files in this tree — there is nothing to re-count. The
> concrete idiom is written in TypeScript against a Nest-shaped application with a TypeORM data
> layer and a message broker, because that is the shape these rules were drawn from; the rule above
> each example is what travels.

---

## 1. Every thrown value is a typed exception carrying a stable code

A failure is a value the rest of the system has to make decisions about: whether to retry it,
whether to show it, which alert it belongs to, which release regressed. A string message supports
none of that. So the code — a stable SCREAMING_SNAKE identifier — is the primary field, and the
sentence is a courtesy for whoever ends up reading the log.

Google's API Design Guide states this as the canonical error model (AIP-193): an error is a
machine-readable status plus a message, and clients branch on the status. Stripe's public API is the
same claim from the operational side — every error carries a typed `code` that client libraries
switch on, precisely so that nobody parses English. `throw new Error("order not found")` fails both:
it groups with every other unrelated `Error` in the tracker, and the only way to match it is a
substring test that breaks the day someone rewords the message.

One base class, one subclass per error situation. Not one subclass per module, and not a single
`AppException` thrown everywhere with a different string.

```ts
// errors/abstract.ts
export interface AppExceptionMetadata {
    /** The underlying failure, when this exception wraps one. Logged; never serialised outward. */
    originalError?: Error
}

export class AppException extends Error {
    constructor(
        message: string,
        /** Stable, SCREAMING_SNAKE, never reworded once released. Clients and alerts key on this. */
        readonly code: string,
        readonly metadata: AppExceptionMetadata = {},
        /** Omitted means unexpected; the boundary translator then answers 500. See §2. */
        readonly httpStatus?: number,
    ) {
        super(message)
        this.name = new.target.name
    }

    /** What may cross a process boundary: a queue payload, a log line, a trace attribute. */
    toJSON() {
        const { originalError: _withheld, ...safe } = this.metadata
        return { code: this.code, message: this.message, metadata: safe }
    }
}

// errors/order/order-not-found.ts
export interface OrderNotFoundExceptionMetadata extends AppExceptionMetadata {
    /** Id that was looked up and did not resolve. */
    orderId: string
}

export class OrderNotFoundException extends AppException {
    constructor({ orderId, originalError }: OrderNotFoundExceptionMetadata) {
        super(`Order not found: ${orderId}`, "ORDER_NOT_FOUND", { orderId, originalError }, 404)
    }
}
```

Three shapes to reject:

```ts
// Wrong: a bare Error. No code, so it cannot be grouped, matched, or retried on purpose.
throw new Error(`Order not found: ${orderId}`)

// Wrong: a framework built-in. It carries an HTTP status and nothing else, which makes the
// transport the only thing that knows what went wrong.
throw new NotFoundException("Order not found")

// Wrong: throwing the base class. Every call site that wants to react to this one situation is
// back to reading the message.
throw new AppException("Order not found", "ORDER_NOT_FOUND", { orderId })
```

The constructor takes ONE destructured metadata object, never positional arguments: a positional
signature silently reorders when a field is added, and the compiler will not notice when both are
strings. Machine-checkable in part — `@typescript-eslint/no-throw-literal` catches thrown
non-errors, and a `no-restricted-syntax` rule banning `NewExpression[callee.name="Error"]` in
`src/**` catches the bare `Error`. That a subclass exists for THIS situation rather than a nearby
one is judgement.

---

## 2. Expected and unexpected failures are different species, and the thrower decides which

An expected failure is a business condition the caller can do something about: the order is not
there, the coupon expired, the quota is spent. It is part of the contract, it maps to a 4xx, and it
is not a defect. An unexpected failure is a broken invariant or a dependency that did not answer. It
maps to a 5xx, it pages someone, and its detail is withheld from the client.

Conflating them is the expensive mistake in both directions. Reporting an expired coupon as a 500
poisons the error budget with events nobody can act on — Google's SRE Book makes error budget the
mechanism that turns reliability into a negotiable number, and a 5xx that is really user input
spends that budget on nothing. Reporting a dropped database connection as a 400 tells the client to
fix its request, so it retries with a different payload forever instead of backing off.

The default must be the safe one: **an exception that does not declare a status is unexpected**.
Declaring 4xx is a deliberate act, taken where the condition is known and named. The base class
above encodes exactly this — `httpStatus` is optional, and the boundary translator (§4) reads its
absence as 500.

This also decides retry policy, which is why it belongs at the throw site and not at the catch site.
Nygard's *Release It!* (Fail Fast) is the argument: a call that cannot succeed should say so
immediately rather than consume a timeout and a retry slot. A 4xx is not retryable — the same
request will fail identically. A 5xx may be, under the rules in §6.

Judgement, not a check. The one thing a linter can hold is that `httpStatus` is never spelled as a
raw `500`: if a call site wants 500, it wants the default and should pass nothing.

---

## 3. Translate at the layer edge — a driver's error never travels past its adapter

Cockburn's Ports and Adapters (2005) and Martin's Clean Architecture put the same constraint two
ways: source dependencies point inward, and the domain names the port while the outside supplies the
adapter. A `QueryFailedError`, an HTTP client's `AxiosError`, a broker's `NatsError` are all outward
details. The moment one is caught in a use case, the use case has a dependency on the driver, and
the portable test — *the use-case layer compiles with no import of the ORM, the web framework, or
the broker client* — fails.

So the adapter that produced the error is the last place allowed to see its type. It catches, it
decides which domain condition this actually is, and it rethrows a typed exception with the original
kept in `metadata.originalError` for the log. Hohpe and Woolf name the general move Message
Translator; it is the same move whether the foreign vocabulary arrives as a message or as a thrown
object.

Normalise `unknown` exactly once, at the catch site. TypeScript types a caught value as `unknown`,
and repeating `error instanceof Error ? error : new Error(String(error))` in every consumer
downstream is the duplication this layer exists to remove.

```ts
// infrastructure/postgres/order.repository.ts — the adapter, and the only file that knows
// what a Postgres unique-violation looks like
const UNIQUE_VIOLATION = "23505"

const toError = (caught: unknown): Error =>
    caught instanceof Error ? caught : new Error(String(caught))

export class OrderRepository {
    async insert(order: OrderRow): Promise<void> {
        try {
            await this.entityManager.insert(OrderEntity, order)
        } catch (caught) {
            const originalError = toError(caught)
            // A unique violation on this table is a business condition with a name, not an outage.
            if (caught instanceof QueryFailedError && caught.driverError?.code === UNIQUE_VIOLATION) {
                throw new OrderAlreadyExistsException({ orderId: order.id, originalError })
            }
            throw new OrderWriteFailedException({ orderId: order.id, originalError })
        }
    }
}
```

```ts
// Wrong: the use case reaching into the driver's vocabulary. This file now cannot be tested
// without the ORM, and it breaks on a driver upgrade that renames the field.
catch (error) {
    if (error instanceof QueryFailedError && error.driverError.code === "23505") { /* ... */ }
}
```

Two details worth stating outright. First, a `catch` that only rethrows the same value adds a stack
frame and nothing else — delete it. Second, a value that is already an `AppException` passes through
untranslated: wrapping a domain exception in another domain exception buries the code that the
boundary was going to report.

---

## 4. One error shape at the API boundary, built in exactly one place

Clients — including your own front end — should be able to write one error handler. That requires
one envelope, produced by one translator per transport, registered globally. AIP-193 again for the
shape; Fielding's uniform-interface constraint for why a transport gets exactly one representation
of a failure.

The handler that produced the failure must not build the envelope. Two places constructing the same
wrapper is how the two shapes drift, and the drift is invisible to the compiler: a controller that
returns `{ error: "..." }` where the filter emits `{ error: { code, message } }` type-checks
perfectly and breaks the client at runtime.

```ts
// api/filters/app-exception.filter.ts — registered once, as a global APP_FILTER provider
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
    catch(caught: unknown, host: ArgumentsHost) {
        // The GraphQL transport formats its own errors through formatError. Answering here as well
        // writes a second response onto a request that has already been answered, and the process
        // dies on ERR_HTTP_HEADERS_SENT. One transport, one translator.
        if (host.getType<GqlContextType>() === "graphql") {
            throw caught
        }

        const exception = caught instanceof AppException
            ? caught
            : new UnhandledException({ originalError: toError(caught) })

        const status = exception.httpStatus ?? 500
        const response = host.switchToHttp().getResponse<Response>()

        // The log gets everything, including the stack and the wrapped original.
        this.logger.error(exception.message, { code: exception.code, stack: exception.stack })

        // The wire gets the code, a safe message, and the id that ties the two together.
        response.status(status).json({
            success: false,
            error: {
                code: exception.code,
                message: status < 500 ? exception.message : "Internal server error",
            },
            requestId: response.locals.requestId,
        })
    }
}
```

Note what the filter is NOT doing: it does not decide whether the failure was the caller's fault.
That was decided at the throw site in §2, and the filter only reads it. A boundary that re-derives
severity from the exception's class name is a boundary that has to be edited every time a new error
is added.

---

## 5. Never leak a stack, a query, or an internal identifier across the boundary

The example above draws the line explicitly: below 500 the message is the domain sentence, at 500
and above it is a fixed string. OWASP ASVS puts this in its error-handling requirements and the Top
10 files the failure under Security Misconfiguration — a stack trace names your framework versions,
your file layout, and often a query with live values in it. That is reconnaissance handed over for
free, and it is handed over on exactly the responses an attacker is trying to provoke.

The rule generalises past stacks. What may cross: the code, a message safe for a stranger, and a
correlation id. What may not: stack frames, SQL or its parameters, upstream vendor payloads, internal
hostnames, primary keys of records the caller cannot already see, and the wrapped `originalError`.
The `toJSON` in §1 drops `originalError` for this reason — a queue payload and a trace attribute are
boundaries too, not just HTTP.

Machine-checkable, and worth checking: a test that drives one 500 through the real filter and
asserts the serialised body has no `stack` key and does not contain the process's own directory
path. It is a two-line test and it catches the regression that a well-meaning debug flag introduces.
Whether a given metadata field is safe to echo — an order id usually is, an internal user id usually
is not — is judgement, and the safe default is to withhold and let the correlation id carry the
investigator to the log.

---

## 6. An error is logged once, at the boundary, and carries a correlation id

Hohpe and Woolf's Correlation Identifier and the W3C Trace Context specification exist for the same
reason: one unit of work spans several hops, and the only way to reassemble it afterwards is an id
that every hop copies forward. Charity Majors' *Observability Engineering* adds the shape — one wide
structured event per unit of work, with the failure as attributes on it, rather than a scattering of
thin lines that have to be re-joined by timestamp.

So: log where the request or the message is finally answered, not at every rethrow. A `catch`
that logs and rethrows produces the same failure three times at three stack depths, and the third
copy is the only one with the whole story. If a middle layer knows something the boundary will not
— which row, which retry attempt — it attaches that to the exception's metadata and rethrows,
rather than logging it separately.

The correlation id is generated at the ingress edge if the caller did not supply one, propagated on
every outbound call and every published message, attached to the log event, and returned in the
error envelope. That last part is what makes a user's screenshot actionable.

---

## 7. Retryable and non-retryable are properties of the error, not guesses made by the retrier

Delivery in any queue worth using is at-least-once, so consumers must be idempotent — Hohpe and
Woolf's Idempotent Receiver, and the reason Stripe put idempotency keys on every unsafe POST. Given
that, the retry decision is simple to state and easy to get wrong: retry only what can succeed on a
second attempt, only for operations that are safe to run twice, with bounded attempts and jittered
backoff (AWS Builders' Library, "Timeouts, retries and backoff with jitter"; Nygard for Timeout and
Circuit Breaker), and send what still fails to a Dead Letter Channel instead of retrying forever.

A worker that decides by inspecting the message text is guessing. The exception already knows: a 4xx
class error is a permanent failure of THIS message and goes straight to the dead-letter queue, an
unexpected error is transient until the attempt budget runs out. Expose it as one field the consumer
reads.

```ts
// The consumer asks the error, and never parses it.
try {
    await this.handler.process(message)
} catch (caught) {
    const exception = caught instanceof AppException
        ? caught
        : new UnhandledException({ originalError: toError(caught) })

    const permanent = (exception.httpStatus ?? 500) < 500
    if (permanent || message.attempt >= MAX_ATTEMPTS) {
        // Poison messages are quarantined with their reason, not dropped and not looped.
        await this.deadLetter.publish(message, { code: exception.code, attempt: message.attempt })
        return
    }
    throw exception   // the broker redelivers with backoff
}
```

Two failure modes this prevents, both from Nygard's anti-pattern list: an unbounded retry loop on a
message that can never succeed, which becomes a self-inflicted denial of service against your own
dependency; and a cascading failure where every consumer retries a downed service in lockstep
because nothing jittered the backoff.
