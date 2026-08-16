---
id: fe-blocks-archetypes-bang-danh-sach-co-nhan-example
title: example.md
slug: /fe/blocks/archetypes/bang-danh-sach-co-nhan/example
sidebar_label: example.md
sidebar_position: 2
description: Một khối mẫu đầy đủ, đọc thẳng từ TopLearners.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `bang-danh-sach-co-nhan` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `A1-1` đến `A1-6` trong một file

```tsx
export type TopLearnersActions = {
    readonly [key: string]: (() => void) | undefined
}

export type TopLearnersProps = {
    readonly state: "pending" | "empty" | "failed" | "ready"
    readonly props: TopLearnersData
    readonly on?: TopLearnersActions
}

const ROW_COUNT = CONTRACTS["ranked-user-list"].children.user.restingCount

const TopLearnersListContentView = ({ props, on, isLoading = false }) => (
    <Tree contract="ranked-user-list" render={defineContractComponent("ranked-user-list", {
        user: props.rows.map((row) => defineCompositeComponent("ranked-user-row", {}, () => (
            <RankedUserRow props={row} on={{ open: on?.[`open:${row.id}`], follow: on?.[`follow:${row.id}`] }} isLoading={isLoading} />
        ))),
    })} />
)

export const _TopLearners = (input: TopLearnersProps) => {
    if (input.state === "empty" || input.state === "failed") { /* SurfaceCard + EmptyNotice */ }
    /* ... SurfaceListCard isNested bên trong SurfaceCard ngoài ... */
}
```

---

## Mười một khối đọc `restingCount` từ registry

`ActivityFeed`, `ChangelogList`, `DailyQuest`, `LeagueCard`, `MyCoursesProgress`,
`RecommendedCourses`, `TopLearners`, `TrendingContents`, `UpcomingLivestreamCard`,
`WeeklyChallengeCard`, `WhoToFollow`.

---

## Trông giống nhưng không phải `A1`

| Trường hợp | Archetype đúng |
|---|---|
| Thẻ khoá học trong catalog | `A4` — dữ liệu thuộc về danh sách bên ngoài |
| Bốn hàng chỉ số trên rail | `A2` — không mặt phẳng, một con số mỗi hàng |
| Thẻ league có bảng xếp hạng bên trong | `A3` — hình chính là vị trí, danh sách chỉ là phần phụ |
