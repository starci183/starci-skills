---
name: starci-fe-consolidate-plan
description: Survey a stated scope of the StarCi frontend for near-duplicate owners, group them into clusters anchored at real call sites, and settle each cluster with one verdict — merge into one owner, add one named variant prop, extract the shared shape as a domain-free composite, or keep the pair apart — then stop for approval. It writes a proposal and changes no code. Use it whenever the job is to FIND the duplication rather than fix it: "tìm component trùng", "scan for duplicate blocks", "where is this card copy-pasted", "is there already a component for this before I write another one", "what should we consolidate next", or before a redesign when nobody knows how many copies of a shape exist. The half that edits is starci-fe-consolidate-apply. Not for net-new UI, which belongs to starci-fe-design-plan, and not for matching a named reference, which is starci-fe-fidelity-fix.
---

# StarCi FE Consolidate Plan

Duplication is evidence, not a defect list. Two files holding the same markup say that a shape was
needed twice and the vocabulary had no word for it, and the useful output of a survey is that
sentence rather than a count.

The expensive mistake runs the other way, and it is why this half exists separately. Merging two
clusters that merely LOOK alike produces something worse than the duplication: one owner carrying a
flag for every call site, which no reader holds in their head and no story renders honestly. So this
half spends its effort on the question a later editor cannot re-derive from a diff — **are these the
same thing** — and hands the mechanical part to Apply.

**It writes a proposal and changes no line of code.** Editing while surveying destroys the evidence
the proposal rests on: a call-site count measured against a tree that no longer exists cannot be
checked by anybody reviewing it.

## Admission and Context Lock

Read [`../../CONTEXT-LOCK.md`](../../CONTEXT-LOCK.md), detect and print the lock, stop on ambiguity,
and persist `context-lock.consolidate-plan.md/json`. This phase writes only its artifact root;
target source and trust stay read-only.

Route away when the request is not this: net-new UI or an undecided product shape goes to
`$starci-fe-design-plan`; making one screen match a named reference goes to
`$starci-fe-fidelity-fix`. Consolidation changes ownership and never changes the render — that
promise is [`refactor-parity`](../../fe/design/refactor-parity.md), and a survey that also improves
the design is two changes wearing one commit.

Read [`references/steps-table.md`](references/steps-table.md),
[`references/consolidation-plan.md`](references/consolidation-plan.md), the layer files under
[`../../fe/canon/uxui/layers/`](../../fe/canon/uxui/layers/) and
[`props-and-slots`](../../fe/canon/patterns/props-and-slots.md).

## State the scope, then measure the tree that still exists

The scope is stated, never assumed: the whole app, one route, one feature folder, or a named file
set. A survey with no stated scope reports whatever it happened to walk, and its ranking cannot be
compared with the last one.

Count **imports and call sites, never string occurrences.** A grep for a component name also matches
its own definition, its story, its re-export and every comment mentioning it, and a cluster inflated
that way outranks one that is genuinely three times worse.

Two call sites is an anchor to those two files. Three is a pattern. Extracting a NEW owner needs
three, for the same reason canon promotes an observation to a rule only when it repeats: the second
file may be the one about to change.

A scope wider than one route may be swept by several readers, one per subtree, and their results are
merged BEFORE anything is ranked. Fan out the sweep; keep the judgement in one place. Impact is a
comparison, and a comparison made inside one subtree cannot see the third copy in the next one —
which is exactly the copy that turns a curiosity into a cluster.

## The three tests that settle a cluster

**Does either copy know a domain entity, and is it the same entity?** A component taking `courseId`
is a block wherever its folder sits. Two blocks over two different entities that render identically
are not one block — they are two blocks with a [`composite`](../../fe/canon/uxui/layers/composite.md)
hiding inside them. The shape earns a name; the meaning does not.

**How many flags would unification cost?** One named variant is a variant. If joining the copies
needs a boolean per call site, they were two components and the survey found a coincidence.

**Would the merged owner need a `className` to serve both callers?** Then it is not a consolidation.
[`SLOTS-6`](../../fe/canon/patterns/props-and-slots.md) refuses the appearance slot outright: a
caller who can restyle a node has become its second owner.

Every cluster ends at exactly one verdict: `merge`, `prop-variant`, `extract-composite` or
`keep-apart`. Record `keep-apart` with its reason. A pair compared and deliberately not merged is a
finding, and leaving it unwritten invites the next survey to spend the same effort reaching the same
answer.

## Rank, stop, hand off

Show a compact table in conversation: cluster, members, call-site count, verdict, and what the
verdict costs. Rank by call sites reached, never by lines saved. Then **stop for approval of the
verdict set** — once, for the whole set, as one form the reader answers in a single pass. Do not
begin editing, and do not treat a ranking as an instruction.

A cluster the survey could not settle on its own is a row in that form, not a halt where it was
found. So is a SUB-RUN the sweep uncovers — a repository whose lint adoption is failing cannot be
measured honestly, and that names `$starci-fe-lint-sync`, which runs and returns here rather than
replacing the survey. It arrives with the verdict the evidence leans to, what makes it uncertain, and what changes
if the reader picks the other one. Surveying produces these one at a time and asking them that way
makes the reader pay a round trip per cluster, which is how a survey stops being run to the end.

When the answer is ambiguous — "gộp hết đi", "cái nào cũng được", silence — ask once more about the
specific clusters in doubt. If it stays ambiguous, default those clusters to `keep-apart`, because
doing nothing is the reversible option here and a wrong merge is not. Record it as
`approvalKind: default-after-ambiguity` with the reason, and say plainly that it was a default.

Write `consolidation-plan.md/json` and validate before routing:

```powershell
node <trust-root>/skills/starci-fe-consolidate-plan/scripts/verify_consolidation_plan.mjs <consolidation-plan.json>
```

It must report `ok: true`. Then INVITE `$starci-fe-consolidate-apply` by name with the approved
clusters, per [`../../handoff.md`](../../handoff.md): say how many clusters and call sites it will
touch, and that it opens by confirming the write boundary. The reader starts it — but say plainly
that the measurement ages from here, because a plan applied against a tree that has moved on is a
plan nobody can check.

Clusters the reader left at `keep-apart` or `default-after-ambiguity` do not travel. Only the
approved set does, and it travels whole.
