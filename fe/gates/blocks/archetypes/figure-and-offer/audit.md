---
id: fe-blocks-archetypes-figure-and-offer-audit
title: audit.md
slug: /gates/blocks/archetypes/figure-and-offer/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện archetype A3.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `figure-and-offer`

## Kết luận

Chấp nhận, với một khoảng trống thật về lỗi của hành động.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `A3` so với `A1` | Loại trừ được bằng sự chi phối: có hình chính hay không |
| `A3` so với `A2` | Loại trừ được bằng mặt phẳng và hành động |
| `A3-6` so với disabled | Loại trừ được bằng câu hỏi: thứ đó đã được lấy chưa |

## Nhận định

- Archetype không nói lỗi của **hành động** nằm ở đâu: nâng cả khối lên `failed`, hay báo cục bộ
  cạnh nút. Đây là khoảng trống chung của `b11` và `b12`, và một bản dựng mù đã phải tự đoán.
- Yêu cầu "kiểm mutation có thật" chưa có gate nào giữ; nó là một bước của kế hoạch, không phải một
  phép kiểm.
