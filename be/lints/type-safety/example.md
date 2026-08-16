---
id: be-lints-type-safety-example
title: example.md
slug: /be/lints/type-safety/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng luật lint an toàn kiểu — cái gì bị báo, cái gì không, và cái gì lọt.
---

# example.md

> Version: `2.00` · Mô-đun: `type-safety` · Luật: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi luật có nhiều cặp **SAI** (luật nổ) và **ĐÚNG** (luật im), rồi tới mục **Cửa lách và nhầm lẫn**
mang mã đi lọt.

Đọc mục cuối đó cho kỹ: mã trong đó **không phải mã được phép**. Nó là mã mà luật **không nhìn thấy**.
Hai chuyện đó khác nhau, và nhầm chúng là cách một kệ tài liệu thực thi biến thành một danh sách mẹo
lách.

---

## `no-double-cast`

### SAI — ép kép để dập một lỗi kiểu

```ts
// src/modules/enrollment/enrollment.service.ts
const row = await this.repository.findRawRow(id)
return (row as unknown as EnrollmentEntity).courseId
```

Trình biên dịch đã nói hai kiểu này không giao nhau và bị bác bỏ hai lần. Từ dòng này trở đi, mọi
thứ tin `row` tuyệt đối.

### ĐÚNG — thu hẹp bằng một guard thật sự kiểm

```ts
// src/modules/enrollment/enrollment.service.ts
const row = await this.repository.findRawRow(id)
if (!isEnrollmentEntity(row)) {
    throw new EnrollmentRowShapeInvalidException({ id })
}
return row.courseId
```

### SAI — ép kép trong đối số của một lời gọi

```ts
// src/modules/payment/payment.service.ts
await this.gateway.capture(payload as unknown as CaptureRequest)
```

Không có cổng vị trí nào. Nút nằm ở đâu bộ duyệt cũng thấy.

### SAI — có ngoặc đơn cũng vậy

```ts
// src/modules/payment/payment.service.ts
const request = (payload as unknown) as CaptureRequest
```

Ngoặc đơn không phải một nút trong cây này, nên hai cách viết là **cùng một hình dạng** và cùng bị
báo.

### ĐÚNG — nhận đầu vào là `unknown` rồi phân giải một lần, công khai

```ts
// src/modules/webhook/webhook.parser.ts
export const parsePayload = (raw: unknown): WebhookPayload => {
    if (typeof raw !== "object" || raw === null || !("event" in raw)) {
        throw new WebhookPayloadInvalidException({})
    }
    return raw as WebhookPayload
}
```

Một phép ép, sau một phép kiểm, ở chỗ người đọc nhìn thấy giả định. Toán hạng không phải một phép ép,
nên luật im — và nên im.

### ĐÚNG — họ spec được miễn, có chủ đích

```ts
// src/modules/webhook/webhook.parser.spec.ts
it("từ chối payload thiếu trường event", () => {
    const broken = { id: "x" } as unknown as WebhookPayload
    expect(() => handle(broken)).toThrow(WebhookPayloadInvalidException)
})
```

Dựng một giá trị sai có chủ đích chính là cách chứng minh một API đóng từ chối nó.

### ĐÚNG — tên tệp chỉ *chứa* chữ spec thì vẫn bị soi

```ts
// src/modules/webhook/spec-helpers.ts
// Luật VẪN áp dụng ở đây: mẫu hậu tố có neo đuôi `\.spec\.ts$`.
export const buildPayload = (raw: unknown): WebhookPayload => parsePayload(raw)
```

### Cửa lách và nhầm lẫn

Toàn bộ mã dưới đây **đi lọt**. Không cái nào trong số này là cách viết được phép.

```ts
// src/modules/enrollment/enrollment.service.ts
// LỌT: tách làm hai câu lệnh. Toán hạng của phép ép giờ là một định danh,
// nên `node.expression.type` không phải TSAsExpression. Giặt sạch y hệt.
const loose: unknown = row
return (loose as EnrollmentEntity).courseId
```

```ts
// src/modules/enrollment/enrollment.service.ts
// LỌT: cầu nối không phải `unknown`. Chỉ TSUnknownKeyword được thử.
// `never` gán được vào mọi kiểu, nên nó giặt mạnh y hệt — và KHÔNG có
// luật thứ hai nào đứng chờ phía sau như trường hợp `any`.
return (row as never as EnrollmentEntity).courseId
```

```ts
// src/modules/enrollment/enrollment.service.ts
// LỌT khỏi luật NÀY: `as any as` là một phép ép kép đầy đủ.
// Nó chỉ đỏ nếu no-explicit-any được bật ở kho tiêu thụ — mà đó là
// một luật khác, của một plugin khác.
return (row as any as EnrollmentEntity).courseId
```

```ts
// src/modules/enrollment/enrollment.mapper.ts
// LỌT: lối ngoặc nhọn là nút TSTypeAssertion, không phải TSAsExpression.
return (<EnrollmentEntity>(<unknown>row)).courseId
```

```ts
// src/shared/coerce.ts
// LỌT: đúng MỘT phép ép, từ `unknown`, hợp lệ ở mọi nơi.
// Đây là dạng nguy nhất trên kệ: một lần dọn dẹp xoá luật ở MỌI chỗ gọi.
export const coerce = <T,>(value: unknown): T => value as T

// src/modules/enrollment/enrollment.service.ts
return coerce<EnrollmentEntity>(row).courseId
```

```ts
// src/modules/enrollment/enrollment.guards.ts
// LỌT: không một phép ép nào trong tệp, và niềm tin phía sau thì y hệt.
// Chính phương thuốc mà văn bản luật kê ra là thứ luật cú pháp không kiểm nổi.
export const isEnrollmentEntity = (row: unknown): row is EnrollmentEntity => true
```

```ts
// src/modules/webhook/webhook.parser.ts
// LỌT: JSON.parse trả `any`, nên chỉ cần MỘT phép ép là xong.
// Cây cầu vẫn ở đó, chỉ là không được đánh vần ra.
return JSON.parse(raw) as WebhookPayload
```

```ts
// src/modules/enrollment/enrollment.service.spec.ts
// LỌT: đây là mã sản phẩm, chỉ khác cái tên. Cổng là lối ra CHO CẢ TỆP
// theo hậu tố, nên mọi thứ trong tệp này đều không được soi.
export const resolveCourse = (row: unknown) =>
    (row as unknown as EnrollmentEntity).courseId
```

```ts
// src/tests/factories/enrollment.factory.ts
// LỌT: đoạn `/src/tests/` miễn cho MỌI tệp nằm dưới nó, mãi mãi —
// kể cả một factory mà mã sản phẩm đang import. Miễn theo thư mục
// không phải miễn theo tệp, và nó không tự hết hạn.
export const anEnrollment = (raw: Record<string, string>) =>
    raw as unknown as EnrollmentEntity
```

---

## `no-inline-param-type`

### SAI — kiểu viết thẳng trên tham số rã cấu trúc

```ts
// src/modules/xp/xp.service.ts
export const grantXp = ({ userId, amount }: { userId: string; amount: number }) => {
    /* ... */
}
```

Người gọi thứ hai không import được hình dạng này, nên họ gõ lại nó — và khi trường thứ ba xuất hiện,
chỉ một trong hai bản chép nhận được.

### ĐÚNG — một kiểu có tên, export ra, đặt trong thư mục types của mô-đun

```ts
// src/modules/xp/types/grant-xp-params.ts
/** Những gì việc cộng XP cần. */
export interface GrantXpParams {
    userId: string
    amount: number
}

// src/modules/xp/xp.service.ts
import { GrantXpParams } from "./types/grant-xp-params"

export const grantXp = ({ userId, amount }: GrantXpParams) => {
    /* ... */
}
```

### SAI — arrow truyền vào một lời gọi cũng bị soi

```ts
// src/modules/order/order.service.ts
rows.map(({ id, total }: { id: string; total: number }) => ({ id, total }))
```

### SAI — phương thức của lớp, vì thân nó là một FunctionExpression

```ts
// src/modules/order/order.service.ts
@Injectable()
export class OrderService {
    public async settle({ orderId, amount }: { orderId: string; amount: number }) {
        /* ... */
    }
}
```

### ĐÚNG — cùng phương thức đó, với kiểu đã có tên

```ts
// src/modules/order/order.service.ts
import { SettleOrderParams } from "./types/settle-order-params"

@Injectable()
export class OrderService {
    public async settle({ orderId, amount }: SettleOrderParams) {
        /* ... */
    }
}
```

### SAI — rã cấu trúc lồng nhau không cứu được

```ts
// src/modules/order/order.mapper.ts
export const toRow = ({ buyer: { id } }: { buyer: { id: string } }) => id
```

Tham số ngoài cùng vẫn là `ObjectPattern` mang một `TSTypeLiteral` trần, nên độ sâu thêm vào không đổi
được gì.

### ĐÚNG — tham số thuộc tính của constructor không phải chỗ luật này canh

```ts
// src/modules/order/order.service.ts
@Injectable()
export class OrderService {
    constructor(private readonly repository: OrderRepository) {}
}
```

Vỏ tham số-thuộc-tính được bóc ra trước khi thử hình dạng, nên nó không thể giấu một pattern khỏi
luật. Ở đây không có pattern nào, nên không có gì để báo.

### Cửa lách và nhầm lẫn

Toàn bộ mã dưới đây **đi lọt**. Không cái nào trong số này là cách viết được phép.

```ts
// src/modules/xp/xp.service.ts
// LỌT: không rã cấu trúc. Tham số là một Identifier, nên luật không hề
// nhìn tới chú thích của nó — trong khi hình dạng vẫn không import được.
// Đây lại là lối viết PHỔ BIẾN HƠN.
export const grantXp = (params: { userId: string; amount: number }) => {
    /* ... */
}
```

```ts
// src/modules/xp/xp.service.ts
// LỌT: thêm một giá trị mặc định biến tham số thành AssignmentPattern.
// Phép bóc chỉ xử lý vỏ TSParameterProperty, nên `= {}` xoá luật.
export const grantXp = (
    { userId, amount }: { userId: string; amount: number } = { userId: "", amount: 0 },
) => {
    /* ... */
}
```

```ts
// src/modules/xp/xp.service.ts
// LỌT: chú thích phải ĐÚNG BẰNG TSTypeLiteral.
// Giao là TSIntersectionType, hợp là TSUnionType, và Readonly<…> là
// TSTypeReference. Cả ba vẫn chôn một hình dạng vào chữ ký.
export const a = ({ userId }: { userId: string } & AuditFields) => userId
export const b = ({ userId }: { userId: string } | undefined = { userId: "" }) => userId
export const c = ({ userId }: Readonly<{ userId: string }>) => userId
```

```ts
// src/modules/xp/types/xp-handler.ts
// LỌT: đây là TSFunctionType trong một type alias — không phải một trong
// ba nút được duyệt. Hình dạng được chốt ở hợp đồng, và chỉ được tuân theo
// ở phần cài đặt, nên chỗ đáng canh nhất lại không bị canh.
export type XpHandler = ({ userId, amount }: { userId: string; amount: number }) => void
```

```ts
// src/modules/xp/types/xp-service.ts
// LỌT: TSMethodSignature trong interface, và TSDeclareFunction cho chữ ký
// nạp chồng, đều không phải nút được duyệt.
export interface XpService {
    grant({ userId, amount }: { userId: string; amount: number }): Promise<void>
}

export declare function grantXp({ userId }: { userId: string }): void
```

```ts
// src/modules/xp/xp.base.ts
// LỌT: thân của một phương thức abstract là TSEmptyBodyFunctionExpression,
// không phải FunctionExpression.
export abstract class XpBase {
    public abstract grant({ userId }: { userId: string }): Promise<void>
}
```

```ts
// src/modules/xp/xp.service.ts
// LỌT: một alias cục bộ, KHÔNG export, thoả mãn luật hoàn toàn —
// trong khi vẫn không import được, tức vẫn đúng cái hại mà TYPE-3 nêu tên.
// Luật giữ được chữ "có tên"; văn bản luật đòi một kiểu có tên TRONG
// thư mục types của mô-đun, và khoảng cách đó cây cú pháp không thấy.
type Params = { userId: string; amount: number }

export const grantXp = ({ userId, amount }: Params) => {
    /* ... */
}
```

```ts
// src/modules/order/order.mapper.ts
// LỌT: ArrayPattern chôn một tuple viết thẳng vào chữ ký, và phép thử
// hình dạng chỉ nhận ObjectPattern.
export const toPair = ([id, total]: [string, number]) => ({ id, total })
```

---

## `no-const-enum`

### SAI — enum khai báo theo lối rẻ tiền

```ts
// src/modules/order/types/order-status.ts
export const enum OrderStatus {
    Pending = "pending",
    Settled = "settled",
    Refunded = "refunded",
}
```

Không có object lúc chạy: không duyệt được, không ánh xạ ngược được, không qua nổi ranh giới
isolated-modules.

### ĐÚNG — enum thường

```ts
// src/modules/order/types/order-status.ts
export enum OrderStatus {
    Pending = "pending",
    Settled = "settled",
    Refunded = "refunded",
}
```

### SAI — nằm trong một khối `declare module` cũng vẫn bị báo

```ts
// src/modules/order/order.augment.ts
declare module "some-gateway" {
    const enum Channel {
        Card = "card",
        Bank = "bank",
    }
}
```

Các từ khoá bao quanh không được đọc; chỉ mỗi cờ `const` trên nút khai báo.

### ĐÚNG — hằng object có `as const`, một lối viết khác hẳn

```ts
// src/modules/order/types/order-channel.ts
export const ORDER_CHANNEL = {
    Card: "card",
    Bank: "bank",
} as const

export type OrderChannel = (typeof ORDER_CHANNEL)[keyof typeof ORDER_CHANNEL]
```

Đây **không** phải một cửa lách: hằng này có object lúc chạy, duyệt được, và không có nút
`TSEnumDeclaration` nào để nói tới.

### ĐÚNG — luật này không có lối ra cho kiểm thử

```ts
// src/modules/order/order.service.spec.ts
// VẪN BỊ BÁO. Miễn trừ thuộc về một luật, không thuộc về mô-đun.
const enum Fixture {
    A = "a",
}
```

### Cửa lách và nhầm lẫn

Toàn bộ mã dưới đây **đi lọt**. Không cái nào trong số này là cách viết được phép.

```ts
// src/modules/order/types/order-status.ts
// LỌT: `declare enum` cũng KHÔNG sinh object lúc chạy — không duyệt được,
// không ánh xạ ngược được, hỏng đúng theo mọi cách mà thông điệp mô tả.
// `node.const` bằng false, nên luật im.
declare enum OrderStatus {
    Pending = "pending",
    Settled = "settled",
}
```

```ts
// types/gateway.d.ts
// LỌT: const enum ambient sống ở đây, và cấu hình thông thường không trỏ
// linter vào `.d.ts`. Luật không có cổng tệp nào của riêng nó, nên tầm với
// của nó ĐÚNG BẰNG tập glob mà kho tiêu thụ đưa cho.
declare const enum Channel {
    Card = "card",
}
```

```ts
// src/modules/order/order.service.ts
// LỌT: luật canh KHAI BÁO chứ không canh chỗ dùng. Const enum này được
// khai báo trong một gói phụ thuộc, mang đủ mọi thất bại kể trên tại đây,
// và không tệp nào trong cây này khai báo nó.
import { Channel } from "some-gateway"

export const listChannels = () => Object.values(Channel)
```

```ts
// tools/codegen/out/status.generated.ts
// LỌT: thư mục sinh mã thường nằm ngoài tập glob. Một bộ sinh mã phun ra
// const enum chính là trường hợp không ai review.
export const enum GeneratedStatus {
    A = "a",
}
```

---

## Ánh xạ yêu cầu sang một luật lint

Nêu tệp, nút cú pháp và giá trị. Nếu thiếu một trong ba, luật không có gì để đứng canh.

| Yêu cầu bằng lời | Nút và giá trị | Luật nổ | Cách viết đúng |
|---|---|---|---|
| "Ép tạm cho qua build, mai sửa" | `TSAsExpression` bọc một phép ép về `unknown` | `no-double-cast` | Sửa kiểu, hoặc thu hẹp bằng guard thật sự kiểm |
| "Dựng một giá trị sai để chứng minh API từ chối nó" | Cùng nút, trong tệp họ spec | không luật nào | Đúng chỗ dùng lối ra này |
| "Hàm chỉ nhận hai trường thôi, khỏi tạo interface" | `ObjectPattern` mang `TSTypeLiteral` | `no-inline-param-type` | Một `interface` có tên, export ra, trong `types/` của mô-đun |
| "Vậy bỏ rã cấu trúc đi cho nhanh" | Tham số `Identifier` mang `TSTypeLiteral` | **không luật nào** — và cái hại thì y nguyên | Vẫn phải là một kiểu có tên |
| "Cho tham số một giá trị mặc định" | `AssignmentPattern` bọc `ObjectPattern` | **không luật nào** | Vẫn phải là một kiểu có tên |
| "Enum này chỉ dùng nội bộ, cho `const` cho nhẹ" | `TSEnumDeclaration` có cờ `const` | `no-const-enum` | `enum` thường |
| "Vậy khai `declare enum` vậy" | `TSEnumDeclaration` không cờ `const` | **không luật nào** — và vẫn không có object lúc chạy | `enum` thường, hoặc hằng `as const` |
| "Gom phép ép vào một hàm tiện ích cho gọn" | Một `TSAsExpression` từ `unknown`, trong một generic | **không luật nào** | Đây là thay đổi luật, không phải một lần dọn dẹp |

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định |
|---|---|
| `no-double-cast` / không luật nào | Toán hạng của phép ép ngoài **có phải** một phép ép về `unknown` không? Nếu cầu nối là `any`, `never` hay `{}`, luật này im. |
| `no-double-cast` / `@typescript-eslint/no-explicit-any` | Từ `any` có xuất hiện trong dòng không? Nếu có, luật kia bắt được; nếu cầu nối là `never`, không luật nào bắt cả. |
| Một phép ép / hai phép ép | `raw as WebhookPayload` sau một phép kiểm là lối viết đúng. Một phép ép **đơn** không bao giờ bị luật này báo, kể cả khi nó cũng đáng ngờ. |
| Tệp được miễn / tệp bị soi | Đường dẫn có kết thúc đúng bằng một trong năm hậu tố, hoặc có chứa đoạn `/src/tests/` không? Câu này quyết định trước cả nội dung tệp — bên trong tệp được miễn, bộ duyệt còn chẳng được lắp. |
| `no-inline-param-type` / không luật nào | Tham số có **được rã cấu trúc** không, và chú thích có **đúng bằng** một object literal không? Hai câu hỏi này phải cùng đúng. |
| Kiểu có tên / kiểu có tên đúng chỗ | Luật dừng ở chữ "có tên". Việc kiểu đó có được export và có nằm trong `types/` của mô-đun hay không là phần văn bản luật đòi mà máy không giữ. |
| `no-const-enum` / không luật nào | Cờ `const` có bật trên chính nút khai báo không? `declare enum` không bật, dù hậu quả lúc chạy y hệt. |
| Khai báo / chỗ dùng | Const enum này được khai báo trong cây mã hay trong một gói phụ thuộc? Luật chỉ thấy vế đầu. |

## Sai lầm lặp lại nhiều nhất

1. Đọc mục **Cửa lách** như danh sách cách viết được phép. Nó là danh sách **chỗ mù**.
2. Tin rằng `x as never as T` an toàn hơn vì lint im. Nó giặt mạnh y hệt và không luật nào đứng chờ.
3. Tách phép ép kép thành hai câu lệnh rồi coi như đã sửa. Đó là đổi hình dạng cú pháp, không phải đổi
   ý nghĩa.
4. Gom phép ép vào một hàm generic "cho gọn", rồi xoá luật ở mọi chỗ gọi cùng lúc.
5. Viết một `row is T` trả về `true` và gọi đó là "đã thu hẹp".
6. Bỏ rã cấu trúc để né `no-inline-param-type`, tưởng đã sửa TYPE-3 trong khi hình dạng vẫn không
   import được.
7. Thêm `= {}` cho tham số rồi tưởng luật vẫn còn đó.
8. Đặt một `type` alias cục bộ không export và coi như đã có "kiểu có tên trong `types/`".
9. Đổi `const enum` thành `declare enum` và tưởng đã có object lúc chạy.
10. Đổi tên một mô-đun sản phẩm thành `.spec.ts`, hoặc đẩy nó vào `src/tests/`, rồi tưởng luật vẫn
    đang canh nó.
11. Đọc `@typescript-eslint/array-type` trong khối đề nghị rồi đi tìm mã tương ứng trong văn bản
    luật — ở đó không có mã nào cả.
