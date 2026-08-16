---
id: fe-layouts-laws-l10-region-width-belongs-to-its-owner-example
title: example.md
slug: /gates/layouts/laws/l10-region-width-belongs-to-its-owner/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp, ngoại lệ và thứ trông giống của sáu mã L10-N, đọc thẳng từ registry contract của repo sống.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `l10-region-width-belongs-to-its-owner` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`, đọc
từ `src/components/contracts/index.ts` trừ khi ghi đường dẫn khác. Không có ví dụ bịa: một mã không
có chỗ nào đang chạy thì phần ví dụ của nó ghi thẳng là chưa có.

---

## `L10-1` — chủ phát, vùng nhận

### Trường hợp: rail dashboard cạnh cột chính

```ts
"dashboard-rail-then-main": {
    classes: ["mx-auto", "flex", "w-full", "max-w-6xl", ... "md:flex-row", "md:items-start",
        "md:[&>*:first-child]:w-72", "md:[&>*:first-child]:shrink-0",
        "md:[&>*:last-child]:min-w-0", "md:[&>*:last-child]:grow"],
    children: {
        rail: { contract: "dashboard-rail" },
        main: { contract: ["dashboard-main", "dashboard-tab-main", "centred-empty-notice"] },
    },
},
```

Neo: `index.ts:1049`. Cả hai con đều bắt buộc và không con nào lặp, nên selector theo vị trí hợp lệ ở
đây.

Vùng nhận không nói gì thêm:

```ts
"dashboard-rail": {
    classes: ["flex", "w-full", "flex-col", "gap-6"],
},
```

Neo: `index.ts:1057`. `w-full` là câu trả lời cho trục dọc lúc xếp chồng, không phải một số đo.

### Trường hợp: cùng hình dạng, số đo khác, chủ khác

```ts
"main-then-rail": {
    classes: [..., "md:[&>*:first-child]:min-w-0", "md:[&>*:first-child]:grow",
        "md:[&>*:last-child]:w-80", "md:[&>*:last-child]:shrink-0", ...],
},
```

Neo: `index.ts:2234`. Chi tiết khoá học đặt rail ở đầu cuối và giữ `w-80`, vì copy mua-hay-thử bị dồn
ở zoom 150% tại `w-72`. Số đo đổi vì nội dung ở số đo cũ hỏng, không vì một trang khác đã đổi.

### Trường hợp nhỏ nhất: chủ phát `w-full` cho mọi con

```ts
"course-pricing-purchase-intent": {
    classes: ["flex", "flex-col", "gap-3", "[&>*]:w-full"],
},
```

Neo: `index.ts:2416`. Ba hành động chuyển đổi từng nằm trong một hàng lồng chỉ để chỉnh kích thước.
Hàng đó bị bỏ, và một chủ duy nhất xếp chúng thành cột đầy chiều rộng.

### Trông giống nhưng không phải `L10-1`

Một vùng khai `grow` cho chính nó để "ăn hết chỗ trống". Nó không biết bên cạnh có ai, nên nó không
biết chỗ trống là bao nhiêu. `grow` là câu trả lời của chủ hàng cho câu hỏi *ai nhận phần dư*, và chỉ
chủ hàng mới đặt được câu hỏi đó.

---

## `L10-2` — nhắm vào danh tính

### Trường hợp: Global Search sau khi bỏ selector theo vị trí

```ts
"global-search-body": {
    classes: [..., "md:[&>[data-component=SelectionList][data-variant=scopes]]:w-72",
        "md:[&>[data-component=SelectionList][data-variant=scopes]]:shrink-0",
        "md:[&>[data-node=global-search-result-region]]:min-w-0",
        "md:[&>[data-node=global-search-result-region]]:grow",
        "md:[&>[data-node=global-search-context-card]]:w-72",
        "md:[&>[data-node=global-search-context-card]]:shrink-0"],
    children: {
        scopes: { leaf: "selection-list" },
        results: { contract: "global-search-result-region" },
        context: { contract: "global-search-context-card", optional: true },
    },
},
```

Neo: `index.ts:2858`. Hai lý do cùng lúc: cột ngữ cảnh là optional nên vị trí cuối không cố định, và
React Aria chèn sibling ẩn quanh ListBox nên vị trí đầu cũng không cố định. Cột scope là leaf nên nó
không mang `data-node`, và selector nhắm vào `data-component` cùng `data-variant`.

### Trường hợp: mặc định cho tất cả, ngoại lệ có tên

```ts
"learn-shell-frame": {
    classes: [
        "flex", "min-h-screen", "w-full", "min-w-0", "flex-col", "items-start",
        "[&>*]:min-w-0", "[&>*]:grow",
        "md:flex-row", "md:items-start",
        "md:[&>[data-node=learn-spine-column]]:w-72",
        "md:[&>[data-node=learn-spine-column]]:grow-0",
        "md:[&>[data-node=learn-spine-column]]:shrink-0",
        ...
    ],
    children: {
        spine: { contract: "learn-spine-column", optional: true },
        body: { leaf: "page" },
        bar: { contract: "learn-mobile-tab-bar", optional: true },
    },
},
```

Neo: `index.ts:333` cho dòng mặc định và `index.ts:335` cho dòng lật. Cả spine lẫn thanh tab mobile
đều optional, và body là leaf, nên không selector vị trí nào sống sót được. Chủ hàng phát một mặc
định cho mọi con rồi thu hồi `grow` đúng ở cột có tên.

### Danh tính kiểm được ở đâu

```ts
export const contractNodeProps = (name: ContractKey) => {
    const spec = contractSpec(name)
    return {
        "data-tier": "branch",
        "data-node": name,
        ...
    }
}
```

Neo: `index.ts:2930`. `data-node` chính là khoá contract, nên một selector có thể đem so với registry
chứ không phải so với ảnh chụp màn hình.

### Trông giống nhưng không phải `L10-2`

`content-reader-frame` viết `md:[&>*:last-child]:w-72` trong khi con cuối của nó là optional:

```ts
children: {
    contents: { contract: "content-map-panel" },
    main: { contract: "learn-content-page" },
    outline: { contract: "content-outline-rail", optional: true },
},
```

Neo: `index.ts:1956` và `index.ts:1962-1964`. Trang gọi nó bỏ hẳn slot cuối khi bài học không có
heading nào:

```tsx
render={defineContractComponent("content-reader-frame", {
    contents,
    main: reader,
    ...(outlineEntries.length === 0 ? {} : { outline }),
})}
```

Neo: `src/components/pages/CourseLearnContentPage/component.tsx:540`. Lúc đó `main` vừa là
`nth-child(2)` vừa là `last-child`, nên nó nhận cả `grow` lẫn `w-72 shrink-0 sticky top-rail
max-h-rail overflow-y-auto`. Đây là `L10-2` viết dưới dạng `L10-1`, và nó đang chạy. Xem
[`audit.md`](./audit.md).

---

## `L10-3` — số đo của trang

### Trường hợp: `why` nói đúng

```ts
"routed-page-main": {
    host: "main",
    classes: ["flex", "min-w-0", "grow", "flex-col"],
    why: "... it takes the height the navbar leaves rather than deciding a measure of its own,
          because the page inside already owns that decision.",
},
```

Neo: `index.ts:749`. Khung nhận chiều cao, trang giữ số đo. Bốn contract trang đang thực thi đúng câu
này: `max-w-6xl` ở `dashboard-rail-then-main` và `main-then-rail`, `max-w-app-xl` ở
`content-reader-frame`, `max-w-app-lg` ở `course-personal-project-task-page`.

### Trông giống nhưng không phải `L10-3`

```ts
"nav-over-body-page": {
    classes: ["flex", "min-h-screen", "w-full", "flex-col"],
    why: "... and the measure is set here because a reading column running the full width of a
          desktop screen cannot be scanned at all.",
},
```

Neo: `index.ts:739`. Câu `why` khẳng định số đo được đặt ở đây, còn `classes` không có `max-w` nào.
Đọc `why` mà không đọc `classes` sẽ dẫn tới việc đi tìm một luật không tồn tại, hoặc tệ hơn là thêm
một `max-w` thứ hai chồng lên số đo mà trang đã giữ.

---

## `L10-4` — sửa đúng chủ

### Trường hợp: lần sửa nhầm đã được live proof bắt

Yêu cầu là nới rail chi tiết khoá học từ `w-72` lên `w-80`. Bản vá trung gian nới nhầm sibling
`content-reader-frame`, một chủ khác có cùng hình dạng hai cột. Live proof phát hiện, bản sửa hoàn
nguyên sibling và chỉ nới `main-then-rail`.

Repo sống hôm nay giữ đúng kết quả ấy:

```ts
"content-reader-frame": {
    classes: [..., "md:[&>*:first-child]:w-72", "md:[&>*:first-child]:shrink-0", ...],
},
```

Neo: `index.ts:1951` cho sibling đã hoàn nguyên, `index.ts:2234` cho chủ thật sự được nới.

### Trông giống nhưng không phải `L10-4`

Hai trang cùng cần rail rộng hơn thì không phải một lần sửa lan sang trang thứ hai, mà là hai quyết
định. Mỗi quyết định cần chứng cứ riêng về nội dung bị dồn ở số đo cũ, đúng như lần đầu tiên đã có
chứng cứ về copy mua-hay-thử ở zoom 150%.

---

## `L10-5` — chủ im lặng thì vùng tự khai

### Trường hợp sống: rail danh tính của profile

```ts
"profile-rail-then-main": {
    classes: ["flex", "w-full", "flex-col", "gap-6", "@app-md:flex-row", "@app-md:items-start", "@app-md:gap-8"],
    children: {
        rail: { contract: "profile-identity-rail" },
        main: { contract: ["profile-main", "centred-empty-notice"] },
    },
},
"profile-identity-rail": {
    classes: ["flex", "w-full", "shrink-0", "flex-col", "@app-md:w-72"],
},
```

Neo: `index.ts:805` và `index.ts:813`. Chủ hàng chỉ phát hướng và khoảng cách. Số đo nằm ở vùng con,
và `profile-main` cũng tự khai `min-w-0 grow` của nó tại `index.ts:820`. Đây là chỗ duy nhất trong
registry làm như vậy.

Ngưỡng cũng khác. `@app-md` đo chính vùng profile chứ không đo cửa sổ, và nó chỉ có nghĩa vì
`profile-rail-container` bật `@container` ngay phía trên:

```ts
"profile-rail-container": {
    classes: ["@container", "w-full"],
    why: "The rail switch measures the public-profile region itself, matching the self-contained legacy RailShell.",
},
```

Neo: `index.ts:800`.

### Ngoại lệ: `L10-5` không cho phép hai chỗ cùng viết

Khi vùng con đã tự khai, chủ hàng không được thêm một số đo nữa cho cùng con đó. Hai nguồn cho một
chiều rộng là hai câu trả lời cho một câu hỏi, và không có cách nào đọc mã mà biết câu nào thắng ngoài
việc chạy thử.

---

## `L10-6` — hàng trong block

### Trường hợp: hàng catalogue

```ts
| "[&>*:first-child]:w-36" | "[&>*:last-child]:shrink-0"
```

Neo: `index.ts:92`, cùng bình luận ngay trên nó tại `index.ts:88-91` giải thích rằng ảnh phải cố định
chứ không tỉ lệ, vì một thumbnail giãn theo viewport sẽ làm cột tiêu đề hẹp lại trên màn hình rộng
hơn. Quyết định đúng, và không thuộc kệ này.

### Trường hợp: hàng xếp hạng

```ts
classes: ["flex", "flex-row", "items-center", "gap-2", "w-full", "[&>*:first-child]:w-5", ...],
```

Neo: `index.ts:1184`. Cột số thứ tự rộng đúng một ký tự và `tabular-nums` giữ nó thẳng hàng xuống cả
danh sách.

### Trông giống nhưng không phải `L10-6`

Nếu hai thứ đứng cạnh nhau đều được `LayoutPlan` gọi tên là region, thì dù chúng nhỏ đến đâu, L10 vẫn
phán. Ranh giới là việc có tên trong plan hay không, không phải kích thước.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "rail hơi chật, nới ra" | `L10-4` | liệt kê mọi chủ giữ số đo đó trước khi sửa bất kỳ chủ nào |
| "cho cái cột này rộng 288 đi" | `L10-1` | số đo về chủ hàng, kèm `shrink-0` |
| "bên phải lúc có lúc không" | `L10-2` | bỏ selector vị trí, nhắm `data-node` |
| "trang bị rộng quá, đọc mỏi mắt" | `L10-3` | `max-w-*` ở contract trang, không ở khung |
| "sao chỉ mình profile làm khác" | `L10-5` | hợp lệ vì chủ hàng của nó không phát gì; kiểm luôn ngưỡng `@app-md` |
| "cái ảnh trong hàng to quá" | `L10-6` | không phải L10; sang `blocks` và principle kích thước |
| "cho thanh chọn này dài hết dòng" | hỏi lại | đó là thứ bậc của một điều khiển, thuộc [`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md) |
