---
id: be-lints-cdc-example
title: example.md
slug: /be/lints/cdc/example
sidebar_label: example.md
sidebar_position: 2
description: Ví dụ bị báo lỗi, không bị báo lỗi và lọt qua quy tắc CDC.
---

# example.md

> Version: `2.00` · Mô-đun: `cdc` · Luật: [`INDEX.md`](./INDEX.md) · Từng quy tắc: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mục dưới đây trình bày **một quy tắc**, với nhiều cặp **SAI** (quy tắc báo lỗi) và **ĐÚNG** (quy tắc không báo), rồi tới
**Cửa lách và nhầm lẫn** — nơi chứa code **lọt qua được**.

Đọc kỹ nhãn ở mục cuối: code trong đó **không phải code được phép viết**. Nó là code **vi phạm luật mà
quy tắc không thấy**. Luật vẫn cấm; chỉ là máy không bắt được.

Tên tệp được ghi ngay trên mỗi khối, vì **tên tệp là toàn bộ điều kiện tồn tại của quy tắc này**.

---

## `projection-listener-contract`

Quy tắc chỉ sống trong tệp có đường dẫn kết thúc bằng `projection.listener.ts`, trừ đúng một tệp lớp
cơ sở. Trong tệp đó, nó thăm **mọi** `ClassDeclaration` và chạy ba phép kiểm độc lập.

### Cặp 1 — không kế thừa lớp cơ sở

**SAI** — `projections/order-totals/order-totals-projection.listener.ts`

```ts
@Injectable()
export class OrderTotalsProjectionListener implements OnModuleInit {
    constructor(
        private readonly kafkaService: KafkaService,
        private readonly orderTotalsProjectionService: OrderTotalsProjectionService,
    ) {}

    async onModuleInit(): Promise<void> {
        const { consumer } = await this.kafkaService.createConsumer({ groupId: "order-totals" })
        await consumer.subscribe({ topics: ["primary.public.orders"], fromBeginning: false })
        await consumer.run({ eachMessage: (payload) => this.handle(payload) })
    }
}
```

Sáu báo cáo trong một lượt: `base` tại tên lớp, bốn `member` cho `groupId`, `topics`, `deriveTargets`,
`recomputeTarget`, và `lifecycle` tại khoá `onModuleInit`. Tệp này biên dịch sạch và chạy được — đó
chính là lý do cần có máy kiểm tra.

**ĐÚNG** — cùng tệp

```ts
@Injectable()
export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
    protected readonly groupId = "order-totals-projection"

    protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}orders`]

    constructor(
        kafkaService: KafkaService,
        winstonService: WinstonService,
        private readonly orderTotalsProjectionService: OrderTotalsProjectionService,
    ) {
        super(kafkaService, winstonService)
    }

    protected deriveTargets({ row }: ProjectionCdcMessage): Array<string> {
        const orderRow = row as OrderCdcRow
        return orderRow.customer_id ? [orderRow.customer_id] : []
    }

    protected async recomputeTarget(customerId: string): Promise<void> {
        await this.orderTotalsProjectionService.recompute({ customerId })
    }
}
```

Khác nhau đúng một chuyện: hợp đồng giao nhận nằm ở một chỗ hay ở mười chỗ.

### Cặp 2 — kế thừa đúng nhưng thiếu tên

**SAI** — `projections/invoice-totals/invoice-totals-projection.listener.ts`

```ts
export class InvoiceTotalsProjectionListener extends AbstractProjectionListener<string> {
    protected deriveTargets({ row }: ProjectionCdcMessage): Array<string> {
        return (row as InvoiceCdcRow).account_id ? [(row as InvoiceCdcRow).account_id] : []
    }

    protected async recomputeTarget(accountId: string): Promise<void> {
        await this.invoiceTotalsProjectionService.recompute({ accountId })
    }
}
```

Hai báo cáo `member`, cùng đặt tại tên lớp: thiếu `groupId`, thiếu `topics`. Ở đây trình biên dịch cũng
đã đòi, vì hai thành viên đó là trừu tượng ở lớp cơ sở — quy tắc chỉ nói lại. Giá trị thật của phép
kiểm `member` nằm ở Cặp 1, nơi lớp **không** kế thừa gì và trình biên dịch im lặng.

**ĐÚNG** — cùng tệp

```ts
export class InvoiceTotalsProjectionListener extends AbstractProjectionListener<string> {
    protected readonly groupId = "invoice-totals-projection"

    protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}invoices`]

    protected deriveTargets({ row }: ProjectionCdcMessage): Array<string> {
        const invoiceRow = row as InvoiceCdcRow
        return invoiceRow.account_id ? [invoiceRow.account_id] : []
    }

    protected async recomputeTarget(accountId: string): Promise<void> {
        await this.invoiceTotalsProjectionService.recompute({ accountId })
    }
}
```

### Cặp 3 — kế thừa đúng nhưng vẫn giành lấy vòng đời

**SAI** — `projections/order-totals/order-totals-projection.listener.ts`

```ts
export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
    protected readonly groupId = "order-totals-projection"
    protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}orders`]

    // "chỉ ghi thêm một dòng nhật ký lúc khởi động thôi"
    override async onModuleInit(): Promise<void> {
        this.winstonService.log(WinstonLog.CdcListenerSubscribed, { op: "order-totals.boot" })
    }

    protected deriveTargets(): Array<string> { return [] }
    protected async recomputeTarget(): Promise<void> {}
}
```

Một báo cáo `lifecycle` tại khoá `onModuleInit`. Đây là hỏng hóc im lặng nhất trong cả luật: cái móc
của lớp cơ sở bị che, không có đăng ký chủ đề nào diễn ra, không có ngoại lệ nào ném ra, và projection
đứng yên vĩnh viễn.

**ĐÚNG** — cùng tệp

```ts
export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
    protected readonly groupId = "order-totals-projection"
    protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}orders`]

    protected deriveTargets({ row }: ProjectionCdcMessage): Array<string> {
        const orderRow = row as OrderCdcRow
        return orderRow.customer_id ? [orderRow.customer_id] : []
    }

    protected async recomputeTarget(customerId: string): Promise<void> {
        await this.orderTotalsProjectionService.recompute({ customerId })
    }
}
```

### Cặp 4 — loại thành viên không quan trọng, cái tên mới quan trọng

**ĐÚNG** — `projections/order-totals/order-totals-projection.listener.ts`

```ts
export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
    // getter thay cho trường: phép quét đọc `key.name`, không đọc loại nút
    protected get groupId(): string { return "order-totals-projection" }

    protected get topics(): Array<string> { return [`${envConfig().kafka.cdcTopicPrefix}orders`] }

    protected deriveTargets(): Array<string> { return [] }
    protected async recomputeTarget(): Promise<void> {}
}
```

**ĐÚNG** — cùng tệp, khoá dạng chuỗi

```ts
export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
    // `key.value` được đọc khi không có `key.name`
    protected readonly "groupId" = "order-totals-projection"
    protected readonly ["topics"] = [`${envConfig().kafka.cdcTopicPrefix}orders`]

    protected deriveTargets(): Array<string> { return [] }
    protected async recomputeTarget(): Promise<void> {}
}
```

**SAI** — cùng tệp, khoá tính toán bằng hằng số

```ts
const GROUP_ID_KEY = "groupId"

export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
    protected readonly [GROUP_ID_KEY] = "order-totals-projection"
    protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}orders`]

    protected deriveTargets(): Array<string> { return [] }
    protected async recomputeTarget(): Promise<void> {}
}
```

Báo `member` cho `groupId`. Khoá tính toán bằng một định danh cho ra `key.name === "GROUP_ID_KEY"`,
không phải `"groupId"` — quy tắc kết luận là thiếu. Đây là **báo cáo sai**, và nó nằm ở đây vì báo cáo
sai là thứ dạy người ta tắt quy tắc.

### Cặp 5 — hàm dựng nhận tham số thuộc tính

**SAI** — `projections/session-counts/session-counts-projection.listener.ts`

```ts
export class SessionCountsProjectionListener extends AbstractProjectionListener<string> {
    constructor(
        kafkaService: KafkaService,
        winstonService: WinstonService,
        protected readonly groupId = "session-counts-projection",
        protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}sessions`],
    ) {
        super(kafkaService, winstonService)
    }

    protected deriveTargets(): Array<string> { return [] }
    protected async recomputeTarget(): Promise<void> {}
}
```

Hai báo cáo `member`. Tham số thuộc tính khai thành viên với trình biên dịch nhưng **không** nằm trong
`node.body.body`, mà đó là chỗ duy nhất phép quét đi qua.

**ĐÚNG** — cùng tệp

```ts
export class SessionCountsProjectionListener extends AbstractProjectionListener<string> {
    protected readonly groupId = "session-counts-projection"
    protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}sessions`]

    constructor(kafkaService: KafkaService, winstonService: WinstonService) {
        super(kafkaService, winstonService)
    }

    protected deriveTargets(): Array<string> { return [] }
    protected async recomputeTarget(): Promise<void> {}
}
```

### Cặp 6 — `onModuleInit` viết thành trường mũi tên vẫn bị bắt

**SAI** — `projections/order-totals/order-totals-projection.listener.ts`

```ts
export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
    protected readonly groupId = "order-totals-projection"
    protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}orders`]

    // trường của lớp, không phải phương thức - vẫn là một thành viên có `key`
    onModuleInit = async (): Promise<void> => {
        await this.startOwnConsumer()
    }

    protected deriveTargets(): Array<string> { return [] }
    protected async recomputeTarget(): Promise<void> {}
}
```

Báo `lifecycle`. Đây là chỗ quy tắc này **mạnh hơn** một phép quét chỉ nhìn phương thức: hàm ánh xạ tên
nhận bất kỳ nút thành viên nào có `key`, nên trường mũi tên không trốn được.

**ĐÚNG** — cùng tệp: bỏ hẳn cái móc, để lớp cơ sở giữ

```ts
export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
    protected readonly groupId = "order-totals-projection"
    protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}orders`]

    protected deriveTargets({ row }: ProjectionCdcMessage): Array<string> {
        const orderRow = row as OrderCdcRow
        return orderRow.customer_id ? [orderRow.customer_id] : []
    }

    protected async recomputeTarget(customerId: string): Promise<void> {
        await this.orderTotalsProjectionService.recompute({ customerId })
    }
}
```

### Cặp 7 — một lớp phụ đứng nhờ trong tệp bộ lắng nghe

**SAI** — `projections/order-totals/order-totals-projection.listener.ts`

```ts
// một lớp gom tiện ích, đặt nhờ trong tệp bộ lắng nghe cho gần chỗ dùng
class OrderRowMapper {
    static toCustomerId(row: OrderCdcRow): string | null { return row.customer_id ?? null }
}

export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
    protected readonly groupId = "order-totals-projection"
    protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}orders`]
    protected deriveTargets(): Array<string> { return [] }
    protected async recomputeTarget(): Promise<void> {}
}
```

`OrderRowMapper` lĩnh trọn năm báo cáo: `base` cộng bốn `member`. Quy tắc thăm **mọi** `ClassDeclaration`
trong tệp khớp cổng, không có khái niệm "lớp chính". Đây là **báo cáo sai**, và cách chữa rẻ nhất — một
chú thích tắt quy tắc ở đầu tệp — sẽ tắt luôn cả ba phép kiểm cho bộ lắng nghe thật ngay bên dưới.

**ĐÚNG** — tách ra `projections/order-totals/order-row.mapper.ts`

```ts
export class OrderRowMapper {
    static toCustomerId(row: OrderCdcRow): string | null { return row.customer_id ?? null }
}
```

Tệp này không kết thúc bằng `projection.listener.ts`, nên quy tắc không tồn tại ở đây.

### Cửa lách và nhầm lẫn

Mọi khối dưới đây **vi phạm luật CDC** và **quy tắc im lặng**. Chúng không phải code được phép viết.

- **`groupId` sinh theo tiến trình.** Quy tắc kiểm cái tên, không kiểm giá trị.

  ```ts
  // projections/order-totals/order-totals-projection.listener.ts
  export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
      // vi phạm CDC-2: mỗi lần khởi động là một nhóm mới, phát lại toàn bộ lịch sử
      protected readonly groupId = `order-totals-${randomUUID()}`
      protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}orders`]
      protected deriveTargets(): Array<string> { return [] }
      protected async recomputeTarget(): Promise<void> {}
  }
  ```

- **Danh sách chủ đề rỗng.** Cũng vi phạm `CDC-2`, cũng đủ tên.

  ```ts
  export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
      protected readonly groupId = "order-totals-projection"
      // vi phạm CDC-2: không theo dõi nguồn nào, projection cũ đi vĩnh viễn
      protected readonly topics: Array<string> = []
      protected deriveTargets(): Array<string> { return [] }
      protected async recomputeTarget(): Promise<void> {}
  }
  ```

- **Một cái móc vòng đời khác.** Chỉ đúng chữ `onModuleInit` bị canh.

  ```ts
  export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
      protected readonly groupId = "order-totals-projection"
      protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}orders`]

      // vi phạm CDC-1: một consumer riêng, một ngữ nghĩa lỗi riêng, quy tắc không thấy
      async onApplicationBootstrap(): Promise<void> {
          const { consumer } = await this.kafkaService.createConsumer({ groupId: "order-totals-shadow" })
          await consumer.run({ eachMessage: (payload) => this.handleMyself(payload) })
      }

      protected deriveTargets(): Array<string> { return [] }
      protected async recomputeTarget(): Promise<void> {}
  }
  ```

- **`recomputeTarget` cộng lượng chênh lệch.** Thân hàm không bao giờ được thăm.

  ```ts
  // vi phạm CDC-4: giao nhận trùng thì nhân đôi, giao nhận thiếu thì không bao giờ tự lành
  protected async recomputeTarget(target: OrderTotalsTarget): Promise<void> {
      await this.orderTotalsProjectionService.increment(target.customerId, target.amountDelta)
  }
  ```

- **`deriveTargets` phát lệnh nghiệp vụ.** Cũng là thân hàm.

  ```ts
  // vi phạm CDC-3: phát lại CDC sẽ lặp lại tác dụng phụ nghiệp vụ
  protected async deriveTargets({ row }: ProjectionCdcMessage): Promise<Array<string>> {
      const orderRow = row as OrderCdcRow
      await this.commandBus.execute(new SendReceiptEmailCommand({ params: { orderId: orderRow.id } }))
      return orderRow.customer_id ? [orderRow.customer_id] : []
  }
  ```

- **Biểu thức lớp.** Khoá thăm là `ClassDeclaration`.

  ```ts
  // projections/order-totals/order-totals-projection.listener.ts
  // vi phạm CDC-1 và CDC-2 cùng lúc, quy tắc không tồn tại với cách viết này
  export const OrderTotalsProjectionListener = class {
      async onModuleInit(): Promise<void> {
          await this.startOwnConsumer()
      }
  }
  ```

- **Đổi tên tệp.** Cổng tên tệp chính là sự tồn tại của quy tắc.

  ```ts
  // projections/order-totals/order-totals.listener.ts  <- bỏ chữ "projection"
  export class OrderTotalsListener implements OnModuleInit {
      async onModuleInit(): Promise<void> {
          const { consumer } = await this.kafkaService.createConsumer({ groupId: `t-${Date.now()}` })
          await consumer.run({ eachMessage: (payload) => this.handle(payload) })
      }
  }
  ```

- **Lớp cha là một cái tên tại chỗ.** Một lớp cùng tệp, viết dưới dạng biểu thức, đặt đúng tên.

  ```ts
  // projections/order-totals/order-totals-projection.listener.ts
  // ClassExpression nên không bị thăm; lớp dưới thoả phép so tên và không kế thừa gì thật
  const AbstractProjectionListener = class {}

  export class OrderTotalsProjectionListener extends AbstractProjectionListener {
      protected readonly groupId = "order-totals-projection"
      protected readonly topics: Array<string> = []
      protected deriveTargets(): Array<string> { return [] }
      protected async recomputeTarget(): Promise<void> {}
  }
  ```

- **Thành viên tĩnh.** Thoả phép quét tên, không thoả hợp đồng lúc chạy.

  ```ts
  export class OrderTotalsProjectionListener {
      // đủ bốn cái tên, không cái nào là thành viên thực thể
      static groupId = "order-totals-projection"
      static topics = []
      static deriveTargets() { return [] }
      static recomputeTarget() {}
  }
  ```

  Vẫn còn một báo cáo `base` ở đây, vì lớp không kế thừa gì — nhưng bốn phép kiểm `member` đã im, và đó
  đúng là điều muốn nói: phép quét không hỏi loại thành viên.

- **Một bộ lắng nghe không ai nối dây.** Quy tắc đọc một tệp, không đọc đồ thị mô-đun.

  ```ts
  // hình dạng hoàn hảo, không có tên trong `providers` của bất kỳ mô-đun nào
  @Injectable()
  export class OrderTotalsProjectionListener extends AbstractProjectionListener<string> {
      protected readonly groupId = "order-totals-projection"
      protected readonly topics = [`${envConfig().kafka.cdcTopicPrefix}orders`]
      protected deriveTargets(): Array<string> { return [] }
      protected async recomputeTarget(): Promise<void> {}
  }
  ```

- **Chứng minh đường giao nhận.** `CDC-7` không có quy tắc nào, ở đây hay ở đâu khác.

  ```ts
  // gọi thẳng phương thức: chứng minh code ánh xạ, không chứng minh CDC
  await listener.recomputeTarget({ customerId })
  ```

  ```ts
  // thứ luật đòi: xuất bản qua broker thật rồi chờ projection trong cơ sở dữ liệu
  await world.cdc.publish(orderRow)
  await until(() => world.db.orderTotals(customerId).then((total) => total === expectedTotal))
  ```

## Ánh xạ yêu cầu sang một báo cáo

Nêu tên tệp, lớp cha và các tên thành viên. Nếu thiếu **một** dữ kiện quyết định, hỏi **một** câu cụ thể
rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Thêm một bộ lắng nghe chiếu tổng đơn hàng | Tệp kết thúc bằng `projection.listener.ts` ⇒ quy tắc tồn tại | `CDC-1` | Phải `extends AbstractProjectionListener` |
| "Chỉ ghi thêm một dòng nhật ký lúc khởi động" | Khai `onModuleInit` là giành lấy vòng đời | `CDC-1` | `lifecycle` tại khoá `onModuleInit` |
| Đưa `groupId` và `topics` vào hàm dựng cho gọn | Tham số thuộc tính không nằm trong thân lớp | — | Hai báo cáo `member`, và đó là **báo cáo sai** |
| Để `groupId` sinh ngẫu nhiên cho khỏi trùng khi chạy nhiều bản | Tên có, giá trị không được đọc | `CDC-2` | Quy tắc **im**; đây là cửa còn mở, không phải sự cho phép |
| Cộng điểm ngay trong `recomputeTarget` cho nhanh | Thân hàm không được thăm | `CDC-4` | Quy tắc **im**; luật vẫn cấm |
| Đặt lớp gom tiện ích cạnh bộ lắng nghe cho gần | Mọi `ClassDeclaration` trong tệp đều bị kiểm | — | Năm báo cáo vào lớp tiện ích, **báo cáo sai** |
| Đổi tên tệp thành `*.listener.ts` cho ngắn | Cổng tên tệp là sự tồn tại của quy tắc | `CDC-1` | Quy tắc biến mất khỏi tệp đó |
| Viết một bộ lắng nghe trung gian cho một họ projection | Lớp cha được so bằng một định danh, một tệp | `CDC-1` | `base` vào mọi lớp lá, **báo cáo sai** |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| Quy tắc có tồn tại với tệp này không | Đường dẫn đã chuẩn hoá có kết thúc bằng `projection.listener.ts` không, và có phải chính tệp lớp cơ sở không? |
| `base` hay không `base` | Định danh viết ngay sau `extends` có đúng chữ `AbstractProjectionListener` không — **cách viết tại chỗ**, không phải thứ nó phân giải ra? |
| `member` hay im | Bốn cái tên có xuất hiện làm khoá của một thành viên trong thân lớp không — bất kể loại, bất kể tĩnh hay không? |
| `lifecycle` hay im | Có thành viên nào tên đúng `onModuleInit` không? Mọi cái móc khác đều ngoài phạm vi |
| Máy giữ hay người đọc | Điều cần khẳng định là một **cái tên** hay một **giá trị/thân hàm**? Giá trị và thân hàm luôn là việc của người đọc |
| Báo cáo đúng hay báo cáo sai | Lớp bị báo có thật sự là một bộ lắng nghe không, và thành viên "thiếu" có được khai ở chỗ nào ngoài thân lớp không? |

## Sai lầm lặp lại nhiều nhất

1. Đọc một lần dựng xanh thành "projection này đúng". Quy tắc giữ hình dạng, không giữ ngữ nghĩa.
2. Tin rằng `groupId` đã được kiểm. Chỉ **cái tên** được kiểm; một nhóm sinh theo tiến trình đi qua sạch.
3. Thêm `onModuleInit` "chỉ để ghi nhật ký" và che mất cái móc của lớp cơ sở.
4. Đưa `groupId`/`topics` vào tham số thuộc tính rồi kết luận quy tắc hỏng, thay vì ghi lại là báo cáo sai.
5. Đặt một lớp tiện ích nhờ trong tệp bộ lắng nghe rồi dập báo cáo sai bằng chú thích tắt quy tắc ở đầu
   tệp — mất luôn ba phép kiểm đúng cho bộ lắng nghe thật.
6. Đổi tên tệp cho gọn và không nhận ra quy tắc vừa biến mất khỏi tệp đó.
7. Dựng một lớp cơ sở trung gian cho một họ projection mà không biết mọi lớp lá sẽ bị báo `base`.
8. Gọi thẳng `recomputeTarget` trong kiểm thử rồi gọi đó là đã chứng minh CDC.
