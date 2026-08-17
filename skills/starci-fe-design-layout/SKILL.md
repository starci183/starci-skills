---
name: starci-fe-design-layout
description: Open or resume a hash-bound design session and produce 3–4 layout JSON candidates for each requested frontend surface, previewed as HTML at localhost:8080 and queued for the owner's approval. Use when a new page, layout, overlay or redesign is requested. Writes JSON to the project registry, never frontend source.
---

# starci-fe-design-layout

Read [`../skill-shape/en.md`](../skill-shape/en.md) first. There is no orchestrator: this skill opens
the session, and `starci-fe-design-execute` refuses to run until every hash it produces is accepted.

**The JSON is the artifact. The HTML is a way of looking at it.** Approval binds to the canonical JSON
hash, never to a rendered page.

## PROCESS

### 1 — Print CONTEXT

Print `### CONTEXT` before touching anything. `Phase` is `layout`. `Touching` names the workflow record
and the project registry, and nothing in the frontend repository.

### 2 — Resolve and verify the workspace route

Read `.workspace/<project>/<role>/config.json` for the `fe` role. Verify before reading anything from
it: the checkout exists, and `context.contract` is still a real file.

A stale route **stops the run** (`WORKSPACE-5`). Do not continue with the nearest checkout that
resolves — every candidate would then cite a contract that is not the product's.

### 3 — Resolve the worktree roots

Registry at `<Source>/.worktrees/<project>/registries`: locked, clean, on the project branch, owned by
this Source's Git (`WORKTREE-1`, `WORKTREE-4`). Preview output goes to
`<Source>/.worktrees/<project>/cache/preview` (`WORKTREE-2`). Never below `.claude`
(`WORKTREE-3`).

### 4 — Resume or open the session

**Session identity is the surface**, not the prompt. Two differently worded requests for the same page
are the same session; a reworded prompt is a new round, not a new session. Print which happened —
`resumed <id>` or `opened <id>` — and keep every accepted hash across a resume.

### 5 — Read the six inputs, at their declared reduction

| Input | Read |
|---|---|
| request | verbatim |
| contract | **queried, not read** — one need per region through `scripts/contract-search.mjs`, which returns `key`, `why`, `host` and never a class array |
| branches | every branch and what each may contain |
| routes | every route page and every persistent layout |
| axes | the closed diversity set |
| precedents | accepted candidates for this project, with their rejections |

Reading the class arrays is a defect, not an optimisation: a stage that cannot see a class cannot write
one into a candidate. The query is how that ceiling stops being a promise: the script never extracts a
class, so the value does not arrive and cannot be copied. Measured on a 299-entry registry: a query answers
in under 2KB where the permitted read is 69KB, and the registry is 192KB.

### 6 — Resolve every region against the contract, one query per region

    node <trust>/scripts/contract-search.mjs <project> <role> --need "<the region stated as a need>"

Ask by the **reason**, never by the shape — the need sentence is what a `why` is written to match. Every
result prints the words it matched on, and a result marked `~` matched on an incidental word rather than on
the need: it is not an answer, and treating it as one is exactly the "close enough" this step exists to
refuse. Each region gets exactly one verdict:

- `reuse <key>` — an entry's reason already answers this region;
- `generalize <key> -> <key>` — it answers it under a feature-bound name; **measure the call-site count
  first**, and keep the new name fixing its children;
- `new <key>` — nothing answers this reason; state the `why` the new entry will carry.

A `generalize` verdict without a measured call-site count is refused, not guessed.

**A query that answers nothing exits 1, and that is two facts, not one.** For this run it is a `new`
verdict. For the tree it is a finding — a real surface stated a need and no entry could be found by it —
and it is carried into `WARNINGS` naming the need verbatim, so [`starci-repair`](../starci-repair/SKILL.md)
can repair the reason that failed rather than the 298 that merely look wrong in a count.

### 7 — Generate 3–4 candidates

Each declares its axis values. Drop any candidate whose whole axis set matches another — that is one
candidate, not two. At least one candidate must not follow the nearest precedent.

If the request admits only one structure, return one and say why. Never pad a batch to three.

### 8 — Refuse what only the owner can decide

A product decision the request does not state and no law can derive produces a refusal block. It ships
**with** the candidates; the rest of the batch stays readable.

### 9 — Validate, hash, write JSON, then render the preview

The batch is validated **before** it is written and before anything is hashed:

```bash
node <trust>/scripts/validate-artifact.mjs \
  --schema <trust>/brainstorms/layouts/schema.json \
  --data <batch.json> --hash
```

The schema refuses a class the way the contract's closed union does — by making it unrepresentable:
every object sets `additionalProperties: false`, so a `className` is an error rather than a finding. The
validator additionally enforces what a schema cannot say — no class token anywhere in the batch, no two
candidates sharing an axis set, at least one candidate citing `none` — and prints the hash of each
candidate.

The hash covers the candidate only, never the envelope. The same decision re-run in a later round with a
reworded prompt produces the same hash; if it did not, an approval would point at nothing.

Then generate one HTML page per candidate into `cache/preview` and serve it:

```bash
npx -y http-server .worktrees/<project>/cache/preview -p 8080 -c-1 --silent
```

The preview's own CSS is documentation chrome. It draws region boxes, region names, axis values and the
entry and branch each region cites. It **never** carries a product class, and nothing in it is a source
of classes for later stages. A preview that starts to look like the product is a preview that has begun
deciding what principles decide.

### 10 — Queue for approval and record the verdict

The queue lives in `registries` because a pending decision is durable; `sessions` is disposable and
would lose it.

On acceptance, bind the hash. On feedback, open a **new round** — never edit an accepted round — append
it to the session, and record `REJECTED` with the actual candidate, its replacement and the owner's own
words.

### 11 — Close the phase

Append the workflow and print the six tables. `OWED` names the block rounds that have not happened.

## Stops

- Route absent or stale → return to `starci-init`.
- Registry unlocked, dirty, or owned by another Git → stop; do not write.
- A required class does not exist in the contract's closed set → this is a **contract change**, not a
  layout choice, and it returns to the owner.
- Two candidates left with identical axis sets → they are one candidate; regenerate rather than ship a
  fake choice.

## OUTPUT

The six tables from the skill shape, in order. `OUTPUTS` names the session, the candidates and their
hashes at concept level; `CHANGES` names the registry and workflow paths written; `NEED APPROVALS`
carries the accept-or-feedback decision and any refusal; `WARNINGS` carries stale-reference risk;
`REJECTED` carries the owner's words; `OWED` carries the block rounds.
