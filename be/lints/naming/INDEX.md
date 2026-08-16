---
id: be-lints-naming-index
title: INDEX.md
slug: /be/lints/naming
sidebar_label: naming
sidebar_position: 0
description: What the two naming rules actually see, and every way of writing a bad name that walks past them.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `naming`

## Law

A name is the only part of a symbol that reaches a reader who has not opened it. Everything else —
the signature, the body, the tests — costs a file to consult. So a name answers one question: what
is this thing, to somebody who does not already know? Not what it is implemented with, not which
version of a format it was written for, not which folder it lived in when it was created.

This shelf does not restate that law. It records **enforcement**: which of the law's seven rulings a
machine holds, by what mechanism, and — the part that is normally left unwritten — which ways of
writing the same bad name the machine does not see at all. A ruling with no rule is known to be
unenforced, and the reader compensates. A rule believed to be closed and in fact leaky is worse,
because it buys the reader's attention and spends it on nothing.

Two of the seven rulings are held. That is not a gap to be filled: the source argues, at length and
with a measurement, that the other five need to know what the thing IS, which no parser knows. The
honest record is the small number, not a larger one made of rules that guess.

## Rules

Two rules ship for this law, in `@starci/eslint-canon-be`. The source's own recommended
configuration puts **both at `warn`, not `error`** — deliberately, and the reason is written in the
source: naming rules land on a mature tree with real debt, and a naming rule at `error` on day one
blocks every commit that touches an old file, which teaches people to disable it.

| Rule | Law code | What it reports |
|---|---|---|
| `no-version-in-name` | `NAME-2` | `versioned` — a declared function, class, interface, type alias or method whose name bakes a schema generation into it |
| `no-bare-verb-export` | `NAME-5` | `bareVerb` — a named export whose identifier is one of eighteen listed bare verbs |

The count is exactly two. The source's `rules` export publishes `no-version-in-name` and
`no-bare-verb-export` and nothing else, and its header says so in the first sentence.

Four findings live in this table and are argued in [`audit.md`](./audit.md):

- **Five of the seven law codes have no rule.** `NAME-1`, `NAME-3`, `NAME-4`, `NAME-6` and `NAME-7`
  are review-held. The source states this and refuses to fake them: whether a name describes a
  folder, a mechanism or its first caller needs to know what the thing IS, and a parser does not.
- **`NAME-1` was rule-shaped, measured, and deleted.** A first version demanded the file name spell
  out the class it declares and found 616 offenders in 4430 files — because the convention is the
  opposite of what it assumed. Fourteen percent of a tree is a convention, not debt. The deletion is
  correct; what it also took away is recorded as an open risk.
- **`NAME-6` looks half-held and is not.** The boolean ruling bans `checkX`. The verb `check` is in
  the bare-verb set, so a function named exactly `check` is reported — but by `no-bare-verb-export`,
  under `NAME-5`, and only when exported. `checkVerified`, the actual shape the ruling bans, is
  reported by nothing.
- **Neither rule ships at `error`.** A build stays green with both firing. "The gate passed" and
  "the rules found nothing" are different sentences here, and only one of them is evidence.

## Detection

Both rules are pure AST walks over declaration names. Nothing here reads the filename, resolves an
import, follows a type alias, or consults the type checker.

| Rule | Mechanism |
|---|---|
| `no-version-in-name` | Visits exactly five node types: `FunctionDeclaration`, `ClassDeclaration`, `TSInterfaceDeclaration`, `TSTypeAliasDeclaration` (each requiring `node.id`) and `MethodDefinition` (requiring `node.key.type === "Identifier"`). Tests the identifier's `name` against one regular expression, `/(?:^\|[a-z])V[0-9]+(?:$\|[A-Z_])\|_V[0-9]+/`. Reports on the identifier node. |
| `no-bare-verb-export` | Visits `ExportNamedDeclaration` only. Returns immediately when `node.declaration` is absent. Takes a `FunctionDeclaration` with an `id` directly; takes a `VariableDeclaration` and loops its declarators, requiring `init.type` to be `ArrowFunctionExpression` or `FunctionExpression` and `id.type` to be `Identifier`. Tests the identifier's `name` for membership in a hand-written `Set` of eighteen strings. Reports on the identifier node. |

Two mechanisms carry the whole shelf, and both are narrow in the same direction: one is a **regular
expression over a declared name**, the other is a **set membership test at one syntactic position**.
Everything in the Open table below follows from those two sentences.

Read the version regular expression carefully, because most of its leaks are inside it. It has two
alternatives. The first, `(?:^|[a-z])V[0-9]+(?:$|[A-Z_])`, requires a capital `V` that is either at
the start of the name or preceded by a **lower-case** letter, and requires the digits to be followed
by the end of the name, a **capital** letter, or an underscore. The second, `_V[0-9]+`, requires a
literal underscore before a capital `V`.

## Escape Hatches

### Closed

Ways of writing that a reader might reasonably expect to slip past, and do not.

| Written as | Why it is still reported |
|---|---|
| `class ContentV2Parser` / `interface IsContentV2Params` / `type V2Body` | All four declaration kinds are visited, and a capital after the digits satisfies the trailing gate. The version is reported wherever it is declared, not only on functions. |
| A method — `async isV2(params) { … }` | `MethodDefinition` is visited with an `Identifier` key. Getters, setters and static methods are the same node. |
| A version at the very front — `class V2ContentParser` | The leading `^` alternative covers it. A version does not become invisible by moving to the start. |
| A version at the very end — `function parseContentV2` | The trailing `$` alternative covers it. |
| `export async function generate(…)` | An `async` function declaration is still a `FunctionDeclaration`. The modifier changes nothing. |
| `export const generate = async () => { … }` | The initializer is an `ArrowFunctionExpression`, which the loop accepts. Arrow style does not launder the name. |
| `export const generate = function generate() { … }` | `FunctionExpression` is accepted alongside the arrow form. |
| `export let generate = () => { … }`, and several declarators on one line | The rule reads the `VariableDeclaration` regardless of `kind`, and loops **every** declarator rather than reading the first. |
| A type annotation on the export — `export const generate: ContentGenerator = () => { … }` | The declarator's `id` is still an `Identifier`; the annotation hangs off it and is not consulted. |
| A constant laundering the name — `const NAME = "isV2"` used as a computed key | Not an escape *into* legality: the computed key is skipped, which is an open hatch, not a closed one. Listed here only because readers expect the constant trick from other shelves; see the Open table. |

### Open

Ways of writing this shelf genuinely does not catch. Each is ordinary code somebody would write while
tidying up, not sabotage.

| Written as | What walks past, and why |
|---|---|
| `export const parseV2Body = (body) => { … }` | **The version rule visits no variable declarator at all.** A version baked into an arrow-function constant — the dominant style for a helper — is invisible. The sibling rule in the same file goes to the trouble of walking declarators for exactly this shape, which shows the author knew it existed. |
| `interface ContentParams { isV2: boolean }` | Only the interface's own name is tested. `TSPropertySignature` is not visited, so a version living on a **field** survives inside a correctly named shape — and a field is read at every call site. |
| `class ContentParser { readonly isV2 = true }` | `PropertyDefinition` is not `MethodDefinition`. A class field carrying a version is not reported; the same name as a method would be. |
| `abstract parseV2Body(): void` in an abstract base | An abstract member is a `TSAbstractMethodDefinition`, a different node type. The one place a versioned method name is most likely to be *declared for others to implement* is not visited. |
| `const api = { parseV2Body() { … } }` | An object-literal method is a `Property`, not a `MethodDefinition`. Shorthand method syntax reads identically and is not seen. |
| `enum Shape { V2 = "v2" }` | Neither `TSEnumDeclaration` nor `TSEnumMember` is visited. |
| `class ContentAPIV2Parser` | The regular expression demands the character before `V` be lower-case or the start of the name. An **acronym immediately before the version** — `API`, `HTTP`, `AI`, `URL` — disables the first alternative, and the second needs an underscore. Nothing fires. |
| `function parseV2body()` | The digits must be followed by end-of-name, a capital, or an underscore. A **lower-case letter after the digits** disables the alternative. One shift key. |
| `const SCHEMA_V2 = …`, `type Params = { MY_V2_FLAG: boolean }` | The `_V[0-9]+` alternative exists for screaming-snake names — and **no visitor ever reaches one**. Constants are declarators, enum members are enum members, properties are properties. That half of the regular expression is very nearly unreachable. |
| `function parse_v2()`, `const isv2 = …` | The `V` must be capital in both alternatives. Lower-case spellings of the same version are not reported. |
| `class ContentSchema2`, `type LegacyBody`, `function parseBodyRev2` | The rule knows one spelling of "version": the letter `V` followed by digits. `Schema2`, `Rev2`, `Gen2`, `Legacy`, `Old`, `New` and `Next` all name a moment and none of them are seen. |
| `function generate() { … }` at the bottom of the file, then `export { generate }` | **The verb rule reads `node.declaration` and returns when it is absent.** A specifier list — the ordinary "declare above, export below" style, and every barrel file — unenforces the rule completely. |
| `export { askModel as generate } from "./models"` | The alias is what *creates* the bare verb, and it is created at the one node the rule refuses to read. A re-export publishes the offending name at a new path silently. |
| `export * from "./content"` | An `ExportAllDeclaration` republishes `generate` transparently. Not visited. |
| `export default function generate() { … }` | `ExportDefaultDeclaration` is a different node type. Not visited by anything here. |
| `export const generate = memoize(buildContent)` | The initializer is a `CallExpression`, not a function expression. Wrapping a function in a memoiser, a logger, a factory or a decorator is ordinary, and it removes the rule from the declaration. |
| `export class ContentService { generate() { … } }` | The rule reads the exported declaration's own name. A bare-verb **method** is not covered — and `const { generate } = service` puts the reader back at exactly the collision the ruling describes. |
| `export const contentApi = { generate: () => { … } }` | An object property holding a function is not read. The verb is published, one indirection down. |
| `export const execute = () => { … }`, `emit`, `read`, `write`, `sync`, `init`, `start`, `render`, `validate`, `find`, `save`, `list`, `format`, `merge`, `serialize` | The verb set is **hand-written and closed at eighteen entries**. Every bare verb outside it is legal. `execute` may be the barest verb in the language and is not in the set. |
| `export const Generate = () => { … }`, `export const generate_ = …`, `export const doGenerate = …` | Set membership is exact and case-sensitive. One capital, one underscore or one filler word walks out. |
| `export declare function generate(): void` in a declaration file | `TSDeclareFunction` is neither a `FunctionDeclaration` nor a `VariableDeclaration`, so the branch returns. |
| Any file name at all — `content-v2.service.ts`, `generate.ts` | **Neither rule reads `context.filename`.** That cuts both ways: no folder can be exempted, and no file name can be judged. `NAME-1` is about file names and has no rule. |

The pattern behind most of those rows is one sentence: **each rule recognises one exact syntactic
position and falls silent everywhere else rather than reporting.** An early `return` is
indistinguishable, in a build log, from a clean file.

## Inputs

| Input | What the rules read |
|---|---|
| Source AST | Five declaration node types and their `id`; `MethodDefinition.key`; `ExportNamedDeclaration.declaration` and, through it, one `FunctionDeclaration` id or a `VariableDeclaration`'s declarator ids |
| Filename | **Nothing.** Neither rule reads `context.filename`, so no folder, suffix, fixture path or generated file is exempt — and no file name is judged |
| Options | **Nothing.** Both declare `schema: []`; there is no configuration surface, and the verb list cannot be extended without editing the rule |
| Imports | **Nothing.** No module is resolved; a re-exported name is never followed to its declaration |
| Types | **Nothing.** No type is resolved; a name is a string |
| Severity | Both are published at `warn` in the recommended configuration, with an explicit instruction to measure before raising them |

## Invariants

- A version is judged on the **declared name only**, never on a value, a string literal, a field or a
  file path.
- A bare verb is judged at **one syntactic position only**: the identifier of a declaration that is
  itself the subject of an `export` keyword.
- Neither rule ships a fixer. Every report is a message, and the replacement name suggested in a
  message is prose, not a patch.
- Neither rule reads the filename, so the rules cannot be escaped by moving or renaming a file — and
  cannot be relaxed for a fixture either.
- Neither rule takes options, so a repository cannot weaken one without disabling it, and cannot add
  a verb to the list without changing the shipped rule.
- A helper is a helper: `normalizePath` exists in the source for the sibling laws and is not used by
  either published rule here.
- Underscore and acronym spelling inside a name is never itself a report; only the version pattern
  and the exact verb string are rulings.
- Both sit at `warn` in the shipped configuration by design, not by oversight.

## Exceptions

Exceptions are part of the enforcement, not relief from it. Each names the rule it steps around and
the reason that survives review.

- **A public wire version.** A route, a payload or a client contract that genuinely publishes a
  second generation to the outside world has a version as part of its identity. `no-version-in-name`
  cannot tell that apart from a schema generation baked into an internal helper, and will report it.
  The honest form is a disable comment naming the published contract — not a rename that makes the
  rule quiet while making the name worse.
- **A protocol or algorithm whose name contains a number.** A name that carries a version because the
  *standard* does is reported by the same regular expression. Same treatment: disable with the
  standard named.
- **A generated or vendored declaration.** A file this tree does not author is disabled at the file
  level with a comment saying who authors it.
- **The test lane is not exempt.** Neither rule gates on the filename, so a helper exported from a
  test tree is judged like any other export. The law's own worked example is an import from a test
  helper module, so this is intent, not oversight.
- **A method on a well-named class** is outside `no-bare-verb-export` by construction, not by
  permission. If the method name is bare, it is reviewed where it is written.

## Output

```text
rule:     <no-version-in-name | no-bare-verb-export>
law code: <NAME-2 | NAME-5>
message:  <versioned | bareVerb>
node:     <declaration name identifier | method key | export declarator id>
severity: warn
```

## Load Policy

Read this file first. Read [`vi.md`](./vi.md) for what each rule catches and why it is worth a
machine, [`example.md`](./example.md) for the code that fires and the code that walks past,
[`audit.md`](./audit.md) while judging whether the enforcement is honest, and
[`changelog.md`](./changelog.md) for what changed.

## Scope

This module documents two published rules and nothing else. A rule that ought to exist but is not in
the source is not documented here; it is an open risk in `audit.md`. Rule names are reproduced
verbatim because the name is the identity — it is what a build log prints, what a disable comment
carries, and what every conversation about the failure uses. Prose and examples name no product.

## Version Rule

Increment all five records by `0.01` for an accepted change and record it in `changelog.md`. A rule
added, removed or renamed in the source is a change to this module even when the law does not move.
A change to the shipped severity is a change to this module, because severity is the difference
between a report and a gate.
