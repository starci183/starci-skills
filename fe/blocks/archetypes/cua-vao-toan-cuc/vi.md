---
id: fe-blocks-archetypes-cua-vao-toan-cuc-vi
title: vi.md
slug: /fe/blocks/archetypes/cua-vao-toan-cuc/vi
sidebar_label: vi.md
sidebar_position: 1
description: Điểm chạm luôn có mặt, không thuộc nội dung trang nào.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `cua-vao-toan-cuc` · Luật: [`INDEX.md`](./INDEX.md)

# Cửa vào toàn cục

Bốn cái: nút AI nổi, hỏi-theo-vùng-bôi-đen, menu tài khoản, menu ngôn ngữ. Chúng không thuộc nội
dung của trang nào, nên chúng không chờ dữ liệu của trang nào.

## Props hẹp là một đặc điểm, không phải sự thiếu sót

`label`, `isOpen`, `hasUnread` — hoặc chỉ `guest | signedIn`. Đúng một hành động. Không thang tải.

Một cửa vào toàn cục có nhiều dữ liệu nghĩa là nó đang biết chuyện của một trang cụ thể, và lúc đó
nó thôi là toàn cục.

## Ai mount nó

Không phải nó. Có hai phán quyết cho chuyện này: một cái bác việc mount vào provider (provider sở
hữu context, không sở hữu bố cục nhìn thấy), một cái bác việc mount vào chrome lặp theo cụm route
(chrome đó lặp lại nên sẽ làm mất trạng thái hội thoại khi đi qua cụm khác).

Kết luận: mount một lần ở một chủ sở hữu chrome được duyệt.

## Chỗ archetype này đang tự phá luật của mình

Nút AI nổi tự đặt `position: fixed` bằng inline style. Đó là inline style duy nhất trong toàn tầng
block, và nó nói rằng khối này đang tự quyết chỗ đứng của mình trên mọi trang nó xuất hiện.

## Dấu hiệu chưa đọc

`hasUnread` là boolean, nên dấu hiệu phải là **sự có mặt**, không phải một con số. Hiện tại nó vẽ số
`1`. Đã có phán quyết đúng chuyện này ở menu tài khoản: không badge cho tới khi API có count thật.
