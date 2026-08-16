---
id: be-lints-testing-example
title: example.md
slug: /be/lints/testing/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng quy tắc kiểm thử — bản làm quy tắc nổ, bản làm nó im, và bản lách qua được.
---

# example.md

> Version: `2.00` · Mô-đun: `testing` · Luật: [`INDEX.md`](./INDEX.md) · Từng quy tắc: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây là **một quy tắc**. Trong mỗi mục có nhiều cặp **SAI** (quy tắc nổ) và **ĐÚNG**
(quy tắc im), rồi tới mục **Cửa lách và nhầm lẫn** chứa mã **lọt qua được**.

Mã trong mục cửa lách **không phải mã được phép viết**. Nó là mã quy tắc **không nhìn thấy**. Luật vẫn
cấm; chỉ có máy là không bắt được. Đó là khác biệt quan trọng nhất trên trang này: một luật không có
quy tắc thì ai cũng biết là chưa được canh, còn một quy tắc rò thì ai cũng tưởng đã đóng.

---

## `no-call-only-spec`

Chỉ chạy trên tệp kết thúc `.spec.ts` và không kết thúc `.e2e-spec.ts`, `.int-spec.ts`,
`.harness-spec.ts`.

### SAI — cả tệp chỉ nói về lời gọi

```ts
// pricing.handler.spec.ts
it("áp mã giảm giá", async () => {
  await handler.execute(command({ coupon: "HALF" }))
  expect(payments.charge).toHaveBeenCalledWith(expect.anything())
})

it("không áp khi mã hết hạn", async () => {
  await handler.execute(command({ coupon: "EXPIRED" }))
  expect(payments.charge).toHaveBeenCalledTimes(1)
})
```

Hai khẳng định, cả hai đều về lời gọi ⇒ hai bộ đếm bằng nhau ⇒ báo, kèm
`toHaveBeenCalledWith, toHaveBeenCalledTimes`. Đổi tên `charge` thành `capture` thì tệp đỏ; đổi mức
giảm từ một nửa thành một phần ba thì tệp vẫn xanh. Đó là quan hệ nhân quả ngược.

### ĐÚNG — khẳng định kết quả

```ts
// pricing.handler.spec.ts
it("áp mã giảm giá", async () => {
  const result = await handler.execute(command({ coupon: "HALF" }))
  expect(result.chargedAmount).toBe(5000)
})

it("không áp khi mã hết hạn", async () => {
  const result = await handler.execute(command({ coupon: "EXPIRED" }))
  expect(result.chargedAmount).toBe(10000)
})
```

### ĐÚNG — lời gọi làm khẳng định thứ hai

```ts
// notify.handler.spec.ts
it("gửi thư khi ghi danh mở", async () => {
  const result = await handler.execute(command({ orderId }))

  expect(result.status).toBe("ENROLLED")          // hệ quả
  expect(mailer.send).toHaveBeenCalledTimes(1)    // chính lời gọi là hệ quả quan sát được
})
```

Đây là ngoại lệ **được thiết kế**, không phải chỗ lách: bộ đếm lệch nhau nên quy tắc im, và luật cũng
cho phép đúng hình dạng này.

### ĐÚNG — chuỗi bổ nghĩa vẫn được nhìn xuyên qua

```ts
it("từ chối giỏ rỗng", async () => {
  await expect(handler.execute(command({ items: [] }))).rejects.toThrow("empty")
})

it("không tính phí khi đã trả", async () => {
  await handler.execute(command({ alreadyPaid: true }))
  expect(payments.charge).not.toHaveBeenCalled()
})
```

Matcher lấy ở **cuối** chuỗi: `toThrow` và `toHaveBeenCalled`. `.rejects` và `.not` không giấu được
gì. Ở đây có một khẳng định thật nên tệp được tha — đúng ý luật.

### Cửa lách và nhầm lẫn

**Cửa 1 — một khẳng định ngoại phạm gỡ ngòi cả tệp.** *Quy tắc không bắt. Luật vẫn cấm.*

```ts
// pricing.handler.spec.ts — 30 ca call-only, cộng đúng một dòng vô hại
it("handler tồn tại", () => {
  expect(handler).toBeDefined()
})

it("áp mã giảm giá", async () => {
  await handler.execute(command({ coupon: "HALF" }))
  expect(payments.charge).toHaveBeenCalledWith(expect.anything())
})
// ... 29 ca nữa cùng hình dạng
```

Bộ đếm tổng là 31, bộ đếm lời gọi là 30 ⇒ khác nhau ⇒ im lặng tuyệt đối.

**Cửa 2 — matcher không cần được gọi.** *Quy tắc không bắt.*

```ts
it("áp mã giảm giá", async () => {
  const result = await handler.execute(command({ coupon: "HALF" }))
  expect(result.chargedAmount).toBe   // quên cặp ngoặc: lúc chạy không khẳng định gì
})
```

Quy tắc đọc **tên thuộc tính cuối cùng**, không hỏi chuỗi đó có kết thúc bằng một lời gọi hay không.
Dòng này đếm là khẳng định thật.

**Cửa 3 — viết lại thành khẳng định giá trị.** *Quy tắc không bắt.*

```ts
it("áp mã giảm giá", async () => {
  await handler.execute(command({ coupon: "HALF" }))
  expect(payments.charge.mock.calls[0][0]).toEqual({ amount: 5000 })
})
```

Vẫn chép lại mã nguồn y hệt bản SAI đầu tiên, nhưng matcher là `toEqual`. Quy tắc nhìn **matcher**,
không nhìn **chủ ngữ**.

**Cửa 4 — matcher ngoài tập chín tên.** *Quy tắc không bắt, và rò hai lần.*

```ts
it("chỉ tính phí một lần", async () => {
  await handler.execute(command({ orderId }))
  expect(payments.charge).toHaveBeenCalledOnce()
})
```

`toHaveBeenCalledOnce` không nằm trong tập, nên (a) không bị tính là khẳng định lời gọi và (b) làm hai
bộ đếm lệch, tha luôn mọi khẳng định lời gọi thật khác trong cùng tệp.

**Cửa 5 — khẳng định dời ra ngoài tệp spec.** *Quy tắc không bắt.*

```ts
// assertions.ts — không phải tệp spec, không quy tắc nào chạy ở đây
export const assertCharged = (spy: jest.Mock) => expect(spy).toHaveBeenCalled()
```

```ts
// pricing.handler.spec.ts — 0 khẳng định quy tắc nhận ra được
import { assertCharged } from "./assertions"

it("áp mã giảm giá", async () => {
  await handler.execute(command({ coupon: "HALF" }))
  assertCharged(payments.charge)
})
```

Tổng khẳng định trong tệp spec là 0, mà 0 là trường hợp quy tắc **cố ý** không báo.

**Nhầm lẫn hay gặp.** Đổi tên tệp thành `pricing.handler.test.ts` là quy tắc thôi tồn tại. Cổng đòi
đúng hậu tố `.spec.ts`.

---

## `e2e-asserts-persisted-state`

Chỉ chạy trên tệp kết thúc `.e2e-spec.ts`.

### SAI — chỉ khẳng định trên phản hồi

```ts
// checkout.e2e-spec.ts
it("thanh toán xong thì ghi danh mở", async () => {
  await addToCart(courseId)
  const checkout = await request(app.getHttpServer()).post("/checkout").send({ courseId })
  expect(checkout.status).toBe(201)

  const webhook = await request(app.getHttpServer()).post("/webhook").send({ status: "PAID" })
  expect(webhook.status).toBe(200)
})
```

Không tên nào trong nhóm đọc trạng thái xuất hiện ⇒ báo. Luồng có thể ngừng ghi hoàn toàn mà tệp vẫn
xanh.

### ĐÚNG — đọc trạng thái về và khẳng định lên nó

```ts
// checkout.e2e-spec.ts
it("thanh toán xong thì ghi danh mở", async () => {
  await addToCart(courseId)
  await request(app.getHttpServer()).post("/checkout").send({ courseId }).expect(201)
  await request(app.getHttpServer()).post("/webhook").send({ status: "PAID" }).expect(200)

  await until(async () => (await countEnrollments(userId, courseId)) === 1)

  const enrollment = await entityManager.findOneOrFail(EnrollmentEntity, {
    where: { user: { id: userId }, course: { id: courseId } },
  })
  expect(enrollment.isEnrolled).toBe(true)
})
```

### ĐÚNG — luồng thật sự không có hệ quả lưu trữ

```ts
// health.e2e-spec.ts
/* eslint-disable-next-line starci-be/e2e-asserts-persisted-state --
   luồng này không ghi gì; thứ nó quan sát là mã trạng thái của bộ kiểm tra sức khoẻ */
it("điểm cuối sức khoẻ trả về các phụ thuộc đã kết nối", async () => {
  const response = await request(app.getHttpServer()).get("/health").expect(200)
  expect(response.body.database).toBe("up")
})
```

Dòng vô hiệu hoá **nêu tên thứ được quan sát thay thế**. Một dòng vô hiệu hoá không có lý do là xoá
luật, xoá dần từng tệp một.

### Cửa lách và nhầm lẫn

**Cửa 1 — dòng nhập khẩu là đủ.** *Quy tắc không bắt. Luật vẫn cấm.*

```ts
// checkout.e2e-spec.ts
import { DataSource } from "typeorm"   // <- chỉ dòng này đã bật cờ "có đọc trạng thái"

it("thanh toán xong thì ghi danh mở", async () => {
  const checkout = await request(app.getHttpServer()).post("/checkout").send({ courseId })
  expect(checkout.status).toBe(201)
})
```

Định danh trong nhập khẩu cũng là `Identifier`. Quy tắc duyệt **mọi** `Identifier` và chỉ hỏi cái tên.

**Cửa 2 — dòng dọn dẹp cũng đủ.** *Quy tắc không bắt.*

```ts
afterAll(async () => {
  await app.get(DataSource).destroy()   // đóng kết nối, không đọc gì cả
})
```

Gần như mọi tệp luồng đều có một dòng như thế trong phần dọn dẹp, nên quy tắc này bị gỡ ngòi ở phần
lớn kho mã mà không ai nhận ra.

**Cửa 3 — đọc mà không khẳng định.** *Quy tắc không bắt.*

```ts
it("thanh toán xong thì ghi danh mở", async () => {
  await request(app.getHttpServer()).post("/checkout").send({ courseId }).expect(201)

  const rows = await entityManager.find(EnrollmentEntity, { where: { courseId } })
  expect(true).toBe(true)   // `rows` không bao giờ được kiểm
})
```

**Cửa 4 — trùng chữ ở tên thuộc tính.** *Quy tắc không bắt.*

```ts
const config = { dataSource: "primary" }   // thuộc tính không tính toán cũng là Identifier
```

**Nhầm lẫn hay gặp — báo nhầm trên một lần đọc thật.** Đoạn dưới đọc trạng thái đàng hoàng nhưng vẫn
bị báo, vì không tên nào thuộc sáu tên trong danh sách:

```ts
const repo = app.get(getRepositoryToken(EnrollmentEntity))
const enrollment = await repo.findOneOrFail({ where: { courseId } })
expect(enrollment.isEnrolled).toBe(true)
```

Cách rẻ nhất để dập là **đổi tên biến**, không phải thêm khẳng định. Quy tắc đo **từ vựng**, không đo
hành vi — và ai đổi tên để dập lint sẽ tưởng mình vừa sửa một lỗi.

---

## `no-model-call-in-e2e`

Chỉ chạy trên tệp kết thúc `.e2e-spec.ts`.

### SAI — nhập khẩu SDK nhà cung cấp

```ts
// content-ask.e2e-spec.ts
import OpenAI from "openai"

const client = new OpenAI({ apiKey: process.env.API_KEY })
```

### SAI — nhập khẩu trợ giúp mô hình nội bộ bằng đường dẫn tương đối

```ts
// content-ask.e2e-spec.ts
import { models } from "../helpers/models.service"
```

Mẫu hậu tố **cố ý không neo đầu**, đúng vì tệp luồng nằm cạnh thư mục trợ giúp và đây mới là đường
dẫn nó thật sự viết.

### ĐÚNG — giữ thật phần điều phối, chỉ giả kết quả bên ngoài

```ts
// content-ask.e2e-spec.ts
aiInvoke.run.mockResolvedValue({
  text: JSON.stringify({
    answer: "Một bao đóng giữ quyền truy cập phạm vi bao quanh sau khi phạm vi đó kết thúc.",
    citations: [{ contentId: CONTENT, quote: "phạm vi từ vựng" }],
    confidence: 0.82,
  }),
})

await ask(CONTENT, "bao đóng là gì?")

const session = await entityManager.findOneOrFail(SessionEntity, { where: { contentId: CONTENT } })
expect(session.turns).toHaveLength(1)
expect(await remainingQuota(learner.id)).toBe(startingQuota - 1)
```

Không nhập khẩu nhà cung cấp ⇒ quy tắc im. Bản giả trả JSON thật nên bộ phân tích cú pháp vẫn chạy —
**phần đó luật đòi, máy không kiểm được.**

### Cửa lách và nhầm lẫn

**Cửa 1 — nhập khẩu động hoặc `require`.** *Quy tắc không bắt. Luật vẫn cấm.*

```ts
// content-ask.e2e-spec.ts
const { default: OpenAI } = await import("openai")
const client = new OpenAI({ apiKey: process.env.API_KEY })
```

`ImportExpression` không phải `ImportDeclaration`. `require("openai")` là `CallExpression`. Không
visitor nào chạm tới cả hai.

**Cửa 2 — gọi thẳng qua mạng.** *Quy tắc không bắt.*

```ts
const response = await fetch("https://api.example-provider.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": process.env.API_KEY! },
  body: JSON.stringify({ model: "large", messages }),
})
```

Đây là một lời gọi mô hình thật, tốn tiền thật, chậm thật, và không có dòng nhập khẩu nào để bắt.

**Cửa 3 — chạm tới mô hình mà không nhập khẩu gì.** *Quy tắc không bắt, và đây là cửa nguy hiểm nhất
trên cả kệ.*

```ts
// content-ask.e2e-spec.ts — không ai đặt bản giả, cổng thật lấy từ vùng chứa ứng dụng
const aiInvoke = app.get(AiInvokeService)
await ask(CONTENT, "bao đóng là gì?")   // đi thẳng ra nhà cung cấp thật
```

Luật nói *một luật phải nhờ trí nhớ là một luật chỉ cách một buổi chiều đãng trí*. Chính hình dạng
quên-đặt-bản-giả đó **không có quy tắc nào canh**.

**Cửa 4 — trợ giúp đổi tên.** *Quy tắc không bắt.*

```ts
import { models } from "../helpers/llm-client"      // hậu tố không phải "models"
import { models } from "../helpers/models/index"    // kết thúc bằng "index"
```

**Nhầm lẫn hay gặp.** Hai danh sách gói trong cùng một tệp nguồn **không khớp nhau**: danh sách cấm
của quy tắc này thiếu một gói mà danh sách chấp nhận của quy tắc harness lại có. Cùng một dòng nhập
khẩu vừa hợp lệ ở harness vừa không bị cấm ở luồng.

---

## `e2e-uses-production-transport`

Chỉ chạy trên tệp kết thúc `.e2e-spec.ts`. Quy tắc này báo **hai** thông báo khác nhau.

### SAI — nhập khẩu bộ điều phối ứng dụng

```ts
// enroll.e2e-spec.ts
import { CommandBus, QueryBus } from "@nestjs/cqrs"
```

Báo một lần cho mỗi định danh.

### SAI — gọi thẳng vào trong ứng dụng

```ts
// enroll.e2e-spec.ts
const bus = app.get(CommandBus)
await bus.execute(new EnrollCommand(userId, courseId))
```

Báo vì tên phương thức là `execute`. Phép kiểm dựa vào **tên phương thức**, nên lấy bus ra bằng
`app.get` không thoát được.

### ĐÚNG — đi qua cửa mà sản xuất đi

```ts
// enroll.e2e-spec.ts
await request(app.getHttpServer())
  .post("/graphql")
  .send({ query: ENROLL_MUTATION, variables: { courseId } })
  .expect(200)

const enrollment = await entityManager.findOneOrFail(EnrollmentEntity, { where: { courseId } })
expect(enrollment.isEnrolled).toBe(true)
```

Định tuyến, bảo vệ, kiểm tra hợp lệ và tuần tự hoá đều nằm trong chứng minh.

### ĐÚNG — bí danh khi nhập khẩu vẫn bị bắt, nên đừng thử

```ts
import { CommandBus as Bus } from "@nestjs/cqrs"   // vẫn báo: đọc tên phía gói, không đọc bí danh
```

### Cửa lách và nhầm lẫn

**Cửa 1 — thuộc tính tính toán.** *Quy tắc không bắt. Luật vẫn cấm.*

```ts
await bus["execute"](new EnrollCommand(userId, courseId))

const method = "execute"
await bus[method](new EnrollCommand(userId, courseId))
```

Quy tắc thoát ngay khi `computed` là đúng.

**Cửa 2 — mọi lối vào nội bộ khác.** *Quy tắc không bắt.*

```ts
await eventBus.publish(new EnrollmentOpenedEvent(userId, courseId))   // "publish"
await handler.handle(new EnrollCommand(userId, courseId))             // "handle"
await resolver.enroll({ courseId }, contextWithUser)                  // tên nghiệp vụ
await enrollService.enroll(userId, courseId)                          // gọi thẳng service
```

Đẩy thẳng một sự kiện lên bus là vào **đúng chỗ** luật cấm. Tập chỉ có hai tên phương thức.

**Cửa 3 — bus nhập khẩu từ nơi khác.** *Quy tắc không bắt.*

```ts
import * as cqrs from "@nestjs/cqrs"       // ImportNamespaceSpecifier: bị bỏ qua
import { CommandBus } from "@app/shared"   // barrel tái xuất khẩu: chuỗi gói không khớp
```

Phép kiểm nhập khẩu là **so bằng đúng chuỗi**.

**Nhầm lẫn hay gặp — báo nhầm trên đúng hai chữ đó.** Cả ba dòng dưới đều bị báo dù không dòng nào là
lối vào ứng dụng:

```ts
const [rows] = await connection.execute("SELECT is_enrolled FROM enrollment WHERE id = ?", [id])
queue.process(async (job) => handleJob(job))
const result = await testClient.execute(document, variables)
```

Dòng đầu còn oái oăm hơn: nó đang **đọc trạng thái về**, tức là làm đúng thứ quy tắc
`e2e-asserts-persisted-state` đòi. Quy tắc không nhìn kiểu nên không phân biệt được nội bộ ứng dụng
với thư viện, và cách dập nhanh nhất là đổi một lời gọi hợp lệ sang tên khác.

---

## `harness-calls-provider-directly`

Chạy trên tệp kết thúc `.harness-spec.ts`, **và** trên tệp trợ giúp nằm trong `/src/tests/helpers/`
— nhưng trong tệp trợ giúp **chỉ** phép kiểm chứng thư chạy.

### SAI — không nhập khẩu SDK nào được chấp nhận

```ts
// grading.harness-spec.ts
import { gradeSubmission } from "../services/grading"

it("chấm bài đạt ngưỡng", async () => {
  expect(await gradeSubmission(submission)).toBeGreaterThanOrEqual(PASSING)
})
```

Báo `missingProvider` ở cuối tệp.

### SAI — giả trang cổng sản xuất

```ts
// grading.harness-spec.ts
import { createHarnessInvoke } from "../helpers/harness-invoke"   // báo: trợ giúp bị cấm

const module = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(AiInvokeService)                              // báo: ghi đè cổng
  .useValue(liveAdapter)
  .compile()
```

### SAI — chứng thư của người dùng cuối

```ts
// grading.harness-spec.ts
const token = process.env["CLAUDE_CODE_OAUTH_TOKEN"]   // báo: chuỗi hằng khớp danh sách
```

### ĐÚNG — gọi thẳng SDK, khoá API máy chủ, một ca

```ts
// grading.harness-spec.ts
import Anthropic from "@anthropic-ai/sdk"
import { gradingPrompt, scoreFrom } from "../services/grading"

const client = new Anthropic({ apiKey: requiredEnv("HARNESS_API_KEY") })

it("chấm bài đạt ngưỡng", async () => {
  const message = await client.messages.create({
    model: HARNESS_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: gradingPrompt(submission) }],
  })
  expect(scoreFrom(message)).toBeGreaterThanOrEqual(PASSING)
})
```

Dùng lại bộ dựng lời nhắc và bộ đọc điểm của sản xuất là hợp lệ; chỉ lời gọi mới phải thẳng.

### Cửa lách và nhầm lẫn

**Cửa 1 — dòng nhập khẩu không dùng cũng thoả mãn.** *Quy tắc không bắt. Luật vẫn cấm.*

```ts
// grading.harness-spec.ts
import "openai"                                  // không dùng, chỉ để bật cờ
import { gradeSubmission } from "./judge-client" // trợ giúp đổi tên, ngoài danh sách cấm

it("chấm bài đạt ngưỡng", async () => {
  expect(await gradeSubmission(submission)).toBeGreaterThanOrEqual(PASSING)
})
```

Quy tắc chứng minh **có một dòng nhập khẩu**, không chứng minh **SDK được gọi**. Cả tệp này sạch lint
mà không có lời gọi nhà cung cấp nào.

**Cửa 2 — chứng thư đọc theo cách thông thường.** *Quy tắc không bắt.*

```ts
const token = process.env.CLAUDE_CODE_OAUTH_TOKEN        // thuộc tính là Identifier, không phải Literal
const header = `Bearer ${process.env.CLAUDE_CODE_OAUTH_TOKEN}`  // mảnh chuỗi là TemplateElement
```

Chỉ dạng ngoặc vuông mới là chuỗi hằng. Dạng chấm — dạng người ta viết hằng ngày — vô hình.

**Cửa 3 — cổng khoác kiểu hoặc mã thông báo khác.** *Quy tắc không bắt.*

```ts
const fake: Partial<AiInvokeService> = { run: async () => ({ text: "..." }) }

interface FakeInvoke { run(input: unknown): Promise<{ text: string }> }

const module = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(AI_INVOKE_TOKEN)     // mã thông báo, không phải tên lớp
  .useValue(fake)
  .compile()
```

Phép quét token tìm **đúng** chuỗi ba token `Pick` `<` `AiInvokeService`. `Partial<...>`, `Omit<...>`
và một `interface` tự viết đều đi qua.

**Cửa 4 — trợ giúp nằm ngoài đúng một thư mục thì ngoài tầm hoàn toàn.** *Quy tắc không bắt.*

```ts
// test/helpers/auth.ts — không phải "/src/tests/helpers/", nên không phép kiểm nào chạy
export const token = "CLAUDE_CODE_OAUTH_TOKEN"
```

Cấm một **thư mục** không phải cấm một **tệp**: cùng đoạn mã đó, đặt dưới một gốc khác, là hợp lệ với
máy.

**Nhầm lẫn hay gặp.** Trong tệp trợ giúp hợp lệ (`/src/tests/helpers/`), ba nhánh kia đều khoá theo
làn harness — nên một tệp trợ giúp có thể nhập khẩu và tái xuất khẩu chính lớp cổng mà không bị báo
gì; chỉ có chuỗi chứng thư là bị soi.

---

## Ánh xạ yêu cầu sang một quy tắc

| Yêu cầu bằng lời | Quy tắc nổ | Mã luật | Cách sửa |
|---|---|---|---|
| "Spec này chỉ toàn `toHaveBeenCalled`" | `no-call-only-spec` | `TESTING-6` | Khẳng định giá trị trả ra hoặc trạng thái đã đổi; giữ khẳng định lời gọi làm khẳng định thứ hai |
| "e2e chỉ kiểm mã trạng thái" | `e2e-asserts-persisted-state` | `TESTING-2` | Đọc hàng, số dư hoặc quyền lợi ra khỏi cơ sở dữ liệu rồi khẳng định lên **cái đó** |
| "e2e nhập khẩu SDK nhà cung cấp" | `no-model-call-in-e2e` | `TESTING-9` | Đặt bản giả cho kết quả bên ngoài, giữ thật phần điều phối, khẳng định hạn mức và lưu trữ |
| "e2e gọi `commandBus.execute`" | `e2e-uses-production-transport` | `TESTING-3` | Vào bằng GraphQL, HTTP, socket thật, thông điệp broker hoặc ranh giới lịch chạy |
| "harness chạy qua cổng sản xuất" | `harness-calls-provider-directly` | `TESTING-10` | Gọi thẳng SDK đã khai báo, khoá API máy chủ đọc từ biến môi trường riêng của harness |
| "harness dùng phiên đăng nhập của công cụ dòng lệnh" | `harness-calls-provider-directly` | `TESTING-10` | Đọc một khoá API do nhà cung cấp cấp, không dùng chứng thư người dùng cuối |
| "e2e đặt tên theo nhóm resolver" | *không quy tắc nào* | `TESTING-1` | Người đọc phải bắt; xem [`audit.md`](./audit.md) |
| "một làn được cấu hình nhưng rỗng" | *không quy tắc nào* | `TESTING-8` | Người đọc phải bắt; xem [`audit.md`](./audit.md) |

## Bảng phân định ranh giới

| Ranh giới | Câu hỏi phân định |
|---|---|
| `no-call-only-spec` nổ / im | Trong **cả tệp** có đúng một khẳng định nào không phải về lời gọi không? |
| `e2e-asserts-persisted-state` nổ / im | Trong **cả tệp** có xuất hiện một trong sáu cái tên đó không — kể cả ở dòng nhập khẩu? |
| `no-model-call-in-e2e` nổ / im | Có một `ImportDeclaration` **tĩnh** khớp danh sách không? Gọi động và gọi mạng đều nằm ngoài. |
| `e2e-uses-production-transport` — hai thông báo | Nhập khẩu bus ⇒ `busImport`; tên phương thức `execute`/`process` không tính toán ⇒ `direct`, bất kể đối tượng là gì. |
| `harness-calls-provider-directly` — làn hay phạm vi | Tệp là `.harness-spec.ts` (bốn phép kiểm) hay tệp trợ giúp trong `/src/tests/helpers/` (chỉ phép kiểm chứng thư)? |
| Quy tắc im / tệp đúng | Quy tắc im chỉ chứng minh tệp không trình ra đúng hình dạng nó nhìn được. Đối chiếu tiếp với luật bằng mắt người. |

## Sai lầm lặp lại nhiều nhất

1. Đọc "lint xanh" thành "bài kiểm thử đúng". Sáu mã luật không có quy tắc nào, và năm quy tắc còn
   lại đều có cửa mở.
2. Thêm một `expect(x).toBeDefined()` cho "đủ lệ bộ" — và gỡ ngòi quy tắc call-only cho cả tệp.
3. Đổi tên biến để dập `e2e-asserts-persisted-state` thay vì thêm một khẳng định thật.
4. Tưởng `import { DataSource }` là chứng cứ tệp có đọc trạng thái.
5. Đổi tên tệp sang `.test.ts` hoặc dời hậu tố, rồi tưởng luật vẫn còn được canh.
6. Viết một dòng vô hiệu hoá không nêu lý do — tức là xoá luật, xoá dần từng tệp một.
7. Dập `e2e-uses-production-transport` bằng cách đổi tên một lời gọi thư viện hợp lệ, thay vì dời lối
   vào ra cửa sản xuất.
8. Đặt `import "openai"` cho harness xanh trong khi harness không hề gọi nhà cung cấp nào.
