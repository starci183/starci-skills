---
id: fe-blocks-archetypes-khoi-ghep-khoi-audit
title: audit.md
slug: /fe/blocks/archetypes/khoi-ghep-khoi/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện archetype A5 và nhãn meta đang trôi.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `khoi-ghep-khoi`

## Kết luận

Chấp nhận, với một khoản trôi đã đo được ở `meta`.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `A5` so với mọi archetype khác | Loại trừ được bằng ba dấu hiệu cùng lúc: không `component.tsx`, không twin, không request |
| `A5-4` so với `b3-4` | Loại trừ được: overlay sống lâu hơn con, nên nó thuộc về composer |

## Nhận định

- **Không gate nào đọc `meta`.** Đã tìm hết `eslint.config.mjs`, `plugins/eslint-canon/*.mjs`,
  `scripts/`, `tests/` và `src/`. Rule chia đôi nửa thuần/nửa nối khoá bằng **đường dẫn file** và
  bằng tên twin `_X`, không bao giờ đọc `meta.world`. `meta` là chú thích thuần.
- Hậu quả đo được: ba composer cùng hình dạng khai hai world khác nhau, và cái khai `pure` lại là
  cái dùng `useState`.
- Tám mươi ba trên chín mươi ba file khai `meta`, với ba lược đồ khác nhau. Không có lược đồ nào
  được ép.
