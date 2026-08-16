---
id: fe-lints-comments-example
title: example.md
slug: /gates/lints/comments/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng rule — chỗ nào rule kêu, chỗ nào không, và chỗ nào nó bỏ lọt.
---

# example.md

> Phiên bản: `2.00` · Mô-đun: `comments` · Luật: [`INDEX.md`](./INDEX.md) · Giải thích: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây là một rule, đọc theo từng cặp **SAI** (rule kêu) và **ĐÚNG** (rule im). Sau các cặp
là mục **Chỗ lách và chỗ dễ nhầm**: đoạn mã ở đó **lọt qua rule**, và lọt không có nghĩa là được phép. Đó
là mã vi phạm luật mà không có máy nào bắt — người review phải bắt.

---

## `require-export-jsdoc`

### Cặp 1 — export một hằng số

**SAI**

```ts
export const MAX_ATTEMPTS_PER_DAY = 5
```

**ĐÚNG**

```ts
/**
 * How many attempts one account may spend in a single day.
 *
 * The cap is per account, not per device: a second device is the cheapest way around a per-device
 * cap and the first thing anyone tries.
 */
export const MAX_ATTEMPTS_PER_DAY = 5
```

Chúng khác nhau ở đúng một thứ: người đọc có biết vì sao con số ấy đếm theo tài khoản hay không.

### Cặp 2 — export một hàm

**SAI**

```ts
export function resolveDueDate(startedAt: Date, days: number): Date {
  const due = new Date(startedAt)
  due.setDate(due.getDate() + days)
  return due
}
```

**ĐÚNG**

```ts
/**
 * The moment an assignment stops accepting work.
 *
 * Counted in whole days from the start, never in hours: an assignment opened at 23:50 must not be
 * one that closes ten minutes later.
 */
export function resolveDueDate(startedAt: Date, days: number): Date {
  const due = new Date(startedAt)
  due.setDate(due.getDate() + days)
  return due
}
```

### Cặp 3 — export một kiểu

**SAI**

```ts
export interface AttemptSummary {
  attemptId: string
  score: number
  submittedAt: string | null
}
```

**ĐÚNG**

```ts
/**
 * One finished attempt, as the result list reads it.
 *
 * `submittedAt` is null while an attempt is still open, and a caller that treats null as zero will
 * sort every open attempt to the top of the list.
 */
export interface AttemptSummary {
  attemptId: string
  score: number
  submittedAt: string | null
}
```

### Chỗ lách và chỗ dễ nhầm

Bốn đoạn dưới đây **vi phạm `COMMENTS-1`** nhưng rule không kêu một tiếng nào.

Tách khai báo khỏi export — nút export không có `declaration`, rule thoát ngay dòng đầu:

```ts
const MAX_ATTEMPTS_PER_DAY = 5

export { MAX_ATTEMPTS_PER_DAY }
```

Export mặc định dưới dạng biểu thức — `ArrowFunctionExpression` không nằm trong bốn loại được kiểm.
Đây là hình dạng export phổ biến nhất của một giao diện:

```tsx
export default () => (
  <section className="flex flex-col gap-4">
    <h2>Attempts</h2>
  </section>
)
```

Khối chú thích rỗng — rule chỉ hỏi "có khối bắt đầu bằng `*` không", không bao giờ đọc bên trong:

```ts
/** */
export const MAX_ATTEMPTS_PER_DAY = 5
```

Khối viết cho dòng phía trên, cách mấy dòng trắng, vẫn được tính là khối của export:

```ts
/** Everything the result list needs, in one import. */
import { formatScore } from "./format"


export const MAX_ATTEMPTS_PER_DAY = 5
```

Một khối gánh nhiều khai báo cùng lúc:

```ts
/** Attempt limits. */
export const MAX_ATTEMPTS_PER_DAY = 5,
  MAX_ATTEMPTS_PER_WEEK = 20,
  COOLDOWN_MINUTES = 30
```

Và `class` với `enum` thì hoàn toàn nằm ngoài tầm với:

```ts
export class AttemptStore {
  private items = new Map<string, number>()
}
```

---

## `no-second-language-in-source`

### Cặp 1 — chú thích

**SAI**

```ts
// Đơn quá hạn thì không cho gia hạn nữa
const canExtend = (dueAt: Date) => dueAt > new Date()
```

**ĐÚNG**

```ts
// An overdue item cannot be extended: extending it would move a deadline that has already been
// used to decide something else.
const canExtend = (dueAt: Date) => dueAt > new Date()
```

### Cặp 2 — tên định danh

Đây là chỗ một rule chỉ đọc chú thích sẽ mù hoàn toàn — câu văn chỉ cần tụt xuống một dòng.

**SAI**

```ts
const đơnQuáHạn = items.filter((item) => item.dueAt < now)
```

**ĐÚNG**

```ts
const overdueItems = items.filter((item) => item.dueAt < now)
```

### Cặp 3 — chữ trong JSX

**SAI**

```tsx
export const EmptyState = () => (
  <div className="flex flex-col items-center gap-2">
    <p>Chưa có kết quả nào</p>
  </div>
)
```

**ĐÚNG**

```tsx
export const EmptyState = () => (
  <div className="flex flex-col items-center gap-2">
    <p>{t("results.empty")}</p>
  </div>
)
```

### Cặp 4 — chuỗi có chức năng

Chuỗi mà máy chủ gửi về nguyên văn và màn hình so khớp trên đó thì **được giữ**, nhưng phải đánh dấu.

**SAI**

```ts
const CANCELLED_STATUS = "Đã huỷ"
```

**ĐÚNG**

```ts
// vn-ok: the server emits this status verbatim and the filter matches on it
const CANCELLED_STATUS = "Đã huỷ"
```

Chúng khác nhau ở đúng một thứ: người đọc sau có phân biệt được **một giá trị** với **một câu ai đó
quên dịch** hay không.

### Chỗ lách và chỗ dễ nhầm

Mọi đoạn dưới đây **vi phạm `COMMENTS-2`** và rule im lặng.

Bỏ dấu đi là xong. Đây là cửa lớn nhất của cả mô-đun, và nó không cần ai cố tình — người ta vẫn gõ như
thế trong khung chat:

```ts
// han cuoi da qua roi thi khong cho gia han nua
const canExtend = (dueAt: Date) => dueAt > new Date()
```

Chữ ở dạng tổ hợp: hiện trên màn hình y hệt dòng bị bắt ở Cặp 1, nhưng được ghép từ chữ cái gốc cộng dấu
rời, mà lớp ký tự chỉ chứa chữ dựng sẵn:

```ts
// Nguồn dán vào từ một trình soạn thảo chuẩn hoá khác — cùng con chữ, khác mã điểm
const label = "không thể huỷ" // lớp ký tự không khớp mảnh nào ở đây
```

Tên gọi bản ngữ tẩy sạch **cả nút**, không chỉ tẩy tên gọi ấy:

```ts
const note = "Tiếng Việt: đơn này đã bị huỷ vì quá hạn thanh toán, không hoàn tiền"
```

Dấu `vn-ok:` miễn cả **dòng**, nên nó gánh luôn những nút không ai định miễn:

```ts
// vn-ok: the server emits this status verbatim
const CANCELLED_STATUS = "Đã huỷ", CANCEL_HINT = "Bấm vào đây để xem lý do huỷ"
```

Và một template chỉ cần **bắt đầu** trên dòng đã đánh dấu là được miễn cho toàn thân, dài bao nhiêu
cũng vậy:

```ts
// vn-ok: matched against the mail template stored upstream
const body = `
  Đơn của bạn đã bị huỷ vì quá hạn thanh toán.
  Bạn có thể đặt lại bất cứ lúc nào trong vòng ba mươi ngày.
  Nếu cần hỗ trợ, hãy trả lời thư này.
`
```

File test được miễn **trọn vẹn**, không phải miễn riêng chuỗi tái hiện dữ liệu thật:

```ts
// file: attempt-store.test.ts — cả file nằm ngoài tầm rule
// Kiểm tra: đơn quá hạn thì không được gia hạn nữa
it("từ chối gia hạn khi đã quá hạn", () => {
  expect(canExtend(yesterday)).toBe(false)
})
```

Giặt qua một đường dẫn được miễn rồi import về — nơi import chỉ còn một tên định danh:

```ts
// file: copy.fixture.ts  (được miễn theo đường dẫn)
export const CANCEL_COPY = "Đơn đã bị huỷ vì quá hạn thanh toán"
```

```tsx
// file: CancelNotice.tsx  (được lint, và không có gì để bắt)
import { CANCEL_COPY } from "./copy.fixture"

export const CancelNotice = () => <p>{CANCEL_COPY}</p>
```

Ngược lại, đây là chỗ **không lách được**, dù trông rất giống: gom chuỗi vào mảng hay object không giấu
được gì, vì rule canh trên chính nút `Literal` chứ không canh một thuộc tính:

```ts
const STATUS_LABELS = ["Đã huỷ", "Đang xử lý", "Hoàn tất"]
```

Viết dưới dạng chuỗi thoát cũng không giấu được, vì rule đọc **giá trị đã giải mã** chứ không đọc mã
nguồn thô:

```ts
const CANCELLED_STATUS = "\u0110\u00e3 hu\u1ef7"
```

---

## `no-emoji-in-source`

### Cặp 1 — trong JSX

**SAI**

```tsx
export const StreakBadge = ({ days }: { days: number }) => (
  <span className="inline-flex items-center gap-1">🔥 {days}</span>
)
```

**ĐÚNG**

```tsx
export const StreakBadge = ({ days }: { days: number }) => (
  <span className="inline-flex items-center gap-1">
    <Icon name="flame" />
    {days}
  </span>
)
```

### Cặp 2 — trong chuỗi chẩn đoán

**SAI**

```ts
logger.warn("⚠️ payment webhook arrived twice for the same reference")
```

**ĐÚNG**

```ts
logger.warn("payment webhook arrived twice for the same reference")
```

Chúng khác nhau ở đúng một thứ: dòng log ấy có còn đọc được trên một terminal không chờ đợi nó hay không.

### Cặp 3 — trong chú thích và tên

**SAI**

```ts
// 🚀 fast path: skip the projection when nothing changed
const skipProjection = (previous: Row, next: Row) => previous.hash === next.hash
```

**ĐÚNG**

```ts
// Fast path: skip the projection when nothing changed. The hash is computed upstream, so this
// comparison is a string compare rather than a deep walk.
const skipProjection = (previous: Row, next: Row) => previous.hash === next.hash
```

### Chỗ lách và chỗ dễ nhầm

Ba đoạn đầu **vi phạm `COMMENTS-4`** và rule im lặng.

Chuỗi kiểu phím số: hiện ra đúng như một emoji, nhưng không mảnh nào của nó mang thuộc tính tượng hình
mở rộng — không chữ số, không ký tự chọn biến thể, không dấu bao ô vuông:

```tsx
export const StepBadge = () => <span>1️⃣ Chọn gói</span>
```

Hình vẽ không mang thuộc tính ấy — sao, mũi tên, dấu chấm đầu dòng, ký tự vẽ khung:

```tsx
export const Rating = ({ score }: { score: number }) => (
  <span aria-hidden>{"★".repeat(score) + "☆".repeat(5 - score)}</span>
)
```

Dữ liệu ngôn ngữ — chính chỗ mà `COMMENTS-4` nói rõ là cũng bị cấm, lại là chỗ cổng đường dẫn miễn:

```json
{
  "streak.title": "🔥 Chuỗi ngày học",
  "streak.empty": "Chưa có chuỗi nào"
}
```

Và đây là chiều ngược lại — **rule kêu ở chỗ không ai coi là emoji**, vì dấu bản quyền cũng mang thuộc
tính tượng hình mở rộng. Đoạn này bị báo lỗi, và đó là chi phí phải biết trước chứ không phải cửa mở:

```tsx
export const Footer = () => <footer>© 2026 — all rights reserved</footer>
```

---

## Ánh xạ yêu cầu sang một rule

| Câu người ta hay nói | Rule trả lời | Có thật sự giữ được không |
|---|---|---|
| "Export nào cũng phải có doc" | `require-export-jsdoc` | Giữ được với `const`, `function`, `interface`, `type`. Không giữ được với `class`, `enum`, export mặc định dạng biểu thức, và `export { … }` |
| "Doc phải nói vai trò, đừng chép chữ ký" | *(không có rule)* | Không. Rule chỉ đếm sự tồn tại của khối |
| "Source phải là một ngôn ngữ" | `no-second-language-in-source` | Giữ được với chữ **có dấu**. Không giữ được với chữ không dấu, chữ dạng tổ hợp, hay hệ chữ khác |
| "Chuỗi máy chủ gửi về thì được giữ nguyên" | `no-second-language-in-source` | Có, qua dấu `vn-ok:` — nhưng dấu ấy miễn cả dòng |
| "Đừng dùng emoji" | `no-emoji-in-source` | Giữ được với ký tự tượng hình mở rộng. Không giữ được với chuỗi kiểu phím số hay hình vẽ trang trí |
| "Cả trong file ngôn ngữ nữa" | *(không có rule)* | Không. File ngôn ngữ được miễn theo đường dẫn |
| "Đừng viết chú thích chép lại dòng bên dưới" | *(không có rule)* | Không. `COMMENTS-5` không có máy giữ |
| "Chú thích nào cãi thì phải nêu tên quyết định nó cãi" | *(không có rule)* | Không. `COMMENTS-6` không có máy giữ |

## Bảng phân định ranh giới

| Nếu phân vân giữa | Phân định bằng |
|---|---|
| Rule im vì mã **đúng luật**, hay im vì **lọt cửa** | Đối chiếu với bảng "Open" trong `INDEX.md`. Im lặng không bao giờ là bằng chứng đúng luật |
| Một chuỗi là **văn bản** hay là **giá trị** | Chương trình đang chạy có so khớp hoặc phát ra đúng chuỗi ấy không. Nếu có, giữ và đánh dấu; nếu không, dịch |
| Đánh dấu `vn-ok:` hay chuyển vào file ngôn ngữ | Chuỗi hiện ra cho người dùng đọc thì thuộc về file ngôn ngữ. Dấu `vn-ok:` dành cho giá trị mà máy so khớp |
| File này là **fixture** hay là **source** | Xem đường dẫn, đúng bảy mẫu ấy. Một file tên `mocks/` hay `seed/` **không** được miễn dù ai cũng gọi nó là dữ liệu giả |
| Thiếu doc, hay rule không với tới hình dạng export ấy | Nhìn dạng khai báo. `export default <biểu thức>` và `export { … }` luôn im, kể cả khi thiếu doc thật |
| Ký hiệu này là emoji hay là chữ | Rule không phân biệt được. Dấu bản quyền bị bắt, ngôi sao thì không |

## Sai lầm lặp lại nhiều nhất

1. **Coi lint xanh là bằng chứng đã theo luật.** Ba rule này giữ bốn trong sáu mã, và giữ không kín.
   Xanh nghĩa là không có gì bị bắt, không nghĩa là không có gì sai.
2. **Bỏ dấu để cho qua.** Gõ không dấu là cách lách phổ biến nhất và tự nhiên nhất, vì nó không giống
   hành vi lách — nó giống gõ nhanh. Nhưng câu ấy vẫn là ngôn ngữ thứ hai, chỉ khó đọc hơn cho tất cả mọi
   người, kể cả người viết ra nó.
3. **Viết `/** */` rỗng cho hết lỗi.** Rule tắt tiếng ngay, và `COMMENTS-1` thì vẫn bị vi phạm y nguyên —
   lần này còn thêm một khối chú thích vô nghĩa nằm lại trong file.
4. **Đặt dấu `vn-ok:` lên một dòng có nhiều thứ.** Nó miễn cả dòng. Một chuỗi cần dấu và một chuỗi chỉ
   tình cờ đứng cạnh sẽ được miễn như nhau.
5. **Tưởng `export { … }` cũng bị kiểm.** Không. Tách khai báo ra khỏi export là cách vô hiệu hoá
   `require-export-jsdoc` mà không ai định làm — nó chỉ là một thói quen sắp xếp file.
6. **Đổ emoji vào file ngôn ngữ.** Vẫn vi phạm `COMMENTS-4`, chỉ là chuyển sang đúng chỗ rule không nhìn.
