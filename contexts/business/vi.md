---
title: Business authority
---

# Business authority

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@feature-schema` | `contexts/business/schema.json` | file | từ chối business claim không được hỗ trợ hoặc truy vết |
| `@registry-schema` | `contexts/business/registry.schema.json` | file | validate stable feature head và immutable object |
| `@business-registry` | `scripts/business-registry.mjs` | script | validate, hash, publish và check business snapshot |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove exact head cấp quyền hoặc chặn source write |

## Record

Business root là authority duy nhất của product truth dùng chung cho frontend, backend, design và mọi
repo đã route. Nó ghi cả truth đã implement gần nhất lẫn intent được owner duyệt rõ ràng. Product source
chứng minh implementation; nó không được âm thầm tự định nghĩa product truth khác.

## Law

Mỗi project sở hữu `<Source>/.worktrees/<project>/businesses`, linked worktree đã lock trên
`codex/businesses/<project>`. Stable `featureId` head trỏ tới immutable SHA-256 object. Mỗi feature hiện
hành còn publish `model.json` cho máy, `CONTEXT.md` gọn, Markdown module route theo task, aggregate
`spec.md` và `evidence.json`.

Mọi claim ảnh hưởng flow, rule, state, API, surface hoặc acceptance phải cite ít nhất một evidence row
đã bind vào role được route và exact source head. Thiếu evidence trở thành `unknown`, không trở thành
representative content. Target dirty chỉ được phép khi mọi dirty path nằm ngoài cited evidence boundary
và snapshot bind committed `HEAD`, không bind working-tree bytes.

Authority schema-v2 có đúng bốn state. `pending` là intent đã duyệt nhưng chưa mở implementation.
`in-progress` là exact intent hiện được phép sửa source. `implemented` là truth đã reconcile với final
committed source heads. `rejected` là lịch sử quyết định bị loại và tuyệt đối không cấp quyền sửa source.
`baseHead` trỏ tới implemented truth gần nhất; `previousHead` chứng minh transition liền trước. Head
schema-v1 cũ được đọc là `implemented`.

Các transition product-intent hợp lệ là `implemented → pending → in-progress → implemented`, có nhánh
`pending|in-progress → rejected` và `rejected → pending`. Transition reconcile kỹ thuật đóng
`implemented → implemented` cũng hợp lệ chỉ khi `basis: reconciled`, `previousHead` và `baseHead`
đều trỏ đúng implemented head liền trước, source identity không đổi, và mọi business claim cùng
evidence identity/claim giữ nguyên byte sau khi loại source hash và line range evidence. Transition này
chỉ refresh committed source/evidence location, không biểu diễn intent. Product write ảnh hưởng business bắt buộc
feature head tương ứng ở `in-progress` trước write đầu tiên. Sau code và gates, feature phải reconcile
thành `implemented` với final committed source heads. Thay đổi thuần kỹ thuật khai
`businessImpact: none`, bind implemented head hiện tại và không tạo feature giả.

## Rules

1. `featureId` ổn định; SHA-256 head là version.
2. Business state là durable và versioned; preview pack sinh lại được vẫn ở session root.
3. FE/BE evidence đọc từ workspace route đã verify tại committed head.
4. Mọi claim không phải unknown cite evidence có trong cùng object.
5. Example import chỉ cho cấu trúc, không cho business fact.
6. `CONTEXT.md`, task module, `spec.md` và `evidence.json` là view sinh từ `model.json`; immutable object mới là authority.
7. LLM load `CONTEXT.md` trước, rồi chỉ load flow/surface module task cần.
8. Mọi repo đã route tin business head và đọc authority status trước khi hành động.
9. `pending` được dùng cho design/planning; chỉ `in-progress` cấp quyền write source ảnh hưởng business.
10. `rejected` không mô tả runtime truth và không bao giờ cấp quyền implementation.
11. Sáng tạo chạy trước trong intent đã duyệt, rồi principles review, source patterns, code và gates.
12. Update business riêng nó không cấp quyền sửa product source ngoài intent.

## Output

```text
business: <project>/<featureId>@<hash>
sources: <role@head ...>
surfaces: <surface ids>
unknowns: <count>
path: .worktrees/<project>/businesses/features/<featureId>/
```
