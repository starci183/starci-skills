---
name: starci-fe-design-layout
description: Design or revise the immutable candidate behind a stable layoutId, evidence-select one recommended visual direction, and present 3–4 structural layouts under one combined approval. The accepted layout head in the design registry is authoritative; sessions are optional audit history. Writes design records, never frontend source or block internals.
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | Supplies the shared interaction and approval contract. |
| `@workspaces` | `contexts/workspaces/context.md` | context | Resolves and verifies the frontend checkout this run reads. |
| `@worktrees` | `contexts/worktrees/context.md` | context | Separates durable decision records from disposable preview work. |
| `@directions` | `brainstorms/directions/context.md` | context | Generates the visual choice that every layout candidate embeds. |
| `@layouts` | `brainstorms/layouts/context.md` | context | Defines structural regions, axes, contract verdicts and output. |
| `@contract-search` | `scripts/contract-search.mjs` | script | Queries contract reasons without exposing class arrays. |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | Produces the live token inventory used by direction candidates. |
| `@layout-schema` | `brainstorms/layouts/schema.json` | file | validate layout candidate JSON |
| `@design-registry-schema` | `contexts/worktrees/design-registry.schema.json` | file | validate the identity-centric registry and its current heads |
| `@design-registry-migrate` | `scripts/migrate-design-registry.mjs` | script | migrate legacy maps non-destructively and verify identity heads are current |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | validate v2 heads, regions, immutable objects and by-id projections |
| `@session` | `skills/skill-shape/session.schema.json` | file | optional audit-history shape; never the lookup authority |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash candidate artifacts |

## NESTED SKILLS

None. A stop ends this run. This skill never invokes another skill as recovery.

## Run

Read `@skill-shape` first. This skill owns the page skeleton. Direction supports that decision; it has
no approval hash or approval checkpoint of its own. The recommended direction is embedded into each layout candidate, so one
`layoutHash` binds visual intent and skeleton together.

The caller supplies a stable `layoutId`. `registries/design-registry-v2.json` is the authority: its
`layoutHeads[layoutId].head` points to the accepted immutable layout object. A session or review record
may explain how a head was reached, but it is optional audit history and is never used to discover the
current layout.

**JSON is the artifact. HTML is a way of looking at it.** Approval binds to canonical layout JSON,
never to a rendered page.

## PROCESS

### 1 — Establish the context lock

Resolve `Phase: layout`; `Touching` names the project registry, optional audit record and disposable cache, and no
frontend source path. Tell the user that location in one friendly sentence; do not print a context table.

### 2 — Resolve and verify the workspace route

Read `@workspaces`. Resolve the user-declared project and `fe` role. Verify the checkout, branch,
recorded head and contract path before reading product evidence. A stale route stops the run
(`WORKSPACE-5`).

### 3 — Resolve the state roots

Read `@worktrees`. Accepted layout candidates, no-hash direction reviews and verdicts go to the project
registry; generated previews stay in cache. Before a registry write, verify that it is locked, clean
and owned by this Source's Git (`WORKTREE-1`, `WORKTREE-4`). Preview uses `cache/preview`
(`WORKTREE-2`) and never a path below `.claude` (`WORKTREE-3`).

### 4 — Resolve the stable layout identity and current head

If v2 is absent, run `@design-registry-migrate --apply`; then run `@design-registry-check`, read `@design-registry-schema` and
`registries/design-registry-v2.json`. Require the caller's stable `layoutId`; do not derive
it from the prompt, a surface label or a session id. Resolve `layoutHeads[layoutId]`, then resolve its
`head` through the immutable `objects.byHash` map when one exists. The head is the accepted layout and the
only current lookup result. A missing identity or schema mismatch stops; an absent head is a new identity,
not permission to treat a proposed candidate as accepted.

If the layout has no accepted head yet, establish the stable identity and continue only under the registry
schema's allowed creation path; never invent a head from a proposed candidate. A prior session or review
may be read for context and appended as audit history, but it cannot select, replace or resurrect a head.
Keep every accepted hash in immutable objects and update the head only at the approval checkpoint.

### 5 — Generate the direction choices

Run `@inventory-visual-language` against the verified checkout and record its generated digest as
`vocabularyAt`. Read `@directions`, then generate 3–4 choices from the request, audience, intended
feeling, live tokens, approved screens, brand evidence, installed vendor guidance, closed axes and this
project's precedents with their rejections.

Validate the batch with `@validate-artifact` and the generated vocabulary **without `--hash`**. Render
every direction over the same content and reference skeleton. External style catalogues may broaden the
search, but remain recommendations.

### 6 — Evidence-select the recommended direction

Compare every valid direction against the request, audience, intended feeling, live vocabulary, brand
evidence and accepted precedents. Select one exact object as the evidence-backed recommendation and state
why it best fits. This is a provisional default, not an owner approval, so do not pause or print
`### NEED APPROVALS` here and do not produce a `directionHash`.

Write a direction batch with `schema: 2` and its `recommended` object. Append the exact candidates,
`state: recommended`, `recommendedId`, `selectionSource: evidence` and `selectionReason` to this layout
round's `directionReview`. Validate both artifacts. If evidence cannot support one recommendation, return
the missing product decision as a refusal; do not generate structural candidates.

Preserve the recommended direction object unchanged in every layout candidate in this round.

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

Embed the **same recommended direction object** in every candidate, then vary only the closed layout axes.
Drop candidates whose entire structural axis sets match. At least one candidate departs from the nearest
layout precedent. Return one only when the request admits one valid skeleton, with the reason; never pad.

### 10 — Refuse product decisions that evidence cannot settle

Return unresolved ownership, route or mounting decisions to the owner. Ship the refusal with whatever
resolved; never guess merely to complete a batch.

### 11 — Validate, hash and render the skeletons

Run `@validate-artifact` with `@layout-schema`, the same visual vocabulary and `--hash`. It refuses an
invalid embedded direction, candidates embedding different directions, class tokens, duplicate layout
axis sets and a missing departure. The printed hash is the one and only `layoutHash` for that candidate.

Render region boxes, names, axes, branches and contract citations under the recommended direction. Do not
draw block internals. Preview CSS is disposable evidence and never a source of product classes.

Generate one HTML page per candidate in `cache/preview`, then serve it. Start at 8080; if occupied, try
the next port, bounded to twenty attempts, and print the URL that actually bound:

```bash
npx -y http-server .worktrees/<project>/cache/preview -p 8080 -c-1 --silent
```

### 12 — Queue approval and close

Show the direction alternatives and why one is recommended together with the direction-backed layout
candidates. Open exactly one `### NEED APPROVALS` for this round: the recommended layout hash is the
default, and `OK` approves both its embedded direction and its skeleton. Feedback may challenge either
the direction or the structure and opens an optional audit review; an accepted candidate is never edited.
On `OK`, validate the immutable object and update `layoutHeads[layoutId].head` in
`design-registry-v2.json` (plus the deterministic `layouts/by-id/<layoutId>.json` projection) to the accepted `layoutHash`
(and its declared stable region ID list) in the design registry. When a replacement layout is accepted, retain the
previous head as superseded audit history and point to the replacement; never edit the old object. Sessions
and reviews may record the owner's words, but are not lookup authority. Validate the registry and artifact,
mark one evidence-backed layout as the default, and close only after every Layout-owned write is complete.

## Stops

- Route absent or stale → stop; report the exact failed route evidence and end this run.
- Registry unlocked, dirty or foreign-owned → stop; report the failed ownership evidence and do not write.
- Visual inventory empty or unreadable → stop; do not infer tokens from screenshots.
- No evidence-backed direction recommendation → return the missing decision; do not generate layouts.
- A required class is outside the contract's closed set → return the contract change to the owner.
- Duplicate layout axis sets remain → regenerate rather than ship a fake choice.
- The stable `layoutId` is absent, ambiguous or resolves to a malformed registry head → stop; do not fall back to a session or prompt.
- A proposed hash is not the registry head → stop; only the approval checkpoint may advance the accepted head.

No stop invokes another skill. If the owner wants recovery, that is a separate request and a separate
run.

## OUTPUT

Present the `layoutId`, current/updated accepted head, direction alternatives, evidence-backed
recommendation, layout candidates, recommended layout hash and preview URL in concise prose. Use one
`### NEED APPROVALS` for the combined accept-or-feedback decision. No status tables.
