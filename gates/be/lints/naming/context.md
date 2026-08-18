---
title: Naming
runtime: true
source: en.md
sourceHash: 3f5fe06112d23374f13a59c5a1819c386c79ba0dd39ff65e0551cd86efcd9ee7
contextVersion: 1
---

# Naming

## LOADS

None.

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
which published rule fired, what message it emitted, on which node, which law code that maps to, and
the open hatch that would have hidden the same failure. This module chooses no name. It refuses one,
and it must be able to point at the identifier it refuses on.

## Law

A name is the only part of a symbol that reaches a reader who has not opened it. Everything else — the
signature, the body, the tests — costs a file to consult. So a name answers one question: what is this
thing, to somebody who does not already know? Not what it is implemented with, not which version of a
format it was written for, not which folder it lived in when it was created.

The law states **seven codes. Two of them have a rule.** That small number is the honest one: the
source argues, at length and with a measurement, that the other five need to know what the thing IS,
which no parser knows. A ruling with no rule is known to be unenforced, and the reader compensates. A
rule believed to be closed and in fact leaky is worse, because it buys the reader's attention and
spends it on nothing.

Both shipped rules sit at **`warn`, not `error`**, in the source's own recommended configuration —
deliberately: naming rules land on a mature tree with real debt, and a naming rule at `error` on day
one blocks every commit that touches an old file, which teaches people to disable it. A build stays
green with both firing. "The gate passed" and "the rules found nothing" are different sentences here,
and only one of them is evidence.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `no-version-in-name` | `NAME-2` | `versioned` — a declared function, class, interface, type alias or method whose name bakes a schema generation into it |
| `no-bare-verb-export` | `NAME-5` | `bareVerb` — a named export whose identifier is one of eighteen listed bare verbs |

The count is exactly two. The source's `rules` export publishes `no-version-in-name` and
`no-bare-verb-export` and nothing else, and its header says so in the first sentence.

`NAME-1`, `NAME-3`, `NAME-4`, `NAME-6` and `NAME-7` have **no rule at all**. They are review-held, not
covered, and a green run says nothing about any of them. Two of those absences are worth naming
precisely. `NAME-1` was rule-shaped, measured, and deleted: a first version demanded the file name
spell out the class it declares and found 616 offenders in 4430 files, because the convention is the
opposite of what it assumed — fourteen percent of a tree is a convention, not debt. And `NAME-6` looks
half-held and is not: the boolean ruling bans `checkX`, and because the verb `check` is in the
bare-verb set a function named exactly `check` is reported — but by `no-bare-verb-export`, under
`NAME-5`, and only when exported. `checkVerified`, the actual shape the ruling bans, is reported by
nothing.

## Reading a diff

1. **Decide scope before anything else, and record it.** Scope here is unusual: **neither rule reads
   `context.filename`**, so every file the linter parses is in scope. There is no folder, suffix,
   fixture path or generated file that is out of scope — and no file name that is judged. Record that
   as the scope decision rather than assuming it.
2. **Check the exemptions.** A disable comment naming a published wire contract, a named standard, or
   a generated/vendored author is the only exit; there is no option, no allowlist and no per-file
   opt-out in either rule.
3. **Read the nodes, not the text.** `no-version-in-name` sees five declaration kinds plus
   `MethodDefinition`; `no-bare-verb-export` sees `ExportNamedDeclaration.declaration` and nothing
   else. A name that is not at one of those exact positions was never looked at.
4. **Emit one block per finding**, on the identifier node the rule reports on.
5. **Write the `hatch` line whenever an open hatch would have hidden the same failure**, including
   when the file emits no finding at all.
6. **Do not report what no rule watches.** Five of the seven codes have no machine; a verdict that
   claims otherwise is wrong about the module.

## `no-version-in-name` — NAME-2

**What it reports.** `versioned`, one message, on the declared identifier: a name that bakes a schema
generation into it — `isV2`, `IsContentV2Params`, `parseV2Body`, `class V2ContentParser`. Such a name
must change on the day the next generation ships, but renaming is the easy part; the hard part is that
until then nobody reading the name can tell whether `V2` means the current shape or an old one, so
every reader goes and looks it up.

**How it detects.** It visits exactly five node types: `FunctionDeclaration`, `ClassDeclaration`,
`TSInterfaceDeclaration`, `TSTypeAliasDeclaration` (each requiring `node.id`) and `MethodDefinition`
(requiring `node.key.type === "Identifier"`). It tests the identifier's `name` against one regular
expression, `/(?:^|[a-z])V[0-9]+(?:$|[A-Z_])|_V[0-9]+/`, and reports on the identifier node. The first
alternative requires a capital `V` either at the start of the name or preceded by a **lower-case**
letter, and requires the digits to be followed by end-of-name, a **capital** letter, or an underscore.
The second requires a literal underscore before a capital `V`.

**What it cannot see.** It visits **no variable declarator at all**, so `export const parseV2Body =
(body) => { … }` — the dominant style for a helper — is invisible; the sibling rule in the same file
walks declarators for exactly that shape, which shows the author knew it existed. `TSPropertySignature`
is not visited, so `interface ContentParams { isV2: boolean }` survives inside a correctly named shape,
and a field is read at every call site. `PropertyDefinition` is not `MethodDefinition`, so
`class ContentParser { readonly isV2 = true }` passes where the same name as a method would fire. An
abstract member is a `TSAbstractMethodDefinition` — the one place a versioned method name is most
likely to be declared for others to implement is not visited. An object-literal method is a `Property`.
Neither `TSEnumDeclaration` nor `TSEnumMember` is visited. Inside the regex: an acronym immediately
before the version, `class ContentAPIV2Parser`, disables the first alternative and the second needs an
underscore; one lower-case letter after the digits, `function parseV2body()`, disables it too — one
shift key. The `_V[0-9]+` alternative was written for screaming-snake names such as `const SCHEMA_V2 =
…` and **no visitor ever reaches one**, so that half is very nearly unreachable. Both alternatives
demand a capital `V`, so `function parse_v2()` and `const isv2 = …` are silent. And the rule knows one
spelling of "version": `Schema2`, `Rev2`, `Gen2`, `Legacy`, `Old`, `New` and `Next` all name a moment
and none are seen.

**Boundary.** It judges the **declared name only** — never a value, a string literal, a field or a
file path. A version in a file name such as `content-v2.service.ts` belongs to `NAME-1`, which has no
rule.

## `no-bare-verb-export` — NAME-5

**What it reports.** `bareVerb`, one message, on the exported identifier: an export named exactly one
bare verb — `generate` — generate **what**? In an import list `generate` collides with every other
module's `generate`, so the reader falls back on reading the **path**, and the path is the thing that
moves. The set is eighteen strings: `generate`, `parse`, `run`, `handle`, `process`, `build`, `create`,
`load`, `resolve`, `check`, `convert`, `transform`, `send`, `fetch`, `get`, `set`, `update`, `apply`.

**How it detects.** It visits `ExportNamedDeclaration` only, and returns immediately when
`node.declaration` is absent. It takes a `FunctionDeclaration` with an `id` directly; it takes a
`VariableDeclaration` and loops its declarators, requiring `init.type` to be `ArrowFunctionExpression`
or `FunctionExpression` and `id.type` to be `Identifier`. The test is membership in a hand-written
`Set`, exact and case-sensitive. It reports on the identifier node. There is no filename gate.

**What it cannot see.** Because it reads `node.declaration` and returns when it is absent, a specifier
list — `function generate() { … }` above and `export { generate }` below, and every barrel file —
unenforces the rule completely. `export { askModel as generate } from "./models"` creates the bare verb
at the one node the rule refuses to read. `export * from "./content"` is an `ExportAllDeclaration`;
`export default function generate() { … }` is an `ExportDefaultDeclaration`; neither is visited.
`export const generate = memoize(buildContent)` has a `CallExpression` initializer, so wrapping a
function in a memoiser, a logger, a factory or a decorator removes the rule from the declaration. A
bare-verb **method** — `export class ContentService { generate() { … } }` — is not covered, and
`const { generate } = service` puts the reader back at exactly the collision the ruling describes. An
object property holding a function, `export const contentApi = { generate: () => { … } }`, publishes
the verb one indirection down. The set is **hand-written and closed at eighteen entries**, so
`execute`, `emit`, `read`, `write`, `sync`, `init`, `start`, `render`, `validate`, `find`, `save`,
`list`, `format`, `merge` and `serialize` are all legal — `execute` may be the barest verb in the
language and is not in the set. Membership is exact, so `Generate`, `generate_` and `doGenerate` walk
out on one capital, one underscore or one filler word. And `export declare function generate(): void`
is a `TSDeclareFunction`, neither branch.

**Boundary.** It judges **one syntactic position only**: the identifier of a declaration that is itself
the subject of an `export` keyword. Anything published by any other route is outside the rule by
construction, not by permission.

## Detection

Both rules are pure AST walks over declaration names. Nothing here reads the filename, resolves an
import, follows a type alias, or consults the type checker.

| Part | Mechanism |
|---|---|
| `no-version-in-name` walker | Five node types — `FunctionDeclaration`, `ClassDeclaration`, `TSInterfaceDeclaration`, `TSTypeAliasDeclaration` (each requiring `node.id`) and `MethodDefinition` (requiring `node.key.type === "Identifier"`) |
| version test | One regular expression over the identifier's `name`: `/(?:^\|[a-z])V[0-9]+(?:$\|[A-Z_])\|_V[0-9]+/`. Report is placed on the identifier node |
| `no-bare-verb-export` walker | `ExportNamedDeclaration` only; returns when `node.declaration` is absent; takes a `FunctionDeclaration` with an `id`, or loops a `VariableDeclaration`'s declarators requiring `ArrowFunctionExpression` or `FunctionExpression` init and `Identifier` id |
| verb test | Membership in a hand-written `Set` of eighteen strings, exact and case-sensitive. Report is placed on the identifier node |
| path gate | **There is none.** Neither rule reads `context.filename` |
| outside the file | **Nothing.** No module is resolved, no type is resolved, no fixer is shipped. The helper `normalizePath` exists in the source for sibling laws and is used by neither published rule here |

Two mechanisms carry the whole shelf, and both are narrow in the same direction: one is a **regular
expression over a declared name**, the other is a **set membership test at one syntactic position**.
Every open hatch below follows from those two sentences.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `class ContentV2Parser` / `interface IsContentV2Params` / `type V2Body` | All four declaration kinds are visited, and a capital after the digits satisfies the trailing gate |
| A method — `async isV2(params) { … }` | `MethodDefinition` is visited with an `Identifier` key; getters, setters and static methods are the same node |
| A version at the very front — `class V2ContentParser` | The leading `^` alternative covers it |
| A version at the very end — `function parseContentV2` | The trailing `$` alternative covers it |
| `export async function generate(…)` | An `async` function declaration is still a `FunctionDeclaration`; the modifier changes nothing |
| `export const generate = async () => { … }` | The initializer is an `ArrowFunctionExpression`, which the loop accepts |
| `export const generate = function generate() { … }` | `FunctionExpression` is accepted alongside the arrow form |
| `export let generate = () => { … }`, several declarators on one line | The rule reads the `VariableDeclaration` regardless of `kind` and loops **every** declarator |
| `export const generate: ContentGenerator = () => { … }` | The declarator's `id` is still an `Identifier`; the annotation hangs off it and is not consulted |
| Moving or renaming the file | Neither rule reads the filename, so no move and no rename escapes either rule |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `no-version-in-name` | **A variable declarator** — `export const parseV2Body = (body) => { … }` is visited by nothing |
| `no-version-in-name` | **A field** — `TSPropertySignature` and `PropertyDefinition` are not visited, so `isV2` survives on an interface field or a class field |
| `no-version-in-name` | **An abstract member** (`TSAbstractMethodDefinition`), **an object-literal method** (`Property`), and **enums** (`TSEnumDeclaration`, `TSEnumMember`) |
| `no-version-in-name` | **An acronym before the version** — `ContentAPIV2Parser` — and **a lower-case letter after the digits** — `parseV2body` — each disable the first alternative |
| `no-version-in-name` | **Screaming snake** — `const SCHEMA_V2 = …`; the `_V[0-9]+` alternative is very nearly unreachable because no visitor reaches a constant |
| `no-version-in-name` | **Lower-case `v`** — `parse_v2`, `isv2` — and **any other spelling of a moment**: `Schema2`, `Rev2`, `Gen2`, `Legacy`, `Old`, `New`, `Next` |
| `no-bare-verb-export` | **A specifier list** — `export { generate }`, and every barrel file — plus **an aliased re-export**, `export * from`, and `export default function generate` |
| `no-bare-verb-export` | **A wrapped initializer** — `memoize(buildContent)` — **a method on an exported class**, **an object property holding a function**, and `export declare function` |
| `no-bare-verb-export` | **Any verb outside the eighteen** — `execute`, `emit`, `read`, `write`, `sync`, `init`, `start`, `render`, `validate`, `find`, `save`, `list`, `format`, `merge`, `serialize` — and any near-miss spelling: `Generate`, `generate_`, `doGenerate` |
| both | **Any file name at all** — `content-v2.service.ts`, `generate.ts`. Neither rule reads `context.filename`, and `NAME-1`, which is about file names, has no rule |
| neither | **Everything `NAME-1`, `NAME-3`, `NAME-4`, `NAME-6` and `NAME-7` forbid** — a name taken from a folder, from a mechanism, from its first caller, and the boolean shape `checkVerified` that `NAME-6` actually bans |

The pattern behind most of those rows is one sentence: **each rule recognises one exact syntactic
position and falls silent everywhere else rather than reporting.** An early `return` is
indistinguishable, in a build log, from a clean file — and at `warn` the log is green either way.

## Rules

1. The identity of a rule is its **published name**. There is no numeric identifier for a rule in this
   module; the name is what a build log prints and what a disable comment carries.
2. Only rules that exist in the source are documented. A rule that ought to exist is an open risk, not
   a row in the table.
3. Each rule holds exactly one law code, and no code is held by two rules.
4. A version is judged on the **declared name only**, never on a value, a string literal, a field or a
   file path.
5. A bare verb is judged at **one syntactic position only**: the identifier of a declaration that is
   itself the subject of an `export` keyword.
6. Neither rule ships a fixer. Every report is a message, and a replacement name suggested in a message
   is prose, not a patch.
7. Neither rule reads the filename, so the rules cannot be escaped by moving or renaming a file — and
   cannot be relaxed for a fixture either.
8. Neither rule takes options, so a repository cannot weaken one without disabling it, and cannot add a
   verb to the list without changing the shipped rule.
9. Underscore and acronym spelling inside a name is never itself a report; only the version pattern and
   the exact verb string are rulings.
10. Every open hatch is a gap in the **rule**, never a permission granted by the **law**. Code that
    walks past is still wrong.
11. Both rules ship at `warn` by design, not by oversight. "The gate passed" is not "the rules found
    nothing".

## Exceptions

Exceptions are part of the enforcement, not relief from it. Neither rule declares an option, an
allowlist or a per-file opt-out, so each of these is a disable comment that names what it releases.

- **A public wire version.** A route, a payload or a client contract that genuinely publishes a second
  generation to the outside world has a version as part of its identity. `no-version-in-name` cannot
  tell that apart from a schema generation baked into an internal helper, and will report it. The
  honest form is a disable comment naming the published contract — not a rename that makes the rule
  quiet while making the name worse.
- **A protocol or algorithm whose name contains a number.** A name that carries a version because the
  *standard* does is reported by the same regular expression. Same treatment: disable with the standard
  named.
- **A generated or vendored declaration.** A file this tree does not author is disabled at the file
  level with a comment saying who authors it.
- **The test lane is not exempt.** Neither rule gates on the filename, so a helper exported from a test
  tree is judged like any other export. The law's own worked example is an import from a test helper
  module, so this is intent, not oversight.
- **A method on a well-named class** is outside `no-bare-verb-export` by construction, not by
  permission. If the method name is bare, it is reviewed where it is written.

## Output

One block per finding:

```text
file:     <path as written; no rule reads it>
scope:    <in — every parsed file; neither rule gates on filename>
rule:     <no-version-in-name | no-bare-verb-export>
law code: <NAME-2 | NAME-5>
message:  <versioned | bareVerb>
node:     <declaration name identifier | method key | export declarator id>
severity: warn
hatch:    <the open hatch that would have hidden this, or none>
```

A clean file emits one block with `message: none` and the `hatch` line naming any open hatch that
would have hidden a failure of the same kind — silence at `warn` is not compliance. There is no
out-of-scope block for this module: no rule gates on the filename, so no file is ever unjudged for
lack of scope.
