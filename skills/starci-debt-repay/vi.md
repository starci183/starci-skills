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

## PIPELINE

Topology: `reconciliation`.

| Bước | Nhánh | Đầu vào | Cách thực hiện | Đầu ra bắt buộc | Điều kiện kiểm tra |
|---|---|---|---|---|---|
| ràng buộc | dùng chung | debt record đã được owner duyệt và project/role đã verify | khóa scope, exit criteria, expiry và owning gates | debt work contract | debt đang active, explicit và đúng scope |
| đo | đối chiếu | debt contract và current source/gate state | đối chiếu từng recorded scope với measured evidence | progress và remaining-delta matrix | không scope nào được coi xanh từ prose |
| trả nợ | thực thi | delta matrix đã nhận | chỉ sửa debt-owned source và chạy owning gates | implementation và measured progress receipt | không tạo debt mới, gia hạn hay ghi ngoài scope |
| đóng | proof | fresh green evidence và debt record | chỉ bỏ scope có exit criteria pass | updated hoặc removed debt receipt | mọi scope bị bỏ có reproducible green proof |

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
