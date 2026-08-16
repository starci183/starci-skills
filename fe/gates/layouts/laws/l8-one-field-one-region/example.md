---
id: fe-layouts-laws-l8-one-field-one-region-example
title: example.md
slug: /gates/layouts/laws/l8-one-field-one-region/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp, ngoại lệ và thứ trông giống của bảy mã L8-N, đọc thẳng từ registry contract của repo sống.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `l8-one-field-one-region` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`, đọc
từ `src/components/contracts/index.ts`. Không có ví dụ bịa: một mã không có chỗ nào đang chạy thì
phần ví dụ của nó ghi thẳng là chưa có.

---

## `L8-1` — một dữ kiện, một vùng

### Trường hợp: giá phải trả nằm ở vùng quyết định mua

Rail giá khai đúng một slot cho khối giá, và `why` của nó nói rõ vùng này tồn tại để làm gì.

```ts
"course-pricing-rail": {
    host: "aside",
    children: {
        phase: { leaf: "badge", optional: true },
        cover: { leaf: "cover-image" },
        price: { contract: "course-price-block" },
        selector: { leaf: "choice-tabs", optional: true },
        purchase: { contract: "course-pricing-purchase-intent", optional: true },
        exploration: { contract: "course-pricing-exploration-intent", optional: true },
        ladder: { leaf: "pricing-phase-disclosure", optional: true },
        proof: { leaf: "text", props: { size: "xs" }, optional: true },
    },
    why: "The rail is one complementary decision surface: artwork and price evidence remain visible while a bounded primary choice selects exactly one purchase or exploration intent...",
}
```

Neo: `D:\Repositories\starci-academy-fe\src\components\contracts\index.ts:2387-2406`. Câu hỏi của
vùng là quyết định mua, và giá là câu trả lời trực tiếp cho câu hỏi đó, nên không cần lý do phụ nào.

### Trông giống nhưng không phải `L8-1`

Cùng một leaf ở hai chỗ không phải một trường ở hai nhà. `rating-stars` xuất hiện hai lần trên trang
chi tiết khoá học, và registry tự phân biệt chúng:

```ts
"course-review-author-line": {
    children: {
        name: { leaf: "text", props: { size: "sm", weight: "medium" } },
        score: { leaf: "rating-stars" },
    },
    why: "A name and the score that person gave are one compact reading on one row - the score here is a fact about what THIS person thought rather than about the course - so they form one functional cluster.",
}
```

Neo: `...\contracts\index.ts:2363-2369`, đối chiếu với `course-review-summary` tại `:2338-2345` nơi
`scale` là điểm của cả tập người học. Hai chủ thể khác nhau nên hai trường khác nhau, mỗi trường vẫn
chỉ có một nhà.

---

## `L8-2` — dữ kiện chuyển nhà

### Trường hợp sống: rating rời khỏi khối tiêu đề

```ts
"course-hero-heading": {
    classes: ["flex", "min-w-0", "flex-col"],
    children: {
        identity: { contract: "course-hero-title-stack" },
    },
    why: "Course identity owns the full readable measure; population rating now belongs to the six-cell evidence ribbon with the other comparable course facts.",
}
```

Neo: `...\contracts\index.ts:2255-2260`. Slot đi hết, không để lại bản tạm, và vùng vừa mất dữ kiện
ghi thẳng vào `why` của mình là dữ kiện đó bây giờ thuộc về ai. Đây là nửa đúng của mã này.

Vùng nhận nằm ngay bên dưới:

```ts
"course-signal-board": {
    classes: [
        "grid", "grid-cols-2", "overflow-hidden",
        "[&>*]:p-3", "[&>*:nth-child(odd)]:border-r", "[&>*:nth-child(-n+4)]:border-b",
        "[&>*]:border-separator",
    ],
    children: {
        signal: { contract: "course-signal-card-neutral", repeats: true, restingCount: 6 },
    },
    why: "Six comparable course facts share the HeroUI Card owned by SurfaceCard and read across its ruled cells...",
}
```

Neo: `...\contracts\index.ts:2270-2279`.

### Trông giống nhưng không phải `L8-2`

Ngay bên trong khối tiêu đề, vùng con vẫn kể về rating như một hàng xóm chưa dọn đi:

```ts
"course-hero-title-stack": {
    classes: ["flex", "min-w-0", "grow", "flex-col", "gap-2"],
    children: {
        title: { leaf: "heading" },
        tagline: { leaf: "text", props: { size: "sm" } },
    },
    why: "The course name and its qualifying sentence are one identity statement and keep the flexible measure so a long technical description wraps before it squeezes the rating.",
}
```

Neo: `...\contracts\index.ts:2262-2268`. Không có slot rating nào trong vùng này nữa, nhưng `why` vẫn
lấy rating làm lý do cho chiều rộng. Đây là chuyển nhà nửa vời: slot đã đi, lời giải thích thì chưa.
Nó là một khoản nợ đo được, và nằm trong [`audit.md`](./audit.md) chứ không được đọc như một ví dụ
đúng.

---

## `L8-3` — hai vùng, hai câu hỏi

### Trường hợp: danh sách để lướt không giữ phần mô tả

```ts
"global-search-result-region": {
    classes: ["min-w-0"],
    children: {
        list: { contract: "global-search-surface-list", optional: true },
        notice: { composite: "empty-notice", optional: true },
    },
    why: "The middle region has no label: populated results use the existing nested SurfaceListCard projection, while settled absence replaces the whole list surface with the shared EmptyNotice.",
}
```

Neo: `...\contracts\index.ts:2866-2873`. Không một slot nào cho mô tả, và đó là chủ ý.

### Trường hợp: khung chi tiết giữ phần mô tả

```ts
"global-search-context-card": {
    classes: ["hidden", "min-w-0", "flex-col", "gap-3", "p-4", "md:flex"],
    children: {
        title: { leaf: "text", props: { size: "sm", weight: "medium" } },
        kind: { leaf: "text", props: { size: "xs", tone: "muted" } },
        snippet: { leaf: "text", props: { size: "sm" }, optional: true },
        status: { leaf: "badge", optional: true },
        action: { leaf: "button", optional: true },
    },
    why: "The selected hit's identity, evidence and one canonical way out share a bounded desktop context surface; mobile omits this redundant pane.",
}
```

Neo: `...\contracts\index.ts:2881-2888`. `snippet` chỉ tồn tại ở đây, đúng một nhà.

### Ngoại lệ chưa đóng: dưới `md` thì `snippet` không có nhà nào

Vùng chi tiết mang `hidden ... md:flex`, tức là nó biến mất trên màn hẹp. Vì nó là nhà duy nhất của
`snippet`, dưới breakpoint đó trường này có **không** vùng nào chứ không phải một. Luật nói đúng một,
và không có mã nào phát ra số không. Chi tiết trong [`audit.md`](./audit.md).

---

## `L8-4` — một vùng bằng chứng, nhiều ô

### Trường hợp: sáu ô thay cho sáu vùng

Bản dựng cũ cho mỗi signal một thẻ rời và để rating đứng riêng thêm một chỗ. Bị bác, thay bằng một
card chia sáu ô. Neo từ chối:
`.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:545`, nguyên văn cột `Why` là
"User: “xanh render kiểu ribbon… 1 card và chia làm 6”."

Mỗi ô là một hợp đồng trung tính, không ô nào được ưu tiên bằng màu:

```ts
"course-signal-card-neutral": {
    classes: ["flex", "min-w-0", "flex-col", "gap-2"],
    children: { label: { leaf: "text", props: { size: "xs", tone: "muted" } }, value: { leaf: "text", props: { size: "sm", weight: "medium" } } },
    why: "All six comparable facts remain neutral peers inside one ruled card; no fact receives decorative color priority over another.",
}
```

Neo: `...\contracts\index.ts:2281-2284`.

### Trông giống nhưng không phải `L8-4`

Sáu ô ở đây khai bằng `repeats: true, restingCount: 6` chứ không khai tên từng dữ kiện. Nghĩa là
registry biết vùng này có sáu ô nhưng không biết ô nào giữ rating. Đọc contract thì không kiểm được
`L8-4` trên chính ví dụ mạnh nhất của nó, và đó là giới hạn đã ghi trong [`audit.md`](./audit.md),
không phải một điểm mạnh.

---

## `L8-5` — đếm trước, đặt sau

### Trường hợp: một dòng không xuống hàng

```ts
"price-note-row": {
    classes: ["flex", "flex-row", "flex-nowrap", "items-center", "gap-2", "[&>*]:whitespace-nowrap"],
    children: {
        fact: { leaf: "text", props: { size: "xs", tone: "muted" }, optional: true },
        action: { leaf: "text-link", props: { size: "xs" } },
    },
    why: "What a price saves and the way to see how it was reached are one thought, so they share a line at the reserved caption step...",
}
```

Neo: `...\contracts\index.ts:2175-2181`. `flex-nowrap` cộng `whitespace-nowrap` là cách hợp đồng giữ
lời hứa "một ý một dòng" ngay cả khi cột hẹp lại.

### Trông giống nhưng không phải `L8-5`

Trong cùng rail, phần khan hiếm lại **được** tách ra một bậc:

```ts
"course-price-block": {
    classes: ["flex", "flex-col", "gap-2"],
    children: {
        primary: { contract: "course-price-primary-group" },
        scarcity: { leaf: "badge", optional: true },
    },
    why: "Scarcity affects timing rather than the price calculation itself, so it sits one spacing step away from the compact price-and-saving group.",
}
```

Neo: `...\contracts\index.ts:2456-2462`. Khan hiếm nói về thời điểm chứ không tham gia vào phép tính
giá, nên nó là dữ kiện thứ hai thật và được một slot riêng. Phân biệt với ví dụ trên nằm ở câu hỏi
*xoá vế sau thì vế trước còn hoàn chỉnh không*, và ở đây thì còn.

---

## `L8-6` — hai vùng loại trừ nhau theo breakpoint

### Trường hợp: giá ở rail và giá ở thanh đáy

```ts
"course-mobile-action-bar": {
    classes: ["sticky", "bottom-0", "z-40", "flex", "flex-row", "items-center", "justify-between", "gap-3", "border-t", "border-separator", "bg-background", "px-4", "py-3", "md:hidden"],
    children: {
        price: { contract: "price-discount-line" },
        action: { leaf: "button" },
    },
    why: "Below the rail's breakpoint the purchase decision would scroll away entirely, so the price and its one action pin to the bottom edge and step aside as soon as the rail can hold them again.",
}
```

Neo: `...\contracts\index.ts:2581-2588`. `md:hidden` nằm trên chính vùng khai trùng, không nằm trên
wrapper nào, nên bằng chứng loại trừ đọc được ngay tại chỗ bản sao xuất hiện.

### Trông giống nhưng không phải `L8-6`

Trang học có một thanh đáy gần y hệt về hình, cũng `sticky bottom-0 md:hidden`, nhưng nó không phải
bản sao của bất cứ trường nào:

```ts
"learn-mobile-tab-bar": {
    host: "nav",
    children: {
        tab: { leaf: "nav-link", props: { kind: "tab" }, repeats: true, restingCount: 3 },
    },
    why: "...It is a NAV of peers rather than the action bar it shares a shape with: those two differ in what sits inside them, which is exactly what a key is for - one holds a price and the thing that buys it, this holds destinations, and no reader should have to tell them apart by guessing.",
}
```

Neo: `...\contracts\index.ts:322-328`. Cùng hình dạng không phải cùng vai trò, và `why` ở đây tự nói
ra điều đó. Nó là điều hướng dưới `md`, tức thuộc `L8-7` nếu có vùng điều hướng thứ hai, chứ không
phải `L8-6`.

---

## `L8-7` — hai vai trò, một loại điều khiển

### Trường hợp: breadcrumb ở trong thân, tabs ở sát navbar

```ts
"course-hero": {
    host: "section",
    children: {
        trail: { leaf: "breadcrumbs" },
        heading: { contract: "course-hero-heading" },
        evidence: { contract: "course-signal-board" },
        section: { contract: [...], repeats: true, restingCount: 2 },
    },
    why: "The route trail first restores where the reader came from... Section tabs do not replace this ancestry.",
}
```

Neo: `...\contracts\index.ts:2248` cho slot `trail`, và `...\contracts\index.ts:2226-2231` cho
`course-section-navigation`, nơi `why` đóng lại bằng câu "the breadcrumb inside the narrative
separately preserves route ancestry".

Neo từ chối: `.workflows\fidel\starci-academy\course-detail-ownership-and-rail.md:440`, nguyên văn
cột `Why` là "User hỏi trực tiếp vì sao bên trái không có breadcrumbs. Trò nhận sai vì đã loại nó
khỏi concept."

### Trông giống nhưng không phải `L8-7`

Navbar chính vẫn lặp lại `Trang chủ / Khóa học / Liên hệ` ngay phía trên tabs của trang chi tiết, và
đó là một vi phạm đã đo được chứ không phải hai vai trò. Cả hai hàng cùng trả lời *đi đâu tiếp*, nên
việc viết thêm chữ "vai trò" lên trên không cứu được nó. Xem
[`gates/layouts/INDEX.md`](../../INDEX.md) mục `Live breaches`, neo `ShellNav\index.tsx:113-121`.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "chỗ này hiện thêm cái giá nữa cho tiện" | hỏi lại | *vùng kia đang trả lời câu hỏi nào, và giá có phải câu trả lời cho nó không?* |
| "cho nó xuống dòng cho thoáng" | `L8-5` | đếm lại trước, xuống dòng biến một ý thành hai dữ kiện |
| "mấy con số này tách ra thành từng thẻ" | `L8-4` | một vùng bằng chứng, mỗi ô một dữ kiện |
| "đưa mô tả vào từng hàng danh sách" | `L8-3` | danh sách giữ danh tính, khung chi tiết giữ mô tả |
| "trên điện thoại thì ghim giá xuống đáy" | `L8-6` | class loại trừ phải nằm trên chính vùng hẹp |
| "có tabs rồi thì bỏ breadcrumb đi" | `L8-7` | hai câu hỏi khác nhau, cả hai ở lại |
| "chuyển cái này sang vùng kia" | `L8-2` | chuyển nguyên slot, và sửa `why` của vùng cũ trong cùng lần thay đổi |
