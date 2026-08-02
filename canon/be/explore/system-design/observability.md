# Observability

Monitoring answers questions you thought of in advance; observability is whether you can answer the
one you did not. The difference matters most on the incident where the failure is a combination — one
tenant, on one route, through one replica, since one deploy — because a dashboard of averages cannot
express that question at all, and no amount of adding dashboards afterwards recovers data that was
never emitted.

The rule that follows from this, and that the rest of this file is built around: **emit one wide,
structured event per unit of work, rich enough that you can group by any of its fields later**
(Charity Majors et al., *Observability Engineering*, 2022). A hundred thin log lines per request give
you a hundred things to grep and nothing to aggregate.

## The test

**Given a request id from a user's complaint, you can reconstruct what happened across every process
it touched — and nothing you find on that path is a secret or a name.**

## The rules

- **Logs go to stdout as an unbuffered event stream.** The application does not open files, rotate
  them, or know where they end up; the platform captures the stream and routes it to the store (a
  Winston or pino transport into Loki, Elasticsearch or the platform's own sink). Twelve-Factor XI is
  the source and the reason is operational: an app that manages its own log files behaves differently
  in a container, on a laptop, and during a crash, which is precisely when the difference costs you.
- **Structured, one event per unit of work.** JSON, not a sentence with values interpolated into it.
  A unit of work is one inbound request, one message consumed, one job attempt — and the event is
  emitted once, at the boundary, carrying everything the operation learned: route or operation name,
  outcome, duration, subject id, tenant, error code, upstream attempt counts, cache hit or miss.
  Attaching a fact to the in-flight event costs nothing; a separate line for the same fact costs a
  join you cannot do.
- **A correlation id, generated at the edge and propagated everywhere.** Hohpe and Woolf named it the
  Correlation Identifier; W3C Trace Context standardises the wire format as the `traceparent` header,
  which OpenTelemetry propagates for you over HTTP. The part nobody gets for free is the hop into
  asynchronous work: the id has to be copied into the message header when publishing to NATS or
  Kafka, and into the job payload when enqueuing to BullMQ, or the trace ends at the queue and the
  half of the system that does the actual work is unreachable from the user's complaint. Carry it in
  `AsyncLocalStorage` rather than threading it through every signature, and note the placement trap:
  the store must be established in middleware, which wraps the continuation, not in an interceptor,
  whose returned observable is subscribed after `run` has already returned.
- **Three signals, three jobs, and one rule about cardinality.** Logs carry the event and its
  high-cardinality attributes. Traces carry causality and timing across hops. Metrics carry cheap
  aggregates, and are the one signal with a hard constraint: **a metric label may never hold an
  unbounded dimension.** A user id, an object id or a raw URL path as a label multiplies time series
  until the metrics backend falls over — this is why OpenTelemetry's HTTP semantic conventions
  specify `http.route`, the template, rather than the path. Unbounded dimensions belong on the log
  event and the span, where the storage model expects them.
- **RED per service, USE per resource, golden signals as the umbrella.** For anything request-driven,
  Tom Wilkie's RED — rate, errors, duration — per route and per operation. For every resource behind
  it (connection pools, worker concurrency, event loop, disk, queue depth), Brendan Gregg's USE —
  utilization, saturation, errors. The Google SRE Book's four golden signals (latency, traffic,
  errors, saturation) are the same idea stated once. Record duration as a histogram, alert on
  percentiles, and never on the mean: a p50 of 40ms and a p99 of 9s is a normal-looking average and a
  broken product. Two refinements worth writing down: measure error latency separately from success
  latency, because a fast-failing dependency flatters the graph, and count *saturation* — queue depth
  and pool wait time — because it turns up before latency does.
- **Alert on symptoms, budget the rest.** An alert should correspond to something a user is
  experiencing, expressed against an SLO and its error budget (Google SRE Book, chs. 4 and 6), not to
  a cause like "CPU is high". Cause-based alerts fire during healthy load and stay silent during the
  outage that took a different path.
- **Log levels are a statement about who acts, not about how interesting a line is.** Using the
  syslog vocabulary (RFC 5424) with operational meanings that survive: `error` means a human must
  look, and every one of them is triaged or the level stops meaning anything; `warn` means degraded
  but handled — a retry that eventually succeeded, a fallback that was used, a breaker that opened;
  `info` is the one wide event per unit of work plus lifecycle transitions; `debug` is off in
  production and switchable by configuration, not by a deploy. The observable failure mode is a level
  configured in two places: whichever registration wins, the effective level is now a guess. Set it
  once from configuration and log the effective level at boot so the answer is in the stream.
- **Never log secrets, credentials or personal data, and enforce that centrally.** Redact at the
  serializer with a field list — pino's `redact`, a Winston format, an OpenTelemetry span processor —
  rather than at each call site, because the call site is exactly where it will be forgotten by the
  next person. The concrete list: authorization headers, access and refresh tokens, API keys, cookies,
  passwords and password hashes, payment instrument data, one-time codes, and any full request body
  on an authentication or payment route. Log an opaque subject id rather than an email or a name; ids
  are enough to answer support questions and are not personal data in the same way. Truncating a
  token does not help if the prefix still identifies it. And nothing sensitive goes in a URL, because
  query strings are logged by every proxy on the path — the same rule as in `auth-and-authz.md`,
  reached from the other side.
- **Errors are structured before they are prose.** A typed error carrying a stable machine-readable
  code and a metadata object is groupable; a formatted English string is not, and it changes the
  moment someone improves the wording. Send the exception to the error tracker with the correlation
  id attached, and log the code — the sentence is for the human reading one instance, the code is for
  the query that counts them.

## One worked example

The correlation mechanism end to end: the store is established in middleware, the identity guard
fills the subject into it once the token is verified, and one interceptor emits the single wide event.

```ts
// The store must be opened by middleware. Middleware wraps `next()`, so everything
// downstream runs inside `run`. An interceptor cannot do this: the observable it
// returns is subscribed after `run` has already returned, and the store is empty.
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  constructor(private readonly als: AsyncLocalStorage<RequestContext>) {}

  public use(request: Request, _response: Response, next: NextFunction): void {
    // Continue the caller's trace when there is one (W3C Trace Context), start one
    // otherwise, so an id exists on every path including internal cron traffic.
    const traceId = parseTraceparent(request.headers.traceparent) ?? randomUUID();
    // subjectId is deliberately absent here: middleware runs before guards, so the
    // identity guard fills it into this same store once the token is verified.
    this.als.run({ traceId, subjectId: undefined }, () => next());
  }
}

@Injectable()
export class OperationEventInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly als: AsyncLocalStorage<RequestContext>,
  ) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const info = GqlExecutionContext.create(context).getInfo<GraphQLResolveInfo>();
    const startedAt = process.hrtime.bigint();

    const emit = (outcome: "ok" | "error", error?: unknown): void => {
      const store = this.als.getStore();
      // One event per unit of work. Every attribute is groupable later; none of
      // them is a secret, and the subject is an opaque id rather than an email.
      this.logger.info("operation", {
        traceId: store?.traceId,
        subjectId: store?.subjectId,
        operation: `${info.parentType.name}.${info.fieldName}`,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
        outcome,
        // The stable code is what an alert counts; the message is for the human
        // reading one instance of it.
        errorCode: error instanceof AbstractException ? error.code : undefined,
      });
    };

    return next().handle().pipe(
      tap({ next: () => emit("ok"), error: (error) => emit("error", error) }),
    );
  }
}

// The hop that breaks traces, and the two lines that fix it: the id has to be put
// on the message, and read back off it by the consumer, or the trace ends here.
await this.natsClient.publish(subject, { ...payload, traceId: store.traceId });

// Wrong: three thin lines per request, none of which can be grouped, and the last
// of which is one refactor away from carrying a token.
// this.logger.info(`handling ${info.fieldName}`);
// this.logger.info(`user ${user.email} authorized`);
// this.logger.debug(`headers: ${JSON.stringify(request.headers)}`);
```

## What a machine can check, and what it cannot

Checkable: that no secret reaches the stream, by serialising a fixture containing a fake token,
cookie and password through the real logger format in a unit test and asserting none of the values
appear — this is worth more than any review, because it keeps working as the redaction list grows.
That `console.log` never ships, via the ESLint `no-console` rule. That every published message and
every enqueued job carries a correlation id, by making it a required field of the publish wrapper's
parameter type, so omitting it does not compile. That metric labels stay bounded, by asserting the
allowed label set where metrics are registered.

Judgement: whether the event is *wide enough*. Nothing fails when a field is missing; you simply find
out during the next incident that you cannot group by the dimension the incident turned out to be
about. The habit that substitutes for a check is to add, at the end of each investigation, the one
field you wished the event had carried.

Related: `resilience.md` (a breaker that opens, a retry that succeeded and a fallback that was used
are all `warn` events, and are how you find out a dependency is sick before it is down) and
`auth-and-authz.md` (the same secrets that must not be exposed by the API must not be logged either,
and the log is the easier of the two to forget).
