---
name: starci-fe-design-layout
description: Open or resume a hash-bound frontend design session, generate 3–4 visual directions for the owner to select, then produce 3–4 structural layout JSON candidates that embed the selected direction. Use for a new page, layout, overlay or redesign. Writes design records, never frontend source or block internals.
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | Supplies the CONTEXT and six-table reporting contract. |
| `@workspaces` | `contexts/workspaces` | module | Resolves and verifies the frontend checkout this run reads. |
| `@worktrees` | `contexts/worktrees` | module | Separates durable decision records from disposable preview work. |
| `@directions` | `brainstorms/directions` | module | Generates the visual choice that every layout candidate embeds. |
| `@layouts` | `brainstorms/layouts` | module | Defines structural regions, axes, contract verdicts and output. |
| `@contract-search` | `scripts/contract-search.mjs` | script | Queries contract reasons without exposing class arrays. |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | Produces the live token inventory used by direction candidates. |
| `@layout-schema` | `brainstorms/layouts/schema.json` | file | validate layout candidate JSON |
| `@session` | `skills/skill-shape/session.schema.json` | file | the shape a design session is written in |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash candidate artifacts |

## NESTED SKILLS

None. A stop ends this run. This skill never invokes another skill as recovery.

## Run

Read `@skill-shape` first. This skill owns the page skeleton. Direction supports that decision; it has
no approval hash of its own. The selected direction is embedded into each layout candidate, so one
`layoutHash` binds visual intent and skeleton together.

**JSON is the artifact. HTML is a way of looking at it.** Approval binds to canonical layout JSON,
never to a rendered page.

## PROCESS

### 1 — Print CONTEXT

Print `### CONTEXT` before touching anything. `Phase` is `layout`. `Touching` names the project registry,
session and disposable cache, and no frontend source path.

### 2 — Resolve and verify the workspace route

Read `@workspaces`. Resolve the user-declared project and `fe` role. Verify the checkout, branch,
recorded head and contract path before reading product evidence. A stale route stops the run
(`WORKSPACE-5`).

### 3 — Resolve the state roots

Read `@worktrees`. Accepted layout candidates, no-hash direction reviews and verdicts go to the project
registry; generated previews stay in cache. Before a registry write, verify that it is locked, clean
and owned by this Source's Git (`WORKTREE-1`, `WORKTREE-4`). Preview uses `cache/preview`
(`WORKTREE-2`) and never a path below `.claude` (`WORKTREE-3`).

### 4 — Resume or open the session

The record is written in the shape `@session` declares, at `registries/decisions/<surface>.json`. It carries
a chain, so appending a round seals it: a round edited in place stops matching, which an array of rounds on
its own can never notice.

**Session identity is the surface**, not the prompt. Two differently worded requests for the same page
are the same session; a reworded prompt is a new round, not a new session. Print which happened —
`resumed <id>` or `opened <id>` — and keep every accepted hash across a resume.

### 5 — Generate the direction choices

Run `@inventory-visual-language` against the verified checkout and record its generated digest as
`vocabularyAt`. Read `@directions`, then generate 3–4 choices from the request, audience, intended
feeling, live tokens, approved screens, brand evidence, installed vendor guidance, closed axes and this
project's precedents with their rejections.

Validate the batch with `@validate-artifact` and the generated vocabulary **without `--hash`**. Render
every direction over the same content and reference skeleton. External style catalogues may broaden the
search, but remain recommendations.

### 6 — Ask the owner to select one direction

Show all valid directions with previews, token reuse/new evidence, explicit rejections and tradeoffs.
The owner selects one or gives feedback. Feedback regenerates the direction choices. Selection is not a
separate approval artifact and produces no `directionHash`.

Append the exact candidates and the owner's selection or words to this layout round's `directionReview`.
Validate the session with `@validate-artifact` and `@session`; a no-hash review is durable evidence, not
a second approval artifact.

Do not start structural candidates until one exact direction object is selected. Preserve that object
unchanged for the layout candidates in this round.

### 7 — Read the structural inputs

Read `@layouts`: request verbatim; contract queried one need per region through `@contract-search`;
every branch and what it may contain; every route page and persistent layout; closed layout axes; and
this project's accepted layout precedents with their rejections.

Layout remains a skeleton. It names regions, geometry ownership, mount lifetime and route relationship.
It never decides a block's internal parts, states or data ownership. That separation is what lets one
block be redesigned later without reopening the page layout.

### 8 — Resolve every region against the contract

Query by business reason, never by shape. Each region receives one verdict: `reuse <key>`,
`generalize <key> -> <key>` with a measured call-site count and rewritten `why`, or `new <key>` with the
reason it will carry. An empty query is a `new` verdict for this run and a warning that the contract
reason index did not answer the need.

```bash
node @contract-search <project> <role> --need "<the region stated as a need>"
```

### 9 — Generate 3–4 layout skeletons

Embed the **same selected direction object** in every candidate, then vary only the closed layout axes.
Drop candidates whose entire structural axis sets match. At least one candidate departs from the nearest
layout precedent. Return one only when the request admits one valid skeleton, with the reason; never pad.

### 10 — Refuse product decisions that evidence cannot settle

Return unresolved ownership, route or mounting decisions to the owner. Ship the refusal with whatever
resolved; never guess merely to complete a batch.

### 11 — Validate, hash and render the skeletons

Run `@validate-artifact` with `@layout-schema`, the same visual vocabulary and `--hash`. It refuses an
invalid embedded direction, candidates embedding different directions, class tokens, duplicate layout
axis sets and a missing departure. The printed hash is the one and only `layoutHash` for that candidate.

Render region boxes, names, axes, branches and contract citations under the selected direction. Do not
draw block internals. Preview CSS is disposable evidence and never a source of product classes.

Generate one HTML page per candidate in `cache/preview`, then serve it. Start at 8080; if occupied, try
the next port, bounded to twenty attempts, and print the URL that actually bound:

```bash
npx -y http-server .worktrees/<project>/cache/preview -p 8080 -c-1 --silent
```

### 12 — Queue approval and close

Queue layout hashes in the durable registry. Feedback opens a new layout round; an accepted candidate
is never edited. When a replacement layout is accepted, mark the previous accepted layout
`superseded` and point `supersededBy` at the replacement. Validate the updated session with
`@validate-artifact`; append feedback as a new sealed round and record the owner's words. Close with the
six tables. `OWED` names the block rounds not yet designed.

## Stops

- Route absent or stale → stop; report the exact failed route evidence and end this run.
- Registry unlocked, dirty or foreign-owned → stop; report the failed ownership evidence and do not write.
- Visual inventory empty or unreadable → stop; do not infer tokens from screenshots.
- No exact direction selected → keep the direction choice open; do not generate layouts.
- A required class is outside the contract's closed set → return the contract change to the owner.
- Duplicate layout axis sets remain → regenerate rather than ship a fake choice.

No stop invokes another skill. If the owner wants recovery, that is a separate request and a separate
run.

## OUTPUT

The six tables from `@skill-shape`, in order. `OUTPUTS` names the selected direction, layout candidates
and hashes at concept level; `CHANGES` names registry/session/cache paths; `NEED APPROVALS` carries the
current selection or accept-or-feedback decision; `REJECTED` keeps the owner's words; `OWED` carries
the block rounds.
