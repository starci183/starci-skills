# Analyze starci-frontend-design-delivery input

Input analysis runs before any operator or Qdrant retrieval. Validate the closed invocation, then perform these checks:

1. Classify journey/layout, block, maintenance, learning resolution or cross-surface reconciliation.
2. Resolve the complete page set, customer-journey boundary, source-contract artifact and grammar lock.
3. Identify which creative decisions require approval and which source paths may be changed.

Also reject an unknown mode, stale or missing authority/evidence identity, ambiguous target, write root outside scope, external mutation without an approval boundary, or option outside the closed schema.

## Modes

| Mode | Meaning | First state |
| --- | --- | --- |
| `layout` | new page or journey | `preflight` |
| `block` | component-impact block | `block-reconcile` |
| `feedback` | approved source-first maintenance | `maintenance-apply` |
| `learning` | resolve queued design learning | `learning-resolve` |
| `reconcile` | closed-set cross-surface consistency | `surface-audit` |

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `brainstorm` | `default` / `multi-direction` | Default direction depth or explicit brainstorm. |

Analysis emits only the normalized scope, classification facts and first state. It does not copy operator knowledge into skill context.
