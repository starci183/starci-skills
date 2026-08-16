---
id: be-lints-data-access-audit
title: audit.md
slug: /be/lints/data-access/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện xem ba quy tắc truy cập dữ liệu có giữ được đúng phần luật mà người ta tin là chúng giữ.
---

# audit.md

> Version: `2.00` · Module: `data-access`

Phản biện này không hỏi luật có đúng không — luật nằm ở tài liệu khác. Nó hỏi một câu duy nhất: **cái
mà mọi người tin là máy đang giữ có bằng cái máy thật sự giữ không?**

## Verdict

Chấp nhận, kèm điều kiện: mô-đun chỉ được đọc **cùng với** bảng cửa còn mở. Ba quy tắc đều chính xác
trong phạm vi của mình, dùng chung một vòng duyệt nên không mâu thuẫn nhau, và không quy tắc nào cần
thông tin kiểu. Nhưng phạm vi của cả ba đều hẹp hơn cái tên gợi ra, và **một** trong ba có một nhánh
chấp nhận dẫn thẳng tới đúng cái hậu quả nó sinh ra để chặn. Đọc riêng `INDEX.md` mục `## Rules` sẽ dẫn
tới kết luận sai rằng ba mã luật đã được giữ kín.

**Đếm quy tắc.** Tệp nguồn công bố **đúng ba** quy tắc trong đối tượng `rules`:
`must-inject-entity-manager`, `no-injected-repository`, `require-entity-table-name`. Con số này khớp
với con số dự kiến, và cũng khớp với khối chú thích đầu tệp — chú thích nói "ba quy tắc", và nói luôn
hai điều luật mà nó **cố ý** không giữ. Đây là một tệp luật có chú thích **chưa lạc hậu**, chuyện đáng
ghi nhận chứ không đáng coi là mặc định.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Mỗi quy tắc có ánh xạ được vào đúng một mã luật không | Được — ba quy tắc, ba mã, một-một, không quy tắc nào không có mã |
| Mỗi mã luật có quy tắc giữ không | Ba trên năm. `DATA-4` và `DATA-5` **cố ý** không có, và nguồn ghi rõ lý do |
| Danh tính quy tắc có mơ hồ không | Không — danh tính là **tên công bố**, không mã số nào được đặt thêm |
| Hai quy tắc có cùng bắt một tham số không | Không — một bên đòi tên kiểu bằng đúng `EntityManager`, bên kia đòi ba tên khác hẳn; hai tập rời nhau |
| Hai quy tắc có hiểu "tham số hàm dựng" giống nhau không | Có — dùng chung `constructorParams`, `unwrapParam`, `paramTypeName`, `paramDecorators`. Sửa một chỗ là đổi cả hai |
| Thông báo có nêu hậu quả, không chỉ nêu lỗi không | Có ở cả ba; cả ba đều viết ra cái hỏng sẽ xảy ra chứ không chỉ gọi tên vi phạm |
| Có quy tắc nào cần thông tin kiểu không | Không — cả ba chạy được trên cây cú pháp thuần |
| Có quy tắc nào bắt nhầm không | Có một: `require-entity-table-name` báo lỗi mọi tên bảng viết gián tiếp |
| `recommended` có khớp `meta.type` không | Khớp — cả ba khai `problem`, cả ba đặt ở `error`. Phân loại và mức nghiêm trọng nói cùng một điều |
| Có quy tắc nào khai `fixable` không | Không quy tắc nào. Xem mục Quyết định |

## Findings

1. **`must-inject-entity-manager` hẹp hơn tên của nó, ở hai tầng.** Tầng thứ nhất: nó không đòi ai
   phải **tiêm** gì cả — một lớp không có bộ quản lý nào, hoặc lấy bộ quản lý từ một nguồn dữ liệu lúc
   chạy, đều thoả quy tắc vì không có tham số nào để soi. Tầng thứ hai, nặng hơn: nó không đòi **nêu
   tên** nguồn dữ liệu, nó chỉ đòi một cái tên decorator **có hình dạng** như thể nêu tên.
2. **Regex `^Inject\w*EntityManager$` cho phần giữa rỗng.** Nên chính decorator trần của khung nền —
   `@InjectEntityManager()` — đi lọt. Đối số của decorator không bao giờ được đọc, mà đó lại là chỗ dạng
   trần đặt tên kết nối. Kết quả: một cách viết **không nêu tên kết nối nào** làm im một quy tắc mà
   toàn bộ thông báo của nó là về việc nêu tên kết nối. Đây là phát hiện nặng nhất của bản phản biện này.
3. **Toàn mô-đun mù trước tiền tố không gian tên và bí danh.** `orm.EntityManager`, `orm.Repository<T>`,
   `type Manager = EntityManager`, `import { Entity as Table }` — bốn cách viết bình thường, ba quy tắc
   im hết. Không phải ba lỗ riêng lẻ: đây là **một** lựa chọn kiến trúc — quyết định bằng chữ đã viết,
   không phân giải import — và nó phải được đọc như một lựa chọn, có giá của nó.
4. **`no-injected-repository` chỉ biết ba cái tên.** Một lớp kho lưu trữ tự viết kế thừa từ kho lưu trữ
   gốc là **đúng thứ luật cấm**, và quy tắc không có cách nào nhận ra. Ai muốn né chỉ cần đặt tên khác.
5. **Cách một kho lưu trữ thật sự xuất hiện nhiều nhất lại không được canh.**
   `manager.getRepository(...)` trong thân một phương thức không phải tham số hàm dựng. Quy tắc giữ
   **nơi tiêm**, còn cái tay cầm thì có thể sinh ra ở bất kỳ dòng nào.
6. **`require-entity-table-name` đòi một *chuỗi ký tự*, không đòi một *cái tên*.** Đây là chỗ duy nhất
   trong mô-đun mà quy tắc **bắt nhầm**: `@Entity(TABLES.cartItems)` và `@Entity({ name: TABLE_NAME })`
   đã đặt tên bảng đàng hoàng mà vẫn bị báo lỗi. Mẫu "hằng số rửa sạch chuỗi ký tự" ở đây chạy **ngược
   chiều** so với chỗ nó thường xuất hiện: gom vào hằng số không mở cửa cho lỗi, nó tạo ra tiếng kêu oan.
7. **`@Entity("")` lọt qua nhánh chấp nhận.** Chuỗi rỗng là `Literal` có `value` kiểu chuỗi. Bộ ánh xạ
   sau đó quay về suy ra tên từ tên lớp — tức là **đúng cái hậu quả** quy tắc sinh ra để chặn, đi vào
   bằng chính cánh cửa quy tắc mở ra để công nhận cách viết đúng.
8. **Chuỗi mẫu được công nhận theo loại nút, không theo giá trị.** `` @Entity(`${prefix}_items`) `` im,
   và không ai đọc tệp đó biết bảng tên là gì. Nếu lý do tồn tại của luật là để tên bảng **đọc được ngay
   tại chỗ**, thì nhánh này thoả về cú pháp mà không thoả về mục đích.
9. **`@Entity` viết không ngoặc thì quy tắc thoát ngay.** Đây là cửa hở về mặt cú pháp, nhưng cần đọc
   kèm hoàn cảnh: viết như vậy thì bộ ánh xạ nhận chính cái lớp làm đối số và hành vi hỏng ở tầng khác.
   Ghi lại vì nó **im**, không vì nó là cách viết ai đó sẽ chọn.
10. **Quy tắc không kiểm decorator đang gắn vào cái gì.** Visitor là `Decorator`, không có điều kiện nào
    đòi nút được trang trí là một khai báo lớp. Một decorator tên `Entity` đến từ nơi khác, gắn vào chỗ
    khác, vẫn bị đem ra kiểm.
11. **Không quy tắc nào khai `fixable`.** Với `DATA-1` và `DATA-2` thì đúng — máy không đoán được nên
    dùng kết nối nào, và đổi từ kho lưu trữ sang bộ quản lý là viết lại thân phương thức, không phải
    thay một chuỗi. Với `DATA-3` thì đây là một lựa chọn: máy **có thể** suy ra tên bảng từ tên lớp,
    nhưng chính việc "tên bảng đi theo tên lớp" là thứ luật muốn xoá, nên một bản sửa tự động sẽ đóng
    băng đúng cái nó phản đối.
12. **`DATA-4` và `DATA-5` không có quy tắc, và đó là một quyết định chứ không phải một thiếu sót.**
    Nguồn nói thẳng: một quy tắc đoán bừa ở hai chỗ này sẽ **kêu trên đoạn mã đúng**. Chúng nằm ở mục
    rủi ro dưới đây, **không** được ánh xạ thành quy tắc ở `INDEX.md`: một quy tắc không chỉ tay vào
    được là một đề xuất, không phải một quy tắc.

## Decisions

- Tài liệu hoá **đúng ba** quy tắc có thật trong tệp nguồn. Không quy tắc nào được bịa thêm cho đẹp bảng
  ánh xạ, kể cả khi luật có năm mã.
- Lấy **tên công bố** làm danh tính. Không đặt mã số cho quy tắc; đặt thêm là tạo ra một quy tắc hai tên
  và không ai biết thông báo đến từ tên nào.
- Giữ nguyên chính tả của mọi định danh, kể cả khi nó chứa một từ gắn với sản phẩm, vì đó là chuỗi mà
  bản build in ra. Lệnh cấm tên sản phẩm áp cho **văn xuôi và ví dụ**, không áp cho định danh.
- Coi bảng **Open** ở `INDEX.md` là phần bắt buộc của mô-đun. Không dòng nào được ghi "không có" cho gọn
  bảng.
- Ghi nhận dạng đối tượng tuỳ chọn của `@Entity` là **được chấp nhận có chủ đích**, kèm lý do có sẵn
  trong nguồn: đó là dạng duy nhất còn mang được phần chỉ định lược đồ, nên từ chối nó sẽ đẩy người viết
  đi xoá lược đồ.
- Không đề xuất quy tắc mới ở đây. Mọi khoảng trống nằm ở mục rủi ro dưới đây, kèm cái mà một quy tắc sẽ
  phải soi để đóng được nó.

## Rủi ro còn mở

Mỗi dòng: cửa còn mở, rồi **cái mà quy tắc phải soi để đóng nó** — hoặc lý do đóng đắt hơn để mở.

**`must-inject-entity-manager`**

- **Decorator trần khớp regex mà không nêu kết nối.** Đóng được và **nên** đóng ngay: sau khi khớp tên,
  đọc tiếp `expression.arguments` và đòi hoặc phần giữa của tên khác rỗng, hoặc có ít nhất một đối số là
  chuỗi ký tự. Rẻ về kỹ thuật, và nó khép đúng phần luật mà thông báo của quy tắc đang hứa. Đây là
  khoảng trống đáng đóng nhất của cả mô-đun.
- **Tên đúng dạng trỏ vào nguồn dữ liệu chưa đăng ký.** Không đóng được ở tầng lint: muốn biết một kết
  nối có thật thì phải đọc cấu hình lúc chạy. Đúng chỗ để chặn là một phép kiểm lúc khởi động, nơi danh
  sách kết nối đã tồn tại.
- **Tiền tố không gian tên, bí danh import, bí danh kiểu, kiểu hợp.** Đóng được một phần: chấp nhận thêm
  `TSQualifiedName` và duyệt các nhánh của `TSUnionType`. Phần **không** đóng được bằng cây cú pháp là
  bí danh kiểu — muốn biết `Manager` là `EntityManager` thì phải có thông tin kiểu, và đó là một mô hình
  chi phí khác hẳn với cả mô-đun này.
- **Thuộc tính của lớp và tham số của hàm nhà máy.** Đóng được: thêm visitor `PropertyDefinition`, và
  thêm tham số của biểu thức hàm nằm trong một thuộc tính tên `useFactory`. Vế đầu rẻ; vế sau phải nhận
  ra một hình dạng nhà cung cấp bằng quy ước đặt tên, nên dễ vừa sót vừa bắt nhầm.
- **Bộ quản lý lấy tay lúc chạy.** Đóng được một phần bằng một quy tắc **riêng** cấm đọc thuộc tính
  `manager` của một nguồn dữ liệu và cấm gọi hàm tạo bộ quản lý. Không nên nhét thêm nhánh vào quy tắc
  này: nó đang là một quy tắc về **nơi tiêm**, và một quy tắc về **thân phương thức** là một quy tắc
  khác, có tập bắt nhầm khác.
- **Lớp không tiêm gì cả.** Không đóng được, và không nên: "phải có một bộ quản lý" không phải là điều
  luật nói. Luật nói *nếu* có thì phải nêu tên. Cái cần sửa ở đây là **cái tên quy tắc**, không phải
  hành vi của nó.

**`no-injected-repository`**

- **Lớp kho lưu trữ tự viết.** Đóng được ở một mức: bắt thêm mọi tên kiểu kết thúc bằng `Repository`.
  Chi phí thật nằm ở chỗ khác — một kho mã có thể đang dùng hậu tố đó cho một khái niệm khác hẳn, nên
  cần khảo sát trước, không thêm mù quáng. Đóng **kín** thì phải theo được `extends`, tức là cần thông
  tin kiểu.
- **Tiêm bằng token.** Đóng được: bắt `@Inject(...)` mà đối số là một lời gọi hàm sinh token của kho lưu
  trữ. Hẹp, rẻ, và bắt đúng một cách né đã biết.
- **`manager.getRepository(...)` trong thân phương thức.** Đóng được bằng một quy tắc riêng thăm
  `CallExpression` và so tên hàm. Chi phí là bắt nhầm: một lần đọc chỉ để dựng truy vấn cũng bị kêu. Vì
  vậy nó xứng đáng là một quy tắc riêng có mức nghiêm trọng riêng, không phải một nhánh nhét thêm.
- **Thuộc tính của lớp.** Đóng được cùng lúc với gạch tương ứng ở quy tắc trên, bằng cùng một visitor.
- **Tiền tố không gian tên và bí danh kiểu.** Cùng một lời như trên; phần bí danh cần thông tin kiểu.

**`require-entity-table-name`**

- **`@Entity("")` lọt.** Đóng được và **nên** đóng ngay: đòi `argument.value.trim().length > 0`. Một
  dòng, không có chi phí nào đi kèm, và nó bịt đúng lỗ dẫn thẳng tới hậu quả quy tắc sinh ra để chặn.
- **Chuỗi mẫu có thay thế.** Đóng được: chỉ chấp nhận `TemplateLiteral` khi nó không có phần thay thế
  nào. Chi phí gần bằng không, vì một chuỗi mẫu không thay thế thì đã là một chuỗi ký tự.
- **Kêu oan với tên bảng viết gián tiếp.** Không đóng được bằng cây cú pháp thuần: muốn biết
  `TABLES.cartItems` là chuỗi gì thì phải lần theo giá trị qua các tệp. Đây là **rủi ro duy nhất ở đây
  có thể khiến người ta tắt luôn quy tắc**, mà tắt thì mất cả phần đang làm đúng. Cách sống chung đã ghi
  ở `INDEX.md` mục `## Exceptions`: viết thẳng chuỗi ở chỗ này, đừng tắt quy tắc cho cả tệp.
- **Khoá tính toán và đối tượng tuỳ chọn chỉ có phần trải.** Đóng được một nửa: chấp nhận khoá tính toán
  khi nó là một chuỗi ký tự. Phần trải thì không, vì nội dung nằm ở tệp khác.
- **Bí danh import và callee dạng truy cập thành viên.** Đóng được: so tên callee sau khi lần về khai
  báo import trong cùng tệp, và chấp nhận thêm `MemberExpression` khi phần thuộc tính tên `Entity`. Vế
  sau rẻ; vế trước là một lượng việc đáng kể cho một cách né hiếm gặp.
- **Các decorator khai báo thực thể khác.** Đóng được bằng cách nới tập tên được canh. Cần khảo sát
  trước: mỗi decorator có bộ đối số riêng, và công nhận sai dạng đối số sẽ tạo ra một loại kêu oan mới.
- **Lược đồ dựng bằng mã, không dùng decorator.** Không đóng được từ quy tắc này. Muốn giữ thì phải là
  một quy tắc riêng đọc đối tượng cấu hình — đúng chỗ hơn, và ngoài phạm vi mô-đun này.
- **Không kiểm nút được trang trí.** Đóng được và rẻ: đòi `node.parent.type` là một khai báo lớp. Ít
  giá trị thực tế; ghi lại cho đủ.

**Nghĩa vụ của luật chưa có quy tắc nào**

- **`DATA-4` — giao dịch phải được truyền vào.** Muốn giữ thì phải biết, ở mỗi lời gọi, hàm được gọi
  đang dùng bộ quản lý nào: tức là cần **đồ thị lời gọi**, không phải cây cú pháp một tệp. Nguồn nói
  thẳng lý do không làm: một quy tắc đoán bừa sẽ kêu trên đoạn mã đúng, và một quy tắc kêu oan là một
  quy tắc bị tắt. Đây là luật do người đọc lại giữ, và điều đúng đắn duy nhất cần làm là **nói ra** rằng
  nó chưa được giữ.
- **`DATA-5` — truy vấn tự nêu thứ nó cần.** Cùng một lời, vì lý do khác: muốn biết một quan hệ có đáng
  được hỏi hay không thì phải biết **câu trả lời dùng để làm gì**, và đó là một phán đoán ngữ nghĩa. Có
  đúng **một** lát cắt đóng được rẻ và đáng cân nhắc riêng: cấm khai `eager: true` trên khai báo quan hệ
  của thực thể. Nó không giữ được cả điều luật, nhưng nó giữ được vế mà điều luật gọi tên trong bảng cấm.

## Re-audit Triggers

- Tệp nguồn công bố thêm hoặc bớt một quy tắc, hoặc đổi một tên công bố.
- Một mã `DATA-<n>` mới xuất hiện trong luật, hoặc một mã hiện có đổi phạm vi.
- `DATA-4` hoặc `DATA-5` có quy tắc lần đầu — khi đó phải đọc lại toàn bộ mục rủi ro này, không chỉ dòng
  tương ứng.
- Một dòng trong bảng **Open** được đóng lại trong nguồn — dòng đó phải chuyển sang bảng **Closed** cùng
  lúc, không để trễ một phiên bản.
- Regex họ decorator, danh sách ba tên kho lưu trữ, hoặc tập dạng đối số được công nhận là tên bảng đổi
  nội dung.
- Có người tắt một quy tắc ở mức tệp hoặc mức thư mục: đó là bằng chứng bắt nhầm, và bắt nhầm là lý do
  quy tắc chết. Ngờ trước `require-entity-table-name` ở một tệp có bảng tên viết gián tiếp.
- Kho mã bắt đầu dùng import cả không gian tên cho tầng ánh xạ — khi đó cả ba quy tắc im cùng lúc mà
  không ai nhận ra.
- Xuất hiện một cách viết né quy tắc mà bảng **Open** chưa có dòng nào cho nó.
