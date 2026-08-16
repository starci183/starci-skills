---
id: be-lints-cqrs-example
title: example.md
slug: /be/lints/cqrs/example
sidebar_label: example.md
sidebar_position: 2
description: Code nổ và code không nổ cho từng quy tắc, kèm code lách qua được.
---

# example.md

> Version: `2.00` · Mô-đun: `cqrs` · Luật: [`INDEX.md`](./INDEX.md) · Từng quy tắc: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi mục dưới đây là **một quy tắc**, với nhiều cặp **SAI** (quy tắc nổ) và **ĐÚNG** (quy tắc im), rồi
tới **Cửa lách và nhầm lẫn** — nơi chứa code **lách qua được**.

Đọc kỹ nhãn ở mục cuối mỗi phần: code trong đó **không phải code được phép viết**. Nó là code vi
phạm luật mà quy tắc **không thấy**. Luật vẫn cấm; chỉ có cái máy là không bắt.

Tên tệp được ghi ngay trên mỗi khối, vì với hai trong ba quy tắc, **tên tệp là một phần của phép
kiểm**.

---

## `handler-overrides-process`

Quy tắc này không có cổng tên tệp. Nó sống ở mọi tệp, và chỉ mở ra khi lớp mang một decorator tên
`CommandHandler`, `QueryHandler` hoặc `EventsHandler`.

### Cặp 1 — bước ra khỏi khuôn mẫu

**SAI** — `add-to-cart/add-to-cart.handler.ts`

```ts
@CommandHandler(AddToCartCommand)
@Injectable()
export class AddToCartHandler extends ICQRSHandler<AddToCartCommand, CartItemEntity> {
    override async execute(command: AddToCartCommand): Promise<CartItemEntity> {
        return this.entityManager.save(this.build(command.params))
    }
}
```

Báo `overridesExecute` ngay tại khoá `execute`. Tệp này biên dịch, chạy đúng, và là tệp duy nhất
không nhận được mối quan tâm cắt ngang tiếp theo thêm vào lớp cơ sở.

**ĐÚNG** — cùng tệp

```ts
@CommandHandler(AddToCartCommand)
@Injectable()
export class AddToCartHandler extends ICQRSHandler<AddToCartCommand, CartItemEntity> {
    protected override async process(command: AddToCartCommand): Promise<CartItemEntity> {
        return this.entityManager.save(this.build(command.params))
    }
}
```

Khác nhau đúng một chuyện: lớp cơ sở còn chạy hay không.

### Cặp 2 — lớp xử lý không có việc để điều phối tới

**SAI** — `archive-order/archive-order.handler.ts`

```ts
@CommandHandler(ArchiveOrderCommand)
export class ArchiveOrderHandler {
    constructor(private readonly orders: OrderRepository) {}
}
```

Báo `noProcess` tại tên lớp: có decorator, không kế thừa ai, không `execute`, không `process`.

**ĐÚNG** — cùng tệp

```ts
@CommandHandler(ArchiveOrderCommand)
export class ArchiveOrderHandler {
    constructor(private readonly orders: OrderRepository) {}

    protected async process(command: ArchiveOrderCommand): Promise<OrderEntity> {
        return this.orders.archive(command.params.request.orderId)
    }
}
```

### Cặp 3 — `execute` không cần là một phương thức bình thường mới bị bắt

**SAI** — `list-invoices/list-invoices.handler.ts`

```ts
@QueryHandler(ListInvoicesQuery)
export class ListInvoicesHandler extends ICQRSHandler<ListInvoicesQuery, Array<InvoiceEntity>> {
    private get execute() {
        return this.run
    }
}
```

Vẫn báo `overridesExecute`. Phép quét so khớp `MethodDefinition` theo tên khoá; `private`, `static`,
`async`, `override` và việc nó là getter đều không được hỏi tới.

**ĐÚNG** — cùng tệp

```ts
@QueryHandler(ListInvoicesQuery)
export class ListInvoicesHandler extends ICQRSHandler<ListInvoicesQuery, Array<InvoiceEntity>> {
    protected override async process(query: ListInvoicesQuery): Promise<Array<InvoiceEntity>> {
        return this.load(query.params)
    }

    private load(params: ExecuteParams<ListInvoicesRequest>): Promise<Array<InvoiceEntity>> {
        return this.invoices.findByOwner(params.user.id)
    }
}
```

Một lớp xử lý được phép mang thêm phương thức khác bên cạnh `process`. Chỉ cái tên `execute` bị cấm.

### Cặp 4 — lớp không mang decorator không phải việc của quy tắc này

**ĐÚNG** — `add-to-cart/add-to-cart.service.ts`

```ts
@Injectable()
export class AddToCartService {
    constructor(private readonly commandBus: CommandBus) {}

    async execute(params: ExecuteParams<AddToCartRequest>): Promise<CartItemEntity> {
        return this.commandBus.execute(new AddToCartCommand(params))
    }
}
```

`execute` ở đây là tên công khai của lớp điều phối, không phải khuôn mẫu bị phá. `@Injectable()`
không nằm trong tập tên decorator xử lý, nên quy tắc không mở ra.

**ĐÚNG** — `suggest-products/suggest-products.handler.ts`

```ts
@QueryHandler(SuggestProductsQuery)
export class SuggestProductsHandler extends AbstractSuggestionsHandler<SuggestProductsQuery, Array<ProductEntity>> {
    protected override buildFilter(params: ExecuteParams<SuggestProductsRequest>): SuggestionFilter {
        return { ownerId: params.user.id }
    }
}
```

Không có `process` tại chỗ, nhưng có lớp cha, nên phép kiểm thiếu `process` không chạy. Một họ truy
vấn gợi ý cài `process` một lần ở lớp trung gian là hình dạng hợp lệ.

### Cửa lách và nhầm lẫn

Bốn khối dưới đây **vi phạm `CQRS-3`** và **quy tắc không báo gì cả**. Đây là chỗ hở, không phải chỗ
được phép.

**Lách 1 — `execute` viết thành trường của lớp.**

```ts
@CommandHandler(AddToCartCommand)
export class AddToCartHandler extends ICQRSHandler<AddToCartCommand, CartItemEntity> {
    override execute = async (command: AddToCartCommand): Promise<CartItemEntity> => {
        return this.entityManager.save(this.build(command.params))
    }
}
```

Trường của lớp là `PropertyDefinition`, không phải `MethodDefinition`. Thuộc tính trên thực thể che
phương thức của lớp cơ sở lúc chạy, nên khuôn mẫu **thật sự** bị bỏ — mà phép quét chỉ nhìn phương
thức.

**Lách 2 — khoá dạng chuỗi.**

```ts
@CommandHandler(AddToCartCommand)
export class AddToCartHandler extends ICQRSHandler<AddToCartCommand, CartItemEntity> {
    async ["execute"](command: AddToCartCommand): Promise<CartItemEntity> {
        return this.entityManager.save(this.build(command.params))
    }
}
```

`key.name` không tồn tại với khoá chuỗi hay khoá tính toán, nên phép so sánh diễn ra với `undefined`.

**Lách 3 — decorator đổi tên khi nhập, hoặc gọi qua không gian tên.**

```ts
import { CommandHandler as Handles } from "@nestjs/cqrs"

@Handles(AddToCartCommand)
export class AddToCartHandler extends ICQRSHandler<AddToCartCommand, CartItemEntity> {
    override async execute(command: AddToCartCommand): Promise<CartItemEntity> {
        return this.entityManager.save(this.build(command.params))
    }
}
```

Cổng khớp **cách viết tại chỗ**, không khớp thứ mà nó phân giải ra. Đổi một dòng `import` là cả quy
tắc tắt cho tệp đó.

**Lách 4 — có lớp cha thì không bị hỏi về `process`.**

```ts
@CommandHandler(ArchiveOrderCommand)
export class ArchiveOrderHandler extends BaseOrderHandler {
    // không `process`, không `execute` - và `BaseOrderHandler` cũng không có `process`
    private async run(command: ArchiveOrderCommand): Promise<OrderEntity> {
        return this.orders.archive(command.params.request.orderId)
    }
}
```

Đây là cửa đắt nhất trong ba quy tắc: lớp xử lý **đúng chuẩn** luôn kế thừa lớp cơ sở khuôn mẫu, nên
hình dạng phổ biến nhất lại là hình dạng nửa quy tắc này không bao giờ soi.

---

## `message-carries-params-only`

Quy tắc chỉ tồn tại trong tệp khớp `<tên-thao-tác>.command.ts` hoặc `<tên-thao-tác>.query.ts`, với
`<tên-thao-tác>` chỉ gồm chữ thường, chữ số và dấu gạch ngang. Và nó bỏ qua mọi lớp mang decorator.

### Cặp 1 — thông điệp mọc thêm một phương thức

**SAI** — `add-to-cart/add-to-cart.command.ts`

```ts
export class AddToCartCommand {
    constructor(readonly params: ExecuteParams<AddToCartRequest>) {}

    isValid(): boolean {
        return this.params.request.quantity > 0
    }
}
```

Báo `method` tại `isValid`. Quy tắc "số lượng phải dương" vừa được dời vào một tệp không ai đọc để
tìm quy tắc.

**ĐÚNG** — cùng tệp

```ts
export class AddToCartCommand {
    constructor(readonly params: ExecuteParams<AddToCartRequest>) {}
}
```

Phép kiểm số lượng thuộc về lớp xử lý, nơi nó có thể ném ra một ngoại lệ có tên.

### Cặp 2 — thông điệp nhiều trường

**SAI** — `archive-order/archive-order.command.ts`

```ts
export class ArchiveOrderCommand {
    constructor(
        readonly request: ArchiveOrderRequest,
        readonly user: UserLike,
    ) {}
}
```

Báo `shape` tại tên lớp: hai tham số, nên mỗi chỗ phát thông điệp tự lắp lấy một kiểu.

**ĐÚNG** — cùng tệp

```ts
export class ArchiveOrderCommand {
    constructor(readonly params: ExecuteParams<ArchiveOrderRequest>) {}
}
```

### Cặp 3 — phương thức tĩnh cũng là phương thức

**SAI** — `list-invoices/list-invoices.query.ts`

```ts
export class ListInvoicesQuery {
    constructor(readonly params: ExecuteParams<ListInvoicesRequest>) {}

    static forOwner(user: UserLike): ListInvoicesQuery {
        return new ListInvoicesQuery({ request: {}, user } as ExecuteParams<ListInvoicesRequest>)
    }
}
```

Báo `method` tại `forOwner`. `static` không được hỏi tới, và một hàm dựng phụ như thế đúng là chỗ
hai người phát cùng một truy vấn bắt đầu hiểu nó khác nhau.

**ĐÚNG** — cùng tệp

```ts
export class ListInvoicesQuery {
    constructor(readonly params: ExecuteParams<ListInvoicesRequest>) {}
}
```

### Cặp 4 — phá cấu trúc tham số không đi qua được

**SAI** — `suggest-products/suggest-products.query.ts`

```ts
export class SuggestProductsQuery {
    constructor({ request, user }: ExecuteParams<SuggestProductsRequest>) {
        this.request = request
        this.user = user
    }

    readonly request: SuggestProductsRequest
    readonly user: UserLike
}
```

Báo hai lần thì không, nhưng báo `shape` thì có: một `ObjectPattern` không có `.name`, nên phép kiểm
tên tham số trượt và quy tắc nổ. Đây là **cửa đóng** — một chỗ người ta hay tưởng lách được.

**ĐÚNG** — cùng tệp

```ts
export class SuggestProductsQuery {
    constructor(readonly params: ExecuteParams<SuggestProductsRequest>) {}
}
```

### Cửa lách và nhầm lẫn

Năm khối dưới đây **vi phạm `CQRS-2`** và **quy tắc im lặng**.

**Lách 1 — thông điệp không có hàm dựng.**

```ts
// archive-order/archive-order.command.ts
export class ArchiveOrderCommand {
    readonly request!: ArchiveOrderRequest
    readonly user!: UserLike
}
```

Phép kiểm hình dạng thoát sớm khi không tìm thấy hàm dựng, và các trường là `PropertyDefinition` mà
quy tắc không hề đọc. Đây đúng là vi phạm mà luật mô tả — nhiều trường thay vì một `params` — viết ở
dạng cái máy không nhìn thấy.

**Lách 2 — logic nằm trong thân hàm dựng.**

```ts
// add-to-cart/add-to-cart.command.ts
export class AddToCartCommand {
    constructor(readonly params: ExecuteParams<AddToCartRequest>) {
        this.params = {
            ...params,
            request: { ...params.request, quantity: params.request.quantity ?? 1 },
        }
    }
}
```

Danh sách tham số hợp lệ tuyệt đối. Thân hàm dựng không bao giờ được thăm — nên "số lượng mặc định là
1" nay là một quyết định nằm trong thông điệp, và hai chỗ phát sẽ không biết về nó.

**Lách 3 — logic viết thành trường.**

```ts
// list-invoices/list-invoices.query.ts
export class ListInvoicesQuery {
    constructor(readonly params: ExecuteParams<ListInvoicesRequest>) {}

    readonly isOverdueOnly = () => this.params.request.status === "overdue"
}
```

Cùng một lỗ kiểu nút như lách 1: trường không phải phương thức.

**Lách 4 — một decorator bất kỳ là tắt cả lớp.**

```ts
// add-to-cart/add-to-cart.command.ts
@Traced()
export class AddToCartCommand {
    constructor(
        readonly request: AddToCartRequest,
        readonly user: UserLike,
    ) {}

    isValid(): boolean {
        return this.params !== undefined
    }
}
```

Hai vi phạm cùng lúc — sai hình dạng và có phương thức — và **không báo nào cả**, vì miễn trừ
decorator là miễn trừ cho toàn bộ lớp. Miễn trừ này được mua để một họ tệp cùng đuôi nhưng khác bản
chất không nổ oan; đây là cái giá của nó.

**Lách 5 — đổi tên tệp là quy tắc biến mất.**

```ts
// addToCart.command.ts  <- chữ hoa trong tên tệp
export class AddToCartCommand {
    constructor(
        readonly request: AddToCartRequest,
        readonly user: UserLike,
    ) {}

    isValid(): boolean {
        return true
    }
}
```

Cổng đòi `[a-z0-9-]+` ngay trước `.command.ts`. Một chữ hoa, một dấu gạch dưới, một tệp gom tên
`commands.ts` — quy tắc không tồn tại nữa. Không ai đổi tên tệp để né lint; người ta đổi tên tệp vì
thấy nó gọn hơn.

---

## `handler-has-twin-spec`

Quy tắc so tên thao tác của tệp đang lint với một **danh sách tên tệp do cấu hình truyền vào**. Nó
không đọc đĩa.

### Cặp 1 — danh sách không chứa cặp song sinh

**SAI** — lint `add-to-cart/add-to-cart.handler.ts` với cấu hình:

```js
// eslint.config.mjs
{
    rules: {
        "starci-be/handler-has-twin-spec": ["error", { specs: ["archive-order.handler.spec.ts"] }],
    },
}
```

```ts
// add-to-cart/add-to-cart.handler.ts
@CommandHandler(AddToCartCommand)
export class AddToCartHandler extends ICQRSHandler<AddToCartCommand, CartItemEntity> {
    protected override async process(command: AddToCartCommand): Promise<CartItemEntity> {
        return this.entityManager.save(this.build(command.params))
    }
}
```

Báo `missing` trên nút `Program`, gọi đúng tên tệp còn thiếu: `add-to-cart.handler.spec.ts`.

**ĐÚNG** — cùng tệp, danh sách có tên đó:

```js
{
    rules: {
        "starci-be/handler-has-twin-spec": ["error", { specs: ["add-to-cart.handler.spec.ts"] }],
    },
}
```

### Cặp 2 — danh sách rỗng không phải là cách tắt

**SAI** — `add-to-cart/add-to-cart.handler.ts`

```js
{
    rules: {
        "starci-be/handler-has-twin-spec": ["error", { specs: [] }],
    },
}
```

Mảng rỗng vẫn là mảng, nên quy tắc chạy và báo. Chỉ **thiếu hẳn tuỳ chọn** mới làm nó im. Đây là
**cửa đóng**.

**ĐÚNG** — tệp không phải lớp xử lý thì cổng tên tệp không mở, dù danh sách rỗng:

```js
// lint add-to-cart/add-to-cart.service.ts với { specs: [] } - không báo gì
```

### Cặp 3 — tệp rỗng vẫn bị báo

**SAI** — `archive-order/archive-order.handler.ts` chỉ có một dòng chú thích:

```ts
// TODO: viết lớp xử lý ở đây
```

Báo cáo gắn vào `Program:exit`, nên nó nổ kể cả khi trong tệp không có code nào. Cũng là **cửa
đóng**: không thể né bằng cách để tệp trống.

### Cửa lách và nhầm lẫn

Bốn tình huống dưới đây **vi phạm `CQRS-7`** và **quy tắc không nói gì**.

**Lách 1 — không truyền tuỳ chọn thì quy tắc trơ, và mặc định là tắt.**

```js
// eslint.config.mjs
{
    rules: {
        "starci-be/handler-has-twin-spec": "error", // bật, nhưng không có `specs`
    },
}
```

Không có danh sách thì quy tắc trả về một bộ duyệt rỗng và không làm gì. Mặc định trong bộ khuyến
nghị còn thẳng thắn hơn: `"off"`.

**Lách 2 — có tệp không có nghĩa là có kiểm thử.**

```ts
// add-to-cart/add-to-cart.handler.spec.ts
describe.skip("AddToCartHandler", () => {
    it("lưu được món hàng vào giỏ", () => {
        expect(true).toBe(true)
    })
})
```

Tên tệp có trong danh sách, nên quy tắc im. "Có cặp song sinh" và "có được kiểm thử" là hai mệnh đề
khác nhau, và chỉ mệnh đề đầu được giữ.

**Lách 3 — trùng tên ngắn ở hai thư mục.**

```txt
billing/archive-order/archive-order.handler.ts        <- không có cặp song sinh
support/archive-order/archive-order.handler.ts
support/archive-order/archive-order.handler.spec.ts   <- một tệp này làm cả hai cùng qua
```

Danh sách được so như tên trần, không kèm thư mục.

**Lách 4 — vẫn là cổng tên tệp.**

```txt
add-to-cart/add-to-cart.handler.mts     <- ngoài cổng
add-to-cart/index.ts                    <- lớp xử lý khai trong tệp gom, ngoài cổng
```

---

## Ánh xạ yêu cầu sang một quy tắc

Nêu tệp, hình dạng lớp và cấu hình. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu rồi dừng.

| Yêu cầu bằng lời | Lập luận | Quy tắc | Kết quả |
|---|---|---|---|
| "Lớp xử lý này ghi đè `execute`, có sao không?" | Có decorator xử lý ⇒ cổng mở, tên khoá là `execute` | `handler-overrides-process` | Báo `overridesExecute`; đổi thành `protected override async process` |
| "Lớp điều phối của tôi có phương thức `execute`" | Không có decorator xử lý ⇒ cổng không mở | `handler-overrides-process` | Im lặng, và đó là ý đồ |
| "Lớp xử lý kế thừa lớp trừu tượng trung gian, không có `process`" | Có lớp cha ⇒ nửa quy tắc thiếu `process` không chạy | `handler-overrides-process` | Im lặng; phải đọc bằng mắt xem lớp cha có `process` không |
| "Thông điệp của tôi có một hàm kiểm tra hợp lệ" | Tệp `.command.ts`, lớp không decorator, có `MethodDefinition` | `message-carries-params-only` | Báo `method`; dời phép kiểm sang lớp xử lý |
| "Thông điệp nhận `request` và `user` riêng" | Hàm dựng hai tham số | `message-carries-params-only` | Báo `shape`; gộp về một `params` |
| "Thông điệp khai các trường, không có hàm dựng" | Không có hàm dựng ⇒ thoát sớm | `message-carries-params-only` | Im lặng, **nhưng vẫn sai luật** |
| "Lớp xử lý này chưa có kiểm thử" | Cổng tên tệp mở, cấu hình có truyền `specs` | `handler-has-twin-spec` | Báo `missing` kèm tên tệp còn thiếu |
| "Bật quy tắc cặp song sinh lên mà không thấy nó báo gì" | Không truyền `specs` ⇒ bộ duyệt rỗng | `handler-has-twin-spec` | Im lặng; phải nối danh sách thư mục từ cổng bên ngoài |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| Lớp xử lý / lớp thường | Lớp có mang decorator tên `CommandHandler`, `QueryHandler` hay `EventsHandler` **viết đúng như vậy tại chỗ** không? |
| `overridesExecute` / `noProcess` | Có `MethodDefinition` tên `execute` không? Có thì chỉ báo cái đó; phép kiểm `process` không chạy nữa |
| `noProcess` chạy / không chạy | Lớp có `superClass` không? Có thì không chạy |
| Thông điệp / cánh cửa cùng đuôi tệp | Lớp có mang **bất kỳ** decorator nào không? Có thì quy tắc bỏ qua cả lớp |
| Quy tắc tồn tại / không tồn tại cho tệp này | Tên tệp có khớp `[a-z0-9-]+` rồi tới `.command.ts`, `.query.ts` hoặc `.handler.ts` không? |
| Cặp song sinh im / báo | Cấu hình có truyền `specs` là **một mảng** không? Thiếu hẳn thì im; rỗng thì báo |

## Sai lầm lặp lại nhiều nhất

1. Tin rằng quy tắc bắt được `execute` viết thành trường của lớp. Không.
2. Tin rằng lớp xử lý kế thừa lớp cơ sở vẫn bị hỏi về `process`. Không — có lớp cha là thoát.
3. Tin rằng thông điệp không có hàm dựng thì "không có gì để kiểm". Nó là hình dạng sai mà im lặng.
4. Viết logic vào thân hàm dựng của thông điệp và coi lint xanh là bằng chứng nó hợp lệ.
5. Thêm một decorator vào thông điệp vì lý do khác, rồi mất luôn cả quy tắc mà không biết.
6. Đổi tên tệp cho gọn và làm cổng tên tệp không khớp nữa.
7. Đổi tên decorator lúc `import` và làm cả quy tắc lớp xử lý tắt cho tệp đó.
8. Coi `handler-has-twin-spec` là bằng chứng đã có kiểm thử. Nó chỉ là bằng chứng có một cái tên
   trong một danh sách.
9. Truyền `specs: []` để tắt quy tắc — mảng rỗng làm nó **báo**, không làm nó im.
10. Đếm số vi phạm bằng tổng số lỗi lint thay vì đếm riêng báo cáo của chính quy tắc đó.
