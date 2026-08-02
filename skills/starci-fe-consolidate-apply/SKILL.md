---
name: starci-fe-consolidate-apply
description: Consolidates one batch of duplicated components into a single canonical component and rewires the call sites, working from a proposal written by starci-fe-consolidate-scan — it reuses or extracts the target as a component and a story in the design system first, replaces every call site the cluster names, deletes the code that was duplicated, verifies with the type checker, the source gates under `patterns/fe/gates/` and the rendered-tree runner, then records what landed. Use it when the finding already exists and the work is to land it: "apply the consolidation", "do the first batch in the proposal", "merge these three cards into one component", "gom component đã chốt", "chốt gom theo proposal", "replace the copies with the block we extracted". Use it also when a scan and an apply happen in different sessions, because the proposal is the whole handover. Not for finding duplication or for changing what a proposal says — that is starci-fe-consolidate-scan, and a consolidation you would rather do differently goes back there first. Not for authoring a component nobody has asked for yet.
---

# Consolidating duplicates

A half-finished consolidation is worse than the duplication it replaced. Before, there were three
copies and everyone could see three copies. After a partial job there are two copies plus a component
claiming to be canonical, and the next person reads the claim, extends the canonical one, and ships a
change that reaches one of the three screens.

That is the whole shape of this half.

**Every call site the cluster names is replaced, or the consolidation did not happen.**

The unit of work is the cluster, not the file, and a cluster is done when the code it duplicated has
been deleted.

## Where the code is

```bash
node .claude/scripts/read-workspace-context.mjs fe.path
node .claude/scripts/read-workspace-context.mjs fe.design_system
node .claude/scripts/read-workspace-context.mjs fe.artifacts
```

The proposal is `consolidate/<scope>.md` under the artifacts folder. It was written beside the tree it
describes precisely so this session can be a different session on a different machine.

## 1. Take one cluster and mark it

Open the proposal, take the highest-ranked pending cluster in the batch, and set its state to in
progress before touching anything. Two people consolidating the same cluster from two branches produce
a merge nobody can reconcile, because both sides deleted the other's call sites.

Read the cluster's own row rather than the summary: the call sites by path, the named target, the
files it says will be touched. If the source no longer matches what the row claims — a call site is
gone, a fourth copy appeared — stop and re-scan. A proposal is a claim about a tree at a moment, and
consolidating against a stale one silently leaves a copy behind.

## 2. The difference between the copies is the specification

This is the step people skip, and it is where the design actually happens. Diff the copies against one
another and place every difference deliberately. Each kind lands somewhere specific:

| The copies differ in | Where the difference belongs |
|---|---|
| the text or the data shown | a prop — this is the difference the component exists to absorb |
| colour, weight, size, density | a `tone` · `size` · `variant` owned by the design system, `canon/fe/enforce/tiers/architecture.md` |
| the seam or the inset between parts | a named concept from `canon/fe/enforce/spacing/overview.md`, never a hand-written class |
| where the thing sits in its parent | the position union, `canon/fe/enforce/spacing/position.md` |
| one fetches, the other takes props | the split — the presentational twin is the shared thing, `canon/fe/enforce/tiers/split.md` |
| what happens on interaction, per call site | nothing here: they are two components, and this cluster was wrong |

The last row is a real outcome and reaching it is not a failure. Record it in the proposal with the
reason, and consolidate the part they genuinely share, if any.

A difference that has nowhere to land in this table is the signal that unification is being bought
with a `className`. A block takes none. The route to a different look runs one tier down — extend the
composite, or write the atom — and that change is named, sits in one place, and every later screen
inherits it.

## 3. Build the target in the design system, first

No component reaches the app that was never a component and a story in the design-system folder first.
That is not a convention this skill can trade away for a shorter diff: after the split the design
system is a story layer over the code that ships, so a component that skipped it has no state matrix
anybody can read, and the first person to need a fourth variant has nothing to read before writing it.

**Reusing an existing target.** Extend it where it is: one added prop, one added variant, its story
gaining exactly one state for the value that was added. Never copy it next to itself under a new name.

**Extracting a new target.** Author it under the tier the proposal named, spelled the house way:
`canon/fe/enforce/authoring/structure-and-naming.md` for where it goes and what it is called,
`canon/fe/enforce/authoring/props-and-types.md` for how the props are declared,
`canon/fe/enforce/authoring/imports-and-format.md` for the import block. A data-owning tier is one folder with
two files, the presentational `_Name` and the connected `Name` — `canon/fe/enforce/tiers/architecture.md` and
`canon/fe/enforce/tiers/split.md`. Translation is data and belongs to the connected half:
`canon/fe/enforce/authoring/i18n.md`.

Then the story, which is a storymap and not a demo — one prop per leaf, every value of that prop
rendered, each state carrying the sentence that says when to reach for it:
`canon/fe/enforce/tiers/story.md`, spelled per `canon/fe/enforce/authoring/storybook-stories.md`.

If the copies had loading states, the skeleton mirrors the loaded shape and declares the **same**
spacing concepts, so nothing jumps when data lands: `canon/fe/enforce/authoring/loading-and-skeleton.md`.

## 4. Replace every call site, then delete

Work the call sites in the order the proposal lists them, and delete the duplicated code as each one
is replaced rather than at the end. A deletion deferred to the end is a deletion that gets forgotten
under a passing type check — the old code still compiles, still renders, and is now the fourth copy.

The app imports its own twin, never the design-system tree directly; `patterns/fe/gates/check-src-sb-import.mjs`
holds that line. Nothing above the vocabulary tiers gains a `className` in the process, and no page
composes a class at all.

## 5. Verify

Three layers, and they see different things. The type checker proves the wiring; the source gates
prove the shape of the files; the runner proves what the browser actually produced.

```bash
FE=$(node .claude/scripts/read-workspace-context.mjs fe.path)
npx tsc --noEmit -p "$FE"
npm --prefix "$FE" run lint
```

Then the gates that this kind of change breaks most often:

| Gate | What it catches here |
|---|---|
| `patterns/fe/gates/check-story-coverage.mjs` | a target that reached the app without a story |
| `patterns/fe/gates/check-doc-parity.mjs` | the component's spec block and its story's drifting apart |
| `patterns/fe/gates/check-src-sb-import.mjs` | app code importing the design system instead of its twin |
| `patterns/fe/gates/check-passthrough-block.mjs` | a "consolidated" block that only forwards |
| `patterns/fe/gates/check-deps-coverage.mjs` | a call site the rewiring missed |
| `patterns/fe/gates/check-seams.mjs` · `patterns/fe/gates/check-padding.mjs` | spacing hand-written while merging |
| `patterns/fe/gates/check-pattern-coverage.mjs` | a seam realised in the new target and never named |
| `patterns/fe/gates/check-one-instance-per-state.mjs` · `patterns/fe/gates/check-no-namespace.mjs` | the story written as a demo |
| `patterns/fe/gates/check-skeleton-prop.mjs` · `patterns/fe/gates/check-inline-types.mjs` | declarations no render exposes |

Finally the rendered-tree runner, `patterns/fe/runner/test-runner.ts`, which resolves its vocabulary
from `patterns/fe/patterns.mjs` and measures the boxes the browser produced rather than the strings
the files contain. What each audit can and cannot prove is `canon/fe/enforce/testing.md` — read it before
treating a green run as more than it is.

Then look at the screens. A consolidation that type-checks, passes every gate and renders the wrong
thing on one of five call sites is the exact failure no machine in this list catches.

## 6. When the change reaches the back end

Occasionally two duplicated blocks fetched two near-identical shapes, and one canonical block wants
one query instead of two. That is a real API change and it is not a side effect of a front-end
cleanup: it follows `canon/be/contracts/api-surface.md`, and it is worth saying out loud before doing
it, because the proposal did not ask for it.

## 7. Record what landed

1. **The proposal.** Set each consolidated cluster's state to consolidated, with the date. Leave every
   other row untouched — the next scan reads this file and must not re-propose what just shipped, nor
   forget what was refused.
2. **The debt ledger.** Close any entry that recorded this duplication, saying how it was paid:
   `.claude/skills/starci-record-debt/SKILL.md`. A cluster that turned out to be two components gets a
   new entry instead, with the reason, so no future scan spends its budget on it.
3. **The canon, only if the change taught something.** A rule earns its place by describing what the
   code already does, and it carries the file it was read from and the day it was measured —
   `canon/HOW-TO-WRITE.md`. Re-ground the anchors afterwards with `patterns/verify.mjs`.

## Constraints

Follow the cluster's specification. A consolidation you would rather do differently — a different
target, a different tier, a fourth copy nobody had counted — goes back to
`.claude/skills/starci-fe-consolidate-scan/SKILL.md`, which is cheap, rather than being decided
silently inside a diff that claims to be applying an approved plan.

## Common mistakes

- **Leaving one call site.** The reason for the whole skill. `patterns/fe/gates/check-deps-coverage.mjs`
  and a grep of the deleted markup both find it in seconds.
- **Keeping the old code beside the new component "until it settles".** It never settles; it gets
  imported.
- **Buying the merge with a `className` or a per-caller flag.** That is a variant explosion wearing a
  consolidation's clothes.
- **Writing the component in the app and back-filling the story.** The story is what makes the states
  reviewable, and a back-filled one documents whatever shipped rather than what was decided.
- **Extending the target beyond the cluster.** Props added for a call site that does not exist yet are
  a guess with a permanent home.
- **Marking the proposal done from memory.** Set the state in the file; the next session has only the
  file.

## Files

| Path | What it is |
|---|---|
| `.claude/scripts/read-workspace-context.mjs` | resolves both trees, per machine |
| `<fe.artifacts>/consolidate/<scope>.md` | the proposal being applied, and where the result is recorded |
| `.claude/skills/starci-fe-consolidate-scan/SKILL.md` | the half that finds and proposes |
| `README.md` | why this is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-consolidate-apply/test.mjs` |
