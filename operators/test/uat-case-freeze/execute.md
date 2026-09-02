# Execute `test/uat-case-freeze`

Freeze one mission-scoped Browser session lease before product execution. The account and Browser
context are reused across audit/repair/recapture rounds of this canonical mission. Reject a lease whose
origin, principal fingerprint, runtime generation, fixture namespace, or mission identity does not
match. Never accept raw credentials, cookies, or OTPs as lease data.

Require `accountRecordRef` to point at the current canonical `snapshot.json#account`, require opaque
evidence for both the Keycloak and application-database records, and require
`credentialCustody=control-panel-ephemeral`. A signed-out page is not a user-action branch; reject it as
an unavailable authenticated lease.

For a project-bound runtime, validate the exact ready owner artifact and require the lease project,
application, generation, owner identity, endpoint-authority fingerprint, and origin to match it. The
owner endpoints must resolve from canonical workspace routes, port registry, and backend metadata;
an arbitrary localhost origin is not trusted. Reject a non-authenticated, expired, foreign-mission,
or foreign-account lease before freezing cases.

Freeze cases, fixtures, exact browser session, and fresh-account requirements before any UAT execution.

Perform only this job. Validate exact mission, parent-child, authority/source-head, and progress identity where present.
