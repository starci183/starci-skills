# Architecture

## Ownership

The host owns entrypoints, runtime and source routing. A project's backend owns `.starciwork` for both backend and frontend. Its excluded `.starciwork/_local` directory owns the shared plan/run records. The frontend owns source only. Multiple projects have separate backend-owned records, even when they use the same runtime.

Commit durable requirements, specifications and suitable evidence according to project policy. Keep secrets out of them. `.starciwork/_local` is local state and should be ignored by the backend repository; the host installer's ignore applies only within the host. Preserve unfinished plans and approvals across agent restarts.

## One long plan, bounded execution

```text
Full requested outcome and terminal acceptance
  → business and architecture coverage
  → BE / FE implementation coverage
  → review and browser UAT coverage
  → terminal proof and user-facing delivery
```

Coverage belongs to the plan even when a later workflow is not yet authorized. Each area is explicitly changed, reused with evidence, or not applicable with a real scope reason. A maintenance-only request does not acquire unrelated product work.

A workflow has a concrete goal, exact targets, limited effects, typed outputs and verification criteria. Manual mode requires actual goal approval before effects and acceptance of the delivered result before completion. Workflow dependencies consume accepted producer outputs, not summaries that imply success. Open questions block the segment they affect; unresolved work remains visible in the plan.

For implementation, backend changes must establish API/unit/E2E evidence before dependent frontend work. Frontend includes design reuse/draw, implementation and browser UAT; unit tests alone are not UAT. A UI drawing defaults to one direction, with multiple alternatives only when explicitly requested. It must be grounded in applicable knowledge and the consuming application's installed grammar package, not just visual resemblance.

## Authorities

| Concern | Maintained source |
| --- | --- |
| Agent entry and load order | `SKILL.md` |
| Project binding | `schemas/workspace-routing.json` |
| Workflow selection | `workflows/catalog.json` |
| Complete plan and coverage | `workflows/plan.json`, `workflows/plan.mjs` |
| Requests, receipts and delivery | `workflows/lifecycle.mjs` |
| Durable metadata and proof | `core/`, `schemas/` |
| Domain execution constraints | `ops/<operator>/operator.json` |
| Generated agent-facing contracts | `.dist/` |

The CLI exposes local setup, inspection and validation. It is not a headless autonomous agent runner. Existing `work/*` wire IDs are retained, while the public product and command are StarCi.

## Evidence boundaries

Completion depends on current input digests, accepted results and referenced assets. Changed semantic inputs invalidate dependent proof without rewriting history. New evidence is staged outside durable metadata and validated before publishing a new bundle. Published bytes are immutable; corrections require new evidence, not a changed file under an old approval.

These are consistency checks, not a security sandbox or a guarantee that a test assertion matches reality. Agent actions remain subject to the host's actual tool permissions and user authority.
