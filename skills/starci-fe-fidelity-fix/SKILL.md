---
name: starci-fe-fidelity-fix
description: Repair a bounded StarCi frontend fidelity, runtime or interaction defect when the intended result is already proven by a named legacy render, approved design, existing contract, test or explicit instruction and no product choice remains. Locks and reconfirms context, proves strict StarCi FE lint adoption, changes only the named owner and touched states, and may propose but never silently mutate canon.
---

# StarCi FE Fidelity Fix

Use this lane for “make this match”, a wrong seam, icon, divider, state, interaction or small runtime
defect whose correct outcome is already evidenced. It is not a shortcut for net-new UI.

## Admission

Read [`../../CONTEXT-LOCK.md`](../../CONTEXT-LOCK.md), detect and print context, then stop on ambiguity.
Require one binding expected-result source: explicit instruction, named legacy source/render,
approved revision, existing contract `why`, or executable test. If hierarchy, CTA, behavior,
ownership or reusable vocabulary still needs a choice, route to `$starci-fe-design-plan`.

Freeze comparison identity before editing: route, viewport, locale, theme, auth persona, fixture or
backend seed, owner state and reference commit. A screenshot from another state cannot prove or
disprove fidelity.

Persist a fidelity record using [`references/fidelity-record.md`](references/fidelity-record.md),
print target repo/branch/worktree/write boundary and obtain explicit confirmation before production
writes. Read [`references/steps-table.md`](references/steps-table.md) completely.

Seal and check the record rather than trusting that both screenshots were taken the same way:

```powershell
node <trust-root>/skills/starci-fe-fidelity-fix/scripts/verify_fidelity_record.mjs <fidelity-record.json> --seal
node <trust-root>/skills/starci-fe-fidelity-fix/scripts/verify_fidelity_record.mjs <fidelity-record.json>
```

It refuses a before and after that disagree on route, viewport, locale, theme, persona, fixture or
owner state — they may differ only in the commit. Two renders taken from different states look
comparable, which is exactly why the difference has to be caught by something that is not looking.

## Strict gate and repair

Run the canonical lint-adoption audit against a real production probe:

```powershell
node <trust-root>/scripts/audit-fe-lint-adoption.mjs --target <target-repo> --probe <production-file>
```

It must return `ok: true` before editing. If lint wiring is inside the confirmed boundary, repair
and re-audit it first; otherwise stop.

Measure the current render/code against the binding evidence in the same frozen state. Freeze one owner, exact files and
touched states. Make the smallest correction that restores behavior and fidelity while following
canon and concrete `starci-academy-fe` source anchors. Do not add a prop, contract, component or
backend capability unless the expected result requires it and ownership is already settled; any
new product decision returns to Plan.

Canon may be proposed for update when the defect exposes a reusable law. Modify trust only when the
user explicitly authorizes that separate write boundary and the source evidence supports a general
rule; one visual preference is not canon.

## Verify

Render before/after evidence for every touched state, run focused tests, typecheck, strict lint,
build as proportional, and rerun lint adoption. Report exact drift fixed and untouched unknowns.
For several independent fixes, the coordinator may dispatch non-overlapping owner/file packets and
must integrate and close them centrally.
