# Analyze starci-conversation-provenance input

Input analysis runs before any operator or Qdrant retrieval. Validate the closed invocation, then perform these checks:

1. Classify immutable record versus provenance query.
2. Resolve provider-neutral conversation identity and redacted snapshot/evidence references.
3. Reject raw transcript payloads, secrets or a query with no bounded provenance target.

Also reject an unknown mode, stale or missing authority/evidence identity, ambiguous target, write root outside scope, external mutation without an approval boundary, or option outside the closed schema.

## Modes

| Mode | Meaning | First state |
| --- | --- | --- |
| `record` | append immutable snapshot head | `record` |
| `query` | read provenance index | `query` |

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| — | — | No additional option is loaded. |

Analysis emits only the normalized scope, classification facts and first state. It does not copy operator knowledge into skill context.
