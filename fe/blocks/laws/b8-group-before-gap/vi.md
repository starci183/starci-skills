---
id: fe-blocks-laws-b8-group-before-gap-vi
title: vi.md
slug: /fe/blocks/laws/b8-group-before-gap/vi
sidebar_label: vi.md
sidebar_position: 1
description: Vì sao đặt tên nhóm trước, chọn khoảng cách sau — và vì sao contract chỉ là niềm tin gần nhất.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b8-group-before-gap` · Luật: [`INDEX.md`](./INDEX.md)

# Nhóm trước, khoảng cách sau

Khi màn hình trông chật, phản xạ đầu tiên là giảm khoảng cách. Phản xạ đó sai vì nó chữa triệu
chứng: cái chật thật ra là **quá nhiều nhóm ngang hàng**, và bóp chúng lại chỉ làm chúng chật mà
vẫn ngang hàng.

Thầy đã nói đúng chuyện này: nội dung thì ổn, cái cần đổi là **cách render**, không phải ép spacing.

## Bảng tra

| Mã | Tình huống | Luật |
|---|---|---|
| `B8-1` | Vài con dưới một cha | đặt tên nhóm trong contract, kèm `why`, trước khi chọn khoảng cách |
| `B8-2` | Một khoảng cách phẳng cho mọi hậu duệ | bị bác — lồng đúng những nhóm có thật |
| `B8-3` | Màn hình trông chật | đổi bố cục và thứ tự đọc, không bóp gap |
| `B8-4` | Hai ý cần tách | hai nhóm có tên trong một mặt phẳng, không phải hai card lồng |
| `B8-5` | Contract đang ghi một khoảng cách mà feedback nói ngược | contract là niềm tin cũ; sửa cả class **và** `why` |

## Vì sao luật này không thể vi phạm ở tầng contract

Mỗi entry của registry có **ba** phần: `children` (cấu trúc), `classes` (khoảng cách) và `why` (vì
sao những con này ngồi cạnh nhau). Ba phần nằm trong cùng một object, nên không lấy khoảng cách thay
cấu trúc được — muốn đổi khoảng cách thì đang nhìn thẳng vào câu giải thích cấu trúc.

Hai trăm chín mươi mốt khoá, mỗi khoá một câu `why` bắt buộc.

## `B8-2` — không có gap phẳng

Cột giá từng dùng một `gap-1` phẳng cho cả giá, ghi chú và cảnh báo sắp hết chỗ. Bị bác: cảnh báo
sắp hết chỗ **không thuộc cùng nhóm ý nghĩ** với phép tính giá. Thay bằng `gap-1` lồng trong `gap-2`
ngoài — hai nhóm, hai quan hệ.

## `B8-5` — contract có thể cũ

Một lần khác, có người giữ nguyên `gap-4` với lý do "contract đang ghi vậy". Bị bác: contract là
**belief**, và feedback ràng buộc chứng minh ngược lại thì belief đó cũ. Sửa cả class và cả câu
`why`; sửa mỗi class là để lại một lời nói dối trong registry.
