---
id: fe-blocks-archetypes-block-of-blocks-vi
title: vi.md
slug: /fe/blocks/archetypes/block-of-blocks/vi
sidebar_label: vi.md
sidebar_position: 1
description: Khối ghép khối: không state, không request, không twin — và vì sao đó là mô hình đang hoạt động.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `block-of-blocks` · Luật: [`INDEX.md`](./INDEX.md)

# Khối ghép khối

Bốn cái: `IdentityRail`, `CommunityTab`, `CoursesTab`, `ExploreTab`, cộng `ProfileTabs`. Chúng chỉ
có `index.tsx`, không có `component.tsx`, và không có twin `_X`.

## Vì sao không có twin

`IdentityRail` tự viết ra lý do trong docstring của chính nó: **không có gì để resolve ở đây**. Dấu
gạch dưới hứa một nửa không chạm thế giới; ở đây mọi thứ đã được các khối con resolve xong rồi.

Và một dòng nữa quan trọng không kém: một bài test render cái này sẽ mount ba khối **có fetch**. Lời
hứa của dấu gạch dưới là **cục bộ, không bắc cầu**.

## Cái nó sở hữu

Đúng hai thứ: **cái seam giữa các con**, là một contract; và **cái tên bên trên chúng**, là copy.
Không gì khác.

## Cái đánh đổi được ghi ra

Ba hàng con hiện ra khi từng cái trả lời xong, thay vì cả ba cùng chờ cái chậm nhất. Docstring gọi
đó là đánh đổi có chủ ý: **lệch nhịp còn hơn bị giữ làm con tin**.

Đây là chỗ archetype này nối thẳng vào `b11`: một khối một đơn vị settle, và composer là cách ghép
nhiều đơn vị settle lại mà không gộp cờ của chúng.

## Ngoại lệ overlay

`CoursesTab` giữ `useState` của id khoá đang xem giá, vì overlay **sống lâu hơn** cái hàng đã mở nó.
Nếu hàng giữ overlay, overlay chết cùng hàng khi danh sách render lại.

## Nhãn `meta` đang trôi

Ba composer cùng hình dạng nhưng khai khác nhau: `IdentityRail` khai `connected`, còn
`CommunityTab`/`CoursesTab`/`ExploreTab` khai `pure` — trong đó `CoursesTab` dùng `useState` và treo
một overlay. Không gate nào đọc `meta`, nên không gì bắt được chuyện này.
