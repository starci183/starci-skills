---
id: be-patterns-cqrs-example
title: example.md
slug: /be/patterns/cqrs/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã CQRS-N, viết bằng TypeScript thường.
---

# example.md

> Version: `2.00` · Module: `cqrs` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường trong một ứng dụng có hình dạng Nest**. Không có tên sản phẩm,
không tên công ty, không tên repository. Một luật chỉ đúng khi nó đúng ở bất kỳ backend nào — nên nếu
một ví dụ cần tên riêng của một hệ thống cụ thể mới đọc được thì ví dụ đó không phù hợp ở đây.

Mỗi mã có **nhiều case**, mỗi case đặt ĐÚNG cạnh SAI, sau đó là mục **ngoại lệ và nhầm lẫn**. Phần cuối
trang ánh xạ một yêu cầu bằng lời sang một vị trí file duy nhất.

---

## `CQRS-1` — một thao tác, một thư mục

### Case: thư mục của một thao tác

```text
add-to-cart/
    add-to-cart.command.ts             message
    add-to-cart.handler.ts             công việc
    add-to-cart.service.ts             dispatch
    add-to-cart.resolver.ts            cửa
    add-to-cart.module.ts              wiring
    add-to-cart.module-definition.ts   định nghĩa của wiring
    add-to-cart.handler.spec.ts        spec song sinh
```

```text
add-to-cart/
    add-to-cart.command.ts
    add-to-cart.handler.ts
    add-to-cart.service.ts
    add-to-cart.resolver.ts
    cart-utils.ts                      SAI: tên này không phải tên thao tác
    price.helper.ts                    SAI: vừa phát minh ra chỗ không ai đi tìm
```

Hai thư mục khác nhau đúng một chuyện: ở cái thứ nhất, biết tên thao tác là biết mọi tên file; ở cái
thứ hai, hai file chỉ tìm ra được bằng cách mở thư mục lên xem.

### Case: hàm dùng chung bị sinh ra trong thư mục thao tác

```ts
// SAI: add-to-cart/price.helper.ts
export const applyDiscount = (amount: number, percent: number): number =>
    Math.round(amount * (100 - percent) / 100)
```

```ts
// ĐÚNG: modules/pricing/discount.ts — một chỗ có tên nói nó là gì
export const applyDiscount = (amount: number, percent: number): number =>
    Math.round(amount * (100 - percent) / 100)
```

```ts
// ĐÚNG: add-to-cart/add-to-cart.handler.ts nhập nó về
import { applyDiscount } from "@modules/pricing/discount"
```

Thao tác thứ hai cần công thức giảm giá sẽ tìm thấy bản trên và **chép** bản dưới. Số lượng bản sao
của một quy tắc giá là số lần nó sẽ được sửa lệch nhau.

### Case: query giữ đúng hình dáng đó

```text
list-invoices/
    list-invoices.query.ts
    list-invoices.handler.ts
    list-invoices.service.ts
    list-invoices.resolver.ts
    list-invoices.module.ts
    list-invoices.handler.spec.ts
```

Query không phải một hạng công dân nhẹ hơn. Nó cũng có nhiều cửa, nên nó cũng có message.

### Case: một thao tác bị xẻ làm hai chỗ

```text
SAI
mutations/orders/place-order/
    place-order.command.ts
    place-order.resolver.ts
shared/handlers/
    place-order.handler.ts             công việc nằm ở một cây khác
```

```text
ĐÚNG
mutations/orders/place-order/
    place-order.command.ts
    place-order.handler.ts
    place-order.resolver.ts
```

### Ngoại lệ và nhầm lẫn

- **Type transport của chính thao tác được phép ở thư mục con mang tên vai trò:**

  ```text
  add-to-cart/
      graphql-types/
          request.ts
          response.ts
      add-to-cart.command.ts
      add-to-cart.handler.ts
  ```

  Chúng chỉ tồn tại vì cửa của thao tác này, nên chúng là một phần của thao tác. Đây là chỗ luật được
  đọc rộng nhất, và nó được ghi nhận trong `audit.md` chứ không bị sửa lén.

- **Thư mục sạch vẫn có thể thiếu spec.** Đó là `CQRS-7`, không phải `CQRS-1`.
- **Đặt tên thư mục theo danh từ (`cart/`) thay vì theo thao tác (`add-to-cart/`)** làm mất luôn cái
  tính chất khiến luật này có ích: grep một thao tác ra một thao tác.

---

## `CQRS-2` — message chỉ bê request context

### Case: hình dáng message

```ts
/** ĐÚNG: một field params, không gì khác. */
export class AddToCartCommand {
    constructor(
        readonly params: ExecuteParams<AddToCartRequest>,
    ) {}
}
```

```ts
/** SAI: mỗi chỗ dispatch sẽ tự lắp ba tham số này theo một thứ tự của riêng nó. */
export class AddToCartCommand {
    constructor(
        readonly productId: string,
        readonly user: UserEntity,
        readonly locale: Locale,
    ) {}
}
```

Khác nhau ở chỗ: cái thứ nhất chỉ có một cách gọi đúng, cái thứ hai có sáu cách gọi và năm trong số
đó compile.

### Case: message tự tính

```ts
/** SAI: một quyết định vừa được đặt vào file mà không ai đọc để tìm quyết định. */
export class PlaceOrderCommand {
    constructor(
        readonly params: ExecuteParams<PlaceOrderRequest>,
    ) {}

    get totalAmount(): number {
        return this.params.request.items.reduce((sum, item) => sum + item.price, 0)
    }
}
```

```ts
/** ĐÚNG: message chở nguyên request, handler mới là chỗ cộng tiền. */
export class PlaceOrderCommand {
    constructor(
        readonly params: ExecuteParams<PlaceOrderRequest>,
    ) {}
}
```

```ts
/** ĐÚNG: phép cộng nằm ở chỗ nó chịu trách nhiệm được. */
protected override async process(command: PlaceOrderCommand): Promise<OrderEntity> {
    const totalAmount = this.pricing.total(command.params.request.items)
    // ...
}
```

Nếu tổng tiền được tính trong message, hai chỗ dispatch cùng message ấy sẽ **đồng ý với nhau về code
mà bất đồng về nghĩa**: một chỗ đã áp mã giảm giá vào `items`, chỗ kia thì chưa.

### Case: default nằm trong message

```ts
/** SAI: "trang mặc định là 1" là một luật, và nó vừa bị giấu vào một constructor. */
export class ListInvoicesQuery {
    constructor(
        readonly params: ExecuteParams<ListInvoicesRequest>,
    ) {
        this.params.request.page = this.params.request.page ?? 1
    }
}
```

```ts
/** ĐÚNG: message không sửa gì, và default là quyết định của handler. */
export class ListInvoicesQuery {
    constructor(
        readonly params: ExecuteParams<ListInvoicesRequest>,
    ) {}
}
```

Message ở bản SAI còn **sửa ngược vào request** của người gọi, nên hai lần dispatch cùng một object
sẽ cho hai kết quả khác nhau.

### Case: message không được biết mình sẽ được xử lý thế nào

```ts
/** SAI: message tự phân quyền — cửa nào dispatch nó cũng phải tin cái hàm này. */
export class CancelSubscriptionCommand {
    constructor(
        readonly params: ExecuteParams<CancelSubscriptionRequest>,
    ) {}

    isAllowed(): boolean {
        return this.params.user.roles.includes("owner")
    }
}
```

```ts
/** ĐÚNG: message trần; quyền là một quyết định, nên nó ở handler. */
export class CancelSubscriptionCommand {
    constructor(
        readonly params: ExecuteParams<CancelSubscriptionRequest>,
    ) {}
}
```

### Ngoại lệ và nhầm lẫn

- **`.command.ts` có decorator là một cửa CLI, không phải message CQRS:**

  ```ts
  /** Ngoại lệ: đây là DOOR của framework CLI, `run` là entry của nó. */
  @Command({ name: "reindex-catalog" })
  export class ReindexCatalogCliCommand extends CommandRunner {
      constructor(private readonly reindexCatalogService: ReindexCatalogService) { super() }

      async run(): Promise<void> {
          await this.reindexCatalogService.execute({ request: {}, locale: Locale.En })
      }
  }
  ```

  Cửa này **cũng** đi qua service tới message như mọi cửa khác — nó chỉ trùng hậu tố tên file.

- **Query cũng là message.** Cùng luật, cùng hình dáng, chỉ khác bus.
- **`readonly` không phải trang trí.** Message bị sửa sau khi dispatch là message mà log và retry
  không còn tả đúng nữa.

---

## `CQRS-3` — `process`, không bao giờ `execute`

### Case: seam của base

```ts
/** Base: `execute` là cửa công khai, `process` là chỗ handler cắm vào. */
export abstract class ICQRSHandler<TParams, TResponse = unknown> {
    async execute(params: TParams): Promise<TResponse> {
        return await this.process(params)
    }

    protected abstract process(params: TParams): Promise<TResponse>
}
```

Mọi thứ cắt ngang — đo thời gian, transaction, retry — được thêm vào `execute` một lần và chạm tới
mọi handler đang ở trong template.

### Case: handler trong template và handler đã bước ra

```ts
/** ĐÚNG: vẫn đi qua base, nên thay đổi cắt ngang lần sau chạm tới file này. */
@CommandHandler(AddToCartCommand)
@Injectable()
export class AddToCartHandler
    extends ICQRSHandler<AddToCartCommand, CartItemEntity>
    implements ICommandHandler<AddToCartCommand, CartItemEntity> {
    protected override async process(command: AddToCartCommand): Promise<CartItemEntity> {
        return this.entityManager.save(cartItem)
    }
}
```

```ts
/** SAI: compile được, chạy được, và là file duy nhất transaction mới thêm sẽ bỏ sót. */
@CommandHandler(AddToCartCommand)
@Injectable()
export class AddToCartHandler
    extends ICQRSHandler<AddToCartCommand, CartItemEntity>
    implements ICommandHandler<AddToCartCommand, CartItemEntity> {
    override async execute(command: AddToCartCommand): Promise<CartItemEntity> {
        return this.entityManager.save(cartItem)
    }
}
```

Hai bản khác nhau đúng một chuyện: **base còn chạy hay không**. Không có test nào đỏ vì chuyện đó, và
đó chính là lý do phải có rule.

### Case: handler đứng một mình mà không có `process`

```ts
/** SAI: không kế thừa base, cũng không có `process` — không có gì để dispatch tới. */
@QueryHandler(ListInvoicesQuery)
@Injectable()
export class ListInvoicesHandler implements IQueryHandler<ListInvoicesQuery> {
    async run(query: ListInvoicesQuery): Promise<Array<InvoiceEntity>> {
        return this.invoices.find({ where: { userId: query.params.user.id } })
    }
}
```

```ts
/** ĐÚNG: kế thừa template, cài đúng cái method template gọi. */
@QueryHandler(ListInvoicesQuery)
@Injectable()
export class ListInvoicesHandler
    extends ICQRSHandler<ListInvoicesQuery, Array<InvoiceEntity>>
    implements IQueryHandler<ListInvoicesQuery, Array<InvoiceEntity>> {
    protected override async process(query: ListInvoicesQuery): Promise<Array<InvoiceEntity>> {
        return this.invoices.find({ where: { userId: query.params.user.id } })
    }
}
```

### Case: handler của event cũng ở trong template

```ts
@EventsHandler(SendMailEvent)
@Injectable()
export class SendMailHandler extends ICQRSHandler<SendMailEvent, void> {
    protected override async process(event: SendMailEvent): Promise<void> {
        await this.mailQueue.add("send-mail", event.payload)
    }
}
```

### Ngoại lệ và nhầm lẫn

- **Handler trừu tượng trung gian: lớp con không khai báo gì cả và vẫn đúng.**

  ```ts
  /** Ngoại lệ, phần 1: cả họ tìm kiếm giống nhau, `process` viết một lần. */
  export abstract class SuggestionHandler<TQuery extends { params: ExecuteParams<SuggestionRequest> }>
      extends ICQRSHandler<TQuery, Array<SuggestionEntity>> {
      protected abstract source(): SuggestionSource

      protected override async process(query: TQuery): Promise<Array<SuggestionEntity>> {
          return this.search.byPrefix(this.source(), query.params.request.prefix)
      }
  }
  ```

  ```ts
  /** Ngoại lệ, phần 2: lớp con THỪA HƯỞNG `process`. Không thiếu gì cả. */
  @QueryHandler(SuggestTagsQuery)
  @Injectable()
  export class SuggestTagsHandler extends SuggestionHandler<SuggestTagsQuery> {
      protected override source(): SuggestionSource {
          return SuggestionSource.Tag
      }
  }
  ```

- **Service có method tên `execute` là ĐÚNG.** Service không kế thừa template nào; `execute` sai chỗ
  là `execute` trên handler.
- **`public process` là mất một nửa ý nghĩa.** `protected` nói rằng ngoài base ra không ai được gọi
  thẳng vào công việc.

---

## `CQRS-4` — service dispatch, và chỉ có thế

### Case: service mỏng và service béo

```ts
/** ĐÚNG: nó bê request tới bus, và nó không biết gì về giỏ hàng. */
async execute(params: ExecuteParams<AddToCartRequest>): Promise<CartItemEntity> {
    return this.commandBus.execute(new AddToCartCommand(params))
}
```

```ts
/** SAI: luật "đã sở hữu rồi thì không thêm nữa" vừa rơi vào chỗ không có message. */
async execute(params: ExecuteParams<AddToCartRequest>): Promise<CartItemEntity> {
    if (await this.ownerships.owns(params.user.id, params.request.productId)) {
        throw new ProductAlreadyOwnedException({ productId: params.request.productId })
    }
    return this.commandBus.execute(new AddToCartCommand(params))
}
```

Khác nhau đúng một chuyện: **cửa thứ hai có với tới luật đó được không**. Cái CLI nhập hàng loạt sẽ
không với tới, và nó sẽ mọc ra bản sao của luật ấy.

### Case: service map dữ liệu

```ts
/** SAI: hình dáng trả về của thao tác được quyết định ở nơi không test được nếu không dựng cửa. */
async execute(params: ExecuteParams<ListInvoicesRequest>): Promise<Array<InvoiceView>> {
    const invoices = await this.queryBus.execute(new ListInvoicesQuery(params))
    return invoices.map((invoice) => ({
        id: invoice.id,
        amount: `${invoice.amount / 100}`,
    }))
}
```

```ts
/** ĐÚNG: hình dáng trả về là một quyết định, nên nó ở handler. */
async execute(params: ExecuteParams<ListInvoicesRequest>): Promise<Array<InvoiceView>> {
    return this.queryBus.execute(new ListInvoicesQuery(params))
}
```

### Case: service ghép hai thao tác

```ts
/** SAI: một quy trình nghiệp vụ vừa được viết ở chỗ không có tên, không có message, không có spec. */
async execute(params: ExecuteParams<CheckoutRequest>): Promise<OrderEntity> {
    const order = await this.commandBus.execute(new PlaceOrderCommand(params))
    await this.commandBus.execute(new ClearCartCommand(params))
    return order
}
```

```ts
/** ĐÚNG: quy trình có tên riêng, và cái tên ấy là một thao tác. */
async execute(params: ExecuteParams<CheckoutRequest>): Promise<OrderEntity> {
    return this.commandBus.execute(new CheckoutCommand(params))
}
```

Bản SAI còn giấu một câu hỏi không ai trả lời: nếu bước thứ hai hỏng thì đơn hàng vừa tạo còn hay
mất. Trong một handler, câu hỏi đó có một chỗ để trả lời.

### Case: cửa không được tự import bus

```ts
/** SAI: cửa biết về bus, nên mỗi cửa mới lại lặp lại cách dựng message. */
async execute(@Args("request") request: AddToCartRequest): Promise<CartItemEntity> {
    return this.commandBus.execute(new AddToCartCommand({ request, user, locale }))
}
```

```ts
/** ĐÚNG: cửa chỉ biết service của thao tác. */
async execute(@Args("request") request: AddToCartRequest): Promise<CartItemEntity> {
    return this.addToCartService.execute({ request, user, locale })
}
```

### Ngoại lệ và nhầm lẫn

- **"Service mỏng thế này thì để làm gì?"** Nó vô nghĩa đúng tới lúc cửa thứ hai xuất hiện — mà CLI và
  bộ test thì đã là cửa thứ hai rồi.
- **Ném exception trong service vẫn sai**, dù exception đúng: sai ở chỗ **quyết định** ném nằm ngoài
  handler.
- **Đọc cache trong service cũng là nghiệp vụ.** "Có cache thì khỏi dispatch" là một luật, và nó
  thuộc về handler.

---

## `CQRS-5` — handler sở hữu thất bại

### Case: `null` và exception

```ts
/** ĐÚNG: cái tên chở theo dữ liệu người gọi sẽ cần. */
if (!product) {
    throw new ProductNotFoundException({ productId })
}
```

```ts
/** SAI: không tồn tại, đã bị xoá, và không có quyền đọc cùng về dưới một `null`. */
if (!product) {
    return null
}
```

Khác nhau đúng một chuyện: **lý do có sống sót qua lời trả về hay không**.

### Case: shape thành công chở lỗi

```ts
/** SAI: mỗi người gọi sẽ giải mã cái shape này một kiểu, và không ai giải mã hết các nhánh. */
protected override async process(command: RefundOrderCommand): Promise<RefundResult> {
    if (order.status !== OrderStatus.Paid) {
        return { ok: false, error: "ORDER_NOT_PAID" }
    }
    return { ok: true, refundId: refund.id }
}
```

```ts
/** ĐÚNG: nhánh từ chối có danh tính, nhánh thành công có kiểu trả về thật. */
protected override async process(command: RefundOrderCommand): Promise<RefundEntity> {
    if (order.status !== OrderStatus.Paid) {
        throw new OrderNotRefundableException({ orderId: order.id, status: order.status })
    }
    return refund
}
```

### Case: nuốt lỗi rồi trả rỗng

```ts
/** SAI: người gọi đọc "không có hoá đơn nào" trong khi sự thật là "không hỏi được database". */
protected override async process(query: ListInvoicesQuery): Promise<Array<InvoiceEntity>> {
    try {
        return await this.invoices.find({ where: { userId: query.params.user.id } })
    } catch {
        return []
    }
}
```

```ts
/** ĐÚNG: rỗng là một câu trả lời, hỏng là một câu trả lời khác. */
protected override async process(query: ListInvoicesQuery): Promise<Array<InvoiceEntity>> {
    return this.invoices.find({ where: { userId: query.params.user.id } })
}
```

### Case: exception có danh tính, không phải `Error` trần

```ts
/** SAI: người gọi chỉ còn cách so sánh chuỗi. */
throw new Error("subscription already cancelled")
```

```ts
/** ĐÚNG: một danh tính bắt được, một payload dùng được. */
throw new SubscriptionAlreadyCancelledException({ subscriptionId, cancelledAt })
```

### Ngoại lệ và nhầm lẫn

- **`null` là kết quả hợp lệ khi nó thật sự có nghĩa "không có, và không có là bình thường".** Một
  query "lấy nháp hiện tại nếu có" trả `null` là đúng; một lệnh "lấy đơn hàng theo id" trả `null` là
  sai.
- **Thất bại của việc phụ không được giết câu trả lời chính.** Mail không gửi được là chuyện của
  handler event, xem `CQRS-6`.
- **Đừng gói exception nghiệp vụ vào exception hạ tầng.** Người gọi mất đúng cái nó cần để phân biệt
  lỗi của mình với lỗi của hệ thống.

---

## `CQRS-6` — event cho việc kiểu gì cũng phải xảy ra

### Case: mail đi dù người đọc đã rời trang

```ts
/** ĐÚNG: câu trả lời không phụ thuộc vào mail, nên mail là event. */
this.eventBus.publish(new SendMailEvent({ template: MailTemplate.OrderPlaced, to: user.email, orderId: order.id }))
return order
```

```ts
/** SAI: người gọi cần đơn hàng, nên đây là một command bị viết thành event — nó không trả về gì. */
this.eventBus.publish(new PlaceOrderEvent({ userId: user.id, items }))
return null
```

Khác nhau đúng một chuyện: **câu trả lời của chính người gọi có phụ thuộc vào nó không**.

### Case: publish rồi đi hỏi lại database

```ts
/** SAI: resolver vừa yêu cầu tạo một dòng rồi quay ra dò xem nó có chưa. */
this.eventBus.publish(new CreateSubscriptionEvent({ userId, planId }))
await sleep(300)
return this.subscriptions.findOne({ where: { userId, planId } })
```

```ts
/** ĐÚNG: cần kết quả thì dispatch command và nhận về kết quả. */
return this.commandBus.execute(new CreateSubscriptionCommand(params))
```

Vòng `sleep` không phải một chi tiết cẩu thả; nó là **triệu chứng**. Nó chỉ xuất hiện khi một command
đã bị viết thành event.

### Case: projection và đồng bộ

```ts
/** ĐÚNG: projection phải cập nhật dù người gọi còn đó hay không. */
protected override async process(command: PublishArticleCommand): Promise<ArticleEntity> {
    const article = await this.articles.save(draft.publish())
    this.eventBus.publish(new SyncReadModelEvent({ entity: "article", id: article.id }))
    return article
}
```

```ts
/** ĐÚNG: handler của event làm việc phụ, và thất bại ở đây không giết câu trả lời chính. */
@EventsHandler(SyncReadModelEvent)
@Injectable()
export class SyncReadModelHandler extends ICQRSHandler<SyncReadModelEvent, void> {
    protected override async process(event: SyncReadModelEvent): Promise<void> {
        await this.readModel.upsert(event.payload)
    }
}
```

### Case: event mang payload, không mang request context

```ts
/** ĐÚNG: event chở đúng thứ việc phụ cần. */
export class SendMailEvent {
    constructor(
        readonly payload: SendMailPayload,
    ) {}
}
```

```ts
/** SAI: event chở nguyên request và user để handler tự đoán phải làm gì với chúng. */
export class SendMailEvent {
    constructor(
        readonly params: ExecuteParams<PlaceOrderRequest>,
    ) {}
}
```

Event không có người gọi đang chờ, nên nó không có "request context" nào để chở. Chở cả request vào
đây là mời handler event đi làm lại phần việc của command.

### Ngoại lệ và nhầm lẫn

- **"Publish rồi await luôn cho chắc"** là command viết bằng cú pháp event, và nó mất luôn giá trị
  trả về.
- **Việc chậm không tự động là event.** Một lần tính tiền chậm mà người gọi cần kết quả thì vẫn là
  command; chậm là chuyện của timeout, không phải chuyện của loại message.
- **Một event, nhiều handler là bình thường.** Đó chính là lý do event tồn tại: bên phát không cần
  biết có bao nhiêu bên nghe.

---

## `CQRS-7` — spec song sinh nằm cạnh handler

### Case: spec ở đúng chỗ và spec bị dời đi

```text
ĐÚNG
place-order/
    place-order.command.ts
    place-order.handler.ts
    place-order.handler.spec.ts
```

```text
SAI
place-order/
    place-order.command.ts
    place-order.handler.ts
test/unit/orders/
    place-order.spec.ts                chỉ người đi tìm test mới thấy nó
```

Cả hai đều chạy. Khác nhau ở chỗ: bản trên đập vào mắt người sửa handler, bản dưới thì không.

### Case: spec bám vào các nhánh quyết định

```ts
describe("PlaceOrderHandler", () => {
    it("ném OrderEmptyException khi giỏ không còn item nào", async () => {
        await expect(handler.execute(command)).rejects.toBeInstanceOf(OrderEmptyException)
    })

    it("trả về đơn hàng đã lưu khi mọi item còn bán", async () => {
        await expect(handler.execute(command)).resolves.toMatchObject({ status: OrderStatus.Pending })
    })
})
```

Spec gọi `execute` chứ không gọi `process`: nó kiểm cả template, nên một ngày nào đó handler lén bước
ra khỏi base thì spec vẫn đi qua đúng con đường thật.

### Ngoại lệ và nhầm lẫn

- **Đặt spec tên khác tên thao tác** làm hỏng đúng cái tính chất khiến `CQRS-1` có ích: grep một thao
  tác không ra spec của nó.
- **Có e2e rồi nên khỏi unit** là đổi một câu hỏi lấy một câu hỏi khác. E2E hỏi "đường đi có thông
  không"; spec song sinh hỏi "nhánh từ chối này có đúng không", và nhánh từ chối là thứ e2e ít khi
  dựng đủ.
- **Rule kiểm spec đọc TÊN FILE, không đọc đĩa.** Một rule đi `stat` filesystem sẽ báo khác nhau tuỳ
  theo đang checkout những gì, và một rule mà kết quả phụ thuộc vào working tree là rule không ai tái
  lập được.

---

## Ánh xạ yêu cầu sang vị trí code

Nêu thao tác, các cửa và loại message. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể
rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Vị trí |
|---|---|---|---|
| "Thêm mutation thêm sản phẩm vào giỏ" | Thao tác mới, nhiều cửa | `CQRS-1` | `add-to-cart/` với đủ bộ file mang tên thao tác |
| "Truyền thêm locale xuống cho handler" | Đó là request context | `CQRS-2` | Vào trong `params`, không thành field thứ hai |
| "Đo thời gian chạy mọi handler" | Đó là mối quan tâm cắt ngang | `CQRS-3` | `execute` của base; handler không đổi |
| "Chặn thêm sản phẩm đã sở hữu" | Đó là một luật nghiệp vụ | `CQRS-4` → handler | `process` của handler, không phải service |
| "Trả gì khi không tìm thấy đơn hàng" | Đó là một thất bại có tên | `CQRS-5` | `throw new OrderNotFoundException({ orderId })` |
| "Gửi mail sau khi đặt hàng" | Người gọi không chờ mail | `CQRS-6` | `eventBus.publish(new SendMailEvent(...))` |
| "Trả về đơn hàng vừa tạo" | Người gọi chờ kết quả | `CQRS-6` → command | `commandBus.execute(new PlaceOrderCommand(params))` |
| "Viết test cho luật hoàn tiền" | Quyết định nằm ở handler | `CQRS-7` | `refund-order.handler.spec.ts` cùng thư mục |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `CQRS-1` / `CQRS-7` | File này **được phép** nằm đây, hay **bắt buộc** phải nằm đây? |
| `CQRS-2` / `CQRS-4` | Nghiệp vụ này đang nằm ở chỗ không ai đọc, hay ở chỗ không cửa nào gọi tới được? |
| `CQRS-3` | Nếu base thêm transaction vào tuần sau, file này có nhận được không? |
| `CQRS-4` / `CQRS-5` | Quyết định từ chối này do ai đưa ra — service hay handler? |
| `CQRS-5` / `CQRS-6` | Thất bại này có làm hỏng câu trả lời người gọi đang chờ không? |
| `CQRS-6` / `CQRS-2` | Câu trả lời của người gọi có phụ thuộc vào việc này xong hay chưa? |
| `CQRS-1` / `CQRS-4` | Đây là câu hỏi file nằm ở đâu, hay câu hỏi file chứa gì? |

## Sai lầm lặp lại nhiều nhất

1. Viết luật nghiệp vụ vào service vì "có mỗi một câu `if`".
2. Override `execute` vì nó public và nó chạy.
3. Trả `null` để nói "không được", rồi để người gọi đoán.
4. Publish event cho thứ người gọi đang chờ, xong đi hỏi lại database.
5. Sinh một file `utils` trong thư mục thao tác, rồi thao tác thứ hai chép nó.
6. Cho message tự tính một giá trị vì "tiện".
7. Dời spec sang cây test tập trung cho "gọn thư mục".
8. Ném `Error` trần thay vì exception có danh tính.
