---
title: StarCi conversation record
---

# starci-conversation-record

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | reporting contract và approval boundary dùng chung |
| `@workspaces` | `knowledge/contexts/workspaces/vi.md` | vi | resolve project trước provider/artifact read |
| `@worktrees` | `knowledge/contexts/worktrees/vi.md` | vi | verify ownership business registry bền và placement của session/generated state |
| `@conversations` | `knowledge/contexts/conversations/vi.md` | vi | luật identity, custody, redaction và artifact link provider-neutral |
| `@snapshot-schema` | `knowledge/contexts/conversations/conversation-snapshot.schema.json` | file | validate một provenance snapshot immutable |
| `@registry-schema` | `knowledge/contexts/conversations/conversation-registry.schema.json` | file | validate current conversation heads |
| `@record` | `scripts/record-conversation-snapshot.mjs` | script | hash và append một snapshot đã duyệt |
| `@check` | `scripts/check-conversation-registry.mjs` | script | chứng minh hash, ancestry và plaintext refusal |

## NESTED SKILLS

Không có.

## PIPELINE

Topology: `linear`.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| ràng buộc | dùng chung | provider conversation reference và target artifact identity | resolve project, role, provider và allowed provenance scope | provenance context | raw transcript không được coi là authority |
| làm sạch | thực thi | provider metadata và content snapshot | redact secret, tách rebuildable search data khỏi durable provenance | sanitized immutable snapshot | không còn forbidden key hay secret-shaped value |
| liên kết | thực thi | sanitized snapshot và exact artifact hashes/paths | tạo provider-neutral provenance links và advance một stable head | snapshot head và artifact links | hash, predecessor và ownership hợp lệ |
| chứng minh | proof | stored records | đọc lại và validate redaction, encryption cùng linkage | provenance receipt | raw transcript không commit và links resolve |

## Run

Skill ghi provenance, không sở hữu authority. Frontend design session evidence là tạm thời; FE provenance bền bind
implemented source commit và path. BE capability/operation authority vẫn có owner riêng.

### 1 — Resolve scope

Bắt buộc project, `conversationId` ổn định, provider và surface. `Touching` là conversation registry dưới
durable `businesses` worktree cùng session/generated state bị ignore; encrypted external write là boundary riêng phải hiển thị.

### 2 — Acquire evidence explicitly

Chỉ dùng provider/thread access khi owner yêu cầu, hoặc đọc export được cung cấp. Không âm thầm scrape
signed-in browser. Không có history thì chỉ ghi evidence thực sự được cung cấp.

### 3 — Separate custody

Raw transcript chỉ có ba custody: provider-held, cache-only theo digest, hoặc encrypted-external theo stable
ciphertext reference và digest. Plaintext transcript, prompt, completion, tool output, credential và signed
URL không vào Git.

### 4 — Build the snapshot

Ghi metadata provider-neutral, summary đã redact, transcript custody và decision links. Mỗi decision gọi tên
role, artifact kind, stable identity, exact hash, message ids và reason. Snapshot advance phải có
`previousHash` bằng current head.

### 5 — Validate and present

Validate snapshot, chạy recorder không `--apply`, rồi hiển thị hash, custody và links. Hỏi một lần trước
durable registry write hay encrypted external upload. `OK` chỉ duyệt các boundary đó.

### 6 — Record and prove

Sau approval, apply recorder, validate registry, chạy checker và chỉ commit immutable object cùng updated
head. SQLite/vector search state ở `.workspaces/local/state/conversations`.

## Stops

- Provider evidence không truy cập được và không có export/reference.
- Raw transcript hoặc secret-shaped content sắp vào registry.
- Registry dirty, unlocked, sai branch hoặc thuộc Git khác.
- `previousHash` khác current head.
- Artifact link thiếu exact identity, hash hoặc message id.
- Durable raw transcript được yêu cầu nhưng chưa có encrypted destination.

## OUTPUT

Nêu conversation identity, provider/surface, snapshot hash, custody, artifact links, registry commit và
checker proof. Không in transcript content hay tool output chứa credential.
