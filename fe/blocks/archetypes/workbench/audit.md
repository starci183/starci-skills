---
id: fe-blocks-archetypes-workbench-audit
title: audit.md
slug: /fe/blocks/archetypes/workbench/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện archetype A6.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `workbench`

## Kết luận

Chấp nhận, với hai ngoại lệ có giới hạn số đếm được.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `A6-1` so với `b10-3` | Loại trừ được: bước là việc của người dùng, bậc là việc của request |
| `A6-4` so với `b3-6` | Loại trừ được bằng ngữ nghĩa form thật, và bằng số đếm |
| `A6-5` so với mọi archetype | Loại trừ được: đúng hai file, và cả hai ở đây |

## Nhận định

- Hai ngoại lệ của archetype này (`useState` trong nửa thuần, chạm DOM thô) hiện được giữ bằng **số
  đếm** chứ không bằng gate. Nếu số đếm tăng mà không ai để ý, ngoại lệ thành thông lệ.
- Chưa đo được cách nhóm này xử lý lỗi của từng bước một cách hệ thống; mỗi khối tự làm.
