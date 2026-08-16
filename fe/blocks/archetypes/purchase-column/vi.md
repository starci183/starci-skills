---
id: fe-blocks-archetypes-purchase-column-vi
title: vi.md
slug: /fe/blocks/archetypes/purchase-column/vi
sidebar_label: vi.md
sidebar_position: 1
description: Cột giá và bản thanh ngang của nó: một con số, hai chỗ nói, không được lệch.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `purchase-column` · Luật: [`INDEX.md`](./INDEX.md)

# Rail quyết định mua

Cột giá của trang khoá học, và bản thanh ngang của chính nó trên màn hình hẹp. Đây là khối duy nhất
trong tầng sở hữu một viewport cuộn, và là `component.tsx` duy nhất mang `'use client'`.

## Rủi ro mà archetype này quản

Hai mặt phẳng cùng nói về **một** con số. Nếu mỗi bên tự tính, sẽ có lúc chúng lệch — và lệch giá là
loại lệch mà người dùng nhớ lâu nhất.

Cách giải: bản thanh ngang khai state của nó là **tập con** state của rail (`ready | price-pending`),
và docstring nói rõ vì sao: nó hiện con số của rail nên nó lấy tình huống của rail.

## Vị trí bên phải: nói đúng những gì biết

Rail là một `aside` bổ trợ, sticky, mang quyết định mua. Nó **nằm bên phải theo legacy**, và chưa
từng bị chất vấn. Không có lý do UX nào cho vị trí đó trong kho phán quyết, nên không được bịa ra
một cái.

## Bốn thứ không được gộp

Thầy đã hỏi thẳng: "tính năng học thử và add to card đâu?". Một CTA duy nhất làm mất hai đường cam
kết. Rail phải giữ: chính (ghi danh hoặc tiếp tục học), phụ (học thử), và thêm vào giỏ.

Mỗi đường một cờ chờ riêng, vì spinner sai nút làm người dùng hiểu sai request đang chạy.

## Cuộn trong khung, không phải khung trôi

Bốn lần bị bác quanh cùng một chuyện: bọc `ScrollShadow` ra ngoài Card, dán `overflow-y-auto` lên
sticky child, `max-h-[80vh]` gõ tay. Kết luận cuối: khung đứng yên, chỉ nội dung chạy, và ranh giới
cuộn có **tên**.
