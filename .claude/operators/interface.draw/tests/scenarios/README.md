# Real interface.draw scenarios

These are actual agent executions, distinct from the offline contract tests in neighboring folders.
Each Sol agent receives a concrete task, the operator/source locations and the same supplied baseline,
without the parent conversation. Each agent reads relevant Nivo source, invokes ImageGen, inspects the
returned pixels and retains the actual prompts, generation bindings, responses and verdict.

| Scenario | User task | Main acceptance question |
| --- | --- | --- |
| `document-filter` | Add document search/filter controls to the desktop accounting workbench | Does the new feature inherit the baseline and use supported document fields? |
| `mobile-workbench` | Adapt the workbench to a mobile viewport | Does the layout reflow coherently while preserving business meaning and action priority? |
| `recovery-immutable-ledger` | Detect and repair a deliberately wrong editable immutable-ledger drawing | Does feedback restore the original baseline semantics while preserving failure diagnostics? |

The recovery scenario explicitly injects a wrong first image as a test fault. That image is rejected,
never presented as a legitimate requested feature or approved implementation. The second call must
repair the fault using the original correct baseline. All Nivo source access is read-only.

Reports must distinguish actual generation, machine validation and observed visual acceptance.
A tool failure or uninspected image is an incomplete scenario, not a pass. See each scenario's
`report.md` and retained artifacts for its execution record.


The calls used the historical contract captured in `operator-under-test.json`. The document-filter
scenario passed after one real call; the mobile case remained mismatch after two; the immutable-ledger
case rejected its injected defect and accepted the second image. Only the two accepted directions
remain as deliverable PNGs and adjacent response previews. `rejected-image-cleanup.json` lists removed
copies. Prompts and provenance metadata for rejected attempts remain historical diagnostics.

Accepted responses were subsequently reinspected and completed with current `criteriaResults`.
Their `criteria-validation.json` files record current acceptance checks. `test_retained_results.py`
checks those retained bytes, current gates and cleanup; it does not repeat the live ImageGen calls.
