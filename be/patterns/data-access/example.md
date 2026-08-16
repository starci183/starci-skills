---
id: be-patterns-data-access-example
title: example.md
slug: /be/patterns/data-access/example
sidebar_label: example.md
sidebar_position: 2
description: Mọi case và ngoại lệ của từng mã DATA-N, viết bằng TypeScript thường.
---

# example.md

> Version: `2.00` · Module: `data-access` · Luật: [`INDEX.md`](./INDEX.md) · Tình huống: [`vi.md`](./vi.md) · Phản biện: [`audit.md`](./audit.md)

Mọi ví dụ dưới đây là **TypeScript thường trong một ứng dụng hình dáng Nest**. Không tên sản phẩm,
không tên công ty, không tên repository. Một luật chỉ đúng khi nó đúng ở bất kỳ backend nào — nên nếu
một ví dụ cần tên riêng của một hệ thống cụ thể mới đọc được thì ví dụ đó đứng sai chỗ.

Mỗi mã có **nhiều case**, mỗi case đặt ĐÚNG cạnh SAI, rồi tới mục **ngoại lệ và nhầm lẫn**. Phần cuối
trang ánh xạ từ yêu cầu bằng lời sang một handle và một vị trí duy nhất.

---

## `DATA-1` — handle gọi tên datasource của nó

### Case: tiêm cơ bản

```ts
constructor(
    @InjectPrimaryPostgreSQLEntityManager()
    private readonly entityManager: EntityManager,
) { super() }
```

```ts
// SAI: đọc rất trôi chảy, compile sạch, và có thể bị nối vào bản sandbox mà không ai nhận ra --
// vì trong cả file không có một chữ nào nói đây là database nào.
constructor(private readonly entityManager: EntityManager) { super() }
```

Hai constructor khác nhau đúng một chuyện: cái thứ nhất trả lời được câu "chỗ này ghi vào đâu" ngay
tại dòng tiêm; cái thứ hai bắt người đọc đi mở file wiring của module để đoán.

### Case: parameter property không giấu được decorator

```ts
// ĐÚNG: decorator đứng trên chính tham số, dù tham số ấy đồng thời khai một field.
constructor(
    @InjectPrimaryPostgreSQLEntityManager()
    private readonly entityManager: EntityManager,
    private readonly clock: Clock,
) {}
```

```ts
// SAI: `private readonly` gói tham số lại, nhưng nó không gói được nghĩa vụ khai datasource.
constructor(
    private readonly entityManager: EntityManager,
    private readonly clock: Clock,
) {}
```

### Case: một service chạm hai datasource

```ts
// ĐÚNG: mỗi handle tự nói nó là ai. Đọc constructor là biết service này bắc cầu giữa hai database.
constructor(
    @InjectPrimaryPostgreSQLEntityManager()
    private readonly entityManager: EntityManager,
    @InjectAnalyticsPostgreSQLEntityManager()
    private readonly analyticsEntityManager: EntityManager,
) {}
```

```ts
// SAI: hai handle cùng kiểu, phân biệt nhau bằng TÊN BIẾN. Đổi thứ tự tham số trong một lần refactor
// là số liệu phân tích được ghi vào database chính, và không có gì đỏ lên.
constructor(
    private readonly entityManager: EntityManager,
    private readonly analyticsEntityManager: EntityManager,
) {}
```

### Ngoại lệ và nhầm lẫn

- **Manager đến qua tham số của hàm thì không cần decorator.** Decorator thuộc về *chỗ tiêm*, còn đây
  là *chỗ nhận*:

  ```ts
  // ĐÚNG: không có decorator, và cũng không được có. Người gọi đã quyết định datasource rồi.
  private async grantBadge(manager: EntityManager, userId: string): Promise<void> {
      await manager.increment(UserStatEntity, { userId }, "badges", 1)
  }
  ```

- **Decorator gọi tên connection, không gọi tên module dùng nó.** Cái tên phải trả lời "database
  nào", chứ không phải "ai đang dùng":

  ```ts
  // SAI: tên nói ai dùng, không nói dùng cái gì. Service thứ hai dùng cùng connection sẽ tự viết ra
  // một decorator thứ hai, và hai cái tên cùng trỏ vào một database.
  export const InjectEnrollmentEntityManager = () => InjectEntityManager(POSTGRESQL_PRIMARY)
  ```

  ```ts
  // ĐÚNG: một tên cho một connection.
  export const InjectPrimaryPostgreSQLEntityManager = () => InjectEntityManager(POSTGRESQL_PRIMARY)
  ```

---

## `DATA-2` — handle không bao giờ là repository

### Case: thao tác ghi hai bảng

```ts
// ĐÚNG: manager mang cả đơn vị công việc, nên lệnh ghi thứ hai nhập vào cùng transaction với lệnh
// ghi thứ nhất.
await this.entityManager.transaction(async (manager) => {
    await manager.save(enrollment)
    await manager.increment(WalletEntity, { userId }, "spent", price)
})
```

```ts
// SAI: hai repository, hai đơn vị công việc. Ví có thể trừ tiền trong khi bản ghi ghi danh hỏng, và
// không có gì trong hệ thống kiểu dữ liệu phản đối.
await this.enrollments.save(enrollment)
await this.wallets.increment({ userId }, "spent", price)
```

Hai đoạn khác nhau đúng một chuyện: hai lệnh ghi ấy có hoàn tác cùng nhau được không.

### Case: repository mặc áo kiểu thay vì áo decorator

```ts
// SAI: không có `@InjectRepository` nào cả, nhưng handle vẫn bị buộc vào một entity.
constructor(
    private readonly enrollments: Repository<EnrollmentEntity>,
) {}
```

```ts
// SAI: cùng một lỗi, đổi lớp áo.
constructor(
    private readonly categories: TreeRepository<CategoryEntity>,
) {}
```

```ts
// ĐÚNG: một handle, mọi entity, và nó truyền đi được.
constructor(
    @InjectPrimaryPostgreSQLEntityManager()
    private readonly entityManager: EntityManager,
) {}
```

### Case: thao tác chỉ đọc cũng dùng manager

```ts
// ĐÚNG. Đây là chỗ luật hay bị bỏ qua nhất: hôm nay nó chỉ đọc, nên "repository cho gọn" nghe rất
// hợp lý. Ngày mai nó đọc rồi ghi một dòng nhật ký truy cập.
const order = await this.entityManager.findOne(OrderEntity, {
    where: { id: orderId },
})
```

```ts
// SAI: rẻ hơn đúng một dòng import, và đắt bằng cả một lần viết lại khi lệnh ghi đầu tiên xuất hiện.
const order = await this.orders.findOne({ where: { id: orderId } })
```

### Case: repository lấy ra TỪ manager transactional

```ts
// ĐÚNG: repository này không được TIÊM, nó được dẫn ra từ manager đang giữ transaction -- nên nó nằm
// trong cùng đơn vị công việc và biến mất cùng nó.
await this.entityManager.transaction(async (manager) => {
    const orders = manager.getRepository(OrderEntity)
    await orders.save(order)
    await manager.increment(WalletEntity, { userId }, "spent", order.total)
})
```

```ts
// SAI: cùng cái tên `getRepository`, nhưng lấy từ connection chứ không từ transaction. Nó commit
// riêng, và nhìn code thì không thấy khác gì đoạn trên.
await this.entityManager.transaction(async (manager) => {
    const orders = this.entityManager.getRepository(OrderEntity)
    await orders.save(order)
    await manager.increment(WalletEntity, { userId }, "spent", order.total)
})
```

### Ngoại lệ và nhầm lẫn

- **"Thao tác này chắc chắn chỉ ghi một bảng" không phải một ngoại lệ.** Nó là một dự đoán về tương
  lai, và luật này tồn tại vì dự đoán ấy sai thường xuyên.
- **Repository không sai vì nó xấu.** Nó sai vì nó **không truyền đi được**. Nếu một ngày có thứ vừa
  buộc vào một entity vừa mang được transaction, tranh luận sẽ mở lại từ tính chất đó, không phải từ
  sở thích.

---

## `DATA-3` — entity gọi tên bảng của nó

### Case: tên bảng viết ra

```ts
@Entity("cart_items")
export class CartItemEntity extends UuidAbstractEntity { /* ... */ }
```

```ts
// SAI: bảng tên là `cart_item_entity` bởi vì class tên thế. Đổi class thành `CartLineEntity` là dưới
// `synchronize`, cái bảng bị DROP rồi CREATE lại rỗng.
@Entity()
export class CartItemEntity extends UuidAbstractEntity { /* ... */ }
```

Hai đoạn khác nhau đúng một chuyện: đổi tên class là một lần refactor, hay là một sự cố.

### Case: dạng options khi cần schema

```ts
// ĐÚNG: dạng duy nhất mang được schema. Đây KHÔNG phải một biến thể phong cách cần loại bỏ.
@Entity({
    name: "audit_events",
    schema: "audit",
})
export class AuditEventEntity extends UuidAbstractEntity { /* ... */ }
```

```ts
// SAI: có options nhưng không có `name`. Schema thì khai rồi, tên bảng vẫn để ORM suy ra.
@Entity({
    schema: "audit",
})
export class AuditEventEntity extends UuidAbstractEntity { /* ... */ }
```

### Case: đổi tên class theo ngôn ngữ nghiệp vụ

```ts
// ĐÚNG: nghiệp vụ đổi cách gọi, class đổi theo, bảng đứng yên. Không cần migration nào cả.
@Entity("cart_items")
export class CartLineEntity extends UuidAbstractEntity { /* ... */ }
```

```ts
// SAI: cùng một lần đổi tên ấy, với `@Entity()` thì bảng `cart_item_entity` biến mất và bảng
// `cart_line_entity` xuất hiện, rỗng. Diff của PR trông y hệt một lần đổi tên vô hại.
@Entity()
export class CartLineEntity extends UuidAbstractEntity { /* ... */ }
```

### Ngoại lệ và nhầm lẫn

- **Base class dùng chung không mang `@Entity`.** Nó không phải một bảng, nên nó không có tên bảng để
  khai:

  ```ts
  // ĐÚNG: không có `@Entity`, chỉ có cột dùng chung.
  export abstract class UuidAbstractEntity {
      @PrimaryGeneratedColumn("uuid")
          id: string
  }
  ```

- **Tên bảng và tên class không cần giống nhau, và thường không nên giống.** Class nói ngôn ngữ của
  code, bảng nói ngôn ngữ của dữ liệu. Ràng hai thứ ấy vào nhau chính là cái luật này gỡ ra.
- **Đặt tên bảng không cứu được một lần đổi tên CỘT.** Đó là một mã khác và một cuộc thảo luận khác;
  đừng đọc `DATA-3` thành "đã đặt tên bảng thì `synchronize` an toàn".

---

## `DATA-4` — transaction được truyền, không được ngầm hiểu

### Case: helper nhận transaction

```ts
// ĐÚNG: helper được ĐƯA cho cái transaction mà nó phải chạy bên trong.
await this.entityManager.transaction(async (manager) => {
    await this.grantXp(manager, userId, amount)
})
```

```ts
// SAI: `grantXp` tự tiêm manager của nó, nên nó ghi trên một connection thứ hai và commit độc lập.
// Rollback ở ngoài để lại số XP đã cộng.
await this.entityManager.transaction(async () => {
    await this.grantXp(userId, amount)
})
```

Hai đoạn khác nhau đúng một chuyện: helper có thật sự nằm trong cái transaction mà nó trông như đang
nằm trong không.

### Case: chữ ký của helper nói ra điều đó

```ts
// ĐÚNG: manager là tham số đầu tiên. Không gọi được hàm này mà quên mất transaction.
private async grantXp(
    manager: EntityManager,
    userId: string,
    amount: number,
): Promise<void> {
    await manager.increment(UserStatEntity, { userId }, "xp", amount)
}
```

```ts
// SAI: chữ ký không đòi gì cả, nên chỗ gọi không có cơ hội làm đúng. Lỗi nằm ở đây, không nằm ở chỗ
// gọi.
private async grantXp(
    userId: string,
    amount: number,
): Promise<void> {
    await this.entityManager.increment(UserStatEntity, { userId }, "xp", amount)
}
```

### Case: chuỗi gọi nhiều tầng

```ts
// ĐÚNG: manager đi hết chiều sâu. Tầng nào cũng chỉ dùng cái nó được đưa.
await this.entityManager.transaction(async (manager) => {
    await this.settleOrder(manager, orderId)
})

private async settleOrder(manager: EntityManager, orderId: string): Promise<void> {
    const order = await manager.findOneOrFail(OrderEntity, { where: { id: orderId } })
    await manager.update(OrderEntity, { id: orderId }, { status: OrderStatus.Settled })
    await this.recordLedgerEntry(manager, order)
}
```

```ts
// SAI: đúng ở tầng một, hỏng ở tầng hai. Đây là dạng khó thấy nhất, vì lời gọi ngoài cùng trông hoàn
// toàn đúng luật.
private async settleOrder(manager: EntityManager, orderId: string): Promise<void> {
    const order = await manager.findOneOrFail(OrderEntity, { where: { id: orderId } })
    await manager.update(OrderEntity, { id: orderId }, { status: OrderStatus.Settled })
    await this.recordLedgerEntry(order)
}
```

### Case: lock giữ theo session, manager đi cùng cái session ấy

```ts
// ĐÚNG: helper tự mở query runner để giữ lock, rồi truyền manager CỦA CHÍNH runner đó vào trong.
// Việc bên trong chạy trên đúng session đang giữ lock.
export const withAdvisoryLock = async <Result>(
    entityManager: EntityManager,
    key: string,
    action: (manager: EntityManager) => Promise<Result>,
): Promise<Result> => {
    const queryRunner = entityManager.connection.createQueryRunner()
    await queryRunner.connect()
    try {
        await queryRunner.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [key])
        return await action(queryRunner.manager)
    } finally {
        await queryRunner.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [key])
            .catch(() => undefined)
        await queryRunner.release()
    }
}
```

```ts
// SAI: lock giữ trên một session, việc chạy trên session khác. Cái lock ấy không bảo vệ gì hết, và
// nó trông y hệt bản đúng.
await queryRunner.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [key])
return await action(entityManager)
```

### Ngoại lệ và nhầm lẫn

- **Nhận manager rồi không dùng là vẫn sai.** Chữ ký đúng không cứu được thân hàm:

  ```ts
  // SAI: `manager` nằm trong chữ ký cho đẹp, còn lệnh ghi thì đi đường khác.
  private async grantXp(manager: EntityManager, userId: string): Promise<void> {
      await this.entityManager.increment(UserStatEntity, { userId }, "xp", 1)
  }
  ```

- **`DATA-4` không có lint giữ.** Cả hai đoạn SAI ở trên đều compile sạch và đều qua được ba rule của
  module này. Người đọc là tầng giữ duy nhất, nên trong review, câu hỏi bắt buộc là: **helper này lấy
  manager ở đâu?**
- **Sửa `DATA-2` không tự sửa `DATA-4`.** Bỏ hết repository đi rồi thì bạn có một đơn vị công việc
  truyền đi được — còn nó có được truyền đi thật không thì vẫn là một quyết định riêng ở từng chỗ gọi.

---

## `DATA-5` — query nói ra cái nó cần

### Case: relation khai ở chỗ hỏi

```ts
// ĐÚNG: call site này cần cây quan hệ để dựng một màn hình chi tiết, nên nó tự nói ra.
const items = await this.entityManager.find(CartItemEntity, {
    where: { user: { id: userId } },
    relations: {
        course: {
            pricingPhases: true,
            translations: true,
        },
    },
    order: { createdAt: "ASC" },
})
```

```ts
// SAI: entity phát relation cho tất cả mọi người. Mọi câu query đều trả lời bằng cách đắt nhất mà
// một call site nào đó từng cần.
@ManyToOne(() => CourseEntity, { eager: true })
    course: CourseEntity
```

Hai đoạn khác nhau đúng một chuyện: chi phí do người cần nó trả, hay do tất cả cùng trả.

### Case: hai call site, hai hình dáng, một entity

```ts
// ĐÚNG: bảng xếp hạng chỉ cần tên và điểm.
const rows = await this.entityManager.find(EnrollmentEntity, {
    where: { courseId },
    select: { id: true, score: true, userId: true },
    order: { score: "DESC" },
    take: 20,
})
```

```ts
// ĐÚNG: màn hình chi tiết của cùng entity ấy cần nhiều hơn, và nó tự nói ra.
const enrollment = await this.entityManager.findOne(EnrollmentEntity, {
    where: { id: enrollmentId },
    relations: { user: true, course: { modules: true } },
})
```

```ts
// SAI: một `eager` trên entity làm bản bảng xếp hạng ở trên kéo theo cả `user` và cả cây `modules`,
// cho hai mươi dòng, mỗi lần mở trang chủ.
@ManyToOne(() => CourseEntity, { eager: true })
    course: CourseEntity
```

### Case: cây quan hệ lặp lại ở nhiều chỗ

```ts
// ĐÚNG: đặt tên cho hình dáng ấy và dùng lại. Quyết định vẫn nằm ở call site, chỉ là nó được viết
// một lần.
const CART_DETAIL_RELATIONS = {
    course: { pricingPhases: true, translations: true },
} as const

const items = await this.entityManager.find(CartItemEntity, {
    where: { user: { id: userId } },
    relations: CART_DETAIL_RELATIONS,
})
```

```ts
// SAI: "ba chỗ đều cần rồi, cho eager luôn cho gọn". Chỗ thứ tư chỉ cần đếm số dòng, và nó trả giá
// cho ba chỗ kia mà không hề biết.
@ManyToOne(() => CourseEntity, { eager: true })
    course: CourseEntity
```

### Case: thứ tự cũng là của call site

```ts
// ĐÚNG: thứ tự thuộc về câu trả lời. Một chỗ cần cũ nhất trước, chỗ khác cần điểm cao nhất trước.
const history = await this.entityManager.find(SubmissionEntity, {
    where: { userId },
    order: { createdAt: "ASC" },
})
```

```ts
// SAI: đặt `order` mặc định trên entity là bắt mọi câu hỏi phải trả lời theo một thứ tự, kể cả câu
// hỏi có thứ tự riêng của nó.
@Entity("submissions")
@Index(["userId"])
export class SubmissionEntity extends UuidAbstractEntity { /* order mặc định khai ở đây */ }
```

### Ngoại lệ và nhầm lẫn

- **`eager` không "nhanh hơn" hay "chậm hơn".** Nó **chuyển chi phí** từ chỗ biết mình cần gì sang
  chỗ không biết. Cuộc tranh luận về hiệu năng chỉ mở ra được sau khi chi phí đã nằm đúng chỗ.
- **N+1 không phải lý do để bật `eager`.** Nó là lý do để call site khai relation ra:

  ```ts
  // SAI: chữa N+1 bằng cách bắt mọi query khác trả tiền.
  @ManyToOne(() => CompanyEntity, { eager: true })
      company: CompanyEntity
  ```

  ```ts
  // ĐÚNG: chữa N+1 ở đúng chỗ sinh ra nó.
  const postings = await this.entityManager.find(JobPostingEntity, {
      where: { status: JobPostingStatus.Open },
      relations: { company: true },
  })
  ```

- **`DATA-5` không có lint giữ.** Không file nào nói được relation này *có nên* được hỏi ở call site
  hay không, vì dữ kiện quyết định là "câu trả lời để làm gì" — và dữ kiện ấy không nằm trong entity.

---

## Ánh xạ yêu cầu sang handle và vị trí

Nêu datasource, các bảng bị ghi và cái phải nguyên tử. Nếu thiếu **một** dữ kiện quyết định, hỏi
**một** câu cụ thể rồi dừng.

| Yêu cầu bằng lời | Lập luận | Mã | Kết quả |
|---|---|---|---|
| Service mới cần đọc dữ liệu | Kiểu không nói database nào | `DATA-1` | `@Inject*EntityManager()` trên tham số |
| Handler này chỉ ghi một bảng thôi | Lệnh ghi thứ hai luôn có thể tới | `DATA-2` | `EntityManager`, không repository |
| Thêm một entity mới | Tên bảng không được là hệ quả của tên class | `DATA-3` | `@Entity("tên_bảng")` |
| Entity mới phải nằm ở schema riêng | Chỉ dạng options mang được schema | `DATA-3` | `@Entity({ name, schema })` |
| Ghi danh xong thì trừ ví | Hai lệnh ghi phải cùng sống cùng chết | `DATA-4` | Một `transaction`, manager truyền vào helper |
| Gọi service dùng chung từ trong transaction | Callee tự lấy manager là commit riêng | `DATA-4` | Thêm `manager` vào chữ ký của callee |
| Màn hình chi tiết cần cả cây quan hệ | Chỉ call site này cần | `DATA-5` | `relations` khai tại chỗ gọi |
| Danh sách bị N+1 | Chi phí phải nằm ở chỗ sinh ra nó | `DATA-5` | `relations` tại call site, không `eager` |
| Ba chỗ cùng cần một cây quan hệ | Dùng lại hình dáng, không chuyển chi phí | `DATA-5` | Hằng số relations dùng chung |

## Bảng phân định ranh giới

Chỉ hỏi khi dữ kiện thật sự thiếu.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `DATA-1` / `DATA-2` | Handle không khai nó trỏ vào đâu, hay handle không mang nổi lệnh ghi thứ hai? |
| `DATA-2` / `DATA-4` | Đã **có** đơn vị công việc để truyền chưa, hay có rồi mà **không truyền**? |
| `DATA-3` / `DATA-5` | Quyết định trên entity này nói về **danh tính** của bảng, hay về **chi phí** của mọi query? |
| `DATA-4` / `DATA-5` | Đặt sai chỗ này gây **mất dữ liệu** hay gây **chậm dần**? |
| `DATA-1` / `DATA-4` | Sai ở **chỗ tiêm** hay sai ở **chỗ dùng**? |

## Sai lầm lặp lại nhiều nhất

1. Tiêm `EntityManager` trần vì "module chỉ có một database" — cho tới khi nó có hai.
2. Dùng repository vì thao tác "chắc chắn" chỉ ghi một bảng.
3. Phân biệt hai datasource bằng tên biến thay vì bằng decorator.
4. `@Entity()` rỗng, rồi đổi tên class trong một PR không có migration nào.
5. Mở transaction rồi gọi một helper tự tiêm manager của nó.
6. Truyền `manager` xuống một tầng rồi quên ở tầng thứ hai.
7. Nhận `manager` trong chữ ký nhưng thân hàm vẫn dùng `this.entityManager`.
8. Giữ lock trên một session rồi chạy việc trên session khác.
9. Chữa N+1 bằng `eager` trên entity thay vì bằng `relations` ở call site.
10. Coi `DATA-4` và `DATA-5` là "khuyến nghị" chỉ vì không có lint nào báo đỏ.
