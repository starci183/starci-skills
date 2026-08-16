---
id: fe-patterns-served-locale-example
title: example.md
slug: /fe/patterns/served-locale/example
sidebar_label: example.md
sidebar_position: 2
description: Tất cả case và ngoại lệ của từng mã LOCALE-N, viết bằng TSX/TS thường.
---

# example.md

> Version: `2.00` · Module: `served-locale` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TS/TSX thường**. Không design system riêng, không tên sản phẩm, không tên
repository. Một luật chỉ đúng khi nó đúng ở bất kỳ front end nào — nên nếu một ví dụ cần tên riêng của
một dự án mới đọc được, ví dụ đó nằm sai chỗ.

Mỗi mã có **nhiều case**, từng case đặt **ĐÚNG** cạnh **SAI**, sau đó là mục ngoại lệ và những thứ trông
giống nhưng không phải mã đó. Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một quyết định.

Quy ước đọc: một **chain** là nơi các link được lắp ráp thành đường truyền; một **link** là một mắt
xích trong chain đó; **link terminal** là mắt xích duy nhất thật sự chạm mạng.

---

## `LOCALE-1` — chain nào cũng khai báo

### Case: chain ẩn danh

ĐÚNG — locale nằm trong chain, cạnh chỗ auth sẽ được chèn vào:

```ts
export const createLinkChain = ({ withAuth = false, uri, headers, signal, debug = false }: Params = {}) => [
    createRetryLink(),
    createTimeoutLink(),
    // Vô điều kiện, khác với link bearer: khách vãng lai cũng đọc bằng một ngôn ngữ, và tài liệu
    // được lưu theo từng locale.
    createAttachLocaleLink({ debug }),
    ...(withAuth ? [createAttachBearerTokenLink({ debug })] : []),
    createHttpLink({ uri, headers, signal }),
]
```

SAI — chain đầy đủ, có retry, có timeout, có token, và câm về ngôn ngữ:

```ts
export const createLinkChain = ({ withAuth = false, uri, headers, signal, debug = false }: Params = {}) => [
    createRetryLink(),
    createTimeoutLink(),
    ...(withAuth ? [createAttachBearerTokenLink({ debug })] : []),
    createHttpLink({ uri, headers, signal }),
]
```

Khác nhau đúng một điều: người đọc đang ở một địa chỉ tiếng Việt có được phục vụ tài liệu tiếng Việt
hay không.

### Case: gắn locale sau một điều kiện

SAI — locale bị buộc vào trạng thái đăng nhập:

```ts
export const createLinkChain = ({ withAuth = false }: Params = {}) => [
    createRetryLink(),
    createTimeoutLink(),
    // Toàn bộ nội dung công khai - thứ người đọc gặp đầu tiên - mất ngôn ngữ.
    ...(withAuth ? [createAttachLocaleLink(), createAttachBearerTokenLink()] : []),
    createHttpLink(),
]
```

ĐÚNG — hai thứ khác nhau, hai vị trí khác nhau:

```ts
export const createLinkChain = ({ withAuth = false }: Params = {}) => [
    createRetryLink(),
    createTimeoutLink(),
    createAttachLocaleLink(),
    ...(withAuth ? [createAttachBearerTokenLink()] : []),
    createHttpLink(),
]
```

Phép thử của case này: bật auth lên phải làm chain **dài thêm đúng một** link.

```ts
// spec: một câu duy nhất giữ cả hai hình dạng thẳng hàng
expect(createLinkChain({ withAuth: true })).toHaveLength(createLinkChain().length + 1)
```

### Case: client thứ hai cho một tính năng mới

SAI — chain thứ hai được viết riêng cho upload, và không ai nhớ tới ngôn ngữ:

```ts
export const createUploadChain = ({ uri }: Params = {}) => [
    createRetryLink(),
    createUploadLink({ uri }),
]
```

ĐÚNG — chain nào chạm mạng thì chain đó khai báo:

```ts
export const createUploadChain = ({ uri }: Params = {}) => [
    createRetryLink(),
    createAttachLocaleLink(),
    createUploadLink({ uri }),
]
```

Lý do phải nói riêng case này: chain thứ hai gần như luôn là **bản copy của chain thứ nhất tại thời
điểm nó được copy**. Nếu locale được thêm vào bản gốc sau đó, bản copy sẽ vĩnh viễn thiếu.

### Ngoại lệ và nhầm lẫn

- **File định nghĩa link terminal không phải là chain.** Nó dựng ra link đó vì đấy là việc của nó, và
  không có cách nào đúng để gắn locale ở trong:

  ```ts
  // links/http.ts - đây là MỘT link, không phải một chain
  export const createHttpLink = (params: CreateHttpLinkParams = {}) =>
      new HttpLink(resolveHttpLinkOptions(params))
  ```

  Nhét một link locale vào đây là giấu cả chain vào trong một mắt xích:

  ```ts
  // SAI: một chain đang trốn bên trong một link
  export const createHttpLink = (params: CreateHttpLinkParams = {}) =>
      ApolloLink.from([createAttachLocaleLink(), new HttpLink(resolveHttpLinkOptions(params))])
  ```

- **Spec khẳng định về một chain chứ không là một chain:**

  ```ts
  // create-apollo-client.test.ts - dựng chain để soi, không phải để chạy production
  const chain = createLinkChain()
  expect(chain.at(-1)).toBeInstanceOf(HttpLink)
  ```

- **Có link locale không có nghĩa là lấy đúng giá trị.** Đó là `LOCALE-2`:

  ```ts
  // Thoả LOCALE-1, vi phạm LOCALE-2: mọi người đọc đều nhận cùng một ngôn ngữ
  export const createAttachLocaleLink = () => new ApolloLink((operation, forward) => {
      operation.setContext({ headers: { "x-locale": "en" } })
      return forward(operation)
  })
  ```

---

## `LOCALE-2` — đọc từ địa chỉ, không nhận từ tham số

### Case: nguồn của giá trị

ĐÚNG — link tự suy ra, không caller nào phải nhớ gì:

```ts
export const resolveRequestLocale = (): Locale => {
    if (typeof window === "undefined") return DEFAULT_LOCALE
    return localeFromPath(window.location.pathname)
        ?? localeFromCookie(document.cookie)
        ?? DEFAULT_LOCALE
}
```

SAI — đúng ở đúng call site này, và hook tiếp theo sẽ không truyền:

```ts
export const useQueryDocumentSwr = ({ displayId, locale }: { displayId: string; locale: Locale }) =>
    useSWR([KEY, displayId, locale], () =>
        queryDocument({ request: { displayId }, headers: { "x-locale": locale } }))
```

Khác nhau đúng một điều: việc đúng có phụ thuộc vào trí nhớ của từng tác giả về sau hay không.

### Case: đoạn đầu của địa chỉ không phải lúc nào cũng là locale

ĐÚNG — chỉ nhận đoạn đầu khi nó **thật sự** là một locale được ship:

```ts
const localeFromPath = (pathname: string): Locale | undefined => {
    const [, first] = pathname.split("/")
    if (first === undefined || first === "") return undefined
    const resolved = toLocale(first)
    // `toLocale` trả về default cho mọi thứ nó không nhận ra, nên một đoạn đầu lạ - `/dashboard`
    // trước khi middleware kịp redirect - không được đọc thành một lựa chọn thật.
    return resolved === first ? resolved : undefined
}
```

SAI — hàm narrow trả về default, và default đó bị đọc thành "người dùng đã chọn":

```ts
const localeFromPath = (pathname: string): Locale => toLocale(pathname.split("/")[1] ?? "")
```

Khác nhau đúng một điều: `/dashboard` có bị hiểu thành "người này chọn tiếng mặc định" hay không —
và nếu có, cookie phía sau sẽ không bao giờ được hỏi tới.

### Case: cache key lộ ra rằng locale đang đi bằng tay

SAI — locale nằm trong key vì nó nằm trong tham số:

```ts
export const useQueryDocumentSwr = ({ displayId, locale }: Params) =>
    useSWR(["document", displayId, locale], () => queryDocument({ displayId, locale }))
```

ĐÚNG — key nói về **cái được hỏi**, còn ngôn ngữ là thuộc tính của đường truyền:

```ts
export const useQueryDocumentSwr = ({ displayId }: Params) =>
    useSWR(["document", displayId], () => queryDocument({ displayId }))
```

Nếu một màn hình cho phép đổi ngôn ngữ **mà không đổi địa chỉ**, đó là một quyết định sản phẩm khác
và phải được nêu ra, không phải được lén đưa vào bằng một tham số hook.

### Ngoại lệ và nhầm lẫn

- **Seam cho test không phải là tham số bị cấm.** Điều kiện: mặc định là hàm suy ra, và production
  không truyền gì:

  ```ts
  export interface CreateAttachLocaleLinkParams {
      /** Nguồn của locale. Seam giữ lại để một spec cố định được giá trị. */
      getLocale?: () => Locale
  }

  export const createAttachLocaleLink = ({ getLocale = resolveRequestLocale }: CreateAttachLocaleLinkParams = {}) =>
      new ApolloLink((operation, forward) => { /* … */ })
  ```

  ```ts
  // ĐÚNG: chỉ spec truyền
  createAttachLocaleLink({ getLocale: () => "vi" })
  ```

  ```ts
  // SAI: production truyền - seam vừa biến thành đúng cái tham số LOCALE-2 cấm
  createApolloClient({ getLocale: () => props.locale })
  ```

- **Cookie làm nguồn đọc phía client là hợp lệ.** Nó chỉ không hợp lệ khi được dùng làm **phương
  tiện** — xem `LOCALE-3`.

- **Không có địa chỉ để đọc là một nhánh đóng, không phải một lối thoát:**

  ```ts
  // Trên server không có `window`; nhánh này trả app default rồi lần fetch phía client sửa lại.
  if (typeof window === "undefined") return DEFAULT_LOCALE
  ```

---

## `LOCALE-3` — cookie không đi qua ranh giới origin

### Case: đường ẩn danh, API khác origin

SAI — trông cậy vào cookie mà request này không hề gửi:

```ts
// "Server đọc cookie ngôn ngữ rồi, nên client không cần làm gì."
export const createLinkChain = () => [
    createRetryLink(),
    createHttpLink({ uri: apiEnv().graphql.url }),
]
```

ĐÚNG — gửi header, vì header là thứ **đi được** trên đúng đường mà request này đi:

```ts
export const createLinkChain = () => [
    createRetryLink(),
    createAttachLocaleLink(),
    createHttpLink({ uri: apiEnv().graphql.url }),
]
```

Khác nhau đúng một điều: server có nhận được gì để đọc hay không. Code đọc cookie ở phía server vẫn
chạy trong cả hai trường hợp — và trong trường hợp SAI, nó chạy trên một cái rỗng.

### Case: "sửa" bằng cách bật credentials

SAI — kéo cả một phạm vi khác vào chỉ để mang một giá trị:

```ts
// Bật credentials cho đường ẩn danh chỉ để cookie ngôn ngữ đi cùng.
createHttpLink({ uri, withCredentials: true })
```

ĐÚNG — credentials là quyết định của tầng auth; ngôn ngữ đi bằng header:

```ts
export const resolveHttpLinkOptions = ({ uri, withCredentials = false }: CreateHttpLinkParams = {}) => ({
    uri: uri ?? apiEnv().graphql.url,
    // Mặc định tắt: đường ẩn danh không cần cookie, và gửi cookie sang một API cross-origin chưa
    // opt-in chỉ tạo ra lỗi CORS.
    credentials: withCredentials ? "include" : "same-origin",
})
```

### Ngoại lệ và nhầm lẫn

- **Cookie vẫn là nguồn đọc hợp lệ ở phía client**, ngay trước khi một component biết route của mình:

  ```ts
  const localeFromCookie = (cookie: string): Locale | undefined => {
      const match = cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`))
      if (match?.[1] === undefined) return undefined
      return toLocale(decodeURIComponent(match[1].trim()))
  }
  ```

- **Cùng origin không làm luật này biến mất.** Nó chỉ làm cho một trong các cách hỏng biến mất. Header
  vẫn là thứ `LOCALE-5` kiểm được, còn cookie thì không ai kiểm được nó đã tới hay chưa.

---

## `LOCALE-4` — mặc định của server là sàn

### Case: đọc câu trả lời mặc định thành "fallback hoạt động"

SAI — kết luận rút ra từ một phép thử không thể thất bại:

```ts
// Người test đọc tiếng mặc định, nên request không khai báo vẫn "trông đúng".
const document = await queryDocument({ displayId })
expect(document.title).toBe("Distributed systems")
```

ĐÚNG — phép thử phải hỏi **request đã khai báo gì**, không phải **câu trả lời trông thế nào**:

```ts
it("khai báo ngôn ngữ trên mọi request, kể cả ẩn danh", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await runOperation(createLinkChain())

    const [, init] = fetchMock.mock.calls[0] ?? []
    expect(new Headers(init?.headers).get("x-locale")).toBeTruthy()
})
```

Khác nhau đúng một điều: phép thử có phát hiện được trường hợp **không gửi gì** hay không.

### Case: smoke test chỉ kiểm status

SAI — 200 là bằng chứng cho việc kết nối được, không phải cho việc phục vụ đúng ngôn ngữ:

```ts
expect(response.status).toBe(200)
```

ĐÚNG — nếu muốn nói về ngôn ngữ thì phải hỏi về ngôn ngữ:

```ts
expect(response.status).toBe(200)
expect(response.request.headers["x-locale"]).toBe("vi")
```

### Ngoại lệ và nhầm lẫn

- **Nhánh không có địa chỉ vẫn khai báo, chứ không bỏ trống.** Kiểu trả về là locale đóng, không phải
  optional, nên không có đường nào gửi đi một request không khai báo:

  ```ts
  export const resolveRequestLocale = (): Locale => { /* … */ }
  ```

  Đây là chỗ luật tự đặt mình vào thế khó và nói ra: trên nhánh đó, giá trị được khai báo **không đến
  từ người đọc**. Xem `audit.md`.

- **"Nội dung chưa dịch nên trả tiếng mặc định" là chuyện của server.** Nó là một quyết định fallback
  nội dung, hợp lệ, và nó chỉ có nghĩa khi request đã khai báo. Không khai báo thì server không có gì
  để fallback **từ đó**.

---

## `LOCALE-5` — một chỗ viết header

### Case: ai viết header

ĐÚNG — một link, một câu:

```ts
export const createAttachLocaleLink = ({ getLocale = resolveRequestLocale }: Params = {}) =>
    new ApolloLink((operation, forward) => {
        const locale = getLocale()
        operation.setContext((previous) => ({
            headers: { ...previous.headers, "x-locale": locale },
        }))
        return forward(operation)
    })
```

SAI — câu trả lời thứ hai, nằm ở một file sẽ không được cập nhật cùng với file thứ nhất:

```ts
const result = await queryDocument({ request, headers: { "x-locale": "vi" } })
```

Khác nhau đúng một điều: bao nhiêu chỗ phải cùng đồng ý thì câu trả lời mới đúng.

### Case: hằng số ngôn ngữ ở tầng gọi

SAI — một hook được "vá nhanh" cho kịp release:

```ts
export const useQueryLessonSwr = ({ id }: Params) =>
    useSWR(["lesson", id], () => queryLesson({ request: { id }, headers: { "x-locale": "vi" } }))
```

ĐÚNG — hook không biết gì về ngôn ngữ, và đó là điểm mạnh của nó:

```ts
export const useQueryLessonSwr = ({ id }: Params) =>
    useSWR(["lesson", id], () => queryLesson({ request: { id } }))
```

Hậu quả điển hình của bản SAI không phải là hook đó sai, mà là hook đó **đúng** trong khi phần còn
lại của bề mặt nằm ở ngôn ngữ mặc định — trạng thái khó chẩn đoán nhất, vì đã có sẵn một bằng chứng
cho thấy "chỗ này làm được mà".

### Case: helper của test đi lạc vào production

SAI — file production import một helper vốn sinh ra để cố định header trong spec:

```ts
import { withFixedLocaleHeaders } from "../../test/helpers"

export const queryFeatured = () => queryDocuments({ headers: withFixedLocaleHeaders("en") })
```

ĐÚNG — spec cố định giá trị qua seam của link, không qua header của call site:

```ts
createAttachLocaleLink({ getLocale: () => "en" })
```

### Ngoại lệ và nhầm lẫn

- **Chính file link locale được viết header đó**, và nó được nhận diện bằng **đường dẫn**, vì cả luật
  lẫn rule đều cần một cái tên để chỉ vào:

  ```text
  src/modules/api/graphql/clients/links/locale.ts
  ```

- **Một chuỗi header nằm trong test là chuyện khác.** Spec khẳng định về header thay vì viết ra một
  header thứ hai cho production:

  ```ts
  expect(new Headers(init?.headers).get("x-locale")).toBe("vi")
  ```

- **Vừa set header vừa nhận `locale` qua tham số thì vi phạm hai mã.** Ghi cả `LOCALE-2` lẫn
  `LOCALE-5`, đừng chọn một:

  ```ts
  // SAI hai lần
  export const queryDocument = ({ displayId, locale }: Params) =>
      request({ displayId }, { headers: { "x-locale": locale } })
  ```

---

## Ánh xạ yêu cầu sang một quyết định

Nêu lời gọi, chain nó đi qua, và nguồn của giá trị. Nếu thiếu **một** dữ kiện quyết định, hỏi **một**
câu cụ thể rồi dừng. Câu trả lời phải là một quyết định hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Thêm client mới cho tính năng upload" | Chain mới chạm mạng thì chain mới phải khai báo | `LOCALE-1` | Đặt link locale vào chain, trước link terminal |
| "Chỉ gắn ngôn ngữ khi người dùng đã đăng nhập cho nhẹ" | Khách vãng lai cũng đọc bằng một ngôn ngữ | `LOCALE-1` | Từ chối; gắn vô điều kiện |
| "Truyền `locale` xuống hook để cache đúng" | Tham số là thứ người sau bỏ sót, và bỏ sót không báo lỗi | `LOCALE-2` | Từ chối; link đọc địa chỉ |
| "Trang này đổi ngôn ngữ mà không đổi URL" | Đây là một quyết định sản phẩm, không phải một chi tiết cài đặt | `LOCALE-2` | Dừng, nêu ra để quyết; đừng lén thêm tham số |
| "Server đọc cookie ngôn ngữ rồi mà" | API khác origin, đường ẩn danh không gửi cookie | `LOCALE-3` | Gửi header |
| "Bật credentials để cookie đi cùng" | Kéo một phạm vi bảo mật khác vào chỉ để mang một giá trị | `LOCALE-3` | Từ chối; header là phương tiện |
| "Không khai báo cũng ra nội dung đúng mà" | Người test đang đọc đúng ngôn ngữ mặc định | `LOCALE-4` | Kiểm header, đừng kiểm câu trả lời |
| "Fallback của server lo phần còn lại" | Biến một header thiếu thành quyết định sản phẩm ngầm | `LOCALE-4` | Khai báo trên mọi request |
| "Vá nhanh một hook cho kịp release" | Câu trả lời thứ hai sẽ phân kỳ ở lần sửa đầu tiên | `LOCALE-5` | Để link giữ header |
| "Spec cần cố định ngôn ngữ" | Seam của link là chỗ cố định, không phải header của call site | `LOCALE-5` | Truyền hàm resolve trong spec |

Câu hỏi phân định **chỉ** được hỏi khi dữ kiện thật sự thiếu:
*"Người đọc ở ngôn ngữ khác có nhận về dữ liệu khác từ lời gọi này không?"*

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định |
|---|---|
| `LOCALE-1` / `LOCALE-5` | Đang **thiếu** một chỗ khai báo, hay đang **thừa** một chỗ? |
| `LOCALE-1` / `LOCALE-2` | Chain có link locale chưa, và nếu có thì link đó lấy giá trị từ đâu? |
| `LOCALE-2` / `LOCALE-3` | Cookie đang được dùng làm **nguồn đọc** ở client, hay làm **phương tiện** sang server? |
| `LOCALE-3` / `LOCALE-4` | Vấn đề là giá trị **không đi tới được**, hay là câu trả lời mặc định **được chấp nhận**? |
| `LOCALE-4` / mọi mã khác | Câu trả lời đúng vì request đã làm rõ, hay vì tôi tình cờ đọc đúng ngôn ngữ mặc định? |
| `LOCALE-5` / `LOCALE-2` | Call site đang **viết** header, hay đang **nhận** ngôn ngữ qua tham số? Nếu cả hai, ghi cả hai mã |

## Sai lầm lặp lại nhiều nhất

1. Copy một chain cũ để làm chain mới, rồi thêm locale vào chain cũ mà quên bản copy.
2. Đặt việc gắn locale sau cờ `withAuth`, làm mất ngôn ngữ ở đúng phần công khai.
3. Truyền `locale` xuống hook và tin rằng như thế là "đã hỗ trợ đa ngôn ngữ".
4. Đọc đoạn đầu của URL bằng một hàm narrow trả về default, rồi tưởng đó là lựa chọn của người đọc.
5. Trông cậy vào cookie để mang ngôn ngữ sang một API khác origin.
6. Bật credentials cho đường ẩn danh chỉ để cứu cookie đó.
7. Kết luận "fallback hoạt động" từ một phép thử chạy ở đúng ngôn ngữ mặc định.
8. Set header ngôn ngữ tại một call site để vá nhanh một trang, rồi để lại hai câu trả lời.
9. Biến seam dành cho test thành tham số của production.
10. Kiểm status 200 và gọi đó là bằng chứng về ngôn ngữ.
