# Source provenance

| Field | Value |
| --- | --- |
| Knowledge ID | `source.provenance` |
| Operators | `conversation-record, conversation-query` |
| Search tags | `conversation, provenance, snapshot, artifact, query, secret` |
| Dependencies | `workspace.routing` |

## Record

Conversation provenance records provider-neutral immutable snapshot heads and artifact links, never raw transcripts or secrets in Git. Recording and querying are separate operators. Search caches are rebuildable; durable records bind provider, conversation identity, snapshot hash, project/role, source revision, artifact references, and redaction proof.
