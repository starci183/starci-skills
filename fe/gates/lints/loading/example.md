---
id: fe-lints-loading-example
title: example.md
slug: /gates/lints/loading/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng quy tắc — chỗ nào nổ, chỗ nào không, và chỗ nào lọt qua.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `loading` · Enforcement: [`INDEX.md`](./INDEX.md) · Vì sao: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây là **một quy tắc**. **SAI** nghĩa là quy tắc nổ. **ĐÚNG** nghĩa là quy tắc im. Mục
**Chỗ lách và chỗ dễ nhầm** ở cuối mỗi quy tắc mang mã mà quy tắc **không bắt được** — đọc nó như một
lỗ hổng đã biết, không phải như một cách viết được cho phép.

---

## `no-resting-twin-component`

### Trường hợp: một tệp mang tên bản sao

**SAI** — cả tệp là phát hiện, báo một lần trên `Program`.

```text
src/components/leaves/AvatarSkeleton/index.tsx
```

```tsx
// src/components/leaves/AvatarSkeleton/index.tsx
export const AvatarSkeleton = () => (
  <div className="flex items-center gap-2">
    <div className="size-10 animate-pulse rounded-full bg-default" />
    <div className="h-4 w-24 animate-pulse rounded bg-default" />
  </div>
)
```

**ĐÚNG** — không có tệp thứ hai; chính thành phần biết cách tự nghỉ.

```tsx
// src/components/leaves/Avatar/index.tsx
export const Avatar = ({ props, isLoading }: AvatarProps) => (
  <div className="flex items-center gap-2">
    <div className={cn("size-10 rounded-full", isLoading && "animate-pulse bg-default")}>
      {isLoading ? null : <img src={props.src} alt="" />}
    </div>
    <Text props={{ value: props.name }} isLoading={isLoading} />
  </div>
)
```

Hai bên khác nhau đúng một chuyện: hình dạng lúc chờ có đổi theo hình dạng thật hay không.

### Trường hợp: tệp phẳng, không có thư mục

**SAI** — mẫu thứ hai bắt tên nằm ngay trên tệp.

```text
src/components/blocks/dashboard/RecentActivitySkeleton.tsx
```

**ĐÚNG** — một tệp, một mô tả, hai trạng thái.

```tsx
// src/components/blocks/dashboard/RecentActivity/index.tsx
export const RecentActivity = ({ input }: RecentActivityProps) => {
  const isLoading = input.state === "pending"
  return (
    <section className="flex flex-col gap-3">
      <Heading props={{ value: "Hoạt động gần đây" }} />
      <ActivityList props={{ rows: isLoading ? RESTING_ROWS : input.rows }} isLoading={isLoading} />
    </section>
  )
}
```

### Trường hợp: tệp không phải thành phần vẫn bị bắt

**SAI** — phần mở rộng `.ts` cũng khớp `tsx?`, nên một tệp chỉ chứa kiểu vẫn bị báo là bản sao.

```text
src/components/leaves/AvatarSkeleton.ts
```

```ts
// src/components/leaves/AvatarSkeleton.ts — không có JSX nào ở đây, vẫn bị báo
export interface AvatarSkeletonProps {
  rows: number
}
```

**ĐÚNG** — đặt kiểu vào cùng chỗ với thứ nó mô tả.

```ts
// src/components/leaves/Avatar/types.ts
export interface AvatarProps {
  props: { src: string; name: string }
  isLoading?: boolean
}
```

### Trường hợp: dựng bằng tay trong test

**ĐÚNG** — tệp test được miễn: bản sao ở đây là vật liệu để đối chiếu.

```tsx
// src/components/blocks/dashboard/pending-gate.test.tsx
const restingRow = <div data-testid="resting" className="h-4 w-24" />
expect(render(<RecentActivity input={{ state: "pending" }} />)).toContainElement(restingRow)
```

### Chỗ lách và chỗ dễ nhầm

Mã dưới đây **lọt qua**. Đó là lỗ hổng, không phải giấy phép.

```tsx
// LỌT — bản sao nằm trong một tệp có tên hợp lệ; quy tắc không đọc khai báo bao giờ
// src/components/leaves/Avatar/index.tsx
export const AvatarSkeleton = () => <div className="size-10 animate-pulse rounded-full bg-default" />
export const Avatar = ({ props }: AvatarProps) => <img src={props.src} alt={props.name} />
```

```text
LỌT — chỉ cần đổi một chữ trong tên tệp
src/components/leaves/AvatarPlaceholder/index.tsx
src/components/leaves/AvatarLoading/index.tsx
src/components/leaves/avatar-skeleton.tsx
src/components/leaves/Card.Skeleton.tsx
src/components/leaves/AvatarSkeleton/view.tsx
src/components/leaves/AvatarSkeleton.jsx
```

```text
LỌT — ra khỏi cây thành phần thì cả ba quy tắc không tồn tại
src/features/dashboard/AvatarSkeleton/index.tsx
app/(dashboard)/AvatarSkeleton.tsx
```

**Nhầm lẫn thường gặp.** Nguyên thuỷ tên đúng bằng `Skeleton` **cũng bị bắt** ở quy tắc này, dù nửa
`import` của quy tắc kia cố ý miễn nó. Đây là hành vi thật của mã, không phải điều tên quy tắc gợi ý.

```text
BỊ BÁO — dù đây là nguyên thuỷ mà mọi thành phần khác nghỉ BẰNG, không phải bản sao của ai
src/components/leaves/Skeleton/index.tsx
```

---

## `no-placeholder-prop`

### Trường hợp: cây dựng sẵn truyền qua thuộc tính

**SAI** — thuộc tính đúng tên, giá trị là một `JSXElement`.

```tsx
<CourseCard
  props={{ title, lessons }}
  skeleton={<div className="h-24 w-full animate-pulse rounded bg-default" />}
/>
```

**ĐÚNG** — truyền cờ xuống, để mỗi phần tự nghỉ như chính nó.

```tsx
<CourseCard props={{ title, lessons }} isLoading={isLoading} />
```

### Trường hợp: ba tên thuộc tính đều nổ

**SAI** — `placeholder` và `fallback` bị đối xử hệt như `skeleton`.

```tsx
<ResultRegion placeholder={<ResultRowBars />} />
```

```tsx
<Boundary fallback={<><div className="h-4 w-full" /><div className="h-4 w-2/3" /></>}>
  <Results />
</Boundary>
```

**ĐÚNG** — cùng một khu vực, cờ chờ đi xuống thay vì cây đi lên.

```tsx
<ResultRegion props={{ rows }} isLoading={isLoading} />
```

### Trường hợp: chuỗi thì không bị đụng tới

**ĐÚNG** — `placeholder` của một ô nhập liệu là chuỗi, không phải cây; quy tắc bỏ qua.

```tsx
<TextField props={{ label: "Tìm khoá học", placeholder: "Nhập từ khoá" }} />
```

```tsx
<input placeholder="Nhập từ khoá" className="w-full rounded border px-3 py-2" />
```

### Trường hợp: nhập một binding `*Skeleton` theo đường dẫn tương đối

**SAI** — mỗi specifier khớp `*Skeleton` là một báo cáo.

```tsx
import { AvatarSkeleton } from "./AvatarSkeleton"
import { CourseCardSkeleton, LessonRowSkeleton } from "../leaves"
```

**ĐÚNG** — nhập nguyên thuỷ nghỉ, tên đúng bằng `Skeleton`, được miễn.

```tsx
import { Skeleton } from "../Skeleton"

export const Price = ({ props, isLoading }: PriceProps) =>
  isLoading ? <Skeleton className="h-4 w-16" /> : <span className="text-lg">{props.amount}</span>
```

### Chỗ lách và chỗ dễ nhầm

```tsx
// LỌT — gom phần tử vào một cái tên trước; biểu thức không còn là JSXElement
const resting = <div className="h-24 w-full animate-pulse rounded bg-default" />
return <CourseCard props={{ title }} skeleton={resting} />
```

```tsx
// LỌT — MemberExpression, CallExpression, TSAsExpression, ConditionalExpression: không cái nào là JSXElement
<CourseCard skeleton={SHAPES.courseCard} />
<CourseCard skeleton={renderResting()} />
<CourseCard skeleton={<CourseCardBars /> as ReactNode} />
<CourseCard fallback={isWide ? <WideBars /> : <NarrowBars />} />
```

```tsx
// LỌT — truyền tham chiếu thành phần, rồi dựng ở bên trong
<CourseCard skeleton={CourseCardBars} />
```

```tsx
// LỌT — tên thuộc tính thứ tư; danh sách đóng ở đúng ba tên
<CourseCard loadingView={<CourseCardBars />} />
<CourseCard restingSlot={<CourseCardBars />} />
<CourseCard renderSkeleton={() => <CourseCardBars />} />
```

```tsx
// LỌT — cây nằm trong prop dạng đối tượng: đây là Property của ObjectExpression, không phải JSXAttribute
<CourseCard props={{ title, fallback: <CourseCardBars /> }} />
```

```tsx
// LỌT — nhập theo alias: nguồn không bắt đầu bằng "./" hay "../"
import { AvatarSkeleton } from "@/components/leaves/AvatarSkeleton"
```

```tsx
// LỌT — đổi tên khi nhập, hoặc nhập cả namespace: chỉ tên cục bộ được đọc
import { AvatarSkeleton as Resting } from "./AvatarSkeleton"
import * as Shapes from "./skeletons"
```

**Nhầm lẫn thường gặp.** `fallback` cũng là tên prop của ranh giới tải chậm và ranh giới lỗi trong
thư viện dựng hình. Một `fallback={<Spinner/>}` hoàn toàn bình thường **vẫn bị báo**. Đó là chủ ý
theo luật, nhưng cần biết trước để không tưởng là lỗi của quy tắc.

---

## `no-resting-branch-at-call-site`

### Trường hợp: hai thành phần khác nhau ở hai nhánh

**SAI** — `Avatar` và `AvatarSkeleton` là hai tên khác nhau.

```tsx
{isLoading ? <AvatarSkeleton /> : <Avatar props={{ name }} />}
```

**ĐÚNG** — một mô tả, hai trạng thái.

```tsx
<Avatar props={{ name }} isLoading={isLoading} />
```

### Trường hợp: mảnh trống đối đầu một phần tử

**SAI** — `"<>"` là một tên, và nó khác `PriceLine`.

```tsx
{isPending ? <><div className="h-4 w-16" /><div className="h-3 w-10" /></> : <PriceLine props={{ amount }} />}
```

**ĐÚNG** — giữ nguyên phần tử, rút giá trị ra.

```tsx
<PriceLine props={{ amount }} isLoading={isPending} />
```

### Trường hợp: hai nửa của một namespace

**SAI** — `Card.Bars` và `Card.Body` được rút về hai chuỗi khác nhau.

```tsx
{isSkeleton ? <Card.Bars /> : <Card.Body props={{ lessons }} />}
```

**ĐÚNG**

```tsx
<Card.Body props={{ lessons }} isLoading={isSkeleton} />
```

### Trường hợp: `null` một bên — cố ý không báo

**ĐÚNG** — một điều khiển chưa có nơi để đi thì đừng vẽ ra; đó là luật đang chạy đúng.

```tsx
{isLoading ? null : <SeeMoreLink props={{ label }} on={{ press }} />}
```

### Trường hợp: cùng một phần tử ở cả hai nhánh

**ĐÚNG** — hai nhánh cùng tên thì không có cây thứ hai nào cả.

```tsx
{isLoading ? <Text props={{ value: "" }} isLoading /> : <Text props={{ value: name }} />}
```

### Chỗ lách và chỗ dễ nhầm

```tsx
// LỌT — cùng tên thẻ gốc "div"; hai cây hoàn toàn khác nhau vẫn đi qua như một
{isLoading
  ? <div className="h-4 w-24 animate-pulse rounded bg-default" />
  : <div className="flex items-center gap-2"><Avatar props={{ name }} /><Text props={{ value: name }} /></div>}
```

```tsx
// LỌT — bọc chung một vỏ là đủ để hai chuỗi bằng nhau
{isPending
  ? <Row><div className="h-4 w-24 animate-pulse rounded bg-default" /></Row>
  : <Row><Avatar props={{ name }} /><Text props={{ value: name }} /></Row>}
```

```tsx
// LỌT — đọc union trạng thái ngay tại chỗ; mẫu cờ đòi chữ "is" đứng trước
{input.state === "pending" ? <AvatarBars /> : <Avatar props={{ name }} />}
```

```tsx
// LỌT — thêm một danh từ vào cờ là \b sau "Loading" gãy
{isLoadingCourses ? <CourseCardBars /> : <CourseCard props={{ title }} />}
{isPendingReview ? <ReviewBars /> : <ReviewRow props={{ review }} />}
```

```tsx
// LỌT — cách gọi khác của "đang chờ": ba chính tả được nhận, phần còn lại thì không
{loading ? <AvatarBars /> : <Avatar props={{ name }} />}
{isFetching ? <AvatarBars /> : <Avatar props={{ name }} />}
{!data ? <AvatarBars /> : <Avatar props={{ name }} />}
```

```tsx
// LỌT — không viết bằng ba ngôi thì không có ConditionalExpression nào để thăm
if (isLoading) return <AvatarBars />
return <Avatar props={{ name }} />
```

```tsx
// LỌT — cặp && là hai LogicalExpression, không phải một ba ngôi
<>
  {isLoading && <AvatarBars />}
  {!isLoading && <Avatar props={{ name }} />}
</>
```

```tsx
// LỌT — chọn thành phần vào một biến; hai nhánh là Identifier nên armName trả null
const El = isLoading ? AvatarBars : Avatar
return <El props={{ name }} />
```

**Nhầm lẫn thường gặp.** Quy tắc so **tên phần tử gốc**, không so cây. Người đọc thông báo lỗi rất
dễ hiểu thành "hai nhánh phải giống nhau"; thực tế nó chỉ đòi **tên gốc** giống nhau, và đó là lý do
lỗ hổng `div` ở trên tồn tại.

---

## Ánh xạ yêu cầu sang quy tắc và mã luật

| Yêu cầu nghe được | Quy tắc sẽ nói gì | Mã luật |
|---|---|---|
| "Tạo giúp một `CourseCardSkeleton` cho màn danh sách" | `no-resting-twin-component` nổ ngay khi tệp được đặt tên | `LOADING-1` |
| "Truyền cái khung chờ này vào cho thẻ" | `no-placeholder-prop` báo `prop` nếu là phần tử JSX trực tiếp | `LOADING-1` |
| "Import cái skeleton bên cạnh vào dùng lại" | `no-placeholder-prop` báo `import` nếu đường dẫn tương đối | `LOADING-1` |
| "Đang tải thì hiện khung xám, xong thì hiện thẻ" | `no-resting-branch-at-call-site` nổ nếu hai tên gốc khác nhau | `LOADING-2` |
| "Đang tải thì ẩn nút đi" | Không quy tắc nào nổ, và đó là đúng | `LOADING-5` |
| "Khu vực này lúc chờ để trống cho gọn" | **Không quy tắc nào nổ** — chiều cao sập không ai giữ | `LOADING-3` |
| "Đọc màn hình có đọc cái shimmer không cũng được" | **Không quy tắc nào nổ** | `LOADING-4` |
| "Dùng chung một cờ `isLoading` cho cả trang" | **Không quy tắc nào nổ** | `LOADING-6` |
| "Chưa có dữ liệu thì coi như rỗng" | **Không quy tắc nào nổ** | `LOADING-7` |

Bốn hàng cuối là phần luật **không có máy giữ**. Đừng đọc "lint xanh" thành "đã theo luật".

## Bảng phân định ranh giới

| Đứng giữa | Cái nào nổ | Dấu hiệu quyết định |
|---|---|---|
| `Skeleton` với `AvatarSkeleton` | Cả hai, ở `no-resting-twin-component` | Quy tắc tên tệp không miễn tên trần; chỉ nửa `import` mới miễn |
| `skeleton={<X/>}` với `skeleton={x}` | Chỉ cái thứ nhất | `expression.type` phải đúng bằng `JSXElement` hoặc `JSXFragment` |
| `placeholder="chuỗi"` với `placeholder={<X/>}` | Chỉ cái thứ hai | Phải là `JSXExpressionContainer` |
| `from "./x"` với `from "@/x"` | Chỉ cái thứ nhất | Nguồn phải khớp `^\.\.?\/` |
| `isLoading ? <A/> : <B/>` với `isLoading ? <A/> : null` | Chỉ cái thứ nhất | Nhánh `null` là `LOADING-5`, cố ý bỏ qua |
| `isLoading ? <div/> : <div/>` với `isLoading ? <div/> : <span/>` | Chỉ cái thứ hai | So sánh là so **tên gốc**, không phải so cây |
| `isPending` với `state === "pending"` | Chỉ cái thứ nhất | Mẫu cờ đòi chữ `is` đứng liền trước |
| `.tsx` sản phẩm với `.test.tsx` | Chỉ cái thứ nhất | Tệp test được miễn cả ba quy tắc |
| `/src/components/…` với `/src/features/…` | Chỉ cái thứ nhất | Phạm vi là một phép kiểm tra chuỗi con trên đường dẫn |

## Sai lầm lặp lại nhiều nhất

1. **Tưởng lint xanh là đã theo luật.** Bảy mã, hai mã có người giữ. Chiều cao, im lặng với trình đọc
   màn hình, cờ dùng chung và union trạng thái đều không ai kiểm.
2. **Đổi tên tệp để hết lỗi.** `AvatarSkeleton` thành `AvatarPlaceholder` làm quy tắc im mà không
   sửa gì cả — bản mô tả thứ hai vẫn còn nguyên đó, chỉ là không ai báo nữa.
3. **Gom phần tử vào một hằng số rồi truyền vào.** Đây là hành động của người đang *dọn dẹp*, không
   phải phá hoại, và nó vô hiệu nửa `prop` của `no-placeholder-prop` một cách hoàn toàn.
4. **Giữ nguyên thẻ gốc rồi đổi hết ruột.** `div` với `div` là bằng nhau với quy tắc nhánh, kể cả khi
   hai bên là hai cây không liên quan gì tới nhau.
5. **Thêm danh từ vào cờ.** `isLoadingCourses` đọc rất tự nhiên và làm quy tắc nhánh biến mất.
6. **Viết `state === "pending"` thẳng trong ba ngôi.** Chính đường nối mà luật mô tả lại là chỗ quy
   tắc không nhìn thấy, vì cờ chưa được đặt tên.
7. **Đặt bản sao vào trong tệp của thành phần thật.** Một dòng `export const XSkeleton` nằm cạnh
   `export const X` đi qua sạch sẽ.
8. **Nhập theo alias.** Gần như mọi dự án đều dùng alias, nên nửa `import` trên thực tế chỉ bắt được
   các lần nhập từ thư mục bên cạnh.
