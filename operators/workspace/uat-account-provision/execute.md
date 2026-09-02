# Execute `workspace/uat-account-provision`

1. Resolve the exact ready runtime owner and verify its generation, origin, routed source, and source
   fingerprint. `input.accountRecordRef` is a prospective target: its snapshot and fragment are expected
   to be absent before provisioning. Never stop, stat, read, or require that target to exist at this step.
2. Run the canonical provisioner from the Source root:
   `node .claude/scripts/uat-account-provision-local.mjs --input <validated-input.json> --provisioning-owner-ref <control-panel-ref>`.
   It derives one run-scoped learner, reads credentials only from environment values or secret-file
   pointers, creates an `is_uat=true` Keycloak identity plus its application-database user, verifies both,
   and emits a non-secret `ready-for-browser-auth` packet. Do not reproduce the provisioner with ad hoc
   SQL, Keycloak commands, or a feature-task script.
3. Use the returned synthetic login identifier and opaque credential ref inside Control Panel custody to
   authenticate one isolated broker Browser context. Do not return, log, or persist the resolved password,
   access token, refresh token, OTP, cookie, or Browser storage.
4. After authenticated product identity is proven, append `state: authenticated` to the account candidate,
   write the opaque lease to the central lease registry, and return the final non-secret account record.
   The later `test/uat-snapshot-freeze` step creates the snapshot and copies that record into
   `snapshot.json#account`.

Never ask the user to sign in, use a personal account, write credentials under `.worktrees/uat`, mutate a
product commitment, or click a payment continuation action. If either store, runtime binding, or broker
authentication cannot be proven, return `blocked`; clean up only records bearing the exact run namespace
and `is_uat=true`.
