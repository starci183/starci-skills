# CDC

## LOADS

None.

## Record

The input is code that is already written — one listener file, one hunk of a diff. The output is a
**verdict**: whether the file was in scope at all, which published rule fired, what it reported and on
which node, which law code that maps to, and the open hatch that would have hidden the same failure.
This module chooses nothing about how a projection is built. It refuses, and it must be able to point
at the identifier it refuses on.

## Law

The law carries seven codes, `CDC-1` through `CDC-7`. **Four codes have machine coverage through three
published rules.** The listener contract reads a filename and member names; two focused rules also
inspect the `groupId` value and the recompute body. The listener contract reads the names of the members a
class declares. That is the whole of it. Names are the only thing about a change-data-capture listener
that a single-file parser can see with certainty: whether a class *extends* the shared base, whether it
*declares* a consumer group, a topic list, a mapping method and a recompute method, and whether it
*declares* a lifecycle hook it must not own.

Everything the law actually cares about downstream of those names — whether the consumer group is
stable across restarts, whether the topic list is complete, whether recompute rebuilds from source rows
or adds a delta, whether a tombstone is skipped, whether one bad message stops the loop, whether
delivery was ever proved against a real broker — is a **value or a body**, not a name. The rule reads
neither.

So the honest statement of enforcement is: **the shape of a listener is held, and the semantics of a
projection are not.** A listener with a correct shape and a per-process consumer group passes this gate
cleanly and replays history on every boot. That is not a defect in the rule; it is the boundary of what
a name can prove, and it is written down here so nobody mistakes a green build for a correct
projection.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `projection-listener-contract` | `CDC-1`, `CDC-2`, `CDC-3` | A class in a listener file does not extend `AbstractProjectionListener` (`base`); it does not declare one of `groupId`, `topics`, `deriveTargets`, `recomputeTarget` (`member`, once per missing name); it declares `onModuleInit` (`lifecycle`) |
| `no-dynamic-projection-group-id` | `CDC-2` | A listener `groupId` is computed at boot instead of being a stable string literal. |
| `projection-recompute-must-upsert` | `CDC-4` | A recompute accepts delta-like input or a projection recompute service does not write through `ON CONFLICT` upsert. |

The source publishes **exactly one** rule. One rule carrying three codes is worth stating plainly
rather than smoothing over: the three checks inside it are independent, they fire independently, and a
reader who sees `projection-listener-contract` in a build log has to read the message to know which
code was broken. `CDC-1` covers `base` and `lifecycle`; `CDC-2` covers the names `groupId` and
`topics`; `CDC-3` covers the names `deriveTargets` and `recomputeTarget`.

The remaining semantic portions of `CDC-2` and `CDC-4`, plus `CDC-5`, `CDC-6` and `CDC-7`, have no complete machine proof. They are
unenforced rather than covered, and a green run says nothing about a recompute that adds a delta, a
tombstone turned into an empty current row, a failure that stops the consumer, or a delivery path never
exercised through a broker.

The published severity is `error`, on the ground that every check is a name comparison inside one file
and needs no configuration to work. The source ships that severity and carries **no measurement note
beside it** — there is no recorded count of offenders that the `error` level was bought with.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means the rule returned `{}`, no visitor was installed, and the rule did not exist for
   that file.
2. **The rule needs a path ending in `projection.listener.ts`.** Any other name — `order.listener.ts`,
   `.tsx`, `.mts`, a listener declared in `index.ts`, a listener living inside a `*.service.ts` —
   switches the rule off entirely.
3. **Check the one exemption.** The normalised path `.endsWith("/abstract-projection.listener.ts")` is
   excluded; the shared base is exempt from its own rule.
4. **Read every `ClassDeclaration` in the file**, not just the exported one, and never a
   `ClassExpression`. Read the superclass identifier as spelled at `extends`, and the `key` of every
   member node.
5. **Emit one block per finding.** The three checks are independent with no early return, so one class
   can collect `base`, four `member` reports and `lifecycle` in one pass.
6. **Write the `hatch` line** whenever an open hatch would have hidden the same failure — most of all
   when the verdict is silence.
7. **Do not report what no rule watches.** Four of the seven codes have no machine; a verdict that
   claims otherwise is wrong about the module.

## `projection-listener-contract` — CDC-1, CDC-2, CDC-3

**What it reports.** Three different things, three different messages, none suppressing another.
`base` — a class in a listener file does not extend `AbstractProjectionListener`, reported at
`node.id || node`. `member` — one of the four names `groupId`, `topics`, `deriveTargets`,
`recomputeTarget` is absent, one report per missing name, all placed at the class id. `lifecycle` — the
class declares `onModuleInit`, reported at `member.key`.

**How it detects.** The filename gate runs first: `context.filename || context.getFilename()`, coerced
with `String(… || "")`, backslashes replaced by `/`, then tested against `/projection\.listener\.ts$/`
— unanchored on the left, so `a-projection.listener.ts`, `a.projection.listener.ts` and
`aprojection.listener.ts` all match. One exclusion: the normalised path
`.endsWith("/abstract-projection.listener.ts")`. No match means the rule returns `{}`. In scope, the
single visitor is `ClassDeclaration`, and three checks run in order with **no early return between
them**: (a) `!node.superClass || node.superClass.name !== "AbstractProjectionListener"` reports `base`;
(b) `node.body.body` is mapped through `member.key && (member.key.name || member.key.value)` into a
`Set`, and each of the four names absent from that set reports `member`; (c) the first member whose
mapped name is `onModuleInit` reports `lifecycle`.

**What it cannot see.** The value behind a name: `` protected readonly groupId = `projection-${randomUUID()}` ``
declares the name and replays history on every boot, and `protected readonly topics = []` declares the
name and follows nothing. A body: `recomputeTarget` that adds the delta carried by the event instead of
rebuilding from source rows, and `deriveTargets` that dispatches a business command, sends a
notification or writes a row, are never visited. Any lifecycle hook other than the single literal name
`onModuleInit` — `onApplicationBootstrap`, `onModuleDestroy`, a scheduled method, an event-subscriber
method, the constructor — is an open door to the exact fork of subscription and failure semantics
`CDC-1` forbids. A `ClassExpression`:
`export const OrderTotalsListener = class extends AbstractProjectionListener { … }` is never visited. An
import: the comparison is `node.superClass.name`, the identifier as spelled at the class, so
`import { AbstractProjectionListener as Base }` then `extends Base` produces a false report, while a
same-file shim named `AbstractProjectionListener` produces silence. A wiring graph: a perfectly shaped
listener that no module lists in its providers reports nothing and projects nothing.

**Boundary.** This rule judges declarations inside one file. Whether the projection those declarations
name is correct at runtime is partly held by the focused `CDC-2` and `CDC-4` rules; `CDC-5` through `CDC-7` remain human-held.

## Detection

| Part | Mechanism |
|---|---|
| filename gate | `context.filename \|\| context.getFilename()`, coerced with `String(… \|\| "")`, backslashes replaced by `/`, tested against `/projection\.listener\.ts$/` — unanchored on the left |
| exclusion | The normalised path `.endsWith("/abstract-projection.listener.ts")` |
| out of scope | The rule returns `{}`. It does not exist for that file rather than passing it |
| visitor | `ClassDeclaration` only — never `ClassExpression` — and every class declaration in the file, not just the exported one |
| superclass test | `!node.superClass \|\| node.superClass.name !== "AbstractProjectionListener"`, reported at `node.id \|\| node` |
| member scan | `node.body.body` mapped through `member.key && (member.key.name \|\| member.key.value)` into a `Set`, checked against `groupId`, `topics`, `deriveTargets`, `recomputeTarget` |
| lifecycle test | The first member whose mapped name is `onModuleInit`, reported at `member.key` |

Two properties of that mechanism decide everything below.

**It reads member names, not member kinds.** The mapping helper takes any node with a `key`, so a
method, a class field, a getter, a static member and an abstract declaration are all the same evidence.
This is the opposite trade from a method-only scan: nothing hides in a class field here.

**It reads names and nothing else.** No value, no body, no type, no import, no second file, no module
graph, no filesystem. A rule whose answer depends on the working tree cannot be reproduced in review; a
rule whose answer depends only on the file in front of it can be — and pays for that with every row in
the Open table.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| A backslash path on a Windows checkout | The filename is normalised to forward slashes before both the match and the exclusion, so the gate behaves identically on every platform |
| Renaming from `a.projection.listener.ts` to `a-projection.listener.ts`, or the reverse | The gate regex is unanchored on the left; it asks only that the path end in `projection.listener.ts`, so the separator before it is irrelevant |
| Declaring `groupId` as a class field instead of a getter, or the reverse | The member scan reads `key.name` off **any** member node. `PropertyDefinition`, `MethodDefinition`, a getter, a setter and an abstract declaration are indistinguishable to it |
| `onModuleInit = async () => { … }` as an arrow field rather than a method | Same scan, same result. A class field is invisible to a method-only rule; it is not invisible to this one |
| A string key: `"groupId" = "orders"` or `["topics"] = []` | The mapping helper falls back to `key.value` when there is no `key.name`, so a string literal key — computed or not — resolves to the same name |
| `private`, `protected`, `override`, `async`, `readonly` on any member | No modifier is consulted anywhere in the rule |
| Hiding the listener behind other classes in the same file | Every `ClassDeclaration` in a matching file is visited; there is no "first class" or "exported class" heuristic |
| `export default class extends AbstractProjectionListener { … }` with no name | An anonymous default export is still a `ClassDeclaration`; the report falls back from `node.id` to the class node |
| Declaring all four members and hoping it excuses the missing base | The three checks are independent with no early return; a class can collect `base`, four `member` reports and `lifecycle` in one pass |
| Extending the base and then adding `onModuleInit` "just to log something" | The lifecycle check does not care whether the base check passed. Owning the hook at all is the report |

**Open** — shipped blindness. A verdict must not claim these were judged.

| What slips through | Why the mechanism misses it |
|---|---|
| `` protected readonly groupId = `projection-${randomUUID()}` `` | The check is that the name `groupId` appears in the class body. The **value** is never read. `CDC-2` exists to forbid a per-process group that replays history on every boot, and that is precisely the spelling the rule cannot see |
| `protected readonly topics = []`, or a topic list built from a variable that resolves to nothing | Same gap on the other half of `CDC-2`. A projection that follows no topic is silently stale forever, and declares the name the rule asks for |
| A private consumer started from `onApplicationBootstrap`, `onModuleDestroy`, a scheduled method, an event-subscriber method, or the constructor | The lifecycle check is a single literal name, `onModuleInit`. Every other hook a framework offers is an open door to the exact fork of subscription and failure semantics `CDC-1` forbids |
| `recomputeTarget` that adds the delta carried by the event instead of rebuilding from source rows | The body is never visited. This is `CDC-4` — duplicate delivery double-counts, a missed event never heals — and the rule sees a correctly named method |
| `deriveTargets` that dispatches a business command, sends a notification or writes a row | Same gap. `CDC-3` says the listener returns identities and nothing else; the rule confirms only that something called `deriveTargets` exists |
| `export const OrderTotalsListener = class extends AbstractProjectionListener { … }` | The visitor key is `ClassDeclaration`. A `ClassExpression` — assigned to a const, returned from a factory, passed to a decorator helper — is never visited, so the rule does not exist for it |
| `order-totals.listener.ts`, `order-totals-projection.listener.tsx`, `.mts`, a listener class declared in `index.ts`, or a listener living inside a `*.service.ts` | The filename gate **is** the rule's existence. Nobody renames a file to dodge a lint; they rename it because it reads better beside its siblings |
| `import { AbstractProjectionListener as Base }` then `extends Base` — and, in the other direction, a local class expression named `AbstractProjectionListener` that the listener extends | The comparison is `node.superClass.name`, the identifier **as spelled at the class**. No import is resolved. Renaming on import produces a false report; a same-file shim with the right name produces silence |
| An intermediate abstract listener: `class OrderTotalsListener extends AbstractOrderProjectionListener`, where that class extends the shared base | The rule is single-file and compares one identifier. A legitimate two-level family reports `base` on every leaf, and the cheapest response — a file-level disable comment — switches off the member and lifecycle checks in the same file |
| `constructor(protected readonly groupId: string, protected readonly topics: Array<string>) { … }` | Parameter properties are not class-body members. They declare the member for the compiler; the scan walks `node.body.body` and reports both names as missing. The false report teaches the author to disable the rule, which is how a true report is lost later |
| `static groupId = "orders"`, `static topics = []` | A static member satisfies the name scan and satisfies nothing at runtime — the instance contract is still unimplemented. The rule accepts it because it never asks what kind of member it found |
| A perfectly shaped listener that is never listed in any module's providers | The rule reads a file, not a wiring graph. A listener nothing constructs consumes nothing, projects nothing, and reports nothing. Green build, dead projection |
| A tombstone handled by inventing an empty current row, in any listener whose base is bypassed | `CDC-5` has no rule. The shared base skips a payload with no after-image; a listener that escaped the base check through any row above takes that behaviour with it |
| A parse or recompute failure that stops the consumer, and any projection whose delivery was never exercised through a broker | `CDC-6` and `CDC-7` have no rule at all. The first is a behaviour of a `catch` block, the second a property of a test run — neither is a name in a class body |

Two of these are the same defect wearing different clothes and are worth naming once. **The rule holds
declaration and never value or body**, which is why every semantic code in the law is open. And **the
superclass is compared as a local spelling in one file**, which makes the rule both over-fire on a
legitimate intermediate base and stay silent for a same-file shim. Neither is sabotage. Both are what
ordinary refactoring looks like.

## Inputs

| Input | Evidence required |
|---|---|
| filename | The path as the linter reports it, normalised to forward slashes; the sole gate on whether the rule exists |
| scope decision | Which filename test matched, or that none did, or that the exclusion fired |
| superclass identifier | The name as spelled at `extends`, not as imported and not as resolved |
| class members | The `key` of every member node — kind, modifiers and static-ness are not evidence here |
| member names | The four literal strings `groupId`, `topics`, `deriveTargets`, `recomputeTarget`, plus `onModuleInit` |

Values, bodies, types, imports, other files and the module graph are **not** inputs. Stating that as an
input list rather than a footnote is the point of this record.

## Rules

1. A rule's identity is its published name. No numeric code is minted for a rule.
2. A rule reports only what its mechanism can see, and this module states that boundary rather than the
   law's ambition.
3. No rule reads the filesystem, resolves an import, or consults a second file. An answer that depends
   on the working tree cannot be reproduced.
4. The three checks inside the rule are independent: one report never suppresses another.
5. A rule ships at `error` only at a measured count of zero; above zero it ships at `warn` with the
   count beside it, or `off` when it needs configuration to work at all.
6. An unenforced code is recorded as unenforced. It is never assigned to the nearest rule.
7. A false report is recorded as a finding, not tolerated as a rounding error: the response to a false
   report is a disable comment, and a disable comment costs every other check in the same file.

## Exceptions

Each exemption below is deliberate and closed.

- **The shared base is exempt from its own rule.** The one file that legitimately declares
  `onModuleInit` and legitimately extends nothing is excluded by path. The exclusion is an exact
  `endsWith("/abstract-projection.listener.ts")`, which means it depends on the file keeping both its
  name and a directory ahead of it. It releases `base` and `lifecycle` for that one path, nothing else.
- **A file that is not a listener is not checked.** The gate is the filename, so mapping helpers, types
  and services near a listener are outside the rule entirely — including when they hold the logic the
  law is really about. It releases the whole rule for those files.
- **Nothing about a member's kind is exempt or required.** The rule deliberately accepts a field where
  the base declares a property and a method where the base declares a method, because the base's four
  abstract members are implemented both ways in practice and a kind check would report correct code. It
  releases the kind of a member, never its name.

## Output

One block per finding:

```text
rule: projection-listener-contract
code: <CDC-1 | CDC-2 | CDC-3 | none>
message: <base | member | lifecycle>
mechanism: <filename gate, superclass identifier or member name>
verdict: <reports | silent>
hatch: <the way of writing that would make this silent, or "none found">
```

A clean file in scope emits one block with `verdict: silent` and `message: none`, plus the `hatch` line
that names what the silence does not prove. A file out of scope emits one block with
`mechanism: filename gate`, `verdict: silent` and a `hatch` line saying the rule did not exist for that
file — out of scope is unjudged, not clean.
