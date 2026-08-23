---
title: Composition evidence
---

# Composition evidence

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@schema` | `knowledge/brainstorms/composition/schema.json` | file | validate baseline bốn lock và owner tree |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | từ chối scope thiếu, parent sai và proof coverage thiếu |

## Record

Module này chạy trước grammar hoặc principles. Nó biến request, screenshot, legacy page và current source thành bốn lock: `Scope`, `Owner`, `Invariant`, `Proof`. Nó không emit class, component hay visual treatment.

## Law

Reference là specification trong scope owner đã gọi tên. Một vùng highlight đề xuất một parent chứa mọi child được gọi tên hoặc nằm trong vùng cho tới khi source evidence chứng minh nested owner. Current DOM là evidence, không phải quyền phủ quyết: nếu DOM chỉ bọc một phần relationship được highlight thì parent đang sai và phải sửa trước khi resolve gap, flow, padding hoặc alignment.

Content có legacy backing ngoài target mặc định được giữ nguyên. Example chỉ chứng minh situation nó minh họa; nó không tự promote thành family invariant.

## Reading evidence

1. Lock một page hoặc flow start-to-end rõ ràng.
2. Ghi mọi reference viewport và state.
3. Gọi tên target owner, direct children và nested owners.
4. Bind screenshot annotation với owner/child identity; vùng màu phải phủ cùng direct-child set mà owner khai.
5. Tách preserved nodes khỏi allowed deltas; hai set không overlap.
6. Viết invariant bằng semantic language, không bằng literal example value.
7. Bắt buộc full-viewport và target-region proof ở mọi viewport/state tham chiếu.

## Rules

1. Grammar và principles không chạy khi một trong bốn lock còn unresolved.
2. Screenshot một page không mở rộng sang page khác; flow rõ ràng chứa mọi page đã gọi tên.
3. Vùng highlight là parent evidence, không phải decoration hint.
4. Legacy composition, hierarchy, visual owner và interaction giữ nguyên ngoài allowed deltas.
5. Shared change cần consumer measurement; bounded annotation giữ local.
6. Computed CSS chỉ là supporting proof, không thay full-viewport parity.

## Output

Một `baseline.json` theo `@schema`, chỉ lưu trong project design cache của phiên hiện tại.
