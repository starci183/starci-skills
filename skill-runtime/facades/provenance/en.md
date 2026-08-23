# Provenance facade

## LOADS

None.

## Purpose

Give conversation-to-artifact provenance a narrow discovery surface instead of placing it under analysis, operations, or a catchall knowledge skill.

## Modes

| Mode | Physical skill | Discriminating intent |
|---|---|---|
| `conversation` | `starci-conversation-record` | record or query provider-neutral conversation snapshots and exact FE/BE artifact links |

## Input

Use the original request, routed project, provider-neutral conversation identity, artifact identity/hash, and requested record or query operation without secret values.

## Output

Return the mode and physical skill, selection reason, unresolved facts, and the unchanged invocation envelope.

## Permissions

The facade performs no snapshot, transcript, artifact, cache, secret, or registry write and transfers no approval.

## Stops

Stop when project or artifact identity is unresolved, the request would commit raw transcripts or secrets, conversation is being treated as product truth, or another capability owns the request.

## Authority boundary

The dispatcher starts `starci-conversation-record` separately. Its custody, redaction, encryption, immutable-head, and proof boundaries remain unchanged. The facade has no orchestration profile.
