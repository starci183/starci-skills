---
id: fe-blocks-laws-b6-one-owner-two-hosts-example
title: example.md
slug: /fe/blocks/laws/b6-one-owner-two-hosts/example
sidebar_label: example.md
sidebar_position: 2
description: Ba trường hợp gộp, hai trường hợp giữ riêng, và cách phân biệt chúng bằng anatomy tương tác.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b6-one-owner-two-hosts` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## Gộp: một hàng, ba cách sắp

```tsx
<IconLabelFactRow props={{ icon: "streak", label, endText: value, recipe: "peer" }} isLoading={...} />
<IconLabelFactRow props={{ icon, label: line.label, endText: line.value, recipe: "label-led" }} />
<IconLabelFactRow props={{ icon: item.icon, label: item.title, endText: item.badge, recipe: "compact-action" }} />
```

Bảy nơi dùng, một chủ, ba giá trị `recipe`. Hàng chỉ số trên rail, dòng giá trong modal chi tiết
giá, và hàng phạm vi trong tìm kiếm — cùng một hình, khác cách sắp.

---

## Giữ riêng: cùng leaf, hai anatomy

```tsx
{props.variant === "scopes" && item.icon !== undefined ? (
    <IconLabelFactRow props={{ ... }} />
) : (
    <span className="flex min-w-0 flex-1 items-center gap-2"> ... </span>
)}
{props.variant === "results" ? <ListBox.ItemIndicator /> : null}
```

Nhánh phạm vi dùng chủ chung. Nhánh kết quả không, và điều đó là **cố ý**: hàng kết quả có tiêu đề,
mô tả, dấu chỉ chọn và một cách đọc khác.

---

## Cách phân biệt trong một câu

Hỏi: *hai chỗ này khác nhau ở cái gì?*

| Khác ở | Phán |
|---|---|
| Cách sắp xếp phần nhìn thấy | `B6-4` — một chủ, một `recipe` |
| Nội dung của các ô | một chủ, hai bộ dữ liệu |
| Cách chọn, cách focus, cách điều hướng | `B6-3` — hai chủ |
| Không khác gì cả | `B6-2` — chỗ thứ hai là bản sao thừa |

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "làm giống cái bên kia" | `B6-2` | dùng chung chủ thật, không dựng bản trông giống |
| "gộp hai cái này lại đi" | `B6-6` | liệt kê mọi nơi gọi trước khi gộp |
| "chỗ này cần sắp khác một chút" | `B6-4` | thêm một `recipe`, không thêm prop |
| "dùng luôn hàng chung cho kết quả tìm kiếm" | `B6-3` | đã bị bác — khác anatomy |
