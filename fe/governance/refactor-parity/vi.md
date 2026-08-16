---
id: fe-governance-refactor-parity-vi
title: vi.md
slug: /fe/governance/refactor-parity/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hướng dẫn tiếng Việt để giữ visual, semantic và state parity khi refactor.
---

# vi.md

> Version: `1.02` · Luật cho AI: [`INDEX.md`](./INDEX.md) · Ví dụ trực quan: [`example.md`](./example.md)

## Refactor đổi ownership, không đổi interface

Refactor parity nghĩa là code, layer hoặc owner có thể thay đổi nhưng người dùng không nhận được một
giao diện khác. Reference implementation quyết định cả appearance lẫn interaction semantics:

- phần nào giống field nhưng thực chất là pressable;
- đâu là switch, button, tab hay link;
- row nào thuộc cùng surface;
- navigation có mấy layer nhưng là một landmark;
- loading có bao nhiêu item;
- overflow dùng drag track hay native scrollbar.

Câu phân loại:

> Reader, keyboard user, screenshot test hoặc accessibility tree có quan sát thấy khác không?

Nếu có, thay đổi đó là redesign và cần scope/review riêng.

## Đọc reference thật

Screenshot và trí nhớ che mất role, focus order, state attributes, nested layer và token theo theme.
Trước khi sửa:

1. Mở component thật và các asset nó dùng.
2. Ghi computed style/token quan trọng.
3. Đi qua interaction bằng keyboard.
4. Liệt kê state, theme và viewport.
5. Chụp/ghi evidence theo matrix, không chỉ happy path.

Không bắt đầu từ “trông giống khoảng này”. Nearby spacing, icon hoặc shadow đều là quyết định mới.

## Semantic primitive là một phần của visual shape

Search trigger có thể trông như input nhưng role là button và press sẽ mở search. Thay bằng `<input>`
đổi keyboard contract. Switch không phải icon button: nó có checked state và binary semantics. Tab
không phải button row nếu reference expose tablist/tab/tabpanel.

Resting screenshot giống nhau không đủ chứng minh parity.

## Compound landmark phải giữ nguyên

Primary navigation và tabs có thể là hai row nhưng reference xem chúng là một double-layer navigation
landmark với sticky ownership và separator chung. Tách thành `<Navbar />` và `<Tabs />` độc lập có thể
giữ label nhưng đã đổi hierarchy, focus path, sticky behavior và boundary.

## Exact assets và tokens

Logo, icon identity, icon size, border/shadow, separator thickness/inset, spacing, radius, skeleton
count, dark token và responsive state là evidence. Không redraw logo gần giống. Không thay `md` bằng
`sm` vì “nhìn gọn”. Không đổi border thành shadow vì framework mới có preset tiện hơn.

## Course content parity

Reference course page có:

- 6 modules, 24 content items;
- expanded current module;
- completion state cho từng row;
- locked capstone row;
- progress `68%`;
- course actions và responsive grouping.

Refactor phải giữ count, order, expansion, labels, row semantics, focus behavior và group surfaces. Nếu
new architecture tự thêm recommendation card hoặc đổi `16/24` thành chart mới, đó là redesign.

## Student review parity

Reference review section có aggregate `4.9/5`, `128 đánh giá`, `94% đề xuất`, distribution, sort/filter,
avatar/name/date/comment và pagination/load-more behavior. Refactor không được:

- biến sort button thành input;
- đổi review row thành card grid;
- ẩn sample size;
- đổi selected chip sang font size khác;
- derive filter options từ current selection;
- thay load-more interaction bằng infinite scroll mà không có redesign scope.

## State matrix, không phải một screenshot

Ít nhất phải xét signed out/in nếu liên quan, loading, empty, populated, error, light, dark, narrow và
wide. Branch khó thường nằm ngoài screenshot đẹp nhất: empty state khác structure, signed-out mất
action, dark mode dùng border thay shadow, narrow mode chuyển landmark.

## Selection không đổi geometry

Selected và unselected options trong cùng selector dùng cùng primitive, font size, line-height và target
geometry. Chỉ state token/attribute đổi. Nếu selected filter lớn hơn, row sẽ nhảy khi click và state
đã biến thành layout change.

Option list phải ổn định từ domain. Chọn năm cũ không được làm mất đường quay về năm hiện tại. Chọn
rating `1 sao` không được làm dropdown chỉ còn 1 sao.

## Overflow interaction

Nếu reference dùng draggable constrained track trong `overflow-hidden` viewport, native scrollbar
không tương đương: geometry và interaction đều khác. Accessibility improvement có thể cần thiết nhưng
phải là change riêng, không lẫn vào parity refactor.

## Tách redesign khỏi refactor

Khi phát hiện reference có vấn đề:

1. Port reference đạt parity trước.
2. Ghi redesign proposal riêng với lý do và impact.
3. Review/accept riêng.
4. Chỉ sau đó thay behavior hoặc visual.

Việc code đang mở không tự cấp phép “sửa tiện thể”.

## Checklist

- Có reference path/version và asset thật chưa?
- Roles, names, states, focus order, keyboard action có giống không?
- Grouping, layer, sticky và overflow có giống không?
- Copy, count, order, exact tokens có giống không?
- Đã test loading/empty/populated/error chưa?
- Light/dark và narrow/wide chưa?
- Selected state có giữ geometry không?
- Intentional delta đã tách thành redesign chưa?
