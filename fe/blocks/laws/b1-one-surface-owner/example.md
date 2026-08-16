---
id: fe-blocks-laws-b1-one-surface-owner-example
title: example.md
slug: /fe/blocks/laws/b1-one-surface-owner/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp, ngoại lệ và thứ trông giống của bảy mã B1-N, đọc thẳng từ mã sống.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `b1-one-surface-owner` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`.
Không có ví dụ bịa: một mã không có chỗ nào đang chạy thì phần ví dụ của nó ghi thẳng là chưa có.

---

## `B1-1` — một card

### Trường hợp: thẻ tổng kết một chỉ số

```tsx
<SurfaceCard
    contract="weekly-challenge-card"
    props={{ label: input.props.label, seeMore: input.props.seeMoreLabel }}
    render={...}
/>
```

Một nhãn, một hình chính, một nút. Không có viền thứ hai ở bất kỳ đâu trong cây.

### Ngoại lệ: nhiều signal, vẫn một card

Trang chi tiết khoá học từng vẽ năm thẻ signal rời và một ô rating đứng riêng. Bị bác; thay bằng
một card chia sáu ô. Sáu ô so sánh được với nhau nên chúng phải ngồi trong cùng một khung.

### Trông giống nhưng không phải `B1-1`

Một hành động đơn lẻ bọc trong một card. Một điều khiển không phải là một nhóm, nên nó không có gì
để sở hữu.

---

## `B1-2` — một list card

### Trường hợp: bảng xếp hạng

`ranked-user-list` khai `divide-y divide-separator`, `p-0` và khoảng đệm bơm vào từng hàng. Đường
phân cách làm việc gộp nhóm, nên không hàng nào cần viền riêng.

### Trường hợp: review của khoá học

Mỗi review một `SurfaceCard` đã bị bác hai vòng liền, thay bằng một `SurfaceListCard` với các hàng
ngăn bằng divider — theo đúng câu của thầy: "dính lại vào nhau kiểu surface list card".

---

## `B1-3` — không mặt phẳng

### Trường hợp: hàng chỉ số trên rail

```tsx
export const _StreakStatRow = (input: StreakStatRowProps) => input.state === "empty" ? null : (
    <IconLabelFactRow props={{ icon: "streak", label: input.props.label, ... }} isLoading={...} />
)
```

Không một import nào từ `components/branches/`. Cả bốn khối chỉ số trên rail đều như vậy, và
contract của vùng là nơi khai dải trần.

### Trông giống nhưng không phải `B1-3`

Một khối trả `null` ở trạng thái rỗng **không** phải là `B1-3`. `B1-3` nói về việc không dựng mặt
phẳng khi đang vẽ; trả `null` là không vẽ gì cả, và đó là chuyện của
[`b4-empty-is-a-state`](../b4-empty-is-a-state/INDEX.md).

---

## `B1-4` — lồng và khai báo

### Trường hợp sống: `TopLearners`

```tsx
const list = defineContractProjection("ranked-user-list", () => (
    <SurfaceListCard
        contract="ranked-user-list"
        render={TopLearnersListContent}
        props={{ label: input.props.label, rows, isNested: true, isLabelHidden: true }}
        on={input.on}
        isLoading={isLoading}
    />
))
return (
    <SurfaceCard ... />
)
```

Ba điều kiện đủ cả: hàng đồng hạng, nhóm gọi được tên là "bảng xếp hạng", và cờ khai tường minh.
Nhãn bị ẩn ở đây hợp lệ vì `SurfaceCard` bên ngoài đang vẽ đúng cái nhãn đó — nhưng đó là phán
quyết của [`b9`](../b9-list-label-owner/INDEX.md), không phải hệ quả của việc lồng.

### Sơn của chế độ lồng

```css
.card[data-component="SurfaceListCardSurface"][data-surface-context="nested"] {
    border: 1px solid var(--border) !important;
    box-shadow: none !important;
}
```

Một luật, một nơi. Không call site nào tự viết viền.

### Ngoại lệ: `B1-4` bên trong overlay

Danh sách kết quả ở cột giữa của Global Search giữ `SurfaceListCard` với `isNested: true`, vì nó là
một đối tượng bên trong có thật. Đây là ngoại lệ duy nhất được phán cho `B1-7`.

### Chưa biểu diễn được

Một `SurfaceCard` hoặc `SurfaceFormCard` cần chế độ lồng: **không có API**. Chỉ
`SurfaceListCard` khai `isNested`. Trường hợp này phải báo là nợ, không được tự sơn viền ở call
site — vì cái viền tự sơn chính là cái viền trang trí mà luật cấm.

---

## `B1-5` — hai nhánh loại trừ nhau

```tsx
if (input.state === "empty" || input.state === "failed") {
    const message = input.state === "empty" ? input.props.emptyMessage : input.props.errorMessage
    return ( /* SurfaceCard contract="empty-notice-card" */ )
}
/* ... nhánh sẵn sàng trả SurfaceListCard ... */
```

Năm khối khác cũng import cả hai thành viên của họ Surface mà không lồng: `ActivityFeed`,
`DailyQuest`, `MyCoursesProgress`, `RecommendedCourses`, `UpcomingLivestreamCard`.

---

## `B1-6` — làm phẳng

### Trường hợp: hai ý định trong cột giá

Hai card lồng cho *mua* và *học thử* bị bác. Thay bằng hai nhóm ngữ nghĩa có tên trong cùng một
`SurfaceCard`; sự tách biệt do thứ bậc làm, không do card.

### Trường hợp: viền ngoài do contract vẽ chồng lên Card của vendor

Cạnh đôi làm bóng phía dưới trông nặng và ngả nâu. Bỏ lớp sơn ngoài, giữ Card của vendor làm chủ
duy nhất. Một regression test hiện chặn việc vẽ lại lớp đó.

---

## `B1-7` — overlay

### Trường hợp: Global Search

`SurfaceCard` trong overlay bị bác hai lần trong cùng một hồ sơ. Vùng nội dung của overlay là các
region `Tree` phẳng.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "cho cái này vào card đi" | `B1-1` | trừ khi vùng chứa đã khai dải trần → `B1-3` |
| "mấy cái này dính lại với nhau" | `B1-2` | đường phân cách, không phải nhiều card |
| "tách hai phần này ra cho rõ" | `B1-6` | thứ bậc và nhóm có tên, không phải card lồng card |
| "bảng xếp hạng nằm trong thẻ league" | `B1-4` | phải khai `isNested` và tên chủ ngoài |
| "modal này thêm card cho gọn" | `B1-7` | overlay đã là mặt phẳng |
| "trông thiếu viền" | hỏi lại | *viền này sở hữu nhóm nào mà chủ ngoài không sở hữu?* |
