---
id: fe-blocks-archetypes-purchase-column-example
title: example.md
slug: /gates/blocks/archetypes/purchase-column/example
sidebar_label: example.md
sidebar_position: 2
description: Rail và bản thanh ngang, đọc cạnh nhau.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `purchase-column` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `A7-1` — enum phẳng

```tsx
export type CoursePricingRailState = "ready" | "price-pending" | "adding" | "trialing" | "checking-out"
```

Ba giá trị cuối là mutation, hai giá trị đầu là nghiệp vụ. Đây là chỗ hình dạng `enum-phang` được
dùng có chủ ý, và kế hoạch phải khai như vậy.

---

## `A7-2` — viewport có tên

```tsx
<ScrollViewport boundary="pricing-rail" render={defineContractComponent("course-pricing-rail", { ... })} />
```

---

## `A7-3` — bản thanh ngang mượn tình huống

```tsx
/** The situations the bar can be in - the rail's, because it shows the rail's number. */
export type CourseMobileEnrollBarState = "ready" | "price-pending"
```

---

## Ánh xạ

| Yêu cầu nghe được | Archetype |
|---|---|
| "cột giá bên phải" | `A7` |
| "trên mobile hiện thanh giá dưới đáy" | `A7`, bản twin, mượn state |
| "gộp hết nút lại cho gọn" | bị bác — mất học thử và giỏ hàng |
