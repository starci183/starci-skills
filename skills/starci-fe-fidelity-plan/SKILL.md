---
name: starci-fe-fidelity-plan
description: Settle what a bounded StarCi frontend repair will change, before changing it — names the binding evidence, freezes the comparison identity, measures the current render against it, and lists every file the fix will touch. Writes no production source. Use for "make this match", a wrong seam, icon, divider, state or small runtime bug. The half that edits is starci-fe-fidelity-apply.
---

# StarCi FE Fidelity Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first.

This lane exists when there is nothing to CHOOSE — only something to restore. It is not a shortcut
for net-new UI, and it is not a licence to redesign on the way past.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

Print the table. `Touching` is nothing: this half writes only the task file.

**Require one binding source for the expected result**, named in the record: an explicit instruction,
a named legacy source or render, an approved review in a task file, a contract's `why`, or a test. If
hierarchy, CTA, behaviour, ownership or reusable vocabulary still needs a choice, this is
`$starci-fe-design-plan` — hand over the evidence already gathered and the ONE decision it has to
settle, so Plan does not rediscover it.

## PROCESS

**Freeze the comparison before measuring:** route, viewport, locale, theme, auth persona, fixture or
seed, owner state, reference commit. A render from another state cannot prove or disprove fidelity,
and two renders from different states look comparable — which is exactly why the difference has to
be caught before anybody looks.

Measure the current render against the binding evidence in that frozen state. Name the defect as a
DIFFERENCE, not as a feeling: the seam that is one rung out, the glyph whose meaning is wrong, the
state that renders when it should be absent. A defect nobody can measure is a defect Apply cannot
prove it fixed.

Then list every file the smallest correction touches, and stop. Do not add a prop, contract,
component or backend capability to the list unless the expected result requires it and ownership is
already settled. A backend capability the repair turns out to need is `$starci-be-feature-plan`,
which returns here.

**Inventory before invention.** If the correction needs a new entry, composite or row, list the
existing keys whose shape already expresses the same relationship and say REUSE, EXTEND, or NEW
because <the relationship nothing existing can express>.

Canon may be PROPOSED for update when the defect exposes a reusable law — recorded here as a
proposal, never written. One visual preference is not canon.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. Append `## plan` to
`<Source>/.workflows/fidel/<app>/<id>.md` with binding evidence, frozen comparison, measured
difference and proposed file boundary. `OUTPUTS` names the correction brief; `CHANGES` details the
workflow path only. Then invite `$starci-fe-fidelity-review`.
