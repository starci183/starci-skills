---
id: be-lints-data-access-vi
title: vi.md
slug: /be/lints/data-access/vi
sidebar_label: vi.md
sidebar_position: 1
description: Ba quy tắc truy cập dữ liệu — bắt gì, phát hiện bằng cách nào, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Module: `data-access`

# Truy cập dữ liệu — phần máy giữ được

Tài liệu luật nói **nên viết thế nào**. Tài liệu này nói **máy nhìn thấy được đến đâu**, và quan trọng
hơn: **máy không nhìn thấy chỗ nào**.

Một điều luật không có quy tắc nào giữ thì ai cũng biết là chưa được giữ, nên vẫn còn người đọc lại.
Một quy tắc **thủng** thì nguy hiểm hơn hẳn: mọi người tin là cửa đã đóng nên không ai đọc lại nữa. Vì
vậy mục **Cửa còn mở** dưới mỗi quy tắc mới là phần chính của trang này, không phải phần phụ lục.

Danh tính của một quy tắc là **cái tên nó công bố**. Không có mã số nào cho quy tắc, vì cái tên đã là
chuỗi ký tự hiện trong log build, trong dòng chú thích tắt quy tắc, và trong mọi cuộc trao đổi về lỗi
đó rồi. Đặt thêm một mã số nữa là tạo ra một quy tắc có hai tên và không ai biết thông báo vừa rồi đến
từ tên nào.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `must-inject-entity-manager` | `DATA-1` | Một tham số hàm dựng có kiểu ghi đúng chữ `EntityManager` mà không mang decorator nào thuộc họ đặt tên nguồn dữ liệu |
| `no-injected-repository` | `DATA-2` | Một tham số hàm dựng mang decorator `InjectRepository`, hoặc có kiểu trùng một trong ba tên kho lưu trữ |
| `require-entity-table-name` | `DATA-3` | Một lời gọi `@Entity(...)` mà trong danh sách đối số không có chuỗi ký tự nào đặt tên bảng |

Luật có **năm** điều. Hai điều còn lại — `DATA-4` và `DATA-5` — **cố ý không có quy tắc nào**, và lý do
nằm ngay trong tệp nguồn: muốn biết một hàm phụ trợ có được trao đúng bộ quản lý đang trong giao dịch
hay không thì phải có đồ thị lời gọi, còn muốn biết một quan hệ có đáng được hỏi ở nơi gọi hay không
thì phải biết câu trả lời dùng để làm gì. Cả hai đều do người đọc lại giữ. Chúng nằm ở `audit.md`,
**không** được ánh xạ thành quy tắc.

---

## `must-inject-entity-manager`

**Bắt gì.** Một tham số của hàm dựng, có chú thích kiểu ghi đúng chữ `EntityManager`, mà không có
decorator nào trên nó khớp `/^Inject\w*EntityManager$/`. Thông báo nói rõ hậu quả: kiểu không nói được
**cái nào** trong nhiều cơ sở dữ liệu, nên đoạn mã đọc thì đúng mà lại trỏ sang cơ sở dữ liệu khác.

**Giữ mã nào.** `DATA-1`.

**Cách phát hiện.** Thăm nút `MethodDefinition`, chỉ tiếp tục khi `node.kind === "constructor"`. Với mỗi
tham số: nếu là `TSParameterProperty` thì bóc ra `.parameter`, rồi đọc
`param.typeAnnotation.typeAnnotation` và đòi đúng `TSTypeReference` có `typeName` là `Identifier`. So
tên đó bằng phép **bằng nhau nguyên chuỗi** với `EntityManager`. Tên decorator được gom từ **hai** nơi:
chính nút gốc, và — khi nút gốc là `TSParameterProperty` — cả tham số nằm bên trong nó. Dạng gọi lấy
`expression.callee.name`, dạng trần lấy `expression.name`.

**Vì sao luật này đáng có máy giữ.** Vì cả hai cách viết đều **biên dịch được, chạy được, và đọc lên
đều đúng**. Không có test nào đỏ, không có kiểu nào sai. Sự khác nhau duy nhất nằm ở chỗ dây nối được
buộc vào đâu lúc khởi động, mà chỗ đó thì không ai đọc trong lúc xem lại một thay đổi. Đây đúng là loại
sai lầm mà mắt người bỏ qua đều đặn và máy thì không bao giờ.

**Cửa còn mở.**

- **Chính decorator của khung nền, viết trần.** `@InjectEntityManager()` khớp regex, vì `\w*` khớp cả
  chuỗi rỗng. Mà **đối số của decorator thì không bao giờ được đọc** — nên một decorator không nêu tên
  kết nối nào vẫn làm im một quy tắc mà toàn bộ thông báo của nó là về việc nêu tên kết nối. Đây là
  dòng nặng nhất của cả mô-đun.
- **Tên đúng dạng nhưng trỏ vào hư không.** `@InjectSandboxEntityManager()` cho một nguồn dữ liệu chưa
  hề đăng ký vẫn im. Quy tắc kiểm **hình dạng của cái tên**, không kiểm cái tên có thật.
- **Decorator tự định nghĩa tại chỗ.** Không import nào được phân giải, nên bất kỳ hàm nào đặt tên đúng
  dạng cũng làm im quy tắc.
- **Tên kiểu có tiền tố không gian tên.** `em: orm.EntityManager` phân tích ra `TSQualifiedName`, mà
  điều kiện đòi `Identifier`. Cách viết import cả không gian tên **vô hình** với cả mô-đun này.
- **Bí danh và bí danh kiểu.** `import { EntityManager as Manager }`, hoặc `type Manager = EntityManager`
  rồi `em: Manager` — quy tắc so cái **chữ đã viết**, nên bí danh nào cũng làm rỗng nó.
- **Kiểu hợp.** `em: EntityManager | undefined` là `TSUnionType`, không phải `TSTypeReference`; hàm đọc
  chú thích trả về null và tham số bị bỏ qua.
- **Thuộc tính của lớp.** `@Inject(TOKEN) private readonly em: EntityManager` là `PropertyDefinition`,
  không phải tham số hàm dựng. Không nút nào được thăm.
- **Lấy tay lúc chạy.** `this.dataSource.manager`, `dataSource.createEntityManager()`,
  `moduleRef.get(...)` — không có tham số nào để soi. Quy tắc giữ **nơi tiêm**; một bộ quản lý lấy được
  lúc chạy thì không có nơi tiêm nào để giữ, và nguồn dữ liệu vẫn được chọn một cách vô hình y hệt.
- **Lớp không có bộ quản lý nào.** Không có gì để báo. Tên quy tắc hứa là "phải tiêm bộ quản lý"; việc
  nó thật sự làm là **ràng buộc một bộ quản lý đã được tiêm sẵn**. Đây là chỗ hành vi hẹp hơn cái tên.
- **Nhà cung cấp dạng hàm nhà máy.** `useFactory: (em: EntityManager) => …` có tham số của một biểu
  thức hàm, không phải của một hàm dựng.

---

## `no-injected-repository`

**Bắt gì.** Một tham số hàm dựng thoả **một trong hai** vế: tên decorator gom được có chứa đúng chuỗi
`InjectRepository`, hoặc tên kiểu khớp `/^(?:Repository|TreeRepository|MongoRepository)$/`. Mỗi tham số
báo đúng một lần dù cả hai vế cùng đúng.

**Giữ mã nào.** `DATA-2`.

**Cách phát hiện.** Dùng chung đúng một vòng duyệt hàm dựng và đúng một hàm gom decorator với quy tắc
trên, nên hai quy tắc **thống nhất tuyệt đối** về việc thế nào là một tham số hàm dựng và một decorator
tên là gì. Tham số kiểu tổng quát không bao giờ được đọc: chỉ mỗi định danh quyết định.

**Vì sao luật này đáng có máy giữ.** Vì hậu quả không xuất hiện ở lúc viết mà ở **lần ghi thứ hai**.
Một tình huống nghiệp vụ ghi một bảng thì kho lưu trữ trông hoàn toàn ổn; đúng ngày nó phải ghi thêm
bảng thứ hai trong cùng một giao dịch thì cái tay cầm đó không mang giao dịch đi được, và phần phải sửa
rơi vào bất kỳ mô-đun nào nhận ra trước. Đó là một khoản nợ **không thấy được lúc xem lại đoạn mã đầu
tiên**, nên nó phải bị chặn ngay tại chỗ khai báo.

**Cửa còn mở.**

- **Lớp kho lưu trữ tự viết.** `class UserRepository extends Repository<UserEntity>` rồi tiêm
  `repo: UserRepository` — tên không nằm trong ba tên nên **im hoàn toàn**. Đây chính là thứ luật cấm,
  mặc đúng bộ đồ mà quy tắc không nhận ra.
- **Mọi tên tay cầm khác.** `AbstractRepository`, `MongoEntityManager`, một lớp bao bọc nội bộ — cùng
  một lý do: danh sách chỉ có ba phần tử.
- **Tiêm bằng token.** `@Inject(getRepositoryToken(UserEntity))` có tên decorator là `Inject`, không
  phải `InjectRepository`; kiểu thì viết gì cũng được. Việc tiêm vẫn thành công và quy tắc không nói gì.
- **Lấy kho lưu trữ từ bộ quản lý hợp lệ.** `this.entityManager.getRepository(UserEntity)` nằm trong
  thân một phương thức. Quy tắc chỉ nhìn tham số, nên **cách một kho lưu trữ thật sự xuất hiện nhiều
  nhất** lại là cách không ai canh.
- **Tên kiểu có tiền tố không gian tên hoặc bí danh.** `orm.Repository<T>`, hoặc
  `type UserRepo = Repository<UserEntity>` — cùng một điểm mù với quy tắc trên.
- **Thuộc tính của lớp.** `@InjectRepository(UserEntity) private repo: Repository<UserEntity>` viết
  thành thuộc tính chứ không thành tham số thì không nút nào được thăm.
- **Tham số của phương thức hoặc của hàm nhà máy.** Cùng lý do: không phải tham số hàm dựng.

---

## `require-entity-table-name`

**Bắt gì.** Một decorator viết dạng gọi, callee là `Identifier` tên đúng `Entity`, mà không đối số nào
đặt tên bảng. Tên bảng được công nhận ở hai dạng: một chuỗi ký tự trực tiếp, hoặc một đối tượng tuỳ
chọn có khoá `name` không tính toán mang một chuỗi ký tự. Báo tại **cả decorator**, không phải tại đối
số.

**Giữ mã nào.** `DATA-3`.

**Cách phát hiện.** Ba lần kiểm liên tiếp, mỗi lần thoát sớm: phải là `CallExpression`, callee phải là
`Identifier`, tên callee phải bằng `Entity`. Sau đó `.some` trên danh sách đối số. Dạng đối tượng tuỳ
chọn được chấp nhận **có chủ đích** — nguồn ghi rõ lý do: đó là dạng **duy nhất** còn mang được phần
chỉ định lược đồ, nên từ chối nó sẽ đẩy người viết đi xoá lược đồ để làm hài lòng quy tắc, một kết cục
tệ hơn cái tên suy ra mà quy tắc sinh ra để chặn.

**Vì sao luật này đáng có máy giữ.** Vì chi phí của lỗi này **không tỉ lệ** với chi phí của thao tác
gây ra nó. Đổi tên một lớp là một thao tác dọn dẹp, làm trong hai giây, không ai nghĩ phải xin phép ai.
Nếu tên bảng đi theo tên lớp thì cùng thao tác đó biến thành một lần bỏ bảng và tạo lại bảng rỗng. Một
sự chênh lệch lớn như vậy giữa **ý định** và **hậu quả** là chỗ duy nhất mà một quy tắc máy thật sự
đáng giá.

**Cửa còn mở.**

- **Chuỗi rỗng.** `@Entity("")` là `Literal` có `value` kiểu chuỗi, nên **lọt**. Rồi bộ ánh xạ lại quay
  về suy ra tên từ tên lớp — đúng cái hậu quả mà quy tắc sinh ra để chặn, đi vào bằng chính nhánh chấp
  nhận của quy tắc.
- **Chuỗi mẫu có thay thế.** `` @Entity(`${prefix}_items`) `` được chấp nhận vô điều kiện; `` @Entity(``) ``
  rỗng cũng vậy. Quy tắc công nhận **loại nút**, không công nhận **giá trị**.
- **Viết không có ngoặc.** `@Entity` trần có `expression` là `Identifier`, và lần kiểm đầu tiên đòi
  `CallExpression` — quy tắc thoát trước khi nhìn thấy gì.
- **Bí danh khi import.** `import { Entity as Table }` rồi `@Table()` — tên callee được so với đúng
  chuỗi `Entity`. Một dòng import làm quy tắc **không tồn tại** với cả tệp đó.
- **Callee dạng truy cập thành viên.** `@Orm.Entity()` trượt ở lần kiểm thứ hai.
- **Các decorator khai báo thực thể khác.** `@ViewEntity()`, `@ChildEntity()` — chỉ đúng chữ `Entity`
  được canh.
- **Lược đồ dựng bằng mã.** Một thực thể khai báo bằng đối tượng cấu hình thay vì bằng decorator thì
  không có nút decorator nào; quy tắc không có gì để nhìn.
- **Chiều ngược lại — bắt nhầm.** `@Entity(TABLES.cartItems)` và `@Entity({ name: TABLE_NAME })`
  **đều bị báo lỗi**, dù bảng đã được đặt tên hẳn hoi. Đây là chỗ mẫu "hằng số rửa sạch chuỗi ký tự"
  chạy **ngược**: gom chuỗi vào một hằng số không làm quy tắc im, nó làm quy tắc kêu oan. Khoá tính
  toán `@Entity({ ["name"]: "cart" })` và `@Entity({ ...OPTIONS })` cũng vậy.

---

## Luật

- Ba quy tắc, ba mã, ánh xạ một-một: `must-inject-entity-manager` giữ `DATA-1`,
  `no-injected-repository` giữ `DATA-2`, `require-entity-table-name` giữ `DATA-3`.
- `DATA-4` và `DATA-5` **không có quy tắc nào**, và đó là một quyết định có ghi lý do trong nguồn, không
  phải một thiếu sót cần vá.
- Chỉ tài liệu hoá quy tắc **có thật trong tệp nguồn**. Một quy tắc đáng có mà chưa có thì không nằm ở
  đây; nó nằm ở `audit.md`, mục rủi ro.
- Tên quy tắc **không bao giờ được viết lại**, kể cả khi nó chứa một từ gắn với sản phẩm, vì đó là chuỗi
  mà bản build in ra.
- Không quy tắc nào đọc thông tin kiểu, phân giải import, đi theo một lời gọi hay đọc đường dẫn tệp.
  Tất cả đều quyết định từ **hình dạng đã viết**.
- **Tên** của một decorator là bằng chứng; **đối số** của một decorator thì không quy tắc nào ở đây đọc.

## Ngoại lệ

- **Tay cầm lấy được lúc chạy không phải ngoại lệ mà là điểm mù.** Không ai cho phép `dataSource.manager`
  hay `manager.getRepository(...)`; quy tắc chỉ đơn giản không có tham số nào để soi. Hãy coi đó là luật
  chưa được giữ, không phải cách viết được duyệt.
- **Decorator đặt tên nguồn dữ liệu viết trần không phải được phép.** Quy tắc chấp nhận nó vì regex cho
  phần giữa rỗng, không phải vì luật cho phép. Luật đòi **nêu tên kết nối**, và một decorator không có
  tên nào trong đó thì không thoả luật, cũng không thoả chính thông báo mà quy tắc in ra.
- **Lớp kho lưu trữ tự viết không phải được phép.** Danh sách ba tên giới hạn điều **máy dám khẳng
  định**, không giới hạn điều **luật cấm**. Phần còn lại vẫn do người đọc lại giữ.
- **Tên bảng viết gián tiếp bị từ chối, và đó là chi phí của quy tắc chứ không phải của luật.** Một hằng
  số hoặc một bảng tên nhập từ nơi khác là cách đặt tên bảng hoàn toàn chính đáng, mà quy tắc vẫn kêu.
  Hãy viết thẳng chuỗi ký tự ở đây, đừng tắt quy tắc cho cả tệp: tắt một lần là gỡ hàng rào khỏi **mọi**
  thực thể trong tệp đó.
- **Tệp sinh tự động hoặc tệp nhập từ nguồn ngoài** nằm ngoài tầm mọi quy tắc ở đây bằng đường **cấu
  hình glob** của kho tiêu thụ, không bằng bất kỳ miễn trừ nào ở mức quy tắc.
