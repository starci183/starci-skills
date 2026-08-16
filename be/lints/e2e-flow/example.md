---
id: be-lints-e2e-flow-example
title: example.md
slug: /be/lints/e2e-flow/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng luật lint luồng e2e — chỗ nó nổ, chỗ nó im, và chỗ nó không nhìn thấy.
---

# example.md

> Version: `2.00` · Mô-đun: `e2e-flow` · Luật: [`INDEX.md`](./INDEX.md) · Giải thích: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây đều nằm trong một tệp có tên kết thúc bằng `.e2e-spec.ts`. Đó không phải chi tiết
trang trí: **đuôi tên tệp là toàn bộ phạm vi của kệ này**. Cùng một dòng mã, đặt trong một tệp tên
khác, không luật nào trên kệ nhìn thấy.

Mỗi luật có nhiều cặp **SAI** (luật nổ) và **ĐÚNG** (luật im), rồi tới một mục **Cửa lách và nhầm
lẫn**. Mã trong mục cuối cùng ấy là mã **đi lọt** — nó được ghi ra vì luật không nhìn thấy nó, chứ
không phải vì nó được phép.

---

## `e2e-uses-production-transport`

### SAI — nhập bộ điều phối nội bộ

```ts
// order-settlement.e2e-spec.ts
import { CommandBus, QueryBus } from "@nestjs/cqrs"
```

Hai báo cáo `busImport`, một cho mỗi tên. Đặt bí danh cũng không giúp gì, vì luật đọc tên **được nhập**
chứ không đọc tên cục bộ.

```ts
// SAI y hệt: bí danh không giấu được
import { EventBus as Bus } from "@nestjs/cqrs"
```

### ĐÚNG — đi vào bằng cổng sản xuất

```ts
const response = await world.graphql(member).checkout({ cartId })
expect(response.orderId).toBeDefined()
```

### SAI — gọi thẳng phương thức nội bộ

```ts
const worker = app.get(SettlementWorker)
await worker.process(job)
```

Báo `direct` tại `process`. Lời gọi này xoá sạch tuần tự hoá, khoá, thử lại và xác nhận đã nhận — tức
là toàn bộ thứ mà một luồng vận hành sinh ra để chứng minh.

### ĐÚNG — đăng ký rồi để hàng đợi thật kích hoạt

```ts
await world.broker.publish("order.settled", { orderId })
await until(() => world.db.entitlementIsOpen(member.id, planId), {
    timeout: 10_000,
    describe: "quyền dùng gói mở ra sau khi sự kiện thanh toán được phát",
})
```

### SAI — gọi qua một định danh kết thúc bằng `Handler`

```ts
const settlementHandler = app.get(SettlementHandler)
await settlementHandler.handle(command)
```

Báo `actor`. Chú ý: `handle` **không** nằm trong hai tên phương thức cứng — thứ làm luật nổ ở đây là
cái đuôi `Handler` của bên nhận.

### ĐÚNG — giữ tham chiếu để đăng ký, không để gọi

```ts
// Nhập một actor để Nest đăng ký nó là đúng; điều bị cấm là phân giải rồi gọi thẳng.
import { SettlementWorker } from "@modules/billing/workers/settlement.worker"

beforeAll(async () => {
    world = await bootE2eWorld({ workers: [SettlementWorker] })
})
```

### Cửa lách và nhầm lẫn

```ts
// LỌT — hai dấu ngoặc vuông. `callee.computed` bật lên, luật thoát trước cả hai nhánh.
const worker = app.get(SettlementWorker)
await worker["process"](job)
```

```ts
// LỌT — bên nhận không phải định danh trần, nên nhánh tên bên nhận không chạy;
// và `handle` không phải một trong hai tên phương thức cứng.
await app.get(SettlementWorker).handle(job)
await workers.settlement.finalize(job)
```

`finalize` là cái tên mà chính văn bản luật nêu đích danh, và ở dạng này nó không bị nhìn thấy.

```ts
// LỌT — phép thử là so ĐUÔI và phân biệt hoa thường.
const worker = app.get(SettlementWorker)
const consumer = app.get(SettlementWorker)
await worker.finalize(job)
await consumer.run(job)
```

```ts
// LỌT — không phải ImportDeclaration với ImportSpecifier, hoặc không đúng chuỗi nguồn.
import * as cqrs from "@nestjs/cqrs"
const { CommandBus } = require("@nestjs/cqrs")
import { CommandBus } from "@nestjs/cqrs/dist/index"
import { CommandBus } from "../shared/cqrs-barrel"
```

```ts
// BÁO THỪA — không có gì bị đi tắt ở đây, nhưng `execute` là tên bị cấm thẳng.
const rows = await dataSource
    .createQueryBuilder()
    .select("*")
    .from("entitlements", "e")
    .where("e.member_id = :id", { id: member.id })
    .execute()
```

Đây chính là phép đọc trạng thái mà `e2e-asserts-persisted-state` đòi hỏi, viết đúng theo hình dạng
thư viện lưu trữ đưa ra — và nó làm luật vận chuyển nổ. Hai luật trên kệ mâu thuẫn nhau ở đúng dòng
này.

---

## `e2e-asserts-persisted-state`

### SAI — cả tệp chỉ khẳng định vào phong bì phản hồi

```ts
// invoice-issue.e2e-spec.ts
describe("một hoá đơn được phát hành cho kỳ vừa đóng", () => {
    it("trả về mã hoá đơn", async () => {
        const response = await world.http.post("/invoices").send({ periodId })
        expect(response.status).toBe(201)
        expect(response.body.invoiceId).toBeDefined()
    })
})
```

Một báo cáo `state` tại `Program`. Bài kiểm thử này chứng minh đúng một điều: máy chủ có trả lời.

### ĐÚNG — đọc lại từ nơi trạng thái sống

```ts
import { DataSource } from "typeorm"

it("ghi hoá đơn ở trạng thái chờ thu", async () => {
    const { body } = await world.http.post("/invoices").send({ periodId })
    const dataSource = app.get(DataSource)
    const row = await dataSource.query("select status from invoices where id = $1", [body.invoiceId])
    expect(row[0].status).toBe("AWAITING_COLLECTION")
})
```

### ĐÚNG — `queryRunner` cũng thoả tên

```ts
const queryRunner = dataSource.createQueryRunner()
await queryRunner.connect()
const [row] = await queryRunner.query("select balance from wallets where member_id = $1", [member.id])
expect(row.balance).toBe(openingBalance - price)
```

### Cửa lách và nhầm lẫn

```ts
// LỌT — một câu nhập không dùng tới làm luật im vĩnh viễn.
// Phần còn lại của tệp vẫn chỉ khẳng định vào phong bì phản hồi.
import { DataSource } from "typeorm"

it("trả về mã hoá đơn", async () => {
    const response = await world.http.post("/invoices").send({ periodId })
    expect(response.status).toBe(201)
})
```

Người dọn dẹp phần nhập, khi xoá dòng ấy đi, sẽ làm một tệp đang xanh hoá đỏ mà không đụng vào một
bài kiểm thử nào. Đó là dấu hiệu rõ nhất rằng thứ đang được đo không phải thứ luật muốn đo.

```ts
// LỌT theo chiều ngược lại — BÁO THỪA.
// Đây là một phép đọc trạng thái đã lưu thật sự, viết qua bộ khung dùng chung như E2E-8 khuyên,
// và nó vẫn bị báo vì không có tên nào trong sáu tên xuất hiện ở đâu trong tệp.
await until(() => world.db.entitlementIsOpen(member.id, planId))
expect(await world.db.walletBalance(member.id)).toBe(openingBalance - price)
```

```ts
// LỌT — một tên chỉ dùng để DỰNG CẢNH cũng thoả luật.
beforeAll(async () => {
    const dataSource = app.get(DataSource)
    await dataSource.query("insert into plans (id, price) values ($1, $2)", [planId, price])
})

it("trả về mã đơn", async () => {
    const response = await world.http.post("/orders").send({ planId })
    expect(response.status).toBe(201) // không đọc lại gì cả, và luật vẫn im
})
```

```ts
// LỌT — hệ quả sống ở kho tài liệu hoặc ở cache thì không có tên nào trong danh sách.
const stored = await mongo.collection("notifications").findOne({ memberId: member.id })
expect(stored?.type).toBe("ENTITLEMENT_OPENED")
```

---

## `no-model-call-in-e2e`

### SAI — nhập thẳng gói nhà cung cấp

```ts
import OpenAI from "openai"
```

### SAI — đường dẫn con của cùng gói

```ts
import type { ChatCompletion } from "openai/resources/chat/completions"
```

Nhánh tiền tố `openai/` bắt cả đường dẫn con. Chú ý đây cũng là một lần **báo thừa**: `import type`
không đóng gói ra thứ gì.

### ĐÚNG — kịch bản hoá kết quả bên ngoài, giữ nguyên chính sách nội bộ

```ts
jest.mock("openai") // chuỗi trong một lời gọi hàm, không phải ImportDeclaration

it("dùng nhà cung cấp dự phòng khi nhà cung cấp chính lỗi", async () => {
    world.providerClient.invoke
        .mockRejectedValueOnce(new Error("upstream 503"))
        .mockResolvedValueOnce({ text: "ok", usage: { totalTokens: 12 } })

    const response = await world.graphql(member).ask({ prompt: "xin chào" })
    expect(response.text).toBe("ok")
})
```

### ĐÚNG — một gói ngoài không dính dáng gì tới mô hình

```ts
import { faker } from "@faker-js/faker"
import Stripe from "stripe"
```

### Cửa lách và nhầm lẫn

```ts
// LỌT — không phải ImportDeclaration.
const OpenAI = require("openai")
const { default: Client } = await import("@anthropic-ai/sdk")
export * from "openai"
```

```ts
// LỌT — nhà cung cấp nằm ngoài sáu mẫu, hoặc suýt trúng một mẫu.
import { edgeClient } from "openai-edge"
import { Bedrock } from "@aws-sdk/client-bedrock-runtime"
import Groq from "groq-sdk"
```

`openai-edge` trượt cả nhánh so bằng (`openai$`) lẫn nhánh có dấu chéo (`openai/`).

```ts
// LỌT — và đây là cửa đắt nhất: không nhập gì cả.
const answer = await fetch("https://api.some-provider.example/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.PROVIDER_KEY}` },
    body: JSON.stringify({ model: "large", messages }),
})
```

```ts
// LỌT — cách tốn kém nhất, và không có một ký tự nào để luật nhìn vào:
// không kịch bản hoá gì hết, để chính sách của ứng dụng tự phân giải nhà cung cấp đã cấu hình.
it("trả lời câu hỏi của thành viên", async () => {
    const response = await world.graphql(member).ask({ prompt: "xin chào" })
    expect(response.text.length).toBeGreaterThan(0) // tiền thật, độ trễ thật, kết quả không tất định
})
```

Tên luật nói "không gọi mô hình"; cơ chế chỉ biết "không nhập gói mô hình".

---

## `no-sleep-in-flow`

### SAI — ngủ bằng một tên trần

```ts
await sleep(500)
expect(await world.db.entitlementIsOpen(member.id, planId)).toBe(true)
```

### ĐÚNG — hỏi vòng, có hạn chót, và hạn chót tự nó là một phép khẳng định

```ts
await until(() => world.db.entitlementIsOpen(member.id, planId), {
    timeout: 10_000,
    describe: "quyền dùng gói mở ra sau sự kiện thanh toán",
})
```

### SAI — bộ hẹn giờ bọc trong promise

```ts
await new Promise((resolve) => setTimeout(resolve, 500))
```

Báo đúng **một** lần, với thông điệp `timer`. Nhánh gọi hàm nhìn thấy tổ tiên `new Promise` của mình
và cố tình đứng im, để một giấc ngủ không sinh ra hai phát hiện.

### SAI — vẫn nổ dù bộ hẹn giờ được gọi qua đối tượng toàn cục

```ts
await new Promise((resolve) => globalThis.setTimeout(resolve, 250))
```

Nhánh promise so bằng **văn bản nguồn**, không so bằng nút, nên viết đủ tên đường không giấu được.

### ĐÚNG — chờ một sự kiện thật, không chờ một khoảng thời gian

```ts
const delivered = await world.socket(member).nextMessage("notification", { timeout: 5_000 })
expect(delivered.type).toBe("ENTITLEMENT_OPENED")
```

### Cửa lách và nhầm lẫn

```ts
// LỌT — ngủ qua thành viên. Bộ hẹn giờ dạng promise hiện đại thường được viết đúng như vậy.
import timers from "node:timers/promises"
await timers.setTimeout(500)
await world.clock.wait(500)
```

```ts
// LỌT — đổi tên đưa callee ra ngoài tập năm tên.
import { sleep as settle } from "./util"
await settle(500)

const nap = sleep
await nap(500)
```

```ts
// LỌT — mọi cách đốt thời gian khác.
await new Promise((resolve) => setImmediate(resolve))
await promisify(setTimeout)(500) // callee là một lời gọi hàm; setTimeout chỉ là đối số
const started = Date.now()
while (Date.now() - started < 500) { /* quay không */ }
```

```ts
// LỌT — và đây là nửa còn lại của mã luật: hỏi vòng KHÔNG hạn chót.
// Đúng thứ luật khuyên, viết dở, và không luật nào nhìn thấy.
while (!(await world.db.entitlementIsOpen(member.id, planId))) {
    await world.db.ping()
}
```

Nó treo tới khi bộ chạy tự hết giờ, rồi báo một cái timeout không gọi tên trạng thái nào — đúng cái
thất bại mà `E2E-3` được viết ra để chặn.

```ts
// BÁO THỪA — không hề ngủ, nhưng văn bản nguồn của nút có chứa chuỗi `setTimeout`.
const settled = await new Promise((resolve) => {
    // không dùng setTimeout ở đây; chờ sự kiện thật
    world.broker.once("order.settled", resolve)
})
```

---

## `no-branch-in-flow-step`

### SAI — `if` quanh một phép khẳng định

```ts
it("mở quyền dùng gói khi thanh toán về", async () => {
    const state = await world.db.orderState(orderId)
    if (state === OrderState.Paid) {
        expect(await world.db.entitlementIsOpen(member.id, planId)).toBe(true)
    }
})
```

Lần chạy đi vào đường bỏ qua vẫn xanh trong khi chứng minh ít hơn, và không có gì trong bản báo cáo
nói cho ai biết điều đó vừa xảy ra.

### ĐÚNG — ép điều kiện xảy ra, rồi khẳng định vô điều kiện

```ts
it("mở quyền dùng gói khi thanh toán về", async () => {
    await world.provider.postWebhook({ orderId, status: "PAID" })
    await until(() => world.db.orderState(orderId) === OrderState.Paid)
    expect(await world.db.entitlementIsOpen(member.id, planId)).toBe(true)
})
```

### SAI — toán tử ba ngôi trong một bước

```ts
it("tính đúng số dư sau khi trừ", async () => {
    const expected = isTrial ? openingBalance : openingBalance - price
    expect(await world.db.walletBalance(member.id)).toBe(expected)
})
```

### ĐÚNG — hai kết quả hợp lệ là hai bước, hoặc hai luồng

```ts
it("thành viên dùng thử không bị trừ số dư", async () => {
    expect(await world.db.walletBalance(trialMember.id)).toBe(openingBalance)
})

it("thành viên trả phí bị trừ đúng giá gói", async () => {
    expect(await world.db.walletBalance(payingMember.id)).toBe(openingBalance - price)
})
```

### SAI — `switch` và toán tử logic đứng thành câu lệnh

```ts
it("ghi nhận kết quả đối soát", async () => {
    switch (await world.db.orderState(orderId)) {
        case OrderState.Paid:
            expect(await world.db.entitlementIsOpen(member.id, planId)).toBe(true)
            break
        default:
            break
    }
})
```

```ts
it("thông báo tới đúng người nhận", async () => {
    // `a && b` đứng nguyên một câu lệnh là một `if` viết trá hình
    delivered && expect(delivered.memberId).toBe(member.id)
})
```

### ĐÚNG — bước có tiền tố vẫn là bước, và vẫn bị giữ

```ts
it.each([["monthly"], ["yearly"]])("phát hành hoá đơn cho chu kỳ %s", async (cycle) => {
    expect(await world.db.invoiceCycle(await world.graphql(member).issue({ cycle }))).toBe(cycle)
})
```

`insideStep` đọc cả `callee.object.name`, nên `it.each`, `it.only`, `it.skip` và `test.each` đều được
tính là bước — một nhánh đặt trong đó vẫn bị báo.

### Cửa lách và nhầm lẫn

```ts
// LỌT — cùng một nhánh, chuyển vào một hàm mà bước gọi ra. Cùng tệp, và vẫn ở ngoài luật.
const expectOpenIfPaid = async (state: OrderState) => {
    if (state === OrderState.Paid) {
        expect(await world.db.entitlementIsOpen(member.id, planId)).toBe(true)
    }
}

it("mở quyền dùng gói khi thanh toán về", async () => {
    await expectOpenIfPaid(await world.db.orderState(orderId))
})
```

```ts
// LỌT — nhánh trong phần dựng cảnh. Đây là chỗ một luồng hay rơi vào việc
// khẳng định khác nhau giữa các lần chạy.
beforeAll(async () => {
    world = await bootE2eWorld()
    if (process.env.SEED_LEGACY === "1") {
        await world.db.seedLegacyPlans()
    }
})
```

```ts
// LỌT — rẽ nhánh không nằm trong bốn loại nút.
it("không nổ khi đối soát chạy hai lần", async () => {
    try {
        await world.graphql(member).reconcile({ orderId })
    } catch {
        // nuốt lỗi: bước này xanh dù nghiệp vụ hỏng
    }
    const results = await Promise.allSettled([world.db.orderState(orderId)])
    expect(results).toHaveLength(1)
})
```

```ts
// LỌT — `??` khởi tạo là LogicalExpression nhưng không ở vị trí câu lệnh;
// và chuỗi truy cập có dấu hỏi trên chính giá trị đang khẳng định cũng không phải nút bị duyệt.
it("gửi thông báo tới thành viên", async () => {
    const delivered = (await world.socket(member).nextMessage("notification")) ?? fallbackMessage
    expect(delivered?.type).toBe("ENTITLEMENT_OPENED")
})
```

```ts
// LỌT — toán tử logic nằm trong biểu thức được tha có chủ ý.
// Bài kiểm thử này chuẩn bị sẵn cho cả hai kết quả, và đi qua sạch.
it("đơn về một trong hai trạng thái cuối", async () => {
    const state = await world.db.orderState(orderId)
    expect(state === OrderState.Paid || state === OrderState.Settled).toBe(true)
})
```

```ts
// LỌT — không cần toán tử nào cả. Phép khẳng định đủ lỏng để đúng trên cả hai đường.
it("mở quyền dùng gói", async () => {
    const rows = await world.db.entitlements(member.id)
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ planId })]))
    expect(rows.length).toBeGreaterThanOrEqual(0) // luôn đúng
})
```

---

## Ánh xạ yêu cầu sang một luật lint

Nêu tên tệp, nút cú pháp và chuỗi được đọc. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ
thể rồi dừng.

| Yêu cầu bằng lời | Nút bị duyệt | Luật | Kết quả |
|---|---|---|---|
| Chặn bài kiểm thử phân giải rồi gọi thẳng một actor nội bộ | `CallExpression` | `e2e-uses-production-transport` | Chỉ nổ khi phương thức tên `execute`/`process`, hoặc bên nhận là định danh trần đuôi `Worker`/`Handler` |
| Chặn nhập bộ điều phối CQRS | `ImportDeclaration` | `e2e-uses-production-transport` | Chỉ khi nguồn đúng bằng `@nestjs/cqrs` và là `ImportSpecifier` |
| Bắt tệp chỉ khẳng định vào phong bì phản hồi | `Identifier` + `Program:exit` | `e2e-asserts-persisted-state` | Chỉ đếm sự **xuất hiện** của sáu cái tên, một báo cáo mỗi tệp |
| Chặn e2e chạm tới nhà cung cấp mô hình | `ImportDeclaration` | `no-model-call-in-e2e` | Chỉ bắt câu nhập tĩnh khớp sáu mẫu; gọi bằng HTTP hoặc để nguyên khách hàng thật thì không |
| Chặn chờ theo khoảng thời gian | `CallExpression`, `NewExpression` | `no-sleep-in-flow` | Chỉ năm tên trần, cộng `new Promise` có chữ `setTimeout` trong văn bản nguồn |
| Buộc phép hỏi vòng phải có hạn chót | — | **không luật nào** | Nửa còn lại của `E2E-3`, không có máy giữ |
| Chặn một bước rẽ nhánh | bốn loại nút | `no-branch-in-flow-step` | Chỉ khi nằm **theo văn bản** trong thân `it`/`test` |
| Chặn bài kiểm thử đặt tên tệp ra ngoài `.e2e-spec.ts` | — | **không luật nào** | Cổng tệp là điều kiện để luật được lắp, nên không luật nào tự canh được nó |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `direct` / `actor` | Tên phương thức có đúng là `execute`/`process` không, hay điều làm luật nổ là cái đuôi của bên nhận? |
| `busImport` / `direct` | Vi phạm nằm ở câu nhập, hay ở lời gọi? Một tệp có thể dính cả hai và nhận hai báo cáo. |
| `state` báo đúng / báo thừa | Trong tệp có tên nào trong sáu tên không, và tên đó có nằm ở chỗ **đọc** hay ở chỗ **ghi**? |
| `sleep` / `timer` | Lời gọi có tổ tiên là `new Promise` không? Nếu có, nhánh promise sở hữu ca đó và chỉ báo một lần. |
| `branch` bắt / không bắt | Nhánh nằm **theo văn bản** trong thân `it`/`test`, hay trong một hàm mà bước gọi ra? |
| Trong phạm vi / ngoài phạm vi | Tên tệp có kết thúc bằng `.e2e-spec.ts` không? Nếu không, không luật nào được lắp. |

## Sai lầm lặp lại nhiều nhất

1. Tin rằng `e2e-asserts-persisted-state` chứng minh tệp có khẳng định — nó chỉ chứng minh tệp có
   **nhắc tới** một cái tên.
2. Chuyển mã vi phạm sang một tệp trợ giúp rồi coi như đã sửa. Cả năm luật biến mất cùng lúc.
3. Đổi `worker.process(job)` thành `worker["process"](job)` để hết báo.
4. Thay `sleep(500)` bằng một vòng hỏi không hạn chót, rồi tưởng đã theo `E2E-3`.
5. Chuyển `if` vào một hàm trợ giúp cùng tệp, rồi tưởng bước đã hết rẽ nhánh.
6. Viết dòng tắt luật cho `builder.execute()` — và tắt luôn hai nhánh còn lại của cùng luật đó trên
   dòng ấy.
7. Nghĩ rằng không thấy báo nào tức là không có lời gọi mô hình nào, trong khi lời gọi đắt nhất là
   lời gọi không nhập gì cả.
