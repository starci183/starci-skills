---
id: fe-blocks-archetypes-owned-item-vi
title: vi.md
slug: /gates/blocks/archetypes/owned-item/vi
sidebar_label: vi.md
sidebar_position: 1
description: Phần tử nhận state từ danh sách, và chỉ sở hữu mutation của chính nó.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `owned-item` · Luật: [`INDEX.md`](./INDEX.md)

# Thẻ hoặc hàng nhận state từ nơi gọi

Hai chỗ dùng: dòng giỏ hàng, thẻ khoá trong catalog. Đây là archetype duy nhất mà khối **được phép**
nhận `state` từ nơi gọi.

## Nguyên tắc gốc

Ai sở hữu request thì sở hữu trạng thái của request đó. Danh sách gọi query, nên danh sách sở hữu
chờ, rỗng và lỗi. Phần tử chỉ sở hữu **mutation của chính nó** — thêm vào giỏ, xoá khỏi giỏ.

Hệ quả trực tiếp: phần tử **không đọc `.error`**. Nếu nó dựng một nhánh lỗi, nó đang nói về một
request nó không thấy.

## Vì sao mutation đè state chứ không thành state mới

```tsx
state={removal.isMutating ? "removing" : state}
```

Nếu `removing` được thêm vào tập state của khối, thì nơi gọi có thể truyền xuống `removing` — mà nơi
gọi không biết gì về mutation đó. Đè lên trong lúc chạy giữ đúng ranh giới: tập state là của danh
sách, cờ mutation là của phần tử.

## Cờ cục bộ không thay được sự thật dùng chung

Có một lần đề xuất giữ `isInCart` cục bộ và hiện nhãn "đã trong giỏ" ở dạng xám. Bị bác: cờ cục bộ
không sống nổi khi có một mặt phẳng giỏ hàng thứ hai, và nó cũng lấy mất hành động đảo ngược được
của bản legacy.

## Nhận gì từ nơi gọi

Chỉ hai loại: **danh tính phần tử** (`course`, `line`, `courseId`) và **outcome gửi lên**
(`onView`, `onOpenPriceDetail`). Không có prop kiểu dáng nào — đo trên toàn tầng: sáu khối
connected nhận props, và không cái nào là kiểu dáng.
