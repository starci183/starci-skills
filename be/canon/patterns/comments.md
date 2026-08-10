# comments

## Definition

A comment here answers the one question the code cannot: **why**. What the code does is already
written in the code, in a language designed for saying it precisely; restating that in English adds
a second description that drifts the first time the code changes and nobody edits the sentence
beside it.

So every export opens with a doc block naming what it is FOR, every enum member states the
consequence of choosing it, and the whole file is written in English ASCII so that the next reader
— who may not share a language with the author — can read it.

The question that settles whether a comment earns its place: **could a reader work this out from
the code in front of them?** If yes, delete it. If no — a constraint from elsewhere, a decision that
looks arbitrary, a bug this shape prevents — write it down, because it is about to be lost.

What holds this law is [`sources/be/comments.mjs`](../../../sources/be/comments.mjs).

## Rules

**COMMENT-1 · Every export opens with a doc block.**

A class, an interface, a type, an enum, an exported function. These are the surface other files
depend on, so they are what somebody reads when deciding whether to use them — and a name plus a
signature says what it takes, never what it is for or when to reach for it.

Data constants are out of scope: `export const MAX_ATTEMPTS = 3` is already fully described, and
requiring a sentence beside it would produce sentences that restate the name.

**COMMENT-2 · Every member of an exported enum states its CONSEQUENCE.**

Not what it is called — what choosing it does. `Pending` restated as "the pending state" is a line
that teaches nothing; "no payment has settled, so nothing is granted and the cart is still editable"
is the fact the next author needs and cannot derive.

An enum is where this matters most, because a member is chosen at a call site far from the switch
that gives it meaning.

**COMMENT-3 · The comment says why, and the code says what.**

A comment restating the line beneath it is worse than no comment: it doubles the maintenance and it
is the half that goes stale silently, because nothing fails when a sentence stops being true.

Reach for a comment when the reason lives OUTSIDE the file — a provider's quirk, a constraint from
the schema, an ordering that looks arbitrary and is not, a bug this shape prevents.

**COMMENT-4 · Source is English ASCII.**

Not because English is better, but because a codebase with two languages in it has a reader for whom
half the reasoning is unavailable — and the half they cannot read is exactly the half that explains
the surprising parts. The bar is a stranger who does not share the author's first language.

ASCII, likewise: no emoji, no decorative symbols. An emoji carries tone rather than information,
and tone is the thing that reads differently to everybody.

**COMMENT-5 · Text a program matches on or emits is not a comment.**

A locale string, a provider's own message, a value compared against — these are DATA that happens
to be prose, and translating them breaks the program. They stay, marked with a short note saying
why, so the next sweep does not "fix" them.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| An undocumented export | The surface others depend on says what it takes and never what it is for | Open it with a doc block |
| An enum member with no doc, or one restating its name | The member is chosen far from the switch that gives it meaning | State what choosing it causes |
| A comment restating the code beneath it | It doubles the maintenance, and it is the half that goes stale in silence | Delete it, or replace it with the reason |
| A comment in a language other than English | Half the reasoning becomes unavailable to some reader, and it is the surprising half | English |
| An emoji or a decorative symbol | It carries tone, not information, and tone reads differently to everybody | Words |
| Translating a string the program matches on | It is data wearing prose, and translating it breaks the behaviour | Leave it, and mark why in one short note |

## Examples

### The ordinary case — the doc says what the code cannot

```ts
/**
 * Binds the PRIMARY postgres entity manager.
 *
 * Injecting the wrong connection would read and write the sandbox or the analytics replica instead
 * of live course data, and the type is identical either way.
 */
export const InjectPrimaryPostgreSQLEntityManager = () => InjectEntityManager(POSTGRESQL_PRIMARY)
```

```ts
/** Injects the primary postgres entity manager. */
export const InjectPrimaryPostgreSQLEntityManager = () => InjectEntityManager(POSTGRESQL_PRIMARY)
```

They differ in one thing: whether a reader learns what goes wrong without it.

### The enum trap

```ts
export enum PaymentState {
    /** No payment has settled, so nothing is granted and the cart is still editable. */
    Pending = "pending",
    /** Money is captured and the entitlement is open; a reversal from here is a refund, not a cancel. */
    Settled = "settled",
}
```

```ts
export enum PaymentState {
    /** The pending state. */
    Pending = "pending",
    /** The settled state. */
    Settled = "settled",
}
```

They differ in one thing: whether the member tells a caller what choosing it does.

### The restatement trap

```ts
// the provider sends this webhook twice for a single capture, so the second one must be a no-op
const existing = await this.entityManager.findOne(PaymentEntity, { where: { providerRef } })
```

```ts
// find the payment by provider ref
const existing = await this.entityManager.findOne(PaymentEntity, { where: { providerRef } })
```

They differ in one thing: whether the sentence says something the line does not.

### The data-wearing-prose trap

```ts
// vn-ok: the provider returns this exact Vietnamese string and the comparison is against it
if (response.message === "Giao dich thanh cong") {
```

```ts
// Wrong: "fixed" by a translation sweep. It now compares against a string the provider never sends,
// and every successful payment falls through the branch.
if (response.message === "Transaction successful") {
```

They differ in one thing: whether the string is ours to change.
