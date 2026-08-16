---
id: fe-lints-translation-example
title: example.md
slug: /fe/lints/translation/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng luật máy — chỗ nó nổ, chỗ nó im, và chỗ nó không nhìn thấy gì cả.
---

# example.md

> Version: `2.00`

Mô-đun: `translation` · Luật máy: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản
biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây giả định tệp nằm trong một thư mục nhận chữ, ví dụ
`src/components/leaves/StatRow/component.tsx`. Ngoài bốn thư mục đó cả hai luật đều **không cài
visitor nào**, nên toàn bộ trang này im lặng.

**SAI** nghĩa là luật nổ. **ĐÚNG** nghĩa là luật im. Mục **Cửa lách và nhầm lẫn** ở cuối mỗi luật
chứa mã mà luật **không bắt được** — đó là mã lọt lưới, không phải mã được phép.

---

## `no-copy-resolution-below-block`

### Trường hợp: tra chữ ngay trong thân thành phần

```tsx
// SAI — src/components/leaves/StatRow/component.tsx
const t = useTranslations("stats")

export const StatRow = ({ value }: Props) => (
  <div className="flex flex-col gap-1">
    <span>{value}</span>
    <span>{t("caption")}</span>
  </div>
)
```

```tsx
// ĐÚNG — chuỗi đã tra xong đi vào bằng props
export const StatRow = ({ value, caption }: Props) => (
  <div className="flex flex-col gap-1">
    <span>{value}</span>
    <span>{caption}</span>
  </div>
)
```

Khác nhau đúng một điều: bản dưới dựng được từ một fixture, không cần runtime nào.

### Trường hợp: đọc ngôn ngữ hiện tại để tự chọn chữ

```tsx
// SAI — cùng một phụ thuộc, chỉ êm hơn một mức
const locale = useLocale()
const label = locale === "vi" ? "Đang học" : "In progress"
```

```tsx
// ĐÚNG — bên trên quyết định câu nào đúng, bên dưới chỉ vẽ
export const ProgressBadge = ({ label }: Props) => <span className="rounded px-2">{label}</span>
```

### Trường hợp: định dạng số và ngày cũng là tra ngôn ngữ

```tsx
// SAI — `useFormatter` nằm trong tập bốn tên
const format = useFormatter()
return <span>{format.dateTime(startedAt)}</span>
```

```tsx
// ĐÚNG — nhận vào một chuỗi đã định dạng
export const StartedAt = ({ startedAtLabel }: Props) => <span>{startedAtLabel}</span>
```

### Trường hợp: gọi ở cấp mô-đun, ngoài mọi thành phần

```tsx
// SAI — visitor không hỏi lời gọi nằm trong hàm nào
const dictionary = await getTranslations("stats")

export const StatRow = () => <span>{dictionary("caption")}</span>
```

```tsx
// ĐÚNG — không có lời gọi nào trong tệp này
export const StatRow = ({ caption }: Props) => <span>{caption}</span>
```

### Trường hợp: tệp phụ nằm cùng thư mục vẫn bị bắt

```ts
// SAI — src/components/leaves/StatRow/hooks.ts vẫn qua cổng, vì cổng xét ĐƯỜNG DẪN
export const useCaption = () => useTranslations("stats")("caption")
```

```ts
// ĐÚNG — tệp phụ chỉ tính toán trên dữ liệu đã nhận
export const toPercent = (done: number, total: number) => Math.round((done / total) * 100)
```

### Cửa lách và nhầm lẫn

Toàn bộ mã dưới đây **không bị báo cáo**. Không cái nào trong số này là hợp lệ theo luật — chúng chỉ
là những chỗ máy không nhìn tới.

```tsx
// LỌT — đổi tên khi import, tên gọi không còn khớp bốn chữ
import { useTranslations as useCopy } from "…"

const t = useCopy("stats")
```

```tsx
// LỌT — callee là MemberExpression, bị loại trước cả bước so tên
const t = i18n.useTranslations("stats")
```

```tsx
// LỌT — gán rồi mới gọi; lời gọi mang tên khác
const resolve = useTranslations
const t = resolve("stats")
```

```tsx
// LỌT — tên nào ngoài bốn tên đó cũng vô hình, kể cả hàm bọc của chính dự án
const t = useCopyForTier("stats")
const now = useNow()
```

```ts
// LỌT — src/hooks/useCaption.ts nằm NGOÀI bốn thư mục, nên không qua cổng
export const useCaption = () => useTranslations("stats")("caption")
```

```tsx
// LỌT — nhưng phụ thuộc thì vẫn nguyên vẹn ở đây
import { useCaption } from "@/hooks/useCaption"

export const StatRow = () => <span>{useCaption()}</span>
```

```tsx
// LỌT — thư mục tên khác: src/components/atoms/… hoặc src/ui/leaves/…
// Cổng tìm chuỗi con "/src/components/leaves/" và không thấy gì cả.
const t = useTranslations("stats")
```

---

## `no-hardcoded-copy-in-vocabulary`

### Trường hợp: chữ viết thẳng trong thẻ

```tsx
// SAI — JSXText sau khi trim là "No courses yet": có dấu cách, mở đầu chữ hoa
export const EmptyState = () => <p className="text-sm">No courses yet</p>
```

```tsx
// ĐÚNG
export const EmptyState = ({ message }: Props) => <p className="text-sm">{message}</p>
```

### Trường hợp: chữ nấp trong thuộc tính người đọc nghe thấy

```tsx
// SAI — hai báo cáo: một cho aria-label, một cho placeholder
<input aria-label="Search courses" placeholder="Type a course name" />
```

```tsx
// ĐÚNG
<input aria-label={searchLabel} placeholder={searchPlaceholder} />
```

`aria-label` không phải trường hợp nhỏ: trình đọc màn hình đọc nó như chữ chính của điều khiển.

### Trường hợp: ngoặc nhọn quanh chuỗi không cứu được

```tsx
// SAI — attributeText mở ngoặc ra và vẫn thấy một Literal chuỗi
<img alt={"Course cover image"} src={src} />
```

```tsx
// ĐÚNG
<img alt={coverAlt} src={src} />
```

### Trường hợp: chữ trải nhiều dòng

```tsx
// SAI — JSXText được trim trước khi thử, nên xuống dòng không giấu được gì
<p className="text-sm">
  Your enrollment is being processed
</p>
```

```tsx
// ĐÚNG
<p className="text-sm">{statusMessage}</p>
```

### Trường hợp: `title` trên một điều khiển

```tsx
// SAI
<button title="Remove from list" type="button">{icon}</button>
```

```tsx
// ĐÚNG
<button title={removeLabel} type="button">{icon}</button>
```

### Trường hợp: chuỗi không phải chữ nghĩa thì luật im

```tsx
// ĐÚNG — không có dấu cách, và cũng không phải chữ người đọc hiểu
<Icon props={{ name: "search" }} />
<span className="text-sm text-neutral-500">{value}</span>
```

### Cửa lách và nhầm lẫn

Đây là phần đắt nhất của trang. Mọi khối dưới đây **không bị báo cáo**, và không khối nào trong số
chúng hợp luật.

```tsx
// LỌT — thuộc tính tên là `props`, chuỗi nằm trong ObjectExpression bên trong
<Input props={{ placeholder: "Search courses" }} />
```

```tsx
// LỌT — hằng số giặt sạch chuỗi; Literal nằm ở VariableDeclarator
const PLACEHOLDER = "Search courses"

export const SearchBox = () => <input placeholder={PLACEHOLDER} />
```

```tsx
// LỌT — template literal không phải Literal
<input placeholder={`Search courses`} aria-label={`Search ${scope}`} />
```

```tsx
// LỌT — nối chuỗi và toán tử ba ngôi cũng vậy
<input placeholder={"Search " + "courses"} />
<img alt={isDone ? "Completed course" : "Course in progress"} src={src} />
```

```tsx
// LỌT — chuỗi trong ngoặc nhọn giữa thẻ là JSXExpressionContainer, không phải JSXText
<span>{"No courses yet"}</span>
```

```tsx
// LỌT — chen một biểu thức làm câu vỡ thành "Search" và "courses"
<span>Search {count} courses</span>
```

```tsx
// LỌT — chữ một từ: không có dấu cách nên không phải "câu"
<button type="button">Submit</button>
<img alt="Avatar" src={src} />
<input aria-label="Close" />
```

```tsx
// LỌT — mở đầu bằng chữ thường
<input aria-label="close the dialog" placeholder="type a course name" />
```

```tsx
// LỌT — chữ hoa ngoài bảng ASCII: /^[A-Z]/ không nhận Đ, Ê, Ô, Ơ, Ư, Á, Ổ…
<p>Đang xử lý đăng ký của bạn</p>
<input aria-label="Đóng hộp thoại" />
```

```tsx
// LỌT — thuộc tính ngoài tập năm tên
<div aria-roledescription="Course card" />
<Field props={{ label: "Full name", errorMessage: "This field is required" }} />
```

```tsx
// LỌT — spread là JSXSpreadAttribute, khác node
<input {...{ placeholder: "Search courses" }} />
```

```tsx
// LỌT — mảng chữ rồi map ra
const TABS = ["Overview", "Recent activity"]

export const Tabs = () => <>{TABS.map((tab) => <span key={tab}>{tab}</span>)}</>
```

```tsx
// LỌT — khoá dịch đi xuyên qua ranh giới; COPY-3 không có luật máy nào
<Badge props={{ labelKey: "quest.title" }} />
```

### Nhầm lẫn theo chiều ngược lại: luật nổ vào thứ không phải chữ nghĩa

```tsx
// Luật NỔ, nhưng đây là giá trị chương trình đem ra so khớp — COPY-6
const CANCELLED = "Da huy"

export const Row = () => <span>{CANCELLED === status ? <b>Da huy</b> : null}</span>
```

Luật viết rằng dòng như vậy được giữ nguyên và **đánh dấu lý do**. Luật máy không đọc chú thích, nên
thứ duy nhất làm nó im là một chỉ thị tắt luật — và chỉ thị đó không bắt ai nêu lý do. Dấu của luật và
cái khoá miệng của máy là hai thứ khác nhau; xem `audit.md`.

---

## Ánh xạ yêu cầu sang một báo cáo lint

| Mã đang xét | Luật máy nào canh chỗ này | Kết quả |
|---|---|---|
| `useTranslations("x")` trong `leaves/` | `no-copy-resolution-below-block` | `error`, thông điệp `resolves` |
| `useLocale()` trong `composites/` | `no-copy-resolution-below-block` | `error`, thông điệp `resolves` |
| `useCopy("x")` (tên đã đổi) trong `leaves/` | *không luật nào* | Xanh, sai luật |
| `useTranslations("x")` trong `blocks/` | *không luật nào* | Xanh, và đúng luật |
| `placeholder="Search courses"` trong `shells/` | `no-hardcoded-copy-in-vocabulary` | `error`, thông điệp `hardcoded` |
| `<p>No courses yet</p>` trong `branches/` | `no-hardcoded-copy-in-vocabulary` | `error`, thông điệp `text` |
| `props={{ placeholder: "Search courses" }}` | *không luật nào* | Xanh, sai luật |
| `aria-label="Close"` | *không luật nào* (một từ) | Xanh, sai luật |
| `<p>Đang xử lý</p>` | *không luật nào* (chữ hoa ngoài ASCII) | Xanh, sai luật |
| `labelKey="quest.title"` | *không luật nào* (`COPY-3` chưa có luật máy) | Xanh, sai luật |
| Tệp từ điển ngôn ngữ | *không luật nào* | Xanh, và đúng luật |

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định | Ai trả lời |
|---|---|---|
| Chữ nghĩa hay giá trị | Người đọc ngôn ngữ khác có thấy khác đi không? | Luật, không phải máy |
| Chữ nghĩa hay giá trị so khớp | Bỏ dịch thì phép so sánh có vỡ không? | `COPY-6`; máy sẽ nổ nhầm, phải tắt bằng chỉ thị |
| Lỗi thật hay cửa lách | Máy im vì mã đúng, hay im vì mã đứng ngoài tầm nhìn? | Bảng "Cửa lách" phía trên |
| Trong tầm hay ngoài tầm | Đường dẫn có chứa `/src/components/{leaves,shells,composites,branches}/` không? | Cổng thư mục |
| Chuỗi hay biểu thức | Giá trị thuộc tính có đúng là một `Literal` chuỗi không? | `attributeText` |
| Câu hay từ đơn | Chuỗi có ít nhất một dấu cách và mở đầu bằng `A`–`Z` không? | `looksLikeProse` |

## Sai lầm lặp lại nhiều nhất

1. Đọc "lint xanh" thành "đã tuân luật". Bốn trong sáu mã của luật này không có luật máy nào.
2. Dùng túi prop `props={{ placeholder: "…" }}` rồi tưởng máy đang canh — đó là chỗ mù lớn nhất.
3. Gom chuỗi vào hằng số cho gọn, và vô tình xoá luôn báo cáo.
4. Tin rằng chữ tiếng Việt được luật giữ; `/^[A-Z]/` không nhận chữ hoa có dấu.
5. Chẻ câu bằng một biểu thức rồi coi như đã hết chữ cứng.
6. Chuyển lời gọi tra chữ sang một tệp ngoài bốn thư mục và gọi đó là đã sửa.
7. Đặt tên thư mục mới cho một tầng dưới block mà không thêm nó vào danh sách trong tệp nguồn.
8. Tắt luật cho một giá trị so khớp mà không viết lý do — dòng sau đó không ai dám sửa.
