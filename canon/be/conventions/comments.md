# Comments — WHEN to write one (WHY, never WHAT)

Source: a scan of the real `src/` on 2026-07-16. This codebase comments MORE densely than average —
but almost entirely WHY: business constraints, workarounds, and non-obvious decisions. It carries
close to zero WHAT comments and zero commented-out code. Keep that ratio. `tsconfig` sets
`removeComments: true`, so comments never ship into `dist`; do not ration words when you have a real
reason. Comments and JSDoc are written in **English**.

## 1. WHY, never WHAT — a comment answers "why does the code have to be like this"

An inline `//` sits DIRECTLY above the line it concerns and explains a constraint the code cannot
state itself:

```ts
// real example, abstract-exception-http.filter.ts — a workaround plus what breaks if you undo it
// GraphQL operations ride on the same HTTP req/res under the hood, but
// must be left to Apollo's own formatError — do not touch the response here
if (host.getType<string>() === "graphql") {
    throw exception
}

// real example, review-flashcard request.ts — why the validation belongs HERE and nowhere else
// reject out-of-range grades before they reach the SM-2 math
@IsInt()
@Min(0)
@Max(3)
    grade: number
```

```ts
// Wrong: parroting the code, carrying no information
// get the response from context
const response = ctx.getResponse<Response>()
// loop through cards
for (const card of cards) ...
```

A business decision with several branches earns a block comment carrying the full context. The real
example is `listDue` in `flashcard-review.service.ts`: six lines explaining why the COURSE page keys
by enrolment while the DASHBOARD keys by `user_id`. Without that comment, whoever edits it next WILL
"make it consistent" and break it.

## 2. Do not comment a name that is already clear — delete redundant comments and commented-out code

- A well-named method or variable documents itself: `sleepEnqueueUxDelay()` and `isPlainObject()`
  need no `// sleep for ux delay` above them.
- Commented-out code is DELETED; git keeps the history. `src/` is clean today — do not be the first
  to leave a body behind.
- A "section divider" comment (`// ==== helpers ====`) is not the house style. When a file grows too
  long, split it per [[modules-and-di]] rather than drawing lines through it.

## 3. JSDoc — for public surfaces, and for constants and fields carrying an implicit meaning

The full shape — JSDoc required on every public class, method, and interface — is in
[[imports-and-format]]. What matters here is WHEN it is worth writing:

**A constant that encodes a business decision** gets JSDoc explaining the reason and the incident it
prevents:

```ts
// real example, flashcard-review.service.ts
/**
 * Max NEW (never-reviewed) cards offered per "due today" batch. Caps the
 * headline so a fresh viewer sees a manageable batch (overdue reviews + this
 * many new) instead of the entire never-reviewed backlog (the "449" bug). The
 * batch refills as new cards get reviewed and leave the new pool.
 */
const DAILY_NEW_LIMIT = 20
```

**A DTO or interface field whose meaning is not obvious** states the consequence of supplying or
omitting a value, rather than repeating the field name:

```ts
// real example — sessionId says why it exists and what happens when it is omitted
description: "The review session this grade belongs to, so the event is attributed
to the session for per-session stats. Omit for an untracked grade.",
```

```ts
// Wrong: parrots the name and says nothing
/** The session id. */
sessionId?: string | null
```

**Every enum member** gets a one-line JSDoc stating its CONSEQUENCE — see `AiErrorKind`, with the
full example in [[type-safety]] §3.

A self-evident field in an internal interface may still carry a short one-line JSDoc
(`/** The card id. */`) so the set is uniform — but do not inflate it into three lines that restate
the name.

## 4. TODO and FIXME — a tag plus enough context for a stranger to continue

The house shape is `TODO(tag): the specific action, plus the condition or path involved`. Never a
meaningless `// TODO fix later`.

```ts
// real example, paypal.client.ts — says exactly what is needed to clear it
 * TODO(real-keys): set `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / ...

// real example, enqueue-generate-cv.service.ts — names the exact swap point
// TODO(wire): swap the literal for ...

// real example, start-mock-interview-session-draw.service.ts — records a deliberate limitation
 *   TODO: a deck can reference multiple modules; this takes the FIRST
```

```ts
// Wrong: no tag, no context, nothing to act on
// TODO: fix this
// FIXME ???
```

A TODO is DELIBERATE debt. Once written, it must answer: can someone reading this line in three
months actually continue? If not, do not leave a TODO — either do the work now, or open a proposal
or a backlog item.

## 5. A comment LIVES with its code — change the code, change the comment

A wrong comment is worse than no comment, because the next reader TRUSTS it instead of reading the
code. Changing behaviour while the comment or JSDoc above it still describes the old behaviour means
the diff is NOT finished. This matters most for the long WHY blocks — the `listDue`
enrolment-versus-`user_id` kind — precisely because they are convincing, which makes them the most
dangerous ones to leave stale.

The checklist before closing an edit: re-read the JSDoc of the method you changed, and every comment
inside the diff.
