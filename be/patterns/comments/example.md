---
id: be-patterns-comments-example
title: example.md
slug: /be/patterns/comments/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã COMMENT-N, viết bằng TypeScript thường trong một ứng dụng hình dạng NestJS.
---

# example.md

> Version: `2.00` · Module: `comments` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường** trong một ứng dụng có hình dạng NestJS. Không có tên sản phẩm,
không tên repository, không tên module riêng. Một luật chỉ đúng khi nó đúng ở bất kỳ back end nào —
nên nếu một ví dụ cần tên riêng của một hệ thống mới đọc được, ví dụ đó không phù hợp ở đây.

Mỗi mã có **nhiều case**, mỗi case đặt bản **ĐÚNG** cạnh bản **SAI**, sau đó là mục **ngoại lệ và nhầm
lẫn**. Phần cuối trang ánh xạ một yêu cầu bằng lời sang một quyết định duy nhất.

Trong toàn bộ trang này, **prose trong code là tiếng Anh** — vì đó chính là điều `COMMENT-4` đòi. Văn
xuôi giải thích quanh code thì bằng tiếng Việt, vì nó không phải source.

---

## `COMMENT-1` — mọi export mở đầu bằng một doc block

### Case: một arrow function một dòng vẫn cần doc

ĐÚNG:

```ts
/**
 * Nest param decorator that binds the PRIMARY entity manager.
 *
 * Injecting the wrong connection reads and writes the sandbox or the analytics replica instead of
 * live data, and the injected type is identical either way -- so nothing fails until the data is
 * already wrong.
 */
export const InjectPrimaryEntityManager = () => InjectEntityManager(PRIMARY_CONNECTION)
```

SAI:

```ts
export const InjectPrimaryEntityManager = () => InjectEntityManager(PRIMARY_CONNECTION)
```

Hai bản khác nhau đúng một chuyện: người đọc có biết **chuyện gì hỏng nếu chọn nhầm** hay không. Chữ
ký thì giống hệt nhau ở cả hai connection, nên chữ ký không cứu được ai.

### Case: doc có mà chép lại tên thì vẫn sai

ĐÚNG:

```ts
/**
 * Marks a handler as safe to replay.
 *
 * The delivery layer at-least-once redelivers on any ack timeout, so an unmarked handler is assumed
 * to have side effects and is serialized behind a lock. Marking one that is NOT idempotent trades
 * the lock for duplicated writes.
 */
export const Replayable = () => SetMetadata(REPLAYABLE, true)
```

SAI:

```ts
/** Marks a handler as replayable. */
export const Replayable = () => SetMetadata(REPLAYABLE, true)
```

Bản SAI **qua được cổng lint** — nó có doc block. Nó vi phạm `COMMENT-3`: câu văn không nói gì mà cái
tên chưa nói. Đây là kiểu vi phạm phổ biến nhất của cả module, và không rule nào bắt được.

### Case: interface làm payload giữa hai module

ĐÚNG:

```ts
/**
 * The payload a projection consumer receives for one aggregate change.
 *
 * `version` is the aggregate's version AFTER the change, not the one that produced it: a consumer
 * that is behind compares it against its own watermark to decide whether to apply or drop.
 */
export interface ProjectionEvent {
    aggregateId: string
    version: number
    payload: Record<string, unknown>
}
```

SAI:

```ts
export interface ProjectionEvent {
    aggregateId: string
    version: number
    payload: Record<string, unknown>
}
```

`version` là số. Kiểu của nó không nói được nó là version **trước** hay **sau** thay đổi, và đoán sai
thì consumer bỏ mất đúng một event mỗi lần nó bị chậm.

### Case: hai thứ đứng cạnh nhau, doc phải nói chọn cái nào

ĐÚNG:

```ts
/**
 * Reads through the cache, and populates it on a miss.
 *
 * Reach for this on a read path. On a write path use `evictCourseSummary` instead: repopulating
 * inside a transaction caches a row the transaction may still roll back.
 */
export const readCourseSummary = async (courseId: string): Promise<CourseSummary> => { /* ... */ }
```

SAI:

```ts
/** Reads the course summary. */
export const readCourseSummary = async (courseId: string): Promise<CourseSummary> => { /* ... */ }
```

Bề mặt của một export không chỉ là "nó làm gì". Nó còn là "**khi nào chọn nó thay vì thứ nằm ngay bên
cạnh**", và đó là phần chữ ký không bao giờ nói được.

### Ngoại lệ và nhầm lẫn

- **Hằng số dữ liệu không thuộc mã này.** Tên đã là mô tả đầy đủ:

  ```ts
  export const MAX_ATTEMPTS = 3
  export const PRIMARY_CONNECTION = "primary"
  ```

  Bắt viết doc ở đây chỉ đẻ ra `/** The max attempts. */`, tức là **tự sinh ra vi phạm
  `COMMENT-3`**. Rule cố ý không ghé thăm một `const` trừ khi nó gắn với một function.

- **Re-export không có chỗ để gắn doc:**

  ```ts
  export { CourseService } from "./course.service"
  ```

  Không có khai báo nào ở đây. Doc thuộc về nơi khai báo, và rule bỏ qua node này.

- **Const gắn với function thì có bề mặt, nên thuộc mã này:**

  ```ts
  /**
   * Normalizes a slug before it is used as a cache key.
   *
   * The gateway lowercases the path but not the query, so two requests for one course can arrive
   * with different casing and split the cache entry in half.
   */
  export const normalizeSlug = (raw: string): string => raw.trim().toLowerCase()
  ```

- **Không export thì rule im lặng, luật thì không.** Một helper private đọc được trong ba dòng thì
  không cần doc. Ngày nó được export ra là ngày nó cần.

---

## `COMMENT-2` — mỗi member enum nói hậu quả của việc chọn nó

### Case: phân loại lỗi để quyết định xử lý key

ĐÚNG:

```ts
/**
 * Rotation-relevant classification of a failed provider call. Drives how the balancer penalizes --
 * or spares -- the key that failed.
 */
export enum ProviderErrorKind {
    /** Invalid, revoked or unauthorized key (401/403) -> hard-disable the key. */
    Auth = "auth",
    /** Rate limit or quota (429) -> short cooldown, the key recovers on its own. */
    RateLimit = "rateLimit",
    /** 5xx, network or timeout -> light cooldown, try another key. */
    Transient = "transient",
    /** Prompt or content fault, NOT the key -> do not penalize, and stop retrying. */
    NonKey = "nonKey",
}
```

SAI:

```ts
/** Classification of a failed provider call. */
export enum ProviderErrorKind {
    /** Auth error. */
    Auth = "auth",
    /** Rate limit error. */
    RateLimit = "rateLimit",
    /** Transient error. */
    Transient = "transient",
    /** Non-key error. */
    NonKey = "nonKey",
}
```

Bản SAI **qua cổng lint**: mỗi member đều có doc. Và nó vô dụng — người viết call site vẫn không biết
chọn `Transient` thay vì `Auth` thì key có bị tắt hay không. Đúng dữ kiện đó là thứ nằm ở file khác.

### Case: trạng thái thanh toán — hậu quả là chuyện *cấp quyền*

ĐÚNG:

```ts
/** The lifecycle of one payment attempt, as the entitlement layer reads it. */
export enum PaymentState {
    /** No money has settled: nothing is granted, and the cart is still editable. */
    Pending = "pending",
    /** Money is captured and the entitlement is open; reversing from here is a refund, not a cancel. */
    Settled = "settled",
    /** The provider declined: the cart stays, and a retry creates a NEW attempt rather than reusing this one. */
    Declined = "declined",
}
```

SAI:

```ts
export enum PaymentState {
    /** The pending state. */
    Pending = "pending",
    /** The settled state. */
    Settled = "settled",
    /** The declined state. */
    Declined = "declined",
}
```

"Reversing from here is a refund, not a cancel" là một câu **không suy ra được từ bất cứ đâu trong
file này**, và là câu quyết định người viết tiếp theo gọi hàm nào.

### Case: enum có ý nghĩa nằm trong một bảng tra ở file khác

ĐÚNG:

```ts
/** Why a key was taken out of rotation. Each reason implies a different recovery path. */
export enum KeyStatus {
    /** Serving normally. */
    Active = "active",
    /** Cooling down after a rate limit; the scheduler puts it back with no human action. */
    Cooling = "cooling",
    /** Disabled after an auth failure; it stays out until somebody replaces the credential. */
    Disabled = "disabled",
}
```

SAI:

```ts
export enum KeyStatus {
    Active = "active",
    Cooling = "cooling",
    Disabled = "disabled",
}
```

Khác biệt thật giữa `Cooling` và `Disabled` không nằm ở tên: một cái **tự quay lại**, một cái **đợi
người**. Người trực đêm cần đúng câu đó.

### Ngoại lệ và nhầm lẫn

- **Enum không export thì rule không nổ, nhưng luật vẫn hỏi.** Một enum module-private vẫn được chọn
  ở call site khác trong cùng module, và vẫn đáng nói hậu quả.

- **Doc của cả enum không thay được doc của member:**

  ```ts
  /** All the states a payment can be in. */
  export enum PaymentState {
      Pending = "pending",
      Settled = "settled",
  }
  ```

  Đây là `COMMENT-1` thoả và `COMMENT-2` vi phạm. Hai mã, hai bề mặt khác nhau.

- **Member trùng giá trị vẫn là hai member, và vẫn cần hai doc.** Nếu hai doc giống hệt nhau thì đó
  là dấu hiệu enum nên có một member, không phải dấu hiệu doc thừa.

---

## `COMMENT-3` — comment nói tại sao, code nói cái gì

### Case: một hệ thống ngoài gửi trùng

ĐÚNG:

```ts
// the gateway redelivers this webhook for a single capture whenever our ack is slow, so the second
// delivery must land as a no-op rather than a second grant
const existing = await this.entityManager.findOne(PaymentEntity, { where: { providerRef } })
```

SAI:

```ts
// find the payment by provider ref
const existing = await this.entityManager.findOne(PaymentEntity, { where: { providerRef } })
```

Hai bản khác nhau đúng một chuyện: câu văn có nói điều gì mà dòng code **không** nói hay không.

### Case: một race giữa hai replica

ĐÚNG:

```ts
// RETURNING id tells us whether THIS transaction won the insert race; a racing replica may have
// inserted the same protected day a millisecond earlier
const inserted = await manager.query(INSERT_PROTECTED_DAY, [userId, day])
if (inserted.length === 0) {
    // somebody else already protected this day, so no credit should be spent for it
    return
}
```

SAI:

```ts
// insert the protected day and check the result
const inserted = await manager.query(INSERT_PROTECTED_DAY, [userId, day])
if (inserted.length === 0) {
    // return early
    return
}
```

Bản SAI mô tả **cấu trúc điều khiển**, thứ đã hiện ra trên màn hình. Bản ĐÚNG mô tả **đối thủ** —
replica kia — thứ không xuất hiện ở bất cứ đâu trong file.

### Case: một thứ tự trông tuỳ tiện

ĐÚNG:

```ts
// stats are recomputed inside the same transaction: a consumer that reads the projection between
// the two writes would see a streak that skips the day we just protected
await this.recomputeStreak(manager, userId)
```

SAI:

```ts
// recompute the streak
await this.recomputeStreak(manager, userId)
```

### Case: nuốt lỗi có chủ ý

ĐÚNG:

```ts
} catch (error) {
    // swallowed on purpose: this sweep is idempotent and runs again tomorrow, and a thrown error
    // here would abort the remaining candidates that have nothing to do with this one
    this.logger.error(LogEvent.SweepFailed, { error })
}
```

SAI:

```ts
} catch (error) {
    // log the error
    this.logger.error(LogEvent.SweepFailed, { error })
}
```

Một `catch` rỗng hoặc chỉ log là chỗ người đọc **luôn** dừng lại để hỏi "cố ý hay quên?". Đó chính là
định nghĩa của một lý do nằm ngoài dòng code.

### Case: một hằng số lấy từ giới hạn của bên thứ ba

ĐÚNG:

```ts
// the provider truncates a batch above 100 without reporting it, so the page size is theirs, not ours
const PAGE_SIZE = 100
```

SAI:

```ts
// page size is 100
const PAGE_SIZE = 100
```

### Ngoại lệ và nhầm lẫn

- **Code bị comment lại không phải comment.** Nó là code chết mặc áo prose. Xoá nó; lịch sử đã nằm
  trong git.

  ```ts
  // SAI
  // const legacy = await this.oldPath(userId)
  const current = await this.newPath(userId)
  ```

- **Một banner phân đoạn không vi phạm mã này**, vì nó không mô tả dòng nào cả — nó điều hướng:

  ```ts
  // -- projection consumers ---------------------------------------------------------------------
  ```

- **Doc block cũng phải thoả `COMMENT-3`.** Có doc mà chép lại tên thì `COMMENT-1` xanh và mã này đỏ.

---

## `COMMENT-4` — prose là tiếng Anh, không emoji, không trang trí

### Case: lý do viết bằng tiếng Việt

ĐÚNG:

```ts
// the sort key must stay stable across pages: the provider returns ties in arbitrary order, so an
// unstable secondary key duplicates a row on one page and drops it from the next
const rows = await query.orderBy("row.score", "DESC").addOrderBy("row.id", "ASC").getMany()
```

SAI:

```ts
// phải sắp xếp ổn định, không thì có dòng bị trùng ở trang này và mất ở trang kia
const rows = await query.orderBy("row.score", "DESC").addOrderBy("row.id", "ASC").getMany()
```

Bản SAI là một câu **rất tốt** — đúng loại lý do mà `COMMENT-3` muốn. Nó hỏng ở chỗ khác: người đọc
tiếp theo không đọc được nó, và đúng chỗ đó mới là chỗ cần đọc.

### Case: emoji trong log

ĐÚNG:

```ts
this.logger.info(LogEvent.SeedCompleted, { seeded: rows.length })
```

SAI:

```ts
this.logger.info(LogEvent.SeedCompleted, { message: "✅ done", seeded: rows.length })
```

Dấu ✅ không nói được nó nghĩa là "đã chạy", "đã thành công", hay "đã kiểm". Nó mang sắc thái, và sắc
thái đọc khác nhau ở mỗi người.

### Case: dấu tích đứng thay một từ trong comment

ĐÚNG:

```ts
// verified against the live gateway on staging; the sandbox does not send this field at all
const settledAt = payload.settled_at ?? null
```

SAI:

```ts
// ⭐ đã test ✅
const settledAt = payload.settled_at ?? null
```

### Case: dấu câu kiểu chữ **được giữ**

ĐÚNG — và đây không phải ngoại lệ, đây là luật:

```ts
// -- retry policy ------------------------------------------------------------------------------
// A capture is retried three times -- the gateway's own timeout is 30s, so a shorter budget here
// would abandon calls that are still in flight.
```

Em dash, middle dot, ellipsis, khung kẻ trong banner **không** thuộc ba lớp bị từ chối. Bản đầu tiên
của rule cấm mọi codepoint ngoài ASCII và báo 857 chỗ trên một back end thật, **toàn bộ** là ba thứ
vừa kể. Đó là dấu hiệu của một luật bị bịa nghiêm hơn, không phải dấu hiệu của 857 chỗ cần sửa.

### Case: lane fixture — chuỗi là dữ liệu, comment vẫn là prose

ĐÚNG:

```ts
// the fixture asks in Vietnamese on purpose: instruction-following in the user's own language is
// the behaviour under test, and an English prompt would test a path nobody uses
it("answers in the language it was asked in", async () => {
    const answer = await harness.ask("Giải thích ngắn gọn closure trong JavaScript là gì.")
    expect(answer).toMatch(VIETNAMESE_LETTER)
})
```

SAI:

```ts
// hỏi bằng tiếng Việt để kiểm tra model trả lời đúng ngôn ngữ
it("answers in the language it was asked in", async () => {
    const answer = await harness.ask("Explain what a closure is in JavaScript.")
    expect(answer).toMatch(VIETNAMESE_LETTER)
})
```

Bản SAI hỏng **hai lần**: comment ở lane fixture vẫn là prose và vẫn phải là tiếng Anh; còn chuỗi thì
bị dịch, nên assertion cuối cùng đi kiểm một hệ thống không ai dùng.

### Ngoại lệ và nhầm lẫn

- **Tên của chính ngôn ngữ là một nhãn:**

  ```ts
  export const LOCALE_LABELS = { en: "English", vi: "Tiếng Việt" }
  ```

- **File locale là product copy toàn phần**, và mã này không áp vào `messages/`, `locales/`, `i18n/`.
  Đi soi chúng là đi soi sản phẩm.

- **Đổi bảng chữ cái không lách được rule.** Ba lớp ký tự nằm trong **một** rule với **một** lý do,
  nên bỏ tiếng Việt để thay bằng một hàng emoji không đi tới đâu.

---

## `COMMENT-5` — chuỗi chương trình phụ thuộc thì giữ và đánh dấu

### Case: message trả cho client theo locale

ĐÚNG:

```ts
const message = {
    [Locale.En]: "Payment created",
    [Locale.Vi]: "Tạo thanh toán thành công", // vn-ok: vi-locale string emitted to clients
}
```

SAI:

```ts
const message = {
    [Locale.En]: "Payment created",
    [Locale.Vi]: "Payment created",
}
```

Bản SAI không đỏ ở đâu cả. Nó chỉ khiến một nửa người dùng nhận message bằng ngôn ngữ họ không chọn.

### Case: pattern khớp vào nội dung người dùng thật đã viết

ĐÚNG:

```ts
// vn-ok: matches the vi-locale heading authored in real lesson bodies
const TESTING_HEADING = /^#{1,6}[ \t].*(Kiểm thử|Verification|Testing)\b.*$/im
```

SAI:

```ts
const TESTING_HEADING = /^#{1,6}[ \t].*(Verification|Testing)\b.*$/im
```

Đây là kiểu hỏng **im lặng** nhất trong cả module: một regex bị dịch không ném lỗi, không fail test,
nó chỉ **không bao giờ khớp nữa**. Nhánh phía sau nó chết mà không ai biết.

### Case: nhãn model bắt buộc phát ra đúng nguyên văn

ĐÚNG:

```ts
const example = {
    phase: "Câu 1", // vn-ok: literal phase label the grader must emit
    score: 8,
}
```

SAI:

```ts
const example = {
    phase: "Question 1",
    score: 8,
}
```

Prompt template dạy model phát ra nhãn nào thì downstream parse theo nhãn đó. Dịch một bên mà không
dịch bên kia là làm hỏng cả hai.

### Case: so sánh với chuỗi hệ thống ngoài gửi sang

ĐÚNG:

```ts
// vn-ok: the gateway sends this exact string and the comparison is against it
if (response.message === "Giao dich thanh cong") {
    await this.settle(payment)
}
```

SAI:

```ts
// "fixed" by a translation sweep: it now compares against a string the gateway never sends, and
// every successful payment falls through the branch
if (response.message === "Transaction successful") {
    await this.settle(payment)
}
```

Câu hỏi phân định là một câu duy nhất: **chuỗi này có phải của mình để đổi không?**

### Ngoại lệ và nhầm lẫn

- **Marker rỗng không phải ngoại lệ:**

  ```ts
  // SAI
  const label = "Đang xử lý" // vn-ok
  ```

  ```ts
  // ĐÚNG
  const label = "Đang xử lý" // vn-ok: status label emitted to clients in the vi locale
  ```

  Marker tồn tại để đợt rà soát sau **đọc được vì sao** dòng này ở lại. Không có lý do thì nó chỉ là
  một cách tắt cổng.

- **Không dùng marker để giữ một comment:**

  ```ts
  // SAI
  // vn-ok: chỗ này phải chạy trước vì cache
  await this.warmCache()
  ```

  Ngoại lệ này dành cho **chuỗi**, không dành cho lời giải thích. Lời giải thích thì dịch.

- **Không phải mọi chuỗi tiếng Việt đều là `COMMENT-5`.** Một message của exception nội bộ, chỉ log ra
  và không ai ngoài đội đọc, là prose — nó thuộc `COMMENT-4`:

  ```ts
  // SAI
  throw new InvalidCartException("Giỏ hàng rỗng")
  ```

  ```ts
  // ĐÚNG
  throw new InvalidCartException("cart is empty")
  ```

---

## Ánh xạ yêu cầu sang một quyết định

Nêu khai báo, đường dẫn và lý do. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể rồi
dừng. Câu trả lời phải là một quyết định hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Thêm một decorator export ra cho module khác dùng | Có bề mặt, file khác import | `COMMENT-1` | Doc block nói chọn nhầm thì hỏng gì |
| Thêm `export const RETRY_LIMIT = 5` | Hằng số dữ liệu, tên đã là mô tả | *không thuộc `COMMENT-1`* | Không viết doc |
| Thêm `export { X } from "./x"` | Re-export, không có khai báo để gắn doc | *không thuộc `COMMENT-1`* | Doc nằm ở nơi khai báo |
| Thêm một member mới vào enum trạng thái | Được chọn ở call site xa chỗ quyết định ý nghĩa | `COMMENT-2` | Doc nói chọn nó thì hệ thống làm gì |
| Giải thích vì sao phải gọi A trước B | Lý do nằm ngoài hai dòng đó | `COMMENT-3` | Comment nói ràng buộc, không kể lại thứ tự |
| Chú thích một dòng query đã đọc được | Không có gì nằm ngoài dòng đó | `COMMENT-3` | Xoá câu chú thích |
| Ghi lại một quyết định bằng tiếng Việt cho nhanh | Prose, người đọc tiếp theo có thể không đọc được | `COMMENT-4` | Viết bằng tiếng Anh |
| Thêm ✅ vào log cho dễ nhìn | Mang sắc thái, không mang thông tin | `COMMENT-4` | Bỏ, dùng chữ hoặc dùng field |
| Thêm message thành công theo locale | Chương trình **phát ra** chuỗi đó | `COMMENT-5` | Giữ nguyên, `vn-ok: <lý do>` |
| So sánh với message của cổng thanh toán | Chương trình **so khớp** chuỗi đó | `COMMENT-5` | Giữ nguyên, `vn-ok: <lý do>` |
| Đưa câu người dùng thật vào một spec | Lane fixture: chuỗi là dữ liệu | `COMMENT-5` | Giữ nguyên; comment quanh nó vẫn tiếng Anh |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `COMMENT-1` / hằng số dữ liệu | Khai báo này có **bề mặt** không, hay tên nó đã là toàn bộ mô tả? |
| `COMMENT-1` / `COMMENT-2` | Đang nói về **cả enum** hay về **một member** được chọn ở call site? |
| `COMMENT-1` / `COMMENT-3` | Doc này có nói gì mà cái tên chưa nói không? |
| `COMMENT-2` / `COMMENT-3` | Doc member nói **hậu quả của việc chọn**, hay chỉ đọc lại tên member? |
| `COMMENT-3` / `COMMENT-4` | Vấn đề là comment **nói gì**, hay comment **viết bằng gì**? |
| `COMMENT-4` / `COMMENT-5` | Chuỗi này có phải **của mình để đổi** không? Chương trình có so khớp hoặc phát ra nó không? |
| `COMMENT-4` / dấu câu | Ký tự này là chữ tiếng Việt, emoji, hay ký hiệu trang trí đứng thay một từ? Nếu không phải ba thứ đó thì nó được giữ |
| `COMMENT-5` / lạm dụng marker | Thứ đang được đánh dấu là **chuỗi** hay là **lời giải thích**? |

## Sai lầm lặp lại nhiều nhất

1. Viết doc block chép lại đúng cái tên, rồi coi như đã xong `COMMENT-1`.
2. Doc member enum viết "trạng thái X" thay vì nói chọn X thì chuyện gì xảy ra.
3. Chú thích lại dòng code bên dưới bằng tiếng Anh và tưởng đó là comment tốt.
4. Đọc `COMMENT-4` thành "chỉ ASCII", rồi đi xoá em dash và khung kẻ banner.
5. Dịch một chuỗi mà chương trình so khớp, làm chết một nhánh **không có test nào đỏ**.
6. Viết `vn-ok` không kèm lý do.
7. Dùng `vn-ok` để giữ lại một comment tiếng Việt.
8. Bắt viết doc cho hằng số dữ liệu, rồi tự sinh ra một câu chép lại tên.
9. Dịch chuỗi fixture trong spec, biến bài test thành bài test cho một hệ thống không ai dùng.
