# Source provenance

| Field | Value |
| --- | --- |
| Knowledge ID | `source.provenance` |
| Operators | `conversation-record, conversation-query` |
| Search tags | `conversation, provenance, snapshot, artifact, query, secret` |
| Dependencies | `workspace.routing` |

## Record

Conversation provenance records provider-neutral immutable snapshot heads and artifact links, never raw transcripts or secrets in Git. Recording and querying are separate operators. Search caches are rebuildable; durable records bind provider, conversation identity, snapshot hash, project/role, source revision, artifact references, and redaction proof.

The recorder accepts only an already-redacted snapshot artifact plus a redaction receipt whose policy version, input hash, output hash, scanner version, and prohibited-category result are explicit. It never loads or persists the raw transcript, prompts, chain-of-thought, credentials, tokens, personal data without declared necessity, or provider response bodies. The durable head contains identities, hashes, timestamps, project/role scope, artifact refs, and predecessor hash only. Publish by compare-and-set: the same identity/hash is an idempotent no-op; the same identity with another hash is a conflict, never an overwrite.

The query operator loads only bounded index metadata for one project/role and returns authorized head/artifact refs with revisions, not transcript bodies. Empty, forbidden, stale-index, and ambiguous-identity outcomes are distinct. A search index may be rebuilt from heads, but query results must be rebound to the current durable head hash before return. Terminal cleanup removes query text, matches, worker observations, and receipts from task-session memory.

Primary privacy reference: [OpenTelemetry data minimization and redaction guidance](https://opentelemetry.io/docs/security/handling-sensitive-data/).
