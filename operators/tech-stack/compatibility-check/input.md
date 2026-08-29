# `tech-stack/compatibility-check` input

| Field | Owner | Meaning |
| --- | --- | --- |
| `context.stackModel` | Default search resolver | Exact stack-model artifact ref, revision, and content hash. |
| `context.compatibilityEvidence` | Default search resolver | Exact compatibility files and revisions. |
| `context.deploymentEvidence` | Default search resolver | Exact deployment files and revisions. |
| `input.project` | Caller | Project identity. |
| `input.objectiveRef` | Caller | Operational objective whose compatibility must be proved. |
| `input.expectedModelSha256` | Caller | Authorized stack-model hash. |
