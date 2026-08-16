---
id: be-lints-observability-example
title: example.md
slug: /be/lints/observability/example
sidebar_label: example.md
sidebar_position: 2
description: Mã nổ quy tắc, mã không nổ, và mã lách qua được - từng trường hợp của hai quy tắc observability.
---

# example.md

> Version: `2.00` · Mô-đun: `observability` · Luật: [`INDEX.md`](./INDEX.md) · Từng quy tắc: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mỗi quy tắc có **nhiều cặp** **SAI** (quy tắc nổ) và **ĐÚNG** (quy tắc im), rồi tới mục
**Cửa lách và nhầm lẫn**.

Mục cửa lách là phần quan trọng nhất của trang này và cần đọc đúng cách: **mã trong đó là mã quy tắc
KHÔNG bắt được, không phải mã được phép viết.** Nó vi phạm luật y như phần SAI. Khác biệt duy nhất là
không có gì đỏ lên, nên nó chỉ được chặn bằng mắt người rà soát — và người rà soát chỉ chặn được thứ
mình biết là có.

Tên gói `@nestjs/common`, tên `Logger` và tên thuộc tính `winstonService` được chép **nguyên văn**,
vì đó đúng là chuỗi mà quy tắc so sánh. Đổi một ký tự trong ví dụ là đổi kết quả.

---

## `no-framework-logger`

### SAI — nhập tên `Logger` từ đúng chuỗi nguồn

```ts
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class ArchiveOrderService {
    private readonly logger = new Logger(ArchiveOrderService.name)
}
```

Nổ **hai** lần trên cùng một tệp: `imported` tại specifier `Logger` ở dòng nhập, và `constructed`
tại `new Logger(...)`. Hai nhánh độc lập, nên sửa một nửa vẫn còn đỏ.

### ĐÚNG — tiêm dịch vụ ghi log của nhà

```ts
import { Injectable } from "@nestjs/common"

@Injectable()
export class ArchiveOrderService {
    constructor(private readonly winstonService: WinstonService) {}
}
```

### SAI — dựng mà không nhập gì cả

```ts
export class RetryPaymentHandler {
    private readonly logger = new Logger(RetryPaymentHandler.name)
}
```

Nhánh `NewExpression` **không hỏi đường dẫn gói**. Cái tên đến từ đâu không quan trọng: callee là
định danh trần `Logger` là đủ.

### ĐÚNG — không dựng gì, chỉ nhận vào

```ts
export class RetryPaymentHandler {
    constructor(private readonly winstonService: WinstonService) {}
}
```

### SAI — đổi tên khi nhập không giấu được

```ts
import { Logger as AppLogger } from "@nestjs/common"

const logger = new AppLogger("checkout")
```

Phép so là `specifier.imported.name`, tức tên **tại nguồn**, không phải tên cục bộ. Dòng nhập vẫn nổ.
Dòng `new AppLogger(...)` thì **không** nổ, vì callee là `AppLogger` — nên nếu ai đó chỉ tắt dòng
nhập bằng chú thích, phần còn lại đi lọt hoàn toàn.

### ĐÚNG — nhập những thứ khác từ cùng gói

```ts
import { Injectable, Inject, forwardRef } from "@nestjs/common"
```

Vòng lặp duyệt **mọi** specifier nhưng chỉ so với đúng một cái tên, nên phần còn lại của gói không bị
đụng tới.

### SAI — dựng ở bất kỳ vị trí nào

```ts
export const createAuditWriter = () =>
    ({
        logger: new Logger("audit"),
    })
```

`NewExpression` là một **loại nút**, không phải một vị trí. Trong trường của lớp, trong nhà máy,
trong getter, trong callback — nổ như nhau.

### ĐÚNG — nhà máy nhận dịch vụ vào

```ts
export const createAuditWriter = (winstonService: WinstonService) =>
    ({
        write: (name: WinstonLog, data: Record<string, unknown>) =>
            winstonService.info(name, data),
    })
```

### Cửa lách và nhầm lẫn

Mọi đoạn dưới đây **vi phạm `OBSERVABILITY-1`** và **không có gì báo**.

- **Nhập theo không gian tên — cả hai nhánh cùng trượt.** Lỗ rộng nhất của mô-đun.

  ```ts
  // KHÔNG BỊ BẮT - và vẫn đi vòng qua mã tương quan y hệt ví dụ SAI đầu trang
  import * as common from "@nestjs/common"

  export class ArchiveOrderService {
      private readonly logger = new common.Logger(ArchiveOrderService.name)
  }
  ```

  Specifier là `ImportNamespaceSpecifier` nên vòng lặp bỏ qua; callee là `MemberExpression` nên nhánh
  dựng bỏ qua.

- **Lớp anh em cùng gói.** Tập tên là đúng một chuỗi.

  ```ts
  // KHÔNG BỊ BẮT - lớp cài đặt cụ thể mang tên khác
  import { ConsoleLogger } from "@nestjs/common"

  const logger = new ConsoleLogger("checkout")
  ```

- **Bọc lại một lần, tắt quy tắc ở khắp nơi.** Tệp khai báo:

  ```ts
  // Tệp này CÓ bị bắt ở dòng nhập - nhưng chỉ tệp này
  import { Logger } from "@nestjs/common"

  export class HouseLogger extends Logger {}
  ```

  Bốn mươi tệp tiêu thụ:

  ```ts
  // KHÔNG BỊ BẮT - nhập một cái tên cục bộ từ một đường dẫn cục bộ
  import { HouseLogger } from "../shared/house-logger"

  const logger = new HouseLogger("checkout")
  ```

  `extends` không phải `NewExpression`; `HouseLogger` không phải `Logger`.

- **Gọi tĩnh, không dựng gì.**

  ```ts
  // KHÔNG BỊ BẮT - không có NewExpression nào, và tên đến qua không gian tên
  import * as common from "@nestjs/common"

  common.Logger.log("archive finished")
  ```

- **Đường dẫn gói sâu.** Phép so là bằng chuỗi trên đúng thứ đã viết ra.

  ```ts
  // KHÔNG BỊ BẮT ở nhánh nhập - node.source.value không bằng chuỗi đang canh
  import { Logger } from "@nestjs/common/services"
  ```

- **`require` thay cho `import`.**

  ```ts
  // KHÔNG BỊ BẮT ở nhánh nhập - không có nút ImportDeclaration nào
  const { Logger } = require("@nestjs/common")

  registerLoggerClass(Logger)
  ```

  Ở đây lớp được **truyền đi** chứ không được dựng, nên nhánh còn lại cũng nằm im.

- **Thư mục không phải tệp.** Lối ra hợp lệ là một glob thư mục. Một dịch vụ có yêu cầu để gắn vào,
  nếu nằm dưới thư mục đã miễn, không bị kiểm — **và không có tín hiệu nào** nói rằng nó đang ở ngoài
  vòng kiểm.

- **Ngược chiều: một báo cáo sai.** Đoạn này **bị báo** dù nó không đi vòng qua gì cả.

  ```ts
  // BỊ BÁO nhưng KHÔNG vi phạm - importKind không được đọc
  import type { Logger } from "@nestjs/common"

  export interface WriterPort {
      readonly logger: Logger
  }
  ```

  Cái giá của báo thừa không phải là phiền: nó dạy người ta viết chú thích tắt lên những dòng vốn
  đúng, và một chú thích tắt đã quen tay thì lần sau đặt lên dòng sai cũng không ai hỏi.

---

## `no-interpolated-log-message`

### SAI — chuỗi mẫu ở đối số thứ nhất

```ts
this.winstonService.info(`opened enrollment for ${user.id} on ${courseId}`)
```

### ĐÚNG — tên từ enum, phần biến thiên đi bên cạnh

```ts
this.winstonService.info(WinstonLog.EnrollmentOpened,
    {
        userId: user.id,
        courseId,
        source: "checkout",
    })
```

### SAI — nối chuỗi bằng `+`

```ts
this.winstonService.warn("retrying payment " + attempt + " of " + maxAttempts)
```

### ĐÚNG — số đếm là dữ liệu, không phải câu chữ

```ts
this.winstonService.warn(WinstonLog.PaymentRetried,
    {
        attempt,
        maxAttempts,
        orderId,
    })
```

### SAI — chữ chuỗi trần, trông rất ngoan

```ts
this.winstonService.info("ORDER_HANDLED")
```

Quy tắc rộng hơn tên gọi của nó: không có phép nội suy nào ở đây và vẫn bị báo. Lý do nằm ở luật —
một chữ trần chỉ cách một lần sửa chữ là thành một sự kiện khác đối với mọi bảng theo dõi, và không
có gì buộc hai chỗ viết cùng một chuỗi phải giống nhau.

### ĐÚNG — thêm thành viên vào enum rồi dùng nó

```ts
this.winstonService.info(WinstonLog.OrderHandled,
    {
        orderId,
    })
```

### SAI — thất bại kể bằng câu tiếng Anh

```ts
this.winstonService.error(`enrollment failed: ${error.message}`)
```

### ĐÚNG — thất bại kể bằng danh tính

```ts
this.winstonService.error(WinstonLog.EnrollmentFailed,
    {
        code: error.code,
        courseId,
        userId: user.id,
    })
```

### SAI — bên nhận đã tách rời vẫn bị bắt

```ts
const { winstonService } = this

winstonService.debug(`cache miss for ${key}`)
```

`isLoggerReceiver` nhận cả `Identifier` trần lẫn `MemberExpression`, nên tách ra một biến **không**
lách được, miễn là biến đó vẫn tên `winstonService`.

### ĐÚNG — cùng cách viết đó với tên từ enum

```ts
const { winstonService } = this

winstonService.debug(WinstonLog.CacheMissed,
    {
        key,
    })
```

### SAI — chuỗi đi qua nhiều tầng thuộc tính

```ts
this.deps.winstonService.verbose(`worker ${workerId} picked up job ${jobId}`)
```

Chỉ **thuộc tính cuối** trong chuỗi truy cập được so, nên đi sâu bao nhiêu tầng cũng vẫn bị bắt.

### ĐÚNG — cùng độ sâu, tên đúng

```ts
this.deps.winstonService.verbose(WinstonLog.JobPickedUp,
    {
        workerId,
        jobId,
    })
```

### Cửa lách và nhầm lẫn

Mọi đoạn dưới đây **vi phạm `OBSERVABILITY-2`, `-3` hoặc `-5`** và **không có gì báo**.

- **Hằng số giặt sạch chữ.** Không phải phá hoại — chỉ là ai đó rút một dòng dài ra ngoài.

  ```ts
  // KHÔNG BỊ BẮT - đối số thứ nhất giờ là một Identifier
  const message = `opened enrollment for ${user.id} on ${courseId}`

  this.winstonService.info(message)
  ```

- **Một lời gọi ở vị trí đầu.** Chuỗi hợp nhất được sinh ra cách đó đúng một khung ngăn xếp.

  ```ts
  // KHÔNG BỊ BẮT - CallExpression không nằm trong ba hình dạng bị báo
  this.winstonService.info(describeEnrollment(user, courseId))
  ```

  ```ts
  // KHÔNG BỊ BẮT - vẫn là CallExpression
  this.winstonService.info(`enrollment ${courseId}`.toUpperCase())
  ```

- **Chuyển sang ô thứ hai.** Chỉ `arguments[0]` được đọc.

  ```ts
  // KHÔNG BỊ BẮT - tên đã nhóm được, dữ liệu bên cạnh vẫn không truy vấn được
  this.winstonService.error(WinstonLog.PaymentFailed,
      {
          detail: `declined ${error.message} after ${attempt} tries`,
      })
  ```

  Đây là `OBSERVABILITY-3` và `OBSERVABILITY-5` nằm trong một dòng, và **không quy tắc nào nhìn vào
  đối số thứ hai**. Cảnh báo sẽ nhóm theo câu chữ y như trước, chỉ là chuyển xuống thấp hơn một tầng.

- **Nửa khẳng định bỏ trống.** Không có gì kiểm rằng tên đến từ enum.

  ```ts
  // KHÔNG BỊ BẮT - Identifier, không ai truy nó về đâu
  this.winstonService.info(eventName)
  ```

  ```ts
  // KHÔNG BỊ BẮT - Literal nhưng value là số, không phải chuỗi
  this.winstonService.info(42)
  ```

  ```ts
  // KHÔNG BỊ BẮT - ConditionalExpression giấu chuỗi mẫu vào loại nút không được soi
  this.winstonService.info(isRetry ? WinstonLog.PaymentRetried : `first attempt ${orderId}`)
  ```

- **Đổi tên thuộc tính được tiêm.** Cửa mở rộng nhất của quy tắc này, và là việc dọn dẹp bình thường
  nhất.

  ```ts
  // KHÔNG BỊ BẮT - đúng dịch vụ ấy, chỉ khác cách viết tên
  export class CheckoutService {
      constructor(private readonly logger: WinstonService) {}

      handle(orderId: string) {
          this.logger.info(`checkout started for ${orderId}`)
      }
  }
  ```

  Danh tính bên nhận là **cách viết**, không bao giờ là kiểu. Một lần đổi tên tắt quy tắc cho cả lớp.

- **Truy cập tính toán ở bất kỳ vế nào.**

  ```ts
  // KHÔNG BỊ BẮT - callee.computed === true
  this.winstonService["info"](`checkout started for ${orderId}`)
  ```

  ```ts
  // KHÔNG BỊ BẮT - isLoggerReceiver từ chối MemberExpression có tính toán
  this["winstonService"].info(`checkout started for ${orderId}`)
  ```

- **Tách rời phương thức.**

  ```ts
  // KHÔNG BỊ BẮT - callee thành Identifier, visitor trả về ở dòng đầu tiên
  const { info } = this.winstonService

  info(`checkout started for ${orderId}`)
  ```

- **Mức log ngoài tập đóng sáu phần tử.**

  ```ts
  // KHÔNG BỊ BẮT - "fatal" không nằm trong tập LOG_METHODS
  this.winstonService.fatal(`shard ${shardId} unreachable`)
  ```

  Và không có gì trong quy tắc báo rằng tập đã cũ. Dịch vụ mọc thêm một mức là mọc thêm một cánh cửa.

- **Một dịch vụ ghi log thứ hai.**

  ```ts
  // KHÔNG BỊ BẮT - mọi cách viết khác đều không phải logger dưới mắt quy tắc này
  this.auditService.info(`role ${role} granted to ${userId}`)
  ```

---

## Ánh xạ yêu cầu sang enforcement

Nêu điều muốn giữ, rồi hỏi **cái gì đang giữ nó**. Câu trả lời phải là một tên quy tắc hoặc chữ
"không ai" — không bao giờ là "chắc là có".

| Yêu cầu bằng lời | Ai giữ | Kết quả |
|---|---|---|
| Cấm logger của khung thay cho dịch vụ nhà | `no-framework-logger` | Bắt được câu nhập đúng chuỗi gói và mọi `new Logger(...)` với callee trần |
| Cấm `console` | Quy tắc chuẩn `no-console`, gọi tên trong bộ khuyến nghị | Không viết lại ở đây |
| Cấm nội suy vào tên sự kiện | `no-interpolated-log-message` | Bắt chuỗi mẫu, nối `+`, chữ chuỗi ở **đối số thứ nhất** |
| Buộc tên sự kiện phải là thành viên enum | **không ai** | Chỉ nửa phủ định được giữ; định danh, lời gọi, số, `null` đều đi lọt |
| Buộc phần biến thiên đi thành dữ liệu bên cạnh | **không ai** | Không quy tắc nào đọc `arguments[1]` |
| Cấm log lúc vào/ra phương thức | **không ai** | Cần biết đoạn mã để làm gì |
| Buộc thất bại ghi danh tính lỗi thay vì câu chữ | **không ai** | Câu lỗi đã dựng nằm trong đối tượng dữ liệu là một giá trị |
| Cho phép chương trình chạy ngoài vòng đời yêu cầu dùng logger thường | `standaloneProgramGlobs` | Là danh sách cấu hình, không phải quy tắc; miễn theo **thư mục** |
| Ràng buộc ngân sách vòng đời cho một tiến trình đo đạc mới | **không ai** | Là bản mô tả trong phiên duyệt |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| Bị bắt / không bị bắt, ở nhánh nhập | `node.source.value` có **bằng đúng** chuỗi gói đang canh không, và specifier có phải `ImportSpecifier` không? |
| Bị bắt / không bị bắt, ở nhánh dựng | `callee` là `Identifier` trần hay là `MemberExpression`? |
| Có phải bên nhận hợp lệ không | Thuộc tính **cuối** trong chuỗi truy cập có viết đúng `winstonService` không, và truy cập có tính toán không? |
| Có phải "chuỗi được dựng" không | Nút đó là `TemplateLiteral`, `BinaryExpression` với `+`, hay `Literal` kiểu chuỗi? Ngoài ba thứ đó là im |
| Vi phạm còn hay đã hết | Cái sai chỉ **chuyển sang đối số thứ hai** hay đã thật sự thành enum cộng dữ liệu? |
| Miễn trừ hợp lệ hay lọt lưới | Tệp này có thật sự là chương trình chạy ngoài vòng đời yêu cầu, hay chỉ tình cờ nằm dưới thư mục đã miễn? |

## Sai lầm lặp lại nhiều nhất

1. Sửa dòng `new Logger(...)` mà quên dòng nhập, hoặc ngược lại — hai nhánh độc lập, mỗi nhánh báo
   riêng.
2. Rút chuỗi mẫu ra một `const` cho gọn rồi tưởng đã sửa xong. Quy tắc im, luật vẫn bị vi phạm.
3. Chuyển phần nội suy sang đối số thứ hai và coi là đã cấu trúc hoá. Dữ liệu vẫn là một câu văn.
4. Đổi tên thuộc tính được tiêm thành `logger` cho ngắn, và tắt quy tắc cho cả lớp mà không biết.
5. Tưởng quy tắc kiểm rằng tên đến từ enum. Nó chỉ từ chối ba cách viết của chuỗi được dựng.
6. Bọc logger của khung thành một lớp của nhà rồi coi như đã tuân thủ.
7. Đặt một dịch vụ có vòng đời yêu cầu vào thư mục đã được miễn, và mất enforcement mà không có tín
   hiệu nào.
8. Viết chú thích tắt cho một báo cáo sai ở `import type`, rồi quen tay đặt chú thích tắt lên những
   dòng thật sự sai.
