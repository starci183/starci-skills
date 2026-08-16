---
id: fe-blocks-laws-b7-repeat-alignment-example
title: example.md
slug: /gates/blocks/laws/b7-repeat-alignment/example
sidebar_label: example.md
sidebar_position: 2
description: Mã sống cho năm mã B7-N và cách một khối lặp đúng chuẩn được lắp.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b7-repeat-alignment` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

---

## `B7-3` và `B7-5` — một khối lặp đúng chuẩn

```tsx
const ROW_COUNT = CONTRACTS["ranked-user-list"].children.user.restingCount

const TopLearnersListContentView = ({ props, on, isLoading = false }) => (
    <Tree contract="ranked-user-list" render={defineContractComponent("ranked-user-list", {
        user: props.rows.map((row) => defineCompositeComponent("ranked-user-row", {}, () => (
            <RankedUserRow
                props={row}
                on={{ open: on?.[`open:${row.id}`], follow: on?.[`follow:${row.id}`] }}
                isLoading={isLoading}
            />
        ))),
    })} />
)
```

Số hàng nghỉ đọc từ registry. Hành động khoá theo id. Cùng một cây cho lúc chờ và lúc có dữ liệu.

### Trông giống nhưng sai

- `const ROW_COUNT = 3` — khối tự chọn. Con số sẽ lệch với contract ngay lần đầu contract đổi.
- Một `TopLearnersSkeleton` riêng — cây thứ hai, và hai cây sẽ trôi khỏi nhau.
- `on={{ openRow1, openRow2 }}` — không mở rộng được theo số hàng.

---

## `B7-4` — cột cuối phải cố định

```
MOVEMENT IS A CARET, NOT A SENTENCE. An earlier version put the whole localized phrase for
"climbed one place" in a Badge, which is a different width on every row - so the points column
beside it stopped lining up, and a column that does not line up is the one thing a leaderboard
cannot afford.
```

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "mấy cột này lệch nhau" | `B7-1` | sửa grid template của contract hàng |
| "mở ra bị thụt vào" | `B7-2` | bỏ offset mặc định của vendor |
| "lúc chờ hiện mấy dòng?" | `B7-3` | đọc `restingCount`, đừng chọn |
| "cho một badge ghi rõ leo mấy bậc" | `B7-4` | chiều rộng đổi theo hàng → phá cột |
| "mỗi hàng một nút theo dõi" | `B7-5` | khoá theo id hàng |
