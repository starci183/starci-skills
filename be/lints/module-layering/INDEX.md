---
id: be-lints-module-layering-index
title: INDEX.md
slug: /be/lints/module-layering
sidebar_label: module-layering
sidebar_position: 0
description: What the two module-layering rules actually see in an import specifier, and what walks past them untouched.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `module-layering`

## Law

The law this module enforces is about the **seams between capabilities**: what an import may name,
and what a capability may say about itself. An import names the file that declares the symbol, never
a folder that re-exports one; and inside a capability, imports are relative rather than routed
through the capability's own public alias.

This shelf does not restate that law. It records **enforcement**: which of those sentences a machine
holds, by what mechanism, and — the part nobody writes down — which ways of writing walk past the
machine untouched.

Two rules exist. The source publishes exactly two in its `rules` export and exactly two in its
`recommended` export, and the two lists agree; both ask for `error`. The law itself states **five**
codes, so three of them are held by nothing.

One of those three is unenforced **on purpose and says so in the source**: deciding whether an
imported module is a sibling capability or a nested child needs the module graph, and a rule reading
one file at a time cannot see it. That is the honest shape of the boundary this shelf documents —
both rules here are pure string work over one specifier, which is exactly why they can be `error`
with no false-positive budget, and exactly why everything requiring a second file is out of reach.

## Rules

| Rule | Code | What it reports |
|---|---|---|
| `must-deep-module-import` | `LAYERING-1` | `barrel` on an aliased specifier with no segment after the capability name — `@modules/<name>`, `@features/<name>`, `@tests/<name>`, the bare prefix alone, and `@modules/<meta root>/<name>` where the meta root is one of three listed category folders |
| `no-self-module-alias` | `LAYERING-2` | `self` on a specifier that reaches the importing file's **own** capability through that capability's public alias, where "own" is derived from the file's path |

`LAYERING-3` (a capability module importing a sibling capability's module rather than wiring it at
the composition root), `LAYERING-4` (the composition root is the only place that knows the whole) and
`LAYERING-5` (a capability's public surface is the files it means to be imported) are enforced by
**no rule**.

`LAYERING-5` deserves the sharpest note, because it looks held and is not. `must-deep-module-import`
polices the **calling** half — nobody may *import* a barrel through an alias. Nothing polices the
**declaring** half: writing an `index.ts` that re-exports a folder is unreported, and once it exists
every relative and unaliased path to it is legal. The rules make barrels inconvenient to reach; they
do not make them impossible to write. All three gaps are carried in `audit.md`.

## Detection

| Rule | Mechanism |
|---|---|
| `must-deep-module-import` | Visits `ImportDeclaration`, plus `ExportNamedDeclaration` and `ExportAllDeclaration` when `node.source` exists. Reads `node.source.value` and returns unless `typeof` is `string`. Finds the first entry of a 3-entry `ALIASES` array whose `prefix` the specifier `startsWith`: `@modules/`, `@features/`, `@tests/`. Slices the prefix off, reports immediately when the remainder is empty, otherwise splits the remainder on `/` and compares `parts.length` against a `barrelDepth` of `1` — or `2` when the alias is `metaAware` (only `@modules/`) **and** `parts[0]` is in a 3-entry `META_ROOTS` `Set`: `platform`, `lib`, `integrations`. `parts.length <= barrelDepth` reports. It never reads `context.filename` |
| `no-self-module-alias` | Reads `context.filename \|\| context.getFilename()` once at `create` time and normalizes `\` to `/`. Walks the same `ALIASES` array in order, taking `lastIndexOf` of each `root` — `/src/modules/`, `/src/features/`, `/src/tests/` — and the first root found wins. Splits the path tail on `/` to derive the self keys: `[parts[0]]` normally, or `["<meta>/<name>", "<name>"]` when the alias is `metaAware`, `parts[0]` is a meta root and there are at least two segments. Returns an **empty visitor** when no root matches. Otherwise visits the same three node types, requires the specifier to `startsWith` that one alias prefix, and reports when the remainder `=== key` or `startsWith(key + "/")` for any key |

Both are single-file and string-only. Neither resolves an import, touches the filesystem, reads a
type, or knows whether the last segment of a specifier is a file, a folder, or nothing at all.

## Escape Hatches

### Closed

| Way of writing | Why it does not slip |
|---|---|
| `import type { Ctx } from "@modules/ai"` | A type-only import is still an `ImportDeclaration`; `importKind` is never consulted, so the type lane is not a side door |
| `export * from "@modules/ai"` and `export { X } from "@modules/ai"` | Both re-export forms are visited, and the second is guarded by `if (node.source)` so a local `export { X }` with no source is skipped rather than crashing |
| `import "@modules/telemetry"` for side effects only | The specifier is read from `node.source`, not from the binding list. An import with no specifiers reports exactly like one with ten |
| `import { X } from "@modules/"` | The empty remainder is reported before the split, so the degenerate spelling is not an accidental pass |
| `import { X } from "@modules/platform"` | A meta root on its own is one segment against a `barrelDepth` of `2`, so naming the category folder is a barrel, not a capability |
| `import { X } from "@modules/ai-billing/x"` from inside `modules/ai/` | The self test is `rest === key \|\| rest.startsWith(key + "/")`. The trailing slash makes the boundary real, so a capability whose name merely begins with another's is not swept in |
| Windows paths in `no-self-module-alias` | `\` is normalized to `/` before any `lastIndexOf`, so a backslash path derives the same capability as every other path |
| A file at the composition root, outside every capability tree | `selfAliases` returns `null` and the rule returns `{}`. This is correct rather than lax: a file that belongs to no capability cannot import its own |
| `import { AiService } from "@modules/ai"` from inside `modules/ai/` | Both rules report the same line — one for naming a barrel, one for the self alias. They are independent tests that happen to agree here |

### Open

| Way of writing | Why the rule does not catch it |
|---|---|
| `import { X } from "@modules/ai/index"` | `must-deep-module-import` counts **segments**, not files. Two segments beat a `barrelDepth` of `1`, so naming the barrel explicitly is the cleanest way past the rule that exists to forbid barrels |
| `import { X } from "@modules/ai/services"` where `services/` has an `index.ts` | Same counting hatch, and the ordinary one. A nested folder barrel is indistinguishable from a file to a rule that never resolves anything — the law says *name the declaring file*, the rule enforces *at least one segment after the capability* |
| `import { X } from "@modules/ai/"` | The trailing slash splits into `["ai", ""]` — two segments. The empty tail is never checked, and the resolver collapses it back to the folder |
| `import { X } from "@modules//ai"` and `from "@modules/./ai"` | Same arithmetic: the extra segment is `""` or `"."`, both count. The identical trick defeats `no-self-module-alias`, where `"/ai/x"` and `"./ai/x"` match neither `key` nor `key + "/"` |
| `const { X } = await import("@modules/ai")` | An `ImportExpression` is not an `ImportDeclaration`. No visitor exists for it in either rule |
| `const { X } = require("@modules/ai")`, and `import X = require("@modules/ai")` | A `CallExpression` and a `TSImportEqualsDeclaration`. Neither is visited, and the second is the one a config file is most likely to use |
| `import { X } from "../../ai"` | Every check begins with `startsWith` against an alias prefix. A relative path never has one, so a cross-capability barrel reached relatively is invisible to `must-deep-module-import` |
| `import { X } from "../../billing/billing.service"` from inside `modules/ai/` | The inverse abuse of the same hole: reaching **into** another capability relatively is a boundary crossing with no alias to report. `no-self-module-alias` inspects only alias-prefixed specifiers, so the rule pair is silent on the one form that hides the seam completely |
| `import { X } from "@shared/utils"`, `"@app/..."`, `"src/modules/ai"` | `ALIASES` is three hand-written prefixes. A fourth path alias added to the compiler config is unenforced from the moment it is added, silently, with no signal anywhere |
| `import { X } from "@modules/adapters/mailer"` | `META_ROOTS` is three hand-written names. A fourth category folder makes its capabilities read as capability-plus-file, so every barrel under it passes |
| `import { X } from "@features/platform/billing"` | Meta awareness belongs to `@modules/` alone. Under the other two aliases a category folder is treated as a capability, so its barrels pass and — in `no-self-module-alias` — its siblings are misread as self |
| A capability tree at `apps/api/modules/`, `src/module/`, or any path without the exact `/src/modules/` segment pair | `no-self-module-alias` finds no root, returns `{}`, and the file is not partially checked — it is not checked at all. Path shape is the cheapest thing in a repository to change, and here it is load-bearing |
| A file written directly at `src/modules/platform/config.ts` | The self keys become `["platform/config.ts", "config.ts"]` — the file's own name where a capability name belongs. No specifier carries a `.ts` extension, so the rule is effectively off for that file while appearing to be on |
| A genuine top-level capability named the same as one under a meta root | The short self key is unqualified. From inside `modules/platform/exceptions/`, an import of a real, separate `@modules/exceptions/...` is reported as a self alias. An inverted hatch: the rule fires on correct code, and the habit it teaches is to scroll past it |
| A self-import laundered through a third file that re-exports it | Both rules read one specifier in one file. A capability that reaches itself through a neighbour's re-export is two correct-looking imports, and no single-file rule can see the loop |
| `// eslint-disable-next-line` above either rule | Neither rule is unsuppressible. Every hatch above is also reachable in one line by somebody in a hurry |

## Inputs

| Input | What is read |
|---|---|
| `node.source.value` | The specifier, and only when it is a `string`. A template literal or a computed source is skipped |
| `context.filename` | `no-self-module-alias` only. Backslash-normalized, then searched with `lastIndexOf` for the three roots |
| `ALIASES` | Three hard-coded `{ prefix, root, metaAware }` entries, scanned in declaration order |
| `META_ROOTS` | A closed 3-entry `Set` of category folder names |

Nothing else is read. Both rules declare `schema: []` and therefore take no options; there is no
configuration by which a repository can add an alias, add a meta root, or move a root.

## Invariants

- A rule's identity is its **published name**. There is no numeric identifier for a rule; the name is
  what a build prints, what a disable comment carries, and what any conversation about a failure
  uses.
- Each rule maps to exactly one code in the law, and no code is held by two rules.
- Both rules are `meta.type: "problem"` and both are `error` in `recommended`.
- Both see only the three static specifier positions: `ImportDeclaration`, `ExportNamedDeclaration`
  with a source, `ExportAllDeclaration`. Every dynamic form is outside their reach by construction.
- `must-deep-module-import` decides on **segment count**, never on what the last segment resolves to.
- `no-self-module-alias` derives a capability from a **path**, so its correctness is exactly as good
  as the folder layout it was written against.
- A missing root returns an **empty visitor**, so an out-of-tree file is not half-checked.
- Every open hatch above is a hatch in the *rule*, never a permission in the *law*. Code that slips
  through is still wrong.

## Output

```text
rule:      <must-deep-module-import | no-self-module-alias>
code:      <LAYERING-1 | LAYERING-2>
file:      <path as the rule normalized it, or "not read" for LAYERING-1>
alias:     <@modules/ | @features/ | @tests/ | none matched>
self keys: <derived capability keys, or "none: file is outside every root">
segments:  <parts.length vs barrelDepth, for LAYERING-1>
message:   <barrel | self>
verdict:   <fires | silent: hatch <name from the Open table>>
```

A `silent` verdict is a real result and must be reported. "The gate is green" and "the rule looked"
are different claims, and only one of them is evidence.

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why it is worth a machine, read
`example.md` for the code that fires and the code that slips, and read `audit.md` only while
reviewing the enforcement itself.

## Scope

This module documents two rules of one back-end law. It names no product, no company and no
repository. Rule names, message identifiers, alias prefixes and folder names the rules match are
**identifiers that ship** and are reproduced verbatim; that exemption covers nothing else.

## Version Rule

Increment all five records by `0.01` for an accepted change to a rule or to what is claimed about it,
and record it in `changelog.md`. A new rule in the source, a removed rule, or a newly discovered open
hatch each require a version bump — a hatch found and not written down is the failure this shelf
exists to prevent.
