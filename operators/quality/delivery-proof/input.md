# `quality/delivery-proof` input

- `context.contextRefs`: exact canonical references resolved by default repository or file search.
- `context.sourceRefs`: exact routed source files permitted for this job.
- `context.readinessReturnReceiptRef`: exact validated same-run readiness-inventory RETURN.
- `context.ruleBindingReturnReceiptRef`: exact validated same-run rule-binding-check RETURN.
- `input.project`: verified project identity.
- `input.objectiveRef`: exact bounded objective reference.
- `input.sourceFingerprint`: frozen fingerprint for supplied evidence.
- `input.debtPolicy`: exact `allowed` or verification-only `forbidden` policy.
- `input.origin`: exact registered final frontend visual PASS receipt, source, packet fingerprint, and audit references for `forbidden`; otherwise `null`.

The runtime Source resolves routes through `.claude/.workspaces`; project authority lives only in the verified backend Source under flat `.worktrees/<kind>`.
