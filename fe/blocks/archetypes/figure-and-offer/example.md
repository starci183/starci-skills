---
id: fe-blocks-archetypes-figure-and-offer-example
title: example.md
slug: /fe/blocks/archetypes/figure-and-offer/example
sidebar_label: example.md
sidebar_position: 2
description: Mã sống của WeeklyChallengeCard, đủ cả sáu bước.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `figure-and-offer` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `A3-4` và `A3-5`

```tsx
const [isClaiming, setIsClaiming] = useState(false)
const state = challenge.error !== undefined && data === undefined
    ? "failed"
    : data === undefined ? "pending" : data === null ? "empty" : "ready"
```

Cờ nhận thưởng nằm ngoài `state`. `state` giữ nguyên là tình huống nghiệp vụ.

---

## `A3-6`

```tsx
? defineLeafComponent("badge", {}, () => <Badge props={{ content: input.props.claimedLabel ?? "", tone: "success" }} />)
```

Badge thế chỗ nút, không phải nút xám.

---

## Ánh xạ

| Yêu cầu nghe được | Archetype |
|---|---|
| "thẻ hiện hạng của tôi trong league" | `A3` |
| "thẻ hiện danh sách bạn học" | `A1` |
| "thẻ có nút nhận thưởng" | `A3`, và kiểm mutation trước |
| "nhận rồi thì nút xám đi" | `A3-6` — không xám, biến mất |
