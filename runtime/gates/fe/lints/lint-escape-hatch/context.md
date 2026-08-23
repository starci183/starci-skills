# Lint-escape-hatch

## LOADS

None.

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, what it reported and on which node,
which law code that maps to, and the open hatch that would have hidden the same failure. This module
chooses nothing. It refuses, and it must be able to point at the comment it refuses on.

## Law

A file may not decide whether repository law applies to it. When one line of comment switches a rule
off in place, the person who wrote the fault is also the person ruling that it is not a fault.

The law carries **three codes** — `LINT-ESCAPE-1`, `LINT-ESCAPE-2` and `LINT-ESCAPE-3`. The rule set
publishes **one rule**, and that one rule holds `LINT-ESCAPE-1` whole, half of `LINT-ESCAPE-2`, and
nothing of `LINT-ESCAPE-3`. What this module documents is enforcement, not law: not what the law says,
but what a linter can see of it and what it cannot. A law with no rule is known to be unenforced. A
rule believed to be closed while it is open is worse, because the belief is what stops anyone from
looking.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `no-inline-lint-config` | `LINT-ESCAPE-1` | A comment inside product source whose body begins with an ESLint `disable`, `disable-line`, `disable-next-line` or `enable` directive |

`LINT-ESCAPE-2` is only half held by a rule. The rule reports the attempted bypass; the exported
`linterOptions.noInlineConfig` is what makes the bypass ineffective. That half is flat configuration a
consuming repository must apply, not a rule that can fail a build on its own — so the second half is
unenforced by any rule rather than covered.

`LINT-ESCAPE-3` has **no rule at all**. Nothing scans for an allowlist. What stands in for one is the
rule's `schema: []` — the rule accepts no options, so no per-path exemption can be handed to it. That
closes one door and leaves the configuration file wide open. A green run says nothing about
`LINT-ESCAPE-3`.

## Reading a diff

1. **Decide scope before anything else, and record it.** The path gate is a substring test for
   `/src/` after separator normalisation. Out of scope here does not mean the file passed — it means
   `create` returned `{}` and the rule did not exist for that file.
2. **Check the exemptions.** There are none in code. The only boundary that looks like one is a rule
   fixture living outside every `/src/` segment, which is the gate working, not a grant.
3. **Read the nodes.** Every `Line` and `Block` comment the parser attached, body untrimmed, each one
   tested from the start of the body.
4. **Emit one block per finding** — one per matching comment node.
5. **Write the `hatch` line** whenever an open hatch would have hidden the same failure, including on
   a file that reports nothing.
6. **Do not report what no rule watches.** A severity comment, an allowlist in flat configuration, an
   unwired plugin: none of these has a machine, and a verdict that claims otherwise is wrong about the
   module.

## `no-inline-lint-config` — LINT-ESCAPE-1

**What it reports.** One report per comment node whose body begins with a directive that changes the
running rule set: `eslint-disable`, `eslint-disable-line`, `eslint-disable-next-line`,
`eslint-enable`. Reported on the comment node itself, `messageId: "directive"`. A reason written after
the directive changes nothing — the reason records the bypass, it does not prevent it.

**How it detects.** File gate: `context.filename` (falling back to `context.getFilename()`),
backslashes rewritten to forward slashes, must contain the substring `/src/`; otherwise `create`
returns `{}`. Visitor: a single `Program` node handler. Source: `context.sourceCode.getAllComments()`.
Match: `comment.value` tested against
`/^\s*eslint-(?:disable(?:-next-line|-line)?|enable)\b/`. Options: `schema: []`.

**What it cannot see.** The bare configuration comment `/* eslint some-rule: "off" */` — the pattern
knows only the `disable`/`enable` family, so the most literal form of inline lint configuration is not
matched, and the rule's name promises more than its matcher delivers. `/* eslint-env node */` and
`/* globals FLAG */` fall through the same family gap. Any file whose path has no `/src/` segment, and
the same file named relatively as `src/thing.tsx` with no separator before `src`. An exemption written
in the flat configuration instead of the file. Directive text stored as a string and emitted later.
Comments in a surface the parser does not hand over. A consuming configuration that omits
`linterOptions.noInlineConfig`. And the plugin simply not being wired.

**Boundary.** The rule reports; the configuration fence neutralises. Neither substitutes for the
other, and this module must say which one is holding which half. Under-catching prose is intentional:
a sentence that merely mentions a directive is deliberately not reported, because a directive a linter
would obey always sits at the start of its comment.

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | `normalizePath` rewrites backslashes to forward slashes before the gate, so a Windows path decides the same way |
| file gate | The normalised path must contain the substring `/src/`; otherwise `create` returns `{}` and the rule does not exist for that file |
| visitor | A single `Program` node handler, run once on entering the program |
| reader | `context.sourceCode.getAllComments()` — every `Line` and `Block` comment node the parser attached |
| match | `comment.value` against `/^\s*eslint-(?:disable(?:-next-line|-line)?|enable)\b/` |
| report | On the comment node, `messageId: "directive"` |
| options | `schema: []` — no configuration surface |
| outside the file | `linterOptions.noInlineConfig` in the consuming flat configuration; it is a separate export, not a rule |

Three details of that pattern decide most of the behaviour below:

- `^` anchors at the start of the comment **body**, which is the only place a linter honours a
  directive. An unanchored pattern matched the word instead of the directive and reported prose that
  merely mentioned one, so writing the explanation became the violation.
- `\s` covers newlines, so a block comment carrying its directive on a later line is still matched.
- `\b` ends the match at the directive word, so a trailing reason is ignored and a longer word such as
  `eslint-disabled` is not a match at all.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written form | Why it does not slip past |
|---|---|
| `//eslint-disable-next-line rule` with no space | `^\s*` permits zero whitespace as readily as one space |
| `// eslint-disable-next-line rule -- reason` | `\b` closes the match at the directive; whatever follows is never consulted, so a reason buys nothing |
| A block comment with the directive on its second line | `\s` includes the newline, so `^\s*` still reaches the directive |
| `{/* eslint-disable rule */}` inside markup | A markup comment expression holds an ordinary comment node; `getAllComments()` returns it |
| An absolute path written with backslashes | `normalizePath` rewrites separators before the `/src/` test, so a path form is not a bypass |
| `/* eslint-disable */` aimed at this very rule | It is reported like any other directive, and where the flat config applies `linterOptions.noInlineConfig` it is inert before it can help |
| `/* eslint-enable */` used alone to reopen a span | `enable` is its own alternative in the pattern, not an afterthought |
| `eslint-disabled` appearing as a word | `\b` cannot match between `e` and `d`, so the longer word is not the directive |
| A sentence explaining that a file carries no such directive | Deliberately not reported. The rule under-catches exactly where the linter itself under-honours, which is not a hole but the boundary of the thing being enforced |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Way of writing | Why the rule misses it |
|---|---|
| The bare configuration comment: `/* eslint some-rule: "off" */` | The pattern knows only the `disable`/`enable` family. A severity comment is inline lint configuration, is honoured by the linter, and is not matched. The rule's name promises more than its matcher delivers |
| `/* eslint-env node */`, `/* globals FLAG */` | Same family gap. Both change how the file is linted; neither begins with `eslint-disable` or `eslint-enable` |
| Any file whose path has no `/src/` segment | A root-level route, view or utility folder is outside the gate. The rule does not weaken there — it is absent |
| A path passed without a leading separator, e.g. piped source linted as `src/thing.tsx` | The gate tests for `/src/`, and a relative path has no separator before `src`. The same file, named two ways, is governed in one and unseen in the other |
| An exemption written in the flat configuration instead of the file: a path-scoped block setting the rule to `off` or `warn` | The rule reads comments in source. It never reads configuration, so the one shape `LINT-ESCAPE-3` forbids most is the one shape nothing inspects |
| Directive text stored as a string and emitted later: `const BANNER = "// eslint-disable-next-line"` | A string literal is not a comment. Whatever writes that banner into a file has laundered the directive past a comment-only scan |
| Comments in a surface the parser does not hand over: markup comments, a template dialect, a file type with no parser registered | `getAllComments()` returns what the parser attached. What it did not attach cannot be reported |
| A consuming configuration that omits `linterOptions.noInlineConfig` | Then `/* eslint-disable <this rule id> */` at the top of a file silences the guard before it reports — a rule turned off by the exact comment it forbids. The report and the fence are separate exports and only one of them is a rule |
| Dropping the rule from the plugin, or not spreading `recommended` | No rule polices its own registration. Enforcement that is not wired is indistinguishable from a law nobody wrote |

Every open hatch above is a documented gap, not a permission. Writing one of those forms to avoid a
report is the violation the law names, whether or not a build agrees.

## Inputs

| Input | Evidence required |
|---|---|
| filename | The value the linter reports for the file, before normalisation |
| comment set | Every comment node the parser attached to the program |
| comment body | The text after the delimiter, untrimmed |
| flat configuration | Whether `linterOptions.noInlineConfig` is applied beside the recommended rules |
| severity | Whether the effective configuration keeps the rule at `error` |

## Rules

1. The identity of the rule is its published name. It carries no numeric code of its own.
2. The rule reports; the configuration fence neutralises. Neither substitutes for the other.
3. The rule accepts no options, so no exemption can be passed to it at a call site.
4. Under-catching prose is intentional; a directive a linter would obey always sits at the start of
   its comment.
5. Every open hatch above is a documented gap, not a permission. Writing one of those forms to avoid a
   report is the violation the law names, whether or not a build agrees.
6. Out of scope means `create` returned `{}` and no visitor was installed, not that the file passed.
7. Only rules that actually exist in the rule set are written here. A rule that ought to exist is a
   recorded risk, not a published rule.
8. Every rule carries at least one honestly written open hatch, or a clear argument that it is closed.
   Writing "none" to tidy the table is forbidden.

## Exceptions

None. `LINT-ESCAPE-3` states there is no allowlist, and the rule's empty option schema means there is
no place to write one. Nothing in code releases a file, a path or a directive.

One boundary is often mistaken for an exception: rule fixtures that construct forbidden directives on
purpose live outside any `/src/` segment. That is the gate doing its job on a file that is not product
source, not an exemption granted to product source.

## Output

One block per finding:

```text
rule: no-inline-lint-config
code: LINT-ESCAPE-1
file: <path containing a /src/ segment>
node: <the comment node, Line or Block>
message: Inline ESLint configuration makes this file the author of whether repository law
         applies. Remove the directive and fix the code or the shared rule; there is no local
         exception path.
hatch: <the open hatch that would have hidden this, or none>
```

A file inside `/src/` with no matching comment emits one block with `node: none`, `message: none` and
the `hatch` line naming any open hatch that applies. A file outside `/src/` emits one block with
`node: none`, `message: none` and `hatch: no /src/ segment — create returned {}, the rule did not
exist for this file`; it was not judged clean.
