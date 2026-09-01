# Execute `test/uat-result-publish`

Publish canonical UAT authority only after all three independent proofs, with any failure dominating.

Perform only this job. Validate exact mission, parent-child, authority/source-head, and progress identity where present.
Write the exact `result.json` beside the validated frozen `snapshot.json`. Validate the result content
against the canonical schema, bind its `snapshotFingerprint` to the parsed sibling snapshot, and
return the parsed-content fingerprint. A generic artifact ref or missing file cannot publish PASS.
