# Platform Sonar

| Field | Value |
| --- | --- |
| Knowledge ID | `platform.sonar` |
| Operators | `sonar-service-reconcile` |
| Search tags | `sonarqube, project, quality-profile, quality-gate, enforcement` |
| Dependencies | `workspace.routing` |

## Record

Reconcile only the declared Sonar service, project set, quality profiles, quality gates, and enforcement settings. Bind exact provider revisions, opaque credential custody, and approval for the plan hash. Explicit project associations are authority because later/default settings may override earlier bindings. The coordinator alone mutates; an already-converged provider is a proved no-op.

Proof re-reads every declared association and enforcement setting after apply. Concurrent drift blocks before overwrite. Partial mutations report exact before/after revisions and remain eligible for bounded reconcile or rollback.

Primary reference: [SonarQube quality-gate associations](https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-gates/associating-projects-with-quality-gate).
