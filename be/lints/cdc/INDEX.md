---
id: be-lints-cdc-index
title: INDEX.md
slug: /be/lints/cdc
sidebar_label: cdc
sidebar_position: 0
description: What the single published CDC lint rule can actually see, and the ways of writing it does not catch.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `cdc`

## Law

The law lives in [`patterns/cdc.md`](../../canon/patterns/cdc.md) and carries seven codes, `CDC-1`
through `CDC-7`. This module documents something narrower and more useful: **which of those codes a
machine holds, by what mechanism, and where the mechanism ends.**

One rule ships. It reads a filename, then reads the names of the members a class declares. That is
the whole of it. Names are the only thing about a change-data-capture listener that a single-file
parser can see with certainty: whether a class *extends* the shared base, whether it *declares* a
consumer group, a topic list, a mapping method and a recompute method, and whether it *declares* a
lifecycle hook it must not own.

Everything the law actually cares about downstream of those names — whether the consumer group is
stable across restarts, whether the topic list is complete, whether recompute rebuilds from source
rows or adds a delta, whether a tombstone is skipped, whether one bad message stops the loop, whether
delivery was ever proved against a real broker — is a **value or a body**, not a name. The rule reads
neither.

So the honest statement of enforcement is: **the shape of a listener is held, and the semantics of a
projection are not.** A listener with a correct shape and a per-process consumer group passes this
gate cleanly and replays history on every boot. That is not a defect in the rule; it is the boundary
of what a name can prove, and it is written down here so nobody mistakes a green build for a correct
projection.

## Rules

The identity of a rule is its published name — the string a build log prints, a disable comment
names, and a config file sets a severity on. There is no second numeric identifier.

| Rule | Code it enforces | What it reports |
|---|---|---|
| `projection-listener-contract` | `CDC-1`, `CDC-2`, `CDC-3` | A class in a listener file does not extend `AbstractProjectionListener` (`base`); it does not declare one of `groupId`, `topics`, `deriveTargets`, `recomputeTarget` (`member`, once per missing name); it declares `onModuleInit` (`lifecycle`) |

The source publishes **exactly one** rule, which is the count this record expected. One rule carrying
three codes is worth stating plainly rather than smoothing over: the three checks inside it are
independent, they fire independently, and a reader who sees `projection-listener-contract` in a build
log has to read the message to know which code was broken.

`CDC-4`, `CDC-5`, `CDC-6` and `CDC-7` have **no rule**, and no rule here claims them. That is recorded
in `audit.md` rather than patched over with an invented mapping.

The severity the module asks for, as shipped in the plugin's own recommendation:

| Rule | Recommended severity | Why |
|---|---|---|
| `projection-listener-contract` | `error` | Every check is a name comparison inside one file, needing no configuration to work |

The source ships that severity and carries **no measurement note beside it** — unlike other modules on
this shelf, there is no recorded count of offenders that the `error` level was bought with. That is
recorded as a finding in `audit.md` rather than restated here as if it were evidence.

## Detection

Read this table before the next one. What a rule can be dodged by follows directly from what it looks
at.

| Rule | Mechanism |
|---|---|
| `projection-listener-contract` | **Filename gate first.** `context.filename \|\| context.getFilename()`, coerced with `String(… \|\| "")`, backslashes replaced by `/`, then tested against `/projection\.listener\.ts$/` — unanchored on the left, so `a-projection.listener.ts`, `a.projection.listener.ts` and `aprojection.listener.ts` all match. One exclusion: the normalised path `.endsWith("/abstract-projection.listener.ts")`. No match means the rule returns `{}` and does not exist for that file. **Then `ClassDeclaration` only** — never `ClassExpression`, and every class declaration in the file, not just the exported one. Three checks run in order with **no early return between them**: (a) `!node.superClass \|\| node.superClass.name !== "AbstractProjectionListener"` reports `base` at `node.id \|\| node`; (b) `node.body.body` is mapped through `member.key && (member.key.name \|\| member.key.value)` into a `Set`, and each of `groupId`, `topics`, `deriveTargets`, `recomputeTarget` absent from that set reports `member` at the class id; (c) the first member whose mapped name is `onModuleInit` reports `lifecycle` at `member.key`. |

Two properties of that mechanism decide everything below.

**It reads member names, not member kinds.** The mapping helper takes any node with a `key`, so a
method, a class field, a getter, a static member and an abstract declaration are all the same evidence.
This is the opposite trade from a method-only scan: nothing hides in a class field here.

**It reads names and nothing else.** No value, no body, no type, no import, no second file, no module
graph, no filesystem. A rule whose answer depends on the working tree cannot be reproduced in review;
a rule whose answer depends only on the file in front of it can be — and pays for that with every row
in the Open table.

## Escape Hatches

### Closed

Ways of writing that a reader might expect to slip past, and why they do not.

| Rule | The dodge that fails | Why it fails |
|---|---|---|
| `projection-listener-contract` | A backslash path on a Windows checkout | The filename is normalised to forward slashes before both the match and the exclusion, so the gate behaves identically on every platform |
| `projection-listener-contract` | Renaming the file from `a.projection.listener.ts` to `a-projection.listener.ts`, or the reverse | The gate regex is unanchored on the left; it asks only that the path end in `projection.listener.ts`, so the separator before it is irrelevant |
| `projection-listener-contract` | Declaring `groupId` as a class field instead of a getter, or the reverse | The member scan reads `key.name` off **any** member node. `PropertyDefinition`, `MethodDefinition`, a getter, a setter and an abstract declaration are indistinguishable to it |
| `projection-listener-contract` | `onModuleInit = async () => { … }` as an arrow field rather than a method | Same scan, same result. A class field is invisible to a method-only rule; it is not invisible to this one |
| `projection-listener-contract` | A string key: `"groupId" = "orders"` or `["topics"] = []` | The mapping helper falls back to `key.value` when there is no `key.name`, so a string literal key — computed or not — resolves to the same name |
| `projection-listener-contract` | `private`, `protected`, `override`, `async`, `readonly` on any member | No modifier is consulted anywhere in the rule |
| `projection-listener-contract` | Hiding the listener behind other classes in the same file | Every `ClassDeclaration` in a matching file is visited; there is no "first class" or "exported class" heuristic |
| `projection-listener-contract` | `export default class extends AbstractProjectionListener { … }` with no name | An anonymous default export is still a `ClassDeclaration`; the report falls back from `node.id` to the class node |
| `projection-listener-contract` | Declaring all four members and hoping it excuses the missing base | The three checks are independent with no early return; a class can collect `base`, four `member` reports and `lifecycle` in one pass |
| `projection-listener-contract` | Extending the base and then adding `onModuleInit` "just to log something" | The lifecycle check does not care whether the base check passed. Owning the hook at all is the report |

### Open

Ways of writing this rule genuinely does **not** catch. Each row is a real violation of the law that
the machine reports nothing about.

| Rule | What slips through | Why the mechanism misses it |
|---|---|---|
| `projection-listener-contract` | `protected readonly groupId = \`projection-${randomUUID()}\`` | The check is that the name `groupId` appears in the class body. The **value** is never read. `CDC-2` exists to forbid a per-process group that replays history on every boot, and that is precisely the spelling the rule cannot see |
| `projection-listener-contract` | `protected readonly topics = []`, or a topic list built from a variable that resolves to nothing | Same gap on the other half of `CDC-2`. A projection that follows no topic is silently stale forever, and declares the name the rule asks for |
| `projection-listener-contract` | A private consumer started from `onApplicationBootstrap`, `onModuleDestroy`, a scheduled method, an event-subscriber method, or the constructor | The lifecycle check is a single literal name, `onModuleInit`. Every other hook a framework offers is an open door to the exact fork of subscription and failure semantics `CDC-1` forbids |
| `projection-listener-contract` | `recomputeTarget` that adds the delta carried by the event instead of rebuilding from source rows | The body is never visited. This is `CDC-4` — duplicate delivery double-counts, a missed event never heals — and the rule sees a correctly named method |
| `projection-listener-contract` | `deriveTargets` that dispatches a business command, sends a notification or writes a row | Same gap. `CDC-3` says the listener returns identities and nothing else; the rule confirms only that something called `deriveTargets` exists |
| `projection-listener-contract` | `export const OrderTotalsListener = class extends AbstractProjectionListener { … }` | The visitor key is `ClassDeclaration`. A `ClassExpression` — assigned to a const, returned from a factory, passed to a decorator helper — is never visited, so the rule does not exist for it |
| `projection-listener-contract` | `order-totals.listener.ts`, `order-totals-projection.listener.tsx`, `.mts`, a listener class declared in `index.ts`, or a listener living inside a `*.service.ts` | The filename gate **is** the rule's existence. Nobody renames a file to dodge a lint; they rename it because it reads better beside its siblings |
| `projection-listener-contract` | `import { AbstractProjectionListener as Base }` then `extends Base` — and, in the other direction, a local class expression named `AbstractProjectionListener` that the listener extends | The comparison is `node.superClass.name`, the identifier **as spelled at the class**. No import is resolved. Renaming on import produces a false report; a same-file shim with the right name produces silence |
| `projection-listener-contract` | An intermediate abstract listener: `class OrderTotalsListener extends AbstractOrderProjectionListener`, where that class extends the shared base | The rule is single-file and compares one identifier. A legitimate two-level family reports `base` on every leaf, and the cheapest response — a file-level disable comment — switches off the member and lifecycle checks in the same file |
| `projection-listener-contract` | `constructor(protected readonly groupId: string, protected readonly topics: Array<string>) { … }` | Parameter properties are not class-body members. They declare the member for the compiler; the scan walks `node.body.body` and reports both names as missing. The false report teaches the author to disable the rule, which is how a true report is lost later |
| `projection-listener-contract` | `static groupId = "orders"`, `static topics = []` | A static member satisfies the name scan and satisfies nothing at runtime — the instance contract is still unimplemented. The rule accepts it because it never asks what kind of member it found |
| `projection-listener-contract` | A perfectly shaped listener that is never listed in any module's providers | The rule reads a file, not a wiring graph. A listener nothing constructs consumes nothing, projects nothing, and reports nothing. Green build, dead projection |
| `projection-listener-contract` | A tombstone handled by inventing an empty current row, in any listener whose base is bypassed | `CDC-5` has no rule. The shared base skips a payload with no after-image; a listener that escaped the base check through any row above takes that behaviour with it |
| `projection-listener-contract` | A parse or recompute failure that stops the consumer, and any projection whose delivery was never exercised through a broker | `CDC-6` and `CDC-7` have no rule at all. The first is a behaviour of a `catch` block, the second a property of a test run — neither is a name in a class body |

Two of these are the same defect wearing different clothes and are worth naming once. **The rule holds
declaration and never value or body**, which is why every semantic code in the law is open. And
**the superclass is compared as a local spelling in one file**, which makes the rule both over-fire on
a legitimate intermediate base and stay silent for a same-file shim. Neither is sabotage. Both are what
ordinary refactoring looks like.

## Inputs

| Input | Evidence required |
|---|---|
| filename | The path as the linter reports it, normalised to forward slashes; the sole gate on whether the rule exists |
| superclass identifier | The name as spelled at `extends`, not as imported and not as resolved |
| class members | The `key` of every member node — kind, modifiers and static-ness are not evidence here |
| member names | The four literal strings `groupId`, `topics`, `deriveTargets`, `recomputeTarget`, plus `onModuleInit` |

Values, bodies, types, imports, other files and the module graph are **not** inputs. Stating that as
an input list rather than a footnote is the point of this record.

## Invariants

- A rule's identity is its published name. No numeric code is minted for a rule.
- A rule reports only what its mechanism can see, and this shelf states that boundary rather than the
  law's ambition.
- No rule reads the filesystem, resolves an import, or consults a second file. An answer that depends
  on the working tree cannot be reproduced.
- The three checks inside the rule are independent: one report never suppresses another.
- A rule ships at `error` only at a measured count of zero; above zero it ships at `warn` with the
  count beside it, or `off` when it needs configuration to work at all.
- An unenforced code is recorded as unenforced. It is never assigned to the nearest rule.
- A false report is recorded as a finding, not tolerated as a rounding error: the response to a false
  report is a disable comment, and a disable comment costs every other check in the same file.

## Exceptions

Each exemption below is deliberate and closed.

- **The shared base is exempt from its own rule.** The one file that legitimately declares
  `onModuleInit` and legitimately extends nothing is excluded by path. The exclusion is an exact
  `endsWith("/abstract-projection.listener.ts")`, which means it depends on the file keeping both its
  name and a directory ahead of it.
- **A file that is not a listener is not checked.** The gate is the filename, so mapping helpers,
  types and services near a listener are outside the rule entirely — including when they hold the
  logic the law is really about.
- **Nothing about a member's kind is exempt or required.** The rule deliberately accepts a field where
  the base declares a property and a method where the base declares a method, because the base's four
  abstract members are implemented both ways in practice and a kind check would report correct code.

## Output

```text
rule: projection-listener-contract
code: <CDC-1 | CDC-2 | CDC-3 | none>
message: <base | member | lifecycle>
mechanism: <filename gate, superclass identifier or member name>
verdict: <reports | silent>
hatch: <the way of writing that would make this silent, or "none found">
```

## Load Policy

Read this file first. Read `vi.md` for what the rule catches and why the law deserves a machine,
`example.md` for code that fires and code that does not — including code that slips through — and
`audit.md` only while reviewing enforcement coverage.

## Scope

This module documents enforcement, not product. Every example is ordinary code in an ordinary folder,
and no prose here names a product, a repository or a component library. The rule name and the plugin
namespace it ships under are identifiers that appear in build output, so they are reproduced verbatim;
that is the one exemption, and it does not extend to prose.

## Version Rule

Increment all five records by `0.01` for an accepted change to what is documented here, and record it
in `changelog.md`. A rule added to or removed from the source is such a change, and so is closing one
row of the Open table.
