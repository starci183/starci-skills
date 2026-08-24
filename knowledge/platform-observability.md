# Platform observability

| Field | Value |
| --- | --- |
| Knowledge ID | `platform.observability` |
| Operators | `observability-reconcile` |
| Search tags | `prometheus, grafana, cadvisor, remote-write, metrics, redaction` |
| Dependencies | `workspace.routing` |

## Record

Reconcile only the declared metrics collectors, scrape targets, dashboards, and remote-write destination. Bind exact config/resource revisions, opaque credential custody, and approval for the plan hash. The coordinator alone mutates; an already-converged stack is a proved no-op.

Proof checks required service health, bounded target and label exposure, remote-write delivery, ordered samples, retry/backoff behavior, and sensitive-data filtering. A green dashboard alone is insufficient. Partial changes report exact before/after revisions and route to bounded reconcile or rollback.

Primary references: [Prometheus Remote Write retries and ordering](https://prometheus.io/docs/specs/prw/remote_write_spec/) and [OpenTelemetry sensitive-data handling](https://opentelemetry.io/docs/security/handling-sensitive-data/).
