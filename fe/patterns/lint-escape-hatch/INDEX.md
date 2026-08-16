---
id: fe-patterns-lint-escape-hatch-index
title: INDEX.md
slug: /fe/patterns/lint-escape-hatch
sidebar_label: lint-escape-hatch
sidebar_position: 0
description: Binding rules for refusing inline ESLint directives, so the author of a violation is never the author of whether it is one.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `lint-escape-hatch`

## Law

A lint escape hatch is source text that changes which laws apply to the file containing it:
`eslint-disable`, its line variants, or `eslint-enable`. It turns a repository law into a local
choice, so the author of the violation also becomes the author of whether it is a violation.

That inversion is the whole subject. Every other property of a directive — how narrow it is, which
rule it names, how good the reason beside it reads — describes the *shape* of the bypass. None of
them changes who decided. A rule is repository policy at `error`; a file is not a party to it, and a
file that can answer the question is not being governed, it is negotiating.

> Does this text let one file decide whether a rule applies to it?

**This is binding, not advisory.** There is no size of bypass small enough to be a note rather than a
decision, and no reason good enough to convert one into the other. A rule that is wrong is corrected
in its matcher or in the architecture, for everyone, in a diff that can be reviewed — which is the
same repair the directive was avoiding.

## Situation Codes

Every situation this module governs carries a code, `LINT-ESCAPE-<n>`. The code names the SITUATION;
the columns name what that situation requires and what it refuses.

| Code | What it requires | What it forbids |
|---|---|---|
| `LINT-ESCAPE-1` | Product source contains no inline ESLint directive — no `eslint-disable`, no `-next-line`, no `-line`, no `eslint-enable` | A file lowering, suspending or restoring repository policy for itself; a bypass excused by the reason written beside it |
| `LINT-ESCAPE-2` | The flat config that switches the rule on also applies `linterOptions.noInlineConfig`, so the attempt is ineffective as well as reported | A guard that a directive inside the reported file can switch off |
| `LINT-ESCAPE-3` | A legitimate case is expressed in shared configuration or a closed type, and debt is fixed before merge | A path, folder, vendor or component allowlist; a warning-level architectural rule |

`LINT-ESCAPE-1` and `LINT-ESCAPE-2` are two halves of one fence and neither substitutes for the
other: one explains the failure, the other guarantees the directive cannot silence its own guard. A
repository holding only the first reports a bypass that worked.

The numbering is fixed and cited from outside this module. A code is never renumbered to close a gap
in the sequence; disagreement with a code is recorded in `audit.md` under "Rủi ro còn mở".

## Tầng giữ

Which tier actually holds each code — `unrepresentable` (a closed union or branded type makes the
wrong value impossible to write), `enforced` (a lint rule from
[`sources/fe/lint-escape-hatch.mjs`](../../../sources/fe/lint-escape-hatch.mjs) catches it, named
here), or `documented` (nothing mechanical holds it; only a reader does).

| Code | Tier | What actually holds it |
|---|---|---|
| `LINT-ESCAPE-1` | `enforced` | `no-inline-lint-config`, the single rule this module publishes: it walks every comment in a product file and reports any whose body begins with a directive |
| `LINT-ESCAPE-2` | `documented` | The frozen `linterOptions` export, plus the twin test that runs a real linter and watches a disable aimed at the guard fail to land — but nothing checks that a consuming config actually spread it. The check that would, `refusesInlineConfig`, belongs to the `lint-adoption` module and is a script |
| `LINT-ESCAPE-3` | `documented` | `schema: []` on the rule, which closes it to options, so no allowlist can be configured *into* the rule — and nothing at all for an allowlist built *around* it out of a later config block |

One row is `enforced` and two are `documented`, and the split is not an accident of effort. The one
code an ESLint rule can hold is the one whose evidence is text inside a file. The other two are facts
about the resolved configuration: whether an option was set, whether a later block removed a path
from the rule's reach. A rule runs *inside* that configuration, after it has already decided whether
the rule runs at all — so the rule is structurally the wrong instrument, and its failure mode is
silent, because a rule switched off for a folder reports nothing and the folder lints clean.

Writing `enforced` on those two rows would put the comfortable answer in the column that exists to
carry the uncomfortable one.

## Anchor

A law that cannot be pointed at in real code is a proposal. One row per code, with the path and what
to look for there.

| Code | Path | What to look for |
|---|---|---|
| `LINT-ESCAPE-1` | [`sources/fe/lint-escape-hatch.mjs`](../../../sources/fe/lint-escape-hatch.mjs) | `INLINE_DIRECTIVE`, anchored at the start of the comment body; the `Program()` visitor walking `getAllComments()` rather than matching source text; and `isProductSource`, the only path condition in the file |
| `LINT-ESCAPE-2` | [`sources/fe/lint-escape-hatch.mjs`](../../../sources/fe/lint-escape-hatch.mjs) | `linterOptions`, frozen and exported beside `rules` so the two cannot be attached separately by accident. **Partial anchor** — see below |
| `LINT-ESCAPE-3` | [`sources/fe/lint-escape-hatch.mjs`](../../../sources/fe/lint-escape-hatch.mjs) | `schema: []` in the rule meta, and `recommended` publishing exactly one entry at exactly one level with no path key — there is no field an exemption could be written into. **Partial anchor** — see below |

Secondary evidence, useful when the primary anchor is being changed:

- `LINT-ESCAPE-1` — [`sources/fe/lint-escape-hatch.test.mjs`](../../../sources/fe/lint-escape-hatch.test.mjs):
  the valid cases that keep prose about a directive legal, with the comment explaining why the
  pattern is anchored and what the unanchored version cost.
- `LINT-ESCAPE-2` — the same twin test's second case: a real linter, the frozen options applied, a
  disable naming the guard itself, and the assertion that the guard still reports at severity `2`.
- `LINT-ESCAPE-2` — [`sources/fe/index.mjs`](../../../sources/fe/index.mjs): the options re-exported
  from the aggregate plugin, so a consuming config takes them from the same import as the rules.
- `LINT-ESCAPE-2` — [`sources/fe/lint-adoption.mjs`](../../../sources/fe/lint-adoption.mjs) and
  [`scripts/audit-fe-lint-adoption.mjs`](../../../scripts/audit-fe-lint-adoption.mjs):
  `refusesInlineConfig`, read from the printed config. It is the only thing that measures a real
  repository, and it belongs to another module.
- `LINT-ESCAPE-3` — [`sources/fe/index.mjs`](../../../sources/fe/index.mjs): `recommended` gathered
  from every module with no per-module discretion over level, and the refusal to rename a published
  rule — the two places a per-path or per-name carve-out would have to live.

`LINT-ESCAPE-2` is anchored for what the artifact PUBLISHES and **`chưa neo được`** for what a
consuming repository RESOLVES: no file in this module observes whether the options arrived.
`LINT-ESCAPE-3` is anchored against an allowlist configured into the rule and **`chưa neo được`**
against one built around it — a later `ignores`, an override block, a glob narrowed by hand. Both
are recorded in `audit.md` under "Rủi ro còn mở".

## Inputs

| Input | Evidence required |
|---|---|
| file | Path of the file being judged, and whether it is product source or a fixture |
| comments | The comment bodies, read from the first non-space character, not the source text |
| config | The resolved `linterOptions`, and any later block that touches them or the rule's reach |
| case | The syntax or situation the bypass was defending, stated as a case rather than as one file |
| severity | The level the rule resolved to |

## Invariants

- A rule is repository policy; the file it reports is not a party to the decision.
- Reporting the attempt and making it ineffective are two obligations, not one.
- A reason written beside a bypass documents it; it never authorises it.
- A directive is read from the first non-space character of a comment and nowhere else, so prose
  about a directive is not a directive.
- A legitimate case is represented in shared configuration or a closed type, never in a per-file
  exemption.
- An architectural rule ships at `error` with a twin test, or it does not ship.
- Debt is fixed before merge rather than hidden beside it.
- Correcting a wrong rule is a repair for everyone, in the rule; it is never a local suspension.
- The absence of a lint rule for a code is a stated gap, never a downgrade of the code.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Prose about a directive.** `LINT-ESCAPE-1` governs directives, not the word. A comment explaining
  why a file carries no `eslint-disable` is the most useful comment on the subject a file can hold,
  and the pattern is anchored so that writing it stays legal. Under-catching is not the trade: a
  directive the linter would obey always sits at the start of the comment.
- **Fixtures that construct the forbidden text.** The rule's twin tests build directives on purpose.
  A fixture is the string, not the act, and the rule's own path gate is what keeps the distinction
  from needing a directive to express it.
- **Globs are where, not who.** `LINT-ESCAPE-3` refuses an allowlist. Which trees a repository lints
  is still the repository's own fact — a monorepo and a single app do not share a folder layout. That
  opens nothing for a file inside the governed trees, and a glob narrowed to route around one
  violation is an allowlist wearing a config's clothes.
- **Shared configuration owning legitimate syntax.** A vendor declaration, a generated shape or a
  platform requirement can be legal. `LINT-ESCAPE-3` requires that legality to be stated once, as a
  semantic case in the shared matcher or a closed type, where every call site inherits it and a
  reviewer can see it. Stating it in the file that needs it is the bypass under another name.
- **Repairing the rule is not an exemption.** When the rule is wrong, the matcher or the architecture
  is corrected. The repair lands in the shared artifact with its twin test, not beside the
  violation — and it is reviewed as a change to the law, because it is one.

## Output

```text
file: <path judged, product source or fixture>
directive: <the comment body, or none>
situation: <LINT-ESCAPE-1 | LINT-ESCAPE-2 | LINT-ESCAPE-3>
holder: <enforced | documented>
verdict: <legal | stop>
repair: <shared rule | closed type | shared config | architecture>
```

## Load Policy

Read this file first. Read `vi.md` for the situation behind each code, `example.md` for the cases,
exceptions and request mapping, and `audit.md` only while reviewing the canon itself — it is where
the unheld codes and their cost are stated.

## Scope

This module states a rule true of any front end that lints. It names no product, no component
library and no repository. Every example is an ordinary flat config and ordinary TSX; the plugin
namespace in the examples is a placeholder, and the law does not change when it is spelled
differently.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
