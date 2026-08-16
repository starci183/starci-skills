---
id: fe-blocks-laws-b12-error-owner-example
title: example.md
slug: /fe/blocks/laws/b12-error-owner/example
sidebar_label: example.md
sidebar_position: 2
description: Ba hình dạng đọc lỗi, một hình dạng đúng mà trông sai, và một hình dạng sai mà trông đúng.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b12-error-owner` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `B12-2` — vô hình, nhưng có lý do viết ra

```tsx
const hasFailed = quota.error !== undefined && quota.error !== null
const isLoading = quota.data === undefined && !hasFailed
if (isLoading) return <_CreditStatRow state="pending" props={{ label: t("aiCredit") }} />
if (hasFailed || credit === undefined) return <_CreditStatRow state="empty" />
```

Lỗi **được đọc**, rồi mới được quyết định là không hiển thị. Đó là khác biệt giữa `B12-2` và
`B12-3`.

---

## `B12-3` — vi phạm sống

```tsx
state={profile.data === undefined ? "pending" : "ready"}
```

Không có `.error` ở đâu cả. Không có nhánh nào để đi tới khi query hỏng.

---

## `B12-4` — không đọc lỗi và đúng

```tsx
state={cart.isMutating ? "adding" : state}
```

`state` đến từ danh sách. Nếu khối này tự dựng một nhánh lỗi, nó đang nói về một request nó không sở
hữu.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "hỏng thì hiện gì?" | `B12-1` | notice cộng nút đọc lại |
| "chưa đăng nhập thì đừng hiện lỗi" | `B12-2` | đọc lỗi trước, rồi mới quyết định không vẽ, và ghi lý do |
| "khối này chưa xử lý lỗi" | `B12-3` | kiểm ngay: có `.error` trong file không |
| "hàng trong danh sách thì báo lỗi thế nào?" | `B12-4` | không báo; danh sách báo |
| "trên mobile không có chỗ hiện lỗi" | `B12-5` | đẩy lỗi lên tầng mọi bố cục đều thấy |
