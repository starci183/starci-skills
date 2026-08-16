---
id: fe-blocks-archetypes-evidence-tile-audit
title: audit.md
slug: /gates/blocks/archetypes/evidence-tile/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện archetype A9: một bản ghi nợ, không phải một khuôn mẫu.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `evidence-tile`

## Kết luận

Chấp nhận **như một bản ghi**, không như một khuôn mẫu để chép.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `A9` so với `A1` | Loại trừ được bằng hình dạng file, không bằng vai trò |
| `A9-5` so với `b4-1` | Loại trừ được: hàng giả mang `globalId` của dữ liệu |

## Nhận định

- **Nguyên nhân gốc là một khoảng trống của lint, không phải một quyết định.** Regex `TWO_FILE_TIERS`
  chỉ khớp `pages|layouts`, nên chín file phẳng ở đây sống trong cây component mà không gate nào
  thấy. Sửa regex là một thay đổi ở kệ `lints`, không ở đây.
- Chưa chạy lint để chứng minh chín file này thực sự đi qua gate xanh; khẳng định đó đọc từ nguồn
  rule.
- Mô-đun này nên **biến mất** khi sáu ô được đưa về `A1`. Một archetype ghi nợ mà sống lâu sẽ bị đọc
  như một lựa chọn hợp lệ.
