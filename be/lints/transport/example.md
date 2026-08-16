---
id: be-lints-transport-example
title: example.md
slug: /be/lints/transport/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho hai quy tắc cửa vào — chỗ nó bắn, chỗ nó im, và chỗ nó bị đi lọt.
---

# example.md

> Version: `2.00` · Mô-đun: `transport` · Cưỡng chế: [`INDEX.md`](./INDEX.md) · Diễn giải: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi quy tắc có nhiều cặp **SAI** (quy tắc bắn) và **ĐÚNG** (quy tắc im), rồi tới mục **Cửa lách và
nhầm lẫn**. Mã trong mục cửa lách **không phải mã được phép viết** — nó là mã mà quy tắc **không
thấy**. Đọc nhầm hai thứ đó là cách nhanh nhất để biến một tài liệu cưỡng chế thành một danh sách
mẹo lách.

Một dòng bình luận trong mã dưới đây ghi `quy tắc bắn` hoặc `quy tắc im`. Chỗ nào quy tắc im mà luật
vẫn bị vi phạm, dòng đó ghi rõ là **đi lọt**, không phải **được phép**.

---

## `rest-door-needs-a-reason`

### Trường hợp: một truy vấn JSON thuần được viết thành route

```ts
// src/features/theme/theme.controller.ts
// SAI — unjustified. Nhận trường, trả về trường, không byte, không hệ thống ngoài, không máy,
// không danh tính vận hành. Đây đúng là thứ lược đồ GraphQL đã có sẵn chỗ cho.
@Controller("api/theme")
export class ThemeController {
    @Get()
    public async list(): Promise<Array<ThemeDto>> {
        return this.themes.list()
    }
}
```

```ts
// src/features/theme/theme.resolver.ts
// ĐÚNG — không còn cửa REST nào để hỏi lý do. Client đã cầm sẵn lược đồ và kiểu sinh tự động.
@Resolver(() => Theme)
export class ThemeResolver {
    @Query(() => [Theme])
    public async themes(): Promise<Array<Theme>> {
        return this.themes.list()
    }
}
```

### Trường hợp: hệ thống ngoài gọi vào một URL cố định

```ts
// src/features/billing/callback.controller.ts
// SAI — unjustified. Đây LÀ một cửa cho hệ thống ngoài, nhưng cả route lẫn đường dẫn đều không
// nói ra điều đó, nên bằng chứng duy nhất quy tắc biết đọc thì không tồn tại.
@Controller("api/billing/callback")
export class BillingCallbackController {
    @Post()
    public async receive(@Body() payload: unknown): Promise<void> {
        await this.payments.settle(payload)
    }
}
```

```ts
// src/features/billing/billing-webhook.controller.ts
// ĐÚNG — lý do "hệ thống ngoài": route chứa `webhook`, và tên tệp cũng vậy. Bằng chứng nằm
// trong tệp, không nằm trong một tài liệu nào khác.
@Controller("api/billing/webhook")
export class BillingWebhookController {
    @Post()
    public async receive(@Body() payload: unknown): Promise<void> {
        await this.payments.settle(payload)
    }
}
```

### Trường hợp: byte chứ không phải trường

```ts
// src/features/media/media-export.controller.ts
// SAI — unjustified. Ý định là tải tệp về, nhưng tệp không chứa một định danh nào trong sáu
// định danh mà phép thử "byte" biết: nó chỉ trả về một chuỗi base64 trong JSON.
@Controller("api/media/export")
export class MediaExportController {
    @Get(":id")
    public async export(@Param("id") id: string): Promise<{ content: string }> {
        return { content: await this.media.encode(id) }
    }
}
```

```ts
// src/features/media/media-export.controller.ts
// ĐÚNG — lý do "byte". `StreamableFile` có mặt trong văn bản tệp, và lần này nó có mặt vì nó
// đang được dùng thật.
@Controller("api/media/export")
export class MediaExportController {
    @Get(":id")
    public async export(@Param("id") id: string): Promise<StreamableFile> {
        return new StreamableFile(await this.media.read(id))
    }
}
```

### Trường hợp: một máy tự đăng ký

```ts
// src/features/fleet/pods.controller.ts
// SAI — unjustified. Phép thử "máy" đòi route BẮT ĐẦU bằng `pods/`, `internal/` hoặc `agents/`,
// tức là phải có dấu gạch và một đoạn phía sau. Một tiền tố trần không khớp.
@Controller("pods")
export class PodsController {
    @Post()
    public async register(@Body() body: RegisterPodDto): Promise<void> {
        await this.fleet.register(body)
    }
}
```

```ts
// src/features/fleet/pods.controller.ts
// ĐÚNG — lý do "máy". Route bắt đầu bằng `pods/` và có đoạn phía sau.
@Controller("pods/registration")
export class PodsRegistrationController {
    @Post()
    public async register(@Body() body: RegisterPodDto): Promise<void> {
        await this.fleet.register(body)
    }
}
```

### Trường hợp: một danh tính không phải phiên người dùng

```ts
// src/features/operations/tenants.controller.ts
// SAI — unjustified. Phép thử "vận hành" neo vào `api/ops`; `ops/` trần không phải nó. Và tệp
// cũng không chứa định danh guard/token nào để cứu.
@Controller("ops/tenants")
export class OperatorTenantsController {
    @Get()
    public async list(): Promise<Array<TenantDto>> {
        return this.tenants.all()
    }
}
```

```ts
// src/features/operations/tenants.controller.ts
// ĐÚNG — hai bằng chứng độc lập, chỉ cần một: route bắt đầu bằng `api/ops`, và tệp dùng một
// guard tên khớp `Operator[A-Za-z]*Guard`.
@Controller("api/ops/tenants")
@UseGuards(OperatorSessionGuard)
export class OperatorTenantsController {
    @Get()
    public async list(): Promise<Array<TenantDto>> {
        return this.tenants.all()
    }
}
```

### Trường hợp: probe kiểm tra sống

```ts
// src/health.controller.ts
// ĐÚNG — lý do "probe", trúng hai đường: route đúng bằng `healthz`, và đường dẫn có đoạn
// `health.`. Đây là lối ra duy nhất mà thông điệp lỗi KHÔNG kể tên.
@Controller("healthz")
export class HealthController {
    @Get()
    public check(): { status: string } {
        return { status: "ok" }
    }
}
```

### Cửa lách và nhầm lẫn

Mọi mã trong mục này **đi lọt** hoặc **bị báo oan**. Không mã nào ở đây là mã nên viết.

```ts
// ĐI LỌT — quy tắc im, luật vẫn bị vi phạm.
// Phép thử "byte" chạy trên VĂN BẢN THÔ của tệp. Một dòng chú thích là văn bản.
// TODO: sau này đổi sang StreamableFile cho nhẹ
@Controller("api/theme")
export class ThemeController {
    @Get()
    public async list(): Promise<Array<ThemeDto>> {
        return this.themes.list()
    }
}
```

```ts
// ĐI LỌT — một import bỏ quên sau lần dọn dẹp cũng là văn bản.
import { FileInterceptor } from "@nestjs/platform-express"

@Controller("api/theme")
export class ThemeController {
    @Get()
    public async list(): Promise<Array<ThemeDto>> {
        return this.themes.list()
    }
}
```

```ts
// ĐI LỌT — phép thử "vận hành" cũng là văn bản thô. Một chuỗi trong bảng cấu hình đủ để mở cửa.
const REDACTED_KEYS = ["AUTHORIZATION", "OPS_TOKEN"]

@Controller("api/theme")
export class ThemeController {
    @Get()
    public async list(): Promise<Array<ThemeDto>> {
        return this.themes.list()
    }
}
```

```ts
// ĐI LỌT — bằng chứng tính theo TỆP, không theo cửa. Cửa thứ hai đi nhờ lý do của cửa thứ nhất
// và không bao giờ có một thông điệp nào cho riêng nó.
@Controller("api/media/export")
export class MediaExportController {
    @Get(":id")
    public async export(@Param("id") id: string): Promise<StreamableFile> {
        return new StreamableFile(await this.media.read(id))
    }
}

@Controller("api/media/settings")
export class MediaSettingsController {
    @Get()
    public async settings(): Promise<MediaSettingsDto> {
        return this.media.settings()
    }
}
```

```ts
// ĐI LỌT — đường dẫn TUYỆT ĐỐI cũng là bằng chứng. Tệp này nằm ở
// .../services/webhooks-gateway/src/features/theme/theme.controller.ts
// Đoạn `webhooks-gateway` khớp /webhook/i, nên MỌI controller dưới cây đó đều có lý do.
@Controller("api/theme")
export class ThemeController {}
```

```ts
// ĐI LỌT — tiền tố route là toàn bộ bằng chứng của lý do "máy". Không có gì kiểm rằng ở đây
// thật sự không có phiên người dùng nào được mang theo.
@Controller("internal/reports")
@UseGuards(UserSessionGuard)
export class InternalReportsController {
    @Get()
    public async list(@CurrentUser() user: UserContext): Promise<Array<ReportDto>> {
        return this.reports.forUser(user.id)
    }
}
```

```ts
// ĐI LỌT — phép thử "probe" so đúng chuỗi route và không bao giờ nhìn handler trả về gì.
@Controller("healthz")
export class BusinessDumpController {
    @Get()
    public async dump(): Promise<Array<TenantDto>> {
        return this.tenants.all()
    }
}
```

```ts
// ĐI LỌT — tên decorator đọc từ một Identifier. Cả ba dòng dưới đây làm CẢ HAI quy tắc im.
import { Controller as Route } from "@nestjs/common"

const Door = Controller

@Route("api/theme")
export class A {}

@Door("api/theme")
export class B {}

@Nest.Controller("api/theme")
export class C {}
```

```ts
// ĐI LỌT — không có decorator nào để thăm. Đây vẫn là một cửa REST đầy đủ.
export const bootstrap = async (app: INestApplication): Promise<void> => {
    app.getHttpAdapter().get("/api/theme", async (_request, response) => {
        response.json(await themes.list())
    })
}
```

```ts
// BÁO OAN — quy tắc bắn, luật KHÔNG bị vi phạm.
// `routeOf` chỉ nhận một `Literal` chuỗi. Template literal và hằng số đều thành "",
// nên ba lý do dựa trên route chết theo.
@Controller(`api/ops/tenants`)
export class OperatorTenantsController {}

@Controller(ROUTES.operatorTenants)
export class OperatorTenantsControllerTwo {}

@Controller({ path: "api/billing/webhook" })
export class BillingWebhookControllerTwo {}
```

```ts
// BÁO OAN — route ở cấp phương thức không bao giờ được đọc. Đây là một webhook thật.
@Controller()
export class BillingCallbackController {
    @Post("webhook/settlement")
    public async receive(@Body() payload: unknown): Promise<void> {
        await this.payments.settle(payload)
    }
}
```

```ts
// KHÔNG PHẢI CỬA LÁCH — quy tắc bắn, và bắn đúng.
// Không có làn kiểm thử nào trong mô-đun này. Một cửa dựng tạm trong spec bị báo như cửa thật.
describe("http pipeline", () => {
    @Controller("api/fixture")
    class FixtureController {}
})
```

---

## `door-lives-in-features`

### Trường hợp: một cửa đậu giữa những năng lực mà nó gọi

```ts
// src/modules/billing/billing.controller.ts
// SAI — wrongTree. Đường dẫn chứa `/src/modules/`, thế là đủ. Route, tên tệp, tên lớp đều
// không được hỏi tới.
@Controller("api/billing/webhook")
export class BillingWebhookController {
    @Post()
    public async receive(@Body() payload: unknown): Promise<void> {
        await this.payments.settle(payload)
    }
}
```

```ts
// src/features/billing/billing-webhook.controller.ts
// ĐÚNG — cùng một lớp, cùng một route, cùng một lý do. Chỉ có địa chỉ đổi, và địa chỉ là toàn
// bộ điều quy tắc này quan tâm.
@Controller("api/billing/webhook")
export class BillingWebhookController {
    @Post()
    public async receive(@Body() payload: unknown): Promise<void> {
        await this.payments.settle(payload)
    }
}
```

### Trường hợp: một lý do `TRANSPORT-2` hoàn hảo không miễn được `TRANSPORT-3`

```ts
// src/modules/media/media-export.controller.ts
// SAI — wrongTree, và `rest-door-needs-a-reason` thì im vì `StreamableFile` có mặt.
// Hai quy tắc độc lập nhau: một cửa có lý do chính đáng vẫn phải đứng đúng chỗ.
@Controller("api/media/export")
export class MediaExportController {
    @Get(":id")
    public async export(@Param("id") id: string): Promise<StreamableFile> {
        return new StreamableFile(await this.media.read(id))
    }
}
```

```ts
// src/modules/media/media.service.ts
// ĐÚNG — quy tắc im, và im đúng. Đây là một NĂNG LỰC, không phải một cửa. `src/modules/` là chỗ
// của nó; cổng chặn chỉ hỏi khi trong tệp có một `@Controller`.
@Injectable()
export class MediaService {
    public async read(id: string): Promise<Readable> {
        return createReadStream(this.pathFor(id))
    }
}
```

### Trường hợp: đào sâu thêm thư mục không thoát được cổng

```ts
// src/modules/billing/http/controllers/billing-webhook.controller.ts
// SAI — wrongTree. Cổng khớp CẶP `/src/modules/` ở bất kỳ đâu trên đường dẫn; thêm bao nhiêu
// tầng phía sau cũng không đổi kết quả.
@Controller("api/billing/webhook")
export class BillingWebhookController {}
```

### Cửa lách và nhầm lẫn

```ts
// ĐI LỌT — cấm một THƯ MỤC không phải cấm một TẦNG.
// src/services/billing/billing-webhook.controller.ts
// Đổi `modules` thành `services`, `domains` hay `capabilities`: tầng còn nguyên, cửa vẫn đậu sai
// chỗ, quy tắc biến mất hoàn toàn.
@Controller("api/billing/webhook")
export class BillingWebhookController {}
```

```ts
// ĐI LỌT — tên quy tắc nói "cửa", thứ nó kiểm là một decorator REST.
// src/modules/chat/chat.gateway.ts
// Một socket gateway là một cửa theo đúng định nghĩa của luật. Quy tắc không thấy nó.
@WebSocketGateway({ namespace: "chat" })
export class ChatGateway {
    @SubscribeMessage("message")
    public async onMessage(@MessageBody() body: string): Promise<void> {
        await this.chat.publish(body)
    }
}
```

```ts
// ĐI LỌT — cùng lý do. Một consumer hàng đợi và một resolver cũng là cửa, cũng vô hình.
// src/modules/billing/billing.consumer.ts
@Controller()
export class BillingConsumer {
    @EventPattern("payment.settled")
    public async onSettled(@Payload() event: PaymentSettledEvent): Promise<void> {
        await this.payments.finalize(event)
    }
}
```

Dòng cuối đáng đọc kỹ: lớp đó **có** `@Controller()`, nên nếu nó nằm dưới `src/modules/` thì
`door-lives-in-features` vẫn bắn. Nhưng nếu tác giả bỏ `@Controller()` đi và dùng một decorator
consumer thuần, cùng một cửa ấy trở nên vô hình. Cưỡng chế ở đây phụ thuộc vào một chi tiết cú pháp
mà tác giả có thể đổi mà không đổi kiến trúc.

```ts
// ĐI LỌT — cùng ba cách viết decorator đã làm quy tắc kia im, cũng làm quy tắc này im.
// src/modules/billing/billing.controller.ts
import { Controller as Route } from "@nestjs/common"

@Route("api/billing")
export class BillingController {}
```

```ts
// RỘNG HƠN LUẬT — quy tắc bắn ở chỗ luật đã miễn.
// apps/operations/src/modules/tenants/tenants.controller.ts
// Luật nói phần này chỉ ràng buộc `src/modules/**` của ứng dụng chính, và một ứng dụng riêng tự
// lắp cửa của nó thì không thuộc phạm vi. Cổng chặn không biết điều đó.
@Controller("api/ops/tenants")
export class OperatorTenantsController {}
```

---

## Ánh xạ yêu cầu sang một quy tắc

Nêu decorator, chuỗi route, đường dẫn tệp và thứ tệp đó chứa. Nếu thiếu **một** dữ kiện quyết định,
hỏi **một** câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Quy tắc | Kết quả |
|---|---|---|---|
| Thêm một route trả JSON cho một danh sách | Không lý do nào trong năm, cửa mặc định là lược đồ | `rest-door-needs-a-reason` | `unjustified` — viết thành query |
| Nhận thông báo thanh toán từ một hệ thống ngoài | Hệ thống ngoài gọi URL cố định | `rest-door-needs-a-reason` | im, **nếu** route hoặc đường dẫn chứa `webhook` |
| Cho tải một tệp đã tạo sẵn về máy | Byte, không phải trường | `rest-door-needs-a-reason` | im, **nếu** tệp thật sự dùng `StreamableFile`/`@Res (`/`createReadStream` |
| Cho một tiến trình tự đăng ký lúc khởi động | Máy, không mang phiên người dùng | `rest-door-needs-a-reason` | im, **nếu** route bắt đầu bằng `pods/`, `internal/`, `agents/` |
| Dựng màn quản trị nền tảng cho người vận hành | Danh tính không phải phiên người dùng | `rest-door-needs-a-reason` | im, **nếu** route bắt đầu `api/ops` hoặc tệp dùng guard/token vận hành |
| Trả về trạng thái sống cho bộ điều phối | Probe, ngoài bảng bốn trường hợp | `rest-door-needs-a-reason` | im, **nếu** route đúng bằng `health`/`healthz` hoặc đường dẫn có đoạn đó |
| Đặt controller cạnh service mà nó gọi cho tiện đọc | Cửa đậu giữa các năng lực | `door-lives-in-features` | `wrongTree` — chuyển sang tầng cửa |
| Chuyển một cửa hợp lệ sang tầng cửa nhưng giữ route cũ | Địa chỉ là thứ duy nhất quy tắc hỏi | `door-lives-in-features` | im |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `TRANSPORT-2` / `TRANSPORT-3` | Câu hỏi là *cửa này được phép không phải GraphQL không*, hay *cửa này đứng đúng chỗ chưa*? Hai câu, hai quy tắc, không thay thế nhau |
| Lý do có thật / lý do chỉ là văn bản | Định danh khớp phép thử đang **được dùng**, hay chỉ **được nhắc tới** trong chú thích, import thừa, chuỗi cấu hình? |
| Bằng chứng theo cửa / bằng chứng theo tệp | Tệp này có nhiều hơn một `@Controller` không? Nếu có, lý do của cái nào đang che cho cái nào? |
| Route thật / route quy tắc đọc được | `arguments[0]` có phải một `Literal` chuỗi không? Nếu không, quy tắc thấy `""` và ba lý do dựa trên route không tồn tại |
| Cửa REST / cửa nói giao thức khác | Nếu đây là gateway, consumer hay resolver: luật vẫn ràng buộc, quy tắc thì không. Quyết định bằng người |
| Ứng dụng chính / ứng dụng riêng | Đường dẫn có `/src/modules/` của một ứng dụng riêng không? Quy tắc bắn; luật đã miễn |

## Sai lầm lặp lại nhiều nhất

1. Đọc quy tắc im thành "cửa này hợp lệ", trong khi lý do duy nhất là một chú thích còn sót.
2. Để lại một import không dùng và vô tình cấp lý do vĩnh viễn cho cả tệp.
3. Nhét cửa thứ hai vào tệp đã có một cửa được biện minh.
4. Lấy tiền tố route làm bằng chứng kiến trúc — `internal/` không làm một truy vấn người dùng thành
   một máy tự đăng ký.
5. Viết route bằng template literal hay hằng số rồi ngạc nhiên vì bị báo lỗi, và tắt cảnh báo thay
   vì trả route về một chuỗi literal.
6. Đặt route webhook ở cấp phương thức, để `@Controller()` rỗng, rồi coi báo lỗi là lỗi của quy tắc.
7. Nghĩ rằng có lý do `TRANSPORT-2` thì được miễn `TRANSPORT-3`.
8. Đổi tên thư mục `modules/` và tin rằng tầng đã được dọn.
9. Tin rằng `door-lives-in-features` giữ mọi cửa; nó giữ đúng những cửa mang `@Controller`.
