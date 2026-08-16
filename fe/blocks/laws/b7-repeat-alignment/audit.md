---
id: fe-blocks-laws-b7-repeat-alignment-audit
title: audit.md
slug: /fe/blocks/laws/b7-repeat-alignment/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật B7: được giữ bằng cấu trúc chứ không bằng kỷ luật.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b7-repeat-alignment`

## Kết luận

Chấp nhận. Đây là luật tự bảo vệ tốt nhất trên kệ, vì nơi vi phạm được đã bị lấy đi khỏi tầm với của
khối.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B7-1` so với `fe/principles/gap` | Loại trừ được: template cột là cấu trúc, gap là quan hệ |
| `B7-3` so với một skeleton riêng | Loại trừ được: hàng nghỉ là dữ liệu, không phải component |
| `B7-4` so với `B7-1` | Loại trừ được: một cột đúng vẫn hỏng nếu nội dung trong nó co giãn |

## Nhận định

- Bốn điểm khác biệt của khối lặp không được gate nào kiểm. Không có lint nào bắt `const ROW_COUNT = 3`.
  Kỷ luật hiện tại đến từ việc mười một khối đã làm đúng và bản sau chép bản trước.
- `B7-2` chỉ có neo từ chối ở một bối cảnh (panel giá). Áp nó cho mọi disclosure là **suy luận** có
  cơ sở nhưng chưa được phán ở bối cảnh thứ hai.
- Chưa đo bằng ảnh chụp. "Thẳng cột" ở đây đọc từ grid template, không từ một lần render.
