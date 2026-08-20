---
title: starci-fe-design-block · English
---

# starci-fe-design-block

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@block-schema` | `brainstorms/blocks/schema.json` | file | validate block anatomy JSON |
| `@design-registry-schema` | `contexts/worktrees/design-registry.schema.json` | file | validate identity-centric layout and block heads |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | validate current layout/block identities without consulting legacy maps |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | reproduce the token digest bound by the accepted layout |
| `@skill-shape` | `skills/skill-shape/en.md` | en | the shared reporting contract every skill reads |
| `@workspaces` | `contexts/workspaces/en.md` | en | resolve and verify the frontend checkout |
| `@worktrees` | `contexts/worktrees/en.md` | en | verify registry ownership and preview roots |
| `@business` | `contexts/business/en.md` | en | bind anatomy to current flows, states, contracts and surface regions |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash candidate artifacts |
| `@design-review` | `publication/design-review-preview/en.md` | en | defines the parent-child Vite graph, block-detail routes and authority boundary |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | builds the shared review app from validated block JSON instead of bespoke HTML |

## NESTED SKILLS

None. This skill never invokes another skill.


## Run

Read `@skill-shape` first. This skill requires caller-supplied stable `layoutId` and `blockId`; it never
chooses an identity. The accepted layout and current block heads in the design registry are authoritative;
review records are audit history only.

**The JSON is the artifact. The shared Vite review is a way of looking at it.** Approval binds to the
canonical JSON hash, never to the manifest or rendered application.

## PROCESS

### 1 — Establish the context lock

`Phase` is `block`. `Touching` names the project registry only. The caller must provide `layoutId` and
`blockId`.

### 2 — Resolve the accepted layout head and declared block identity

Run `@design-registry-check`, then read `@design-registry-schema` and
`registries/design-registry-v2.json`; resolve `layoutHeads[layoutId].head` through immutable
`objects.byHash`. The head is the accepted layout and the only lookup authority; review history cannot
select a different layout. Require `blockId` to be an exact member of that accepted head's `regions` list.
An arbitrary blockId, a proposed layout head, missing object or
schema mismatch stops before any block design work.

Resolve the visual direction through the accepted layout object; do not accept a second direction hash from
the caller. A later revision of one block keeps the same stable `(layoutId, blockId)` identity and accepted
parent `layoutHash`, while its new immutable anatomy receives a new `blockHash`.

### 3 — Verify route and roots

Read `@workspaces` and verify the `fe` route before reading (`WORKSPACE-5`), then read `@worktrees` and
verify the registry's lock, cleanliness and ownership (`WORKTREE-1`, `WORKTREE-4`). Preview into
`cache/preview` (`WORKTREE-2`), never below `.claude` (`WORKTREE-3`).

Run `@inventory-visual-language` again. Its digest must equal the accepted direction's `vocabularyAt`;
a mismatch stops here, before a stale preview can produce a new block decision.

### 4 — Read the eight inputs

First resolve the accepted layout's current business feature and surface. Check its head against routed
FE/BE commits; refresh and commit absent or stale truth. Load `CONTEXT.md`, the selected surface and only
flows touching this block. Unsupported content, state or action remains an unknown.

| Input | Read |
|---|---|
| region | the accepted region and its business reason |
| direction | selected object resolved from the accepted layout: axes and role-to-token decisions |
| contract | key, `why`, `host`, children names, `repeats`, `optional` — **not** the class arrays |
| vocabulary | the leaf names the contract cites, the composite names, the blocks that exist |
| axes | the closed anatomy set: data owner, repetition, weight, composition |
| precedents | accepted anatomies for this project, with their rejections |
| states | how this region's data actually fails, read from page and block source |
| laws | the block laws |

`optional` in the contract states **presence**, not which absence. Pending, failed and empty all reach
the same `optional`, so separating them is read from source — never assumed from the registry.

### 5 — Enumerate the states before designing anything

List every condition the region can enter: populated, empty, pending, failed, partial, forbidden. An
anatomy is designed for the full set, not for the happy path. A state the region can reach and the
anatomy does not draw is a defect the block laws reject, not a detail for later.

### 6 — Resolve the parts against the contract and vocabulary

Search by `why`. Each part gets one verdict: `reuse <key>`, `generalize <key> -> <key>` with a measured
call-site count, or `new <key>` with the `why` it will carry. Every leaf and composite a part cites must
exist in the vocabulary; a citation that cannot be checked is an invented name.

### 7 — Generate 3–4 anatomies

Each declares its axis values: who owns the data, whether it repeats and at what resting count, which
state carries the block, how it is composed. Identical axis sets are one anatomy. At least one anatomy
must not follow the nearest precedent.

### 8 — Refuse what only the owner can decide

Who owns the data, whether an empty region is a real outcome, what the resting count is when the request
does not say — these are product decisions. A refusal block ships with the candidates.

### 9 — Validate, hash, write JSON, then render the preview

Validate before writing and before hashing:

```bash
node @validate-artifact \
  --schema @block-schema \
  --data <batch.json> --hash
```

Beyond the shape, the validator refuses a class token anywhere in the batch, two anatomies sharing an
axis set, a `repeats` anatomy with no `restingCount`, and a batch where no anatomy cites `none`. The hash
covers the anatomy only, never the envelope.

Read `@design-review`, write optional representative-content data into the project cache, then overlay the
anatomy batch onto its exact parent in the one project review graph:

```bash
node @render-design-review \
  --phase block --project <project> \
  --layout-id <layoutId> --block-id <blockId> \
  --artifact <block-batch.json> \
  --registry .worktrees/<project>/registries \
  --vocabulary .worktrees/<project>/cache/preview/visual-vocabulary.json \
  --content <representative-content.json> \
  --recommended-id <candidateId> \
  --out .worktrees/<project>/cache/preview/design-review
```

The dedicated block route is
`#/layouts/<layoutId>/<layoutHash>/blocks/<blockId>`. It visibly names the parent `layoutId` and exact
`layoutHash`, compares anatomy candidates and explains every enumerated state on the page—never in a modal.
Proposed candidates appear only on that block route; the layout canvas keeps rendering the current accepted
child, or rough content when no compatible child exists. Every anatomy uses the same direction, copy and
representative data; changing those between candidates or showing only the populated state invalidates the
comparison. Do not author candidate-specific HTML, CSS or JavaScript.

Serve the generated directory:

```bash
npx -y http-server .worktrees/<project>/cache/preview/design-review -p 8080 -c-1 --silent
```

**8080 is where the search starts, not where it stops.** Bind it; if it is taken, try 8081, 8082, and keep
going until one binds, then **print the URL actually served**. A run that dies because somebody's dev server
holds 8080 has failed at nothing the owner asked about, and a run that prints a URL nobody can open is worse
than one that prints none. Bound the search — twenty ports is a busy machine, two hundred is a bug — and if
nothing binds, say so instead of serving nowhere quietly.


### 10 — Queue for approval and record the verdict

Queue candidate reviews in the registry's optional audit history. Record
the stable `(layoutId, blockId)`, accepted parent `layoutHash` and independent `blockHash`. On `OK`, update
the scoped `blockHeads[layoutId/blockId].head` and `blocks/by-id/<layoutId>/<blockId>.json`, retaining the previous
block head as superseded immutable history. Feedback never changes a head. Mark one evidence-backed candidate
as the default. `OK` accepts every displayed default and binds hashes immediately; never ask the same approval
twice. Validate the design registry and artifact before closing.
After `OK`, rebuild the project graph so the layout route replaces rough content with the accepted child
parts. The block projection's parent `layoutHash` must remain explicit.

### 11 — Close the phase

Before continuing, name regions still owed in friendly prose and finish every region owned by this
skill. Close only when `own = 0` or a genuine `NEED APPROVALS` item blocks a region.

## Stops

- No accepted layout head, or its bound direction cannot be resolved → stop; name the broken dependency.
- `blockId` is not listed by `layoutHeads[layoutId].regions` → stop; do not create an orphan block head.
- Direction vocabulary no longer matches the source state it was approved against → stop; mark the visual evidence stale.
- A part cites a leaf or composite that does not exist → stop; the vocabulary is the authority.
- A state cannot be determined from source → refusal, not a guess.
- Registry unlocked, dirty or foreign-owned → stop; do not write.

## OUTPUT

Follow the skill shape's prose output. Include `layoutId`, `blockId`, parent `layoutHash` and updated block
head. No status tables.
