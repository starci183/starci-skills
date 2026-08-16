---
id: be-lints-observability-vi
title: vi.md
slug: /be/lints/observability/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hai quy tắc lint giữ luật observability - bắt gì, phát hiện bằng cách nào, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `observability`

# Hai cái máy giữ luật observability

Luật observability có tám mã, `OBSERVABILITY-1` đến `OBSERVABILITY-8`. **Chỉ hai mã có quy tắc của
riêng nhà.** Một mã nữa được giữ bằng một danh sách đường dẫn trong cấu hình chứ không phải bằng quy
tắc. Năm mã còn lại — log ghi lại một quyết định hay chỉ ghi lại một lần đi qua, thất bại mang theo
danh tính hay mang theo câu tiếng Anh đã dựng, một tiến trình đo đạc mới có tự trả chi phí vòng đời
của nó không — là **phán đoán**. Bộ phân tích cú pháp thấy được rằng một lời gọi đã xảy ra; nó không
thấy được đoạn mã đó **để làm gì**.

Tài liệu này không chép lại luật. Nó nói **máy thấy được đến đâu** và **hết thấy từ chỗ nào**.

Một mã không có quy tắc thì ai cũng biết là chưa có ai giữ, nên vẫn còn được đọc bằng mắt. Một quy
tắc bị tin là kín mà thật ra hở thì tệ hơn: nó mua sự im lặng và trả bằng cảm giác đã được che.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `no-framework-logger` | `OBSERVABILITY-1` (một nửa) | Nhập tên `Logger` từ đúng chuỗi nguồn `@nestjs/common`; và mọi `new Logger(...)` mà callee là định danh trần |
| `no-interpolated-log-message` | `OBSERVABILITY-2` | Đối số **thứ nhất** của một phương thức log trên dịch vụ ghi log của nhà, khi đối số đó là chuỗi mẫu, phép nối `+`, hoặc chữ chuỗi |

Cả hai quy tắc đều có mã luật để giữ. Chiều ngược lại mới là chỗ trống, và chỗ trống rất rộng:

| Mã | Ai giữ | Ghi chú |
|---|---|---|
| `OBSERVABILITY-1` | `no-framework-logger` **cộng** quy tắc chuẩn `no-console` | Quy tắc nhà giữ một trong hai lối ra; lối còn lại chỉ được **gọi tên** trong bộ khuyến nghị chứ không viết ở đây |
| `OBSERVABILITY-2` | `no-interpolated-log-message` | Chỉ giữ **nửa phủ định** — xem dưới |
| `OBSERVABILITY-3` | *không ai* | Không quy tắc nào đọc đối số thứ hai |
| `OBSERVABILITY-4` | *không ai* | "Quyết định, không phải lần đi qua" cần biết đoạn mã để làm gì |
| `OBSERVABILITY-5` | *không ai* | Câu lỗi đã dựng nằm trong đối tượng dữ liệu là một **giá trị**, không phải một hình dạng |
| `OBSERVABILITY-6` | `standaloneProgramGlobs`, một danh sách đường dẫn được xuất ra | Là giá trị cấu hình, không phải quy tắc |
| `OBSERVABILITY-7` | *không ai* | Ranh giới thay đổi là việc của bản duyệt |
| `OBSERVABILITY-8` | *không ai* | Ngân sách vòng đời là một bản mô tả, không phải một loại nút |

Chỗ cần nói thẳng nhất là `OBSERVABILITY-2`. Luật nói tên sự kiện **là một thành viên enum**. Quy tắc
cấm ba cách viết một chuỗi được dựng ra. Hai câu đó không cùng một nghĩa: quy tắc giữ nửa phủ định và
**không giữ chút nào nửa khẳng định**. Đối số không thuộc ba hình dạng kia thì đi lọt — kể cả một
định danh, một lời gọi hàm, một con số và `null`. **Không có gì ở đây kiểm rằng tên log đến từ enum.**

---

## `no-framework-logger`

**Bắt gì.** Hai chuyện khác nhau, hai thông điệp khác nhau.

- `imported` — một câu lệnh nhập lấy tên `Logger` từ đúng chuỗi nguồn `@nestjs/common`. Báo ngay tại
  **specifier**, nên dòng cần chú thích tắt là dòng nhập chứ không phải dòng dùng.
- `constructed` — bất kỳ `new Logger(...)` nào mà callee là **định danh trần**. Nhánh này **không**
  hỏi tên gói: nó tồn tại đúng để một câu nhập đã đổi tên hoặc đã đi qua tệp trung gian không lách
  được nhánh trên.

**Giữ mã nào.** `OBSERVABILITY-1`, và chỉ một nửa của mã đó. Nửa còn lại — `console` — giao cho quy
tắc chuẩn, được gọi tên trong bộ khuyến nghị. Không viết lại một quy tắc mà cả thế giới đã có là một
quyết định, không phải một chỗ bỏ sót.

**Cách phát hiện.** Hai visitor, **không có cổng theo tên tệp** — quy tắc sống ở mọi tệp được lint.
`ImportDeclaration`: trả về ngay nếu `node.source.value` không **bằng đúng** chuỗi `@nestjs/common`;
sau đó duyệt `node.specifiers`, bỏ qua mọi phần tử có `type` khác `ImportSpecifier`, và báo khi
`specifier.imported.name` đúng bằng `Logger` — tức là tên **tại nguồn**, không phải tên cục bộ.
`NewExpression`: báo khi `node.callee.type` là `Identifier` và `node.callee.name` đúng bằng `Logger`.

**Vì sao luật này đáng có máy giữ.** Vì cái sai này **không đỏ lên ở đâu cả**. Dòng log vẫn được ghi,
vẫn đúng định dạng, vẫn hiện ra ở stdout khi chạy máy mình. Nó chỉ thiếu đúng một thứ mà lúc phát
triển không ai nhìn: mã tương quan của yêu cầu, và cấu hình vận chuyển. Cái giá được trả vào ngày có
sự cố, khi một luồng yêu cầu được lần lại và đúng dòng quan trọng nhất là dòng không gắn được vào
đâu — hoặc không tới nơi nào cả. Sai ở chỗ vô hình tại điểm gọi, đắt về sau: đó là định nghĩa của
việc cần một cái máy.

**Cửa còn mở.**

- **Nhập theo không gian tên.** `import * as common from "@nestjs/common"` rồi `new common.Logger()`
  — specifier là `ImportNamespaceSpecifier` nên vòng lặp bỏ qua, còn callee là `MemberExpression` nên
  nhánh dựng cũng bỏ qua. **Cả hai nhánh cùng trượt một dòng.** Đây là lỗ rộng nhất của cả mô-đun.
- **Lớp anh em cùng gói.** Tập tên là đúng một chuỗi `Logger`. Lớp cài đặt cụ thể mà gói đó cũng xuất
  ra mang tên khác, nên vô hình ở cả hai nhánh.
- **Bọc lại thành lớp của nhà.** `class HouseLogger extends Logger {}` ở một tệp, rồi `new HouseLogger()`
  ở bốn mươi tệp khác. `extends` không phải `NewExpression`, và bốn mươi tệp kia nhập một cái tên cục
  bộ từ một đường dẫn cục bộ. Một lớp bọc tắt quy tắc trên toàn kho.
- **Gọi tĩnh.** `Logger.log("…")` không dựng gì cả, nên nhánh `NewExpression` nằm im; nếu lớp đó đến
  qua không gian tên hoặc qua tệp trung gian thì nhánh nhập cũng nằm im.
- **Đường dẫn gói sâu hoặc bí danh.** Phép so là **bằng chuỗi trên đúng thứ đã viết ra**, không phải
  phân giải mô-đun. Một đường dẫn con hay một bí danh không gian làm việc là đủ để nhánh nhập trả về
  trước khi đọc specifier nào.
- **`require`.** Không có nút `ImportDeclaration` trong một lời gọi `require`.
- **Thư mục không phải tệp.** Lối ra hợp lệ được khai bằng glob thư mục. Một dịch vụ có yêu cầu để
  gắn vào, nếu được đặt hoặc chuyển vào thư mục đã miễn, sẽ nằm ngoài vòng kiểm mà **không có tín
  hiệu nào** báo.
- **Ngược chiều: báo thừa.** `import type { Logger }` **vẫn bị báo**, vì `importKind` không được đọc.
  Một tham chiếu chỉ dùng làm kiểu thì không đi vòng qua gì cả. Lỗ ở đây là một báo cáo sai, và cái
  giá của nó là dạy người ta viết chú thích tắt lên những dòng vốn đúng.

---

## `no-interpolated-log-message`

**Bắt gì.** Một thông điệp duy nhất, `built`: đối số **thứ nhất** của một phương thức log trên dịch
vụ ghi log của nhà, khi đối số đó là `TemplateLiteral`, là `BinaryExpression` với toán tử `+`, hoặc
là `Literal` có `value` thuộc kiểu chuỗi.

Đáng chú ý: chữ chuỗi trần cũng bị bắt. `info("ORDER_HANDLED")` trông rất ngoan và vẫn bị báo, vì nó
chỉ cách một lần sửa chữ là thành một sự kiện khác đối với mọi bảng theo dõi.

**Giữ mã nào.** `OBSERVABILITY-2`, nửa phủ định.

**Cách phát hiện.** Một visitor `CallExpression`, không có cổng theo tên tệp. Đòi
`callee.type === "MemberExpression"` và `callee.computed === false`. Đòi `callee.property.name` nằm
trong tập đóng sáu phần tử: `log`, `error`, `warn`, `info`, `debug`, `verbose`. Đòi bên nhận đi qua
`isLoggerReceiver` — chấp nhận `Identifier` có `name` đúng bằng `winstonService`, hoặc
`MemberExpression` không tính toán có `property.name` đúng bằng `winstonService`, và không gì khác.
Rồi đọc `node.arguments[0]`, trả về nếu vắng, và báo nếu nó thuộc một trong ba hình dạng trên. Báo
cáo gắn vào **đối số**, không gắn vào lời gọi.

**Vì sao luật này đáng có máy giữ.** Vì đây là lối thoát duy nhất **vẫn còn trông giống log có cấu
trúc**. Hai lối kia lộ liễu: ai đọc cũng thấy một lời gọi đi vòng qua dịch vụ. Lối này đi qua đúng
dịch vụ, đúng mức log, đúng chỗ trong luồng — và sinh ra một dòng không đếm được, không nhóm được,
không lọc được theo người dùng. Nó chỉ hỏng ở tầng sau khi log đã rời tiến trình, tức là hỏng ở chỗ
người viết không nhìn thấy và người rà soát cũng không nhìn thấy, vì đoạn mã ấy đọc **hay hơn** đoạn
mã đúng. Thêm nữa, hỏng theo kiểu im lặng: ngày ai đó sửa lại câu chữ cho hay hơn, mọi bảng theo dõi
dựng trên nó tắt tiếng mà không có gì đỏ lên.

**Cửa còn mở.**

- **Đổi tên thuộc tính được tiêm.** `this.logger.info(…)` với đúng dịch vụ ấy phía sau. Danh tính bên
  nhận là **cách viết** `winstonService`, không bao giờ là kiểu. Đây là quy ước đặt tên mang thông
  điệp nói về mã tương quan, và đổi tên là việc dọn dẹp bình thường nhất trên đời.
- **Hằng số giặt sạch chữ.** Dựng chuỗi ở dòng trên, gán vào một `const`, truyền định danh vào dòng
  dưới. Ba hình dạng bị báo biến mất và không ai lần ngược lại chỗ nó được dựng.
- **Một lời gọi bất kỳ ở vị trí đầu.** `info(buildName(order))` — `CallExpression` không nằm trong ba
  hình dạng. Chuỗi hợp nhất được sinh ra cách đó đúng một khung ngăn xếp.
- **Chuyển sang ô thứ hai.** `error(WinstonLog.PaymentFailed, \`declined: ${error.message}\`)`. Chỉ
  `arguments[0]` được đọc. Tên đã đúng và nhóm được; dữ liệu bên cạnh vẫn là một câu văn không truy
  vấn được. Đó là `OBSERVABILITY-3` và `OBSERVABILITY-5` trong một dòng, và không quy tắc nào nhìn.
- **Nửa khẳng định bỏ trống.** `info(bienBatKy)`, `info(0)`, `info(null)`, `info(dk ? A : \`…${x}\`)`
  đều đi lọt. Toán tử ba ngôi giấu chuỗi mẫu vào một loại nút không được soi.
- **Truy cập tính toán ở bất kỳ vế nào.** `this.winstonService["info"](…)` trượt ở
  `callee.computed === false`; `this["winstonService"].info(…)` trượt ở `isLoggerReceiver`.
- **Tách rời phương thức.** `const { info } = this.winstonService` rồi `info(\`…\`)`: callee thành
  `Identifier`, visitor trả về ở dòng đầu tiên.
- **Mức log ngoài tập đóng.** Tập có sáu phần tử. Dịch vụ mọc thêm một mức là mọc thêm một cánh cửa
  không ai giữ, và không có gì trong quy tắc báo rằng tập đã cũ.
- **Một dịch vụ ghi log thứ hai.** Danh tính là một chuỗi. Mọi cách viết khác đều không phải logger
  dưới mắt quy tắc này.

---

## Luật

1. Danh tính của một quy tắc là **tên đã công bố** của nó. Không đúc thêm mã số cho quy tắc.
2. Một quy tắc chỉ báo được thứ cơ chế của nó nhìn thấy. Trang này ghi lại **ranh giới đó**, không
   ghi lại tham vọng của luật.
3. Cả hai quy tắc **không đọc hệ thống tệp** và **không có cổng theo tên tệp**. Phạm vi duy nhất là
   phạm vi do cấu hình đặt.
4. Miễn trừ được khai **một lần theo đường dẫn** trong cấu hình, không bao giờ bằng một đống chú
   thích tắt từng dòng. Một danh sách, được xuất ra, để cấu hình và cổng đo không thể nói khác nhau.
5. Một quy tắc chỉ lên `error` khi số đo bằng không, và số đo ấy được lấy **sau khi** đã áp phạm vi
   đường dẫn.
6. Mã không có quy tắc thì ghi là chưa ai giữ. Không bao giờ gán nó cho quy tắc gần nhất tình cờ nổ
   ở bên cạnh.
7. Quy tắc chuẩn được gọi tên là quy tắc chuẩn. Mô-đun này không nhận vơ phần enforcement mà nó giao
   đi.

## Ngoại lệ

Mỗi miễn trừ dưới đây là cố ý và đóng.

- **Chương trình không có yêu cầu nào để gắn vào thì được miễn theo đường dẫn.** Một tác nhân hoặc
  một điểm vào dòng lệnh chạy ngoài vòng đời yêu cầu: không có mã tương quan để gắn, không có vận
  chuyển nào được cấu hình. Dịch vụ của nhà cho nó một phụ thuộc và không cho gì thêm. Miễn trừ là
  một glob thư mục khai một lần, và cái giá của độ mịn ấy đã ghi ở bảng cửa mở.
- **`console` không được viết lại.** Quy tắc chuẩn đã làm đúng việc đó. Gọi tên nó trong bộ khuyến
  nghị là toàn bộ lập trường của mô-đun này về lối ra đó.
- **Nhánh dựng cố ý không hỏi đường dẫn gói.** Cái giá là báo thừa nếu có một lớp trùng tên đến từ
  gói khác. Cái giá ấy được chấp nhận: hai lớp cùng tên `Logger` trong một kho là một vấn đề đặt tên
  đáng được lộ ra.
- **Nửa khẳng định không được thử.** Chứng minh một đối số đến từ đúng một enum cần thông tin kiểu mà
  quy tắc không có. Từ chối ba cách viết của cái sai đã biết là thứ một quy tắc cú pháp giữ được một
  cách trung thực; nhận nhiều hơn là nhận mình biết kiểu, mà nó không biết.
