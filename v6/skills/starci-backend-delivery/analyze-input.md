# Analyze starci-backend-delivery input

Input analysis runs before any operator or Qdrant retrieval. Validate the closed invocation, then perform these checks:

1. Classify fresh delivery versus an already approved in-boundary repair.
2. Resolve business authority, target module, permitted write roots and evidence freshness.
3. Choose architecture depth and deployment handoff explicitly; never infer either from prose.

Also reject an unknown mode, stale or missing authority/evidence identity, ambiguous target, write root outside scope, external mutation without an approval boundary, or option outside the closed schema.

## Modes

| Mode | Meaning | First state |
| --- | --- | --- |
| `deliver` | plan and deliver backend source | `route` |
| `repair` | resume approved in-boundary repair | `implement` |

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `architectureMode` | `auto` / `required` / `skip` | Whether hard architecture analysis is required. |
| `deploymentMode` | `none` / `handoff` | Stop after source proof or hand off to deployment. |

Analysis emits only the normalized scope, classification facts and first state. It does not copy operator knowledge into skill context.
