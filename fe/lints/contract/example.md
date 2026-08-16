---
id: fe-lints-contract-example
title: example.md
slug: /fe/lints/contract/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng luật máy giữ — chỗ nó bắn, chỗ nó im, và chỗ nó lọt.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `contract` · Luật máy giữ: [`INDEX.md`](./INDEX.md) · Giải thích: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây có **vài cặp SAI / ĐÚNG** — SAI là mã làm luật **bắn**, ĐÚNG là mã làm luật **im** —
rồi tới mục **Cửa lách và nhầm lẫn**.

Đọc mục cuối đó cho kỹ. Mã trong đó là mã **luật bỏ sót**, **không phải** mã được phép viết. Nó vi
phạm luật y hệt mã SAI ngay phía trên; khác biệt duy nhất là **không ai báo**. Đừng chép nó đi dùng.

---

## `no-literal-structural-class`

### Cặp 1 — chuỗi tĩnh ở thuộc tính class

```tsx
{/* SAI — `flex` là token cấu trúc, hình dạng đang bị quyết ở nơi gọi */}
export const Summary = ({ props }: SummaryProps) => (
    <Panel className="flex flex-col gap-4">
        <Heading props={{ content: props.title, level: 3 }} />
        <Amount props={{ value: props.total }} />
    </Panel>
)
```

```tsx
{/* ĐÚNG — hình dạng có tên, và cái tên nói rõ bên trong có gì */}
export const Summary = ({ props }: SummaryProps) => (
    <Tree contract="title-over-total-stack" render={summaryFrom(props)} />
)
```

### Cặp 2 — nâng lên hằng số vẫn bị bắt

```tsx
{/* SAI — nâng lên một dòng không làm quyết định hợp lệ, chỉ làm nó vô hình với bộ thăm kia */}
const ROW = "flex flex-row items-center gap-2"

export const Entry = ({ props }: EntryProps) => <Label className={ROW}>{props.name}</Label>
```

```tsx
{/* ĐÚNG — chuỗi đi vào bảng, nơi gọi chỉ gõ khoá */}
export const Entry = ({ props }: EntryProps) => (
    <Tree contract="icon-beside-label-row" render={entryFrom(props)} />
)
```

### Cặp 3 — biến thể và dấu quan trọng không giấu được gì

```tsx
{/* SAI — token bị cắt hết phần trước dấu hai chấm cuối và bỏ dấu chấm than, còn lại `flex` */}
<Panel className="lg:hover:!flex" />
```

```tsx
{/* SAI — template không có lỗ vẫn là một chuỗi tĩnh, vẫn bị nối lại và quét */}
<Panel className={`grid grid-cols-2 gap-4`} />
```

```tsx
{/* ĐÚNG — không token cấu trúc nào; đây là màu của một giá trị, do lá tự vẽ */}
<Amount className="tabular-nums" props={{ value }} />
```

### Cửa lách và nhầm lẫn

```tsx
{/* LUẬT KHÔNG BẮT — và đây vẫn là vi phạm CONTRACT-1 y như cặp 2.
    `init` là ObjectExpression nên bộ thăm hằng số không thấy chuỗi,
    còn thuộc tính thì nhận một MemberExpression nên bộ thăm kia cũng không thấy. */}
const CLASSES = {
    root: "flex flex-col gap-4",
    row: "flex items-center gap-2",
}

export const Summary = ({ props }: SummaryProps) => <Panel className={CLASSES.root} />
```

```tsx
{/* LUẬT KHÔNG BẮT — literal nằm trong mảng, không nằm ở thuộc tính mà luật canh */}
const root = ["flex", "flex-col", "gap-4"].join(" ")
```

```tsx
{/* LUẬT KHÔNG BẮT — và lọt CẢ hai luật cùng lúc:
    luật này đòi chuỗi tĩnh, luật ghép class chỉ biết template có lỗ và phép cộng.
    Đây là cửa dễ đi nhất trong toàn mô-đun. */}
<Panel className={props.isDense ? "flex gap-2" : "grid gap-4"} />
```

```tsx
{/* LUẬT KHÔNG BẮT — PropertyDefinition, không phải VariableDeclarator */}
class Layout {
    static root = "flex flex-col gap-6"
}
```

```tsx
{/* BÁO THỪA — bộ thăm hằng số quét MỌI chuỗi tĩnh trong tệp bị quản,
    kể cả chuỗi không bao giờ là class. Câu tài liệu này bị báo là `hoisted`. */}
const HINT = "đặt gap-4 giữa hai nhóm ngang hàng"
```

---

## `no-class-composition-outside-contract`

### Cặp 1 — hàm ghép class

```tsx
{/* SAI — một bảng thứ hai không khoá, không lý do, không ai đọc ngược lại được */}
<Panel className={cn("flex flex-col", props.isDense ? "gap-2" : "gap-4")}>{children}</Panel>
```

```tsx
{/* ĐÚNG — khác biệt là thật, nên nó được đặt tên; hai hình dạng là hai khoá */}
<Tree contract={props.isDense ? "stacked-peer-controls" : "stacked-sections"} render={render} />
```

### Cặp 2 — nội suy vào thuộc tính class

```tsx
{/* SAI — chuỗi chỉ tồn tại trong lúc thành phần chạy, không gì đọc lại được */}
<Panel className={`flex flex-col gap-${props.step}`} />
```

```tsx
{/* SAI — phép cộng chuỗi cũng vậy */}
<Panel className={"flex " + tone} />
```

```tsx
{/* ĐÚNG — cả chuỗi nằm trong một mục, nơi gọi chỉ chuyền khoá */}
<Tree contract="stacked-sections" render={render} />
```

### Cặp 3 — luật bắn tại lời gọi, không cần biết kết quả đi đâu

```ts
// SAI — báo ngay ở CallExpression, kể cả khi kết quả không hề dùng làm class
const tone = cva("badge", { variants: { intent: { danger: "danger" } } })
```

### Cửa lách và nhầm lẫn

```tsx
{/* LUẬT KHÔNG BẮT — callee là MemberExpression, mà tập tên chỉ so với Identifier trần.
    Trớ trêu: `only-the-frame-wears-a-node` CÓ xử member. Hai luật cùng nhà, hai chuẩn. */}
<Panel className={utils.cn("flex flex-col", gap)} />
```

```tsx
{/* LUẬT KHÔNG BẮT — đổi tên khi nhập là đủ */}
import { cn as classes } from "./styling"

<Panel className={classes("flex", gap)} />
```

```tsx
{/* LUẬT KHÔNG BẮT — ghép bằng phương thức mảng vẫn là ghép */}
<Panel className={[base, props.isDense && "gap-2"].filter(Boolean).join(" ")} />
```

```tsx
{/* LUẬT KHÔNG BẮT — nội suy được nâng lên biến:
    bộ thăm nội suy chỉ đọc thuộc tính, còn bộ thăm hằng số bên luật kia đòi template KHÔNG lỗ. */}
const root = `flex flex-col gap-${props.step}`

<Panel className={root} />
```

```tsx
{/* LUẬT KHÔNG BẮT — LogicalExpression không nằm trong hai dạng được kiểm */}
<Panel className={props.isDense && "flex gap-2"} />
```

---

## `only-the-frame-wears-a-node`

### Cặp 1 — trải props của nút lên phần tử của thư viện

```tsx
{/* SAI — hàm trả về class và các dấu, KHÔNG trả về phần tử.
    Mục ghi `ol`, tài liệu nhận `div`: danh sách rơi khỏi cây trợ năng,
    khoá vẫn phân giải, dấu vẫn đọc đúng, mọi cổng vẫn xanh. */}
export const SurfaceListCard = ({ contract, children }: SurfaceListCardProps) => (
    <Card.Content {...contractNodeProps(contract)}>{children}</Card.Content>
)
```

```tsx
{/* ĐÚNG — nút tự dựng phần tử của nó BÊN TRONG thân của thư viện, không nằm TRÊN thân */}
export const SurfaceListCard = ({ contract, render: Content, props }: SurfaceListCardProps) => (
    <Card>
        <Card.Content className="p-0">
            <Tree contract={contract} render={Content} />
        </Card.Content>
    </Card>
)
```

### Cặp 2 — bài kiểm thử không phải miễn trừ thứ hai

```tsx
// SAI — bài kiểm thử tự trải props thì nó đang chứng minh fixture của chính nó,
// không chứng minh được gì về sản phẩm.
it("marks the node", () => {
    render(<div {...contractNodeProps("weekday-run")} />)
})
```

```tsx
// ĐÚNG — đọc thứ thật sự tới tài liệu, đọc trên khung dựng đã dựng ra nó
it("marks the node", () => {
    render(<Tree contract="weekday-run" render={run} />)
})
```

### Cửa lách và nhầm lẫn

```tsx
{/* LUẬT KHÔNG BẮT — luật cấm MỘT CÁI TÊN, không cấm HÀNH VI.
    Đọc thẳng bảng rồi tự nối class tái tạo y nguyên hỏng hóc "không đỏ ở đâu cả". */}
<Card.Content className={CONTRACTS["weekday-run"].classes.join(" ")}>{children}</Card.Content>
```

```tsx
{/* LUẬT KHÔNG BẮT — truyền hàm mà không gọi, nên không có CallExpression nào mang tên đó */}
const nodes = keys.map(contractNodeProps)
```

```ts
// LUẬT KHÔNG BẮT — bí danh
const wear = contractNodeProps
const worn = wear("weekday-run")
```

```ts
// LUẬT KHÔNG BẮT — truy cập tính toán bị bỏ qua CÓ CHỦ Ý (callee.computed)
const worn = helpers["contractNodeProps"]("weekday-run")
```

---

## `contract-why-is-a-reason`

### Cặp 1 — nhãn không phải lý do

```ts
// SAI — bốn từ; đây là một cái nhãn, không phải một dữ kiện
"content-row": {
    classes: ["flex", "flex-row", "flex-wrap", "gap-2"],
    why: "hàng chip nội dung",
}
```

```ts
// ĐÚNG — nói rõ cái gì vỡ khi bỏ nút này đi
"tag-row-under-title": {
    classes: ["flex", "flex-row", "flex-wrap", "gap-2"],
    why: "các thẻ phải xuống dòng riêng trước khi tiêu đề xuống dòng, để một tiêu đề dài không bị bẻ giữa từ",
}
```

### Cặp 2 — nói lại chính cái khoá

```ts
// SAI — mọi từ đều lấy ra từ khoá, nên câu này nói khoá hai lần và không nói gì thêm
"label-over-value": {
    classes: ["flex", "flex-col", "gap-1"],
    why: "label over value label over value label over value",
}
```

```ts
// ĐÚNG — một dữ kiện, không phải một tiếng vọng
"label-over-value": {
    classes: ["flex", "flex-col", "gap-1"],
    why: "con số đọc trước rồi mới tới tên của nó, nên nhãn không bao giờ được đẩy xuống một hàng khác",
}
```

### Cửa lách và nhầm lẫn

```ts
// LUẬT KHÔNG BẮT — dấu backtick làm giá trị không còn là Literal,
// nên TẮT SẠCH luật cho mục này, kể cả sàn mười hai từ.
"content-row": {
    classes: ["flex", "flex-row", "gap-2"],
    why: `hàng chip`,
}
```

```ts
// LUẬT KHÔNG BẮT — đúng mười hai từ nước lã. Chỉ có sàn ĐỘ DÀI, không có thước đo nội dung.
"content-row": {
    classes: ["flex", "flex-row", "gap-2"],
    why: "nút này tồn tại vì thiết kế muốn các con của nó đứng cạnh nhau như vậy",
}
```

```ts
// THÔNG ĐIỆP `restates` GẦN NHƯ KHÔNG BAO GIỜ BẮN ĐƯỢC.
// Nó đòi MỌI từ đều thuộc khoá, trong khi sàn đã là mười hai từ.
// Chỉ cần một từ ngoài khoá — chữ "và" cũng được — là thoát.
"label-over-value": {
    why: "label over value và label over value label over value label",
}
```

```ts
// BÁO THỪA — luật bắn vào MỌI thuộc tính tên `why` trong tệp bảng,
// kể cả một `why` thuộc bảng khác hoặc một đối tượng lồng bên trong.
export const notes = buildNotes({
    "release": { why: "ghi chú" },
})
```

---

## `no-structural-host-outside-contract-frame`

### Cặp 1 — hộp trung tính viết tay

```tsx
{/* SAI — nút không khoá: không gì ghi nó mặc class nào, con nào được vào, và vì sao nó ở đó.
    Bảy hộp trung tính bị cấm VÔ ĐIỀU KIỆN, kể cả khi không mang class nào. */}
export const Region = ({ children }: RegionProps) => <section>{children}</section>
```

```tsx
{/* ĐÚNG — mục tự đặt tên phần tử của nó */}
export const Region = ({ props }: RegionProps) => (
    <Tree contract="page-region-stack" render={regionFrom(props)} />
)
```

### Cặp 2 — phần tử ngữ nghĩa: chỉ cấm khi nó đeo class

```tsx
{/* SAI — mang class là đã thôi làm lớp bọc, thành một nút không khoá */}
<ul className="flex flex-row flex-wrap gap-2">{days}</ul>
```

```tsx
{/* ĐÚNG — mở ra vì Ý NGHĨA, không quyết hình dạng nào; công nghệ trợ giúp đọc ra phần tử */}
<form onSubmit={onSubmit}>
    <Tree contract="field-stack" render={fields} />
</form>
```

```ts
// ĐÚNG — hình dạng của danh sách đó thuộc về một mục, và mục tự khai host
"weekday-run": {
    classNames: ["flex", "flex-row", "flex-wrap", "items-center", "gap-2"],
    children: { day: { leaf: "day-cell", props: { size: "sm" }, repeats: true, restingCount: 6 } },
    host: "ul",
    why: "một dãy cột bằng nhau chỉ còn đọc ra là một quãng thời gian khi các cột còn nằm trên một dòng",
}
```

### Cửa lách và nhầm lẫn

```tsx
{/* LUẬT KHÔNG BẮT — chỉ mười một tên thẻ được liệt kê.
    `article` là một phần tử CHỨA y như `section`, và luật này không có ý kiến gì. */}
<article className="rounded-2xl border p-4">{children}</article>
```

```tsx
{/* LUẬT KHÔNG BẮT — `span` không thuộc tập nào, dù ở đây nó đang làm đúng việc của một nút.
    (Chuỗi class thì bị luật CONTRACT-1 bắt; còn PHẦN TỬ thì không ai hỏi.) */}
<span className="flex items-center gap-2">{children}</span>
```

```tsx
{/* LUẬT KHÔNG BẮT — class đi qua spread; JSXSpreadAttribute không phải JSXAttribute */}
const listProps = { className: "flex flex-wrap gap-2" }

<ul {...listProps}>{days}</ul>
```

```tsx
{/* LUẬT KHÔNG BẮT — tên thẻ không còn là JSXIdentifier viết thường tại nơi gọi */}
const Tag = "div"

<Tag className="rounded-2xl">{children}</Tag>
```

```tsx
{/* LUẬT KHÔNG BẮT — miễn trừ là THƯ MỤC, không phải vai trò.
    Tệp phụ nằm sâu trong một trong bốn nhánh bề mặt được miễn TOÀN BỘ. */}
// branches/SurfaceCard/parts/Divider.tsx
export const Divider = () => <div className="flex h-px w-full bg-neutral-200" />
```

---

## `no-hand-written-contract-attrs`

### Cặp 1 — dấu viết tay

```tsx
{/* SAI — tuyên bố một hợp đồng KHÔNG AI GIỮ.
    Tệ hơn một nút không dấu, vì nút không dấu ít nhất còn thành thật. */}
<div data-node="weekday-run" data-why="một dãy ngày">{days}</div>
```

```tsx
{/* ĐÚNG — vẽ khoá ra, để khung dựng tự sơn dấu từ mục nó đang dựng */}
<Tree contract="weekday-run" render={days} />
```

### Cặp 2 — dấu khác thì luật không quan tâm

```tsx
{/* ĐÚNG — `data-component` không nằm trong tập hai chuỗi, và nó không phải dấu của hợp đồng */}
<Card data-component="SurfaceListCardSurface">{children}</Card>
```

### Cửa lách và nhầm lẫn

```tsx
{/* LUẬT KHÔNG BẮT — spread; chỉ tên thuộc tính viết thẳng trong JSX mới được so */}
<div {...{ "data-node": key, "data-why": reason }}>{children}</div>
```

```ts
// LUẬT KHÔNG BẮT — không đi qua JSX
element.setAttribute("data-node", key)
```

```tsx
{/* LUẬT KHÔNG BẮT — gói vào một đối tượng props thường rồi chuyền xuống */}
const marks = { "data-node": key }

<Row {...marks} />
```

---

## `no-unknown-contract-key`

### Cặp 1 — khoá không có trong bảng

```tsx
{/* SAI — khoá này không mô tả class nào, phần tử nào, lý do nào.
    Thông điệp liệt kê ra các khoá ĐANG có, ngay tại chỗ gõ sai. */}
<Tree contract="weekday-runs" render={days} />
```

```tsx
{/* ĐÚNG */}
<Tree contract="weekday-run" render={days} />
```

### Cặp 2 — dạng gọi hàm

```ts
// SAI — đối số đầu là chuỗi và không thuộc bảng
const spec = contractSpec("title-with-baselinefact")
```

```ts
// ĐÚNG
const spec = contractSpec("title-with-baseline-fact")
```

### Cửa lách và nhầm lẫn

```tsx
{/* LUẬT KHÔNG BẮT — BỐN TRÊN NĂM dạng tham chiếu đều không được kiểm.
    Đây chính là bốn dạng mà `no-dead-contract-key` ĐẾM là tham chiếu.
    Nên một khoá gõ sai ở đây vừa không bị báo, vừa đủ để giữ sống một khoá đã chết. */}
const Content = defineContractComponent("weekday-runs", ContentView)
const Projected = defineContractProjection("weekday-runs", project)
const entry = CONTRACTS["weekday-runs"]
const slot = { contract: "weekday-runs" }
```

```tsx
{/* LUẬT KHÔNG BẮT — khoá động, kể cả khi cả hai nhánh đều sai */}
<Tree contract={props.isCompact ? "a-typo" : "another-typo"} render={render} />
```

```tsx
{/* LUẬT KHÔNG BẮT — tên phần tử phải đọc ra ĐÚNG bằng `Tree` */}
import { Tree as Node } from "@/components/branches/Tree"

<Node contract="weekday-runs" render={days} />
```

```ts
// ĐỊNH DẠNG LẠI BẢNG LÀ TẮT LUẬT — biểu thức chính quy đòi ĐÚNG BỐN ký tự trắng đầu dòng.
// Bảng thụt hai dấu cách ⇒ danh sách khoá rỗng ⇒ bộ đọc trả null ⇒ luật TẮT TRONG IM LẶNG.
export const CONTRACTS = buildContracts({
  "weekday-run": {
    classNames: ["flex", "gap-2"],
  },
})
```

```ts
// BÁO SAI — mẫu khoá là [a-z][a-z-]*, KHÔNG có chữ số.
// Khoá này không lọt vào danh sách, nên MỌI chỗ dùng đúng nó đều bị báo là khoá lạ.
export const CONTRACTS = buildContracts({
    "grid-2-up": {
        classNames: ["grid", "grid-cols-2", "gap-4"],
        why: "hai cột phải giữ bằng nhau để mắt so được hai giá trị mà không cần dịch chuyển",
    },
})
```

---

## `no-duplicate-entry-shape`

### Cặp 1 — cùng hình dạng, hai cái tên

```ts
// SAI — mục sau bị báo: cùng bộ class (không kể thứ tự), cùng host, cùng khe.
// Một `restingCount` khác, một `why` khác, một cái tên khác đều KHÔNG phải hình dạng khác.
export const CONTRACTS = buildContracts({
    "task-list": {
        classNames: ["flex", "flex-col", "gap-2"],
        why: "các việc phải đọc thành một cột liền để mắt dò xuống mà không nhảy cột",
    },
    "alert-list": {
        classNames: ["gap-2", "flex-col", "flex"],
        why: "các cảnh báo phải đọc thành một cột liền để mắt dò xuống mà không nhảy cột",
    },
})
```

```ts
// ĐÚNG — hai hình dạng thật sự khác nhau: một cái khai host, một cái không
export const CONTRACTS = buildContracts({
    "task-list": {
        classNames: ["flex", "flex-col", "gap-2"],
        why: "các việc phải đọc thành một cột liền để mắt dò xuống mà không nhảy cột",
    },
    "alert-run": {
        classNames: ["flex", "flex-row", "flex-wrap", "gap-2"],
        host: "ul",
        why: "các cảnh báo xuống dòng theo bề ngang, nên mất chỗ thì chúng gãy dòng chứ không tràn ra ngoài",
    },
})
```

### Cửa lách và nhầm lẫn

```ts
// LUẬT KHÔNG BẮT — một SpreadElement làm mục KHÔNG ĐỌC TĨNH ĐƯỢC,
// và mục không đọc được thì bị BỎ QUA chứ không bị báo. Một dấu ba chấm giấu bản sao vĩnh viễn.
export const CONTRACTS = buildContracts({
    "task-list": { classNames: ["flex", "flex-col", "gap-2"], why: "…" },
    "alert-list": { ...shared, classNames: ["flex", "flex-col", "gap-2"] },
})
```

```ts
// LUẬT KHÔNG BẮT — class lấy từ hằng số, không phải mảng literal ⇒ mục bị bỏ qua
const STACK = ["flex", "flex-col", "gap-2"]

export const CONTRACTS = buildContracts({
    "alert-list": { classNames: STACK, why: "…" },
})
```

```ts
// BÁO THỪA — `props` của khe bị bỏ ra ngoài hình dạng CÓ CHỦ Ý,
// nên hai khe ràng buộc literal khác nhau vẫn bị coi là cùng một hình dạng.
{
    "small-run": { children: { item: { leaf: "chip", props: { size: "sm" } } } },
    "large-run": { children: { item: { leaf: "chip", props: { size: "lg" } } } },
}
```

---

## `no-interaction-class-in-entry`

### Cặp 1 — hành vi

```ts
// SAI — mục đang HỨA rằng nút bấm được, trong khi thứ thật sự bấm được nằm chỗ khác,
// và bảng là bên không thể được báo rằng lời hứa đã tắt.
"pressable-row": {
    classNames: ["flex", "items-center", "gap-3", "cursor-pointer", "hover:opacity-80"],
    why: "…",
}
```

```ts
// ĐÚNG — mục giữ đúng phần sắp xếp; hành vi thuộc nhánh vẽ ra cái điều khiển
"row-with-trailing-fact": {
    classNames: ["flex", "items-center", "justify-between", "gap-3"],
    why: "con số đứng cuối hàng phải giữ được lề phải khi nhãn dài ra, nếu không hai hàng lệch nhau",
}
```

### Cặp 2 — màu của một giá trị

```ts
// SAI — màu chữ là sơn của MỘT giá trị, mà lá vẽ giá trị đó đã sở hữu nó rồi
"muted-caption-stack": {
    classNames: ["flex", "flex-col", "gap-1", "text-muted"],
    why: "…",
}
```

```ts
// ĐÚNG — canh lề thì được: `text-center` nói cách MỌI con nằm bên trong, đó là quan hệ
"centered-empty-state": {
    classNames: ["flex", "flex-col", "items-center", "gap-3", "text-center"],
    why: "dòng giải thích phải canh giữa theo hình minh hoạ, nếu không khối rỗng đọc ra là lệch",
}
```

### Cặp 3 — nền và độ nổi

```ts
// SAI — nền cộng độ nổi làm nút thành một VẬT THỂ, mà vật thể đã có chủ là nhánh bề mặt
"card-stack": {
    classNames: ["flex", "flex-col", "gap-4", "bg-surface", "shadow-md"],
    why: "…",
}
```

```ts
// ĐÚNG — dải chạy hết bề ngang và tự kẻ ranh giới: nền duy nhất một mục được phép giữ
"page-band": {
    classNames: ["flex", "flex-col", "gap-6", "w-full", "border-b", "bg-surface"],
    why: "dải phải chạm hai mép và tự kẻ ranh giới, vì nó không có đường viền riêng để tự đóng lại",
}
```

### Cửa lách và nhầm lẫn

```ts
// LUẬT KHÔNG BẮT — ba biểu thức đối chiếu chuỗi THÔ, KHÔNG cắt biến thể,
// khác hẳn `no-literal-structural-class` vốn có cắt. Thêm một tiền tố là đi thẳng vào bảng.
"pressable-row": {
    classNames: ["flex", "md:cursor-pointer", "lg:bg-surface", "dark:shadow-md", "!bg-surface"],
}
```

```ts
// LUẬT KHÔNG BẮT — họ nền/nổi chỉ có hai tiền tố, họ màu chỉ có sáu tên chính xác
"card-stack": {
    classNames: ["flex", "flex-col", "gap-4", "bg-white", "drop-shadow-lg", "ring-1", "text-primary"],
}
```

```ts
// LUẬT KHÔNG BẮT — ngoại lệ dải là một MẬT KHẨU HAI TOKEN.
// Thêm `w-full` và `border-b` là mở được nền cho một thứ vốn là cái thẻ.
"card-stack": {
    classNames: ["flex", "flex-col", "gap-4", "rounded-2xl", "w-full", "border-b", "bg-surface"],
}
```

---

## `no-dead-contract-key`

### Cặp 1 — khoá không ai vẽ

```ts
// SAI — không `contract="…"`, không `defineContractComponent`, không `CONTRACTS[…]`,
// và không khe con nào của mục khác khai. Đây là lời hứa về một cái không tồn tại.
"planned-detail-stack": {
    classNames: ["flex", "flex-col", "gap-4"],
    why: "phần chi tiết sẽ xếp dọc khi màn hình hẹp lại, để hai cột không bị ép quá chật",
}
```

```ts
// ĐÚNG — khoá con được khai trong khe của mục cha thì được TÍNH LÀ CÓ NGƯỜI VẼ,
// dù không tệp nào ngoài bảng gọi tên nó (bảng là tệp duy nhất bị bỏ qua khi đi bộ).
"detail-page": {
    classNames: ["flex", "flex-col", "gap-6"],
    children: { detail: { contract: "planned-detail-stack" } },
    why: "phần đầu trang và phần chi tiết cuộn chung một mạch, nên chúng phải là hai con của một cha",
}
```

### Cặp 2 — story vẫn tính

```tsx
{/* ĐÚNG — story và test ĐƯỢC đi bộ như mã sản phẩm.
    Một hình dạng chứng minh được ở đó là hình dạng có tài liệu, không phải hình dạng chết. */}
export const Resting = () => <Tree contract="planned-detail-stack" render={detail} />
```

### Cửa lách và nhầm lẫn

```md
<!-- BÁO CHẾT OAN — chỉ sáu phần mở rộng mã nguồn được đi bộ.
     Khoá chỉ được gọi tên trong tài liệu thì bị báo chết, và finding tới dưới dạng LỆNH XOÁ. -->
Dùng `contract="planned-detail-stack"` cho khối chi tiết.
```

```tsx
{/* BÁO CHẾT OAN — khoá dựng động, trong một tệp không hề nhắc chữ `ContractKey`.
    Nó vẽ ở mọi lần tải, và luật bảo đem xoá. */}
<Tree contract={`row-${props.size}`} render={row} />
```

```ts
// CHIỀU NGƯỢC LẠI — mẫu `contract: "…"` khớp MỌI thuộc tính tên `contract` ở MỌI tệp.
// Một dòng dữ liệu nghiệp vụ giữ sống một khoá đã chết, và không ai biết.
const posting = { title: "Kỹ sư giao diện", contract: "full-time" }
```

```ts
// CHIỀU NGƯỢC LẠI — chỉ cần tệp có nhắc tên kiểu `ContractKey` là MỌI literal
// thường có gạch nối trong tệp được tính là tham chiếu. Một bảng dịch cũng đủ.
const label: Record<string, string> = {
    "weekday-run": "Dãy ngày",
    "planned-detail-stack": "Khối chi tiết",
}
export const pick = (key: ContractKey) => label[key]
```

---

## Ánh xạ yêu cầu sang một luật máy giữ

Nêu **tệp**, **thứ đang viết** và **điều muốn chặn**. Nếu điều muốn chặn không có luật nào giữ, câu
trả lời là **nói ra điều đó**, không phải chọn một luật gần đúng.

| Yêu cầu bằng lời | Luật máy giữ | Mã | Kết quả |
|---|---|---|---|
| Cấm gõ `flex gap-4` thẳng ở màn hình | `no-literal-structural-class` | `CONTRACT-1` | Báo tại thuộc tính, và tại hằng số nếu chuỗi bị nâng lên |
| Cấm rẽ nhánh class lúc chạy | `no-class-composition-outside-contract` | `CONTRACT-2` | Báo tại lời gọi, và tại thuộc tính nếu có nội suy |
| Chặn một nhánh đeo hợp đồng của khoá lên phần tử của nó | `only-the-frame-wears-a-node` | `CONTRACT-4` | Báo mọi lời gọi `contractNodeProps` ngoài khung dựng |
| Bắt mọi mục phải nói lý do thật | `contract-why-is-a-reason` | `CONTRACT-6` | Sàn mười hai từ; chỉ với `why` viết bằng nháy thường |
| Cấm mở `div` bằng tay | `no-structural-host-outside-contract-frame` | `CONTRACT-7` | Bảy hộp trung tính cấm tuyệt đối; bốn phần tử ngữ nghĩa cấm khi đeo class |
| Cấm bịa dấu hợp đồng | `no-hand-written-contract-attrs` | `CONTRACT-8` | Báo hai tên thuộc tính viết thẳng trong JSX |
| Chặn hai khoá cùng một hình dạng | `no-duplicate-entry-shape` | `CONTRACT-9` | Báo trên mục sau, kèm tên mục trước |
| Chặn khoá gõ sai | `no-unknown-contract-key` | *không mã nào* | Chỉ với `<Tree contract="…">` và `contractSpec("…")` |
| Cấm mục vẽ hành vi, màu, vật thể | `no-interaction-class-in-entry` | `CONTRACT-12` | Ba họ class, đối chiếu chuỗi thô |
| Dọn khoá không ai vẽ | `no-dead-contract-key` | `CONTRACT-13` | Sau một lượt đi bộ cây; im lặng khi không đi được |
| **Bắt một khoá phải có TÊN nói rõ bên trong chứa gì** | **không luật nào** | `CONTRACT-5` | Chỉ tồn tại dưới dạng lời khuyên trong thông điệp của một luật khác |
| **Cấm một giá trị ngoài thang** | **không luật nào — và không cần** | `CONTRACT-3` | Union đóng: giá trị sai **không viết ra được** |
| **Kiểm khe con đúng danh tính, đúng props, đủ số lượng** | **không luật nào — và không cần** | `CONTRACT-11` | Trình biên dịch giữ; thêm một luật ở đây là canh một cánh cửa đã khoá |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `no-literal-structural-class` / `no-class-composition-outside-contract` | Chuỗi này **tĩnh** hay được **dựng lúc chạy**? Tĩnh thì luật đầu; có lỗ thì luật sau; **ba ngôi thì không luật nào**. |
| `no-structural-host-outside-contract-frame` / `no-literal-structural-class` | Vấn đề là **phần tử** hay là **class**? Cả hai đều bắn trên một `<div className="flex">`, và sửa một cái không tắt cái kia. |
| `no-unknown-contract-key` / `no-dead-contract-key` | Đang hỏi "khoá này **có thật** không" hay "khoá này **có ai vẽ** không"? Hai luật đọc hai đầu của cùng một bảng và **bất đồng** về việc gọi tên một khoá trông ra sao. |
| `no-duplicate-entry-shape` / `no-unknown-contract-key` | `CONTRACT-9` thật sự nằm ở luật **trùng hình dạng**. Luật khoá lạ chỉ kiểm phép thuộc tập. |
| `no-interaction-class-in-entry` / `no-literal-structural-class` | Class nằm **trong bảng** hay nằm **ở nơi gọi**? Hai luật không bao giờ bắn cùng một chỗ: một cái chỉ chạy trong tệp bảng, cái kia bị tắt ở đó. |
| Mọi luật / im lặng | Tệp có nằm dưới `/src/` không? Không thì **không luật nào chạy**, và bản chạy vẫn xanh. |

## Sai lầm lặp lại nhiều nhất

1. **Tin rằng bản chạy xanh nghĩa là luật đã giữ.** Tệp ngoài `/src/`, bảng thụt hai dấu cách, cây
   không đi bộ được — cả ba đều cho ra **xanh**, và cả ba nghĩa là **không ai nhìn**.
2. **Dùng ba ngôi để chọn class.** Lọt cả hai luật class cùng lúc. Đây là cửa dễ đi nhất.
3. **Gom class vào một đối tượng hằng số cho gọn.** Không phải phá hoại — nhưng nó xoá sạch cả hai bộ
   thăm của `CONTRACT-1`.
4. **Dời một tệp vào `leaves/` để hết bị báo.** Miễn trừ là **thư mục**, nên chuyện này luôn thành
   công. Câu hỏi giữ một thành phần ở ngoài là câu hỏi **do người đặt**.
5. **Thêm một tiền tố biến thể vào class trong bảng.** `md:cursor-pointer` đi thẳng vào, vì luật cấp
   bảng **không cắt biến thể**.
6. **Đổi tên khoá thành có chữ số.** Mọi chỗ dùng đúng lập tức bị báo là khoá lạ.
7. **Xoá một khoá vì luật bảo nó chết**, trong khi nó chỉ được gọi tên trong tài liệu hoặc dựng động.
8. **Sửa một finding bằng cách dịch nó sang một kiểu node khác** — từ literal sang đối tượng, từ lời
   gọi sang bí danh, từ thuộc tính sang spread. Báo cáo tắt, vi phạm còn nguyên.
