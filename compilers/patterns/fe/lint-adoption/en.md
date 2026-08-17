---
title: Lint-adoption
---

# Lint-adoption

The input is a shape already accepted: a repository has been agreed to run under the canonical front-end rule set, and nobody is re-opening whether it should. The output is source architecture — which file carries the attachment, which layer holds the proof, what leaves canon as one versioned unit, what the resolved configuration must print, and which pass is allowed to write product source at all. This pattern does not argue for the rule set; it lands it in files.

## Law

Lint adoption is the effective ESLint configuration applied to a real production file. It is not a plugin folder, not an import line, not a package name, and not a locally maintained rule set that carries a familiar prefix. The deciding question is a single one:

> Does `eslint --print-config` show every canonical rule at `error`, and refuse inline config?

Every other signal — the plugin resolves, the folder exists, the config file mentions the right identifier — describes what a repository *has*. This law is about what ESLint *does*, and those two have been different often enough that only the second is evidence.

**This is binding, not advisory.** A repository is either governed by the complete set or it is not; there is no partially adopted state that still counts as adopted. A rule set that arrives missing seven rules is not adoption with a small gap, it is a different rule set with a familiar name.

## Situation codes

Every situation this module governs carries a code, `LINT-ADOPTION-<n>`. The code names the SITUATION; the columns name what that situation requires of source and what it refuses.

| Code | Situation | What the source must look like |
|---|---|---|
| `LINT-ADOPTION-1` | A consuming repository attaches the canonical set | The plugin, the recommendation and the linter options attach as one versioned unit; the config spreads the received block instead of listing rule names. Forbidden: a hand-written project-local subset of any of the three |
| `LINT-ADOPTION-2` | Adoption has to be proven, not asserted | The canonical effective-config audit runs against at least one real production source file, invoked with `--probe` pointing at a file that ships. Forbidden: reading adoption off an import, a folder name or a plugin's presence |
| `LINT-ADOPTION-3` | Rules arrived — at what level | Every rule in the canonical recommendation resolves to `error`; `missing: []` and `nonError: []`. Forbidden: a parallel hand-written plugin, or a warning-level rollout |
| `LINT-ADOPTION-4` | A file could switch the law off from inside itself | The resolved config sets `linterOptions.noInlineConfig` to `true`; `refusesInlineConfig: true`. Forbidden: a file deciding, from inside itself, whether repository law applies to it |
| `LINT-ADOPTION-5` | A pass wants to edit product source while the audit is red | Apply and fidelity work stop before production edits while this audit fails; `ok: true` before the pass's first commit. Forbidden: writing product source that incomplete enforcement would call legal |

The numbering is fixed and cited from outside this module. A code is never renumbered to close a gap in the sequence; disagreement with a code is recorded as an open risk rather than by editing the code.

## Reading an accepted shape

1. **Read what the shape states.** It states that this repository is governed by the canonical set, and it states the globs the repository owns — which trees the law applies to. That is a repository's own fact.
2. **Read what it does not state, and therefore does not resolve.** It does not state what the effective configuration prints. It does not state the severity any rule ended at, whether a later config block overrode `linterOptions`, or whether the probe file is inside the governed globs. None of those are decided by the shape; they are decided by measurement.
3. **Resolve outermost first.** The attachment comes before the proof, the proof before the severities, the severities before the inline refusal, and all four before any question about product source. A subset that never arrived cannot be measured at `error`, and a red audit decides the last question regardless of the others.
4. **Ask each code's question in order.** `LINT-ADOPTION-1`: did the plugin, the recommendation and the linter options leave canon as one versioned unit, or did somebody copy part of them? `LINT-ADOPTION-2`: was the effective config printed by the target's own ESLint for a file that ships? `LINT-ADOPTION-3`: is `missing` empty and is `nonError` empty? `LINT-ADOPTION-4`: does the printed `linterOptions.noInlineConfig` read `true`? `LINT-ADOPTION-5`: is this pass about to touch product source while `ok` is false?
5. **When two codes both match, name both and act on the outer one.** A hand-copied subset that is also fully `error` is `LINT-ADOPTION-1`, not a clean `LINT-ADOPTION-3` — `missing` is usually a symptom of code 1, while `nonError` is almost always code 3. Attaching correctly but never measuring is `LINT-ADOPTION-2`, not adoption. Measuring and then ignoring a red result is `LINT-ADOPTION-5`, not `LINT-ADOPTION-2`.

## `LINT-ADOPTION-1` — one versioned unit, no local subset

**Situation.** A repository consuming canon must receive three things at once: the plugin, the recommendation (rule names with their levels), and the linter options. Those three leave canon as one versioned unit. A repository that hand-writes any part of the three has created a second canon — not on the day it was written, but on the day one of the two lists changes.

**What it emits in source.** The consuming config spreads the received attachment block. The attachment factory in [`sources/fe/lint-adoption.mjs`](../../../../sources/fe/lint-adoption.mjs) emits the globs, the linter options, the plugin and the rules in ONE block, and throws on an empty recommendation instead of returning a block with no rules. No local plugin folder is kept beside the mirror, and no second copy of the same rule set lives anywhere in the repository.

**Recognition signs.** `eslint.config.mjs` lists rule names inside `rules: {}` instead of spreading what it received. A repository-maintained plugin folder sits beside the mirror. A second copy of the same rule set lives somewhere else in the repository. Somebody answers "the plugin is imported" when asked how many rules govern the repository. The test: if canon adds a rule tomorrow, does this repository receive it with nobody editing by hand? If a hand edit is required, this is a copy, not a unit.

**Boundary.** This is not `LINT-ADOPTION-3`: code 1 asks whether the rules arrived at all, code 3 asks what level they ended at once they did. A hand-written subset can be entirely `error` and still fail code 1, because what it lacks is the rules nobody copied in. It is also not `LINT-ADOPTION-2`: code 1 is how the set attaches, code 2 is how attachment is proven. Attaching correctly without measuring is still not evidence.

**Common business situations.** A repository cloned for the first time · a monorepo and a single app sharing the law but not the globs · a repository keeping the old plugin "to migrate gradually" · a CI job that fetches only one repository · a Docker build that copies only one directory · somebody editing the mirror directory directly to save time.

## `LINT-ADOPTION-2` — measure on a real production file

**Situation.** Loading the plugin only proves the rule exists. It does not prove ESLint switches that rule on for any file. The only evidence worth anything is the resolved config for a real shipping file, printed by the target repository's own ESLint rather than read by eye from the config file.

**What it emits in source.** A run of [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) where `--probe` is required and the config being judged is spawned out of the target's own ESLint rather than read off its config file. The probe path names a production source file inside the governed globs — not a test, not a config, not a script. Candidate source from a preview pass sits inside those globs deliberately.

**Recognition signs.** The adoption conclusion is drawn by opening `eslint.config.mjs` and reading it. Nobody can run the audit command, or it runs with `--probe` pointing at a test file, a config file or a script. The repository is "green" but nobody can say how many rules it is green under. The globs do not cover the file chosen as probe, and nobody notices because the output still prints normally. The test: is the file used as probe genuinely part of the set that ships? If it is a test or configuration file, something nobody deploys was measured.

**Boundary.** This is not `LINT-ADOPTION-1`: see above. It is not `LINT-ADOPTION-5` either: code 2 is the act of measuring, code 5 is the consequence when the result is red. Measuring and then ignoring the result fails code 5, not code 2.

**Common business situations.** Taking over an unfamiliar repository · before opening an Apply pass · after wiring has been repaired · after canon adds a new rule · when the lint error count drops on its own with nobody fixing anything · when a preview candidate file is about to be ported into production.

## `LINT-ADOPTION-3` — every rule resolves to `error`

**Situation.** Once the rules have arrived they must all be at `error`, without exception. A warning-level set, or a hand-written plugin running in parallel, creates a second and weaker architecture — and the weaker one wins, because it is the one that does not block a merge.

**What it emits in source.** The printed config resolves every canonical rule to `error`. `severityOf` in [`sources/fe/lint-adoption.mjs`](../../../../sources/fe/lint-adoption.mjs) collapses every spelling of a severity to a number, and the `nonError` list collects everything not equal to `2`; both `missing` and `nonError` come back empty. `recommended` in [`sources/fe/index.mjs`](../../../../sources/fe/index.mjs) is gathered from every module, with every level `error` and no per-module discretion. No later config block overrides a level for a "temporary" glob.

**Recognition signs.** In the audit output, `nonError` is non-empty: a rule is present but at `warn` or `off`. In the audit output, `missing` is non-empty: the rule does not exist in the resolved config. A later config block overrides the level of a few rules for a "temporary" glob. Somebody describes `warn` as a "rollout phase". The test: if a fresh violation of this rule were written today, would it block? If it only prints a yellow line and merges, the rule has not been adopted, only mentioned.

**Boundary.** This is not `LINT-ADOPTION-1`: `missing` is usually a symptom of code 1, `nonError` almost always code 3. It is not `LINT-ADOPTION-4` either: code 3 is about the level of a rule, code 4 about whether a comment inside the violating file can switch that rule off. Full `error` that still permits inline disable means that level is only a default.

**Common business situations.** A repository with old debt wanting to drop to `warn` to get through · canon adding a rule the repository has not mirrored · a "legacy" glob being exempted · a rule turned `off` while debugging and left there permanently · two repositories on the same canon counting two different error totals.

## `LINT-ADOPTION-4` — the resolved config refuses inline config

**Situation.** `noInlineConfig` is not an extra strictness option. It is what makes a directive inside a file *have no effect*, rather than merely being considered wrong. Without it, the author of a violation is also the person deciding whether it is a violation.

**What it emits in source.** `refusesInlineConfig`, read from the PRINTED `linterOptions.noInlineConfig` in [`sources/fe/lint-adoption.mjs`](../../../../sources/fe/lint-adoption.mjs) and required by `ok` alongside the rule comparison, comes back `true`. The consuming config applies the frozen linter options published by [`sources/fe/lint-escape-hatch.mjs`](../../../../sources/fe/lint-escape-hatch.mjs) beside the rule that reports the directive. Product source carries no `eslint-disable`, `eslint-disable-next-line` or `eslint-enable`.

**Recognition signs.** `refusesInlineConfig: false` in the audit output even though the rule list is complete. The config attaches rules but forgets to spread the linter options. A later config block overrides `linterOptions` and nobody notices, because flat config takes the later block. Product source contains `eslint-disable`, `eslint-disable-next-line` or `eslint-enable`. The test: can a comment placed in the right spot switch off the rule reporting that very line? If it can, what is standing there is not a fence.

**Boundary.** This is not `LINT-ADOPTION-3`: see above. It is also not the `lint-escape-hatch` law: the *rule that reports* a directive belongs to that module, while the *linter option that renders the directive inert* is the adoption condition here. Both are needed — one explains why it broke, the other guarantees the directive cannot silence its own guard.

**Common business situations.** A vendor file needing unusual syntax · a "temporary" migration · a generated file · a component rushed to merge before a demo · a pull request adding `eslint-disable` with a very reasonable justification written right beside it.

## `LINT-ADOPTION-5` — a red audit stops product edits

**Situation.** Code written under an incomplete fence can be locally legal and still violate canon. It is not red, so nobody knows. It goes red on exactly the day the wiring is repaired — and by then the debt carries somebody else's name.

**What it emits in source.** No product source changes while `ok` is false. [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) exits non-zero when `ok` is false, and that non-zero exit is the signal a pass is required to halt on rather than annotate. Wiring diffs and product diffs stay in separate commits, so it can be read which caused which.

**Recognition signs.** An Apply or fidelity pass starts editing `.tsx` while the audit has never run, or ran and returned `ok: false`. Somebody says "fix lint later, the feature comes first". The product diff and the wiring diff sit in one commit, so nobody can read which caused which. A measuring pass — a duplicate survey, a parity comparison — runs on a repository with broken adoption and reports its results as real. The test: if the wiring were repaired right after this commit, would this diff still be green? If that is uncertain, this diff is being graded by a different rule set than the one that will grade it tomorrow.

**Boundary.** This is not `LINT-ADOPTION-2`: code 2 is the measurement, code 5 is what the red result obliges. It is also not its own exception: repairing wiring is not editing product source. Code 5 stops product source; it does not stop the approved repair of the configuration that just went red, inside a boundary approved before it starts.

**Common business situations.** A new task on a repository untouched for a long time · a batch of new rules just pulled in · a preview candidate about to be ported · a demo deadline · a "one line only" bug fix · a consolidation survey on a repository that has not adopted.

## Layer held

Which tier actually holds each code — `unrepresentable` (a closed union or branded type makes the wrong value impossible to write), `enforced` (a lint rule from [`sources/fe/lint-adoption.mjs`](../../../../sources/fe/lint-adoption.mjs) catches it, named here), or `documented` (nothing mechanical holds it; only a reader does).

| Code | Tier | What actually holds it |
|---|---|---|
| `LINT-ADOPTION-1` | `documented` | [`scripts/sync-fe-lint.mjs`](../../../../scripts/sync-fe-lint.mjs) reports a hand-kept plugin folder and a drifted mirror — but it is a script somebody chooses to run, not a rule a build fails on |
| `LINT-ADOPTION-2` | `documented` | [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) performs the audit; nothing can require that it was performed |
| `LINT-ADOPTION-3` | `documented` | `audits["effective-config"]` returns `nonError`, and returns it only when invoked |
| `LINT-ADOPTION-4` | `documented` | the same audit returns `refusesInlineConfig`; the value it looks for is published by [`sources/fe/lint-escape-hatch.mjs`](../../../../sources/fe/lint-escape-hatch.mjs), which is a different module's rule |
| `LINT-ADOPTION-5` | `documented` | a reader, or a skill that stops |

All five read `documented`, and the artifact that holds this law publishes `rules = {}` on purpose rather than by neglect. An ESLint rule sees a syntax tree inside a file, under a configuration that has already been resolved. This law's entire subject is that resolution: whether a rule is present, what severity it ended at, whether directives are honoured. A rule asked to judge those facts would be judging the config that decided whether the rule runs at all — and the failure mode is silent, because a rule switched off reports nothing and a repository governed by nothing lints clean. That is why the holder here is a repository audit over `eslint --print-config` rather than a rule, and why this table shows five `documented` rows instead of pretending otherwise. The layer that owns this concern is the repository's resolved configuration and the audit over it; every product layer — components, blocks, pages — stays ignorant of it and must never carry a local opinion about which rules govern it.

## Anchor

A law that cannot be pointed at in real code is a proposal. One row per code, with the path and what to look for there.

| Code | Path | What to look for |
|---|---|---|
| `LINT-ADOPTION-1` | [`sources/fe/lint-adoption.mjs`](../../../../sources/fe/lint-adoption.mjs) | The exported attachment factory: the globs, the linter options, the plugin and the rules leave in ONE block, and an empty recommendation throws instead of returning a block with no rules |
| `LINT-ADOPTION-2` | [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) | `--probe` is required, and the config being judged is spawned out of the target's own ESLint rather than read off its config file |
| `LINT-ADOPTION-3` | [`sources/fe/lint-adoption.mjs`](../../../../sources/fe/lint-adoption.mjs) | `severityOf`, which collapses every spelling of a severity to a number, and the `nonError` list that collects everything not equal to `2` |
| `LINT-ADOPTION-4` | [`sources/fe/lint-adoption.mjs`](../../../../sources/fe/lint-adoption.mjs) | `refusesInlineConfig`, read from the PRINTED `linterOptions.noInlineConfig`, and required by `ok` alongside the rule comparison |
| `LINT-ADOPTION-5` | [`scripts/audit-fe-lint-adoption.mjs`](../../../../scripts/audit-fe-lint-adoption.mjs) | The non-zero exit when `ok` is false — the signal a pass is required to halt on rather than annotate. **Partial anchor** — see below |

Secondary evidence, useful when the primary anchor is being changed:

- `LINT-ADOPTION-1` — [`scripts/sync-fe-lint.mjs`](../../../../scripts/sync-fe-lint.mjs): the content digest over the mirror, and the finding raised when a hand-maintained plugin folder still exists beside it.
- `LINT-ADOPTION-3` — [`sources/fe/index.mjs`](../../../../sources/fe/index.mjs): `recommended`, gathered from every module, with every level `error` and no per-module discretion.
- `LINT-ADOPTION-4` — [`sources/fe/lint-escape-hatch.mjs`](../../../../sources/fe/lint-escape-hatch.mjs): the frozen linter options a consuming config applies, published beside the rule that reports the directive.
- `LINT-ADOPTION-5` — the lint-sync Apply skill states the close condition that only `ok: true` satisfies, and the consolidation Plan skill routes away rather than measuring a repository whose adoption is failing.

`LINT-ADOPTION-5` is anchored for lint-sync work and **not yet anchored** for design and fidelity Apply: no file in those skills reads this audit, so the halt they owe exists in prose and nowhere else. It is recorded as an open risk.

## Inputs

| Input | Evidence required |
|---|---|
| probe | Path of a real production source file inside the governed globs |
| printed config | The output of the target's own `eslint --print-config` for that probe |
| recommendation | The canonical rule-to-level map, gathered from every module, not a subset |
| linter options | The resolved `linterOptions`, read from the printed config rather than the source config |
| phase | Which work is asking: wiring, Apply, fidelity, or a measuring pass |

## Rules

1. Adoption is a property of the resolved configuration, never of a file, folder or package name.
2. The plugin, the recommendation and the linter options move together and version together.
3. A repository owns which globs the law applies to; it owns no opinion about what the law says.
4. Missing and weakened are two distinct findings, and neither one is a warning.
5. A rule that could be disabled by the comment it reports is not a fence.
6. The audit is run against source that ships, including source a later pass will port into production.
7. A failing audit is a stop, not a caveat attached to a diff.
8. The absence of a lint rule for a code is a stated gap, never a downgrade of the code.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it applies to.

- **Repository-owned config.** `LINT-ADOPTION-1` binds the rules, their severities and the inline refusal. Which globs they apply to is a repository's own fact — a monorepo lints a shared package and each app, a single app lints one tree. Rules are the law; globs are where it applies.
- **The repository's other plugins.** `LINT-ADOPTION-1`: a consuming config keeps its own unrelated plugins, its own ignores and its own language options. What it may not keep is a second opinion about the canonical set.
- **Candidate source is not exempt.** `LINT-ADOPTION-2`: a preview candidate is the exact source a later pass ports into production. It sits inside the governed globs deliberately, so the one file that becomes production was not judged by nothing.
- **Repairing the wiring is not a production edit.** `LINT-ADOPTION-5` stops product source, not the approved repair of the configuration that failed. The boundary of that repair is approved before it starts.
- **Debt is recorded, never lowered.** `LINT-ADOPTION-3`: a rule that cannot be carried yet is written down with its cost, at full severity everywhere it does exist. Recording an absence keeps the number honest; lowering a level makes the boundary optional for everyone who comes after.

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

One block per probe the shape produces: a monorepo that lints a shared package and each app emits one block per governed tree, because each tree resolves its own effective configuration.

## Worked example

The accepted shape: *this single-app front end adopts the canonical rule set across its own source tree, and an Apply pass is queued to edit product components in that tree.*

The shape states the rule set and the tree it applies to. It does not state what the effective configuration prints — not the severities, not whether a later block overrode `linterOptions`, not whether the config spreads the received attachment or lists rule names by hand — and therefore it resolves none of those. They are settled by printing the config, not by reading the shape.

Measured on the app tree:

```text
probe: src/app/dashboard/page.tsx
unit: local subset
missing: [seven canonical rules absent from the effective config]
nonError: []
refusesInlineConfig: true
situation: LINT-ADOPTION-1
verdict: stop
reason: the config lists rule names in rules: {} instead of spreading the attachment block, so rules added to canon never arrive
```

The `reason` names the fact that excludes `LINT-ADOPTION-3`: every rule that did arrive resolved to `error`, so `nonError` is empty — the failure is rules that were never copied in, which is code 1, not a severity that was lowered, which would be code 3.

After the wiring repair, measured again on the same tree:

```text
probe: src/app/dashboard/page.tsx
unit: one versioned unit
missing: []
nonError: []
refusesInlineConfig: false
situation: LINT-ADOPTION-4
verdict: stop
reason: a later config block overrides linterOptions, so the printed noInlineConfig is false and a comment can switch off the rule reporting its own line
```

The `reason` names the fact that excludes `LINT-ADOPTION-3`: the rule list is complete and every level is `error`, so nothing about severity decided this — what decided it is that the printed `linterOptions.noInlineConfig` is `false`, which is code 4.

Only when a block comes back with `missing: []`, `nonError: []`, `refusesInlineConfig: true` and `verdict: ok` may the queued Apply pass touch product source; while either block above stands, `LINT-ADOPTION-5` holds it. Note what holds that halt: nothing mechanical. All five codes are `documented`, and for design and fidelity Apply the halt is not anchored in any file at all.

## Scope

This module states a rule true of any front end that lints. It names no product, no component library and no repository. Every example is an ordinary flat config and ordinary TSX; the plugin namespace in the examples is a placeholder, and the law does not change when it is spelled differently.
