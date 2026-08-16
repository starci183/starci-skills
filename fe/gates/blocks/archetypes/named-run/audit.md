---
id: fe-blocks-archetypes-named-run-audit
title: audit.md
slug: /gates/blocks/archetypes/named-run/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện archetype A1.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `named-run`

## Kết luận

Chấp nhận. Archetype đông nhất, nhất quán nhất, và ít chỗ để sai nhất — vì bốn quyết định dễ sai
nhất đã bị đưa ra khỏi khối.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `A1` so với `A3` | Loại trừ được: `A3` có một hình chính, `A1` không có hàng nào quan trọng hơn hàng nào |
| `A1` so với `A4` | Loại trừ được: ai sở hữu request |
| `A1` so với `A2` | Loại trừ được: có mặt phẳng hay không, và có nhiều hàng hay một |

## Nhận định

- Không có gate nào kiểm thứ tự lắp của `A1-1`. Nó sống bằng việc bản sau chép bản trước.
- Hai khối viết theo kiểu khác hẳn: `CommunityTab` viết một dòng không khoảng trắng, và
  `UpcomingLivestreamCard` nhét toàn bộ nửa connected vào một dòng duy nhất. Cả hai vẫn qua lint vì
  không có luật độ dài dòng.
