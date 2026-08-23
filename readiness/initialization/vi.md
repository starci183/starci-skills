---
title: Trạng thái sẵn sàng khởi tạo
---

# Registry khởi tạo

## LOADS

| Alias | Target | Kind | Vì sao |
|---|---|---|---|
| `@initialization-identity` | `readiness/initialization/identity/vi.md` | vi | machine decrypt readiness |
| `@initialization-bootstrap` | `readiness/initialization/bootstrap/vi.md` | vi | route agent entry |
| `@initialization-workspaces` | `readiness/initialization/workspaces/vi.md` | vi | ngôn ngữ Source và read route |
| `@initialization-worktrees` | `readiness/initialization/worktrees/vi.md` | vi | write root của project |

## Registry

Load `@initialization-identity`, `@initialization-bootstrap`, `@initialization-workspaces` và
`@initialization-worktrees` theo đúng thứ tự đó.

Khởi tạo gồm bốn module có boundary rõ ràng và chạy đúng thứ tự:

1. [identity](identity/vi.md) — chứng minh máy này giải mã được Source trước mọi setup dùng secret;
2. [bootstrap](bootstrap/vi.md) — route cả hai agent runtime vào trust tree;
3. [workspaces](workspaces/vi.md) — cài shared immutable pattern references, rồi ghi ngôn ngữ chung và mọi read route đã khai;
4. [worktrees](worktrees/vi.md) — cài write root durable và disposable.

Mỗi module sở hữu một verdict và một write surface, trình theo evidence, action và proof. Request init
trực tiếp cho phép action local có giới hạn đó. Chỉ hỏi khi hoàn tất đòi hỏi boundary external hoặc
destructive mà request chưa cấp. Identity đứng đầu vì Source đã có ciphertext nhưng dùng sai identity
thì không thể mint, rotate, publish hay expose credential một cách an toàn.
