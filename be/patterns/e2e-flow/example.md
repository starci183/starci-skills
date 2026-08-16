---
id: be-patterns-e2e-flow-example
title: example.md
slug: /be/patterns/e2e-flow/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã E2E-N, viết bằng TypeScript thường theo hình dạng một spec framework.
---

# example.md

> Version: `2.00` · Module: `e2e-flow` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường**, có hình dạng một spec của framework DI quen thuộc: một
`describe`, các `it` xếp theo thứ tự, một entity manager, một queue và một socket. Không dùng tên sản
phẩm, tên repository hay tên module riêng. Nơi luật gốc gọi tên một service nội bộ, ở đây service đó
được gọi bằng **vai trò** — vì vai trò có thể chuyển sang hệ thống khác, còn tên riêng thì không.

Mỗi mã có **nhiều case**; mỗi case đặt **ĐÚNG** cạnh **SAI**, sau đó là mục **Ngoại lệ và nhầm lẫn**.
Cuối trang là phần ánh xạ từ một yêu cầu bằng lời sang một quyết định, bảng phân định ranh giới và
danh sách những sai lầm lặp lại nhiều nhất.

---

## `E2E-1` — một file, một câu nghiệp vụ

### Case: tên file và `describe` nói cùng một câu

```ts
// file: course-purchase.e2e-spec.ts
describe("a learner buys a course and can start it",
    () => {
        // ...
    })
```

```ts
// SAI — file: enrollment-resolver.e2e-spec.ts
// Tên đặt theo một nhóm resolver. Xoá file này thì không lời hứa nghiệp vụ nào mất người canh,
// chỉ có một lớp kỹ thuật mất coverage.
describe("EnrollmentResolver",
    () => {
        // ...
    })
```

Hai bên khác nhau đúng một chỗ: bên trái nói **cái gì được hứa**, bên phải nói **code nào được gọi**.

### Case: một file, một câu — không gộp hai câu vào một file

```ts
// file: course-refund.e2e-spec.ts
describe("a learner refunds a course and loses access to it",
    () => {
        // ...
    })
```

```ts
// SAI — hai câu nghiệp vụ trong một file. Khi nó đỏ, "purchase and refund" không nói được
// vế nào vỡ, và hai vế có vòng đời khác nhau: một vế đổi thì file của vế kia cũng phải review.
describe("purchase and refund",
    () => {
        describe("purchase", () => { /* ... */ })
        describe("refund", () => { /* ... */ })
    })
```

### Case: tên file phải đọc được bởi người không viết nó

```ts
// file: notification-delivery.e2e-spec.ts
describe("a notification reaches its recipient and nobody else",
    () => {
        // ...
    })
```

```ts
// SAI — tên hạ tầng. "app" không phải một câu nghiệp vụ, và file này sẽ dần trở thành
// bãi chứa mọi thứ chưa biết để đâu.
// file: app.e2e-spec.ts
describe("app",
    () => {
        // ...
    })
```

### Ngoại lệ và nhầm lẫn

- **Một câu dài không có nghĩa là hai câu.** *"mua khoá học rồi bắt đầu học được"* vẫn là **một** lời
  hứa: mua mà không học được thì lời hứa vỡ. Đó là một file.
- **Tên file trùng tên module không tự động sai** — nó chỉ sai khi *nội dung* file được tổ chức theo
  module thay vì theo câu nghiệp vụ.

---

## `E2E-2` — chuỗi bước có tên

### Case: mỗi chặng nghiệp vụ là một `it`

```ts
describe("a learner buys a course and can start it",
    () => {
        let world: FlowWorld
        let learner: UserEntity
        let orderId: string

        beforeAll(async () => {
            world = await bootWorld()
            learner = await world.mintLearner("buyer")
        })

        it("puts the course in the cart",
            async () => {
                await world.graphql(learner).addToCart({ courseId: COURSE_ID })
                const size = await world.entityManager.count(CartItemEntity,
                    { where: { userId: learner.id } })
                expect(size).toBe(1)
            })

        it("checks out and leaves the order pending",
            async () => {
                orderId = (await world.graphql(learner).checkout()).orderId
                const order = await world.entityManager.findOneOrFail(TransactionEntity,
                    { where: { id: orderId } })
                expect(order.status).toBe(TransactionStatus.Pending)
            })

        it("opens the enrolment when the gateway reports the order captured",
            async () => {
                await world.http().post("/webhooks/gateway",
                    { orderId, status: "PAID" })
                await until(() => world.entityManager.exists(EnrolmentEntity,
                    { where: { userId: learner.id, courseId: COURSE_ID } }),
                { describe: "the enrolment to open after the captured webhook" })
            })
    })
```

```ts
// SAI — một case ôm cả flow. Nó cho đúng MỘT dòng đỏ cho ba chặng, và người đọc phải
// đếm ngược trong đầu xem dòng nào đã chạy.
it("buys a course",
    async () => {
        await world.graphql(learner).addToCart({ courseId: COURSE_ID })
        const orderId = (await world.graphql(learner).checkout()).orderId
        await world.http().post("/webhooks/gateway",
            { orderId, status: "PAID" })
        await until(() => world.entityManager.exists(EnrolmentEntity,
            { where: { userId: learner.id, courseId: COURSE_ID } }))
        expect(await world.entityManager.count(CartItemEntity,
            { where: { userId: learner.id } })).toBe(0)
    })
```

Hai bên khác nhau đúng một chỗ: **dòng đỏ có tên bước hay không**.

### Case: state dùng chung khai ở scope `describe`, gán ở bước tạo ra nó

```ts
describe("a submission is graded and the score is persisted",
    () => {
        let submissionId: string

        it("accepts the submission",
            async () => {
                submissionId = (await world.graphql(learner).submit({ challengeId: CHALLENGE_ID })).id
                expect(submissionId).toEqual(expect.any(String))
            })

        it("persists the grade the runner produced",
            async () => {
                await until(() => world.entityManager.exists(GradeEntity,
                    { where: { submissionId } }),
                { describe: "the grade row for the accepted submission" })
            })
    })
```

```ts
// SAI — bước sau tự đi tìm lại state bằng một truy vấn "gần đúng". Chạy song song với
// một flow khác là nó bắt nhầm hàng của người khác.
it("persists the grade",
    async () => {
        const latest = await world.entityManager.findOne(SubmissionEntity,
            { order: { createdAt: "DESC" } })
        await until(() => world.entityManager.exists(GradeEntity,
            { where: { submissionId: latest?.id } }))
    })
```

### Ngoại lệ và nhầm lẫn

- **Một câu nghiệp vụ thật sự một bước thì một `it`.** Đây là lý do không rule nào đếm `it`:

  ```ts
  describe("an expired session is rejected at the gateway",
      () => {
          it("rejects the expired session and writes no row",
              async () => {
                  const response = await world.graphql(expiredLearner).me()
                  expect(response.errors?.[0]?.extensions?.code).toBe("SESSION_EXPIRED")
                  expect(await world.entityManager.count(SessionEntity,
                      { where: { userId: expiredLearner.id } })).toBe(0)
              })
      })
  ```

- **Bước phụ thuộc bước trước là hợp lệ ở đây, và chỉ ở đây.** Nó không cho phép phụ thuộc **xuyên
  file**:

  ```ts
  // SAI — file này giả định file kia đã chạy trước. Chạy lẻ một file là đỏ, và thứ tự
  // file không phải một hợp đồng.
  it("continues the flow started in course-purchase.e2e-spec.ts",
      async () => { /* ... */ })
  ```

---

## `E2E-3` — poll trạng thái, kèm deadline

### Case: deadline là một assertion

```ts
// Deadline nói ra một tuyên bố về hệ thống: "việc này lắng trong mười giây". Khi hết hạn,
// thông điệp gọi tên THỨ đã chờ.
await until(() => world.entityManager.exists(EnrolmentEntity,
    { where: { userId: learner.id, courseId: COURSE_ID } }),
{
    timeout: 10_000,
    describe: "the enrolment to open after the captured webhook",
})
```

```ts
// SAI — đỏ khi broker bận, chậm ở mọi lần chạy không bận, và cách sửa ai cũng với tay
// tới là đổi 500 thành 2000, thứ không mua được đúng đắn lẫn tốc độ.
await sleep(500)
expect(await world.entityManager.exists(EnrolmentEntity,
    { where: { userId: learner.id, courseId: COURSE_ID } })).toBe(true)
```

Hai bên khác nhau đúng một chỗ: **lần chờ bị chặn bởi kết cục hay bởi một phỏng đoán**.

### Case: sleep đội tên khác vẫn là sleep

```ts
await until(() => queue.getCompletedCount() === 1,
    { describe: "the mail job to reach completed" })
```

```ts
// SAI — cả bốn đều là chờ một THỜI LƯỢNG. Đổi tên hàm không đổi bản chất, và rule bắt
// đúng cả bốn tên này.
await delay(300)
await wait(300)
await pause(300)
await new Promise((resolve) => setTimeout(resolve,
    300))
```

### Case: predicate được phép ném khi state chưa tới

```ts
// `findOneOrFail` ném khi row chưa tồn tại. Đó là "chưa tới", không phải "hỏng" —
// chỉ deadline mới làm bước đỏ.
await until(async () => {
    const order = await world.entityManager.findOneOrFail(TransactionEntity,
        { where: { id: orderId } })
    return order.status === TransactionStatus.Captured
},
{ describe: "the order to reach captured" })
```

```ts
// SAI — bắt lỗi rồi nuốt, nên khi hết hạn không ai biết đã chờ cái gì và vì sao.
try {
    await sleep(2_000)
    const order = await world.entityManager.findOneOrFail(TransactionEntity,
        { where: { id: orderId } })
    expect(order.status).toBe(TransactionStatus.Captured)
} catch {
    // "chắc chưa kịp"
}
```

### Case: chờ trên sổ sách của seam ngoài vẫn là poll một trạng thái

```ts
await until(() => enqueueEnrolment.enqueueForTransaction.mock.calls.length === 1,
    { describe: "the enrolment hand-off to be enqueued exactly once" })
```

```ts
// SAI — cùng một ý định, nhưng đo bằng đồng hồ. Nếu hand-off xảy ra HAI lần, bước này
// vẫn xanh, vì nó chưa bao giờ nói ra con số nó mong đợi.
await sleep(1_000)
expect(enqueueEnrolment.enqueueForTransaction).toHaveBeenCalled()
```

### Ngoại lệ và nhầm lẫn

- **Khoảng im lặng của `E2E-6` là ngoại lệ duy nhất.** Sự vắng mặt chỉ đo được bằng thời gian:

  ```ts
  await expectNoMessage(strangerSocket,
      "notification",
      { within: 1_000 })
  ```

- **Deadline không có `describe` là nửa vời:**

  ```ts
  // SAI — hết hạn thì thông điệp chỉ nói "timeout of 10000ms exceeded", đúng thứ mà cả
  // luật này sinh ra để tránh.
  await until(() => world.entityManager.exists(EnrolmentEntity,
      { where: { userId: learner.id } }))
  ```

---

## `E2E-4` — đọc hệ quả ở nơi nó sống

### Case: row là hệ quả, envelope thì không

```ts
it("credits the balance when the top-up settles",
    async () => {
        await world.http().post("/webhooks/gateway",
            { orderId, status: "PAID" })
        await until(async () => {
            const wallet = await world.entityManager.findOneOrFail(WalletEntity,
                { where: { userId: learner.id } })
            return wallet.balance === startingBalance + TOP_UP_AMOUNT
        },
        { describe: "the wallet balance to reflect the settled top-up" })
    })
```

```ts
// SAI — chứng minh server đã trả lời, và chỉ thế. Handler ghi nhầm ví của người khác
// thì bước này vẫn xanh.
it("credits the balance",
    async () => {
        const response = await world.http().post("/webhooks/gateway",
            { orderId, status: "PAID" })
        expect(response.status).toBe(200)
    })
```

### Case: hệ quả của một mutation GraphQL nằm ở row, không nằm ở `data`

```ts
it("closes the enrolment when the refund is approved",
    async () => {
        await world.graphql(admin).approveRefund({ orderId })
        const enrolment = await world.entityManager.findOneOrFail(EnrolmentEntity,
            { where: { userId: learner.id, courseId: COURSE_ID } })
        expect(enrolment.revokedAt).not.toBeNull()
    })
```

```ts
// SAI — `data.approveRefund.success` là thứ resolver TỰ NÓI về mình. Nó không phải bằng
// chứng, nó là lời khai.
it("closes the enrolment",
    async () => {
        const response = await world.graphql(admin).approveRefund({ orderId })
        expect(response.data.approveRefund.success).toBe(true)
    })
```

### Case: hệ quả có nhiều nơi sống thì đọc đủ

```ts
it("grants access and records the ledger line",
    async () => {
        await until(() => world.entityManager.exists(EnrolmentEntity,
            { where: { userId: learner.id, courseId: COURSE_ID } }),
        { describe: "the enrolment row" })

        const line = await world.entityManager.findOneOrFail(LedgerEntity,
            { where: { orderId } })
        expect(line.amount).toBe(COURSE_PRICE)
        expect(line.direction).toBe(LedgerDirection.Credit)
    })
```

```ts
// SAI — mở quyền học nhưng không ghi sổ là một lỗi kế toán im lặng. Đọc một nửa hệ quả
// là canh một nửa lời hứa.
it("grants access",
    async () => {
        await until(() => world.entityManager.exists(EnrolmentEntity,
            { where: { userId: learner.id, courseId: COURSE_ID } }))
    })
```

### Ngoại lệ và nhầm lẫn

- **Envelope vẫn được khẳng định — như một điều kiện, không như hệ quả.** Kiểm `errors` rỗng để bước
  sau không đọc nhầm sự im lặng của một lỗi, rồi vẫn đọc row.
- **Rule chỉ giữ được nửa.** `e2e-asserts-persisted-state` chỉ thấy được rằng file **có** đọc state
  bền vững ở đâu đó. File dưới đây **qua** rule và vẫn sai `E2E-4`:

  ```ts
  it("checks out",
      async () => {
          const response = await world.graphql(learner).checkout()
          expect(response.data.checkout.orderId).toEqual(expect.any(String))
      })

  it("cleans up",
      async () => {
          await world.entityManager.query("SELECT 1")
      })
  ```

  Lần đọc duy nhất chẳng khẳng định hệ quả nào. Nửa còn lại là việc của người đọc.

---

## `E2E-5` — realtime: cái gì đã tới, tới ai

### Case: chờ tin kế tiếp khớp predicate, khẳng định nội dung và người nhận

```ts
it("delivers the message to the member watching the room",
    async () => {
        const delivered = nextMessage<ChatSocketMessage>(memberSocket,
            "chat.message",
            (payload) => payload.roomId === roomId)

        await world.graphql(author).sendMessage({ roomId, body: "shipped" })

        const message = await delivered
        expect(message.body).toBe("shipped")
        expect(message.authorId).toBe(author.id)
    })
```

```ts
// SAI — số 2 mã hoá "hôm nay có bao nhiêu listener". Thêm một subscriber nữa thì một hệ
// thống ĐÚNG hoá đỏ; gửi sai payload cho đúng hai người thì một hệ thống HỎNG vẫn xanh.
expect(messageRecorder["chat.message"].length).toBe(2)
```

Hai bên khác nhau đúng một chỗ: **assertion nói về lời hứa hay nói về đường ống**.

### Case: đăng ký listener **trước** khi kích hoạt

```ts
// Promise được tạo trước, `await` sau. Nếu server phát nhanh hơn test đăng ký, tin không
// bị rơi vào khoảng trống.
const delivered = nextMessage<NotificationPayload>(recipientSocket,
    "notification",
    (payload) => payload.type === "ENROLMENT_OPENED")

await world.http().post("/webhooks/gateway",
    { orderId, status: "PAID" })

expect((await delivered).courseId).toBe(COURSE_ID)
```

```ts
// SAI — race. Đăng ký sau khi đã kích hoạt, rồi đổ lỗi cho "flaky".
await world.http().post("/webhooks/gateway",
    { orderId, status: "PAID" })
const delivered = await nextMessage(recipientSocket,
    "notification")
```

### Case: recorder tự reset bằng tay là nợ

```ts
// Helper trả về đúng N tin khớp predicate, tính từ lúc gọi. Không có state nào phải nhớ dọn.
const [first, second] = await nextMessages<ProgressPayload>(learnerSocket,
    "job.progress",
    2,
    (payload) => payload.jobId === jobId)

expect(first.percent).toBeLessThan(second.percent)
```

```ts
// SAI — một lần quên `recorder.reset()` là bước sau đếm cả sự kiện của bước trước, và
// lỗi đó chỉ hiện ra khi thêm bước thứ ba vào giữa.
recorder.reset()
await world.graphql(learner).startJob({ jobId })
expect(recorder.events.length).toBe(2)
```

### Ngoại lệ và nhầm lẫn

- **Khẳng định "không có tin thứ hai" không phải đếm.** Đó là `E2E-6`, và nó nói về **sự vắng mặt**,
  không về số lượng người nghe.
- **Một tin vừa được lưu vừa được phát là hai hệ quả ở hai nơi.** Đọc row là `E2E-4`, nhận socket là
  `E2E-5`; bỏ một trong hai là bỏ nửa lời hứa.

---

## `E2E-6` — phủ định là một phần của flow

### Case: người ngoài phòng phải im lặng

```ts
it("persists and emits the notification without leaking it to another socket",
    async () => {
        const delivered = nextMessage<NotificationPayload>(recipientSocket,
            "notification")
        const silence = expectNoMessage(strangerSocket,
            "notification",
            { within: 1_000 })

        await world.graphql(actor).notify({ userId: recipient.id })

        expect((await delivered).userId).toBe(recipient.id)
        await silence
    })
```

```ts
// SAI — file chỉ khẳng định thứ PHẢI tới. Một hệ thống phát mọi thứ cho mọi người sẽ qua
// sạch mọi case trong file, và không ai biết cho tới khi có người kể chuyện lạ.
it("notifies the recipient",
    async () => {
        const delivered = await nextMessage(recipientSocket,
            "notification")
        expect(delivered.userId).toBe(recipient.id)
    })
```

### Case: trước khi thanh toán lắng, quyền phải **đóng**

```ts
it("keeps the course closed while the order is pending",
    async () => {
        const response = await world.graphql(learner).lessonContent({ lessonId: LESSON_ID })
        expect(response.errors?.[0]?.extensions?.code).toBe("ENROLMENT_REQUIRED")
        expect(await world.entityManager.exists(EnrolmentEntity,
            { where: { userId: learner.id, courseId: COURSE_ID } })).toBe(false)
    })
```

```ts
// SAI — flow nhảy thẳng tới webhook. Nó không bao giờ chứng minh được rằng quyền học đã
// từng đóng, nên một hệ thống mở quyền ngay lúc đặt hàng vẫn xanh.
it("opens the course after payment",
    async () => {
        await world.http().post("/webhooks/gateway",
            { orderId, status: "PAID" })
        await until(() => world.entityManager.exists(EnrolmentEntity,
            { where: { userId: learner.id, courseId: COURSE_ID } }))
    })
```

### Case: webhook cho một tham chiếu lạ **không** được phát quyền

```ts
it("hands nothing off for a reference the gateway does not know",
    async () => {
        await world.http().post("/webhooks/gateway",
            { orderId: "unknown-reference", status: "PAID" })
        await expectNoChange(() => enqueueEnrolment.enqueueForTransaction.mock.calls.length,
            { within: 1_000, describe: "no enrolment hand-off for an unknown reference" })
    })
```

```ts
// SAI — không có bước này thì một handler bắt nhầm đơn gần nhất vẫn xanh suốt.
```

### Ngoại lệ và nhầm lẫn

- **Cửa sổ im lặng phải ngắn và phải nêu rõ.** Một giây đủ để chứng minh không rò; mười giây chỉ làm
  suite chậm mà không chứng minh thêm gì.
- **Phủ định cần một actor thứ hai có tên** (`E2E-9`). Không có `stranger` thì không có gì để chứng
  minh là đã **không** nhận.

---

## `E2E-7` — không rẽ nhánh trong một bước

### Case: ép điều kiện, rồi khẳng định vô điều kiện

```ts
it("re-sends the mail after the transport rejects it once",
    async () => {
        transport.send
            .mockRejectedValueOnce(new Error("smtp temporarily unavailable"))
            .mockResolvedValueOnce({ accepted: true })

        await world.queue("mail").add("send", { userId: learner.id })

        await until(() => transport.send.mock.calls.length === 2,
            { describe: "the mail transport to be called twice" })
        const job = await world.entityManager.findOneOrFail(JobEntity,
            { where: { userId: learner.id } })
        expect(job.status).toBe(JobStatus.Completed)
    })
```

```ts
// SAI — lần chạy đi vào nhánh `else` là một lần xanh chứng minh ÍT hơn, và không ai đọc
// được từ dòng đỏ rằng nhánh nào đã chạy.
it("re-sends the mail",
    async () => {
        const job = await world.entityManager.findOneOrFail(JobEntity,
            { where: { userId: learner.id } })
        if (job.status === JobStatus.Completed) {
            expect(transport.send).toHaveBeenCalledTimes(2)
        }
    })
```

### Case: hai kết cục hợp lệ là hai bước

```ts
it("accepts the first submission",
    async () => {
        const response = await world.graphql(learner).submit({ challengeId: CHALLENGE_ID })
        expect(response.data.submit.accepted).toBe(true)
    })

it("refuses the second submission within the cooldown",
    async () => {
        const response = await world.graphql(learner).submit({ challengeId: CHALLENGE_ID })
        expect(response.errors?.[0]?.extensions?.code).toBe("SUBMISSION_COOLDOWN")
    })
```

```ts
// SAI — ternary chỉ là `if` viết ngắn hơn, và nó giấu đi việc bước này chấp nhận cả hai
// kết cục.
const response = await world.graphql(learner).submit({ challengeId: CHALLENGE_ID })
expect(response.data ? response.data.submit.accepted : response.errors.length > 0).toBeTruthy()
```

### Case: `&&` đứng thành câu lệnh là một `if` giấu mặt

```ts
expect(order.status).toBe(TransactionStatus.Captured)
```

```ts
// SAI — khi `order` là `undefined`, không assertion nào chạy và bước vẫn xanh.
order && expect(order.status).toBe(TransactionStatus.Captured)
```

### Ngoại lệ và nhầm lẫn

- **Predicate của `until` được phép là một biểu thức điều kiện.** Nó là **thứ đang được chờ**, không
  phải một assertion có điều kiện:

  ```ts
  await until(() => job.status === JobStatus.Completed || job.status === JobStatus.Failed,
      { describe: "the job to reach a terminal status" })
  ```

  Nhưng ngay sau đó phải có một assertion nói ra **kết cục nào** flow này hứa.

- **`&&` bên trong một assertion không phải nhánh:**

  ```ts
  expect(order.status === TransactionStatus.Captured && order.paidAt !== null).toBe(true)
  ```

---

## `E2E-8` — một chỗ dựng thế giới lên

### Case: file flow mở đầu bằng thứ nó đang test

```ts
describe("a learner buys a course and can start it",
    () => {
        let world: FlowWorld
        let learner: UserEntity

        beforeAll(async () => {
            world = await bootWorld()
            learner = await world.mintLearner("buyer")
        })

        afterAll(async () => {
            await world.close()
        })

        it("puts the course in the cart",
            async () => { /* ... */ })
    })
```

```ts
// SAI — hai trăm dòng wiring trước dòng nghiệp vụ đầu tiên. Đổi một provider hạ tầng là
// sửa hai mươi lăm file, và không ai dám sửa cả hai mươi lăm cùng lúc.
beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
        imports: [
            ConfigModule.forRoot({ isGlobal: true }),
            TypeOrmModule.forRoot({ /* ... */ }),
            CqrsModule.forRoot(),
            ScheduleModule.forRoot(),
            /* ...và hai mươi module nữa... */
        ],
    })
        .overrideProvider(CacheService).useValue(cacheMock)
        .overrideProvider(EncryptionService).useValue(encryptionMock)
        .compile()
    app = moduleRef.createNestApplication()
    await app.init()
})
```

### Case: ghi đè một token, không sao chép cả thế giới

```ts
// Thế giới nhận thêm provider; framework resolve token trùng về bản đăng ký SAU CÙNG,
// nên một flow ghi đè đúng thứ nó cần và giữ nguyên phần còn lại thật.
world = await bootWorld({
    providers: [
        {
            provide: MODEL_CLIENT,
            useValue: scriptedModelClient([new Error("provider unavailable"), { text: "ok" }]),
        },
    ],
})
```

```ts
// SAI — chép cả hàm dựng thế giới sang file này để đổi một provider. Từ đây hai thế giới
// bắt đầu trôi khỏi nhau, và không ai biết chúng khác nhau chỗ nào.
const bootWorldButWithMyModelClient = async () => { /* bản sao 180 dòng */ }
```

### Ngoại lệ và nhầm lẫn

- **Hai entry point khác nhau là hợp lệ** khi chúng phục vụ hai loại lane — ví dụ một hàm dựng app
  đầy đủ và một hàm dựng world có broker thật. Hai **bản sao** của cùng một hàm thì không.
- **Không có lint giữ mã này**, vì nó là sự thật về **cây fixture của một repository**, không phải về
  một file.

---

## `E2E-9` — actor có tên, do flow tạo

### Case: mint theo tên vai trò

```ts
beforeAll(async () => {
    world = await bootWorld()
    buyer = await world.mintLearner("buyer")
    stranger = await world.mintLearner("stranger")
    reviewer = await world.mintLearner("reviewer")
})
```

```ts
// SAI — số thứ tự ma thuật. Nó không nói gì cho người đọc, và hai flow cùng chọn số 8 sẽ
// va nhau LẶNG LẼ: cả hai cùng đỏ, và cả hai cùng trông như lỗi của bên kia.
const buyer = await world.entityManager.findOneOrFail(UserEntity,
    { where: { accountNumber: 8 } })
```

### Case: actor phủ định phải tồn tại thì phủ định mới kiểm được

```ts
it("keeps the draft invisible to another learner",
    async () => {
        const response = await world.graphql(stranger).draft({ draftId })
        expect(response.errors?.[0]?.extensions?.code).toBe("NOT_FOUND")
    })
```

```ts
// SAI — chỉ có một actor trong cả file, nên mọi khẳng định về quyền riêng tư đều là
// khẳng định về chính chủ sở hữu.
it("keeps the draft private",
    async () => {
        const response = await world.graphql(owner).draft({ draftId })
        expect(response.data.draft.id).toBe(draftId)
    })
```

### Case: mỗi flow tự tạo actor, nên thứ tự file không quan trọng

```ts
// Mint ghi một row mới mỗi lần, nên hai file chạy song song không nhìn thấy nhau.
const mintLearner = async (name: string): Promise<UserEntity> =>
    entityManager.save(entityManager.create(UserEntity,
        {
            email: `${name}-${randomUUID()}@example.test`,
            displayName: name,
        }))
```

```ts
// SAI — actor dùng chung từ seed. Một flow đổi trạng thái của nó là flow khác đỏ, và dòng
// đỏ nằm ở file KHÔNG gây ra lỗi.
const learner = await world.entityManager.findOneOrFail(UserEntity,
    { where: { email: "seed-learner@example.test" } })
```

### Ngoại lệ và nhầm lẫn

- **Dữ liệu tham chiếu bất biến được phép dùng chung** — một khoá học seed chỉ để đọc thì không phải
  actor. Ranh giới là: **có ai ghi vào nó không**.
- **Tên phải là vai trò, không phải tên người.** `buyer`, `stranger`, `reviewer` nói ra vì sao actor
  đó có mặt; `an`, `binh` thì không.

---

## `E2E-10` — flow không log gì

### Case: tên bước đã là nhật ký

```ts
it("retries the membership request the provider rejected once",
    async () => {
        // ...
    })
```

```ts
// SAI — xanh thì không ai đọc, đỏ thì đẩy dòng assertion ra khỏi màn hình.
it("retries",
    async () => {
        console.log("starting retry test")
        const job = await world.entityManager.findOneOrFail(JobEntity,
            { where: { userId: learner.id } })
        console.log("job", job)
    })
```

### Case: cần nhìn state thì thêm assertion, không thêm log

```ts
const job = await world.entityManager.findOneOrFail(JobEntity,
    { where: { userId: learner.id } })
expect(job.attempts).toBe(2)
expect(job.status).toBe(JobStatus.Completed)
```

```ts
// SAI — log không bao giờ làm bước đỏ. Nó chỉ làm người đọc TƯỞNG mình đã kiểm tra.
logger.debug(`job attempts: ${job.attempts}`)
```

### Ngoại lệ và nhầm lẫn

- **Luật observability đã giữ mã này**, bằng `no-console` và `starci-be/no-framework-logger` phủ mọi
  call site. Module này không dựng thêm rule trùng.
- **Chuỗi chứa chữ `console.log` bên trong một chương trình được nộp đi chấm không phải logging:**

  ```ts
  const submittedProgram = "console.log('accepted')"
  await world.graphql(learner).submitCode({ challengeId: CHALLENGE_ID, source: submittedProgram })
  ```

---

## `E2E-11` — vào bằng cửa production, mọi chặng trong đều thật

### Case: đẩy qua queue thật, chứng minh retry và cạn lượt

```ts
it("persists terminal mail failure only after the queue exhausts retries",
    async () => {
        transport.send.mockRejectedValue(new Error("smtp down"))

        await world.queue("mail").add("send",
            { userId: learner.id },
            { attempts: 3, backoff: { type: "fixed", delay: 10 } })

        await until(async () => {
            const job = await world.entityManager.findOne(JobEntity,
                { where: { userId: learner.id } })
            return job?.status === JobStatus.Failed
        },
        { describe: "the mail job to fail terminally after three attempts" })
        expect(transport.send).toHaveBeenCalledTimes(3)
    })
```

```ts
// SAI — gọi thẳng worker. Serialization, khoá, ack, retry và cạnh tranh consumer biến mất,
// đúng những thứ mà flow này sinh ra để chứng minh.
const worker = app.get(MailWorker)
await worker.process({ data: { userId: learner.id } } as Job)
```

### Case: import worker để đăng ký là **đúng**

```ts
// Import để framework khám phá và đăng ký. Đây là ngoại lệ được nêu rõ.
world = await bootWorld({ imports: [MailWorkerModule] })

// rồi kích hoạt bằng cửa thật
await world.queue("mail").add("send",
    { userId: learner.id })
```

```ts
// SAI — resolve rồi gọi method nội bộ. Rule bắt đúng shape này.
const handler = app.get(EnrolmentHandler)
await handler.process(command)
```

### Case: đừng mượn bus để "đẩy flow đi cho nhanh"

```ts
await world.http().post("/webhooks/gateway",
    { orderId, status: "PAID" })
```

```ts
// SAI — bus là dispatcher NỘI BỘ. Vào bằng nó là bỏ qua guard, validation, mapping và
// mọi thứ mà cửa production làm trước khi lệnh tồn tại.
import {
    CommandBus,
} from "@nestjs/cqrs"

await app.get(CommandBus).execute(new SettleOrderCommand(orderId))
```

### Case: scheduler thật, không gọi tay method của nó

```ts
// Thế giới bật scheduler thật, và flow đẩy đồng hồ tới hạn.
world = await bootWorld({ imports: [SessionCleanupModule] })
await world.clock.advanceTo(expiryAt)
await until(() => world.entityManager.exists(SessionEntity,
    { where: { id: sessionId, revokedAt: Not(IsNull()) } }),
{ describe: "the scheduled cleanup to revoke the expired session" })
```

```ts
// SAI — gọi tay thì lịch, khoá chống chạy trùng và hành vi nhiều instance không được
// chứng minh gì cả.
await app.get(SessionCleanupService).run()
```

### Ngoại lệ và nhầm lẫn

- **Rule chỉ giữ nửa cú pháp.** Nó bắt import bus và lời gọi trực tiếp lên `*Worker` / `*Handler`.
  Việc flow có **thật sự vào bằng cửa production** hay không thì người đọc phải xác nhận.
- **Rule cũng bắt mọi `.execute()` và `.process()`**, kể cả trên một receiver hoàn toàn khác. Đây là
  false positive đã biết, ghi ở `audit.md`; cách xử lý là đổi tên helper của test, không phải tắt
  rule.

---

## `E2E-12` — ghi đè kết quả ngoài, không ghi đè chính sách trong

### Case: seam nằm ở client cụ thể của nhà cung cấp

```ts
// Bộ chọn nhà cung cấp, xoay khoá, cache sức khoẻ, entitlement và tính tiền đều THẬT.
// Chỉ kết quả của client ngoài được kịch bản hoá, theo thứ tự FIFO.
world = await bootWorld({
    providers: [
        {
            provide: MODEL_CLIENT,
            useValue: scriptedModelClient([
                new Error("provider unavailable"),
                { text: "answer", promptTokens: 12, completionTokens: 30 },
            ]),
        },
    ],
})
```

```ts
// SAI — mock chính bộ điều phối. Fallback, quy kết, rollback và idempotency không còn
// cách nào đỏ được, vì thứ quyết định chúng đã bị thay bằng một hằng số.
world = await bootWorld({
    providers: [
        { provide: ModelInvokeService, useValue: { invoke: async () => ({ text: "answer" }) } },
    ],
})
```

Hai bên khác nhau đúng một chỗ: **chính sách nội bộ có còn được chứng minh không**.

### Case: chứng minh fallback bằng cách ép client ngoài ném lỗi

```ts
it("falls back to the second provider and bills the one that answered",
    async () => {
        await world.graphql(learner).askTutor({ question: "why quorum?" })

        const usage = await world.entityManager.findOneOrFail(UsageEntity,
            { where: { userId: learner.id } })
        expect(usage.providerId).toBe(SECOND_PROVIDER_ID)
        expect(usage.credits).toBeGreaterThan(0)
    })
```

```ts
// SAI — import thẳng SDK. Bước này tốn tiền, mất vài giây, và trả lời khác nhau mỗi lần
// chạy, nên nó sẽ trở thành test bị bỏ qua trong vòng một tháng.
import OpenAI from "openai"

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
```

### Case: cổng thanh toán — đối soát và định tuyến hành động phải thật

```ts
it("grants the entitlement the reconciliation decided on",
    async () => {
        gatewayClient.verifySignature.mockReturnValue(true)
        gatewayClient.fetchOrder.mockResolvedValue({ orderId, status: "PAID", amount: COURSE_PRICE })

        await world.http().post("/webhooks/gateway",
            { orderId })

        await until(() => world.entityManager.exists(EnrolmentEntity,
            { where: { userId: learner.id, courseId: COURSE_ID } }),
        { describe: "the entitlement the reconciliation granted" })
    })
```

```ts
// SAI — mock đường phát quyền. Từ đây webhook nào cũng phát quyền, kể cả webhook không
// khớp số tiền, và đó chính là lỗ hổng flow này sinh ra để canh.
world = await bootWorld({
    providers: [
        { provide: GrantEntitlementService, useValue: { grant: jest.fn() } },
    ],
})
```

### Case: cùng một ranh giới cho mọi phụ thuộc ngoài

```ts
// IdP, SMTP, kho mã nguồn, sandbox chấm bài, bộ chuyển mã — tất cả đều là client ngoài.
identityClient.exchangeToken.mockResolvedValue({ accessToken: "…", expiresIn: 300 })
transport.send.mockResolvedValue({ accepted: true })
sandboxClient.run.mockResolvedValue({ exitCode: 0, stdout: "accepted" })
```

```ts
// SAI — mock service NỘI BỘ bọc quanh chúng. Ranh giới bị đẩy vào trong một nấc, và mỗi
// nấc đẩy vào là một tầng chính sách thôi được chứng minh.
world = await bootWorld({
    providers: [
        { provide: SessionService, useValue: { issue: jest.fn() } },
        { provide: GradingOrchestrator, useValue: { grade: jest.fn() } },
    ],
})
```

### Ngoại lệ và nhầm lẫn

- **Ném lỗi là kết quả ngoài, và được phép.** Đó là cách duy nhất chứng minh fallback mà không cần
  làm hỏng thật một nhà cung cấp.
- **Rule chỉ bắt import SDK.** Mock một orchestrator nội bộ không để lại import nào để bắt, nên nửa
  quan trọng hơn của mã này vẫn là việc của người đọc.

---

## Ánh xạ yêu cầu sang một quyết định

Hãy nêu câu nghiệp vụ, cửa vào, hệ quả và seam ngoài. Nếu thiếu **một** dữ kiện quyết định, hãy hỏi
**một** câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Test cái resolver ghi danh" | Yêu cầu nêu lớp kỹ thuật, không nêu lời hứa | `E2E-1` | Hỏi lại câu nghiệp vụ, rồi đặt tên file theo câu đó |
| "Webhook về thì mở quyền học, nhớ chờ một chút" | "Chờ một chút" là một thời lượng | `E2E-3` | `until(predicate, { timeout, describe })` |
| "Kiểm tra API trả 200" | Envelope không phải hệ quả | `E2E-4` | Đọc row hệ quả, giữ envelope làm điều kiện |
| "Xem có đúng hai người nhận không" | Số lượng là chi tiết fan-out | `E2E-5` | Chờ tin khớp predicate, khẳng định nội dung và người nhận |
| "Chỉ cần chắc người trong phòng nhận được" | Chưa có vế rò rỉ | `E2E-6` | Thêm actor `stranger` và một bước im lặng |
| "Job có thể đã chạy rồi thì bỏ qua" | Bỏ qua nghĩa là xanh mà rỗng | `E2E-7` | Ép trạng thái, khẳng định vô điều kiện |
| "Copy file flow cũ rồi sửa module import" | Wiring đang nhân bản | `E2E-8` | Ghi đè token trên hàm dựng thế giới chung |
| "Dùng tài khoản seed số 8" | Ordinal va nhau lặng lẽ | `E2E-9` | `mintLearner("buyer")` |
| "In ra payload cho dễ debug" | Log không làm bước đỏ | `E2E-10` | Thêm assertion, đặt tên bước rõ hơn |
| "Gọi thẳng worker cho nhanh" | Bỏ qua ack, khoá, retry | `E2E-11` | Đẩy vào queue thật; import worker chỉ để đăng ký |
| "Mock service điều phối cho ổn định" | Chính sách nội bộ biến mất | `E2E-12` | Kịch bản hoá client ngoài, giữ điều phối thật |
| "Test này chạm model thật cho giống production" | Tốn tiền, chậm, không tất định | `E2E-12` | Script seam ngoài; chất lượng model thuộc lane harness |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `E2E-1` / `E2E-2` | Đây là **một** lời hứa hay là **nhiều** lời hứa bị gom vào một file? |
| `E2E-2` / `E2E-7` | Hai kết cục này đều hợp lệ về nghiệp vụ, hay chỉ một cái là lời hứa? |
| `E2E-3` / `E2E-5` | Thứ đang chờ sống ở **store** hay bay qua **transport**? |
| `E2E-3` / `E2E-6` | Đang chờ một thứ **xảy ra**, hay đang quan sát một thứ **không xảy ra**? |
| `E2E-4` / `E2E-5` | Hệ quả này có row không? Có message không? Có cả hai không? |
| `E2E-5` / `E2E-6` | Đã có ai đứng ngoài để chứng minh không rò chưa? |
| `E2E-8` / `E2E-12` | Đây là **ghi đè một token**, hay là **sao chép cả thế giới**? |
| `E2E-11` / `E2E-12` | Câu hỏi là **đi vào bằng cửa nào**, hay **thay cái gì ở đầu kia**? |

## Sai lầm lặp lại nhiều nhất

1. Chờ bằng thời lượng, rồi tăng con số mỗi lần nó đỏ.
2. Khẳng định envelope và gọi đó là hệ quả nghiệp vụ.
3. Đếm message thay vì khẳng định nội dung và người nhận.
4. Không có bước phủ định nào trong cả file.
5. `if` quanh một assertion để "cho khỏi đỏ".
6. Gọi thẳng worker hoặc bus vì "vào bằng cửa thật thì chậm".
7. Mock service điều phối nội bộ để "test ổn định hơn".
8. Actor lấy từ seed dùng chung, rồi hai flow giẫm lên nhau.
9. Một `it` ôm cả flow, và một dòng đỏ cho mười một operation.
10. Chép hàm dựng thế giới sang file riêng để đổi đúng một provider.
11. `console.log` để lại sau một buổi debug.
12. Đăng ký listener **sau** khi đã kích hoạt, rồi gọi kết quả là flaky.
