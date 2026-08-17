---
title: Comments
---

# Comments

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |


## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
which lane the file fell in, which published rule fired, on which AST node or raw line it fired, which
law code that maps to, and the open hatch that would have hidden the same failure. This module chooses
no comment and writes none. It refuses, and it must be able to point at the character it refuses on.

## Law

A comment answers the one question the code cannot: **why**. The law that states this lives in
`canon/patterns/comments.md` and carries five codes, `COMMENT-1` through `COMMENT-5`.

The law states five codes. **Three rules ship.** The gap is not an oversight to be tidied away — one of
the codes cannot be checked by any program, and one of the rules holds only half of the code it is
named for. Both facts are stated below rather than rounded off, because **a leaky rule believed to be
closed is more dangerous than a law known to be unenforced.** A law is a sentence a reader obeys; a rule
is a pattern a program matches. They are never the same size, and the difference is the entire subject
here.

## Published rules

Three rules are published, from the module's `rules` export, at `error` in its `recommended` export.
They ship in the package `@canon-be` under the plugin prefix `starci-be/`.

| Rule | Code | What it reports |
|---|---|---|
| `require-export-jsdoc` | `COMMENT-1` | An exported class, interface, type alias, enum, function declaration, or `const` bound to a literal function expression, with no `/** … */` block before it |
| `require-enum-member-jsdoc` | `COMMENT-2`, existence half only | A member of an exported enum with no `/** … */` block before it |
| `no-non-ascii-source` | `COMMENT-4`, with `COMMENT-5` as its marker | A source line carrying a Vietnamese letter, an emoji, or one of twelve listed ornamental symbols |

**`COMMENT-3` has no rule.** "The comment says why, and the code says what" is enforced by nobody. This
is not a missing rule to be written; it is a code no program can hold, because deciding whether a
sentence restates the line beneath it requires understanding both. It is unenforced, not covered, and
nobody may read a green build as evidence that `COMMENT-3` is satisfied.

**`COMMENT-5` is not a rule either; it is the escape hatch of `no-non-ascii-source`.** Text a program
matches on or emits stays, marked `vn-ok`. The marker is what makes the third rule survivable, and it is
also that rule's widest open door.

**`COMMENT-2` is enforced at half strength, and the rule says so in its own message.** The code demands
that a member state the CONSEQUENCE of choosing it. A rule can see that a doc block exists and never
that it says anything. `/** The pending state. */` — the exact text the law prints as its
counter-example — passes.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — for `no-non-ascii-source` a locale path installs an empty visitor, and the rule did not
   exist for that file.
2. **Place the file in a lane.** A path matching `/(?:messages|locales|i18n)/` is exempt from
   `no-non-ascii-source` entirely, comments included. A path matching `\.spec\.ts$`, `-spec\.ts$` or
   `/src/tests/` is the fixture lane, where only comment lines are policed. Everything else is ordinary
   source. The two JSDoc rules read no filename at all and have no lane.
3. **Check the exemptions on the line before the nodes.** A line matching `\bvn-ok\b` is skipped
   whole; the first occurrence of the string `Tiếng Việt` is stripped before the letter test.
4. **Read the nodes.** For the JSDoc rules that means `node.declaration`, the init of
   `declarations[0]`, the declaration kind, and whatever `sourceCode.getCommentsBefore` returns. For
   `no-non-ascii-source` it means no node at all — it walks `sourceCode.getLines()`.
5. **Emit one block per finding**, naming the mechanism that decided it.
6. **Write the `hatch` line** whenever an open hatch would have hidden the same failure.
7. **Do not report what no rule watches.** `COMMENT-3` has no machine and half of `COMMENT-2` has none
   either; a verdict that claims otherwise is wrong about the module.

## `require-export-jsdoc` — COMMENT-1

**What it reports.** A thing leaving the file without a doc block in front of it: `class`, `interface`,
`type`, `enum`, a function declaration, and a `const` bound **directly** to an arrow function or a
function expression. Both the named form and `export default` are inspected. It holds `COMMENT-1` as far
as a machine can see it — whether the doc block **exists**, never what is inside it.

**How it detects.** Visits `ExportNamedDeclaration` and `ExportDefaultDeclaration`. Reads
`node.declaration`; returns immediately when it is absent. For a `VariableDeclaration`, inspects
`declarations[0].init` only and continues **only** if that init's type is `ArrowFunctionExpression` or
`FunctionExpression`. Otherwise requires `declaration.type` to be one of `TSInterfaceDeclaration`,
`TSTypeAliasDeclaration`, `TSEnumDeclaration`, `ClassDeclaration`, `FunctionDeclaration`. Then calls
`sourceCode.getCommentsBefore(node)` and passes if **any** returned comment has `type === "Block"` and a
`value` beginning with `*`.

**What it cannot see.** Re-export is invisible: `export { Thing }` and `export { Thing } from "./thing"`
have no `declaration` and the rule returns at once, while `export * from "./thing"` has no visitor at
all — a barrel file can publish an entire undocumented surface in silence. Wrapping a function in a call
escapes: `export const run = make(1)`, `= memo(() => {})`, `= other.bind(null)`, `= class {}` — the init
is a `CallExpression` or `ClassExpression`, so a callable or constructable surface is treated as a data
constant. `export default () => {}` and `export default { … }` are skipped while the same arrow written
as `export const f = () => {}` is checked — the exemption depends on the export FORM, not on what is
exported. Only `declarations[0]` is inspected, so `export const MAX = 3, run = () => {}` lets `run`
escape, and swapping the order makes it fire. An empty `/** */` satisfies the rule, because its value is
`* `. Any qualifying leading comment passes, so a file banner, or a doc orphaned by a deleted
declaration, serves as the next export's doc. An overload signature parses as `TSDeclareFunction`, which
is not in the documented-kinds set — the doc is demanded on the implementation instead, the one
signature callers never read, and a file of pure signatures is entirely silent. A public method on a
documented exported class is out of scope, though other files depend on it exactly as much.
`export declare const CONFIG: Shape` has no init and is skipped. And the content of the doc block is
never read: a sentence restating the name is green.

**Boundary.** This rule stops at the top-level declaration. Members inside an exported enum are
`require-enum-member-jsdoc`; nothing judges what the sentence says.

## `require-enum-member-jsdoc` — COMMENT-2

**What it reports.** A member of an **exported** enum with no doc block of its own. It holds only the
**first half** of `COMMENT-2`. The law demands that a member state the consequence of choosing it; the
rule sees only whether a doc block is present. The error message states this limit rather than
pretending otherwise.

**How it detects.** Visits `TSEnumDeclaration`. Returns unless `node.parent.type ===
"ExportNamedDeclaration"`. Iterates `node.members` and applies the same `getCommentsBefore` / `Block` /
leading-`*` test to each member node.

**What it cannot see.** The half that matters: `/** The pending state. */` — the exact text the law
prints as its counter-example — passes, because the machine counts doc blocks and cannot read them. An
empty `/** */` passes too. Detaching the keyword disarms the rule completely: `enum State { … }` on one
line and `export { State }` on the next leaves the enum's parent as the program body, and every member
requirement disappears. `export const State = { Pending: "pending" } as const` is silent under **both**
JSDoc rules — a data constant to the first, not a `TSEnumDeclaration` to the second — and it is the
construct most often reached for in place of an enum. `export type State = "pending" | "settled"` needs
one doc for the alias and none for the members, so the relationship `COMMENT-2` exists to protect is
gone and the build is green.

**Boundary.** The enum's own doc is `require-export-jsdoc`'s business:
`getCommentsBefore` is called on each member node, and the declaration's doc sits before the export node,
so it is never returned for a member.

## `no-non-ascii-source` — COMMENT-4

**What it reports.** A source **line** carrying one of three things: a Vietnamese letter with a
diacritic, an emoji, or one of twelve listed ornamental symbols. It carries `COMMENT-5` not as a
condition for firing but as the exemption: a line marked `vn-ok` is skipped.

**How it detects.** Reads `context.filename`, normalises backslashes to forward slashes, and returns an
empty visitor when the path matches `/(?:messages|locales|i18n)/`. Computes a fixture lane from
`\.spec\.ts$`, `-spec\.ts$` or `/src/tests/`; inside that lane it builds a line-number set from the spans
of `sourceCode.getAllComments()`. At `Program:exit` it walks `sourceCode.getLines()` — **raw text, not
AST** — skips any line matching `\bvn-ok\b`, skips non-comment lines when in the fixture lane, strips the
first occurrence of the string `Tiếng Việt`, then tests three character classes in order: Vietnamese
letters, emoji ranges (`1F300–1FAFF`, `1F000–1F0FF`, `2600–27BF`, `FE0F`, `1F1E6–1F1FF`), and a
twelve-character ornament literal.

**What it cannot see.** Unaccented prose in a second language: the letter class matches diacritics, so a
sentence written without them carries no matching codepoint and passes completely — the rule detects one
orthography, not one language. Prose in Russian, Chinese, Japanese, Korean, Thai or Greek is in none of
the three classes; the law refuses a codebase with two languages in it, the rule refuses one specific
alphabet. The ornament set is a hand-written list of twelve characters: `⭐` (`U+2B50`) is on it and `⭕`
(`U+2B55`) is not, the emoji arrow `➡` falls inside `2600–27BF` and is caught while `→` (`U+2192`) — the
arrow anyone would actually type — is not, and `⇒`, `●`, `⬛` and box-drawing runs are outside it too. An
escaped string is invisible: `"Đặt hàng"` is pure ASCII on the line while the program still emits the
same text at runtime, and a formatter that escapes non-ASCII output produces this without anyone
deciding to. A folder ban is not a file ban: the same content in `payment/messages.ts` is policed in
full, and moving one file into an `i18n/` folder exempts every line of it permanently, comments
included. The fixture lane is bound to a filename, so `foo.spec.ts` exempts its strings and the identical
file as `foo.test.ts` does not, and neither does `__tests__/helper.ts` — extracting fixtures into a
helper module turns data written to be legal into a wall of errors on the day it is tidied out. The
marker regex is `\bvn-ok\b` and nothing more: the message asks for `vn-ok: <reason>` and the rule never
checks for one, the marker exempts the WHOLE line so one legitimate provider string beside a sentence of
reasoning passes wholesale, and nothing distinguishes data from prose but the author's assertion.

**Boundary.** Because this rule never touches the AST, it is immune to the laundering that defeats most
literal-matching rules — gathering a string into a constant, an array or an object does not hide it,
since the characters are still on some line, and splitting a string across a concatenation only spreads
it over lines that are each scanned. It buys that immunity by being unable to tell a comment from an
identifier from a seed row.

## Detection

Every mechanism here was confirmed by running the rules against constructed sources, not inferred from
their names.

| Part | Mechanism |
|---|---|
| path gate | Only `no-non-ascii-source` reads `context.filename`. It normalises backslashes to forward slashes and returns an empty visitor when the path matches `/(?:messages\|locales\|i18n)/` |
| lane computation | The fixture lane is `\.spec\.ts$`, `-spec\.ts$` or `/src/tests/`; inside it, a line-number set is built from the spans of `sourceCode.getAllComments()` and non-comment lines are skipped |
| the walker | `require-export-jsdoc` visits `ExportNamedDeclaration` and `ExportDefaultDeclaration`; `require-enum-member-jsdoc` visits `TSEnumDeclaration` and iterates `node.members`; `no-non-ascii-source` installs `Program:exit` only |
| the reader | Both JSDoc rules call `sourceCode.getCommentsBefore(node)` and pass on **any** comment with `type === "Block"` and a `value` beginning with `*`. `no-non-ascii-source` reads `sourceCode.getLines()` — raw text, not AST |
| reaching outside the file | Nothing does. No rule opens another module, resolves an import or consults a configuration; the two JSDoc rules do not even read the filename, so there is no name to change to dodge them |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `// what this is for` above an export | `require-export-jsdoc` requires `type === "Block"`; a line comment is `Line` and never satisfies it |
| `/* what this is for */` above an export | The block's `value` must begin with `*`; a plain block comment's does not |
| Renaming the file to dodge `require-export-jsdoc` | Neither JSDoc rule reads `context.filename` at all, so there is no name to change |
| `export default class` / `export default function` | `ExportDefaultDeclaration` is visited by the same handler as the named form |
| A doc on the enum standing in for its members | `getCommentsBefore` is called on each member node; the declaration's own doc sits before the export node and is never returned for a member |
| Gathering a Vietnamese string into a constant, array or object | `no-non-ascii-source` scans raw lines, so no syntactic move relocates the characters out of its view |
| Splitting an offending string across a concatenation | Each fragment still occupies a line, and each line is scanned independently |
| A line carrying `Tiếng Việt` twice | The strip is non-global; only the first occurrence is removed, and the second still reports |

**Open** — shipped blindness. A verdict must not claim these were judged. None is theoretical, and none
requires bad faith to reach — most are what tidying up looks like.

| Scope | What passes |
|---|---|
| `require-export-jsdoc` | `export { Thing }`, `export { Thing } from "./thing"` — no `declaration`, immediate return; `export * from "./thing"` has no visitor at all |
| `require-export-jsdoc` | `export const run = make(1)`, `= memo(() => {})`, `= other.bind(null)`, `= class {}` — the init is a `CallExpression` or `ClassExpression`, so a callable surface is treated as data |
| `require-export-jsdoc` | `export default () => {}` and `export default { … }` — the exemption depends on the export FORM, not on what is exported |
| `require-export-jsdoc` | `export const MAX = 3, run = () => {}` — only `declarations[0]` is inspected; swapping the order makes it fire |
| `require-export-jsdoc` | A file banner, or a doc orphaned by a deleted declaration, serving as the next export's doc |
| `require-export-jsdoc` | An overload signature is `TSDeclareFunction`; a file of pure signatures is entirely silent |
| `require-export-jsdoc` | A public method on a documented exported class, and `export declare const CONFIG: Shape` |
| `require-enum-member-jsdoc` | `enum State { … }` then `export { State }` on the next line — the parent is the program body and every member requirement disappears |
| both JSDoc rules | `/** */` — the value is `* `, so an empty doc block satisfies either rule |
| both JSDoc rules | `export const State = { Pending: "pending" } as const`, and `export type State = "pending" \| "settled"` — the constructs reached for in place of an enum are the ones neither rule covers |
| both JSDoc rules | A doc block whose sentence restates the name. This is `COMMENT-3` and half of `COMMENT-2`, and no rule holds either |
| `no-non-ascii-source` | Unaccented prose in a second language — the class matches diacritics, so the rule detects one orthography, not one language |
| `no-non-ascii-source` | Prose in Russian, Chinese, Japanese, Korean, Thai or Greek — none of those scripts is in any of the three classes |
| `no-non-ascii-source` | `→` (`U+2192`), `⇒`, `●`, `⬛`, `⭕` (`U+2B55`), box-drawing runs — the ornament set is twelve hand-written characters |
| `no-non-ascii-source` | `"Đặt hàng"` — the line is pure ASCII and the program still emits the same text at runtime |
| `no-non-ascii-source` | Any file inside a folder named `messages`, `locales` or `i18n` — the empty visitor exempts the file's comments as well as its copy, permanently |
| `no-non-ascii-source` | Renaming a spec, and extracting fixtures out of a spec into a helper module — the lane is a filename, not a purpose |
| `no-non-ascii-source` | `// vn-ok` with no reason anywhere on the line, a marked line that also carries untranslated prose, and the marker itself — `COMMENT-5`'s boundary is entirely on the honour system |
| no rule | Everything `COMMENT-3` forbids, and the consequence half of `COMMENT-2` |

## Inputs

| Input | Evidence required |
|---|---|
| rule | The published name, verbatim, as it appears in a build log |
| code | The `COMMENT-<n>` it enforces, or an explicit `none` |
| file | The path as `context.filename` sees it, forward-slashed |
| construct | The AST node or raw line the mechanism actually matches |
| lane | Whether the path falls in a locale folder, the fixture lane, or ordinary source |

## Rules

1. A rule's identity is its published NAME. It carries no numeric code of its own.
2. A rule name is reproduced verbatim, including any product word inside it, because that string is what
   a build prints and what a disable comment must spell.
3. Every rule documented here exists in the published `rules` export. A rule that ought to exist is a
   proposal, not a rule.
4. Every rule has at least one honest open row, or an argument for why it is airtight.
5. A law code with no rule is recorded as unenforced rather than mapped to the nearest rule.
6. Existence checks are never reported as content checks.

## Exceptions

Exceptions here are properties of the rules, not relief from the law.

- **The marked literal.** A line matching `\bvn-ok\b` is skipped entirely by `no-non-ascii-source`. This
  is `COMMENT-5` working as intended, and it is per-line, unverified and total. It releases the whole
  line, prose included.
- **The locale folder.** Paths containing `messages/`, `locales/` or `i18n/` disable the third rule
  completely, releasing `COMMENT-4` over every line of the file. Policing product copy would be policing
  the product.
- **The fixture lane.** In `*.spec.ts`, `*-spec.ts` and `tests/`, only comment lines are policed. It
  releases `COMMENT-4` over data lines only: a sentence a real person would type is data being fed to a
  system, while a comment in a spec is prose, and is still refused.
- **The data constant.** `export const MAX_ATTEMPTS = 3` is exempt from `require-export-jsdoc` by design,
  releasing `COMMENT-1` for data, because demanding a sentence there produces sentences that restate the
  name — which `COMMENT-3` forbids and no rule can catch.
- **The endonym.** The string `Tiếng Việt` is stripped once per line before the letter test, being a
  label rather than prose. The strip is non-global, so a line carrying it twice still reports.

## Output

One block per finding:

```text
rule: <require-export-jsdoc | require-enum-member-jsdoc | no-non-ascii-source>
code: <COMMENT-1 | COMMENT-2 | COMMENT-4 | none>
file: <path>:<line>
construct: <AST node or raw line the mechanism matched>
verdict: <fires | silent>
reason: <the fact that decides it, naming the mechanism>
hatch: <the open hatch that would have hidden this, or none>
```

A clean file emits nothing from the rules that ran, and the lane it was judged in is still recorded. A
file the path gate rejected emits one block with `verdict: silent` and a `reason` naming the empty
visitor — it was not judged, and it did not pass.

## Worked example

**Input.** `payment/state.ts`, ordinary source, no lane exemption:

```ts
export enum PaymentState {
  Pending = "pending",
  /** Đã thanh toán xong. */
  Settled = "settled",
}

export const refund = async (id: string) => charge.reverse(id)
```

```text
rule: require-enum-member-jsdoc
code: COMMENT-2
file: src/payment/state.ts:2
construct: TSEnumMember Pending
verdict: fires
reason: getCommentsBefore returned no Block comment whose value begins with "*"
hatch: none
```

```text
rule: no-non-ascii-source
code: COMMENT-4
file: src/payment/state.ts:3
construct: raw line "  /** Đã thanh toán xong. */"
verdict: fires
reason: Program:exit walked getLines(); the line carries Vietnamese diacritics, matches no \bvn-ok\b marker, and the path matched neither the locale gate nor the fixture lane
hatch: none
```

```text
rule: require-export-jsdoc
code: COMMENT-1
file: src/payment/state.ts:7
construct: ExportNamedDeclaration, VariableDeclaration, declarations[0].init ArrowFunctionExpression
verdict: fires
reason: the init is a literal function expression, so the declaration is checked, and no leading Block comment begins with "*"
hatch: none
```

**Repaired.**

```ts
/** Where a payment sits in its lifecycle. */
export enum PaymentState {
  /** Money has not moved; the order may still be cancelled for free. */
  Pending = "pending",
  /** Money has moved and access is granted; reversing costs a refund fee. */
  Settled = "settled",
}

/** Reverses a settled charge and reopens the order. */
export const refund = async (id: string) => charge.reverse(id)
```

Every rule that ran is now silent. That silence is not the same as compliance, and one tidying move
proves it:

```ts
enum PaymentState {
  /** The pending state. */
  Pending = "pending",
}
export { PaymentState }
export const refund = memo(async (id: string) => charge.reverse(id))
```

```text
rule: require-enum-member-jsdoc
code: COMMENT-2
file: src/payment/state.ts:1
construct: TSEnumDeclaration PaymentState
verdict: silent
reason: node.parent.type is the program body, not ExportNamedDeclaration, so the rule returns before reaching node.members
hatch: detaching the export keyword disarms the rule entirely; and even inside an export, "/** The pending state. */" — the law's own counter-example — passes, because the rule sees existence and never content
```

```text
rule: require-export-jsdoc
code: none
file: src/payment/state.ts:5
construct: ExportNamedDeclaration with no declaration; VariableDeclaration with a CallExpression init
verdict: silent
reason: export { PaymentState } has no node.declaration and the rule returns at once; memo(...) is a CallExpression, not a literal function expression, so refund is treated as a data constant
hatch: re-export is invisible and wrapping a function in a call escapes — both surfaces ship undocumented with a green build
```

## Scope

This module documents the enforcement of one law over source comments. It does not judge whether a
comment says why rather than what — `COMMENT-3` has no owner in code and belongs to the reader. It does
not judge whether an enum member states its consequence — that half of `COMMENT-2` is owned by nobody. It
names no product, no component library and no repository. The only product words on this page are inside
identifiers that ship — a rule name, a plugin prefix, a package name — and those are reproduced exactly,
because a renamed identifier is a different identifier.
