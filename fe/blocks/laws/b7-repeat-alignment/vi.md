---
id: fe-blocks-laws-b7-repeat-alignment-vi
title: vi.md
slug: /fe/blocks/laws/b7-repeat-alignment/vi
sidebar_label: vi.md
sidebar_position: 1
description: Bốn chỗ khối lặp khác khối đơn, và vì sao cột lệch là lỗi nặng nhất của một danh sách.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b7-repeat-alignment` · Luật: [`INDEX.md`](./INDEX.md)

# Hàng phải thẳng cột

Một danh sách tồn tại để **so sánh**. Bỏ đi khả năng so sánh thì nó chỉ còn là mấy dòng chữ xếp
chồng. Cột lệch là cách nhanh nhất để bỏ đi khả năng đó.

## Khối lặp khác khối đơn ở bốn chỗ đo được

Không phải một chỗ, mà bốn — và đây là bốn chỗ hay bị bỏ sót nhất khi dựng một khối lặp:

1. **Số hàng nghỉ không do khối đặt.** Nó đọc ngược từ registry:
   `CONTRACTS[key].children.<slot>.restingCount`. Mười một khối làm thế.
2. **Hàng nghỉ là dữ liệu giả đúng kiểu**, không phải một component skeleton thứ hai. Nhờ vậy cây
   lúc chờ và cây lúc có dữ liệu là **một** cây.
3. **Actions là index signature khoá theo id**: `open:${row.id}`, `follow:${row.id}` — không phải
   callback đặt tên.
4. **Cột thẳng hàng do contract giữ**, bằng một grid template cố định; khối không có cách nào chạm
   vào nó.

## `B7-1` — một grid template, một nơi

```ts
classes: ["grid", "w-full", "grid-cols-[auto_auto_1fr_5rem_2.5rem]", "items-center", "gap-3", ...]
```

Năm cột, khai một lần. Contract còn tự giải thích: hạng và ảnh nhận diện người học, danh tính chiếm
phần rộng, điểm giữ được so sánh, và một kết quả di chuyển hoặc theo dõi ở cuối hàng.

Đây là lý do `B7` được tuân **không phải bằng kỷ luật mà bằng cấu trúc**: khối không có chỗ nào để
viết một chiều rộng cột.

## `B7-2` — mở ra thì thẳng với chỗ bấm

Panel mở ra mang sẵn một khoảng thụt của vendor. Thầy khoanh vùng và nói phần đó không được có
offset. Nội dung mở ra phải bắt đầu ở đúng cột mà trigger bắt đầu, nếu không mắt phải nhảy hai lần
cho một việc.

## `B7-4` — thứ co giãn không ngồi trong cột phải thẳng

Một bản cũ nhét cả câu "leo một bậc" vào một `Badge` ở cuối hàng. Câu đó dài ngắn khác nhau ở mỗi
hàng, nên cột điểm bên cạnh **thôi thẳng**. Thay bằng một caret cố định chiều rộng; câu chữ sống
tiếp dưới dạng nhãn cho trình đọc màn hình.

Bài học rộng hơn: cột cuối của một hàng lặp là chỗ nguy hiểm nhất để đặt một thứ có chiều rộng thay
đổi theo nội dung.
