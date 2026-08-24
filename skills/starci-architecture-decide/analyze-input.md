# Analyze starci-architecture-decide input

Input analysis runs before any operator or Qdrant retrieval. Validate the closed invocation, then perform these checks:

1. Decide whether the request is a genuinely difficult cross-system choice or ordinary known-shape work.
2. Resolve the decision question, constraints, current-state evidence and systems inside the boundary.
3. Use skip only when no material alternative or irreversible tradeoff needs analysis.

Also reject an unknown mode, stale or missing authority/evidence identity, ambiguous target, write root outside scope, external mutation without an approval boundary, or option outside the closed schema.

## Modes

| Mode | Meaning | First state |
| --- | --- | --- |
| `analyze` | run architecture analysis | `route` |
| `skip` | ordinary known-shape work | `not-needed` |

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |

Analysis emits only the normalized scope, classification facts and first state. It does not copy operator knowledge into skill context.
