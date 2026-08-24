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

Treat every effect as compare-and-set against the frozen release, target, and observed revision. A matching desired state is a proved idempotent no-op. A different release appearing during execution is concurrent drift: stop and replan; never recover or roll it back as if it belonged to this run. Monitoring distinguishes `progressing` from failure, uses a bounded deadline and backoff, and never converts one transient probe into recovery. Steady means the immutable digest is active, all declared targets are available, no superseded target remains active unless the strategy permits it, and public/runtime probes pass for the whole steady window.

Recovery may repeat only approved reversible actions and must preserve the same release identity. Exhaustion, an unsafe action, a changed boundary, or an unavailable rollback identity routes to approval, rollback, or blocked. Rollback is valid only when its exact safe release still exists, the current data/schema state remains compatible, and every provider/runtime mutation has a before/after revision. A rolled-back release is a distinct terminal outcome; it must never be reported as successful delivery of the rejected release.

Primary reference: [Kubernetes Deployments—status, progress deadlines, pause/resume, and rollback](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/).
