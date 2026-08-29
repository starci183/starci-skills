# `platform/tunnel-apply` output

- `output.outcome`: `proved` or `blocked`.
- `output.receiptRef`: fresh convergence proof only when proved.
- `output.mutations`: every applied effect with resource and before/after revisions.
- `output.checks`: exactly DNS target, tunnel route, TLS, and public HTTPS.
- `output.reason`: one bounded blocker, otherwise null.
- `output.evidenceRefs`: approval, execution, revision, and proof evidence.

The Skill machine owns routing and the runtime owns terminal cleanup.
