# `test/uat-result-publish` output

- `output.outcome`: `passed`, fresh `frontend-counterevidence`, ordinary `failed`, or `blocked`.
- `output.result`: Canonical PASS artifact or exact FE-owned counterevidence; ordinary failure/blocking is null.
- `output.gaps`: Exact blockers.
- `output.evidenceRefs`: Evidence consumed.

Only `frontend-counterevidence` may resume the frontend mission. It binds the finding, UAT snapshot,
current source, exact evidence bundle, prior blind visual PASS, observation time, owner
`starci-fe-process`, and resume state `reapply`. Ordinary `failed` never becomes frontend success or
frontend reapply authority.
