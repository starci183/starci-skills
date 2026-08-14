---
name: starci-fe-lint-sync
description: Point a StarCi front-end repository at the one rule set in this trust tree, remove any local plugin folder or vendored copy, and settle every error the complete set then reports. Use when a repository carries its own `plugins/eslint/`, when `audit-fe-lint-adoption.mjs` reports missing or weakened rules, when two repositories disagree about a rule name, or before any Apply blocked by lint adoption. It wires by import and never by copy.
---

# StarCi FE lint sync

## Definition

Lint sync is the state where a front-end repository is judged by the rules in this tree and by no
others: its `eslint.config.mjs` imports `.claude/sources/fe/index.mjs`, it holds no rule file of its
own, and the canonical effective-config audit answers `ok: true` against a real production file.

The one question that decides whether something belongs to this procedure: **would the change alter
what any rule MEANS?** Wiring a repository to the shared rules, deleting a duplicate, and repairing
the code the complete set now reports all leave every rule's meaning untouched, so they belong here.
Changing a rule's severity, adding a rule, renaming one, or deciding that a rule should not apply is
a change to canon and belongs to the tree, not to a repository being synced.

A repository that imports the shared plugin and still fails the audit is not synced. A repository
that passes its own lint with a local plugin is not synced either — that is the failure this
procedure exists to end, and it looks exactly like success until the two rule sets are compared.

## Rules

**LINT-SYNC-1 — Wire by import, never by copy.** The consuming repository reaches this tree; it does
not receive a duplicate of it. Root `CLAUDE.md` states the prohibition and this procedure is how it
is kept: `sync-fe-lint.mjs` writes one generated import block and removes `plugins/eslint/` and any
vendored `.claude/sources/fe/`. A copy drifts in ways a reader cannot see — a renamed rule, a path
that knows one folder layout — and both have already happened here.

**LINT-SYNC-2 — Run the wiring before reading any lint result.** A lint run against a partial rule
set answers a different question from the one being asked, and its green is the most misleading
output in this procedure. Wire first, then lint, and treat every number produced before wiring as
describing a repository that no longer exists.

**LINT-SYNC-3 — Prove adoption with the audit, not with a clean lint.** `npm run lint` passing means
the rules that are loaded found nothing. `audit-fe-lint-adoption.mjs` is what answers whether the
canonical rules are loaded at all, at `error`, with inline config refused. Only its `ok: true`
closes this procedure.

**LINT-SYNC-4 — A rule that fires on correct code is a finding about the rule.** Before repairing
what a newly enabled rule reports, establish that the code is actually wrong. A rule written against
one folder layout reports the other layout's correct files, and at volume that reads as repository
debt: fifty reports, fifty apparently owed fixes, and every one of them a file that was right. Fix
the rule in this tree, redistribute, and re-measure before touching product source.

**LINT-SYNC-5 — Repairs that change a silhouette stop for the owner, together and once.** Rounding a
spacing value to its nearest rung, choosing an element for a landmark, or naming a token that did not
exist are visible decisions even when the rule leaves no alternative. Measure the difference, state
it in the units a reader will see, and let the owner choose. Silence here spends somebody else's
design judgement.

Collect them; do not ask them as the sweep meets them. Every unambiguous repair is made first, then
the visible ones are handed over as ONE form — each with the measured delta, the rung or element in
force as the default, and what changes if the owner picks the other. A sweep that halts at each
silhouette makes the owner pay a round trip per value, which is how a sync stops being finished.
[`../../handoff.md`](../../handoff.md) governs the shape.

**LINT-SYNC-6 — A rule that cannot pass anywhere is escalated, not disabled quietly.** Where a
canonical rule cannot hold in a repository — because it decides something the product has not
decided, or because it names a shape this repository does not have — record the reason beside the
switch and report it. A rule switched off with no reason beside it is indistinguishable from one
nobody got round to, and the next reader restores it into a repository that will fail again.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Copy `.claude/` or any part of it into a repository | The copy drifts silently and becomes a second answer to the same question | Import `.claude/sources/fe/index.mjs` through the specifier the script computes |
| Keep `plugins/eslint/` "for the extra rules" | Those rules are proposals for canon; kept locally they are a parallel rule set that outlives the reason for it | Move them into this tree, or record them as canon proposals and drop them |
| Read a lint number taken before wiring | A partial rule set answers a different question, and its green survives in the reader's memory | Wire first, then measure |
| Repair product source because a rule fired | The rule may be wrong about this layout, and a mass repair of correct files is expensive and invisible | Confirm the code is wrong; fix the rule here when it is not |
| Lower a failing rule to `warning` | Severity is what makes a boundary a boundary; a warning-level rollout is a second, weaker architecture | Fix the debt, or record why the rule cannot hold and escalate |
| Round a spacing value or pick a landmark element alone | Both change what a person sees, and neither is implied by the rule text | Measure the change and stop for the owner |

## Examples

### Right — the rule is wrong, not the repository

```text
Canon reports 50 errors across 28 files in packages/ui/src/leaves.
Every file declares meta = { shape: "leaf" }; leaves may write classes.
The rule matches "/src/components/leaves/" only. Fixed in the tree; re-measured: 8 errors.
```

### Wrong — the repository is repaired to satisfy the rule

```text
Canon reports 50 errors. Rewrote 28 leaves to render through Tree.
```

Both start from the same output. The difference is that one of them checked whether the code was
wrong before changing it.

### Right — a visible repair stops for the owner

```text
py-1.5 is half a rung. Nearest rungs: py-2 (+2px) or py-1 (-2px).
The search box changes height either way. Asked; owner chose py-2.
```

### Wrong — the repair is chosen silently because the rule left no alternative

```text
py-1.5 is not on the scale, so it became py-2.
```

The difference is not the value chosen. It is that a rule with one legal shape still left a design
decision, and only one of these two admitted that.

### Right — a rule that cannot hold is recorded where the switch is

```text
"starci-fe/no-second-language-in-source" stays off: 26 Vietnamese literals, and enabling it
decides this app's i18n shape from a lint file while the approved record deliberately froze none.
```

### Wrong — the same rule, omitted

```text
(no entry for no-second-language-in-source)
```

The difference is that the first can be argued with. The second is invisible, and the audit's
"missing" list is the only place it surfaces — as a number, with no reason attached.

## Procedure

Inspect first; the script writes nothing without `--write`.

```powershell
node <trust-root>/scripts/sync-fe-lint.mjs --target <repo>
node <trust-root>/scripts/sync-fe-lint.mjs --target <repo> --write
```

Then measure the repository the wiring produced, and close on the audit rather than on the lint:

```powershell
node <trust-root>/scripts/audit-fe-lint-adoption.mjs --target <repo> --probe <production-file>
```

Between those two, work the reported errors under LINT-SYNC-4 and LINT-SYNC-5: establish that each
is real, fix the rule here when it is not, and collect anything a reader would see into the one form
the owner answers in a single pass. Report the before and after counts together — a repair is only
legible beside the number it moved.

This procedure is often a SUB-RUN: Apply or Fidelity Fix reached a failing lint-adoption audit and
named it. When that is how it started, it RETURNS to the phase that requested it — closing with
`ok: true` and the phase's own name, not with a fresh invitation to something else. A sub-run that
ends by starting a different lane abandons the work that asked for it, half done and unrecorded.
