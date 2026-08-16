---
id: be-lints-data-access-example
title: example.md
slug: /be/lints/data-access/example
sidebar_label: example.md
sidebar_position: 2
description: Mã thật cho từng quy tắc — chỗ nó báo lỗi, chỗ nó không báo và chỗ nó bỏ sót lỗi.
---

# example.md

> Version: `2.00` · Module: `data-access`

Mỗi mục dưới đây là một quy tắc. **SAI** là đoạn mã khiến quy tắc báo lỗi. **ĐÚNG** là đoạn mã không bị báo lỗi.
Mục **Cửa lách và nhầm lẫn** ở cuối mỗi quy tắc là đoạn mã **quy tắc không thấy** — đọc kỹ nhãn: đó là
chỗ máy bỏ sót, **không phải** chỗ luật cho phép.

---

## `must-inject-entity-manager`

### Trường hợp: tham số thuộc tính không có decorator

**SAI** — `TSParameterProperty` được bóc ra, chú thích kiểu ghi đúng chữ `EntityManager`, không
decorator nào khớp. Báo tại chính tham số.

```ts
@Injectable()
export class EnrollLearnerService {
    constructor(private readonly entityManager: EntityManager) {}
}
```

**ĐÚNG** — decorator nêu tên kết nối ngay tại nơi kết nối được chọn.

```ts
@Injectable()
export class EnrollLearnerService {
    constructor(
        @InjectPrimaryPostgreSQLEntityManager()
        private readonly entityManager: EntityManager,
    ) {}
}
```

### Trường hợp: tham số trần, không phải thuộc tính

**SAI** — không có `TSParameterProperty` nào để bóc, nhưng chú thích kiểu vẫn nằm đúng chỗ quy tắc đọc.

```ts
export class ReportBuilder {
    constructor(entityManager: EntityManager) {
        this.manager = entityManager
    }
}
```

**ĐÚNG** — decorator gắn thẳng lên tham số trần cũng được gom, vì cả hai nơi mang decorator đều được đọc.

```ts
export class ReportBuilder {
    constructor(@InjectAnalyticsPostgreSQLEntityManager() entityManager: EntityManager) {
        this.manager = entityManager
    }
}
```

### Trường hợp: tham số tuỳ chọn

**SAI** — dấu `?` nằm trên tham số, không nằm trên chú thích kiểu, nên `TSTypeReference` không đổi.

```ts
export class MigrationRunner {
    constructor(private readonly entityManager?: EntityManager) {}
}
```

**ĐÚNG** — vẫn tuỳ chọn, nhưng đã nêu tên kết nối.

```ts
export class MigrationRunner {
    constructor(
        @InjectPrimaryPostgreSQLEntityManager()
        private readonly entityManager?: EntityManager,
    ) {}
}
```

### Trường hợp: decorator viết dạng trần, không ngoặc

**ĐÚNG** — nhánh `Identifier` gom được tên, nên quy tắc im đúng như với dạng gọi.

```ts
export class BadgeGranter {
    constructor(
        @InjectPrimaryPostgreSQLEntityManager
        private readonly entityManager: EntityManager,
    ) {}
}
```

### Cửa lách và nhầm lẫn

Đoạn dưới đây **không bị kêu** dù nó không nêu tên cơ sở dữ liệu nào cả. Regex là
`^Inject\w*EntityManager$`, mà `\w*` khớp cả chuỗi rỗng — nên chính decorator trần của khung nền đi lọt,
và **đối số của decorator thì không quy tắc nào đọc**. Đây là cửa nặng nhất của cả mô-đun.

```ts
export class LedgerService {
    constructor(
        @InjectEntityManager()
        private readonly entityManager: EntityManager,
    ) {}
}
```

Cũng **không bị kêu**: một cái tên đúng dạng trỏ vào một nguồn dữ liệu chưa hề đăng ký. Quy tắc kiểm
hình dạng của cái tên, không kiểm cái tên có thật.

```ts
export class LedgerService {
    constructor(
        @InjectNowhereEntityManager()
        private readonly entityManager: EntityManager,
    ) {}
}
```

Cũng **không bị kêu**: import cả không gian tên. `orm.EntityManager` là `TSQualifiedName`, mà điều kiện
đòi `Identifier`.

```ts
import * as orm from "typeorm"

export class LedgerService {
    constructor(private readonly entityManager: orm.EntityManager) {}
}
```

Cũng **không bị kêu**: một bí danh kiểu. Quy tắc so cái chữ đã viết, không so cái kiểu thật.

```ts
type Manager = EntityManager

export class LedgerService {
    constructor(private readonly entityManager: Manager) {}
}
```

Cũng **không bị kêu**: kiểu hợp. `EntityManager | undefined` là `TSUnionType`, hàm đọc chú thích trả về
null và tham số bị bỏ qua.

```ts
export class LedgerService {
    constructor(private readonly entityManager: EntityManager | undefined) {}
}
```

Cũng **không bị kêu**: bộ quản lý lấy tay lúc chạy. Không có tham số hàm dựng nào để soi, mà nguồn dữ
liệu ở đây được chọn vô hình y hệt trường hợp bị cấm.

```ts
export class LedgerService {
    constructor(private readonly dataSource: DataSource) {}

    async write(): Promise<void> {
        const manager = this.dataSource.manager
        await manager.save(entity)
    }
}
```

Cũng **không bị kêu**: tiêm qua thuộc tính của lớp. `PropertyDefinition` không được thăm.

```ts
export class LedgerService {
    @Inject(PRIMARY_MANAGER)
    private readonly entityManager!: EntityManager
}
```

Cũng **không bị kêu**: nhà cung cấp dạng hàm nhà máy. Tham số của một biểu thức hàm không phải tham số
của một hàm dựng.

```ts
export const ledgerProvider = {
    provide: LEDGER,
    inject: [PRIMARY_MANAGER],
    useFactory: (entityManager: EntityManager) => new Ledger(entityManager),
}
```

---

## `no-injected-repository`

### Trường hợp: decorator kho lưu trữ

**SAI** — tên decorator gom được chứa đúng chuỗi `InjectRepository`.

```ts
export class CartService {
    constructor(
        @InjectRepository(CartItemEntity)
        private readonly cartItems: Repository<CartItemEntity>,
    ) {}
}
```

**ĐÚNG** — một bộ quản lý mang được cả giao dịch, nên lần ghi thứ hai chỉ là thêm một dòng.

```ts
export class CartService {
    constructor(
        @InjectPrimaryPostgreSQLEntityManager()
        private readonly entityManager: EntityManager,
    ) {}
}
```

### Trường hợp: chỉ có kiểu, không có decorator

**SAI** — nhánh kiểu tự đứng được; tham số kiểu tổng quát không bao giờ được đọc.

```ts
export class CategoryService {
    constructor(private readonly categories: TreeRepository<CategoryEntity>) {}
}
```

**ĐÚNG** — hai lần ghi nằm trong một đơn vị công việc.

```ts
export class CategoryService {
    constructor(
        @InjectPrimaryPostgreSQLEntityManager()
        private readonly entityManager: EntityManager,
    ) {}

    async move(node: CategoryEntity, parentId: string): Promise<void> {
        await this.entityManager.transaction(async (manager) => {
            await manager.save(CategoryEntity, { ...node, parentId })
            await manager.increment(AuditEntity, { kind: "move" }, "count", 1)
        })
    }
}
```

### Trường hợp: decorator đúng, kiểu lại là bộ quản lý

**SAI** — hai vế nối bằng `hoặc`, nên chỉ cần vế decorator đúng là đã báo, bất kể kiểu ghi gì.

```ts
export class OrderService {
    constructor(
        @InjectRepository(OrderEntity)
        private readonly entityManager: EntityManager,
    ) {}
}
```

### Trường hợp: kho lưu trữ tài liệu

**SAI** — `MongoRepository` nằm trong danh sách ba tên.

```ts
export class DocumentService {
    constructor(private readonly documents: MongoRepository<DocumentEntity>) {}
}
```

### Cửa lách và nhầm lẫn

Đoạn dưới đây **không bị kêu**, dù nó đúng là thứ luật cấm, chỉ mặc một cái tên khác. Danh sách chỉ có
ba tên, và một lớp kho lưu trữ tự viết không nằm trong đó.

```ts
export class UserRepository extends Repository<UserEntity> {}

export class ProfileService {
    constructor(private readonly users: UserRepository) {}
}
```

Cũng **không bị kêu**: tiêm bằng token. Tên decorator là `Inject`, không phải `InjectRepository`, còn
kiểu thì viết gì cũng được.

```ts
export class ProfileService {
    constructor(
        @Inject(getRepositoryToken(UserEntity))
        private readonly users: unknown,
    ) {}
}
```

Cũng **không bị kêu**, và đây là **cách một kho lưu trữ thật sự xuất hiện nhiều nhất**: lấy ra từ một
bộ quản lý đã tiêm hợp lệ, trong thân một phương thức. Quy tắc chỉ nhìn tham số hàm dựng.

```ts
export class ProfileService {
    constructor(
        @InjectPrimaryPostgreSQLEntityManager()
        private readonly entityManager: EntityManager,
    ) {}

    async find(id: string): Promise<UserEntity | null> {
        const users = this.entityManager.getRepository(UserEntity)
        return users.findOneBy({ id })
    }
}
```

Cũng **không bị kêu**: một bí danh kiểu che mất cái tên mà quy tắc so.

```ts
type UserRepo = Repository<UserEntity>

export class ProfileService {
    constructor(private readonly users: UserRepo) {}
}
```

Cũng **không bị kêu**: viết thành thuộc tính của lớp thay vì tham số hàm dựng.

```ts
export class ProfileService {
    @InjectRepository(UserEntity)
    private readonly users!: Repository<UserEntity>
}
```

---

## `require-entity-table-name`

### Trường hợp: gọi rỗng

**SAI** — không đối số nào, nên không đối số nào đặt tên bảng. Báo tại cả decorator.

```ts
@Entity()
export class CartItemEntity {}
```

**ĐÚNG** — tên bảng viết thẳng, không đi theo tên lớp nữa.

```ts
@Entity("cart_items")
export class CartItemEntity {}
```

### Trường hợp: dạng đối tượng tuỳ chọn

**SAI** — có đối tượng tuỳ chọn nhưng không có khoá `name`, nên bảng vẫn được suy ra từ tên lớp.

```ts
@Entity({ schema: "public" })
export class CartItemEntity {}
```

**ĐÚNG** — dạng đối tượng là dạng **duy nhất** còn mang được phần chỉ định lược đồ, nên nó được chấp
nhận có chủ đích chứ không phải được tha.

```ts
@Entity({ name: "cart_items", schema: "public" })
export class CartItemEntity {}
```

### Trường hợp: khoá viết dạng chuỗi

**ĐÚNG** — điều kiện đọc cả `property.key.name` lẫn `property.key.value`, nên khoá dạng chuỗi vẫn được
công nhận.

```ts
@Entity({ "name": "cart_items" })
export class CartItemEntity {}
```

### Trường hợp: trải một đối tượng tuỳ chọn dùng chung

**ĐÚNG** — phần trải bị bỏ qua, nhưng `.some` vẫn tìm thấy khoá `name` viết tay bên cạnh.

```ts
@Entity({ ...BASE_ENTITY_OPTIONS, name: "cart_items" })
export class CartItemEntity {}
```

### Cửa lách và nhầm lẫn

Đoạn dưới đây **không bị kêu**, và nó dẫn tới **đúng cái hậu quả quy tắc sinh ra để chặn**: chuỗi rỗng
là một `Literal` có `value` kiểu chuỗi, nên nhánh chấp nhận nhận nó, rồi tên bảng lại quay về suy ra
từ tên lớp.

```ts
@Entity("")
export class CartItemEntity {}
```

Cũng **không bị kêu**: chuỗi mẫu được công nhận theo **loại nút**, không theo **giá trị**. Không ai đọc
tệp này biết bảng tên là gì.

```ts
@Entity(`${TABLE_PREFIX}_cart_items`)
export class CartItemEntity {}
```

Cũng **không bị kêu**: viết không ngoặc thì `expression` là `Identifier`, và lần kiểm đầu tiên đòi
`CallExpression` — quy tắc thoát trước khi nhìn thấy gì.

```ts
@Entity
export class CartItemEntity {}
```

Cũng **không bị kêu**: một dòng import làm quy tắc **không tồn tại** với cả tệp.

```ts
import { Entity as Table } from "typeorm"

@Table()
export class CartItemEntity {}
```

Cũng **không bị kêu**: callee dạng truy cập thành viên trượt ở lần kiểm thứ hai.

```ts
import * as orm from "typeorm"

@orm.Entity()
export class CartItemEntity {}
```

Cũng **không bị kêu**: các decorator khai báo thực thể khác không được canh.

```ts
@ViewEntity()
export class ActiveCartView {}
```

Còn đây là **chiều ngược lại — báo nhầm**. Bảng đã được đặt tên đàng hoàng, nhưng đối số là một truy cập
thành viên chứ không phải một chuỗi ký tự, nên quy tắc báo lỗi. Mẫu "gom chuỗi vào hằng số" ở đây chạy
**ngược**: nó không khiến quy tắc không báo, mà khiến quy tắc báo nhầm.

```ts
@Entity(TABLES.cartItems)
export class CartItemEntity {}
```

Cùng một kiểu báo nhầm, viết ở dạng đối tượng tuỳ chọn.

```ts
@Entity({ name: CART_ITEMS_TABLE, schema: "public" })
export class CartItemEntity {}
```

Và một kiểu báo nhầm nữa: khoá tính toán bị điều kiện `!property.computed` loại ra.

```ts
@Entity({ ["name"]: "cart_items" })
export class CartItemEntity {}
```

---

## Ánh xạ yêu cầu sang một phán quyết

Nêu quy tắc, nêu nút mà quy tắc thăm, rồi mới nêu phán quyết. Một phán quyết **im** phải luôn kèm theo
lý do im: sạch, hay lọt.

| Yêu cầu bằng lời | Quy tắc | Phán quyết |
|---|---|---|
| Bắt mọi tham số `EntityManager` chưa nêu tên kết nối | `must-inject-entity-manager` | Kêu tại tham số; **im** với bí danh kiểu, tiền tố không gian tên và kiểu hợp |
| Kiểm rằng mọi nơi tiêm đều nêu đúng một nguồn dữ liệu có thật | `must-inject-entity-manager` | Im — đối số của decorator không bao giờ được đọc; chỉ hình dạng cái tên được kiểm |
| Kiểm rằng lớp này có tiêm bộ quản lý hay không | `must-inject-entity-manager` | Im hoàn toàn nếu lớp không tiêm gì; quy tắc chỉ ràng buộc một tham số đã tồn tại |
| Bắt mọi kho lưu trữ đến qua hàm dựng | `no-injected-repository` | Kêu ở ba tên kiểu và ở decorator `InjectRepository`; im ở mọi lớp kho lưu trữ tự viết |
| Kiểm rằng không chỗ nào dùng kho lưu trữ nữa | `no-injected-repository` | Im ở `manager.getRepository(...)` — quy tắc không bước vào thân phương thức |
| Bắt mọi thực thể chưa đặt tên bảng | `require-entity-table-name` | Kêu ở `@Entity()` rỗng và ở đối tượng tuỳ chọn không có `name`; im ở `@Entity("")` |
| Kiểm rằng tên bảng đọc lên biết ngay là gì | `require-entity-table-name` | Im ở chuỗi mẫu có thay thế — loại nút được công nhận, giá trị thì không |
| Cho phép đặt tên bảng bằng một hằng số dùng chung | `require-entity-table-name` | Kêu — đây là chỗ quy tắc từ chối một cách viết mà luật không cấm |
| Kiểm rằng hàm phụ trợ chạy đúng trong giao dịch của bên gọi | *không có quy tắc nào* | `DATA-4` không được máy giữ; xem `audit.md` |
| Kiểm rằng thực thể không nạp sẵn quan hệ | *không có quy tắc nào* | `DATA-5` không được máy giữ; xem `audit.md` |

## Bảng phân định ranh giới

Chỉ hỏi khi thật sự thiếu dữ kiện.

| Ranh giới | Câu hỏi phân định |
|---|---|
| `must-inject-entity-manager` / `no-injected-repository` | Tham số này là **bộ quản lý thiếu tên kết nối**, hay là **một tay cầm sai loại**? Hai quy tắc dùng chung một vòng duyệt nhưng không bao giờ cùng bắt một tham số |
| Kêu / im ở `must-inject-entity-manager` | Chú thích kiểu có phải một `TSTypeReference` mà định danh viết **đúng chữ** `EntityManager` không? |
| Im đúng / im lọt ở `must-inject-entity-manager` | Có decorator nào khớp regex không, và nếu có thì bên trong tên nó có **nêu được kết nối nào** không? |
| Kêu / im ở `no-injected-repository` | Tên kiểu có nằm trong đúng ba tên không, hoặc tên decorator có bằng đúng `InjectRepository` không? |
| Nơi tiêm / thân phương thức | Cái tay cầm này đến từ **hàm dựng** hay được lấy ra **lúc chạy**? Chỉ vế đầu có quy tắc |
| Kêu / im ở `require-entity-table-name` | Có đối số nào là chuỗi ký tự hoặc chuỗi mẫu — hoặc là đối tượng tuỳ chọn có khoá `name` không tính toán mang một trong hai dạng đó — không? |
| Kêu oan / kêu đúng ở `require-entity-table-name` | Bảng **đã có tên** rồi mà tên đó viết gián tiếp, hay bảng **thật sự chưa có tên**? |

## Sai lầm lặp lại nhiều nhất

1. Tin rằng quy tắc đã giữ hết luật, rồi thôi không đọc lại — sai lầm gốc, và là lý do trang này tồn tại.
2. Dùng decorator trần của khung nền rồi coi là đã theo `DATA-1`; nó thoát quy tắc và không nêu kết nối nào.
3. Đổi kho lưu trữ thành một lớp tự viết cho hết lỗi, thay vì đổi sang bộ quản lý.
4. Tiêm bộ quản lý đúng luật rồi gọi `getRepository(...)` ngay trong phương thức, tưởng là đã xong.
5. Viết `@Entity("")` để khiến quy tắc không báo, đúng lúc đang tạo ra cái hậu quả quy tắc sinh ra để chặn.
6. Gom tên bảng vào hằng số cho gọn, rồi tắt quy tắc cho cả tệp vì nó báo nhầm một chỗ.
7. Lấy bộ quản lý bằng `dataSource.manager` rồi tưởng bản build xanh nghĩa là nguồn dữ liệu đã được nêu tên.
8. Coi `DATA-4` và `DATA-5` là đã được giữ, chỉ vì ba mã còn lại có quy tắc.
