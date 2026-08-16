---
id: fe-layouts-laws-l11-full-width-run-versus-compact-control-example
title: example.md
slug: /gates/layouts/laws/l11-full-width-run-versus-compact-control/example
sidebar_label: example.md
sidebar_position: 2
description: Chín điều khiển đang chạy thật, ba chạy hết chiều ngang và sáu đứng gọn, đọc thẳng từ hợp đồng và call site trong repo sống.
---

# example.md

> Phiên bản: `1.00` · Mô-đun: `l11-full-width-run-versus-compact-control` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là mã thật trong repo sống `D:\Repositories\starci-academy-fe` nhánh `main`. Không
có ví dụ bịa: một mã chưa có chỗ nào đang chạy thì phần ví dụ của nó ghi thẳng là chưa có.

Toàn bộ điều khiển chọn kiểu tab trong repo sống được đo hết để viết tài liệu này. Có mười bốn call
site, ba của `ExtendedTabs` và mười một của `ChoiceTabs`, không tính hai dòng khai kiểu. Bốn cái dùng
cơ chế hàng chạy hết chiều ngang và mười cái giữ chiều rộng intrinsic. Ba trong bốn cái đầu trả lời
được cả hai vế theo cách `L11-1` đòi; cái thứ tư thì không, và nó có mục riêng ở cuối `L11-4`.

---

## `L11-1` — hàng chạy hết chiều ngang

### Trường hợp: hàng tab là tầng thứ hai của navbar

```ts
"double-navbar": {
    classes: ["sticky", "top-0", "z-50", "w-full", "border-b", "border-separator", "bg-background"],
    children: {
        primary: { contract: "brand-links-then-tools-bar" },
        bottom: { contract: "underlined-tab-strip", optional: true },
    },
    why: "The active page's tab strip is the navbar's second layer, so both rows move as one sticky landmark and share one bottom border instead of drawing two unrelated bars.",
}
```

`bottom` là anh em ngang hàng với `primary`, và cả cụm navbar đứng trên phần thân do route vẽ. Điều
khiển sống lâu hơn cái nó thay, đúng dấu hiệu của `L11-1`.

Cơ chế đi kèm nằm trong leaf và nó tự lấy cả dòng:

```tsx
<div data-tier="leaf" data-component="ExtendedTabs" className="w-full px-6">
```

Neo: `…\contracts\index.ts:1691-1698`, `…\contracts\index.ts:1739-1744`,
`…\leaves\ExtendedTabs\index.tsx:37`, và call site ở `…\layouts\ShellNav\component.tsx:113-123`.

### Trường hợp: khoá hợp đồng đã nói ra quan hệ

```ts
"profile-tabs-over-body": {
    classes: ["flex", "w-full", "flex-col"],
    children: {
        tabs: { contract: "underlined-tab-strip" },
        body: { contract: "profile-page-measure" },
    },
    why: "Profile route chrome belongs to the persistent public-profile layout above its measured identity-and-evidence body; it is not a second layer owned by the global navbar.",
}
```

`tabs` đứng trên `body` và không bị thay cùng với `body`. Cái tên `profile-tabs-over-body` viết ra
đúng quan hệ mà `L11-1` đòi, nên chỗ này kiểm được bằng registry chứ không cần ảnh chụp.

Neo: `…\contracts\index.ts:781-788`, `…\blocks\profile\ProfileTabs\component.tsx:20-24`,
`…\layouts\PublicProfileLayout\component.tsx:103`.

### Trường hợp: điều khiển mở landmark của riêng nó

```ts
"course-section-navigation": {
    host: "nav",
    classes: ["sticky", "top-16", "z-50", "-mt-px", "flex", "w-full", "border-b", "border-separator", "bg-background", "px-6"],
    children: { tabs: { leaf: "choice-tabs" } },
    why: "The four controls move within one course document, so they share one navigation landmark and one full-width baseline above the narrative. …",
}
```

Đây là chỗ duy nhất một `choice-tabs` chạy hết chiều ngang, và nó làm được vì hợp đồng bọc ngoài khai
`host: "nav"` cùng `w-full`, còn call site thì không truyền `variant` nên leaf rơi về nhánh gạch chân.

```tsx
navigation: defineContractComponent("course-section-navigation", {
    tabs: defineLeafComponent("choice-tabs", {}, () => (
        <ChoiceTabs
            props={{
                label: input.props.labels.sectionTabsLabel,
                selectedKey: input.props.selectedSection ?? "overview",
                tabs: [ /* overview, curriculum, reviews, faq */ ],
            }}
```

Neo: `…\contracts\index.ts:2217-2224`, `…\contracts\index.ts:2226-2231`,
`…\pages\CourseDetailPage\component.tsx:459-471`.

### Trông giống nhưng không phải `L11-1`

Bốn mục ấy chỉ cuộn màn hình, không thay gì cả, nên rất dễ bị đọc thành một trường hợp ngoại lệ của
`L11-2`. Không phải. Bốn mục là bốn vùng của chính trang và dải điều khiển mở một landmark riêng, nên
phân loại đứng ở `L11-1`. Cái handler thuộc về [`l4`](../l4-tab-switches-panel-route-switches-page/INDEX.md)
`L4-5` và nó không tham gia vào phân loại hình dạng.

---

## `L11-2` — điều khiển gọn cạnh cái nó đổi

### Trường hợp: cú lật của thầy đóng băng thành một hợp đồng

```ts
"contribution-calendar-heading-row": {
    classes: ["flex", "w-full", "flex-row", "flex-wrap", "items-center", "justify-between", "gap-3"],
    children: {
        total: { leaf: "text", props: { size: "xs", tone: "muted" } },
        years: { leaf: "choice-tabs" },
    },
    why: "The activity total identifies one contribution plot while the year is a compact parameter of that same plot, so its primary segmented choice sits at the trailing edge rather than becoming a ShellNav-style secondary navigation line.",
}
```

Câu `why` này là phán quyết vòng hai viết lại bằng ngôn ngữ của contract, kể cả cụm "ShellNav-style"
để nhắc thẳng cái hình dạng vừa bị bác. Call site khai đúng nhánh gọn:

```tsx
years: defineLeafComponent("choice-tabs", {}, () => (
    <ChoiceTabs
        props={{
            label: props.totalLabel ?? "",
            selectedKey: String(props.year),
            variant: "primary",
            tabs: props.years.map((year) => ({ id: String(year), label: String(year) })),
        }}
        on={{ select: (key) => on?.selectYear?.(Number(key)) }}
    />
)),
```

Neo: `…\contracts\index.ts:1243-1250` và `…\composites\ContributionCalendar\index.tsx:46-56`.

### Trường hợp: chế độ hỏng ghi ngay cạnh chỗ ra quyết định

```ts
"scope-switch-row": {
    // A row, so the switch takes the width of its two words. In the page column it was a
    // direct child of a `flex-col`, which stretches its children - and a segmented control
    // spanning the whole measure reads as a band the page is divided by rather than as one
    // control the reader can press.
    classes: ["flex", "flex-row"],
    children: { tabs: { leaf: "choice-tabs" } },
    why: "The scope switch is a control, not a divider: it is as wide as the choice it offers, so the page beneath it stays the thing being read rather than the thing being framed.",
}
```

Cái hợp đồng này tồn tại chỉ để một `flex-col` thôi kéo giãn con của nó. Đây là hệ quả thứ nhất của
luật, viết bằng chính chữ của người sửa nó, và nó có hai call site là `LeaguePage` với
`CourseLeaderboardPage`.

Neo: `…\contracts\index.ts:1504-1511`, `…\pages\LeaguePage\component.tsx:121-132`,
`…\pages\CourseLeaderboardPage\component.tsx:105-116`.

### Trường hợp khó: đứng đúng chỗ của một hàng `L11-1` mà vẫn gọn

```ts
"league-page-column": {
    classes: ["mx-auto", "flex", "w-full", "max-w-6xl", "flex-col", "gap-6", "px-6", "py-6"],
    children: {
        header: { contract: "page-header-stack" },
        scope: { contract: "scope-switch-row" },
        board: { contract: "league-board-stack" },
    },
    why: "The board is one reading column: where the reader is and what this page is, which competition is being read, then that competition — so switching scope changes the answer beneath the question rather than moving the question.",
}
```

`scope` là anh em ngang hàng với `board` ở tầng cao nhất của hợp đồng trang, đúng vị trí mà một hàng
`L11-1` sẽ đứng, và nó vẫn gọn. Lý do là vế thứ nhất đã trả lời xong: bảng xếp hạng không đổi loại, nó
tính lại. Vị trí chỉ được hỏi đến khi vế thứ nhất trả lời là mặt.

Neo: `…\contracts\index.ts:1492-1502`.

### Trông giống nhưng không phải `L11-2`

Vòng một của hồ sơ đã đo hai con số cạnh nhau, tablist chọn năm rộng `189.625px` bắt đầu ở x
`978.775px`, còn tablist của ShellNav rộng `1216.8px` bắt đầu ở x `24px`, rồi kéo con số thứ nhất cho
bằng con số thứ hai. Hai hàng ấy nhìn cạnh nhau thì cùng là một dải tab, nên phép so bằng mắt không
phân biệt được chúng. Chỉ câu hỏi cái gì bị thay mới phân biệt được.

Neo: `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:50-51`.

---

## `L11-3` — hàng thì đầy, điều khiển thì không

### Trường hợp: hai trục độc lập chung một hàng

```ts
"dual-tabs-toolbar": {
    classes: ["flex", "w-full", "flex-row", "flex-wrap", "items-center", "justify-between", "gap-3"],
    children: {
        leading: { leaf: "choice-tabs" },
        trailing: { leaf: "choice-tabs" },
    },
    why: "Two independent primary-tab axes govern one result set; they share a toolbar row but keep their own selection and accessible label without invented container chrome.",
}
```

`w-full` ở đây thuộc về cái hàng, vì hàng cần trải ra mới đẩy được hai đầu về hai phía. Hai
`choice-tabs` bên trong đều intrinsic và phải phân loại riêng từng cái.
`contribution-calendar-heading-row` là cùng hình dạng ấy với một nhãn thay cho điều khiển thứ hai.

Hợp đồng này có hai chủ, và đó là chỗ đáng đọc kỹ. Composite `DualTabsToolbar` ép cả hai trục về
`variant: "primary"` và được `FeedExplorer` dùng cho cặp phạm vi với hạng mục của luồng hoạt động, tức
là hai giá trị của cùng một luồng nên cả hai gọn và cùng một lớp sơn. `ContentTabRow` thì dựng thẳng
cùng hợp đồng ấy với trục sau ở `secondary`. Câu `why` của hợp đồng nói "Two independent primary-tab
axes", nên nó đang mô tả đúng một trong hai chủ.

Neo: `…\contracts\index.ts:1323-1329`, `…\contracts\index.ts:1243-1244`,
`…\composites\DualTabsToolbar\index.tsx:21-30`, `…\blocks\dashboard\FeedExplorer\component.tsx:35-40`.

### Trông giống nhưng không phải `L11-3`

Đọc `w-full` trong mảng `classes` rồi kết luận điều khiển bên trong chạy hết chiều ngang. Đó không
phải một biến thể của mã này mà là cách bỏ qua nó. Ba hợp đồng `L11-1` và hai hợp đồng `L11-3` đều
mang `w-full`, nên chuỗi class ấy không phân biệt được gì cả.

---

## `L11-4` — mặt của một vùng bên trong trang

### Trường hợp: ba mặt nội dung của một bài học

```tsx
export const contentTabRow = (props: ContentTabRowData, on?: ContentTabRowActions) =>
    defineContractComponent("dual-tabs-toolbar", {
        // The faces are a PANEL switch, so they take the segmented pill rather than the filter
        // underline: pressing one replaces what is being read rather than narrowing it.
        leading: defineLeafComponent("choice-tabs", {}, () => (
            <ChoiceTabs
                props={{
                    label: props.facesLabel,
                    selectedKey: props.selectedFace ?? props.faces[0]?.id ?? "",
                    variant: "primary",
```

`ContentFaceId` là `"reading" | "source" | "challenge"`, ba loại nội dung khác hẳn nhau, nên vế thứ
nhất trả lời là mặt. Vế thứ hai đọc từ chỗ hàng ấy đứng:

```tsx
const reader = defineContractComponent("learn-content-page", {
    header,
    ...(faces.length > 1 || (input.props.languages ?? []).length > 1 ? {
        faces: contentTabRow( /* … */ ),
    } : {}),
    body: visibleBody,
})
…
<Tree
    contract="content-reader-frame"
    render={defineContractComponent("content-reader-frame", {
        contents,
        main: reader,
        ...(outlineEntries.length === 0 ? {} : { outline }),
    })}
/>
```

`faces` đứng trên `body`, nhưng cả hai nằm trong `learn-content-page`, mà `learn-content-page` chính
là `main`, một trong ba cột của khung. Vùng bị thay là vùng bên trong, nên điều khiển giữ hình dạng
gọn.

Neo: `…\blocks\learn\ContentTabRow\component.tsx:26,85-93` và
`…\pages\CourseLearnContentPage\component.tsx:495-522,534-542`.

### Trường hợp: bên trong một rail và bên trong một overlay

```tsx
selector: hasIntentSwitch
    ? defineLeafComponent("choice-tabs", {}, () => (
        <ChoiceTabs
            props={{
                label: input.props.intent?.intentTabsLabel ?? input.props.title,
                selectedKey: visibleIntent,
                variant: "primary",
                tabs: [
                    { id: "purchase", label: … },
                    { id: "trial", label: … },
                ],
```

Chuyển giữa mua và dùng thử thay hẳn phần thân của rail, và cặp chọn cách trả tiền trong
`CheckoutOverlay` cũng thay phần tóm tắt bên dưới nó. Cả hai vẫn gọn, vì rail và overlay đều đã là vật
có ranh giới, và với overlay thì [`l6`](../l6-overlay-is-already-a-surface/INDEX.md) đã phán chuyện đó
từ trước.

Neo: `…\blocks\courses\CoursePricingRail\component.tsx:206-217` và
`…\overlays\commerce\CheckoutOverlay\component.tsx:127-132`.

### Trông giống nhưng không phải `L11-4`

Hàng bốn mục của trang chi tiết khoá học cũng nằm bên trong một hợp đồng trang, nên thoạt nhìn có vẻ
cùng loại. Khác ở chỗ hợp đồng ấy là tầng cao nhất của chính trang chứ không phải một cột bên trong
nó, và `course-section-navigation` khai `host: "nav"`. Không hợp đồng nào trong bốn ví dụ `L11-4` khai
một landmark nào cả.

### Vi phạm còn sống: cùng hình dạng ấy, làm ngược lại

```ts
"coding-problem-page": {
    classes: ["flex", "w-full", "min-h-screen", "flex-col", "md:flex-row"],
    children: {
        reading: { contract: "problem-reading-column" },
        work: { contract: "problem-work-column" },
    },
    …
},
"problem-reading-column": {
    classes: ["flex", "w-full", "min-w-0", "flex-col", "gap-4", "border-b", "border-separator", "p-6", "md:w-2/5", "md:shrink-0", "md:border-b-0", "md:border-r"],
    children: {
        tabs: { leaf: "extended-tabs" },
        body: { contract: "problem-statement-stack" },
    },
    why: "The tabs stay put while what is under them changes, so a reader who moved to the hint and back does not lose the place they were reading from.",
}
```

Bốn mặt đề bài, gợi ý, lời giải và các lần nộp là bốn loại nội dung khác nhau, nên vế thứ nhất trả lời
là mặt. Vế thứ hai đọc ra ngay từ hai dòng trên: cột đọc là một trong hai cột của trang và nó rộng
`md:w-2/5`, tức là một vùng bên trong trang. Theo tiêu chí thì đây là `L11-4` và điều khiển phải gọn,
nhưng call site đặt `ExtendedTabs` vào đó, mà leaf ấy tự mang `w-full px-6`.

Đây là cặp so sánh mạnh nhất mà mô-đun có. Trang học và trang bài luyện mã đặt cùng một câu hỏi, một
hàng chọn mặt đứng trên phần thân của một cột, và hai bên trả lời ngược nhau. Chưa có lời phán nào của
thầy đứng riêng cho cặp ấy, nên [`audit.md`](./audit.md) vừa ghi nó thành vi phạm theo tiêu chí, vừa
ghi rằng một phán quyết có thể lật cả hai sang `L11-1`.

Neo: `…\contracts\index.ts:2625-2631`, `…\contracts\index.ts:2633-2643`,
`…\blocks\coding\ProblemReadingColumn\component.tsx:88-103`, `…\leaves\ExtendedTabs\index.tsx:37`.

---

## `L11-5` — tên vendor không phải bằng chứng

### Trường hợp: tiêu chí viết sẵn trong leaf

```ts
/**
 * Primary is a compact segmented choice inside one bounded context. Secondary is an underline
 * navigation layer between large content regions. The names select those two stable products;
 * they are not a general importance scale.
 */
readonly variant?: "primary" | "secondary"
```

Câu này là vòng hai của phán quyết, viết vào chính chỗ mà người viết mã tiếp theo sẽ đọc. Cơ chế đứng
sau nó cũng tách đôi rõ ràng: nhánh segmented sơn selection lên chính cái tab, còn nhánh gạch chân giữ
`Tabs.Indicator` của vendor.

Neo: `…\leaves\ChoiceTabs\index.tsx:26-31`, `:55`, `:58`, `:88`.

### Trường hợp: hai trục cạnh nhau, hai token khác nhau, lý do ghi tại chỗ

```tsx
trailing: defineLeafComponent("choice-tabs", {}, () => (
    <ChoiceTabs
        props={{
            label: props.languagesLabel ?? "",
            selectedKey: props.selectedLanguage ?? props.languages?.[0]?.id ?? "",
            // Neutral, as legacy draws it: the language qualifies the examples inside the
            // face rather than choosing a face, so it must not compete with the pill.
            variant: "secondary",
```

Cùng một hàng, cùng một leaf, hai token khác nhau, và lý do đứng ngay cạnh giá trị. Đây là hình mẫu
của `L11-5`: token viết sau cùng và viết kèm câu làm cho tên với hình khớp nhau.

Chỗ này còn chứng minh một điều nữa mà không ví dụ nào khác chứng minh được. Trục ngôn ngữ mang lớp
sơn gạch chân và vẫn intrinsic, vì chiều rộng của nó đến từ cái hàng chứ không đến từ token. Nghĩa là
lớp sơn gạch chân tự nó không làm nên một hàng chạy hết chiều ngang, và một plan chỉ gọi tên lớp sơn
thì chưa gọi tên được gì cả.

Neo: `…\blocks\learn\ContentTabRow\component.tsx:108-110` và `…\contracts\index.ts:1323-1329`.

### Cái bẫy im lặng: mặc định là nhánh gạch chân

```tsx
const variant = props.variant ?? "secondary"
```

Bỏ trống ô này thì nhận lấy hình dạng điều hướng mà không phán câu nào. Trên trang chi tiết khoá học
việc bỏ trống lại ra đúng kết quả vì hàng ấy là `L11-1` thật. Trên một điều khiển gọn thì cùng chỗ bỏ
trống ấy là một cái tật, và hai diff nhìn giống hệt nhau.

Neo: `…\leaves\ChoiceTabs\index.tsx:62`.

### Trông giống nhưng không phải `L11-5`: render đúng, lý do sai

```tsx
// `variant: "primary"` is the segmented pill, not the underline. `ChoiceTabs` defaults
// to `"secondary"`, which draws a filter underline, and an earlier revision took that
// default by omission. The legacy catalog and the legacy league page both pass
// `"primary"` here for the reason the legacy source states beside it: these tabs switch
// the WHOLE panel rather than filtering the list under them, and a pill says so.
view: defineLeafComponent("choice-tabs", {}, () => (
```

Kết quả render đúng, vì chuyển giữa lưới và dòng là một cách bày lại cùng một danh sách, tức là
`L11-2`. Nhưng lý do viết bên cạnh lại nói ngược tiêu chí: theo lời comment thì việc đổi cả panel là
căn cứ để chọn pill, trong khi theo luật thì đổi cả vùng nội dung của trang chính là vế chạy hết chiều
ngang. Đây đúng là loại lỗi mà dòng `:241` đã bác một lần dưới dạng tên và hình phải mô tả cùng một
sản phẩm, chỉ khác ở chỗ lần này cái sai nằm trong câu giải thích chứ không nằm trong pixel.

Neo: `…\pages\CoursesCatalogPage\component.tsx:216-226`.

---

## `L11-6` — trả câu hỏi về cho thầy

### Chưa có ví dụ sống

Không điều khiển nào trong repo sống đang đứng ở trạng thái chưa phán. Chín cái đều đã có hình dạng và
sáu trong số đó có câu `why` hoặc comment nói ra lý do. Mã này được phát biểu từ chính cú lật, chứ
không từ một chỗ đang treo.

### Trường hợp lịch sử: đây là cách nó lẽ ra đã chạy

Vòng một là một ca `L11-6` thật. Cái nút chọn năm có hai cách đọc cùng bảo vệ được: nó là điều khiển
chính của một khu vực trên Dashboard, và nó là tham số của một hình vẽ. Plan lúc ấy chọn cách đọc thứ
nhất bằng cách lấy ShellNav làm mẫu, và ba phase sau thì chính thầy lật lại.

Neo: `.workflows\fidel\starci-academy\dashboard-contribution-primary-tabs.md:82`, `:173`, `:242`,
`:291`.

---

## Ánh xạ từ yêu cầu sang mã

| Yêu cầu nghe được | Mã | Ghi chú |
|---|---|---|
| "nó phải là 1 line dài như shellnav" | `L11-6` rồi `L11-1` hoặc `L11-2` | chính câu này đã bị lật một lần; hỏi cái gì bị thay trước khi kéo dài |
| "cho cái chọn năm ra một dòng riêng cho rõ" | `L11-2` | biểu đồ vẫn là biểu đồ ấy, chỉ vẽ lại |
| "thêm tab cho trang này" | `L11-1` nếu vùng của trang bị thay, `L11-4` nếu là một cột bên trong | hỏi vùng bị thay thuộc về ai |
| "hàng này rộng quá / hẹp quá" | `L11-3` | chiều rộng thuộc về hàng; hỏi lại từng điều khiển một |
| "để mặc định cho nhanh" | `L11-5` | mặc định là nhánh gạch chân, và đó là một phán quyết chưa ai làm |
| "HeroUI gọi nó là secondary mà" | `L11-5` | token là kết quả, không phải bằng chứng |
| "cái toggle lưới với dòng nên là tab lớn" | `L11-2` | cùng một danh sách bày lại; xem thêm chỗ lý do đang viết ngược |
| "cho tab này vào trong overlay" | `L11-4` | overlay đã là ranh giới, xem `l6` |
| "modal rộng ra" | không phải mã này | chiều rộng overlay là `l7`, có mô-đun riêng |
| "bấm tab thì có đổi URL không" | không phải mã này | đó là `l4` |
