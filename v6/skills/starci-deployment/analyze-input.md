# Analyze starci-deployment input

Input analysis runs before any operator or Qdrant retrieval. Validate the closed invocation, then perform these checks:

1. Classify adopt, deploy, monitor, recover or rollback against one immutable release identity.
2. Resolve environment, manifest, artifact, provider/runtime evidence and public endpoint targets.
3. Flag new external resources, destructive changes, credential rotation or undeclared rollback for approval.

Also reject an unknown mode, stale or missing authority/evidence identity, ambiguous target, write root outside scope, external mutation without an approval boundary, or option outside the closed schema.

## Modes

| Mode | Meaning | First state |
| --- | --- | --- |
| `adopt` | adopt missing deployment intent | `route` |
| `deploy` | execute declared release | `route` |
| `monitor` | observe existing rollout | `monitor` |
| `recover` | repair observed failure | `recover` |
| `rollback` | restore declared rollback identity | `rollback` |

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `reconcileBusiness` | `boolean` | Reconcile delivery proof into the business head. |

Analysis emits only the normalized scope, classification facts and first state. It does not copy operator knowledge into skill context.
