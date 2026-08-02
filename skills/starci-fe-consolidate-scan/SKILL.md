---
name: starci-fe-consolidate-scan
description: Finds duplicated and near-duplicate component code across a stated scope of the front end, groups it into clusters anchored at real call sites, names one canonical target per cluster — an existing component to reuse, or a new one to extract — and writes that as a ranked proposal beside the tree it describes, without editing a line. Use it whenever the job is to find the duplication rather than to fix it: "scan for duplicate components", "where is this card copy-pasted", "what should we consolidate next", "is there already a component for this before I write another one", "tìm component trùng", "quét lặp code trang khoá học", or before a redesign, when nobody yet knows how many copies of a shape exist. Use it also when a screen feels heavy for what it does and the suspicion is copied markup rather than logic. Not the half that changes code — the proposal it writes is built by starci-fe-consolidate-apply. Not for deciding which component a fresh data shape becomes (that lookup is `canon/fe/explore/component/data/matrix.csv`) and not for auditing one screen against canon.
---

# Finding duplicate components

Duplication is evidence, not a defect list. Two files holding the same markup say something happened
— a shape was needed twice and the vocabulary had no word for it — and the useful output of a scan is
that sentence, not a count.

The expensive mistake is the opposite one, and it is why this half exists separately. Merging two
clusters that merely *look* alike produces something worse than the duplication: one component with a
flag for every call site, which no reader can hold in their head and no story can render honestly. So
the scan spends its effort on the question a later editor cannot re-derive from a diff — *are these
the same thing* — and hands the mechanical part to the apply.

**The scan writes a proposal and changes no code.** Editing while scanning destroys the evidence the
proposal rests on: the call-site count in a cluster was measured against a tree that no longer exists,
and nobody reviewing the proposal can check it.

## Where the code is

Never write a path down. Ask, every session:

```bash
node .claude/scripts/read-workspace-context.mjs fe.path
node .claude/scripts/read-workspace-context.mjs fe.design_system
node .claude/scripts/read-workspace-context.mjs fe.artifacts
```

A missing context exits non-zero and prints the command that fixes it; `starci-setup-workspace-fe`
owns that record. When the project borrows the ecosystem's book rather than carrying its own,
`design_system.path` is the answer instead — see `.claude/skills/starci-setup-storybook-choose/SKILL.md`.

These are **two trees and two different findings**. A shape duplicated inside the design system is a
vocabulary that split in half; a shape duplicated across app code is a missing import of a word that
already exists. Reading them as one pile hides which of the two you are looking at.

## 1. State the scope

The scope is stated, never assumed: the whole app, one route, one feature folder, or a named set of
files. A scan with no stated scope reports whatever it happened to walk, and the ranking that comes
out of it cannot be compared with the last one.

A scope wider than a single route is swept by several readers, one per subtree, and the results are
merged **before** anything is ranked. Fan out the sweep; keep the judgement in one place. Impact is a
comparison, and a comparison made inside one subtree cannot see the third copy sitting in the next
one — which is exactly the copy that turns a curiosity into a cluster.

## 2. Sweep for clusters

Four shapes are worth the sweep, and each is anchored at real files before it is written down:

| What you find | What it usually means |
|---|---|
| the same JSX cluster in two or more files | a composite was needed and never written |
| the same class string repeated across call sites | a variant of an existing component, not a new one |
| two components with the same structure over different data | one component with a typed prop, if the data means the same thing |
| several sites hand-rolling the same primitive | a missing atom, and every hand-roll drifts separately |

Count **imports and call sites**, not string occurrences. A grep for a component name matches its own
definition, its story, its re-export and every comment mentioning it, and a cluster inflated that way
gets ranked above one that is genuinely three times worse.

Two call sites is an anchor to those two files. Three is a pattern. That is the same standard
`canon/HOW-TO-WRITE.md` sets for promoting an observation to a rule, and it applies here for the same
reason: a cluster of two is worth recording and is not yet worth a component, because the second file
may be the one that is about to change.

## 3. Test each cluster: the same thing, or the same picture

Shape is what a sweep can see. Meaning is what decides, and there are three tests that settle almost
every case.

**Does either copy know a domain entity, and is it the same entity?** A component taking `courseId`
is a block whatever folder it sits in — `canon/fe/enforce/tiers/architecture.md`. Two blocks over two different
entities that render identically are two blocks with one composite hiding inside them, and the
composite is the real finding.

**How many flags would unification cost?** If joining the copies needs a boolean per call site, they
were two components and the sweep found a coincidence. Name the shared part instead, if there is one,
and leave the rest alone.

**Would the merged component need a `className` to serve both callers?** Then it is not a
consolidation. A block takes no `className`, and handing one out is how a single component grows five
undocumented variants living in five call sites — the failure `canon/fe/enforce/tiers/architecture.md` spells out at
length. A difference in appearance belongs one tier down as a `tone`, a `size` or a `variant`; a
difference in placement belongs to the position union in
`canon/fe/enforce/spacing/position.md`.

When two copies genuinely differ in meaning, record that they were compared and kept apart. An
unexplained near-duplicate is re-proposed by the next scan, and refused again, forever.

## 4. Name the target

Every cluster names exactly one target, and the proposal says which of the two kinds it is.

**Reuse.** Search the design system before proposing anything new. A cluster whose target already
exists is the cheapest row in the proposal and the easiest to get wrong, because the existing
component is usually one prop short of fitting and it is tempting to write a second one instead.

**Extract.** Enter the lookup from the shape of the data in your hand and read across to exactly one
component: `canon/fe/explore/component/data/matrix.csv`, with its deciding tests in
`canon/fe/explore/component/data/sections.csv` and the section-by-section traps in
`canon/fe/explore/component/references/traps.md`. Never read backward from a name you already had in mind — the
failure that produces is type-valid and renders fine.

Then the tier, from `canon/fe/enforce/tiers/architecture.md` and the machine-readable table
`patterns/fe/data/tiers.csv`. When two tiers both fit, pick the lower one. Where a boundary looks
arbitrary, the reason it sits there is in `canon/fe/enforce/tiers/references/tier-boundaries.md`.

A proposed target is a **component and a story in the design system**, in that order, always — no
component reaches the app that was never a component and a story there first. The scan only names it;
building it belongs to the apply.

## 5. Write the proposal

The proposal lives beside the tree it describes, under the artifacts folder that
`read-workspace-context.mjs fe.artifacts` resolves — `consolidate/<scope>.md`. A project with no
artifacts folder yet gets one at `fe.path`. Writing it into this skill set instead would be the same
mistake as an absolute path in a debt entry: a claim about one checkout, stored where a different
checkout will read it.

The file holds two parts, and the first is longer than the second.

**Every cluster found in the scope, ranked by impact** — call sites first, then how close the copies
are, then what the duplication is already costing. Each row carries its state written as a word:
pending, in progress, consolidated with its date, or left alone with the reason it was left. This is
the full picture, kept so the next scan can be read against this one.

**The batch**, which is three clusters. Each one names its call sites by path, its target, the files
the apply will touch, and what verification will prove it landed.

Re-running the scan **updates** this file rather than replacing it: new clusters are added, existing
states are kept, and a cluster already refused stays refused. A scan that rewrites the file loses the
record of every decision somebody already made, and re-proposes work that was deliberately declined.

## 6. Why three

Three is not a throughput target, it is a review budget. A proposal of thirty clusters is approved as
a whole or not at all, and approving it as a whole means nobody weighed the fourth-ranked one. Three
can be argued with individually, which is the only form of approval worth having — and the ranked
list underneath means the fourth is already written down and loses nothing by waiting.

When no pending cluster is left in the scope, say so plainly. "No duplication left in this scope" is a
real and useful result, and padding the batch to three with weak clusters destroys the ranking that
made the strong ones credible.

## Clusters you decide not to consolidate

Record them, with the reason, through `.claude/skills/starci-record-debt/SKILL.md`. A near-duplicate
that was weighed and kept looks exactly like one nobody noticed, and the note is what stops the next
scan spending its ranking budget on it again.

## What the scan may not do

No file in either tree is edited. No component is created, no story is written, no call site moves.
Reading duplicated code makes the fix look obvious and cheap, and it usually is — take it in the
apply, where the change is verified and recorded, rather than as a side effect of a scan that reports
having changed nothing.

## Offering the apply

Finish by asking whether to consolidate the batch now. Agreement moves straight to
`.claude/skills/starci-fe-consolidate-apply/SKILL.md`; a no costs nothing, because the proposal is the
handover and reads the same in a session next month.

## Common mistakes

- **Ranking by how bad the code looks.** Impact is call sites and drift, not aesthetics. The ugliest
  duplicate in the app is often two files nobody opens.
- **Counting a name instead of an import.** Definitions, stories and comments all match a grep.
- **Reading a folder name as the tier.** The folder records the judgement; it never makes it.
- **Merging the app tree and the design-system tree into one list.** They are different findings with
  different fixes.
- **Proposing a target that exists.** Search first; a second near-identical component is the exact
  thing this skill was written to prevent, and a scan that creates one has done net harm.
- **Skipping the reason on a cluster kept apart.** Unexplained, it comes back every scan.

## Files

| Path | What it is |
|---|---|
| `.claude/scripts/read-workspace-context.mjs` | resolves both trees, per machine |
| `<fe.artifacts>/consolidate/<scope>.md` | the proposal, beside the tree it describes |
| `.claude/skills/starci-fe-consolidate-apply/SKILL.md` | the half that builds it |
| `README.md` | why this is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-consolidate-scan/test.mjs` |
