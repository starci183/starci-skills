---
id: fe-blocks-laws-b3-block-owns-its-frame-example
title: example.md
slug: /gates/blocks/laws/b3-block-owns-its-frame/example
sidebar_label: example.md
sidebar_position: 2
description: Mã sống cho sáu mã B3-N, kèm chỗ vi phạm và chỗ ngoại lệ hợp lệ.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b3-block-owns-its-frame` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `B3-2` — ngoại lệ hợp lệ duy nhất: một viewport có tên

```tsx
<ScrollViewport
    boundary="pricing-rail"
    render={defineContractComponent("course-pricing-rail", { ... })}
/>
```

Ranh giới có **tên**, nên nó tra được, đo được và tái sử dụng được. Đây là khối duy nhất trong toàn
tầng dùng `ScrollViewport`, và cũng là `component.tsx` duy nhất mang `'use client'`.

### Trông giống nhưng bị bác

- Bọc `ScrollShadow` ra ngoài Card.
- Dán `overflow-y-auto` lên con trực tiếp của layout sticky.
- `max-h-[80vh]` gõ tay trong khối.

---

## `B3-5` — vùng cấp vị trí, khối không hỏi

```ts
"dashboard-rail-then-main": {
    classes: [..., "md:[&>*:first-child]:w-72", "md:[&>*:first-child]:shrink-0", ...],
    children: { rail: { contract: "dashboard-rail" }, main: { contract: [...] } },
    why: "The learner rail keeps the product's fixed 288px reading width beside a flexible main column, ...",
}
```

Chiều rộng nằm ở đây. Khối trên rail không biết nó rộng bao nhiêu, và không cần biết.

### Vi phạm sống

```tsx
style={{ position: "fixed", right: 16, bottom: 16, zIndex: 50 }}
```

Một inline style duy nhất trong toàn tầng, và nó nói đúng cái điều `B3-5` cấm.

---

## `B3-6` — không sơn được vì không biểu diễn được

```ts
/**
 * The closed set of classes a node may lay its children out with.
 *
 * `gap-[13px]` is not forbidden - it is UNREPRESENTABLE, because it is not a member.
 */
export type LayoutClassName = ...
```

Đây là lý do `B3-6` không cần một luật tuần tra: giá trị sai không gõ được.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "cái này sát mép quá" | `B3-1` | khối tự sửa |
| "danh sách dài quá, cho cuộn đi" | `B3-2` | cuộn **trong** khung, khung đứng yên |
| "cao tối đa 80% màn hình" | `B3-3` | token có tên, không phải giá trị gõ tay |
| "cho chọn mua hay học thử" | `B3-4` | state cục bộ, không lên URL |
| "đẩy nó sang phải một chút" | `B3-5` | sửa contract của vùng, không sửa khối |
| "cho nó nổi ở góc màn hình" | `B3-5` | đây là quyết định của trang, không của khối |
