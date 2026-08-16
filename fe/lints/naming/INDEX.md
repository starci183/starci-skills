---
id: fe-lints-naming-index
title: INDEX.md
slug: /fe/lints/naming
sidebar_label: naming
sidebar_position: 0
description: What the three naming rules mechanically see, and — the part nobody writes down — what they do not.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `naming`

## Law

The law is `patterns/naming.md`. It states three things: a module-level function is an arrow const
(`NAMING-1`), something a reader triggers is named `onX` and never `handleX` (`NAMING-2`), and a file
or route name is written in the one language every reader of the repository shares (`NAMING-3`).

This shelf does not restate the law. It records ENFORCEMENT: the exact node a machine looks at, and
the ways of writing that walk past it untouched. A law with no rule is known to be unenforced and
gets reviewed by a person. A leaky rule is BELIEVED to be closed, and nobody reviews it at all — so
the open table below is the reason this file exists, not an appendix to it.

## Rules

Three rules are published. The identity of each is its name; there is no numeric code for a rule,
because the name is already the string that appears in a build log, in a disable comment and in
every conversation about the failure.

| Rule | Law code | What it reports |
|---|---|---|
| `prefer-arrow-export` | `NAMING-1` | A `function` declaration standing at module level, named in the message, with the arrow-const rewrite spelled out |
| `handler-on-prefix` | `NAMING-2` | A binding, JSX attribute or type property whose name begins `handle` + an uppercase letter, quoting the `on…` name it should have been born with |
| `no-second-language-in-path` | `NAMING-3` | One path segment — the first offender only — that carries a second language, either by an accented letter or by an exact match against a named list of romanised segments |

Every published rule maps to a code, and every code in the law has a rule. Two obligations the law
states are NOT enforced by any rule, and they are recorded in `audit.md` rather than mapped here:
the law's demand that the module-level form be an ARROW specifically, and its ban on a name that
says where a thing is used.

## Detection

| Rule | Mechanism |
|---|---|
| `prefer-arrow-export` | Visits `FunctionDeclaration`. Reads `node.parent.type` and continues only when it is `Program`, `ExportNamedDeclaration` or `ExportDefaultDeclaration`. Reports on `node.id`, falling back to the node when the declaration is anonymous; the message interpolates `node.id.name`, or the literal `default`. |
| `handler-on-prefix` | Visits exactly three node types. `VariableDeclarator`, only when `node.id.type === "Identifier"`. `JSXAttribute`, reading `node.name.name`. `TSPropertySignature`, only when `node.key.type === "Identifier"`. Each name is tested against `/^handle[A-Z]/`; the message is built from `name.slice("handle".length)`. |
| `no-second-language-in-path` | Reads `context.filename` (falling back to `context.getFilename()`) BEFORE returning any visitor. Normalises backslashes to `/`, lowercases the whole string, splits on `/`, drops empty segments. A segment offends if a single-alphabet accented-letter regex matches it, OR if the segment with `(`, `)`, `[` and `]` removed is an exact member of a 20-entry list of romanised segments. Only the first offender survives `.find`. When nothing offends, the rule returns an empty visitor object and the file is never walked; otherwise it reports once on `Program`. |

## Escape Hatches

### Closed — looks like it would slip past, does not

| Way of writing | Rule | Why it still fires |
|---|---|---|
| `export async function load() {}` | `prefer-arrow-export` | `async` does not change the node type; it is still a `FunctionDeclaration` under `ExportNamedDeclaration` |
| `function* walk() {}` | `prefer-arrow-export` | Same node type; generators are not a separate case |
| `export default function () {}` | `prefer-arrow-export` | Anonymous, so `node.id` is null — the report falls back to the node and the message says `default` rather than silently skipping |
| `let handleClick = …` / `var handleClick = …` | `handler-on-prefix` | The visitor is `VariableDeclarator`, which every declaration kind produces; `const` is not special-cased |
| `const handleClick = useCallback(() => {}, [])` | `handler-on-prefix` | The initialiser is never inspected; only the declared identifier is |
| `<Field handleChange={fn} />` | `handler-on-prefix` | A JSX attribute is checked by its own name, independently of what the receiving component's type says |
| `app/(marketing)/dang-nhap/page.tsx` | `no-second-language-in-path` | Route-group parentheses and dynamic-segment brackets are stripped before the list comparison |
| `app/DANG-KY/page.tsx` | `no-second-language-in-path` | The whole path is lowercased before any comparison |
| `src/components/Đăng nhập/index.tsx` | `no-second-language-in-path` | The accented branch matches anywhere in the segment; no separator or word boundary is required |

### Open — genuinely not caught

| Way of writing | Rule | Why the rule cannot see it |
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
| A romanised segment outside the 20-entry list — `bai-hoc`, `nguoi-dung`, `dat-hang` | `no-second-language-in-path` | Membership is exact-list. The list is deliberate, not lazy: inferred matching would refuse `capacity` and `dangerous`, and a rule that fires on the shared language is one a repository switches off |
| `dang-nhap-v2`, `auth-dang-nhap`, `dangnhap`, `dang_nhap` | `no-second-language-in-path` | The comparison is equality on the whole segment. Any prefix, suffix or different separator escapes |
| `[...dang-nhap]` and `@dang-nhap` | `no-second-language-in-path` | The strip set is exactly `(`, `)`, `[`, `]`. A catch-all's leading dots and a parallel-route `@` survive and break equality |
| A folder holding no lintable file — static assets, documents, images | `no-second-language-in-path` | The rule fires from inside a linted file. A second-language folder that contains none is never visited by the linter at all |
| A route declared as a string: a rewrite table, a redirect map, a router config, a hand-built `href` | `no-second-language-in-path` | The rule reads a FILENAME. The public address — the part of the law that names customers and support tickets — can be in a second language with no file to point at |
| A second language whose alphabet is not the one encoded, or a script with no Latin letters | `no-second-language-in-path` | The accented branch enumerates one language's letters; the list enumerates one language's words. The rule's name is general, its knowledge is not |
| A path with two offending segments | `no-second-language-in-path` | `.find` stops at the first. Rename it and the same rule fires again on the next one — correct, but a reader reading one message will under-estimate the work |

## Inputs

| Input | Evidence required |
|---|---|
| source | A parsed file; every rule here works on the syntax tree alone, with no type information |
| parser | TypeScript with JSX enabled — two of `handler-on-prefix`'s three visitors are TypeScript or JSX nodes and are silently never reached otherwise |
| `context.filename` | An absolute path as the linter reports it, which `no-second-language-in-path` reads before it returns any visitor |
| glob | The consuming configuration decides which files are linted. A file no glob names is a file no rule here exists for |
| severity | The rules' own opinion is `error` for all three; the consuming configuration remains the authority on what is switched on |

## Invariants

- A rule's identity is its published name. No rule carries a numeric code, and no message is
  addressed by anything but the rule name.
- Every rule reports at a node a reader can put a cursor on: the declaration's identifier, the
  offending attribute or key, or the file's `Program` node.
- No rule reads type information, resolves an import or inspects a value. Everything in this shelf
  is decided from shape and from the file's own path.
- `no-second-language-in-path` is a per-file decision made once, before traversal, and produces at
  most one report per file.
- Message text names the replacement, not only the offence. Each message contains the exact
  rewritten spelling the author should use.
- The rules are shape rules and cannot see intent; every one of them is deliberately narrow because
  of it, and the cost of that narrowness is the open table above.

## Exceptions

- **A nested `function` is not an exception, it is a blind spot.** Nothing grants it; the rule simply
  cannot reach it. Treat it as unenforced law, not as permitted writing.
- **A romanised segment outside the list is not permitted.** The list bounds what a machine will
  claim, not what the law forbids. Review remains the enforcement for everything the list omits.
- **The word `handle` as a domain noun** — a person's public handle, a resource handle — collides
  with the regex. `const handleAvailable = …` fires on a name the law has no opinion about. This is
  the one place where a correct name must be spelled around the rule; rename the variable to avoid
  the prefix rather than disable the rule for the file.
- **A generated or vendored file** is outside every rule here by way of the consuming glob, not by
  way of any rule-level exemption.

## Output

```text
rule: <prefer-arrow-export | handler-on-prefix | no-second-language-in-path>
code: <NAMING-1 | NAMING-2 | NAMING-3>
node: <the exact node the rule visits>
verdict: <fires | silent>
hatch: <none | the open row from the table above that explains the silence>
```

A `silent` verdict with `hatch: none` is a claim that the writing is clean. A `silent` verdict that
names a hatch is a claim that the writing is unreviewed — a different fact, and the one this shelf
exists to keep sayable.

## Load Policy

Read this file first. Read `vi.md` for each rule stated in business terms and for the open door under
each one, `example.md` for the code that fires and the code that slips through, `audit.md` while
reviewing whether these rules still deserve trust, and `changelog.md` for what changed and when.

## Scope

This module documents only rules that exist in the source file that publishes them. A rule that
ought to exist and does not is not documented here — it is a finding in `audit.md`. A rule that
cannot be pointed at is a proposal, not a rule.

## Version Rule

Increment all five records by `0.01` for an accepted change to what these rules do or to what this
shelf claims about them, and record it in `changelog.md`. A new rule in the source is a change to
this module even when the law does not move.
