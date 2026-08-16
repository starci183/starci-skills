---
id: fe-blocks-laws-b8-group-before-gap-audit
title: audit.md
slug: /fe/blocks/laws/b8-group-before-gap/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện luật B8 và ranh giới của nó với kệ principles.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `b8-group-before-gap`

## Kết luận

Chấp nhận. Luật này được giữ bằng hình dạng của registry: cấu trúc và khoảng cách nằm trong cùng một
entry với câu `why`.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `B8` so với `fe/principles/gap` | Loại trừ được: ở đây quyết định **có nhóm nào**, ở kia quyết định **khoảng cách bao nhiêu** |
| `B8-4` so với `b1` | Cùng một phán quyết nhìn từ hai phía; `b8` nói về nhóm, `b1` nói về viền |
| `B8-5` so với "làm theo contract" | Loại trừ được: feedback ràng buộc thắng, và phải sửa cả `why` |

## Nhận định

- Mô-đun này cố ý **không** nêu một giá trị khoảng cách nào. Nếu có ai thêm vào, nó đã lấn sang
  `fe/principles/gap` và phải chuyển đi.
- Con số hai trăm chín mươi mốt khoá contract là số đo tại thời điểm khảo sát, không phải một gate.
- Chưa kiểm chéo rằng mọi câu `why` đang nói đúng về cấu trúc mà nó mô tả. Có `why` là bắt buộc; `why`
  **đúng** thì không máy nào kiểm được.
