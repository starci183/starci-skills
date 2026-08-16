---
id: fe-lints-lint-escape-hatch-index
title: INDEX.md
slug: /fe/lints/lint-escape-hatch
sidebar_label: lint-escape-hatch
sidebar_position: 0
description: What the machine actually sees of the lint-escape-hatch law, and every way of writing that still walks past it.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `lint-escape-hatch`

## Law

The law is stated in `patterns/lint-escape-hatch.md` and carries three codes, `LINT-ESCAPE-1`,
`LINT-ESCAPE-2` and `LINT-ESCAPE-3`. In one line: a file may not decide whether repository law
applies to it.

This shelf documents something narrower and less flattering — **enforcement**. Not what the law
says, but what a linter can see of it, and what it cannot. A law with no rule is known to be
unenforced. A rule believed to be closed while it is open is worse, because the belief is what stops
anyone from looking.

The rule set publishes **one** rule. Everything below is that one rule.

## Rules

| Rule | Code | What it reports |
|---|---|---|
| `no-inline-lint-config` | `LINT-ESCAPE-1` | A comment inside product source whose body begins with an ESLint `disable`, `disable-line`, `disable-next-line` or `enable` directive |

Two findings sit in this table rather than outside it:

- `LINT-ESCAPE-2` is only half held by a rule. The rule reports the attempted bypass; the exported
  `linterOptions.noInlineConfig` is what makes the bypass ineffective. That half is flat
  configuration a consuming repository must apply, not a rule that can fail a build on its own.
- `LINT-ESCAPE-3` has **no rule**. Nothing scans for an allowlist. What stands in for one is the
  rule's `schema: []` — the rule accepts no options, so no per-path exemption can be handed to it.
  That closes one door and leaves the configuration file wide open. See `audit.md`.

## Detection

| Rule | Mechanism |
|---|---|
| `no-inline-lint-config` | **File gate:** `context.filename` (falling back to `context.getFilename()`), backslashes rewritten to forward slashes, must contain the substring `/src/`; otherwise `create` returns `{}` and the rule does not exist for that file. **Visitor:** a single `Program` node handler. **Source:** `context.sourceCode.getAllComments()` — every `Line` and `Block` comment node the parser attached. **Match:** `comment.value` tested against `/^\s*eslint-(?:disable(?:-next-line|-line)?|enable)\b/`. **Report:** on the comment node, `messageId: "directive"`. **Options:** `schema: []` — no configuration surface. |

Three details of that pattern decide most of the behaviour in the next section:

- `^` anchors at the start of the comment **body**, which is the only place a linter honours a
  directive. An unanchored pattern matched the word instead of the directive and reported prose that
  merely mentioned one, so writing the explanation became the violation.
- `\s` covers newlines, so a block comment carrying its directive on a later line is still matched.
- `\b` ends the match at the directive word, so a trailing reason is ignored and a longer word such
  as `eslint-disabled` is not a match at all.

## Escape Hatches

### Closed

| Written form | Why it does not slip past |
|---|---|
| `//eslint-disable-next-line rule` with no space | `^\s*` permits zero whitespace as readily as one space |
| `// eslint-disable-next-line rule -- lý do` | `\b` closes the match at the directive; whatever follows is never consulted, so a reason buys nothing |
| A block comment with the directive on its second line | `\s` includes the newline, so `^\s*` still reaches the directive |
| `{/* eslint-disable rule */}` inside markup | A markup comment expression holds an ordinary comment node; `getAllComments()` returns it |
| An absolute path written with backslashes | `normalizePath` rewrites separators before the `/src/` test, so a path form is not a bypass |
| `/* eslint-disable */` aimed at this very rule | It is reported like any other directive, and where the flat config applies `linterOptions.noInlineConfig` it is inert before it can help |
| `/* eslint-enable */` used alone to reopen a span | `enable` is its own alternative in the pattern, not an afterthought |
| `eslint-disabled` appearing as a word | `\b` cannot match between `e` and `d`, so the longer word is not the directive |
| A sentence explaining that a file carries no such directive | Deliberately not reported. The rule under-catches exactly where the linter itself under-honours, which is not a hole but the boundary of the thing being enforced |

### Open

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

## Inputs

| Input | Evidence required |
|---|---|
| filename | The value the linter reports for the file, before normalisation |
| comment set | Every comment node the parser attached to the program |
| comment body | The text after the delimiter, untrimmed |
| flat configuration | Whether `linterOptions.noInlineConfig` is applied beside the recommended rules |
| severity | Whether the effective configuration keeps the rule at `error` |

## Invariants

- The identity of the rule is its published name. It carries no numeric code of its own.
- The rule reports; the configuration fence neutralises. Neither substitutes for the other.
- The rule accepts no options, so no exemption can be passed to it at a call site.
- Under-catching prose is intentional; a directive a linter would obey always sits at the start of
  its comment.
- Every open hatch above is a documented gap, not a permission. Writing one of those forms to avoid
  a report is the violation the law names, whether or not a build agrees.

## Exceptions

None. `LINT-ESCAPE-3` states there is no allowlist, and the rule's empty option schema means there
is no place to write one.

One boundary is often mistaken for an exception: rule fixtures that construct forbidden directives
on purpose live outside any `/src/` segment. That is the gate doing its job on a file that is not
product source, not an exemption granted to product source.

## Output

```text
rule: no-inline-lint-config
code: LINT-ESCAPE-1
file: <path containing a /src/ segment>
node: <the comment node, Line or Block>
message: Inline ESLint configuration makes this file the author of whether repository law
         applies. Remove the directive and fix the code or the shared rule; there is no local
         exception path.
```

## Load Policy

Read this file first for what is enforced and what is not. Read `vi.md` for why the law deserves a
machine at all, `example.md` for the code that fires and the code that does not, and `audit.md` when
deciding whether an open hatch is worth closing.

## Scope

This module documents enforcement of one law, in one rule set, shipped as one package. The prose and
every example name no product, no component library and no repository. Rule identifiers are quoted
verbatim, because the identifier is what a build log prints and a second spelling would mean one
rule with two names.

## Version Rule

Increment all five records by `0.01` for an accepted change to a rule, a detection mechanism or a
hatch classification, and record it in `changelog.md`.
