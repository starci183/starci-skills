# comments

## Definition

A comment is what the code cannot say about itself. The code already states what happens; a comment
states why it happens that way, what breaks without it, and which alternative was refused. Anything
that merely renames the line below it is noise, and noise trains a reader to skip the comment that
mattered.

Two questions settle everything here. **Would a stranger reach the same conclusion from the code
alone?** If yes, the comment is not needed. **Can a reader who does not share your first language
read it?** If no, it is not written yet.

That second question is the one this file is strictest about, and the bar is deliberately not
"English where convenient": the source is English-only, to a stranger's standard, and the exceptions
are three, narrow, and named below.

What holds this law is [`sources/fe/comments.mjs`](../../../sources/fe/comments.mjs). It reaches
identifiers, comments, JSDoc, diagnostics and string literals — everywhere prose can hide — because
a rule that checked only comments would leave the same sentence legal one line lower as a variable
name.

## Rules

**COMMENTS-1 · Every export opens with a documentation block.**

An export is something another file depends on, so its contract is read far more often than it is
written, and by people who will never open the body. The block names the ROLE — what this is, what
it is for — rather than restating the signature, which the signature already states.

The scope is deliberate: exports only. Requiring one on every internal helper produces a file where
half the lines are ceremony and no block is read.

**COMMENTS-2 · The source is English, to a stranger's standard.**

Comments, JSDoc, identifiers and diagnostic messages. The bar is not the team — it is somebody who
joins in a year and does not share the first language of whoever wrote the line. A codebase with two
languages in it has two populations of readers, and the smaller one silently stops reading the parts
it cannot.

**COMMENTS-3 · Three exceptions, and each is stated where it applies.**

Locale content is not authoring: a translation dictionary IS the other language, and holding it to
this rule would empty the product. A test fixture that reproduces a real string has to reproduce it
exactly, or it is testing something else. And a literal the running program matches on or emits —
a value, not prose — stays, marked on its own line with the reason.

The mark is the point of the third exception. An unmarked literal is indistinguishable from a
comment somebody forgot to translate, so a reader has to decide, and the next one decides
differently.

**COMMENTS-4 · No emoji in source.**

Not in identifiers, comments, diagnostics or non-content strings. A pictograph renders differently
on every platform, sorts unpredictably, breaks a terminal that is not expecting it, and carries a
meaning that is not the same in two countries. Where a mark is genuinely wanted on screen, it is an
icon, which is a decision the icon vocabulary already owns.

**COMMENTS-5 · A comment that restates the line is deleted, not improved.**

`// increment the counter` above an increment costs a line and teaches nothing, and it is worse than
neutral: a reader who finds three of them stops reading the fourth, which is the one that said why
the counter resets on a Sunday.

**COMMENTS-6 · A comment that has to argue is arguing with a decision, and names it.**

The comments worth keeping are the ones recording a refusal: what was tried, what it cost, why the
obvious shape is wrong here. Those are exactly the ones a reader would otherwise undo.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| An export with no documentation block | Its contract is read by people who never open the body | Name the role, not the signature |
| A block that restates the signature | The signature already says it, in a form that cannot go stale | Say why it exists, or delete the block |
| A comment in a second language | The codebase gains a population of readers who skip parts of it | English, to a stranger's standard |
| An identifier in a second language | Same, one line lower, where a comment rule would not look | Same |
| A diagnostic message in a second language | The person reading it is whoever is on call, not whoever wrote it | Same |
| Emoji anywhere in source | It renders differently everywhere and means different things in different places | An icon, if a mark is wanted on screen |
| A functional literal in another language, unmarked | It is indistinguishable from prose somebody forgot to translate | Keep it, and mark the line with its reason |
| A comment restating the line below it | It teaches nothing and trains the reader to skip the next one | Delete it |

## Examples

### The ordinary case — a block that says what the signature cannot

```ts
/**
 * Read the table that governs a linted file.
 *
 * Returns null when none sits above it. A rule that gets null must do NOTHING: a table nobody can
 * read is a reason to stay quiet, never a reason to call every call site wrong.
 */
```

```ts
/**
 * Reads the table.
 *
 * @param filename - The filename.
 * @returns The table.
 */
```

They differ in one thing: whether a reader learns what to do with the answer.

### The language trap — one line lower

```ts
const isOverdue = (dueAt: Date) => dueAt < now
```

```ts
// han cuoi da qua
const isOverdue = (dueAt: Date) => dueAt < now
```

They differ in one thing: whether the next reader can read the reason. The rule reaches identifiers
for the same reason — moving the sentence into a name does not translate it.

### The functional-literal exception

```ts
// vn-ok: the server sends this status verbatim and the screen matches on it
const CANCELLED = "Da huy"
```

```ts
const CANCELLED = "Da huy"
```

They differ in one thing: whether a reader can tell a value from an untranslated comment.

### The restatement trap

```ts
// The rungs are not evenly spaced, so adding one lands between them.
const next = STEPS[index + 1]
```

```ts
// get the next step
const next = STEPS[index + 1]
```

They differ in one thing: whether the comment says something the line does not.
