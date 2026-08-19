---
title: Conversation provenance
---

# Conversation provenance

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@registry-schema` | `contexts/conversations/conversation-registry.schema.json` | file | validate stable conversation head và immutable object reference |
| `@snapshot-schema` | `contexts/conversations/conversation-snapshot.schema.json` | file | validate một provenance snapshot provider-neutral đã redact |
| `@conversation-check` | `scripts/check-conversation-registry.mjs` | script | chứng minh hash, head identity, ancestry và plaintext refusal |

## Record

Conversation provenance giải thích exchange OpenAI, Codex, ChatGPT, Anthropic hay Claude nào tạo ra một
quyết định frontend/backend đã accepted. Nó không phải authority thiết kế/backend thứ hai và không phải kho
raw chat trong Git.

`conversationId` ổn định trỏ tới một metadata `snapshotHash` immutable. Khi có message hay decision mới,
tạo snapshot mới với `previousHash` trỏ ngược. FE và BE artifact cite đúng snapshot đã ảnh hưởng tới nó,
không cite mutable provider thread head.

## Law

Provider chỉ là metadata. Mọi provider dùng cùng snapshot shape; `provider` và `surface` nói exchange diễn
ra ở đâu. Raw message, prompt, completion và tool output không vào durable registry. Chúng ở provider,
ignored local cache, hoặc encrypted external object.

Registry chỉ giữ redacted summary, message identities, provider reference, transcript custody và artifact
decision links. Search database và embedding là projection dưới `cache/conversations`; xóa chúng chỉ mất
thời gian dựng lại, không mất authority.

## Situations

| Code | Situation | Shape bắt buộc |
|---|---|---|
| `CONVERSATION-1` | Cần tìm lại một exchange | `conversationId` ổn định và provider-neutral head |
| `CONVERSATION-2` | Exchange có thêm message/decision | immutable snapshot với `previousHash`; không sửa object cũ |
| `CONVERSATION-3` | Cần giữ raw transcript | provider reference, cache-only digest, hoặc encrypted external reference; không plaintext Git |
| `CONVERSATION-4` | Chat ảnh hưởng product authority | exact artifact identity, artifact hash và message ids |
| `CONVERSATION-5` | Cần full-text/semantic search | SQLite/vector projection dựng lại được trong cache |
| `CONVERSATION-6` | Content có thể chứa credential/private data | redact trước summary; từ chối secret-shaped key và signed URL |
| `CONVERSATION-7` | Cần đọc provider history | chỉ đọc qua access owner đã cho phép hoặc export được cung cấp; không tự scrape |

## Placement

Metadata bền nằm dưới `<Source>/.worktrees/<project>/registries/conversations`. Immutable snapshot object
nằm dưới `conversations/objects/sha256`; `conversation-registry-v1.json` giữ current heads. Transcript đã
decrypt, SQLite index và vectors nằm dưới `<Source>/.worktrees/<project>/cache/conversations`.

External ciphertext reference phải ổn định, không chứa query string, temporary signature, credential hay
bearer value. Encryption credential ở Source credential authority, không ở conversation metadata.

## Rules

1. Lookup identity là `conversationId`; provider thread id chỉ là metadata.
2. Snapshot body immutable và content-addressed.
3. Artifact provenance bind exact snapshot hash và message ids.
4. Không raw `messages`, `content`, `prompt`, `completion`, token, authorization hay secret key trong Git.
5. Redacted summary không chứa credential/private tool output.
6. Search projection là cache, dựng lại được.
7. Ghi provider history cần explicit access; không có thì báo, không bịa.
8. Conversation provenance không advance FE layout/block head hay BE capability/operation head.

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

- Raw transcript hoặc material chứa secret sắp vào registry.
- Provider history không truy cập được và không có export.
- Referenced artifact hash hay previous snapshot malformed/missing.
- Registry worktree dirty, unlocked hoặc thuộc Git khác.
