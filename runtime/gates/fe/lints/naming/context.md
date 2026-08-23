# Naming

## LOADS

None.

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was linted at all, which published rule fired, on which node it fired, which law code
that maps to, and the open hatch that would have hidden the same failure. This module chooses no name.
It refuses one, and it must be able to point at the character it refuses on.

## Law

The law is `patterns/naming.md`. It states three things: a module-level function is an arrow const
(`NAMING-1`), something a reader triggers is named `onX` and never `handleX` (`NAMING-2`), and a file
or route name is written in the one language every reader of the repository shares (`NAMING-3`).

The law states **three codes, and all three have a rule.** That is not a claim of coverage. Two
obligations the law states in words are enforced by no rule at all: the demand that the module-level
form be an ARROW specifically, and the ban on a name that says where a thing is used. This module does
not restate the law; it records ENFORCEMENT — the exact node a machine looks at, and the ways of
writing that walk past it untouched. A law with no rule is known to be unenforced and gets reviewed by
a person. A leaky rule is BELIEVED to be closed, and nobody reviews it at all — so the open table below
is the reason this file exists, not an appendix to it.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `prefer-arrow-export` | `NAMING-1` | A `function` declaration standing at module level, named in the message, with the arrow-const rewrite spelled out |
| `handler-on-prefix` | `NAMING-2` | A binding, JSX attribute or type property whose name begins `handle` + an uppercase letter, quoting the `on…` name it should have been born with |
| `no-second-language-in-path` | `NAMING-3` | One path segment — the first offender only — that carries a second language, either by an accented letter or by an exact match against a named list of romanised segments |
| `no-direct-const-alias` | machine-only identity | A `const A = B` declarator whose binding and initializer are both identifiers, because it gives one value two names without adding behavior |

Every code the law states has a rule, while `no-direct-const-alias` is explicitly machine-only:
**no code here is left without a machine, and no machine-only identity is assigned a false code.**
What is left unenforced is narrower than a code and must not be read as covered —
`NAMING-1`'s demand for an ARROW specifically, and the law's ban on a name that says where a thing is
used, have no rule watching them. A green run says nothing about either.

The identity of each rule is its name; there is no numeric code for a rule, because the name is already
the string that appears in a build log, in a disable comment and in every conversation about the
failure.

## Reading a diff

1. **Decide scope before anything else, and record it.** The consuming configuration's glob decides
   which files are linted. A file no glob names is not a file that passed — it is a file no rule here
   existed for, and it is unjudged.
2. **Check the exemptions.** A generated or vendored file is outside every rule here by way of the glob,
   not by way of any rule-level exemption. A `handle` used as a domain noun is a known collision, not a
   grant.
3. **Read the nodes, not the text.** `prefer-arrow-export` reads `FunctionDeclaration` and its parent;
   `handler-on-prefix` reads exactly three node types; `no-second-language-in-path` reads
   `context.filename` before any visitor exists; `no-direct-const-alias` reads a const
   `VariableDeclarator` whose two sides are identifiers. A name in a comment or string is invisible.
4. **Emit one block per finding.** `no-second-language-in-path` produces at most one report per file;
   the other two report once per offending node.
5. **Write the `hatch` line whenever an open hatch would have hidden the same failure.** A `silent`
   verdict with `hatch: none` claims the writing is clean; a `silent` verdict naming a hatch claims the
   writing is unreviewed. They are different facts.
6. **Do not report what no rule watches.** Nothing here checks that a module-level form is an arrow, and
   nothing here checks a name that says where a thing is used.

## `prefer-arrow-export` — NAMING-1

**What it reports.** A `function` declaration whose direct parent is the module body, a named `export`
or an `export default`. The message names the function and spells out the replacement:
`const <name> = (...) => {...}`.

**How it detects.** Visits `FunctionDeclaration`. Reads `node.parent.type` and continues only when it is
`Program`, `ExportNamedDeclaration` or `ExportDefaultDeclaration`. Reports on `node.id`, falling back to
the node when the declaration is anonymous; the message interpolates `node.id.name`, or the literal
`default`.

**What it cannot see.** A `function` declaration inside a component body, an `if` block, a test callback
or a class static block — the parent is `BlockStatement` or similar, so the module-level guard returns
early, while hoisting, the actual failure the law names, still happens inside that scope.
`const load = function () { … }` is a `FunctionExpression`, not a `FunctionDeclaration`: the binding is
not hoisted, so the hoisting argument is satisfied, but it is not an arrow — the rule's own name
promises more than it checks. `export default () => {}` has no declaration node to report, so the law's
second stated concern, an export with no name to grep at its call sites, is unenforced.
`declare function fetchQuota(): void` and overload signatures parse as `TSDeclareFunction`, a different
node type the visitor never receives.

**Boundary.** This rule judges the SHAPE of a module-level declaration. It never judges the name it
carries; a module-level `function handleSubmit()` fires here for its shape and is invisible to
`handler-on-prefix`.

## `handler-on-prefix` — NAMING-2

**What it reports.** A name matching `/^handle[A-Z]/` in exactly three places, with the message built
from `name.slice("handle".length)` and read back as `on…`.

**How it detects.** Visits exactly three node types. `VariableDeclarator`, only when
`node.id.type === "Identifier"`. `JSXAttribute`, reading `node.name.name`. `TSPropertySignature`, only
when `node.key.type === "Identifier"`. Three visitors, one shared test. It reads no initialiser, no
type and no import — only the string of the name and the kind of node holding it.

**What it cannot see.** `const Row = ({ handleClick }) => …`: the declarator's `id` is an `ObjectPattern`
and the guard requires `Identifier`, and destructured props are where handler names most often arrive.
`(handleClick) => …` and `function f(handleClick)` are not `VariableDeclarator`s at all; no parameter
node is visited. `function handleSubmit() {}` inside a component is a `FunctionDeclaration`, not a
declarator — `prefer-arrow-export` would catch its SHAPE at module level but never its NAME, and nested
it is invisible to both rules. `const handlers = { handleClick: fn }` is a `Property` and a class method
`handleClick() {}` is a `MethodDefinition`; neither is visited. `type Props = { handleClick(): void }` is
a `TSMethodSignature`, not a `TSPropertySignature` — same meaning, different node type, silence.
`type Props = { "handleClick": () => void }` has a string-literal key where the guard requires
`Identifier`. `clickHandler`, `submitHandler`, `doSubmit` and `handle_click` all fall outside a regex
anchored on `handle` followed by an uppercase letter, and the suffix spelling is the most common
alternative vocabulary for exactly the idea the law wants unified. `<Field {...{ handleChange }} />` is a
`JSXSpreadAttribute`; the rule only sees a named attribute.

**Boundary.** This rule keys on a name at a declaration site, not on what a value is or does. A
correctly named `onSubmit` holding a mis-shaped function is not this rule's business.

## `no-second-language-in-path` — NAMING-3

**What it reports.** Exactly one path segment — the first offender only — of the file being linted,
reported once on `Program`.

**How it detects.** Reads `context.filename` (falling back to `context.getFilename()`) BEFORE returning
any visitor. Normalises backslashes to `/`, lowercases the whole string, splits on `/`, drops empty
segments. A segment offends if a single-alphabet accented-letter regex matches it, OR if the segment
with `(`, `)`, `[` and `]` removed is an exact member of a 20-entry list of romanised segments. Only the
first offender survives `.find`. When nothing offends, the rule returns an empty visitor object and the
file is never walked; otherwise it reports once on `Program`.

**What it cannot see.** A romanised segment outside the 20-entry list — `bai-hoc`, `nguoi-dung`,
`dat-hang` — passes, because membership is exact-list. That list is deliberate, not lazy: inferred
matching would refuse `capacity` and `dangerous`, and a rule that fires on the shared language is one a
repository switches off. `dang-nhap-v2`, `auth-dang-nhap`, `dangnhap` and `dang_nhap` escape, because
the comparison is equality on the whole segment; any prefix, suffix or different separator defeats it.
`[...dang-nhap]` and `@dang-nhap` escape, because the strip set is exactly `(`, `)`, `[`, `]`, so a
catch-all's leading dots and a parallel-route `@` survive and break equality. A folder holding no
lintable file — static assets, documents, images — is never visited by the linter at all, since the rule
fires from inside a linted file. A route declared as a string — a rewrite table, a redirect map, a
router config, a hand-built `href` — is invisible, because the rule reads a FILENAME while the public
address, the part of the law that names customers and support tickets, lives in the string. A second
language whose alphabet is not the one encoded, or a script with no Latin letters, passes: the accented
branch enumerates one language's letters and the list enumerates one language's words, so the rule's
name is general and its knowledge is not. A path with two offending segments yields one message, because
`.find` stops at the first — rename it and the same rule fires again on the next, correct but liable to
make a reader under-estimate the work. And the rule reaches too far: the whole absolute path is scanned,
including the part OUTSIDE the repository, so a working copy sitting under an accented folder makes
every file in the repository report at once, on a segment nobody in the repository can fix.

**Boundary.** This rule decides once per file, from the path alone, before traversal. Nothing inside the
file changes its verdict, and no other rule here reads a path.

## `no-direct-const-alias` — machine-only identity

**What it reports.** The declared identifier in `const A = B` when both `A` and `B` are plain
identifiers. The message names both and requires the original identifier to be used directly, or the
new const to hold the result of a real transformation.

**How it detects.** Visits `VariableDeclarator`, requires the parent declaration kind to be `const`,
then requires `node.id.type` and `node.init.type` both to be `Identifier`. It does not resolve imports
or types and does not care whether either name is PascalCase.

**What it cannot see.** `let A = B`, `const A = object.B`, destructuring, an import alias, a re-export,
or a wrapper call such as `const A = identity(B)`. Those are different AST shapes; this rule is the
literal refusal of direct const aliases, not a data-flow equivalence engine.

**Boundary.** A member access, call, `await`, literal, or constructed value adds an operation and is not
this rule. Whether that operation is useful belongs to its own law.

## Detection

| Part | Mechanism |
|---|---|
| `prefer-arrow-export` | Visits `FunctionDeclaration`. Reads `node.parent.type` and continues only when it is `Program`, `ExportNamedDeclaration` or `ExportDefaultDeclaration`. Reports on `node.id`, falling back to the node when the declaration is anonymous; the message interpolates `node.id.name`, or the literal `default`. |
| `handler-on-prefix` | Visits exactly three node types. `VariableDeclarator`, only when `node.id.type === "Identifier"`. `JSXAttribute`, reading `node.name.name`. `TSPropertySignature`, only when `node.key.type === "Identifier"`. Each name is tested against `/^handle[A-Z]/`; the message is built from `name.slice("handle".length)`. |
| `no-second-language-in-path` | Reads `context.filename` (falling back to `context.getFilename()`) BEFORE returning any visitor. Normalises backslashes to `/`, lowercases the whole string, splits on `/`, drops empty segments. A segment offends if a single-alphabet accented-letter regex matches it, OR if the segment with `(`, `)`, `[` and `]` removed is an exact member of a 20-entry list of romanised segments. Only the first offender survives `.find`. When nothing offends, the rule returns an empty visitor object and the file is never walked; otherwise it reports once on `Program`. |
| `no-direct-const-alias` | Visits `VariableDeclarator`; reports when the parent kind is `const` and both `id` and `init` are `Identifier` nodes. |
| what reaches outside the file | Only `context.filename`. No rule reads type information, resolves an import or inspects a value; everything else is decided from shape inside the file. |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Rule | Why it still fires |
|---|---|---|
| `export async function load() {}` | `prefer-arrow-export` | `async` does not change the node type; it is still a `FunctionDeclaration` under `ExportNamedDeclaration` |
| `function* walk() {}` | `prefer-arrow-export` | Same node type; generators are not a separate case |
| `export default function () {}` | `prefer-arrow-export` | Anonymous, so `node.id` is null — the report falls back to the node and the message says `default` rather than silently skipping |
| `let handleClick = …` / `var handleClick = …` | `handler-on-prefix` | The visitor is `VariableDeclarator`, which every declaration kind produces; `const` is not special-cased |
| `const handleClick = useCallback(() => {}, [])` | `handler-on-prefix` | The initialiser is never inspected; only the declared identifier is |
| `<Field handleChange={fn} />` | `handler-on-prefix` | A JSX attribute is checked by its own name, independently of what the receiving component's type says |
| `const localValue: typeof sourceValue = sourceValue` | `no-direct-const-alias` | A type annotation does not change either identifier node or the parent declaration kind |
| `app/(marketing)/dang-nhap/page.tsx` | `no-second-language-in-path` | Route-group parentheses and dynamic-segment brackets are stripped before the list comparison |
| `app/DANG-KY/page.tsx` | `no-second-language-in-path` | The whole path is lowercased before any comparison |
| `components/Đăng nhập/index.tsx` | `no-second-language-in-path` | The accented branch matches anywhere in the segment; no separator or word boundary is required |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Written this way | Rule | Why the rule cannot see it |
|---|---|---|
| A `function` declaration inside a component body, an `if` block, a test callback or a class static block | `prefer-arrow-export` | The parent is `BlockStatement` or similar, so the module-level guard returns early. Hoisting — the actual failure the law names — still happens inside that scope |
| `const load = function () { … }` | `prefer-arrow-export` | A `FunctionExpression` is not a `FunctionDeclaration`. The binding is not hoisted, so the hoisting argument is satisfied, but it is not an arrow — the rule's own name promises more than it checks |
| `export default () => {}` | `prefer-arrow-export` | Nothing to report: there is no declaration node. The law's second stated concern — an export with no name to grep at its call sites — is unenforced |
| `declare function fetchQuota(): void` and overload signatures | `prefer-arrow-export` | These parse as `TSDeclareFunction`, a different node type the visitor never receives |
| `const Row = ({ handleClick }) => …` | `handler-on-prefix` | The declarator's `id` is an `ObjectPattern`, and the guard requires `Identifier`. Destructured props are where handler names most often arrive |
| `(handleClick) => …` and `function f(handleClick)` | `handler-on-prefix` | A parameter is not a `VariableDeclarator` at all; no parameter node is visited |
| `function handleSubmit() {}` inside a component | `handler-on-prefix` | A `FunctionDeclaration`, not a declarator. `prefer-arrow-export` would catch its SHAPE at module level but never its NAME, and nested it is invisible to both rules |
| `const handlers = { handleClick: fn }` and a class method `handleClick() {}` | `handler-on-prefix` | `Property` and `MethodDefinition` are not visited |
| `type Props = { handleClick(): void }` | `handler-on-prefix` | A method-shaped member is a `TSMethodSignature`, not a `TSPropertySignature` |
| `type Props = { "handleClick": () => void }` | `handler-on-prefix` | The key is a string literal, and the guard requires `Identifier` |
| `clickHandler`, `submitHandler`, `doSubmit`, `handle_click` | `handler-on-prefix` | The regex is anchored on `handle` followed by an uppercase letter. The suffix spelling is the most common alternative vocabulary and is entirely invisible |
| `<Field {...{ handleChange }} />` | `handler-on-prefix` | A spread is a `JSXSpreadAttribute`; the rule only sees a named attribute |
| `const Alias = object.Original`, `const Alias = identity(Original)`, or `import { Original as Alias }` | `no-direct-const-alias` | Member access, calls and import specifiers are not direct identifier-to-identifier const declarators |
| A romanised segment outside the 20-entry list — `bai-hoc`, `nguoi-dung`, `dat-hang` | `no-second-language-in-path` | Membership is exact-list. The list is deliberate, not lazy: inferred matching would refuse `capacity` and `dangerous`, and a rule that fires on the shared language is one a repository switches off |
| `dang-nhap-v2`, `auth-dang-nhap`, `dangnhap`, `dang_nhap` | `no-second-language-in-path` | The comparison is equality on the whole segment. Any prefix, suffix or different separator escapes |
| `[...dang-nhap]` and `@dang-nhap` | `no-second-language-in-path` | The strip set is exactly `(`, `)`, `[`, `]`. A catch-all's leading dots and a parallel-route `@` survive and break equality |
| A folder holding no lintable file — static assets, documents, images | `no-second-language-in-path` | The rule fires from inside a linted file. A second-language folder that contains none is never visited by the linter at all |
| A route declared as a string: a rewrite table, a redirect map, a router config, a hand-built `href` | `no-second-language-in-path` | The rule reads a FILENAME. The public address — the part of the law that names customers and support tickets — can be in a second language with no file to point at |
| A second language whose alphabet is not the one encoded, or a script with no Latin letters | `no-second-language-in-path` | The accented branch enumerates one language's letters; the list enumerates one language's words. The rule's name is general, its knowledge is not |
| A path with two offending segments | `no-second-language-in-path` | `.find` stops at the first. Rename it and the same rule fires again on the next one — correct, but a reader reading one message will under-estimate the work |
| A checkout placed under an accented folder outside the repository | `no-second-language-in-path` | The whole absolute path is scanned, including the part outside the repository, so every file reports at once on a segment nobody in the repository can fix |

## Inputs

| Input | Evidence required |
|---|---|
| source | A parsed file; every rule here works on the syntax tree alone, with no type information |
| parser | TypeScript with JSX enabled — two of `handler-on-prefix`'s three visitors are TypeScript or JSX nodes and are silently never reached otherwise |
| `context.filename` | An absolute path as the linter reports it, which `no-second-language-in-path` reads before it returns any visitor |
| glob | The consuming configuration decides which files are linted. A file no glob names is a file no rule here exists for |
| severity | The rules' own opinion is `error` for all four; the consuming configuration remains the authority on what is switched on |

## Rules

1. A rule's identity is its published name. No rule carries a numeric code, and no message is addressed
   by anything but the rule name.
2. Every rule reports at a node a reader can put a cursor on: the declaration's identifier, the
   offending attribute or key, or the file's `Program` node.
3. No rule reads type information, resolves an import or inspects a value. Everything in this module is
   decided from shape and from the file's own path.
4. `no-second-language-in-path` is a per-file decision made once, before traversal, and produces at most
   one report per file.
5. Message text names the replacement, not only the offence. Each message contains the exact rewritten
   spelling the author should use.
6. The rules are shape rules and cannot see intent; every one of them is deliberately narrow because of
   it, and the cost of that narrowness is the open table above.
7. A rule name is never rewritten, even when it carries a product word, because it is the string the
   build prints.

## Exceptions

- **A nested `function` is not an exception, it is a blind spot.** Nothing grants it; the rule simply
  cannot reach it. Treat it as unenforced law, not as permitted writing.
- **A romanised segment outside the list is not permitted.** The list bounds what a machine will claim,
  not what the law forbids. Review remains the enforcement for everything the list omits.
- **The word `handle` as a domain noun** — a person's public handle, a resource handle — collides with
  the regex. `const handleAvailable = …` fires on a name the law has no opinion about. This is the one
  place where a correct name must be spelled around the rule; rename the variable to avoid the prefix
  rather than disable the rule for the file, because one file-wide disable opens the door for every
  mis-named handler in that file.
- **A generated or vendored file** is outside every rule here by way of the consuming glob, not by way
  of any rule-level exemption.

## Output

One block per finding:

```text
rule: <prefer-arrow-export | handler-on-prefix | no-second-language-in-path | no-direct-const-alias>
code: <NAMING-1 | NAMING-2 | NAMING-3 | machine-only identity>
node: <the exact node the rule visits>
verdict: <fires | silent>
hatch: <none | the open row from the table above that explains the silence>
```

A clean file emits one block per rule with `verdict: silent` and `hatch: none` — a claim that the
writing was judged and passed. A file no glob names emits no block at all; record the scope decision in
words instead, because no visitor was installed and the rule did not exist for that file. A `silent`
verdict that names a hatch is a claim that the writing is unreviewed — a different fact, and the one
this module exists to keep sayable.
