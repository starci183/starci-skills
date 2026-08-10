# exceptions

## Definition

Every failure this backend produces is an `AbstractException` subclass, declared in one folder, and
thrown with a metadata object. That is three rules about one idea: **a failure is a named thing with
data attached, not a string.**

A `new Error("course not found")` carries a sentence. Nobody can group on it, match on it, decide
whether it is retryable, translate it, or attach the course id without parsing English. A Nest
built-in is barely better — it carries an HTTP status and nothing else, which is a transport
concern standing in for a domain one.

The question that settles it: **could a caller, a log pipeline or a client want to act differently
on this than on the failure beside it?** If yes it needs its own class, and it nearly always does.

What holds this law is [`sources/be/exceptions.mjs`](../../../sources/be/exceptions.mjs).

## Rules

**EXCEPTION-1 · Throw an `AbstractException` subclass, never `Error`, never a Nest built-in.**

`Error` has no stable code, so nothing downstream can group, match or retry on purpose. A Nest
`BadRequestException` has a status and no identity: two unrelated failures arrive at a client
indistinguishable, and the only way to tell them apart is the message, which is exactly the thing
that gets reworded.

**EXCEPTION-2 · The constructor takes ONE metadata object — `{}` when there is nothing to say.**

`new CourseNotFoundException({ id: courseId })`, never positional arguments and never a bare
`new CourseNotFoundException()`. Positional arguments are a shape that cannot grow: the day a
failure needs a second field, every throw site is edited, and the ones that are edited wrong still
compile.

The empty object is not ceremony. It keeps ONE spelling for every throw in the codebase, so a reader
does not have to check whether this particular exception happens to take arguments.

**EXCEPTION-3 · The class itself extends `AbstractException`, not a framework base.**

Guarding the throw site is not enough. A class that extends a Nest exception is thrown by its own
name, so the throw READS house-shaped and a rule watching throws sees nothing wrong — which is how
one such class stayed live, thrown from four call sites, while the gate stayed green.

**EXCEPTION-4 · Every exception is declared in the exceptions folder.**

One folder holds them all, so the question "what can this application throw?" has one place to look
and a reviewer can see a new failure mode arrive in a diff. An exception declared beside the code
that throws it is invisible until something throws it in production.

**EXCEPTION-5 · The metadata carries what the reader of the failure will need.**

The ids, the state that made it impossible, the limit that was exceeded. Not a rendered sentence:
the message is for a human reading a log, and the metadata is for everything else — the client
deciding what to show, the retry policy, the alert that groups by code.

**EXCEPTION-6 · A test-runner assertion is not a domain failure.**

The spec family and the test tree may `throw new Error` — there it means "this test cannot
continue", which is a different thing from a failure the product can produce. That exit is sanctioned
where it applies and nowhere else.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| `throw new Error(...)` in product code | No stable code, so nothing can group, match or retry on it without parsing English | Throw the `AbstractException` subclass that names the failure |
| `throw new BadRequestException(...)` or any Nest built-in | It carries an HTTP status and no identity, so two unrelated failures are indistinguishable to a client | Same |
| `new XException()` with no argument | Two spellings for one idea, and a reader must check which exceptions take arguments | `new XException({})` |
| Positional constructor arguments | The shape cannot grow; adding a field edits every throw site and the wrong edits still compile | One metadata object |
| An `*Exception` class extending a framework base | The throw site then reads house-shaped, and the rule watching throws sees nothing wrong | Extend `AbstractException` |
| An exception declared outside the exceptions folder | The set of failures the app can produce stops being readable in one place | Declare it with the others |
| A rendered sentence as the only payload | The client, the retry policy and the alert all have to parse prose | Put the ids and the state in the metadata |

## Examples

### The ordinary case — a failure with a name and data

```ts
if (!courseExists) {
    throw new CourseNotFoundException({
        id: courseId,
    })
}
```

```ts
// Wrong: a sentence. The client cannot tell this from six other 400s, the alert cannot group it,
// and the course id can only be recovered by parsing the message.
if (!courseExists) {
    throw new BadRequestException(`course ${courseId} not found`)
}
```

They differ in one thing: whether anything downstream can act on it.

### The declaration trap — the one the throw-site rule cannot see

```ts
/** The learner already owns this course. */
export class CourseAlreadyEnrolledException extends AbstractException { /* ... */ }
```

```ts
// Wrong: thrown as `new CourseAlreadyEnrolledException({...})`, which LOOKS correct at every call
// site - so a rule watching throws passes it, and the class is a Nest exception in disguise.
export class CourseAlreadyEnrolledException extends ConflictException { /* ... */ }
```

They differ in one thing: whether the throw site tells the truth about what is thrown.

### The empty-object trap

```ts
throw new UserNotFoundException({})
```

```ts
// Wrong: a second spelling. Now a reader has to know which exceptions take an argument.
throw new UserNotFoundException()
```

They differ in one thing: whether every throw in the codebase reads the same way.

### The sanctioned exit

```ts
// a spec: this is the runner giving up, not a failure the product can produce
if (!seeded) {
    throw new Error("fixture did not seed - the test cannot continue")
}
```

```ts
// Wrong in product code: the same line, where it now describes something a user can hit.
if (!seeded) {
    throw new Error("enrollment missing")
}
```

They differ in one thing: whether a person could ever encounter it.
