---
title: starci-architecture-analyze · English
description: Human-first, evidence-backed analysis for difficult cross-system technical decisions.
---

# starci-architecture-analyze

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | shared reporting and orchestration contract |
| `@workspaces` | `knowledge/contexts/workspaces/en.md` | en | resolve and verify every routed source used as evidence |
| `@business` | `knowledge/contexts/business/en.md` | en | keep technical options inside accepted product truth |

## NESTED SKILLS

None. This analysis returns a decision context; it never starts planning, approval or implementation.

## PIPELINE

Topology: `dual-track` and read-only.

| Step | Track | Input | Transform | Required output | Gate |
|---|---|---|---|---|---|
| constraints | top-down | owner objective, current business head and non-functional concerns | separate fixed intent, preference, measurable constraint, assumption and unknown | decision frame | no candidate silently changes product truth |
| capability | bottom-up | verified routed source, runtime topology, data ownership and existing tests | trace the current flow and locate real leverage, coupling and failure boundaries | evidence-backed current-state model | every current-state claim cites live evidence |
| alternatives | join | accepted decision frame and current-state model | form 2–4 genuinely viable solutions and compare their consequences | option set and trade-off matrix | alternatives differ materially and use the same criteria |
| decision-handoff | proof | option set plus adversarial challenge | recommend or record one decision, explain losses, draw one simple flow and freeze planning inputs | human analysis and compact planning context | decision, invariants, risks, unknowns and proof expectations are explicit |

## Purpose

Give a human reader enough evidence and criticism to understand a hard technical decision before anybody names
implementation files. Use it for cross-service data placement, consistency, recovery, security boundaries,
capacity, bandwidth, latency, migration or similarly coupled choices where one locally reasonable change can
damage another system. Do not use it for routine CRUD, a known sibling operation, a small local correction or a
request already asking for exact files and tests.

## Boundary

This skill reads verified project routes, the current business authority, source, tests and declared runtime
configuration. It writes no product source, business authority, provider state or implementation plan. Its answer
is a human-first analysis plus a compact context block that a separately requested planning owner can consume.
It may recommend a product-truth question, but cannot publish that truth.

## Run

1. Read `@skill-shape`, `@workspaces` and `@business`. Resolve the project, the exact decision question, every
   affected routed role and the current business head. Verify route head, branch, origin and instructions before
   reading target source.
2. Decide whether depth is warranted. Continue only when at least two viable designs or one meaningful
   cross-boundary failure/cost/security trade-off exists. Otherwise explain the direct answer and leave ordinary
   file planning to its planning owner without manufacturing alternatives.
3. Build the decision frame from five distinct kinds of input: fixed owner intent, accepted business rules,
   measurable non-functional constraints, preferences/defaults and unresolved unknowns. Never upgrade a
   preference into a requirement.
4. Trace the current system from live source. Follow ownership and data across entry, persistence, processing,
   serving, deletion and recovery. Cite exact repository-relative paths and line ranges for facts that select or
   reject an option. Screenshots and examples may explain intent but do not prove implementation.
5. Create two to four materially different viable options. Include the current design when keeping it is viable.
   Evaluate every option against the same relevant criteria: correctness, data ownership, bandwidth/latency,
   capacity/cost, consistency, security/privacy, failure recovery, operability/observability, migration and testability.
   Omit criteria that genuinely do not apply rather than filling the table with noise.
6. Challenge the strongest candidate before recommending it. Exercise partial failure, retry/idempotency,
   concurrency, stale state, deletion, recovery, dependency outage and rollback where applicable. Quantify known
   limits; label estimates and unknowns instead of inventing numbers.
7. Draw exactly one simple explanatory flow for the recommended option. Use three to eight named boxes and the
   few arrows needed to show the principal interaction. It is a reading aid, not a full system diagram: no class,
   file, endpoint, network-zone or every-failure topology. Put detail in prose and the trade-off table.
8. State the recommendation first, then why the other options lost. If owner input is genuinely required, narrow
   it to one decision after exhausting source evidence and useful defaults. A reversible recommendation may remain
   explicitly provisional; an irreversible or security-sensitive fork must not be silently selected.
9. End with a compact planning context containing: project and source revisions, business head, objective,
   chosen decision/status, fixed constraints, invariants, affected contracts/data, failure and recovery obligations,
   migration/rollback expectation, proof expectations and unresolved unknowns. Do not name implementation files,
   pattern situations or test filenames; those belong to the subsequent planning boundary.

## Required human output

Keep the report readable and proportional. It must contain:

- the recommendation or exact unresolved decision;
- verified current-state findings;
- one simple flow diagram;
- a same-criteria trade-off table for 2–4 viable options;
- adversarial findings and mitigations;
- rejected options and why they lost;
- the compact planning context.

## Stops

- Business truth required by the decision is missing or contradictory: report the exact gap; do not solve it technically.
- A required routed source is absent or stale: stop before claiming the current architecture.
- Only one reasonable implementation shape exists and no meaningful cross-boundary trade-off remains: return the
  direct evidence-backed answer instead of fake brainstorming.
- Evidence cannot distinguish the leading options and the difference is irreversible, security-sensitive or
  materially changes cost: ask for the one owner decision and do not continue into planning.

## Output

Return the human analysis followed by `PLANNING CONTEXT`, a concise frozen handoff suitable for a separately
requested role-specific planner. No source writes and no implementation file list.
