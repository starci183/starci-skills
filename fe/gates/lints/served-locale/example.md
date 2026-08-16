---
id: fe-lints-served-locale-example
title: example.md
slug: /gates/lints/served-locale/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng rule - chỗ nổ, chỗ không nổ, và chỗ lọt lưới.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `served-locale` · Máy: [`INDEX.md`](./INDEX.md) · Vì sao: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi rule có nhiều cặp **SAI** (rule nổ) và **ĐÚNG** (rule im), rồi tới mục **Chỗ lách và chỗ dễ nhầm**.
Mã trong mục cuối cùng đó **không phải mã được phép viết** — nó là mã mà rule **không nhìn thấy**.
Đọc nhầm chỗ này là biến một lỗ hổng thành một giấy phép.

---

## `api-client-attaches-the-locale`

### SAI — chuỗi đầy đủ, chỉ câm về ngôn ngữ

```ts
// src/api/create-client.ts
export const createLinkChain = ({ uri, headers, signal, withAuth }: Params) => [
    createRetryLink(),
    createTimeoutLink(),
    ...(withAuth ? [createAttachBearerTokenLink({ debug })] : []),
    createHttpLink({ uri, headers, signal }),
]
```

Chuỗi có thử lại, có hết giờ, có xác thực — và không nói mình muốn đọc bằng tiếng gì. Rule nổ ngay
tại `createHttpLink`.

### ĐÚNG — mắt xích ngôn ngữ đứng cạnh mắt xích xác thực

```ts
// src/api/create-client.ts
export const createLinkChain = ({ uri, headers, signal, withAuth }: Params) => [
    createRetryLink(),
    createTimeoutLink(),
    createAttachLocaleLink({ debug }),
    ...(withAuth ? [createAttachBearerTokenLink({ debug })] : []),
    createHttpLink({ uri, headers, signal }),
]
```

### SAI — dựng bằng `new`

```ts
// src/api/client.ts
const terminal = new HttpLink({ uri: endpoint, fetch })
export const client = new ApiClient({ link: from([retry, timeout, terminal]) })
```

Một hàm thăm gắn cho cả lời gọi lẫn `new`, nên `new HttpLink(...)` bị thấy y như `createHttpLink(...)`.

### ĐÚNG — cùng cách dựng, có thêm mắt xích ngôn ngữ

```ts
// src/api/client.ts
const locale = createLocaleLink()
const terminal = new HttpLink({ uri: endpoint, fetch })
export const client = new ApiClient({ link: from([retry, timeout, locale, terminal]) })
```

### SAI — chuỗi tải tệp lên cũng là chuỗi

```ts
// src/api/upload-client.ts
export const uploadChain = ({ uri }: Params) => [
    createTimeoutLink(),
    createUploadLink({ uri }),
]
```

Một màn hình tải tệp lên vẫn nhận về thông báo lỗi, tên danh mục và nhãn đã dịch. Nó không được miễn.

### ĐÚNG — chuỗi tải tệp lên có ngôn ngữ

```ts
// src/api/upload-client.ts
export const uploadChain = ({ uri }: Params) => [
    createTimeoutLink(),
    createAttachLocaleLink(),
    createUploadLink({ uri }),
]
```

### SAI — chuỗi gộp lô

```ts
// src/api/batch-client.ts
export const batchChain = ({ uri }: Params) => [
    createRetryLink(),
    new BatchHttpLink({ uri, batchMax: 10 }),
]
```

### ĐÚNG — gọi qua một đối tượng vẫn được nhận diện

```ts
// src/api/batch-client.ts
export const batchChain = ({ uri }: Params) => [
    createRetryLink(),
    links.createAttachLocaleLink(),
    new transport.BatchHttpLink({ uri, batchMax: 10 }),
]
```

Tên bên bị gọi được rút từ `.property.name`, nên phần đứng trước dấu chấm bị bỏ qua ở cả hai vế.

### ĐÚNG vì miễn trừ — tệp định nghĩa chính mắt xích đó

```ts
// src/api/links/http.ts
export const createHttpLink = ({ uri, headers, signal }: Params) =>
    new HttpLink({ uri, headers, fetchOptions: { signal } })
```

Tệp nằm **trực tiếp** trong `links/` là **một** mắt xích, không phải một chuỗi. Gắn mắt xích ngôn ngữ
vào đây là một chuỗi trốn bên trong một mắt xích, nên không có cách nào thoả mãn rule ở đây — và
miễn trừ tồn tại vì đúng lý do đó.

### ĐÚNG vì miễn trừ — spec khẳng định *về* một chuỗi

```ts
// src/api/create-client.spec.ts
it("puts the terminal link last", () => {
    const chain = createLinkChain({ uri, withAuth: false })
    expect(chain.at(-1)).toBe(createHttpLink.mock.results[0].value)
})
```

### Chỗ lách và chỗ dễ nhầm

Mã dưới đây **lọt lưới**. Không cái nào trong số này là cách viết được luật cho phép.

**Đổi tên khi nhập khẩu.** Rule so theo cách viết của tên, không truy vết nhập khẩu.

```ts
// LỌT LƯỚI - vẫn vi phạm LOCALE-1, rule không thấy
import { createHttpLink as createTransport } from "./links/http"

export const createLinkChain = ({ uri }: Params) => [
    createRetryLink(),
    createTransport({ uri }),
]
```

**Chuỗi lắp từ hằng.** Không có lời gọi nào, nên không có tên nào để so.

```ts
// LỌT LƯỚI - đúng cái mắt xích bị bỏ quên lại là thứ làm rule im
import { authLink } from "./links/auth"
import { httpLink } from "./links/http"

export const chain = from([authLink, httpLink])
```

**Có tên mà không có trong chuỗi.** Rule ghi nhận một cái tên đã được gọi ở đâu đó trong tệp.

```ts
// LỌT LƯỚI - hằng này không ai dùng, chuỗi vẫn câm
const unusedLocaleLink = createAttachLocaleLink()

export const chain = from([createRetryLink(), createHttpLink({ uri })])
```

**Gắn có điều kiện.** `LOCALE-1` nói thẳng là vô điều kiện; rule không thấy điều kiện.

```ts
// LỌT LƯỚI - khách vãng lai đọc bằng ngôn ngữ mặc định của máy chủ
export const createLinkChain = ({ uri, isLoggedIn }: Params) => [
    ...(isLoggedIn ? [createAttachLocaleLink()] : []),
    createHttpLink({ uri }),
]
```

**Miễn trừ theo thư mục, không theo tệp.** Đặt cả chuỗi vào trong `links/` là được miễn trọn vẹn.

```ts
// LỌT LƯỚI - src/api/links/client.ts, nằm trực tiếp trong links/ nên không bị soi
export const createLinkChain = ({ uri }: Params) => [
    createRetryLink(),
    createHttpLink({ uri }),
]
```

Chú ý mặt trái của cùng một cổng: chuyển mắt xích thật xuống một tầng nữa thì **mất** miễn trừ, vì
cổng đòi tệp nằm trực tiếp trong `links`.

```ts
// BÁO SAI - src/api/links/http/index.ts vẫn là một mắt xích, nhưng cổng miễn trừ không khớp
export const createHttpLink = ({ uri }: Params) => new HttpLink({ uri })
```

**Tệp phụ trợ cho kiểm thử không mang đuôi spec.** Cổng miễn trừ chỉ nhận `.test.` và `.spec.`.

```ts
// BÁO SAI - src/api/__tests__/fixture-client.ts, không phải mã sản phẩm nhưng vẫn bị báo
export const makeTestChain = () => [createHttpLink({ uri: "http://localhost" })]
```

---

## `locale-header-belongs-to-the-link`

### SAI — header viết trong một hook

```ts
// src/hooks/use-course.ts
export const useCourse = ({ displayId, locale }: Params) =>
    useSwr([KEY, displayId, locale], () =>
        queryCourse({ request: { displayId }, headers: { "x-locale": locale } }),
    )
```

Đúng ở đúng chỗ này, và hook tiếp theo sẽ không truyền. Đây là câu trả lời thứ hai cho câu hỏi
"lời gọi này thuộc ngôn ngữ nào".

### ĐÚNG — hook không biết gì về ngôn ngữ

```ts
// src/hooks/use-course.ts
export const useCourse = ({ displayId }: Params) =>
    useSwr([KEY, displayId], () => queryCourse({ request: { displayId } }))
```

Ngôn ngữ đi theo đường truyền, nên không lời gọi nào phải nhớ.

### SAI — khoá tính toán dạng chuỗi vẫn bị bắt

```ts
// src/api/query-category.ts
const headers = { ["x-locale"]: currentLocale }
```

Khoá `Literal` mang giá trị chuỗi được đọc dù có tính toán hay không.

### SAI — hằng cấu hình cũng là một câu trả lời thứ hai

```ts
// src/config/request-defaults.ts
export const DEFAULT_HEADERS = {
    "content-type": "application/json",
    "x-locale": "en",
}
```

Đây chính là dạng nguy hiểm nhất: nó **trông** như đã lo xong phần ngôn ngữ, trong khi nó đóng băng
một thứ tiếng cho mọi người đọc.

### ĐÚNG — nơi duy nhất được viết

```ts
// src/api/links/locale.ts
export const createAttachLocaleLink = () =>
    new ContextLink((operation, previous) => ({
        headers: { ...previous.headers, "x-locale": readLocaleFromPath() },
    }))
```

### ĐÚNG — chuyền giá trị, không chuyền tên header

```ts
// src/api/query-course.ts
export const queryCourse = ({ request }: Params) => client.query({ query: COURSE, variables: request })
```

### Chỗ lách và chỗ dễ nhầm

Mã dưới đây **lọt lưới**. Tất cả đều đặt đúng cái header mà rule tưởng mình đang giữ.

**Gán chứ không khai báo.**

```ts
// LỌT LƯỚI - phép gán vào biểu thức thành viên không phải nút Property
const headers: Record<string, string> = {}
headers["x-locale"] = currentLocale
```

**Header là đối số của một lời gọi.**

```ts
// LỌT LƯỚI - rule không đọc đối số
const headers = new Headers()
headers.set("x-locale", currentLocale)
```

**Hằng rửa sạch chuỗi.**

```ts
// LỌT LƯỚI - khoá tính toán dạng Identifier trả về null
const LOCALE_HEADER = "x-locale"
const headers = { [LOCALE_HEADER]: currentLocale }
```

**Đổi chữ hoa chữ thường.** Trên đường truyền, tên header không phân biệt hoa thường; phép so trong
rule thì có.

```ts
// LỌT LƯỚI - cùng một header, không một báo lỗi nào
const headers = { "X-Locale": "en" }
```

**Trải một đối tượng dựng ở tệp khác.**

```ts
// LỌT LƯỚI - không có Property nào ở đây, và tệp kia không được mở ra
import { localeHeader } from "./locale-header"

const headers = { ...localeHeader, "content-type": "application/json" }
```

**Miễn trừ neo vào tên tệp — mất khi đổi tên hoặc đổi ngôn ngữ lập trình.**

```js
// BÁO SAI - src/api/links/locale.js, đúng tệp mắt xích ngôn ngữ, nhưng đuôi .js không được miễn
export const createAttachLocaleLink = () => attach({ "x-locale": readLocaleFromPath() })
```

```ts
// BÁO SAI - src/api/links/attach-locale.ts, đổi tên là mất miễn trừ
export const createAttachLocaleLink = () => attach({ "x-locale": readLocaleFromPath() })
```

```ts
// LỌT LƯỚI - vendor/widgets/links/locale.ts, chẳng liên quan gì, vẫn được miễn
export const HEADERS = { "x-locale": "en" }
```

**Spec không được miễn khỏi rule này.**

```ts
// BÁO SAI - src/api/links/locale.spec.ts miễn khỏi rule chuỗi, không miễn khỏi rule header
it("attaches the header", () => {
    expect(run(link).headers).toEqual({ "x-locale": "vi" })
})
```

**Không kiểm chiều ngược lại — cửa mở đắt nhất của cả mô-đun.**

```ts
// LỌT LƯỚI - cả hai rule đều xanh, và không lời gọi nào khai báo ngôn ngữ
// src/api/links/locale.ts
export const createAttachLocaleLink = () =>
    new ContextLink((operation, previous) => ({ headers: { ...previous.headers } }))
```

```ts
// ...và chuỗi bên cạnh nó vẫn "hợp lệ"
export const createLinkChain = ({ uri }: Params) => [
    createAttachLocaleLink(),
    createHttpLink({ uri }),
]
```

Hai tệp trên tái lập **chính xác** sự cố đã sinh ra luật này, với một build hoàn toàn xanh.

---

## Ánh xạ yêu cầu sang rule sẽ nổ

| Việc đang làm | Rule liên quan | Kết quả |
|---|---|---|
| Dựng một chuỗi truyền tải mới, có `createHttpLink` | `api-client-attaches-the-locale` | Đỏ cho tới khi có lời gọi `createAttachLocaleLink` hoặc `createLocaleLink` trong cùng tệp |
| Thêm một chuỗi tải tệp lên bằng `createUploadLink` | `api-client-attaches-the-locale` | Như trên, không có miễn trừ nào cho tải tệp lên |
| Viết `new HttpLink(...)` trong một tệp trực tiếp dưới `links/` | `api-client-attaches-the-locale` | Xanh vì miễn trừ mắt xích |
| Đặt `"x-locale"` vào `headers` của một hook | `locale-header-belongs-to-the-link` | Đỏ tại đúng thuộc tính đó |
| Đặt `"x-locale"` vào một hằng cấu hình dùng chung | `locale-header-belongs-to-the-link` | Đỏ; hằng dùng chung không phải mắt xích |
| Viết `"x-locale"` trong `links/locale.ts` | `locale-header-belongs-to-the-link` | Xanh vì miễn trừ tệp mắt xích |
| Đổi mắt xích ngôn ngữ sang `links/attach-locale.ts` | `locale-header-belongs-to-the-link` | Đỏ ngay tại nơi duy nhất được phép viết — miễn trừ neo vào tên tệp |
| Đọc ngôn ngữ từ một tham số truyền qua hook | *không rule nào* | Xanh; `LOCALE-2` là câu hỏi phản biện của người |
| Trông cậy vào cookie để qua biên nguồn gốc | *không rule nào* | Xanh; `LOCALE-3` là câu hỏi phản biện của người |
| Coi mặc định của máy chủ là phương án dự phòng | *không rule nào* | Xanh; `LOCALE-4` là câu hỏi phản biện của người |

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định |
|---|---|
| Chuỗi hay mắt xích | Tệp này **lắp ráp** nhiều mắt xích, hay **định nghĩa** một mắt xích? Lắp ráp thì phải gắn ngôn ngữ; định nghĩa thì không có chỗ đúng để gắn |
| Rule chuỗi hay rule header | Đang thiếu **một mắt xích** trong chuỗi, hay đang có **một chuỗi ký tự header** ở sai chỗ? |
| Cửa đóng hay cửa mở | Rule có nút cú pháp để bám vào không? Không có nút thì không có phát hiện, dù ý định rõ đến đâu |
| Rule bắt hay luật cấm | Luật cấm bảy việc; máy giữ được hai. Năm việc còn lại vẫn bị cấm, chỉ là không ai gác |
| Báo sai hay vi phạm thật | Tệp có nằm ngoài ý định của miễn trừ không? Nếu có, đó là phát hiện **về rule**, không phải việc phải sửa mã sản phẩm |

## Sai lầm lặp lại nhiều nhất

1. Đọc "build xanh" thành "mọi lời gọi đều khai báo ngôn ngữ". Xanh chỉ nói về tên gọi và vị trí.
2. Gom tên header vào một hằng cho gọn, và vô tình gỡ mất rule thứ hai.
3. Gắn mắt xích ngôn ngữ trong một nhánh có điều kiện, trong khi luật nói vô điều kiện.
4. Đặt cả chuỗi vào trong `links/` rồi tưởng đó là sắp xếp thư mục, chứ không biết đó là tự miễn
   trừ cho mình.
5. Đổi tên tệp mắt xích ngôn ngữ và thấy chính nơi được phép viết header lại bị báo đỏ.
6. Sửa mã sản phẩm để làm im một báo sai do cổng miễn trừ, thay vì ghi nó thành phát hiện về rule.
7. Viết `X-Locale` vì thấy tài liệu ngoài viết hoa như vậy, rồi kết luận rule đã cho phép.
8. Tin rằng rule header bảo đảm mắt xích **có** viết header. Nó chỉ cấm nơi khác viết.
