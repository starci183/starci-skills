---
id: fe-lints-props-and-slots-example
title: example.md
slug: /gates/lints/props-and-slots/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng rule — chỗ nó nổ, chỗ nó im, và chỗ nó không nhìn thấy gì.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `props-and-slots` · Luật: [`INDEX.md`](./INDEX.md) · Nghiệp vụ: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây là **một rule**, viết bằng tên nó công bố. Trong mỗi mục: nhiều cặp **SAI** (rule
nổ) và **ĐÚNG** (rule im), rồi tới **Chỗ lách và chỗ dễ nhầm** — phần này chứa mã **lọt qua** rule.

> Mã trong mục "Cửa lách" **không phải mã được phép viết**. Nó là mã mà rule **không nhìn thấy**.
> Luật vẫn cấm; chỉ là không có máy nào bắt được. Đọc nhầm chỗ này thành "vậy là hợp lệ" là cách
> nhanh nhất để một luật đã có rule trở thành một luật không ai giữ.

---

## `no-inline-parameter-type`

Mã luật: `SLOTS-3`. Rule đọc kiểu khai tại **tham số** và hỏi: hình dạng này có tên không?

### SAI — object vô danh viết thẳng tại tham số

```tsx
export const Row = ({ props }: { props: { label: string; value: string } }) => (
  <p>{props.label}</p>
)
```

### ĐÚNG — đặt tên cho hình dạng trong chính mô-đun

```tsx
export type RowProps = {
  readonly props: RowData
}

export const Row = ({ props }: RowProps) => <p>{props.label}</p>
```

### SAI — nửa vô danh giấu trong một phép giao

```tsx
export const _DashboardPage = (
  input: DashboardFrame & { readonly signOutLabel: string; readonly unavailableMessage: string },
) => <Frame {...input} />
```

Rule duyệt từng thành viên của phép giao. Một thành viên vô danh là đủ để báo.

### ĐÚNG — cả phép giao có một cái tên

```tsx
export type DashboardPageProps = DashboardFrame & DashboardCopy

export const _DashboardPage = (input: DashboardPageProps) => <Frame {...input} />
```

### SAI — bọc ngoặc không giấu được

```tsx
const format = ({ amount }: ({ amount: number })) => amount.toFixed(2)
```

### ĐÚNG — cũng hình dạng ấy, có tên

```tsx
type MoneyInput = { readonly amount: number }

const format = ({ amount }: MoneyInput) => amount.toFixed(2)
```

### SAI — tham số thứ hai cũng bị soi

```tsx
const merge = (base: MergeBase, overrides: { readonly locale: string }) => ({
  ...base,
  ...overrides,
})
```

### ĐÚNG — mọi tham số đều có tên

```tsx
type MergeOverrides = { readonly locale: string }

const merge = (base: MergeBase, overrides: MergeOverrides) => ({ ...base, ...overrides })
```

### SAI — biểu thức hàm và khai báo hàm đều bị bắt

```tsx
export function toRow(entry: { id: string; title: string }) {
  return { id: entry.id, label: entry.title }
}
```

### ĐÚNG — tham số vô hướng không phải hình dạng không có chỗ đọc

```tsx
const truncate = (value: string, limit: number) => value.slice(0, limit)
```

### Chỗ lách và chỗ dễ nhầm

Bốn đoạn dưới đây **lọt qua rule**. Không đoạn nào trong số đó là cách viết được phép.

**Bọc trong một kiểu tiện ích.** Hàm kiểm tra chỉ đi qua type literal, ngoặc, giao và hợp — nó không
bước vào đối số kiểu của một tham chiếu:

```tsx
// LỌT QUA — vẫn là hình dạng không có tên, rule không nhìn tới đối số kiểu
const Row = ({ props }: Readonly<{ props: { label: string } }>) => <p>{props.label}</p>

// LỌT QUA — mảng của một hình dạng vô danh cũng vậy
const renderAll = (rows: { id: string; label: string }[]) => rows.map((row) => row.label)
```

**Đẩy hình dạng lên ràng buộc của tham số kiểu.** Kiểu tại tham số chỉ còn là một chữ cái:

```tsx
// LỌT QUA — object vô danh nằm ở chỗ rule không bao giờ ghé
const Row = <T extends { label: string }>(input: T) => <p>{input.label}</p>
```

**Giấu vào một kiểu hàm.** `TSFunctionType` không nằm trong danh sách node được duyệt:

```tsx
// LỌT QUA — shape props vô danh, chỉ khác chỗ đứng
export type RowRenderer = (input: { label: string; value: string }) => ReactNode
```

**Đẩy vào thân hàm.** Rule chỉ đọc khai báo tại tham số:

```tsx
// LỌT QUA — không có gì tại tham số để soi
const Row = (input: unknown) => {
  const shaped = input as { label: string; value: string }
  return <p>{shaped.label}</p>
}
```

**Nhầm lẫn hay gặp.** Tách cấu trúc **không khai kiểu** không phải lỗi của rule này:

```tsx
// KHÔNG NỔ, và đúng như thiết kế — kiểu tới từ ngữ cảnh, là câu hỏi của luật khác
const f = ({ a }) => a
```

---

## `no-children-slot`

Mã luật: `SLOTS-4`. Rule chỉ chạy trong file thành phần **bị quản**, và chỉ soi hai chỗ: chữ ký
thuộc tính trong kiểu, và khoá tách cấu trúc tại tham số.

### SAI — khai `children` trong kiểu props của một container

```tsx
// src/components/branches/SurfaceCard/index.tsx
export interface SurfaceCardProps {
  readonly contract: ContractKey
  readonly children?: ReactNode
}
```

### ĐÚNG — container nhận `contract` và `render`

```tsx
// src/components/branches/SurfaceCard/index.tsx
export interface SurfaceCardProps {
  readonly contract: ContractKey
  readonly render: ContractComponent<ContractKey, LeafProps<SurfaceData>>
}
```

### SAI — cũng slot ấy, tới bằng cửa khác

```tsx
// src/components/branches/SurfaceCard/index.tsx
export const SurfaceCard = ({ props, children }: SurfaceCardProps) => (
  <section>{children}</section>
)
```

### ĐÚNG — không có slot nào nhận giao diện dựng sẵn

```tsx
// src/components/branches/SurfaceCard/index.tsx
export const SurfaceCard = ({ props, contract, render }: SurfaceCardProps) => (
  <Tree contract={contract} props={props} render={render} />
)
```

### SAI — một thư mục trông giống shell vẫn bị quản

```tsx
// src/components/shells/PopoverShell/index.tsx
type PopoverShellProps = {
  readonly children?: ReactNode
}
```

Danh sách miễn là **bốn cái tên đúng chữ**. Đặt tên na ná không được miễn theo.

### ĐÚNG — bốn shell được miễn, vì chúng chuyển thẳng phần bên trong

```tsx
// src/components/shells/ModalShell/index.tsx
export interface ModalShellProps {
  readonly children?: ReactNode
}
```

### SAI — tầng lá cũng không được mọc slot

```tsx
// src/components/leaves/Icon/index.tsx
export const Icon = ({ children }: IconProps) => <span>{children}</span>
```

### ĐÚNG — object thường có khoá `children` không phải một slot

```tsx
// src/components/branches/SurfaceCard/index.tsx
const spec = { children: [] as ReadonlyArray<ContractKey> }
```

Khoá này nằm trong một object đang **dựng**, không phải một mẫu đang **tách**. Rule bỏ qua có chủ ý.

### ĐÚNG — tách trong thân hàm được miễn có chủ ý

```tsx
// src/components/branches/SurfaceCard/index.tsx
export const SurfaceCard = (props: SurfaceCardProps) => {
  const { contract, render } = props
  return <Tree contract={contract} render={render} />
}
```

### Chỗ lách và chỗ dễ nhầm

Năm đoạn dưới đây **lọt qua rule** và không đoạn nào được phép viết.

**Kế thừa slot từ file khác.** Rule không có thông tin kiểu, nên không lần được:

```tsx
// LỌT QUA — trong file không có chữ ký nào tên children
// src/components/branches/SurfaceCard/index.tsx
export interface SurfaceCardProps extends PropsWithChildren<SurfaceCardData> {
  readonly contract: ContractKey
}
```

**Không tách cấu trúc, đọc thẳng qua tham số.** Không `Property` nào chạy, và nếu kiểu được import
thì cũng không chữ ký nào chạy:

```tsx
// LỌT QUA — slot vẫn tới, vẫn dùng, file vẫn xanh
// src/components/branches/SurfaceCard/index.tsx
import type { SurfaceCardProps } from "./props"

export const SurfaceCard = (props: SurfaceCardProps) => <section>{props.children}</section>
```

**Tách trong thân hàm, ghép với kiểu import.** Phần miễn dành cho tách trong thân hàm trở thành một
cửa khi kiểu nằm ở file khác:

```tsx
// LỌT QUA — file không còn tín hiệu nào
// src/components/branches/SurfaceCard/index.tsx
import type { SurfaceCardProps } from "./props"

export const SurfaceCard = (props: SurfaceCardProps) => {
  const { children } = props
  return <section>{children}</section>
}
```

**Khoá dạng chuỗi.** Cả hai node đều đòi khoá là **định danh**:

```tsx
// LỌT QUA — cùng một slot, chỉ khác cách đánh vần
// src/components/branches/SurfaceCard/index.tsx
export interface SurfaceCardProps {
  readonly "children"?: ReactNode
}
```

**Đổi tên slot.** Đây là cửa rộng nhất của cả mô-đun: rule cấm **một chữ**, luật cấm **giao diện đã
dựng sẵn**:

```tsx
// LỌT QUA — y hệt về hành vi, chỉ khác cái tên
// src/components/branches/SurfaceCard/index.tsx
export interface SurfaceCardProps {
  readonly body?: ReactNode
}

export const SurfaceCard = ({ body }: SurfaceCardProps) => <section>{body}</section>
```

**Nhầm lẫn hay gặp.** Một trang nhận `children` **không** phải lỗi, và cũng không phải cửa lách — nó
nằm ngoài gốc thành phần một cách có chủ ý:

```tsx
// KHÔNG NỔ, và đúng như thiết kế — nhận children là đúng việc của một trang
// src/app/page.tsx
export const Page = ({ children }: PageProps) => <main>{children}</main>
```

Nhưng cùng cơ chế ấy trở thành cửa khi cây thành phần **không** nằm dưới gốc được quản:

```tsx
// LỌT QUA — cùng một container, chỉ khác chỗ đặt file
// src/ui/SurfaceCard.tsx
export interface SurfaceCardProps {
  readonly children?: ReactNode
}
```

---

## `no-surface-list-items-slot`

Mã luật: `SLOTS-7`. Rule theo dõi tên đã import rồi soi **chỗ gọi**.

### SAI — mở làn dữ liệu thứ hai ngay tại chỗ gọi

```tsx
import { SurfaceListCard } from "@/components/branches/SurfaceListCard"

export const QuestBlock = () => (
  <SurfaceListCard contract="quest-list" props={{ label }} render={Content} items={tasks} />
)
```

### ĐÚNG — bộ sưu tập đi dưới tên thật, bên trong `props`

```tsx
import { SurfaceListCard } from "@/components/branches/SurfaceListCard"

export const QuestBlock = () => (
  <SurfaceListCard contract="quest-list" props={{ label, tasks }} render={Content} />
)
```

### SAI — đặt bí danh khi import vẫn bị bắt

```tsx
import { SurfaceListCard as List } from "@/components/branches/SurfaceListCard"

export const QuestBlock = () => (
  <List contract="quest-list" props={{ label }} render={Content} items={tasks} />
)
```

Tập ràng buộc lưu **tên cục bộ**, nên bí danh không phải một cửa.

### ĐÚNG — một `items` trên thành phần khác không liên quan

```tsx
import { SurfaceListCard } from "@/components/branches/SurfaceListCard"
import { Pagination } from "@/components/branches/Pagination"

export const QuestBlock = () => (
  <>
    <SurfaceListCard contract="quest-list" props={{ label, tasks }} render={Content} />
    <Pagination items={pages} />
  </>
)
```

### Chỗ lách và chỗ dễ nhầm

Bốn đoạn dưới đây **lọt qua rule**. Không đoạn nào được phép viết.

**Trải object.** Vòng lặp bỏ qua mọi thứ không phải một thuộc tính JSX thường:

```tsx
// LỌT QUA — làn thứ hai tới bằng phép trải
import { SurfaceListCard } from "@/components/branches/SurfaceListCard"

const config = { contract: "quest-list", props: { label }, render: Content, items: tasks }

export const QuestBlock = () => <SurfaceListCard {...config} />
```

```tsx
// LỌT QUA — cùng một thứ, viết ngắn hơn
export const QuestBlock = () => (
  <SurfaceListCard contract="quest-list" props={{ label }} render={Content} {...{ items: tasks }} />
)
```

**Đổi dạng import.** Bất kỳ dạng nào không khớp đúng mẫu nguồn và đúng tên nhập đều làm tập ràng buộc
rỗng, và rule im lặng **cho cả file**:

```tsx
// LỌT QUA — import mặc định thì không có tên nhập để so
import SurfaceListCard from "@/components/branches/SurfaceListCard"

export const QuestBlock = () => (
  <SurfaceListCard contract="quest-list" props={{ label }} render={Content} items={tasks} />
)
```

```tsx
// LỌT QUA — nguồn kết thúc bằng /index, và truy cập qua namespace không phải một định danh
import * as Branches from "@/components/branches/SurfaceListCard/index"

export const QuestBlock = () => (
  <Branches.SurfaceListCard contract="quest-list" props={{ label }} render={Content} items={tasks} />
)
```

**Bọc một lớp.** File bọc qua được vì làn tới bằng trải; file gọi qua được vì tên không nằm trong tập
theo dõi:

```tsx
// LỌT QUA — file bọc
import { SurfaceListCard } from "@/components/branches/SurfaceListCard"

export const ListCard = (props: ListCardProps) => <SurfaceListCard {...props} />
```

```tsx
// LỌT QUA — file gọi
import { ListCard } from "@/components/blocks/ListCard"

export const QuestBlock = () => (
  <ListCard contract="quest-list" props={{ label }} render={Content} items={tasks} />
)
```

**Đổi tên làn.** Vẫn hai làn dữ liệu, vẫn bắt bề mặt dùng chung biết mô hình của bên gọi:

```tsx
// LỌT QUA — rule cấm một chữ, không cấm cái làn
import { SurfaceListCard } from "@/components/branches/SurfaceListCard"

export const QuestBlock = () => (
  <SurfaceListCard contract="quest-list" props={{ label }} render={Content} rows={tasks} />
)
```

**Nhầm lẫn hay gặp.** Rule **không** canh phía khai báo. Đoạn dưới đây không bị báo ở đâu cả cho tới
khi có người dùng tới nó, qua đúng dạng import mà rule theo dõi:

```tsx
// LỌT QUA — làn được mở ngay trong kiểu của chính bề mặt
// src/components/branches/SurfaceListCard/props.ts
export type SurfaceListCardProps = {
  readonly contract: ContractKey
  readonly items?: ReadonlyArray<unknown>
}
```

---

## Ánh xạ yêu cầu sang một rule

Nêu **file**, **node** và **cách viết**. Nếu thiếu một trong ba, câu trả lời là một câu hỏi, không
phải một kết luận.

| Yêu cầu bằng lời | Lập luận | Rule | Kết quả |
|---|---|---|---|
| "Kiểu tham số viết thẳng object" | `TSTypeLiteral` ngay tại khai báo của tham số | `no-inline-parameter-type` | Nổ |
| "Kiểu tham số là `Frame & { label: string }`" | Một thành viên của phép giao là vô danh | `no-inline-parameter-type` | Nổ |
| "Kiểu tham số là `Readonly<{ label: string }>`" | Hình dạng nằm trong đối số kiểu, ngoài tầm duyệt | `no-inline-parameter-type` | **Không nổ — cửa mở** |
| "Container khai `children` trong interface của nó" | Chữ ký thuộc tính, khoá định danh, file bị quản | `no-children-slot` | Nổ |
| "Container đọc `props.children` mà không tách" | Không mẫu tách, kiểu ở file khác | `no-children-slot` | **Không nổ — cửa mở** |
| "Container khai `body?: ReactNode`" | Rule so đúng chữ `children` | `no-children-slot` | **Không nổ — cửa mở** |
| "Trang nhận `children`" | Ngoài gốc thành phần, miễn có chủ ý | `no-children-slot` | Không nổ, và đúng |
| "Chỗ gọi truyền `items={tasks}`" | Thuộc tính JSX trên tên đã theo dõi | `no-surface-list-items-slot` | Nổ |
| "Chỗ gọi trải một object có `items`" | Không phải thuộc tính JSX thường | `no-surface-list-items-slot` | **Không nổ — cửa mở** |
| "Chỗ gọi truyền `rows={tasks}`" | Rule so đúng chữ `items` | `no-surface-list-items-slot` | **Không nổ — cửa mở** |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `no-inline-parameter-type` / không rule nào | Hình dạng vô danh có nằm **ngay tại** khai báo kiểu của tham số, hay đã bị đẩy vào đối số kiểu, ràng buộc, kiểu hàm hoặc thân hàm? |
| `no-children-slot` / ngoài phạm vi | File có nằm dưới một gốc thành phần **khác** gốc `src` trần không, và có phải một trong bốn shell hay file bảng đăng ký không? |
| `no-children-slot` — chữ ký hay tách cấu trúc | Chữ `children` xuất hiện như một chữ ký thuộc tính, hay như một khoá tách **tại tham số**? Tách trong thân hàm không tính. |
| `no-surface-list-items-slot` / im lặng | Import có khớp đúng mẫu nguồn và đúng tên nhập không? Nếu không, rule im cho **cả file**, không phải chỉ cho lần gọi đó. |
| Rule im / luật vẫn cấm | Rule không báo có nghĩa là **máy không thấy**, không có nghĩa là luật cho phép. |

## Sai lầm lặp lại nhiều nhất

1. Đọc mục "Cửa lách" thành danh sách cách viết hợp lệ. Đó là danh sách chỗ **máy mù**.
2. Nghĩ `no-children-slot` cấm giao diện dựng sẵn. Nó cấm **một chữ**; đổi tên là qua.
3. Nghĩ `no-surface-list-items-slot` canh cả kiểu của bề mặt. Nó chỉ canh **chỗ gọi**.
4. Nghĩ `no-inline-parameter-type` chỉ chạy trên file thành phần. Nó **không có cổng tên file** nào.
5. Bọc hình dạng vô danh vào `Readonly<…>` rồi tưởng đã đặt tên cho nó.
6. Import qua barrel hoặc bằng import mặc định rồi kết luận file "đã sạch làn thứ hai".
7. Thấy một kho báo **không có vi phạm** rồi đọc thành tuân thủ, trong khi cổng tên file không khớp
   bố cục kho đó và rule chưa từng chạy ở đâu cả.
