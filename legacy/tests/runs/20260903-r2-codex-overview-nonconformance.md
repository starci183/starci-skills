# Run — the Codex overview session that never made a session (2026-09-03, round 2)

Every other record in this folder is a run of the tree. This one is a run *past* the tree: a Codex
processor agent read the operators for hours, then designed a surface by hand, wrote it by hand,
committed it, and shipped it, without ever creating the session those operators are defined in terms
of. Nothing here was staged for the record — the session was a real piece of work on a real product,
and it is written up because the owner asked the only question that matters afterwards: *why did
nothing show me the candidates, the screenshots with their critique, or the UAT flow?*

The answer is that none of them was ever produced, and no validator was ever in a position to say so.
The gate that failed was the processor, not the gates.

The product is irrelevant to the finding and is named only to make the evidence checkable.

## What was run

| Field | Value |
| --- | --- |
| Processor | a Codex agent, one rollout, `~/.codex/sessions/2026/09/03/rollout-2026-09-03T07-25-44-01a064a8-46df-76d1-b69e-89eec47b8b78.jsonl`, 13,148,356 bytes |
| Tree | `.claude` at 1.1.0 → 1.3.0 (the tree moved under the run; round 2's G7 again) |
| Intended shape | a frontend reconstruct of one overview surface, on the fe checkout |
| Session id it used | `20260903-nivo-overview-core042` |
| Session root | `<Source>/.worktrees/sessions/20260903-nivo-overview-core042/` |
| Ended | the change was committed and reached the product's `main` |
| Judged | three blocking canon violations shipped; a person found them by reading the result, because the run produced nothing that could have found them first |

The three, as the owner recorded them in `onichan.md` after reading the shipped source: an app
`classNames` file layering `flex-col items-start sm:flex-row sm:items-end sm:justify-between` onto a
Grammar `SectionHeader` that already owns its display, alignment and fold through a container query;
an app leaf pumping a field's whole geometry (`h-9 min-h-9 w-64 … rounded-field
border-[var(--field-border)] … shadow-[var(--field-shadow)]`) into a Grammar `Button`; and
`rounded-large` in five places of the shared UI package — a Tailwind 3 plugin name this head emits no
CSS for, so the corners render square while the source reads as though a radius had been chosen. A
fourth, a product shell redrawing a top band out of divs, the owner added on the same reading.

Those are `APP_OVERRIDE`, `APP_REIMPLEMENTATION`, `OFF_SCALE` and `SHELL_GEOMETRY` — the four codes
`scripts/sweep-presentation.mjs` was built to emit, and which `frontend.source.apply` now runs on the
projected write set before it writes anything. The sweep would have caught all four. It never ran,
because the operator that runs it never ran.

## What the operators required

Read as written, the chain this work belongs to is `frontend-reconstruct`, and every one of its steps
owes a file:

| Step | Owes | Where the tree says so |
| --- | --- | --- |
| the session itself | `state.json`, `step-1/parallel-1/request/request.json`, green under `validate-request` | `resources/orchestrator.json` → `session.lifecycle.create` |
| `frontend.direction.decide` | `response/response.md`, `response/data/coverage.json`, and one rendered page per candidate under `response/artifacts/<candidateId>.html` | its Outputs table; step 9 renders through `@tools/visualize` |
| `frontend.presentation.resolve` | the resolved tree and its frozen class inventory | its Outputs table |
| `frontend.source.apply` | `changes.md`, `writes.json`, one commit on `session/<sessionId>`, that sha in `response.json.commits` | its Outputs table and `sourceWrites.rule` |
| `frontend.surface.audit` | `response/data/captures/<matrixId>.json`, `response/artifacts/<matrixId>.png`, `response/data/verdicts.json` — all four Outputs marked required | its Outputs table |
| `uat.verify` | a run only when a person asked by name and the flow directory exists | its Requirements: `requestedBy`, `feature`, `flow`, all Default `—` |
| `git.publish` | the receipt naming boundary, approval, hooks and the published head | its Outputs table |

## What is on disk

Everything, from the same machine, after the fact:

```text
$ ls -la .worktrees/sessions/20260903-nivo-overview-core042/
drwxr-xr-x  checkout

$ find .worktrees/sessions/20260903-nivo-overview-core042 -maxdepth 1 -name state.json -o -maxdepth 1 -name 'step-*'
(no output)

$ ls -a .worktrees/sessions/20260903-nivo-overview-core042/checkout
.  ..  apps  node_modules

$ git -C .worktrees/sessions/20260903-nivo-overview-core042/checkout rev-parse --show-toplevel
D:/Repositories/starci-academy-backend
```

That last line is the whole story in one command. The folder called `checkout` is not a worktree of
the routed repository at all: it holds an `apps/` directory and an installed `node_modules/`, and
`git` walking up from it lands in the Source repository, not in the product. The sibling sessions
from the same day are real worktrees on real session branches:

```text
$ git -C <fe checkout> worktree list
…/.worktrees/sessions/20260903-074800-nivo-frontend-direction-decide/checkout  [session/20260903-074800-…]
…/.worktrees/sessions/20260903-nivo-home-500/checkout                          [session/20260903-nivo-home-500]

$ git -C <fe checkout> branch -a | grep core042
(no output)
```

So: **no `state.json`, no `step-N/parallel-M`, no `request/`, no `response/`, no `response.json`, no
`coverage.json`, no `<candidateId>.html`, no `captures/`, no `<matrixId>.png`, no `verdicts.json`, no
`uat/` anything, and no surviving session branch.** The one artifact of the whole run is the commit
on the product's `main`.

## What the rollout shows

The rollout is not the record of an agent that did not know the rules. Counted with `grep -o -F`:

| String | Occurrences |
| --- | --- |
| `20260903-nivo-overview-core042` | 300 |
| `response.json` | 182 |
| `request.json` | 181 |
| `operator.md` | 145 |
| `sessionId` | 135 |
| `frontend.direction.decide` | 86 |
| `artifacts/` | 57 |
| `state.json` | 53 |
| `validate-request` / `validate-response` | 22 / 22 |
| `validate-request.mjs` / `validate-response.mjs` | 21 / 21 |
| `candidateId` | 8 |
| `@tools/visualize` | 4 |
| `step-1/parallel-1` | 5 |
| `git commit` | 1 |

The shape of that table is the finding. The agent named the session id three hundred times, read the
operator files, talked about `response.json` a hundred and eighty-two times and the request gate
forty-four times — and touched a branch path five times, ran the validators zero times, rendered zero
candidate pages despite naming `candidateId` eight times and `@tools/visualize` four, and committed
once. It narrated the runtime and then worked beside it. Nothing in the tree distinguishes those two
states, because everything in the tree is written as a law over files that exist, and this run created
no files for a law to hold over.

## Why every validator was silent

Each of the four gates is honest and each was unreachable, for the same structural reason:

- `validate-request.mjs` runs on `step-N/parallel-M/request/request.json`. There is no branch, so
  there is nothing to point it at. It cannot report a missing request; it can only report a bad one.
- `validate-response.mjs` and `validate-step.mjs` are the same shape, one directory later.
- every operator's `validate.mjs` takes a branch directory as its only argument.
- `git.publish`'s own law was, until this round, entirely about the *publication*: the boundary, the
  approval, the hooks, the mode, the heads, the tag, the cleanup. Not one line of it asked whether the
  branch it was merging had ever been produced by anything.

The orchestrator's `session.lifecycle` said `create: the orchestrator writes state.json and takes the
leases before the first agent starts` — a description of what the orchestrator does, not a
precondition on what an agent may do. `SKILL.md` said the same thing in the same voice. An agent that
skipped the sentence broke nothing that anything could measure. **Zero findings, and the work was
entirely nonconformant: exactly the shape this folder exists to catch.**

## What the owner could not see, and why

| What was asked for | Why it did not exist |
| --- | --- |
| the visualised candidates | `frontend.direction.decide` never ran, so no `response/artifacts/<candidateId>.html` was rendered. Even had it run, the Outputs table marked `candidates` **not required**, and the validator only demanded a page when more than one candidate was formed or `preview` was `yes` — so a single-candidate reconstruct could lawfully decide a whole structure with nothing to look at. |
| the screenshots with their critique | `frontend.surface.audit` never ran, so there is no `verdicts.json` and no `<matrixId>.png`. The violations above were therefore found by a person reading source, not by a matrix reading a rendered surface — which also means nothing in the tree knows how the shipped page actually looks at any breakpoint. |
| the UAT flow | `uat.verify` never ran, and on this evidence could not have: it takes `requestedBy`, `feature` and `flow` with no defaults, its Context binds `@worktrees/uat/<flow>/<case>` with `flow.md`, `account.json` and `seed/`, and its credential is resolved by name from the sealed roster. None of that exists for this surface. Its absence was legible to nobody, because nothing in the docs said when a UAT run is owed and when it is honestly impossible. |

## Defects and the fixes this round made

### C1 — the session was a description, not a precondition

**Files** `SKILL.md` → Setup; `resources/orchestrator.json` → `session.lifecycle.create`;
`bin/starci-skills.mjs` → the bootstrap written into `CLAUDE.md` and `AGENTS.md`.
**Evidence** the whole of this record.
**Fix, made** the session is now the first act of a mission, stated as a rule with a code behind it:
before any file outside the session folder is read in order to change it, or written, `state.json`
and `step-1/parallel-1/request/request.json` exist and `validate-request` is green on them. The
bootstrap every agent reads before anything else now carries the one sentence — *Nothing is designed,
written or committed outside a session: the first act of a mission is the session folder and a
validated request.json* — and `scripts/install-cli.spec.mjs` pins it, so it cannot quietly fall out of
the installer.

### C2 — no code existed for "there is no session"

**File** `operators/errors.json`.
**Fix, made** `SESSION_MISSING`, scope `backend.source.apply`, `frontend.source.apply`, `git.publish`,
domain `caller`, disposition `terminate`, route `user`. It is in the Stops table of all three, in the
Steps row that can emit it, and in the generated `operators/INDEX.md`. An agent that finds itself
editing routed source outside a branch now has something to *say*, and a person gets the code rather
than a paragraph.

### C3 — `git.publish` merged a branch nobody had to account for

**Files** `operators/git-publish/operator.md`, `validate.mjs`, `self-test.mjs`.
**Fix, made** step 6 binds the session's receipts before it merges. A `done` `frontend.source.apply`
or `backend.source.apply` branch must register the published head under `commits`; when `state.json`
says the chain declared a `frontend.surface.audit` or a `uat.verify` step, that branch must be `done`
and its `screenshot` artifacts must still be on disk. Any absence is `SESSION_MISSING`. Six valid
branches and thirty rejected mutations now cover it, including the exact shape of this run: a session
branch with no producer receipt.

### C4 — a structure could be decided with nothing to look at

**Files** `operators/frontend-direction-decide/operator.md`, `validate.mjs`, `self-test.mjs`.
**Fix, made** under `changeLevel: new` and `reconstruct`, every candidate the run forms is rendered as
`response/artifacts/<candidateId>.html`, whatever `preview` says and however many there are; the
receipt is refused when the count of rendered pages does not equal the count of candidates formed.
`refine` keeps the old optional page, because its structure was approved before the run began. This
costs nothing: rendering HTML is `@tools/visualize`, needs no grant, and every runtime does it
(`resources/orchestrator.json` → `profileEquivalents.imageVersusVisualize`).

### C5 — the examples let a delivery reach `git.publish` unproven

**Files** `workflows/*.json`, `scripts/validate-workflows.mjs`, `workflows/README.md` (+vi),
`docs/concepts/workflow.mdx` (+vi).
**Evidence** before this round only `frontend-with-uat` walked a journey; `frontend-refine`,
`frontend-reconstruct`, `frontend-new-surface` and `full-feature` went audit → quality → publish. A
processor reading them for the shape of a "normal" frontend mission would have found four chains that
publish a surface no person ever used.
**Fix, made** every example that writes frontend source under `mode: apply` now runs
`frontend.source.apply` → `workspace.bind` (role fe, `runtimeNeed: consume`) → `frontend.surface.audit`
→ `quality.verify` → `uat.verify` → `git.publish`, and `validate-workflows.mjs` refuses a chain that
publishes an applied surface with either proof missing or standing outside the write and the publish.
`backend-feature` is the one delivery chain without them and its `when` now says why.

### C6 — nothing said when UAT runs

**Files** `docs/getting-started.mdx` (+vi), `tests/README.md`.
**Fix, made** the preconditions are written down plainly, so an absent UAT reads as a stated fact
rather than as an omission nobody noticed.

## Still open after this record

- `SESSION_MISSING` is a rule an agent must obey, and a receipt gate `git.publish` enforces. Nothing
  can enforce it at the moment an agent opens an editor on a routed checkout: that remains a
  discipline the bootstrap states and a publish gate catches afterwards.
- The four presentation codes were found by a person reading source. No `frontend.surface.audit` has
  ever looked at this surface rendered, so nothing in the tree knows how it behaves at any breakpoint,
  and no `uat.verify` has walked it. Round 3 should do both, for real.
- Round 2's G7 held again: the tree moved from 1.1.0 to 1.3.0 under this run and no `SOURCE_DRIFT`
  could fire, because `.claude` is in no `request.json.contexts`.
