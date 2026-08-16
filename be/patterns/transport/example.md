---
id: be-patterns-transport-example
title: example.md
slug: /be/patterns/transport/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã TRANSPORT-N, viết bằng TypeScript thường.
---

# example.md

> Version: `2.00` · Module: `transport` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường trong một ứng dụng hình dáng Nest**. Không tên sản phẩm,
không tên công ty, không tên repository. Một luật chỉ đúng khi nó đúng ở bất kỳ backend nào — nên nếu
một ví dụ cần tên riêng của một hệ thống cụ thể mới đọc được thì ví dụ đó đứng sai chỗ.

Mỗi mã có **nhiều case**, mỗi case đặt ĐÚNG cạnh SAI, rồi tới mục **ngoại lệ và nhầm lẫn**. Phần cuối
trang ánh xạ từ yêu cầu bằng lời sang một cửa duy nhất.

---

## `TRANSPORT-1` — cửa mặc định là GraphQL

### Case: đọc một bản ghi

SAI — thao tác này nhận field và trả field, nên nó không có lý do gì để là một giao thức thứ hai:

```ts
@Controller("orders")
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    @Get(":orderId")
    async getOrder(@Param("orderId") orderId: string): Promise<OrderResponse> {
        return this.orderService.findOne(orderId)
    }
}
```

ĐÚNG:

```ts
@Resolver()
export class OrderResolver {
    constructor(private readonly orderService: OrderService) {}

    @Query(() => OrderResponse, { name: "order" })
    async order(@Args("request") request: OrderRequest): Promise<OrderResponse> {
        return this.orderService.findOne(request)
    }
}
```

Client gọi cửa dưới đã cầm sẵn schema, đã có type sinh ra cho `OrderResponse`, và đã có đúng một
endpoint để trỏ tới. Cửa trên bắt nó học thêm một base URL, một cách bắt lỗi, và một hình dáng phản
hồi mà không type sinh ra nào phủ.

### Case: một lệnh ghi

SAI:

```ts
@Controller("subscriptions")
export class CancelSubscriptionController {
    @Post(":subscriptionId/cancel")
    @HttpCode(200)
    async cancel(
        @Param("subscriptionId") subscriptionId: string,
        @Body() body: CancelSubscriptionRequest,
    ): Promise<CancelSubscriptionResponse> {
        return this.cancelSubscriptionService.cancel(subscriptionId, body)
    }
}
```

ĐÚNG:

```ts
@Resolver()
export class CancelSubscriptionResolver {
    @Mutation(() => CancelSubscriptionResponse, { name: "cancelSubscription" })
    async cancelSubscription(
        @Args("request") request: CancelSubscriptionRequest,
    ): Promise<CancelSubscriptionResponse> {
        return this.cancelSubscriptionService.cancel(request)
    }
}
```

Chú ý chỗ tốn kém thật sự ở bản SAI: định danh nằm trong đường dẫn, phần còn lại nằm trong body, nên
**một** yêu cầu bị xé làm hai nguồn tham số. Bản ĐÚNG có đúng một `request`, và đó cũng là hình dáng
mà tầng dưới nhận.

### Case: danh sách có lọc và phân trang

SAI — mỗi tham số mới là một query string mới phải tự tay parse và tự tay validate:

```ts
@Controller("invoices")
export class InvoiceListController {
    @Get()
    async list(
        @Query("status") status?: string,
        @Query("from") from?: string,
        @Query("limit") limit?: string,
    ): Promise<Array<InvoiceResponse>> {
        return this.invoiceService.list({
            status,
            from,
            limit: limit ? Number(limit) : 20,
        })
    }
}
```

ĐÚNG:

```ts
@Resolver()
export class InvoicesResolver {
    @Query(() => InvoicesResponse, { name: "invoices" })
    async invoices(@Args("request") request: InvoicesRequest): Promise<InvoicesResponse> {
        return this.invoiceService.list(request)
    }
}
```

`limit` ở bản SAI là `string` cho tới lúc có người nhớ ép kiểu. Ở bản ĐÚNG nó là `number` vì schema
đã nói vậy, và một giá trị không phải số không bao giờ tới được service.

### Case: lý do bị viện ra nhiều nhất, và vì sao nó không tính

```ts
// SAI -- "bên tích hợp quen REST hơn"
@Controller("partners/reports")
export class PartnerReportController {
    @Get("monthly")
    async monthly(@Query("month") month: string): Promise<MonthlyReportResponse> {
        return this.reportService.monthly(month)
    }
}
```

"Bên tích hợp quen REST hơn" chỉ là lý do khi bên tích hợp **không phải** client sản phẩm. Nếu nó là
client sản phẩm thì nó đã cầm schema rồi, và câu này thật ra là "viết route nhanh tay hơn". Nếu nó
thật sự là một bên thứ ba đi vào bằng một danh tính không phải phiên người dùng, thì cửa này thuộc ca
**operator** của `TRANSPORT-2` — và lúc đó file phải **nói ra** điều đó, chứ không phải để người đọc
đoán.

### Ngoại lệ và nhầm lẫn

- **Trả về byte thì ngay từ đầu đã không phải thao tác field**, nên nó không thuộc mã này:

  ```ts
  // ĐÚNG -- đây là TRANSPORT-2 ca "bytes", không phải một ngoại lệ của TRANSPORT-1
  @Controller("invoices")
  export class InvoiceDownloadController {
      @Get(":invoiceId/pdf")
      async download(@Param("invoiceId") invoiceId: string): Promise<StreamableFile> {
          return new StreamableFile(await this.invoiceService.renderPdf(invoiceId))
      }
  }
  ```

- **Đừng bọc một webhook vào mutation cho "đủ chuẩn GraphQL":**

  ```ts
  // SAI -- cổng thanh toán không gửi GraphQL document, và ta không có quyền bắt nó gửi
  @Resolver()
  export class PaymentWebhookResolver {
      @Mutation(() => Boolean, { name: "paymentWebhook" })
      async paymentWebhook(@Args("payload") payload: string): Promise<boolean> {
          return this.paymentService.handle(JSON.parse(payload))
      }
  }
  ```

  `payload: string` rồi `JSON.parse` là dấu hiệu cho thấy schema đang bị dùng làm ống dẫn chứ không
  phải làm hợp đồng. Cửa này thuộc `TRANSPORT-2`.

- **Một cửa nội bộ vẫn là một cửa.** "Chỉ đội mình gọi" không nằm trong bốn ca.

---

## `TRANSPORT-2` — cửa REST chỉ ở chỗ GraphQL không tới được

### Case: hệ thống ngoài post vào một URL ta phát ra

ĐÚNG — lý do nằm ngay ở route và ở tên file (`payment/webhook/webhook.controller.ts`):

```ts
@Controller("payment/webhook")
export class PaymentWebhookController {
    constructor(private readonly paymentWebhookService: PaymentWebhookService) {}

    @Post()
    @HttpCode(200)
    async receive(
        @Body() body: PaymentWebhookRequest,
        @Headers("x-signature") signature: string,
    ): Promise<void> {
        await this.paymentWebhookService.receive(body, signature)
    }
}
```

SAI — cùng một việc, nhưng không còn ai đọc ra được nó là webhook:

```ts
@Controller("payment")
export class PaymentNotifyController {
    @Post("notify")
    @HttpCode(200)
    async notify(@Body() body: PaymentNotifyRequest): Promise<void> {
        await this.paymentService.applyGatewayUpdate(body)
    }
}
```

Đây là ca nguy hiểm nhất của cả module: **cửa hoàn toàn chính đáng, mà lý do thì vô hình**. Người đọc
sau thấy `POST payment/notify` và không có cách nào biết đây là URL đã phát cho một cổng thanh toán
hay là một route ai đó viết cho tiện. Sửa không phải bằng cách thêm comment, mà bằng cách để chính
địa chỉ nói ra:

```ts
// ĐÚNG -- đổi tên là đủ; bằng chứng quay lại nằm trong file
@Controller("payment/webhook")
export class PaymentWebhookController {
    @Post()
    @HttpCode(200)
    async receive(@Body() body: PaymentWebhookRequest): Promise<void> {
        await this.paymentService.applyGatewayUpdate(body)
    }
}
```

### Case: byte đi vào

SAI — nhét file vào một field:

```ts
@Resolver()
export class UploadAvatarResolver {
    @Mutation(() => UploadAvatarResponse, { name: "uploadAvatar" })
    async uploadAvatar(@Args("base64") base64: string): Promise<UploadAvatarResponse> {
        return this.mediaService.store(Buffer.from(base64, "base64"))
    }
}
```

ĐÚNG:

```ts
@Controller("media")
export class UploadAvatarController {
    @Post("avatar")
    @UseInterceptors(FileInterceptor("file"))
    async upload(@UploadedFile() file: Express.Multer.File): Promise<UploadAvatarResponse> {
        return this.mediaService.store(file.buffer, file.mimetype)
    }
}
```

Bản SAI phình dữ liệu thêm một phần ba, giữ trọn file trong bộ nhớ ở cả hai đầu, và đưa một tệp bốn
mươi megabyte đi qua một tầng parse vốn được chỉnh cho document. `FileInterceptor` trong bản ĐÚNG vừa
là cơ chế, vừa là **bằng chứng** cho lý do — nó là thứ người đọc và rule cùng nhìn.

### Case: byte đi ra

ĐÚNG — stream có sẵn hình dáng riêng:

```ts
@Controller("reports")
export class ReportExportController {
    @Get(":reportId/export")
    async export(@Param("reportId") reportId: string): Promise<StreamableFile> {
        return new StreamableFile(await this.reportService.openExportStream(reportId))
    }
}
```

ĐÚNG — khi phải tự cầm response để đặt header hoặc phục vụ theo range:

```ts
@Controller("media/files")
export class MediaFileController {
    @Get("*path")
    async serve(@Param("path") path: string, @Res() response: Response): Promise<void> {
        const resolved = await this.mediaService.resolve(path)
        response.setHeader("content-type", resolved.mimeType)
        createReadStream(resolved.absolutePath).pipe(response)
    }
}
```

`@Res(` là một cam kết chứ không phải một tiện ích: cầm lấy response là tự nhận luôn phần việc mà
tầng tuần tự hoá vẫn làm hộ. Đó cũng là lý do nó đủ tư cách làm bằng chứng — không ai viết nó ra một
cách vô tình.

### Case: một cỗ máy tự đăng ký

ĐÚNG:

```ts
@Controller("pods/registration")
export class PodRegistrationController {
    @Post()
    async register(@Body() body: PodRegistrationRequest): Promise<PodRegistrationResponse> {
        return this.podRegistryService.register(body)
    }
}
```

SAI — cùng một việc, nhưng địa chỉ đọc như một route sản phẩm:

```ts
@Controller("compute-nodes")
export class ComputeNodeController {
    @Post("register")
    async register(@Body() body: ComputeNodeRegistrationRequest): Promise<void> {
        await this.nodeRegistryService.register(body)
    }
}
```

Điều khiến ca này thành một lối ra không phải là "nó nội bộ", mà là **không có phiên người dùng nào
để mang theo**. Một pod gọi về lúc boot chưa có ai đăng nhập cả. Tiền tố `pods/`, `internal/`,
`agents/` là cách sự thật ấy hiện ra trong địa chỉ.

### Case: một danh tính không phải phiên người dùng

ĐÚNG:

```ts
@Controller("api/ops/tenants")
@UseGuards(OperatorTokenGuard)
export class OpsTenantController {
    @Post(":tenantId/suspend")
    async suspend(@Param("tenantId") tenantId: string): Promise<void> {
        await this.tenantOpsService.suspend(tenantId)
    }
}
```

SAI:

```ts
@Resolver()
export class SuspendTenantResolver {
    @Mutation(() => Boolean, { name: "suspendTenant" })
    @UseGuards(ViewerGuard, RoleGuard)
    async suspendTenant(@Args("tenantId") tenantId: string): Promise<boolean> {
        return this.tenantOpsService.suspend(tenantId)
    }
}
```

Bản SAI không sai vì nó là GraphQL — mà vì nó treo một chủ thể **khác hạng** lên cùng bộ guard với
người dùng sản phẩm. Từ giây phút đó, "operator nền tảng" chỉ còn là một vai trong cùng một bảng
phân quyền, và một quản trị viên của một tenant chỉ cách quyền vận hành cả nền tảng đúng một dòng cấu
hình sai. Tách chủ thể ra một cửa riêng với guard riêng là để **không tồn tại** con đường ấy.

### Case: liveness probe — lối ra thứ năm

```ts
@Controller("healthz")
export class HealthProbeController {
    @Get()
    check(): { status: string } {
        return { status: "ok" }
    }
}
```

Probe không nằm trong bốn ca vì nó không phục vụ ai ngoài hạ tầng. Nó phải trả lời **khi ứng dụng
đang hỏng**, có thể trước lúc tầng feature kịp lên — nên nó cũng không được phép phụ thuộc vào bất cứ
thứ gì mà nó có nhiệm vụ báo cáo tình trạng.

### Ngoại lệ và nhầm lẫn

- **`@Controller` dạng object che mất route.** Đây là nhầm lẫn tốn kém nhất trong thực tế:

  ```ts
  // SAI -- lý do biến mất khỏi tầm nhìn
  @Controller({ path: httpConfig().payment().webhook, version: "1" })
  export class PaymentWebhookController { }
  ```

  Route lúc này là một lời gọi hàm, không phải một chuỗi. Người đọc phải mở file cấu hình mới biết
  cửa này đi đâu, và bất cứ thứ gì đọc theo route đều không thấy gì cả. Nếu buộc phải dùng dạng
  object vì cần `version`, thì lý do phải quay về qua **tên file hoặc tên thư mục**:

  ```ts
  // ĐÚNG -- file nằm ở payment/webhook/webhook.controller.ts, nên bằng chứng vẫn đọc được
  @Controller({ path: httpConfig().payment().webhook, version: "1" })
  export class PaymentWebhookController { }
  ```

  Hai đoạn giống hệt nhau, và đó chính là điểm: cái phân định chúng nằm ở **địa chỉ trên đĩa**, không
  nằm trong nội dung. Một cửa dùng route động mà lại đặt ở thư mục không nói gì thì đã tự xoá bằng
  chứng của mình.

- **Sổ đăng ký không phải là lý do:**

  ```ts
  // SAI -- một danh sách "đã duyệt" mục ngay lần đầu có người thêm route rồi quên
  export const ALLOWED_REST_ROUTES = [
      "payment/notify",
      "partners/reports/monthly",
      "admin/exports",
  ]
  ```

  Sổ đăng ký còn tạo ra một trạng thái tệ hơn cả không có gì: một route sai nằm trong sổ **trông y
  hệt** một route đúng, và người đọc mất luôn khả năng tự phân định.

- **Đừng mượn bằng chứng.** Thêm một tham số `@Res()` không dùng tới để cửa "trông như" ca byte là
  nói dối bằng cú pháp:

  ```ts
  // SAI -- @Res có mặt nhưng không ai stream gì cả
  @Controller("orders")
  export class OrderController {
      @Get(":orderId")
      async getOrder(@Param("orderId") id: string, @Res() response: Response): Promise<void> {
          response.json(await this.orderService.findOne(id))
      }
  }
  ```

- **Bốn ca là danh sách đóng.** "Gấp", "tạm thời", "chỉ nội bộ", "sẽ refactor" không phải ca thứ năm.

---

## `TRANSPORT-3` — cửa nào cũng nằm dưới `features/`

### Case: một controller đặt nhầm trong cây năng lực

SAI:

```text
src/modules/payment/
    payment.module.ts
    payment.service.ts
    webhook.controller.ts        <- cửa nằm lẫn giữa các năng lực nó gọi
```

ĐÚNG:

```text
src/modules/payment/
    payment.module.ts
    payment.service.ts           <- năng lực ở lại đây

src/features/api/http/payment/webhook/
    webhook.controller.ts        <- cửa nằm cạnh mọi cửa khác
    webhook.service.ts
    webhook.module.ts
```

### Case: cửa gọi năng lực, không nuốt năng lực

```ts
// ĐÚNG -- features/api/http/payment/webhook/webhook.controller.ts
@Controller("payment/webhook")
export class PaymentWebhookController {
    constructor(private readonly paymentWebhookService: PaymentWebhookService) {}

    @Post()
    @HttpCode(200)
    async receive(@Body() body: PaymentWebhookRequest): Promise<void> {
        await this.paymentWebhookService.receive(body)
    }
}
```

Chuyện gì xảy ra khi cửa nằm trong `modules/`: nó **đọc như một năng lực**, và rồi bị import như một
năng lực.

```ts
// SAI -- một module chẳng liên quan gì tới HTTP kéo cả cửa vào để dùng ké
@Module({
    imports: [PaymentWebhookModule],
    providers: [BillingReconcileService],
})
export class BillingModule {}
```

Từ giây phút này, xoá cái route ấy làm vỡ phần đối soát hoá đơn. Cái giá không nằm ở chỗ file đặt sai
thư mục, mà ở chỗ **một phụ thuộc sai đã trở nên viết được**.

### Case: gateway và consumer cũng là cửa

ĐÚNG:

```ts
// features/socket/notification/notification.gateway.ts
@WebSocketGateway({ namespace: "notification" })
export class NotificationGateway {
    @SubscribeMessage("subscribe")
    async subscribe(@MessageBody() body: SubscribeRequest): Promise<void> {
        await this.notificationService.subscribe(body)
    }
}
```

SAI:

```ts
// src/modules/notification/notification.gateway.ts
@WebSocketGateway({ namespace: "notification" })
export class NotificationGateway {
    @SubscribeMessage("subscribe")
    async subscribe(@MessageBody() body: SubscribeRequest): Promise<void> {
        await this.notificationService.subscribe(body)
    }
}
```

Hai file giống hệt nhau về nội dung; chỉ khác địa chỉ. Đó đúng là điều luật này nói: **giao thức chưa
bao giờ quyết định địa chỉ, việc là một cửa mới quyết định.** Một socket gateway nhận sự kiện từ bên
ngoài thì cũng là cửa y như một resolver.

### Ngoại lệ và nhầm lẫn

- **Ứng dụng riêng dưới `apps/*` tự lắp cửa của nó:**

  ```text
  apps/ops-console/src/
      app.module.ts
      health/health.controller.ts     <- không thuộc phạm vi chia đôi này
  ```

  Luật ràng `src/modules/**` và chỉ chừng đó. Một app riêng không đứng giữa hai tầng cửa trong cùng
  một cây — nó chỉ có một.

- **Một cửa hợp lệ theo `TRANSPORT-2` vẫn có thể sai `TRANSPORT-3`.** Hai mã kiểm hai chuyện khác
  nhau: một bên hỏi *có được phép là REST không*, một bên hỏi *file này nằm ở đâu*.
- **Service, repository, adapter, client bên thứ ba vẫn ở `modules/`.** Luật này chỉ kéo **cửa**.

---

## Ánh xạ yêu cầu sang một cửa

Nêu người gọi, payload và danh tính. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể rồi
dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Cho client đọc chi tiết một đơn hàng | Field vào, field ra, phiên người dùng | `TRANSPORT-1` | `@Query` trong `features/api/graphql/queries/…` |
| Cho client huỷ gói thuê bao | Field vào, field ra | `TRANSPORT-1` | `@Mutation` trong `features/api/graphql/mutations/…` |
| Nhận cập nhật trạng thái từ cổng thanh toán | Bên ngoài post vào URL ta phát ra | `TRANSPORT-2` ca external | `@Controller("payment/webhook")` trong `features/…/payment/webhook/` |
| Cho người dùng đổi ảnh đại diện | Multipart, byte chứ không phải field | `TRANSPORT-2` ca bytes | `@Controller` + `FileInterceptor` |
| Cho tải hoá đơn PDF | Stream đi ra | `TRANSPORT-2` ca bytes | `@Controller` trả `StreamableFile` |
| Pod gọi về lúc khởi động | Không có phiên người dùng để mang theo | `TRANSPORT-2` ca machine | `@Controller("pods/registration")` |
| Operator nền tảng khoá một tenant | Chủ thể khác hạng với người dùng sản phẩm | `TRANSPORT-2` ca operator | `@Controller("api/ops/…")` + guard riêng |
| Load balancer cần một điểm kiểm tra sống | Phải trả lời khi ứng dụng đang hỏng | ngoại lệ probe | `@Controller("healthz")` |
| Đội tích hợp muốn một route REST cho báo cáo tháng | Chưa nêu được ca nào; "quen REST hơn" không phải ca | `TRANSPORT-1` | Vào schema |
| Đặt controller webhook cạnh service thanh toán | Nó là cửa, không phải năng lực | `TRANSPORT-3` | Chuyển sang `features/` |

Ở hai dòng cuối, câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ họ cần một lối ra:
*"Bên gọi vào có mang một danh tính không phải phiên người dùng của sản phẩm không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `TRANSPORT-1` / `TRANSPORT-2` | Có chỉ ra được **một** trong bốn ca, và bằng chứng của nó có nằm trong file không? |
| `TRANSPORT-2` ca external / ca operator | Bên gọi tự chọn thời điểm gọi (webhook), hay ta gọi và nó chỉ mang danh tính khác (operator)? |
| `TRANSPORT-2` ca bytes / `TRANSPORT-1` | Payload là byte thật, hay là field được mã hoá thành chuỗi cho vừa một cửa? |
| `TRANSPORT-2` ca machine / ca operator | Không có phiên nào cả, hay có phiên nhưng thuộc chủ thể khác? |
| `TRANSPORT-2` / ngoại lệ probe | Cửa này có phải trả lời được **khi tầng feature đã chết** không? |
| `TRANSPORT-2` / `TRANSPORT-3` | Đang hỏi *được phép là REST không*, hay đang hỏi *file nằm ở đâu*? |
| `TRANSPORT-3` / năng lực | Có thứ gì ngoài tiến trình này chạm được vào file không? |

## Sai lầm lặp lại nhiều nhất

1. Viết một route REST vì nó nhanh tay hơn, rồi gọi cái nhanh tay ấy là một yêu cầu kỹ thuật.
2. Một webhook hoàn toàn chính đáng đặt tên là `notify`, `callback`, `hook` — mất sạch bằng chứng.
3. Dùng `@Controller({ path })` dạng object rồi đặt file ở thư mục không nói gì; lý do biến mất khỏi
   cả tầm nhìn của người đọc lẫn tầm nhìn của rule.
4. Treo một operator hoặc một service token lên cùng bộ guard với người dùng sản phẩm.
5. Nhét file vào field dưới dạng base64 để "cho vào được schema".
6. Lập một sổ đăng ký route đã duyệt và coi đó là lý do.
7. Đặt cửa trong `modules/`, rồi để một module khác import nó như một năng lực.
8. Nghĩ rằng qua `TRANSPORT-2` là xong; địa chỉ vẫn là một câu hỏi riêng.
