---
title: Trả nợ Source
---

# Trả nợ Source

## LOADS

| Alias | Target | Kind | Vì sao |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | contract execution, approval và reporting |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | verify route project/role trước target read |
| `@staleness` | `readiness/staleness/vi.md` | vi | route scope namespace về owner finding |
| `@stale-debts` | `readiness/staleness/debts/vi.md` | vi | authority, expiry và close semantics của debt |
| `@source-quality` | `scripts/check-source-quality.mjs` | script | validate debt và remeasure quality scope đã biết |

## NESTED SKILLS

Không có. Initialization, duyệt debt mới và provider setup là capability owner riêng.

## Boundary

Chỉ trả debt hiện có đã được owner duyệt. Không tạo debt, gia hạn, thêm scope hay đi qua repository khác.
Một run sở hữu một record project/role trừ khi owner gọi tên batch. Debt route chỉ là record; route stale
trả về initialization owner trước khi đọc product.

## Process

1. Verify route và validate `.worktrees/<project>/debts/<role>.md` bằng debt-only quality command.
2. Đọc từng scope namespace, baseline và exit criterion; route qua staleness registry.
3. Đo trước khi ghi, sửa nguyên nhân mà không làm yếu gate, rồi prove đúng criterion.
4. Cải thiện chưa đạt bar thì append progress có ngày. Chỉ bỏ scope sau proof; hết scope thì xoá Markdown.
5. Commit source và debt record riêng. Chỉ push khi request hiện tại cho phép rõ ràng.

## Stops

- Route absent, invalid hoặc stale → trả initialization owner; không đọc target source.
- Debt thiếu, invalid, expired hoặc chưa được owner duyệt → fail closed.
- Scope lạ → report namespace để owner route; không đoán.
- Thiếu credential → dùng hidden intake đúng OS; không xin/in value trong chat.
- Chỉ suppression mới mua được xanh → giữ debt mở.

## Output

Báo project/role, scope trước/sau, commit, metric và record còn hay đã xoá. Dùng `debt reduced`, `debt
repaid` hoặc `debt still open`; không gọi scope còn lại là pass.
