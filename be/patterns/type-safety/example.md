---
id: be-patterns-type-safety-example
title: example.md
slug: /be/patterns/type-safety/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã TYPE-N, viết bằng TypeScript thường trong một ứng dụng dạng NestJS.
---

# example.md

> Version: `2.00` · Module: `type-safety` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường trong một ứng dụng có cấu trúc kiểu NestJS**. Không tên sản phẩm,
không tên repository, không tên khoá học. Một luật chỉ đúng khi nó đúng ở bất kỳ back end nào — nên
nếu một ví dụ cần tên riêng của một hệ thống cụ thể mới đọc được, ví dụ đó đứng sai chỗ.

Mỗi mã có **nhiều case**; trong mỗi case, bản **ĐÚNG** được đặt cạnh **SAI**, rồi tới mục **Ngoại lệ và nhầm lẫn**.
Phần cuối trang ánh xạ từ một yêu cầu bằng lời sang đúng một mã.

---

## `TYPE-1` — không `any`, thu hẹp từ `unknown`

### Case: parse một payload đi vào từ mạng

ĐÚNG — hình dạng chưa biết vào bằng `unknown`, và **giả định được viết ra thành code**:

```ts
/** Payload tối thiểu mà handler này cần đọc được. */
export interface WebhookPayload {
    event: string
    reference: string
}

/**
 * Narrow một body chưa kiểm chứng thành {@link WebhookPayload}.
 * @param raw - Body thô, chưa được validate.
 * @throws WebhookPayloadInvalidException khi body không mang đủ hai field bắt buộc.
 */
export const parseWebhookPayload = (raw: unknown): WebhookPayload => {
    if (typeof raw !== "object" || raw === null) {
        throw new WebhookPayloadInvalidException({})
    }
    const candidate = raw as Record<string, unknown>
    if (typeof candidate.event !== "string" || typeof candidate.reference !== "string") {
        throw new WebhookPayloadInvalidException({})
    }
    return {
        event: candidate.event,
        reference: candidate.reference,
    }
}
```

SAI — cùng một hàm, nhưng mọi dòng phía sau nó không còn được kiểm tra:

```ts
export const parseWebhookPayload = (raw: any): WebhookPayload => raw
```

Hai bản khác nhau đúng một điều: **giả định có được viết ở chỗ người đọc tìm thấy không.** Bản dưới
vẫn "chạy đúng" với mọi payload hợp lệ, và im lặng tuyệt đối với payload không hợp lệ.

### Case: `catch` quanh một lệnh gọi ra ngoài

ĐÚNG — `unknown` là kiểu thật của một giá trị bị ném:

```ts
/**
 * Chuẩn hoá một giá trị bị ném thành chuỗi log ngắn.
 * @param error - Giá trị bắt được; JavaScript cho phép ném bất cứ thứ gì.
 */
export const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message
    }
    return String(error)
}
```

SAI — `any` ở đây mua được một dòng ngắn và bán đi mọi kiểm tra phía sau:

```ts
try {
    await this.gatewayService.charge(params)
} catch (error: any) {
    // `error.response.data.message` không được kiểm tra gì cả; ba tầng đều có thể undefined
    this.winstonService.error(WinstonLog.ChargeFailed, {
        reason: error.response.data.message,
    })
}
```

Bản SAI hỏng ở một chỗ rất khó truy: nếu provider trả về một lỗi mạng thuần (không có `response`),
chính khối `catch` sẽ ném ra một `TypeError` mới, **đè lên** lỗi thật, và log ghi lại một sự kiện
không hề xảy ra.

### Case: đọc một cột jsonb đã lưu

ĐÚNG — dữ liệu cũ trong cột là một biên giới, đúng nghĩa như biên giới mạng:

```ts
/**
 * Đọc snapshot cấu hình đã lưu, chấp nhận cả những row ghi từ phiên bản cũ.
 * @param stored - Giá trị thô từ cột jsonb.
 */
export const readRetryPolicy = (stored: unknown): RetryPolicy => {
    if (typeof stored !== "object" || stored === null) {
        return DEFAULT_RETRY_POLICY
    }
    const candidate = stored as Record<string, unknown>
    const attempts = typeof candidate.attempts === "number" ? candidate.attempts : undefined
    return {
        attempts: attempts ?? DEFAULT_RETRY_POLICY.attempts,
    }
}
```

SAI — `any` biến một row ghi từ hai năm trước thành một quả mìn hẹn giờ:

```ts
export const readRetryPolicy = (stored: any): RetryPolicy => ({
    attempts: stored.attempts,
})
```

### Ngoại lệ và nhầm lẫn

- **`as Record<string, unknown>` là một cast đơn, không phải double cast.** Nó nới từ `unknown`
  xuống một hình dạng vẫn còn `unknown` ở mọi lá — nên mọi property đọc ra **vẫn phải** được kiểm.
  Nó là bước đi hợp lệ **giữa** `unknown` và guard, không phải chỗ dừng.

- **Thu hẹp một lần, không phải thu hẹp mỗi lần dùng.** Bản dưới lặp lại đúng một giả định ở bốn
  chỗ, và ngày nó sai thì nó sai ở bốn chỗ:

  ```ts
  // SAI: cùng một giả định được viết lại mỗi lần cần đến
  const eventName = (raw as Record<string, unknown>).event as string
  const reference = (raw as Record<string, unknown>).reference as string
  ```

- **`unknown` ở generic argument cũng vẫn là `unknown`.** `Promise<any>` tắt kiểm tra cho mọi thứ
  `await` ra được, và nó không hiện lên như một chữ `any` ở chỗ người ta đọc.

  ```ts
  // SAI
  const fetchProfile = (): Promise<any> => this.httpService.get(url)
  // ĐÚNG
  const fetchProfile = (): Promise<unknown> => this.httpService.get(url)
  ```

---

## `TYPE-2` — không double cast qua `unknown`

### Case: ép một row thô thành entity

SAI — trình biên dịch đã nói hai kiểu không giao nhau, và bị bác bỏ hai lần:

```ts
const rows = await entityManager.query("select id, course_id from enrollments where user_id = $1", [
    userId,
])
// từ đây trở đi mọi thứ tin tuyệt đối rằng đây là một entity đầy đủ
return (rows[0] as unknown as EnrollmentEntity).courseId
```

ĐÚNG — một guard **thật sự kiểm tra** cái mà kiểu tuyên bố:

```ts
/** Row tối thiểu mà truy vấn thô này trả về. */
interface EnrollmentRow {
    id: string
    course_id: string
}

/**
 * Guard cho một row của truy vấn thô ở trên.
 * @param value - Phần tử bất kỳ trong mảng kết quả.
 */
const isEnrollmentRow = (value: unknown): value is EnrollmentRow =>
    typeof value === "object"
    && value !== null
    && typeof (value as Record<string, unknown>).course_id === "string"

const [first] = rows
if (!isEnrollmentRow(first)) {
    throw new EnrollmentRowMalformedException({})
}
return first.course_id
```

Hai bản khác nhau đúng một điều: **có thứ gì thật sự kiểm tra hay không.** Bản trên còn tệ hơn ở
chỗ nó đọc `courseId` trong khi cột tên là `course_id`, và không có gì đỏ lên.

### Case: dựng một collaborator thiếu method — trong code sản phẩm

SAI:

```ts
// trong một service sản phẩm
const noop = {} as unknown as NotificationService
await this.dispatchService.run(noop)
```

ĐÚNG — nếu chỗ đó thật sự không cần gửi gì, hãy nói ra bằng kiểu:

```ts
/** Cổng gửi thông báo tối thiểu mà `run` cần. */
export interface NotificationSink {
    send(params: SendNotificationParams): Promise<void>
}

/** Sink không làm gì, dùng cho luồng chạy khô. */
export const noopNotificationSink: NotificationSink = {
    send: async () => undefined,
}
```

### Case: hai framework, hai kiểu request

SAI — ép request của tầng này thành request của tầng kia:

```ts
const request = context.getArgByIndex(0) as unknown as Request
const token = request.cookies.refreshToken
```

ĐÚNG — khai một hình dạng cấu trúc tối thiểu, đúng bằng phần thật sự đọc tới:

```ts
/**
 * Hình dạng tối thiểu mà việc đọc cookie cần: request của framework HTTP,
 * hoặc túi header mà guard dựng lên. Tồn tại để hai seam không phải double
 * cast một túi header thành một `Request` đầy đủ.
 */
export interface CookieRequestLike {
    cookies?: Record<string, unknown>
    headers?: {
        cookie?: unknown
        [key: string]: unknown
    }
}
```

Đây là hình dạng repair chuẩn của `TYPE-2`: **cast sai bị thay bằng một kiểu đúng và hẹp hơn**, chứ
không phải bằng một cast khéo hơn.

### Ngoại lệ và nhầm lẫn

- **`as unknown` một mình là hợp lệ.** Nó vứt thông tin đi và không nhận thêm gì — chiều hỏng ngược
  lại, và không bị cấm:

  ```ts
  // ĐÚNG: nới rộng ra ngoài trước khi trao cho một API chỉ nhận `unknown`
  const payload = event as unknown
  ```

- **Một cast thu hẹp đơn lẻ là câu hỏi khác.** `raw as EnrollmentEntity` có thể vẫn đáng ngờ, nhưng
  nó **không** thuộc mã này, và rule cũng không bắt nó:

  ```ts
  // Không phải TYPE-2. Là một câu hỏi nhỏ hơn, thuốc khác.
  const row = raw as EnrollmentEntity
  ```

- **Một cặp cast không đi qua `unknown` cũng không thuộc mã này.**

  ```ts
  // Không phải TYPE-2: không có `unknown` ở giữa
  const literal = (value as number) as 1
  ```

- **Rửa kiểu qua hai câu lệnh thì rule không thấy — nhưng luật vẫn thấy.** Đây là chỗ lách phổ biến
  nhất, và nó vi phạm `TYPE-2` đầy đủ:

  ```ts
  // SAI: đúng một hành vi với `raw as unknown as EnrollmentEntity`, chỉ tách làm hai dòng
  const widened: unknown = raw
  const row = widened as EnrollmentEntity
  ```

---

## `TYPE-3` — tham số destructure mang kiểu có tên

### Case: params của một service method

SAI — kiểu viết thẳng tại chữ ký, không ai tham chiếu được:

```ts
export const grantXp = ({ userId, amount }: { userId: string, amount: number }) => {
    // ...
}
```

ĐÚNG — kiểu có tên, đặt trong `types/` của module:

```ts
// src/modules/<module>/types/grant-xp-params.ts
/** Params cho {@link XpService.grant}. */
export interface GrantXpParams {
    /** Người nhận. */
    userId: string
    /** Số điểm cộng thêm; luôn dương. */
    amount: number
}
```

```ts
// src/modules/<module>/xp.service.ts
export const grantXp = ({ userId, amount }: GrantXpParams) => {
    // ...
}
```

### Case: cái mà một cái tên mua được

Đây là phần thường bị bỏ qua khi tranh luận "kiểu inline có sao đâu". Một kiểu có tên **index vào
được**:

```ts
/** Params cho {@link GradingLaneValidationService.validate}. */
export interface ValidateGradingLaneParams {
    /** Người nộp bài; entitlement của họ quyết định model được phép chọn. */
    userId: string
    /** Tên model cụ thể từ picker; vắng mặt thì balancer tự chọn. */
    model?: string
    /** Provider của {@link ValidateGradingLaneParams.model}. */
    provider?: ModelProvider
}
```

```ts
// dòng này là thứ mà kiểu inline không cho phép viết
private resolveProvider(
    provider: NonNullable<ValidateGradingLaneParams["provider"]>,
): ModelDescriptor {
    // ...
}
```

Kiểu inline không có tên để index vào, nên hàm phụ ở trên hoặc phải gõ lại `ModelProvider`, hoặc
phải nhận `string`. Cả hai đều là một bản sao sẽ trôi.

### Case: caller thứ hai, và field thứ ba

Đây là kịch bản hỏng đầy đủ, viết ra để không phải tưởng tượng:

```ts
// file A — viết trước
export const grantXp = ({ userId, amount }: { userId: string, amount: number }) => { /* ... */ }

// file B — viết sau, không import được gì nên gõ lại
export const grantXpFromChallenge = (
    { userId, amount }: { userId: string, amount: number },
) => grantXp({
    userId,
    amount,
})
```

```ts
// ba tháng sau: thêm `reason` để audit log biết XP đến từ đâu
export interface GrantXpParams {
    userId: string
    amount: number
    /** Vì sao XP được cộng; audit log đọc field này. */
    reason: XpReason
}
```

Với kiểu có tên, file B **đỏ lên ngay** ở lần build tiếp theo. Với hai bản sao inline, file B vẫn
xanh, và audit log lặng lẽ mất một nửa số dòng.

### Ngoại lệ và nhầm lẫn

- **Tham số positional không thuộc mã này.** Nó là vấn đề nhỏ hơn (không bị caller thứ hai gõ lại
  theo cùng cách), và rule cố tình không bắt:

  ```ts
  // Không phải TYPE-3
  export const grantXp = (params: { userId: string }) => params.userId
  ```

- **Không có annotation nào thì đó là việc của trình biên dịch, không phải của mã này.**

  ```ts
  // Không phải TYPE-3: `noImplicitAny` mới là thứ trả lời dòng này
  export const grantXp = ({ userId }) => userId
  ```

- **Parameter property vẫn bị tính.** Constructor injection không phải chỗ trú:

  ```ts
  // SAI: `private readonly` bọc ngoài không làm kiểu inline biến mất
  constructor(private readonly { host, port }: { host: string, port: number }) {}
  ```

- **Kiểu inline trong một chữ ký ở vị trí kiểu thì rule không thấy — luật vẫn thấy.**

  ```ts
  // SAI theo luật, nhưng rule không duyệt tới đây
  export interface XpGateway {
      grant(params: { userId: string, amount: number }): Promise<void>
  }
  ```

---

## `TYPE-4` — enum thường, không `const enum`

### Case: một tập hằng bình thường

SAI:

```ts
export const enum OrderStatus {
    Pending = "pending",
    Paid = "paid",
    Refunded = "refunded",
}
```

ĐÚNG:

```ts
/** Trạng thái vòng đời của một đơn hàng. */
export enum OrderStatus {
    /** Đã tạo, chưa nhận được xác nhận thanh toán. */
    Pending = "pending",
    /** Đã nhận xác nhận thanh toán từ cổng. */
    Paid = "paid",
    /** Đã hoàn tiền, một phần hoặc toàn bộ. */
    Refunded = "refunded",
}
```

### Case: hồi phục một giá trị đã lưu

Đây là chỗ `const enum` hỏng đầu tiên, và nó hỏng ngay lần đầu ai đó đọc dữ liệu cũ lên:

```ts
/**
 * Ép một chuỗi thô về một member đã biết, rơi về `Pending` cho mọi giá trị lạ —
 * không bao giờ ném, nên một row cũ hoặc sai định dạng không làm hỏng cả luồng.
 * @param value - Chuỗi trạng thái thô từ database.
 */
export const normalizeOrderStatus = (value: string | null | undefined): OrderStatus => {
    const candidate = value?.trim().toLowerCase()
    const match = Object.values(OrderStatus).find((status) => status === candidate)
    return match ?? OrderStatus.Pending
}
```

`Object.values(OrderStatus)` cần một **object lúc chạy**. Với `const enum` thì không có object nào,
và hàm này **không viết ra được** — không phải "chạy sai", mà là không biên dịch nổi.

### Case: enum được truyền như một giá trị

Đây là bằng chứng mạnh nhất, vì chính bản thân enum là **đối số**:

```ts
/**
 * Ép một scalar thô về một member của enum truyền vào, khớp theo key rồi theo value.
 * @param value - Scalar thô đọc từ front-matter.
 * @param enumObject - Chính enum cần khớp, truyền như một giá trị.
 */
export const toNullableEnum = <TEnum extends Record<string, string | number>>(
    value: unknown,
    enumObject: TEnum,
): TEnum[keyof TEnum] | undefined => {
    const asString = typeof value === "string" ? value.trim() : undefined
    if (!asString) {
        return undefined
    }
    if (asString in enumObject) {
        return enumObject[asString as keyof TEnum]
    }
    return Object.values(enumObject).find((member) => member === asString) as
        | TEnum[keyof TEnum]
        | undefined
}
```

Mọi caller của helper này là một việc mà `const enum` làm cho bất khả thi.

### Ngoại lệ và nhầm lẫn

- **`declare enum` không thuộc mã này.** Khai báo ambient mô tả một thứ đã tồn tại ở nơi khác:

  ```ts
  // Không phải TYPE-4
  declare enum AmbientLogLevel {
      Debug,
      Info,
  }
  ```

- **"Để tiết kiệm bundle" không phải một lý do ở back end.** Đây là một tiến trình chạy trên máy
  chủ; vài byte không phải thứ đang thiếu.

- **Union kiểu chuỗi không phải là bản thay thế cho enum.** Nó không có object lúc chạy đúng như
  `const enum`, nên nó chỉ đúng khi **không có gì** cần duyệt hay map ngược:

  ```ts
  // hợp lệ khi và chỉ khi không nơi nào cần duyệt qua các giá trị này
  export type CacheTier = "memory" | "redis"
  ```

---

## `TYPE-5` — union phân biệt thắng một túi boolean

### Case: kết quả chấm bài

SAI — bốn field, mười sáu tổ hợp, ba trạng thái thật:

```ts
export interface GradeState {
    isPending: boolean
    isGraded: boolean
    isFailed: boolean
    score?: number
}
```

`isGraded && isFailed` biên dịch. `isGraded` mà `score` undefined biên dịch. Không tổ hợp nào trong
hai cái đó tồn tại trong nghiệp vụ, và trình biên dịch chưa từng được cho biết điều đó.

ĐÚNG — union của những trạng thái **có thật**:

```ts
/** Trạng thái chấm của một bài nộp. Trạng thái không tồn tại thì không viết ra được. */
export type GradeState =
    | { kind: "pending" }
    | { kind: "graded", score: number }
    | { kind: "failed", reason: string }
```

Hai bản khác nhau đúng một điều: **một trạng thái không thể xảy ra có viết ra được hay không.**

### Case: cái mà union mua được ở phía đọc

```ts
/**
 * Dòng chữ hiển thị cho một trạng thái chấm.
 * @param state - Trạng thái chấm hiện tại.
 */
export const describeGrade = (state: GradeState): string => {
    switch (state.kind) {
    case "pending":
        return "Đang chờ chấm"
    case "graded":
        // `score` chắc chắn có mặt ở nhánh này — không cần `!`, không cần kiểm tra
        return `Đã chấm: ${state.score}`
    case "failed":
        return `Chấm thất bại: ${state.reason}`
    }
}
```

Thêm một trạng thái thứ tư vào union thì hàm này **đỏ lên** — đó là lời nhắc mà túi boolean không
bao giờ đưa ra.

### Case: một bước đăng nhập trả về hai thứ khác hẳn nhau

```ts
/** Kết quả nội bộ của bước khởi tạo đăng nhập; trạng thái lai không biên dịch. */
export type SignInInitCommandResult =
    | {
        kind: "challenge"
        challengeId: string
        expiresInSeconds: number
    }
    | {
        kind: "session"
        accessToken: string
        refreshToken: string
    }
```

Nếu viết bằng cờ, `challengeId` và `accessToken` cùng optional, và tồn tại một giá trị hợp lệ về mặt
kiểu mang **cả hai** — nghĩa là một phiên đăng nhập vừa chưa xác thực vừa đã xác thực.

### Ngoại lệ và nhầm lẫn

- **Kiểu transport không mang được union.** Một class response đã đăng ký schema chỉ có field
  optional, và điều đó **đúng**: định dạng trên dây không có kiểu tổng. Union sống ở kết quả nội bộ,
  và việc làm phẳng xảy ra một lần, một chỗ:

  ```ts
  /** Payload công khai của bước khởi tạo đăng nhập. */
  export class SignInInitData {
      challengeId?: string
      expiresInSeconds?: number
      accessToken?: string
  }

  /**
   * Làm phẳng kết quả nội bộ thành payload đi trên dây.
   * @param result - Kết quả nội bộ, đã phân biệt bằng `kind`.
   */
  export const toSignInInitData = (result: SignInInitCommandResult): SignInInitData =>
      result.kind === "challenge"
          ? {
              challengeId: result.challengeId,
              expiresInSeconds: result.expiresInSeconds,
          }
          : {
              accessToken: result.accessToken,
          }
  ```

  Điều làm ngoại lệ này **đóng** là: bản phẳng chỉ tồn tại ở biên, và không có handler nào nhận
  `SignInInitData` làm đầu vào để ra quyết định.

- **Nhiều boolean độc lập vẫn là nhiều boolean.** Mã này nói về nhiều cờ mô tả **một** tình huống:

  ```ts
  // ĐÚNG: hai câu hỏi độc lập, hai boolean độc lập
  export interface UserFlags {
      /** Đã xác minh email. */
      isEmailVerified: boolean
      /** Đã bật xác thực hai lớp. */
      isTwoFactorEnabled: boolean
  }
  ```

- **Đừng dùng enum để thay union khi mỗi nhánh mang dữ liệu khác nhau.** Enum cho mình cái tên trạng
  thái, nhưng không gắn được `score` vào riêng nhánh `graded`:

  ```ts
  // SAI: `score` vẫn optional với mọi trạng thái, đúng bài toán cũ
  export interface GradeState {
      status: GradeStatus
      score?: number
  }
  ```

---

## `TYPE-6` — lối thoát khai một lần tại làn

### Case: spec dựng một collaborator thiếu method — hợp lệ

```ts
// user.service.spec.ts
const otpChallengeService = {
    createActionChallenge: jest.fn(),
} as unknown as jest.Mocked<Pick<OtpChallengeService, "createActionChallenge">>
```

Đây **không phải** một vi phạm `TYPE-2` được tha. Nó **nằm ngoài phạm vi** `TYPE-2` ngay từ đầu, vì
lối thoát thuộc về **làn**. Chú ý thứ **không có mặt** ở đây: không một dòng `eslint-disable` nào.

### Case: lối thoát được khai ở đâu

ĐÚNG — một hàm, một lần, mọi chỗ có hiệu lực đều suy ra được từ nó:

```js
/** Họ spec và cây test được phép dựng một giá trị sai cố ý. */
const isTestFile = (filename) => {
    const file = String(filename || "").replace(/\\/g, "/")
    return /\.(?:spec|test|e2e-spec|int-spec|harness-spec)\.ts$/.test(file)
        || file.includes("/src/tests/")
}
```

SAI — cùng một lối thoát, rắc từng dòng, không ai đếm được:

```ts
// eslint-disable-next-line starci-be/no-double-cast
const stub = {} as unknown as PaymentGatewayService
```

### Case: dấu hiệu một làn chưa được khai báo

```ts
// file 1
// eslint-disable-next-line starci-be/no-double-cast
const a = {} as unknown as CacheService
```

```ts
// file 2
// eslint-disable-next-line starci-be/no-double-cast
const b = {} as unknown as CacheService
```

```ts
// file 3
// eslint-disable-next-line starci-be/no-double-cast
const c = {} as unknown as CacheService
```

Ba lần cùng một suppression **không phải** ba quyết định. Đó là **một làn chưa được khai báo**, và
việc phải làm là khai nó một lần — hoặc, nếu ba file này là code sản phẩm, thừa nhận rằng ba file
đang nằm sai làn và cần một kiểu đúng thay vì một lệnh miễn trừ.

### Ngoại lệ và nhầm lẫn

- **Một file sản phẩm cần lối thoát của test nghĩa là file đang sai làn.** Không phải luật sai.
- **Ngoại lệ đóng ≠ suppression.** Ngoại lệ trong `## Ngoại lệ` là một phần của luật, đã nêu rõ phạm
  vi và lý do. Một suppression không nêu gì cả; nó chỉ ghi lại rằng có người đang mệt.
- **Đừng nới rộng làn để nuốt một file.** Đưa `/src/tests/` thành `/src/` sẽ làm mọi test xanh và
  mọi luật biến mất — đó là cách một lối thoát biến thành một cái cửa.

---

## Ánh xạ yêu cầu sang một mã

Nêu giá trị, nguồn gốc và làn. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể rồi
dừng. Câu trả lời phải là một mã hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Việc phải làm |
|---|---|---|---|
| "Nhận body webhook rồi xử lý" | Hình dạng do bên ngoài quyết định | `TYPE-1` | Nhận `unknown`, guard một lần, ném exception có định danh khi sai |
| "SDK khai kiểu sai, tôi ép lại cho nhanh" | Trình biên dịch đang bị bác bỏ hai lần | `TYPE-2` | Khai một interface cấu trúc tối thiểu, đúng bằng phần thật sự đọc tới |
| "Hàm này nhận ba tham số, gộp thành object cho gọn" | Sẽ có caller thứ hai | `TYPE-3` | Đặt tên kiểu, để trong `types/` của module |
| "Thêm một tập trạng thái cho đơn hàng" | Có chỗ sẽ duyệt và map ngược | `TYPE-4` | `enum` thường, kèm một hàm normalize dùng `Object.values` |
| "Bài nộp có thể đang chờ, đã chấm, hoặc lỗi" | Mỗi trạng thái mang dữ liệu khác nhau | `TYPE-5` | Union phân biệt bằng `kind`; `switch` vét cạn ở phía đọc |
| "Spec cần một service giả thiếu method" | Dựng giá trị sai cố ý là mục đích của spec | `TYPE-6` | Dùng lối thoát của làn; **không** thêm suppression từng dòng |
| "Response GraphQL có hai dạng payload" | Định dạng trên dây không mang được kiểu tổng | `TYPE-5` (ngoại lệ) | Union ở kết quả nội bộ, class phẳng ở biên, map một lần |
| "Tôi cần `as unknown` để đưa vào một API chỉ nhận `unknown`" | Nới rộng ra ngoài, không nhận thêm gì | — | Hợp lệ, không thuộc mã nào |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `TYPE-1` / `TYPE-2` | Dòng này **thú nhận** rằng nó không biết, hay **tuyên bố** một kiểu mà không kiểm gì? |
| `TYPE-1` / `TYPE-3` | Sau dòng này trình biên dịch mất kiểm tra, hay chỉ mất một cái tên để import? |
| `TYPE-2` / `TYPE-6` | File này thuộc làn nào? Nếu là spec hoặc test tree thì không thuộc `TYPE-2`. |
| `TYPE-3` / không phải mã nào | Tham số có đang được destructure ngay tại chữ ký không? |
| `TYPE-4` / `TYPE-5` | Mỗi nhánh có mang dữ liệu **riêng** không? Có thì enum không đủ. |
| `TYPE-5` / nhiều boolean độc lập | Các cờ này mô tả **một** tình huống, hay trả lời những câu hỏi độc lập? |
| `TYPE-5` / ngoại lệ transport | Hình dạng này đi trên dây hay xuống ổ đĩa, và có handler nào ra quyết định từ nó không? |

## Sai lầm lặp lại nhiều nhất

1. Gõ `any` trong `catch`, rồi đọc ba tầng property mà không kiểm tra tầng nào.
2. Chèn `unknown` vào giữa để làm im một cast mà trình biên dịch vừa từ chối.
3. Rửa kiểu qua hai câu lệnh (`const widened: unknown = raw`) và tin rằng vì rule không kêu thì
   luật cũng không.
4. Viết kiểu inline trên tham số destructure vì "chỉ có một caller".
5. Thêm `const` vào trước `enum` để "nhẹ hơn", trong một tiến trình chạy trên máy chủ.
6. Mô tả một tình huống bằng ba boolean, rồi viết comment giải thích tổ hợp nào hợp lệ — comment ấy
   chính là kiểu dữ liệu bị viết nhầm chỗ.
7. Dán `eslint-disable` lần thứ ba cho cùng một luật, thay vì nhận ra đó là một làn chưa khai báo.
8. Coi kiểu transport phẳng ở biên là lý do để bỏ luôn union ở kết quả nội bộ.
