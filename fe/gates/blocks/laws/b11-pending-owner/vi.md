---
id: fe-blocks-laws-b11-pending-owner-vi
title: vi.md
slug: /gates/blocks/laws/b11-pending-owner/vi
sidebar_label: vi.md
sidebar_position: 1
description: Mỗi hành động một cờ chờ, và cái giá đo được của việc gộp ba request vào một cờ.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `b11-pending-owner` · Luật: [`INDEX.md`](./INDEX.md)

# Mỗi hành động một chủ chờ

Cái spinner nói với người dùng một câu: *cái bạn vừa bấm đang chạy*. Khi ba nút dùng chung một cờ,
câu đó thành sai ở hai nút — và người dùng bấm lại, hoặc bỏ đi.

Thầy bác đúng một dòng cho chuyện này: một state `adding` dùng chung cho cả thanh toán lẫn giỏ hàng,
thay bằng **ba** chủ pending riêng.

## Bảng tra

| Mã | Tình huống | Luật |
|---|---|---|
| `B11-1` | Khối có nhiều hành động | mỗi hành động một cờ, tên theo việc nó làm |
| `B11-2` | Khối lặp, mỗi hàng một hành động | khối giữ **id hàng đang chờ** và so từng hàng |
| `B11-3` | Một component đọc nhiều request | tách ra — mỗi đơn vị settle một khối |
| `B11-4` | Mutation của chính phần tử đang chạy | cờ mutation **đè** lên state mà nơi gọi đưa xuống |
| `B11-5` | Khoá request chưa giải | vẽ đang tải, và **không** vẽ rỗng |

## `B11-3` — cái giá đã đo được

Một component từng đọc ba request và cho chúng chung một cờ. Kết quả: cái ví trả lời trong tám mươi
mili giây phải chờ hạn mức AI mất sáu trăm. Năm trăm hai mươi mili giây người đọc ngồi nhìn một con
số đã có sẵn.

Đó là lý do "một khối một đơn vị settle" không phải chuyện gọn gàng. Ba request settle ở ba thời
điểm, nên chúng là ba khối.

## `B11-2` — khối lặp giữ id, không giữ boolean

```tsx
const [pendingId, setPendingId] = useState<string>()
const rows = (query.data ?? []).map((course) => ({
    ...toRow(course, {...}),
    isPending: pendingId === course.globalId,
}))
```

Một boolean cho cả danh sách sẽ làm mười hàng cùng quay khi người dùng bấm một hàng.

## `B11-4` — mutation đè state, không thành state mới

Một thẻ khoá học trong catalog nhận `state` từ danh sách và chỉ sở hữu mutation của chính nó:

```tsx
state={cart.isMutating ? "adding" : state}
```

Nó không thêm `adding` vào tập state của mình; nó đè lên trong lúc chạy. Lỗi vẫn thuộc về danh sách
— xem [`b12`](../b12-error-owner/INDEX.md).
