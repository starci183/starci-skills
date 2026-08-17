---
title: Data-access · Vietnamese
---

# Truy cập dữ liệu

## LOADS

None.


## Bản ghi

Gate này nhận đoạn mã đã viết xong — một tệp, một mảnh diff. Kết quả là một **phán quyết**: quy tắc nào đã
công bố đã báo, báo tại nút nào, ứng với mã luật nào, và cửa nào còn mở có thể đã che đúng lỗi đó.
Mô-đun này không chọn thiết kế nào cả. Nó từ chối một cách viết, và nó phải trỏ được vào đúng tham số
hoặc đúng decorator mà nó từ chối.

## Luật

Luật nằm ở `patterns/data-access.md`. Luật nói năm điều. Một bộ quản lý được tiêm phải nêu tên nguồn dữ
liệu mà nó thuộc về (`DATA-1`). Phần lưu trữ không bao giờ đến dưới dạng một kho lưu trữ (`DATA-2`).
Một thực thể phải đặt tên bảng của nó (`DATA-3`). Một giao dịch phải được truyền cho mọi thứ bắt buộc
chạy bên trong nó (`DATA-4`). Một truy vấn phải nói rõ nó cần gì, và thực thể không được quyết thay
(`DATA-5`).

Luật nêu **năm mã. Ba mã có quy tắc máy.** Trang này không kể lại luật; nó ghi lại phần THỰC THI — đúng
cái nút mà máy nhìn vào, và những cách viết đi ngang qua nó mà không hề bị chạm. Một điều luật không có
quy tắc nào giữ thì ai cũng biết là chưa được giữ, nên vẫn còn người đọc lại. Một quy tắc **thủng** thì
mọi người TIN là cửa đã đóng nên không ai đọc lại nữa — vì vậy bảng cửa còn mở bên dưới mới là lý do
tồn tại của tài liệu này, không phải phần phụ lục của nó.

## Luật máy đã xuất bản

Danh tính của mỗi quy tắc là **cái tên nó công bố**; không có mã số nào cho quy tắc, vì cái tên đã là
chuỗi ký tự hiện trong log build, trong dòng chú thích tắt quy tắc, và trong mọi cuộc trao đổi về lỗi
đó rồi.

| Quy tắc | Mã | Nó báo cái gì |
|---|---|---|
| `must-inject-entity-manager` | `DATA-1` | Một tham số hàm dựng có chú thích kiểu `EntityManager` mà không mang decorator nào thuộc họ đặt tên nguồn dữ liệu, báo ngay tại chính tham số đó |
| `no-injected-repository` | `DATA-2` | Một tham số hàm dựng hoặc mang decorator `InjectRepository`, hoặc có chú thích kiểu trùng một trong ba tên kho lưu trữ, báo tại tham số |
| `require-entity-table-name` | `DATA-3` | Một lời gọi `@Entity(...)` mà trong danh sách đối số không có chuỗi ký tự nào đặt tên bảng, báo tại cả decorator |

Mỗi quy tắc đã công bố đều ứng với một mã, và ánh xạ là một-một. `DATA-4` (giao dịch phải được truyền
cho mọi thứ bắt buộc chạy bên trong nó) và `DATA-5` (truy vấn phải nói rõ nó cần gì) **không có quy tắc
nào cả**: muốn biết một hàm phụ trợ có được trao đúng bộ quản lý đang trong giao dịch hay không thì
phải có đồ thị lời gọi, còn muốn biết một quan hệ có đáng được hỏi ở nơi gọi hay không thì phải biết
câu trả lời dùng để làm gì. Cả hai là **chưa được thực thi**, chứ không phải được phủ, và một lần chạy
xanh không nói được gì hết về cả hai.

## Đọc một diff

1. **Quyết phạm vi trước tiên, và ghi lại.** Phạm vi ở đây là cấu hình glob của kho tiêu thụ. Một tệp
   không glob nào gọi tên là một tệp mà mọi quy tắc ở đây không tồn tại — ngoài phạm vi **không** có
   nghĩa là tệp đã sạch, mà là chưa có gì được xét.
2. **Kiểm bộ phân tích cú pháp.** Không có TypeScript kèm hỗ trợ decorator và thuộc tính-tham số thì
   `TSParameterProperty`, `TSTypeReference` và `Decorator` không bao giờ xuất hiện, cả ba quy tắc câm
   vĩnh viễn mà vẫn báo xanh.
3. **Đọc nút, đừng đoán ý định.** Hai quy tắc thăm tham số hàm dựng; một quy tắc thăm decorator. Không
   gì khác trong tệp được nhìn tới.
4. **Đọc định danh của tham chiếu kiểu trước.** Cả hai quy tắc tham số dừng ngay khi chú thích không
   phải `TSTypeReference` có `typeName` là `Identifier`, nên một tiền tố không gian tên hoặc một bí
   danh là đủ làm rỗng cả hai.
5. **Mỗi phát hiện xuất đúng một khối.**
6. **Viết dòng `hatch` mỗi khi có một cửa còn mở áp dụng được** — sự im lặng mà một cửa mở giải thích
   được là lời khẳng định rằng cách viết đó **chưa được xét**, không phải rằng nó sạch.
7. **Đừng báo điều không quy tắc nào canh.** Hai trong năm mã không có máy nào giữ; một phán quyết nói
   khác là nói sai về mô-đun này.

## `must-inject-entity-manager` — DATA-1

**Nó báo cái gì.** Một tham số hàm dựng có chú thích kiểu ghi đúng chữ `EntityManager` mà không mang
decorator nào khớp `/^Inject\w*EntityManager$/`, báo tại tham số đã được bóc vỏ. Thông báo nêu cả cách
thay lẫn hậu quả: kiểu không nói được **cái nào** trong nhiều cơ sở dữ liệu, nên đoạn mã đọc lên thì
đúng mà lại trỏ sang cơ sở dữ liệu khác.

**Nó phát hiện bằng gì.** Thăm `MethodDefinition`, chỉ tiếp tục khi `node.kind === "constructor"` và có
`node.value.params`. Với mỗi tham số: bóc `TSParameterProperty` ra `.parameter`, rồi đọc
`param.typeAnnotation.typeAnnotation` và đòi đúng `TSTypeReference` có `typeName.type === "Identifier"`.
Chỉ đi tiếp khi `name` của định danh ấy đúng bằng `EntityManager`. Tên decorator được gom từ **HAI** nơi
mang — chính nút gốc, và khi nút gốc là `TSParameterProperty` thì cả tham số bên trong nó — dạng gọi
lấy `expression.callee.name` với callee là `Identifier`, dạng trần lấy `expression.name`. Im lặng khi
bất kỳ tên gom được nào khớp regex; ngược lại báo tại tham số đã bóc vỏ.

**Điểm mù.** `@InjectEntityManager()`, chính decorator trần của khung nền, vì `\w*` khớp cả
chuỗi rỗng và **đối số của decorator thì không bao giờ được đọc** — một decorator không nêu tên kết nối
nào vẫn thoả một quy tắc mà toàn bộ thông báo của nó nói về việc nêu tên kết nối. `@InjectAnythingEntityManager()`
cho một nguồn dữ liệu không hề tồn tại, cùng lý do: quy tắc kiểm **hình dạng của cái tên**, không bao
giờ kiểm cái tên có ứng với một kết nối đã đăng ký hay không. Một decorator tự định nghĩa tại chỗ mà
đặt tên đúng dạng, vì không import nào được phân giải. `em: typeorm.EntityManager`, phân tích ra
`TSQualifiedName`. `import { EntityManager as Manager }` rồi `em: Manager`, và `type Manager = EntityManager`
— quy tắc so cái chữ đã viết. `em: EntityManager | undefined`, một `TSUnionType` mà hàm đọc chú thích
trả về null. Một thuộc tính của lớp, `@Inject(MANAGER) private readonly em: EntityManager`, vì
`PropertyDefinition` không bao giờ được thăm. `this.dataSource.manager`,
`this.dataSource.createEntityManager()` và `moduleRef.get(EntityManager)`, không cái nào là tham số:
quy tắc giữ **nơi tiêm**, mà một bộ quản lý lấy được lúc chạy thì không có nơi tiêm nào để giữ, còn
nguồn dữ liệu vẫn được chọn một cách vô hình y hệt. Một lớp không giữ bộ quản lý nào — không có gì để
báo, và tên quy tắc hứa là phải tiêm bộ quản lý trong khi việc nó thật sự làm là ràng buộc một bộ quản
lý đã được tiêm sẵn. Một nhà cung cấp dạng hàm nhà máy, `useFactory: (em: EntityManager) => …`, có tham
số của một biểu thức hàm chứ không phải của một hàm dựng.

**Ranh giới.** Quy tắc này xét một tham số bộ quản lý được đặt tên và gắn decorator ra sao. Còn phần
lưu trữ có nên đến dưới dạng bộ quản lý hay không là việc của `DATA-2`.

## `no-injected-repository` — DATA-2

**Nó báo cái gì.** Một tham số hàm dựng thoả **một trong hai** vế: tên decorator gom được có chứa đúng
chuỗi `InjectRepository`, HOẶC định danh tham chiếu kiểu của tham số khớp
`/^(?:Repository|TreeRepository|MongoRepository)$/`. Mỗi tham số báo đúng một lần dù vế nào khớp, hay
cả hai cùng khớp.

**Nó phát hiện bằng gì.** Dùng chung đúng một vòng duyệt hàm dựng, đúng một phép bóc `TSParameterProperty`
và đúng một hàm gom decorator với `must-inject-entity-manager`, nên hai quy tắc thống nhất tuyệt đối về
việc thế nào là một tham số hàm dựng và một decorator tên là gì. Tham số kiểu tổng quát không bao giờ
được đọc: chỉ mỗi định danh quyết định.

**Điểm mù.** `class UserRepository extends Repository<UserEntity>` rồi tiêm
`repo: UserRepository` — thành viên chỉ gồm ba tên viết đúng, nên đúng thứ luật cấm lại không được nhận
ra. `AbstractRepository`, `MongoEntityManager`, hay bất kỳ tên tay cầm nào khác, cùng một danh sách
đóng ba phần tử. `@Inject(getRepositoryToken(UserEntity)) private readonly repo: unknown`, nơi tên
decorator là `Inject` còn kiểu thì không nằm trong danh sách: việc tiêm vẫn thành công và quy tắc không
nói gì. `this.entityManager.getRepository(UserEntity)` nằm trong thân một phương thức — **cách một kho
lưu trữ thật sự xuất hiện nhiều nhất** lại là một lời gọi, mà quy tắc chỉ nhìn tham số. Tên kiểu có
tiền tố không gian tên hoặc bí danh, `orm.Repository<T>` hay `type UserRepo = Repository<UserEntity>`,
đúng điểm mù của quy tắc trên. Một thuộc tính của lớp thay vì một tham số. Một kho lưu trữ được trao
vào dưới dạng tham số của phương thức hoặc đối số của hàm, vốn không phải tham số hàm dựng.

**Ranh giới.** Quy tắc này xét hình dạng của một tham số đã khai báo. Một tay cầm lấy được trong thân
phương thức không phải ngoại lệ của nó, mà nằm ngoài nó.

## `require-entity-table-name` — DATA-3

**Nó báo cái gì.** Một lời gọi `@Entity(...)` mà không đối số nào đặt tên bảng, báo tại **cả nút
`Decorator`** chứ không tại đối số. Tên bảng được công nhận ở hai dạng: một chuỗi ký tự trực tiếp, hoặc
một đối tượng tuỳ chọn có khoá `name` không tính toán mang một chuỗi như vậy.

**Nó phát hiện bằng gì.** Thăm `Decorator`. Đòi `node.expression.type === "CallExpression"`,
`callee.type === "Identifier"` và `callee.name === "Entity"` — ba điều kiện, mỗi điều kiện đều thoát
sớm. Một tên bảng được tính khi có đối số nào là `Literal` với `typeof value === "string"`, hoặc là
`TemplateLiteral`, hoặc là `ObjectExpression` chứa một `Property` không tính toán mà khoá có `name`
hoặc `value` bằng `name` và giá trị thuộc một trong hai dạng chữ nghĩa đó. Ngược lại báo tại nút
`Decorator`. Nút mà decorator gắn vào thì không bao giờ được soi. Dạng đối tượng tuỳ chọn được chấp
nhận **có chủ đích**: đó là dạng duy nhất còn mang được phần chỉ định lược đồ, nên từ chối nó sẽ đẩy
người viết đi xoá lược đồ cho quy tắc hài lòng — một kết cục tệ hơn cái tên suy ra mà quy tắc sinh ra
để chặn.

**Điểm mù.** `@Entity("")` — chuỗi rỗng là một `Literal` có `value` kiểu chuỗi nên lọt qua,
rồi bộ ánh xạ quay về suy tên từ tên lớp, đúng cái hậu quả quy tắc sinh ra để chặn, đi vào bằng chính
nhánh chấp nhận của quy tắc. `` @Entity(`${prefix}_items`) `` và chuỗi mẫu rỗng `` @Entity(``) ``, vì
`TemplateLiteral` được chấp nhận vô điều kiện: quy tắc công nhận **loại nút**, không công nhận **giá
trị**. `@Entity` viết không ngoặc, có `expression` là `Identifier` và trượt ngay lần kiểm đầu tiên
trước khi nhìn thấy bất cứ gì. `import { Entity as Table }` rồi `@Table("cart_items")` hay `@Table()` —
một bí danh làm quy tắc **không tồn tại** với cả tệp đó. `@Orm.Entity()`, callee dạng truy cập thành
viên. `@ViewEntity()`, `@ChildEntity()` và mọi decorator khai báo thực thể khác, vì chỉ đúng chữ
`Entity` được canh. Một lược đồ dựng bằng mã thay vì khai báo bằng decorator, vốn không có nút decorator
nào. Và chiều ngược lại — bắt nhầm: `@Entity(TABLES.cartItems)` và `@Entity({ name: TABLE_NAME })` đều
bị báo dù bảng đã được đặt tên hẳn hoi; ở đây thói quen gom chuỗi vào hằng số chạy **ngược**, làm quy
tắc báo sai, và khoá tính toán `@Entity({ ["name"]: "cart" })` cùng `@Entity({ ...OPTIONS })` đứng một
mình cũng vậy.

**Ranh giới.** Quy tắc này chỉ xét đối số của decorator. Lớp bên dưới khai báo gì, và về sau truy vấn
hỏi thực thể đó những gì, là chuyện của `DATA-5` và không có quy tắc nào giữ.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| cổng đường dẫn | Không có ở mức quy tắc. Cấu hình glob của kho tiêu thụ quyết định tệp nào bị lint; không quy tắc nào đọc đường dẫn tệp |
| yêu cầu bộ phân tích | TypeScript kèm hỗ trợ decorator và thuộc tính-tham số. Thiếu nó thì `TSParameterProperty`, `TSTypeReference` và `Decorator` không bao giờ xuất hiện và cả ba quy tắc câm vĩnh viễn |
| vòng duyệt hàm dựng dùng chung | `MethodDefinition` với `node.kind === "constructor"` và `node.value.params`; mỗi tham số được bóc từ `TSParameterProperty` ra `.parameter` trước khi đọc bất cứ thứ gì |
| hàm đọc chú thích dùng chung | `param.typeAnnotation.typeAnnotation` phải là `TSTypeReference` có `typeName.type === "Identifier"`; định danh đã viết được so nguyên chuỗi |
| hàm gom decorator dùng chung | Tên gom từ HAI nơi mang — chính nút gốc, và khi nút gốc là `TSParameterProperty` thì cả tham số bên trong — dạng gọi lấy `expression.callee.name` với callee là `Identifier`, dạng trần lấy `expression.name` |
| bộ thăm decorator | Nút `Decorator`, chắn bằng `CallExpression` + callee `Identifier` + đúng tên `Entity`, rồi `.some` trên toàn bộ danh sách đối số |
| với ra ngoài tệp | Không có gì. Không quy tắc nào đọc thông tin kiểu, phân giải import, đi theo một lời gọi hay đọc đường dẫn tệp — tất cả quyết định từ hình dạng đã viết |

## Lối thoát hợp lệ

**Đóng** — người đọc tưởng những cách viết này lọt được, nhưng không.

| Viết thế này | Quy tắc | Vì sao vẫn bị báo |
|---|---|---|
| `constructor(private readonly em: EntityManager)` | `must-inject-entity-manager` | Thuộc tính-tham số được bóc vỏ trước khi đọc kiểu, nên chú thích vẫn tìm thấy ở tham số bên trong |
| `constructor(em?: EntityManager)` | `must-inject-entity-manager` | Tính tuỳ chọn nằm ở tham số chứ không ở chú thích; tham chiếu kiểu không đổi |
| `constructor(readonly em: EntityManager)` không có từ khoá phạm vi truy cập | `must-inject-entity-manager` | Vẫn là `TSParameterProperty`; phép bóc vỏ không quan tâm bổ từ nào sinh ra nó |
| Decorator viết không ngoặc — `@InjectPrimaryEntityManager` | `must-inject-entity-manager` | Nhánh `Identifier` trần gom được tên, nên quy tắc im lặng đúng như với dạng gọi |
| Decorator đặt trên tham số bên trong thay vì trên thuộc tính-tham số | `must-inject-entity-manager` | Cả hai nơi mang đều được đọc; bộ phân tích gắn vào nút nào thì tên vẫn được gom |
| `Repository<UserEntity>` | `no-injected-repository` | Tham số kiểu bị bỏ qua; quy tắc đọc định danh tham chiếu kiểu, tức `Repository` |
| `@InjectRepository(UserEntity) private readonly em: EntityManager` | `no-injected-repository` | Nhánh decorator tự nó đã báo; kiểu của tham số không còn liên quan một khi decorator khớp |
| `constructor(repo: TreeRepository<NodeEntity>)` hoàn toàn không có decorator | `no-injected-repository` | Nhánh kiểu không cần decorator nào |
| `@Entity({ schema: "public" })` | `require-entity-table-name` | Một đối tượng tuỳ chọn không có thuộc tính `name` thì không đặt tên bảng, và từ chối nó chính là lý do cho phép dạng tuỳ chọn tồn tại |
| `@Entity({ "name": "cart_items" })` | `require-entity-table-name` | Khoá là chuỗi ký tự vẫn được chấp nhận: phép kiểm đọc `property.key.name` HOẶC `property.key.value` |
| `@Entity({ ...base, name: "cart_items" })` | `require-entity-table-name` | Phần trải bị bỏ qua và thuộc tính `name` vẫn được `.some` tìm ra |
| `@Entity("cart_items", { schema: "public" })` | `require-entity-table-name` | Đối số nào cũng có thể mang tên; phép kiểm chạy trên cả danh sách đối số |

**Mở** — điểm mù đã xuất xưởng. Một phán quyết không được phép nói rằng những chỗ này đã bị xét.

| Viết thế này | Quy tắc | Vì sao quy tắc không thấy |
|---|---|---|
| `@InjectEntityManager()` — chính decorator trần của khung nền | `must-inject-entity-manager` | Regex là `^Inject\w*EntityManager$` và `\w*` khớp cả chuỗi rỗng. ĐỐI SỐ của decorator không bao giờ được đọc, nên một decorator không nêu tên kết nối nào vẫn thoả một quy tắc mà toàn bộ thông báo nói về việc nêu tên kết nối. Đây là dòng nặng nhất của cả bảng này |
| `@InjectAnythingEntityManager()` cho một nguồn dữ liệu không tồn tại | `must-inject-entity-manager` | Cùng lý do. Quy tắc kiểm hình dạng của TÊN, không bao giờ kiểm cái tên có ứng với một kết nối đã đăng ký |
| Một decorator khai báo tại chỗ mà tình cờ đặt tên đúng dạng | `must-inject-entity-manager` | Danh tính decorator chỉ là một chuỗi. Không import nào được phân giải, nên bất kỳ hàm nào đặt tên đúng dạng cũng làm quy tắc im |
| `em: typeorm.EntityManager` | `must-inject-entity-manager`, `no-injected-repository` | Tên có tiền tố phân tích ra `TSQualifiedName`, mà cả hai quy tắc đòi `typeName.type === "Identifier"`. Cách import cả không gian tên vô hình với toàn bộ mô-đun |
| `import { EntityManager as Manager }`, rồi `em: Manager` | `must-inject-entity-manager` | Quy tắc so định danh đã viết. Bí danh nào, và cả `type Manager = EntityManager`, đều làm rỗng nó |
| `em: EntityManager \| undefined` | `must-inject-entity-manager` | Kiểu hợp là `TSUnionType`, không phải `TSTypeReference`; hàm đọc chú thích trả về null và tham số bị bỏ qua |
| Thuộc tính của lớp — `@Inject(MANAGER) private readonly em: EntityManager` | `must-inject-entity-manager`, `no-injected-repository` | `PropertyDefinition` không được thăm. Với hai quy tắc này chỉ tồn tại tham số hàm dựng |
| `this.dataSource.manager`, `this.dataSource.createEntityManager()`, `moduleRef.get(EntityManager)` | `must-inject-entity-manager` | Không cái nào là tham số. Quy tắc giữ NƠI TIÊM; một bộ quản lý lấy được lúc chạy không có nơi tiêm nào để giữ, và nguồn dữ liệu vẫn được chọn vô hình y hệt |
| Một lớp không giữ bộ quản lý nào | `must-inject-entity-manager` | Không có gì để báo. Tên quy tắc hứa là phải tiêm bộ quản lý; việc nó thật sự làm là ràng buộc một bộ quản lý đã được tiêm sẵn |
| Nhà cung cấp dạng hàm nhà máy — `useFactory: (em: EntityManager) => …` | `must-inject-entity-manager`, `no-injected-repository` | Tham số của một biểu thức hàm không phải tham số của một hàm dựng. Nhà cung cấp dựng kiểu này nằm ngoài cả hai quy tắc |
| `class UserRepository extends Repository<UserEntity>` tiêm vào dạng `repo: UserRepository` | `no-injected-repository` | Thành viên chỉ gồm ba tên viết đúng. Một lớp kho lưu trữ tự viết chính là thứ luật cấm và quy tắc không có cách nào nhận ra |
| `AbstractRepository`, `MongoEntityManager`, hay bất kỳ tên tay cầm nào khác | `no-injected-repository` | Cùng một danh sách đóng ba phần tử |
| `@Inject(getRepositoryToken(UserEntity)) private readonly repo: unknown` | `no-injected-repository` | Tên decorator là `Inject`, không phải `InjectRepository`, và kiểu thì không nằm trong danh sách. Việc tiêm vẫn thành công và quy tắc không nói gì |
| `this.entityManager.getRepository(UserEntity)` trong thân phương thức | `no-injected-repository` | Một kho lưu trữ lấy từ bộ quản lý được tiêm hợp lệ là một lời gọi trong thân phương thức. Quy tắc chỉ nhìn tham số, nên cách một kho lưu trữ thật sự xuất hiện nhiều nhất lại là cách không ai canh |
| Một kho lưu trữ trao vào dạng tham số phương thức hoặc đối số hàm | `no-injected-repository` | Không phải tham số hàm dựng |
| `@Entity("")` | `require-entity-table-name` | Chuỗi rỗng là `Literal` có `value` kiểu chuỗi nên phép kiểm đi qua. Bộ ánh xạ rồi quay về suy tên từ tên lớp — đúng hậu quả quy tắc sinh ra để chặn, đi vào bằng chính nhánh chấp nhận của quy tắc |
| `` @Entity(`${prefix}_items`) `` | `require-entity-table-name` | `TemplateLiteral` được chấp nhận vô điều kiện, kể cả có phần thay thế. `` @Entity(``) `` — chuỗi mẫu rỗng — cũng lọt |
| `@Entity` viết không ngoặc | `require-entity-table-name` | Biểu thức là một `Identifier`, mà lần kiểm đầu đòi `CallExpression`. Quy tắc thoát trước khi nhìn thấy bất cứ gì |
| `import { Entity as Table }`, rồi `@Table("cart_items")` hay `@Table()` | `require-entity-table-name` | Tên callee được so với đúng chuỗi `Entity`. Một bí danh làm quy tắc không tồn tại với cả tệp đó |
| `@Orm.Entity()` | `require-entity-table-name` | Callee dạng truy cập thành viên trượt ở `callee.type === "Identifier"` |
| `@ViewEntity()`, `@ChildEntity()`, và mọi decorator khai báo thực thể khác | `require-entity-table-name` | Chỉ đúng chữ `Entity` được canh |
| Một lược đồ dựng bằng mã thay vì khai báo bằng decorator | `require-entity-table-name` | Không có nút decorator nào. Một thực thể khai báo kiểu này nằm hoàn toàn ngoài quy tắc |
| Mọi thứ `DATA-4` và `DATA-5` cấm — một hàm phụ trợ chạy ngoài giao dịch của nơi gọi, một quan hệ do thực thể quyết thay cho truy vấn | không quy tắc nào | Không có quy tắc nào tồn tại. Cả hai cần đồ thị lời gọi hoặc mục đích của câu trả lời, mà hình dạng đã viết không cung cấp cái nào |

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| source | Một tệp đã phân tích cú pháp; cả ba quy tắc làm việc trên cây cú pháp, không dùng thông tin kiểu |
| parser | TypeScript kèm hỗ trợ decorator và thuộc tính-tham số. Thiếu nó thì `TSParameterProperty`, `TSTypeReference` và `Decorator` không bao giờ xuất hiện và cả ba quy tắc câm vĩnh viễn |
| glob | Cấu hình của kho tiêu thụ quyết định tệp nào bị lint. Một tệp không glob nào gọi tên là một tệp mà mọi quy tắc ở đây không tồn tại |
| severity | Ý kiến của chính các quy tắc là `error` cho cả ba, đo ở mức nợ bằng không trong cây tham chiếu. Một kho tiếp nhận chúng vào cây có sẵn thì đo trước, và mọi con số trên không thì hạ xuống `warn` kèm số đếm bên cạnh |

## Quy tắc

1. Danh tính của một quy tắc là cái tên nó công bố. Không quy tắc nào mang mã số, và không thông báo
   nào được gọi tên bằng thứ gì khác ngoài tên quy tắc.
2. Mọi quy tắc đều báo tại một nút mà người đọc đặt được con trỏ vào: tham số vi phạm, hoặc cả
   decorator.
3. Không quy tắc nào đọc thông tin kiểu, phân giải import, đi theo một lời gọi hay đọc đường dẫn tệp.
   Mọi thứ trong mô-đun này quyết định từ hình dạng đã viết.
4. Hai quy tắc dùng chung một vòng duyệt hàm dựng và một hàm đọc decorator, nên chúng thống nhất tuyệt
   đối về việc thế nào là một tham số hàm dựng và một decorator tên là gì.
5. TÊN của một decorator là bằng chứng; ĐỐI SỐ của một decorator thì không quy tắc nào ở đây đọc.
6. Lời thông báo nêu cả cách thay lẫn hậu quả, không chỉ nêu lỗi.
7. Đây là các quy tắc về hình dạng và chúng không thấy được ý định. Chính vì vậy mỗi quy tắc đều hẹp có
   chủ đích, và cái giá của sự hẹp đó là bảng cửa còn mở ở trên.

## Ngoại lệ

- **Tay cầm lấy được lúc chạy không phải ngoại lệ mà là điểm mù.** Không ai cho phép
  `dataSource.manager` hay `manager.getRepository(...)`; quy tắc chỉ đơn giản không có tham số nào để
  soi. Hãy coi đó là luật chưa được giữ, không phải cách viết được duyệt.
- **Decorator đặt tên nguồn dữ liệu viết trần không phải được phép.** Quy tắc chấp nhận nó vì regex cho
  phần giữa rỗng, không phải vì luật cho phép. Luật đòi **nêu tên kết nối**, và một decorator không có
  tên nào trong đó thì không thoả luật, cũng không thoả chính thông báo mà quy tắc in ra.
- **Lớp kho lưu trữ tự viết không phải được phép.** Danh sách ba tên giới hạn điều **máy dám khẳng
  định**, không giới hạn điều **luật cấm**. Phần còn lại vẫn do người đọc lại giữ.
- **Tên bảng viết gián tiếp bị từ chối, và đó là chi phí của quy tắc chứ không phải của luật.** Một
  hằng số hoặc một bảng tên nhập từ nơi khác là cách đặt tên bảng hoàn toàn chính đáng, mà
  `require-entity-table-name` vẫn kêu. Hãy viết thẳng chuỗi ký tự ở đây, đừng tắt quy tắc cho cả tệp:
  tắt một lần là gỡ hàng rào khỏi **mọi** thực thể trong tệp đó.
- **Tệp sinh tự động hoặc tệp nhập từ nguồn ngoài** nằm ngoài tầm mọi quy tắc ở đây bằng đường cấu hình
  glob của kho tiêu thụ, không bằng bất kỳ miễn trừ nào ở mức quy tắc.

## Đầu ra

Mỗi phát hiện một khối:

```text
rule: <must-inject-entity-manager | no-injected-repository | require-entity-table-name>
code: <DATA-1 | DATA-2 | DATA-3>
node: <the exact node the rule visits>
verdict: <fires | silent>
hatch: <none | the open row from the table above that explains the silence>
```

Một tệp sạch xuất một khối cho mỗi quy tắc đã chạy, mỗi khối mang `verdict: silent` và `hatch: none` —
một lời khẳng định rằng cách viết đã được xét và được thấy là sạch. Một phán quyết `silent` có nêu tên
một cửa còn mở lại là lời khẳng định rằng cách viết đó **chưa được xét**: một sự thật khác hẳn, và
đúng là sự thật mà mô-đun này tồn tại để còn nói ra được. Một tệp nằm ngoài glob của kho tiêu thụ thì
không xuất khối nào, và sự vắng mặt đó phải được ghi là **chưa xét**, không bao giờ được ghi là sạch —
không bộ thăm nào được cài và các quy tắc không hề tồn tại với tệp ấy.

## Ví dụ đã giải

**Đầu vào.** Một dịch vụ và một thực thể, cả hai đều bị mô-đun này từ chối:

```ts
@Injectable()
export class CartService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(CartItemEntity)
    private readonly items: Repository<CartItemEntity>,
  ) {}
}

@Entity()
export class CartItemEntity {
  @PrimaryGeneratedColumn("uuid") id: string
}
```

```text
rule: must-inject-entity-manager
code: DATA-1
node: the unwrapped constructor parameter `em`
verdict: fires
hatch: none
```

```text
rule: no-injected-repository
code: DATA-2
node: the unwrapped constructor parameter `items`
verdict: fires
hatch: none
```

`items` chỉ bị báo một lần chứ không phải hai, dù cả hai vế cùng khớp: tên decorator gom được có chứa
`InjectRepository`, và định danh tham chiếu kiểu là `Repository`.

```text
rule: require-entity-table-name
code: DATA-3
node: the whole `@Entity()` Decorator
verdict: fires
hatch: none
```

**Sau khi sửa.** Bộ quản lý nêu tên nguồn dữ liệu, kho lưu trữ biến mất, bảng được đặt tên:

```ts
@Injectable()
export class CartService {
  constructor(
    @InjectEntityManager()
    private readonly em: EntityManager,
  ) {}

  async items(cartId: string) {
    return this.em.getRepository(CartItemEntity).findBy({ cartId })
  }
}

@Entity("cart_items", { schema: "public" })
export class CartItemEntity {
  @PrimaryGeneratedColumn("uuid") id: string
}
```

Cả ba phán quyết bây giờ đều đọc là `silent`. Một trong ba là tuân thủ thật. Hai cái còn lại thì không:

```text
rule: must-inject-entity-manager
code: DATA-1
node: the unwrapped constructor parameter `em`
verdict: silent
hatch: `@InjectEntityManager()` — the regex is `^Inject\w*EntityManager$` and `\w*` matches the empty string, and the decorator's arguments are never read, so a decorator that names no connection satisfies a rule whose whole message is about naming the connection
```

```text
rule: no-injected-repository
code: DATA-2
node: constructor parameters of `CartService`
verdict: silent
hatch: `this.em.getRepository(CartItemEntity)` is a call expression in a method body; the rule watches parameters only, so the most common way a repository actually appears is unwatched
```

Tệp đã sửa xanh hơn là đúng. `DATA-1` vẫn không biết dịch vụ này ghi vào cơ sở dữ liệu nào, và `DATA-2`
thì trong mã vẫn còn một kho lưu trữ — máy chỉ đơn giản không có nút nào để đặt con trỏ vào. Hai khối
trên tồn tại là vì chuyện đó.

## Phạm vi

Mô-đun này chỉ tài liệu hoá những quy tắc có thật trong tệp nguồn công bố chúng. Một quy tắc đáng có mà
chưa có thì không nằm ở đây — một quy tắc không trỏ vào được là một đề xuất, không phải một quy tắc. Nó
không xét `DATA-4` lẫn `DATA-5`; cả hai vẫn thuộc về người đọc lại thay đổi, đúng chỗ mà nguồn cố ý để
lại. Tên bảng có phải tên ĐÚNG hay không, nguồn dữ liệu có tồn tại hay không, và truy vấn có hỏi đúng
các quan hệ cần thiết hay không đều nằm ngoài mọi quy tắc ở đây. Tên quy tắc, regex, tên decorator và
tên loại nút là các định danh xuất hiện nguyên văn trong kết quả build nên được giữ nguyên chữ.
