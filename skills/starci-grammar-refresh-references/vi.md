---
title: starci-grammar-refresh-references · Vietnamese
---

# starci-grammar-refresh-references

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | execution và reporting boundary dùng chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | resolve đúng grammar/profile role project đã chọn |
| `@grammar` | `grammars` | module | durable grammar authority mà optional ref không được đổi |
| `@audit-references` | `skills/starci-grammar-refresh-references/scripts/audit-reference-sidecar.mjs` | script | verify identity và immutability của optional ref |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | chứng minh durable grammar authority vẫn nguyên byte và hợp lệ |

## NESTED SKILLS

Không có.

## Run

Resolve role project đã khai cùng cặp grammar/profile rõ ràng. Snapshot mọi durable grammar artifact, audit
optional sidecar rồi sửa stale immutable ref ngay trong cùng lượt. Sidecar vắng mặt là kết quả `none` hợp lệ.
Chỉ nhận `git+https://...@<40-char-commit>:<path>`. So replacement với invariant và counterexample của capsule,
chỉ update provenance, chạy lại hai audit và chứng minh mọi durable hash không đổi.

## Stops

- Route không chọn grammar/profile tồn tại.
- Ref mutable, không truy cập được hoặc khác behavior.
- Bất kỳ fact, rule, profile, capsule, ruling, case hay template nào đổi.

## Output

Nêu grammar/profile, ref đã refresh hoặc bỏ, immutable replacement và proof bằng văn xuôi ngắn. Không dùng bảng trạng thái.
