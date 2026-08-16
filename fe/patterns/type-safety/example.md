---
id: fe-patterns-type-safety-example
title: example.md
slug: /fe/patterns/type-safety/example
sidebar_label: example.md
sidebar_position: 2
description: Tất cả case và ngoại lệ của từng mã TYPE-SAFETY-N, viết bằng TS/TSX thuần.
---

# example.md

> Version: `2.00` · Module: `type-safety` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript và TSX thường**. Không tên sản phẩm, không tên thư viện thật:
những chỗ cần một vendor thì import từ `@vendor/*` — một module giữ chỗ. Một luật chỉ đúng khi nó
đúng ở bất kỳ front end nào, nên nếu một ví dụ cần tên riêng của một sản phẩm mới đọc được thì ví dụ
đó nằm sai chỗ.

Mỗi mã có **nhiều case**, từng case đặt **ĐÚNG** cạnh **SAI**, sau đó là mục **ngoại lệ và nhầm lẫn**.
Phần cuối trang ánh xạ từ một yêu cầu bằng lời sang một mã duy nhất.

---

## `TYPE-SAFETY-1` — cast xuyên `unknown`

### Case: body của response

```ts
// SAI
const load = async (): Promise<ResumeRow> => {
    const response = await fetch("/api/resume")
    return await response.json() as unknown as ResumeRow
}
```

```ts
// ĐÚNG
const load = async (): Promise<ResumeRow | undefined> => {
    const response = await fetch("/api/resume")
    const payload: unknown = await response.json()
    return isResumeRow(payload) ? payload : undefined
}
```

Hai đoạn khác nhau đúng một điều: còn ai kiểm rằng payload đúng là thứ nó tự nhận hay không. Ở đoạn
đầu, ngày server bỏ một field, dòng `fetch` vẫn xanh và ứng dụng vỡ ở một component cách đó bốn tầng.

### Case: giá trị đọc từ storage

```ts
// SAI
const draft = JSON.parse(window.localStorage.getItem("draft") ?? "{}") as unknown as DraftState
```

```ts
// ĐÚNG
const raw: unknown = JSON.parse(window.localStorage.getItem("draft") ?? "{}")
const draft: DraftState | undefined = isDraftState(raw) ? raw : undefined
```

`localStorage` là bộ nhớ của **phiên bản trước** của ứng dụng này. Không có biên nào mà kiểu ít đáng
tin hơn chỗ đó, và cũng không có biên nào mà `as unknown as` được dùng nhiều hơn.

### Case: kiểu vendor khai hẹp hơn thực tế

```ts
// SAI
import type { WidgetConfig } from "@vendor/widget"

const config = { theme: "dark", density: "compact" } as unknown as WidgetConfig
```

```ts
// ĐÚNG
import type { WidgetConfig } from "@vendor/widget"

/**
 * The vendor type omits `density`, which its runtime reads. Declared here as the extension it
 * actually is, so the day the vendor adds the field this line stops compiling instead of drifting.
 */
type WidgetConfigWithDensity = WidgetConfig & { readonly density: "compact" | "cosy" }

const config: WidgetConfigWithDensity = { theme: "dark", density: "compact" }
```

Khai một extension có tên nói được điều đang xảy ra: kiểu vendor thiếu một field. Cast xuyên `unknown`
thì không nói được gì cả — nó chỉ nói "đừng hỏi".

### Case: cast một hình dạng sang một hình dạng khác hẳn

```ts
// SAI
const toSummary = (detail: CourseDetail): CourseSummary =>
    detail as unknown as CourseSummary
```

```ts
// ĐÚNG
const toSummary = (detail: CourseDetail): CourseSummary => ({
    id: detail.id,
    title: detail.title,
    lessonCount: detail.modules.reduce((total, module) => total + module.lessons.length, 0),
})
```

Nếu phải đi vòng qua `unknown` để hai kiểu chịu nhau, thì chúng **không chung gì cả** — nghĩa là đây
là một phép biến đổi, và phép biến đổi thì phải viết ra.

### Ngoại lệ và nhầm lẫn

- **Cast đi *vào* `unknown` không phải mã này.** Nó đi ngược chiều: từ một kiểu không đáng tin sang
  một kiểu không dùng được nếu chưa kiểm.

  ```ts
  // ĐÚNG - mở rộng ra `unknown` rồi mới thu hẹp
  const parsed = parseSnapshot(await response.json() as unknown)
  ```

- **Cast một tầng không phải mã này** — nó thuộc `TYPE-SAFETY-5`, và điều kiện là mang lý do.
- **Trong `.test.`/`.spec.` thì đây là `TYPE-SAFETY-4`**, không phải lỗi.
- **Một comment không cứu được cast xuyên `unknown`:**

  ```ts
  // SAI - lý do đúng, hành động vẫn là xoá kiểu
  // The server always sends this shape.
  const row = payload as unknown as ResumeRow
  ```

  Nếu server **luôn** gửi hình dạng đó thì hãy viết cái guard khẳng định điều ấy. Một câu văn không
  làm cho việc kiểm quay lại.

---

## `TYPE-SAFETY-2` — `any`

### Case: giá trị trả về của một hàm biên

```ts
// SAI
const fetchProfile = async (id: string): Promise<any> => {
    const response = await fetch(`/api/profiles/${id}`)
    return await response.json()
}
```

```ts
// ĐÚNG
const fetchProfile = async (id: string): Promise<unknown> => {
    const response = await fetch(`/api/profiles/${id}`)
    return await response.json()
}
```

Khác biệt không nằm ở dòng này, mà ở **mọi dòng phía sau**. Với `any`, `profile.displayName.trim()`
biên dịch được, kể cả khi `displayName` không tồn tại. Với `unknown`, nó không biên dịch được cho tới
khi có người kiểm — và người ấy sẽ kiểm ở chỗ nhìn thấy được.

### Case: `any` lan qua ba file

```ts
// SAI - api/client.ts
export const request = async (path: string): Promise<any> => (await fetch(path)).json()

// SAI - hooks/useProfile.ts  (không hề nhắc tới `any`)
export const useProfile = (id: string) => {
    const [profile, setProfile] = useState(undefined)
    useEffect(() => { void request(`/profiles/${id}`).then(setProfile) }, [id])
    return profile
}

// SAI - components/ProfileName.tsx  (cũng không hề nhắc tới `any`)
export const ProfileName = ({ id }: { readonly id: string }) => {
    const profile = useProfile(id)
    return <span>{profile.displayName}</span>
}
```

```ts
// ĐÚNG - api/client.ts
export const request = async (path: string): Promise<unknown> => (await fetch(path)).json()

// ĐÚNG - modules/profile/parse.ts  - việc thu hẹp có một chỗ ở, và chỗ đó có tên
export const parseProfile = (raw: unknown): Profile | undefined =>
    isRecord(raw) && typeof raw.displayName === "string"
        ? { displayName: raw.displayName }
        : undefined
```

File thứ ba là toàn bộ luận điểm của mã này. Nó **không viết chữ `any` nào**, nó đọc như một file có
kiểu đầy đủ, và nó vẫn là chỗ ứng dụng nổ. Một cast dừng ở dòng của nó; `any` thì không dừng ở file
của nó.

### Case: `Record<string, any>` trong một kiểu dữ liệu

```ts
// SAI
type ChartData = {
    readonly series: Array<{ readonly name: string; readonly points: Record<string, any> }>
}
```

```ts
// ĐÚNG
type ChartPoint = { readonly x: number; readonly y: number }

type ChartData = {
    readonly series: Array<{ readonly name: string; readonly points: Array<ChartPoint> }>
}
```

`Record<string, any>` thường có nghĩa là "tôi chưa ngồi xuống nghĩ xem trong đó có gì". Đó là một
việc chưa làm, không phải một kiểu.

### Case: biến `catch`

```ts
// SAI
try {
    await submit(values)
} catch (error: any) {
    setMessage(error.response.data.message)
}
```

```ts
// ĐÚNG
try {
    await submit(values)
} catch (error: unknown) {
    setMessage(messageOf(error) ?? t("errors.unexpected"))
}

/** A message only when the thrown value actually carries one; anything may be thrown. */
const messageOf = (error: unknown): string | undefined =>
    error instanceof Error ? error.message : undefined
```

`throw` nhận **bất kỳ giá trị nào**, kể cả một chuỗi hay `undefined`. `error.response.data.message`
là ba lần đoán liên tiếp trên một giá trị mà ngôn ngữ không hứa hẹn gì cả — và nó nổ đúng lúc đang
xử lý một lỗi khác, tức lúc tệ nhất.

### Ngoại lệ và nhầm lẫn

- **`unknown` không phải `any` viết dài hơn.** `unknown` cấm mọi thao tác cho tới khi có kiểm; đó
  chính là giá trị của nó.

  ```ts
  const value: unknown = JSON.parse(raw)
  // value.name        <- không biên dịch, và đó là điều đúng
  ```

- **Generic không phải `any`.** Chỗ nào chỉ cần "kiểu nào cũng được, nhưng bảo toàn kiểu ấy" thì
  đó là một tham số kiểu:

  ```ts
  // SAI
  const first = (items: Array<any>): any => items[0]
  // ĐÚNG
  const first = <T,>(items: Array<T>): T | undefined => items[0]
  ```

- **`any` trong một `.d.ts` của vendor không phải lỗi của file này**, nhưng nó **lan vào** file này.
  Chặn nó ở biên:

  ```ts
  import { legacyWidget } from "@vendor/legacy" // khai trả về `any`

  /** The vendor declares `any`; stop it at this line rather than letting it travel. */
  const widget: unknown = legacyWidget()
  ```

- **`any` không được cứu bằng một lý do**, vì lý do đứng ở một dòng còn `any` thì đi tiếp.

---

## `TYPE-SAFETY-3` — một cách viết cho mảng

### Case: kiểu dữ liệu của một component

```ts
// SAI
type CourseListData = {
    readonly courses: CourseSummary[]
    readonly tags: readonly string[]
}
```

```ts
// ĐÚNG
type CourseListData = {
    readonly courses: Array<CourseSummary>
    readonly tags: ReadonlyArray<string>
}
```

### Case: kiểu phần tử tự nó đã generic

```ts
// SAI
const buckets: Map<string, Set<number>>[] = []
```

```ts
// ĐÚNG
const buckets: Array<Map<string, Set<number>>> = []
```

Ở dạng hậu tố, cặp ngoặc nói "đây là một mảng" bị đẩy ra tận cuối, sau khi mắt đã phải giải xong hai
tầng generic khác. Đây là lý do luật chọn dạng generic chứ không phải ngược lại.

### Case: hai cách viết trong cùng một file

```ts
// SAI - cùng một file, hai cách viết
type Module = { readonly lessons: Lesson[] }
type Course = { readonly modules: Array<Module> }
```

```ts
// ĐÚNG
type Module = { readonly lessons: Array<Lesson> }
type Course = { readonly modules: Array<Module> }
```

Không ai viết đoạn trên một cách cố ý. Nó xuất hiện vì hai người sửa hai lần, và **không có thứ gì
sửa cách viết thứ hai**. Đó là toàn bộ lý do đây là một luật.

### Ngoại lệ và nhầm lẫn

- **Tuple không phải mảng.** `[number, number]` là một tuple; luật này không đụng tới nó.

  ```ts
  // ĐÚNG - tuple bảo toàn
  const bounds: readonly [number, number] = [0, 100]
  ```

- **Rest parameter giữ cú pháp của ngôn ngữ**, nhưng kiểu của nó vẫn viết dạng generic:

  ```ts
  type Handler = (...args: Array<never>) => void
  ```

- **Đây là mã duy nhất trong module không nói về việc tắt kiểm.** Không có gì bị xoá; hệ kiểu vẫn
  làm việc. Nó ở đây vì cùng một lý do gốc: thứ không có ai sửa thì sẽ trôi.

---

## `TYPE-SAFETY-4` — test dựng giá trị sai, và đó là việc của nó

### Case: fake một operation của transport link

```ts
// ĐÚNG - links/bearer.test.ts
import type { TransportOperation } from "@vendor/transport"

/** A fake operation that records the context updates the link applies to it. */
const fakeOperation = (): TransportOperation => {
    let context: Record<string, unknown> = {}
    const operation = {
        operationName: "PlatformStats",
        getContext: () => context,
        setContext: (update: Record<string, unknown>) => { context = { ...context, ...update } },
    }
    return operation as unknown as TransportOperation
}
```

```ts
// SAI - links/bearer.ts  (cùng một dòng, trong file sản phẩm)
const emptyOperation = (): TransportOperation => ({} as unknown as TransportOperation)
```

Hai đoạn khác nhau đúng một điều: **dựng giá trị sai có phải việc của file này hay không**. File test
đang chứng minh rằng link gắn header đúng cách kể cả khi operation chỉ có ba method; file sản phẩm
đang tạo ra một giá trị mà phần còn lại của chương trình sẽ tin.

### Case: bỏ một field bắt buộc để kiểm nhánh phòng thủ

```ts
// ĐÚNG - mutations/types/auth.test.ts
it("treats a challenge without an expiry as already expired", () => {
    const challenge = {
        challengeId: "c-1",
        // `expiresAt` deliberately absent: this is exactly the payload the guard must survive.
    } as unknown as SignInChallengeData

    expect(isChallengeUsable(challenge)).toBe(false)
})
```

```ts
// SAI - cùng file test, nhưng cast vì lười chứ không vì chứng minh
const challenge = {
    challengeId: "c-1",
} as unknown as SignInChallengeData

it("returns the challenge id", () => {
    expect(challenge.challengeId).toBe("c-1")   // không có gì đang được chứng minh về giá trị sai
})
```

Đoạn thứ hai **không có gì báo cáo nó** — miễn trừ là một đường dẫn, và đường dẫn không phân biệt
được động cơ. Đó là giới hạn đã biết của mã này, ghi ở `audit.md`.

### Case: mock một module vendor bằng những mảnh tối thiểu

```tsx
// ĐÚNG - shells/DrawerShell/index.test.tsx
import type * as Vendor from "@vendor/overlay"

type PartProps = { readonly children?: ReactNode }

// Keep the vendor's type imported so the mock below stays checked against the real module shape.
void (undefined as unknown as typeof Vendor)

vi.mock("@vendor/overlay", () => {
    const DrawerRoot = (input: PartProps) => <div>{input.children}</div>
    DrawerRoot.Content = (input: PartProps) => <div data-testid="drawer-content">{input.children}</div>
    return { Drawer: DrawerRoot }
})
```

### Ngoại lệ và nhầm lẫn

- **File test không tự động sạch.** Miễn trừ nói: dựng giá trị sai ở đây không phải lỗi. Nó **không**
  nói mọi cast trong test đều đúng.
- **Fixture đúng kiểu thì đừng cast.** Nếu giá trị hợp lệ, hãy khai nó:

  ```ts
  // SAI
  const row = { id: "1", title: "Graphs" } as unknown as CourseSummary
  // ĐÚNG
  const row: CourseSummary = { id: "1", title: "Graphs", lessonCount: 12 }
  ```

- **Một helper dùng chung nằm ngoài `.test.` thì mất miễn trừ**, kể cả khi chỉ test gọi nó:

  ```ts
  // SAI - test/fixtures/course.ts  (không khớp `.test.`/`.spec.`, nên vẫn bị chi phối)
  export const brokenCourse = {} as unknown as CourseSummary
  ```

  Đặt nó trong file test đang dùng nó, hoặc đặt tên file theo đúng dạng miễn trừ. Đây là cái giá của
  một miễn trừ dựa trên đường dẫn, và là cái giá luật này cố ý trả.

---

## `TYPE-SAFETY-5` — cast sống sót mang theo lý do

### Case: cast không có lý do, tại một biên

```ts
// SAI
const payload = await response.json() as SitemapCoursesResponse
return payload.data.courses.map((course) => course.displayId)
```

```ts
// ĐÚNG
const payload: unknown = await response.json()
if (!isSitemapCoursesResponse(payload)) return []
return payload.data.courses.map((course) => course.displayId)
```

Cast một tầng ở đây không bị rule nào báo cáo — và đó chính là lý do mã này tồn tại. Câu duy nhất
viết được bên cạnh nó là "vì nếu không thì TypeScript kêu", mà đó là trình biên dịch đang nói một
điều **đúng**: không ai biết body ấy có hình dạng gì.

### Case: cast có lý do, và vẫn còn kiểm sau đó

```ts
// ĐÚNG
/** Decode only the public expiry claim; token verification remains the server's job. */
const expiresAt = (token: string): number | undefined => {
    const encoded = token.split(".")[1]
    if (encoded === undefined) return undefined
    const payload = JSON.parse(window.atob(encoded)) as { exp?: unknown }
    return typeof payload.exp === "number" ? payload.exp * 1000 : undefined
}
```

Cast này sống sót vì ba lý do đọc được ngay trên màn hình: nó **chỉ mở đúng một field**, field ấy vẫn
là `unknown` nên vẫn phải kiểm, và câu bên trên làm rõ phần nào của việc kiểm **không** thuộc về
client. Cast mở đủ chỗ để kiểm, chứ không thay cho kiểm.

### Case: implementation của một factory có overload

```ts
// ĐÚNG
/**
 * Bind either checked named slots or one real component type to an exact contract identity.
 * The overloads above are the checked surface; this implementation is deliberately wider than any
 * one of them, which is what the assertion states.
 */
export const defineContractComponent = ((contract: ContractKey, input: unknown) => {
    if (typeof input === "function") return { kind: "component" as const, contract, render: input }
    return { kind: "slots" as const, contract, slots: input }
}) as DefineContractComponent
```

```ts
// SAI - cùng cú pháp, không có tập overload nào phía trên
export const defineContractComponent = ((contract: string, input: unknown) => ({
    contract,
    input,
})) as DefineContractComponent
```

Đoạn dưới cast vào một kiểu **không phải** tập overload của chính nó. Không có bề mặt nào đang được
kiểm cả; chỉ có một cái tên được dán vào.

### Case: lý do nói lại chính cast

```ts
// SAI
// Cast the response to the course type.
const course = payload as CourseSummary
```

```ts
// ĐÚNG
// The list endpoint returns the summary projection; the detail fields are fetched separately.
const course = payload as CourseSummary
```

Lý do phải nói về **điều được bảo đảm**, không nói lại điều dòng code đã nói. Đoạn trên là comment
duy nhất mà một rule "phải có comment" sẽ chấp nhận — và đó là lý do không viết rule ấy.

### Ngoại lệ và nhầm lẫn

- **Lý do không nâng cấp được một cast xuyên `unknown`:**

  ```ts
  // SAI - lý do đúng, hành động vẫn thuộc `TYPE-SAFETY-1`
  // The runtime guarantees this shape.
  const row = payload as unknown as ResumeRow
  ```

- **`as const` không phải cast theo nghĩa của mã này.** Nó **thu hẹp** kiểu chứ không xoá gì:

  ```ts
  const modes = ["read", "write"] as const
  ```

- **Cast trong test không cần xin phép** — đó là `TYPE-SAFETY-4`.
- **Không viết được lý do thì bỏ cast**, và sửa hình dạng. Đó là kết cục thường gặp nhất của phép thử
  này, và là lý do nó đáng giá.

---

## Ánh xạ yêu cầu sang một mã

Nêu file, nguồn gốc của giá trị và hình dạng của việc xoá kiểu. Nếu thiếu **một** dữ kiện quyết định,
hỏi **một** câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Nhận response rồi trả về đúng kiểu này cho tôi" | Giá trị từ ngoài vào, chưa ai kiểm | `TYPE-SAFETY-1` | `unknown` + type guard |
| "Cho tạm `any` chỗ này, mai sửa" | Việc xoá kiểu sẽ đi theo giá trị sang file khác | `TYPE-SAFETY-2` | `unknown`, thu hẹp ở một chỗ có tên |
| "Bắt lỗi rồi lấy `error.response.data.message`" | `throw` nhận mọi giá trị | `TYPE-SAFETY-2` | `catch (error: unknown)` + `instanceof` |
| "Khai một mảng khoá học" | Một thứ một cách viết | `TYPE-SAFETY-3` | `Array<CourseSummary>` |
| "Viết test chứng minh API từ chối payload thiếu field" | Dựng giá trị sai chính là thứ đang chứng minh | `TYPE-SAFETY-4` | cast trong `.test.`, kèm câu làm rõ đang canh gì |
| "Kiểu vendor thiếu field mà runtime luôn gửi" | Biên thật, lý do viết ra được | `TYPE-SAFETY-5` | cast một tầng + mệnh đề lý do, hoặc một type extension có tên |
| "Ép cái này thành kiểu kia cho nó hết đỏ" | Lỗi là trình biên dịch đang nói một điều đúng | `TYPE-SAFETY-1` | sửa hình dạng, hoặc viết phép biến đổi |
| "Widen giá trị này ra `unknown` trước khi parse" | Đi ngược chiều xoá kiểu | *không mã nào* | hợp lệ, không cần xin phép |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `TYPE-SAFETY-1` / `TYPE-SAFETY-2` | Việc xoá kiểu dừng lại ở dòng này, hay đi theo giá trị sang chỗ khác? |
| `TYPE-SAFETY-1` / `TYPE-SAFETY-4` | File này có phải `.test.`/`.spec.` không? Chỉ đường dẫn quyết định, không phải ý định. |
| `TYPE-SAFETY-1` / `TYPE-SAFETY-5` | Cast có đi xuyên `unknown` không? Nếu có thì không có lý do nào cứu được. |
| `TYPE-SAFETY-2` / `TYPE-SAFETY-5` | Thứ bị xoá là **một dòng** hay **một kiểu**? Lý do chỉ biện hộ được cho một dòng. |
| `TYPE-SAFETY-4` / mọi mã khác | Giá trị sai có phải chính là thứ đang được chứng minh không? |
| `TYPE-SAFETY-5` / không mã nào | Lý do viết ra thành một câu được không, và câu ấy có nói về điều được bảo đảm không? |

## Sai lầm lặp lại nhiều nhất

1. Cast để làm hết đỏ, ngay tại biên — chỗ duy nhất không có ai bắt lại giúp.
2. Dùng `any` cho "tạm thời", rồi nó đi qua ba file và nổ ở file thứ tư không hề nhắc tới nó.
3. `catch (error: any)` rồi đọc ba tầng property trên một giá trị mà ngôn ngữ không hứa gì.
4. Viết một comment cạnh cast xuyên `unknown` và tưởng rằng đã đủ.
5. `T[]` lẫn `Array<T>` trong cùng một file, vì không có ai sửa cách viết thứ hai.
6. Đặt fixture cast sẵn ra một file `fixtures/` ngoài `.test.`, làm mất miễn trừ.
7. Cast trong test vì lười, nấp sau miễn trừ vốn dành cho việc chứng minh.
8. `Record<string, any>` thay cho một kiểu chưa ai ngồi xuống viết.
