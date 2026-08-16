---
id: be-patterns-module-layering-example
title: example.md
slug: /be/patterns/module-layering/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã LAYERING-N, viết bằng TypeScript/NestJS thuần.
---

# example.md

> Version: `2.00` · Module: `module-layering` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường trong một ứng dụng hình dáng NestJS**. Không tên sản phẩm,
không tên repository, không tên module riêng của ai. Một luật chỉ đúng khi nó đúng ở bất kỳ back end
nào — nên nếu một ví dụ cần tên riêng của một hệ thống cụ thể mới đọc được, ví dụ đó sai chỗ.

Các capability trong ví dụ được đặt tên trung tính: `billing`, `notifications`, `catalog`, `search`.
Các thư mục **chứa** capability (category folder) đặt là `platform/`, `lib/`, `integrations/`,
`databases/`.

Mỗi mã có **nhiều case**, rồi tới **ngoại lệ** và **những thứ trông giống nhưng không phải mã đó**.
Phần cuối trang ánh xạ từ yêu cầu bằng lời sang một đường đi duy nhất.

---

## `LAYERING-1` — specifier chạm tới file

### Case: lấy một service từ capability khác

```ts
// src/features/api/orders/create-order.handler.ts
import {
    InvoiceService,
} from "@modules/billing/invoice.service"
```

```ts
// SAI: dừng lại ở tên capability. Để lấy một symbol, dòng này kéo theo toàn bộ đồ thị import của
// thư mục billing -- và người đọc không còn biết file nào thật sự bị phụ thuộc.
import {
    InvoiceService,
} from "@modules/billing"
```

Hai dòng khác nhau đúng **một** thứ: phụ thuộc là một **file** hay một **thư mục**.

### Case: capability nằm dưới một category folder

```ts
// `platform` chứa capability chứ không phải là capability. Tên capability là đoạn thứ hai
// (`exceptions`), nên đường phải đi sâu thêm mới chạm tới file.
import {
    AbstractException,
} from "@modules/platform/exceptions/errors/abstract"
```

```ts
// SAI: hai đoạn, nhưng vẫn chưa chạm tới file nào. `platform/exceptions` là tên một capability.
import {
    AbstractException,
} from "@modules/platform/exceptions"
```

```ts
// SAI theo cách rõ hơn: một category folder đứng một mình còn chưa gọi tên nổi một capability.
import {
    AbstractException,
} from "@modules/platform"
```

Độ sâu "đã chạm file" **lệch một đoạn** giữa hai loại thư mục. Một rule dùng chung một độ sâu cho cả
hai thì sai **đồng thời theo hai chiều**: nó bỏ sót barrel dưới category folder, và nó tố nhầm những
import đúng ở ngoài.

### Case: `export ... from` cũng là một specifier

```ts
// SAI: re-export bắc cầu vẫn là một cạnh phụ thuộc, và cạnh này dừng ở thư mục.
export * from "@modules/notifications"
```

```ts
// SAI theo dạng có vẻ vô hại hơn: chỉ một symbol, vẫn qua barrel.
export {
    NotificationDispatchService,
} from "@modules/notifications"
```

```ts
// ĐÚNG: bên gọi tự gọi tên file. Không cần dòng re-export nào tồn tại.
import {
    NotificationDispatchService,
} from "@modules/notifications/notification-dispatch.service"
```

Đây là chỗ `LAYERING-1` và `LAYERING-5` gặp nhau: cách sửa đúng nhất cho một re-export sai **không
phải** sửa specifier, mà là **xoá file re-export đi**.

### Ngoại lệ và nhầm lẫn

- **Entry point của package bên ngoài không phải barrel.**

  ```ts
  // ĐÚNG: `@nestjs/common` là bề mặt do chính package công bố. Đi sâu vào trong nó mới là bước qua
  // ranh giới của người khác.
  import {
      Injectable,
  } from "@nestjs/common"
  ```

- **Category folder lồng nhau là chỗ luật đúng còn rule mù.** `lib/native/redis` có `native` là một
  category nằm trong category:

  ```ts
  // Vẫn là barrel theo LUẬT -- specifier dừng ở tên một capability (`redis`) và không chạm file nào.
  import {
      RedisClient,
  } from "@modules/lib/native/redis"
  ```

  Rule chỉ biết một tầng category, nên dòng này **lọt**. Xem `audit.md`, mục "Rủi ro còn mở".

- **Barrel bằng đường tương đối vẫn là barrel.**

  ```ts
  // SAI theo luật. Rule không thấy, vì nó chỉ soi ba alias của repository.
  import {
      PaymentGatewayService,
  } from "./gateways"
  ```

- **Đường dài không phải là mục tiêu.** Mục tiêu là **chạm tới file**. Một capability phẳng thì
  `@modules/search/search-index.service` đã là đường ngắn nhất đúng luật.

---

## `LAYERING-2` — bên trong capability thì đi tương đối

### Case: service gọi service anh em

```ts
// src/modules/billing/invoice.service.ts
import {
    TaxRateService,
} from "./tax-rate.service"
import {
    CurrencyService,
} from "./currency/currency.service"
```

```ts
// SAI: cùng một file đích, nhưng đi vòng qua cửa chính của chính capability này. Alias sinh ra để
// nói "thứ này đến từ nơi khác", và bây giờ nó không còn nói thế nữa.
import {
    TaxRateService,
} from "@modules/billing/tax-rate.service"
```

Hai dòng khác nhau đúng **một** thứ: alias có còn báo hiệu một lần **bước qua ranh giới** hay không.

### Case: module file nạp provider của chính nó

```ts
// src/modules/billing/billing.module.ts
import {
    Module,
} from "@nestjs/common"
import {
    InvoiceService,
} from "./invoice.service"
import {
    TaxRateService,
} from "./tax-rate.service"
import {
    ConfigurableModuleClass,
} from "./billing.module-definition"

@Module({
    providers: [
        InvoiceService,
        TaxRateService,
    ],
    exports: [
        InvoiceService,
        TaxRateService,
    ],
})
/**
 * Billing capability -- invoice issuing and tax resolution.
 */
export class BillingModule extends ConfigurableModuleClass {}
```

```ts
// SAI: module file là chỗ cám dỗ nhất, vì đây đúng là nơi capability tự mô tả mình -- và "tự mô tả"
// rất dễ trượt thành "tự gọi tên qua alias".
import {
    InvoiceService,
} from "@modules/billing/invoice.service"
```

### Case: dưới category folder, cả dạng dài lẫn dạng ngắn đều là "chính mình"

```ts
// src/modules/platform/exceptions/errors/payment-declined.ts
import {
    AbstractException,
} from "../abstract"
```

```ts
// SAI -- dạng dài.
import {
    AbstractException,
} from "@modules/platform/exceptions/errors/abstract"
```

```ts
// SAI -- dạng ngắn. Cùng một capability, chỉ bỏ tên category đi.
import {
    AbstractException,
} from "@modules/exceptions/errors/abstract"
```

Một capability nằm dưới category folder **với tới được bằng hai cách**, nên "chính mình" cũng phải
được hiểu theo cả hai cách. Chỉ chặn một dạng là để ngỏ dạng kia.

### Ngoại lệ và nhầm lẫn

- **Trùng tên nhưng khác capability thì alias là đúng.**

  ```ts
  // src/modules/billing/invoice.service.ts -- `catalog` là capability KHÁC, dù cũng có `price`.
  import {
      PriceLookupService,
  } from "@modules/catalog/price-lookup.service"
  ```

- **Spec đứng cạnh file nó kiểm cũng là bên trong capability.**

  ```ts
  // src/modules/billing/invoice.service.spec.ts
  import {
      InvoiceService,
  } from "./invoice.service"
  ```

- **Module file nhắc lại tên thư mục không phải lỗi.** `billing/billing.module.ts` khai báo
  `BillingModule`; đó là chủ thể, không phải sự lặp thừa. `LAYERING-2` nói về **alias**, không nói về
  từ lặp.

- **`../` vẫn là tương đối.** Đi lên rồi đi xuống trong cùng capability là hợp lệ; điều bị cấm là
  **rời khỏi rồi quay lại qua cửa chính**.

---

## `LAYERING-3` — cạnh bắc ngang nối ở composition root

### Case: hai capability cần biết nhau

```ts
// SAI: src/modules/notifications/notifications.module.ts
// Notifications và billing từ đây không còn khởi động rời nhau được, và quyết định "hai thứ này đi
// cùng nhau" được ghi trong một file mà chủ thể của nó không phải cả hai.
@Module({
    imports: [
        BillingModule,
    ],
    providers: [
        NotificationDispatchService,
    ],
})
export class NotificationsModule {}
```

```ts
// ĐÚNG: apps/<app>/src/app.module.ts -- composition root, nơi công việc CHÍNH LÀ biết ứng dụng gồm gì.
@Module({
    imports: [
        BillingModule.register({
            isGlobal: true,
        }),
        NotificationsModule.register({
            isGlobal: true,
        }),
    ],
})
export class AppModule {}
```

Hai đoạn khác nhau đúng **một** thứ: sau đó còn khởi động được **một** capability một mình hay không.

### Case: cạnh đi xuống — lồng nhau và aggregator vẫn được giữ

```ts
// ĐÚNG: src/modules/billing/billing.module.ts import module CON của chính nó.
import {
    CurrencyModule,
} from "./currency/currency.module"

@Module({
    imports: [
        CurrencyModule.register({
            isGlobal: false,
        }),
    ],
})
export class BillingModule {}
```

```ts
// ĐÚNG: một aggregator gom các module bên dưới rồi export lại. Mọi đường đều tương đối, mọi cạnh đều
// đi xuống.
@Module({
    imports: [
        InvoicesModule,
        SubscriptionsModule,
        RefundsModule,
    ],
    exports: [
        InvoicesModule,
        SubscriptionsModule,
        RefundsModule,
    ],
})
export class BillingModule {}
```

```ts
// SAI: cũng gọi là aggregator, nhưng gom những thứ KHÔNG thuộc capability này. Một cái tên "gom cho
// gọn" không biến ba cạnh ngang thành ba cạnh xuống.
import {
    SearchModule,
} from "@modules/search/search.module"
import {
    CatalogModule,
} from "@modules/catalog/catalog.module"

@Module({
    imports: [
        SearchModule,
        CatalogModule,
    ],
})
export class BillingModule {}
```

Phép thử: module bị import có nằm **bên trong thư mục** của capability đang import không? Có thì
xuống, không thì ngang.

### Case: feature cần một tích hợp dùng chung

```ts
// SAI: mỗi feature tự kéo client về cho mình. Ba feature, ba đăng ký, ba vòng đời khác nhau cho một
// thứ đáng lẽ chỉ có một.
@Module({
    imports: [
        ObjectStorageModule.register({
            isGlobal: true,
        }),
    ],
})
export class ReportsModule {}
```

```ts
// ĐÚNG: root đăng ký một lần, mọi feature nhận cùng một instance.
@Module({
    imports: [
        ObjectStorageModule.register({
            isGlobal: true,
        }),
        ReportsModule,
        ExportsModule,
    ],
})
export class AppModule {}
```

### Ngoại lệ và nhầm lẫn

- **Composition root được miễn theo định nghĩa.** Biết cả hai capability ở đó không phải vi phạm; đó
  là chủ thể của root. Vì vậy `apps/*/src/**` nằm **ngoài** glob thực thi mã này.
- **Một capability tự đặt `isGlobal` cho mình là `LAYERING-4`, không phải `LAYERING-3`.** Không có
  cạnh ngang nào ở đó cả — chỉ có một capability nói thay ứng dụng.
- **Import một `type` từ capability khác không phải cạnh module.** `LAYERING-3` nói về `@Module`;
  một `import type` thuộc `LAYERING-1`.
- **"Nó chỉ là một service nhỏ" không đổi được phân loại.** Kích thước của thứ được import không
  quyết định cạnh đó ngang hay xuống.

---

## `LAYERING-4` — chỉ root biết toàn cảnh

### Case: cùng một capability, hai ứng dụng, hai câu trả lời

```ts
// apps/api/src/app.module.ts -- ứng dụng có tầng GraphQL, nên cần resolver cho quan hệ entity.
@Module({
    imports: [
        PrimaryDatabaseModule.register({
            isGlobal: true,
            withResolvers: true,
        }),
    ],
})
export class AppModule {}
```

```ts
// apps/cli/src/app.module.ts -- cùng capability, không có tầng GraphQL nào để resolve.
@Module({
    imports: [
        PrimaryDatabaseModule.register({
            isGlobal: true,
            withResolvers: false,
        }),
    ],
})
export class AppModule {}
```

Không câu trả lời nào trong hai câu này viết được **bên trong** capability, vì capability không biết
nó đang được khởi động vào ứng dụng nào.

### Case: `isGlobal` là quyết định của ứng dụng

```ts
// SAI: src/modules/notifications/notifications.module.ts
// Capability tự tuyên bố mình phải nhìn thấy được ở mọi nơi -- thay mặt cho một ứng dụng mà nó chưa
// từng gặp.
@Module({})
export class NotificationsModule {
    static register(): DynamicModule {
        return {
            module: NotificationsModule,
            global: true,
        }
    }
}
```

```ts
// ĐÚNG: capability nhận `isGlobal` như một tuỳ chọn; root là nơi trả lời.
NotificationsModule.register({
    isGlobal: true,
})
```

### Case: thứ tự khởi động

```ts
// SAI: một capability tự lo cho thứ tự của cả ứng dụng. Từ đây capability này không còn được nạp
// riêng lẻ để dò lỗi nữa, mà dò lỗi riêng lẻ là việc đầu tiên người ta muốn làm khi có sự cố.
import "@modules/integrations/tracing/instrument"

@Module({})
export class CatalogModule {}
```

```ts
// ĐÚNG: apps/<app>/src/main.ts -- dòng đầu tiên của file, kèm lý do.
// Tracing phải khởi tạo trước khi bất kỳ symbol tracing nào khác được nạp; import module Nest sẽ
// kéo những symbol đó vào quá sớm.
import "@modules/integrations/tracing/instrument"
import {
    NestFactory,
} from "@nestjs/core"
import {
    AppModule,
} from "./app.module"
```

### Case: root ghi lại cái nó cố tình KHÔNG kéo theo

```ts
/**
 * CLI composition root -- chỉ những gì các subcommand thật sự cần.
 * `PrimaryDatabaseModule` có mặt vì một subcommand đọc entity manager;
 * `withResolvers: false` vì ở đây không có tầng GraphQL nào.
 * Không kéo theo bộ seeder/bootstrap: chúng thuộc về ứng dụng chạy nền, không thuộc CLI.
 */
export class AppModule {}
```

Đoạn văn này chỉ viết được ở root. Bên trong một capability không tồn tại cái "ứng dụng nào" để nó
nói về.

### Ngoại lệ và nhầm lẫn

- **Cấu hình per-instance không phải kiến thức toàn cảnh.** Một module cần tham số **riêng cho chỗ
  này** thì tham số đó đi cùng chỗ đó; cái phải lên root là câu hỏi "ai được nhìn thấy nó".
- **`LAYERING-4` hỏng được một mình.** Không cần capability thứ hai nào tham gia: chỉ cần một
  capability giấu kiến thức thứ tự trong ruột là nó đã không tự khởi động được. Đó là lý do đây là
  mã riêng chứ không phải một câu trong `LAYERING-3`.

---

## `LAYERING-5` — bề mặt là những file có ý định cho người khác import

### Case: barrel và cách sửa

```ts
// SAI: src/modules/billing/index.ts
export * from "./invoice.service"
export * from "./tax-rate.service"
export * from "./currency/currency.service"
export * from "./types/invoice"
```

```ts
// ĐÚNG: không có file nào như trên tồn tại. Bên gọi tự gọi tên file nó cần.
import {
    InvoiceService,
} from "@modules/billing/invoice.service"
```

Bề mặt bây giờ đọc được ở **import list của những nơi gọi**, nên một phụ thuộc nhầm hiện ra dưới dạng
một dòng import **trông lạ**. Khi bề mặt nằm trong barrel, phụ thuộc nhầm chỉ là thêm một cái tên vào
một danh sách dài — và danh sách dài thì không ai đọc.

### Case: đổi tên không đổi bản chất

```ts
// SAI: src/modules/catalog/public-api.ts
// Gọi là "public API" thì nghe có chủ đích hơn, nhưng nó vẫn re-export cả thư mục, và mọi file thêm
// vào sau này vẫn tự động rộng thêm bề mặt mà không ai quyết định.
export * from "./product.service"
export * from "./category.service"
export * from "./variant.service"
```

```ts
// SAI ở dạng khó thấy nhất: chỉ một dòng, và nó "tiện".
export {
    ProductService,
} from "./product.service"
```

### Case: cái gì KHÔNG phải barrel

```ts
// ĐÚNG: src/modules/billing/constants/credit-cost.ts
// Một file khai báo giá trị của chính nó. Nó không re-export thư mục nào; nó LÀ nơi symbol được khai
// báo, nên gọi tên nó chính là gọi tên file khai báo.
export const CREDIT_COST_PER_INVOICE = 3
export const CREDIT_COST_PER_REFUND = 1
```

```ts
// ĐÚNG: src/modules/billing/types/invoice.ts -- cùng lý do, cho type.
export interface InvoiceDraft {
    amount: number
    currency: string
}
```

Phép thử phân biệt: file này **khai báo** symbol, hay chỉ **chuyển tiếp** symbol của file khác?

### Case: bề mặt đọc ở call site

```ts
// apps/<app>/src/app.module.ts
import {
    BillingModule,
} from "@modules/billing/billing.module"
```

```ts
// src/features/api/orders/create-order.handler.ts
import {
    InvoiceService,
} from "@modules/billing/invoice.service"
```

Hai dòng này **là** tài liệu bề mặt của capability `billing`: một module cho root, một service cho
người gọi. Không có file thứ ba nào phải được viết ra để nói điều đó.

### Ngoại lệ và nhầm lẫn

- **"Import cho gọn" là lý do duy nhất người ta dựng barrel** — và cũng là lý do duy nhất luật này
  phải viết ra. Cái giá của "gọn" là đồ thị import không còn đọc được.
- **Một thư mục util nhiều hàm nhỏ vẫn không được gom.** Mỗi hàm là một file, mỗi call site gọi tên
  file nó dùng.
- **Xoá barrel là một thay đổi có thật, không phải dọn dẹp.** Nó buộc mọi call site phải nói ra thứ
  chúng vốn đã phụ thuộc vào — và số đó thường lớn hơn dự đoán. Đó là bằng chứng cho luật, không phải
  lý lẽ chống lại nó.
- **Không có barrel thì specifier dạng barrel còn không resolve được.** Khi `paths` chỉ map
  `@modules/*` và trong thư mục không có `index.ts`, `@modules/billing` không trỏ tới file nào cả.
  Sự **vắng mặt** là thứ giữ luật, không phải cái mapping.

---

## Ánh xạ yêu cầu sang một đường đi

Nêu file đang viết, specifier định dùng và loại cạnh. Nếu thiếu **một** dữ kiện quyết định, hỏi
**một** câu cụ thể rồi dừng. Câu trả lời phải là một đường đi hoặc một câu hỏi — không bao giờ cả hai.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Lấy service phát hoá đơn dùng ở handler đặt hàng | Cạnh vào, capability khác | `LAYERING-1` | `@modules/billing/invoice.service` |
| Lấy exception class dùng chung ở tầng nền | Capability nằm dưới category folder | `LAYERING-1` | `@modules/platform/exceptions/errors/abstract` |
| Trong service phát hoá đơn, dùng service tính thuế cùng thư mục | Cạnh nội bộ | `LAYERING-2` | `./tax-rate.service` |
| Trong một exception con, kế thừa lớp trừu tượng cùng capability | Nội bộ, dưới category folder, cả hai dạng alias đều là self | `LAYERING-2` | `../abstract` |
| Notifications cần billing | Cạnh ngang giữa hai capability | `LAYERING-3` | Đăng ký cả hai ở `apps/<app>/src/app.module.ts` |
| Billing cần module tiền tệ nằm trong chính nó | Cạnh xuống | `LAYERING-3`, ngoại lệ | `./currency/currency.module`, giữ nguyên |
| Cho module này nhìn thấy được ở mọi nơi | Câu hỏi thuộc về ứng dụng | `LAYERING-4` | `isGlobal` truyền từ root, không đặt trong capability |
| Thứ này phải khởi tạo trước mọi thứ khác | Kiến thức toàn cảnh | `LAYERING-4` | Dòng đầu của `main.ts` ở root |
| Gom export của capability lại cho gọn | Bề mặt phải đọc ở call site | `LAYERING-5` | Không tạo file gom; giữ nguyên |
| Đặt tên `public-api.ts` thay cho `index.ts` | Vẫn chuyển tiếp cả thư mục | `LAYERING-5` | Không tạo; xoá nếu đã có |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `LAYERING-1` / `LAYERING-2` | Specifier dừng ở đâu, hay specifier **có được phép là alias** không? |
| `LAYERING-1` / `LAYERING-5` | Lỗi nằm ở dòng của bên gọi, hay nằm ở file mà bên bị gọi đã dựng sẵn? |
| `LAYERING-2` / `LAYERING-3` | Đang nói về một specifier trong một file, hay về một cạnh giữa hai `@Module`? |
| `LAYERING-3` cạnh ngang / cạnh xuống | Module bị import có nằm **bên trong thư mục** của capability đang import không? |
| `LAYERING-3` / `LAYERING-4` | Có hai capability dính vào nhau, hay chỉ có **một** capability đang nói thay ứng dụng? |
| `LAYERING-4` / `LAYERING-5` | Dữ kiện này nói về **toàn cảnh ứng dụng**, hay nói về **bề mặt của một capability**? |
| Capability / category folder | Đoạn này **là** một capability, hay nó **chứa** các capability? |

## Sai lầm lặp lại nhiều nhất

1. Dừng specifier ở tên capability vì "trông gọn hơn".
2. Đếm sai một đoạn dưới category folder, rồi kết luận một import đúng là sai (hoặc ngược lại).
3. Dùng alias công khai cho file **cùng capability**, thường là trong chính module file.
4. Nối cạnh ngang trong `@Module` của một capability thay vì ở root.
5. Nhầm cạnh **xuống** thành cạnh ngang, rồi đi "sửa" một aggregator vốn đúng.
6. Để capability tự tuyên bố `isGlobal` hoặc tự lo thứ tự khởi động.
7. Dựng barrel, rồi đổi tên nó thành `public-api.ts` và coi như đã xử lý.
8. Coi việc xoá barrel là dọn dẹp, trong khi nó là một thay đổi làm lộ ra những phụ thuộc chưa từng
   được khai báo.
