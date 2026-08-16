---
id: fe-blocks-laws-b6-one-owner-two-hosts-audit
title: audit.md
slug: /fe/blocks/laws/b6-one-owner-two-hosts/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật B6, và vì sao trích một vế của nó là cách sai phổ biến nhất.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b6-one-owner-two-hosts`

## Kết luận

Chấp nhận. Đây là luật duy nhất trên kệ được phát biểu thành **hai vế bắt buộc đi cùng nhau**, và
cách phát biểu đó là kết quả trực tiếp của việc nó bị bác theo cả hai hướng.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B6-1` so với `B6-2` | Loại trừ được bằng số nơi gọi của từng ứng viên |
| `B6-3` so với `B6-4` | Loại trừ được bằng `interactionAnatomy`; khác cách sắp thì gộp, khác cách tương tác thì tách |
| `B6-4` so với một prop mới | Không cần phân định: kiểu props của composite không cho phép prop cấp cao |
| `B6-6` | Kiểm được bằng cách đếm: ma trận parity phải có đủ số nơi gọi đã đo |

## Repo sống đang ở đâu

**Đang tuân, và tuân đúng cả hai vế.** `IconLabelFactRow` là chủ chung với bảy nơi dùng và ba
`recipe`; `SelectionList` giữ hai nhánh vì hai anatomy.

## Nhận định

- Ranh giới `interactionAnatomy` sắc trong hai trường hợp đã phán, nhưng chưa có bảng phân loại đầy
  đủ cho các anatomy khác — kéo-thả, mở rộng nội dòng, chọn nhiều. Chúng chưa xuất hiện nên chưa
  được viết; đó là **suy luận, không có neo** nếu ai đó áp luật này vào chúng.
- Mười sáu thư mục rỗng còn sót trong cây component, bảy trong số đó trùng tên với một composite còn
  sống. Tra tên sẽ ra hai chỗ trong khi chỉ một chỗ có mã, và đó chính là cái bẫy đã dẫn tới vòng
  đầu sai của lần gộp trước.
