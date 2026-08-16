---
id: fe-layouts-laws-l9-sticky-offset-is-page-local-example
title: example.md
slug: /gates/layouts/laws/l9-sticky-offset-is-page-local/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi trường hợp, ngoại lệ và thứ trông giống của bảy mã L9-N, đọc thẳng từ token và contract đang chạy.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `l9-sticky-offset-is-page-local` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`.
Không có ví dụ bịa: một mã không có chỗ nào đang chạy thì phần ví dụ của nó ghi thẳng là chưa có.

Hai token cả kệ này xoay quanh nằm cạnh nhau trong đúng một khối `@theme`:

```css
/* globals.css:55-56 */
--spacing-rail: 5.5rem;
--max-height-rail: calc(100dvh - 7rem);

/* globals.css:63-64 */
--spacing-course-rail: 6.1rem;
--max-height-pricing-rail: calc((100dvh - var(--spacing-course-rail)) * 0.8);
```

---

## `L9-1` — chrome tự ghim

### Trường hợp: dải navbar của cụm route

```ts
"double-navbar": {
    classes: ["sticky", "top-0", "z-50", "w-full", "border-b", "border-separator", "bg-background"],
    children: {
        primary: { contract: "brand-links-then-tools-bar" },
        bottom: { contract: "underlined-tab-strip", optional: true },
    },
},
```

Không có class offset nào vì không có gì đứng trên nó. Hai hàng nằm trong một container, nên chúng là
một landmark ghim và chia nhau một đường kẻ đáy.

### Trông giống nhưng không phải `L9-1`

Đọc `double-navbar` thành hai vùng ghim rồi đi tìm offset cho hàng `bottom`. Hàng đó không ghim riêng,
nó trôi theo container đã ghim. Nếu đi tìm offset cho nó, kết quả sẽ là một `top-16` thừa và một
đường kẻ thứ hai.

---

## `L9-2` — hàng chrome thứ hai

### Trường hợp: tab của trang chi tiết khoá học

```ts
"course-section-navigation": {
    host: "nav",
    classes: ["sticky", "top-16", "z-50", "-mt-px", "flex", "w-full",
              "border-b", "border-separator", "bg-background", "px-6"],
    children: { tabs: { leaf: "choice-tabs" } },
},
```

`top-16` đo được, không đoán: hàng chính khai `h-16 min-h-16` tại `contracts/index.ts:1700`. `-mt-px`
kéo hàng này lên một pixel để mặt đục của nó phủ đúng nét kẻ đáy của hàng trên.

### Ngoại lệ: cùng kết quả nhìn, khác cấu trúc

Dashboard đạt hai hàng bằng cách nhét `underlined-tab-strip` vào trong `double-navbar`, tức một
landmark. Course detail đạt hai hàng bằng một landmark `nav` thứ hai dán lên bằng offset. Với `L9`
cả hai đều hợp lệ vì cả hai đều trừ đúng chrome của mình. Việc course detail có hai landmark `nav`
chồng nhau là một finding của [`audit.md`](./audit.md), thuộc về `L3` chứ không thuộc mã này.

### Trông giống nhưng không phải `L9-2`

Dải tab của trang hồ sơ:

```ts
"profile-tabs-over-body": {
    classes: ["flex", "w-full", "flex-col"],
    children: {
        tabs: { contract: "underlined-tab-strip" },
        body: { contract: "profile-page-measure" },
    },
},
```

Không một class sticky nào. Dải này cuộn đi mất, nên nó không phải hàng chrome thứ hai và nó không
đóng góp gì vào offset của vùng bên dưới.

---

## `L9-3` — ghim dưới chrome một hàng

### Trường hợp: spine của trang học

```ts
"md:[&>[data-node=learn-spine-column]]:sticky",
"md:[&>[data-node=learn-spine-column]]:top-rail",
"md:[&>[data-node=learn-spine-column]]:self-start",
"md:[&>[data-node=learn-spine-column]]:max-h-rail",
"md:[&>[data-node=learn-spine-column]]:overflow-y-auto",
```

Ghim và trần nằm cạnh nhau trong cùng một danh sách class, nên người sửa cái này nhìn thấy cái kia.
Vùng được nhắm bằng `data-node`, không bằng vị trí con, và đó là `L10` đang làm việc ngay bên cạnh.

### Trường hợp: hai vùng cùng ghim trên một trang

```ts
"md:[&>*:first-child]:sticky", "md:[&>*:first-child]:top-rail",
"md:[&>*:first-child]:self-start", "md:[&>*:first-child]:max-h-rail",
"md:[&>*:nth-child(2)]:min-w-0", "md:[&>*:nth-child(2)]:grow",
"md:[&>*:last-child]:sticky", "md:[&>*:last-child]:top-rail",
"md:[&>*:last-child]:self-start", "md:[&>*:last-child]:max-h-rail",
```

`content-reader-frame` ghim cả cột đầu lẫn cột cuối vào cùng một mốc. Không xung đột, vì cả hai đứng
dưới đúng một chrome.

### Trông giống nhưng không phải `L9-3`

Rail của trang chi tiết khoá học. Nó cũng là một cột cố định ghim bên phải nội dung, nhìn hệt cột
cuối của `content-reader-frame`, nhưng trang nó đứng có hai hàng chrome nên nó là `L9-4`. Đây đúng là
chỗ `top-rail` đã bị dùng nhầm và bị bác.

---

## `L9-4` — ghim dưới chrome hai hàng

### Trường hợp: rail giá của trang chi tiết khoá học

```ts
"main-then-rail": {
    classes: [..., "md:[&>*:last-child]:w-80", "md:[&>*:last-child]:shrink-0",
        "md:[&>*:last-child]:sticky", "md:[&>*:last-child]:top-course-rail",
        "md:[&>*:last-child]:self-start",
    ],
},
```

### Trần không nằm cùng chỗ với ghim

```css
/* globals.css:363-377 */
.card[data-component="SurfaceCardSurface"][data-scroll-inside="pricing-rail"] {
    max-height: var(--max-height-pricing-rail);
    overflow: hidden;
}

.card[data-component="SurfaceCardSurface"][data-scroll-inside="pricing-rail"]
    [data-node="pricing-rail-scroll-viewport"] {
    max-height: var(--max-height-pricing-rail);
}
```

Đây là chỗ duy nhất trong repo mà ghim do khung giữ còn trần do stylesheet giữ. Lập kế hoạch cho vùng
này phải gọi tên cả hai chủ; đọc mỗi `main-then-rail` sẽ tưởng vùng này không có trần.

### Ngoại lệ: 80% chứ không phải toàn bộ phần còn lại

`L9-3` để lại phía dưới đúng bằng phía trên. `L9-4` lấy 80% phần chrome chừa ra. Hai công thức khác
nhau và không suy ra nhau được, vì con số 80% là một phán quyết chứ không phải một phép tính.

---

## `L9-5` — không ghim

### Trường hợp: rail của Dashboard

```ts
"dashboard-rail-then-main": {
    classes: ["mx-auto", "flex", "w-full", "max-w-6xl", "flex-col", "gap-6", "md:gap-8",
        "px-6", "py-6", "md:flex-row", "md:items-start",
        "md:[&>*:first-child]:w-72", "md:[&>*:first-child]:shrink-0",
        "md:[&>*:last-child]:min-w-0", "md:[&>*:last-child]:grow"],
},
```

Không `sticky`, không `top-*`, không `max-h-*`. Và `why` tại `contracts/index.ts:1054` nói ra lý do,
rằng rail giữ chiều rộng đọc cố định bên cạnh cột chính mà không trở thành card và cũng không thành
một viewport ghim riêng.

### Trường hợp: rail của trang hồ sơ

```ts
"profile-rail-then-main": {
    classes: ["flex", "w-full", "flex-col", "gap-6",
              "@app-md:flex-row", "@app-md:items-start", "@app-md:gap-8"],
},
```

Cùng kết luận, và ở đây còn dễ nhầm hơn vì trang hồ sơ nhìn có hai băng ngang phía trên.

### Trông giống nhưng không phải `L9-5`

Một vùng không mang class sticky **vì người viết quên**. `L9-5` là vùng đã được phán là không ghim,
có `why` hoặc có phán quyết đứng sau. Không tìm được câu đó thì đây là một câu hỏi cho thầy, không
phải một mã.

---

## `L9-6` — ghim vào cạnh đáy

### Trường hợp: hai thanh đáy

```ts
"learn-mobile-tab-bar": {
    host: "nav",
    classes: ["sticky", "bottom-0", "z-40", ..., "md:hidden"],
},

"course-mobile-action-bar": {
    classes: ["sticky", "bottom-0", "z-40", ..., "md:hidden"],
},
```

Không trừ gì cả, vì chrome ở trên còn thanh này ở dưới. `md:hidden` bảo đảm chúng không bao giờ cùng
hiện với rail mà chúng thay thế.

### Trông giống nhưng không phải `L9-6`

Một thanh ghim đáy **không** kèm `md:hidden`. Khi đó nó cùng sống với rail, và câu hỏi phải trả lời
trước không còn là offset mà là hai vùng cùng nói một việc. Chuyện đó thuộc `L8`.

---

## `L9-7` — chưa đo thì báo nợ

### Trường hợp: hai hình dạng đã bị bác

`max-h-[80vh]` viết thẳng tại block, thay bằng token có tên `max-h-pricing-rail`. `80dvh` phẳng không
trừ navbar, thay bằng `(100dvh - navbar) * 0.8`. Cả hai đều render ra một cái rail trông ổn, và cả
hai đều sai.

### Chưa có ví dụ đúng

Chưa có lần nào một trang mới đi đến mã này rồi báo nợ token đúng quy trình. Cả hai lần đã ghi lại
đều là phát hiện sau khi đã viết số. Đây là chỗ mã này còn chưa được chứng minh bằng một ca sống.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "cho cái cột này dính lại khi cuộn" | `L9-3` hoặc `L9-4` | đếm số hàng chrome ghim của trang trước, rồi mới chọn token |
| "rail bị navbar che mất đầu" | `L9-4` | gần như chắc chắn đang dùng `top-rail` trên trang hai hàng |
| "cuộn xuống thì mất nút cuối của rail" | `L9-3` hoặc `L9-4` | thiếu nửa thứ hai, tức trần chiều cao |
| "tab của trang phải dính dưới navbar" | `L9-2` | offset đúng bằng `h-16` của hàng trên, kèm `-mt-px` |
| "màn hình bé thì đưa nút mua xuống dưới" | `L9-6` | ghim đáy, `md:hidden`, không trừ gì |
| "cho rail Dashboard dính luôn đi" | hỏi lại | `why` của nó đã từ chối, đổi là đổi phán quyết chứ không phải đổi class |
| "cứ để 80vh cho nhanh" | `L9-7` | đã bị bác đích danh hai lần |
