---
title: Initialize Source · Vietnamese
---

# starci-init

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | hợp đồng báo cáo chung mà mọi skill đều đọc |
| `@initialization` | `readiness/initialization/vi.md` | vi | các boundary identity-first và owner của từng init verdict |

## NESTED SKILLS

Không có. Skill này không tự gọi skill khác.

## Cách chạy

Đọc `@skill-shape`, rồi `@initialization`. Từ đó, load bốn runtime context module theo đúng thứ tự
registry: `identity`, `bootstrap`, `workspaces`, `worktrees`; không load `en.md` hoặc `vi.md` dành cho người đọc.

Project và role phải do user khai; boundary cần chúng sẽ dừng thay vì suy ra. Resolve từng module liên
quan theo **evidence → action → proof**. Đo identity trước mọi boundary phía sau vì setup dùng credential
không an toàn trước khi chứng minh identity. Boundary đã ready là `reuse` và không tạo write. Chạy các
local action đã yêu cầu theo thứ tự registry:

1. **Identity** — chạy `node .claude/scripts/init-identity.mjs --source <Source> --plan`; báo `ready`, cần
   import identity gốc, có thể generate identity đầu tiên, hay `blocked`. Không hiển thị private material.
2. **Bootstrap** — chứng minh trust entry tồn tại; phân loại và trình toàn bộ before/after của `AGENTS.md`
   cùng `CLAUDE.md`.
3. **Workspaces** — verify ngôn ngữ chung, family offset/application slot bền và mọi read route
   project/role đã khai với checkout thật. Allocation chỉ ở `.workspace/ports/config.json` cùng một
   `.workspace/ports/<project>.json`; init không copy ownership đó vào product. Với mỗi role, ghi
   `grammar` và `grammarProfile` cùng null hoặc thành cặp đã khai rõ, có compiler package/profile thật;
   không suy ra chúng từ identity.
4. **Worktrees** — verify design registry, business authority và cache root của project bằng account
   worktree của Git cùng path policy. Tạo hoặc reuse `businesses` độc lập trên
   `codex/businesses/<project>`; không đặt nó trong design-registry worktree hay cache dùng một lần.

Nêu evidence và action chính xác của từng boundary trước khi đổi. Chỉ thị init trực tiếp đã nêu Source và
Project cần thiết cho phép các local write có giới hạn này; không thêm approval stop chung. Chỉ hỏi nếu
hoàn tất cần action external hoặc destructive mà request chưa cấp. Request không cho phép sửa target,
publish secret, network hay external service.

Sau từng action, chạy proof của module đó trước khi sang module tiếp. Branch local-only được báo đúng như
vậy, không gọi là missing. Đóng bằng các root và effect chính xác, ngắn gọn; không đóng khi còn action đã
yêu cầu hoặc proof của nó.

## Điểm dừng

- Trust entry vắng, bootstrap chứa nội dung owner, hoặc link chỉ resolve nếu dùng path tuyệt đối.
- Đã có ciphertext nhưng không có identity gốc, hoặc identity không decrypt được sample.
- Project/role cần cho boundary chưa được owner khai.
- Route stale không được repoint âm thầm; phải trình replacement.
- Git owner lạ, legacy registry dirty, hoặc registry branch collision.
- Yêu cầu sửa product repository; init chỉ mô tả target và sở hữu Source-local state.
