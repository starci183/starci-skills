---
name: starci-fe-design-block
description: Produce 3–4 block anatomy JSON candidates for each region of an accepted layout — parts, repeats, states and data ownership — previewed as HTML at localhost:8080 and queued for the owner's approval. Use after a layout hash is accepted. Writes JSON to the project registry, never frontend source.
---

# starci-fe-design-block

Read [`../skill-shape/en.md`](../skill-shape/en.md) first. This skill runs inside the session
`starci-fe-design-layout` opened; it never opens its own.

**The JSON is the artifact. The HTML is a way of looking at it.** Approval binds to the canonical JSON
hash, never to a rendered page.

## PROCESS

### 1 — Print CONTEXT

`Phase` is `block`. `Touching` names the workflow record and the project registry only.

### 2 — Require an accepted layout

Read the session. A region may enter block rounds only if the layout candidate that contains it carries
an **accepted** hash. A proposed layout is not a starting point: block anatomies built on it would be
discarded with it.

Stop if no layout hash is accepted, and say which one is pending.

### 3 — Verify route and roots

Same as layout: verify the `fe` route before reading (`WORKSPACE-5`), then the registry's lock,
cleanliness and ownership (`WORKTREE-1`, `WORKTREE-4`). Preview into `cache/preview`
(`WORKTREE-2`), never below `.claude` (`WORKTREE-3`).

### 4 — Read the seven inputs

| Input | Read |
|---|---|
| region | the accepted region and its business reason |
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
node <trust>/scripts/validate-artifact.mjs \
  --schema <trust>/brainstorms/blocks/schema.json \
  --data <batch.json> --hash
```

Beyond the shape, the validator refuses a class token anywhere in the batch, two anatomies sharing an
axis set, a `repeats` anatomy with no `restingCount`, and a batch where no anatomy cites `none`. The hash
covers the anatomy only, never the envelope.

Then render one HTML page per anatomy into `cache/preview`, including **every enumerated state**, and
serve it:

```bash
npx -y http-server .worktrees/<project>/cache/preview -p 8080 -c-1 --silent
```

The preview's CSS is documentation chrome and never a product class. A preview that shows only the
populated state hides the exact decision this stage exists to make.

### 10 — Queue for approval and record the verdict

Queue in `registries`, not `sessions`. On acceptance, bind the hash. On feedback, open a **new round**,
append it, and record `REJECTED` with the actual anatomy, its replacement and the owner's words.

### 11 — Close the phase

Append the workflow and print the six tables. `OWED` names regions still without an accepted anatomy,
because those are what `starci-fe-design-execute` will stop on.

## Stops

- No accepted layout hash → stop; name the pending one.
- A part cites a leaf or composite that does not exist → stop; the vocabulary is the authority.
- A state cannot be determined from source → refusal, not a guess.
- Registry unlocked, dirty or foreign-owned → stop; do not write.

## OUTPUT

The six tables from the skill shape, in order.
