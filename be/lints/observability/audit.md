---
id: be-lints-observability-audit
title: audit.md
slug: /be/lints/observability/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phủ của hai quy tắc observability và những cửa còn mở sau khi đọc mã nguồn.
---

# audit.md

> Version: `2.00` · Mô-đun: `observability`

Phản biện này kiểm một chuyện: tài liệu có mô tả **đúng thứ mã nguồn làm** hay không, và có nói thật
về chỗ mã nguồn **không** làm gì hay không.

## Verdict

Chấp nhận, kèm ba nhận định phải đọc cùng.

**Một.** Số quy tắc được công bố là **đúng hai**, khớp với con số dự kiến. Đối tượng `rules` xuất ra
hai khoá: `no-framework-logger` và `no-interpolated-log-message`. Không có quy tắc thứ ba nào ẩn
trong tệp.

**Hai.** Bộ khuyến nghị `recommended` lại có **ba** dòng, và chênh lệch này là cố ý chứ không phải
lỗi đếm: dòng thứ ba là `no-console`, quy tắc **chuẩn**, được gọi tên chứ không được viết ở đây. Tài
liệu ghi nó ở bảng mức nghiêm trọng và không xếp nó vào bảng quy tắc, vì mô-đun này không nhận vơ
phần enforcement mà nó giao đi. Ai đếm "ba quy tắc observability" là đếm đúng số cổng và sai số tác
giả.

**Ba.** Tệp còn xuất ra `standaloneProgramGlobs`, một danh sách đường dẫn. Nó giữ `OBSERVABILITY-6`
nhưng **không phải quy tắc** — nó là giá trị cấu hình. Được xuất ra thay vì được mô tả bằng lời, để
cấu hình tiêu thụ và cổng đo đọc **cùng một danh sách**; hai bản sao của một miễn trừ là cách một bản
lặng lẽ lớn lên.

Tổng kết mức phủ: **2 quy tắc, 2 mã có máy giữ, 1 mã giữ bằng cấu hình, 5 mã không ai giữ, và 18 cửa
còn mở** được ghi ở bảng Open của `INDEX.md`.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Số quy tắc công bố trong `rules` | Đúng **2**, khớp dự kiến |
| Số dòng trong `recommended` | **3** — chênh một, vì `no-console` là quy tắc chuẩn được gọi tên |
| Mỗi quy tắc có mã luật để giữ không | Có. Không quy tắc nào ở đây không ánh xạ được |
| Có mã luật nào bị gán bừa cho quy tắc gần nhất không | Không. `-3`, `-4`, `-5`, `-7`, `-8` ghi thẳng là **không ai giữ** |
| `no-framework-logger` giữ trọn `OBSERVABILITY-1` không | **Không** — chỉ một trong hai lối ra; lối `console` giao cho quy tắc chuẩn |
| `no-interpolated-log-message` giữ trọn `OBSERVABILITY-2` không | **Không** — chỉ nửa phủ định. Nửa khẳng định ("là thành viên enum") hoàn toàn không được kiểm |
| Có quy tắc nào đọc hệ thống tệp không | Không. Cả hai chỉ đọc cây cú pháp |
| Có quy tắc nào có cổng theo tên tệp không | Không. Cả hai sống ở mọi tệp được lint; phạm vi duy nhất do cấu hình đặt |
| Có báo cáo sai nào không | **Có một**: `import type { Logger }` bị báo dù không đi vòng qua gì cả |
| Danh tính bên nhận được kiểm theo kiểu hay theo tên | Theo **tên**, luôn luôn. Không có thông tin kiểu nào được dùng |

## Findings

1. **Hai quy tắc có tên rộng hơn hành vi thật.** Cả hai đều đáng ghi lại.

   - `no-framework-logger` nghe như cấm logger của khung. Thực tế nó cấm **đúng một cách viết của
     đúng một cái tên**: `Logger`. Lớp cài đặt cụ thể mà cùng gói ấy xuất ra, một lớp con của nó,
     một lời gọi tĩnh qua không gian tên — cùng một hành vi đi vòng, không có cái nào bị bắt.
   - `no-interpolated-log-message` nghe như cấm nội suy. Thực tế nó **rộng hơn** ở một chỗ và **hẹp
     hơn** ở ba chỗ: rộng hơn vì chữ chuỗi trần không có nội suy nào cũng bị báo; hẹp hơn vì nội suy
     ở đối số thứ hai, nội suy đi qua một `const`, và nội suy sinh ra từ một lời gọi hàm đều đi lọt.

2. **Nhánh nhập và nhánh dựng của quy tắc thứ nhất có thể trượt cùng lúc.** Chú thích trong mã nguồn
   nói nhánh dựng tồn tại để "một câu nhập đã đổi tên không lách được nhánh trên", và điều đó đúng
   với bí danh. Nhưng với **không gian tên**, cả hai nhánh cùng trượt: specifier không phải
   `ImportSpecifier`, callee không phải `Identifier`. Đây là lỗ rộng nhất và nó không mất gì để bịt
   một phần — chấp nhận `ImportNamespaceSpecifier` rồi bám tên cục bộ là việc trong tầm.

3. **`OBSERVABILITY-3` và `OBSERVABILITY-5` không chỉ thiếu quy tắc — chúng thiếu quy tắc ở đúng chỗ
   vi phạm hay chạy tới nhất.** Khi người viết bị `no-interpolated-log-message` chặn ở đối số thứ
   nhất, đường ít trở lực nhất là **đẩy câu văn sang đối số thứ hai**. Quy tắc đang tồn tại nhào nặn
   hành vi theo hướng tạo ra một vi phạm mà không quy tắc nào nhìn.

4. **Danh tính bên nhận theo tên biến enforcement thành quy ước đặt tên.** Thông điệp của quy tắc nói
   về mã tương quan và cấu hình vận chuyển — những chuyện thuộc về **kiểu** của dịch vụ. Cơ chế thì
   chỉ so một chuỗi. Đổi tên thuộc tính được tiêm thành `logger` là hành vi dọn dẹp mà mọi người sẽ
   làm mà không nghĩ, và nó tắt quy tắc cho cả lớp.

5. **Miễn trừ theo thư mục rộng hơn ngoại lệ mà nó được mua về.** `OBSERVABILITY-6` nói lối ra là
   "chương trình chạy ngoài vòng đời yêu cầu". Glob nói lối ra là "mọi tệp dưới ba thư mục". Hai câu
   đó trùng nhau hôm nay và không có gì giữ cho chúng trùng nhau ngày mai.

6. **Tập mức log là tập đóng và không có ai canh cho nó khỏi cũ.** Sáu mức. Thư viện vận chuyển bên
   dưới có nhiều mức hơn thế. Ngày dịch vụ mở thêm một mức, cánh cửa mới mở ra trong im lặng.

7. **Không có quy tắc nào chặn được đường thoát ở tầng thấp nhất.** `process.stdout.write` và một lời
   gọi thẳng vào transport nằm ngoài cả ba cổng. Đây không phải chỗ người ta vô tình đi qua, nên nó
   là rủi ro nhỏ — nhưng nó có thật, và nó là lý do không nên đọc bộ ba cổng như một vòng kín.

## Decisions

- **Giữ đúng hai quy tắc.** Không đúc thêm quy tắc cho `-4`, `-5`, `-7`, `-8`. Một quy tắc đoán ý
  định sẽ nổ vào mã đúng đủ nhiều lần để người ta học cách tắt nó, và một quy tắc bị tắt không giữ gì
  cả trong khi trông vẫn như đang giữ.
- **Không viết lại `console`.** Quy tắc chuẩn đã làm đúng việc đó; gọi tên nó trong bộ khuyến nghị là
  toàn bộ lập trường cần có.
- **Ghi `-3` và `-5` là chưa ai giữ, không gán chúng cho `no-interpolated-log-message`.** Quy tắc đó
  đọc đúng một đối số, và nói khác đi là bán một mức che không tồn tại.
- **Giữ miễn trừ ở dạng glob được xuất ra, không chuyển sang chú thích tắt từng dòng.** Độ mịn thô
  hơn nhưng **đo được**: một danh sách ai cũng đọc được, thay vì một tập chú thích không ai đếm.
- **Ghi mọi cửa mở thành bảng, không viết "không có".** Một cửa mở đã biết là một rủi ro có tên; một
  bảng ghi "không có" là một rủi ro không tên.
- **Không sửa mã nguồn trong lần tài liệu hoá này.** Hai đề xuất sửa thật (không gian tên, và
  `importKind` cho báo cáo sai) được ghi ở phần dưới để vào một phiên có phép ghi vào
  `sources/be/observability.mjs`.

## Rủi ro còn mở

Từng cửa, và **quy tắc phải soi thêm cái gì** để đóng nó.

| Cửa mở | Phải soi thêm gì để đóng | Đáng đóng không |
|---|---|---|
| Nhập theo không gian tên rồi `new common.Logger()` | Chấp nhận `ImportNamespaceSpecifier`, ghi lại tên cục bộ trong phạm vi tệp, rồi ở `NewExpression` chấp nhận cả `MemberExpression` có `object.name` thuộc tập đó | **Đáng.** Chi phí thấp, đây là lỗ rộng nhất |
| Lớp anh em cùng gói (`ConsoleLogger` và tương tự) | Đổi một chuỗi thành một tập tên, hoặc canh mọi tên nhập từ đúng gói đó | **Đáng.** Một tập tên thay một chuỗi là thay đổi nhỏ nhất trên trang này |
| `class HouseLogger extends Logger {}` rồi dùng ở nơi khác | Cần lần theo mô-đun: biết `HouseLogger` phân giải về đâu. Vượt khỏi khả năng của một quy tắc chỉ đọc cây cú pháp một tệp | **Không đóng bằng quy tắc.** Đóng bằng một phép kiểm ở tầng khác, hoặc chấp nhận và ghi tên |
| Gọi tĩnh `Logger.log(...)` | Thêm visitor cho `MemberExpression` có `object.name === "Logger"` | **Đáng, có điều kiện.** Sẽ báo thừa vào mọi biến tên `Logger`; chỉ nên làm cùng lúc với việc bám tên nhập |
| Đường dẫn gói sâu hoặc bí danh | Phân giải mô-đun thật, hoặc đổi phép so bằng thành phép so tiền tố | **Nửa đáng.** So tiền tố bịt được đường dẫn con; bí danh không gian làm việc thì cần phân giải, và một quy tắc phụ thuộc phân giải trả lời khác nhau ở hai máy |
| `require` thay `import` | Thêm visitor cho `CallExpression` có callee `require` cùng phép rã đối tượng | **Không đáng lắm.** Mã nguồn hiện tại là ESM ở khắp nơi; đây là lỗ lý thuyết cho tới khi ngược lại |
| `import type` bị báo thừa | Đọc `node.importKind` và `specifier.importKind`, bỏ qua khi là `type` | **Rất đáng.** Đây là lỗi, không phải giới hạn. Báo thừa dạy người ta viết chú thích tắt |
| Miễn trừ theo thư mục quá rộng | Không có gì quy tắc soi thêm được — độ mịn nằm ở cấu hình. Chỉ đóng được bằng cách thu hẹp glob, hoặc bằng một phép kiểm rằng tệp dưới thư mục đó không nhận vào thứ gì thuộc vòng đời yêu cầu | **Đóng bằng rà soát định kỳ**, không bằng quy tắc |
| Đổi tên thuộc tính được tiêm (`this.logger`) | Thông tin **kiểu**: biết bên nhận là dịch vụ ghi log của nhà bất kể tên. Cần một quy tắc dùng dịch vụ kiểu | **Không đáng bằng quy tắc cú pháp.** Chi phí cao, chạy chậm, và ràng buộc bộ quy tắc vào một cấu hình kiểu. Chấp nhận, và ghi rằng tên thuộc tính là một phần của luật |
| Hằng số giặt sạch chữ | Lần theo phạm vi biến: tra định danh về khai báo và soi giá trị khởi tạo trong cùng tệp | **Đáng, có giới hạn.** Bắt được `const` gán một lần trong cùng tệp; không bắt được thứ đến từ tệp khác. Che một nửa còn hơn không che, miễn là nói rõ là một nửa |
| Lời gọi hàm ở vị trí đầu | Cần biết hàm trả về gì — thông tin kiểu | **Không đáng.** Cùng lý do như trên |
| Nội suy chuyển sang đối số thứ hai | Soi `arguments[1]`: đòi nó là `ObjectExpression`, và từ chối giá trị nào là `TemplateLiteral`, nối `+`, hay chữ chuỗi dài. Đây chính là `OBSERVABILITY-3` | **Rất đáng.** Đây là vi phạm mà quy tắc hiện tại **đẩy người ta về phía đó**, và nó nằm trong tầm của một quy tắc cú pháp |
| Nửa khẳng định (tên phải từ enum) | Đòi `arguments[0]` là `MemberExpression` không tính toán trên một định danh đã biết, hoặc dùng thông tin kiểu để kiểm nó là thành viên enum | **Nửa đáng.** Bản cú pháp bắt được `info(bienBatKy)` và `info(42)` với chi phí thấp; bản kiểu thì không |
| `info(0)`, `info(null)` | Cùng phép kiểm hình dạng ở dòng trên | **Đáng**, đi kèm cùng thay đổi |
| Truy cập tính toán hai vế | Bỏ điều kiện `computed === false` và so `property.value` khi khoá là chữ chuỗi | **Đáng.** Rẻ, và bịt một cách viết chỉ ai đang cố lách mới dùng |
| Tách rời phương thức (`const { info } = …`) | Lần theo phạm vi biến từ phép rã đối tượng về bên nhận | **Nửa đáng.** Cùng cơ chế với hằng số giặt chữ; nên làm một lần cho cả hai |
| Mức log ngoài tập đóng sáu phần tử | Không phải việc của quy tắc mà là việc của **kiểm chứng**: một phép kiểm buộc tập trong quy tắc khớp với các mức dịch vụ thật sự công bố | **Đáng.** Rẻ nhất trong bảng này, và nó chặn một lỗ mở ra trong im lặng |
| `process.stdout.write` và lời gọi transport trực tiếp | Một danh sách chặn thứ ba cho lối ra tầng thấp | **Không đáng.** Không phải chỗ ai vô tình đi qua; ghi tên là đủ |

Hai câu cuối cần nói thẳng. **Cửa mở không biết thì nguy hiểm hơn một luật hoàn toàn không có quy
tắc**: luật không có quy tắc thì ai cũng biết phải đọc bằng mắt, còn quy tắc hở thì được tin là kín.
Và trong bảng trên, thứ đáng làm sớm nhất không phải cái khó nhất — là `importKind` (một lỗi thật),
tập tên thay cho một chuỗi, và một quy tắc cho `OBSERVABILITY-3`, vì quy tắc hiện có đang đẩy vi phạm
về đúng chỗ đó.

## Re-audit Triggers

- Có quy tắc được thêm vào hoặc bỏ khỏi `rules`, hoặc có dòng được thêm vào `recommended`.
- Danh sách đường dẫn miễn trừ đổi, dài thêm, hoặc bị chép ra một bản thứ hai ở kho tiêu thụ.
- Dịch vụ ghi log công bố thêm một mức, hoặc đổi tên thuộc tính mà nó được tiêm vào.
- Số đo của một quy tắc rời khỏi mốc không, hoặc một mức nghiêm trọng bị hạ ở kho tiêu thụ.
- Xuất hiện chú thích tắt từng dòng cho một trong hai quy tắc — đó là dấu hiệu miễn trừ theo đường
  dẫn đã không còn mô tả đúng thực tế.
- Có ai đề xuất rằng một trong hai quy tắc "đã giữ" một mã mà trang này ghi là không ai giữ.
