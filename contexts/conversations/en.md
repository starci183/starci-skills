---
title: Conversation provenance
---

# Conversation provenance

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@registry-schema` | `contexts/conversations/conversation-registry.schema.json` | file | validate stable conversation heads and immutable object references |
| `@snapshot-schema` | `contexts/conversations/conversation-snapshot.schema.json` | file | validate one provider-neutral, redacted provenance snapshot |
| `@conversation-check` | `scripts/check-conversation-registry.mjs` | script | prove hashes, head identity, ancestry and plaintext refusal |

## Record

Conversation provenance explains which OpenAI, Codex, ChatGPT, Anthropic or Claude exchange produced an
accepted frontend or backend decision. It is not a second design/backend authority and it is not a raw-chat
archive in Git.

Stable `conversationId` points to one immutable metadata `snapshotHash`. A new message or decision creates a
new snapshot whose `previousHash` points backward. FE and BE artifacts cite the exact snapshot that informed
them, never a mutable provider thread head.

## Law

Provider vocabulary is metadata, not structure. Every provider uses the same snapshot shape; `provider` and
`surface` state where the exchange occurred. Raw messages, prompts, completions and tool output never enter
the durable registry. They remain at the provider, in one ignored session, or in an encrypted external object.

The registry stores only a redacted summary, message identities, provider reference, transcript custody and
artifact decision links. Cross-session search databases and embeddings are generated under
`.workspaces/local/state/conversations`; deleting them loses time, not authority.

## Situations

| Code | Situation | Required shape |
|---|---|---|
| `CONVERSATION-1` | One exchange must be found again | stable `conversationId` and provider-neutral head |
| `CONVERSATION-2` | The exchange gains messages or decisions | immutable snapshot with `previousHash`; old object untouched |
| `CONVERSATION-3` | Raw transcript must be retained | provider reference, cache-only digest, or encrypted external reference; never plaintext Git |
| `CONVERSATION-4` | A chat informed product authority | exact artifact identity, artifact hash and message ids |
| `CONVERSATION-5` | People need full-text or semantic lookup | rebuildable SQLite/vector projection in generated local state |
| `CONVERSATION-6` | Content may carry credentials or private data | redact before summary; reject secret-shaped keys and signed URLs |
| `CONVERSATION-7` | Provider history is requested | read only through explicit owner-authorized access or supplied export; never infer or scrape silently |

## Placement

Durable metadata lives below `<Source>/.worktrees/<project>/businesses/conversations` on the existing business-authority branch.
Immutable snapshot objects live below `objects/sha256`; `conversation-registry-v1.json` owns current heads.
Decrypted transcripts, SQLite indexes and vectors live below `<Source>/.sessions/<project>/<session-id>/conversations`.

An external ciphertext reference must be stable and must not contain a query string, temporary signature,
credential or bearer value. Encryption credentials remain under the Source credential authority, never in
conversation metadata.

## Rules

1. Conversation lookup identity is `conversationId`; provider thread ids are metadata.
2. Snapshot bodies are immutable and content-addressed.
3. Artifact provenance binds a specific snapshot hash and specific message ids.
4. No raw `messages`, `content`, `prompt`, `completion`, token, authorization or secret keys enter Git.
5. Redacted summaries contain no credential or private tool output.
6. Search projections are generated local state and can be rebuilt.
7. Recording provider history requires explicit access; absence is reported, never fabricated.
8. Conversation provenance never turns cached frontend previews into authority or advances BE capability/operation heads.

## Output

```text
conversation: <conversationId>
provider: <provider>/<surface>
snapshot: <sha256>
transcript: <provider | cache-only | encrypted-external>
links: <artifact identities and hashes>
proof: <registry checker result>
```

## Stops

- Raw transcript or secret-bearing material would enter the registry.
- Provider history is unavailable and no export was supplied.
- A referenced artifact hash or previous snapshot is malformed or absent.
- The registry worktree is dirty, unlocked or foreign-owned.
