---
name: starci-fe-design-review
description: Challenge and revise an evidence-backed StarCi frontend design brief before source changes begin. Use after starci-fe-design-plan records the selected direction. Freezes the exact page, layout, overlay, block, composite, branch, leaf and shell tree plus every public-prop migration; writes no HTML, JSX, CSS or production source and ends with one explicitly approved revision for starci-fe-design-apply.
---

# StarCi FE Design Review

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Then read the Review decision owners:
[`critique.md`](../../fe/creativity/critique.md),
[`selection.md`](../../fe/creativity/selection.md),
[`contract-graph.md`](../../fe/creativity/contract-graph.md) and
[`verification.md`](../../fe/creativity/verification.md).

Review settles what Apply will build. It does not build a second implementation for Apply to copy.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

`Touching` is the workflow and declared review evidence only. Read `## plan`; if it has no selected
direction, return to `$starci-fe-design-plan`. Review writes no target source.

## PROCESS

Challenge the selected direction against live contracts, existing source ownership, the relevant
[`../../fe/canon/uxui/layers/`](../../fe/canon/uxui/layers/) rules and
[`../../fe/canon/patterns/contract.md`](../../fe/canon/patterns/contract.md). Confirm exact target
paths, owner states, fixture identities and acceptance commands.

Read the live target imports, exports, prop types and call sites. Freeze every owner in the approved
tree only after the following decision artifacts are settled.

Print the selected direction's canonical research rows from
[`research.md`](../../fe/creativity/research.md) under `### INTERACTION CONSEQUENCE`. Reject a visible
interaction with a missing or wildcard trigger, product owner, visual state, pending, success,
failure, persistence/shared effect or evidence claim. `N/A` requires evidence.

For every proposed `ADD composite` or `ADD block`, print the canonical graph rows under
`### OWNER CHALLENGE`. Search live contracts, components, imports and call sites; try `REUSE` and
`ALTER` before `KEEP_APART` or `ADD`. Every such ADD must match one challenge row and its
layer-specific proof. Print this heading before `### COMPONENT DELTA`.

For every added or changed icon, badge, chip, border, surface, wrapper or selected paint, print the
canonical critique rows under `### VISUAL JOB`. Reject chrome without an observable recognition,
grouping or interaction-state job. Bind its complete applicable state family in acceptance
evidence.

Then freeze every owner in the approved tree under the exact heading `### COMPONENT DELTA`:

| Layer | Owner | Action | Current path | Final path | Parent / call sites | Contract | Reason |
|---|---|---|---|---|---|---|---|

`Layer` is `route`, `page`, `layout`, `overlay`, `block`, `composite`, `branch`, `leaf` or `shell`.
`Action` is `REUSE`, `ADD`, `MODIFY`, `MOVE` or `REMOVE`; `EXTEND` becomes `MODIFY` and `NEW`
becomes `ADD` so the row predicts a real diff. Record both paths for `MOVE`, every consumer for
`REMOVE`, and the exact parent or call sites for every row. `REUSE` means no source edit. Reject a
duplicate shape under a second name.

Freeze the public interface of every `ADD`, `MODIFY`, `MOVE` or `REMOVE` owner under the exact
heading `### PROPS DELTA`:

| Owner | Prop / API | Action | Before | After | Producers / call sites | Migration proof |
|---|---|---|---|---|---|---|

Use `KEEP`, `ADD`, `REMOVE`, `RENAME`, `RETYPE`, `MAKE_REQUIRED`, `MAKE_OPTIONAL` or
`CHANGE_DEFAULT`. A component with no public-interface change gets one `KEEP` row; silence is not a
verdict. For a removed or renamed prop, name every producer and how source proves none is left. Include
the connected/pure twin boundary, state union, contract key or slot API when that is the interface
that changes.

Reject approval if a required decision artifact or either delta table is absent, has unresolved
wildcards, defers inventory to Apply, or names an owner without inspecting its live definition and
consumers. An empty `VISUAL JOB` table is valid only when no listed visual element is added or
changed. The production boundary may also name contracts, fixtures, messages, hooks and transport
files, but it cannot substitute for the decision artifacts or two component-interface tables.

Review two to four conceptual directions only when the Plan still carries a real unresolved product
choice. Create no HTML, JSX, CSS, design-code directory, copied component tree or production edit.
The approved revision must be precise enough that Apply can work directly in final source paths.

Use this loop until explicit approval:

```text
brief -> feedback -> revised brief -> workflow append -> brief
```

Record every rejection with its replacement and reason. Append `## review` with
`Approved revision: <identity>`, both delta tables, the exact supporting production boundary, owner
states and acceptance evidence. Then invite `$starci-fe-design-apply`.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED`
and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

`OUTPUTS` names the approved concept and acceptance meaning. `CHANGES` details workflow/evidence
paths only. Production paths belong to the approved component/props delta and supporting boundary,
not to Review's written changes.
