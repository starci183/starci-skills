# Execute `test/uat-ui-proof`

Produce independent UI proof for one frozen UAT snapshot.

Require the complete render-state matrix from the latest source: every in-scope entry, task, pending, recovery, result, exit, and exact handoff state at wide, intermediate, and compact. Require and inspect the uncropped host-context handoff artifact from the exact delivered browser surface and content viewport with no viewport override. A detached automation viewport cannot certify a differently sized in-app panel. Inspect the image artifacts themselves. An overlay does not certify the obscured surface, and a different state left visible after audit invalidates the proof. CSS tests, DOM, geometry, lint, and accessibility evidence only corroborate; they never establish UI PASS.

Perform only this job. Validate exact mission, parent-child, authority/source-head, and progress identity where present.
