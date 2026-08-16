---
id: fe-blocks-laws-b11-pending-owner-example
title: example.md
slug: /gates/blocks/laws/b11-pending-owner/example
sidebar_label: example.md
sidebar_position: 2
description: Ba hình dạng chủ pending đang chạy trong repo và một hình dạng bị bác.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b11-pending-owner` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `B11-1` — cờ riêng, để ngoài `state`

```tsx
const [isClaiming, setIsClaiming] = useState(false)
```

Nó đi xuống trong `props`, không nhét vào `state`. Nhờ vậy tập state của khối vẫn là tập tình huống
nghiệp vụ, không lẫn cơ chế.

---

## `B11-2` — bốn khối đang so theo id

`MyCoursesProgress`, `TopLearners`, `WhoToFollow`, `UpcomingLivestreamCard` đều giữ một id đang chờ
và so từng dòng.

---

## Hình dạng bị bác

| Bị bác | Thay bằng |
|---|---|
| Một state `adding` cho cả checkout và giỏ hàng | ba chủ pending riêng |
| Một `isLoading` cho ba request trong một component | ba khối |
| Một boolean `isPending` cho cả danh sách | so `pendingId === row.id` |

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "thêm loading cho cái nút này" | `B11-1` | cờ riêng, không nhét vào `state` |
| "hàng nào bấm thì hàng đó quay" | `B11-2` | giữ id, không giữ boolean |
| "khối này đọc luôn cả xu và hạn mức AI" | `B11-3` | hai đơn vị settle → hai khối |
