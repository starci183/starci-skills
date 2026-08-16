---
id: fe-blocks-laws-b5-no-invented-field-audit
title: audit.md
slug: /gates/blocks/laws/b5-no-invented-field/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật B5: được giữ tốt, một vi phạm còn lại, và chỗ gate không nhìn thấy.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b5-no-invented-field`

## Kết luận

Chấp nhận. Đây là luật có tỉ lệ tuân cao nhất đo được: ba chuỗi gõ tay trên sáu mươi hai khối.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B5-1` so với `B5-5` | Loại trừ được: suy ra từ field đã có thì không phải bịa |
| `B5-2` so với `B5-1` | Loại trừ được bằng `cardinality` của producer |
| `B5-3` so với `B5-1` | Loại trừ được: danh từ riêng không có bản dịch |
| `B5-4` so với `B5-1` | Loại trừ được: field có thật nhưng không có chỗ đứng trên màn hình |

## Nhận định

- Vi phạm còn lại là một dòng. Sửa nó cần một quyết định sản phẩm nhỏ (dấu hiệu không số) chứ không
  cần backend.
- Không có rule lint nào đếm chuỗi hiển thị gõ tay ở tầng block. Con số ba là kết quả một lần đo tay,
  không phải một gate — nên nó đúng tại thời điểm đo và không tự giữ.
- `B5-5` là mã yếu nhất: nó nói "phải có lý do" nhưng không nói ai duyệt lý do đó. Trong chuỗi gate,
  chỗ duyệt là `reason` của field trong `gate.schema.json`, nhưng schema không phân biệt được một lý
  do thật với một câu cho đủ.
