---
id: fe-patterns-props-and-slots-example
title: example.md
slug: /fe/patterns/props-and-slots/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã SLOTS-N, viết bằng TSX thường.
---

# example.md

> Version: `2.00` · Module: `props-and-slots` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường**. Không component library, không design system riêng, không
registry key thật. Một luật chỉ đúng khi nó đúng ở bất kỳ front end nào — nên nếu một ví dụ cần tên
riêng của một sản phẩm mới đọc được, ví dụ đó sai chỗ.

Bốn alias tầng được dùng xuyên suốt trang này là `LeafProps`, `CompositeProps`, `BranchProps` và
`BlockProps`. Chúng là hàng rào; chúng không được sửa ở nơi dùng.

Mỗi mã có **nhiều case**, mỗi case đặt **ĐÚNG** cạnh **SAI**, rồi tới mục **ngoại lệ và nhầm lẫn**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một quyết định slot duy nhất.

---

## `SLOTS-1` — slot dữ liệu chỉ chứa dữ liệu

### Case: handler đi cùng dữ liệu mà nó tác động lên

```tsx
// ĐÚNG
type InvoiceRowData = {
    readonly invoiceId: string
    readonly amountLabel: string
    readonly isOverdue: boolean
}

type InvoiceRowActions = {
    readonly onDownload?: (invoiceId: string) => void
}

type InvoiceRowProps = LeafProps<InvoiceRowData, InvoiceRowActions>

export const InvoiceRow = ({ props, on }: InvoiceRowProps) => (
    <div className="flex items-center justify-between p-4">
        <span>{props.amountLabel}</span>
        <button onClick={() => on?.onDownload?.(props.invoiceId)} type="button">Tải hoá đơn</button>
    </div>
)
```

```tsx
// SAI
type InvoiceRowData = {
    readonly invoiceId: string
    readonly amountLabel: string
    readonly onDownload: () => void
}
```

Hai bản chỉ khác nhau ở một điều: bản dưới đã đóng dữ liệu vào trong một closure mà không ai bên ngoài
đọc được. `on` tồn tại để câu hỏi "component này **làm** gì" trả lời được mà không phải đọc thân hàm.

### Case: một component đi lạc qua slot dữ liệu

```tsx
// SAI
<StatusCell props={{ label: "Đã nộp", icon: CheckIcon }} />
```

```tsx
// ĐÚNG
<StatusCell props={{ label: "Đã nộp", tone: "positive" }} />
```

Bản trên khiến caller trở thành tác giả của một shape không ai tìm được từ bên ngoài: muốn biết ô này
vẽ ra gì thì phải đi đọc từng call site. Bản dưới nói ra **ý nghĩa**, và component giữ quyền quyết
định hình.

### Case: dữ liệu lồng nhau vẫn là dữ liệu

```tsx
// ĐÚNG
type ProgressCardData = {
    readonly title: string
    readonly milestones: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly isDone: boolean
    }>
}
```

```tsx
// SAI
type ProgressCardData = {
    readonly title: string
    readonly milestones: ReadonlyArray<{
        readonly id: string
        readonly render: () => JSX.Element
    }>
}
```

Chiều sâu không phải tiêu chí. Ràng buộc chạy **xuống tận đáy**: một hàm nằm ở tầng thứ ba của một
object vẫn là một hàm nằm trong slot dữ liệu.

### Ngoại lệ và nhầm lẫn

- **`boolean` là dữ liệu hợp lệ.** `isOverdue`, `isSelected`, `isLoading` đều qua được `SLOTS-1`. Nếu
  một cờ vẫn sai chỗ thì mã cần tra là `SLOTS-5` hoặc `SLOTS-6`, không phải mã này.
- **Chuỗi class cũng là dữ liệu hợp lệ về kiểu** — và vẫn bị `SLOTS-6` từ chối vì lý do khác hẳn.
- **Đừng "sửa" bằng cách nới ràng buộc:**

  ```tsx
  // SAI
  type LooseData = { readonly [key: string]: unknown }
  ```

  Nới `DataValue` thành `unknown` không sửa một call site nào cả; nó gỡ hàng rào cho toàn hệ thống để
  một file khỏi phải đổi.

---

## `SLOTS-2` — dữ liệu khai bằng `type`

### Case: cùng một shape, hai công cụ

```tsx
// ĐÚNG
type BadgeData = {
    readonly label: string
    readonly tone: "neutral" | "positive" | "warning"
}
```

```tsx
// SAI
interface BadgeData {
    readonly label: string
    readonly tone: "neutral" | "positive" | "warning"
}
```

Hai bản chỉ khác nhau ở một điều: bản dưới không có implicit index signature, nên nó **thôi thoả mãn**
ràng buộc đang giữ hàm ra khỏi slot dữ liệu. Hàng rào không kêu ở đây; nó vắng mặt ở đây.

### Case: lỗi rơi xuống chỗ dùng, không rơi ở chỗ khai

```tsx
// SAI — lỗi hiện ở dòng này, dù nguyên nhân nằm ở file khai `BadgeData`
type BadgeProps = LeafProps<BadgeData>
```

Đây là chỗ mã này hay bị chẩn đoán nhầm nhất: người đọc thấy alias tầng đỏ và kết luận alias tầng
hỏng. Alias tầng đang làm đúng việc của nó.

### Case: sửa đúng chỗ

```tsx
// ĐÚNG
type BadgeData = {
    readonly label: string
    readonly tone: "neutral" | "positive" | "warning"
}

type BadgeProps = LeafProps<BadgeData>
```

```tsx
// SAI
interface BadgeData {
    readonly label: string
}

type BadgeProps = { readonly props: BadgeData }
```

Bản dưới làm cho lỗi biến mất bằng cách bỏ luôn hàng rào — biên dịch xanh, và từ giờ `props` nhận
được bất cứ thứ gì `BadgeData` cho phép, kể cả sau này nó mọc thêm một field hàm.

### Ngoại lệ và nhầm lẫn

- **`interface` không bị cấm trong cả repo.** Nó bị cấm cho **shape dữ liệu của component**. Một
  interface mô tả một object của vendor, một response schema hay một hợp đồng service không thuộc mã
  này.
- **Đổi `interface` thành `type` không phải reformat.** Nó là khôi phục một ràng buộc, nên nó thuộc
  về commit sửa lỗi chứ không phải commit dọn style.

---

## `SLOTS-3` — hình dạng của tham số phải có tên

### Case: shape gõ thẳng vào tham số

```tsx
// ĐÚNG
export const SummaryRow = ({ props }: SummaryRowProps) => (
    <div className="flex items-center justify-between">
        <span>{props.label}</span>
        <span className="tabular-nums">{props.value}</span>
    </div>
)
```

```tsx
// SAI
export const SummaryRow = ({ props }: { props: { label: string; value: string } }) => (
    <div className="flex items-center justify-between">
        <span>{props.label}</span>
        <span className="tabular-nums">{props.value}</span>
    </div>
)
```

Hai bản chỉ khác nhau ở một điều: có thứ gì khác **tham chiếu** được tới shape này không. Giá của việc
đặt tên là một dòng; thứ mua được là khác biệt giữa một hợp đồng và một chữ ký.

### Case: intersection lắp tại tham số

```tsx
// SAI
export const OverviewPage = (
    input: PageFrame & { readonly signOutLabel: string; readonly unavailableMessage: string },
) => <Frame props={input} />
```

```tsx
// ĐÚNG
export type OverviewPageProps = PageFrame & OverviewPageCopy

export const OverviewPage = (input: OverviewPageProps) => <Frame props={input} />
```

Có tên một nửa không phải là có tên. Phần copy ở bản trên không import được, nên twin test buộc phải
chép lại nó — và bản chép đó bắt đầu già đi từ dòng tiếp theo.

### Case: twin test là chỗ hậu quả lộ ra

```tsx
// SAI — test phải dựng lại shape vì không có gì để import
const input = { label: "Tổng cộng", value: "1.200.000đ" }
render(<SummaryRow props={input} />)
```

```tsx
// ĐÚNG
const input: SummaryRowProps = { props: { label: "Tổng cộng", value: "1.200.000đ" } }
render(<SummaryRow {...input} />)
```

### Ngoại lệ và nhầm lẫn

- **Tham số vô hướng không thuộc mã này:**

  ```tsx
  // ĐÚNG
  const formatMinutes = (value: number) => `${value} phút`
  ```

- **Destructure không có kiểu là một câu hỏi khác** và không phải mã này.
- **Ngoặc đơn không giấu được gì:**

  ```tsx
  // SAI
  const Row = ({ label }: ({ label: string })) => <span>{label}</span>
  ```

- **Tên phải là `XProps` cho component `X`.** Một tên hợp lệ nhưng đặt bừa vẫn qua được lint, và đó là
  phần mà chỉ người đọc giữ được.

---

## `SLOTS-4` — `contract` + `render` là ranh giới tầng

### Case: container mở, khai đủ hai slot

```tsx
// ĐÚNG
type SectionCardProps = BranchProps<SectionCardData, "section-card">

export const SectionCard = ({ props, contract, render }: SectionCardProps) => (
    <section className="rounded-lg border p-4">
        <h2>{props.title}</h2>
        <Tree contract={contract} render={render} />
    </section>
)
```

```tsx
// SAI
interface SectionCardProps {
    readonly title: string
    readonly children?: ReactNode
}
```

Bản dưới nhận vào thứ **đã dựng xong**, nên không ai phát biểu được phần bên trong section này là gì —
không tài liệu, không test, không compiler. Slot có tên tồn tại để câu đó phát biểu được.

### Case: shape đóng mọc thêm slot

```tsx
// SAI
type PriceTagProps = CompositeProps<PriceTagData> & {
    readonly render: ContractComponent<"price-tag">
}
```

```tsx
// ĐÚNG
type PriceTagProps = CompositeProps<PriceTagData>
```

Nếu bản trên là thứ thật sự cần, thì kết luận không phải "thêm slot" mà là "component này thuộc tầng
container" — và nó phải chuyển sang tầng đó, mang theo cả tên file lẫn call site.

### Case: shell trao thẳng phần bên trong cho vendor

```tsx
// ĐÚNG — một trong bốn file được miễn
type ModalShellProps = { readonly children?: ReactNode; readonly isOpen: boolean }

export const ModalShell = ({ children, isOpen }: ModalShellProps) => (
    <VendorDialog open={isOpen}>{children}</VendorDialog>
)
```

```tsx
// SAI — cùng một dáng, khác một điều: file này sắp xếp
export const PopoverShell = ({ children }: PopoverShellProps) => (
    <div className="rounded-lg border p-2">{children}</div>
)
```

Miễn trừ không cấp cho một hình dạng, nó cấp cho **bốn file** đã chứng minh là không sắp xếp gì. Cái
`div` có padding ở bản dưới chính là hành vi sắp xếp.

### Case: cùng slot đó đi cửa khác

```tsx
// SAI
export const ResultList = ({ props, children }: ResultListProps) => (
    <ul>{children}</ul>
)
```

Destructure không tạo ra một slot khác. Nếu shape của props đã không được phép khai lỗ markup thì tham
số cũng không.

### Ngoại lệ và nhầm lẫn

- **Page nhận thứ framework trao là hợp lệ** — một page nằm ngoài các tầng component.
- **Một object thường có field trùng tên không phải slot:**

  ```tsx
  // ĐÚNG
  const spec = { children: [] }
  ```

- **`render` không nhận JSX dựng sẵn hay một callback trần.** Cả hai đều không mang metadata của khoá,
  nên `contract` và `render` sẽ thôi là **một** quyết định được kiểm.

---

## `SLOTS-5` — `isLoading` được nhận

### Case: leaf nhận cờ

```tsx
// ĐÚNG
type AvatarProps = LeafProps<AvatarData>

export const Avatar = ({ props, isLoading }: AvatarProps) =>
    isLoading ? <span className="size-10 rounded-full bg-neutral-200" /> : <img alt={props.name} src={props.url} />
```

```tsx
// SAI
export const Avatar = ({ props }: AvatarProps) => {
    const { data, isLoading } = useProfileQuery(props.userId)
    return isLoading ? <span className="size-10 rounded-full bg-neutral-200" /> : <img alt={data.name} src={data.url} />
}
```

Bản dưới trả lời một câu hỏi mà tầng trên đã trả lời rồi. Hậu quả không phải là code thừa: hai
component trong cùng một cây bắt đầu chờ lệch nhau, và màn hình nhấp nháy theo thứ tự request về chứ
không theo thứ tự nội dung.

### Case: tầng sở hữu request ghi cờ một lần

```tsx
// ĐÚNG
type DashboardBlockProps = BlockProps<"loading" | "ready" | "empty", DashboardBlockData>

export const DashboardBlock = ({ state, props }: DashboardBlockProps) => (
    <SummaryCard props={props.summary} isLoading={state === "loading"} />
)
```

```tsx
// SAI
type DashboardBlockProps = BlockProps<"ready", DashboardBlockData> & { readonly isLoading?: boolean }
```

Tầng ghi cờ thì không nhận cờ. Props của nó mang **tình huống nghiệp vụ**, và "đang tải" chỉ là một
trong các tình huống đó — trộn thêm một cờ vào là mô tả cùng một sự thật hai lần, ở hai chỗ có thể mâu
thuẫn nhau.

### Case: cờ đi xuống nhiều tầng vẫn là một cờ

```tsx
// ĐÚNG
export const SummaryCard = ({ props, isLoading }: SummaryCardProps) => (
    <>
        <MetricRow props={props.completed} isLoading={isLoading} />
        <MetricRow props={props.streak} isLoading={isLoading} />
    </>
)
```

### Ngoại lệ và nhầm lẫn

- **Trạng thái tương tác cục bộ không phải cờ chờ.** Một menu tự biết mình đang mở là chuyện của
  component đó; "dữ liệu đã về chưa" thì không.
- **Không lint nào bắt được mã này.** Nó chỉ được giữ bởi người đọc diff — nên nó là mã dễ trôi nhất
  trong module.

---

## `SLOTS-6` — không có slot ngoại hình

### Case: caller muốn nhấn mạnh một dòng

```tsx
// ĐÚNG
<LeaderboardRow props={{ name, points, isOwnRow: true }} />
```

```tsx
// SAI
<LeaderboardRow props={{ name, points }} nameClassName={isMe ? "text-accent" : undefined} />
```

Hai bản chỉ khác nhau ở một điều: ai quyết định "dòng của chính mình" trông thế nào. Bản trên nói ra
**sự thật nghiệp vụ** và để component chọn hình; bản dưới trao cho mọi call site quyền quyết định hình,
và không call site nào biết các call site khác đã chọn gì.

### Case: variant được khai thành một union đóng

```tsx
// ĐÚNG
type ActionButtonData = {
    readonly label: string
    readonly intent: "primary" | "secondary" | "danger"
}
```

```tsx
// SAI
type ActionButtonData = {
    readonly label: string
    readonly className: string
}
```

### Case: hook styling cho từng phần bên trong

```tsx
// SAI
<ProfileCard props={{ name }} classNames={{ header: "pt-6", body: "gap-4", footer: "border-t" }} />
```

Mỗi phần tử bên trong vừa trở thành **bề mặt công khai**. Sau prop này, đổi cây DOM bên trong
`ProfileCard` là một breaking change, và không ai gọi tên được lý do.

### Case: khoảng cách thuộc về cha, không thuộc về prop

```tsx
// ĐÚNG
<div className="flex flex-col gap-4">
    <ProfileCard props={profile} />
    <ProgressCard props={progress} />
</div>
```

```tsx
// SAI
<ProfileCard props={profile} marginBottom="1rem" />
```

Khoảng cách giữa hai anh em là quan hệ giữa chúng, nên nó do cha sở hữu. Một component tự đẩy anh em
của nó ra là đang phát biểu về thứ nó không nhìn thấy.

### Ngoại lệ và nhầm lẫn

- **Không có ngoại lệ nào cho mã này.** Không có "chỉ lần này", không có prop styling tạm để kịp
  release.
- **Nếu không đặt tên được variant, thì yêu cầu chưa rõ.** Câu hỏi cần hỏi là "chỗ này khác vì lý do
  nghiệp vụ gì", không phải "cho mình một class nhé".
- **`tone`, `intent`, `size` là variant hợp lệ**; `className`, `style`, `gap` thì không — khác nhau ở
  chỗ một bên nói ý nghĩa, một bên nói cách vẽ.

---

## `SLOTS-7` — collection đi theo tên domain trong `props`

### Case: một surface dùng chung hiển thị danh sách nhiệm vụ

```tsx
// ĐÚNG
<ListSurfaceHost
    contract="daily-task-list"
    render={DailyTaskContent}
    props={{ title: "Nhiệm vụ hôm nay", tasks }}
/>
```

```tsx
// SAI
<ListSurfaceHost
    contract="daily-task-list"
    render={DailyTaskContent}
    props={{ title: "Nhiệm vụ hôm nay" }}
    items={tasks}
/>
```

Hai bản chỉ khác nhau ở một điều: có bao nhiêu đường để dữ liệu runtime đi vào. Bản dưới mở đường thứ
hai, và caller tiếp theo sẽ hỏi "collection của tôi đi đường nào" — một câu hỏi chỉ tồn tại sau khi
đường thứ hai tồn tại.

### Case: component `render` sở hữu shape domain

```tsx
// ĐÚNG
type DailyTaskContentData = {
    readonly title: string
    readonly tasks: ReadonlyArray<{ readonly id: string; readonly label: string; readonly isDone: boolean }>
}

export const DailyTaskContent = ({ props }: LeafProps<DailyTaskContentData>) => (
    <ul className="divide-y">
        {props.tasks.map((task) => (
            <li className="p-4" key={task.id}>{task.label}</li>
        ))}
    </ul>
)
```

Đây là chỗ tên domain sống: `tasks` là tên thật của collection, và nó được khai ở component biết về
domain, không ở surface dùng chung.

### Case: domain thứ hai không dạy gì thêm cho surface

```tsx
// ĐÚNG
<ListSurfaceHost contract="course-list" render={CourseListContent} props={{ title: "Khoá đang học", courses }} />
```

```tsx
// SAI
<ListSurfaceHost contract="course-list" render={CourseListContent} props={{ title: "Khoá đang học" }} items={courses} />
```

Đến caller thứ ba thì surface ở bản dưới đã biết ba mô hình collection mà đáng lẽ nó không cần biết
mô hình nào.

### Ngoại lệ và nhầm lẫn

- **Một component tự nó lặp không thuộc mã này.** `SLOTS-7` nói về **surface dùng chung** nhận
  collection của caller, không nói về mọi component có `.map`.
- **Lint chỉ bắt được một import path.** Một surface dùng chung khác mọc thêm làn `items` sẽ **không**
  đỏ — xem `audit.md`.

---

## Ánh xạ yêu cầu sang một quyết định slot

Nêu tầng, dữ liệu, hành vi và ai sở hữu request. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu
cụ thể rồi dừng. Câu trả lời phải là một quyết định slot hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Row có nút tải hoá đơn riêng | Hành vi không đi cùng giá trị nó tác động lên | `SLOTS-1` | `LeafProps<D, A>`, handler nằm trong `on` |
| Khai shape dữ liệu cho một card | Alias giữ ràng buộc; interface làm nó vắng mặt | `SLOTS-2` | `type CardData = { … }` |
| Component mới, có ba chuỗi copy | Shape của tham số phải import được | `SLOTS-3` | `type XProps = …` khai trong module |
| Màn hình quyết định phần thân của card | Caller được đổ nội dung ⇒ container | `SLOTS-4` | `BranchProps<D, K>` với `contract` + `render` |
| Card hiển thị skeleton khi chờ | Tầng dưới không sở hữu request | `SLOTS-5` | Nhận `isLoading`, không tự tính |
| Dòng của chính mình cần nổi bật | Đó là sự thật nghiệp vụ, không phải class | `SLOTS-6` | Thêm `isOwnRow` vào dữ liệu, variant quyết định bên trong |
| Surface dùng chung hiển thị danh sách khoá học | Collection đi dưới tên domain | `SLOTS-7` | `props={{ …, courses }}` |
| Wrapper chỉ trao phần bên trong cho modal của vendor | File không sắp xếp gì | `SLOTS-4` (ngoại lệ) | Nằm trong bốn file được miễn, hoặc không được miễn |

Câu hỏi phân định **chỉ** được hỏi khi dữ kiện quyết định thật sự thiếu, ví dụ: *"Caller có được quyết
định phần bên trong không, hay chỉ được truyền dữ liệu vào một cấu trúc cố định?"*

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định |
|---|---|
| `SLOTS-1` / `SLOTS-4` | Thứ đi lạc vào `props` là một handler, hay là **phần bên trong** mà caller muốn quyết định? |
| `SLOTS-1` / `SLOTS-2` | Vấn đề là **giá trị được truyền**, hay là **cách khai kiểu** của nó? |
| `SLOTS-2` / `SLOTS-3` | Kiểu này thiếu **tên**, hay thiếu **đúng công cụ khai báo**? |
| `SLOTS-4` / `SLOTS-7` | Caller có được đổ nội dung vào không, hay câu đó đã xong và chỉ còn hỏi dữ liệu đi đường nào? |
| `SLOTS-5` / `SLOTS-1` | Cờ này sai **kiểu**, hay sai **người viết ra nó**? |
| `SLOTS-6` / `SLOTS-4` | Caller đang mở **diện mạo**, hay đang mở **cấu trúc**? |
| `SLOTS-6` / `SLOTS-1` | Chuỗi này là dữ liệu nghiệp vụ, hay là cách vẽ? |

## Sai lầm lặp lại nhiều nhất

1. Khai shape dữ liệu bằng `interface`, rồi nới ràng buộc của alias tầng để làm biên dịch xanh.
2. Gõ shape thẳng vào tham số vì "chỉ có hai field".
3. Lắp intersection tại tham số và tưởng rằng có tên một nửa là đã có tên.
4. Mở một lỗ markup "chỉ lần này thôi" trên một component không thuộc bốn file được miễn.
5. Thêm slot thứ tư thay vì thừa nhận component đang ở sai tầng.
6. Để một leaf tự gọi request rồi tự quyết `isLoading`.
7. Thêm một prop `className` để kịp release, và mất quyền đổi cây DOM bên trong từ đó về sau.
8. Mở làn `items` bên cạnh `props` trên một surface dùng chung.
