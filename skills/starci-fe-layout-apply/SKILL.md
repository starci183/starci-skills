---
name: starci-fe-layout-apply
description: Builds an approved layout proposal into real code — the whole surface set at once: every component the proposal needs is authored first as a component and a story in the design-system folder, at its tier, and only then composed into the route's page, the layout shell and each modal and drawer, with routing, data wiring and, when the feature genuinely needs it, the back-end fields and resolvers behind it; it then verifies the result against the type checker, the source gates and the rendered-tree runner, walks the proposal's own verify plan in the running app, and closes the proposal out in the queue. Reach for it when a design has already been settled and the work is to land it: "apply the proposal", "build the enrolment flow we agreed", "dựng layout đã chốt", "build what's queued for the checkout page", "làm tiếp cái proposal hôm qua", "ship the design from the prototype", "sửa layout theo proposal". It builds only what a proposal says — designing or redesigning a flow is starci-fe-layout-brainstorm, and changing one block or one component's internals on a surface that already exists is starci-fe-review.
---

# Building an approved surface set

Build order is most of this skill. A surface is assembled out of components, some of which do not
exist yet, and the order in which those come into existence decides whether they end up reusable or
accidental. Write the page first and the missing pieces get inlined into it, shaped by the one
screen that needed them, with no story and no state matrix anybody can read; extracting them later
is a rewrite that never gets scheduled. Author them first, in the design system, and the page turns
into what a page is supposed to be — an arrangement.

That is the law this phase exists to keep, and canon states it without qualification in
`canon/fe/enforce/tiers/architecture.md`:
**No component reaches the app that was never a component and a story in the design-system folder first.**

The second shape is the unit. A proposal is applied whole, not block by block, because the flow's
surfaces were designed against each other: the shell that page two shares with page one, the drawer
that reuses the list from the page behind it, the empty state that points at the surface three steps
along. Landing half of that produces a set that disagrees with itself, and the disagreement is
invisible until somebody walks the flow.

## Where the source is

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs fe.design_system
node .claude/scripts/workspace/read-workspace-context.mjs be.path
```

Ask every time rather than remembering an answer from earlier in the session. A missing context
exits non-zero and prints the command that fixes it; `starci-setup-workspace-fe` and
`starci-setup-workspace-be` register the sources.

## 1. Take one proposal off the queue

Open `.claude/fe/proposals/BACKLOG.md` under `fe.path`. Pick the proposal named in the request, or —
when several are pending and none was named — ask which, rather than choosing by position. Move its
line to `in progress` before starting. The backlog is the only place that knows what has been built,
so a build that never touched it is a build somebody will later do twice.

## 2. Read the spec, and the canon it leans on

Read `.claude/fe/proposals/<feature>.proposal.md` in full: the flow surface by surface, the shell
each job chose, the zones, the state matrix with its conversion lens, the block briefs, the list of
components that do not exist yet, the files expected to be touched, and the verify plan.

Then walk the prototype it references. It exists because a described layout gets agreed to and a
clicked one gets understood, and that applies to the person building it at least as much as to the
person who approved it — the state toggles are where the intent actually lives.

Then read the canon the build will be graded against, before writing code rather than after:

| For | Read |
|---|---|
| tier, import direction, the presentational and connected split | `canon/fe/enforce/tiers/architecture.md`, `canon/fe/enforce/tiers/split.md` |
| what a page, a layout shell and an overlay each own | `canon/fe/enforce/tiers/page.md`, `canon/fe/enforce/tiers/layout.md`, `canon/fe/enforce/tiers/overlay.md` |
| what a story must render, and how the file is spelled | `canon/fe/enforce/tiers/story.md`, `canon/fe/enforce/authoring/storybook-stories.md` |
| seams, insets, and the named container widths | `canon/fe/enforce/spacing/overview.md`, with `canon/fe/explore/registry.mjs` as the authority on values |
| fetching, and what the loading state owes the reader | `canon/fe/enforce/authoring/async-data.md`, `canon/fe/enforce/authoring/loading-and-skeleton.md` |
| modal, drawer and toast as code | `canon/fe/enforce/authoring/overlay-and-feedback.md` |
| file placement, prop declaration, class writing, translated strings | `canon/fe/enforce/authoring/INDEX.md` and the file it points at |
| anything on the back end | `canon/be/INDEX.md` |

## 3. Write the implementation spec before touching code

Not a plan in conversation — a written spec, because it is the thing that keeps a wide build
coherent across the hours it takes. It names, per file: what changes, the shape the code takes, the
edge cases, and the order. It names which components have to be authored and at which tier. It names
every back-end change and states plainly that the back end goes first. A build that starts without
this reliably discovers on the fourth surface that the second one made an assumption it cannot keep.

## 4. Build, in this order

**4a. The back end, when the proposal needs it.** This skill is not confined to the front end. A
surface that needs a field, a resolver, a gate or a new relation gets it, in the tree at `be.path`,
under `canon/be/contracts/api-surface.md`, `canon/be/contracts/validation.md`,
`canon/be/contracts/exceptions.md` and `canon/be/modules/database-and-entities.md`. It goes first
because the front end is about to be written against its shape, and a shape that changes underneath
half-built surfaces is the most expensive ordering mistake available here.

**4b. Every new component, in the design system, one at a time.** Resolve `fe.design_system` and
author each one there as a component and a story at the tier the proposal named — the story being a
storymap rather than a demo: one prop per leaf, every value of that prop rendered, each state
carrying the sentence that says when to reach for it. Which component a shape of data becomes is
`canon/fe/explore/component/`, not a fresh judgement. Run the gates on each component as it lands
instead of saving them all for the end; a tier mistake found after five components have been built
on top of it is five rewrites.

**4c. Compose the surfaces, together.** The layout shell, the page, and every modal and drawer named
by the proposal, in the app tree at `fe.path`. The page is a list of functions — which blocks, in
which frames, fed which data — and draws no shape of its own; the layout owns the shell and no
content; the overlay owns the covering surface and no domain data. Routing is part of this and is
decided by the proposal: whether a phase is its own route or a mode on the same shell, and how
sibling surfaces agree on their URL scheme.

**4d. Wire the data, and the states with it.** Every fetch through the app's async boundary, and
every state the proposal drew — nothing yet, exactly one, the ordinary many, more than fits, mixed,
loading, failed — actually built, not just the happy path. The loading state mirrors the shape it
replaces, so the surface does not jump when the data lands.

Throughout: compose, do not hand-roll. A shape assembled inline out of raw elements because it was
faster than authoring a component is the exact debt this ordering exists to prevent, and it will be
invisible to anyone reading only the page.

## 5. Verify

A green build is not a working surface, and the two failures look nothing alike.

1. The type checker and the linter, clean.
2. The source gates under `scripts/gates/check-*.mjs` — in particular
   `scripts/gates/check-story-coverage.mjs` for a component that reached the app without a
   story, `scripts/gates/check-doc-parity.mjs` for a component whose spec block and story's
   have drifted apart, and `scripts/gates/check-src-sb-import.mjs` for app code reaching into
   the design-system tree instead of its own twin.
3. The rendered-tree runner, `scripts/runner/test-runner.ts`, which measures computed style
   against the registry after every story. What it checks and how to read a failure is
   `canon/fe/enforce/testing.md`.
4. The app itself, walked along the proposal's verify plan — the whole flow, and every state in the
   matrix, not the happy path. Capture what you saw.
5. When the back end was touched, the back end at runtime: run the action, read the log, and
   separate a genuine defect from a local configuration problem before reporting either. A clean
   front-end type check says nothing at all about a resolver.

A gate that disagrees with you is a question, not a verdict. More than once the gate has been the
thing that was wrong — read its output before editing anything to satisfy it.

## 6. Close out

Mark the proposal `done` in `.claude/fe/proposals/BACKLOG.md` with the date. A build that is finished
in the tree and pending in the backlog is worse than one that was never started, because the next
person believes the backlog.

Then write back only what generalises. A layout judgement that will be made again — a shell that
turned out to suit a class of job, a state arrangement that resolved a real ambiguity — belongs in
canon, added the way `canon/HOW-TO-WRITE.md` requires: anchored to the file it was read from, dated,
and only when two independent cases support it. One occurrence is an anchor to that case, not a law.
Anything deliberately left undone gets recorded with its reason through `starci-record-debt`, where
the reason survives; a shortcut with no note is read as the house pattern by the next person.

## What this skill does not do

It does not redesign. A proposal that turns out to be wrong mid-build is a signal to stop and go
back to `starci-fe-layout-brainstorm`, not to quietly choose a different shell — the value of
separating the phases is entirely that the design was settled while it was still cheap to change,
and a design changed during a build is invisible because it looks like progress.

It does not touch surfaces outside the proposal's scope, and it does not invent a shell or a
primitive. Dead code that the change genuinely orphans can go, once nothing imports it.

## Files

| Path | What it is |
|---|---|
| `<fe.path>/.claude/fe/proposals/BACKLOG.md` | the queue this reads from and writes back to |
| `<fe.path>/.claude/fe/proposals/<feature>.proposal.md` | the spec being built |
| `skills/starci-fe-layout-brainstorm/SKILL.md` | the phase that produced it |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-layout-apply/test.mjs` |
