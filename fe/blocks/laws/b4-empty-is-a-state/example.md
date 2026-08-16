---
id: fe-blocks-laws-b4-empty-is-a-state-example
title: example.md
slug: /fe/blocks/laws/b4-empty-is-a-state/example
sidebar_label: example.md
sidebar_position: 2
description: Mã sống cho từng mã B4-N và bốn hình dạng rỗng đang tồn tại trong repo.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b4-empty-is-a-state` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `B4-1` và `B4-2` — một vỏ, hai nhánh

```tsx
if (input.state === "empty" || input.state === "failed") {
    const message = input.state === "empty" ? input.props.emptyMessage : input.props.errorMessage
    return (
        /* SurfaceCard contract="empty-notice-card" bọc EmptyNotice; chỉ nhánh failed mang retry */
    )
}
```

Mười một khối tự chủ dữ liệu dựng `EmptyNotice` thật theo đúng khuôn này: `ContinueLearning`,
`DailyQuest`, `JobReadinessWidget`, `LeagueCard`, `MyCoursesProgress`, `RecommendedCourses`,
`StreakStrip`, `TopLearners`, `UpcomingLivestreamCard`, `WeeklyChallengeCard`, `WeeklyGoals`.

---

## `B4-3` — chưa trả lời thì không phải rỗng

```tsx
expect(container.querySelector("[data-loading=\"true\"]")).not.toBeNull()
expect(container.querySelector("[data-component=\"EmptyNotice\"]")).toBeNull()
```

Đây là gate duy nhất trong repo kiểm hành vi trạng thái của khối, và nó khoá đúng cặp nhầm lẫn này
trên mười ba khối.

### Thang bốn bậc, đọc envelope đúng thứ tự

```tsx
const state = challenge.error !== undefined && data === undefined
    ? "failed"
    : data === undefined
        ? "pending"
        : data === null
            ? "empty"
            : "ready"
```

---

## `B4-4` — biến mất, có lý do viết ra

```tsx
// A failure is a SETTLED answer, not a wait: SWR retries a rejected key on a backoff and
// reports `isLoading` again each time, so a row reading the flag alone shimmers for as long as
// the backend is unreachable - which is exactly what a signed-out reader sees.
const hasFailed = weekly.error !== undefined && weekly.error !== null
const isLoading = weekly.data === undefined && !hasFailed
if (isLoading) return <_StreakStatRow state="pending" props={{ label: t("streak") }} />
if (hasFailed || !weekly.data) return <_StreakStatRow state="empty" />
```

Câu chú thích chính là bằng chứng. Không có nó, đây là `B4-5`.

---

## `B4-6` — hình dạng bị bác

```tsx
const message = error ? errorMessage : emptyMessage
// ... rồi message được đẩy vào danh sách như một hàng mang globalId: "state"
```

Sáu file phẳng ở `blocks/profile/overview/` đều làm thế. Đây cũng là nhóm nằm ngoài luật file-layout
của lint, nên không gate nào thấy chúng.

---

## `B4-7` — điều khiển trỏ vào chỗ không có

Một tab FAQ chết bị bác: mọi tab phải trỏ tới nội dung có thật. Cách sửa không phải là để tab đó
hiện một notice rỗng — mà là bỏ tab, cho tới khi có nội dung.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "chưa có khoá nào thì ẩn đi cho gọn" | `B4-1` | rỗng phải hiện rõ |
| "chưa đăng nhập thì đừng hiện" | `B4-4` | viết lý do vào docstring |
| "lúc load thì hiện chữ chưa có gì" | `B4-3` | sai — pending vẽ cây sẵn sàng với `isLoading` |
| "cho luôn một dòng ghi chưa có gì vào danh sách" | `B4-6` | một câu không phải một dòng dữ liệu |
| "để cái tab đó đấy, sau có nội dung" | `B4-7` | bỏ tab |
