---
id: fe-patterns-naming-example
title: example.md
slug: /fe/patterns/naming/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã NAMING-N, viết bằng TSX thường, ĐÚNG và SAI đặt cạnh nhau.
---

# example.md

> Version: `2.00` · Module: `naming` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TSX thường**. Không component library, không design system riêng, không tên
sản phẩm. Một luật chỉ đúng khi nó đúng ở bất kỳ front end nào — nên nếu một ví dụ cần tên riêng của
một sản phẩm mới đọc được, ví dụ đó đứng sai chỗ.

Mỗi mã có **nhiều case**, mỗi case đặt **SAI** và **ĐÚNG** cạnh nhau, rồi tới mục **ngoại lệ và
nhầm lẫn**. Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một cách viết duy nhất.

---

## `NAMING-1` — hàm ở mức module là một arrow const

### Case: một file, một dáng khai báo

```tsx
// ĐÚNG — mọi khai báo cùng một dáng, và không gì tồn tại trước dòng tạo ra nó.
export const formatQuota = (value: number) => `còn ${value}`

export const QuotaRow = ({ props }: QuotaRowProps) => (
    <SummaryRow props={{ label: props.label, value: formatQuota(props.remaining) }} />
)
```

```tsx
// SAI — component gọi một helper khai báo ở dưới nó và vẫn xanh.
export function QuotaRow({ props }: QuotaRowProps) {
    return <SummaryRow props={{ label: props.label, value: formatQuota(props.remaining) }} />
}

function formatQuota(value: number) {
    return `còn ${value}`
}
```

Hai bản khác nhau đúng **một** thứ: một cái tên có được dùng trước dòng tạo ra nó hay không. Bản SAI
xanh, chạy đúng, và thứ nó lấy mất là lời hứa rằng thứ tự của file có nghĩa.

### Case: route mặc định của một trang

```tsx
// SAI — bản export không mang tên nào để grep ở phía call site.
export default function Page() {
    return <ArticleList />
}
```

```tsx
// ĐÚNG — có tên ở chỗ khai báo, và tên đó tìm được từ mọi nơi trỏ tới nó.
const Page = () => <ArticleList />

export default Page
```

### Case: đọc file từ trên xuống

```tsx
// ĐÚNG — thứ tự khai báo trùng thứ tự phụ thuộc, và trình biên dịch giữ điều đó.
const toMinutes = (seconds: number) => Math.round(seconds / 60)

const label = (seconds: number) => `${toMinutes(seconds)} phút`

export const DurationTag = ({ props }: DurationTagProps) => <span>{label(props.seconds)}</span>
```

```tsx
// SAI — ba khai báo có thể tráo đổi vị trí tuỳ ý mà không có gì phản đối.
export function DurationTag({ props }: DurationTagProps) {
    return <span>{label(props.seconds)}</span>
}

function label(seconds: number) {
    return `${toMinutes(seconds)} phút`
}

function toMinutes(seconds: number) {
    return Math.round(seconds / 60)
}
```

### Case: giữ từ khoá `function` sau dấu `=`

```tsx
// SAI — vẫn là từ khoá luật này từ chối, chỉ đổi chỗ đứng.
export const parsePage = function (raw: string) {
    return Number.parseInt(raw, 10) || 1
}
```

```tsx
// ĐÚNG
export const parsePage = (raw: string) => Number.parseInt(raw, 10) || 1
```

Case này đi qua lint (xem [`audit.md`](./audit.md)) và vẫn sai luật. Một mã được giữ **một phần**
không có nghĩa là phần còn lại được phép.

### Ngoại lệ và nhầm lẫn

- **Khai báo lồng được phép.** Hoisting trong một thân không phá thứ tự của file:

  ```tsx
  export const useVisibleRows = (rows: readonly Row[]) => {
      function isVisible(row: Row) {
          return !row.archived
      }

      return rows.filter(isVisible)
  }
  ```

- **`async` không đổi gì.** Một hàm bất đồng bộ ở mức module vẫn là arrow const:

  ```tsx
  export const loadProfile = async (id: string) => (await fetch(`/api/profiles/${id}`)).json()
  ```

- **Tên đúng khuôn `NAMING-1` vẫn có thể sai `NAMING-2`.** Hai mã đọc độc lập:

  ```tsx
  // Đúng NAMING-1 (arrow const), sai NAMING-2 (chữ `handle`).
  export const handleRetry = () => retry()
  ```

---

## `NAMING-2` — thứ chạy do người dùng thì tên là `onX`

### Case: biến cục bộ truyền vào một slot

```tsx
// SAI — hàm mang một tên ở đây và một tên khác đúng một dòng sau, chỉ có thói quen giữ hai thứ khớp nhau.
const handleClaim = () => claim.trigger()

return <_RewardTile state="claimable" props={frame} on={{ claim: handleClaim }} />
```

```tsx
// ĐÚNG — cái tên giống nhau ở chỗ khai báo, ở slot, và trong kiểu props.
const onClaim = () => claim.trigger()

return <_RewardTile state="claimable" props={frame} on={{ claim: onClaim }} />
```

### Case: field trong kiểu props

```tsx
// SAI — kiểu props nói một chữ, slot nói một chữ khác, và người viết phải dịch qua lại mỗi lần.
type DialogProps = {
    readonly handleConfirm: () => void
    readonly handleDismiss: () => void
}
```

```tsx
// ĐÚNG
type DialogProps = {
    readonly onConfirm: () => void
    readonly onDismiss: () => void
}
```

### Case: thuộc tính DOM

```tsx
// SAI — thuộc tính DOM đã là `onClick` từ trước khi file này tồn tại.
const handleSubmit = () => form.submit()

return <button onClick={handleSubmit} type="button">Gửi</button>
```

```tsx
// ĐÚNG
const onSubmit = () => form.submit()

return <button onClick={onSubmit} type="button">Gửi</button>
```

### Case: một giá trị không mang `on`

```tsx
// ĐÚNG — nó tính ra một chuỗi. `on` sẽ là nói dối, và luật không đòi.
const claimLabel = buildClaimLabel(quest.data)
```

```tsx
// SAI — đặt tên như thể người đọc kích hoạt nó, trong khi không ai kích hoạt cả.
const onClaimLabel = buildClaimLabel(quest.data)
```

Hai bản khác nhau đúng **một** thứ: cái chạy nó có phải là hành động của người đọc hay không.

### Case: cụm handler gom trong một object

```tsx
// SAI — cùng một lỗi chữ, chỉ nằm trong object literal. Nó đi qua lint, và vẫn sai luật.
const listeners = {
    handleSelect: (id: string) => select(id),
    handleClear: () => select(null),
}
```

```tsx
// ĐÚNG
const listeners = {
    onSelect: (id: string) => select(id),
    onClear: () => select(null),
}
```

### Case: nhận prop rồi truyền tiếp

```tsx
// SAI — đổi tên ngay tại chỗ nhận, để rồi đổi ngược lại tại chỗ truyền đi.
export const Toolbar = ({ on }: ToolbarProps) => {
    const handleRefresh = on.refresh

    return <IconButton on={{ press: handleRefresh }} />
}
```

```tsx
// ĐÚNG — không có bước dịch nào ở giữa.
export const Toolbar = ({ on }: ToolbarProps) => <IconButton on={{ press: on.refresh }} />
```

### Ngoại lệ và nhầm lẫn

- **`handled` và `handler` là từ, không phải khuôn.** Luật dừng ở `handle` + chữ hoa:

  ```tsx
  const handled = errors.length === 0
  const handler = buildHandler(config)
  ```

- **`on` không phải là giấy phép.** Một cái tên đúng khuôn mà rỗng nghĩa vẫn là một cái tên tồi:

  ```tsx
  // Đi qua rule, không nói cho ai biết cái gì xảy ra.
  const onThing = () => doTheThing()
  ```

- **Đổi chữ không phải là đổi thiết kế.** `onSubmit` gọi ba việc không liên quan vẫn là ba việc không
  liên quan; luật này chỉ nói về **chữ**.

---

## `NAMING-3` — đường dẫn viết bằng thứ tiếng mọi người cùng đọc

### Case: một đoạn route

```text
SAI   src/app/dang-nhap/page.tsx      →  /dang-nhap
ĐÚNG  src/app/sign-in/page.tsx        →  /sign-in
```

```tsx
// Bên trong file, mọi định danh đều tiếng Anh — và đó chính là lý do luật soi source không thấy gì.
export const Page = () => (
    <main>
        <SignInForm />
    </main>
)
```

Bản SAI xanh ở mọi rule đọc source. Thứ hỏng nằm ở chỗ rule ấy không nhìn được: URL, chuỗi import,
thư mục trên sidebar, và đường dẫn trong stack trace.

### Case: dấu thanh và dạng đã bỏ dấu là hai ca khác nhau

```text
SAI   src/app/cấp-phát/page.tsx       dấu thanh còn nguyên trong tên thư mục
SAI   src/app/cap-phat/page.tsx       dạng thật sự xuống tới filesystem
ĐÚNG  src/app/provisioning/page.tsx
```

Một phép kiểm dựa vào dấu bắt được dòng đầu và **không** bắt được dòng thứ hai. Đó là lý do luật này
có hai phần chứ không phải một.

### Case: route group

```text
SAI   src/app/(auth)/dang-ky/page.tsx
ĐÚNG  src/app/(auth)/sign-up/page.tsx
```

```tsx
// Ngoặc là dấu câu quanh cái tên, không phải một phần của tên. Đoạn trong ngoặc không lên URL,
// nhưng đoạn bên cạnh nó thì có.
export const Page = () => <SignUpForm />
```

### Case: thư mục component

```text
SAI   src/components/blocks/gio-hang/CartPanel/index.tsx
ĐÚNG  src/components/blocks/cart/CartPanel/index.tsx
```

```tsx
// Đường dẫn là thứ mọi import lặp lại. Một import lặp lại một thứ tiếng thì lặp lại nó ở mọi file
// từng chạm tới component này.
import { CartPanel } from "@/components/blocks/cart/CartPanel"
```

### Case: chữ người đọc thì thuộc về catalogue

```tsx
// SAI — lấy nội dung làm địa chỉ. Đổi chữ hiển thị thì đổi luôn cả URL.
// src/app/khoa-hoc/page.tsx
export const Page = () => <h1>Khoá học</h1>
```

```tsx
// ĐÚNG — địa chỉ tiếng Anh, chữ hiển thị lấy từ catalogue, và đổi ngôn ngữ không đụng tới URL.
// src/app/courses/page.tsx
export const Page = () => {
    const t = useTranslations("courses")

    return <h1>{t("title")}</h1>
}
```

```tsx
// ĐÚNG — catalogue MANG thứ tiếng kia; tên của chính file catalogue vẫn là một địa chỉ tiếng Anh.
// src/messages/vi.ts
export const vi = {
    courses: { title: "Khoá học" },
}
```

### Case: từ tiếng Anh trông giống dạng đã bỏ dấu

```text
ĐÚNG  src/app/capacity/page.tsx
ĐÚNG  src/components/leaves/DangerBadge/index.tsx
```

```tsx
// `cap` và `dang` mở đầu nhiều tên tiếng Anh bình thường. Một luật từ chối chúng là một luật bị tắt,
// và một luật đã tắt thì không giữ gì cả.
export const DangerBadge = ({ props }: DangerBadgeProps) => <span role="status">{props.label}</span>
```

### Ngoại lệ và nhầm lẫn

- **Một đoạn ngoài danh sách vẫn sai luật, dù lint im lặng:**

  ```text
  src/app/uu-dai/page.tsx     lint không báo — danh sách không có đoạn này
  src/app/offers/page.tsx     đúng luật
  ```

- **Tên file `.ts` cũng là đường dẫn.** Không chỉ route:

  ```text
  SAI   src/utils/tinh-tien.ts
  ĐÚNG  src/utils/pricing.ts
  ```

- **Thư mục không chứa file nào bị lint thì không ai ghé thăm.** Một thư mục chỉ có ảnh và `.json`
  không bao giờ đi qua rule, và luật vẫn áp cho nó.

---

## Ánh xạ yêu cầu sang một cách viết

Nêu vị trí của cái tên, ai đọc nó, và nó sẽ đi qua ranh giới nào. Nếu thiếu **một** dữ kiện quyết
định, hỏi **một** câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Thêm một helper định dạng vào file | Khai báo ở mức module | `NAMING-1` | `export const format = (…) => …` |
| Tạo trang mặc định cho một route | Export mặc định vẫn cần một cái tên để grep | `NAMING-1` | `const Page = () => …` rồi `export default Page` |
| Viết một hàm phụ chỉ dùng trong thân một hook | Lồng trong một thân, không phải mức module | `NAMING-1` (ngoại lệ) | `function` bên trong được phép |
| Nút này bấm vào thì gửi form | Hành động của người đọc, và sẽ được truyền đi | `NAMING-2` | `const onSubmit = …` |
| Khai kiểu props cho một dialog có xác nhận và huỷ | Field sẽ được đọc ở mọi call site | `NAMING-2` | `onConfirm`, `onDismiss` |
| Dựng nhãn hiển thị từ dữ liệu | Nó tính ra giá trị, không ai kích hoạt | không mã nào | `const claimLabel = …` |
| Thêm route cho trang thanh toán | Đoạn route là địa chỉ công khai | `NAMING-3` | `src/app/checkout/…` |
| Hiển thị tiêu đề trang bằng tiếng Việt | Chữ người đọc là nội dung | `NAMING-3` | Địa chỉ tiếng Anh + catalogue locale |
| Đặt tên component theo màn hình đang dùng nó | Câu hỏi này thuộc về từng layer | — | Hỏi luật của layer tương ứng |

Dòng cuối là chỗ module này **cố ý dừng lại**: nó nói rõ câu hỏi tồn tại và nói rõ nó không trả lời ở
đây, thay vì trả lời một nửa.

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `NAMING-1` / khai báo lồng | Cha của khai báo này là module, hay là thân của một hàm khác? |
| `NAMING-1` / `NAMING-2` | Đang hỏi về **cách khai báo**, hay về **chữ** trong cái tên? |
| `NAMING-2` / một giá trị | Cái chạy nó là hành động của người đọc, hay là lượt render? |
| `NAMING-2` / `handled`, `handler` | Sau `handle` có phải là một chữ hoa không? |
| `NAMING-3` / catalogue locale | Đây là **địa chỉ** hay là **chữ người ta đọc**? |
| `NAMING-3` / từ tiếng Anh trùng hình dạng | Đoạn này là một từ tiếng Anh có nghĩa, hay là một từ đã bỏ dấu? |
| Cả ba / tên theo vai trò | Câu hỏi là "viết thế nào", hay "đặt tên theo cái gì"? Vế sau thuộc luật của từng layer |

## Sai lầm lặp lại nhiều nhất

1. `export default function` cho route, rồi không grep được cái tên ở bất kỳ đâu.
2. Gọi một helper khai báo phía dưới, thấy xanh, và kết luận thứ tự file không quan trọng.
3. Đặt `handleX` ở chỗ khai báo rồi đổi thành `onX` ở chỗ truyền đi — hai lần, mỗi lần một dịp sai.
4. `handleX` nằm trong object literal hoặc trong tham số destructure, đi qua lint, ở lại vĩnh viễn.
5. Đặt `on` cho một thứ chỉ tính ra giá trị.
6. Lấy chữ hiển thị làm đoạn route, rồi phải đổi URL mỗi lần đổi nội dung.
7. Tin rằng lint im lặng nghĩa là đường dẫn hợp lệ — danh sách chỉ có hai mươi đoạn.
8. `const X = function () {}` và tưởng rằng đã thoả `NAMING-1`.
