---
id: fe-blocks-archetypes-owned-item-audit
title: audit.md
slug: /gates/blocks/archetypes/owned-item/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện archetype A4.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `owned-item`

## Kết luận

Chấp nhận. Archetype này quan trọng vì nó là **ngoại lệ có tên** cho hai luật khác, và không có nó
thì `b12` sẽ báo sai ba khối.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `A4` so với `A1` | Loại trừ được bằng `ownsRequest` |
| `A4-4` so với vi phạm `b12` | Loại trừ được bằng cùng một input |
| `A4-3` so với `B10-1` | Loại trừ được: đè tạm thời, không mở rộng tập state |

## Nhận định

- Chỉ hai bản đang chạy, nên hình dạng này chưa được kiểm bởi nhiều trường hợp. Bản thứ ba nên được
  đọc kỹ trước khi coi archetype là đã ổn định.
- Ranh giới "outcome gửi lên" và "prop kiểu dáng" hiện được giữ bằng quan sát, không bằng gate.
