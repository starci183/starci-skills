# Deployment lifecycle

| Field | Value |
| --- | --- |
| Knowledge ID | `deployment.lifecycle` |
| Operators | `intent-bind, manifest-validate, execution-plan, execution-root-init, credential-resolve, host-prepare, artifact-build, artifact-publish, migration, domain-reconcile, rollout, monitor, recover, rollback, proof` |
| Search tags | `deployment, manifest, infra, credential, host, artifact, migration, domain, rollout, monitor, rollback` |
| Dependencies | `workspace.routing, quality.source-gates` |

## Record

`.stacks` declares durable product-owned deployment intent, `.infra/<environment>` holds ignored rebuildable execution state, and platform knowledge supplies law. Target project, role, environment, topology, host, artifact, domain owner/driver, workflow, probes, credentials-by-reference, and rollback identity are explicit; siblings provide precedent but never ownership.

Verification precedes immutable build/publication and rollout. Credentials are resolved by name through existing custody and values never enter schema, plan, chat, logs, or arguments. Apply migration, domain/TLS, runtime rollout, and monitoring as separate receipts. A deployment completes only after remote identity and public probes remain green for the declared steady window. Recover the smallest owned boundary; destructive loss, rotation, or a new host/domain/tenant/project returns to approval, and rollback preserves declared data boundaries.
