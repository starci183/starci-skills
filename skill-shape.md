# skill shape

Lifecycles are explicit per capability; suffixes do not create a universal lifecycle.

```text
FE design: Design Plan -> Layout rounds -> Block rounds -> Execute
BE feature: Feature Plan -> Feature Approve
Governance/data capabilities: their declared Plan -> Review -> Apply
```

Every worker reads and appends the same workflow/session; no worker creates a parallel task record.
FE JSON rounds are the review surface: founder acceptance is hash-bound, and Execute begins only
after all reachable layout/block units are accepted. Backend Approve contains a hard approval stop
before its first production write. Existing governance/data trios retain their normal phase rules.

Source-local setup is the second named exception. It has two continuous skills with internal
Plan → Review → Apply stages: `starci-setup-workspace` owns only
`<Source>/.workspace/<project>/`, while `starci-setup-worktrees` owns only
`<Source>/.worktrees/<project>/`. Neither stores runtime state below `.claude` or edits a target
repository. Missing identity, ambiguous paths, collisions or an expanded write boundary still stop
at Review for one batched approval.

Optional grammar-reference refresh is one standalone continuous capability:
`starci-grammar-refresh-references` audits, compares and updates only immutable provenance refs in
one run. It never edits durable templates, capsules, rulings, cases, rules or profiles, so it has no
separate approval phase and no authority to change grammar behavior.

## CONTEXT — print before doing anything

Present and append the table under the exact Markdown heading `### CONTEXT`. A plain `CONTEXT` label
is invalid because the workflow validator cannot identify its section.

| Field | Value |
|---|---|
| Workdir | absolute working directory |
| Source | absolute repository containing the active `AGENTS.md` and `.claude` trust tree |
| Project | user-declared project identity, or `Explicit targets` when FE/BE were supplied directly |
| Frontend | exact user-declared or project-resolved frontend repository |
| Backend | exact user-declared or project-resolved backend repository |
| Trust | absolute `<Source>/.claude` trust tree |
| Skills | absolute `<trust>/skills` root discovered by ChatGPT/Codex |
| App | product name, for example `starci-academy`, `nivo` or `nivo-expert-academy` |
| Repo / branch | absolute repository path and current branch, read from git |
| Purpose | one sentence saying what this phase must settle |
| Workflow root | absolute `<Source>/.workflows` |
| Workflow | `<workflow-root>/<kind>/<app>/<name>.md` |
| Language | `vi` |
| Phase | `plan`, `review` or `apply` |
| Touching | exact paths this phase may write |

For FE design session records, `Phase` is `layout`, `block`, `execute` or `complete`. Every event
keeps the same `Session id`, immutable object hashes and exact workspace-selected grammar receipt. A changed
grammar or profile hash reopens the affected decision owner; it is not silently adopted by Execute.

`Source` is the current Codex project context that owns `AGENTS.md`, `.claude` and `.workflows`; it is
not automatically a target repository. Resolve `Trust`, `Skills` and `Workflow root` from `Source`;
never hardcode a drive, machine path or repository name. The user must provide either `Project`, or
explicit `Frontend` and `Backend` targets. Resolve the targets from that declaration and never infer
them from Source or App. `App` names the product used in the workflow path. A phase that cannot
resolve Workdir, Source, Project/explicit targets, Frontend, Backend, Trust, Skills, App, Workflow
root or Workflow is stuck before target-specific work.

Before the first production write in Apply, confirm `Repo / branch` and `Touching` with the user.
Detection is not permission. Plan and Review write only the workflow and declared review evidence.

## PROCESS — continue until genuinely stuck

| State | Meaning | Next action |
|---|---|---|
| working | evidence or safe work remains | continue without asking |
| needs approval | a decision, permission, promise, price or write boundary can be wrong | batch it in `NEED APPROVALS` |
| phase complete | this phase's exit condition is met | append the workflow and invoke the next phase |

Do not stop merely because one tool path failed; try the safe fallback first. Batch all currently
known approvals into one round. After feedback, continue inside the same Review phase, append the
revision and show the revised brief or evidence again.

### Plan

Read the governing canon, contracts, live source and named references before proposing anything.
Produce a brief: objective, evidence, boundaries, decisions, alternatives and acceptance evidence.
Do not write production code.

For FE Design, Plan opens/resumes one hash-bound registry session, resolves the FE role's exact
workspace-selected
deterministic grammar and routes target surfaces to Layout. It does not create HTML previews.
Layout and Block JSON rounds are the review surface; each round keeps exact prompt, response,
candidates, feedback, founder verdict and grammar receipt.

### Review

Challenge the brief against real contracts, components, fixtures and runtime boundaries. This
generic Review phase applies only to capabilities that still declare Plan → Review → Apply; FE
Design and Backend Feature use their explicit journeys above.

Run the feedback loop until the user explicitly approves:

```text
brief -> feedback -> revision -> workflow append -> brief
```

Record every revision and every rejection with its replacement and reason. Review completes only
when the exact brief, acceptance states and production change boundary are approved.

### Apply

Read the approved Review section and confirm the production write boundary. Before changing product
source, commit the current target state and record `Baseline commit: <sha>`. This commit belongs to
the start of Apply: it captures the state before the approved change. Do not create a baseline from a
partly edited implementation.

Then implement the approved revision directly in target source and track `git diff <baseline>`.
A required path outside `Touching` returns to its decision owner; it never arrives quietly in the diff.

Prove the result at the production boundary. Tests, renders and live calls prove different claims;
run the ones the approved acceptance evidence names. Append the exact results to the workflow.

For a read-only capability, Apply finalizes the approved verdict and routes any repair to its owning
capability; it does not turn measurement into an undeclared source edit.

## OUTPUT — print these six tables at the end

Print all six in this order. An empty table still has one row saying `None`.
Use the exact level-three headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`,
`### WARNINGS`, `### REJECTED` and `### OWED`. Plain labels are invalid.

### OUTPUTS — concepts only

| Concept | Result |
|---|---|
| the brief, direction, approved revision, verdict or capability produced | what it now means |

`OUTPUTS` never lists implementation paths or line-by-line edits. It tells the reader what was
created, decided or proved at the concept level.

### CHANGES — implementation details

| Tree | Details |
|---|---|
| `path/to/file` | `added`, `modified`, `deleted` or `renamed` — the exact change |

`CHANGES` is the detailed code tree. Name every written path, including workflow files. For a rename,
name both old and new paths. Plan and Review normally list only workflow/evidence paths. Apply lists
every production path in `git diff <baseline>` and must match the approved boundary.

### NEED APPROVALS

| Question | Options |
|---|---|
| one decision that can be wrong | the evidence-backed default first, then alternatives |

Do not put ordinary implementation judgement here. Nothing to ask is `None`.

### WARNINGS

| Warning | Impact |
|---|---|
| an assumption, conflict, stale reference, failed proof path or irreversible risk | what it can invalidate |

A warning is not hidden inside `OUTPUTS` and is not promoted to an approval unless it blocks safe
progress.

### REJECTED

| Rejected | Instead | Why |
|---|---|---|
| the actual proposal or revision refused | its replacement | the user's reason, in their words where possible |

Use `None` when nothing was rejected. Never reconstruct a historical rejection from memory, and do
not count `not recorded` as evidence.

### OWED

| Owed | Cleared by |
|---|---|
| work or proof that did not happen | exact command, capability or decision that clears it |

`OWED` is unfinished work. `WARNINGS` is risk. `NEED APPROVALS` is a blocker requiring the user.
Keep the three claims separate.

## The workflow file

Use one append-only record:

```text
<Source>/.workflows/<kind>/<app>/<name>.md
```

Begin every new record with `<!-- starci-workflow: v2 -->`. Historical files without the marker
remain valid evidence and are not rewritten. After appending a phase, run:

```powershell
node <trust-root>/scripts/validate-workflows.mjs --root <Source>/.workflows
```

Write workflow narrative, evidence, decisions, questions, warnings, rejections and table values in
Vietnamese. Keep canonical headings, schema labels, paths, commands, code identifiers and exact source
quotes unchanged where translation would break validation or evidence.

| kind | capability |
|---|---|
| `designs` | new or undecided frontend pages, layouts, blocks and overlays |
| `fidel` | bounded fidelity or runtime repair against binding evidence |
| `feature` | backend capability |
| `consolidation` | duplicate-shape survey and consolidation |
| `data-backup` | datastore snapshot |
| `data-restore` | datastore restore |
| `lint` | lint adoption and synchronization |
| `drift` | workflow-to-source drift audit |
| `upgrade` | changes to canon, skills, skill shape or gates |

Do not rewrite old phases to match a newer schema. Historical records are evidence. Append a new
phase or migration note with what changed and why.

Each phase appends, in order:

1. `## plan`, `## review` or `## apply` with a revision suffix when repeated.
2. The exact `CONTEXT` table printed for that run.
3. Evidence and phase-specific artifact/state tables.
4. The six output tables in their canonical order.

Fidelity session records instead append `## start`, zero or more `## feedback`, one or more
`## end`, then `## finality`. Feedback after End resumes the same open session and requires End to
run again. Feedback after Finality opens a new Start with `Continuation of: <session-id>`.

An approved Review writes `Approved revision: <identity>`. Apply writes
`Applied revision: <same identity>`, `Baseline commit: <sha>` and `Tracked diff: <baseline>..worktree`
so the validator can prove what changed after Apply began.

Review records the approved revision explicitly. Apply must cite that revision. Upgrade Plan reads
real `REJECTED` rows, deduplicates identical witnesses by workflow and phase, and ignores `None` or
`not recorded` rows.

## Phase routing

- FE Design Plan routes Layout rounds, Block rounds and then Execute; no preview/review/apply sibling exists.
- Backend Feature Plan invites Feature Approve; Approve loops until explicit approval before coding.
- Other declared Plan/Review/Apply capabilities keep their existing routing.
- Workspace and worktree setup complete their internal Plan, Review and Apply stages without routing
  to sibling skills.
- Upgrade changes future rules only after repeated workflow evidence passes Upgrade Review.

No capability skips a declared decision boundary because the requested change looks small.
