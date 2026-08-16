---
id: be-patterns-observability-example
title: example.md
slug: /be/patterns/observability/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã OBSERVABILITY-N, viết bằng TypeScript/NestJS thuần.
---

# example.md

> Version: `2.00` · Module: `observability` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường trong một ứng dụng có cấu trúc kiểu NestJS**. Không tên sản phẩm, không
tên repository, không tên module riêng của ai. Một luật back end chỉ đúng khi nó đúng ở bất kỳ dịch
vụ nào — nên nếu một ví dụ cần tên riêng của một hệ thống mới đọc được, ví dụ đó sai chỗ.

Hai tên được giữ nguyên vì lint rule **khớp trực tiếp với chúng**: receiver `winstonService` và enum
`WinstonLog`. Đó là tên của house service và tập tên sự kiện, không phải tên sản phẩm; đổi chúng
trong ví dụ thì ví dụ không còn kiểm được bằng rule nữa.

Mỗi mã có **nhiều case**, rồi tới **ngoại lệ và nhầm lẫn**. Phần cuối trang ánh xạ từ yêu cầu bằng
lời sang một quyết định duy nhất.

---

## `OBSERVABILITY-1` — log đi ra qua house service

### Case: một handler ghi lại kết quả nghiệp vụ

```ts
@Injectable()
export class CancelOrderHandler {
    constructor(private readonly winstonService: WinstonService) {}

    public async process(request: CancelOrderRequest): Promise<void> {
        await this.orders.cancel(request.orderId)
        this.winstonService.log(WinstonLog.OrderCancelled,
            {
                orderId: request.orderId,
                actorId: request.actorId,
                reason: request.reason,
            })
    }
}
```

```ts
// SAI: ghi ra đúng hình dạng, và vẫn đánh mất request đã sinh ra nó, vì correlation id nằm trong
// service mà dòng này đi vòng qua.
@Injectable()
export class CancelOrderHandler {
    private readonly logger = new Logger(CancelOrderHandler.name)
}
```

Hai đoạn khác nhau đúng một chuyện: dòng log có buộc lại được với request hay không.

### Case: cron dọn dữ liệu

```ts
@Injectable()
export class ExpireReservationsCron {
    constructor(private readonly winstonService: WinstonService) {}

    @Cron(CronExpression.EVERY_5_MINUTES)
    public async run(): Promise<void> {
        const expired = await this.reservations.expireDue()
        this.winstonService.log(WinstonLog.ReservationsExpired,
            {
                count: expired.length,
            })
    }
}
```

```ts
// SAI: không bao giờ tới được log pipeline. Trên máy dev thì thấy, trên production thì không ai
// thấy gì cả — và đó là loại im lặng không ai đi tìm.
console.log("expired",
    expired.length)
```

### Case: bắt lỗi ở tầng transport

```ts
@Catch()
export class ExceptionLoggingFilter implements ExceptionFilter {
    constructor(private readonly winstonService: WinstonService) {}

    public catch(exception: AbstractException, host: ArgumentsHost): void {
        this.winstonService.log(WinstonLog.RequestFailed,
            {
                code: exception.code,
                path: host.switchToHttp().getRequest<Request>().url,
            })
    }
}
```

```ts
// SAI: import thẳng logger của framework. Rule báo ngay ở specifier, không đợi tới call site.
import {
    Logger,
} from "@nestjs/common"
```

### Ngoại lệ và nhầm lẫn

- **Đổi tên biến không phải là lối ra.** Gán logger của framework cho một field tên khác vẫn là cùng
  một lần đi vòng:

  ```ts
  // SAI
  private readonly log = new Logger("orders")
  ```

- **Worker xử lý queue vẫn là `-1`, không phải `-6`.** Có job để gắn vào thì có thứ để correlate.
- **`console` trong test không nằm trong phạm vi này**, vì test không phải một tiến trình phục vụ
  request. Nhưng nó cũng không phải một lý do để `console` xuất hiện trong `src/`.

---

## `OBSERVABILITY-2` — tên sự kiện là thành viên enum

### Case: tập tên đóng và call site của nó

```ts
/** Log event names; each maps to a config entry (level, transport, messageType). */
export enum WinstonLog {
    /** An order was cancelled by its owner or by an operator. */
    OrderCancelled = "OrderCancelled",
    /** A payment webhook was rejected because its signature did not verify. */
    WebhookRejected = "WebhookRejected",
}
```

```ts
this.winstonService.log(WinstonLog.WebhookRejected,
    {
        provider,
        webhookId,
    })
```

```ts
// SAI: template literal. Một nước đi làm hỏng hai thứ: tên hết group được, dữ liệu hết query được.
this.winstonService.log(`rejected webhook ${webhookId} from ${provider}`)
```

### Case: chuỗi nối bằng `+`

```ts
// SAI: cùng một lỗi với một toán tử khác. Rule bắt cả hai vì chúng là một chuyện.
this.winstonService.log("rejected webhook " + webhookId)
```

```ts
this.winstonService.log(WinstonLog.WebhookRejected,
    {
        webhookId,
        reason: "signature-mismatch",
    })
```

### Case: chuỗi cứng, không có biến nào

```ts
// SAI: không có nội suy, vẫn sai. Nó chỉ cách việc trở thành một sự kiện khác đúng một lần sửa chữ,
// và không ai coi sửa chữ là đổi hành vi.
this.winstonService.log("subscription renewed")
```

```ts
this.winstonService.log(WinstonLog.SubscriptionRenewed,
    {
        subscriptionId,
        periodEnd,
    })
```

### Case: chữ ký của house service tự chặn ở tầng kiểu

```ts
public log<TName extends WinstonLog>(
    name: TName,
    message: (typeof configMap)[TName]["messageType"],
): void
```

Chữ ký này làm một chuỗi **không viết ra được**, chứ không phải viết ra rồi bị báo lỗi. Lint rule vẫn
cần, vì không phải house service nào cũng có chữ ký như thế, và một service phơi ra `info(name: string)`
thì tầng kiểu không giữ gì cả.

### Ngoại lệ và nhầm lẫn

- **Enum member động vẫn hợp lệ.** Chọn thành viên bằng biến là vẫn ở trong tập đóng:

  ```ts
  const event = failed ? WinstonLog.JobExecutedFailed : WinstonLog.JobExecutedSuccessfully
  this.winstonService.log(event,
      {
          jobId,
      })
  ```

- **Đừng sinh tên sự kiện từ dữ liệu.** Tra enum bằng một khoá dựng tại chỗ là template literal đội
  lốt enum: tập tên không còn đóng, và không ai liệt kê được nó nữa.

  ```ts
  // SAI
  this.winstonService.log(WinstonLog[`${kind}Synced`],
      {
          kind,
      })
  ```

- **Thiếu tên thì thêm member**, không viết tạm một chuỗi rồi hẹn dọn sau.

---

## `OBSERVABILITY-3` — phần thay đổi đi cạnh cái tên

### Case: một kiểu message cho mỗi sự kiện

```ts
/** Message for when a background job finishes executing. */
export interface JobExecutedMessage {
    /** Job record id. */
    jobId: string
    /** Queue the job was taken from. */
    queueName?: string
    /** Total duration in milliseconds, when the caller measured it. */
    durationMs?: number
    /** Whether the job completed without throwing. */
    success?: boolean
}
```

```ts
this.winstonService.log(WinstonLog.JobExecutedSuccessfully,
    {
        jobId: job.id,
        queueName: job.queueName,
        durationMs: this.clock.now().diff(startedAt),
        success: true,
    })
```

### Case: thêm một trường không phải là đổi tên

```ts
// Sáu tháng sau, cần lọc theo tenant. Tên sự kiện không đổi; dashboard cũ vẫn chạy.
export interface JobExecutedMessage {
    jobId: string
    queueName?: string
    durationMs?: number
    success?: boolean
    /** Tenant the job belonged to. */
    tenantId?: string
}
```

```ts
// SAI: nhét dữ liệu vào tên. Muốn thêm tenant thì phải viết lại tên, và mọi thứ dựng trên tên cũ
// tắt tiếng cùng lúc.
this.winstonService.log(`job ${job.id} finished in ${durationMs}ms`)
```

### Case: có tên đúng nhưng không có dữ liệu

```ts
// SAI: đếm được, nhưng không trả lời được "cái nào" và "lâu bao nhiêu". Sự kiện tồn tại mà không
// điều tra được gì.
this.winstonService.log(WinstonLog.JobExecutedSuccessfully,
    {})
```

```ts
this.winstonService.log(WinstonLog.JobExecutedSuccessfully,
    {
        jobId: job.id,
        durationMs,
        success: true,
    })
```

### Ngoại lệ và nhầm lẫn

- **Payload lớn là dữ liệu, không phải bằng chứng.** Nhét nguyên body request vào log là cách nhanh
  nhất để trả tiền egress cho thứ không ai truy vấn. Ghi id, ghi kích thước, ghi kết cục.
- **Đừng để `undefined` chiếm chỗ**: house service lọc chúng ra trước khi ghi, nhưng người viết vẫn
  nên chọn trường có nghĩa thay vì liệt kê tất cả.
- **PII không tự động là dữ liệu hợp lệ.** Xem `OBSERVABILITY-8`: những gì vượt biên phải kiểm soát
  trước, không phải sau khi đã sang bên kia.

---

## `OBSERVABILITY-4` — log quyết định, không log việc đi ngang qua

### Case: một nhánh đã được chọn, và bằng chứng của nó

```ts
if (!(await this.enrollments.existsFor(userId,
    courseId))) {
    await this.enrollments.create(userId,
        courseId)
    this.winstonService.log(WinstonLog.EnrollmentCreated,
        {
            userId,
            courseId,
            source: "checkout",
        })
    return
}
this.winstonService.log(WinstonLog.EnrollmentAlreadyExists,
    {
        userId,
        courseId,
    })
```

Nhánh thứ hai mới là thứ không ai dựng lại được sau này: nó nói hệ thống đã **bỏ qua** việc tạo bản
ghi, và bỏ qua vì cái gì.

```ts
// SAI: nói rằng hàm được gọi, điều mà call site đã nói rồi.
this.winstonService.log(WinstonLog.MethodEntered,
    {
        method: "enroll",
    })
```

### Case: chọn nhà cung cấp dự phòng

```ts
this.winstonService.log(WinstonLog.ProviderFellBack,
    {
        from: primary.id,
        to: fallback.id,
        reason: "quota-exhausted",
    })
```

```ts
// SAI: hai dòng bao quanh một lời gọi, không dòng nào nói hệ thống đã quyết cái gì.
this.winstonService.log(WinstonLog.ProviderCallStarted,
    {
        provider: primary.id,
    })
const result = await primary.call(input)
this.winstonService.log(WinstonLog.ProviderCallFinished,
    {
        provider: primary.id,
    })
```

### Case: bước của pipeline — khi nào thì đáng

```ts
// ĐÚNG khi bước có kết cục khác nhau được: xong, bỏ qua, hỏng.
this.winstonService.log(WinstonLog.ProcessStepExecuted,
    {
        jobId,
        step: "verify-signature",
        success: false,
        reason: "signature-mismatch",
    })
```

```ts
// SAI khi nó chỉ đánh dấu con trỏ đã đi tới đâu.
this.winstonService.log(WinstonLog.ProcessStepExecuted,
    {
        jobId,
        step: "verify-signature",
    })
```

### Ngoại lệ và nhầm lẫn

- **Debug tạm thời không được ở lại.** Một dòng "đã tới đây" hợp lệ trong lúc điều tra, và bị gỡ cùng
  lúc với việc điều tra kết thúc.
- **Timing không phải arrival.** Ghi `durationMs` của một thao tác là ghi một kết cục đo được, không
  phải ghi việc thao tác đã bắt đầu.
- **Một quyết định, một sự kiện.** Đừng gộp hai nhánh vào một tên rồi phân biệt bằng một trường
  `type` — dashboard sẽ phải tự tách lại thứ mà tên đã có thể tách sẵn.

---

## `OBSERVABILITY-5` — thất bại ghi danh tính

### Case: `catch` của một worker

```ts
} catch (error) {
    this.winstonService.log(WinstonLog.JobExecutedFailed,
        {
            jobId: job.id,
            queueName: job.queueName,
            code: error instanceof AbstractException ? error.code : "UnknownException",
            durationMs: this.clock.now().diff(startedAt),
        })
    throw error
}
```

```ts
// SAI: alert group theo câu chữ. Hôm nào có người viết lại câu thông báo cho dễ hiểu hơn thì một
// sự cố tách làm hai, và không ai nhận ra vì cả hai đều im.
} catch (error) {
    this.winstonService.log(WinstonLog.JobExecutedFailed,
        {
            jobId: job.id,
            error: error.message,
        })
}
```

### Case: metadata của exception là bằng chứng

```ts
this.winstonService.log(WinstonLog.PaymentRejected,
    {
        code: exception.code,
        gateway: exception.metadata.gateway,
        attempt: exception.metadata.attempt,
    })
```

```ts
// SAI: `String(error)` chỉ là cùng một câu chữ đi đường khác.
this.winstonService.log(WinstonLog.PaymentRejected,
    {
        error: String(error),
    })
```

### Case: câu chữ vẫn được ở lại, nhưng không làm khoá group

```ts
this.winstonService.log(WinstonLog.IntegrationCallFailed,
    {
        code: exception.code,
        provider,
        // trường phụ cho người đọc; alert đếm theo `code`, không đếm theo dòng này
        detail: exception.message,
    })
```

### Ngoại lệ và nhầm lẫn

- **Lỗi từ thư viện ngoài không có `code` của mình.** Quy nó về một danh tính của mình trước khi ghi;
  đừng để câu chữ của thư viện trở thành khoá group:

  ```ts
  const code = error instanceof AbstractException ? error.code : "UpstreamUnavailable"
  ```

- **Stack trace không phải danh tính.** Nó đổi theo dòng, theo bản build, theo cả minify.
- **Đừng log lỗi hai lần** ở handler rồi lại ở filter: một sự cố thành hai sự kiện, và mọi phép đếm
  gấp đôi.

---

## `OBSERVABILITY-6` — lối ra cho chương trình đứng một mình

### Case: khai lối ra một lần theo path

```js
// eslint.config.mjs
{
    files: standaloneProgramGlobs,
    rules: {
        "<plugin>/no-framework-logger": "off",
        "no-console": "off",
    },
}
```

```js
// nguồn duy nhất của danh sách, export ra để config và gate đọc CÙNG một chỗ
export const standaloneProgramGlobs = [
    "apps/cli/**",
    "apps/*-agent/**",
]
```

### Case: entry point của một CLI

```ts
// apps/cli/src/main.ts — không có request nào để correlate, không có transport nào được cấu hình.
const bootstrap = async () => {
    await CommandFactory.run(AppModule,
        new Logger())
}
```

```ts
// SAI: cùng đoạn code đó, nhưng lối ra được lấy theo từng dòng. Mỗi dòng như thế là một ngoại lệ
// mới mà không ai đo được tổng của chúng.
// eslint-disable-next-line <plugin>/no-framework-logger -- pre-DI bootstrap
new Logger()
```

### Case: thứ trông giống lối ra nhưng không phải

```ts
// SAI: worker này chạy trong tiến trình phục vụ queue. Có job để gắn vào, nên nó thuộc `-1`.
@Processor("payments")
export class PaymentsWorker {
    private readonly logger = new Logger(PaymentsWorker.name)
}
```

```ts
@Processor("payments")
export class PaymentsWorker {
    constructor(private readonly winstonService: WinstonService) {}
}
```

### Ngoại lệ và nhầm lẫn

- **"Chương trình nhỏ" không phải tiêu chí.** Tiêu chí là **có request hay không**.
- **Script migrate chạy tay là lối ra; migration chạy trong lúc app boot thì không**, vì lúc đó
  injector đã tồn tại và transport đã được cấu hình.
- **Một danh sách, không hai.** Nếu gate đo bằng một danh sách còn config tắt bằng một danh sách
  khác, một trong hai sẽ âm thầm rộng ra.

---

## `OBSERVABILITY-7` — Minimal trước, Full khi có bằng chứng

### Case: đường đi nhỏ nhất mà đầy đủ

```ts
export const createConsoleOnlyLogger = () => buildLogger({ console: true, forward: false })
export const createForwardingLogger = () => buildLogger({ console: false, forward: true })
export const createConsoleAndForwardingLogger = () => buildLogger({ console: true, forward: true })
```

```ts
// mỗi sự kiện tự khai nó có vượt biên hay không — đây là chỗ cardinality và chi phí được quyết định
export const configMap = {
    [WinstonLog.JobExecutedFailed]: {
        name: WinstonLog.JobExecutedFailed,
        level: WinstonLevel.Error,
        console: true,
        forward: true,
        messageType: {} as JobExecutedMessage,
    },
    [WinstonLog.ContextFileLoaded]: {
        name: WinstonLog.ContextFileLoaded,
        level: WinstonLevel.Debug,
        console: true,
        forward: false,
        messageType: {} as ContextFileLoadedMessage,
    },
}
```

### Case: brief của một Phase 1 nói đủ ba thứ

```text
Phase 1 — Minimal
  đã có:   log có tên + có cấu trúc, console ở mọi môi trường
  thêm:    chuyển tiếp sự kiện mức error/warn sang backend đã duyệt; 2 alert nguy cấp
  hoãn:    tracing phân tán, metric tuỳ biến, dashboard thứ hai
  mở lại:  khi có một sự cố mà log đã có không định vị nổi, đo được, ghi lại số lần
```

```text
SAI — brief liệt kê công cụ, không liệt kê tín hiệu
  thêm:    collector, tracer, TSDB, dashboard stack
  lý do:   "chúng nó tích hợp sẵn với nhau"
```

### Ngoại lệ và nhầm lẫn

- **Full không phải nợ của Minimal.** Minimal xong là xong; Full bắt đầu ở một Review sau.
- **"Có sẵn trên cloud" không phải bằng chứng.** Bằng chứng là một SLO hoặc khoảng trống debug đo
  được, một giới hạn scale/cardinality, một ràng buộc tuân thủ hay cư trú dữ liệu, một yêu cầu độ tin
  cậy, hoặc một chi phí đã chứng minh.
- **Hoãn phải được ghi ra.** Một thứ bị hoãn mà không ai ghi lại thì lần sau sẽ được thêm vào như thể
  chưa từng bị cân nhắc.

---

## `OBSERVABILITY-8` — tiến trình telemetry trả giá vòng đời của nó

### Case: dùng lại đường đã có, khai bằng config có kiểu

```ts
/** Forwarding backend configuration. */
forward: {
    /** Host of the approved log backend. */
    host: parseEnvString({ key: "LOG_BACKEND_HOST", defaultValue: "http://localhost:3100" }),
    /** Whether the backend requires authentication. */
    requireAuth: parseEnvBoolean({ key: "LOG_BACKEND_REQUIRE_AUTH", defaultValue: false }),
    /** Credentials, read through the secret reader. */
    username: parseEnvSecret({ key: "LOG_BACKEND_USERNAME" }),
    password: parseEnvSecret({ key: "LOG_BACKEND_PASSWORD" }),
}
```

Không có tiến trình mới nào trong runtime: một transport, một backend đã duyệt, credential khai như
secret. Đó là hình dạng của một lần **từ chối** thêm tiến trình.

### Case: brief bắt buộc khi vẫn cần một tiến trình tại chỗ

```text
Tiến trình đề xuất: local collector
  tín hiệu đường hiện tại không chở nổi: trace xuyên service (log không nối được span)
  chủ sở hữu:      đội platform
  tài nguyên:      0.5 vCPU / 512Mi
  cổng:            4317 (nội bộ, không expose)
  credential:      1 token ghi, lưu như secret
  lưu trữ:         không (chuyển tiếp ngay)
  health check:    /healthz, 10s
  backup:          không áp dụng (không giữ trạng thái)
  điều kiện gỡ:    khi backend đã duyệt nhận trực tiếp được, hoặc khi trace không còn được truy vấn
```

```text
SAI — brief nói về tính năng của công cụ
  "nó có UI đẹp, có alert sẵn, dựng bằng một lệnh"
  không ai trả lời được: ai sở hữu, mở cổng nào, giữ bao lâu, khi nào gỡ
```

### Case: managed không xoá nghĩa vụ kiểm soát

```ts
// vượt biên hay không là một quyết định theo từng sự kiện, không phải một công tắc toàn cục
forward: event.level === WinstonLevel.Error || event.level === WinstonLevel.Warn,
```

```ts
// SAI: bật hết cho tiện. Cardinality và chi phí trở thành thứ phát hiện ra ở hoá đơn tháng sau.
forward: true,
```

### Ngoại lệ và nhầm lẫn

- **Cloud-first không phải cloud-only.** Bảo mật, cư trú dữ liệu, độ tin cậy hoặc chi phí đều có thể
  làm managed thành lựa chọn sai; khi đó lý do được ghi lại như một ràng buộc.
- **Dashboard cũng là một tiến trình.** Nó có cổng, có credential, có người phải nâng cấp nó.
- **"Tạm dựng để xem thử" là cách một tiến trình vào runtime vĩnh viễn.** Điều kiện gỡ phải được viết
  ra **trước**, vì sau đó sẽ không ai viết nữa.

---

## Ánh xạ yêu cầu sang một quyết định

Nêu call site, vòng đời và tín hiệu. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể rồi
dừng. Câu trả lời phải là một quyết định hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| "Thêm log vào handler huỷ đơn" | Có request để correlate | `OBSERVABILITY-1` | Inject house service, gọi qua nó |
| "Log ra là biết đơn nào bị huỷ" | Id là dữ liệu, không phải tên | `OBSERVABILITY-3` | Tên enum + `{ orderId, actorId }` |
| "Ghi luôn lý do vào câu log cho dễ đọc" | Câu chữ không group được | `OBSERVABILITY-2` | Thêm trường `reason`, giữ nguyên tên |
| "Đánh dấu chỗ này để biết code có chạy" | Source đã nói điều đó | `OBSERVABILITY-4` | Từ chối; log nhánh đã chọn và bằng chứng |
| "Alert khi job chết" | Khoá group phải sống sót qua việc sửa chữ | `OBSERVABILITY-5` | Ghi `code` + metadata, câu chữ là trường phụ |
| "CLI cũng phải dùng service đó chứ?" | Không có request để gắn vào | `OBSERVABILITY-6` | Logger thường, khai một lần theo path |
| "Bật thêm tracing cho đủ bộ" | Công cụ có sẵn không phải bằng chứng | `OBSERVABILITY-7` | Hoãn, ghi lại trigger đo được để mở lại |
| "Dựng thêm một collector tại chỗ" | Đường hiện tại đã chở được tín hiệu này | `OBSERVABILITY-8` | Từ chối, hoặc khai đủ vòng đời trước |

Ở dòng thứ tư, câu hỏi phân định **chỉ** được hỏi khi bên yêu cầu nói rõ họ cần dấu vết chứ không cần
quyết định: *"Có một nhánh nào ở đây mà kết cục của nó khác nhau được không?"*

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `OBSERVABILITY-1` / `-2` | Dòng này đi sai đường, hay đi đúng đường mà mang sai tên? |
| `OBSERVABILITY-1` / `-6` | Có tồn tại một request hoặc một job để dòng này gắn vào không? |
| `OBSERVABILITY-2` / `-3` | Dữ liệu đang nằm **trong** tên, hay nằm **cạnh** tên? |
| `OBSERVABILITY-3` / `-5` | Đây là sự kiện bình thường, hay là một thất bại cần khoá group theo danh tính? |
| `OBSERVABILITY-4` / `-2` | Sự kiện này có đáng tồn tại không, hay chỉ là tên đặt cho một lần đi ngang? |
| `OBSERVABILITY-4` / `-3` | Sai chỗ đặt, hay đúng chỗ mà thiếu bằng chứng? |
| `OBSERVABILITY-7` / `-8` | Đang mở rộng **phạm vi tín hiệu**, hay đang thêm **một tiến trình** để chở nó? |

## Sai lầm lặp lại nhiều nhất

1. Dùng logger của framework vì nó "cũng ra JSON" — và mất correlation id.
2. Nhét id vào câu chữ bằng template literal.
3. Viết một chuỗi cứng vì "chỉ một chỗ dùng thôi".
4. Log đầu hàm và cuối hàm thay vì log nhánh đã chọn.
5. Ghi `error.message` làm khoá group trong `catch`.
6. Lấy lối ra `-6` bằng comment tắt rule trên từng dòng thay vì khai một lần theo path.
7. Coi Phase 2 là phần việc còn nợ của Phase 1.
8. Thêm một tiến trình telemetry vì công cụ tích hợp sẵn, rồi mới hỏi ai sở hữu nó.
