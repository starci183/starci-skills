---
id: be-lints-cdc-audit
title: audit.md
slug: /be/lints/cdc/audit
sidebar_label: audit.md
sidebar_position: 3
description: Đánh giá độ phủ thực của quy tắc CDC và ghi lại mọi kẽ hở còn tồn tại.
---

# audit.md

> Version: `2.00` · Mô-đun: `cdc`

Bản đánh giá này chỉ hỏi một câu: **luật CDC được máy giữ tới đâu, và từ đâu trở đi chỉ còn con người?**

## Verdict

Chấp nhận, kèm một điều kiện đọc nghiêm ngặt hơn mọi mô-đun khác trong nhóm này.

Nguồn công bố **đúng một** quy tắc — `projection-listener-contract` — khớp với con số một mà nhiệm vụ
dự đoán. Quy tắc có bản cài đặt đầy đủ, có bản kiểm thử song sinh, và ánh xạ được vào ba mã luật có
thật (`CDC-1`, `CDC-2`, `CDC-3`). Không có ánh xạ nào phải bịa.

Điều kiện đọc: **mô-đun này không được đọc như "luật CDC đã có máy giữ".** Quy tắc giữ **hình dạng khai
báo** của một bộ lắng nghe và không giữ **ngữ nghĩa** của một projection. Trong ba mã nó chạm tới, hai
mã (`CDC-2`, `CDC-3`) chỉ được giữ ở phần **tên**: quy tắc khẳng định `groupId` tồn tại chứ không khẳng
định nó ổn định, khẳng định `recomputeTarget` tồn tại chứ không khẳng định nó luỹ đẳng. Bốn mã còn lại
không có quy tắc nào.

Nói theo cách có thể kiểm được: **mã duy nhất được giữ tương đối kín là `CDC-1`**, và ngay cả nó cũng
thoát được qua một cái móc vòng đời khác tên hoặc một cái tên tệp khác.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Số quy tắc nguồn công bố | **Một**: `rules = { "projection-listener-contract": projectionListenerContract }` — đúng bằng con số nhiệm vụ dự đoán |
| Quy tắc có đủ `meta` và `create` | Có; `meta.messages` khai ba `messageId`: `base`, `member`, `lifecycle` |
| Quy tắc ánh xạ được vào mã luật nào | Được, và vào **ba** mã: `CDC-1` (`base`, `lifecycle`), `CDC-2` (`groupId`, `topics`), `CDC-3` (`deriveTargets`, `recomputeTarget`) |
| Có mã nào không có quy tắc | Có bốn: `CDC-4`, `CDC-5`, `CDC-6`, `CDC-7` |
| Tên quy tắc có bị viết lại trong tài liệu | Không; tên được chép nguyên văn làm tiêu đề mục ở cả ba tài liệu nội dung |
| Có đọc hệ thống tệp, `import` hay tệp thứ hai không | Không; toàn bộ bằng chứng nằm trong tệp đang lint |
| Ba phép kiểm có chặn nhau không | Không; không có lệnh thoát sớm giữa chúng, một lớp có thể lĩnh sáu báo cáo trong một lượt |
| Phép quét thành viên có bỏ sót trường của lớp không | **Không** — và đây là điểm mạnh nhất của quy tắc: hàm ánh xạ nhận bất kỳ nút nào có `key` |
| Mức nghiêm khắc có kèm số đo | **Không.** Nguồn phát hành ở `error` mà không có ghi chú đo nào đi kèm |
| Quy tắc có bao giờ báo vào code đúng không | **Có, bốn cách** — xem Findings 3 |
| Luật có bảo vệ được chính lớp cơ sở khỏi quy tắc của nó không | Có, nhưng bằng một phép so đường dẫn chính xác, dễ trượt — xem Finding 5 |

## Findings

1. **Một quy tắc, ba mã, không có ánh xạ bịa.** Đây là hình dạng khác với các mô-đun anh em (một quy
   tắc một mã), và nó có lý do: ba phép kiểm cùng chia một cổng tên tệp và một lượt duyệt lớp, nên tách
   thành ba quy tắc sẽ nhân ba chi phí duyệt để đổi lấy ba cái tên. Cái giá phải nói ra: **một dòng
   nhật ký dựng ghi `projection-listener-contract` không cho biết mã nào bị vi phạm** — phải đọc thông
   báo.

2. **Quy tắc giữ khai báo, không giữ giá trị — và luật CDC gần như hoàn toàn là về giá trị.** Đọc lại
   bảy mã: `CDC-2` nói nhóm phải **ổn định** và chủ đề phải **đủ**; `CDC-3` nói `deriveTargets` chỉ trả
   danh tính; `CDC-4` nói recompute phải **luỹ đẳng**; `CDC-5` nói bia mộ không được bịa thành hàng
   rỗng; `CDC-6` nói một tin nhắn hỏng không được làm đứng consumer; `CDC-7` nói phải chứng minh qua
   broker thật. **Không mệnh đề nào trong số đó là một cái tên.** Quy tắc giữ được `CDC-1` vì `CDC-1`
   tình cờ là mã duy nhất phát biểu được bằng hình dạng khai báo: "kế thừa lớp này, đừng khai cái móc
   kia".

3. **Bốn cách quy tắc báo vào code đúng.** Đây là mục quan trọng nhất của phản biện này, vì mỗi báo cáo
   sai đẻ ra một chú thích tắt quy tắc, và một chú thích tắt quy tắc ở đầu tệp tắt **cả ba** phép kiểm
   cho tệp đó — kể cả những phép kiểm sau này sẽ đúng.

   1. **Lớp phụ trong cùng tệp.** Mọi `ClassDeclaration` trong tệp khớp cổng đều bị kiểm. Một lớp gom
      tiện ích đặt nhờ cạnh bộ lắng nghe lĩnh năm báo cáo.
   2. **Tham số thuộc tính của hàm dựng.** `constructor(protected readonly groupId: string)` khai thành
      viên với trình biên dịch, nhưng phép quét chỉ đi qua `node.body.body`.
   3. **Lớp cơ sở trung gian.** Một họ projection có lớp trung gian riêng sẽ bị báo `base` ở mọi lớp lá,
      vì phép so là một định danh trong một tệp.
   4. **Đổi tên khi nhập.** `import { AbstractProjectionListener as Base }` rồi `extends Base`.

   Ba trong bốn cách này là **cách viết hợp lệ và thông dụng**, không phải cách viết kỳ quặc.

4. **Mức `error` không có số đo đứng sau.** Các mô-đun khác ghi rõ một quy tắc chỉ lên `error`
   khi nợ về không, và chép lại phép đo. Nguồn của mô-đun này phát hành ở `error` mà không có ghi chú nào. Với
   một quy tắc mà **bốn** kiểu báo cáo sai đã biết đều là code hợp lệ, đó là một khoảng trống đáng ghi:
   không có gì chứng minh rằng ở thời điểm bật lên, không có tệp hợp lệ nào đang bị báo.

5. **Miễn trừ cho lớp cơ sở treo trên một phép so đường dẫn chính xác.** Loại trừ là
   `endsWith("/abstract-projection.listener.ts")`. Ba cách trượt: linter báo đường dẫn không có thư mục
   đứng trước (chạy với thư mục làm việc đúng tại thư mục đó, hoặc lint nội dung dán vào); tệp lớp cơ
   sở được đổi tên; hoặc dựng thêm một lớp cơ sở trừu tượng thứ hai — `abstract-user-projection.listener.ts`
   chẳng hạn — mà tên không trùng khít chuỗi đó. Trong hai trường hợp đầu, chính tệp lớp cơ sở bị báo
   `base` và `lifecycle`.

6. **Cổng tên tệp rộng hơn vẻ ngoài.** Biểu thức `/projection\.listener\.ts$/` không neo bên trái, nên
   `aprojection.listener.ts` cũng khớp. Rộng là tốt ở đây — nó bắt cả hai quy ước đặt tên đang cùng tồn
   tại (`a.projection.listener.ts` và `a-projection.listener.ts`) mà không cần hai biểu thức. Nhưng nó
   vẫn là **cổng tên tệp**, nghĩa là quy tắc ngừng tồn tại với `.tsx`, `.mts`, tệp gom, hay một tệp bỏ
   chữ `projection` đi cho ngắn.

7. **Điểm mạnh đáng ghi: không có gì trốn được trong một trường của lớp.** Hàm `memberName` nhận bất kỳ
   nút thành viên nào có `key` và đọc `key.name || key.value`. Nghĩa là trường mũi tên, getter, khoá
   dạng chuỗi và khai báo trừu tượng đều bị nhìn thấy như nhau. Trên kệ này, đó là lỗ hổng phổ biến
   nhất của các quy tắc cùng nhóm, còn quy tắc này không mắc phải.

8. **Tên quy tắc hứa nhiều hơn khả năng thực tế của máy.** `projection-listener-contract` nghe như "hợp đồng của bộ lắng
   nghe được giữ". Hành vi thật là "trong một tệp có tên đúng, mỗi lớp khai đúng một tên lớp cha và bốn
   tên thành viên, và không khai một tên móc". Hợp đồng thật sự của một bộ lắng nghe — nhóm ổn định, chủ
   đề đủ, ánh xạ không có tác dụng phụ, recompute luỹ đẳng — không có phần nào trong đó được kiểm.

9. **Một báo cáo hơi lệch về ngữ nghĩa.** Bốn thành viên `static` cùng tên khiến bốn phép kiểm `member` không
   báo, dù thành viên tĩnh không cài đặt gì cho hợp đồng ở mức thực thể. Ít gặp, chi phí thấp, nhưng vẫn là
   một lần không báo dù sai về mặt ngữ nghĩa.

## Decisions

- Ghi **đúng một** quy tắc có thật, lấy **tên công bố** làm danh tính và làm tiêu đề mục. Không đặt
  thêm mã số cho quy tắc: tên đó đã là chuỗi in ra trong nhật ký dựng và viết trong chú thích tắt quy
  tắc; một danh tính thứ hai nghĩa là một quy tắc hai tên và không cách nào biết thông báo đến từ tên
  nào.
- Ghi rõ quy tắc giữ **ba** mã, và ghi rõ mỗi `messageId` phụ trách mã nào, vì đó là thứ duy nhất giúp đọc
  một dòng nhật ký dựng ngược về đúng điều luật.
- Ghi bốn mã không có quy tắc là **chưa có ai giữ**, ở đây, thay vì gán chúng cho quy tắc gần nhất.
- Giữ bảng **Cửa còn mở** là phần bắt buộc của `INDEX.md`, không phải phụ lục. Một cửa chưa ai biết
  nguy hiểm hơn một luật chưa có quy tắc: luật chưa có quy tắc thì ai cũng biết là chưa được giữ.
- Ghi **báo cáo sai** thành một hạng mục riêng ngang hàng với cửa còn mở. Trên một quy tắc ba-phép-kiểm
  dùng chung một cổng, một báo cáo sai không chỉ gây phiền: nó mua một chú thích tắt quy tắc, và chú
  thích đó tắt cả ba.
- Ghi mức phát hành thực tế (`error`) và ghi luôn việc **không có số đo** đứng sau nó, thay vì suy ra một con
  số không có trong nguồn.
- Không đề xuất sửa nguồn trong mô-đun này. Đây là hồ sơ **thi hành**, và một đề xuất quy tắc mới thuộc
  về `Rủi ro còn mở` cho tới khi có bản cài đặt chỉ tay vào được.

## Rủi ro còn mở

Mỗi mục nói rõ **quy tắc phải soi thêm cái gì** mới đóng được, hoặc vì sao đóng đắt hơn để mở.

### Cửa còn mở trong `projection-listener-contract`

- **`groupId` là tên, không phải giá trị ổn định.** Đóng được **một phần** mà không ra khỏi tệp: đọc
  giá trị khởi tạo của thành viên `groupId` và báo khi nó không phải một chuỗi tĩnh hoặc một khuôn chuỗi
  chỉ chứa hằng — nghĩa là báo khi thấy một lời gọi hàm, `Date.now()`, `randomUUID()`, `process.pid`
  hoặc một định danh không phân giải được trong tệp. Rủi ro báo sai thấp, vì một nhóm tiêu thụ hợp lệ
  gần như luôn là hằng chuỗi. **Nên đóng: đây là cửa đắt nhất trong mô-đun**, vì hậu quả của nó — phát
  lại toàn bộ lịch sử mỗi lần khởi động — là hỏng hóc nặng nhất mà luật này mô tả.
- **`topics` rỗng.** Đóng được ở mức thô cùng cách trên: một mảng khởi tạo rỗng theo nghĩa đen là đáng
  báo. Không đóng được trường hợp danh sách dựng từ cấu hình lúc chạy, vì đó là giá trị chỉ tồn tại khi
  chạy. **Nên đóng phần mảng rỗng theo nghĩa đen; phần còn lại giữ mở có ý thức.**
- **Chỉ `onModuleInit` bị canh.** Đóng được, và rẻ: mở tập tên móc vòng đời ra thành một danh sách đóng
  (`onModuleInit`, `onApplicationBootstrap`, `onApplicationShutdown`, `onModuleDestroy`) và báo bất kỳ
  cái nào. Rủi ro báo sai không bằng không — một bộ lắng nghe có thể có lý do hợp lệ để dọn dẹp tài
  nguyên riêng lúc tắt — nên cần đo trước. **Nên đo rồi mở rộng danh sách.**
- **Thân `recomputeTarget` và `deriveTargets` không được đọc (`CDC-3`, `CDC-4`).** Đóng được ở mức thô
  và **không nên**: một phép kiểm kiểu "trong `recomputeTarget` chỉ được gọi đúng một phương thức của
  một dịch vụ" sẽ báo vào mọi biến thể hợp lệ — nhiều đích, ghi nhật ký, sớm thoát. Còn phép kiểm thật
  sự cần thiết ("recompute có luỹ đẳng không") là một **phán đoán về hành vi**, không phải một hình
  dạng. **Giữ mở có ý thức; đây là chỗ con người đọc, và là lý do `patterns/cdc.md` đặt câu hỏi phân
  định "xử lý cùng một hàng hai lần có ra cùng kết quả không" ngay ở phần định nghĩa.**
- **Biểu thức lớp không được thăm.** Đóng được, gần như miễn phí: thêm `ClassExpression` vào bộ duyệt
  và dùng chung hàm xử lý. **Nên đóng.**
- **Cổng tên tệp.** Không đóng được mà không bỏ cổng, mà bỏ cổng thì quy tắc đòi mọi lớp trong kho mã
  phải kế thừa lớp cơ sở của projection. Cách rẻ hơn nằm ở chỗ khác: một quy tắc đặt tên buộc mọi lớp
  kế thừa `AbstractProjectionListener` phải sống trong tệp có hậu tố đó sẽ làm việc đổi tên tệp trở
  thành lỗi của **chính nó**, và như vậy cửa này đóng gián tiếp. **Giữ mở tại đây; ghi lại như lý do để
  cân nhắc một quy tắc đặt tên.**
- **Lớp cha so bằng cách viết tại chỗ.** Đóng hẳn thì cần lần theo `import` để biết định danh phân giải
  ra cái gì — phân tích liên tệp, đắt hơn hẳn mọi thứ trong mô-đun này, và làm câu trả lời phụ thuộc
  cây làm việc. Đóng một phần được: nhận thêm `MemberExpression` để `extends core.AbstractProjectionListener`
  không lọt. **Đóng phần `MemberExpression`; phần đổi tên khi nhập giữ mở.**
- **Lớp cơ sở trung gian bị báo `base`.** Cùng một rào cản liên tệp. Cách rẻ và trung thực hơn: nới phép
  so thành "tên lớp cha khớp `/^Abstract.*ProjectionListener$/`", chấp nhận rằng quy tắc khi đó chỉ
  khẳng định "kế thừa **một** lớp cơ sở của projection" chứ không khẳng định lớp nào. Được nhiều hơn
  mất, vì nó xoá một trong bốn nguồn báo cáo sai. **Nên đo rồi nới.**
- **Tham số thuộc tính không được tính là thành viên.** Đóng được và rẻ: gom thêm tên của các
  `TSParameterProperty` trong hàm dựng vào `Set` tên thành viên. **Nên đóng — đây là báo cáo sai rẻ
  nhất để xoá.**
- **Lớp phụ trong tệp bộ lắng nghe bị kiểm.** Đóng được ở mức thô bằng cách chỉ kiểm lớp được xuất,
  hoặc chỉ kiểm lớp có tên kết thúc bằng `Listener`. Cả hai đều mua sự yên tĩnh bằng một cửa mới: một
  bộ lắng nghe không xuất, hoặc đặt tên khác, sẽ thoát. **Cần cân nhắc kỹ; nghiêng về chỉ bỏ qua lớp
  không xuất và ghi nhận cửa đổi lại.**
- **Thành viên `static` được chấp nhận.** Đóng được bằng cách bỏ qua thành viên `static` khi dựng `Set`.
  Chi phí gần bằng không, lợi ích cũng gần bằng không cho tới khi gặp trường hợp đầu tiên. **Ghi lại,
  chưa cần làm.**
- **Khoá tính toán bằng định danh báo sai.** Không đóng được nếu không suy luận giá trị của hằng số, và
  một bộ lắng nghe dùng khoá tính toán cho `groupId` là chuyện hầu như không xảy ra. **Giữ mở có ý
  thức.**
- **Miễn trừ lớp cơ sở treo trên một chuỗi chính xác.** Đóng được: đổi phép so sang biểu thức chính quy
  trên tên tệp (`/(^|\/)abstract-[a-z0-9-]*projection\.listener\.ts$/`) để bắt cả trường hợp không có
  thư mục đứng trước lẫn trường hợp có nhiều lớp cơ sở trừu tượng. **Nên đóng.**
- **Một bộ lắng nghe không ai nối dây.** Không đóng được bằng lint một tệp: nó là một câu hỏi về đồ thị
  mô-đun. Chỗ đóng đúng là một phép kiểm lúc khởi động hoặc một kiểm thử đọc siêu dữ liệu mô-đun.
  **Giữ mở tại đây; đó là việc của cổng bên ngoài.**

### Ngoài phạm vi quy tắc duy nhất

- **`CDC-4` (recompute luỹ đẳng) không có quy tắc.** Đây là mã **quan trọng nhất** trong cả luật — nó
  là câu hỏi phân định mà `patterns/cdc.md` dùng để định nghĩa CDC — và nó là phán đoán về hành vi. Một
  quy tắc lint đoán mò chỗ này sẽ bị tắt. **Chỗ giữ đúng là kiểm thử: phát cùng một hàng hai lần và
  khẳng định projection không đổi.** Ghi lại như một đề xuất cho mô-đun kiểm thử, không phải cho mô-đun
  này.
- **`CDC-5` (bia mộ) không có quy tắc.** Hiện được giữ bằng **kiến trúc** chứ không bằng lint: lớp cơ
  sở bỏ qua payload không có ảnh `after`, nên mọi bộ lắng nghe kế thừa nó đều được. Nghĩa là `CDC-5`
  phụ thuộc hoàn toàn vào việc `base` được giữ — và mọi cửa làm `base` im lặng cũng làm `CDC-5` mất
  chỗ dựa. **Ghi lại như một quan hệ phụ thuộc, không phải như một quy tắc thiếu.**
- **`CDC-6` (một tin nhắn hỏng không làm đứng consumer) không có quy tắc.** Cùng một quan hệ phụ thuộc
  với `CDC-5`: khối `catch` nằm trong lớp cơ sở.
- **`CDC-7` (chứng minh qua broker thật) không có quy tắc trong mô-đun này.** Nó là tính chất của một
  lần chạy kiểm thử, không phải một hình dạng khai báo. **Đây là đề xuất, không phải quy tắc** — nó
  không được ghi vào `INDEX.md`, đúng theo luật cao nhất: một quy tắc không chỉ tay vào được là một đề
  xuất.
- **Mức `error` chưa có số đo.** Không phải một cửa, nhưng là một khoảng trống bằng chứng. Chỗ đóng
  đúng là chạy quy tắc trên nguồn thật với một cấu hình tối thiểu, đếm **chỉ** báo cáo của quy tắc này,
  và ghi con số vào `changelog.md`. **Nên đo.**

## Re-audit Triggers

- Nguồn công bố thêm hoặc bớt một quy tắc, hoặc đổi tên quy tắc đang có.
- Mức nghiêm khắc đổi, hoặc lần đầu có một phép đo được ghi lại cho mức `error` hiện tại.
- Có ai đó viết quy tắc cho `CDC-4`, `CDC-5`, `CDC-6` hoặc `CDC-7`.
- Bất kỳ cửa nào trong mục trên được đóng, hoặc một cửa mới được tìm ra trong mã nguồn thật.
- Một trong bốn nguồn **báo cáo sai** xuất hiện trong kho mã thật, hoặc xuất hiện một chú thích tắt quy
  tắc ở đầu một tệp bộ lắng nghe — chú thích đó tắt cả ba phép kiểm và phải được ghi lại.
- Tệp lớp cơ sở được đổi tên, được di chuyển, hoặc mọc thêm một lớp cơ sở trừu tượng thứ hai.
- Tập tên móc vòng đời mà khung nền cung cấp thay đổi.
- Quy tắc bắt đầu đọc hệ thống tệp, phân giải `import`, hoặc dùng thông tin kiểu — điều đó đổi hẳn tính
  tái lập của cả mô-đun.
