---
title: CQRS · Vietnamese
---

# Tách lệnh và truy vấn

## LOADS

None.


## Bản ghi

Gate này nhận mã đã viết xong — một tệp, một mẩu diff. Kết quả là một **phán quyết**: tệp đó có nằm trong
phạm vi hay không, luật máy nào đã nổ, nó báo gì và trên nút nào, điều đó ứng với mã luật nào, và cách
viết nào sẽ khiến chính luật máy ấy im lặng. Mô-đun này không chọn thiết kế nào cả. Nó từ chối một
thiết kế, và nó phải chỉ được ra đúng cái nút mà nó từ chối.

## Luật

Luật mang bảy mã, `CQRS-1` đến `CQRS-7`. Tài liệu này ghi một chuyện hẹp hơn mà hữu dụng hơn: **máy
giữ được mã nào, giữ bằng cơ chế gì, và cơ chế đó hết tác dụng từ chỗ nào.**

Bốn trong bảy mã nay có lát cắt mà parser nhìn thấy được. Các phán đoán còn lại — công việc
nằm ở đâu, lớp điều phối mỏng đến mức nào, người gọi có đang đợi một
sự kiện hay không — là **phán đoán**. Một quy tắc đoán mò mấy thứ đó sẽ báo nhầm trên code đúng đủ
nhiều lần để mọi người học được cách tắt nó đi, và một quy tắc bị tắt thì không giữ gì cả trong khi
trông vẫn như đang giữ.

Nên câu nói trung thực về mức thực thi là: luật nêu bảy mã, **bốn mã có quy tắc còn ba mã chưa có proof
máy đầy đủ — và bốn mã có quy tắc thì bản thân quy tắc vẫn hở những chỗ đã biết.** Cả hai nửa của câu đó
đều quan trọng. Một mã không có quy tắc thì ai cũng biết là chưa có ai giữ, nên vẫn còn được đọc bằng
mắt. Một quy tắc bị tin là kín mà thật ra hở thì tệ hơn: nó mua sự im lặng và trả bằng cảm giác đã
được che.

## Luật máy đã xuất bản

| Quy tắc | Mã | Nó báo gì |
|---|---|---|
| `handler-overrides-process` | `CQRS-3` | Lớp xử lý có decorator mà khai báo `execute` (`overridesExecute`), hoặc lớp xử lý có decorator, không kế thừa ai, mà không khai cả `execute` lẫn `process` (`noProcess`) |
| `message-carries-params-only` | `CQRS-2` | Lớp không decorator trong tệp thông điệp khai một phương thức ngoài hàm dựng (`method`), hoặc hàm dựng của nó không nhận đúng một tham số tên `params` (`shape`) |
| `handler-has-twin-spec` | `CQRS-7` | Tệp lớp xử lý mà tên thao tác của nó không có `<operation>.handler.spec.ts` tương ứng trong danh sách do cấu hình đưa vào (`missing`) |
| `no-handler-encoded-failure` | `CQRS-5` | `process` của handler trả object mang `success: false` hoặc `error` thay vì ném domain exception gọi tên thất bại. |

Mọi quy tắc đã xuất bản đều ứng với một mã luật. `CQRS-1`, `CQRS-4` và `CQRS-6` chưa có proof máy đầy
đủ. `no-handler-encoded-failure` chỉ giữ các hình dạng object trả về đóng mà nó gọi tên; nó không chứng
minh mọi nhánh failure đều ném đúng exception.

Mức nghiêm trọng mà mô-đun đề nghị, đúng như đang phát hành: `handler-overrides-process` ở `error` và
`message-carries-params-only` ở `error`, vì nợ đo được của mỗi quy tắc đã trả về không;
`handler-has-twin-spec` ở `off`, vì nó trơ khi chưa có danh sách thư mục truyền vào như một tuỳ chọn,
và kho mã nào cung cấp danh sách ấy thì tự bật nó lên. Một quy tắc chỉ lên `error` khi số đo bằng
không. Phát hành ở `error` khi còn nợ sẽ chặn mọi lần commit chạm vào chỗ vi phạm, và đó chính là cách
một quy tắc bị tắt trọn gói thay vì được trả nợ dần.

## Đọc một diff

1. **Quyết phạm vi trước mọi thứ khác, và ghi lại.** Nằm ngoài phạm vi ở đây không có nghĩa là tệp đã
   qua — nghĩa là quy tắc trả về một bộ duyệt rỗng và không tồn tại với tệp đó.
2. **Kiểm các cổng.** `message-carries-params-only` đòi tên tệp khớp
   `/\/([a-z0-9-]+)\.(command|query)\.ts$/`; `handler-has-twin-spec` đòi
   `/\/([a-z0-9-]+)\.handler\.ts$/` **và** một mảng tại `context.options[0].specs`;
   `handler-overrides-process` không có cổng tên tệp nào cả và sống ở mọi tệp.
3. **Kiểm các miễn trừ trước khi đọc thành viên lớp.** Lớp không decorator không phải lớp xử lý; lớp
   mang bất kỳ decorator nào trong tệp thông điệp được miễn hoàn toàn; lớp có lớp cha được miễn nửa
   phép kiểm thiếu `process`.
4. **Đọc kiểu nút, đừng đọc tên.** Một phương thức và một trường trùng tên là hai chứng cứ khác nhau,
   và mọi phép duyệt ở đây chỉ đọc `MethodDefinition`.
5. **Xuất một khối cho mỗi phát hiện**, và viết dòng `hatch` mỗi khi có một lối thoát còn mở đủ sức
   làm chính quy tắc ấy im lặng.
6. **Đừng báo thứ không quy tắc nào canh.** Bốn trong bảy mã không có máy; một phán quyết nói khác đi
   là nói sai về mô-đun này.

## `handler-overrides-process` — CQRS-3

**Nó báo cái gì.** Hai chuyện khác nhau dưới hai thông điệp khác nhau. `overridesExecute` — một lớp
mang decorator xử lý mà khai báo phương thức `execute`; nó tự bước ra khỏi phương thức khuôn mẫu ở lớp
cơ sở, nơi `execute` công khai là chỗ gọi vào `process` được bảo vệ, nên ghi đè `execute` là cắt đứt
đoạn nối đó. `noProcess` — một lớp mang decorator xử lý, không kế thừa ai, mà không khai `process`;
lớp cơ sở khai `process` là trừu tượng và gọi nó từ `execute`, nên một lớp xử lý không cài đặt cái nào
thì không có việc gì để điều phối tới.

**Nó phát hiện bằng gì.** Chỉ thăm `ClassDeclaration`. Cổng: lớp phải mang một decorator có biểu thức
là `Identifier`, hoặc là `CallExpression` với `callee` kiểu `Identifier`, mà tên khớp
`/^(?:Command|Query|Events)Handler$/`. Sau đó duyệt `node.body.body` tìm `MethodDefinition` có
`key.name` là `execute`; thấy thì báo ngay tại khoá đó rồi dừng. Không thấy: nếu `node.superClass` tồn
tại thì thôi, còn không thì tìm `MethodDefinition` có `key.name` là `process` và báo nếu vắng. Không
có cổng theo tên tệp.

**Điểm mù.** `override execute = async (command: C) => { … }` — trường của lớp là
`PropertyDefinition`, không phải `MethodDefinition`; nó vẫn che phương thức của lớp cơ sở lúc chạy,
nghĩa là khuôn mẫu **thật sự** bị bỏ, mà phép duyệt chỉ nhìn phương thức. `async ["execute"](command:
C) { … }` hoặc bất kỳ khoá tính toán nào — phép duyệt so `member.key.name`, mà khoá dạng chuỗi hay
khoá tính toán không có `.name`, nên nó so với `undefined`. Bất kỳ lớp xử lý nào `extends` một thứ gì
đó mà không cài `process` — `if (node.superClass) return` khiến phép kiểm thiếu `process` chỉ áp cho
lớp đứng một mình, vốn là hình dạng hiếm hơn; lớp xử lý đúng chuẩn thì kế thừa lớp cơ sở khuôn mẫu,
nên hình dạng phổ biến nhất lại đúng là hình dạng nửa quy tắc này không bao giờ soi.
`@nest.CommandHandler(C)`, hoặc `import { CommandHandler as Handles }` rồi `@Handles(C)` — `callee`
kiểu `MemberExpression` không cho ra tên nào nên lớp không được nhận là lớp xử lý, và biểu thức chính
quy khớp cách viết định danh tại chỗ chứ không khớp thứ nó phân giải ra; đổi tên khi nhập là cả quy
tắc tắt hẳn với tệp đó. Và một decorator bọc của riêng dự án, bất cứ thứ gì không viết đúng
`CommandHandler`, `QueryHandler` hay `EventsHandler`, làm mọi lớp xử lý bên dưới nó biến mất, vì tập
tên decorator là một biểu thức chính quy đóng.

**Ranh giới.** Quy tắc này xét thành viên lớp dựa trên một decorator. Thao tác đó có bản kiểm thử nằm
cạnh hay không là việc của `handler-has-twin-spec`; lớp thông điệp đi kèm mang gì là việc của
`message-carries-params-only`.

## `message-carries-params-only` — CQRS-2

**Nó báo cái gì.** Cũng hai thông điệp. `method` — lớp thông điệp khai báo bất kỳ phương thức nào
ngoài hàm dựng; một thông điệp biết tính toán là đã dời một quyết định vào tệp không ai đọc để tìm
quyết định, và hai chỗ phát cùng một thông điệp sẽ hiểu nó khác nhau. `shape` — hàm dựng không nhận
đúng một tham số tên `params`; thông điệp là ngữ cảnh yêu cầu được trao nguyên khối cho lớp xử lý, còn
thông điệp nhiều trường bắt mỗi chỗ phát tự lắp lấy một kiểu.

**Nó phát hiện bằng gì.** Cổng tên tệp trước tiên: `context.filename` chuẩn hoá về dấu gạch chéo xuôi,
rồi khớp `/\/([a-z0-9-]+)\.(command|query)\.ts$/`. Không khớp nghĩa là quy tắc trả về một bộ duyệt
rỗng và không tồn tại với tệp đó. Khớp rồi mới thăm `ClassDeclaration`, và bỏ qua toàn bộ lớp nếu lớp
mang **bất kỳ** decorator nào. Còn lại: báo mọi `MethodDefinition` có `kind` khác `constructor`; rồi
tìm hàm dựng `MethodDefinition`, gỡ `TSParameterProperty` về `parameter` bên trong, và đòi
`params.length === 1` cùng `.name === "params"`.

**Điểm mù.** Thông điệp không có hàm dựng —
`export class ArchiveOrderCommand { readonly request: R; readonly user: U }` — đi qua sạch, vì phép
kiểm hình dạng thoát sớm khi không có hàm dựng, và các trường là `PropertyDefinition` mà quy tắc không
hề đọc; đó đúng là vi phạm mà `CQRS-2` mô tả, viết ở dạng quy tắc không nhìn thấy. Logic nằm trong
**thân** hàm dựng — `constructor(readonly params: P) { this.params = normalise(params) }` — vì chỉ
danh sách tham số bị soi còn thân hàm không bao giờ được thăm, nên chỗ duy nhất một thông điệp có thể
tính toán một cách vô hình lại là chỗ duy nhất không có ai nhìn. `isValid = () => true` viết thành
trường, cùng một lỗ về kiểu nút. Một decorator bất kỳ trên lớp, kể cả thêm vào vì lý do không liên
quan: `if ((node.decorators || []).length > 0) return` là miễn trừ cả lớp, nên một decorator làm một
thông điệp thành không đo được. Một tham số duy nhất tên `params` chứa gì cũng qua — một kho dữ liệu,
một bộ nhớ đệm, một hàm gọi lại — vì phép kiểm là **tên** tham số, không bao giờ là kiểu của nó. Và
`addToCart.command.ts`, `add_to_cart.command.ts`, `commands.ts`, hay một thông điệp khai trong
`index.ts`: cổng đòi `[a-z0-9-]+` ngay trước `.command.ts` hoặc `.query.ts`, nên một chữ hoa, một gạch
dưới, một dạng số nhiều hay một tệp gom là quy tắc không tồn tại. Tên tệp là thứ rẻ nhất trong một kho
mã để thay đổi.

**Ranh giới.** Quy tắc này chỉ đọc tệp thông điệp. Nó không mở lớp xử lý nhận thông điệp và không kiểm
kiểu nằm sau cái tên `params`.

## `handler-has-twin-spec` — CQRS-7

**Nó báo cái gì.** `missing` — một tệp `<operation>.handler.ts` mà tên thao tác của nó không có
`<operation>.handler.spec.ts` tương ứng trong danh sách do cấu hình đưa vào. Quyết định nằm trong lớp
xử lý, nên một lớp xử lý không có kiểm thử là một quyết định không có kiểm thử, và bản kiểm thử nằm
cùng thư mục thì người sửa lớp xử lý gặp nó, thay vì chỉ người đi tìm trong cây kiểm thử mới gặp.

**Nó phát hiện bằng gì.** Cổng tên tệp: đường dẫn chuẩn hoá, khớp `/\/([a-z0-9-]+)\.handler\.ts$/`,
lấy ra tên thao tác. Rồi đọc `context.options[0].specs`; nếu đó không phải mảng thì quy tắc trả về một
bộ duyệt rỗng. Là mảng thì hỏi mảng đó có chứa chuỗi `` `${operation}.handler.spec.ts` `` không.
Không có thì đăng ký `Program:exit` và báo trên nút `Program`. **Nó không hề đụng vào hệ thống tệp** —
phép kiểm là một chuỗi đối chiếu với một danh sách do cấu hình đưa vào. Điều đó là cố ý và đáng nói
thẳng: một quy tắc đi `stat` đĩa sẽ trả lời khác nhau tuỳ theo cây làm việc đang có gì, và một quy tắc
mà câu trả lời phụ thuộc cây làm việc thì không ai tái lập lại được lúc rà soát.

**Điểm mù.** Mặc định là mọi thứ — phát hành ở `off`, và kể cả bật lên vẫn trơ nếu cấu hình
không truyền `specs`; quy tắc là bộ báo cáo cho một cái cổng nằm ngoài nó. Một bản kiểm thử có tồn tại
mà không kiểm gì — rỗng, `describe.skip`, hoặc chỉ một khẳng định luôn đúng — vì phép kiểm là một tên
tệp trong một danh sách và nội dung không bao giờ được đọc, nên "có cặp song sinh" và "có được kiểm
thử" là hai mệnh đề, và chỉ mệnh đề đầu được giữ. Hai thao tác trùng tên ngắn ở hai thư mục khác nhau
mà chỉ một bên có bản kiểm thử: danh sách được so như tên trần không kèm thư mục, nên một bản kiểm thử
đặt theo tên thao tác làm mọi lớp xử lý cùng tên cùng qua. `<operation>.handler.tsx`, `.handler.mts`,
hay lớp xử lý khai trong một tệp gom — vẫn cổng tên tệp đóng ấy, với cùng cái giá. Và một danh sách
cũ: ai truyền `specs` thì người đó quyết kết quả, nên một danh sách dựng một lần rồi nhớ đệm, hoặc
dựng từ sai thư mục gốc, làm mọi lớp xử lý qua hết trong khi không có gì được kiểm.

**Ranh giới.** Quy tắc này xét một cái tên với một danh sách được trao cho nó. Nó báo tên tệp đáng lẽ
phải có; việc đếm thứ thật sự có là của cổng bên ngoài.

## Cách phát hiện

| Quy tắc | Cơ chế |
|---|---|
| `handler-overrides-process` | Chỉ `ClassDeclaration`. Cổng: lớp mang một decorator có biểu thức là `Identifier`, hoặc là `CallExpression` với `callee` kiểu `Identifier`, mà tên khớp `/^(?:Command\|Query\|Events)Handler$/`. Rồi duyệt `node.body.body` tìm `MethodDefinition` có `key.name` là `execute`; thấy thì báo tại khoá đó. Không thấy: nếu có `node.superClass` thì dừng; không có thì tìm `MethodDefinition` có `key.name` là `process` và báo nếu vắng. Không có cổng tên tệp nào cả. |
| `message-carries-params-only` | Cổng tên tệp trước tiên: `context.filename` chuẩn hoá về gạch chéo xuôi, rồi khớp `/\/([a-z0-9-]+)\.(command\|query)\.ts$/`. Không khớp nghĩa là quy tắc trả bộ duyệt rỗng và không tồn tại với tệp đó. Rồi `ClassDeclaration`, bỏ qua trọn lớp nếu lớp mang **bất kỳ** decorator nào. Báo mọi `MethodDefinition` có `kind` khác `constructor`. Rồi tìm hàm dựng `MethodDefinition`, gỡ `TSParameterProperty` về `parameter`, và đòi `params.length === 1` cùng `.name === "params"`. |
| `handler-has-twin-spec` | Cổng tên tệp: đường dẫn chuẩn hoá khớp `/\/([a-z0-9-]+)\.handler\.ts$/`, lấy ra thao tác. Rồi đọc `context.options[0].specs`; nếu không phải mảng thì quy tắc trả bộ duyệt rỗng. Là mảng thì hỏi mảng đó có chứa chuỗi `` `${operation}.handler.spec.ts` `` không. Không có thì đăng ký `Program:exit` và báo trên nút `Program`. **Nó không hề đụng vào hệ thống tệp** — phép kiểm là một chuỗi đối chiếu danh sách do cấu hình đưa vào. |

Không có gì ở đây với ra ngoài tệp đang lint, trừ quy tắc cặp song sinh; và thứ nó với tới là một tuỳ
chọn, không phải đĩa.

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng mấy cách viết này lọt qua, nhưng không.

| Quy tắc | Cách né bất thành | Vì sao vẫn nổ |
|---|---|---|
| `handler-overrides-process` | Viết `@CommandHandler` không có ngoặc | Bộ đọc decorator chấp nhận cả biểu thức `Identifier` trần lẫn `CallExpression`, nên cả hai cách viết đều được nhận |
| `handler-overrides-process` | Vùi decorator xử lý dưới `@Injectable()` và những cái khác | Cổng dùng `.some()` trên mọi decorator của lớp, không chỉ cái đầu tiên |
| `handler-overrides-process` | `private execute()`, `public execute()`, `get execute()` | Phép duyệt khớp `MethodDefinition` chỉ theo tên khoá; mức truy cập, `override`, `async` và loại truy xuất đều không được tra |
| `handler-overrides-process` | Khai thêm cả `process`, hy vọng nó bù trừ | Nhánh `execute` báo và trả về trước khi `process` được tìm tới |
| `message-carries-params-only` | `constructor(readonly params: P)` so với `constructor(params: P)` | `TSParameterProperty` được gỡ về tham số bên trong trước khi so tên, nên bổ từ truy cập không đổi được gì |
| `message-carries-params-only` | Rã tham số: `constructor({ request, user }: P)` | `ObjectPattern` không có `.name`, nên phép kiểm hình dạng thất bại và báo |
| `message-carries-params-only` | Đánh dấu logic phụ là `private` hay `static` | Cả hai đều không được tra; mọi `MethodDefinition` ngoài hàm dựng đều bị báo |
| `message-carries-params-only` | Đường dẫn gạch chéo ngược trên một bản làm việc Windows | Tên tệp được chuẩn hoá về gạch chéo xuôi trước khi khớp, nên cổng xử sự y hệt trên mọi nền |
| `handler-has-twin-spec` | Truyền `specs: []` để bịt miệng nó | Mảng rỗng vẫn là mảng, nên quy tắc vẫn chạy và vẫn báo; chỉ **thiếu hẳn** tuỳ chọn mới tắt được nó |
| `handler-has-twin-spec` | Một tệp lớp xử lý rỗng | Báo cáo gắn vào `Program:exit`, nên nó nổ ngay cả khi trong tệp không có dòng mã nào |

**Còn mở** — chỗ mù đã phát hành cùng sản phẩm. Một phán quyết không được nhận là đã xét mấy chỗ này.

| Quy tắc | Cái gì lọt qua | Vì sao cơ chế bỏ sót |
|---|---|---|
| `handler-overrides-process` | `override execute = async (command: C) => { … }` | Trường của lớp là `PropertyDefinition`, không phải `MethodDefinition`. Thuộc tính thể hiện che phương thức lớp cơ sở lúc chạy, nên khuôn mẫu thật sự bị bỏ — mà phép duyệt chỉ nhìn phương thức |
| `handler-overrides-process` | `async ["execute"](command: C) { … }` hoặc một khoá tính toán | Phép duyệt so `member.key.name`; khoá dạng chuỗi hay khoá tính toán không có `.name`, nên nó so với `undefined` |
| `handler-overrides-process` | Bất kỳ lớp xử lý nào `extends` một thứ gì đó mà không cài `process` | `if (node.superClass) return` — phép kiểm thiếu `process` chỉ áp cho lớp đứng một mình, vốn là hình dạng hiếm hơn. Lớp xử lý đúng chuẩn kế thừa lớp cơ sở khuôn mẫu, nên hình dạng đúng chuẩn lại chính là hình dạng nửa quy tắc này không bao giờ soi |
| `handler-overrides-process` | `@nest.CommandHandler(C)`, hoặc `import { CommandHandler as Handles }` rồi `@Handles(C)` | `callee` kiểu `MemberExpression` không cho ra tên nào nên lớp không được nhận là lớp xử lý; biểu thức chính quy khớp cách viết định danh tại chỗ, không khớp thứ nó phân giải ra. Đổi tên khi nhập là cả quy tắc tắt hẳn với tệp đó |
| `handler-overrides-process` | Lớp xử lý mang decorator bọc của riêng dự án — bất cứ thứ gì không viết đúng `CommandHandler`, `QueryHandler` hay `EventsHandler` | Tập tên decorator là một biểu thức chính quy đóng; một lớp bọc làm mọi lớp xử lý bên dưới nó vô hình |
| `message-carries-params-only` | Thông điệp không có hàm dựng: `export class ArchiveOrderCommand { readonly request: R; readonly user: U }` | Phép kiểm hình dạng thoát sớm khi không có hàm dựng, và các trường là `PropertyDefinition` mà quy tắc không hề đọc. Đúng vi phạm mà `CQRS-2` mô tả, ở dạng quy tắc không nhìn thấy |
| `message-carries-params-only` | Logic trong **thân** hàm dựng: `constructor(readonly params: P) { this.params = normalise(params) }` | Chỉ danh sách tham số bị soi. Thân hàm không bao giờ được thăm, nên chỗ duy nhất một thông điệp có thể tính toán vô hình lại là chỗ duy nhất không ai nhìn |
| `message-carries-params-only` | `isValid = () => true` viết thành trường của lớp | Cùng lỗ về kiểu nút như trên: một trường không phải `MethodDefinition` |
| `message-carries-params-only` | Một decorator bất kỳ trên lớp, kể cả thêm vào vì lý do không liên quan | `if ((node.decorators \|\| []).length > 0) return` là miễn trừ cả lớp, mua để một họ tệp `.command.ts` khác hình dạng không báo oan. Một decorator làm một thông điệp thành không đo được |
| `message-carries-params-only` | Một tham số duy nhất tên `params` chứa bất cứ thứ gì — một kho dữ liệu, một bộ nhớ đệm, một hàm gọi lại | Phép kiểm là **tên** tham số, không bao giờ là kiểu. `params` là quy ước đặt tên mà quy tắc giữ, còn nội dung thì nó không giữ |
| `message-carries-params-only` | `addToCart.command.ts`, `add_to_cart.command.ts`, `commands.ts`, một thông điệp khai trong `index.ts` | Cổng đòi `[a-z0-9-]+` ngay trước `.command.ts` hoặc `.query.ts`. Một chữ hoa, một gạch dưới, một dạng số nhiều, hay một tệp gom là quy tắc không tồn tại. Tên tệp là thứ rẻ nhất trong một kho mã để thay đổi |
| `handler-has-twin-spec` | Mọi thứ, theo mặc định | Phát hành ở `off`, và kể cả bật lên vẫn trơ nếu cấu hình không truyền `specs`. Quy tắc là bộ báo cáo cho một cái cổng nằm ngoài nó |
| `handler-has-twin-spec` | Một bản kiểm thử có tồn tại mà không kiểm gì — rỗng, `describe.skip`, hoặc chỉ một khẳng định luôn đúng | Phép kiểm là một tên tệp trong một danh sách. Nội dung không bao giờ được đọc, nên "có cặp song sinh" và "có được kiểm thử" là hai mệnh đề, và chỉ mệnh đề đầu được giữ |
| `handler-has-twin-spec` | Hai thao tác trùng tên ngắn ở hai thư mục khác nhau, chỉ một bên có bản kiểm thử | Danh sách được so như tên trần, không kèm thư mục. Một bản kiểm thử đặt theo tên thao tác làm mọi lớp xử lý cùng tên cùng qua |
| `handler-has-twin-spec` | `<operation>.handler.tsx`, `.handler.mts`, hay lớp xử lý khai trong một tệp gom | Vẫn cổng tên tệp đóng như trên, với cùng cái giá |
| `handler-has-twin-spec` | Một danh sách cũ | Ai truyền `specs` thì người đó quyết kết quả. Một danh sách dựng một lần rồi nhớ đệm, hoặc dựng từ sai thư mục gốc, làm mọi lớp xử lý qua hết trong khi không có gì được kiểm |
| không quy tắc nào | Mọi thứ mà `CQRS-1`, `CQRS-4`, `CQRS-5` và `CQRS-6` cấm | Bốn mã đó không có máy nào cả |

Hai dòng trong bảng là cùng một khiếm khuyết mặc hai bộ quần áo, và đáng gọi tên một lần: **trường của
lớp vô hình với toàn bộ phép duyệt phương thức ở đây**, và **cổng tên tệp thôi tồn tại ngay khi một tệp
bị đổi tên.** Cả hai đều không phải phá hoại. Cả hai đều đúng là hình dáng của việc dọn dẹp.

## Đầu vào

| Đầu vào | Chứng cứ phải có |
|---|---|
| tên tệp | Đường dẫn đúng như bộ lint báo, chuẩn hoá về dấu gạch chéo xuôi |
| decorator | Định danh decorator đúng như viết tại lớp, không phải như lúc nhập |
| thành viên lớp | Kiểu nút, không phải tên: một phương thức và một trường trùng tên là hai chứng cứ khác nhau |
| tham số hàm dựng | Số lượng, và cái tên sau khi tham số thuộc tính đã được gỡ |
| tuỳ chọn | Với quy tắc cặp song sinh, danh sách thư mục do cấu hình truyền vào; thiếu nó thì quy tắc trơ |

## Quy tắc

1. Danh tính của một quy tắc là tên nó công bố — chuỗi in ra trong nhật ký dựng, chuỗi viết trong chú
   thích tắt quy tắc, chuỗi đặt mức nghiêm trọng trong tệp cấu hình. Không đặt thêm mã số cho quy tắc.
2. Một quy tắc chỉ báo những gì cơ chế của nó nhìn thấy được, và mô-đun này ghi đúng cái ranh giới đó
   chứ không ghi tham vọng của luật.
3. Không quy tắc nào đọc hệ thống tệp. Một câu trả lời phụ thuộc cây làm việc thì không tái lập được.
4. Một quy tắc chỉ lên `error` khi số đo bằng không; còn nợ thì `warn` kèm số đếm, hoặc `off` nếu nó
   cần cấu hình mới chạy được.
5. Khi đo số thật của một quy tắc, chỉ đếm báo cáo của chính quy tắc đó. Các chú thích tắt quy tắc trỏ
   tới những quy tắc mà một cấu hình tối thiểu không hề nạp thì bản thân chúng lại bị báo, và làm mọi
   con số phồng lên.
6. Một mã chưa có ai giữ được ghi là chưa có ai giữ. Không bao giờ gán nó cho quy tắc gần nhất.

## Ngoại lệ

Mỗi miễn trừ dưới đây là cố ý, được mua bằng một phép đo, và đóng.

- **Không decorator thì không phải lớp xử lý.** Miễn trừ này thả mọi lớp mang tên lớp xử lý mà không
  mang decorator xử lý ra khỏi `handler-overrides-process`, vì nó có thể là lớp xử lý ổ cắm, một chiến
  lược, một bộ chuyển đổi. Quy tắc nổ theo tên sẽ dành cả đời bị tắt bởi những người tắt đúng.
- **Lớp có kế thừa được miễn phép kiểm thiếu `process`.** Miễn trừ này thả mọi lớp có `superClass` ra
  khỏi nửa `noProcess`. Báo bất kể lớp cha cho ra mười báo cáo sai trên ba báo cáo đúng, vì một lớp xử
  lý trừu tượng trung gian cài `process` một lần rồi được kế thừa là hình dạng hợp lệ.
- **Lớp có decorator trong tệp thông điệp được miễn.** Miễn trừ này thả trọn lớp ra khỏi
  `message-carries-params-only`. Một khung nền khác dùng đúng đuôi tệp đó cho một lớp có decorator và
  có phương thức `run` — đó là một cánh cửa, không phải một thông điệp; họ tệp ấy chiếm mười chín trên
  hai mươi mốt báo cáo trước khi có miễn trừ này.
- **Quy tắc cặp song sinh im lặng khi không có danh sách.** Miễn trừ này thả mọi tệp lớp xử lý khi
  `context.options[0].specs` không phải mảng. Không có tuỳ chọn thì nó không làm gì thay vì đoán, vì
  đoán ở đây nghĩa là hai máy cho hai kết quả.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
rule: <published rule name>
code: <CQRS-n | none>
mechanism: <node type, filename regex or option consulted>
verdict: <reports | silent>
hatch: <the way of writing that would make this silent, or "none found">
```

Một tệp sạch xuất một khối cho mỗi quy tắc có mặt trong phạm vi, với `verdict: silent` và dòng hatch
gọi tên lối thoát còn mở nào có thể đang tạo ra sự im lặng ấy. Một tệp ngoài phạm vi xuất `verdict:
silent` với `mechanism` gọi tên cái cổng tên tệp đã không khớp — ngoài phạm vi nghĩa là quy tắc trả về
một bộ duyệt rỗng và không tồn tại với tệp đó, không phải là tệp đã qua.

## Ví dụ đã giải

**Đầu vào.** Hai tệp của một thao tác, `orders/archive-order/`:

```ts
// archive-order.command.ts
export class ArchiveOrderCommand {
  constructor(
    readonly request: ArchiveOrderRequest,
    readonly user: User,
  ) {}

  isArchivable() {
    return this.request.status === "closed"
  }
}
```

```ts
// archive-order.handler.ts
@CommandHandler(ArchiveOrderCommand)
export class ArchiveOrderHandler extends BaseCommandHandler {
  async execute(command: ArchiveOrderCommand) {
    return this.repository.archive(command.request.id)
  }
}
```

Tệp thông điệp khớp `/\/([a-z0-9-]+)\.(command|query)\.ts$/` và lớp không mang decorator nào, nên
`message-carries-params-only` chạy. Lớp xử lý mang `@CommandHandler(…)` với `callee` kiểu `Identifier`,
nên `handler-overrides-process` chạy; quy tắc đó không có cổng tên tệp nên nó cũng đã ghé tệp thông
điệp, nhưng lớp thông điệp không mang decorator xử lý nên không được nhìn thấy.

```text
rule: message-carries-params-only
code: CQRS-2
mechanism: MethodDefinition with kind !== "constructor" in a file matching /\/([a-z0-9-]+)\.(command|query)\.ts$/
verdict: reports
hatch: none found
```

```text
rule: message-carries-params-only
code: CQRS-2
mechanism: constructor MethodDefinition, params.length === 1 and .name === "params" after TSParameterProperty unwrap
verdict: reports
hatch: none found
```

```text
rule: handler-overrides-process
code: CQRS-3
mechanism: ClassDeclaration with a decorator matching /^(?:Command|Query|Events)Handler$/, MethodDefinition key.name === "execute"
verdict: reports
hatch: none found
```

Sau khi sửa, thông điệp mang đúng một `params` và không có phương thức nào, còn lớp xử lý cài `process`
thay cho `execute`:

```ts
// archive-order.command.ts
export class ArchiveOrderCommand {
  constructor(readonly params: ArchiveOrderParams) {}
}
```

```ts
// archive-order.handler.ts
@CommandHandler(ArchiveOrderCommand)
export class ArchiveOrderHandler extends BaseCommandHandler {
  protected async process(command: ArchiveOrderCommand) {
    return this.repository.archive(command.params.request.id)
  }
}
```

Giờ cả hai quy tắc đều im, và một trong hai sự im lặng đó không phải là tuân thủ. Lớp xử lý `extends
BaseCommandHandler`, nên nửa kiểm thiếu `process` vốn chưa bao giờ soi nó — nếu `process` cũng bị bỏ
luôn thì phán quyết vẫn y hệt:

```text
rule: handler-overrides-process
code: CQRS-3
mechanism: ClassDeclaration, node.superClass present
verdict: silent
hatch: if (node.superClass) return — the missing-process check applies only to a standalone class, so the canonical extending handler is never inspected by that half
```

Còn quy tắc cặp song sinh thì ở đây chưa từng được lắp vào:

```text
rule: handler-has-twin-spec
code: CQRS-7
mechanism: context.options[0].specs
verdict: silent
hatch: shipped off, and inert even when on unless the config supplies specs
```

## Phạm vi

Mô-đun này ghi mức thực thi, không ghi luật và không ghi sản phẩm. Nó không gọi tên sản phẩm nào, kho
mã nào hay thư viện thành phần nào. Tên các quy tắc và không gian tên trình cắm mà chúng phát hành
dưới đó là những định danh xuất hiện trong nhật ký dựng, nên chúng được chép nguyên văn; đó là miễn
trừ duy nhất, và nó không lan sang phần văn xuôi. Công việc có nằm đúng chỗ không, lớp điều phối mỏng
đến mức nào, thất bại được ném ra hay trả về, và người gọi có đang đợi một sự kiện hay không đều thuộc
về `CQRS-1`, `CQRS-4`, phần ngữ nghĩa của `CQRS-5` và `CQRS-6` — đọc bằng mắt người ngoài các hình dạng đóng mà encoded-failure rule sở hữu
chúng.
