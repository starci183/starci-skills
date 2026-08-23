---
title: Initialize Source · Vietnamese
---

# starci-init

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | hợp đồng báo cáo chung mà mọi skill đều đọc |
| `@initialization` | `platform/readiness/initialization/vi.md` | vi | các boundary identity-first và owner của từng init verdict |

## NESTED SKILLS

Không có. Skill này không tự gọi skill khác.

## PIPELINE

Topology: `reconciliation` qua bốn readiness boundary có thứ tự.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| định danh | execution | machine và encrypted Source identity declarations | reconcile SOPS/age identity mà không chạm target repositories | identity receipt | decrypt identity available và secret-safe |
| bootstrap | execution | identity receipt và agent bootstrap declarations | reconcile required local bootstrap state | bootstrap receipt | bootstrap reads/checks pass |
| route | reconciliation | workspace declarations, immutable source-reference catalog và observed project/role locations | cài/verify shared offline references rồi reconcile route records | workspace receipt | mọi source reference và requested role resolve chính xác |
| worktree-chứng minh | execution | verified routes và durable worktree declarations | reconcile project worktree state rồi đọc lại cả bốn boundary | readiness receipt | identity, bootstrap, route và worktree đều xanh |

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
3. **Workspaces** — hydrate `.workspaces/config.json`, `projects/**/*.json` và `ports/*.json` đã track vào
   `.workspaces/local/routes` bằng `workspace-portable.mjs`; sau đó plan và cài mọi immutable FE/BE pattern
   reference tại `.workspaces/local/references/<id>`, ghi generated route vào
   `.workspaces/local/pattern-references.json`. Verify mọi read route project/role đã khai với checkout thật.
   Reuse Git object cục bộ khi có, chỉ fetch đúng catalog commit khi thiếu. Allocation chỉ ở
   `.workspaces/ports/config.json` cùng một
   `.workspaces/ports/<project>.json`; init không copy ownership đó vào product. Với mỗi role, ghi
   `grammar` và `grammarProfile` cùng null hoặc thành cặp đã khai rõ, có grammar authority package/profile thật;
   không suy ra chúng từ identity.
   Khi operation được yêu cầu là chia sẻ hoặc refresh topology, chạy `workspace-portable.mjs export --plan`,
   trình exact candidate, rồi chỉ apply `.workspaces/config.json`, `.workspaces/projects/**/*.json` và
   `.workspaces/ports/*.json`. Loại `.workspaces/local`, `.sessions`, `.worktrees`, absolute path, observed head,
   timestamp và field/value giống credential. Request đã nói rõ commit/push cấp quyền đúng portable boundary đó;
   nếu không, publication ra ngoài vẫn là approval riêng.
4. **Worktrees** — verify `businesses` và `debts` bằng account worktree/path policy của Git, đồng thời verify
   `.sessions/<project>` đã ignore. Chỉ tạo/reuse durable branch; không tạo design registry hay cache dưới
   `.worktrees`.

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
- Portable candidate chứa machine-local, generated, observed-head, timestamp hoặc credential material.
- Pattern reference thiếu quay về skill này; downstream pattern compiler không được tự cài.
- Git owner lạ hoặc business-authority branch collision.
- Yêu cầu sửa product repository; init chỉ mô tả target và sở hữu Source-local state.
