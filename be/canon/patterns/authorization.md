# authorization

## Definition

Authentication asks **who is this**. Authorization asks **whether they may do this, to this**. They
are different questions, they are answered in different places, and the reason they are separate is
that one of them can be answered without reading any data and the other cannot.

A guard sees the request. It can prove a token, resolve a user, and refuse an anonymous caller —
and that is the whole of what it can do, because the row the caller is reaching for has not been
loaded yet. Whether this user owns this review, has an enrollment on this course, or belongs to the
tenant that owns this record are questions about a row, and only the handler holds both the row and
the identity at the same moment.

The question that settles where a check belongs: **does the answer depend on the request's data?**
"Is anyone signed in" does not, and belongs to the door. "May this person edit *that*" does, and
belongs to the handler.

What holds the machine-checkable half is
[`sources/be/authorization.mjs`](../../../sources/be/authorization.mjs). That half is AUTHZ-2 and
only AUTHZ-2 — the rest turn on which row is being reached and what it means to own it, and no parser
knows that. The module records what was measured and deliberately left alone, so the next reader does
not "finish the job" by writing a rule that fires on every correct handler in the tree.

## Rules

**AUTHZ-1 · A handler owns its own preconditions, and an identity is one of them.**

A handler checking that it has a user is not duplicating the guard. The guard belongs to ONE door,
and the handler belongs to every door — the CLI, the job, the harness and the next transport are all
callers with no resolver in front of them. That is the same argument CQRS makes for putting the work
in the handler, applied to the work's preconditions.

So the check reads as defensive and is not: remove it, and the operation is safe exactly as long as
nobody invokes it from anywhere new.

**AUTHZ-2 · A door that READS an identity carries the guard that establishes it.**

A resolver method taking the authenticated-user parameter without a guard on that method or its
class is reading a user off a request nothing authenticated. It compiles, it is quiet, and what it
hands the handler is whatever the pipeline happened to leave there.

This is the half worth a rule, because it is the failure that looks like nothing: the door still
mentions a user, the handler still receives one, and the only missing piece is the line that proved
it belonged to the caller.

**AUTHZ-3 · Ownership is decided against the loaded row, never against the request.**

`request.reviewId` says which row the caller NAMES, not which row they own. Load it, compare the
owner to the authenticated identity, and refuse on the comparison. A check written against ids the
caller supplied is a check the caller passes by choosing different ids.

**AUTHZ-4 · A refusal that would reveal a private row's existence is a not-found.**

"You may not edit this" and "this does not exist" are different facts, and a client shows different
things for them — so ordinarily each earns its own exception. The exception to that is a row the
caller could not otherwise know about: there, answering "forbidden" confirms the row exists, and the
existence was the secret. Answer not-found, and let the log carry the real reason.

Say which of the two a refusal is when you write it, because the wrong one is invisible in both
directions: a not-found where forbidden was correct sends a legitimate caller hunting for a bug, and
a forbidden where not-found was correct is an enumeration oracle.

**AUTHZ-5 · An entitlement is a STATE, and having the row is not having the state.**

Enrollment, membership, subscription, trial. A row saying somebody has a relationship to a course
does not say which relationship: a trial row and a paid row are both enrollments and grant different
things. A check that treats the row's EXISTENCE as the entitlement grants the trial everything the
purchase grants.

Read the field that carries the distinction, and name it in the query rather than in a comment. This
is the check most likely to be written once, correctly, and then copied to a place where the
distinction matters and the field is dropped.

**AUTHZ-6 · An operator is a different subject from a viewer.**

A platform operator, a service token and a product user are three identities, and hanging them off
one guard means one academy's administrator can operate the platform. The subject decides the guard,
and a door serving a non-viewer subject says so — see `transport.md`, which places such a door and
gives it the one reason it is allowed not to be GraphQL.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| A resolver reading the authenticated user with no guard on the method or class | It reads an identity off a request nothing authenticated, and hands the handler whatever was left there | Put the guard on the door that reads the identity |
| Deciding ownership from ids in the request | The caller chose those ids, so the check is one they pass by choosing others | Load the row and compare its owner to the authenticated identity |
| Answering "forbidden" for a row the caller could not know exists | The refusal confirms the row, and its existence was the secret | Answer not-found; put the real reason in the log |
| Answering "not found" where the caller legitimately knows the row | It sends a legitimate caller hunting for a bug that is not there | Name the refusal |
| Treating an entitlement row's existence as the entitlement | A trial row and a paid row are both rows, and they grant different things | Read the field that distinguishes them |
| One guard for operators, service tokens and product users | One tenant's administrator ends up able to operate the platform | One guard per subject |
| Removing a handler's identity precondition because the resolver has a guard | The guard covers one door; the handler has as many doors as the bus has callers | Leave it; it is the handler's precondition, not the door's |
| An authorization rule written in the service beside the handler | It has no message, so no second door reaches it and the next door grows its own copy | Put it in the handler |

## Examples

### The door that reads what nothing proved

```ts
@UseGuards(KeycloakAuthGraphQLGuard)
@Mutation(() => SubmitCourseReviewResponse, { name: "submitCourseReview" })
async execute(
    @KeycloakGraphQLUser() user: UserEntity,
    @Args("request") request: SubmitCourseReviewRequest,
): Promise<CourseReviewEntity> { /* ... */ }
```

```ts
// Wrong: the parameter still says `user`, the handler still receives one, and nothing
// established that it belongs to the caller.
@Mutation(() => SubmitCourseReviewResponse, { name: "submitCourseReview" })
async execute(
    @KeycloakGraphQLUser() user: UserEntity,
    @Args("request") request: SubmitCourseReviewRequest,
): Promise<CourseReviewEntity> { /* ... */ }
```

They differ in one thing: whether anything proved the identity the door reads.

### The ownership trap

```ts
// the row decides, and the row was loaded
const review = await this.entityManager.findOne(CourseReviewEntity, {
    where: { id: reviewId },
    relations: { user: true },
})
if (!review) throw new CourseReviewNotFoundException({ id: reviewId })
if (review.user.id !== user.id) throw new CourseReviewNotOwnedException({ id: reviewId })
```

```ts
// Wrong: the caller supplied both ids, so they satisfy this by supplying different ones.
if (request.userId !== user.id) {
    throw new CourseReviewNotOwnedException({ id: request.reviewId })
}
await this.entityManager.delete(CourseReviewEntity, { id: request.reviewId })
```

They differ in one thing: whether the check reads anything the caller did not choose.

### The entitlement trap

```ts
// the field that distinguishes a purchase from a trial is named in the query
const isEntitled = await this.entityManager.exists(EnrollmentEntity, {
    where: { course: { id: courseId }, user: { id: user.id }, isEnrolled: true },
})
```

```ts
// Wrong: a trial row satisfies this, so everything gated behind it is free.
const isEntitled = await this.entityManager.exists(EnrollmentEntity, {
    where: { course: { id: courseId }, user: { id: user.id } },
})
```

They differ in one thing: whether a trial passes the gate a purchase was meant to open.

### The refusal that leaks

```ts
// a draft nobody may read: the refusal does not confirm it exists
if (!draft || draft.author.id !== user.id) {
    throw new DraftNotFoundException({ id: draftId })
}
```

```ts
// Wrong: iterate ids, and "forbidden" maps every draft in the system.
if (!draft) throw new DraftNotFoundException({ id: draftId })
if (draft.author.id !== user.id) throw new DraftNotOwnedException({ id: draftId })
```

They differ in one thing: whether the refusal is an enumeration oracle.
