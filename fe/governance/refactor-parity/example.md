---
id: fe-governance-refactor-parity-example
title: example.md
slug: /fe/governance/refactor-parity/example
sidebar_label: example.md
sidebar_position: 2
description: Ví dụ chi tiết và live UI về parity cho course content, reviews, semantics và state matrix.
---

# example.md

> Version: `1.02` · Mỗi comparison chỉ khác một quyết định observable.

## Course content: giữ grouping và state thật

Reference có header `Nội dung khóa học`, progress `16/24 · 68%`, sáu module, module hiện tại expanded,
row content có duration/completion, capstone locked, action `Tiếp tục học` trỏ đúng content tiếp theo.

**Parity:** new architecture render cùng order/count/labels, cùng expanded state, cùng row boundary và
focus behavior. Data ownership có thể chuyển layer nhưng reader không thấy thêm/bớt object.

**Not parity:** biến mỗi module row thành elevated card, tự thêm `Gợi ý cho bạn`, đổi action target hoặc
chỉ render 3 skeleton trong khi ready list có 6 module anchors.

<CodeUiTabs example="refactor-course-content" />

## Student reviews: giữ evidence và interaction

Reference có `4.9/5`, 128 reviews, 94% recommend, star distribution, sort trigger, filter chips và review
rows với avatar/name/date/comment. Selected filter `Mới nhất` dùng cùng geometry như peers.

**Parity:** giữ aggregate/sample, review order, accessible names, selected state, load-more/pagination
behavior và responsive stack.

**Not parity:** thay sort pressable bằng editable input, selected chip lớn hơn, bỏ sample size, chuyển
rows thành carousel hoặc thay load-more bằng infinite scroll.

<CodeUiTabs example="refactor-student-reviews" />

## Field-look không có nghĩa là input

Search trigger hiển thị placeholder `Tìm nội dung`, shortcut `⌘K`, có border/radius giống field nhưng
press mở command search. Correct port dùng pressable primitive với button semantics, accessible name và
keyboard activation. Wrong port dùng input `onChange`, làm người dùng nghĩ có thể nhập tại chỗ.

<CodeUiTabs example="refactor-pressable-search" />

## Switch không phải icon button

Setting `Tự động phát nội dung tiếp theo` có label, description và switch checked state. Port giữ switch
role, accessible checked state, target geometry và focus. Icon button toggle trông gần giống nhưng làm
mất binary semantics.

<CodeUiTabs example="refactor-switch-semantics" />

## Compound navigation landmark

Course workspace có primary row (course, progress, account) và bottom tab row (`Nội dung`, `Ghi chú`,
`Thảo luận`) cùng sticky shell và separator. Refactor giữ một landmark hai layer. Không tách hai sticky
containers khiến shadow/separator và focus path khác.

<CodeUiTabs example="refactor-compound-navigation" />

## State/theme/viewport matrix

Matrix demo đối chiếu:

- loading: giữ course/review anchor skeleton đúng count;
- empty: heading và purpose không biến mất;
- populated: content thật;
- error: local error không thay toàn page;
- light/dark: exact border/shadow/token;
- narrow/wide: same source order và semantics.

Một desktop light screenshot pass không đóng được matrix.

<CodeUiTabs example="refactor-state-matrix" />

## Stable filter domain

Review rating options luôn là `Tất cả, 5, 4, 3, 2, 1 sao`. Khi chọn `1 sao`, option list không derive
thành `1 sao` hoặc mất đường quay về `Tất cả`. Selected state chỉ đổi semantic token, không đổi size.

<CodeUiTabs example="refactor-stable-options" />

## Overflow parity

Course chapter tabs reference dùng clipped viewport và constrained draggable track. Port giữ interaction,
track bounds, hidden overflow và focusability. Native scrollbar không được thay im lặng dù implementation
dễ hơn. Nếu cần accessibility improvement, tạo redesign task riêng.

<CodeUiTabs example="refactor-overflow-track" />

## Verification matrix mẫu

| Axis | Course content | Student reviews |
|---|---|---|
| Loading | Module anchors/count | Score, distribution, row anchors |
| Empty | No enrolled content explanation | No reviews + invitation |
| Populated | 6 modules, 24 items, 68% | 4.9/5, 128, 94%, rows |
| Error | Local retry, stable heading | Local retry, stable aggregate region |
| Light/dark | Exact edge/shadow | Exact chip/row/divider tokens |
| Narrow/wide | Same source order | Same aggregate-before-detail order |
| Keyboard | Expansion/action order | Sort/filter/review/action order |
| Accessibility tree | headings/list/progress | heading/filters/list/rating names |
