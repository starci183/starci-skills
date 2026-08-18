# Event-delivery

## LOADS

None.

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, which message it emitted and on which
node, which law code that maps to, and the open hatch that would have hidden the same failure. This
module chooses nothing. It refuses, and it must be able to point at the offsets it refuses on.

## Law

The law settles one question about a fact that crosses between application instances: **can the same
envelope come back to its own producer, or arrive twice, without the local consequence happening
twice?** The bridge must drop a self-origin envelope and claim the delivery digest before it hands
anything to the in-process emitter.

The law states six codes. **One rule exists, and it holds two of them.** The source publishes exactly
one entry in its `rules` export and exactly one in its `recommended` export, and the two agree; the
expected count of one is confirmed. That single rule carries two message identifiers and therefore
holds two codes at once. The remaining four codes are held by nothing here.

The design worth naming up front is that **this rule reads no syntax tree.** It gates on one exact
file path, then compares three character offsets inside the raw file text. Nothing is parsed, nothing
is resolved, and no node is inspected beyond the `Program` node it reports on. That choice makes the
rule cheap and completely portable across refactors of the file's internals — and it is also the
origin of every open hatch below, because text cannot tell a guard from a comment about a guard.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `nats-bridge-delivery-contract` | `DELIVERY-3` (message `origin`) and `DELIVERY-4` (message `digest`) | `origin` when the producer-identity comparison is absent, or sits later in the file text than the first emitter call; `digest` when the token `parsed.digest` is absent, or sits later in the file text than the first emitter call. Both are reported on the `Program` node |

One rule holding two codes is not an error, but it is a fact a reader must carry: a build log prints
the rule **name**, and that name is the same string for a missing self-origin guard and for a missing
idempotency claim. Only the message text separates them.

`DELIVERY-1` (every envelope carries producer identity and digest), `DELIVERY-2` (`useLocal` and
`useNats` declared per event), `DELIVERY-5` (a consumer asserts recipient and content, not listener
count) and `DELIVERY-6` (cross-instance behaviour proved with two real instances) have **no rule at
all** in this source. Four of six codes are unenforced rather than covered, and a green run says
nothing about any of them.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means an empty visitor was installed and the rule did not exist for that file. That
   state is invisible in a build log.
2. **The rule needs the exact path suffix `/event/nats/nats-bridge.service.ts`**, after `\` is
   normalized to `/`. Any other name, any other folder, any second bridge: no check at all.
3. **Read the exemptions next.** There is no test lane: a fixture, a backup or a build-output copy at
   the same suffix is checked like production. A copy at any other path is not checked.
4. **Read the three offsets, not the logic** — `originIndex`, `digestIndex`, `emitIndex`, taken from
   the whole file as one string. Never report execution order; the rule knows page order only.
5. **Emit one block per finding.** Both messages are computed independently and can fire together on
   one file.
6. **Write the `hatch` line whenever an open hatch would have hidden the same failure**, and record on
   the `evidence` line that a live statement, a comment, a string and dead code are indistinguishable
   here.
7. **Do not report what no rule watches.** Four of the six codes have no machine; a verdict that
   claims otherwise is wrong about the module.

## `nats-bridge-delivery-contract` — DELIVERY-3 and DELIVERY-4

**What it reports.** Two things, two separate messages, computed independently so both can fire at
once. `origin` — the producer-identity comparison is absent, or found but sitting **after** the first
emitter call in the file text. `digest` — the token `parsed.digest` is absent, or found but sitting
after that same call. Both reports land on the `Program` node, so a failure points at the top of the
file and never at the offending emit.

**How it detects.** File gate first. It reads `context.filename`, falling back to
`context.getFilename()`, normalizes `\` to `/`, and requires the result to satisfy
`endsWith("/event/nats/nats-bridge.service.ts")`. A non-match returns an **empty visitor**, so the
file is not partially checked — it is not checked at all. On a match it registers exactly one visitor,
`Program:exit`, and inside it takes `sourceCode.getText()` — the **entire file as one string** — then
computes three offsets: `originIndex = text.search(/parsed\.id\s*===\s*this\.instanceService\.getId\(\)/)`,
`digestIndex = text.indexOf("parsed.digest")`, `emitIndex = text.indexOf("this.eventEmitter.emit")`.
It reports `origin` when `originIndex < 0 || emitIndex < 0 || originIndex > emitIndex`, and `digest`
when `digestIndex < 0 || emitIndex < 0 || digestIndex > emitIndex`.

**What it cannot see.** That a matched comparison actually **skips** anything: the rule proves the
comparison exists, never that it drops the envelope, so `if (parsed.id === this.instanceService.getId()) { }`
with no `continue` and no `return` is silent while every self-echo is emitted. A comment, a string
literal, a disabled block or a dead private method satisfies either token permanently, because the
offsets are taken from raw text and carry no provenance. A digest read with no matching write —
`await this.cacheService.get({ key, args: [parsed.digest] })` — passes, which is exactly the race
`DELIVERY-4` was written to close. Every emitter call after the first, because `indexOf` stops at the
first occurrence. Execution order, because character offset is not execution order: a correct guard in
a helper written below the handler is refused, and an incorrect one written above is accepted. Any
longer identifier with the same prefix — `parsed.digestedAt`, `parsed.digestion` — or the quoted
string `"parsed.digest"` in a log line, because `indexOf` is a substring search with no word boundary
and no node type. That `parsed` is the real envelope at all: `const parsed = { id: "x", digest: "y" }`
passes, since no import is resolved, no type is read, and nothing confirms `getId()` returns an
instance id rather than a subject. The real fan-out moved into a collaborator —
`this.localFanOut.publish(...)` in another file — while one token-satisfying emit stays behind. Any
other filename, any second bridge, any second application. And a run that hands the rule no filename:
`normalizePath(undefined)` is `""`, which fails the suffix test.

**Boundary.** This rule judges tokens in an order inside one file. Whether the consequence actually
happens twice — the thing the law is about — is judged by nothing in this module.

## Detection

| Part | Mechanism |
|---|---|
| file gate | `context.filename`, falling back to `context.getFilename()`, `\` normalized to `/`, then `endsWith("/event/nats/nats-bridge.service.ts")`. A non-match returns an empty visitor |
| walker | Exactly one visitor, `Program:exit`. No child node is visited and no property of `Program` is inspected; it is the report anchor only |
| reader | `sourceCode.getText()`, falling back to `context.getSourceCode()` — the entire file as one string, for all three offsets |
| origin offset | `text.search(/parsed\.id\s*===\s*this\.instanceService\.getId\(\)/)` — a fixed spelling of three identifiers, hard-coding the local name `parsed`, the member path `this.instanceService.getId()`, the operator `===` and the operand order. `\s*` absorbs whitespace and line breaks around the operator, and nothing else varies |
| digest offset | `text.indexOf("parsed.digest")` — a bare substring search with no word boundary and no node type |
| emit offset | `text.indexOf("this.eventEmitter.emit")` — the **first** occurrence only. Every later emitter call in the same file is compared against nothing |
| reach outside the file | None. No import is resolved, no type is read, no second file is opened, no configuration and no list of blessed events |

"Before" means earlier in the file, not earlier in execution. Class methods hoist and helpers are
called from anywhere, so where a guard sits on the page and when it runs are independent facts, and
the rule only knows the first one. The rule declares `schema: []`, so it takes no options, and
declares no `fixable` and no `hasSuggestions`, so it offers no repair.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
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

**Open** — shipped blindness. A verdict must not claim these were judged.

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
| everything else in the law | **`DELIVERY-1`, `DELIVERY-2`, `DELIVERY-5` and `DELIVERY-6`** — an envelope with no producer identity or digest, an event with no `useLocal`/`useNats` declaration, a consumer that asserts listener count instead of recipient and content, cross-instance behaviour never proved with two real instances |

Twelve open rows of writing, and eleven of them share one shape: the rule sees **tokens in an order**,
while the law is about **a consequence that must not happen twice**. A token can be written without
the consequence being guarded, and a guard can be written without the token.

## Rules

1. A rule's identity is its **published name**. There is no numeric identifier for a rule; the name is
   what a build prints, what a disable comment carries, and what any conversation about a failure
   uses.
2. This rule holds two codes of the law, separated by message identifier and by nothing else.
3. The rule reads exactly one file. Every other file in the repository is outside, and outside
   silently.
4. The file gate returns an **empty visitor**, so a gated file is not partially checked — it is not
   checked at all, and that state is invisible in a build log.
5. Both messages are computed independently and can fire together on one file.
6. Both reports land on `Program`, so a failure points at the top of the file and never at the
   offending emit.
7. The rule takes no options: `schema: []`. Relaxing it means switching it off, and switching it off
   is visible.
8. The rule has no fixer. The message is words, not a repair.
9. `meta.type` is `"problem"` and `recommended` sets the rule to `error`.
10. Every open hatch above is a hatch in the *rule*, never a permission in the *law*. Code that slips
    through is still wrong.

## Exceptions

Every exception here is written into the rule, not granted beside it.

- **Every file but one is exempt.** The gate admits a single path suffix. This is not a carve-out for
  tests or generated code; it is the rule's entire scope, and it means the module enforces a law about
  a class of behaviour by asserting the contents of one file. It releases every other bridge, in this
  application and in any other, from `DELIVERY-3` and `DELIVERY-4`.
- **No test lane.** A fixture, a backup or a vendored copy at the same path suffix is checked like
  production. A copy at any other path is not.
- **Absence of an emitter call is treated as a violation, not as an exemption.** A file with no
  fan-out reports both messages, using message text about ordering. That divergence between cause and
  message is a finding of the enforcement, not a permission.
- **Nothing distinguishes a use from a mention.** A comment, a string and a dead branch are accepted
  as evidence by omission, not by design; the rule has no way to tell them apart. This releases every
  file whose tokens are mentions.
- **The reversed operand order** — `this.instanceService.getId() === parsed.id` — is not an exception:
  it **is reported**, though it means exactly the same thing. It is recorded here because it is the
  false report a reader meets most often, and the correct repair is to change the regex, not to
  rewrite code that is already right.

## Output

One block per finding:

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

A clean file emits one block with `gate: matched`, all three offsets present and ordered, `message`
naming neither, and `verdict: silent` with the hatch that could still be hiding the failure. An
out-of-scope file emits one block with `gate: empty visitor: file is not checked`, all three offsets
absent and `verdict: silent: hatch renaming or moving the file`. It has not passed.

The `evidence` line is not decoration. This rule's strongest possible result and its weakest possible
result are **the same result**, because character offsets carry no provenance. Reporting a token found
in a comment as equal to a guard found in the handler is how a leftover line becomes a delivery
guarantee.
