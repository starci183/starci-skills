# Frontend product UAT guidance

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui-testing` |
| Contract revision | `7.6.0` |
| Operators | `fe/capture-preflight, fe/render-capture` |
| Search tags | `browser, UAT, final journey, authentication, responsive, persisted outcome` |
| Dependencies | `fe.customer-journey, fe.state-modeling, fe.product-seeding, fe.product-proof` |

Product UAT is the final gate after latest-source blind UI PASS and final quality PASS. This record is
journey-execution guidance; it does not create a test stage before review, mutate product source, or
route a repair.

Open the connected application in a real browser and follow the compiled journey as an ordinary user
with the declared run-scoped account. Direct database mutation, internal route shortcuts, DOM
scripting that bypasses controls, and authenticated storage injection are not user interaction and
cannot prove the journey. Never expose secrets in logs, screenshots, traces, or artifacts.

Start from the approved public entry. Navigate, type, select, submit, recover, sign out/re-enter when
applicable, refresh/resume, and reach the meaningful persisted terminal only through user-visible
controls. Validate every required populated, pending, validation, denied, error, recovery, and result
state across the declared responsive owners; do not rerun the blind aesthetic review inside UAT.

Evidence includes the final quality receipt, scenario/fixture identity, sanitized interaction trace,
screenshots, console/network failures, persisted outcome, and exact FE/BE/runtime/source fingerprints.
The result is typed `PASS`, `FAIL`, or `BLOCKED`. UAT never writes product source. Canonical PASS
returns to frontend completion. Fresh frontend-owned counterevidence may return one single-use typed
handoff to the exact `reapply` resume state; the frontend caller—not UAT—reruns
capture/preflight, blind review, Quality, and UAT. Replayed/unchanged findings, boundary drift, or a
non-frontend owner return their exact typed exit.
