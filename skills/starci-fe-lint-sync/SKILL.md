---
name: starci-fe-lint-sync
description: Point a StarCi front-end repository at the one rule set in this tree, remove any local plugin folder or vendored copy, and settle every error the complete set then reports. Use when a repository carries its own plugins/eslint/, when audit-fe-lint-adoption reports missing or weakened rules, or when two repositories disagree about a rule name. Wires by import, never by copy.
---

# StarCi FE lint sync

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Synced means the repository is judged by the rules in this tree and by no others: its
`eslint.config.mjs` imports `.claude/sources/fe/index.mjs`, it holds no rule file of its own, and the
audit answers `ok: true` against a real production file.

A repository that passes its own lint with a local plugin is not synced. That looks exactly like
success until the two rule sets are compared, and it is the failure this procedure exists to end.

## SCOPE

Print the table. `Touching` is the target's ESLint config and whatever product files the errors turn
out to be about — confirm both before editing, because the second set is not knowable until after the
wiring.

## PROCESS

**Wire by import, never by copy.** A copy drifts where a reader cannot see it: rule NAMES diverge, so
one repository passes its own gate while failing this one, and a copy that knows only a single-app
folder layout reports fifty correct files as broken.

```powershell
node <trust-root>/scripts/sync-fe-lint.mjs --target <repo>
node <trust-root>/scripts/sync-fe-lint.mjs --target <repo> --write
```

**Wire before reading any lint number.** A run against a partial rule set answers a different
question, and its green is the most misleading output here. Treat every count taken before wiring as
describing a repository that no longer exists.

**Prove adoption with the audit, not a clean lint.** `npm run lint` passing means the rules that are
loaded found nothing.

```powershell
node <trust-root>/scripts/audit-fe-lint-adoption.mjs --target <repo> --probe <production-file>
```

Only `ok: true` closes this — every canonical rule at `error`, inline config refused.

**A rule that fires on correct code is a finding about the RULE.** Establish the code is actually
wrong before repairing it. At volume this reads as repository debt: fifty reports, fifty apparently
owed fixes, every one of them a file that was right. Fix the rule here, redistribute, re-measure.

**Never lower a failing rule to `warning`.** Severity is what makes a boundary a boundary. Where a
rule genuinely cannot hold — it decides something the product has not decided, or names a shape this
repository does not have — record the reason beside the switch. A rule switched off with no reason is
indistinguishable from one nobody got round to, and the next reader restores it into a repository
that fails again.

## OUTPUT

A confirm row for repairs a reader would SEE — rounding a spacing value to its nearest rung, choosing an
element for a landmark, naming a token that did not exist. These are visible decisions even when the
rule leaves one legal shape. Measure the difference in the units a person sees, give the rung in
force as the default, and hand them over TOGETHER. Halting at each one makes the user pay a round
trip per value, which is how a sync stops being finished.

Close when the audit is green. Report the before and after counts together — a repair is only
legible beside the number it moved.

**When another lane called this one**, it is a detour: close by returning to the skill that asked,
not by inviting something else. A sub-run that ends by starting a different lane abandons the work
that needed it, half done and unrecorded.
