---
name: starci-fe-layout-brainstorm
description: Designs the layout of a whole flow — every surface a feature touches: the route's page, the shell it sits inside, and each modal and drawer it opens — by deciding each surface's shell from the job it exists to do, mapping its zones, walking the data-state matrix and a conversion lens through every one of those states, briefing each block against a component that actually exists, and then rendering a clickable HTML prototype of the flow so the design can be walked and argued with before anything is built; on approval it writes the design as a proposal into the front-end app's proposals queue. Reach for it when a feature's surfaces are being planned rather than adjusted: "dựng trang X", "làm luồng đăng ký", "sửa layout", "plan the layout for the checkout flow", "design the whole enrolment flow", "what should this page look like", "I want to click through it before you build it", "queue this design for later". It designs and then stops — it writes no application code; building an approved proposal is starci-fe-layout-apply, and adjusting one block or one component's internals after the surfaces exist is starci-fe-review.
---

# Designing a flow's surfaces

A page designed on its own is designed against its siblings. The thing a person actually moves
through is a flow — setup, then work, then result; or list, then detail, then edit — and every
decision worth making is a decision about that sequence. Which surface owns the primary action.
Where the empty case sends someone. Whether the second step reuses the first step's shell or
deliberately breaks it. Ask those questions one page at a time and each answer is locally
reasonable and collectively incoherent.

So the unit here is the flow and every surface it touches: the route's page, the layout shell it
sits inside, and each modal and drawer it opens. A modal designed later, by someone holding only
the page, is how a flow grows a second visual language.

The second idea does the rest of the work.
**A surface's shell follows the job it exists to do, not the data it happens to carry.**
A reading surface and a working surface can hold the same records
and must not have the same shape: reading wants a bounded column and a quiet edge, working wants
the full width and two panes that stay in view. Choosing the shell from the data is how a
comparison table ends up inside a narrow article column, and how a lesson ends up sprawled across
a workspace nobody can read.

This skill decides shape. What goes inside a block stops at one line of brief; the internals are
another skill's job.

## Where the source is

Nothing here remembers a path. The front end, its design-system folder, and the back end are asked
for, every time:

```bash
node .claude/scripts/workspace/read-workspace-context.mjs fe.path
node .claude/scripts/workspace/read-workspace-context.mjs fe.design_system
node .claude/scripts/workspace/read-workspace-context.mjs be.path
```

A missing context exits non-zero and prints the command that fixes it; `starci-setup-workspace-fe`
is the skill that registers one. Honour the exit code rather than continuing with an empty string —
an empty root builds a plausible-looking path and then fails somewhere far from the cause.

## What to read before deciding anything

The design is constrained by canon, so the constraints come first. Reading them after the blueprint
is drawn means rewriting the blueprint.

| Question in front of you | Where it is already answered |
|---|---|
| which tier a surface or a piece of it belongs to, and what it may import | `canon/fe/enforce/tiers/architecture.md` |
| what a page owns | `canon/fe/enforce/tiers/page.md` |
| what a layout shell owns, and what an overlay owns | `canon/fe/enforce/tiers/layout.md`, `canon/fe/enforce/tiers/overlay.md` |
| which component a shape of data becomes | `canon/fe/explore/component/`, and the "Which component a data shape becomes" section of `canon/fe/enforce/tiers/architecture.md` |
| what a seam or an inset means, and the four container widths a shape may change at | `canon/fe/enforce/spacing/overview.md`, with `canon/fe/explore/registry.mjs` as the authority on the values |
| how an async surface is written, and what its loading state owes the reader | `canon/fe/enforce/authoring/async-data.md`, `canon/fe/enforce/authoring/loading-and-skeleton.md` |
| how a modal, drawer or toast behaves as code | `canon/fe/enforce/authoring/overlay-and-feedback.md` |
| what already exists to compose with | the design-system folder at `fe.design_system`, read directly |

Two of those deserve emphasis while sketching. Responsive shape in this codebase is a **container**
question, not a viewport question — the same card sits in a full-width page, in a split pane and in
a narrow drawer, and its shape follows the box it was given. Sketch the narrow form of a surface as
"this region became narrow", never as "this is the phone". And a shape that changes names the width
it changes at, from the four named container widths in `canon/fe/enforce/spacing/overview.md`; "it wraps when it
gets tight" is not a design decision, it is the absence of one.

When canon does not cover a pattern — and it does not cover persuasion, funnels, or onboarding
sequences at all — research it rather than inventing it. Read how products that do this well
actually do it, and cite what you read. Do not re-research something canon already settles.

## The procedure

**1. Draw the boundary of the flow.** List every surface before designing any of them: each route,
each phase, each mode, each modal and drawer, and the sibling surfaces that share the shell. Then
read the real source for the ones that already exist, under `fe.path`. A flow drawn from the
feature's name rather than its code reliably misses a phase, and the missed phase is usually the
one with the awkward state.

**2. Decide each surface's shell from its job.**

- **2a.** Write the job in one sentence, from the person's side: what they came to do here, in the
  order they will do it. If the sentence needs an "and", there may be two surfaces.
- **2b.** Choose the shell that job implies — a reading column, a browsing grid, a working surface
  with two panes, a focused single-task surface, a dashboard of peers. Say why the job implies it.
- **2c.** In a multi-phase flow, expect the shell to **change** between phases. Setup and work rarely
  want the same frame, and forcing one shell across a flow is the commonest way a working surface
  ends up cramped.

**3. Map the zones.** For each surface, name its regions and what each holds — the shell's own
chrome, the primary region, any secondary rail, the action area. Then say what each region does when
its container narrows: which rail collapses into what, which split stacks, and at which named width.
A rail that would hold fewer than a handful of items is not a rail; fold it before it gets drawn.

**4. Walk the data-state matrix, per surface.** Not as a list beside the design — placed *into* the
zones, because a state is a different arrangement, not a different sentence. The set to cover:
nothing yet, exactly one, the ordinary many, more than fits, mixed or partially complete, still
loading, and failed. Each one changes which region matters, and at least one of them usually reveals
that the chosen shell was wrong. These are not optional later: the build is graded on them by
`scripts/gates/check-one-instance-per-state.mjs` and by the rendered-tree runner described in
`canon/fe/enforce/testing.md`, so a state left out of the proposal is a state somebody has to design during
a build.

**5. Put the conversion lens through every state.** Canon says nothing about this, so the judgement
lives here, and it is three questions asked of every state of every surface:

- **The action.** Exactly one primary action per surface, sitting where the eye already is at the
  moment the person is able to take it. An action offered before someone can act on it is noise.
- **The onward link.** No state is a dead end. The empty state especially: emptiness is an
  invitation, and a surface that says "nothing here" without saying what to do next is the one place
  in a flow where people simply leave.
- **The honest hook.** Progress that is real, counts that are true, urgency that exists. A number
  nobody can reproduce, a countdown that resets on reload, a scarcity claim with no scarcity behind
  it — these convert once and cost the product's word permanently. If the true number is
  unimpressive, show something else; do not improve it.

**6. Brief every block against a component that exists.** One line per block, and that line names
the real component from the design system, resolved from `fe.design_system` and grepped, not
recalled. Where nothing suitable exists, say so plainly and name the tier the new component would
sit at. That sentence is not a footnote — it is the storybook-first work the apply phase will do
first, and a proposal that hides it produces a build that hand-rolls.

**7. Verify your own blueprint before showing it.** The self-check below. A miss found here costs a
sentence; the same miss found in review costs the whole review.

**8. Render the prototype and host it.** Below. A described layout is agreed to far more readily
than it is understood; a clicked one is argued with, which is the point.

**9. Write the proposal into the queue** once it is approved, and then stop.

## Rival directions, when the shell is genuinely unclear

Most flows have one obvious shell and this section does not apply. When two shells both look
defensible, or when the flow is important enough to be worth the cost, develop the rival directions
in parallel rather than sequentially — sequential exploration anchors on the first sketch — and then
have one pass attack each direction specifically: which canon rule it breaks, which state it has no
answer for, where the flow dead-ends. Synthesise afterwards. Keep this opt-in; run on an ordinary
flow it produces three designs and a decision nobody needed to make.

## The prototype

One self-contained HTML file, inline CSS and JavaScript, no external requests. Each surface and each
phase is a screen; previous and next walk the flow, and the hotspots — the primary action, a tab, a
zone — either move to another screen or toggle a state in place, so the empty case and the loaded
case can be compared by clicking rather than imagined. Low fidelity is fine; flat blocks, short
labels, the semantic colour tokens.

What the prototype must **not** be is anonymous. Every wireframe block carries the name of the real
component it stands for, which is the same name step 6 briefed. That is the whole difference between
a prototype that can be built from and a picture: an unnamed rectangle is an invitation to hand-roll
a `div`, and it is the apply phase that pays for it. Mark the primary action, the onward link, the
psychological hook and the current state where they sit, in the region they sit in.

Give it a toggle between a wide container and a narrow one, so the rail-to-chips and split-to-stack
decisions from step 3 can be seen rather than promised.

Host it strictly, because the failure here is silent. Serve the file's own directory on a static
server, preferring one port and moving up until one is free; if the preferred port is already held,
either free it or take the next one. Then **verify the content, not the status code**: fetch the URL
and grep for a marker unique to this prototype — the title is the easy one. An HTTP 200 is routinely
an *older* prototype still being served from an earlier session, and handing over that URL has
happened. Wrong marker means kill and re-serve. Hand over the URL only after the marker matched.

A prototype worth reusing belongs beside the queue, under `.claude/fe/prototypes/` in the front-end
app, with a line in that folder's index. A one-off belongs in the scratchpad. If a shared template
exists there, start from it and improve it in place rather than starting over — the template is
where this skill's output compounds.

## What the self-check asks

Ask these of the blueprint before showing it, and answer them in words:

1. Does every state of every surface offer a way onward, including the empty one?
2. Does each surface's shell follow from the job sentence written in step 2a, or from the data?
3. Is there exactly one primary action per surface, and is it reachable in every state that permits
   it?
4. Does every rail earn being a rail, and does every shape that changes name the container width it
   changes at?
5. Is every number shown one that can be reproduced from real data?
6. Does every block brief name a component that exists, or say clearly that it does not exist yet
   and at which tier it would sit?
7. Was every surface in the flow covered — every phase, every mode, every modal and drawer, and the
   siblings that share the shell?

## The proposal

The proposal is the whole handoff. It is read in another session, possibly by someone who never saw
the prototype, and everything not written into it is lost. Resolve `fe.path`, then write
`.claude/fe/proposals/<feature>.proposal.md` under it, holding:

- the flow, surface by surface, each with its job sentence and the shell that job chose
- the zones per surface, and what each does as its container narrows, with the named width
- the state matrix placed into zones, with the conversion lens answered per state
- the block briefs, naming real components, and a separate list of the components that do not exist
  yet with the tier each belongs at
- a reference to the prototype
- the files expected to be touched, under `fe.path` and — when the feature needs it — under
  `be.path`
- the verify plan: what a person should click, in what order, to believe it works

Then add one line to `.claude/fe/proposals/BACKLOG.md` in that same app with status `pending`. The
backlog is the single place that knows what has been built and what has not; a proposal file with no
backlog line is invisible.

Applying immediately is fine. Ask whether to run `starci-fe-layout-apply` in this same session — the
separation between the two skills is about the decision being settled before code is written, not
about session boundaries.

## What this skill does not do

It does not build, and it does not partially build. No component, no route, no story, no backend
change. It does not mark anything done and it does not write rulings back into canon; both belong to
the phase that actually produced code and can say what survived contact with it.

It does not invent a shell or a primitive. Where canon and the design system have no answer, ask
rather than decide quietly — a shell invented in a proposal becomes a shell built in the app.

If the flow's shape is settled and the question is really about one block's internals or one
component's styling, this is the wrong skill; that work is starci-fe-review.

## Files

| Path | What it is |
|---|---|
| `<fe.path>/.claude/fe/proposals/<feature>.proposal.md` | the design, as a spec another session can build |
| `<fe.path>/.claude/fe/proposals/BACKLOG.md` | the queue: what is pending, in progress, done |
| `<fe.path>/.claude/fe/prototypes/` | reusable prototypes and the shared template |
| `skills/starci-fe-layout-apply/SKILL.md` | the phase that builds an approved proposal |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-layout-brainstorm/test.mjs` |
