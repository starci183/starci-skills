# Module-layering

## LOADS

None.

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, on which specifier, which law code
that maps to, and the open hatch that would have hidden the same failure. This module chooses no
layout. It refuses one, and it must be able to point at the specifier it refuses on.

## Law

The law is about the **seams between capabilities**: what an import may name, and what a capability
may say about itself. An import names the file that declares the symbol, never a folder that
re-exports one; and inside a capability, imports are relative rather than routed through the
capability's own public alias.

The published module now exposes **five exact rules**. Alongside the two import rules, it refuses index
barrels, capability-owned `@Global()`, and relative imports that escape their capability. All five ask
for `error`; graph-level sibling-capability judgement remains outside a single-file rule.

One of the three is unenforced **on purpose and says so in the source**: deciding whether an imported
module is a sibling capability or a nested child needs the module graph, and a rule reading one file
at a time cannot see it. That is the honest shape of this boundary — both rules are pure string work
over one specifier, which is exactly why they can be `error` with no false-positive budget, and
exactly why everything requiring a second file is out of reach.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `must-deep-module-import` | `LAYERING-1` | `barrel` on an aliased specifier with no segment after the capability name — `@modules/<name>`, `@features/<name>`, `@tests/<name>`, the bare prefix alone, and `@modules/<meta root>/<name>` where the meta root is one of three listed category folders |
| `no-self-module-alias` | `LAYERING-2` | `self` on a specifier that reaches the importing file's **own** capability through that capability's public alias, where "own" is derived from the file's path |
| `no-self-global-module` | `LAYERING-4` / Law 6 | A capability module declares itself `@Global()` instead of leaving application-wide wiring to the composition root. |
| `no-folder-reexport` | `LAYERING-5` / Law 7 | A source specifier names a bare directory, or an `index.*` file contains only re-export statements. |
| `no-relative-capability-escape` | Law 8 | A relative specifier walks out of the current capability rather than crossing through its public alias. |

`LAYERING-3` (distinguishing a sibling capability from a nested child in the module graph) remains
unenforced. The new rules hold exact per-file slices of the other boundaries and do not claim to prove
application graph correctness.

`LAYERING-5` now has both visible sides covered: `must-deep-module-import` refuses a bare aliased import,
while `no-folder-reexport` refuses bare-directory exports and pure index barrels.

## Reading a diff

1. **Decide scope before anything else, and record it.** For `no-self-module-alias`, a file whose
   path contains none of `/src/modules/`, `/src/features/`, `/src/tests/` gets an **empty visitor** —
   out of scope does not mean the file passed, it means the rule did not exist for that file.
   `must-deep-module-import` never reads `context.filename` and is in scope everywhere.
2. **Check the exemptions.** A local `export { X }` with no `source` is skipped. A specifier that is
   not a `string` — a template literal, a computed source — is skipped. A file at the composition
   root, outside every capability tree, is released from `no-self-module-alias` entirely.
3. **Read the nodes.** Only three static specifier positions exist for either rule:
   `ImportDeclaration`, `ExportNamedDeclaration` with a source, `ExportAllDeclaration`. Every dynamic
   form is outside their reach by construction, so read the form before reading the string.
4. **Emit one block per finding.** One specifier can carry two findings: a self-aliased barrel is
   reported by both rules, independently.
5. **Write the hatch line whenever an open hatch would have hidden the same failure.** A `silent`
   verdict is a real result and must be reported. "The gate is green" and "the rule looked" are
   different claims, and only one of them is evidence.
6. **Do not report what no rule watches.** Three of the five codes have no machine; a verdict that
   claims otherwise is wrong about the module.

## `must-deep-module-import` — LAYERING-1

**What it reports.** `barrel` — a specifier that names **a capability and no file**. `@modules/ai`
instead of `@modules/ai/ai-invoke.service`. One report per offending specifier.

**How it detects.** Visits `ImportDeclaration`, plus `ExportNamedDeclaration` and
`ExportAllDeclaration` when `node.source` exists. Reads `node.source.value` and returns unless
`typeof` is `string`. Finds the first entry of a 3-entry `ALIASES` array whose `prefix` the specifier
`startsWith`: `@modules/`, `@features/`, `@tests/`. Slices the prefix off, reports immediately when
the remainder is empty, otherwise splits the remainder on `/` and compares `parts.length` against a
`barrelDepth` of `1` — or `2` when the alias is `metaAware` (only `@modules/`) **and** `parts[0]` is
in a 3-entry `META_ROOTS` `Set`: `platform`, `lib`, `integrations`. `parts.length <= barrelDepth`
reports. It never reads `context.filename`.

**What it cannot see.** It counts **segments**, never what the last segment resolves to.
`@modules/ai/index` is two segments and passes — naming the barrel explicitly is the cleanest way
past the rule that exists to forbid barrels. `@modules/ai/services` where `services/` has an
`index.ts` is the same hatch and the ordinary one: a nested folder barrel is indistinguishable from a
file to a rule that never resolves anything. `@modules/ai/` splits into `["ai", ""]` — two segments,
and the empty tail is never checked. `@modules//ai` and `@modules/./ai` are the same arithmetic. A
relative specifier has no alias prefix, so a cross-capability barrel reached relatively is invisible.
`ALIASES` and `META_ROOTS` are three hand-written names each: a fourth path alias or a fourth
category folder is unenforced from the moment it is added, silently, with no signal anywhere. And
meta awareness belongs to `@modules/` alone, so under `@features/` and `@tests/` a category folder is
treated as a capability and its barrels pass.

**Boundary.** This rule judges one specifier's shape. Whether the specifier points back at the
importing file's own capability is `LAYERING-2`. Whether the barrel may be *written* at all is held
by nothing.

## `no-self-module-alias` — LAYERING-2

**What it reports.** `self` — a file inside capability `ai` reaching for `@modules/ai/...`. A
capability talking to itself through its own front door. One report per offending specifier.

**How it detects.** Reads `context.filename || context.getFilename()` once at `create` time and
normalizes `\` to `/`. Walks the same `ALIASES` array in order, taking `lastIndexOf` of each `root` —
`/src/modules/`, `/src/features/`, `/src/tests/` — and the first root found wins. Splits the path
tail on `/` to derive the self keys: `[parts[0]]` normally, or `["<meta>/<name>", "<name>"]` when the
alias is `metaAware`, `parts[0]` is a meta root and there are at least two segments. Returns an
**empty visitor** when no root matches. Otherwise visits the same three node types, requires the
specifier to `startsWith` that one alias prefix, and reports when the remainder `=== key` or
`startsWith(key + "/")` for any key.

**What it cannot see.** `@modules//ai/x` and `@modules/./ai/x` leave a remainder of `"/ai/x"` and
`"./ai/x"`, matching neither `key` nor `key + "/"`. Reaching **into** another capability relatively —
`../../billing/billing.service` from inside `modules/ai/` — is a boundary crossing with no alias to
report, and the rule inspects only alias-prefixed specifiers. A capability tree at
`apps/api/modules/`, `module/`, or any path without the exact `/src/modules/` segment pair finds
no root and is not checked at all; path shape is the cheapest thing in a repository to change, and
here it is load-bearing. A file written directly at `modules/platform/config.ts` derives self
keys `["platform/config.ts", "config.ts"]` — the file's own name where a capability name belongs —
and since no specifier carries a `.ts` extension the rule is effectively off for that file while
appearing to be on. The short self key under a meta root is unqualified, so from inside
`modules/platform/exceptions/` an import of a real, separate `@modules/exceptions/...` is reported as
a self alias: the rule fires on correct code, and the habit it teaches is to scroll past it. And a
self-import laundered through a third file that re-exports it is two correct-looking imports no
single-file rule can see.

**Boundary.** This rule derives a capability from a **path**, so its correctness is exactly as good
as the folder layout it was written against. Whether the specifier names a barrel is `LAYERING-1`.

## Detection

| Part | Mechanism |
|---|---|
| node set | Both rules see only `ImportDeclaration`, `ExportNamedDeclaration` with a source, and `ExportAllDeclaration`. `ExportNamedDeclaration` is guarded by `if (node.source)` |
| specifier read | `node.source.value`, and only when `typeof` is `string` |
| path gate | `must-deep-module-import` has none — it never reads `context.filename`. `no-self-module-alias` reads it once at `create`, normalizes `\` to `/`, and takes `lastIndexOf` of `/src/modules/`, `/src/features/`, `/src/tests/`; the first root found wins |
| alias table | `ALIASES`, three hard-coded `{ prefix, root, metaAware }` entries scanned in declaration order: `@modules/`, `@features/`, `@tests/`. Only `@modules/` is `metaAware` |
| meta roots | `META_ROOTS`, a closed 3-entry `Set`: `platform`, `lib`, `integrations` |
| depth arithmetic | Remainder empty reports at once; otherwise split on `/` and compare `parts.length` with a `barrelDepth` of `1`, or `2` under a `metaAware` alias whose `parts[0]` is a meta root |
| self match | Remainder `=== key` or `startsWith(key + "/")`, so a capability whose name merely begins with another's is not swept in |
| out of scope | `no-self-module-alias` returns an empty visitor object. The rule does not exist for that file rather than passing it |

Both are single-file and string-only. Neither resolves an import, touches the filesystem, reads a
type, or knows whether the last segment of a specifier is a file, a folder, or nothing at all.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
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

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `must-deep-module-import` | `import { X } from "@modules/ai/index"` — the rule counts **segments**, not files. Two segments beat a `barrelDepth` of `1`, so naming the barrel explicitly is the cleanest way past the rule that exists to forbid barrels |
| `must-deep-module-import` | `import { X } from "@modules/ai/services"` where `services/` has an `index.ts` — same counting hatch, and the ordinary one. A nested folder barrel is indistinguishable from a file to a rule that never resolves anything; the law says *name the declaring file*, the rule enforces *at least one segment after the capability* |
| `must-deep-module-import` | `import { X } from "@modules/ai/"` — the trailing slash splits into `["ai", ""]`, two segments. The empty tail is never checked, and the resolver collapses it back to the folder |
| both | `import { X } from "@modules//ai"` and `from "@modules/./ai"` — the extra segment is `""` or `"."`, both count. The identical trick defeats `no-self-module-alias`, where `"/ai/x"` and `"./ai/x"` match neither `key` nor `key + "/"` |
| both | `const { X } = await import("@modules/ai")` — an `ImportExpression` is not an `ImportDeclaration`. No visitor exists for it in either rule |
| both | `const { X } = require("@modules/ai")`, and `import X = require("@modules/ai")` — a `CallExpression` and a `TSImportEqualsDeclaration`. Neither is visited, and the second is the one a config file is most likely to use |
| `must-deep-module-import` | `import { X } from "../../ai"` — every check begins with `startsWith` against an alias prefix. A relative path never has one, so a cross-capability barrel reached relatively is invisible |
| both | `import { X } from "../../billing/billing.service"` from inside `modules/ai/` — the inverse abuse of the same hole: reaching **into** another capability relatively is a boundary crossing with no alias to report. `no-self-module-alias` inspects only alias-prefixed specifiers, so the rule pair is silent on the one form that hides the seam completely |
| both | `import { X } from "@shared/utils"`, `"@app/..."`, `"src/modules/ai"` — `ALIASES` is three hand-written prefixes. A fourth path alias added to the compiler config is unenforced from the moment it is added, silently, with no signal anywhere |
| `must-deep-module-import` | `import { X } from "@modules/adapters/mailer"` — `META_ROOTS` is three hand-written names. A fourth category folder makes its capabilities read as capability-plus-file, so every barrel under it passes |
| both | `import { X } from "@features/platform/billing"` — meta awareness belongs to `@modules/` alone. Under the other two aliases a category folder is treated as a capability, so its barrels pass and, in `no-self-module-alias`, its siblings are misread as self |
| `no-self-module-alias` | A capability tree at `apps/api/modules/`, `module/`, or any path without the exact `/src/modules/` segment pair — no root is found, `{}` is returned, and the file is not partially checked, it is not checked at all. Path shape is the cheapest thing in a repository to change, and here it is load-bearing |
| `no-self-module-alias` | A file written directly at `modules/platform/config.ts` — the self keys become `["platform/config.ts", "config.ts"]`, the file's own name where a capability name belongs. No specifier carries a `.ts` extension, so the rule is effectively off for that file while appearing to be on |
| `no-self-module-alias` | A genuine top-level capability named the same as one under a meta root — the short self key is unqualified. From inside `modules/platform/exceptions/`, an import of a real, separate `@modules/exceptions/...` is reported as a self alias. An inverted hatch: the rule fires on correct code, and the habit it teaches is to scroll past it |
| both | A self-import laundered through a third file that re-exports it — both rules read one specifier in one file. A capability that reaches itself through a neighbour's re-export is two correct-looking imports, and no single-file rule can see the loop |
| both | `// eslint-disable-next-line` above either rule — neither rule is unsuppressible. Every hatch above is also reachable in one line by somebody in a hurry |
| neither | **Everything `LAYERING-3`, `LAYERING-4` and `LAYERING-5` forbid** — a capability module importing a sibling's module instead of wiring it at the composition root, a composition root that is no longer the only place that knows the whole, and an `index.ts` written to re-export a folder |

Every open hatch above is a hatch in the *rule*, never a permission in the *law*. Code that slips
through is still wrong.

## Inputs

| Input | Evidence required |
|---|---|
| `node.source.value` | The specifier as a `string`. A template literal or a computed source is skipped, and the verdict must say so rather than call it clean |
| `context.filename` | `no-self-module-alias` only. The path with `\` normalized to `/`, and which of the three roots `lastIndexOf` found — or that none did |
| `ALIASES` | Which of the three `{ prefix, root, metaAware }` entries matched, in declaration order, or `none matched` |
| `META_ROOTS` | Whether `parts[0]` was in the closed 3-entry `Set`, because it decides the `barrelDepth` and the self keys |

Nothing else is read. Both rules declare `schema: []` and therefore take no options; there is no
configuration by which a repository can add an alias, add a meta root, or move a root.

## Rules

1. A rule's identity is its **published name**. There is no numeric identifier for a rule; the name is
   what a build prints, what a disable comment carries, and what any conversation about a failure
   uses.
2. Each rule maps to exactly one code in the law, and no code is held by two rules.
3. Both rules are `meta.type: "problem"` and both are `error` in `recommended`.
4. Both see only the three static specifier positions: `ImportDeclaration`, `ExportNamedDeclaration`
   with a source, `ExportAllDeclaration`. Every dynamic form is outside their reach by construction.
5. `must-deep-module-import` decides on **segment count**, never on what the last segment resolves to.
   Every sentence about "files" in its message is the **law** speaking, not something it measures.
6. `no-self-module-alias` derives a capability from a **path**, so its correctness is exactly as good
   as the folder layout it was written against.
7. A missing root returns an **empty visitor**, so an out-of-tree file is not half-checked.
8. Every open hatch is a hatch in the *rule*, never a permission in the *law*. Code that slips through
   is still wrong.

## Exceptions

These are exemptions **already present in the source**, not room to manoeuvre.

- **Meta roots.** `platform`, `lib`, `integrations` count as containers of capabilities rather than
  capabilities. This releases `@modules/platform/exceptions` from passing as capability-plus-file —
  it is correctly a barrel — and it releases a file inside such a folder into two self keys, long and
  short. It is the most expensive exception here: the list is closed, and every open hatch it owns
  comes from that list missing or holding one name.
- **A file outside every capability tree.** The composition root and any file belonging to no
  capability is released from `no-self-module-alias` completely. This is correct rather than lax: a
  file that belongs to no capability cannot import its own.
- **`export { X }` with no source.** Only a re-export that **has** a `source` is checked; a local
  `export { X }` is not an import and is released from both rules.
- **`LAYERING-3` is unenforced on purpose.** The source says so directly: separating a sibling
  capability from a nested child needs the module graph. A repository that wants it must write a
  tree-walking gate, not a per-file rule that guesses.
- **`error` is the recommendation, but only after measuring.** The source records both rules measured
  at zero debt in the reference repository. A repository applying them to an existing tree will not
  be at zero, because a barrel is the default of most code. Measure first, drop to `warn` with the
  number attached, then burn it down.

Beyond these, neither rule declares an option, an allowlist or a per-file opt-out. The only other
exit is a disable comment, and this module grants none; that comment is recorded above as an open
hatch, not as an exception.

## Output

One block per finding:

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

A clean file emits one block with `message: none` and `verdict: silent: no hatch — every static
specifier was read and none matched`. A file out of scope for `no-self-module-alias` emits
`self keys: none: file is outside every root` and `verdict: silent: no visitor installed`, which is
not a pass.
