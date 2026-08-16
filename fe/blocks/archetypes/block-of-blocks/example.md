---
id: fe-blocks-archetypes-block-of-blocks-example
title: example.md
slug: /fe/blocks/archetypes/block-of-blocks/example
sidebar_label: example.md
sidebar_position: 2
description: Hai composer đang chạy, một chuẩn và một mang ngoại lệ.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `block-of-blocks` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `A5-2` — composer chuẩn

```tsx
export const IdentityRail = () => (
    <Tree
        contract="profile-over-stat-rows"
        render={defineContractComponent("profile-over-stat-rows", {
            profile: defineCompositeComponent("profile-row", {}, () => <ProfileIdentityRow />),
            stats: defineContractComponent("stacked-stat-rows", {
                stat: [
                    defineCompositeComponent("icon-label-fact-row", {}, () => <StreakStatRow />),
                    defineCompositeComponent("icon-label-fact-row", {}, () => <CreditStatRow />),
                    defineCompositeComponent("icon-label-fact-row", {}, () => <RewardStatRow />),
                ],
            }),
        })}
    />
)
```

Không props xuống con. Không state. Không request.

---

## `A5-4` — ngoại lệ overlay

```tsx
export const CoursesTab = () => {
    const [pricedCourseId, setPricedCourseId] = useState<string | undefined>(undefined)
    return (
        <>
            <Tree contract="dashboard-tab-main" render={...} />
            <CoursePriceOverlay courseId={pricedCourseId} isOpen={pricedCourseId !== undefined} onDismiss={...} />
        </>
    )
}
```

Con duy nhất nhận prop là `RecommendedCourses`, và prop đó là một **outcome gửi lên**
(`onOpenPriceDetail`), không phải dữ liệu.

---

## Ánh xạ

| Yêu cầu nghe được | Archetype |
|---|---|
| "cột trái gồm ba hàng chỉ số" | `A5` |
| "tab khoá học gồm ba khối" | `A5` |
| "vùng này cần biết cả ba khối đã tải xong chưa" | không — đó là gộp cờ, và `b11` cấm |
