---
title: Authorization · Vietnamese
---

# Phân quyền

## LOADS

None.


## Bản ghi

Gate này nhận code đã viết xong — một tệp, một mẩu của bản khác biệt. Kết quả là một **phán quyết**: quy tắc
đã xuất bản nào nổ, nổ trên nút nào, ứng với mã luật nào, và lối thoát còn mở nào lẽ ra đã che đúng cái
sai đó. Mô-đun này không chọn thiết kế phân quyền nào cả. Nó từ chối một thiết kế, và nó phải chỉ được ra
đúng tham số mà nó từ chối.

## Luật

Một cánh cửa **đọc** danh tính đã xác thực thì phải mang cái cổng chứng minh danh tính ấy. Sai lầm này
trông như không có gì — tham số vẫn tên `user`, lớp xử lý vẫn nhận được một `user` — và thứ duy nhất vắng
mặt là dòng chứng minh danh tính ấy thuộc về người gọi.

Luật nêu sáu mã, `AUTHZ-1` đến `AUTHZ-6`. **Chỉ một mã có quy tắc máy.** Đó không phải là chuyện phủ sóng
thiếu sót. Một mã trong sáu mã là hình dạng mà một bộ phân tích cú pháp nhìn thấy được; năm mã còn lại đều
xoay quanh việc đang với tới hàng dữ liệu nào và sở hữu hàng đó nghĩa là gì, mà một tệp thì không phải là
chỗ chứa những điều ấy. Cho nên phát biểu trung thực về mức thi hành là: **năm mã không có máy nào giữ, và
một mã có máy nhưng máy đó có những lỗ đã biết.** Cả hai nửa đều quan trọng. Một mã không có quy tắc thì
được biết là không được thi hành, và sẽ có người đọc bằng mắt. Còn một quy tắc bị tin là kín kẽ trong khi
không kín kẽ thì mua lấy sự im lặng và trả bằng một cảm giác phủ sóng sai lầm.

## Luật máy đã xuất bản

| Quy tắc | Mã | Nó báo cái gì |
|---|---|---|
| `identity-needs-guard` | `AUTHZ-2` | `unguarded` — một phương thức của lớp nhận tham số mang một trong ba decorator danh tính, trong khi cả phương thức lẫn lớp trực tiếp của nó đều không mang decorator tên `UseGuards`. Báo lỗi ngay tại tham số, và thông điệp gọi đúng tên decorator danh tính mà nó tìm thấy |

Danh tính của một quy tắc là tên đã xuất bản của nó — chuỗi mà nhật ký biên dịch in ra, mà một dòng
disable gọi tên, và mà tệp cấu hình đặt mức nghiêm trọng lên. Không có định danh số thứ hai. Mức nghiêm
trọng đã xuất bản là `error`; một quy tắc chỉ lên `error` khi số vi phạm đo được bằng không, và quy tắc
này đo được bằng không.

`AUTHZ-1` (một lớp xử lý sở hữu điều kiện tiên quyết của chính nó, và danh tính là một trong số đó),
`AUTHZ-3` (quyền sở hữu quyết định dựa trên hàng đã nạp, không bao giờ dựa trên yêu cầu), `AUTHZ-4` (một
lời từ chối làm lộ ra sự tồn tại của hàng riêng tư thì phải trả lời là không tìm thấy), `AUTHZ-5` (quyền
lợi là một trạng thái; có hàng không phải là có trạng thái) và `AUTHZ-6` (người vận hành là một chủ thể
khác với người dùng) **hoàn toàn không có quy tắc nào**. Chúng không được thi hành chứ không phải đã được
che phủ, và một lần chạy xanh không nói lên điều gì về bất kỳ mã nào trong số đó. `AUTHZ-1` thì đã đo rồi
và cố tình để yên: một lớp xử lý tự nhắc lại điều kiện tiên quyết về danh tính của chính nó trông giống
chép lại nhưng không phải, nên một quy tắc từ chối chuyện đó sẽ báo nhầm trên phần lớn lớp xử lý **đúng**
trong cây này.

## Đọc một diff

1. **Quyết phạm vi trước tiên và ghi lại.** Quy tắc này hoàn toàn không có cổng theo tên tệp —
   `context.filename` không bao giờ được đọc — nên nó sống ở mọi tệp mà cấu hình lint tới. Một tệp mà cấu
   hình không trỏ tới là **chưa được xét**, không phải là sạch: không có trình thăm nào được cài, và quy
   tắc không tồn tại đối với tệp đó.
2. **Kiểm các miễn trừ trước khi đọc nút.** Một cánh cửa không đọc danh tính thì không phải là lỗi. Một
   `UseGuards` trên lớp trực tiếp tha cho mọi phương thức của lớp.
3. **Đọc các nút.** Chỉ `MethodDefinition`. Với mỗi phương thức, duyệt `node.value.params`, mở
   `TSParameterProperty` ra, đọc tên từng decorator, và dừng ngay khi biểu thức decorator không phải một
   `Identifier` trần cũng không phải `CallExpression` có callee là `Identifier` — tên đọc ra khi đó là
   `undefined` và phương thức thậm chí không thành ứng viên.
4. **Xuất một khối cho mỗi phát hiện.** Một phương thức chỉ báo một lần, kể cả khi nó mang hai tham số
   danh tính.
5. **Viết dòng `hatch` mỗi khi một lối thoát còn mở lẽ ra đã che đúng cái sai đó**, và nói rõ sự im lặng
   ấy phải trả giá bằng gì.
6. **Đừng báo thứ không quy tắc nào canh.** Năm trong sáu mã không có máy; một phán quyết nói khác đi là
   một phán quyết hiểu sai mô-đun này.

## `identity-needs-guard` — AUTHZ-2

**Nó báo cái gì.** Một thông điệp duy nhất, `unguarded`, ngay tại nút tham số, gọi đúng tên decorator danh
tính mà nó tìm thấy.

**Nó phát hiện bằng gì.** Chỉ một trình thăm, `MethodDefinition`, không có loại nút nào khác. Với mỗi
phương thức, nó duyệt `node.value.params`; tham số kiểu `TSParameterProperty` được mở ra lấy `parameter`
bên trong làm vật mang dự phòng, và danh sách decorator lấy theo thứ tự `parameter.decorators`, rồi tới
của vật mang, rồi tới mảng rỗng. Tên một decorator đọc được từ một `Identifier` trần, hoặc từ
`CallExpression` có `callee.type` là `Identifier`; mọi hình dạng biểu thức khác trả về `undefined`. Phương
thức trở thành ứng viên khi có tên decorator tham số nằm trong tập chữ đóng
`{ KeycloakGraphQLUser, KeycloakUser, CurrentUser }`. Nó được tha nếu có decorator nào trên phương thức
tên đúng `UseGuards`, hoặc — đi từ `node.parent` (là `ClassBody`) lên `parent` của nút đó để lấy lớp —
nếu có decorator nào trên nút lớp ấy tên đúng `UseGuards`. Còn lại thì báo `unguarded` tại tham số.

**Điểm mù.** Một danh tính đến bằng bất cứ đường nào khác ba decorator đó: `@Context() ctx` rồi
`ctx.req.user`, `@Req() req` rồi `req.user`, hoặc chính phép đọc ấy được đẩy thêm một chặng vào một phương
thức riêng tư của lớp — quy tắc không bao giờ nhìn vào thân phương thức và không bao giờ lần theo lời gọi.
Một decorator có không gian tên, `@auth.CurrentUser()`, mà callee `MemberExpression` cho ra `undefined`.
Một lệnh nhập khẩu đổi tên, `import { CurrentUser as Who }` rồi `@Who()`, vì tập chữ được so với cách viết
tại chỗ dùng chứ không bao giờ so với thứ mà lệnh nhập khẩu phân giải ra. Bất kỳ decorator danh tính thứ
tư nào cây này thêm về sau. Ở chiều ngược lại, nó không thấy được một cái cổng có thật sự canh hay không:
`@UseGuards()` không tham số đã được đo là **không báo**, và một cổng không xác thực cũng vậy. Nó còn báo
nhầm trên code **đúng** ở bốn hình dạng đã đo — `@nest.UseGuards(G)`, một decorator gộp `@Authenticated()`
bên trong là `applyDecorators(UseGuards(...))`, một cổng chỉ đặt trên **lớp cơ sở** còn cửa khai ở lớp con,
và một lớp phục vụ có phạm vi theo yêu cầu nhận `@CurrentUser()` ở hàm dựng mà không phải một cánh cửa.
Mỗi lần như vậy là một lần ai đó viết `eslint-disable`, và dòng `eslint-disable` mới là thứ che mất trường
hợp thật tiếp theo.

**Ranh giới.** Quy tắc giữ đúng một dữ kiện: một cánh cửa đọc danh tính thì mang một decorator viết đúng
chữ `UseGuards`. Còn cổng ấy có xác thực hay không, lớp xử lý sau đó với tới hàng nào, ai sở hữu hàng đó,
một lời từ chối làm lộ ra điều gì và chủ thể nào đứng sau cánh cửa là chuyện của `AUTHZ-3` đến `AUTHZ-6`,
và ở đây không máy nào giữ bất kỳ dữ kiện nào trong số đó.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| cổng theo đường dẫn | Không có. **`context.filename` không bao giờ được đọc**, nên quy tắc sống ở mọi tệp mà cấu hình lint tới |
| trình duyệt nút | Một trình thăm, `MethodDefinition`. Một trường của lớp, một phương thức của đối tượng, một hàm thường hay một đăng ký bằng mã đều không phải nó, và nằm hẳn ngoài thế giới của quy tắc |
| bộ đọc tham số | `node.value.params`, với `TSParameterProperty` được mở ra lấy `parameter` bên trong làm vật mang dự phòng; decorator lấy từ `parameter.decorators`, rồi của vật mang, rồi mảng rỗng |
| bộ đọc decorator | Một biểu thức `Identifier` trần, hoặc một `CallExpression` có `callee.type` là `Identifier`. Mọi hình dạng biểu thức khác trả về `undefined` |
| tập danh tính | Tập chữ đóng `{ KeycloakGraphQLUser, KeycloakUser, CurrentUser }`, so với cách viết tại chỗ dùng |
| phép tha | `.some()` trên các decorator của phương thức để tìm đúng tên `UseGuards`, rồi trên chính các decorator của lớp lấy qua `node.parent.parent` |
| với ra ngoài tệp | Không có gì. Không đọc hệ tệp, không phân giải lệnh nhập khẩu, không lần theo lời gọi |

Hai tính chất của cơ chế này quyết định mọi thứ ở dưới. **Danh tính chỉ được nhận ra dưới dạng decorator
tham số, qua đúng ba chuỗi ký tự.** Và **cổng chỉ được nhận ra qua một decorator viết đúng chữ `UseGuards`,
tính bằng sự có mặt — không bao giờ tính bằng thứ nó áp vào.**

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lọt được, nhưng không.

| Viết kiểu này | Vì sao vẫn nổ |
|---|---|
| Đổi tên hay dời tệp: `door.ts`, `orders.controller.ts`, một tệp gom, một thư mục không ai ngờ | Hoàn toàn không có cổng theo tên tệp. Tên tệp là thứ rẻ nhất trong một kho mã để thay đổi, và quy tắc này không đặt cược gì vào nó |
| `@UseInterceptors(TransformInterceptor)` thay cho một cổng | Chỉ đúng tên `UseGuards` mới tha cho phương thức. Một bộ chặn nằm cùng ngăn xếp và đọc lên nghe y hệt, mà vẫn bị báo |
| Đổi tên tham số từ `user` thành `caller`, `me`, `principal` | Tên tham số không bao giờ được đọc. Cái được đọc là decorator trên nó |
| Dời decorator danh tính xuống vị trí thứ hai: `execute(@Args("request") request: R, @CurrentUser() user: U)` | Mọi tham số đều được duyệt, và mọi decorator trên từng tham số đều được duyệt |
| Một tham số thuộc tính ở hàm dựng: `constructor(@CurrentUser() private readonly user: U)` | `TSParameterProperty` được xử lý, và một hàm dựng là một `MethodDefinition` bình thường. Nó bị báo |
| Rã danh tính ra: `execute(@CurrentUser() { id }: U)` | Decorator nằm trên nút tham số dù nút ấy mang mẫu gì, nên một `ObjectPattern` không đổi được gì |
| `static`, `private`, `protected`, `async`, `override` trên phương thức | Không cái nào được xét tới. Trình thăm khóa theo loại nút, không theo bổ từ |
| Một cổng đặt trên **một phương thức khác** của cùng lớp | Phép tha chạy theo từng phương thức, và phép kiểm ở cấp lớp đọc decorator của chính lớp — không phải của một phương thức anh em |
| Hai tham số danh tính trên cùng một phương thức | Cái tìm thấy trước quyết định; phương thức chỉ báo một lần. Làm im một tham số không làm im được phương thức |

Có hai cách viết khiến phép kiểm được tha chứ không nổ, và cả hai đều chính đáng: `@UseGuards` viết không
có ngoặc vẫn qua, vì bộ đọc decorator nhận cả một `Identifier` trần lẫn một `CallExpression`; và chôn cái
cổng dưới `@Mutation()`, `@Injectable()` cùng bốn decorator khác vẫn qua, vì phép kiểm là `.some()` trên
mọi decorator — thứ tự và vị trí không được xét tới.

**Còn mở** — mù đã xuất xưởng. Một phán quyết không được nhận vơ rằng những chỗ này đã được xét.

| Cái lọt qua | Cái giá phải trả |
|---|---|
| **Đọc danh tính từ yêu cầu thay vì từ decorator tham số** — `@Context() ctx` rồi `ctx.req.user`, hoặc `@Req() req` rồi `req.user` | Toàn bộ khái niệm "đọc danh tính" của quy tắc là ba decorator tham số, và không có gì trong quy tắc nhìn vào thân phương thức. Đây là **lỗ lớn nhất**, và đúng là cách viết mà người phát triển với tay tới khi thấy decorator nặng nề |
| **Qua một lớp trung gian** — cửa nhận `@Context() ctx`, một phương thức riêng tư trong cùng lớp móc `user` ra từ đó | Vẫn khoảng trống ấy, chỉ xa thêm một cấp. Quy tắc không lần theo lời gọi, nên cửa không bị báo còn phương thức phụ thì chẳng có decorator nào để tìm |
| **Decorator có không gian tên**, `@auth.CurrentUser()` sau `import * as auth from …` | Callee `MemberExpression` cho ra `undefined`, không nằm trong tập, nên phương thức thậm chí không thành ứng viên |
| **Đổi tên lúc nhập khẩu**, `import { CurrentUser as Who }` rồi `@Who()` | Đổi tên lệnh nhập khẩu là quy tắc tắt hẳn trong tệp đó |
| **Một decorator danh tính thứ tư** — `@AuthUser()`, `@Principal()`, `@Viewer()` | Tập là chữ đóng gồm ba chuỗi. Thêm một decorator danh tính mới là mọi cánh cửa dùng nó trở nên vô hình, và không có gì báo cho ai biết chuyện đó |
| **`@UseGuards()` rỗng, không tham số nào** | Đã đo là không báo. Sự có mặt của decorator là toàn bộ điều quy tắc khẳng định; danh sách tham số không bao giờ được đọc |
| **`@UseGuards(RolesGuard)`, `@UseGuards(ThrottlerGuard)`, `@UseGuards(AlwaysTrueGuard)`** — một cổng không xác thực | "Có cổng" và "danh tính đã được chứng minh" là hai dữ kiện khác nhau, và quy tắc chỉ giữ được dữ kiện thứ nhất. Một cổng mặc định rằng đã có xác thực trước đó vẫn thỏa mãn quy tắc này trọn vẹn |
| **Một hàm `UseGuards` khai báo hoặc xuất lại tại chỗ mà chẳng làm gì** | Phép kiểm là cách viết. Một hàm rỗng mang tên đó làm sạch mọi cánh cửa trong tệp |
| **Cổng ở cấp lớp che phủ vĩnh viễn** — một `@UseGuards(...)` trên lớp, rồi một năm sau thêm một phương thức phục vụ chủ thể khác | Mọi phương thức của lớp ấy được tha mãi mãi, không ai quyết lại. Đây cũng là chỗ `AUTHZ-6` hỏng lặng lẽ: một cửa cho người vận hành và một cửa cho người xem dưới cùng một cổng cấp lớp là một cổng cho hai chủ thể, mà quy tắc vẫn coi là đạt |
| **Một cánh cửa không phải phương thức của lớp** — một tuyến đường đăng ký bằng mã, một lớp xử lý ráp bằng nhà máy, một bộ giải ráp từ một bảng ánh xạ | Trình thăm duy nhất là `MethodDefinition`. Thứ gì không phải nó thì nằm hẳn ngoài thế giới của quy tắc |
| **Mọi thứ mà `AUTHZ-1`, `AUTHZ-3`, `AUTHZ-4`, `AUTHZ-5` và `AUTHZ-6` cấm** | Cố tình không thi hành. Quyền sở hữu quyết định từ id trong yêu cầu, một lời từ chối làm lộ sự tồn tại của hàng riêng tư, một hàng quyền lợi bị nhầm là chính quyền lợi, và một cổng phục vụ ba chủ thể đều im lặng ở đây — mà mỗi cái đều là một sự cố nặng hơn cái mã duy nhất đang được giữ |

Hai trong số này là cùng một khiếm khuyết mặc hai bộ áo, và đáng gọi tên một lần: **quy tắc so khớp những
chuỗi ký tự mà một lần đổi tên là thay đổi được**, và **nó đếm sự có mặt của một decorator chứ không đếm
tác dụng của nó.** Không cái nào là phá hoại. Cả hai đều là dáng dấp của việc dọn dẹp thường ngày.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| loại nút | `MethodDefinition`. Một trường của lớp, một phương thức của đối tượng, một hàm thường hay một đăng ký bằng mã đều không phải nó |
| tham số | `node.value.params`, với `TSParameterProperty` được mở ra lấy tham số bên trong làm dự phòng |
| decorator của tham số | Các định danh đúng như viết tại tham số, không phải như được nhập khẩu và không phải như chúng phân giải ra |
| decorator của phương thức | Các định danh đúng như viết tại phương thức |
| decorator của lớp | Đọc qua `node.parent.parent` — chỉ lớp trực tiếp. Không lớp cơ sở, không mô-đun, không đăng ký ở cấp ứng dụng |
| tên tệp | Không được xét tới. Quy tắc áp dụng ở bất cứ đâu cấu hình trỏ tới |

## Quy tắc

1. Danh tính của một quy tắc là tên đã xuất bản của nó. Không đúc mã số nào cho một quy tắc.
2. Một quy tắc chỉ báo những gì cơ chế của nó thấy được, và mô-đun này nêu đúng ranh giới đó chứ không nêu
   tham vọng của luật.
3. Quy tắc không đọc hệ tệp, không phân giải lệnh nhập khẩu và không lần theo lời gọi. Một câu trả lời phụ
   thuộc vào bất kỳ điều nào trong đó đều không tái lập được từ chính tệp đang xét.
4. Sự có mặt của decorator cổng là điều quy tắc khẳng định. Cổng ấy có xác thực hay không nằm ngoài quy tắc,
   và tài liệu này không bao giờ ngụ ý điều ngược lại.
5. Một quy tắc chỉ lên `error` khi số vi phạm đo được bằng không.
6. Một mã không được thi hành thì ghi rõ là không được thi hành. Không bao giờ gán nó cho quy tắc gần nhất.
7. Một báo lỗi trên code đúng là một khiếm khuyết nghiêm trọng ngang với một vi phạm bị bỏ sót, vì nó mua
   lấy dòng disable che mất trường hợp thật tiếp theo.

## Ngoại lệ

Mỗi miễn trừ dưới đây là cố ý và đã đóng.

- **Cửa không đọc danh tính thì không bị báo.** Một truy vấn công khai không có gì để chứng minh, và coi
  nó là lỗi là cách nhanh nhất để cả quy tắc bị tắt. Miễn trừ này thả mọi phương thức không có decorator
  tham số nào nằm trong tập danh tính.
- **Cổng trên lớp tha cho mọi phương thức của lớp.** Từ chối chuyện này sẽ đẩy người viết tới việc lặp
  decorator ở từng phương thức, không phải cách cây này đang làm. Miễn trừ này thả mọi phương thức của một
  lớp mang `UseGuards`, và cái giá là lớp che phủ đã nêu ở trên.
- **Không có cổng theo tên tệp.** Cố ý: quy tắc rộng đúng bằng cấu hình nạp nó, kể cả những tệp không ai
  nghĩ là cửa. Miễn trừ này không thả gì cả, nó nới rộng mọi thứ.
- **`AUTHZ-1` cố tình không có máy giữ.** Một lớp xử lý sở hữu điều kiện tiên quyết của chính nó; một quy
  tắc từ chối phép kiểm danh tính được nhắc lại sẽ đi ngược canon chứ không giữ canon. Miễn trừ này thả mọi
  phép kiểm danh tính ở cấp lớp xử lý.
- **`AUTHZ-3`, `AUTHZ-4` và `AUTHZ-5` cố tình không có máy giữ.** Cả ba đều quyết định dựa trên một hàng đã
  nạp, và không bộ phân tích cú pháp nào biết một lớp xử lý đang với tới hàng nào hay sở hữu hàng đó nghĩa
  là gì. Miễn trừ này thả mọi quyết định về quyền sở hữu, về lời từ chối làm lộ dữ liệu và về quyền lợi.
- **`AUTHZ-6` cố tình không có máy giữ.** Chủ thể đứng sau một cánh cửa là dữ kiện nghiệp vụ, không phải
  hình dạng cú pháp. Miễn trừ này thả mọi phân biệt giữa người vận hành và người dùng.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
rule: identity-needs-guard
code: AUTHZ-2
mechanism: MethodDefinition · identity parameter decorator name · UseGuards on method or class
verdict: <reports | silent>
hatch: <the way of writing that would make this silent, or "none found">
```

Một tệp sạch — tệp mà cấu hình có lint tới, và mọi phương thức đọc danh tính trong đó đều được tha nhờ
`UseGuards` trên chính nó hoặc trên lớp của nó — xuất một khối với `verdict: silent` và dòng `hatch` điền
lối thoát còn mở lẽ ra đã tạo ra đúng sự im lặng ấy, hoặc `none found`. Mô-đun này không có tệp nào nằm
ngoài phạm vi: vì không có cổng theo tên tệp, mọi tệp cấu hình trỏ tới đều được xét. Một tệp cấu hình không
trỏ tới thì không xuất khối nào cả, và nó là **chưa được xét** chứ không phải sạch.

## Ví dụ đã giải

**Đầu vào.** Một lớp resolver, một phương thức, thư mục bình thường:

```ts
@Resolver()
export class OrderResolver {
  @Query(() => OrderResponse)
  async order(
    @Args("request") request: OrderRequest,
    @CurrentUser() user: UserLike,
  ): Promise<OrderResponse> {
    return this.service.order(request, user)
  }
}
```

Phương thức là một `MethodDefinition`. Tham số thứ hai mang `CurrentUser`, vốn nằm trong tập đóng, nên
phương thức thành ứng viên. Không decorator nào trên phương thức tên `UseGuards`, và nút lớp lấy qua
`node.parent.parent` chỉ mang `Resolver`. Nó báo.

```text
rule: identity-needs-guard
code: AUTHZ-2
mechanism: MethodDefinition · identity parameter decorator name · UseGuards on method or class
verdict: reports
hatch: none found
```

**Đã sửa.** Cánh cửa mang cái cổng chứng minh danh tính mà nó đọc:

```ts
@Resolver()
export class OrderResolver {
  @UseGuards(GqlAuthGuard)
  @Query(() => OrderResponse)
  async order(
    @Args("request") request: OrderRequest,
    @CurrentUser() user: UserLike,
  ): Promise<OrderResponse> {
    return this.service.order(request, user)
  }
}
```

Nhưng đúng cái sai ấy sống sót qua một lần viết lại rất bình thường. Bỏ cổng đi lần nữa và lấy danh tính ra
từ ngữ cảnh:

```ts
@Resolver()
export class OrderResolver {
  @Query(() => OrderResponse)
  async order(
    @Args("request") request: OrderRequest,
    @Context() ctx: GqlContext,
  ): Promise<OrderResponse> {
    return this.service.order(request, ctx.req.user)
  }
}
```

```text
rule: identity-needs-guard
code: AUTHZ-2
mechanism: MethodDefinition · identity parameter decorator name · UseGuards on method or class
verdict: silent
report: none
hatch: reading the identity off the request instead of a parameter decorator — no parameter decorator is in the closed set, so the method is never a candidate and the body is never read. The door reads exactly the same unproven identity; the silence is not compliance
```

## Phạm vi

Mô-đun này ghi lại việc thi hành, không ghi lại sản phẩm. Nó không gọi tên sản phẩm nào, kho mã nào hay thư
viện thành phần nào. Tên quy tắc, không gian tên plugin mà nó xuất xưởng dưới đó, và các định danh decorator
mà quy tắc so khớp như chuỗi chữ đều là những thứ xuất hiện trong kết quả biên dịch và trong chính mã nguồn
của quy tắc, nên chúng được chép lại nguyên văn; đó là miễn trừ duy nhất, và nó không lan sang phần văn xuôi.
Còn luật hiểu thế nào là quyền sở hữu, là lời từ chối làm lộ dữ liệu, là quyền lợi và là chủ thể thì thuộc về
luật, và thuộc về con người đọc `AUTHZ-1`, `AUTHZ-3`, `AUTHZ-4`, `AUTHZ-5` và `AUTHZ-6`, bởi ở đây không máy
nào đọc chúng.
