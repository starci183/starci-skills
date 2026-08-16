---
id: fe-patterns-contract-example
title: example.md
slug: /gates/patterns/contract/example
sidebar_label: example.md
sidebar_position: 2
description: Tất cả case và ngoại lệ của từng mã CONTRACT-N, viết bằng TSX thường.
---

# example.md

> Version: `2.00` · Module: `contract` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường**. Không tên sản phẩm, không tên repository. `Tree` là frame — một
component duy nhất biến key thành element. `Panel` là một primitive vendor bất kỳ có thân riêng; thay
nó bằng primitive của bạn thì luật không đổi một chữ nào.

Mỗi mã có **nhiều case**, từng case đặt **ĐÚNG** cạnh **SAI**, sau đó là mục **ngoại lệ và nhầm lẫn**.
Ba mục cuối trang ánh xạ từ yêu cầu bằng lời sang một mã, phân định các ranh giới, và liệt kê những
sai lầm lặp lại nhiều nhất.

---

## `CONTRACT-1` — class cấu trúc đến từ key

### Case: một hàng hai con

```tsx
// ĐÚNG — hình dạng nằm ở key, và key nằm ở đúng một chỗ tra được.
export const AuthorLine = ({ props }: AuthorLineProps) => (
    <Tree contract="avatar-with-identity-stack" render={authorFrom(props)} />
)
```

```tsx
// SAI — hình dạng của node này được quyết ở đây, và không có gì phía trên tìm ra được nó.
export const AuthorLine = ({ props }: AuthorLineProps) => (
    <div className="flex items-center gap-2">
        <Avatar props={props.avatar} />
        <IdentityStack props={props.identity} />
    </div>
)
```

Khác nhau đúng một điều: ngày mai có người hỏi "node này căn kiểu gì", họ tra được ở đâu.

### Case: nhấc chuỗi lên hằng số module

```tsx
// ĐÚNG — không có hằng số class nào, vì không có chuỗi class nào.
export const MetricGrid = ({ props }: MetricGridProps) => (
    <Tree contract="metric-figure-grid" render={metricsFrom(props)} />
)
```

```tsx
// SAI — quyết định chỉ dịch lên một dòng, và mất luôn khả năng bị nhìn thấy.
const GRID = "grid grid-cols-2 gap-4 sm:grid-cols-4"

export const MetricGrid = ({ props }: MetricGridProps) => (
    <div className={GRID}>{/* … */}</div>
)
```

### Case: class không cấu trúc trên một leaf

```tsx
// ĐÚNG — leaf sở hữu ruột của nó: đây là sơn của MỘT giá trị, không phải hình dạng của một cây.
export const Figure = ({ props }: FigureProps) => (
    <span className="text-2xl font-semibold tabular-nums">{props.value}</span>
)
```

```tsx
// SAI — cùng file leaf, nhưng đây đã là sắp xếp hai nội dung, nên nó không còn là leaf nữa.
export const Figure = ({ props }: FigureProps) => (
    <span className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{props.value}</span>
        <span className="text-sm">{props.unit}</span>
    </span>
)
```

### Ngoại lệ và nhầm lẫn

- **Không phải class nào cũng là cấu trúc.** `text-sm`, `font-medium`, `tabular-nums`, `truncate` nói
  về vẻ ngoài của một giá trị. `flex`, `gap-*`, `items-*`, `col-*`, `sticky` nói về hình dạng của một
  cây. Chỉ nhóm sau thuộc `CONTRACT-1`.
- **Thư mục leaf là ngoại lệ, và nó là ngoại lệ THẬT.** Không ai đi tuần được câu hỏi "file này có sắp
  xếp hai nội dung không". Nộp một arrangement vào đó là thoát luật, và cái giá đã đo được: entry có
  chuỗi class **trùng từng byte** với hằng số gõ tay trong thư mục leaf, mà không gì nhìn ra vì không
  rule nào đọc cả hai.

---

## `CONTRACT-2` — không ghép chuỗi class lúc chạy

### Case: hai hình dạng là hai key

```tsx
// ĐÚNG — phân định là thật, nên nó được đặt tên, và cả hai tên đều tra được.
<Tree contract={props.isCompact ? "stacked-peer-controls" : "stacked-sections"} render={render} />
```

```tsx
// SAI — một bảng thứ hai không key, không lý do, và `gap-4` giờ vô hình với mọi rule.
<div className={cn("flex flex-col", props.isCompact ? "gap-2" : "gap-4")}>{children}</div>
```

### Case: nội suy template

```tsx
// ĐÚNG — trạng thái đi vào một prop có tên trên component sở hữu node, không đi vào chuỗi class.
<StatusRow props={props} variant={props.isSelected ? "selected" : "resting"} />
```

```tsx
// SAI — chuỗi chỉ tồn tại trong lúc component chạy, nên không ai đọc lại được nó.
<div className={`flex items-center gap-2 ${props.isSelected ? "bg-accent-soft" : ""}`} />
```

### Case: `cva` cũng là bảng thứ hai

```tsx
// ĐÚNG — hai bậc, hai key. Cái tên nói ra sự khác biệt thay vì giấu nó trong một object variant.
const key = props.density === "tight" ? "task-row-tight" : "task-row"
return <Tree contract={key} render={taskFrom(props)} />
```

```tsx
// SAI — `cva` là một registry đầy đủ chức năng đứng cạnh registry thật, và không cái nào biết cái kia.
const row = cva("flex items-center", { variants: { density: { tight: "gap-1", roomy: "gap-3" } } })
return <div className={row({ density: props.density })}>{children}</div>
```

### Ngoại lệ và nhầm lẫn

- **Đây không phải "cấm dùng biến".** Dữ liệu runtime đi qua `props`; điều bị cấm là **chuỗi class**
  được ghép lúc chạy.
- **Chọn key bằng biến là hợp lệ.** `contract={key}` với `key` có kiểu `ContractKey` vẫn là gõ một
  key — chỉ là gõ ở chỗ khác. Rule đọc key được, và bảng vẫn là chỗ duy nhất giữ chuỗi class.

---

## `CONTRACT-3` — từ vựng class là union đóng

### Case: giá trị ngoài thang

```ts
// ĐÚNG — mọi member đều nằm trong union, nên entry này biên dịch được.
"weekday-run": {
    classes: ["flex", "flex-row", "flex-wrap", "items-center", "gap-2"],
    children: { day: { leaf: "day-cell", props: { size: "sm" }, repeats: true, restingCount: 6 } },
    host: "ul",
    why: "a run of equal columns only reads as one span of time while the columns stay on one line",
}
```

```ts
// SAI — `gap-[13px]` không bị cấm, nó KHÔNG VIẾT RA ĐƯỢC: nó không phải member của union.
"weekday-run": {
    classes: ["flex", "flex-row", "gap-[13px]"],
    children: { day: { leaf: "day-cell", repeats: true, restingCount: 6 } },
    host: "ul",
    why: "…",
}
```

### Case: ép kiểu để cho qua

```ts
// ĐÚNG — cần một bậc mới thì thêm member vào union, một lần, có tên, có người đọc.
export type LayoutClassName =
    | "gap-1" | "gap-2" | "gap-3" | "gap-4" | "gap-6" | "gap-8"
    | "md:w-2/5" | "md:shrink-0"
```

```ts
// SAI — `as` biến type thành lời đề nghị. Union còn nguyên, chỉ có chỗ này thôi bị kiểm.
classes: ["flex", "gap-[13px]" as LayoutClassName]
```

### Ngoại lệ và nhầm lẫn

- **Không có ngoại lệ nào.** Đây là mã duy nhất trong module không cần rule để giữ, và cũng là mã
  không có cửa sau: một `as` không phải ngoại lệ, nó là chỗ luật bị vô hiệu hoá.
- **Thêm member là một lần sửa cố ý.** Nó nằm trong diff, có tên, và người review đọc được — khác hẳn
  một `gap-[13px]` trôi qua trong một file JSX dài.

---

## `CONTRACT-4` — element thuộc về entry

### Case: một chuỗi ngày LÀ một danh sách

```ts
// ĐÚNG — entry đặt tên element của chính nó, nên hình dạng này có chỗ hợp pháp để sống.
"weekday-run": {
    classes: ["flex", "flex-row", "flex-wrap", "items-center", "gap-2"],
    children: { day: { leaf: "day-cell", props: { size: "sm" }, repeats: true, restingCount: 6 } },
    host: "ul",
    why: "a run of equal columns only reads as one span of time while the columns stay on one line",
}
```

```tsx
// SAI — không có host để dùng, nên hình dạng bị nộp xuống tầng leaf, nơi nó tự viết được class.
const RUN_CLASSES = "flex flex-row flex-wrap items-center gap-2"
export const WeekRun = ({ props }: WeekRunProps) => <ul className={RUN_CLASSES}>{/* … */}</ul>
```

### Case: node props bị mặc lên element của vendor

```tsx
// ĐÚNG — node của entry đứng BÊN TRONG thân vendor, nên host mà entry đặt tên vẫn tới được tài liệu.
<Panel>
    <Panel.Body>
        <Tree contract="task-list" render={rowsFrom(props.tasks)} />
    </Panel.Body>
</Panel>
```

```tsx
// SAI — node props mang class và marker mà KHÔNG mang element. Entry nói `ol`, tài liệu nhận `div`.
<Panel>
    <Panel.Body {...contractNodeProps("task-list")}>{rows}</Panel.Body>
</Panel>
```

Đây là lỗi **không có màu đỏ ở đâu cả**: key vẫn resolve, marker vẫn đọc đúng, gate vẫn xanh — chỉ có
danh sách rời khỏi accessibility tree và không còn gì báo có bao nhiêu mục.

### Case: prop `as` trên frame

```tsx
// ĐÚNG — frame chỉ nhận key và nội dung. Element không có cửa nào để caller truyền vào.
export interface TreeProps<K extends ContractKey> {
    contract: K
    render: ContractComponent<NoInfer<K>>
}
```

```tsx
// SAI — hai call site của MỘT key giờ có thể mở ra hai element: hai node mặc chung một cái tên.
<Tree as="section" contract="page-header-stack" render={render} />
```

### Ngoại lệ và nhầm lẫn

- **`host` vắng mặt không đồng nghĩa với `host: "div"`.** Frame mặc định về `div`, nhưng **đặt tên**
  element là một quyết định entry đã ra, còn để trống thì không. Hai entry lệch nhau ở chỗ đó không
  bao giờ bị gọi là bản sao của nhau.
- **`ul`/`ol` phải nói mình là list hai lần.** Preflight đặt `list-style: none`, và một số trình duyệt
  trả lời bằng cách gỡ hẳn element khỏi accessibility tree. `role="list"` khôi phục đúng điều entry đã
  nói và không thêm gì khác — nên nó nằm ở frame, không phải một field trên từng entry.
- **`li` phải có mặt trong union host.** Union từng nhận `ul` và `ol` mà không nhận `li`, nên một mục
  danh sách buộc phải là `div` — HTML sai, và im lặng.

---

## `CONTRACT-5` — TÊN của key cố định thứ bên trong

### Case: tên cố định được đứa con

```ts
// ĐÚNG — tên nói ra thứ nó chứa, nên một đứa con sai NHÌN LÀ THẤY, và một câu `why` đúng cho mọi chỗ dùng.
"title-with-baseline-fact": {
    classes: ["flex", "flex-row", "flex-wrap", "items-baseline", "gap-2"],
    children: {
        title: { leaf: "text", props: { size: "sm", weight: "semibold" } },
        fact: { leaf: "text", props: { size: "xs", tone: "muted" } },
    },
    why: "the fact reads as part of the heading sentence, so it sits on the title's baseline and wraps under it",
}
```

```ts
// SAI — `card` hôm nay chứa một list, mai chứa một form, tháng sau chứa một biểu đồ.
"card": {
    classes: ["flex", "flex-col", "gap-4", "p-4"],
    children: {},
    why: "a card",
}
```

Một câu duy nhất không thể nói vì sao **cả ba** đứng như vậy — nên `why` của `card` buộc phải rỗng
nghĩa, và `CONTRACT-6` sập theo `CONTRACT-5`.

### Case: cái tên chung hút hết call site

```ts
// ĐÚNG — ba cái tên, ba hình dạng, mỗi cái nói ra thứ nó giữ.
"label-over-progress-bar": { /* … */ }
"label-over-figure-grid": { /* … */ }
"label-over-joined-list": { /* … */ }
```

```ts
// SAI — thêm `section-inner` vào cạnh chúng thì ba cái trên chết dần, vì đây là cái không ai phải nghĩ.
"section-inner": {
    classes: ["flex", "flex-col", "gap-3"],
    children: {},
    why: "the inner stack of a section",
}
```

### Ngoại lệ và nhầm lẫn

- **Với node hợp thành, tên không còn là thứ DUY NHẤT giữ đứa con.** Entry khai từng slot và compiler
  kiểm từng cái (`CONTRACT-11`). Nhưng với node nhận nội dung từ caller, tên vẫn là thứ duy nhất.
- **Đảo chiều này được ghi lại, không im lặng.** Bản đồ con cũ bị bỏ vì không kiểm được gì khi nội
  dung đến dưới dạng markup. Quyết định cũ đúng với hình dạng nó được ra, và sai với hình dạng này.

---

## `CONTRACT-6` — `why` là một lý do

### Case: nói ra cái vỡ

```ts
// ĐÚNG — câu này nói đúng sự thật đã làm node ra đời.
why: "the tags wrap onto their own line before the title does, so a long title never breaks mid-word"
```

```ts
// SAI — nhắc lại cái key, tốn một dòng, không dạy gì.
why: "row of chips"
```

### Case: lý do phải đúng ở MỌI chỗ dùng key

```ts
// ĐÚNG — một sự thật về quan hệ giữa các con, nên nó đúng ở cả hai mươi chỗ dùng key này.
"label-fact-over-progress": {
    classes: ["flex", "flex-col", "gap-1"],
    children: {
        label: { leaf: "text", props: { size: "sm", weight: "medium" } },
        fact: { leaf: "text", props: { size: "xs", tone: "muted" } },
        bar: { leaf: "progress" },
    },
    why: "the figure must be read before the bar is interpreted, so the bar never carries the only copy of the number",
}
```

```ts
// SAI — mô tả một MÀN HÌNH chứ không mô tả node, nên nó sai ngay ở chỗ dùng thứ hai.
why: "used on the dashboard to show how far along the learner is this week"
```

### Ngoại lệ và nhầm lẫn

- **Rule chỉ đo được hai thứ: độ dài, và việc dùng lại chính chữ trong key.** Một câu mười hai chữ vô
  nghĩa vẫn lọt. Phần còn lại là việc của người đọc.
- **Lý do đi vào DOM là cố ý.** Chỗ một cây bị sai là chỗ người đọc đang nhìn khi họ nhận ra nó sai.

---

## `CONTRACT-7` — đúng một file biến key thành element

### Case: hộp trung tính

```tsx
// ĐÚNG — không có key nào vừa thì đó là PHÁT HIỆN, và phát hiện được xử lý bằng một entry mới.
<Tree contract="page-header-stack" render={headerFrom(props)} />
```

```tsx
// SAI — node không key: không gì ghi lại class nó nên mang, đứa con nào thuộc về nó, hay nó tồn tại vì cái gì.
<section className="flex flex-col gap-3">
    <Heading props={props.heading} />
    <Text props={props.subtitle} />
</section>
```

### Case: element ngữ nghĩa không mang class

```tsx
// ĐÚNG — `form` mở ra vì NGHĨA của nó, không mang class nào, nên nó không quyết định hình dạng nào cả.
<form onSubmit={on.submit}>
    <Tree contract="checkout-field-stack" render={fieldsFrom(props)} />
</form>
```

```tsx
// SAI — cùng một `form`, nhưng giờ nó mang hình dạng, nên nó đã thành node không key.
<form className="flex flex-col gap-4" onSubmit={on.submit}>
    {fields}
</form>
```

### Case: `<ul>` viết tay

```tsx
// ĐÚNG — element là quyết định của entry, và frame là thứ duy nhất mặc nó.
<Tree contract="notification-feed" render={itemsFrom(props.notifications)} />
```

```tsx
// SAI — "frame chỉ vẽ div thôi" không còn đúng, và đây chính là lỗ đã làm đầy tầng leaf.
<ul className="divide-y">
    {props.notifications.map((item) => <NotificationRow key={item.id} props={item} />)}
</ul>
```

### Ngoại lệ và nhầm lẫn

- **Surface branch có tên là ngoại lệ đã đóng.** Xem `CONTRACT-10`.
- **`<span>` bọc text trong một leaf không thuộc mã này.** Nó không chứa element khác, nên nó không
  phải node.
- **`<div>` giữ chỗ lúc loading vẫn là node.** Skeleton và nội dung thật dùng chung một key; đổi hình
  dạng lúc chờ là nói dối về hình dạng.

---

## `CONTRACT-8` — marker do frame vẽ

### Case: marker sinh ra ở đúng một hàm

```ts
// ĐÚNG — một hàm, đọc từ entry, không nơi nào khác biết cách viết ra hai attribute này.
export const contractNodeProps = (name: ContractKey) => {
    const spec = contractSpec(name)
    return { "data-node": name, "data-why": spec.why, className: spec.classes.join(" ") }
}
```

```tsx
// SAI — node này khẳng định một contract mà KHÔNG CÓ GÌ giữ, và mọi test đi qua attribute đó đều tin.
<div data-node="task-list" data-why="rows read as one list">{rows}</div>
```

### Case: rút ngắn selector cho e2e

```tsx
// ĐÚNG — cần một móc cho test thì dùng một attribute có tên khác, không mượn từ vựng của contract.
<Tree contract="task-list" render={rowsFrom(props.tasks)} />
// test: [data-node="task-list"] — do frame vẽ, nên nó phản ánh đúng thực tế.
```

```tsx
// SAI — mượn `data-node` cho tiện selector, và từ đó không ai phân biệt được node thật với node giả.
<div data-node="task-list-wrapper">{children}</div>
```

### Ngoại lệ và nhầm lẫn

- **Twin test được dựng fixture bằng tay.** Điều nó muốn biết là **cái gì tới được tài liệu**, và nó
  đọc điều đó từ frame đã render.
- **Node không marker THÀNH THẬT hơn node có marker viết tay.** Đó là toàn bộ lập luận của mã này.

---

## `CONTRACT-9` — key mới phải là hình dạng mới

### Case: chỉ khác một bậc gap

```ts
// ĐÚNG — một entry, dùng cho cả hai chỗ. Muốn chặt hơn thì đổi cho TẤT CẢ.
"peer-card-grid": {
    classes: ["grid", "grid-cols-1", "gap-4", "sm:grid-cols-2"],
    children: { card: { contract: "summary-card", repeats: true, restingCount: 4 } },
    why: "each card owns its own internal rhythm, so the grid seam only has to keep them from touching",
}
```

```ts
// SAI — `peer-card-grid-tight` là cùng một hình dạng dưới cái tên thứ hai.
"peer-card-grid-tight": {
    classes: ["grid", "grid-cols-1", "gap-4", "sm:grid-cols-2"],
    children: { card: { contract: "summary-card", repeats: true, restingCount: 6 } },
    why: "the tighter variant used on the narrow route",
}
```

`restingCount` khác **không** phải hình dạng khác: `CONTRACT-9` bác một key vì gap khác, và một key vì
số placeholder khác chính là cùng một kiểu phình đó.

### Case: hình dạng thật sự mới

```ts
// ĐÚNG — không key nào diễn đạt được "một cột cố định bên cạnh một cột co giãn", nên nó xứng đáng có key.
"rail-beside-reading-column": {
    classes: ["flex", "flex-col", "gap-4", "md:flex-row", "md:items-start", "md:gap-8"],
    children: {
        rail: { contract: "filter-stack" },
        reading: { contract: "$content" },
    },
    why: "the rail keeps its measure while the reading column takes the remainder, because a problem statement at rail width wraps every second word",
}
```

```ts
// SAI — cùng hình dạng đó, đặt tên theo CALL SITE, nên từ vựng bắt đầu mô tả màn hình thay vì hình dạng.
"course-search-page-layout": { /* classes y hệt */ }
```

### Ngoại lệ và nhầm lẫn

- **Prop boolean chọn giữa hai sắp xếp là bị cấm.** Một trong hai sẽ không có key, không lý do, không
  tên — nó tồn tại trên màn hình và không tồn tại trong bảng.
- **Hai entry lệch nhau ở việc CÓ đặt tên host hay không thì không phải bản sao.** Đặt tên element là
  một quyết định; để trống là một câu khác.

---

## `CONTRACT-10` — branch sở hữu cơ chế wrapper

### Case: seam vendor cố định

```tsx
// ĐÚNG — seam ngoài là code branch bình thường; contract node đứng BÊN TRONG thân vendor.
export const SurfaceListCard = ({ props, on, contract, render: Content, isLoading }: SurfaceListCardProps) => (
    <Tree contract="label-over-surface-with-caption" render={surfaceFrom(props, (
        <Panel className="p-0">
            <Panel.Body className="p-0">
                <Content props={props} on={on} isLoading={isLoading} />
            </Panel.Body>
        </Panel>
    ))} />
)
```

```tsx
// SAI — wrapper nhận markup không kiểu, nên contract không chứng minh được card này chứa cái gì.
export const SurfaceCard = ({ children }: SurfaceCardProps) => (
    <div className="flex flex-col gap-3">{children}</div>
)
```

### Case: đừng biến một host thành ba contract

```tsx
// ĐÚNG — một key cho content node. Dòng tiêu đề, wrapper ngoài và caption là code branch.
<SurfaceListCard
    contract="daily-task-list"
    props={{ label, fact, description, tasks }}
    render={DailyTaskContent}
/>
```

```ts
// SAI — ba key sinh ra chỉ để khỏi phải viết branch, và giờ bảng mô tả cơ chế wrapper.
"surface-card-heading-line": { /* … */ }
"surface-card-outer-wrapper": { /* … */ }
"surface-card-caption": { /* … */ }
```

### Case: không có bảng compound

```tsx
// ĐÚNG — lặp lại `Panel > Panel.Body` tốn hai dòng, và hai dòng đó không sở hữu chính sách nào cả.
<Panel>
    <Panel.Body>
        <ContractContent contract={contract} render={render} />
    </Panel.Body>
</Panel>
```

```ts
// SAI — mô hình hoá cơ chế wrapper thành từ vựng thứ hai: thêm gián tiếp, không thêm chính sách.
export const COMPOUNDS = buildCompounds({
    "card-shell": { outer: "panel", body: "panel-body" },
})
```

### Ngoại lệ và nhầm lẫn

- **Seam của surface branch không được biến đổi theo caller, không nhận con, không nhận marker.** Ba
  điều kiện này là **định nghĩa** của ngoại lệ, không phải mô tả kèm theo.
- **Bound host đặt `ContractContent` vào đó; surface chạy theo dữ liệu đặt component đã branded vào
  đó** và truyền `props`, `on`, `isLoading` bình thường.

---

## `CONTRACT-11` — mỗi slot có tên

### Case: khai slot thay vì nhận `children`

```ts
// ĐÚNG — mỗi slot có tên, có identity đóng, và compiler kiểm từng cái.
"resume-item-card": {
    classes: ["flex", "flex-col", "gap-3", "p-4"],
    children: {
        title: { leaf: "text", props: { size: "sm", weight: "semibold" } },
        progress: { composite: "labelled-progress-row", optional: true },
        action: { leaf: "button" },
    },
    why: "the learner must see how far in they are before the one control that resumes, so the figure never sits below the fold of the card",
}
```

```tsx
// SAI — markup tới nơi thì đã dựng xong và đã xoá mất hình dạng của chính nó.
<ContractNode contract="resume-item-card">
    <Text props={title} />
    {progress ? <ProgressRow props={progress} /> : null}
    <Button props={action} />
</ContractNode>
```

### Case: slot có tên, không đếm

```ts
// ĐÚNG — chèn thêm một slot vào giữa thì không có gì đổi nghĩa, vì không gì được với tới bằng vị trí.
children: {
    label: { leaf: "text", props: { size: "sm", weight: "medium" } },
    fact: { leaf: "text", props: { size: "xs", tone: "muted" } },
    bar: { leaf: "progress" },
}
```

```ts
// SAI — chèn một đứa con vào giữa và MỌI vị trí sau nó âm thầm mang nghĩa khác.
children: [
    { leaf: "text" },
    { leaf: "text" },
    { leaf: "progress" },
]
```

### Case: `repeats` đi cùng `restingCount`

```ts
// ĐÚNG — độ dài lúc sống là động; số placeholder lúc chờ là một quyết định, nên nó được khai riêng.
children: { task: { contract: "task-row", repeats: true, restingCount: 4 } }
```

```ts
// SAI — slot lặp mà không nói hình dạng lúc nghỉ, nên skeleton trôi khỏi hình dạng thật.
children: { task: { contract: "task-row", repeats: true } }
```

```tsx
// SAI — cây skeleton viết tay bên cạnh danh sách: hai hình dạng, không gì đọc cả hai.
{isLoading
    ? <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <RowSkeleton key={i} />)}</div>
    : <Tree contract="task-list" render={rowsFrom(props.tasks)} />}
```

### Case: `props` trong slot là ràng buộc literal

```ts
// ĐÚNG — slot ràng buộc một literal, và leaf khai đúng cặp đó trên metadata của chính nó.
children: { day: { leaf: "day-cell", props: { size: "sm" }, repeats: true, restingCount: 6 } }
```

```ts
// SAI — chữ do query trả về không thuộc về bảng; nó đi qua `props` runtime của render component.
children: { day: { leaf: "day-cell", props: { size: "sm", label: queryResult.dayLabel } } }
```

### Case: component đã branded thay vì arrow trần

```tsx
// ĐÚNG — component ổn định được branded, dữ liệu runtime đi qua `props`.
const TaskListView = ({ props }: TaskListViewProps) => (
    <Tree contract="task-list" render={rowsFrom(props.tasks)} />
)
export const TaskListContent = defineContractComponent("task-list", TaskListView)
```

```tsx
// SAI — arrow trần không mang metadata contract/leaf nào, nên không gì kiểm được nó thoả slot này.
<SurfaceListCard contract="task-list" render={() => <div>{rows}</div>} props={props} />
```

### Case: joined list — quan hệ giữa các row thuộc về root

```ts
// ĐÚNG — `divide-y` ngồi trên content host, root là `p-0`, nên mọi divider chạm được hai mép.
"task-list": {
    classes: ["flex", "flex-col", "divide-y", "divide-separator", "p-0"],
    children: { task: { contract: "task-row", repeats: true, restingCount: 4 } },
    why: "the rows are peers of one collection, so one rule between them replaces a seam that would break the run into separate cards",
}
```

```tsx
// SAI — row leaf tự vẽ luật ranh giới của mình, nên row cuối kẻ thừa một đường và không gì thấy.
export const TaskRow = ({ props }: TaskRowProps) => (
    <div className="after:block after:h-px after:bg-separator last:after:hidden">{/* … */}</div>
)
```

### Case: fact của dòng label thuộc về list host

```tsx
// ĐÚNG — fact định tính cho chính joined list, nên nó là một field trong props có tên của list host.
<SurfaceListCard contract="task-list" props={{ label: "Việc hôm nay", fact: "4 việc", description, tasks }} render={TaskListContent} />
```

```tsx
// SAI — caller chiếu fact ra thành sibling riêng, nên không gì nói fact đó thuộc về danh sách nào.
<>
    <SurfaceListCard contract="task-list" props={{ label: "Việc hôm nay", tasks }} render={TaskListContent} />
    <Text props={{ content: "4 việc", size: "xs", tone: "muted" }} />
</>
```

```tsx
// SAI — `description` dành cho caption của CẢ list, nằm dưới surface, không phải fact cạnh label.
<SurfaceListCard contract="task-list" props={{ label: "Việc hôm nay", description: "4 việc", tasks }} render={TaskListContent} />
```

### Ngoại lệ và nhầm lẫn

- **Không rule nào đi tuần thứ nằm trong slot, và điều đó đã được ĐO chứ không phải đoán.** Compiler
  đã từ chối cả ba: arrow inline, hàm có tên không metadata, và metadata mang **sai** tên. Thêm một
  rule ở đây là đi tuần một cánh cửa type đã khoá.
- **Tên miền nghiệp vụ của tập hợp (`tasks`, `courses`, `alerts`) là field trong kiểu props có tên.**
  Một slot chung tên `items` sẽ dạy cho surface biết mô hình dữ liệu của caller.
- **Lề của row là bất đối xứng, và đó là cố ý.** Một row `p-4`; row đầu `px-4 pt-4 pb-3`; row giữa
  `px-4 py-3`; row cuối `px-4 pt-3 pb-4`.

---

## `CONTRACT-12` — class của entry là sắp xếp

### Case: hành vi thuộc về branch sở hữu control

```tsx
// ĐÚNG — control giữ handler, giữ disabled, nên nó giữ luôn con trỏ. Entry bên trong vẫn thuần sắp xếp.
export const PressableTaskRow = ({ props, on }: PressableTaskRowProps) => (
    <button className="w-full cursor-pointer text-left hover:opacity-80" onClick={on.open} type="button">
        <Tree contract="task-row" render={taskFrom(props)} />
    </button>
)
```

```ts
// SAI — entry tự nhận là bấm được, mà bảng là bên KHÔNG THỂ được báo rằng lời hứa đã tắt.
"task-row": {
    classes: ["flex", "items-center", "gap-3", "cursor-pointer", "hover:opacity-80"],
    children: { /* … */ },
    why: "…",
}
```

Cùng một entry `task-row` thuần sắp xếp dùng lại được cho một hàng bấm được **và** một hàng không.

### Case: surface là một COMPONENT, không phải danh sách class

```tsx
// ĐÚNG — branch vẽ nền, bo góc và độ nổi; entry bên trong chỉ nói các con đứng với nhau thế nào.
<SurfaceCard contract="summary-stack" props={props} render={SummaryContent} />
```

```ts
// SAI — bảng giờ chứa HAI loại card, và không key nào nói cho ai biết họ đang nhìn loại nào.
"summary-card": {
    classes: ["flex", "flex-col", "gap-4", "p-4", "rounded-2xl", "bg-surface", "shadow-surface"],
    children: { /* … */ },
    why: "…",
}
```

Ngày surface của nhà đổi radius hoặc đổi elevation, chỉ **một** trong hai loại đổi theo.

### Case: một dải (band) không phải một vật thể nổi

```ts
// ĐÚNG — chạy hết bề ngang và tự kẻ ranh giới với dải kế tiếp: đó là dải, và dải được giữ nền.
"page-band": {
    classes: ["flex", "w-full", "flex-col", "gap-6", "border-b", "border-separator", "bg-surface", "py-6"],
    children: { section: { contract: "$content" } },
    why: "alternating grounds let a reader count the bands of a long page, and the rule replaces the gap that would otherwise have to carry the boundary",
}
```

```ts
// SAI — độ nổi không cần bạn đồng hành: không gì đổ bóng mà không đứng cao hơn thứ khác.
"page-band": {
    classes: ["flex", "w-full", "flex-col", "border-b", "bg-surface", "shadow-surface"],
    children: { /* … */ },
    why: "…",
}
```

### Ngoại lệ và nhầm lẫn

- **`bg-background` là nền của khung ứng dụng, không phải một vật thể nổi.** Navbar và thanh hành động
  đáy đứng trên nó, và không branch card nào sở hữu nó.
- **`rounded-*` và `border*` vẫn hợp lệ, vì một cạnh cũng CẮT và CHIA.** Entry dùng chúng để bo hai
  đầu một joined list và để kẻ dải này khỏi dải kia. Máy không phân biệt được chúng với góc của một
  card, nên việc tách được để lại cho migration.
- **`text-left`/`text-center` là mâu thuẫn còn mở giữa luật và rule.** Bảng *Forbidden* của luật gốc
  liệt `text-left`; rule cố ý để nó hợp lệ với lập luận rằng căn lề là **thừa kế xuống mọi con** nên
  thuộc về node sắp xếp. Xem `audit.md`; đừng tự sửa một bên cho khớp bên kia.

---

## `CONTRACT-13` — key không ai vẽ

### Case: key sống sót sau khi màn hình bị gỡ

```ts
// ĐÚNG — bảng chỉ chứa thứ đang đứng trong tài liệu.
export const CONTRACTS = buildContracts({
    "task-list": { /* … */ },
    "task-row": { /* … */ },
})
```

```ts
// SAI — trang đã gỡ, key ở lại: một lời hứa về một node không tồn tại.
export const CONTRACTS = buildContracts({
    "task-list": { /* … */ },
    "task-row": { /* … */ },
    "legacy-task-board-column": { /* không call site nào */ },
})
```

### Case: key "để tuần sau dùng"

```ts
// ĐÚNG — hình dạng chưa dựng thuộc về plan record, nơi một node chưa tồn tại đúng là thứ người đọc mong gặp.
// .claude/workflows/<id>.md
// đề xuất: "mentor-availability-grid" — chưa dựng, chờ duyệt.
```

```ts
// SAI — trong bảng, mọi thứ có mặt đều được hiểu là đang trên màn hình.
"mentor-availability-grid": {
    classes: ["grid", "grid-cols-2", "gap-2"],
    children: {},
    why: "planned for the mentor booking screen next sprint",
}
```

### Ngoại lệ và nhầm lẫn

- **Slot con LÀ một call site.** Key chỉ được gọi từ một slot của entry khác vẫn sống, dù file duy
  nhất nhắc tới nó chính là file bảng.
- **Story và test được tính.** Chúng render key đó; một hình dạng chỉ được chứng minh trong story là
  **được ghi lại**, không phải chết.
- **Không đọc được cây thì im lặng.** Một reader nhìn vào chỗ trống mà trả lời "không ai vẽ cái này"
  sẽ giao ra một danh sách xoá làm màn hình đang chạy biến mất.
- **Bản sao của bảng trong plan record không bị tính.** Design candidate chỉ vẽ đúng trang nó sinh ra
  để trả lời.

---

## Ánh xạ yêu cầu sang một mã

Nêu element, nêu nó có chứa element khác không, nêu key. Nếu thiếu **một** dữ kiện quyết định, hỏi
**một** câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Cho avatar và tên đứng cạnh nhau" | Element chứa element ⇒ node | `CONTRACT-1` | `<Tree contract="avatar-with-identity-stack" …/>` |
| "Khi compact thì cho hẹp lại" | Phân định thật, cách diễn đạt sai | `CONTRACT-2` | hai key, chọn bằng một biến kiểu `ContractKey` |
| "Cần khoảng cách 13px" | Giá trị ngoài thang | `CONTRACT-3` | thêm member vào union, hoặc dùng bậc gần nhất |
| "Chỗ này phải là danh sách thật" | Element mang nghĩa | `CONTRACT-4` | `host: "ul"` trên entry |
| "Đặt tên key này là `card`" | Tên không cố định được gì | `CONTRACT-5` | đổi tên theo thứ nó chứa |
| "`why` viết gì bây giờ" | Lý do ≠ nhãn | `CONTRACT-6` | nói cái vỡ/xuống dòng/tràn khi bỏ node |
| "Chỉ cần một `div` bọc thôi" | Node không key | `CONTRACT-7` | thêm hoặc dùng lại một key |
| "Thêm `data-node` cho selector gọn" | Marker khẳng định điều không ai giữ | `CONTRACT-8` | render key, để frame vẽ marker |
| "Y hệt cái kia nhưng thưa hơn" | Cùng hình dạng, tên thứ hai | `CONTRACT-9` | dùng key đang có, hoặc đổi entry cho tất cả |
| "Bọc nó trong card rồi thêm caption" | Cơ chế wrapper | `CONTRACT-10` | surface branch có tên; content node đứng bên trong |
| "Truyền `children` vào cho tiện" | Markup xoá mất hình dạng của nó | `CONTRACT-11` | khai slot có tên, một component mỗi slot |
| "Cho hàng này bấm được" | Hành vi ≠ sắp xếp | `CONTRACT-12` | branch vẽ control, node đứng bên trong |
| "Giữ key lại tuần sau dùng" | Lời hứa về một node không tồn tại | `CONTRACT-13` | ghi vào plan record, xoá khỏi bảng |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `CONTRACT-1` / `CONTRACT-2` | Chuỗi class là tĩnh viết sai chỗ, hay được ghép lúc chạy? |
| `CONTRACT-1` / `CONTRACT-3` | Câu hỏi là *ai được viết class này*, hay *class này có tồn tại không*? |
| `CONTRACT-1` / `CONTRACT-7` | Bạn đang gắn class lên element có sẵn, hay vừa mở một element mới? |
| `CONTRACT-4` / `CONTRACT-7` | Element bị viết tay, hay bị caller chọn qua một prop? |
| `CONTRACT-4` / `CONTRACT-10` | Node của entry đứng TRÊN thân vendor, hay BÊN TRONG nó? |
| `CONTRACT-5` / `CONTRACT-6` | Sai ở chỗ tên không cố định được đứa con, hay ở chỗ lý do không nói được cái vỡ? |
| `CONTRACT-5` / `CONTRACT-11` | Nội dung đến từ caller, hay entry khai được từng slot? |
| `CONTRACT-9` / `CONTRACT-13` | Key thừa lúc sinh, hay key đã chết sau khi màn hình bị gỡ? |
| `CONTRACT-2` / `CONTRACT-12` | Đang ghép class, hay đang đặt hành vi vào sai chủ? |
| `CONTRACT-12` / `CONTRACT-3` | Token này bị rule bác, hay union còn chưa gỡ nó ra? |
| `CONTRACT-10` / `CONTRACT-11` | Seam thuộc về wrapper cố định, hay là quan hệ giữa các con của root? |

## Sai lầm lặp lại nhiều nhất

1. Mở một `div` vì "không có key nào vừa" — đó là phát hiện, không phải giấy phép.
2. Nhấc chuỗi class lên hằng số module và tưởng đã hết vi phạm.
3. Spread node props lên thân vendor: gate xanh, danh sách rời khỏi accessibility tree.
4. Đặt tên key là `card`, `wrapper`, `section-inner` — rồi mất hết call site của anh em cụ thể.
5. Viết `why` bằng chính chữ trong key.
6. Thêm key thứ hai vì gap khác, hoặc vì `restingCount` khác.
7. Cho entry mang `cursor-pointer` trong khi thứ thật sự bấm nằm ở component khác.
8. Cho entry mang `bg-surface` + `shadow-*` trong khi surface branch đã vẽ đúng cái đó.
9. Truyền `children` vào node cấu trúc, rồi không ai nói được bên trong có gì.
10. Slot lặp không khai `restingCount`, rồi dựng một cây skeleton riêng bên cạnh.
11. Viết tay `data-node` để selector e2e ngắn lại.
12. Giữ key "cho tuần sau" trong bảng thay vì trong plan record.
13. Tạo key cho heading line, wrapper ngoài và caption chỉ để khỏi phải viết một branch.
