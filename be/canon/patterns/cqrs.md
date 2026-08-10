# cqrs

## Definition

Every operation this backend exposes is a CQRS message with a handler. A mutation dispatches a
command; a query dispatches a query; a side effect that must outlive the request is an event. The
resolver does not do the work, and the service does not do the work — they carry the request to a
handler, and the handler is where the work lives.

The shape is not decoration. Putting the work behind a message means the same operation can be
reached from a resolver, a controller, a CLI command, a job or a test **without any of them knowing
about each other**, and it means the one place to read what "enroll a learner" actually does is a
file named after enrolling a learner.

The question that settles whether something belongs here: **can this be invoked from more than one
door?** If yes — and almost everything can, because the CLI and the test suite are doors — it is a
message with a handler, not a method on a service.

What holds this law is [`sources/be/cqrs.mjs`](../../../sources/be/cqrs.mjs).

## Rules

**CQRS-1 · One operation, one folder, and the folder holds the whole operation.**

```
add-to-cart/
    add-to-cart.command.ts             the message
    add-to-cart.handler.ts             the work
    add-to-cart.service.ts             the dispatch
    add-to-cart.resolver.ts            the door
    add-to-cart.module.ts              the wiring
    add-to-cart.module-definition.ts   the wiring's own definition
    add-to-cart.handler.spec.ts        the twin
```

Every file is named for the operation, so a reader who knows the operation knows every filename,
and a grep for it finds the whole thing rather than one slice of it. A file in this folder that is
not named for the operation is something that was invented here and belongs somewhere findable.

**CQRS-2 · The message carries the request context and nothing else.**

A command or query holds one `params` field, and that field carries the request, the authenticated
user and the locale. It has no methods, no defaults and no logic: a message that computes something
has moved a decision to a place nobody looks, and two dispatchers of the same message would then
disagree about what it means.

**CQRS-3 · A handler overrides `process`, never `execute`.**

`ICQRSHandler` is a template method: `execute` is the public entry and it calls the protected
`process` a handler implements. That seam exists so a cross-cutting concern — a timing, a log, a
transaction, a retry — can be added once in the base rather than in a hundred handlers.

A handler that overrides `execute` takes itself out of the template, and does so invisibly: it
compiles, it runs, and it is the one handler the next cross-cutting change silently misses.

**CQRS-4 · The service dispatches, and that is all it does.**

The service beside a handler exists so the door does not import the bus, and it is one line long on
purpose. Business logic that appears there is logic in a place with no message, which means it
cannot be invoked by any other door and cannot be tested without standing up the door it belongs to.

The thinness looks pointless right up until the second door arrives — and the CLI and the harness
are already second doors.

**CQRS-5 · The handler owns the failure, and the failure is a domain exception.**

A handler that cannot do its work throws the domain exception that says why. It does not return
`null`, and it does not return a success shape carrying an error string: both push the decision on
to a caller who has less information than the handler that just made it.

**CQRS-6 · An event is for what must happen ANYWAY, not for what the caller is waiting on.**

Dispatch an event when the work must happen whether or not the caller is still there — a mail, a
projection, a sync. Anything the caller's own answer depends on stays in the command, because an
event the caller must wait for is a command with worse ergonomics and no return value.

**CQRS-7 · The handler has a twin spec beside it.**

`<operation>.handler.spec.ts`, in the same folder. A handler is where the decisions are, so it is
where the unit tests are — and putting the spec beside the file means the spec is found by whoever
edits the handler rather than by whoever goes looking in a test tree.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Work in a resolver or controller | It is then reachable from exactly one door, and the CLI, the job and the test cannot get at it | Dispatch a message; put the work in the handler |
| Work in the service beside the handler | Same, one layer down - it has no message, so nothing else can invoke it | Move it into the handler |
| Overriding `execute` on a handler | It leaves the template silently, and the next cross-cutting change misses exactly this file | Override `process` |
| A command or query with methods, defaults or logic | A message that computes moves a decision somewhere nobody reads | Keep it to `params`; compute in the handler |
| A handler returning `null` to mean failure | The caller has to guess what went wrong with less information than the handler had | Throw the domain exception that names it |
| A handler returning `{ ok: false, error }` | Same, wearing a shape - and every caller decodes it differently | Throw |
| An event the caller waits on | It is a command with no return value and worse ergonomics | Make it a command |
| A file in the operation folder not named for the operation | Something reusable was invented where nobody will find it | Move it to `modules/` under a name that says what it is |
| A handler with no spec beside it | The decisions live here, so an untested handler is an untested decision | Write the twin |

## Examples

### The ordinary case — the whole operation, in the shape

```ts
/** The message: request context, nothing else. */
export class AddToCartCommand {
    constructor(readonly params: ExecuteParams<AddToCartRequest>) {}
}
```

```ts
/** The dispatch: one line, so the door never imports the bus. */
@Injectable()
export class AddToCartService {
    constructor(private readonly commandBus: CommandBus) {}

    async execute(params: ExecuteParams<AddToCartRequest>): Promise<CartItemEntity> {
        return this.commandBus.execute(new AddToCartCommand(params))
    }
}
```

```ts
/** The work: `process`, never `execute`. */
@CommandHandler(AddToCartCommand)
@Injectable()
export class AddToCartHandler
    extends ICQRSHandler<AddToCartCommand, CartItemEntity>
    implements ICommandHandler<AddToCartCommand, CartItemEntity> {
    protected override async process(command: AddToCartCommand): Promise<CartItemEntity> { /* ... */ }
}
```

### The template trap

```ts
// handler: inside the template, so a timing or a transaction added to the base reaches it.
protected override async process(command: AddToCartCommand): Promise<CartItemEntity> {
    return this.entityManager.save(cartItem)
}
```

```ts
// Wrong: it compiles, it runs, and it is the one handler that never gets the cross-cutting
// change - because it stopped going through the base at all.
override async execute(command: AddToCartCommand): Promise<CartItemEntity> {
    return this.entityManager.save(cartItem)
}
```

They differ in one thing: whether the base class still runs.

### The fat-service trap

```ts
// service: it carries the request to the bus, and knows nothing about carts.
async execute(params: ExecuteParams<AddToCartRequest>): Promise<CartItemEntity> {
    return this.commandBus.execute(new AddToCartCommand(params))
}
```

```ts
// Wrong: the rule about already-owned courses now lives in a place with no message, so the CLI
// that also enrolls people cannot reach it and will grow its own copy.
async execute(params: ExecuteParams<AddToCartRequest>): Promise<CartItemEntity> {
    if (await this.enrollments.owns(params.user.id, params.request.courseId)) {
        throw new CourseAlreadyEnrolledError({ courseId: params.request.courseId })
    }
    return this.commandBus.execute(new AddToCartCommand(params))
}
```

They differ in one thing: whether a second door can reach the rule.

### The failure trap

```ts
// handler: it names the failure, and the name carries the data somebody will need.
if (!courseExists) {
    throw new CourseNotFoundException({ id: courseId })
}
```

```ts
// Wrong: the caller now guesses. A missing course, a deleted course and an unauthorised read all
// arrive as the same `null`.
if (!courseExists) {
    return null
}
```

They differ in one thing: whether the reason survives the return.

### The event trap

```ts
// event: the mail must go whether or not the reader is still on the page.
this.eventBus.publish(new EnrollmentOpenedEvent({ userId, courseId }))
return enrollment
```

```ts
// Wrong: the caller needs the enrollment, so this is a command written as an event - it returns
// nothing, and the resolver now polls for a row it just asked to have created.
this.eventBus.publish(new OpenEnrollmentEvent({ userId, courseId }))
return null
```

They differ in one thing: whether the caller's own answer depends on it.
