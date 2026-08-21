---
name: starci-conversation-record
description: Record or query provider-neutral OpenAI/ChatGPT/Codex and Anthropic/Claude conversation provenance for FE/BE artifacts without committing raw transcripts or secrets. Uses immutable snapshot heads in the project registry and rebuildable search cache.
---

# starci-conversation-record

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared reporting and approval boundary |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve the named project before provider or artifact reads |
| `@worktrees` | `contexts/worktrees/context.md` | context | verify durable registry ownership and cache placement |
| `@conversations` | `contexts/conversations/context.md` | context | provider-neutral identity, custody, redaction and artifact-link law |
| `@snapshot-schema` | `contexts/conversations/conversation-snapshot.schema.json` | file | validate one immutable provenance snapshot |
| `@registry-schema` | `contexts/conversations/conversation-registry.schema.json` | file | validate current conversation heads |
| `@record` | `scripts/record-conversation-snapshot.mjs` | script | hash and append one approved snapshot |
| `@check` | `scripts/check-conversation-registry.mjs` | script | prove hashes, ancestry and plaintext refusal |

## NESTED SKILLS

None.

## Run

This skill records provenance, not authority. Frontend design cache is transient; durable FE provenance binds
implemented source commits and paths. BE capability/operation authority remains separately owned.

### 1 — Resolve scope

Require a project and a stable `conversationId`. Resolve provider and surface separately (`openai/codex`,
`openai/chatgpt`, `anthropic/claude-code`, etc.). `Touching` is the project's conversation registry and
ignored conversation cache; an encrypted external write is a separate displayed boundary.

### 2 — Acquire evidence explicitly

Use a provider connector/thread tool only when the owner requested that access and it is available, or read
a user-supplied export. Never scrape a signed-in browser silently. If history is unavailable, record only a
provider thread reference and redacted decision metadata that the current request actually supplies.

### 3 — Separate custody

Raw transcript choices are closed:

- provider-held reference;
- ignored `cache/conversations` with a digest;
- encrypted external object with a stable ciphertext reference and digest.

Plaintext transcript, prompts, completions, tool output, credentials and signed URLs never enter Git.

### 4 — Build the snapshot

Write provider-neutral metadata: stable identity, provider/surface, optional external thread id, exact
message count, redacted summary, transcript custody and decision links. Every decision names FE/BE role,
artifact kind, stable artifact identity, exact artifact hash, message ids and why those messages matter.
When advancing an existing conversation, `previousHash` must equal its current head.

### 5 — Validate and present

Validate against `@snapshot-schema`, run `@record` without `--apply`, and display the resulting snapshot
hash, custody mode and artifact links. Ask once before the durable registry write or any external encrypted
upload. `OK` approves only the displayed snapshot and boundaries.

### 6 — Record and prove

After approval run `@record --apply`, validate `conversation-registry-v1.json`, run `@check`, then commit
only the new immutable object, updated head and projections. Search SQLite/vector state remains cache and is
never committed.

## Stops

- Provider history is unavailable and no export/reference was supplied.
- Raw transcript or secret-shaped content would enter the registry.
- The registry is dirty, unlocked, wrong-branch or foreign-owned.
- `previousHash` does not equal the current stable head.
- An artifact link lacks an exact identity, hash or message id.
- Durable raw transcript was requested without an approved encrypted destination.

## OUTPUT

State `conversationId`, provider/surface, snapshot hash, custody, artifact links, registry commit and checker
proof. Never print transcript content or credential-bearing tool output.
