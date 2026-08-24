# Analyze starci-business-authority input

Input analysis runs before any operator or Qdrant retrieval. Validate the closed invocation, then perform these checks:

1. Classify model refresh versus delivered-source reconciliation.
2. Resolve the feature head, lifecycle state and immutable product evidence references.
3. Detect whether a new approved business revision is required before downstream planning.

Also reject an unknown mode, stale or missing authority/evidence identity, ambiguous target, write root outside scope, external mutation without an approval boundary, or option outside the closed schema.

## Modes

| Mode | Meaning | First state |
| --- | --- | --- |
| `refresh` | refresh and publish model | `route` |
| `reconcile` | reconcile delivered source | `route-reconcile` |

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |

Analysis emits only the normalized scope, classification facts and first state. It does not copy operator knowledge into skill context.
