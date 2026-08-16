---
id: fe-lints-naming-example
title: example.md
slug: /fe/lints/naming/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng quy tắc — chỗ nó kêu, chỗ nó im, và chỗ nó im mà lẽ ra nên kêu.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `naming`

Mỗi mục dưới đây là một quy tắc. **SAI** là đoạn mã làm quy tắc kêu. **ĐÚNG** là đoạn mã nó không
kêu. Mục **Chỗ lách và chỗ dễ nhầm** ở cuối mỗi quy tắc là đoạn mã **quy tắc không thấy** — đọc kỹ nhãn:
đó là chỗ máy bỏ sót, **không phải** chỗ luật cho phép.

---

## `prefer-arrow-export`

### Trường hợp: một hàm phụ trợ ở cấp mô-đun

**SAI** — cha là `Program`, quy tắc kêu tại định danh `formatQuota`.

```tsx
function formatQuota(value: number) {
    return `${value} left`
}
```

**ĐÚNG** — một hằng arrow, không tồn tại trước dòng tạo ra nó.

```tsx
const formatQuota = (value: number) => `${value} left`
```

### Trường hợp: một hàm được export theo tên

**SAI** — cha là `ExportNamedDeclaration`, vẫn nằm trong tập ba loại cha.

```tsx
export function formatQuota(value: number) {
    return `${value} left`
}
```

**ĐÚNG**

```tsx
export const formatQuota = (value: number) => `${value} left`
```

### Trường hợp: một thành phần export mặc định

**SAI** — cha là `ExportDefaultDeclaration`.

```tsx
export default function QuotaRow({ props }: QuotaRowProps) {
    return <Row props={{ label: props.label, value: formatQuota(props.remaining) }} />
}
```

**ĐÚNG** — một tên để grep ở nơi gọi, rồi mới export.

```tsx
const QuotaRow = ({ props }: QuotaRowProps) => (
    <Row props={{ label: props.label, value: formatQuota(props.remaining) }} />
)

export default QuotaRow
```

### Trường hợp: hàm bất đồng bộ và hàm sinh

**SAI** — `async` và `*` không đổi loại nút; cả hai vẫn là `FunctionDeclaration` và đều bị bắt.

```tsx
export async function loadInvoices(userId: string) {
    return client.invoices.list(userId)
}

export function* walkRows(rows: Row[]) {
    for (const row of rows) yield row
}
```

**ĐÚNG**

```tsx
export const loadInvoices = async (userId: string) => client.invoices.list(userId)

export const walkRows = function* (rows: Row[]) {
    for (const row of rows) yield row
}
```

### Chỗ lách và chỗ dễ nhầm

Đoạn dưới đây **quy tắc không kêu**. Không phải vì được phép — vì cha của nút là `BlockStatement`
chứ không phải một trong ba loại cha mà quy tắc nhận. Hiện tượng hoisting vẫn nguyên vẹn: `total`
gọi `rate` ở dòng trên dòng khai báo `rate`, và vẫn xanh.

```tsx
export const buildSummary = (rows: Row[]) => {
    const total = rows.reduce((sum, row) => sum + rate(row), 0)

    function rate(row: Row) {
        return row.amount * row.multiplier
    }

    return total
}
```

Đoạn dưới đây cũng **không bị kêu**, và đây là chỗ tên quy tắc hứa nhiều hơn hành vi: đó là một
`FunctionExpression`, không phải khai báo, nên nó thoát — dù nó **không phải arrow**.

```tsx
export const formatQuota = function (value: number) {
    return `${value} left`
}
```

Đoạn dưới đây **không bị kêu** vì không có nút khai báo nào để báo lỗi. Mối lo thứ hai mà luật nêu —
một export không có tên để grep — không được quy tắc nào giữ.

```tsx
export default ({ props }: QuotaRowProps) => <Row props={props} />
```

Đoạn dưới đây **không bị kêu** vì nó phân tích ra `TSDeclareFunction`, một loại nút mà visitor không
bao giờ nhận được.

```ts
declare function formatQuota(value: number): string
```

---

## `handler-on-prefix`

### Trường hợp: một biến cục bộ trong thành phần

**SAI** — `VariableDeclarator` có `id` là `Identifier`, tên khớp `/^handle[A-Z]/`.

```tsx
const handleClaim = () => claim.trigger()

return <Quest state="claimable" props={frame} on={{ claim: handleClaim }} />
```

**ĐÚNG** — cùng một chuỗi ký tự ở chỗ khai báo và ở ô nhận.

```tsx
const onClaim = () => claim.trigger()

return <Quest state="claimable" props={frame} on={{ claim: onClaim }} />
```

### Trường hợp: một thuộc tính JSX

**SAI** — quy tắc đọc thẳng tên thuộc tính, không cần biết thành phần nhận khai báo kiểu gì.

```tsx
<SubmitBar handleSubmit={submit} handleCancel={cancel} />
```

**ĐÚNG**

```tsx
<SubmitBar onSubmit={submit} onCancel={cancel} />
```

### Trường hợp: một trường trong kiểu props

**SAI** — `TSPropertySignature` với khoá là `Identifier`.

```ts
type SubmitBarProps = {
    handleSubmit: () => void
    handleCancel: () => void
}
```

**ĐÚNG**

```ts
type SubmitBarProps = {
    onSubmit: () => void
    onCancel: () => void
}
```

### Trường hợp: bọc trong một hook

**SAI** — giá trị khởi tạo không hề được đọc; chỉ cái tên bị kiểm, nên bọc bao nhiêu lớp cũng vẫn kêu.

```tsx
const handleRetry = useCallback(() => {
    void refetch()
}, [refetch])
```

**ĐÚNG**

```tsx
const onRetry = useCallback(() => {
    void refetch()
}, [refetch])
```

### Chỗ lách và chỗ dễ nhầm

Đoạn dưới đây **quy tắc không kêu**, và đây là cửa nặng nhất của nó: `id` của declarator là một
`ObjectPattern`, mà điều kiện đòi `Identifier`. Tên hàm phản hồi thường **đến bằng đúng đường này**.

```tsx
const SubmitBar = ({ handleSubmit, handleCancel }: SubmitBarProps) => (
    <Row>
        <Button onPress={handleSubmit}>Save</Button>
        <Button onPress={handleCancel}>Cancel</Button>
    </Row>
)
```

Đoạn dưới đây **không bị kêu**: một khai báo hàm không phải `VariableDeclarator`, và vì nó nằm trong
thân một thành phần nên `prefer-arrow-export` cũng không với tới. Cả hai quy tắc cùng im.

```tsx
const Panel = () => {
    function handleSubmit() {
        void save()
    }

    return <SubmitBar onSubmit={handleSubmit} />
}
```

Đoạn dưới đây **không bị kêu**: `Property` trong một đối tượng và `MethodDefinition` trong một lớp
đều không nằm trong ba visitor.

```tsx
const callbacks = {
    handleSubmit: () => save(),
    handleCancel: () => reset(),
}

class Controller {
    handleSubmit() {
        void save()
    }
}
```

Đoạn dưới đây **không bị kêu** dù ý nghĩa y hệt trường hợp SAI ở trên: viết dạng phương thức thì nút
là `TSMethodSignature`, còn khoá dạng chuỗi thì là `Literal` — cả hai đều trượt khỏi điều kiện.

```ts
type SubmitBarProps = {
    handleSubmit(): void
    "handleCancel": () => void
}
```

Đoạn dưới đây **không bị kêu** vì regex neo vào `handle` rồi một chữ hoa. Cách viết hậu tố là từ vựng
thay thế phổ biến nhất cho đúng ý niệm mà luật muốn thống nhất, và nó vô hình.

```tsx
const submitHandler = () => save()
const cancel_handler = () => reset()
const handleclick = () => open()
```

Đoạn dưới đây **không bị kêu** vì một trải thuộc tính là `JSXSpreadAttribute`, không phải một thuộc
tính có tên.

```tsx
<SubmitBar {...{ handleSubmit, handleCancel }} />
```

Đoạn dưới đây thì ngược lại: quy tắc **kêu nhầm**. `handle` ở đây là danh từ nghiệp vụ — tên định danh
công khai của một người — chứ không phải một hàm phản hồi. Cách xử lý là đổi tên biến để né tiền tố,
không phải tắt quy tắc cho cả tệp.

```tsx
const handleAvailable = await checkAvailability(input)
const handleInput = form.watch("publicName")
```

---

## `no-second-language-in-path`

Quy tắc này đọc **đường dẫn của tệp**, không đọc mã bên trong. Nên ví dụ ở đây là đường dẫn, kèm phán
quyết cho từng đường dẫn.

### Trường hợp: một đoạn có dấu

**SAI** — nhánh dấu khớp bất kỳ đâu trong đoạn; không cần dấu phân cách, không cần trùng khít.

```text
src/components/Đăng nhập/index.tsx     → kêu tại đoạn "đăng nhập"
src/app/thanh-toán/page.tsx            → kêu tại đoạn "thanh-toán"
```

**ĐÚNG**

```text
src/components/SignIn/index.tsx
src/app/checkout/page.tsx
```

### Trường hợp: một đoạn phiên âm nằm trong danh sách

**SAI** — bỏ dấu ngoặc rồi so bằng với danh sách hai mươi phần tử; cả hai đường dẫn dưới đây đều trùng
khít.

```text
src/app/dang-nhap/page.tsx             → kêu tại đoạn "dang-nhap"
src/app/(auth)/[dang-ky]/page.tsx      → kêu tại đoạn "dang-ky" sau khi bóc ngoặc
```

**ĐÚNG**

```text
src/app/sign-in/page.tsx
src/app/(auth)/[sign-up]/page.tsx
```

### Trường hợp: chữ hoa không cứu được gì

**SAI** — toàn bộ đường dẫn được hạ chữ thường trước mọi phép so.

```text
src/app/DANG-XUAT/page.tsx             → kêu tại đoạn "dang-xuat"
```

**ĐÚNG**

```text
src/app/sign-out/page.tsx
```

### Chỗ lách và chỗ dễ nhầm

Những đường dẫn dưới đây **quy tắc không kêu**. Chúng vi phạm luật y như các trường hợp SAI ở trên;
chỉ là máy không với tới. Đây là bỏ sót, không phải cho phép.

```text
src/app/bai-hoc/page.tsx               → im: từ phiên âm không có trong danh sách
src/app/nguoi-dung/page.tsx            → im: cùng lý do
src/app/dang-nhap-v2/page.tsx          → im: so bằng nguyên đoạn, hậu tố phá khớp
src/app/auth-dang-nhap/page.tsx        → im: tiền tố phá khớp
src/app/dangnhap/page.tsx              → im: bỏ dấu gạch thì không còn trùng
src/app/dang_nhap/page.tsx             → im: đổi dấu phân cách thì không còn trùng
src/app/[...dang-nhap]/page.tsx        → im: chỉ bóc bốn ký tự ngoặc, ba dấu chấm còn lại
src/app/@dang-nhap/page.tsx            → im: ký tự @ không nằm trong tập bị bóc
```

Thư mục dưới đây **không bao giờ bị bước vào**: quy tắc phát ra từ bên trong một tệp đang được kiểm,
mà ở đây không có tệp nào được kiểm cả.

```text
public/tai-lieu/huong-dan.pdf
public/tai-lieu/bang-gia.png
```

Đoạn mã dưới đây **không bị kêu** dù nó tạo ra đúng cái địa chỉ công khai mà luật lo lắng. Quy tắc đọc
tên tệp; ở đây ngôn ngữ thứ hai nằm trong một chuỗi, và không có tệp nào để chỉ vào.

```ts
export const redirects = [
    { source: "/dang-nhap", destination: "/sign-in", permanent: true },
    { source: "/gio-hang", destination: "/cart", permanent: true },
]
```

Đường dẫn dưới đây bị kêu **một lần duy nhất** dù có hai đoạn phạm. Sửa xong đoạn đầu thì quy tắc kêu
lại ở đoạn sau; ai đọc một thông báo sẽ ước lượng thiếu khối lượng phải sửa.

```text
src/app/dang-nhap/tai-khoan/page.tsx   → chỉ báo "dang-nhap"
```

Còn đây là chiều ngược lại — **kêu nhầm hàng loạt**. Quy tắc quét **toàn bộ đường dẫn tuyệt đối**, kể
cả phần nằm ngoài kho mã. Một bản làm việc đặt dưới một thư mục có dấu sẽ khiến mọi tệp trong kho báo
lỗi, ở một đoạn không ai trong kho sửa được.

```text
C:/Người dùng/tuan/repo/src/app/checkout/page.tsx   → kêu tại đoạn "người dùng"
```

---

## Ánh xạ yêu cầu sang một phán quyết

Nêu quy tắc, nêu nút mà quy tắc thăm, rồi mới nêu phán quyết. Một phán quyết **im** phải luôn kèm
theo lý do im: sạch, hay lọt.

| Yêu cầu bằng lời | Quy tắc | Phán quyết |
|---|---|---|
| Đổi `export function X()` sang hằng arrow | `prefer-arrow-export` | Kêu tại `X`, thông báo viết sẵn dạng thay thế |
| Bỏ một `function` phụ trợ nằm trong thân một thành phần | `prefer-arrow-export` | Im — cha là `BlockStatement`; phải người đọc lại |
| Kiểm rằng mọi hàm phản hồi ở props đều tên `on…` | `handler-on-prefix` | Kêu ở trường viết dạng `handle…`, **im** ở trường viết dạng phương thức và ở props phá cấu trúc |
| Kiểm rằng không còn cách viết `…Handler` nào | `handler-on-prefix` | Im hoàn toàn — regex neo vào tiền tố, không neo vào hậu tố |
| Kiểm rằng không tuyến nào mang ngôn ngữ thứ hai | `no-second-language-in-path` | Kêu ở đoạn có dấu và ở hai mươi đoạn trong danh sách; im ở mọi từ phiên âm khác |
| Kiểm rằng không URL công khai nào mang ngôn ngữ thứ hai | `no-second-language-in-path` | Im nếu URL đến từ một bảng chuyển hướng — quy tắc chỉ đọc tên tệp |
| Kiểm một thư mục tài liệu tĩnh | `no-second-language-in-path` | Im — không có tệp nào được kiểm để phát ra thông báo |

## Bảng phân định ranh giới

Chỉ hỏi khi thật sự thiếu dữ kiện.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `prefer-arrow-export` / `handler-on-prefix` | Đang nói về **hình dạng** khai báo hay về **cái tên**? Hai quy tắc không bao giờ cùng bắt một lỗi |
| Kêu / im ở `prefer-arrow-export` | Cha trực tiếp của nút có phải thân mô-đun hoặc một lệnh export không? |
| Kêu / im ở `handler-on-prefix` | Cái tên đang nằm ở một trong đúng ba loại nút, hay ở tham số, thuộc tính đối tượng, phương thức? |
| Kêu nhầm / kêu đúng ở `handler-on-prefix` | `handle` ở đây là **động từ** hay là **danh từ nghiệp vụ**? |
| Kêu / im ở `no-second-language-in-path` | Đoạn phạm có **trùng khít** một phần tử trong danh sách sau khi bóc bốn ký tự ngoặc không? |
| Đường dẫn / chuỗi | Địa chỉ đó do **hệ thống tệp** sinh ra hay do một **chuỗi trong mã** khai báo? |

## Sai lầm lặp lại nhiều nhất

1. Tin rằng quy tắc đã giữ hết luật, rồi thôi không đọc lại — sai lầm gốc, và là lý do trang này tồn tại.
2. Viết `const X = function () {}` rồi coi là đã theo `NAMING-1`; nó thoát quy tắc nhưng không phải arrow.
3. Đặt `handleX` trong props phá cấu trúc và tưởng là hợp lệ vì bản build xanh.
4. Dùng cách viết hậu tố `…Handler` để né, tạo ra đúng cái hai-từ-vựng mà luật muốn xoá.
5. Đặt một `function` phụ trợ trong thân thành phần rồi gọi nó ở dòng trên — vẫn hoisting, vẫn xanh.
6. Đổi tên `dang-nhap` thành `dangnhap` cho hết lỗi, thay vì đổi sang ngôn ngữ chung.
7. Tắt `handler-on-prefix` cho cả tệp chỉ vì một biến chứa danh từ `handle`.
8. Coi việc quét toàn bộ đường dẫn tuyệt đối là lỗi của kho mã, rồi đi sửa tên tệp trong kho.
