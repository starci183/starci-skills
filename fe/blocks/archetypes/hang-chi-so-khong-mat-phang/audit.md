---
id: fe-blocks-archetypes-hang-chi-so-khong-mat-phang-audit
title: audit.md
slug: /fe/blocks/archetypes/hang-chi-so-khong-mat-phang/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện archetype A2.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `hang-chi-so-khong-mat-phang`

## Kết luận

Chấp nhận. Archetype nhỏ nhất và có lý do tồn tại rõ nhất, vì nó ra đời từ một phép đo cụ thể.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `A2` so với `A1` | Loại trừ được: một con số so với một tập hàng |
| `A2` so với `A3` | Loại trừ được: có mặt phẳng và hành động hay không |
| `A2-4` so với vi phạm `b4` | Loại trừ được bằng câu lý do viết trong docstring |

## Nhận định

- Bốn khối này là chỗ duy nhất trong sản phẩm mà `null` là câu trả lời đúng, và điều đó chỉ đúng
  **vì lý do được viết ra**. Nếu ai đó xoá câu chú thích, khối trở thành vi phạm mà không đổi một
  dòng mã nào — đó là một điểm yếu thật của cách bảo vệ hiện tại.
- `ProfileIdentityRow` cùng nhóm nhưng dựng một hình khác (`profile-row`); nó vẫn là `A2` theo luật
  vì vẫn một request, không surface, gộp lỗi vào nhánh vô hình.
