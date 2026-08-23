---
title: StarCi conversation record
---

# starci-conversation-record

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | shared reporting and approval boundary |
| `@workspaces` | `knowledge/contexts/workspaces/en.md` | en | resolve the named project before provider or artifact reads |
| `@worktrees` | `knowledge/contexts/worktrees/en.md` | en | verify durable business-registry ownership and session/generated-state placement |
| `@conversations` | `knowledge/contexts/conversations/en.md` | en | provider-neutral identity, custody, redaction and artifact-link law |
| `@snapshot-schema` | `knowledge/contexts/conversations/conversation-snapshot.schema.json` | file | validate one immutable provenance snapshot |
| `@registry-schema` | `knowledge/contexts/conversations/conversation-registry.schema.json` | file | validate current conversation heads |
| `@record` | `scripts/record-conversation-snapshot.mjs` | script | hash and append one approved snapshot |
| `@check` | `scripts/check-conversation-registry.mjs` | script | prove hashes, ancestry and plaintext refusal |

## NESTED SKILLS

None.

## PIPELINE

Topology: `linear`.

| Step | Track | Input | Transform | Required output | Gate |
|---|---|---|---|---|---|
| bind | shared | provider conversation reference and target artifact identity | resolve project, role, provider and allowed provenance scope | provenance context | no raw transcript is treated as authority |
| sanitize | execution | provider metadata and content snapshot | redact secrets and separate rebuildable search data from durable provenance | sanitized immutable snapshot | forbidden keys and secret-shaped values are absent |
| link | execution | sanitized snapshot and exact artifact hashes/paths | create provider-neutral provenance links and advance one stable head | snapshot head and artifact links | hashes, predecessor and ownership validate |
| prove | proof | stored records | read back and validate redaction, encryption and linkage | provenance receipt | raw transcript is not committed and links resolve |

## Run

This skill records provenance, not authority. Frontend design session evidence is transient; durable FE provenance binds
implemented source commits and paths. BE capability/operation authority remains separately owned.

### 1 — Resolve scope

Require project, stable `conversationId`, provider and surface. `Touching` is the conversation registry below
the durable `businesses` worktree plus ignored session/generated state; an encrypted external write is a separate displayed boundary.

### 2 — Acquire evidence explicitly

Use provider/thread access only when the owner requested it, or read a supplied export. Never scrape a
signed-in browser silently. If history is unavailable, record only evidence actually supplied.

### 3 — Separate custody

Raw transcript custody is provider-held, cache-only by digest, or encrypted-external by stable ciphertext
reference and digest. Plaintext transcripts, prompts, completions, tool output, credentials and signed URLs
never enter Git.

### 4 — Build the snapshot

Write provider-neutral metadata, redacted summary, transcript custody and decision links. Every decision
names role, artifact kind, stable identity, exact hash, message ids and reason. An advancing snapshot's
`previousHash` equals the current head.

### 5 — Validate and present

Validate the snapshot, run the recorder without `--apply`, and display hash, custody and links. Ask once
before a durable registry write or external encrypted upload. `OK` approves only those boundaries.

### 6 — Record and prove

After approval apply the recorder, validate the registry, run the checker and commit only the immutable
object and updated head. Search SQLite/vector state stays under `.workspaces/local/state/conversations`.

## Stops

- Provider evidence unavailable and no export/reference supplied.
- Raw transcript or secret-shaped content would enter the registry.
- Registry dirty, unlocked, wrong-branch or foreign-owned.
- `previousHash` differs from current head.
- Artifact link lacks exact identity, hash or message id.
- Durable raw transcript requested without encrypted destination.

## OUTPUT

State conversation identity, provider/surface, snapshot hash, custody, artifact links, registry commit and
checker proof. Never print transcript content or credential-bearing tool output.
