---
title: starci-fe-design-layout · English
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | Supplies the shared interaction and approval contract. |
| `@workspaces` | `contexts/workspaces/en.md` | en | Resolves and verifies the frontend checkout this run reads. |
| `@worktrees` | `contexts/worktrees/en.md` | en | Separates durable decision records from disposable preview work. |
| `@directions` | `brainstorms/directions/en.md` | en | Generates the visual choice that every layout candidate embeds. |
| `@layouts` | `brainstorms/layouts/en.md` | en | Defines structural regions, axes, contract verdicts and output. |
| `@contract-search` | `scripts/contract-search.mjs` | script | Queries contract reasons without exposing class arrays. |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | Produces the live token inventory used by direction candidates. |
| `@layout-schema` | `brainstorms/layouts/schema.json` | file | validate layout candidate JSON |
| `@design-registry-schema` | `contexts/worktrees/design-registry.schema.json` | file | validate the identity-centric registry and its current heads |
| `@design-registry-migrate` | `scripts/migrate-design-registry.mjs` | script | migrate legacy maps non-destructively and verify identity heads are current |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | validate v2 heads, regions, immutable objects and by-id projections |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash candidate artifacts |
| `@design-review` | `publication/design-review-preview/en.md` | en | defines the universal Vite review manifest, interactions and authority boundary |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | builds the shared review app from validated layout JSON instead of bespoke HTML |

## NESTED SKILLS

None. A stop ends this run. This skill never invokes another skill as recovery.

## Run

Read `@skill-shape` first. This skill owns the page skeleton. Direction supports that decision; it has
no approval hash or approval checkpoint of its own. The recommended direction is embedded into each layout candidate, so one
`layoutHash` binds visual intent and skeleton together.

The caller supplies a stable `layoutId`. `registries/design-registry-v2.json` is the authority: its
`layoutHeads[layoutId].head` points to the accepted immutable layout object. Review history may explain
how a head was reached, but it is never used to discover the current layout.

**JSON is the artifact. The shared Vite review is a way of looking at it.** Approval binds to canonical
layout JSON, never to the manifest or rendered application.

## PROCESS

### 1 — Establish the context lock

Resolve `Phase: layout`; `Touching` names the project registry and disposable cache, and no
frontend source path. Tell the user that location in one friendly sentence; do not print a context table.

Before resolving any `layoutId`, write a disposable scope ledger with three lists: explicitly requested product
surfaces, modes owned by one surface, and illustrative examples. Only requested surfaces may enter a layout batch
or draft-index flow. A capability example stays evidence until the owner explicitly promotes it into product scope.

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

If v2 is absent, run `node @design-registry-migrate --registry .worktrees/<project>/registries --apply`; then run
`node @design-registry-check --registry .worktrees/<project>/registries`, read `@design-registry-schema` and
`registries/design-registry-v2.json`. Require the caller's stable `layoutId`; do not derive
it from the prompt or a surface label. Resolve `layoutHeads[layoutId]`, then resolve its
`head` through the immutable `objects.byHash` map when one exists. The head is the accepted layout and the
only current lookup result. A missing identity or schema mismatch stops; an absent head is a new identity,
not permission to treat a proposed candidate as accepted.

If the layout has no accepted head yet, keep `layoutHeads[layoutId]` absent while the caller-supplied stable
`layoutId` identifies the review envelope and candidates. Approval writes the first immutable object and
head together; there is no headless registry entry and no proposed candidate is current. Prior review history may
be read for context and appended, but it cannot select, replace or resurrect a head.
Keep every accepted hash in immutable objects and update the head only at the approval checkpoint.

### 5 — Generate the direction choices

Run `@inventory-visual-language` against the verified checkout. The inventory follows stylesheet
`@import` edges, including resolvable installed package CSS, but does not evaluate runtime-generated
CSS from TypeScript or JSON. Record its generated digest as `vocabularyAt`. Read `@directions`, then generate 3–4 choices from the request, audience, intended
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

Layout remains a skeleton. New work uses layout schema 3 and names regions, hashed child bounding geometry
(`placement`, `width`, `height`, `align`), a hashed impressionistic child brief, mount lifetime and route relationship.
A centered authentication panel must render centered with recognizable representative content before its block
exists; a rail region must occupy the rail slot with representative destinations. Keep the wireframe visibly rough:
labels and sample values explain intent, but do not claim exact parts, states, behavior or final copy.
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

Read `@design-review`. Write optional shell and representative-content descriptors into the project cache,
then overlay this batch onto the one project review graph:

```bash
node @render-design-review \
  --phase layout --project <project> --layout-id <layoutId> \
  --artifact <layout-batch.json> --directions <direction-batch.json> \
  --registry .worktrees/<project>/registries \
  --vocabulary .worktrees/<project>/cache/preview/visual-vocabulary.json \
  --content <representative-content.json> --shell <shell-descriptor.json> \
  --recommended-id <candidateId> \
  --out .worktrees/<project>/cache/preview/design-review
```

When the owner asks to compare or approve several stable layout identities in one round, write one
`layout-draft-index.json` beside their batches. Its `layouts` array entries declare `layoutId`, `artifact`,
optional `directions`, optional `content`, optional `shell`, and `recommendedId`; paths are relative to the
index. Optional `flows` declare ordered nodes that reference a `layoutId` and optional declared `blockId`;
the renderer derives immutable routes and default adjacent edges, then exposes the sequences in review.
Render the combined graph once with `--layout-draft-index <index.json>` in place of `--phase layout`.
The first index entry owns the initial route. This only combines review: each candidate keeps its own
immutable hash and still requires explicit approval before any block round starts.

The layout route renders a complete page. Every declared region renders a labeled impressionistic wireframe from
its hashed brief so purpose, geometry, density and reading order are judgeable before child blocks exist. Use
representative labels, values and actions inside dashed lightweight controls; never present them as accepted parts,
states, behavior or final copy. Modes sharing the route owner remain block states for the later block round.
Navigation and flow cues appear only for explicitly scoped surfaces. A child block renders its
accepted parts only when its recorded `layoutHash` equals the candidate displayed; missing or stale children
stay rough. Clicking a region navigates to
`#/layouts/<layoutId>/<layoutHash>/blocks/<blockId>`; it never opens a modal.

The layout artifact still does not settle block parts, states, data ownership or final copy. A blank canvas,
a region with no content, or a layout with no region overlay is invalid.

Do not author candidate-specific HTML, CSS or JavaScript. Project shell and content are manifest data;
the Vite application is project-neutral and its interactions never mutate the registry. Serve the generated
directory. Start at 8080; if occupied, try the next port, bounded to twenty attempts, and print the URL that
actually bound:

```bash
npx -y http-server .worktrees/<project>/cache/preview/design-review -p 8080 -c-1 --silent
```

### 12 — Queue approval and close

Show the direction alternatives and why one is recommended together with the direction-backed layout
candidates. Open exactly one `### NEED APPROVALS` for this round: the recommended layout hash is the
default, and `OK` approves both its embedded direction and its skeleton. Feedback may challenge either
the direction or the structure and opens an optional audit review; an accepted candidate is never edited.
On `OK`, validate the immutable object and update `layoutHeads[layoutId].head` in
`design-registry-v2.json` plus `layouts/by-id/<layoutId>.json` to the accepted `layoutHash`
(and its declared stable region ID list) in the design registry. When a replacement layout is accepted, retain the
previous head as superseded audit history and point to the replacement; never edit the old object. Reviews
may record the owner's words, but are not lookup authority. Validate the registry and artifact,
mark one evidence-backed layout as the default, and close only after every Layout-owned write is complete.
Rebuild the project review graph after the head advances; block heads bound to the previous layout hash must
appear stale and the new layout must fall back to rough child content until each block is redesigned or
explicitly accepted under the new parent.

## Stops

- Route absent or stale → stop; report the exact failed route evidence and end this run.
- Registry unlocked, dirty or foreign-owned → stop; report the failed ownership evidence and do not write.
- Visual inventory empty or unreadable → stop; do not infer tokens from screenshots.
- No evidence-backed direction recommendation → return the missing decision; do not generate layouts.
- A required class is outside the contract's closed set → return the contract change to the owner.
- Duplicate layout axis sets remain → regenerate rather than ship a fake choice.
- The stable `layoutId` is absent, ambiguous or resolves to a malformed registry head → stop; do not fall back to a prompt.
- A proposed hash is not the registry head → stop; only the approval checkpoint may advance the accepted head.

No stop invokes another skill. If the owner wants recovery, that is a separate request and a separate
run.

## OUTPUT

Present the `layoutId`, current/updated accepted head, direction alternatives, evidence-backed
recommendation, layout candidates, recommended layout hash and preview URL in concise prose. Use one
`### NEED APPROVALS` for the combined accept-or-feedback decision. No status tables.
