# truy cập dữ liệu

## Định nghĩa

Sự kiên trì trải qua một`EntityManager`, được chèn bởi một trình trang trí đặt tên cho nguồn dữ liệu đó
thuộc về. Không có kho lưu trữ nào ở đây và không có kết nối mặc định xung quanh: cả hai
là các thẻ điều khiển trông giống hệt bất kỳ cơ sở dữ liệu nào mà chúng được trỏ tới và ứng dụng này có
nhiều hơn một cơ sở dữ liệu.

Toàn bộ luật đều xuất phát từ một tài sản. MỘT`EntityManager`là **đơn vị công việc có thể được thông qua**
— được giao cho người trợ giúp, được bao bọc trong một giao dịch, được đổi lấy một giao dịch — và một kho lưu trữ
không phải vậy, bởi vì nó bị ràng buộc với một thực thể suốt đời. Thời điểm một ca sử dụng cần viết
nguyên tử hai bảng, mã được xây dựng trên kho lưu trữ phải được viết lại thay vì mở rộng và
viết lại vùng đất trong bất kỳ mô-đun nào được chú ý đầu tiên.

Câu hỏi giải quyết vấn đề đó: **thao tác này có thể tăng thêm lần ghi thứ hai không?** Nó gần như luôn luôn có thể,
và một tay cầm không thể thực hiện giao dịch xuyên suốt cặp là tay cầm sai ngay từ đầu.

Điều giữ luật này là[`sources/be/data-access.mjs`](../../../sources/be/data-access.mjs).

## Quy tắc

**DATA-1 · Một mũi tiêm`EntityManager`đặt tên nguồn dữ liệu của nó thông qua một trình trang trí.**`@InjectPrimaryPostgreSQLEntityManager()`, không bao giờ trần trụi`EntityManager`tham số. Loại nói
không có gì về kết nối đó: trình quản lý cơ sở dữ liệu chính và một trình quản lý phân tích
hoặc bản sao hộp cát có cùng loại, do đó tham số chưa được trang trí sẽ đọc chính xác và có thể được nối dây
đến dữ liệu sai.

Bộ trang trí là một lớp bao bọc xung quanh bộ tiêm riêng của khung và nó tồn tại để
kết nối được đặt tên tại vị trí tiêm — nơi duy nhất mà người đọc tìm kiếm để trả lời "cơ sở dữ liệu nào
cái này có chạm vào không".

**DATA-2 · Persistence không bao giờ xuất hiện dưới dạng kho lưu trữ được chèn vào.**

Không`@InjectRepository`, không phải một`Repository<T>`tham số. Một kho lưu trữ được liên kết với một thực thể, do đó
trình xử lý đang giữ một trình xử lý không thể thực hiện giao dịch vào bảng thứ hai và trường hợp sử dụng phát triển
lần viết thứ hai được viết lại thay vì mở rộng. Người quản lý là tay cầm tồn tại trong sự tăng trưởng.

**DATA-3 · Một thực thể đặt tên cho bảng của nó.**`@Entity("cart_items")`, không bao giờ`@Entity()`. Còn lại để suy luận, TypeORM lấy tên bảng từ
tên lớp - vì vậy việc đổi tên lớp sẽ đổi tên bảng và bên dưới`synchronize`việc đổi tên được thực hiện
dưới dạng DROP và TẠO thay vì di chuyển. Đổi tên lớp là một công cụ tái cấu trúc; một cái bàn bị rơi là
sự cố mất điện.

Biểu mẫu tùy chọn có giá trị như nhau và không phải là một phong cách đáng nản lòng: đây là biểu mẫu duy nhất có thể
cũng mang một hạn định lược đồ, vì vậy việc từ chối nó sẽ buộc tác giả phải xóa lược đồ để đáp ứng
quy tắc.

**DATA-4 · Giao dịch là đơn vị công việc và được thông qua, không ngụ ý.**

Công việc phải thành công hay thất bại cùng nhau diễn ra bên trong một giao dịch và mọi thứ bên trong nó đều cần
người quản lý giao dịch làm đối số. Một người trợ giúp tiếp cận người quản lý được tiêm của chính nó trong khi
người gọi nó đang ở giữa giao dịch ghi bên ngoài giao dịch đó và cam kết độc lập - đó là
vô hình khi xem xét và chỉ hiển thị ở trạng thái viết một nửa khi đang tải.

**DATA-5 · Một truy vấn cho biết nó cần gì và thực thể không quyết định điều đó.**

Các mối quan hệ, lựa chọn và đặt hàng thuộc về trang cuộc gọi biết câu trả lời là gì. Một thực thể
với các mối quan hệ háo hức trả lời mọi truy vấn theo cùng một cách tốn kém và chi phí sẽ thuộc về người gọi
người cần một cột.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Một trần`EntityManager`tham số hàm tạo | Loại không cho biết nguồn dữ liệu nào và ứng dụng này có nhiều hơn một | Đặt tên theo ngôi nhà`@Inject*EntityManager()`người trang trí |
|`@InjectRepository(...)`| Nó liên kết phần điều khiển với một thực thể, do đó lần ghi thứ hai không thể tham gia giao dịch | Tiêm`EntityManager`|
| MỘT`Repository<T>` / `TreeRepository<T>`tham số | Tương tự, mặc đồ thay vì đồ trang trí | Tương tự |
|`@Entity()`không có tên bảng | Tên bảng theo sau tên lớp và việc đổi tên sẽ trở thành DROP bên dưới`synchronize` | `@Entity("table_name")`|
| Người trợ giúp liên hệ với người quản lý của chính mình trong giao dịch của người gọi | Nó ghi bên ngoài giao dịch và tự mình cam kết, để lại trạng thái nửa viết | Vượt qua người quản lý giao dịch trong |
| Háo hức quan hệ trên một thực thể | Mọi truy vấn đều đáp ứng được nhu cầu cao nhất của người gọi | Yêu cầu quan hệ tại nơi gọi mà muốn |

## Ví dụ

### Trường hợp thông thường — kết nối được đặt tên ở nơi nó được đưa vào
```ts
constructor(
    @InjectPrimaryPostgreSQLEntityManager()
    private readonly entityManager: EntityManager,
) { super() }
```

```ts
// Wrong: reads correctly, compiles, and can be wired to the sandbox replica without anyone
// noticing - because nothing here says which database this is.
constructor(private readonly entityManager: EntityManager) { super() }
```
Chúng khác nhau ở một điều: liệu nguồn dữ liệu có được nêu ở nơi nó được chọn hay không.

### Cái bẫy có tay cầm
```ts
// The manager carries the whole unit of work, so a second write joins the first.
await this.entityManager.transaction(async (manager) => {
    await manager.save(enrollment)
    await manager.increment(WalletEntity, { userId }, "spent", price)
})
```

```ts
// Wrong: two repositories, two units of work. The wallet can move while the enrollment fails,
// and nothing in the type system objects.
await this.enrollments.save(enrollment)
await this.wallets.increment({ userId }, "spent", price)
```
Chúng khác nhau ở một điều: liệu hai thao tác viết có thể được hoàn tác cùng nhau hay không.

### Cái bẫy đang trôi qua — cái bẫy tinh vi
```ts
// The helper is given the transaction it must run inside.
await this.entityManager.transaction(async (manager) => {
    await this.grantXp(manager, userId, amount)
})
```

```ts
// Wrong: `grantXp` injects its own manager, so it writes on a second connection and commits
// independently. The outer rollback leaves the XP behind.
await this.entityManager.transaction(async () => {
    await this.grantXp(userId, amount)
})
```
Chúng khác nhau ở một điều: liệu người trợ giúp có ở trong giao dịch hay không thì nó dường như ở bên trong.

### Bẫy tên bảng
```ts
@Entity("cart_items")
export class CartItemEntity { /* ... */ }
```

```ts
// Wrong: the table is called `cart_item_entity` because the class is. Rename the class to
// `CartLineEntity` and `synchronize` drops the table and creates an empty one.
@Entity()
export class CartItemEntity { /* ... */ }
```
Chúng khác nhau ở một điều: việc đổi tên lớp là do bộ tái cấu trúc hay do ngừng hoạt động.
