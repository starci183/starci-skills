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
ownership or reusable vocabulary still needs a choice, name `$starci-fe-design-plan` and hand over the
evidence already gathered plus the ONE decision Plan has to settle, per
[`../../handoff.md`](../../handoff.md). This lane holds the reason Plan is needed, and passing that
reason on as a bare routing note leaves Plan to rediscover it.

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

It must return `ok: true` before editing. If lint wiring is inside the confirmed boundary, repair and
re-audit it first. If it is outside, this is not a dead end: report which rules are missing or
weakened, name `$starci-fe-lint-sync` as the thing that fixes it, and put the boundary extension to
the user as a DECISION beside everything else the run has gathered — extending the boundary to the
config is one line for them and unblocks the whole lane. Stopping on `ok: false` with nothing else
said is the refusal shape [`../../handoff.md`](../../handoff.md) refuses.

Measure the current render/code against the binding evidence in the same frozen state. Freeze one owner, exact files and
touched states. Make the smallest correction that restores behavior and fidelity while following
canon and concrete `starci-academy-fe` source anchors. Do not add a prop, contract, component or
backend capability unless the expected result requires it and ownership is already settled; a new
product decision goes back to Plan carrying the measurement that exposed it, named as the one
decision Plan has to settle — not the whole screen reopened because one seam was wrong. A backend
capability the repair turns out to need is a SUB-RUN: name `$starci-be-feature-plan`, say what it
will expose, and resume this repair when it returns.

Inventory before invention. When the correction does require a new contract entry, composite or row,
list first the existing keys and composites whose shape already expresses the same relationship and
record one verdict per candidate: REUSE, EXTEND, or NEW because <the relationship no existing key can
express>. An entry whose class list and child identities repeat an existing entry is not a new
concept, it is the same concept under a second name, and `starci-fe/no-duplicate-entry-shape` refuses
it. A row assembled inline from a leaf plus a glyph is the same failure where no lint can see it,
because it never became an entry at all. This repository has already paid for it: a value-proposition
list was written with the exact class list of the day's-quest list, and its ticked row was rebuilt
from a text leaf and an icon while the composite that draws that row already shipped.

Canon may be proposed for update when the defect exposes a reusable law. Modify trust only when the
user explicitly authorizes that separate write boundary and the source evidence supports a general
rule; one visual preference is not canon.

## Verify

After editing the contract table, run the target repository's typecheck before rendering anything:
the class vocabulary is a closed union, so one unadmitted token makes the whole table fail to type
and reports as errors in unrelated files.

Render before/after evidence for every touched state, run focused tests, typecheck, strict lint,
build as proportional, and rerun lint adoption. When the browser refuses to composite, take the
headless fallback in
[`../starci-fe-design-preview/references/state-coverage.md`](../starci-fe-design-preview/references/state-coverage.md)
before recording any state as uncaptured — this lane is judged on a pair of images, so the camera
failing is the one failure it must not accept on the first try.

Report exact drift fixed and untouched unknowns. This lane invites nothing after it, so its close is
the item form itself, per [`../../handoff.md`](../../handoff.md): ONE pass, sorted by who can clear
each line — what the run already handled, each DECISION with the default in force, each RESOURCE with
the command that supplies it, each SUB-RUN with the skill that owns it and its return here.

For several independent fixes, the coordinator may dispatch non-overlapping owner/file packets and
must integrate and close them centrally. One packet blocked does not hold the others: the clear ones
land and are proved, and the blocked one is named with what it waits on.
