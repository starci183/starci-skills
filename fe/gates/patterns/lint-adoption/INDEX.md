---
id: fe-patterns-lint-adoption-index
title: INDEX.md
slug: /gates/patterns/lint-adoption
sidebar_label: lint-adoption
sidebar_position: 0
description: Binding rules for proving that a repository is governed by the complete canonical lint set, measured on the config ESLint actually resolved.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `lint-adoption`

## Law

Lint adoption is the effective ESLint configuration applied to a real production file. It is not a
plugin folder, not an import line, not a package name, and not a locally maintained rule set that
carries a familiar prefix. The deciding question is a single one:

> Does `eslint --print-config` show every canonical rule at `error`, and refuse inline config?

Every other signal — the plugin resolves, the folder exists, the config file mentions the right
identifier — describes what a repository *has*. This law is about what ESLint *does*, and those two
have been different often enough that only the second is evidence.

**This is binding, not advisory.** A repository is either governed by the complete set or it is not;
there is no partially adopted state that still counts as adopted. A rule set that arrives missing
seven rules is not adoption with a small gap, it is a different rule set with a familiar name.

## Situation Codes

Every situation this module governs carries a code, `LINT-ADOPTION-<n>`. The code names the
SITUATION; the columns name what that situation requires and what it refuses.

| Code | What it requires | What it forbids |
|---|---|---|
| `LINT-ADOPTION-1` | The plugin, the recommendation and the linter options attach as one versioned unit | A hand-written project-local subset of any of the three |
| `LINT-ADOPTION-2` | The canonical effective-config audit runs against at least one real production source file | Reading adoption off an import, a folder name or a plugin's presence |
| `LINT-ADOPTION-3` | Every rule in the canonical recommendation resolves to `error` | A parallel hand-written plugin, or a warning-level rollout |
| `LINT-ADOPTION-4` | The resolved config sets `linterOptions.noInlineConfig` to `true` | A file deciding, from inside itself, whether repository law applies to it |
| `LINT-ADOPTION-5` | Apply and fidelity work stop before production edits while this audit fails | Writing product source that incomplete enforcement would call legal |

The numbering is fixed and cited from outside this module. A code is never renumbered to close a gap
in the sequence; disagreement with a code is recorded in `audit.md` under "Rủi ro còn mở".

## Tầng giữ

Which tier actually holds each code — `unrepresentable` (a closed union or branded type makes the
wrong value impossible to write), `enforced` (a lint rule from
[`sources/fe/lint-adoption.mjs`](../../../../sources/fe/lint-adoption.mjs) catches it, named here), or
`documented` (nothing mechanical holds it; only a reader does).

| Code | Tier | What actually holds it |
|---|---|---|
| `LINT-ADOPTION-1` | `documented` | [`scripts/sync-fe-lint.mjs`](../../../../scripts/sync-fe-lint.mjs) reports a hand-kept plugin folder and a drifted mirror — but it is a script somebody chooses to run, not a rule a build fails on |
| `LINT-ADOPTION-2` | `documented` | [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) performs the audit; nothing can require that it was performed |
| `LINT-ADOPTION-3` | `documented` | `audits["effective-config"]` returns `nonError`, and returns it only when invoked |
| `LINT-ADOPTION-4` | `documented` | the same audit returns `refusesInlineConfig`; the value it looks for is published by [`sources/fe/lint-escape-hatch.mjs`](../../../../sources/fe/lint-escape-hatch.mjs), which is a different module's rule |
| `LINT-ADOPTION-5` | `documented` | a reader, or a skill that stops |

All five read `documented`, and the artifact that holds this law publishes `rules = {}` on purpose
rather than by neglect. An ESLint rule sees a syntax tree inside a file, under a configuration that
has already been resolved. This law's entire subject is that resolution: whether a rule is present,
what severity it ended at, whether directives are honoured. A rule asked to judge those facts would
be judging the config that decided whether the rule runs at all — and the failure mode is silent,
because a rule switched off reports nothing and a repository governed by nothing lints clean. That
is why the holder here is a repository audit over `eslint --print-config` rather than a rule, and why
this table shows five `documented` rows instead of pretending otherwise.

## Anchor

A law that cannot be pointed at in real code is a proposal. One row per code, with the path and what
to look for there.

| Code | Path | What to look for |
|---|---|---|
| `LINT-ADOPTION-1` | [`sources/fe/lint-adoption.mjs`](../../../../sources/fe/lint-adoption.mjs) | The exported attachment factory: the globs, the linter options, the plugin and the rules leave in ONE block, and an empty recommendation throws instead of returning a block with no rules |
| `LINT-ADOPTION-2` | [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) | `--probe` is required, and the config being judged is spawned out of the target's own ESLint rather than read off its config file |
| `LINT-ADOPTION-3` | [`sources/fe/lint-adoption.mjs`](../../../../sources/fe/lint-adoption.mjs) | `severityOf`, which collapses every spelling of a severity to a number, and the `nonError` list that collects everything not equal to `2` |
| `LINT-ADOPTION-4` | [`sources/fe/lint-adoption.mjs`](../../../../sources/fe/lint-adoption.mjs) | `refusesInlineConfig`, read from the PRINTED `linterOptions.noInlineConfig`, and required by `ok` alongside the rule comparison |
| `LINT-ADOPTION-5` | [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) | The non-zero exit when `ok` is false — the signal a pass is required to halt on rather than annotate. **Partial anchor** — see below |

Secondary evidence, useful when the primary anchor is being changed:

- `LINT-ADOPTION-1` — [`scripts/sync-fe-lint.mjs`](../../../../scripts/sync-fe-lint.mjs): the content
  digest over the mirror, and the finding raised when a hand-maintained plugin folder still exists
  beside it.
- `LINT-ADOPTION-3` — [`sources/fe/index.mjs`](../../../../sources/fe/index.mjs): `recommended`,
  gathered from every module, with every level `error` and no per-module discretion.
- `LINT-ADOPTION-4` — [`sources/fe/lint-escape-hatch.mjs`](../../../../sources/fe/lint-escape-hatch.mjs):
  the frozen linter options a consuming config applies, published beside the rule that reports the
  directive.
- `LINT-ADOPTION-5` — the lint-sync Apply skill states the close condition that only `ok: true`
  satisfies, and the consolidation Plan skill routes away rather than measuring a repository whose
  adoption is failing.

`LINT-ADOPTION-5` is anchored for lint-sync work and **`chưa neo được`** for design and fidelity
Apply: no file in those skills reads this audit, so the halt they owe exists in prose and nowhere
else. It is recorded in `audit.md` under "Rủi ro còn mở".

## Inputs

| Input | Evidence required |
|---|---|
| probe | Path of a real production source file inside the governed globs |
| printed config | The output of the target's own `eslint --print-config` for that probe |
| recommendation | The canonical rule-to-level map, gathered from every module, not a subset |
| linter options | The resolved `linterOptions`, read from the printed config rather than the source config |
| phase | Which work is asking: wiring, Apply, fidelity, or a measuring pass |

## Invariants

- Adoption is a property of the resolved configuration, never of a file, folder or package name.
- The plugin, the recommendation and the linter options move together and version together.
- A repository owns which globs the law applies to; it owns no opinion about what the law says.
- Missing and weakened are two distinct findings, and neither one is a warning.
- A rule that could be disabled by the comment it reports is not a fence.
- The audit is run against source that ships, including source a later pass will port into
  production.
- A failing audit is a stop, not a caveat attached to a diff.
- The absence of a lint rule for a code is a stated gap, never a downgrade of the code.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Repository-owned config.** `LINT-ADOPTION-1` binds the rules, their severities and the inline
  refusal. Which globs they apply to is a repository's own fact — a monorepo lints a shared package
  and each app, a single app lints one tree. Rules are the law; globs are where it applies.
- **The repository's other plugins.** A consuming config keeps its own unrelated plugins, its own
  ignores and its own language options. What it may not keep is a second opinion about the canonical
  set.
- **Candidate source is not exempt.** A preview candidate is the exact source a later pass ports
  into production. It sits inside the governed globs deliberately, so the one file that becomes
  production was not judged by nothing.
- **Repairing the wiring is not a production edit.** `LINT-ADOPTION-5` stops product source, not the
  approved repair of the configuration that failed. The boundary of that repair is approved before
  it starts.
- **Debt is recorded, never lowered.** A rule that cannot be carried yet is written down with its
  cost, at full severity everywhere it does exist. Recording an absence keeps the number honest;
  lowering a level makes the boundary optional for everyone who comes after.

## Output

```text
probe: <production file the effective config was printed for>
unit: <one versioned unit | local subset>
missing: <canonical rules absent from the effective config>
nonError: <canonical rules resolved below error>
refusesInlineConfig: <true | false>
situation: <LINT-ADOPTION-1 | LINT-ADOPTION-2 | LINT-ADOPTION-3 | LINT-ADOPTION-4 | LINT-ADOPTION-5>
verdict: <ok | stop>
reason: <the measured fact that decided it>
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
