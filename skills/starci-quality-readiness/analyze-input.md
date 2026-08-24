# Analyze starci-quality-readiness input

Input analysis runs before any operator or Qdrant retrieval. Validate the closed invocation, then perform these checks:

1. Classify diagnosis, inventory, approved finding repair, debt repayment or rule-binding audit.
2. Resolve the measured finding/debt identity and the exact source boundary, if mutation is requested.
3. Route check-only work away from mutating operators and require approval before repair.

Also reject an unknown mode, stale or missing authority/evidence identity, ambiguous target, write root outside scope, external mutation without an approval boundary, or option outside the closed schema.

## Modes

| Mode | Meaning | First state |
| --- | --- | --- |
| `diagnose` | trace without mutation | `diagnose` |
| `inventory` | measure readiness | `inventory` |
| `repair` | repair an approved finding | `repair-approval` |
| `debt` | repay approved debt | `debt` |
| `bindings` | check rule accountability | `bindings` |

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |

Analysis emits only the normalized scope, classification facts and first state. It does not copy operator knowledge into skill context.
