---
id: be-lints-module-layering-example
title: example.md
slug: /be/lints/module-layering/example
sidebar_label: example.md
sidebar_position: 2
description: Mã bắn quy tắc, mã không bắn, và mã đi lọt — từng trường hợp một.
---

# example.md

> Version: `2.00` · Mô-đun: `module-layering`

Mỗi mục dưới đây là một quy tắc có thật trong nguồn. **SAI** là mã làm quy tắc bắn. **ĐÚNG** là mã
không làm nó bắn. Mục **Cửa lách và nhầm lẫn** ở cuối mỗi quy tắc là mã **đi lọt** — không phải mã
được phép, mà là mã quy tắc không nhìn thấy.

Cây thư mục dùng chung cho mọi ví dụ:

```text
src/
  modules/
    ai/
      ai-invoke.service.ts
      ai-entitlement.service.ts
      services/
        index.ts
    billing/
      billing.service.ts
    platform/
      exceptions/
        errors/
          abstract.ts
      config/
        config.service.ts
  features/
    checkout/
      checkout.context.ts
      steps/
        payment.step.ts
  tests/
    fixtures/
      user.fixture.ts
  app.module.ts
```

---

## `must-deep-module-import`

### Trường hợp: năng lực thường, gọi tên tệp

**SAI** — gọi tên một năng lực và không tệp nào. Một đoạn sau tiền tố, `barrelDepth` là `1`, quy tắc
báo `barrel`.

```ts
import {
    AiInvokeService,
} from "@modules/ai"
```

**ĐÚNG** — hai đoạn. Người đọc biết ngay phụ thuộc vào **tệp** nào.

```ts
import {
    AiInvokeService,
} from "@modules/ai/ai-invoke.service"
```

### Trường hợp: tái xuất

Tái xuất cũng là import, và một `export * from` một barrel là cách nhanh nhất để biến năng lực của
mình thành barrel tiếp theo. Cả hai dạng tái xuất đều được thăm.

**SAI**

```ts
export * from "@modules/billing"
```

**SAI** — dạng có tên, cùng một chỗ báo.

```ts
export {
    BillingService,
} from "@modules/billing"
```

**ĐÚNG**

```ts
export {
    BillingService,
} from "@modules/billing/billing.service"
```

### Trường hợp: thư mục nhóm

`platform`, `lib`, `integrations` là chỗ **chứa** năng lực chứ không phải một năng lực. Dưới chúng
tên năng lực là đoạn **thứ hai**, nên `barrelDepth` thành `2`.

**SAI** — hai đoạn nhưng vẫn là barrel: `exceptions` mới là tên năng lực, và sau nó không còn gì.

```ts
import {
    AbstractException,
} from "@modules/platform/exceptions"
```

**SAI** — chỉ mỗi tên thư mục nhóm, một đoạn, càng là barrel.

```ts
import {
    AbstractException,
} from "@modules/platform"
```

**ĐÚNG** — bốn đoạn, gọi thẳng tệp khai báo.

```ts
import {
    AbstractException,
} from "@modules/platform/exceptions/errors/abstract"
```

### Trường hợp: import chỉ để lấy tác dụng phụ

Specifier được đọc từ `node.source`, không phải từ danh sách ký hiệu. Không có ký hiệu nào cũng bị
báo y như có mười ký hiệu.

**SAI**

```ts
import "@modules/telemetry"
```

**ĐÚNG**

```ts
import "@modules/telemetry/telemetry.register"
```

### Trường hợp: import chỉ lấy kiểu

Lane kiểu không phải cửa sau. `importKind` không bao giờ được hỏi tới, nên `import type` vẫn là một
`ImportDeclaration`.

**SAI**

```ts
import type {
    CheckoutContext,
} from "@features/checkout"
```

**ĐÚNG**

```ts
import type {
    CheckoutContext,
} from "@features/checkout/checkout.context"
```

### Trường hợp: ba alias, không phải một

`@tests/` cũng nằm trong danh sách, với cùng một `barrelDepth` bằng `1`.

**SAI**

```ts
import {
    userFixture,
} from "@tests/fixtures"
```

**ĐÚNG**

```ts
import {
    userFixture,
} from "@tests/fixtures/user.fixture"
```

### Cửa lách và nhầm lẫn

Mọi đoạn mã dưới đây **quy tắc không báo**. Không đoạn nào là cách viết được phép; chúng là những
chỗ máy không nhìn tới.

**Đi lọt** — gọi thẳng tên tệp barrel. Hai đoạn, thắng `barrelDepth` bằng `1`. Đây là đường đi lọt
sạch sẽ nhất qua chính quy tắc sinh ra để cấm barrel.

```ts
import {
    AiInvokeService,
} from "@modules/ai/index"
```

**Đi lọt** — barrel lồng một tầng. `services/` có `index.ts`, nhưng quy tắc đếm số đoạn chứ không
phân giải gì cả, nên một thư mục và một tệp là như nhau với nó.

```ts
import {
    AiInvokeService,
} from "@modules/ai/services"
```

**Đi lọt** — dấu gạch chéo cuối. Tách ra `["ai", ""]`, đủ hai đoạn; đoạn rỗng không bao giờ được
kiểm, còn bộ phân giải thì gộp nó lại thành đúng thư mục cũ.

```ts
import {
    AiInvokeService,
} from "@modules/ai/"
```

**Đi lọt** — đoạn thừa `""` và `"."`. Cùng một phép đếm, và cùng cách viết này cũng đi lọt
`no-self-module-alias`.

```ts
import { AiInvokeService } from "@modules//ai"
import { AiInvokeService } from "@modules/./ai"
```

**Đi lọt** — mọi dạng động. `ImportExpression`, `CallExpression`, `TSImportEqualsDeclaration`; không
nút nào được thăm.

```ts
const { AiInvokeService } = await import("@modules/ai")
const billing = require("@modules/billing")
import telemetry = require("@modules/telemetry")
```

**Đi lọt** — barrel gọi bằng đường tương đối. Mọi phép kiểm bắt đầu bằng `startsWith` một tiền tố
alias; đường tương đối không có tiền tố nào, nên quy tắc thoát ở dòng đầu tiên.

```ts
import {
    AiInvokeService,
} from "../../ai"
```

**Đi lọt** — alias thứ tư. `ALIASES` là ba chuỗi viết tay; thêm một đường ánh xạ vào cấu hình biên
dịch là có ngay một cây không được cưỡng chế, im lặng.

```ts
import { formatMoney } from "@shared/utils"
import { AiInvokeService } from "src/modules/ai"
```

**Đi lọt** — thư mục nhóm thứ tư. `META_ROOTS` cũng là ba tên viết tay, nên `adapters` đọc thành một
năng lực và `mailer` đọc thành tệp của nó.

```ts
import {
    MailerService,
} from "@modules/adapters/mailer"
```

**Đi lọt** — nhận biết thư mục nhóm chỉ thuộc về `@modules/`. Dưới `@features/` và `@tests/`, một
thư mục nhóm bị coi là năng lực nên barrel dưới nó qua được.

```ts
import {
    BillingPanel,
} from "@features/platform/billing"
```

---

## `no-self-module-alias`

Mọi ví dụ trong mục này đứng ở một tệp cụ thể; **đường dẫn của tệp đang import quyết định quy tắc
nhìn thấy gì**, nên nó được ghi ngay trên mỗi khối.

### Trường hợp: anh em trong cùng một năng lực

**SAI** — trong `src/modules/ai/ai-invoke.service.ts`. Khoá tự thân là `["ai"]`, phần còn lại
`"ai/ai-entitlement.service"` khớp `key + "/"`.

```ts
// src/modules/ai/ai-invoke.service.ts
import {
    AiEntitlementService,
} from "@modules/ai/ai-entitlement.service"
```

**ĐÚNG** — cùng tệp đó, cùng ký hiệu đó, đường tương đối.

```ts
// src/modules/ai/ai-invoke.service.ts
import {
    AiEntitlementService,
} from "./ai-entitlement.service"
```

### Trường hợp: đúng chính năng lực, không kèm tệp

**SAI** — trong `src/modules/ai/`. Phần còn lại `"ai"` khớp `key` nguyên vẹn. Dòng này bị **hai** quy
tắc báo cùng lúc: `barrel` vì không có tệp, và `self` vì trỏ về chính mình.

```ts
// src/modules/ai/ai-invoke.service.ts
import {
    AiEntitlementService,
} from "@modules/ai"
```

**ĐÚNG**

```ts
// src/modules/ai/ai-invoke.service.ts
import {
    AiEntitlementService,
} from "./ai-entitlement.service"
```

### Trường hợp: năng lực dưới thư mục nhóm, hai khoá

Một tệp trong `src/modules/platform/exceptions/` gọi được bằng cả đường dài lẫn đường ngắn, nên khoá
tự thân là `["platform/exceptions", "exceptions"]` và **cả hai** đều là chính nó.

**SAI** — đường dài.

```ts
// src/modules/platform/exceptions/errors/not-found.ts
import {
    AbstractException,
} from "@modules/platform/exceptions/errors/abstract"
```

**SAI** — đường ngắn, cùng một tệp đích.

```ts
// src/modules/platform/exceptions/errors/not-found.ts
import {
    AbstractException,
} from "@modules/exceptions/errors/abstract"
```

**ĐÚNG**

```ts
// src/modules/platform/exceptions/errors/not-found.ts
import {
    AbstractException,
} from "./abstract"
```

### Trường hợp: tái xuất trong chính năng lực

**SAI**

```ts
// src/features/checkout/checkout.context.ts
export * from "@features/checkout/steps/payment.step"
```

**ĐÚNG**

```ts
// src/features/checkout/checkout.context.ts
export * from "./steps/payment.step"
```

### Trường hợp: alias dùng đúng chỗ của nó

**ĐÚNG** — trong `modules/ai/`, gọi sang một năng lực **khác** bằng alias. Đây chính là việc alias
sinh ra để làm, và quy tắc không có gì để nói.

```ts
// src/modules/ai/ai-invoke.service.ts
import {
    BillingService,
} from "@modules/billing/billing.service"
```

**ĐÚNG** — tên năng lực khác chỉ *bắt đầu giống*. Phép thử là `rest === key` hoặc
`rest.startsWith(key + "/")`, và dấu gạch chéo làm ranh giới thành thật.

```ts
// src/modules/ai/ai-invoke.service.ts
import {
    AiBillingService,
} from "@modules/ai-billing/ai-billing.service"
```

### Cửa lách và nhầm lẫn

**Đi lọt** — đoạn thừa. `"/ai/..."` và `"./ai/..."` không khớp `key` cũng không khớp `key + "/"`.

```ts
// src/modules/ai/ai-invoke.service.ts
import { AiEntitlementService } from "@modules//ai/ai-entitlement.service"
import { AiEntitlementService } from "@modules/./ai/ai-entitlement.service"
```

**Đi lọt** — dạng động, y như quy tắc trên.

```ts
// src/modules/ai/ai-invoke.service.ts
const { AiEntitlementService } = await import("@modules/ai/ai-entitlement.service")
```

**Đi lọt, và là mặt trái tệ nhất** — với **vào** một năng lực khác bằng đường tương đối. Không có
alias nào để báo, nên cặp quy tắc im lặng trước đúng cái cách viết giấu đường nối kỹ nhất. Đây là mã
sai theo luật, và không quy tắc nào ở đây thấy nó.

```ts
// src/modules/ai/ai-invoke.service.ts
import {
    BillingService,
} from "../billing/billing.service"
```

**Đi lọt** — cây năng lực không nằm dưới đúng cặp đoạn `/src/modules/`. `selfAliases` trả `null`,
quy tắc trả bộ thăm rỗng, cả tệp **không được kiểm** chứ không phải kiểm một nửa.

```ts
// apps/api/modules/ai/ai-invoke.service.ts
import {
    AiEntitlementService,
} from "@modules/ai/ai-entitlement.service"
```

**Đi lọt** — tệp viết thẳng trong thư mục nhóm. Khoá tự thân thành
`["platform/config.service.ts", "config.service.ts"]`: tên tệp nằm ở chỗ đáng lẽ là tên năng lực. Vì
không specifier nào mang đuôi `.ts`, quy tắc tắt hẳn với tệp đó trong khi trông vẫn như đang bật.

```ts
// src/modules/platform/config.service.ts
import {
    ConfigLoader,
} from "@modules/platform/config.service"
```

**Cửa mở ngược — quy tắc bắn vào mã đúng.** Giả sử tồn tại đồng thời `modules/platform/exceptions/`
và một năng lực **khác hẳn** tên `modules/exceptions/`. Khoá ngắn không mang tên nhóm, nên dòng dưới
đây bị báo `self` dù nó vượt một ranh giới có thật.

```ts
// src/modules/platform/exceptions/errors/not-found.ts
import {
    ExceptionReporter,
} from "@modules/exceptions/exception-reporter.service"
```

**Đi lọt** — tự trỏ đi vòng qua một tệp thứ ba. Đọc riêng thì hai dòng đều đúng; không quy tắc
một-tệp nào thấy được vòng lặp.

```ts
// src/modules/billing/billing-reexport.ts
export { AiEntitlementService } from "@modules/ai/ai-entitlement.service"

// src/modules/ai/ai-invoke.service.ts
import { AiEntitlementService } from "@modules/billing/billing-reexport"
```

---

## Ánh xạ yêu cầu sang quy tắc

| Yêu cầu nghe được | Quy tắc trả lời | Trả lời được tới đâu |
|---|---|---|
| "Cấm import barrel" | `must-deep-module-import` | Chỉ ở **chỗ gọi**, và chỉ qua ba alias. Viết ra một barrel không bị cấm |
| "Import phải gọi tên tệp" | `must-deep-module-import` | Thực chất là "phải có ít nhất một đoạn sau tên năng lực". `@modules/ai/services` qua được |
| "Trong một năng lực thì dùng đường tương đối" | `no-self-module-alias` | Chỉ khi tệp nằm đúng dưới `/src/modules/`, `/src/features/` hoặc `/src/tests/` |
| "Cấm năng lực này với sang năng lực kia" | *không quy tắc nào* | `LAYERING-3`, cần đồ thị mô-đun; phải viết thành cổng duyệt cây |
| "Chỉ composition root biết toàn cục" | *không quy tắc nào* | `LAYERING-4` |
| "Không được có `index.ts` tái xuất cả thư mục" | *không quy tắc nào* | `LAYERING-5` nửa khai báo |
| "Cấm với vào ruột năng lực khác bằng `../`" | *không quy tắc nào* | Không có alias thì không có gì để so |

## Bảng phân định ranh giới

| Cách viết | `must-deep-module-import` | `no-self-module-alias` | Ghi chú |
|---|---|---|---|
| `@modules/ai` từ ngoài `ai` | báo | im | Barrel |
| `@modules/ai` từ trong `ai` | báo | báo | Hai quy tắc độc lập cùng đúng ở một dòng |
| `@modules/ai/ai-invoke.service` từ ngoài | im | im | Cách viết đích |
| `@modules/ai/ai-invoke.service` từ trong `ai` | im | báo | Đúng hình dạng, sai cửa |
| `@modules/ai/index` | im | im nếu ở ngoài | Đếm đoạn, không phân giải tệp |
| `@modules/ai/` | im | im | Đoạn rỗng vẫn là một đoạn |
| `@modules/platform/exceptions` | báo | tuỳ tệp | Thư mục nhóm nâng ngưỡng lên `2` |
| `@modules/platform/config/config.service` | im | báo nếu ở trong `platform/config` | Hai khoá dài và ngắn |
| `@features/platform/billing` | im | có thể báo nhầm | Nhận biết thư mục nhóm chỉ có ở `@modules/` |
| `../../ai` | im | im | Không alias thì không có gì để so |
| `await import("@modules/ai")` | im | im | Không phải `ImportDeclaration` |
| `export * from "@modules/ai"` | báo | tuỳ tệp | Tái xuất được thăm đầy đủ |
| `export { X }` không có nguồn | im | im | Không phải một lần import |

## Sai lầm lặp lại nhiều nhất

1. **Đọc `must-deep-module-import` thành "đã cấm barrel".** Nó cấm **với tới** barrel qua alias. Tệp
   barrel vẫn viết ra được, và một khi có rồi thì mọi đường tương đối tới nó đều hợp lệ.
2. **Tưởng đoạn cuối của specifier là một tệp.** Quy tắc không phân giải gì cả. `services`, `index`
   và một đoạn rỗng đều đếm bằng đúng một đoạn như `ai-invoke.service`.
3. **Thêm một alias vào cấu hình biên dịch rồi tưởng nó được giữ.** Danh sách alias nằm trong nguồn
   quy tắc, không nằm trong cấu hình dự án, và `schema: []` nghĩa là không có chỗ nào để khai báo
   thêm.
4. **Đổi chỗ cây năng lực rồi tưởng `no-self-module-alias` vẫn chạy.** Không thấy root thì bộ thăm
   rỗng: không lỗi, không cảnh báo, không dấu vết. Đúng cái hình dạng của một cổng đã tắt.
5. **Sửa một báo `self` bằng cách đổi sang đường dài hơn.** `@modules/exceptions/...` và
   `@modules/platform/exceptions/...` đều là chính nó; cách sửa duy nhất là đường tương đối.
6. **Coi việc quy tắc im lặng là bằng chứng.** Với cả hai quy tắc, "im lặng" gồm cả trường hợp
   *không nhìn tới*: dạng động, đường tương đối, alias lạ, cây thư mục lạ.
7. **Tưởng `LAYERING-3` bị bỏ quên.** Nó bị bỏ ra có chủ ý và nguồn nói rõ lý do. Viết nó thành một
   quy tắc đọc từng tệp rồi đoán là làm hỏng đúng thứ khiến hai quy tắc này để được ở mức `error`.
