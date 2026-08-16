---
id: fe-blocks-laws-b12-error-owner-vi
title: vi.md
slug: /fe/blocks/laws/b12-error-owner/vi
sidebar_label: vi.md
sidebar_position: 1
description: Lỗi là một câu trả lời đã xong, không phải một sự chờ đợi — và bảy khối đang giấu nó.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b12-error-owner` · Luật: [`INDEX.md`](./INDEX.md)

# Lỗi phải có chủ thấy được

Câu quan trọng nhất của luật này nằm trong một chú thích của mã sống:

> Một thất bại là một câu trả lời **đã settle**, không phải một sự chờ.

Thư viện fetch thử lại một khoá hỏng theo backoff, và mỗi lần thử lại nó báo `isLoading` một lần
nữa. Một hàng chỉ đọc cờ đó sẽ shimmer **chừng nào backend còn chết** — nghĩa là vô hạn. Người đọc
được bảo "chờ đi" trong khi câu trả lời đã về từ lâu và câu trả lời là "không".

## Bảng tra

| Mã | Tình huống | Luật |
|---|---|---|
| `B12-1` | Khối tự chủ request và request hỏng | state `failed`, notice thấy được, có nút đọc lại |
| `B12-2` | Lỗi bị gộp vào một bản vẽ vô hình | chỉ hợp lệ khi có **lý do sản phẩm được viết ra** |
| `B12-3` | Khối tự chủ request nhưng không đọc `.error` | bị bác — shimmer vĩnh viễn |
| `B12-4` | State đến từ nơi gọi | **không** đọc `.error`; lỗi thuộc về danh sách |
| `B12-5` | Bố cục không có chỗ nào để lỗi xuất hiện | đẩy lỗi lên tầng có chỗ |

## Ba nhóm trong repo sống

**Mười lăm khối** cho lỗi một chủ thấy được: state `failed`, `EmptyNotice`, nút đọc lại.

**Sáu khối** gộp lỗi vào một bản vẽ vô hình. Bốn trong số đó — các hàng danh tính — có lý do viết
ra: người chưa đăng nhập thấy đúng như thế. Hai khối còn lại thì không.

**Một khối** không đọc `.error` lần nào dù tự chủ request: `ProfileHero`. State của nó là `data ===
undefined ? "pending" : "ready"`. Một query hồ sơ hỏng sẽ shimmer mãi — đúng cái bẫy mà docstring
của một khối khác đã ghi ra và tự tránh.

**Ba khối** không đọc `.error` và **đúng**: `AccountMenu`, `CartLine`, `CourseCatalogCard`. State
của chúng đến từ nơi gọi, và chúng chỉ sở hữu mutation của chính mình.

## `B12-5` — bố cục hẹp cũng phải có chỗ cho lỗi

Có một phán quyết riêng cho chuyện này ở chatbot: lỗi biên dịch chỉ hiện trong khung xem trước là
không đủ, vì bố cục hẹp và bố cục di động không có khung đó — nên chúng sẽ **giấu** lỗi. Trạng thái
hỏng phải có mặt ở cấp editor, chỗ mọi bố cục đều nhìn thấy.
