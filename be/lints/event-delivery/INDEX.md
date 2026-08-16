---
id: be-lints-event-delivery-index
title: INDEX.md
slug: /be/lints/event-delivery
sidebar_label: event-delivery
sidebar_position: 0
description: What the single event-delivery rule actually sees in one file, and the twelve ways of writing that walk past it.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `event-delivery`

## Law

The law this module enforces settles one question about a fact that crosses between application
instances: **can the same envelope come back to its own producer, or arrive twice, without the local
consequence happening twice?** The bridge must drop a self-origin envelope and claim the delivery
digest before it hands anything to the in-process emitter.

This shelf does not restate that law. It records **enforcement**: which of those sentences a machine
can hold, by what mechanism, and — the part nobody writes down — which ways of writing walk past the
machine untouched.

One rule exists. The source publishes exactly one entry in its `rules` export and exactly one in its
`recommended` export, and the two agree; the expected count of one is confirmed. That single rule
carries **two** message identifiers and therefore holds **two** codes of the law at once. The
remaining four codes are held by nothing here.

The design worth naming up front is that **this rule reads no syntax tree.** It gates on one exact
file path, then compares three character offsets inside the raw file text. Nothing is parsed,
nothing is resolved, and no node is inspected beyond the `Program` node it reports on. That choice
makes the rule cheap and completely portable across refactors of the file's internals — and it is
also the origin of every open hatch below, because text cannot tell a guard from a comment about a
guard.

## Rules

| Rule | Code | What it reports |
|---|---|---|
| `nats-bridge-delivery-contract` | `DELIVERY-3` (message `origin`) and `DELIVERY-4` (message `digest`) | `origin` when the producer-identity comparison is absent, or sits later in the file text than the first emitter call; `digest` when the token `parsed.digest` is absent, or sits later in the file text than the first emitter call. Both are reported on the `Program` node |

One rule holding two codes is not an error, but it is a fact a reader must carry: a build log prints
the rule **name**, and that name is the same string for a missing self-origin guard and for a missing
idempotency claim. Only the message text separates them.

`DELIVERY-1` (every envelope carries producer identity and digest), `DELIVERY-2` (`useLocal` and
`useNats` declared per event), `DELIVERY-5` (a consumer asserts recipient and content, not listener
count) and `DELIVERY-6` (cross-instance behaviour proved with two real instances) are enforced by
**no rule in this source**. Four of six codes are unheld. That is carried in `audit.md` rather than
softened here.

## Detection

| Rule | Mechanism |
|---|---|
| `nats-bridge-delivery-contract` | **File gate first.** Reads `context.filename`, falling back to `context.getFilename()`, normalizes `\` to `/`, and requires the result to satisfy `endsWith("/event/nats/nats-bridge.service.ts")`. A non-match returns an **empty visitor**, so the file is not partially checked — it is not checked at all. On a match it registers exactly one visitor, `Program:exit`, and inside it takes `sourceCode.getText()` — the **entire file as one string** — then computes three offsets: `originIndex = text.search(/parsed\.id\s*===\s*this\.instanceService\.getId\(\)/)`, `digestIndex = text.indexOf("parsed.digest")`, `emitIndex = text.indexOf("this.eventEmitter.emit")`. It reports `origin` when `originIndex < 0 \|\| emitIndex < 0 \|\| originIndex > emitIndex`, and `digest` when `digestIndex < 0 \|\| emitIndex < 0 \|\| digestIndex > emitIndex`. Both reports are anchored to the `Program` node passed into the visitor |

Four properties of that mechanism decide everything on this page.

**"Before" means earlier in the file, not earlier in execution.** The comparison is between character
offsets. Class methods hoist and helpers are called from anywhere, so where a guard sits on the page
and when it runs are independent facts, and the rule only knows the first one.

**`emitIndex` is the FIRST occurrence.** `indexOf` stops at the first `this.eventEmitter.emit`. Every
later emitter call in the same file is compared against nothing.

**The digest test is a bare substring search.** `indexOf("parsed.digest")` has no word boundary and
no node type. It matches inside a longer property name, inside a string literal and inside a comment.

**The origin test is a fixed spelling of three identifiers.** The regex hard-codes the local name
`parsed`, the member path `this.instanceService.getId()` and the operator `===` in that operand
order. `\s*` absorbs whitespace and line breaks around the operator, and nothing else varies.

The rule declares `schema: []`, so it takes no options, and declares no `fixable` and no
`hasSuggestions`, so it offers no repair.

## Escape Hatches

### Closed

| Way of writing | Why it does not slip |
|---|---|
| `if (parsed.id !== this.instanceService.getId()) continue` — the inversion that drops everything **except** self-echo | The regex demands `===`. `!==` does not match, `originIndex` is `-1`, and `origin` fires. The most damaging way to get this wrong is caught, though only as "no guard at all" |
| Moving a correct guard below the emitter call | Order is half the test. `originIndex > emitIndex` reports exactly as loudly as an absent guard |
| Recording the digest after handing the event to the emitter | Same shape on the other message. `digestIndex > emitIndex` reports `digest` |
| Deleting the emitter call to quiet the rule | `emitIndex < 0` makes **both** conditions true, so removing the fan-out produces two reports instead of zero |
| Aliasing the emitter — `const bus = this.eventEmitter` then `bus.emit(...)` | The emit token disappears, `emitIndex` is `-1`, and both messages fire. Renaming cannot buy silence |
| Hoisting the instance id into a named local — `const selfId = this.instanceService.getId()` then `if (parsed.id === selfId)` | The regex no longer matches and `origin` fires. This is the inverse of the usual constant-laundering hatch: gathering a value into a constant makes this rule **louder**, never quieter |
| Reformatting — a line break or extra spaces around `===` | `\s*` on both sides absorbs it, so a formatter run cannot switch the check off |
| A Windows-style path with backslashes | Every separator is normalized before the suffix test, so the gate behaves identically on any platform |
| A copy of the bridge under a fixture, a backup or a build-output folder, if its path still ends in the same three segments | The gate is a plain suffix match with no test-lane and no build-output carve-out. A copy in the same shape is checked exactly like the original |
| Passing an option to relax the check | `schema: []`. There is nothing to pass. The only relief is a disable comment, and a disable comment is visible in the file |

### Open

| Way of writing | Why the rule does not catch it |
|---|---|
| `if (parsed.id === this.instanceService.getId()) { /* nothing */ }` — the comparison with no `continue` and no `return` | The rule proves the comparison **exists**. It never proves it **skips**. Every self-echo is emitted, the text matches, and the gate is silent. This is the single most serious hatch in the module |
| `// legacy path: parsed.id === this.instanceService.getId()` in a comment near the top of the file | The offsets are taken from raw text. A comment, a disabled block, a string literal or a dead private method satisfies the origin test permanently, and the live handler can then do nothing at all |
| `await this.cacheService.get({ key, args: [parsed.digest] })` with no matching write | The digest test asks only that the token appear before the emit. A read without a claim is exactly the race `DELIVERY-4` was written to close: two redeliveries both miss the cache, both emit, and the rule reports clean |
| A second emitter call lower in the file — a retry path, a second subscription loop, a lifecycle event | `emitIndex` is the **first** occurrence only. Guard the first emit and every later one is unmeasured, forever |
| A guard in a private helper written **below** the handler, or a handler written above a guard that runs first | Character offset is not execution order. The rule judges where code sits on the page. This cuts both ways: it refuses correct code and it accepts incorrect code |
| Renaming the file to `nats-bridge.ts`, or moving it to `event/bridge/`, or splitting the handler into `nats-bridge.consumer.ts` | The gate is one exact three-segment suffix. Filename is the cheapest thing in a repository to change, and an empty visitor is indistinguishable from a clean file in a build log |
| A second bridge: `event/nats/nats-bridge-v2.service.ts`, `event/kafka/kafka-bridge.service.ts`, or the same file in a second application | The law governs every cross-instance bridge. The gate names one path. Nothing else in the tree is looked at, ever |
| Moving the real fan-out into a collaborator — `this.localFanOut.publish(...)` in another file — while one token-satisfying emit stays behind in the bridge | The rule is single-file and reads no import. The tokens it needs are still present and still ordered; the unguarded emit now lives where the rule cannot reach |
| `parsed.digestedAt`, `parsed.digestion`, or the string `"parsed.digest"` in a log message | `indexOf` is a substring search with no word boundary and no node type. Any longer identifier with that prefix, and any quoted mention, satisfies `DELIVERY-4` |
| `const parsed = { id: "x", digest: "y" }` — a stub that is not the envelope | No import is resolved and no type is read. Nothing verifies `parsed` is the parsed envelope, that `this.instanceService` is the instance service, or that `getId()` returns an instance id rather than a subject |
| A run that hands the rule no filename, or a filename with no `/` before `event` | The gate needs the leading slash and a non-empty name; `normalizePath(undefined)` is `""`, and `""` fails the suffix test. Narrow, but it is a dependency on how the runner names the file rather than on where the file is |
| `// eslint-disable-next-line starci-be/nats-bridge-delivery-contract` | The rule is not unsuppressible. Every closed row above is also reachable in one line by somebody in a hurry |

Twelve open rows, and eleven of them share one shape: the rule sees **tokens in an order**, while the
law is about **a consequence that must not happen twice**. A token can be written without the
consequence being guarded, and a guard can be written without the token.

## Inputs

| Input | What is read |
|---|---|
| `context.filename` | Backslash-normalized, then suffix-matched against `/event/nats/nats-bridge.service.ts`. Falls back to `context.getFilename()` when falsy |
| `sourceCode.getText()` | The complete file text, as one string, for all three offsets. Falls back to `context.getSourceCode()` |
| `Program` node | Used **only** as the report anchor. No property of it is inspected |

Nothing else is read. No child node, no type information, no import graph, no second file, no
configuration, no list of blessed events.

## Invariants

- A rule's identity is its **published name**. There is no numeric identifier for a rule; the name is
  what a build prints, what a disable comment carries, and what any conversation about a failure
  uses.
- This rule holds two codes of the law, separated by message identifier and by nothing else.
- The file gate returns an **empty visitor**, so a gated file is not partially checked — it is not
  checked at all, and that state is invisible in a build log.
- Both messages are computed independently and can fire together on one file.
- Both reports land on `Program`, so a failure points at the top of the file and never at the
  offending emit.
- `meta.type` is `"problem"` and `recommended` sets the rule to `error`.
- Every open hatch above is a hatch in the *rule*, never a permission in the *law*. Code that slips
  through is still wrong.

## Exceptions

Every exception here is written into the rule, not granted beside it.

- **Every file but one is exempt.** The gate admits a single path suffix. This is not a carve-out for
  tests or generated code; it is the rule's entire scope, and it means the module enforces a law
  about a class of behaviour by asserting the contents of one file.
- **No test lane.** A fixture, a backup or a vendored copy at the same path suffix is checked like
  production. A copy at any other path is not.
- **Absence of an emitter call is treated as a violation, not as an exemption.** A file with no
  fan-out reports both messages, using message text about ordering. That divergence between cause and
  message is a finding, recorded in `audit.md`.
- **Nothing distinguishes a use from a mention.** A comment, a string and a dead branch are accepted
  as evidence on purpose-by-omission, not by design; the rule has no way to tell them apart.

## Output

```text
rule:     nats-bridge-delivery-contract
code:     <DELIVERY-3 | DELIVERY-4>
file:     <path as the rule normalized it>
gate:     <matched | empty visitor: file is not checked>
origin:   <offset | absent>
digest:   <offset | absent>
emit:     <offset of the FIRST emitter call | absent>
evidence: <live statement | comment | string | dead code | unknown — the rule cannot tell>
message:  <origin | digest>
verdict:  <fires | silent: hatch <name from the Open table>>
```

The `evidence` line is not decoration. This rule's strongest possible result and its weakest possible
result are **the same result**, because character offsets carry no provenance. Reporting a token
found in a comment as equal to a guard found in the handler is how a leftover line becomes a delivery
guarantee.

## Load Policy

Read this file first. Read `vi.md` for what the rule catches and why it is worth a machine, read
`example.md` for the code that fires and the code that slips, and read `audit.md` only while
reviewing the enforcement itself.

## Scope

This module documents one rule of one back-end law. It names no product, no company and no
repository. The rule name, its message identifiers, the plugin prefix in the `recommended` map and
the identifiers the regex matches are **identifiers that ship** and are reproduced verbatim; that
exemption covers nothing else.

## Version Rule

Increment all five records by `0.01` for an accepted change to the rule or to what is claimed about
it, and record it in `changelog.md`. A new rule in the source, a removed rule, a changed detection
mechanism, or a newly discovered open hatch each require a version bump — a hatch found and not
written down is the failure this shelf exists to prevent.
