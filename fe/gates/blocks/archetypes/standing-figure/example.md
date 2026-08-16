---
id: fe-blocks-archetypes-standing-figure-example
title: example.md
slug: /gates/blocks/archetypes/standing-figure/example
sidebar_label: example.md
sidebar_position: 2
description: Toàn bộ một khối A2, cả hai nửa.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `standing-figure` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## Nửa thuần

```tsx
export type StreakStatRowProps =
    | { readonly state: "empty" }
    | { readonly state: "pending"; readonly props: { readonly label: string } }
    | { readonly state: "settled"; readonly props: { readonly label: string; readonly value: string } }

export const _StreakStatRow = (input: StreakStatRowProps) => input.state === "empty" ? null : (
    <IconLabelFactRow
        props={{ icon: "streak", label: input.props.label, endText: input.state === "settled" ? input.props.value : undefined, recipe: "peer" }}
        isLoading={input.state === "pending"}
    />
)
```

---

## Nửa nối thế giới

```tsx
const hasFailed = weekly.error !== undefined && weekly.error !== null
const isLoading = weekly.data === undefined && !hasFailed
if (isLoading) return <_StreakStatRow state="pending" props={{ label: t("streak") }} />
if (hasFailed || !weekly.data) return <_StreakStatRow state="empty" />
return <_StreakStatRow state="settled" props={{ label: t("streak"), value: t("days", { count: weekly.data.streak ?? 0 }) }} />
```

---

## Ánh xạ

| Yêu cầu nghe được | Archetype |
|---|---|
| "hiện số xu còn lại trên rail" | `A2` |
| "hiện xu và hạn mức AI trong một hàng" | hai khối `A2`, không phải một |
| "cho cái hàng đó vào card" | không — contract vùng đã khai dải trần |
