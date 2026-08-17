---
title: Exceptions · Vietnamese
---

# Ngoại lệ

Đầu vào là mã đã viết xong — một tệp back end, một mẩu diff. Đầu ra là một **phán quyết**: tệp đó có
nằm trong phạm vi hay không, quy tắc đã công bố nào bắn, nó báo thông điệp gì và trên nút nào, ứng với
mã luật nào, và cửa còn mở nào lẽ ra đã che đúng thất bại đó. Mô-đun này không chọn thiết kế nào cả.
Nó từ chối, và nó phải chỉ được đúng ký tự mà nó từ chối.

## Luật

Một thất bại là **một thứ có tên và có dữ liệu đi kèm, không phải một câu chữ**: mọi thất bại đều là
một lớp con của `AbstractException`, khai báo trong một thư mục, và dựng bằng đúng một object metadata.

Luật nêu **sáu** mã. **Bốn mã có quy tắc giữ.** Nguồn công bố đúng bốn quy tắc trong `rules` và đúng
bốn trong `recommended`, hai danh sách khớp nhau; hai mã còn lại không có gì giữ. Bốn quy tắc chia làm
hai cặp, và cặp đôi ấy chính là thiết kế: hai quy tắc canh **chỗ ném**, hai quy tắc canh **chỗ khai
báo**, vì thiếu nửa nào cũng thủng. Một lớp kế thừa lớp nền của framework vẫn được ném ra bằng cái tên
nhà mình, nên quy tắc canh chỗ ném đọc thấy hoàn toàn bình thường. `throw-abstract-exception` công khai
là một phép suy đoán — một quy tắc đọc từng tệp một thì không thể xác minh lớp được ném kế thừa cái gì
— và `exception-extends-abstract` mới là thứ làm cho phép suy đoán ấy đứng vững, bằng cách bảo đảm mọi
lớp `*Exception` trong cây đều là hàng nhà mình.

## Luật máy đã xuất bản

| Quy tắc | Mã luật | Nó báo cái gì |
|---|---|---|
| `throw-abstract-exception` | `EXCEPTION-1` | `bareError` cho `throw new Error(...)`; `framework` cho `throw new <FrameworkException>(...)` khi tên nằm trong mười bảy ngoại lệ vận chuyển đã liệt kê |
| `require-exception-object-arg` | `EXCEPTION-2` | `zero` cho `new XException()`; `extra` khi có hơn một tham số; `notObject` khi tham số đầu không phải object literal |
| `exception-extends-abstract` | `EXCEPTION-3` | `base` cho lớp tên kết thúc bằng `Exception` mà định danh lớp cha trực tiếp là một tên khác `AbstractException` |
| `exception-in-errors-folder` | `EXCEPTION-4` | `place` cho lớp tên kết thúc bằng `Exception`, có lớp cha, khai báo trong tệp nằm ngoài thư mục `exceptions/errors/` |

`EXCEPTION-5` (metadata phải mang đúng thứ người đọc thất bại sẽ cần) và `EXCEPTION-6` (một khẳng định
của bộ chạy kiểm thử không phải một thất bại nghiệp vụ) **không có quy tắc nào giữ**. Chúng là phần
không được cưỡng chế, chứ không phải phần đã được che, nên một lần chạy xanh chẳng nói gì về cả hai.
`EXCEPTION-6` chỉ xuất hiện trong nguồn dưới dạng một *miễn trừ* nằm trong `EXCEPTION-1`, mà miễn trừ
khỏi một quy tắc không phải là cưỡng chế một quy tắc.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, và ghi lại.** Ngoài phạm vi ở đây không có nghĩa là tệp đã
   qua — cổng theo tên tệp trả về **bộ thăm rỗng**, nên quy tắc không tồn tại đối với tệp đó. Tệp bị
   chặn không phải là tệp kiểm một nửa; nó là tệp không được kiểm.
2. **Kiểm các miễn trừ ngay sau đó.** `/\.spec\.ts$/`, `/-spec\.ts$/` hoặc đường dẫn chứa `/src/tests/`
   tắt hẳn `throw-abstract-exception`; `/\/health(?:z)?\.controller\.ts$|\/health\//` chỉ tắt nhánh
   framework của nó; `/exceptions\/errors\/abstract\.ts$/` miễn cho chính tệp lớp nền khỏi
   `exception-extends-abstract`; `/\/exceptions\/errors\//` miễn một tệp khỏi
   `exception-in-errors-folder`. `require-exception-object-arg` không có cổng chặn theo tên tệp nào.
3. **Đọc các nút.** Quy tắc canh chỗ ném đọc `ThrowStatement` mà tham số là `NewExpression` với callee
   là `Identifier` — khác đi là bộ thăm thoát ngay dòng đầu. Quy tắc canh chỗ khai báo đọc
   `ClassDeclaration` có `node.id` với tên kết thúc bằng `Exception`.
4. **Xuất một khối cho mỗi phát hiện.** `new XException(1, 2)` là hai phát hiện trên cùng một chỗ ném:
   `extra` rồi `notObject`, vì sau khi báo `extra` quy tắc không `return`.
5. **Viết dòng `hatch` mỗi khi một cửa còn mở lẽ ra đã che đúng thất bại đó.** Phán quyết `silent` là
   một kết quả thật và phải được báo cáo.
6. **Đừng báo thứ không quy tắc nào canh.** Hai trong sáu mã không có máy giữ; một phán quyết nói khác
   đi là nói sai về mô-đun này.

## `throw-abstract-exception` — EXCEPTION-1

**Nó báo cái gì.** Hai thông điệp. `bareError` bắt `throw new Error(...)`: một câu chữ không mang mã ổn
định, nên phía sau không thể gom nhóm, khớp mẫu hay quyết định thử lại mà không đi phân tích tiếng Anh.
`framework` bắt `throw new BadRequestException(...)` và mười sáu tên anh em của nó: chúng mang một mã
trạng thái HTTP và không mang danh tính, nên hai thất bại chẳng liên quan gì tới nhau đi tới client
giống hệt nhau, và thứ duy nhất phân biệt chúng là câu thông báo — đúng cái phần hay bị viết lại nhất.

**Nó phát hiện bằng gì.** Thăm nút `ThrowStatement`. Đòi `node.argument.type === "NewExpression"`
**và** `callee.type === "Identifier"`; so `callee.name` với chuỗi `"Error"` trước, rồi với một `Set`
mười bảy tên ngoại lệ framework. Hai cổng cấp tệp đọc `context.filename`: `/\.spec\.ts$/`,
`/-spec\.ts$/` hoặc đường dẫn chứa `/src/tests/` tắt hẳn quy tắc;
`/\/health(?:z)?\.controller\.ts$|\/health\//` chỉ tắt nhánh framework.

**Nó không thấy gì.** `const failure = new Error("no seat left"); throw failure` — nút tại
`ThrowStatement` là một `Identifier` chứ không phải `NewExpression`, nên trình xử lý thoát ngay dòng
đầu. `return Promise.reject(new Error(...))`, `subscriber.error(new Error(...))` và
`callback(new Error(...))` không sinh ra `ThrowStatement` nào cả. `throw new TypeError(...)` và
`throw new RangeError(...)` không phải chuỗi `"Error"`, cũng không nằm trong `Set` đóng.
`PreconditionFailedException`, `MethodNotAllowedException`, `RpcException` và `WsException` nằm ngoài
mười bảy chuỗi viết tay, mà framework thì có thể thêm lớp mới ở bất kỳ phiên bản nào.
`import { BadRequestException as BadRequest }` rồi `throw new BadRequest(...)` đi lọt, vì quy tắc so
**định danh cục bộ** chứ không bao giờ so ràng buộc import — một dòng import đã tắt cả danh sách chặn
cho tệp đó. `throw new errors.CourseNotFoundException({})` có callee là `MemberExpression` nên thoát
trước khi đọc tên. Mọi tệp tên `*-spec.ts` được miễn theo hậu tố tên tệp, mà tên tệp là thứ rẻ nhất
trong một repo để đổi. Và mọi tệp nằm bất kỳ đâu dưới thư mục tên `health` đều thừa hưởng miễn trừ
framework, vì cổng probe là `\/health\/` — một đoạn thư mục, không phải một controller.

**Ranh giới.** Quy tắc này quyết định một ngoại lệ có được ném hay không. Hình dạng tham số hàm khởi
tạo thuộc về `require-exception-object-arg`, còn lớp được ném kế thừa cái gì thì vượt ngoài tầm một quy
tắc đọc một tệp — đó là phần `exception-extends-abstract` bù vào.

## `require-exception-object-arg` — EXCEPTION-2

**Nó báo cái gì.** Ba thông điệp. `zero` bắt `new XException()` — phải viết `new XException({})` kể cả
khi không có gì để nói, để mọi lần ném trong toàn bộ mã nguồn có **một** cách viết và người đọc không
phải tra xem ngoại lệ này có nhận tham số hay không. `extra` bắt nhiều hơn một tham số. `notObject` bắt
tham số đầu không phải object literal, vì một hình dạng theo vị trí thì không lớn lên được: ngày thất
bại đó cần thêm một trường, mọi chỗ ném đều phải sửa, và những chỗ sửa sai vẫn biên dịch trót lọt.

**Nó phát hiện bằng gì.** Cũng thăm `ThrowStatement` với cùng yêu cầu `NewExpression` + `Identifier`.
Lọc tên bằng `/Exception$/`, rồi bỏ `AbstractException` và bỏ mọi tên có trong `Set` framework. Sau đó
đọc `arguments.length` cho `zero` và `extra`, và `arguments[0].type !== "ObjectExpression"` cho
`notObject`. **Không có cổng chặn theo tên tệp nào.**

**Nó không thấy gì.** Khe hở nặng nhất của nó chạy theo chiều ngược: `const meta = { id }` rồi
`throw new CourseNotFoundException(meta)` là hình dạng **đúng**, nhưng quy tắc vẫn báo lỗi, vì nó kiểm
`arguments[0].type === "ObjectExpression"` tại chỗ gọi chứ không kiểm giá trị. Hằng số làm lẫn literal
theo cả hai chiều. `new XException({} as SomeMeta)` là `TSAsExpression` nên bị báo dù nội dung đúng.
`const e = new XException(); throw e` thoát ở yêu cầu `NewExpression`. Một ngoại lệ nhà mình đặt tên
`CourseNotFoundError` không khớp `/Exception$/` nên vô hình. `new errors.XException()` có callee là
`MemberExpression` nên thoát. Và `new ServiceUnavailableException(body)` cố tình không thuộc phần việc
của quy tắc này.

**Ranh giới.** Hàm khởi tạo của framework bị bỏ qua: hình dạng đó do framework công bố, và sửa nó là
đổi thứ được gửi đi. Việc có được ném một ngoại lệ như vậy hay không là câu hỏi của
`throw-abstract-exception`, và quy tắc đó trả lời nó.

## `exception-extends-abstract` — EXCEPTION-3

**Nó báo cái gì.** Thông điệp `base` — một lớp tên kết thúc bằng `Exception` mà lớp cha trực tiếp là
một định danh khác `AbstractException`. Đây là quy tắc làm cho `EXCEPTION-1` trở nên có căn cứ. Canh
chỗ ném là không đủ: một lớp kế thừa lớp nền framework vẫn được ném bằng chính tên nó, nên chỗ ném
**đọc lên giống hàng nhà mình** và quy tắc canh chỗ ném không thấy gì bất thường.

**Nó phát hiện bằng gì.** Thăm `ClassDeclaration`. Đòi có `node.id` và `/Exception$/` trên
`node.id.name`. Đọc `node.superClass`; thoát khi không có lớp cha, khi `type` của lớp cha không phải
`Identifier`, hoặc khi `name` của nó đúng bằng `AbstractException`. Một cổng theo tên tệp:
`/exceptions\/errors\/abstract\.ts$/` miễn cho chính tệp của lớp nền.

**Nó không thấy gì.** `export const CourseException = class CourseException extends ConflictException {}`
là `ClassExpression`, một loại nút khác, không bao giờ được thăm.
`class CourseException extends mixin(ConflictException) {}` và `extends base.Http {}` bị từ chối báo vì
lớp cha không phải `Identifier` — đó là im lặng, không phải cho qua.
`class CourseNotFoundError extends ConflictException {}` rơi khỏi bộ lọc `/Exception$/` và khỏi mọi
cưỡng chế ở chỗ khai báo, trong khi vẫn được ném từ mọi chỗ gọi. Quy tắc **đòi kế thừa trực tiếp**, nên
một lớp nền trung gian hợp lệ — `class HttpishException extends AbstractException {}` rồi
`class XException extends HttpishException {}` — vẫn bị báo dù xét bắc cầu thì nó đúng luật. Và đổi tên
tệp lớp nền thành `base.ts` là chính lớp nền bị báo lỗi: cổng miễn trừ neo vào một tên tệp duy nhất.

**Ranh giới.** Quy tắc này xét lớp kế thừa cái gì, không xét nó được viết ở đâu. Chỗ đặt thuộc về
`exception-in-errors-folder`.

## `exception-in-errors-folder` — EXCEPTION-4

**Nó báo cái gì.** Thông điệp `place` — một lớp tên kết thúc bằng `Exception`, có lớp cha, khai báo
trong tệp nằm ngoài thư mục ngoại lệ. Gom một chỗ để câu hỏi "ứng dụng này có thể ném ra những gì?" có
**một** chỗ tra, và để người review nhìn thấy một dạng thất bại mới **đi vào** trong diff thay vì phát
hiện nó ngoài môi trường chạy thật.

**Nó phát hiện bằng gì.** Cổng cấp tệp chạy trước: `/\/exceptions\/errors\//` khớp trên
`context.filename` đã chuẩn hoá dấu gạch thì trả về bộ thăm rỗng. Ngược lại thăm `ClassDeclaration`,
đòi `node.id`, đòi `/Exception$/` trên tên, và đòi `node.superClass` tồn tại ở bất kỳ hình dạng nào.

**Nó không thấy gì.** Cổng khớp **cặp thư mục theo tên**, ở bất kỳ đâu trong đường dẫn: thư mục
`exceptions/errors/` thứ hai, thứ ba và thứ hai mươi đều thoả, nên thứ được cưỡng chế là "một thư mục
viết đúng chữ", không phải "một chỗ để tra". `class CourseException {}` không kế thừa gì, viết ngoài
thư mục, thì quy tắc thoát theo thiết kế — một hình dạng không trang trí gì không được coi là ngoại lệ,
và một lớp thất bại thật viết mà không có lớp nền là cái giá của quyết định đó. `ClassExpression` không
được thăm, y như trên. `type XException = ...` và `interface XException` không phải `ClassDeclaration`.
Thư mục viết `exception/errors/` — thiếu một chữ `s` — thì bị báo dù ý định đúng; đó là cùng một khe hở
nhìn từ chiều ngược lại.

**Ranh giới.** Quy tắc này báo một lớp ở nơi nó **được viết**, không phải nơi nó được dùng, nên dời lớp
tới sát mã ném nó cũng không thoát được.

## Cách phát hiện

| Phần | Cơ chế |
|---|---|
| chuẩn hoá dấu gạch | Cả bốn đổi `\` thành `/` trước mọi phép so đường dẫn, nên đường dẫn Windows so giống mọi đường dẫn khác |
| ngoài phạm vi | Cổng theo tên tệp trả về **bộ thăm rỗng**. Quy tắc không tồn tại với tệp đó, chứ không phải cho tệp đó qua |
| hình dạng chỗ ném | `ThrowStatement` với `node.argument.type === "NewExpression"` và `callee.type === "Identifier"`; `node.arguments` chỉ được đọc sau khi cả hai điều kiện đúng |
| hình dạng chỗ khai báo | `ClassDeclaration` có `node.id`, `/Exception$/` trên `node.id.name`, và `node.superClass` (`type` và `name`) |
| danh sách tên framework | Một `Set` đóng mười bảy tên ngoại lệ vận chuyển, viết cứng trong nguồn |
| tầm với | Cả bốn đều đọc một tệp: không quy tắc nào giải import, đọc kiểu, hay biết tệp khác khai báo gì |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này đi lọt, nhưng không.

| Viết như thế này | Vì sao vẫn bị bắn |
|---|---|
| `class CourseAlreadyEnrolledException extends ConflictException {}`, ném bằng `new CourseAlreadyEnrolledException({ id })` | Chỗ ném đọc lên giống hàng nhà mình và `EXCEPTION-1` cho qua — nhưng `exception-extends-abstract` báo ở chỗ khai báo. Đó là cặp đôi đang làm việc; một lớp như vậy từng sống qua bốn chỗ gọi trước khi quy tắc thứ hai ra đời |
| Dời lớp tới sát mã ném nó | `exception-in-errors-folder` là quy tắc canh chỗ khai báo, nên lớp bị báo ở nơi nó được viết, không phải nơi nó được dùng |
| Một tệp dưới thư mục tên `health` ném `new Error(...)` | Miễn trừ probe chỉ chặn nhánh framework. Nhánh `Error` báo trước và thoát trước khi tới phép kiểm probe |
| `new UserNotFoundException()` trong một spec | Cổng làn kiểm thử chỉ thuộc về `EXCEPTION-1`. `require-exception-object-arg` không có cổng tên tệp nên bắn ở mọi làn |
| `new ServiceUnavailableException(body)` | Cố tình không thuộc phần việc của `EXCEPTION-2`: framework đã công bố hàm khởi tạo đó và sửa nó là đổi thứ được gửi đi. Việc có được ném hay không là câu hỏi của `EXCEPTION-1`, và quy tắc đó trả lời nó |
| Kế thừa lớp nền từ một tệp mang tên khác | Chỉ `exceptions/errors/abstract.ts` được miễn `exception-extends-abstract`; một lớp nền tự khai báo thứ hai ở nơi khác vẫn bị báo |

**Còn mở** — phần mù đã xuất xưởng. Một phán quyết không được nói rằng những thứ này đã được xét.

| Phạm vi | Cái gì đi lọt |
|---|---|
| cả hai quy tắc chỗ ném | `const failure = new Error("no seat left"); throw failure` — một `Identifier` tại `ThrowStatement` không phải `NewExpression`, nên cả hai bộ thăm thoát ngay dòng đầu của trình xử lý |
| cả hai quy tắc chỗ ném | `return Promise.reject(new Error(...))`, `subscriber.error(new Error(...))`, `callback(new Error(...))` — không có `ThrowStatement` nào. Cùng thất bại đó tới cùng người gọi mà không quy tắc nào từng chạy |
| cả hai quy tắc chỗ ném | `throw new errors.CourseNotFoundException({})` — `callee.type` là `MemberExpression`, nên các phép kiểm thoát trước khi đọc tên |
| `throw-abstract-exception` | `throw new TypeError(...)`, `throw new RangeError(...)` — mọi lớp dựng sẵn khác đều không phải chuỗi `"Error"` và cũng không nằm trong `Set` |
| `throw-abstract-exception` | `PreconditionFailedException`, `MethodNotAllowedException`, `RpcException`, `WsException` — danh sách là mười bảy chuỗi viết tay, mà framework có thể thêm lớp mới ở bất kỳ phiên bản nào |
| `throw-abstract-exception` | `import { BadRequestException as BadRequest }` rồi `throw new BadRequest(...)` — quy tắc so định danh cục bộ, nên một lần đổi tên ở dòng import đã tắt danh sách chặn cho tệp đó |
| `throw-abstract-exception` | Mọi tệp tên `*-spec.ts` — một tệp trợ giúp sản xuất đặt tên `client-spec.ts` tắt quy tắc cho toàn bộ nội dung của nó, mà tên tệp là thứ rẻ nhất trong một repo để đổi |
| `throw-abstract-exception` | Mọi tệp nằm bất kỳ đâu dưới thư mục tên `health` — cả service, mapper lẫn repository đều thừa hưởng miễn trừ mà nguồn mô tả là hẹp tới mức một controller |
| `require-exception-object-arg` | `const meta = { id }` rồi `throw new CourseNotFoundException(meta)` — cửa mở ngược: đây là hình dạng đúng mà quy tắc vẫn báo, vì nó kiểm loại nút tại chỗ gọi chứ không kiểm giá trị. Hằng số làm lẫn literal theo cả hai chiều |
| cả hai quy tắc chỗ khai báo | `export const CourseException = class CourseException extends ConflictException {}` — `ClassExpression` là loại nút khác và không bao giờ được thăm |
| cả hai quy tắc chỗ khai báo | `class CourseNotFoundError extends ConflictException {}` — đổi hậu tố tên là đưa lớp ra khỏi mọi cưỡng chế trong khi nó vẫn được ném từ mọi chỗ gọi |
| `exception-extends-abstract` | `class CourseException extends mixin(ConflictException) {}` hoặc `extends base.Http {}` — lớp cha là lời gọi hay biểu thức thành viên thì quy tắc im lặng, không phải cho qua |
| `exception-in-errors-folder` | Thư mục `exceptions/errors/` thứ hai, thứ ba và thứ hai mươi — cổng khớp cặp thư mục theo tên, ở bất kỳ đâu trong đường dẫn |
| `exception-in-errors-folder` | `class CourseException {}` không kế thừa gì, nằm ngoài thư mục — quy tắc thoát khi thiếu `superClass`, theo thiết kế |
| cả bốn | `// eslint-disable-next-line` đặt trên bất kỳ quy tắc nào trong bốn. Không quy tắc nào là không tắt được; mọi cửa ở trên đều tới được bằng một dòng, bởi một người đang vội |
| không quy tắc nào | Mọi thứ `EXCEPTION-5` và `EXCEPTION-6` nêu — metadata không mang đúng thứ người đọc thất bại sẽ cần, và một khẳng định của bộ chạy kiểm thử khoác áo thất bại nghiệp vụ |

## Đầu vào

| Đầu vào | Bằng chứng phải có |
|---|---|
| `context.filename` | Đường dẫn đúng như quy tắc nhìn thấy, đã chuẩn hoá dấu gạch ngược, và mẫu nào trong làn kiểm thử, probe, tệp lớp nền hay thư mục lỗi đã khớp |
| `ThrowStatement` | `node.argument`, `type` của nó, `callee.type`, `callee.name` và `arguments` |
| `ClassDeclaration` | `node.id.name` và `node.superClass` (`type` và `name`) |
| Danh sách tên framework | Một `Set` đóng mười bảy tên ngoại lệ vận chuyển, viết cứng trong nguồn |

Không đọc gì khác. Không thông tin kiểu, không đồ thị import, không tệp thứ hai, không cấu hình — mọi
quy tắc đều khai báo `schema: []` nên không nhận tuỳ chọn nào.

## Quy tắc

1. Danh tính của một quy tắc là **tên đã công bố** của nó. Không có mã số riêng cho quy tắc; cái tên đó
   mới là chuỗi build in ra, chuỗi nằm trong dòng tắt cảnh báo, và chuỗi mọi cuộc trao đổi về lỗi dùng.
2. Chỉ ghi lại quy tắc **có thật trong nguồn**. Một quy tắc đáng có mà chưa có thì không phải một dòng
   trong bảng đã công bố.
3. Mỗi quy tắc giữ đúng một mã luật; không mã nào bị hai quy tắc cùng giữ.
4. Mọi quy tắc đều là `meta.type: "problem"` và mọi quy tắc đều ở mức `error` trong `recommended`.
5. Quy tắc canh chỗ ném chỉ thấy `ThrowStatement` với một định danh được dựng trực tiếp; mọi thứ khác
   nằm ngoài tầm với của chúng do cấu tạo, không phải do sơ ý.
6. Quy tắc canh chỗ khai báo chỉ thấy `ClassDeclaration` có tên kết thúc bằng `Exception`.
7. Cổng theo tên tệp trả về **bộ thăm rỗng**, nên tệp bị chặn không phải là tệp kiểm một nửa — nó là
   tệp không được kiểm.
8. Mọi cửa còn mở ở trên là khe hở của **quy tắc**, không bao giờ là quyền được viết như vậy của
   **luật**. Mã đi lọt vẫn là mã sai.
9. Nói "cổng xanh" và nói "quy tắc đã nhìn" là hai câu khác nhau; chỉ một trong hai là bằng chứng.

## Ngoại lệ

Đây là những miễn trừ đã viết sẵn trong nguồn, không phải sự nới tay của luật. Mỗi miễn trừ đều đóng và
gọi tên quy tắc mà nó tha.

- **Làn kiểm thử.** Họ `.spec.ts`, `-spec.ts` và mọi đường dẫn dưới `/src/tests/` được phép
  `throw new Error`, vì ở đó câu đó nghĩa là "bộ chạy kiểm thử không đi tiếp được" chứ không phải đặt
  tên cho một thất bại mà sản phẩm có thể sinh ra. Chỉ tha `throw-abstract-exception`;
  `require-exception-object-arg` vẫn bắn trong làn kiểm thử. Miễn trừ này từng được cấp trong lời văn
  nhưng thiếu trong quy tắc, và một repo áp dụng đã thừa hưởng 69 phát hiện mà chính luật của nó đã
  tha.
- **Probe sống/sẵn sàng.** Một tệp khớp mẫu probe được ném ngoại lệ framework, vì ở đó mã trạng thái là
  toàn bộ hợp đồng — phía đọc chỉ lấy mã trạng thái và không bao giờ lấy thân phản hồi, nên mã trạng
  thái *chính là* danh tính. Chỉ tha nhánh framework của `throw-abstract-exception`. `Error` **vẫn** bị
  từ chối: trạng thái của probe là hợp đồng, còn một cú sập không tên thì không.
- **Hàm khởi tạo của framework.** `require-exception-object-arg` bỏ qua mọi tên có trong danh sách
  framework. Hình dạng đó do framework công bố, và sửa nó là đổi thứ được gửi đi. Việc có được ném một
  ngoại lệ như vậy hay không thuộc về `throw-abstract-exception`.
- **Tệp của lớp nền.** `exceptions/errors/abstract.ts` được tha khỏi `exception-extends-abstract`, vì
  nó giữ lớp duy nhất được phép kế thừa thứ khác.
- **Thư mục ngoại lệ theo từng ứng dụng.** Cổng thư mục cố tình không neo vào một đường dẫn tuyệt đối,
  tha `exception-in-errors-folder` cho mọi cặp thư mục viết đúng chữ. Bản trước neo vào bố cục của đúng
  một repo và báo 83 phát hiện ở một back end khác, mà phần lớn các tệp đứng đầu danh sách **đã** nằm
  trong một thư mục `exceptions/errors/` — chỉ không phải thư mục đó. Một quy tắc bắn vào mã đúng còn
  tệ hơn không có quy tắc, vì người sau học được thói quen cuộn qua nó.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
rule:     <throw-abstract-exception | require-exception-object-arg | exception-extends-abstract | exception-in-errors-folder>
code:     <EXCEPTION-1 | EXCEPTION-2 | EXCEPTION-3 | EXCEPTION-4>
file:     <path as the rule normalized it>
gate:     <none | test-lane | probe | base-file | errors-folder>
node:     <ThrowStatement argument | first argument | superClass | class identifier>
message:  <bareError | framework | zero | extra | notObject | base | place>
verdict:  <fires | silent: hatch <name from the Open table>>
```

Một tệp sạch xuất một khối cho mỗi quy tắc đã chạy, với `message: none` và `verdict: silent: no hatch`
— các quy tắc đã nhìn và không thấy gì. Một tệp ngoài phạm vi xuất một khối gọi tên cổng đã khớp và
`verdict: silent: gate` — không bộ thăm nào được lắp, nên tệp đó là chưa được xét chứ không phải sạch.

## Ví dụ đã giải

**Đầu vào.** Một tệp service, `src/modules/enrollment/enrollment.service.ts`, và một tệp lớp nằm cạnh
nó, `src/modules/enrollment/course-already-enrolled.exception.ts`:

```ts
// enrollment.service.ts
import { ConflictException } from "@nestjs/common"
import { CourseAlreadyEnrolledException } from "./course-already-enrolled.exception"

export class EnrollmentService {
  enroll(userId: string, courseId: string) {
    if (!courseId) throw new Error("missing course")
    if (this.full(courseId)) throw new ConflictException("course is full")
    if (this.has(userId, courseId)) throw new CourseAlreadyEnrolledException()
  }
}
```

```ts
// course-already-enrolled.exception.ts
import { ConflictException } from "@nestjs/common"

export class CourseAlreadyEnrolledException extends ConflictException {}
```

Không tệp nào khớp mẫu làn kiểm thử, probe, tệp lớp nền hay thư mục lỗi, nên cả bốn quy tắc đều chạy.

```text
rule:     throw-abstract-exception
code:     EXCEPTION-1
file:     src/modules/enrollment/enrollment.service.ts
gate:     none
node:     ThrowStatement argument
message:  bareError
verdict:  fires
```

```text
rule:     throw-abstract-exception
code:     EXCEPTION-1
file:     src/modules/enrollment/enrollment.service.ts
gate:     none
node:     ThrowStatement argument
message:  framework
verdict:  fires
```

```text
rule:     require-exception-object-arg
code:     EXCEPTION-2
file:     src/modules/enrollment/enrollment.service.ts
gate:     none
node:     first argument
message:  zero
verdict:  fires
```

Chỗ ném thứ ba đọc lên giống hàng nhà mình nên `EXCEPTION-1` cho qua. Chỗ khai báo mới là nơi bắt được
nó:

```text
rule:     exception-extends-abstract
code:     EXCEPTION-3
file:     src/modules/enrollment/course-already-enrolled.exception.ts
gate:     none
node:     superClass
message:  base
verdict:  fires
```

```text
rule:     exception-in-errors-folder
code:     EXCEPTION-4
file:     src/modules/enrollment/course-already-enrolled.exception.ts
gate:     none
node:     class identifier
message:  place
verdict:  fires
```

**Đã sửa.** Lớp chuyển vào `src/modules/enrollment/exceptions/errors/` và kế thừa lớp nền nhà mình; mọi
chỗ ném đều gọi tên một ngoại lệ nhà mình và truyền đúng một object literal:

```ts
// src/modules/enrollment/exceptions/errors/course-already-enrolled.exception.ts
import { AbstractException } from "../../../../exceptions/errors/abstract"

export class CourseAlreadyEnrolledException extends AbstractException {}
```

```ts
// enrollment.service.ts
if (!courseId) throw new CourseIdRequiredException({ courseId })
if (this.full(courseId)) throw new CourseFullException({ courseId })
if (this.has(userId, courseId)) throw new CourseAlreadyEnrolledException({ userId, courseId })
```

Một cửa còn mở sống sót qua lần sửa này. Một thao tác refactor bình thường đưa đúng cái `Error` trần đó
quay lại, đi lọt mọi quy tắc:

```ts
const failure = new Error("missing course")
throw failure
```

```text
rule:     throw-abstract-exception
code:     EXCEPTION-1
file:     src/modules/enrollment/enrollment.service.ts
gate:     none
node:     ThrowStatement argument
message:  none
verdict:  silent: hatch an Identifier at the ThrowStatement is not a NewExpression
```

Dòng `message: none` đó là một báo cáo không có gì, và nó không phải một lần cho qua: trình xử lý thoát
ngay dòng đầu, nên chỗ ném này là chưa được xét chứ không phải hợp lệ.

Và metadata trong các chỗ ném đã sửa thì không có gì xét cả: `EXCEPTION-5` không có quy tắc nào giữ,
nên `{ userId, courseId }` dù không mang thứ gì người đọc thất bại dùng được thì vẫn là im lặng, không
phải tuân thủ.

## Phạm vi

Mô-đun này ghi lại bốn quy tắc của một luật back end, và chỉ ghi phần cưỡng chế — không ghi chính lời
văn của luật. Nó không nêu tên sản phẩm, công ty hay repository nào. Tên quy tắc, định danh thông điệp
và tên lớp mà các quy tắc khớp là **những định danh có xuất xưởng** nên được chép nguyên văn; miễn trừ
đó không bao trùm thứ gì khác. Metadata phải chứa gì, và một khẳng định kiểm thử có phải một thất bại
nghiệp vụ hay không, thuộc về `EXCEPTION-5` và `EXCEPTION-6`, hai mã mà không quy tắc nào trong mô-đun
này giữ.
