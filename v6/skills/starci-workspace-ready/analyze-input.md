# Analyze starci-workspace-ready input

Input analysis runs before any operator or Qdrant retrieval. Validate the closed invocation, then perform these checks:

1. Classify initialize, hydrate or single-route verification.
2. Resolve Source identity, declared routes and exact worktree target before filesystem work.
3. Reject undeclared absolute paths or a target outside the declared workspace boundary.

Also reject an unknown mode, stale or missing authority/evidence identity, ambiguous target, write root outside scope, external mutation without an approval boundary, or option outside the closed schema.

## Modes

| Mode | Meaning | First state |
| --- | --- | --- |
| `initialize` | full initialization | `identity` |
| `hydrate` | hydrate declared routes | `routes` |
| `verify` | verify one route only | `route` |

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |

Analysis emits only the normalized scope, classification facts and first state. It does not copy operator knowledge into skill context.
