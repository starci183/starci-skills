---
id: be-lints-comments-example
title: example.md
slug: /be/lints/comments/example
sidebar_label: example.md
sidebar_position: 2
description: Mã nổ quy tắc, mã không nổ, và mã lọt qua kẽ hở của từng quy tắc.
---

# example.md

> Version: `2.00` · Luật: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây là một quy tắc. Trong mỗi mục có nhiều cặp **SAI** (quy tắc nổ) và **ĐÚNG** (quy
tắc im), rồi tới **Cửa lách và nhầm lẫn**.

Đọc kỹ phần cửa lách. Mã trong đó **không nổ quy tắc**, nhưng đó là **thiếu sót của quy tắc**, không
phải sự cho phép của luật. Không dòng nào trong phần đó được coi là mẫu để chép.

Mọi ví dụ là mã nguồn thường. Không tên sản phẩm, không thư viện riêng.

---

## `require-export-jsdoc`

### Trường hợp: một lớp được xuất ra

**SAI** — quy tắc nổ tại tên lớp.

```ts
export class RefundService {
    async refund(paymentId: string): Promise<void> {
        // ...
    }
}
```

**ĐÚNG** — khối tài liệu nói ra thứ mà cái tên và chữ ký không nói được.

```ts
/**
 * Reverses a settled payment.
 *
 * Reach for this only after money has been captured. A payment that has not settled is cancelled
 * instead, and the two produce different rows downstream: a refund keeps the original charge on the
 * statement, a cancel never puts one there.
 */
export class RefundService {
    async refund(paymentId: string): Promise<void> {
        // ...
    }
}
```

### Trường hợp: hằng gán thẳng vào một hàm mũi tên

**SAI** — init là `ArrowFunctionExpression`, nên nó có bề mặt và bị đòi tài liệu.

```ts
export const buildIdempotencyKey = (orderId: string, attempt: number) =>
    `${orderId}:${attempt}`
```

**ĐÚNG**

```ts
/**
 * Builds the key the gateway deduplicates on.
 *
 * The attempt number is part of the key on purpose: a retry after a timeout must be allowed to
 * charge, while a double submit of the same attempt must not.
 */
export const buildIdempotencyKey = (orderId: string, attempt: number) =>
    `${orderId}:${attempt}`
```

### Trường hợp: giao diện và bí danh kiểu

**SAI** — cả hai đều nằm trong năm loại bị soi.

```ts
export interface RefundRequest {
    paymentId: string
    reason: string
}

export type RefundOutcome = RefundRequest & { settledAt: Date }
```

**ĐÚNG**

```ts
/** The fields a caller must gather before a refund can be attempted. */
export interface RefundRequest {
    paymentId: string
    reason: string
}

/** A refund that the gateway has confirmed; `settledAt` is the gateway's clock, never ours. */
export type RefundOutcome = RefundRequest & { settledAt: Date }
```

### Trường hợp: `export default`

**SAI** — dạng mặc định đi qua đúng bộ xử lý với dạng có tên.

```ts
export default function normalizeAmount(raw: string): number {
    return Math.round(Number(raw) * 100)
}
```

**ĐÚNG**

```ts
/**
 * Converts a decimal string to minor units.
 *
 * Rounds rather than truncates, because truncating loses a cent on every third invoice and the
 * ledger reconciliation then fails by an amount nobody can trace back to a line.
 */
export default function normalizeAmount(raw: string): number {
    return Math.round(Number(raw) * 100)
}
```

### Trường hợp: hằng số dữ liệu — được miễn một cách cố ý

**ĐÚNG** — không có khối tài liệu, và quy tắc im. Đây là miễn trừ có chủ ý, không phải kẽ hở: ép
viết một câu ở đây chỉ đẻ ra câu chép lại cái tên.

```ts
export const MAX_REFUND_ATTEMPTS = 3
```

### Cửa lách và nhầm lẫn

**Lọt — tệp gom đầu mối.** Không có `declaration` để gắn tài liệu, nên quy tắc thoát ngay. Toàn bộ
bề mặt công khai đi ra ngoài mà không một dòng nào bị đòi.

```ts
export { RefundService } from "./refund.service"
export { normalizeAmount } from "./amount"
export * from "./types"
```

**Lọt — gói hàm vào một lời gọi.** Cả ba dòng đều là thứ gọi được hoặc dựng được, và cả ba đều bị
xếp chung với hằng số dữ liệu.

```ts
export const buildKey = memoize((orderId: string) => `${orderId}:0`)
export const refundHandler = createHandler(RefundService)
export const RefundError = class extends Error {}
```

**Lọt — khai báo thứ hai trở đi.** Chỉ `declarations[0]` được xét; nó là dữ liệu nên cả câu lệnh
được bỏ qua, và hàm bên cạnh đi ra ngoài trần trụi. Đảo thứ tự lại thì quy tắc nổ.

```ts
export const MAX_REFUND_ATTEMPTS = 3, buildKey = (id: string) => `${id}:0`
```

**Lọt — tiêu đề tệp làm tài liệu cho thứ nằm dưới nó.** `getCommentsBefore` trả về mọi chú thích
đứng trước, và **bất kỳ** khối hợp lệ nào cũng cho qua. Khối dưới đây nói về mô-đun, không nói gì
về lớp, và quy tắc vẫn im.

```ts
/**
 * Refund plumbing.
 *
 * Split out of the payment module in the interest of build time.
 */
export class RefundService {}
```

**Lọt — chữ ký nạp chồng.** Hai chữ ký mà người gọi thật sự đọc thì không bị đòi gì; tài liệu bị đòi
ở phần cài đặt, là chữ ký duy nhất không ai đọc. Một tệp chỉ có chữ ký, không có phần cài đặt, thì
im hoàn toàn.

```ts
export function refund(payment: string): Promise<void>
export function refund(payment: string, partial: number): Promise<void>
/** Reverses a captured payment, in full or in part. */
export function refund(payment: string, partial?: number): Promise<void> {
    // ...
}
```

**Nhầm lẫn — vị trí khối tài liệu khi có bộ trang trí.** Hai đoạn dưới đây khác nhau đúng một chỗ
đặt, và quy tắc phân xử ngược với thói quen của gần như mọi người.

Đoạn này **nổ**, dù nó có tài liệu:

```ts
/** Reverses a captured payment. */
@Injectable()
export class RefundService {}
```

Đoạn này **im**:

```ts
@Injectable()
/** Reverses a captured payment. */
export class RefundService {}
```

Đây là báo nhầm, không phải cửa lách: quy tắc đòi tài liệu ở chỗ mà người đọc không tìm. Ghi ở
`audit.md` dưới mục rủi ro.

---

## `require-enum-member-jsdoc`

### Trường hợp: enum được xuất ra, thành viên trần

**SAI** — quy tắc nổ **một lần cho mỗi thành viên**.

```ts
export enum PaymentState {
    Pending = "pending",
    Settled = "settled",
    Reversed = "reversed",
}
```

**ĐÚNG** — mỗi thành viên nói ra hệ quả của việc chọn nó.

```ts
export enum PaymentState {
    /** No money has moved, so nothing is granted and the cart is still editable. */
    Pending = "pending",
    /** Money is captured and access is open; undoing this is a refund, never a cancel. */
    Settled = "settled",
    /** Money went back and access was withdrawn; the original charge stays on the statement. */
    Reversed = "reversed",
}
```

### Trường hợp: thêm một thành viên vào enum đã có tài liệu

**SAI** — ba thành viên cũ có tài liệu không che được thành viên thứ tư. Quy tắc nổ đúng tại
`Disputed`, và đây là giá trị lớn nhất của nó: một dòng thêm vào thì không ai nhớ phải kèm gì.

```ts
export enum PaymentState {
    /** No money has moved, so nothing is granted and the cart is still editable. */
    Pending = "pending",
    /** Money is captured and access is open; undoing this is a refund, never a cancel. */
    Settled = "settled",
    /** Money went back and access was withdrawn; the original charge stays on the statement. */
    Reversed = "reversed",
    Disputed = "disputed",
}
```

**ĐÚNG**

```ts
export enum PaymentState {
    /** No money has moved, so nothing is granted and the cart is still editable. */
    Pending = "pending",
    /** Money is captured and access is open; undoing this is a refund, never a cancel. */
    Settled = "settled",
    /** Money went back and access was withdrawn; the original charge stays on the statement. */
    Reversed = "reversed",
    /**
     * The cardholder challenged the charge. Access stays open while the bank decides, and any
     * refund attempted from here is rejected by the gateway as a duplicate reversal.
     */
    Disputed = "disputed",
}
```

### Cửa lách và nhầm lẫn

**Lọt — khối tài liệu chép lại cái tên.** Máy đếm được khối, không đọc được câu. Đoạn dưới đây là
đúng thứ mà luật in ra làm ví dụ phản diện, và bản dựng vẫn xanh.

```ts
export enum PaymentState {
    /** The pending state. */
    Pending = "pending",
    /** The settled state. */
    Settled = "settled",
}
```

**Lọt — khối rỗng.** `value` của nó là `"* "`, bắt đầu bằng `*`, nên đủ điều kiện.

```ts
export enum PaymentState {
    /** */
    Pending = "pending",
}
```

**Lọt — tách từ khoá `export` ra dòng khác.** Nút cha không còn là nút xuất, và toàn bộ yêu cầu biến
mất. Bề mặt công khai không đổi một chút nào.

```ts
enum PaymentState {
    Pending = "pending",
    Settled = "settled",
}

export { PaymentState }
```

**Lọt — đối tượng hằng thay cho enum.** Quy tắc thứ hai không thấy vì đây không phải
`TSEnumDeclaration`; quy tắc thứ nhất không thấy vì đây là hằng số dữ liệu. Hai quy tắc, cả hai đều
tắt.

```ts
export const PaymentState = {
    Pending: "pending",
    Settled: "settled",
} as const

export type PaymentState = (typeof PaymentState)[keyof typeof PaymentState]
```

**Lọt — hợp kiểu chuỗi.** Chỉ cần **một** khối tài liệu cho cả bí danh là xanh; từng lựa chọn không
cần gì. Quan hệ mà luật sinh ra để bảo vệ mất sạch.

```ts
/** The state a payment can be in. */
export type PaymentState = "pending" | "settled" | "reversed"
```

**Nhầm lẫn — chú thích dòng trên thành viên không tính.** Đoạn này **nổ**, và nó nổ đúng: quy tắc
đòi khối `/** … */`, không nhận `//`.

```ts
export enum PaymentState {
    // no money has moved yet
    Pending = "pending",
}
```

---

## `no-non-ascii-source`

### Trường hợp: lý lẽ viết bằng ngôn ngữ thứ hai

**SAI** — quy tắc nổ tại dòng chú thích.

```ts
// nhà cung cấp gửi webhook này hai lần cho một lần thu tiền, nên lần thứ hai phải là no-op
const existing = await this.entityManager.findOne(PaymentEntity, { where: { providerRef } })
```

**ĐÚNG** — cùng một lý lẽ, đọc được bởi người không chung tiếng mẹ đẻ với người viết.

```ts
// the provider sends this webhook twice for a single capture, so the second one must be a no-op
const existing = await this.entityManager.findOne(PaymentEntity, { where: { providerRef } })
```

### Trường hợp: biểu tượng cảm xúc và ký hiệu trang trí

**SAI** — biểu tượng mang **giọng điệu** chứ không mang thông tin, và giọng điệu thì mỗi người đọc
ra một kiểu.

```ts
// ✅ safe to retry here
// ❌ never retry after capture
await this.gateway.capture(paymentId)
```

**ĐÚNG**

```ts
// Retrying is safe before capture and unsafe after it: the gateway treats a second capture as a
// second charge, not as a duplicate of the first.
await this.gateway.capture(paymentId)
```

### Trường hợp: chuỗi mà chương trình so khớp

**SAI** — một đợt "dịch cho sạch" đã đổi chuỗi mà nhà cung cấp không bao giờ gửi. Mọi giao dịch
thành công rơi khỏi nhánh, và không có gì đỏ lên.

```ts
if (response.message === "Transaction successful") {
    await this.settle(paymentId)
}
```

**ĐÚNG** — giữ nguyên chuỗi, đánh dấu để đợt quét sau không biến nó thành lỗi.

```ts
// vn-ok: the provider returns this exact string and the comparison is against it
if (response.message === "Giao dịch thành công") {
    await this.settle(paymentId)
}
```

### Trường hợp: dữ liệu thử trong tệp thử

**ĐÚNG** — trong làn `*.spec.ts`, chuỗi không bị soi: câu mà người dùng thật sẽ gõ là **dữ liệu**
đang nạp vào hệ thống, dịch nó đi là đang thử một hệ thống không ai dùng.

```ts
// refund.spec.ts — a real customer sentence is a fixture, not prose
const message = "Tôi đã chuyển khoản nhưng chưa thấy mở khoá"
expect(classify(message)).toBe(Intent.PaymentNotCredited)
```

**SAI** — vẫn trong tệp thử đó, chú thích thì vẫn là văn xuôi và vẫn bị từ chối.

```ts
// refund.spec.ts
// kiểm tra nhánh khách đã chuyển khoản nhưng chưa được mở khoá
const message = "Tôi đã chuyển khoản nhưng chưa thấy mở khoá"
```

### Cửa lách và nhầm lẫn

**Lọt — bỏ dấu.** Không một điểm mã nào khớp lớp chữ cái. Quy tắc nhận diện một **lối viết**, không
nhận diện một **ngôn ngữ**, và ngôn ngữ thứ hai vẫn còn nguyên trong tệp.

```ts
// nha cung cap gui webhook nay hai lan cho mot lan thu tien, nen lan thu hai phai la no-op
const existing = await this.entityManager.findOne(PaymentEntity, { where: { providerRef } })
```

**Lọt — đổi sang bảng chữ cái khác.** Không chữ nào trong các dòng dưới thuộc ba lớp ký tự.

```ts
// провайдер отправляет этот вебхук дважды
// 供应商会发送两次该回调
// このウェブフックは二回送られてくる
```

**Lọt — mũi tên người ta thật sự gõ.** `➡` rơi vào dải biểu tượng nên bị bắt; `→` và `⇒` thì không.
`⭐` có trong danh sách mười hai ký tự, `⭕` thì không.

```ts
// pending → settled → reversed
// ⇒ the order matters: a reversal before settlement is a cancel
// ⭕ unresolved
```

**Lọt — thoát hoá.** Dòng là ASCII thuần, chương trình vẫn phát ra đúng văn bản cũ lúc chạy. Không
cần ai cố ý: một trình định dạng có bật tuỳ chọn thoát ký tự ngoài ASCII sẽ tự sinh ra dạng này.

```ts
const message = "\u0110\u1eb7t h\u00e0ng th\u00e0nh c\u00f4ng"
```

**Lọt — thư mục được miễn thì miễn cả tệp.** Quy tắc trả về bộ thăm rỗng, nên **chú thích** trong tệp
đó cũng thoát, không riêng phần nội dung hiển thị. Cùng nội dung ấy nằm ở `payment/messages.ts` —
tên tệp chứ không phải tên thư mục — thì bị soi đủ.

```ts
// src/i18n/payment.ts
// lý do chọn cách gieo chuỗi này thay vì tra bảng: bảng tra nạp chậm hơn ba lần
export const messages = { settled: "Giao dịch thành công" }
```

**Lọt — đổi tên tệp thử.** Cùng nội dung, hai số phận. Tên tệp là thứ rẻ nhất trong một kho mã để
đổi.

```ts
// refund.spec.ts   -> chuỗi được miễn
// refund.test.ts   -> chuỗi bị báo lỗi
// __tests__/refund.ts -> chuỗi bị báo lỗi
const message = "Tôi đã chuyển khoản nhưng chưa thấy mở khoá"
```

**Lọt — dấu `vn-ok` miễn cả dòng.** Biểu thức là `\bvn-ok\b`, không hơn: không đòi lý do, không đòi
nằm trong chú thích, và không giới hạn phạm vi trong dòng. Dòng dưới đây vừa mang một chuỗi hợp lệ
vừa mang một câu lý lẽ chưa dịch, và nó qua trọn vẹn.

```ts
if (r.message === "Giao dịch thành công") { /* vn-ok — và đây là lý do viết bằng tiếng Việt */ }
```

**Lọt — dấu trần.** Không có lý do nào cả, quy tắc vẫn im.

```ts
const message = "Giao dịch thành công" // vn-ok
```

**Nhầm lẫn — dấu không lan sang dòng khác.** Đoạn này **nổ** ở dòng thứ hai. Đây là quy tắc làm đúng,
không phải kẽ hở: dấu theo từng dòng.

```ts
// vn-ok: the two provider strings below are compared against
const settled = "Giao dịch thành công"
```

---

## Ánh xạ yêu cầu sang một quy tắc

Nêu cấu trúc đang viết và đường dẫn tệp. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu rồi
dừng.

| Yêu cầu bằng lời | Cấu trúc thật | Quy tắc | Kết quả |
|---|---|---|---|
| Xuất ra một lớp dịch vụ | `ClassDeclaration` sau `export` | `require-export-jsdoc` | Nổ nếu không có khối `/** … */` |
| Xuất ra một hàm tiện ích viết bằng hàm mũi tên | `const` gán thẳng vào `ArrowFunctionExpression` | `require-export-jsdoc` | Nổ nếu không có khối |
| Xuất ra một hàm tiện ích đã bọc qua `memoize` | `const` gán vào `CallExpression` | *không quy tắc nào* | Im — bề mặt đi ra ngoài trần trụi |
| Gom cả mô-đun ra một tệp đầu mối | `export { … } from` | *không quy tắc nào* | Im — kiểm bằng mắt |
| Xuất ra một hằng số cấu hình | `const` gán vào một giá trị | `require-export-jsdoc` | Im, và đó là chủ ý |
| Thêm một trạng thái vào enum được xuất ra | `TSEnumDeclaration` dưới `export` | `require-enum-member-jsdoc` | Nổ tại thành viên mới |
| Thay enum bằng đối tượng `as const` | `VariableDeclaration` | *không quy tắc nào* | Im ở cả hai quy tắc |
| Viết lý lẽ vào chú thích | Dòng văn bản thô | `no-non-ascii-source` | Nổ nếu có dấu tiếng Việt, biểu tượng hoặc ký hiệu trang trí |
| Viết lý lẽ bằng tiếng Việt không dấu | Dòng văn bản thô | *không quy tắc nào* | Im — kiểm bằng mắt |
| So khớp một chuỗi nhà cung cấp trả về | Dòng văn bản thô | `no-non-ascii-source` | Nổ, trừ khi đánh dấu `vn-ok` |
| Nạp dữ liệu thử là câu người dùng thật gõ | Chuỗi trong `*.spec.ts` | `no-non-ascii-source` | Im trong làn; nổ nếu tệp mang tên khác |
| Ghi nội dung hiển thị theo ngôn ngữ | Tệp dưới `i18n/` | *không quy tắc nào* | Im toàn bộ tệp, kể cả chú thích |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| Bị đòi tài liệu / được miễn | Thứ được xuất ra có **bề mặt** — gọi được, dựng được, hiện thực hoá được — hay chỉ là một giá trị? |
| `require-export-jsdoc` / không quy tắc nào | Khai báo có nằm **ngay sau** `export`, hay đi ra ngoài qua một tệp đầu mối? |
| Đủ tài liệu / chỉ đủ để xanh | Khối tài liệu này có nói được điều gì mà cái tên và chữ ký không nói không? Không quy tắc nào hỏi hộ câu này |
| `require-enum-member-jsdoc` / không quy tắc nào | Đây là `enum` gắn liền với `export`, hay là một cấu trúc khác đóng vai enum? |
| Văn xuôi / dữ liệu | Chương trình có **so khớp** hoặc **phát ra** chuỗi này không? Nếu có thì đánh dấu; nếu không thì dịch |
| Miễn theo làn / bị soi đủ | Tệp có nằm trong thư mục được miễn, hoặc mang đuôi tên trong làn dữ liệu thử không? |

## Sai lầm lặp lại nhiều nhất

1. Đọc bản dựng xanh thành "luật đã được tuân thủ". Ba quy tắc giữ hai mã rưỡi trên năm mã.
2. Viết một câu chép lại cái tên rồi coi là đã có tài liệu — cả hai quy tắc `jsdoc` đều cho qua.
3. Bọc một hàm qua `memoize` hay một xưởng dựng, rồi tưởng nó vẫn được soi.
4. Đưa bề mặt ra ngoài bằng tệp đầu mối và tưởng tệp đầu mối cũng bị soi.
5. Thay enum bằng đối tượng `as const` cho tiện, và mất luôn cả hai quy tắc mà không ai báo.
6. Bỏ dấu để cho qua quy tắc thứ ba, tưởng là đã tuân thủ trong khi ngôn ngữ thứ hai vẫn còn nguyên.
7. Đánh `vn-ok` lên một dòng vừa có chuỗi dữ liệu vừa có lý lẽ chưa dịch, rồi tưởng chỉ chuỗi được
   miễn.
8. Chuyển một tệp vào thư mục được miễn cho gọn, và tắt luôn phần kiểm chú thích của tệp đó vĩnh
   viễn.
9. Tách dữ liệu thử ra một mô-đun riêng cho sạch, và làm nó rơi khỏi làn — hàng loạt lỗi mới xuất
   hiện trên đúng thứ dữ liệu vốn hợp lệ.
10. Đặt khối tài liệu **trên** bộ trang trí rồi không hiểu vì sao vẫn bị báo thiếu.
