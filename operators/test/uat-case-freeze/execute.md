# Execute `test/uat-case-freeze`

Freeze one mission-scoped Browser session lease before product execution. The account and Browser
context are reused across audit/repair/recapture rounds of this canonical mission. Reject a lease whose
origin, principal fingerprint, runtime generation, fixture namespace, or mission identity does not
match. Never accept raw credentials, cookies, or OTPs as lease data.

Freeze cases, fixtures, exact browser session, and fresh-account requirements before any UAT execution.

Perform only this job. Validate exact mission, parent-child, authority/source-head, and progress identity where present.
