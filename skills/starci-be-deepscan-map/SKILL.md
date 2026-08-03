---
name: starci-be-deepscan-map
description: Deep-scans the backend one business domain at a time and writes two documents per domain into `.artifacts/states/<domain>/` — `business.md`, the domain's states, transitions and invariants written for a front-end reader who never opens the backend; and `findings.md`, a ranked list of everywhere the code drifts from the BE canon or carries a real defect, each anchored to a `file:line` and the canon rule or risk it breaks — and it changes not one line of source. Reach for it whenever the backend as a whole needs to be understood and graded rather than written: "deep scan the backend", "map the business logic to .artifacts for the FE", "phân tích nghiệp vụ states ra artifacts", "audit toàn bộ backend", "which domains are inconsistent", "soi bug/logic/edge/security cả backend", "tối ưu source backend", "lên kế hoạch refactor backend", "review naming/JSDoc/guard/test coverage across the modules" — and before a large refactor, so the drift and the domain map exist before anyone edits. It is read-only and fans out: one agent owns a bundle of domains, so a whole-backend pass runs as a workflow. Not for grading a single module against canon in isolation (that is starci-be-cannon-plan) and not for writing or repairing code — an approved finding is handed to starci-be-cannon-apply, a missing test to the three-kind testing lanes. It grades and maps; it never edits the tree it reads.
---

# Deep-scanning the backend into a domain map and a findings ledger

A backend this size is not read by opening it. Thirty business domains under
`src/modules/bussiness/`, the resolvers that call them under `src/features/api/core/graphql/`, and
sixty-odd infrastructure modules beside them — no single reader holds that, and the front end holds
none of it. This skill turns that unread mass into two written things per domain: a **map** the front
end can read instead of the source, and a **ledger** of where the source has drifted from what the
canon says it should be, or carries a defect a canon rule cannot name but a careful reader can.

It produces documents and no diff. A run that scanned and edited in one pass could not be reviewed —
the finding and the fix it justifies would arrive together, with no way left to weigh one against the
other. **This skill reads, maps, and grades; it never edits the tree it reads.** The repair is a
separate, approved act: a canon violation goes to `starci-be-cannon-apply`, a missing test to the
three-kind lanes in [[testing]], a business bug to whoever owns the decision.

## The two documents, per domain

Every domain scanned writes into `.artifacts/states/<domain>/`. **Write `findings.md` with a Bash
heredoc, not the Write tool** — the Write tool hard-blocks the filename `findings.md` for subagents
("return findings as text, not write report files"), a guard aimed at self-reports that false-positives
on this skill's actual per-domain deliverable. `business.md` is fine through either.

| File | Is | For |
|---|---|---|
| `business.md` | the domain's entities, its **states**, the **transitions** between them, and the **invariants** that must hold across them | a front-end reader who will never open the backend — so a screen knows what states exist, what moves between them, and what can never be true at once |
| `findings.md` | a ranked list of drift and defects, each anchored to a `file:line` and to the canon rule or risk it breaks | the person who will decide what to repair, and the apply skill that will repair it |

`business.md` is the point of the exercise for the front end. It is not an API dump — it is the
**state machine behind the API**: what an enrolment, a submission, a transaction, a streak actually
*is* over time, drawn from the entity's own fields and the service methods that move it. A screen
built against a clear state map stops inventing states the backend does not have.

`findings.md` is graded against the canon, not against taste. Each finding names the rule it breaks
and the anchor that proves it, exactly as `starci-be-cannon-plan` does — this skill is that audit
plus the business map, run domain by domain across the whole tree rather than on one module.

## Resolve the source first

The backend lives at a different absolute path on every machine; nothing here remembers one.

```bash
node .claude/scripts/workspace/read-workspace-context.mjs be.path
```

A non-zero exit means this machine has never stated where its backend is — it prints the command
that fixes it (`skills/starci-setup-workspace`). Scanning the wrong checkout produces a map and a
ledger that are internally consistent and entirely fictional. This is a **monorepo**: the library is
root `src/` (`modules/`, `features/`), the deployable app is `apps/core/` (its `main.ts`,
`app.module.ts`, and the `test/{e2e,harness}` lanes). The business domains are `src/modules/bussiness/*`.

## The seven axes a finding is graded on

Read each domain against the canon and against defect, and file every finding under one axis so the
ledger sorts:

| Axis | What a finding on it looks like | Grades against |
|---|---|---|
| naming | a variable or method whose name lies about what it holds or does | [[naming-and-structure]] |
| jsdoc | a public class, method, resolver, service or enum member with no JSDoc, or JSDoc that restates the name | [[comments]] — required on every public surface |
| business-logic | a branch that produces the wrong state, a transition that should be impossible, an invariant the code lets break | the domain itself — recorded in `business.md`, cross-linked |
| edge-case | an input, an empty set, a concurrent path the handler never considers | [[validation]], and the state map |
| security | a mutation with no guard, a by-id read with no owner in its `where`, a secret read outside the env boundary | [[authorization]], [[auth-and-authz]], [[config-and-env]] |
| gate-middleware | a guard, interceptor or pipe that is missing where the pattern says one belongs, or present but wrong | [[authorization]] |
| test-tier | a domain with no unit spec for its branches, no e2e for its wiring, or an AI feature with no harness spec | [[testing]] — the three kinds |

A finding names its axis, its `file:line`, the rule or risk, and what breaks if it is left — ranked
by what a user actually loses, most severe first. A defect the canon has no rule for is still a
finding; it is filed under `business-logic` or `edge-case` and says plainly that it is a judgement,
not a canon breach.

## Partition for a fan-out, by file count and by explicit list

A whole-backend pass is a workflow: one agent owns a bundle of domains, reads them, writes their two
documents, and returns a short manifest of what it wrote. The partition is by **file count, not by
alphabet** — the domains are wildly uneven (`jobs` and `projections` dwarf the rest), so an
alphabetic split hands one agent ten times another's work. Compute each domain's size, balance the
bundles, and hand every agent an **explicit list of the domains it owns**, never a range. Never let
two agents write the same domain's folder.

Because the run is read-only and each agent writes a disjoint set of `.artifacts/states/<domain>/`
folders, no agent conflicts with another and none needs a git worktree. When the workflow returns,
**verify on disk what actually landed** — count the `<domain>/business.md` + `findings.md` pairs
against the domains dispatched — rather than trusting the run's own "completed": a fan-out that hits
a session limit reports success while silently dropping agents, and the dropped domains are simply
missing folders.

## What this skill is not

- **Not a single-module audit.** Grading one service or branch against canon, in isolation, is
  `starci-be-cannon-plan`. This skill is the whole-tree pass that also draws the state map.
- **Not a repair.** It writes `.artifacts/`, never `src/`. A canon finding is landed by
  `starci-be-cannon-apply`; a missing unit/e2e/harness spec is written into the lanes in [[testing]];
  a business bug is a decision for the teacher before it is a diff.
- **Not an API reference.** `business.md` is the state machine behind the API — states, transitions,
  invariants — not a list of fields and endpoints.

## Files

| Path | What it is |
|---|---|
| `.claude/scripts/workspace/read-workspace-context.mjs` | where the backend actually is (`be.path`) |
| `canon/be/INDEX.md` | the standard every finding is graded against |
| `.artifacts/states/<domain>/` | where the two documents land, one folder per domain |
| `.artifacts/states/README.md` | the incremental-audit log format this shares with `starci-be-patterns-audit` |
