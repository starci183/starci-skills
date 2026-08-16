---
id: be-patterns-exceptions-example
title: example.md
slug: /be/patterns/exceptions/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã EXCEPTION-N, viết bằng TypeScript thường.
---

# example.md

> Version: `2.00` · Module: `exceptions` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường, có hình dạng một ứng dụng Nest quen thuộc**. Không dùng tên
sản phẩm, tên module riêng hay tên repository. Một luật ở shelf này chỉ đúng khi nó đúng ở bất kỳ back
end nào — vì vậy nếu một ví dụ cần tên riêng của một hệ thống cụ thể mới đọc được, ví dụ đó không phù
hợp ở đây.

Mỗi mã có **nhiều case**, sau đó là mục **ngoại lệ và nhầm lẫn**. Cuối trang ánh xạ yêu cầu bằng lời
sang một cách viết duy nhất.

---

## `EXCEPTION-1` — throw một class có tên

### Case: tra cứu không ra bản ghi

```ts
if (!order) {
    throw new OrderNotFoundException({
        orderId,
    })
}
```

```ts
// SAI: một câu văn. Client không phân biệt được nó với sáu lỗi 400 khác, alert không group được, và
// orderId chỉ lấy lại được bằng cách parse message.
if (!order) {
    throw new BadRequestException(`order ${orderId} not found`)
}
```

Hai đoạn khác nhau đúng một thứ: phía dưới có làm được gì với thất bại này hay không.

### Case: `Error` trần trong product code

```ts
// SAI
if (balance < amount) {
    throw new Error("insufficient balance")
}
```

```ts
// ĐÚNG
if (balance < amount) {
    throw new InsufficientBalanceException({
        accountId,
        balance,
        requested: amount,
    })
}
```

Bản SAI không phải "thiếu chi tiết" — nó thiếu **code**. Không có code thì không có gì để retry policy
khớp vào, không có gì để alert group theo, và không có gì để client rẽ nhánh ngoài chính câu tiếng
Anh đó.

### Case: bọc lỗi của một thư viện ngoài

```ts
try {
    return await this.storageClient.putObject(bucket, key, body)
} catch (error) {
    throw new ObjectStorageWriteFailedException({
        bucket,
        key,
        originalError: error as Error,
    })
}
```

```ts
// SAI: ném lại nguyên trạng. Lỗi của thư viện mang từ vựng của thư viện đó, và bộ code của ứng dụng
// vừa mọc thêm một nhánh mà không ai khai báo.
try {
    return await this.storageClient.putObject(bucket, key, body)
} catch (error) {
    throw error
}
```

Vấn đề không phải mất thông tin — `originalError` giữ lại nguyên bản. Vấn đề là **biên giới**: một
thất bại vượt qua biên của ứng dụng thì phải mang tên của ứng dụng.

### Ngoại lệ và nhầm lẫn

- **Health probe được phép dùng exception của framework**, vì ở đó status **là** toàn bộ hợp đồng:

  ```ts
  @Controller("healthz")
  export class HealthController {
      @Get()
      check(): { status: string } {
          if (!this.dependencies.ready()) {
              // orchestrator chỉ đọc status code, không bao giờ đọc body
              throw new ServiceUnavailableException()
          }
          return {
              status: "ok",
          }
      }
  }
  ```

- **Nhưng `Error` trần vẫn bị từ chối kể cả ở probe:**

  ```ts
  // SAI ngay trong health controller: status của probe là hợp đồng, một cú crash không tên thì không.
  if (!this.dependencies.ready()) {
      throw new Error("not ready")
  }
  ```

- **Ngoại lệ này hẹp có chủ đích.** Chỉ health controller mới được, để nó không trở thành chỗ một
  service đi qua để khỏi phải đặt tên cho thất bại của mình.

---

## `EXCEPTION-2` — đúng một object metadata

### Case: một object mang đủ trường

```ts
throw new SubscriptionTierNotAvailableException({
    tier,
    requestedAt,
})
```

### Case: không có gì để kể — vẫn viết object

```ts
// ĐÚNG: thất bại này không có id nào để mang, và vẫn giữ đúng một cách viết như mọi throw khác.
throw new AdminApiKeyNotConfiguredException({})
```

```ts
// SAI: cách viết thứ hai. Từ giờ người đọc phải kiểm tra xem exception NÀY có nhận tham số không.
throw new AdminApiKeyNotConfiguredException()
```

### Case: tham số vị trí — hình dạng không lớn lên được

```ts
// SAI
throw new StateTransitionRejectedException(orderId, "pending")
```

```ts
// ĐÚNG
throw new StateTransitionRejectedException({
    orderId,
    from: "pending",
})
```

Vì sao bản SAI nguy hiểm hơn nó trông: ngày thêm trường `to`, mọi chỗ throw phải sửa, và một chỗ viết
nhầm thứ tự hai chuỗi vẫn **compile qua**. Object literal thì chỗ viết thiếu trường sẽ đỏ ngay tại
chỗ.

### Case: khai báo là thứ khiến object lớn lên được

```ts
/** Metadata cho {@link StateTransitionRejectedException}. */
export interface StateTransitionRejectedExceptionMetadata extends AbstractExceptionMetadata {
    /** Id của bản ghi bị từ chối chuyển trạng thái. */
    orderId: string
    /** Trạng thái hiện tại. */
    from: string
    /** Trạng thái được yêu cầu chuyển tới. */
    to: string
}

/** Bản ghi không thể chuyển sang trạng thái được yêu cầu từ trạng thái hiện tại. */
export class StateTransitionRejectedException extends AbstractException {
    constructor({
        orderId,
        from,
        to,
        originalError,
    }: StateTransitionRejectedExceptionMetadata) {
        super(
            "Order cannot move to the requested state",
            "STATE_TRANSITION_REJECTED_EXCEPTION",
            {
                orderId,
                from,
                to,
                originalError,
            },
        )
    }
}
```

Thêm `to` vào interface là một dòng. Mọi chỗ throw thiếu nó đỏ lên ngay. Đó là điều mà một constructor
vị trí không mua được cho bạn.

### Case: nhiều hơn một tham số

```ts
// SAI: hai tham số. Cái thứ hai sẽ đi đâu, và ai đọc được nó?
throw new RateLimitExceededException({
    clientId,
}, 429)
```

```ts
// ĐÚNG: mọi thứ cần nói đều nằm trong một object; status là việc của khai báo, không của chỗ throw.
throw new RateLimitExceededException({
    clientId,
    limit,
    observed,
})
```

### Ngoại lệ và nhầm lẫn

- **Constructor của framework không thuộc luật này:**

  ```ts
  // Nest công bố constructor này. Viết lại nó cho hợp quy ước nhà sẽ đổi luôn thứ framework gửi đi.
  throw new ServiceUnavailableException({
      retryAfter: 30,
  })
  ```

  Chuyện nó có được throw ở đây hay không là câu hỏi của `EXCEPTION-1`, và `EXCEPTION-1` trả lời rồi.

- **`{}` thoả `EXCEPTION-2` tuyệt đối, và có thể vẫn trốn `EXCEPTION-5`:**

  ```ts
  // Hợp lệ về hình dạng. Nhưng nếu thất bại này có một id để kể mà không kể, nó vi phạm EXCEPTION-5.
  throw new PaymentGatewayRejectedException({})
  ```

- **Object rỗng không phải chỗ để lười.** Nó dành cho thất bại **thật sự** không có dữ kiện nào —
  điển hình là lỗi cấu hình, nơi thứ duy nhất cần nói đã nằm trong chính cái tên.

---

## `EXCEPTION-3` — class extends base của nhà

### Case: khai báo đúng

```ts
/** Tài khoản đã đăng ký gói này rồi. */
export class SubscriptionAlreadyActiveException extends AbstractException {
    constructor({
        accountId,
    }: SubscriptionAlreadyActiveExceptionMetadata) {
        super(
            "Subscription is already active for this account",
            "SUBSCRIPTION_ALREADY_ACTIVE_EXCEPTION",
            {
                accountId,
            },
        )
    }
}
```

```ts
// SAI: một exception của framework đội lốt. Tên đúng, thư mục đúng, chỉ dòng `extends` là sai.
export class SubscriptionAlreadyActiveException extends ConflictException {
    /* ... */
}
```

### Case: chỗ throw của cả hai bản trên — giống hệt nhau

```ts
if (subscription?.active) {
    throw new SubscriptionAlreadyActiveException({
        accountId,
    })
}
```

Đây là toàn bộ lý do `EXCEPTION-3` tồn tại tách khỏi `EXCEPTION-1`. Dòng trên **không đổi một ký tự**
giữa bản đúng và bản sai. Một rule đọc chỗ throw sẽ cho qua, mọi reviewer đọc call site cũng cho qua,
và class đó sống tiếp — được throw từ bốn chỗ — trong khi gate vẫn xanh.

Kết luận về một class chỉ được rút ra từ **file khai báo**.

### Case: file của base — class duy nhất được extends thứ khác

```ts
/** Base của mọi exception trong ứng dụng. */
export class AbstractException extends Error {
    readonly code: string
    readonly metadata?: Record<string, unknown>
    readonly httpStatus?: number

    constructor(message: string, name: string, metadata?: Record<string, unknown>, httpStatus?: number) {
        super(message)
        this.code = name
        this.name = name
        this.metadata = metadata
        this.httpStatus = httpStatus
    }
}
```

Ngoại lệ này cấp theo **tên file**, không cấp theo thư mục — nếu cấp theo thư mục thì cả trăm file
hàng xóm cũng được extends bất cứ thứ gì.

```ts
// SAI: cùng thư mục, không phải file base.
export class LegacyImportException extends Error {
    /* ... */
}
```

### Ngoại lệ và nhầm lẫn

- **Cần đúng một status cụ thể không phải lý do để extends framework.** Base của nhà đã có chỗ cho
  status, và giữ nguyên code:

  ```ts
  export class AdminApiKeyNotConfiguredException extends AbstractException {
      constructor({
          originalError,
      }: AdminApiKeyNotConfiguredExceptionMetadata) {
          super(
              "Admin API key is not configured.",
              "ADMIN_API_KEY_NOT_CONFIGURED_EXCEPTION",
              {
                  originalError,
              },
              HttpStatus.INTERNAL_SERVER_ERROR,
          )
      }
  }
  ```

- **Extends một exception khác của nhà cũng bị từ chối.** Base là `AbstractException`, không phải "một
  cái gì đó cuối cùng cũng tới `AbstractException`". Cây thừa kế sâu làm chỗ throw không còn đọc ra
  được thất bại nào đang được ném.

---

## `EXCEPTION-4` — khai báo trong thư mục exceptions

### Case: khai báo lẫn vào file service

```ts
// SAI — cuối một file service
@Injectable()
export class InvoiceService {
    /* ... 200 dòng ... */
}

/** Hoá đơn đã được thanh toán rồi. */
export class InvoiceAlreadySettledException extends AbstractException {
    /* ... */
}
```

Class này chỉ tồn tại với người đã đọc hết file. Nó không xuất hiện ở chỗ ai đó đi tìm "ứng dụng có
thể thất bại theo những cách nào", và nó đi vào production mà không reviewer nào thấy một failure mode
mới **đến**.

```ts
// ĐÚNG — exceptions/errors/invoices/invoice-already-settled.ts
import type {
    AbstractExceptionMetadata,
} from "../abstract"
import {
    AbstractException,
} from "../abstract"

/** Metadata cho {@link InvoiceAlreadySettledException}. */
export interface InvoiceAlreadySettledExceptionMetadata extends AbstractExceptionMetadata {
    /** Id của hoá đơn. */
    invoiceId: string
}

/** Hoá đơn đã ở trạng thái đã thanh toán, không thể thanh toán lần nữa. */
export class InvoiceAlreadySettledException extends AbstractException {
    constructor({
        invoiceId,
        originalError,
    }: InvoiceAlreadySettledExceptionMetadata) {
        super(
            "Invoice has already been settled",
            "INVOICE_ALREADY_SETTLED_EXCEPTION",
            {
                invoiceId,
                originalError,
            },
        )
    }
}
```

```ts
// ĐÚNG — service chỉ import
import {
    InvoiceAlreadySettledException,
} from "@modules/platform/exceptions/errors/invoices/invoice-already-settled"
```

### Case: nhiều ứng dụng trong một repository

```text
apps/
  billing/
    src/exceptions/errors/          <- "billing có thể throw gì" trả lời ở đây
  scheduler/
    src/exceptions/errors/          <- "scheduler có thể throw gì" trả lời ở đây
```

Luật đòi **một chỗ cho mỗi ứng dụng**, không đòi một đường dẫn cố định. Viết một đường dẫn literal vào
luật là viết layout của một repository vào luật — và một rule bắn vào code đúng thì tệ hơn không có
rule, vì người viết tiếp theo học được thói quen cuộn qua nó.

### Case: exception sinh ra trong lane test rồi bị kéo ngược vào product

```ts
// SAI — tests/support/fixtures.ts
export class FixtureNotSeededException extends AbstractException {
    /* ... */
}
```

```ts
// SAI — và đây là chỗ nó thành vấn đề thật
import {
    FixtureNotSeededException,
} from "../../../tests/support/fixtures"
```

Hai vi phạm chồng nhau: khai báo ngoài thư mục exceptions (`EXCEPTION-4`), và một thất bại **của bài
test** được đặt tên bằng từ vựng của sản phẩm (`EXCEPTION-6`).

### Ngoại lệ và nhầm lẫn

- **"Tạm thời để đây, refactor sau"** là cách một exception ở sai chỗ tồn tại lâu nhất. Chi phí di dời
  không giảm theo thời gian, còn số call site thì tăng.
- **Thư mục con theo domain là được khuyến khích**, miễn cả cây vẫn nằm dưới một thư mục exceptions
  duy nhất của ứng dụng — câu hỏi "throw được gì" vẫn có một chỗ để mở ra đọc.

---

## `EXCEPTION-5` — metadata mang thứ người đọc sẽ cần

### Case: id nằm trong câu, hay nằm trong dữ liệu

```ts
// SAI: id đã bị nướng vào tiếng Anh. Muốn lấy lại phải parse.
throw new OrderNotFoundException({
    message: `order ${orderId} was not found`,
})
```

```ts
// ĐÚNG
throw new OrderNotFoundException({
    orderId,
})
```

Message là thứ **sẽ bị sửa lại chữ**. Bất cứ dữ kiện nào chỉ tồn tại trong message đều là dữ kiện sẽ
biến mất trong một lần refactor không ai coi là rủi ro.

### Case: một câu đã render làm payload duy nhất

```ts
// SAI
throw new PayoutRejectedException({
    reason: "Payout was rejected because the destination account is closed",
})
```

```ts
// ĐÚNG
throw new PayoutRejectedException({
    payoutId,
    destinationAccountId,
    destinationState: "closed",
})
```

Bản ĐÚNG cho phép ba người đọc khác nhau hành động: client hiện đúng màn hình, retry policy biết đây
là loại không nên thử lại, alert group theo `destinationState`.

### Case: chuyển trạng thái bị từ chối — mang cả hai đầu

```ts
throw new StateTransitionRejectedException({
    orderId,
    from: order.state,
    to: requestedState,
})
```

Chỉ `from` thôi thì không trả lời được "người dùng vừa cố làm gì". Chỉ `to` thôi thì không trả lời
được "vì sao không được".

### Case: vượt hạn mức — mang cả ngưỡng lẫn giá trị đo được

```ts
throw new RateLimitExceededException({
    clientId,
    limit: policy.limit,
    observed: counter.value,
    windowSeconds: policy.windowSeconds,
})
```

Thiếu `limit` thì không ai biết ngưỡng đang là bao nhiêu mà không mở config; thiếu `observed` thì
không ai biết vượt bao xa, tức là không biết đây là cấu hình sai hay là tấn công.

### Case: bọc lỗi ngoài — giữ nguyên bản gốc

```ts
catch (error) {
    throw new PaymentGatewayUnreachableException({
        gateway: "primary",
        endpoint,
        originalError: error as Error,
    })
}
```

### Ngoại lệ và nhầm lẫn

- **Người đọc metadata hôm nay là log, chưa phải HTTP client.** Filter gửi ra đúng ba trường:

  ```ts
  response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
  })
  ```

  Nên trước khi thêm một trường vì "client cần", hãy kiểm xem client có nhận được nó không. Đây là một
  dữ kiện về hệ thống, không phải một lối thoát khỏi luật: id vẫn phải nằm trong metadata, vì log và
  caller in-process đều đọc nó.

- **Không đưa dữ liệu nhạy cảm vào metadata.** Metadata đi vào log; token, mật khẩu, số thẻ không đi
  vào log. Cần định danh thì mang id, đừng mang bí mật.

  ```ts
  // SAI
  throw new AuthenticationFailedException({
      username,
      password,
  })
  ```

- **`{}` là câu trả lời đúng khi thật sự không có dữ kiện nào** — điển hình là lỗi cấu hình, nơi thứ
  duy nhất cần nói đã nằm trong cái tên.

---

## `EXCEPTION-6` — assertion của test runner không phải lỗi nghiệp vụ

### Case: spec bỏ cuộc vì môi trường

```ts
// một spec: đây là runner bỏ cuộc, không phải thất bại mà sản phẩm sinh ra được
if (!seeded) {
    throw new Error("fixture did not seed - the test cannot continue")
}
```

```ts
// SAI trong product code: đúng dòng đó, nhưng giờ nó mô tả thứ một người dùng chạm tới được.
if (!record) {
    throw new Error("record missing")
}
```

Hai đoạn khác nhau đúng một thứ: có ai **có thể chạm tới** dòng này không.

### Case: chờ tới deadline trong một flow e2e

```ts
const waitFor = async (predicate: () => Promise<boolean>, timeoutMs: number): Promise<void> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (await predicate()) return
        await delay(200)
    }
    throw new Error(`Condition was not met within ${timeoutMs}ms`)
}
```

Không có domain exception nào đúng ở đây. "Điều kiện không xảy ra trong 30 giây" là một sự thật về
**bài test**, không phải một cách mà sản phẩm thất bại.

### Case: bịa một domain exception cho fixture

```ts
// SAI — exceptions/errors/testing/fixture-not-seeded.ts
export class FixtureNotSeededException extends AbstractException {
    /* ... */
}
```

Từ lúc file này tồn tại, danh sách "ứng dụng có thể throw gì" có thêm một dòng mà không người dùng nào
chạm tới được. Người đọc danh sách đó không có cách nào biết dòng nào là thật.

### Case: ranh giới được viết bằng đường dẫn

```js
{
    files: [
        "apps/*/test/**/*.ts",
        "src/tests/**/*.ts",
    ],
    rules: {
        "starci-be/throw-abstract-exception": "off",
    },
}
```

Ranh giới của mã này là **đường dẫn**, và nó được viết hai lần: một lần trong chính rule, một lần
trong config của repository dùng rule. Hai chỗ đó lệch nhau là một finding, không phải một lựa chọn
địa phương.

### Ngoại lệ và nhầm lẫn

- **Product code import helper của test không thừa hưởng lối ra này:**

  ```ts
  // SAI: hàm này sống trong lane test, nhưng lời gọi thì không.
  import {
      waitFor,
  } from "../../tests/support/wait-for"
  ```

- **Một lane test vẫn phải throw domain exception khi nó đang mô phỏng nghiệp vụ.** Lối ra chỉ dành
  cho thất bại **của bài test**: fixture, deadline, stub hết kịch bản. Một stub cố tình trả về lỗi
  nghiệp vụ thì vẫn dùng đúng class của nghiệp vụ đó.

---

## Ánh xạ yêu cầu sang một cách viết

Hãy nêu chỗ throw, file khai báo và người đọc thất bại. Nếu thiếu **một** dữ kiện quyết định, hãy hỏi
**một** câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Báo lỗi khi không tìm thấy bản ghi theo id | Client, retry policy và alert đều cần phân biệt được | `EXCEPTION-1` | `throw new XNotFoundException({ id })` |
| Lỗi này không có gì để kèm theo | Giữ một cách viết duy nhất cho mọi throw | `EXCEPTION-2` | `throw new XException({})` |
| Truyền id và trạng thái vào lỗi | Hình dạng phải lớn lên được | `EXCEPTION-2` | Một object literal, không tham số vị trí |
| Lỗi này cần trả về đúng 401 | Status là trường của base, không phải lý do đổi base | `EXCEPTION-3` | `extends AbstractException`, truyền `httpStatus` |
| Đặt class lỗi cạnh service cho gần | Danh sách failure mode phải đọc được ở một chỗ | `EXCEPTION-4` | File trong thư mục exceptions, service chỉ import |
| Ghi rõ lý do thất bại cho client | Câu văn là thứ sẽ bị sửa chữ | `EXCEPTION-5` | Id và trạng thái vào metadata, câu để ở message |
| Spec cần dừng vì fixture không seed | Đây là runner bỏ cuộc | `EXCEPTION-6` | `throw new Error("...")`, trong lane test |
| Bọc lỗi của thư viện ngoài | Vượt biên ứng dụng thì mang tên ứng dụng | `EXCEPTION-1` + `EXCEPTION-5` | Class của nhà, kèm `originalError` |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `EXCEPTION-1` / `EXCEPTION-3` | Tôi đang kết luận từ chỗ throw hay từ dòng `extends` trong file khai báo? |
| `EXCEPTION-1` / `EXCEPTION-6` | File này nằm trong lane test hay trong product code? |
| `EXCEPTION-2` / `EXCEPTION-5` | Câu hỏi đang là **hình dạng** của tham số, hay **nội dung** của object? |
| `EXCEPTION-3` / `EXCEPTION-4` | Class extends sai base, hay nằm sai thư mục? Hai lỗi này độc lập nhau |
| `EXCEPTION-4` / nhiều app | Câu "ứng dụng này throw được gì" đã có đúng một chỗ trả lời chưa? |
| `EXCEPTION-5` / `exception-identity` | Đang nói về payload đi kèm, hay về chính cái tên và code? |
| `EXCEPTION-6` / `EXCEPTION-1` | Có người dùng nào chạm tới dòng này được không? |

## Sai lầm lặp lại nhiều nhất

1. Kết luận một class là đúng vì **chỗ throw** đọc lên đúng — trong khi bằng chứng nằm ở dòng
   `extends`.
2. Nướng id vào message rồi để metadata rỗng.
3. Dùng exception của framework vì "chỉ cần trả đúng status".
4. Constructor nhận tham số vị trí, rồi thêm trường thứ hai và sửa nhầm một call site.
5. Viết `new XException()` ở một chỗ và `new YException({})` ở chỗ khác, trong cùng một file.
6. Khai báo class lỗi cuối file service "cho gần", rồi không bao giờ dời đi.
7. Bịa một domain exception cho một thất bại chỉ bài test mới gặp.
8. Kéo helper của lane test vào product code, mang theo cả lối ra `throw new Error`.
9. Đưa dữ liệu nhạy cảm vào metadata vì "để debug cho dễ".
