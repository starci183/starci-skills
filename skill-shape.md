# skill shape

Every capability is three skills, in this order:

```text
Plan -> Review -> Apply
```

Plan researches and briefs. Review challenges the brief and revises it until approval. Apply first
commits the current target state as its baseline, then writes the approved change and tracks the
resulting diff. Every phase reads and appends the same workflow file; no phase creates a second record
for the same task.

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

For FE Design with an undecided product choice, build one implementation-feasible `index.html` with
two to four proposal tabs. Put it under
`<Source>/.workflows/.previews/designs/<app>/<name>/<revision>/` and serve that directory on the first
free localhost port starting at `8080`. A parity request includes a parity-first tab. Work with no
real choice does not manufacture alternatives. This preview is inspectable Plan evidence, not
production source or an Apply baseline.

Track the single preview by URL, HTML path and SHA-256, then track each tab by direction ID and status.
Plan completes only after the user can open the preview and switch every tab, the brief is written to
the workflow, and Review has enough evidence to challenge every decision before Apply.

### Review

Challenge the brief against the real contracts, components, fixtures and runtime boundaries. Resolve
every decision that can make Apply diverge. FE Design Review creates no HTML, JSX, CSS, parallel
design tree or production edit.

FE Design Review must freeze two source-backed tables before approval: `COMPONENT DELTA` names every
route, page, layout, overlay, block, composite, branch, leaf and shell as `REUSE`, `ADD`, `MODIFY`,
`MOVE` or `REMOVE`; `PROPS DELTA` names every public prop/API action and all producers or call sites.
No row may defer discovery to Apply. `REUSE` predicts no edit, while every other row predicts an
exact baseline-to-worktree change.

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

Then implement the approved revision directly in target source. For FE Design, source is the only
implementation: no design-code directory, detached HTML proposal or disposable component copy.
Track `git diff <baseline>` throughout Apply. A required path outside `Touching` returns to Review as
a finding; it never arrives quietly in the diff.

For FE Design, reconcile that diff with every approved `COMPONENT DELTA` and `PROPS DELTA` row.
Discovering a new owner, tier, path, prop or action returns to Review; Apply does not invent it.

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

An approved Review writes `Approved revision: <identity>`. Apply writes
`Applied revision: <same identity>`, `Baseline commit: <sha>` and `Tracked diff: <baseline>..worktree`
so the validator can prove what changed after Apply began.

Review records the approved revision explicitly. Apply must cite that revision. Upgrade Plan reads
real `REJECTED` rows, deduplicates identical witnesses by workflow and phase, and ignores `None` or
`not recorded` rows.

## Phase routing

- Plan invites its sibling Review.
- Review loops until explicit approval, then invites its sibling Apply.
- Apply closes the capability or routes a newly discovered concern to that concern's Plan.
- Fidelity repairs deviation from approved evidence; it does not redesign.
- Upgrade changes future rules only after repeated workflow evidence passes Upgrade Review.

No phase skips its sibling because the requested change looks small.
