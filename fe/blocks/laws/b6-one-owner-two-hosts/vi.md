---
id: fe-blocks-laws-b6-one-owner-two-hosts-vi
title: vi.md
slug: /fe/blocks/laws/b6-one-owner-two-hosts/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hai vế của một luật: gộp hàng nhìn thấy, giữ riêng chủ tương tác.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b6-one-owner-two-hosts` · Luật: [`INDEX.md`](./INDEX.md)

# Một chủ, hai chỗ ngồi

Luật này có **hai vế** và cả hai đều bị bác, mỗi vế theo hướng ngược nhau. Trích một vế rồi làm theo
là cách chắc chắn nhất để sai.

- **Vế gộp**: hai chỗ hiện cùng một thứ thì phải dùng chung một chủ **thật**. Một bản sao riêng
  trông y hệt **không phải** là dùng chung.
- **Vế giữ riêng**: giống markup thì chưa đủ để gộp. Nếu hai chỗ khác nhau ở **cách tương tác** —
  chọn, focus chạy, điều hướng kết quả — thì phần nhìn thấy được gộp, còn chủ tương tác giữ riêng.

## Bảng tra

| Mã | Tình huống | Phán |
|---|---|---|
| `B6-1` | Hai chỗ cùng hình, một bên đã có chủ có nhiều nơi gọi | tổng quát hoá chủ **đã được chứng minh** |
| `B6-2` | Chỗ thứ hai tự dựng bản riêng trông y hệt | không phải reuse — thay bằng chủ chung |
| `B6-3` | Cùng markup, khác cách tương tác | giữ riêng; chỉ gộp hàng nhìn thấy |
| `B6-4` | Một chủ phải vẽ hai cách sắp | `props.recipe`, không phải prop cấp cao mới |
| `B6-5` | Đặt tên cho chủ chung | đặt theo **hình**, không theo nơi gọi đầu tiên |
| `B6-6` | Đề xuất gộp | mọi nơi gọi hiện hữu phải vào ma trận parity |

## `B6-1` — tổng quát hoá cái đã sống, không phải cái đã chết

Vòng đầu của một lần gộp đã chọn dựng chủ chung từ một component **chết** — không nơi nào gọi — chỉ
vì tên nó nghe hợp. Thầy chỉ vào "Chuỗi ngày học" trên màn hình và nguồn xác nhận: đã có một chủ
khác đúng hình glyph–nhãn–con số, với nhiều nơi gọi thật.

Bài học đo được: **số nơi gọi là bằng chứng**. Một component không ai gọi chưa từng được kiểm bởi
thực tế nào.

## `B6-3` — giống mà vẫn phải riêng

Cùng một leaf `SelectionList` mang hai nhánh: nhánh phạm vi dùng hàng glyph–nhãn–con số dùng chung,
nhánh kết quả tự vẽ tiêu đề, mô tả và dấu chỉ chọn. Đề xuất "dùng luôn hàng chung cho kết quả" bị
bác, với lý do viết rõ: hàng kết quả sở hữu tiêu đề, loại, dấu chỉ và một cách đọc khác.

Đây là chỗ hai vế của luật chạm nhau trong **một file**.

## `B6-4` — biến thể là dữ liệu

`IconLabelFactRow` phân biệt ba cách sắp bằng `props.recipe`: `peer`, `label-led`,
`compact-action`. Không phải bằng một prop cấp cao, vì kiểu props của composite chỉ nhận `props`,
`on`, `isLoading` — một prop cấp cao mới thậm chí không biên dịch được.

## `B6-5` — tên theo hình

Chủ chung ban đầu tên `QuickActionRow`, theo nơi gọi đầu tiên. Tên đó sai ngay khi có nơi gọi thứ
hai không phải "quick action". Đổi thành `IconLabelFactRow` — tên của **hình**.
