# Scope-based execution

Choose the least ceremony that still represents the requested scope truthfully:

- **Plan:** new large, unclear or multi-workflow outcome. Inspect enough to define
  the scope, then keep the whole delivery route in one Plan. Resume that Plan on
  later prompts; do not replan every repair or checkpoint.
- **Workflow:** clear bounded work fitting one existing workflow, such as fixing
  a backend behavior or UI. No Plan wrapper or invented future stages. A frontend
  workflow may include its own draw, implementation and UAT operators; several
  operators within one workflow do not automatically require several workflows.
- **Flash:** small clear reversible low-risk local repair. Briefly state the
  change, do it, run focused checks and report. No goal approval ceremony.

Few lines can still carry significant risk. Authorization, data and contract
changes cannot use flash, but do not automatically need a large Plan if one
well-defined workflow safely owns them. Unresolved scope or multiple owners/jobs
needs planning. No route grants deployment, publication or customer-data effects.

## Standalone workflow

Use `proposeStandalone` and `presentStandaloneGoal` from `workflows/lifecycle.mjs`
for a clear single workflow. Keep its detailed goal and show a short goal brief.
The existing manual goal approval, scoped cell requests, typed outputs, result
review and completion checks still apply. Do not manufacture a Plan, Plan
acceptance or fake user reply just to satisfy old ceremony.

The standalone record lives under `.starciwork/_local/workflows/<id>/`, not the
Plan tree. Existing Plan runs and their receipts stay unchanged. Scoped
coordinator mandates and auto remain Plan-bound; this standalone path is direct
manual approval and does not silently migrate an active delegated run.

If execution reveals a materially larger outcome, stop before expanded effects,
retain useful work and propose the required Plan. A routine correction within the
same approved scope stays in that workflow; do not restart planning.
