---
id: be-patterns-testing-example
title: example.md
slug: /be/patterns/testing/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã TESTING-N, viết bằng TypeScript/NestJS thường.
---

# example.md

> Version: `2.00` · Module: `testing` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường trong một ứng dụng có cấu trúc kiểu NestJS**. Không tên sản phẩm, không
tên repository, không tên khoá học. Nghiệp vụ dùng làm nền là những thứ mọi back-end đều có: đơn
hàng, quyền truy cập, ví, hạn mức, bài nộp được chấm.

Mỗi mã có **nhiều case**; trong mỗi case, bản **ĐÚNG** được đặt cạnh **SAI**, rồi tới mục **Ngoại lệ và nhầm lẫn**.
Cuối trang là ánh xạ từ một yêu cầu bằng lời sang một lane và một mã.

Một lưu ý đọc suốt trang: hai đoạn ĐÚNG/SAI trong mỗi case **chỉ khác nhau đúng một điều**, và câu
ngay dưới nói điều đó là gì. Nếu bạn phải đọc kỹ mới thấy khác biệt, đó chính là lý do luật này tồn
tại — trên màn hình review, hai đoạn đó trông giống hệt nhau.

---

## `TESTING-1` — một file e2e là một câu chuyện nghiệp vụ

### Case: tên file quyết định file sẽ chứa gì

```ts
// ĐÚNG — order-checkout.e2e-spec.ts
// Tên là một câu về nghiệp vụ, nên người sau chỉ thêm được bước vào đúng câu chuyện đó.
describe("a paid checkout opens the entitlement and credits the wallet", () => {
    it("runs end to end", async () => {
        await addToCart(productId)
        const { orderId } = await checkout()
        await postProviderWebhook({ orderId, status: "PAID" })

        await until(async () => (await countEntitlements(userId, productId)) === 1)

        const entitlement = await entityManager.findOneOrFail(EntitlementEntity, {
            where: { user: { id: userId }, product: { id: productId } },
        })
        expect(entitlement.isActive).toBe(true)
        expect(await walletBalance(userId)).toBe(startingBalance + CHECKOUT_BONUS)
    })
})
```

```ts
// SAI — orders-queries.e2e-spec.ts
// Tên là một danh ngữ chỉ một phần của API. Không file nào mang hình dạng này nói được
// "nghiệp vụ chạy" — nó chỉ nói "vài endpoint có trả lời".
describe("orders queries", () => {
    it("orderById returns an order", async () => { /* … */ })
    it("myOrders returns a list", async () => { /* … */ })
    it("orderInvoice returns a URL", async () => { /* … */ })
})
```

Khác nhau đúng một điều: file đầu có thể **hỏng vì nghiệp vụ sai**; file sau chỉ hỏng khi endpoint
chết.

### Case: một flow bị xé thành một test mỗi endpoint

```ts
// ĐÚNG — một câu, ba bước, một lời hứa.
it("an installment falling due suspends access and reopens it on payment", async () => {
    await advanceClockPastDueDate(planId)
    await runDunningJob()

    await until(async () => (await accessState(userId)) === "SUSPENDED")

    await payInstallment(planId)
    await until(async () => (await accessState(userId)) === "ACTIVE")

    const plan = await entityManager.findOneOrFail(InstallmentPlanEntity, { where: { id: planId } })
    expect(plan.overdueCount).toBe(0)
})
```

```ts
// SAI — ba lời mô tả endpoint. Mỗi cái xanh, và không cái nào nói hệ thống làm được việc.
it("dunning job returns 200", async () => { /* … */ })
it("accessState query returns SUSPENDED", async () => { /* … */ })
it("payInstallment returns 200", async () => { /* … */ })
```

Khác nhau đúng một điều: ở bản SAI, không ai kiểm rằng ba bước **nối được vào nhau**.

### Case: tên trung thực lộ ra hình dạng sai

```ts
// SAI — tên file nói "một flow", nhưng thân file là một bộ sưu tập.
// rewards-redeem.e2e-spec.ts
it("listRewards returns items", async () => { /* … */ })
it("rewardById returns one item", async () => { /* … */ })
it("redeemReward returns 200", async () => { /* … */ })
```

Đây là ca khó nhất của `TESTING-1`: **tên đã đúng mà file vẫn sai**. Phép thử là viết ra câu trung
thực mô tả nội dung hiện tại — nếu câu đó là "vài query về reward" thì file đang ở sai hình dạng, và
sửa tên chỉ làm cho lỗi khó thấy hơn.

### Ngoại lệ và nhầm lẫn

- **Một flow có nhiều `it` là bình thường**, miễn các `it` là **các bước có tên** của cùng một câu
  chuyện chứ không phải các endpoint độc lập.
- **Đúng hậu tố không cứu được cái tên phía trước.** `TESTING-7` chỉ nói về hậu tố.
- **Query cũng có thể là flow**, nếu câu chuyện thật sự là "người đọc tìm ra thứ vừa được xuất bản":

  ```ts
  it("a newly published item becomes findable through search", async () => {
      const { itemId } = await publishItem({ title: "Rate limiting" })
      await until(async () => (await search("rate limiting")).some((hit) => hit.id === itemId))

      const indexed = await entityManager.findOneOrFail(SearchIndexEntity, { where: { itemId } })
      expect(indexed.state).toBe("INDEXED")
  })
  ```

  Cái làm nó thành flow không phải chữ "search", mà là **xuất bản rồi mới tìm** — có một hệ quả nối
  hai bước.

---

## `TESTING-2` — assert hệ quả, không assert phong bì

### Case: đọc lại state thay vì đọc lại response

```ts
// ĐÚNG — hệ quả được đọc ra từ nơi nó sống.
await postProviderWebhook({ orderId, status: "PAID" })
await until(async () => (await countEntitlements(userId, productId)) === 1)

const order = await entityManager.findOneOrFail(OrderEntity, { where: { id: orderId } })
expect(order.state).toBe("PAID")
expect(order.paidAt).not.toBeNull()
```

```ts
// SAI — chứng minh server còn sống, không chứng minh gì đã đổi.
const response = await postProviderWebhook({ orderId, status: "PAID" })
expect(response.status).toBe(200)
expect(response.body.data.__typename).toBe("OrderPayload")
```

Khác nhau đúng một điều: nếu handler im lặng ngừng ghi, bản trên đỏ và bản dưới xanh.

### Case: hệ quả là một event, không phải một hàng

```ts
// ĐÚNG — không phải hệ quả nào cũng là một row. Event đi ra cũng là state quan sát được.
const delivered = firstMessage(subscriber, "entitlement.opened")
await postProviderWebhook({ orderId, status: "PAID" })

expect((await delivered).payload.userId).toBe(userId)

const outbox = await entityManager.findOneOrFail(OutboxEntity, { where: { aggregateId: orderId } })
expect(outbox.publishedAt).not.toBeNull()
```

```ts
// SAI — đếm số message. Con số không nói message nào đã tới, và nó xanh cả khi sai loại event.
await postProviderWebhook({ orderId, status: "PAID" })
expect(subscriber.received).toHaveLength(1)
```

Khác nhau đúng một điều: bản dưới xanh khi hệ thống gửi **nhầm** event.

### Case: hệ quả âm — thứ đáng lẽ không được xảy ra

```ts
// ĐÚNG — một hệ quả âm vẫn phải được quan sát, và phải được quan sát trong một khoảng thời gian.
await postProviderWebhook({ orderId, status: "PAID" })
await postProviderWebhook({ orderId, status: "PAID" }) // webhook lặp

await until(async () => (await countEntitlements(userId, productId)) === 1)
await staysAbsent(async () => (await countEntitlements(userId, productId)) > 1, { silence: 1_000 })

expect(await walletBalance(userId)).toBe(startingBalance + CHECKOUT_BONUS) // cộng đúng một lần
```

```ts
// SAI — assert sự vắng mặt ngay lập tức. Nó đúng ở mọi hệ thống, kể cả hệ thống hỏng,
// vì lần ghi thứ hai còn chưa kịp xảy ra.
await postProviderWebhook({ orderId, status: "PAID" })
await postProviderWebhook({ orderId, status: "PAID" })
expect(await countEntitlements(userId, productId)).toBe(1)
```

Khác nhau đúng một điều: bản trên **quan sát sự vắng mặt trong một khoảng**, bản dưới chỉ chụp một
khoảnh khắc quá sớm.

### Ngoại lệ và nhầm lẫn

- **Flow thật sự không để lại state bền vững** thì cần disable **nêu tên thứ được quan sát thay
  thế**:

  ```ts
  // eslint-disable-next-line no-restricted-syntax -- flow chỉ có hệ quả là message trên socket;
  // assertion nằm ở `delivered.type` bên dưới, không có row nào để đọc.
  ```

  Không nêu được thứ thay thế thì đó không phải ngoại lệ, đó là test chưa xong.

- **`expect(response.body.errors).toBeUndefined()` không phải assertion.** Nó là một điều kiện tiên
  quyết. Viết được, nhưng nó không tính là hệ quả.
- **Đọc lại qua chính query vừa ghi cũng hợp lệ**, miễn nó đi qua read path thật:

  ```ts
  const refreshed = await graphql(`query { myEntitlements { productId } }`)
  expect(refreshed.data.myEntitlements).toContainEqual({ productId })
  ```

  Đây là "đọc lại từ nơi state sống" ở một tầng khác, không phải "đọc lại response của chính lệnh
  ghi".

---

## `TESTING-3` — test đi đúng đường mà flow đi

### Case: vào bằng cửa production, không vào bằng bus

```ts
// ĐÚNG — vào qua GraphQL, nên guard, pipe và serializer đều nằm trong phạm vi chứng minh.
const response = await request(app.getHttpServer())
    .post("/graphql")
    .set("Authorization", `Bearer ${token}`)
    .send({ query: CHECKOUT_MUTATION, variables: { cartId } })

expect(response.body.errors).toBeUndefined()
```

```ts
// SAI — bắt đầu sau routing, xác thực, validation và serialization. Bốn thứ đó có thể vỡ
// mà file này vẫn xanh.
import { CommandBus } from "@nestjs/cqrs"

const result = await commandBus.execute(new CheckoutCommand({ cartId, userId }))
expect(result.orderId).toBeDefined()
```

Khác nhau đúng một điều: cửa production có nằm trong phạm vi test hay không.

### Case: chờ trạng thái, không chờ đồng hồ

```ts
// ĐÚNG — deadline cộng predicate. Bản thân deadline là một assertion về hệ thống.
await enqueueGradingJob(submissionId)

await until(
    async () => (await gradingState(submissionId)) === "GRADED",
    { timeout: 10_000, describe: "grading job settles" },
)
```

```ts
// SAI — assert ngay dòng sau. Cái đang được kiểm là tốc độ của scheduler, không phải nghiệp vụ.
await enqueueGradingJob(submissionId)
expect(await gradingState(submissionId)).toBe("GRADED")
```

```ts
// SAI theo kiểu khác — sleep cố định. Sai cả hai chiều cùng lúc: ngắn quá thì đỏ vì lý do
// không phải defect, dài quá thì mọi lần chạy đều trả giá cho trường hợp xấu nhất.
await enqueueGradingJob(submissionId)
await new Promise((resolve) => setTimeout(resolve, 3_000))
expect(await gradingState(submissionId)).toBe("GRADED")
```

Khác nhau đúng một điều: hai bản dưới đo đồng hồ, bản trên đo trạng thái.

### Case: flow nửa HTTP nửa socket

```ts
// ĐÚNG — flow kết thúc trên socket, nên test mở socket thật và chờ message.
const socket = await connectSocket(token)
const delivered = firstMessage(socket, "notification")

await completeTask(taskId)

expect((await delivered).type).toBe("STREAK_EXTENDED")
```

```ts
// SAI — cùng flow đó nhưng chỉ nói HTTP. Nửa khó — phần chuyển phát — hoàn toàn không được chạm tới,
// và test vẫn xanh khi không có gì tới được người nhận.
await completeTask(taskId)
expect((await getNotifications()).length).toBe(1)
```

Khác nhau đúng một điều: nửa khó của flow có được chạy hay không.

### Case: cửa vào là scheduler

```ts
// ĐÚNG — flow do cron khởi động thì test vào bằng đúng biên đó, không gọi thẳng method của service.
await advanceClockTo("2026-09-01T00:05:00Z")
await triggerScheduledBoundary("renewals")

await until(async () => (await subscriptionState(subscriptionId)) === "RENEWED")

const invoice = await entityManager.findOneOrFail(InvoiceEntity, { where: { subscriptionId } })
expect(invoice.period).toBe("2026-09")
```

```ts
// SAI — gọi thẳng worker. Lịch, khoá chống chạy trùng và guard của scheduler đều nằm ngoài chứng minh.
await renewalWorker.process({ data: { subscriptionId } })
```

Khác nhau đúng một điều: phần lập lịch có được chứng minh hay không.

### Ngoại lệ và nhầm lẫn

- **`commandBus.execute(...)` không xấu.** Nó là công dân hợp lệ của lane `*.int-spec.ts`:

  ```ts
  // hợp lệ trong billing-policy.int-spec.ts — chủ thể ở đây là wiring, không phải flow.
  const result = await commandBus.execute(new ApplyCouponCommand({ orderId, code: "HALF" }))
  expect(result.chargedAmount).toBe(5_000)
  ```

- **Rule bắt `.execute()` và `.process()` theo tên**, nên một helper nội bộ trùng tên cũng bị bắt
  trong lane e2e. Đó là cái giá phải trả để rule không cần type information; đổi tên helper rẻ hơn
  nhiều so với việc để một flow lách vào bằng cửa sau.
- **Polling không phải retry.** `until` chờ **một trạng thái** đi tới; nó không chạy lại bước nghiệp
  vụ. Chạy lại bước nghiệp vụ là che một lỗi idempotency.

---

## `TESTING-4` — happy path là chủ thể

### Case: nhánh hỏng kéo theo một việc bắt buộc đúng

```ts
// ĐÚNG — đã capture rồi settle hỏng, nên refund PHẢI chạy và quyền PHẢI đóng lại.
// Thất bại này kích hoạt một việc thứ hai, nên nó xứng đáng có một flow.
it("a settlement failure after capture refunds and closes the entitlement", async () => {
    const { orderId } = await checkoutAndCapture()
    await postProviderWebhook({ orderId, status: "SETTLEMENT_FAILED" })

    await until(async () => (await refundState(orderId)) === "REFUNDED")

    expect(await walletBalance(userId)).toBe(startingBalance)
    expect(await isEntitled(userId, productId)).toBe(false)
})
```

```ts
// SAI lane — một field thiếu là một QUYẾT ĐỊNH, không phải một flow. Nó không kéo theo gì cả,
// và nó đang tốn một database để chứng minh một nhánh `if`.
it("checkout rejects an empty cart", async () => {
    const response = await checkout()
    expect(response.errors[0].message).toContain("empty")
})
```

Khác nhau đúng một điều: khi bước này hỏng, có thứ thứ hai nào bắt buộc phải xảy ra không.

### Case: cuộc đua mà constraint phải bắt

```ts
// ĐÚNG — hai writer đua nhau vào suất cuối. Cái được chứng minh là constraint, không phải thông báo lỗi.
it("two concurrent claims on the last seat leave exactly one winner", async () => {
    const [first, second] = await Promise.allSettled([claimSeat(slotId), claimSeat(slotId)])

    const claims = await entityManager.count(SeatClaimEntity, { where: { slot: { id: slotId } } })
    expect(claims).toBe(1)
    expect([first.status, second.status].filter((status) => status === "fulfilled")).toHaveLength(1)
})
```

```ts
// SAI — chạy tuần tự rồi gọi nó là race. Lần gọi thứ hai thấy hàng đã ghi xong, nên constraint
// không hề bị thử; cái được chứng minh chỉ là một câu `if` đọc trước khi ghi.
await claimSeat(slotId)
const second = await claimSeat(slotId)
expect(second.errors[0].message).toContain("full")
```

Khác nhau đúng một điều: hai lệnh có thật sự chồng lên nhau trong thời gian hay không.

### Case: webhook lặp và idempotency

```ts
// ĐÚNG — charge tới hai lần thì idempotency phải giữ, nên nhánh hỏng này là một flow.
it("a duplicated provider callback charges the wallet once", async () => {
    await postProviderWebhook({ orderId, status: "PAID", deliveryId: "d-1" })
    await postProviderWebhook({ orderId, status: "PAID", deliveryId: "d-1" })

    await until(async () => (await orderState(orderId)) === "PAID")

    const ledger = await entityManager.find(LedgerEntryEntity, { where: { orderId } })
    expect(ledger).toHaveLength(1)
})
```

### Ngoại lệ và nhầm lẫn

- **"Unhappy path quan trọng lắm" không phải tiêu chí.** Tiêu chí là: **có việc thứ hai nào bắt buộc
  phải đúng khi việc thứ nhất hỏng không**.
- **Không nhét nhánh hỏng vào file happy path.** Nhánh hỏng đủ tiêu chuẩn có câu chuyện riêng, nên có
  file riêng — `TESTING-1` áp cho nó y hệt.
- **Lỗi phân quyền thường là quyết định**, trừ khi từ chối kéo theo audit trail, khoá tài khoản hoặc
  thu hồi phiên:

  ```ts
  // đủ tiêu chuẩn: từ chối xong PHẢI có một bản ghi audit và phiên PHẢI bị thu hồi.
  await attemptForbiddenAction(token)
  await until(async () => (await sessionState(sessionId)) === "REVOKED")
  const audit = await entityManager.findOneOrFail(AuditEntryEntity, { where: { sessionId } })
  expect(audit.reason).toBe("FORBIDDEN_ACTION")
  ```

---

## `TESTING-5` — phủ nhánh quyết định, không phủ dòng

### Case: bảng nhánh thay cho một giá trị ở giữa dải

```ts
// ĐÚNG — mỗi nhánh đổi kết quả có một dòng riêng, và biên nằm trong bảng.
it.each([
    ["no attempts", 0, "FIRST_TRY"],
    ["one below the cap", MAX_ATTEMPTS - 1, "RETRYING"],
    ["at the cap", MAX_ATTEMPTS, "EXHAUSTED"],
    ["past the cap", MAX_ATTEMPTS + 1, "EXHAUSTED"],
])("resolves %s to %s", async (_name, attempts, expected) => {
    expect(await handler.execute(command({ attempts }))).toBe(expected)
})
```

```ts
// SAI — một giá trị ở giữa dải. Mọi dòng đều chạy, biên không bao giờ được chạm,
// và một off-by-one ở đúng ngưỡng vẫn ship được.
it("resolves the attempt state", async () => {
    expect(await handler.execute(command({ attempts: 2 }))).toBe("RETRYING")
})
```

Khác nhau đúng một điều: biên có được đi qua hay không.

### Case: tập rỗng và "đã làm rồi"

```ts
// ĐÚNG — bốn nhánh, bốn kết quả khác nhau.
it.each([
    ["an empty cart", [], "EMPTY_CART"],
    ["an item already owned", [ownedItem], "ALREADY_OWNED"],
    ["a mixed cart", [ownedItem, newItem], "PARTIALLY_OWNED"],
    ["a clean cart", [newItem], "READY"],
])("classifies %s as %s", async (_name, items, expected) => {
    expect(await service.classify(items, userId)).toBe(expected)
})
```

```ts
// SAI — chỉ nhánh giữa. Giỏ rỗng và giỏ trộn là hai nhánh KHÁC NHAU của cùng một hàm,
// và cả hai đều là chỗ người dùng thật rơi vào.
it("classifies a cart", async () => {
    expect(await service.classify([newItem], userId)).toBe("READY")
})
```

Khác nhau đúng một điều: các nhánh mà người dùng thật đi vào có được liệt kê hay không.

### Case: coverage xanh mà quyết định vẫn hở

```ts
// Hàm đang được kiểm — hai điều kiện, bốn tổ hợp, nhưng chỉ hai dòng code.
export const canRedeem = (balance: number, isSuspended: boolean): boolean =>
    balance >= REDEEM_THRESHOLD && !isSuspended
```

```ts
// SAI — một case chạm đủ 100% số DÒNG của hàm trên, và bỏ sót hai tổ hợp.
it("allows redeeming", () => {
    expect(canRedeem(REDEEM_THRESHOLD, false)).toBe(true)
})
```

```ts
// ĐÚNG — bốn tổ hợp, kể cả đúng ngưỡng và ngay dưới ngưỡng.
it.each([
    [REDEEM_THRESHOLD, false, true],
    [REDEEM_THRESHOLD - 1, false, false],
    [REDEEM_THRESHOLD, true, false],
    [REDEEM_THRESHOLD - 1, true, false],
])("canRedeem(%i, %s) === %s", (balance, isSuspended, expected) => {
    expect(canRedeem(balance, isSuspended)).toBe(expected)
})
```

Đây là ví dụ gọn nhất cho câu "coverage nghĩa là **quyết định** được phủ, không phải dòng được chạy".

### Ngoại lệ và nhầm lẫn

- **Không phải mọi tổ hợp, chỉ mọi nhánh ĐỔI KẾT QUẢ.** Hai tham số không tương tác với nhau thì
  không cần nhân chéo.
- **`it.each` không bắt buộc.** Bốn `it` rõ ràng cũng đạt. Cái bị từ chối là **một** `it` cho bốn
  nhánh.
- **Nhánh chỉ khác nhau ở thông điệp lỗi vẫn là nhánh**, nếu người gọi phân biệt được chúng.

---

## `TESTING-6` — spec chỉ assert lời gọi là spec chép lại source

### Case: assert quyết định, không assert lời gọi

```ts
// ĐÚNG — assert cái handler KẾT LUẬN từ dữ liệu nó nhận.
it("charges the discounted amount when a coupon applies", async () => {
    const result = await handler.execute(command({ coupon: "HALF" }))
    expect(result.chargedAmount).toBe(5_000)
})
```

```ts
// SAI — chép lại source. Đổi tên method của collaborator thì đỏ; đổi mức giảm thành số sai thì xanh.
it("charges the discounted amount when a coupon applies", async () => {
    await handler.execute(command({ coupon: "HALF" }))
    expect(payments.charge).toHaveBeenCalledWith(expect.anything())
})
```

Khác nhau đúng một điều: một con số sai có bị bắt hay không.

### Case: call assertion hợp lệ, vì lời gọi CHÍNH LÀ hệ quả

```ts
// ĐÚNG — hai assertion. Thứ nhất là kết quả; thứ hai là hiệu ứng quan sát được duy nhất
// của việc gửi mail, và nó khẳng định ĐÚNG NGƯỜI NHẬN chứ không chỉ "đã gọi".
it("notifies the buyer when the refund settles", async () => {
    const result = await handler.execute(command({ orderId }))

    expect(result.refundState).toBe("REFUNDED")
    expect(mailer.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: buyer.email, template: "REFUND_SETTLED" }),
    )
})
```

```ts
// SAI — cùng ý định, nhưng cả file không còn assertion nào khác, và đối số bị nuốt bằng
// `expect.anything()`. Rule nổ ở đây, và nó nổ đúng.
it("notifies the buyer when the refund settles", async () => {
    await handler.execute(command({ orderId }))
    expect(mailer.send).toHaveBeenCalledWith(expect.anything())
})
```

Khác nhau đúng một điều: trong file có thứ gì đó **ngoài** lời gọi được khẳng định hay không.

### Case: `.not` và `.resolves` đi xuyên qua

```ts
// Cả hai dòng dưới đều được rule đọc thành call matcher, vì nó leo hết chuỗi member.
expect(payments.charge).not.toHaveBeenCalled()
expect(auditLog.write).toHaveBeenCalledTimes(1)
```

```ts
// Còn dòng này được đọc thành `toBe` — modifier không làm nó thành call assertion.
await expect(handler.execute(command())).resolves.toBe("READY")
```

Đây là chỗ hay bị hiểu nhầm nhất: `expect(x).not.toHaveBeenCalled()` **vẫn** là call assertion. Phủ
định một lời gọi vẫn là nói về lời gọi.

### Case: assert trạng thái đã đổi thay cho assert kết quả trả về

```ts
// ĐÚNG — handler không trả về gì có nghĩa, nên hệ quả được đọc ra từ nơi nó sống.
it("suspends access when the plan goes overdue", async () => {
    await handler.execute(command({ planId }))

    const plan = await repository.findOneOrFail({ where: { id: planId } })
    expect(plan.accessState).toBe("SUSPENDED")
    expect(plan.suspendedAt).not.toBeNull()
})
```

```ts
// SAI — "đã gọi save" không nói cái gì đã được lưu.
it("suspends access when the plan goes overdue", async () => {
    await handler.execute(command({ planId }))
    expect(repository.save).toHaveBeenCalled()
})
```

Khác nhau đúng một điều: giá trị được ghi có được nhìn hay không.

### Ngoại lệ và nhầm lẫn

- **Rule chỉ nổ khi CẢ FILE không còn assertion nào khác.** Một file có mười assertion kết quả và một
  call assertion là hợp lệ, và cố ý hợp lệ.
- **File không có assertion nào thì rule im lặng.** Đó là một vấn đề khác — và là vấn đề của
  `TESTING-5`, không phải của mã này.
- **`toHaveReturned` cũng nằm trong danh sách.** Nó nói về mock, không nói về nghiệp vụ.

---

## `TESTING-7` — lane nằm ở hậu tố, không nằm ở thư mục

### Case: bốn hậu tố, bốn câu hỏi

```ts
// price-calculator.spec.ts          — quyết định này có ra đúng không?
// billing-policy.int-spec.ts        — các mảnh này ghép vào nhau có chạy không?
// order-checkout.e2e-spec.ts        — nghiệp vụ có chạy không?
// grading-quality.harness-spec.ts   — câu trả lời của model có chấp nhận được không?
```

### Case: config loại trừ nhau bằng suffix

```ts
// ĐÚNG — lane nhanh loại trừ ba lane kia bằng HẬU TỐ, nên e2e và harness có thể nằm chung thư mục
// mà lần chạy nhanh không bao giờ nhặt phải.
{
    displayName: "unit",
    testMatch: ["**/*.spec.ts"],
    testPathIgnorePatterns: [
        "\\.int-spec\\.ts$",
        "\\.e2e-spec\\.ts$",
        "\\.harness-spec\\.ts$",
    ],
}
```

```ts
// SAI — loại trừ bằng đường dẫn. Chuyển một file sang thư mục khác là đổi lane của nó,
// và không ai nhìn tên file mà biết được điều đó.
{
    displayName: "unit",
    testMatch: ["**/*.spec.ts"],
    testPathIgnorePatterns: ["<rootDir>/src/tests/"],
}
```

Khác nhau đúng một điều: lane của một file có nhìn thấy được từ tên file hay không.

### Ngoại lệ và nhầm lẫn

- **Hậu tố `.e2e-spec.ts` cũng khớp `.spec.ts` nếu regex viết cẩu thả.** Mọi phép thử lane đều phải
  loại trừ ba hậu tố kia một cách tường minh — đó là lý do hàm nhận diện unit spec trong rule file
  làm đúng hai bước: khớp `\.spec\.ts$` rồi loại `\.(?:e2e|int|harness)-spec\.ts$`.
- **Thư mục vẫn có ích** cho việc đặt globalSetup của lane. Nó chỉ không được dùng để **quyết định**
  lane.

---

## `TESTING-8` — lane rỗng không phải lane xanh

### Case: cờ "qua khi rỗng" cộng một lane rỗng

```jsonc
// SAI — lane đã cấu hình, đã có script, đã nằm trong CI, và không khớp file nào.
// Nó báo xanh mãi mãi, và xanh là thứ người ta đọc.
{
    "scripts": {
        "test:contract": "jest --selectProjects contract --passWithNoTests"
    }
}
```

```jsonc
// ĐÚNG — hoặc lane có test thật, hoặc lane bị xoá. Không có trạng thái thứ ba.
{
    "scripts": {
        "test:contract": "jest --selectProjects contract"
    }
}
```

Khác nhau đúng một điều: một lane rỗng có báo đỏ hay không.

### Case: lane rỗng vì glob trượt sau refactor

```ts
// Lane vẫn "xanh" sau khi thư mục bị đổi tên, vì roots trỏ vào chỗ không còn gì.
{
    displayName: "integration",
    testMatch: ["**/*.int-spec.ts"],
    roots: ["<rootDir>/test/integration"], // thư mục đã chuyển sang src/tests
}
```

Đây là dạng vi phạm khó thấy nhất, vì **không ai làm gì sai** — một lần refactor thư mục đủ để biến
một lane thành lời tuyên bố rỗng. Phép thử rẻ nhất là đếm file mà lane thật sự nhặt được, và so với
số file mang hậu tố đó trong repository.

### Ngoại lệ và nhầm lẫn

- **Cờ "qua khi rỗng" tự nó không phải vi phạm.** Nó hữu ích khi một lane đang được dựng, có chủ và
  có hạn. Vi phạm là cờ đó cộng với một lane thật sự rỗng và không ai theo dõi.
- **Lane bị skip khác lane rỗng.** Skip có tiếng ồn; rỗng thì im lặng, và im lặng là lý do mã này tồn
  tại.

---

## `TESTING-9` — e2e không bao giờ gọi model

### Case: stub trả JSON thật dạng, rồi assert thứ có thể vỡ

```ts
// ĐÚNG — model bị thay, mọi thứ khác giữ nguyên: transport, orchestration, quota, persistence.
// Vì payload là JSON thật dạng, parser strict-JSON VẪN CHẠY — đó là seam dễ vỡ nhất.
aiInvoke.run.mockResolvedValue({
    text: JSON.stringify({
        answer: "A closure keeps access to its enclosing scope after that scope returns.",
        citations: [{ sourceId: SOURCE_ID, quote: "lexical scope" }],
        confidence: 0.82,
    }),
})

await ask(SOURCE_ID, "what is a closure?")

const session = await entityManager.findOneOrFail(AssistantSessionEntity, { where: { sourceId: SOURCE_ID } })
expect(session.turns).toHaveLength(1)
expect(session.turns[0].citations).toHaveLength(1)
expect(await remainingQuota(userId)).toBe(startingQuota - 1)
```

```ts
// SAI — một marker. Parser không bao giờ chạy, nên chỗ output của model gặp schema —
// đúng chỗ dễ vỡ nhất — là chỗ duy nhất flow này không chạm tới.
aiInvoke.run.mockResolvedValue({ text: "stubbed" })
```

Khác nhau đúng một điều: parser có được chạy hay không.

### Case: gọi thật trong lane flow

```ts
// SAI lane — một lần gọi model thật trong test flow. Tốn tiền, thêm vài giây, và assertion
// phải nới lỏng cho sống sót qua cách diễn đạt khác, tới lúc nó không bắt được gì.
const response = await ask(SOURCE_ID, "what is a closure?")
expect(response.answer.toLowerCase()).toContain("closure")
```

```ts
// ĐÚNG — cùng flow đó, nhưng assert những thứ CÓ THỂ VỠ và luôn xác định.
const response = await ask(SOURCE_ID, "what is a closure?")
expect(response.citations).toHaveLength(1)
expect(await remainingQuota(userId)).toBe(startingQuota - 1)
```

Khác nhau đúng một điều: test có thể đỏ vì một lý do **không phải defect** hay không.

### Case: stub là mặc định của thế giới, không phải việc tác giả flow phải nhớ

```ts
// ĐÚNG — thế giới boot lên đã có SDK bị thay sẵn; định tuyến, quota và persistence vẫn thật.
// Chạm tới provider là một lần OPT-OUT có chủ ý.
const { app, entityManager, aiInvoke } = await createFlowWorld({
    providers: [PricingService, EntitlementService],
})
// aiInvoke.run là một jest mock — flow lập trình lại nó theo từng bước khi cần.
```

```ts
// SAI — mỗi flow tự nhớ cài stub. Một luật phụ thuộc trí nhớ là một luật chỉ cách một buổi chiều
// mất tập trung là vỡ, và vết vỡ hiện ra dưới dạng một suite chậm, đắt, đỏ lúc được lúc không.
beforeAll(() => {
    jest.spyOn(aiInvokeService, "run").mockResolvedValue({ text: "{}" })
})
```

Khác nhau đúng một điều: có phải nhớ mới đúng hay không.

### Case: import SDK provider vào file e2e

```ts
// SAI — rule bắt ngay ở dòng import, trước cả khi có lời gọi nào.
// order-assistant.e2e-spec.ts
import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
```

```ts
// SAI theo kiểu tinh vi hơn — import helper model của lane harness bằng đường dẫn TƯƠNG ĐỐI.
// Rule khớp không cần tiền tố `tests/` chính vì lý do này: file e2e nằm ngay cạnh thư mục helper.
import { callModel } from "../helpers/models.service"
```

Khác nhau đúng một điều: không có. Cả hai đều là "gọi model từ e2e", chỉ khác cách viết đường dẫn —
và đó chính là lý do rule phải bắt cả hai.

### Ngoại lệ và nhầm lẫn

- **Stub không miễn `TESTING-2`.** Sau khi thay model, phần còn lại của flow vẫn phải assert hệ quả.
- **"JSON thật dạng" nghĩa là giá trị hợp lệ**, không chỉ đúng khoá: điểm nằm trong dải, mảng không
  rỗng, enum là thành viên schema khai. Một payload đúng khoá nhưng `confidence: 42` chỉ chứng minh
  parser bỏ qua việc kiểm dải.
- **Được phép lập trình lại stub theo từng bước** — đó là lý do nó là jest mock chứ không phải hằng
  số:

  ```ts
  aiInvoke.run
      .mockResolvedValueOnce({ text: JSON.stringify({ answer: "…", citations: [], confidence: 0.4 }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ answer: "…", citations: [c], confidence: 0.9 }) })
  ```

---

## `TESTING-10` — harness gọi thẳng provider, và giữ mình nhỏ

### Case: SDK provider, key server, model và endpoint khai tường minh

```ts
// ĐÚNG — client của chính provider, key do provider cấp cho server, model nêu tên.
// gradingPrompt và scoreFrom là seam production được tái sử dụng, không phải bản sao.
const client = new ProviderSdk({ apiKey: readRequiredHarnessKey("HARNESS_PROVIDER_API_KEY") })

const message = await client.messages.create({
    model: HARNESS_MODEL,
    max_tokens: 1_024,
    messages: [{ role: "user", content: gradingPrompt(submission) }],
})

expect(scoreFrom(message)).toBeGreaterThanOrEqual(PASSING)
```

```ts
// SAI — provider thật nấp sau một gateway production giả. Adapter có thể BỊA ra provider,
// token và metadata chi phí, nên harness xanh mà hợp đồng production chưa được chứng minh.
const aiInvoke = createHarnessInvoke(() => ({ model: "some-model-id" }))
const text = await aiInvoke.run({ messages: gradingPrompt(submission) })
expect(scoreFrom(text)).toBeGreaterThanOrEqual(PASSING)
```

Khác nhau đúng một điều: harness gọi đúng đích đã khai, hay đóng giả gateway production.

### Case: ba cách đóng giả gateway, cả ba đều bị bắt

```ts
// SAI — import chính symbol của gateway production vào lane harness.
import { AiInvokeService } from "@modules/ai/ai-invoke.service"
```

```ts
// SAI — cung cấp gateway production như một provider của module test.
const moduleRef = await Test.createTestingModule({
    providers: [{ provide: AiInvokeService, useValue: liveProviderAdapter }],
}).compile()
```

```ts
// SAI — override gateway production. Cùng một hành vi, cú pháp thứ ba.
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AiInvokeService)
    .useValue(liveProviderAdapter)
    .compile()
```

Ba cú pháp, một hành vi. Rule bắt cả ba, cộng thêm dạng thứ tư là `Pick<AiInvokeService, "run">` — vì
một kiểu mượn tên gateway cũng là một lời hứa rằng đây là gateway production.

### Case: credential — cái gì tính, cái gì không

```ts
// ĐÚNG — mỗi authority là một biến môi trường bắt buộc, đọc từ process, không fallback.
// Không file, không OAuth, không key pool, không biến anh em.
export const readRequiredHarnessKey = (name: string): string => {
    const value = process.env[name]?.trim()
    if (!value) throw new Error(`Missing required harness credential: ${name}`)
    return value
}
```

```ts
// SAI — credential của một CLI hoặc một phiên ứng dụng người dùng. Nó không phải API key
// do provider cấp cho server, nên nó không chứng minh được quyền đã deploy.
const apiKey = process.env.CLAUDE_CODE_OAUTH_TOKEN ?? readTokenFile("~/.config/auth-profile.json")
```

Khác nhau đúng một điều: credential có phải thứ production dùng hay không.

### Case: judge khai bộ bốn của riêng nó

```ts
// ĐÚNG — hai authority tách rời. Không bên nào thừa kế ngầm bộ bốn của bên kia.
const subject = new ProviderSdk({ apiKey: readRequiredHarnessKey("HARNESS_PROVIDER_API_KEY") })
const judge = new ProviderSdk({ apiKey: readRequiredHarnessKey("HARNESS_JUDGE_API_KEY") })

const answer = await subject.messages.create({ model: SUBJECT_MODEL, messages: subjectPrompt(input) })
const verdict = await judge.messages.create({ model: JUDGE_MODEL, messages: judgePrompt(answer) })

expect(scoreFrom(verdict)).toBeGreaterThanOrEqual(PASSING)
```

```ts
// SAI — judge dùng lại client của subject. Khi subject đổi model, judge âm thầm đổi theo,
// và cái được chấm với cái đi chấm không còn độc lập.
const verdict = await subject.messages.create({ model: SUBJECT_MODEL, messages: judgePrompt(answer) })
```

Khác nhau đúng một điều: người chấm có độc lập với người bị chấm hay không.

### Case: giữ lane nhỏ

```ts
// ĐÚNG — một hai case mỗi capability, chọn vì chúng là chỗ một regression sẽ lộ ra.
it("grades a strong submission above the passing bar", async () => { /* … */ })
it("grades an off-topic submission below the passing bar", async () => { /* … */ })
```

```ts
// SAI — một case mỗi edge. Lane này tính tiền theo lượt gọi, nên nó lớn dần tới lúc không ai chạy,
// và màu xanh cuối cùng của nó vẫn còn treo trên bảng như thể còn đúng.
it.each(THIRTY_EIGHT_RUBRIC_EDGES)("grades %s", async (edge) => { /* … */ })
```

Khác nhau đúng một điều: lane này sáu tháng nữa còn được chạy hay không.

### Ngoại lệ và nhầm lẫn

- **Tái sử dụng prompt builder và parser của production là ĐƯỢC KHUYẾN KHÍCH.** Cái bị cấm là tái sử
  dụng **lớp định tuyến**. Prompt và parser là thứ đang được kiểm; routing là thứ làm cho phép kiểm
  vô nghĩa.
- **Chia sẻ code nạp credential là hợp lệ.** Chia sẻ code **gọi model** thì không.
- **Harness không thay thế độ phủ flow.** Nó không biết gì về quota, entitlement hay persistence —
  đó là việc của `TESTING-9`.

---

## `TESTING-11` — seed demo dựng một thế giới

### Case: ghi bản ghi nguồn, rồi vô hiệu hoá projection dẫn xuất

```ts
// ĐÚNG — seed ghi đúng những hàng mà read path production đọc, rồi vô hiệu hoá phần dẫn xuất
// để handler bình thường dựng lại. Màn hình vì thế là bằng chứng, không phải bức tranh.
await seedWorld({
    currentUser: { resumedItems, activeDays, earnedCredits, gradedSubmissions },
    peers: variedPeers,
    challengeWinners,
})
await invalidateDerivedProjections(currentUser.id)
```

```ts
// SAI — ghi thẳng JSON đúng hình dạng màn hình cần. Trông đầy đủ, và không join hay projection nào
// của production chứng minh được nó.
await writeDashboardProjection(currentUser.id, screenshotShapedJson)
```

Khác nhau đúng một điều: UI đang đọc một thế giới thật hay một kết quả đã được vẽ sẵn.

### Case: một tài khoản trắng không lộ ra được gì

```ts
// SAI — mọi số bằng không. List, đếm, xếp hạng, tiến độ và join giữa nhiều người dùng
// đều không có gì để chứng minh là đúng.
await seedWorld({ currentUser: { items: [], credits: 0, streak: 0 }, peers: [] })
```

```ts
// ĐÚNG — trạng thái rỗng VẪN được seed, nhưng là một trong nhiều trạng thái, không phải tất cả.
await seedWorld({
    currentUser: { resumedItems, activeDays: 7, earnedCredits: 1_250 },
    peers: [busyPeer, newPeer, dormantPeer],
    emptyStates: ["notifications", "bookmarks"],
})
```

Khác nhau đúng một điều: có nhánh nào **có dữ liệu** để đối chiếu hay không.

### Case: idempotent và nhận vào tài khoản đang soi

```ts
// ĐÚNG — nhận email của tài khoản đang được soi, và chạy lần hai không nhân đôi gì.
const targetEmail = process.argv[2] ?? process.env.DEV_INSPECTED_ACCOUNT_EMAIL
await upsertUserByEmail(targetEmail)
await upsertProgressRows(FIXED_IDS, targetEmail)
```

```ts
// SAI — ghim cứng một identity và giả định đó là người đang đăng nhập. Người thứ hai mở lên
// thấy một dashboard trắng và kết luận sai rằng tính năng hỏng.
const HARD_CODED_USER = "11111111-1111-1111-1111-111111111111"
await insertProgressRows(HARD_CODED_USER)
```

Khác nhau đúng một điều: người thứ hai chạy seed có nhìn thấy thế giới đó hay không.

### Ngoại lệ và nhầm lẫn

- **ID cố định là tốt**, vì nó làm seed idempotent. **Identity người dùng cố định** thì không, vì nó
  giả định ai đang đăng nhập. Hai thứ này hay bị gộp làm một.
- **Seed không phải fixture của test.** Nó phục vụ việc soi bằng mắt qua read path thật; test flow có
  thế giới riêng của nó.
- **Vô hiệu hoá projection ≠ xoá dữ liệu.** Vô hiệu hoá buộc handler thật dựng lại; xoá làm mất luôn
  thứ cần chứng minh.

---

## Ánh xạ yêu cầu sang lane và mã

Nêu câu hỏi cần trả lời, cửa vào và hệ quả. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ
thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Lane và hình dạng |
|---|---|---|---|
| "Kiểm rằng mua xong thì mở được quyền" | Một câu chuyện nghiệp vụ, có hệ quả bền vững | `TESTING-1`, `TESTING-2` | `*.e2e-spec.ts`, đọc lại entitlement từ database |
| "Kiểm rằng webhook chạy đúng" | Bước async, cửa vào là HTTP của provider | `TESTING-3` | `*.e2e-spec.ts`, POST webhook rồi `until` |
| "Kiểm rằng giỏ rỗng thì báo lỗi" | Một quyết định, không kéo theo gì | `TESTING-4`, `TESTING-5` | `*.spec.ts`, một case trong bảng nhánh |
| "Kiểm rằng settle hỏng thì hoàn tiền" | Thất bại kích hoạt việc thứ hai bắt buộc đúng | `TESTING-4` | `*.e2e-spec.ts`, file riêng mang tên câu chuyện đó |
| "Kiểm rằng số lần thử tới ngưỡng thì khoá" | Có biên | `TESTING-5` | `*.spec.ts`, `cap - 1`, `cap`, `cap + 1` |
| "Kiểm rằng mail được gửi" | Lời gọi là hệ quả quan sát được | `TESTING-6` | `*.spec.ts`, assert kết quả **và** người nhận |
| "Kiểm rằng notification tới được người dùng" | Flow kết thúc trên socket | `TESTING-3` | `*.e2e-spec.ts`, mở client thật, chờ message |
| "Kiểm rằng hỏi đáp AI lưu đúng và trừ quota" | Flow đi qua model | `TESTING-9`, `TESTING-2` | `*.e2e-spec.ts`, stub JSON thật dạng, assert quota và bản ghi |
| "Kiểm rằng model chấm bài đủ tốt" | Chủ thể là câu trả lời của model | `TESTING-10` | `*.harness-spec.ts`, SDK provider, một hai case |
| "Dựng dữ liệu để soi dashboard local" | Cần read path production chứng minh màn hình | `TESTING-11` | script seed idempotent, ghi nguồn rồi vô hiệu hoá projection |
| "Kiểm rằng handler gọi đúng service" | Chưa nêu hệ quả nào | — | Hỏi một câu: **kết quả hay trạng thái nào đổi khi handler này chạy đúng?** |

Dòng cuối là dòng duy nhất được phép kết thúc bằng một câu hỏi. Câu trả lời phải là một lane cộng một
mã, hoặc một câu hỏi — không bao giờ cả hai.

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `TESTING-1` / `TESTING-4` | Tên file là một câu chuyện, hay là một nhánh của câu chuyện khác? |
| `TESTING-2` / `TESTING-3` | Vấn đề là **nhìn nhầm chỗ**, hay là **vào nhầm cửa**? |
| `TESTING-3` / lane integration | Cửa vào của production có nằm trong phạm vi chứng minh không? |
| `TESTING-4` / `TESTING-5` | Khi bước này hỏng, có việc thứ hai nào bắt buộc phải đúng không? |
| `TESTING-5` / `TESTING-6` | Thiếu **case**, hay thiếu **assertion về kết quả**? |
| `TESTING-6` / ngoại lệ hợp lệ | Trong cả file còn assertion nào không nói về lời gọi không? |
| `TESTING-7` / `TESTING-8` | Lane khai sai, hay lane khai đúng mà rỗng? |
| `TESTING-9` / `TESTING-10` | Chủ thể là *quota/parser/persistence*, hay là *chất lượng câu trả lời*? |
| `TESTING-11` / fixture của test | Thế giới này để **người** soi bằng mắt, hay để **test** assert? |

## Sai lầm lặp lại nhiều nhất

1. Assert `status === 200` rồi gọi đó là một flow đã được phủ.
2. Gọi `commandBus.execute(...)` trong e2e vì nó nhanh hơn và ít wiring hơn.
3. Assert kết quả async ở dòng ngay sau lời gọi, rồi thêm `sleep` khi nó đỏ.
4. Đặt tên file e2e theo nhóm resolver, rồi thêm dần endpoint vào đó.
5. Một `it` cho bốn nhánh, và một giá trị nằm giữa dải.
6. Cả file chỉ có `toHaveBeenCalledWith`, và tin rằng thế là đã kiểm handler.
7. Stub model trả về `"stubbed"`, nên parser — chỗ dễ vỡ nhất — không bao giờ chạy.
8. Để mỗi tác giả flow tự nhớ cài stub, thay vì để thế giới cài sẵn.
9. Harness gọi provider qua wrapper nhà, rồi tin rằng thứ được kiểm là thứ sẽ ship.
10. Seed một tài khoản trắng, rồi kết luận rằng list và bảng xếp hạng "trông ổn".
11. Để một lane rỗng trong CI kèm cờ "qua khi rỗng", và đọc màu xanh của nó như độ phủ.
