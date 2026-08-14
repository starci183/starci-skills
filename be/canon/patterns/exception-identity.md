# exception identity

## Definition

A failure's identity is the word that tells it apart from every other failure this application can
produce. [`exceptions.md`](exceptions.md) settles that a failure IS a named thing with data attached.
This file settles the name: **one word, written in three alphabets, and all three say the same
thing.**

The class is `CourseReviewNotOwnedException`. The code is `COURSE_REVIEW_NOT_OWNED_EXCEPTION`. The
payload type is `CourseReviewNotOwnedExceptionMetadata`. Nothing here is decoration — each alphabet
is read by a different consumer, and none of them can read the others:

- The **class name** is what the gates see. Every rule guarding exceptions matches a name ending in
  `Exception`, so a failure that spells its name differently is not enforced by any of them.
- The **code** is what the client sees. Apollo's `formatError` stamps it onto every GraphQL error and
  the REST filter puts it in the body, and the front end matches on it rather than on the status,
  because one GraphQL response can carry several errors of different severities.
- The **metadata type** is what the throw site sees. It is the contract the caller has to satisfy,
  and the place the failure's second field will land.

The question that settles whether a declaration has an identity: **if this failure and the one
declared above it both arrived at a client, could anything tell them apart without reading English?**
If the answer is the message, it has no identity — it has a sentence.

What holds this law is
[`sources/be/exception-identity.mjs`](../../../sources/be/exception-identity.mjs). Two of its rulings
are held there; the ones about renaming and about the HTTP status are stated here and enforced by
review, because neither is visible in one file.

## Rules

**IDENTITY-1 · A class extending `AbstractException` is named `*Exception`.**

Not `*Error`, not a bare noun. This is not a style preference — the suffix is the only thing every
other exception rule can see. `require-exception-object-arg`, `exception-extends-abstract` and
`exception-in-errors-folder` all key on it, and `throw-abstract-exception` recognises only `Error`
and the framework names — so a failure named `SomethingError` sits in the errors folder, extends the
house base, is thrown from real call sites, and is checked by NONE of them. The gate reports nothing
and that reads as agreement.

The same trap `EXCEPTION-3` describes, from the other end. There, a class extending a framework base
looks house-shaped at the throw site; here, a class named for no convention looks house-shaped in the
folder. Both are failures that pass every check by being invisible to it.

**IDENTITY-2 · The code is the class name, spelled in SCREAMING_SNAKE.**

`CourseNotFoundException` reports `COURSE_NOT_FOUND_EXCEPTION`, and it is written as a literal in the
`super()` call, never assembled. Two things follow from deriving it rather than choosing it, and both
are the point.

The first is that nobody has to look it up. A reader with the class name knows the code; a reader
with the code can find the class by searching for it. A code chosen by hand is a second name for the
same failure, and the second name is the one that ends up in the client, in the alert rule and in the
support ticket, while the first is the only one in the source.

The second is uniqueness for free. A code copied from the exception above it is the ordinary way two
unrelated failures come to share one identity — and it has happened here: an OTP challenge and a
course challenge reported the same code, so a client matching on it could not tell a missing course
lesson from a missing login step. That is precisely the defect `EXCEPTION-1` refuses framework
exceptions for, arriving inside the house vocabulary instead.

Underscore placement inside an acronym is not part of the ruling. `GRAPHQL_DATA_NOT_FOUND_EXCEPTION`
and `GRAPH_QL_DATA_NOT_FOUND_EXCEPTION` name the same class, there is no correct split, and a rule
insisting on one would fire on code that is right.

**IDENTITY-3 · Renaming the class renames the wire, so rename on purpose.**

Because the code is derived, a rename is a client-visible change rather than a refactor. That is the
honest consequence and the reason to keep it: the alternative is a class whose code preserves a name
it no longer has, which has also happened here — a path lookup still reports the directory lookup it
used to be, and no reader of either name can guess the other.

So a rename is a decision with a migration, not a tidy-up performed on the way past. If the old code
must stay on the wire for a released client, the class keeps its old name until the client is
retired; what is refused is the silent half-rename that leaves the two disagreeing forever.

**IDENTITY-4 · The metadata type is named for its exception, even when it adds nothing.**

`CourseNotFoundExceptionMetadata`, extending `AbstractExceptionMetadata`, is what the constructor's
destructured parameter is typed as — and an exception with nothing of its own to say still declares
`export type XExceptionMetadata = AbstractExceptionMetadata` rather than typing the parameter as the
base directly.

The empty alias is not ceremony, for the same reason `EXCEPTION-2`'s empty object is not: it is the
place the first field lands. A parameter typed as the base says "this failure carries nothing", which
stops being true the moment somebody has an id to attach — and at that moment the base type is shared
by every other exception, so the field cannot be added there and the declaration has to be reshaped
before it can be extended. Naming the type after the exception also means a reader holding the
failure's name can find its payload without opening the file.

**IDENTITY-5 · The HTTP status is not the identity.**

`AbstractException` takes an optional `httpStatus`, and most failures omit it and default to 500. It
is a transport concession for the cases where the status IS the contract — a guard answering 401, an
upload refused as 413 — and it is never how two failures are told apart, because a status is a
category shared by hundreds of them.

This is why an exception that sets a status still needs everything above, and why a reviewer asking
"what does the client match on?" is asking about the code. A declaration reaching for a status in
order to be distinguishable has answered the wrong question.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A failure class named `*Error` or a bare noun | Every exception rule keys on the `Exception` suffix, so the class is enforced by nothing while the gate stays green | Name it `*Exception` |
| A code chosen by hand rather than derived from the class | It is a second name for one failure, and the second name is the one that reaches the client while the first is the only one in the source | Spell the class name in SCREAMING_SNAKE |
| A code copied from the exception declared above it | Two unrelated failures then arrive at the client identical, which is the defect framework exceptions are refused for | Derive it, so the copy is visible in the same file |
| A code assembled at runtime | Nothing can find it by searching, which is what every consumer of a code does | Pass a literal |
| A class renamed while the code stays | The two names disagree forever and neither can be guessed from the other | Rename both, or keep the old class name until the released client is retired |
| A constructor parameter typed `AbstractExceptionMetadata` | It says the failure carries nothing, and the shared base is not where its first field can be added | `export type XExceptionMetadata = AbstractExceptionMetadata` |
| An `httpStatus` set so the failure can be told apart | A status is a category shared by hundreds of failures, so it distinguishes nothing | Set the status only where the status is the contract; the code carries the identity |

## Examples

### The ordinary declaration — three alphabets, one word

```ts
/** Metadata when a caller reaches for a review that belongs to somebody else. */
export interface CourseReviewNotOwnedExceptionMetadata extends AbstractExceptionMetadata {
    id?: string
    userId?: string
}

/** Thrown when the caller is not the author of the review they are editing. */
export class CourseReviewNotOwnedException extends AbstractException {
    constructor({ id, userId, originalError }: CourseReviewNotOwnedExceptionMetadata) {
        super("Course review does not belong to this user", "COURSE_REVIEW_NOT_OWNED_EXCEPTION", {
            id, userId, originalError,
        })
    }
}
```

```ts
// Wrong: three names for one failure. A client matching `REVIEW_FORBIDDEN` cannot find the class,
// a reader holding the class cannot guess the code, and the payload type belongs to nobody.
export interface ReviewMetadata extends AbstractExceptionMetadata { id?: string }

export class CourseReviewNotOwnedException extends AbstractException {
    constructor({ id }: ReviewMetadata) {
        super("Forbidden", "REVIEW_FORBIDDEN", { id })
    }
}
```

They differ in one thing: whether the three consumers are reading the same word.

### The suffix trap — the declaration no rule can see

```ts
export class CourseAlreadyEnrolledException extends AbstractException { /* ... */ }
```

```ts
// Wrong: correctly based, correctly placed, correctly thrown - and matched by no exception rule in
// the plugin, because every one of them looks for a name ending in `Exception`.
export class CourseAlreadyEnrolledError extends AbstractException { /* ... */ }
```

They differ in one thing: whether the gate can see the class at all.

### The copied code

```ts
export class ChallengeOtpNotFoundException extends AbstractException {
    constructor({ id }: ChallengeOtpNotFoundExceptionMetadata) {
        super("Challenge not found", "CHALLENGE_OTP_NOT_FOUND_EXCEPTION", { id })
    }
}
```

```ts
// Wrong: the line was left as it was found in the file this was written beside, so a missing OTP
// challenge and a missing course challenge now reach the client as the same failure.
export class ChallengeOtpNotFoundException extends AbstractException {
    constructor({ id }: ChallengeOtpNotFoundExceptionMetadata) {
        super("Challenge not found", "CHALLENGE_NOT_FOUND_EXCEPTION", { id })
    }
}
```

They differ in one thing: whether the code was derived or inherited from a neighbour.

### The empty metadata type

```ts
/** Metadata for a request missing the `x-admin-api-key` header. */
export type AdminApiKeyRequiredExceptionMetadata = AbstractExceptionMetadata

export class AdminApiKeyRequiredException extends AbstractException {
    constructor({ originalError }: AdminApiKeyRequiredExceptionMetadata) {
        super("x-admin-api-key header is required.", "ADMIN_API_KEY_REQUIRED_EXCEPTION", {
            originalError,
        }, HttpStatus.UNAUTHORIZED)
    }
}
```

```ts
// Wrong: the parameter is typed as the base every exception shares, so the day this failure needs
// to say WHICH key was rejected there is nowhere to put it that does not belong to all of them.
export class AdminApiKeyRequiredException extends AbstractException {
    constructor({ originalError }: AbstractExceptionMetadata = {}) {
        super("x-admin-api-key header is required.", "ADMIN_API_KEY_REQUIRED_EXCEPTION", {
            originalError,
        }, HttpStatus.UNAUTHORIZED)
    }
}
```

They differ in one thing: whether the failure owns the type describing it.

### The status is not the name

```ts
// Two refusals, distinguishable by code; the status says only how the transport should answer.
super("Playground is not part of this plan", "PLAYGROUND_NOT_ENTITLED_EXCEPTION", { userId },
    HttpStatus.FORBIDDEN)
super("Premium content requires an active plan", "PREMIUM_CONTENT_AI_ACCESS_DENIED_EXCEPTION",
    { userId }, HttpStatus.FORBIDDEN)
```

```ts
// Wrong: the status was chosen to make this failure "different" from the one beside it. It is not -
// hundreds of failures answer 403, and the client still has nothing to branch on.
super("Not allowed", "FORBIDDEN_EXCEPTION", { userId }, HttpStatus.FORBIDDEN)
```

They differ in one thing: whether the failure is told apart by its code or by its transport.
