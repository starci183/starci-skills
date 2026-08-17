---
title: Skill shape
---

# Skill shape

You are given a capability to run and you return one appended workflow phase and six output tables.
This module decides **what every skill must print, ask and record** — not what any one skill does.
A skill that invents its own reporting shape cannot be audited against the others, and a tree whose
records disagree about their own format stops being evidence.

## Law

A skill states where it is before it acts, and what it wrote after. The `CONTEXT` table comes first
because a run that cannot name its Source, project and write boundary is not ready to touch anything;
the six output tables come last because a run that cannot separate what it decided from what it wrote
from what it still owes has not finished.

Detection is not permission. Finding that something must change is never authority to change it.

## The seven capabilities

| Skill | Journey | Owns |
|---|---|---|
| `starci-init` | plan → review → apply, internal | the Source bootstrap: `AGENTS.md` and `CLAUDE.md` |
| `starci-fe-design-layout` | opens or resumes the session, then layout rounds | 3–4 layout candidates per surface, hash-bound |
| `starci-fe-design-block` | block rounds | 3–4 anatomies per region, hash-bound |
| `starci-fe-design-execute` | execution | frontend source, only after every reachable hash is accepted |
| `starci-be-plan` | plan | the backend brief: files, boundary, test cases |
| `starci-be-approve` | approve, then apply | approval, then backend source |
| `starci-setup-workspaces-and-worktrees` | plan → review → apply, internal | `.workspace/<project>/` and `.worktrees/<project>/`, separately |

There is no orchestrator. Two jobs an orchestrator used to hold are therefore assigned explicitly:
**Layout opens the session**, and **Execute refuses to run** while any reachable layout or block hash
is unaccepted. A skill that cannot find its precondition stops; it never proceeds on the assumption
that someone approved something.

## CONTEXT — printed before anything else

Under the exact heading `### CONTEXT`. A plain label is invalid: the validator identifies the section
by its heading.

| Field | Value |
|---|---|
| Workdir | absolute working directory |
| Source | absolute repository holding `AGENTS.md` and the trust tree |
| Project | the user-declared project, never inferred from a folder |
| Role targets | the repositories resolved from `.workspace/<project>/<role>/config.json` |
| Trust | absolute trust tree |
| Purpose | one sentence saying what this phase must settle |
| Workflow | `<Source>/.workflows/<kind>/<app>/<name>.md` |
| Phase | `layout`, `block`, `execute`, `plan`, `approve` or `apply` |
| Touching | the exact paths this phase may write |
| Read | the exact contract, source, schema or runtime evidence read, with its state |
| Missing | required evidence that is absent, and what it blocks — or `None` |

`Project` and its role routes resolve through the workspace module, and a route is verified before it
is read. A phase that cannot resolve Workdir, Source, Project, its role targets, Trust or Workflow is
stuck before any target-specific work.

## Process states

| State | Meaning | Next action |
|---|---|---|
| working | evidence or safe work remains | continue without asking |
| needs approval | a decision, promise, price or write boundary could be wrong | batch it into `NEED APPROVALS` |
| phase complete | the exit condition is met | append the workflow, invoke the next phase |

One failed tool path is not a stuck run: try the safe fallback first. All approvals known at that
moment are batched into one round rather than asked one at a time. After feedback, the same phase
continues, appends its revision, and shows the revised brief again.

## Phases

**Design rounds** are the review surface. Each round records the exact prompt, the candidates, the
feedback and the owner's verdict, and acceptance is bound to a hash. Feedback opens a new round; it
never edits an accepted round.

**Plan** reads canon, contracts and live source, then produces a brief: objective, evidence,
boundaries, decisions, alternatives, acceptance evidence. It writes no product code.

**Approve** loops until the user explicitly approves, and holds a hard stop before the first
production write. Every rejection is recorded with its replacement and the user's reason.

**Apply** confirms the write boundary, records a baseline commit taken **before** the change, then
implements the approved revision and proves it at the production boundary with the evidence the
approval named. A path outside `Touching` returns to its owner instead of arriving quietly in a diff.

## Output — six tables, in this order

Exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED`,
`### OWED`. An empty table still carries one row saying `None`.

| Table | Holds | Never holds |
|---|---|---|
| OUTPUTS | what was decided or proved, at concept level | file paths |
| CHANGES | every written path and what happened to it | concepts |
| NEED APPROVALS | one decision that could be wrong, evidence-backed default first | ordinary implementation judgement |
| WARNINGS | an assumption, conflict, stale reference or irreversible risk | anything that blocks progress — that is an approval |
| REJECTED | the actual proposal refused, its replacement, the user's reason | a rejection reconstructed from memory |
| OWED | work or proof that did not happen | risk, which is a warning |

`OWED`, `WARNINGS` and `NEED APPROVALS` are three different claims — unfinished work, risk, and a
blocker needing the user. Collapsing them is how an unfinished run reads as a finished one.

## The workflow file

One append-only record at `<Source>/.workflows/<kind>/<app>/<name>.md`:

| kind | capability |
|---|---|
| `designs` | frontend surfaces, layouts, blocks and overlays |
| `feature` | backend capability |
| `setup` | workspace routes and worktree state |

Each phase appends its heading, the exact `CONTEXT` table printed for that run, its evidence tables,
then the six output tables in order. An approved phase writes `Approved revision: <identity>`, and
Apply cites that same identity plus its baseline commit, so the record proves what changed after Apply
began.

Narrative, evidence and table values are written in Vietnamese. Headings, schema labels, paths,
commands and code identifiers stay unchanged, because translating them breaks validation.

Old phases are not rewritten to match a newer format. A historical record is evidence; a correction is
appended.

## Rules

1. `CONTEXT` is printed before acting, and it names `Touching` before any write.
2. Detection is not permission.
3. Approvals are batched, not drip-fed.
4. One session, one record. No skill opens a parallel task record for the same work.
5. Acceptance is hash-bound; an accepted round is never edited in place.
6. Execute runs only when every reachable hash is accepted.
7. A baseline commit is taken before the first production write, not from a half-edited tree.
8. A path outside `Touching` returns to its owner.
9. Every phase ends with all six tables, `None` included.

## Exceptions

- **Setup owns two roots.** `.workspace/<project>/` and `.worktrees/<project>/` fail in opposite
  directions — one makes a run read the wrong repository, the other makes it write where writing was
  forbidden. One approval never covers both; each root is approved as its own boundary.
- **A read-only capability.** Its Apply finalises a verdict and routes repairs to their owner. It never
  turns measurement into an undeclared source edit.
- **A resumed session.** Layout may resume rather than open. The session id and every accepted hash
  survive the resume unchanged.

## Worked example

**Run.** "Design the coding drill result page."

```text
### CONTEXT
Phase: layout
Project: starci-academy
Role targets: fe -> <disk>\starci-academy-fe (verified: contract present)
Touching: .workflows/designs/starci-academy/coding-drill-result.md
Purpose: settle 3-4 layout candidates for one new surface
Read: contract keys + why + host (74KB of 192KB), branch inventory, route table
Missing: None
```

Layout opens the session because no orchestrator exists, runs one round, and ends with six tables —
`NEED APPROVALS` carrying the one product decision the request did not state, `OWED` carrying the block
rounds that have not happened yet.

If `starci-fe-design-execute` were invoked at this point it would stop, not start: the layout hash is
proposed, not accepted, and nothing else in the tree makes it acceptable.

## Scope

This module decides the shape every skill reports in. It does not decide what a layout may contain,
which class is correct, or which repository is read — those belong to the brainstorm, compiler and
context modules respectively.
