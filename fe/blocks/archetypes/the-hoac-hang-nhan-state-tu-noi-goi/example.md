---
id: fe-blocks-archetypes-the-hoac-hang-nhan-state-tu-noi-goi-example
title: example.md
slug: /fe/blocks/archetypes/the-hoac-hang-nhan-state-tu-noi-goi/example
sidebar_label: example.md
sidebar_position: 2
description: Hai khối A4 đang chạy và ranh giới với B12.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `the-hoac-hang-nhan-state-tu-noi-goi` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `A4-1` — props công khai

```tsx
readonly course: CourseCatalogCardData
readonly onView?: () => void
readonly onOpenPriceDetail?: () => void
```

Danh tính, cộng hai outcome gửi lên. Không có gì khác.

---

## `A4-3` — mutation đè state

```tsx
export const CartLine = ({ state = "ready", line }: CartLineProps) => {
    const { mutate } = useSWRConfig()
    const removal = useMutateRemoveFromCartSwr(state === "pending" ? undefined : line.courseId)
    return <_CartLine state={removal.isMutating ? "removing" : state} props={line} on={{ ... }} />
}
```

---

## `A4-4` — không đọc lỗi, và đúng

| Khối | Đọc `.error`? | Phán |
|---|---|---|
| `CartLine` | không | đúng — không sở hữu request |
| `CourseCatalogCard` | không | đúng — không sở hữu request |
| `AccountMenu` | không | đúng — không sở hữu request |
| `ProfileHero` | không | **sai** — có sở hữu request |

---

## Ánh xạ

| Yêu cầu nghe được | Archetype |
|---|---|
| "mỗi khoá một thẻ trong catalog" | `A4` |
| "thẻ tự lấy dữ liệu khoá của nó" | không — đó là N+1 request; danh sách lấy |
| "hàng giỏ hàng có nút xoá" | `A4`, mutation thuộc về hàng |
