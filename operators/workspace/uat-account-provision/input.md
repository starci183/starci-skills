# `workspace/uat-account-provision` input

- `context.authorityRefs`: exact UAT, runtime, and provisioning authority references.
- `context.runtimeOwnerRef`: exact ready centralized runtime-owner artifact.
- `context.sourceFingerprint`: frozen source fingerprint bound to the UAT run.
- `input.missionRef`: canonical mission identity owning the account and Browser lease.
- `input.project`: verified routed product project.
- `input.feature`: canonical UAT feature key.
- `input.flow`: canonical UAT flow key.
- `input.runId`: fresh run identity used to isolate the account and fixtures.
- `input.role`: learner role provisioned for this flow.
- `input.origin`: exact frontend origin from the ready runtime owner.
- `input.accountRecordRef`: prospective canonical `snapshot.json#account` fragment. The file and fragment
  must not be required to exist until the later snapshot-freeze step.
- `input.fixtureNamespace`: exact namespace applied to UAT-owned mutable records.

Raw credentials and personal account identifiers are invalid input.
