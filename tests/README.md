# Tests — workflow dry runs and their assessment

`tests/runs/` holds one record per real session of a workflow: the request, every branch's status and
stop code, the validator output verbatim, the artifacts written, and the defects the run exposed. A
run is executed by a processor agent (Claude Opus in this round) that also plays each operator's agent;
every branch must pass `validate-request`, `validate-response` and the operator's own `validate.mjs`; a
valid `blocked` counts as green, a fabricated green is a failure. Source-writing steps ran with
`mode: dry`; nothing was written to a checkout or a businesses root; sessions live under
`.worktrees/sessions/` (gitignored) and are kept for inspection.

## Round 1 — 2026-09-03, tree at 1.0.2

| Workflow | Target | Reached | Stopped by | Judged | Report |
| --- | --- | --- | --- | --- | --- |
| `frontend-refine` | `/[lang]/subscriptions` (`ProSubscriptionBlock`) | bind → direction done | `frontend.presentation.resolve` `RULE_MISSING` (route block inset; accent marker on an unraised row) | correct stop; knowledge added (`PADDING-9`), resolve law added (forbidden class is removed) | [record](runs/20260903-frontend-refine-subscriptions.md) |
| `frontend-reconstruct` | learner dashboard | bind → direction → resolve (0 `RULE_MISSING`, 27 classes removed, 1 gap) → apply dry (5 paths, 0 `WRITE_REJECTED`) | `frontend.surface.audit` `RUNTIME_UNAVAILABLE` (no preview served) | correct stop; workflows now bind the fe checkout with `runtimeNeed: consume` | [record](runs/20260903-frontend-reconstruct-dashboard.md) |
| `frontend-new-surface` | `/games/billiards` (no promise exists) | bind done | `business.decide` `EVIDENCE_MISSING`; standalone direction `BUSINESS_REQUIRED` | correct refusal to draw an undecided page; design gap fixed: a greenfield promise now enters as the person's `promise` (intent claim) | [record](runs/20260903-frontend-new-surface-billiards.md) |
| `backend-feature` | `pro-subscription` | bind `CHECKOUT_DIRTY` → resume done → business (22 claims, 15 dimensions) → architecture done with `COMPATIBILITY_UNVERIFIED` fallback and the `critique` exchange (8 attacks hold) | stopped before `backend.source.apply` (no dry mode yet) | correct; the nested exchange and the fallback path work end to end | [record](runs/20260903-backend-feature-pro-subscription.md) |
| `content-unit` (Sonnet) | `system-design/lesson-01` | — | `content.generate` `BRIEF_UNBOUND` (MinIO unreachable offline) | correct stop; a Sonnet-class agent satisfied the contracts without retries | [record](runs/20260903-content-unit.md) |

Profiles bound versus models run: every branch ran on Claude Opus except `content-unit` (Claude Sonnet
standing in for `luna`); the tree now records profile equivalents in `resources/orchestrator.json` so a
stand-in is declared, not silent.

## What the round changed in the tree

Fixed from the records (see `onichan.md` for the owner-facing log): the `validate-response` CLI branch
detection; `route.schema.json` write roots; `PADDING-9`; the resolve law for a forbidden class;
`business.decide` `promise` and the claims schema for intent statements; Next-table edges and the
workflow adjacency and bound-role checks; `runtimeNeed: consume` presets; `response.json.reason`;
Grammar claims that disagreed with their CSS (`@starci/grammar@0.4.1`); the `session-only` worktree
policy for the fe route.

## Still open after round 1

- `backend.source.apply` has no `mode: dry`; the backend chain cannot be dry-run past architecture.
- A preview of the fe checkout must be served for `frontend.surface.audit` to produce a matrix; the
  runtime registry claimed `ready` while no port answered (`platform.operate` territory).
- Knowledge candidates with a single occurrence (not authored): canvas or media aspect ratio; a page-level
  idiom for the dashboard; `Rail` filling and scrolling at once.
- Orchestrator: who owns `declaredWriteRoots` for a bind (the workflow target should derive them); a
  `.claude` edit mid-session is invisible to `SOURCE_DRIFT` because the head does not move.

## Round 2 — planned

`frontend-refine` again on subscriptions (expect resolve to pass `PADDING-9` and remove the accent marker
class), `backend-feature` through a dry apply once the mode exists, `full-feature` for the parallel step,
`frontend-with-uat` for the admission stop, and one resume of a blocked branch.
