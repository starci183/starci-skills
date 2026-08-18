---
name: starci-fe-design-block
description: Produce 3–4 block anatomy JSON candidates for each region under an accepted visual direction and layout — parts, repeats, states and data ownership — previewed as HTML at localhost:8080 and queued for the owner's approval. Use to design or revise one block without reopening the page layout. Writes JSON to the project registry, never frontend source.
---

# starci-fe-design-block

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@block-schema` | `brainstorms/blocks/schema.json` | file | validate block anatomy JSON |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | reproduce the token digest bound by the accepted layout |
| `@session` | `skills/skill-shape/session.schema.json` | file | the shape a design session is written in |
| `@skill-shape` | `skills/skill-shape/context.md` | context | the shared reporting contract every skill reads |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve and verify the frontend checkout |
| `@worktrees` | `contexts/worktrees/context.md` | context | verify registry ownership and preview roots |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash candidate artifacts |

## NESTED SKILLS

None. This skill never invokes another skill.


## Run

Read `@skill-shape` first. This skill requires an existing hash-bound session; it never opens its own.

**The JSON is the artifact. The HTML is a way of looking at it.** Approval binds to the canonical JSON
hash, never to a rendered page.

## PROCESS

### 1 — Establish the context lock

`Phase` is `block`. `Touching` names the project registry only.

### 2 — Require an accepted layout and resolve its direction

The accepted hash is read from the session record `@session` describes; a block round is appended to that
same session, never to a new one.

Read the session. A region may enter block rounds only if the layout candidate that contains it carries
an **accepted** hash. Resolve the visual direction through that layout candidate; do not accept a second
direction hash from the caller. A proposed layout is not a starting point.

Stop if the layout hash is unaccepted. A later revision of one block reuses the same accepted layout
hash — and therefore the same bound direction — and opens a new round for that region only.

### 3 — Verify route and roots

Read `@workspaces` and verify the `fe` route before reading (`WORKSPACE-5`), then read `@worktrees` and
verify the registry's lock, cleanliness and ownership (`WORKTREE-1`, `WORKTREE-4`). Preview into
`cache/preview` (`WORKTREE-2`), never below `.claude` (`WORKTREE-3`).

Run `@inventory-visual-language` again. Its digest must equal the accepted direction's `vocabularyAt`;
a mismatch stops here, before a stale preview can produce a new block decision.

### 4 — Read the eight inputs

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

Then render one HTML page per anatomy into `cache/preview`, including **every enumerated state**, and
serve it:

```bash
npx -y http-server .worktrees/<project>/cache/preview -p 8080 -c-1 --silent
```

The preview resolves only the accepted direction's semantic roles. Its fixed documentation markup is
never a source of product classes. Every anatomy in a batch uses the same direction, copy and data; a
preview that changes any of those or shows only the populated state invalidates the comparison.

**8080 is where the search starts, not where it stops.** Bind it; if it is taken, try 8081, 8082, and keep
going until one binds, then **print the URL actually served**. A run that dies because somebody's dev server
holds 8080 has failed at nothing the owner asked about, and a run that prints a URL nobody can open is worse
than one that prints none. Bound the search — twenty ports is a busy machine, two hundred is a bug — and if
nothing binds, say so instead of serving nowhere quietly.


### 10 — Queue for approval and record the verdict

Queue in `registries`, not `sessions`, and record the accepted parent `layoutHash` beside the independent
block hash. On acceptance, mark the previous accepted block for that `(layoutHash, region)`
`superseded` and point `supersededBy` at the replacement. On feedback, open a **new round**, append it,
and record `REJECTED` with the actual anatomy, its replacement and the owner's words. Mark one
evidence-backed candidate as the default for each region. `OK` accepts every displayed default and binds
the hashes immediately; never ask the same approval twice. Validate the updated session with
`@validate-artifact` and `@session` before closing.

### 11 — Close the phase

Before continuing, name regions still owed in friendly prose and finish every region owned by this
skill. Close only when `own = 0` or a genuine `NEED APPROVALS` item blocks a region.

## Stops

- No accepted layout hash, or its bound direction cannot be resolved → stop; name the broken dependency.
- Direction vocabulary no longer matches the source state it was approved against → stop; mark the visual evidence stale.
- A part cites a leaf or composite that does not exist → stop; the vocabulary is the authority.
- A state cannot be determined from source → refusal, not a guess.
- Registry unlocked, dirty or foreign-owned → stop; do not write.

## OUTPUT

Follow the skill shape's prose output. No status tables.
