---
title: Observability · Vietnamese
---

# Quan sát vận hành

## LOADS

None.


## Bản ghi

Gate này nhận đoạn mã đã được viết ra rồi — một tệp, một mảnh diff. Kết quả là một **phán quyết**: quy tắc
đã công bố nào nổ, nổ trên nút nào, khớp với chuỗi nào, ứng với mã luật nào, và cửa nào còn mở đủ để
che đúng cái sai ấy. Mô-đun này không chọn một thiết kế ghi log nào cả. Nó từ chối, và nó phải chỉ được
vào đúng ký tự mà nó từ chối.

## Luật

Mọi dòng log rời tiến trình đều đi qua một đường ống gắn mã tương quan và cấu hình vận chuyển, và mọi
dòng log đều mang một cái tên đếm được, nhóm được, lọc được. Luật gọi tên ba lối một dòng log thoát ra
khỏi đường ống ấy — logger của khung, `console`, và một cái tên đã hợp nhất với dữ liệu của nó.

Luật nêu tám mã, `OBSERVABILITY-1` đến `OBSERVABILITY-8`. **Ba mã có quy tắc.** Thêm một mã nữa,
`OBSERVABILITY-6`, được giữ bằng một danh sách đường dẫn trong cấu hình chứ không phải bằng quy tắc.
Năm mã còn lại không có máy nào giữ. Đó không phải chỗ bỏ sót: phần còn lại của luật là **phán đoán**.
Log ghi lại một quyết định hay chỉ ghi lại một lần đi qua, thất bại mang theo danh tính hay mang theo
câu tiếng Anh đã dựng, một tiến trình đo đạc có tự trả chi phí vòng đời của nó không — không thứ nào
trong đó là một hình dạng. Bộ phân tích cú pháp thấy được rằng một lời gọi đã xảy ra; nó không thấy
được đoạn mã ấy **để làm gì**. Một quy tắc đoán mò sẽ nổ trên mã đúng đủ nhiều để ai cũng học cách tắt
nó đi, mà một quy tắc ai cũng tắt thì chẳng giữ gì cả trong khi trông như đang giữ.

Vậy lời khai trung thực về mức enforcement là: **ba mã có máy giữ và cái máy ấy có những lỗ đã biết,
một mã được giữ bằng danh sách cấu hình chứ không phải quy tắc, bốn mã không có máy nào.** Một mã không
có quy tắc thì ai cũng biết là chưa ai giữ, nên vẫn còn được đọc bằng mắt. Một quy tắc bị tin là kín mà
thật ra hở thì mua sự im lặng và trả bằng cảm giác đã được che.

## Luật máy đã xuất bản

| Quy tắc | Mã | Nó báo cái gì |
|---|---|---|
| `no-framework-logger` | `OBSERVABILITY-1` (một nửa) | `imported` — một câu nhập lấy tên `Logger` từ đúng chuỗi nguồn `@nestjs/common`; `constructed` — mọi `new Logger(...)` mà callee là định danh trần |
| `no-interpolated-log-message` | `OBSERVABILITY-2` | `built` — đối số thứ nhất của một phương thức log trên dịch vụ ghi log của nhà, khi đối số đó là chuỗi mẫu, phép nối `+`, hoặc chữ chuỗi |
| `no-error-wording-as-log-identity` | `OBSERVABILITY-5` | Failure log mang wording của exception trong data nhưng thiếu danh tính ổn định `error.code`. |

Cả ba quy tắc đã công bố đều có mã để giữ. Chiều ngược lại mới là chỗ trống, và chỗ trống rất rộng.
`OBSERVABILITY-3` (một cái tên không có dữ liệu bên cạnh) **không có quy tắc nào**: không ai đọc đối số
thứ hai. `OBSERVABILITY-4` ("quyết định, không phải lần đi qua") **không có quy tắc nào**: nó cần biết
đoạn mã để làm gì. `OBSERVABILITY-5` nay có quy tắc hẹp cho hình dạng failure log nhìn thấy được:
wording mà thiếu `error.code`. `OBSERVABILITY-7` (ranh giới thay đổi) **không có
quy tắc nào**: đó là việc của bản duyệt. `OBSERVABILITY-8` (ngân sách vòng đời) **không có quy tắc
nào**: đó là một bản mô tả, không phải một loại nút. `OBSERVABILITY-6` được giữ bằng
`standaloneProgramGlobs`, một danh sách đường dẫn được xuất ra — là giá trị cấu hình, không phải quy
tắc, và phạm vi của nó là thư mục. Các phần ngữ nghĩa còn lại là **chưa ai giữ**, không phải đã được che.

Chỗ cần nói thẳng nhất trên trang này là `OBSERVABILITY-2`. Luật nói tên sự kiện **là một thành viên
enum**. Quy tắc cấm ba cách viết một chuỗi được dựng ra. Hai câu đó không cùng một nghĩa: quy tắc giữ
nửa phủ định và không giữ chút nào nửa khẳng định. Đối số không thuộc ba hình dạng kia thì đi lọt — kể
cả một định danh, một lời gọi hàm, một con số và `null`. **Không có gì ở đây kiểm rằng tên log đến từ
enum.**

Lối ra còn lại mà `OBSERVABILITY-1` gọi tên là `console`, giao cho quy tắc chuẩn `no-console` và được
bật bằng tên trong bộ `recommended`. Để `no-console` tắt thì hai quy tắc kia thành đồ trang trí: đó là
lối ra thứ ba, và là lối rẻ nhất để với tới.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, và ghi lại nó.** Không quy tắc nào có cổng theo tên tệp,
   nên phạm vi duy nhất là phạm vi đường dẫn do cấu hình đặt. Một tệp bị cấu hình loại ra thì không
   phải là sạch — không visitor nào được cài, và quy tắc không tồn tại với tệp đó.
2. **Kiểm miễn trừ trước.** Một tệp nằm trong các thư mục do `standaloneProgramGlobs` gọi tên thì được
   thả theo đường dẫn. Miễn trừ theo thư mục không phải miễn trừ theo tệp; hãy ghi rõ glob nào đã thả
   nó.
3. **Đọc các nút theo đúng thứ tự quy tắc đọc.** Chuỗi nguồn của `ImportDeclaration`, rồi loại
   specifier và `imported.name`; loại callee của `NewExpression` trước khi tới tên callee; với một lời
   gọi log thì loại callee, `callee.computed`, tên phương thức, cách viết bên nhận, rồi `arguments[0]`
   và không gì sau đó.
4. **Mỗi phát hiện xuất đúng một khối.**
5. **Viết dòng `hatch` mỗi khi có một cửa mở đủ sức che đúng cái sai ấy** — một câu nhập theo không
   gian tên, một lớp bọc, một bên nhận đã đổi tên, một hằng số giặt chữ, một ô dịch sang phải.
6. **Không báo thứ không quy tắc nào canh.** Bốn trong tám mã không có quy tắc; một phán quyết nói khác
   đi là nói sai về mô-đun này.

## `no-framework-logger` — OBSERVABILITY-1

**Nó báo cái gì.** Hai chuyện khác nhau, hai thông điệp khác nhau. `imported` — một câu lệnh nhập lấy
tên `Logger` từ đúng chuỗi nguồn `@nestjs/common`; báo ngay tại **specifier**, nên dòng cần chú thích
tắt là dòng nhập chứ không phải dòng dùng. `constructed` — bất kỳ `new Logger(...)` nào mà callee là
định danh trần.

**Nó phát hiện bằng gì.** Hai visitor, **không có cổng theo tên tệp** — quy tắc sống ở mọi tệp được
lint. `ImportDeclaration` trả về ngay nếu `node.source.value` không bằng đúng chuỗi `@nestjs/common`;
sau đó duyệt `node.specifiers`, bỏ qua mọi phần tử có `type` khác `ImportSpecifier`, và báo khi
`specifier.imported.name` đúng bằng `Logger` — tên **tại nguồn**, không phải `local.name`.
`NewExpression` báo khi `node.callee.type` là `Identifier` và `node.callee.name` đúng bằng `Logger`;
nhánh này **không** hỏi đường dẫn gói, và chính điều đó chặn một câu nhập đã đổi tên hoặc đã đi qua tệp
trung gian lách được nhánh trên.

**Điểm mù.** `import * as common from "@nestjs/common"` rồi `new common.Logger(...)`: vòng lặp
nhập bỏ qua mọi specifier không phải `ImportSpecifier`, mà specifier không gian tên thì không phải, còn
callee của lời dựng là `MemberExpression` nên nhánh thứ hai từ chối. **Cả hai nhánh cùng trượt một
dòng** — đây là lỗ rộng nhất trên trang này. Lớp anh em cùng gói, `new ConsoleLogger(...)` hoặc một lớp
tự viết cài đặt giao diện logger của khung: tập tên là đúng một chuỗi. `class HouseLogger extends
Logger {}` ở một tệp rồi `new HouseLogger()` ở bốn mươi tệp khác: `extends` không phải `NewExpression`,
và một lớp bọc tắt quy tắc trên toàn kho. `Logger.log("…")`, lời gọi tĩnh đến qua không gian tên hoặc
qua tệp trung gian: không có gì được dựng, còn nhánh nhập chỉ thấy đúng chuỗi gói. Đường dẫn gói sâu
hay bí danh, `"@nestjs/common/services"` hoặc một bí danh không gian làm việc: phép so là bằng chuỗi
trên đúng thứ đã viết ra, không phải phân giải mô-đun. `const { Logger } = require("@nestjs/common")`:
không có nút `ImportDeclaration` nào, nên việc truyền lớp ấy đi tiếp — vào một factory, vào một lời gọi
`useLogger` của khung — là vô hình. Một tệp nằm trong `standaloneProgramGlobs` mà không phải chương
trình độc lập: thư mục không phải tệp, nên một dịch vụ có yêu cầu để gắn vào, nếu bị chuyển vào thư mục
đã miễn, sẽ nằm ngoài vòng kiểm mà không có tín hiệu nào báo. Và ngược chiều: `import type { Logger }
from "@nestjs/common"` **vẫn bị báo** dù không nên, vì `importKind` không bao giờ được đọc — một báo
cáo sai, và cái giá của nó là dạy người ta viết chú thích tắt lên những dòng vốn đúng.

**Ranh giới.** Quy tắc này giữ một trong hai lối ra mà `OBSERVABILITY-1` gọi tên. Lối `console` thuộc
về quy tắc chuẩn `no-console`, được gọi tên trong `recommended` và không viết ở đây.

## `no-interpolated-log-message` — OBSERVABILITY-2

**Nó báo cái gì.** Một thông điệp duy nhất, `built`: đối số thứ nhất của một phương thức log trên dịch
vụ ghi log của nhà, khi đối số đó là `TemplateLiteral`, là `BinaryExpression` với toán tử `+`, hoặc là
`Literal` có `value` thuộc `typeof "string"`. Báo cáo gắn vào **đối số**, không gắn vào lời gọi. Đáng
chú ý là chữ chuỗi trần cũng bị bắt: `info("ORDER_HANDLED")` trông rất ngoan và vẫn bị báo, vì nó chỉ
cách một lần sửa chữ là thành một sự kiện khác đối với mọi bảng theo dõi dựng trên nó.

**Nó phát hiện bằng gì.** Một visitor `CallExpression`, không có cổng theo tên tệp. Nó đòi
`callee.type === "MemberExpression"` và `callee.computed === false`; đòi `callee.property.name` nằm
trong tập đóng sáu phần tử `log`, `error`, `warn`, `info`, `debug`, `verbose`; đòi bên nhận đi qua
`isLoggerReceiver`, vốn chấp nhận `Identifier` có `name` đúng bằng `winstonService`, hoặc
`MemberExpression` không tính toán có `property.name` đúng bằng `winstonService`, và không gì khác. Rồi
nó đọc `node.arguments[0]`, trả về nếu vắng, và báo trên ba hình dạng kia.

**Điểm mù.** Một thuộc tính được tiêm đã đổi tên — `this.logger.info(…)`, `this.log.info(…)` —
với đúng dịch vụ ấy phía sau: danh tính bên nhận là **cách viết** `winstonService`, nên quy tắc là một
quy ước đặt tên mang thông điệp nói về mã tương quan, và một lần đổi tên bình thường là hết quy tắc cho
cả lớp đó. **Hằng số giặt sạch chữ**: `` const message = `opened ${id}` `` ở dòng trên,
`this.winstonService.info(message)` ở dòng dưới — đối số giờ là `Identifier`, và không ai lần ngược lại
chỗ nó được dựng. Bất kỳ lời gọi nào ở vị trí đầu: `info(buildName(order))`, `info(names.get(kind))`,
`` info(`x`.toUpperCase()) `` — `CallExpression` không nằm trong ba hình dạng, và chuỗi hợp nhất đến
như một giá trị, được sinh ra cách đó đúng một khung ngăn xếp. Sự hợp nhất dịch sang ô bên phải,
`` this.winstonService.error(WinstonLog.PaymentFailed, `declined: ${error.message}`) `` — chỉ
`arguments[0]` được đọc, nên tên đã nhóm được mà dữ liệu bên cạnh vẫn là một câu văn không truy vấn
được; đó là `OBSERVABILITY-3` và `OBSERVABILITY-5` trong một dòng, và không quy tắc nào nhìn. Nửa
khẳng định bỏ trống: `info(someVariable)`, `info(0)`, `info(null)`,
`` info(cond ? A : `built ${x}`) `` đều đi lọt, toán tử ba ngôi giấu chuỗi mẫu vào một loại nút không
được soi. Truy cập tính toán ở bất kỳ vế nào: `` this.winstonService["info"](`…`) `` trượt ở
`callee.computed === false`, còn `` this["winstonService"].info(`…`) `` trượt ở `isLoggerReceiver`.
Tách rời phương thức, `const { info } = this.winstonService` hoặc
`const log = this.winstonService.info.bind(…)`, biến callee thành `Identifier` trần và visitor trả về
ngay dòng đầu tiên. Một mức log ngoài tập đóng — `fatal`, `http`, `silly`, hay một `write`/`emit` chung
mà tầng vận chuyển phơi ra — là cánh cửa thứ bảy không ai giữ, và không có gì báo rằng tập đã cũ. Và
một dịch vụ ghi log thứ hai, hoặc cùng dịch vụ ấy được tiêm dưới một cái tên thứ hai trong một lớp, đều
không phải logger dưới mắt quy tắc này.

**Ranh giới.** Quy tắc này chỉ giữ nửa phủ định của `OBSERVABILITY-2`. Thứ nằm ở đối số thứ hai là
`OBSERVABILITY-3` và `OBSERVABILITY-5`, và cả hai đều không có quy tắc.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| cổng đường dẫn | Không quy tắc nào có. Cả hai đều không đọc hệ thống tệp và không có cổng theo tên tệp; chúng sống ở mọi tệp được lint, và phạm vi duy nhất là phạm vi do cấu hình đặt |
| bộ duyệt câu nhập | `node.source.value` so bằng đúng với `@nestjs/common`, rồi duyệt `node.specifiers`, bỏ qua phần tử không phải `ImportSpecifier`, so `specifier.imported.name` với `Logger`. Vòng lặp đi hết mọi specifier, không chỉ cái đầu |
| bộ duyệt lời dựng | `node.callee.type === "Identifier"` và `node.callee.name === "Logger"`. `NewExpression` là một loại nút, không phải một vị trí: nằm trong trường của lớp, trong factory, trong getter hay trong callback đều như nhau |
| bộ duyệt lời gọi | `callee.type === "MemberExpression"`, `callee.computed === false`, `callee.property.name` trong tập đóng sáu phần tử, bên nhận qua `isLoggerReceiver`, rồi `node.arguments[0]` — loại nút của nó, và với `Literal` thì `typeof` của giá trị |
| bộ đọc bên nhận | `isLoggerReceiver` so một tên định danh. Chỉ **tên thuộc tính cuối** trong chuỗi member được so, nên truy cập sâu bao nhiêu cũng vẫn khớp. Nó không biết lớp nào đứng phía sau |
| lối ra hợp lệ | `standaloneProgramGlobs`, một danh sách đường dẫn được xuất ra, để cấu hình và cổng đo đọc cùng một danh sách. Đây là thứ duy nhất ở đây với ra ngoài tệp đang lint, và nó chỉ với xa tới mức một thư mục |

Ba tính chất quyết định mọi thứ bên dưới: **bên nhận được khớp bằng cách viết, không bao giờ bằng
kiểu**; **chỉ đối số thứ nhất được đọc**, từ đối số thứ hai trở đi không ai soi; và **chỉ ba loại nút
được tính là "đã dựng"**, nên một chuỗi đến bằng cách khác thì không phải chuỗi dưới mắt quy tắc.

## Lối thoát hợp lệ

**Đóng** — người đọc có thể tưởng những cách viết này lách được, nhưng không.

| Viết thế này | Vì sao vẫn nổ |
|---|---|
| `import { Logger as AppLogger } from "@nestjs/common"` | Phép so là với `specifier.imported.name`, tên tại nguồn, không phải `local.name` |
| Nhập từ một tệp trung gian tái xuất nó, rồi dựng | Nhánh nhập trượt, nhưng nhánh `NewExpression` không hỏi đường dẫn gói nào |
| Dựng mà không viết câu nhập nào, ở tệp mà tên ấy là toàn cục hay ambient | Cùng nhánh đó: lời dựng bị bắt chỉ bằng cách viết của callee |
| `import { Logger, Injectable } from "@nestjs/common"` trong một câu | Vòng lặp đi hết mọi specifier, không chỉ cái đầu |
| Dựng bên trong trường của lớp, factory, getter hay callback | `NewExpression` là loại nút, không phải vị trí |
| `this.winstonService.info(...)` so với `winstonService.info(...)` đã phá cấu trúc | Cả hai hình dạng bên nhận đều được chấp nhận: `Identifier` trần và `MemberExpression` không tính toán |
| `this.deps.winstonService.info(...)` | Chỉ tên thuộc tính cuối được so, nên sâu bao nhiêu cũng vẫn khớp |
| `` `ORDER_HANDLED` `` không có phần chèn nào | Loại nút vẫn là `TemplateLiteral` dù không chèn gì vào |
| `"ORDER_HANDLED"`, một chữ chuỗi hằng | Chữ chuỗi `Literal` là một trong ba hình dạng bị báo; quy tắc rộng hơn cái tên của nó |
| Đổi mức log để né, `verbose` thay cho `info` | Cả sáu mức của nhà đều nằm trong tập |
| Dựng bằng `+` thay cho chuỗi mẫu | `BinaryExpression` với toán tử `+` bị gọi tên và báo |

**Mở** — mù đã xuất xưởng. Một phán quyết không được nói rằng những chỗ này đã được xét.

| Phạm vi | Cái gì đi lọt |
|---|---|
| `no-framework-logger` | **Nhập theo không gian tên rồi dựng qua member**, `import * as common` rồi `new common.Logger()` — cả hai nhánh cùng trượt một dòng, lỗ rộng nhất ở đây |
| `no-framework-logger` | **Lớp anh em cùng gói**, `new ConsoleLogger(...)` hoặc một lớp tự cài đặt giao diện logger |
| `no-framework-logger` | **Lớp bọc của nhà**, `class HouseLogger extends Logger {}` được dùng ở bốn mươi tệp |
| `no-framework-logger` | **Lời gọi tĩnh**, `Logger.log("…")` đến qua không gian tên hoặc qua tệp tái xuất |
| `no-framework-logger` | **Đường dẫn gói sâu hoặc bí danh**, và **`require`** — không có nút `ImportDeclaration` nào tồn tại |
| `no-framework-logger` | **Một tệp nằm trong thư mục đã miễn nhưng không phải chương trình độc lập** — thư mục không phải tệp |
| `no-framework-logger` | **Ngược chiều: `import type { Logger }` bị báo dù không nên**, vì `importKind` không bao giờ được đọc |
| `no-interpolated-log-message` | **Bên nhận đã đổi tên**, **hằng số giặt chữ**, **bất kỳ lời gọi nào ở vị trí đầu**, **sự hợp nhất dịch sang ô bên phải**, **toàn bộ nửa khẳng định**, **truy cập tính toán ở bất kỳ vế nào**, **phương thức đã tách rời**, **mức log ngoài tập đóng**, và **một dịch vụ ghi log thứ hai** |
| không quy tắc nào | **`process.stdout.write(…)`, một lời gọi vận chuyển thô, hoặc `globalThis.console.log(…)`** — hai cái đầu nằm ngoài cả hai quy tắc và ngoài `no-console`; cái thứ ba cũng ngoài `no-console`, vì quy tắc ấy dõi theo tham chiếu tới định danh `console` chứ không phải mọi đường với tới đối tượng đó |
| không quy tắc nào | **Mọi thứ mà `OBSERVABILITY-3`, `OBSERVABILITY-4`, `OBSERVABILITY-5`, `OBSERVABILITY-7` và `OBSERVABILITY-8` cấm** — một cái tên không có dữ liệu bên cạnh, một log ghi lần đi qua thay vì một quyết định, câu lỗi đã dựng nằm trong đối tượng dữ liệu, một ranh giới thay đổi không được chặn, một ngân sách vòng đời không ai trả |

Ba trong số đó là cùng một khuyết tật mặc áo khác nhau: **danh tính bằng cách viết là danh tính bằng
không gì cả** — một lần đổi tên, một bí danh, một không gian tên hay một lớp bọc là gỡ mất quy tắc;
**chỉ đối số mà quy tắc đọc mới được canh**, nên cái sai dịch sang một ô là biến mất; và **thư mục
không phải tệp**, nên một miễn trừ theo đường dẫn rộng hơn cái ngoại lệ mà nó được mua về. Không cái
nào là phá hoại. Cả ba đều là hình dáng của việc dọn dẹp.

## Đầu vào

| Đầu vào | Bằng chứng cần có |
|---|---|
| nguồn câu nhập | Đúng chuỗi như đã viết trong tệp, so bằng tuyệt đối — không phải mô-đun đã phân giải |
| specifier câu nhập | Tên tại nguồn (`imported.name`), và loại nút của specifier |
| callee của lời dựng | Loại nút trước, rồi mới đến cách viết của định danh |
| bên nhận của lời gọi | Tên thuộc tính cuối trong chuỗi member, hoặc chính định danh đó. Không bao giờ là kiểu |
| phương thức của lời gọi | Tên thuộc tính, đối chiếu với một tập đóng sáu phần tử |
| đối số thứ nhất | Loại nút của nó, và với `Literal` thì `typeof` của giá trị |
| phạm vi đường dẫn | Với lối ra hợp lệ, là danh sách glob mà mã nguồn xuất ra để cấu hình và cổng đo đọc cùng một danh sách |

## Quy tắc

1. Danh tính của một quy tắc là tên đã công bố của nó. Không đúc thêm mã số cho quy tắc.
2. Một quy tắc chỉ báo được thứ cơ chế của nó nhìn thấy, và mô-đun này ghi lại ranh giới đó chứ không
   ghi lại tham vọng của luật.
3. Cả hai quy tắc không đọc hệ thống tệp và không có cổng theo tên tệp. Chúng sống ở mọi tệp được lint,
   và phạm vi duy nhất là phạm vi do cấu hình đặt.
4. Miễn trừ được khai một lần theo đường dẫn trong cấu hình tiêu thụ, không bao giờ bằng một đống chú
   thích tắt từng dòng. Một danh sách, được xuất ra, để cấu hình và cổng đo không thể nói khác nhau.
5. Một quy tắc chỉ lên `error` khi số đo bằng không, và số đo ấy được lấy sau khi đã áp phạm vi đường
   dẫn. `no-framework-logger`, `no-interpolated-log-message` và quy tắc chuẩn `no-console` đều xuất
   xưởng ở mức `error`.
6. Mã không có quy tắc thì ghi là chưa ai giữ. Không bao giờ gán nó cho quy tắc gần nhất tình cờ nổ ở
   bên cạnh.
7. Quy tắc chuẩn được gọi tên là quy tắc chuẩn. Mô-đun này không nhận vơ phần enforcement mà nó giao
   đi.

## Ngoại lệ

Mỗi miễn trừ dưới đây là cố ý và đóng.

- **Chương trình không có yêu cầu nào để gắn vào thì được miễn theo đường dẫn.** Một tác nhân hoặc một
  điểm vào dòng lệnh chạy ngoài vòng đời yêu cầu: không có mã tương quan để gắn, không có vận chuyển
  nào được cấu hình, nên dịch vụ của nhà cho nó một phụ thuộc và không cho gì thêm. Miễn trừ là một
  glob thư mục khai một lần, và nó thả `no-framework-logger` cho mọi tệp nằm dưới thư mục ấy — cái giá
  của độ mịn đó đã ghi ở bảng cửa mở phía trên.
- **`console` không được viết lại.** Quy tắc chuẩn đã làm đúng việc đó. Gọi tên nó trong bộ khuyến nghị
  là toàn bộ lập trường của mô-đun này về lối ra đó; nó thả mô-đun khỏi việc tự viết lối ra thứ hai,
  không thả khỏi việc bắt buộc phải có nó.
- **Lời dựng có trang trí hay có bọc không được xử lý riêng.** Nhánh dựng cố ý không hỏi đường dẫn gói,
  nên nó báo thừa nếu có một lớp trùng tên đến từ gói khác. Cái giá ấy được chấp nhận: hai lớp cùng tên
  `Logger` trong một kho là một vấn đề đặt tên đáng được lộ ra.
- **Nửa khẳng định của phép kiểm tên không được thử.** Chứng minh một đối số đến từ đúng một enum cần
  thông tin kiểu mà quy tắc không có. Điều này thả mọi đối số không thuộc ba hình dạng bị từ chối. Từ
  chối ba cách viết của cái sai đã biết là thứ một quy tắc cú pháp giữ được một cách trung thực; nhận
  nhiều hơn là nhận mình biết kiểu, mà nó không biết.

## Đầu ra

Mỗi phát hiện một khối:

```text
rule: <published rule name>
code: <OBSERVABILITY-n | none>
mechanism: <node type, matched literal or option consulted>
verdict: <reports | silent>
hatch: <the way of writing that would make this silent, or "none found">
```

Một tệp sạch xuất một khối với `verdict: silent` và `hatch: none found`. Một tệp được
`standaloneProgramGlobs` thả ra thì xuất `verdict: silent` với chính glob đó ghi ở phần mechanism — nó
đã không được xét, và nó không phải là sạch.

## Ví dụ đã giải

**Đầu vào.** Một dịch vụ theo yêu cầu, nằm ngoài mọi thư mục đã miễn:

```ts
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class OrderService {
  private readonly log = new Logger(OrderService.name)

  handle(order: Order) {
    this.winstonService.info(`order ${order.id} handled`)
  }
}
```

```text
rule: no-framework-logger
code: OBSERVABILITY-1
mechanism: ImportDeclaration, source.value === "@nestjs/common", specifier.imported.name === "Logger"
verdict: reports
hatch: none found
```

```text
rule: no-framework-logger
code: OBSERVABILITY-1
mechanism: NewExpression, callee.type === "Identifier", callee.name === "Logger"
verdict: reports
hatch: import * as common from "@nestjs/common" then new common.Logger(...) misses both branches
```

```text
rule: no-interpolated-log-message
code: OBSERVABILITY-2
mechanism: CallExpression, arguments[0] is TemplateLiteral, receiver isLoggerReceiver "winstonService"
verdict: reports
hatch: none found
```

**Đã sửa.** Logger của khung biến mất, và cái tên là một thành viên enum với dữ liệu đặt bên cạnh:

```ts
import { Injectable } from "@nestjs/common"

@Injectable()
export class OrderService {
  constructor(private readonly winstonService: WinstonService) {}

  handle(order: Order) {
    this.winstonService.info(WinstonLog.OrderHandled, { orderId: order.id })
  }
}
```

Cả hai quy tắc im lặng. Nhưng một cửa mở vẫn sống sót qua lần sửa ấy, và sự im lặng đó không phải là
tuân thủ:

```text
rule: no-interpolated-log-message
code: OBSERVABILITY-2
mechanism: arguments[0] is an Identifier-rooted MemberExpression, not one of the three refused shapes
report: none
hatch: only arguments[0] is read — error(WinstonLog.PaymentFailed, `declined: ${error.message}`) fuses
  the sentence one slot right, which is OBSERVABILITY-3 and OBSERVABILITY-5, and no rule looks there
```

```text
rule: no-interpolated-log-message
code: none
mechanism: isLoggerReceiver compares the spelling "winstonService"
report: none
hatch: renaming the injected property to `logger` removes the rule for this whole class, and nothing
  verifies that WinstonLog.OrderHandled came from the enum — the positive half is unenforced
```

## Phạm vi

Mô-đun này ghi lại enforcement, không ghi lại luật và không ghi lại sản phẩm. Nó không gọi tên sản phẩm
nào, kho mã nào hay công ty nào. Lối ra `console` thuộc về quy tắc chuẩn `no-console`, không thuộc bất
cứ thứ gì ở đây. Miễn trừ theo đường dẫn cho chương trình độc lập thuộc về `standaloneProgramGlobs`
trong cấu hình tiêu thụ, không thuộc một quy tắc nào. `OBSERVABILITY-3`, `OBSERVABILITY-4`,
`OBSERVABILITY-5`, `OBSERVABILITY-7` và `OBSERVABILITY-8` thuộc về phần rà soát bằng mắt người. Tên quy
tắc, không gian tên của plugin, chuỗi gói được khớp và định danh bên nhận được khớp đều chép nguyên
văn, vì đó đúng là những chuỗi mà một bản log build in ra và người đọc phải đối chiếu; đó là ngoại lệ
duy nhất, và nó không kéo dài sang phần văn xuôi.
