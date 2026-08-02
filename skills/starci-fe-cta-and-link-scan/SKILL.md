---
name: starci-fe-cta-and-link-scan
description: Reads a scope of the front end as a conversion and navigation graph rather than as a set of pictures, and grades every surface — and every one of its states — on whether it offers a single honest primary action, copy that names an outcome instead of a mechanism, at least one path onward, entity references that are genuinely clickable, deep links that carry an intent rather than an address, one way back, and persuasion resting only on numbers the back end can actually produce; the result is a ranked audit ledger plus a short proposal for approval, and no code is changed. Reach for it when the question is whether a screen makes sense as a step in a funnel rather than whether it is spelled correctly: "audit the CTAs", "check the funnel", "does this page go anywhere", "why is the empty state a dead end", "two buttons here look the same", "soi CTA/link trang này", "check phễu", "link có make sense không", "dựng trang X xong rồi, soi lại đường đi". Not for spacing, tier or component-choice review — those are the storybook and component skills — and not for writing the fix, which is the sibling starci-fe-cta-and-link-apply.
---

# CTA and link scan

A page can pass every gate in this repo and still be a dead end. The tier is right, the seams sit on
the ladder, the story exists, the types check — and the person who arrived has no idea what to do
next, or has two equally loud buttons and therefore picks neither. Nothing in `patterns/fe/gates/`
can catch that, because it is not a property of a file. It is a property of the graph the files add
up to.

So this skill reads the app as that graph. A surface is a node with two obligations: **one honest
action that moves the person forward, and at least one edge leading out.** A node failing either is
a finding no matter how it looks.

It grades, ranks and writes. It never edits. The sibling
[`skills/starci-fe-cta-and-link-apply/SKILL.md`](../starci-fe-cta-and-link-apply/SKILL.md) builds
what gets approved, and keeping the halves apart is what lets a scan written on Monday be applied on
Thursday, in another session, by someone who was not there.

## Where the source is

```bash
node .claude/scripts/read-workspace-context.mjs fe.path
node .claude/scripts/read-workspace-context.mjs fe.design_system
node .claude/scripts/read-workspace-context.mjs be.path
```

Ask every run rather than remembering — the reasoning is
[`skills/starci-setup-workspace-fe/SKILL.md`](../starci-setup-workspace-fe/SKILL.md). The back end
matters more here than in most front-end work: a large share of findings are claims about whether a
number on screen has a real column behind it, and only `be.path` settles those.

## Scope

The argument names what to look at: the whole app, one route, one feature, or a stated set of files.
A wide scope is scanned by fanning out one scanner per feature or subtree and merging the results —
one pass reading forty surfaces produces forty shallow readings.

Grading a surface is wide, mechanical and cheap; ranking findings and deciding which three are worth
a person's attention is the expensive judgement. Spend the model budget accordingly: many small
readers, one decider.

## Every state is a surface

The most common miss in this audit is scoping it to routes. A route is not a node; each of its
states is. Empty, single item, many items, overflowing, mixed, loading, error, locked behind a
paywall — a person can land in any of them, and the dead ends almost always live in the ones nobody
demos. "Nothing here yet" with no link to where content gets made is the single most reliable
finding this scan produces.

Enumerate the full state set before grading anything. The states a component is obliged to render
are the same ones its story must show — [`design/storybook/architecture/story.md`](../../design/storybook/architecture/story.md)
— so an existing story is the fastest inventory of what a surface can become, and a state the story
omits is worth a look on its own.

## The rubric

Three families. Each judgement below is a claim about a specific call site, and a finding that
cannot name `file:line` is not a finding yet.

### The action

**One primary per surface.** Two buttons of equal weight are not a choice offered, they are a
decision deferred; the second-loudest action belongs a rank down. Which rank, and what the prominence
ladder is, is settled by the accent rules the app already follows — read them from the source before
proposing a demotion rather than inventing a hierarchy for this audit.

**It sits where the eye lands.** A primary action parked in a header's utility slot, next to a
refresh control, is not a primary action. It belongs to the anchor zone the layout already defines.

**It fires at a moment when the person can act.** Motivation and ability have to be high at the same
instant as the prompt. The reliable moment is completion — the end of a lesson, a session, a
submission — where motivation peaks and the next step is obvious. A prompt thrown at someone who has
not yet seen any value is noise, and teaches them to ignore the next one.

**The copy names an outcome, not a mechanism.** "Build the evidence an employer will ask for" is the
thing the person wants; "uses AI credits" is the thing the system does. Mechanism copy is the most
common defect this scan finds and the cheapest to fix.

**Secondary actions stay quiet.** Retry, view details, dismiss — these read as subordinate or they
compete, and a competing secondary is the same defect as two primaries wearing different clothes.

### The path

**Every state has at least one way onward.** With content, that is the next step. Empty is not an
exception: an empty state is a route to wherever that content gets created, and a message with no
link is a dead end wearing a friendly tone.

**A reference to another entity is a link, or it is plain text.** A mention of a lesson, a course, a
user or a challenge inside a sentence should be clickable and resolve through the app's own entity
link component. When it cannot resolve — deleted, unavailable, out of scope — the honest render is
bold plain text. A link that looks pressable and goes nowhere is worse than no link, because it
spends trust.

**A deep link carries an intent.** Pointing at the general course page is an address. Pointing at the
specific module the scorecard just measured as weakest is a reason. If the surface knows something
about *why* the person should go, the href should say it.

**Resume stays inside the scope of the surface.** A continue action on a content page continues the
content; it does not jump to a capstone. A surface that owns a dashboard lands on the dashboard
rather than auto-forwarding into one item and stealing the choice.

**There is exactly one way back.** A breadcrumb chain on a browsing page, a single back link on a
leaf. Two competing back affordances is the same disease as two primaries.

**A related-content list excludes itself.** Anything deriving suggestions from the current item's own
text will rank that item first. Filtering the source id out is a correctness fix, not a polish one.

### The honesty

Persuasion is legitimate here and it is bounded by one rule: **every number used to persuade must
resolve to a real value the back end can produce.** A seat count renders when there is a real cap and
hides when there is not. A learner count is a query. A quota bar shows the quota.

That makes two specific things findings rather than choices. A fallback that invents a plausible
number when the query fails — a stat strip printing a round figure on error — is a fabricated claim
shipped under a real component's name. And a countdown, a scarcity note, or a social-proof figure
with no column behind it is prohibited outright, including when it measures better. So are
confirmshaming copy and a nag that cannot be dismissed.

The line to hold: persuasion here points at learning that can be verified, never at paying to inflate
a number.

## Ground the claim before you make it

The failure mode of this audit is inventing funnels. "These two features should link to each other"
is easy to write and expensive to build, and it is wrong whenever no relationship exists in the data.

Before asserting a missing link or a broken funnel, check the real relationship: the foreign keys on
the entities under `be.path` — the shapes are described in
[`canon/be/modules/database-and-entities.md`](../../canon/be/modules/database-and-entities.md) — and
the nesting of the content itself. If there is no relationship, the honest finding is that the
surface stands alone. Record that and move on; do not force a funnel through it.

## Procedure

1. **Take the inventory.** List every route, phase and state in scope. Read the real components under
   `fe.path`, not a description of them.
2. **Grade each surface against the rubric.**
   - 2a. For each judgement, record one of three verdicts in words — sound, weak, or broken — with
     the call site and the rule it fails.
   - 2b. Check the data relationship before writing any finding that asserts a missing link.
   - 2c. Note whether the fix is a change at one call site, a change to the shell or funnel, or a
     component that does not exist yet. That routing decision is what the apply half reads.
3. **Write the full ledger** to `proposals/cta-link-<scope>.audit.md`: every finding, one line each,
   ranked by severity times funnel impact — a dead end or a dead link above a duplicated primary or
   mechanism copy, and both above a nit — each carrying an open, in-progress or done state. This file
   is the plan, and it is complete. It is not what gets shown.
4. **Surface a batch of three to five.** Take the highest-ranked open findings into
   `proposals/cta-link-<scope>-<batch>.proposal.md` — surface, rule failed, call site, proposed fix,
   route, and how to verify it — add one pending line to `proposals/BACKLOG.md`, and stop. Three
   findings get read and decided; thirty get skimmed and none get decided.
5. **Offer the apply.** Ask whether to build it in this session. If yes, hand the proposal to
   `starci-fe-cta-and-link-apply`. If no, the backlog entry is the handover and nothing is lost.

Re-running the scan updates the ledger rather than replacing it: new findings are added, existing
states are preserved, and anything already done drops out. That is what makes the second run cheap.

## When the fix needs a component that does not exist

Some findings cannot be fixed by editing the app. Turning a plain-text mention into a real reference
link, when no such component exists, is not a copy change — it is a new component, and **no component
reaches the app that was never a component and a story in the design-system folder first**
([`canon/fe/architecture.md`](../../canon/fe/architecture.md), enforced by
[`patterns/fe/gates/check-story-coverage.mjs`](../../patterns/fe/gates/check-story-coverage.mjs)).

Say so in the proposal. A finding priced as a one-line copy edit that actually needs a component and
its full state matrix is the kind of estimate that turns an approved batch into an abandoned one.

## Show the map, not only the list

A ranked list tells a reader which finding is worst. It does not tell them which *page* is in
trouble, and that is the question being asked. Render the audit as a grid: one row per surface, one
column per family, each cell carrying its verdict in a readable form, ranked worst first, with this
batch's findings distinguished from the ones still queued and from the surfaces that came back sound.
A person looking at that grid sees the broken funnel in a second; the same information as a table of
sentences takes a minute and gets skimmed.

## What this skill does not do

It changes no code, not even an obvious one-word copy fix — the moment it edits, the proposal stops
being reviewable and the pair loses the property that makes it work across sessions.

It does not re-open findings already recorded as settled unless the source has moved since.

It does not grade spacing, tier choice or component choice. Those have their own skills and their own
gates, and a conversion audit that drifts into them produces a proposal nobody can approve as a unit.

## Files

| Path | What it is |
|---|---|
| `proposals/cta-link-<scope>.audit.md` | the full ledger, every finding, with state |
| `proposals/cta-link-<scope>-<batch>.proposal.md` | the batch put up for approval |
| `proposals/BACKLOG.md` | the queue, and the only place that says what is done |
| `README.md` | why this skill is shaped the way it is |
| `test.mjs` | run after any change: `node .claude/skills/starci-fe-cta-and-link-scan/test.mjs` |
