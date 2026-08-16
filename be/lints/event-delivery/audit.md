---
id: be-lints-event-delivery-audit
title: audit.md
slug: /be/lints/event-delivery/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện phần máy giữ hợp đồng chuyển phát — đếm lại luật, soi từng cửa còn mở.
---

# audit.md

> Version: `2.00` · Mô-đun: `event-delivery`

Phản biện này hỏi một câu duy nhất: **cái cổng này đang giữ được đúng bao nhiêu, và người đọc có đang
tin nó giữ nhiều hơn thế không?**

## Verdict

Chấp nhận **có điều kiện**, kèm bảy nhận định và mười hai cửa còn mở phải được ghi vào tài liệu chứ
không được làm gọn đi.

Luật máy đúng việc nó nhận: nó bắt được **mất hẳn một câu lệnh**, và mất hẳn một câu lệnh là dạng
hỏng thường gặp nhất của hai điều luật này, vì cả hai câu lệnh ấy đọc riêng ra đều trông thừa và đều
là ứng viên số một cho một lần dọn dẹp. Nó có bộ kiểm song sinh, nó ở mức `error`, và nó không có
tuỳ chọn nào để nới.

Điều **không** chấp nhận được là đọc luật máy này thành "hợp đồng chuyển phát đã có máy giữ". Nó giữ
hai trong sáu điều, giữ hai điều ấy trên **đúng một tệp**, và giữ bằng cách **tìm chuỗi ký tự theo
thứ tự xuất hiện** chứ không phải bằng cách đọc mã. Khoảng cách giữa "chuỗi có mặt đúng thứ tự" và
"hậu quả không xảy ra hai lần" là toàn bộ nội dung mục **Rủi ro còn mở**.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Nguồn công bố mấy luật máy? | Đúng **một**, khớp với con số dự kiến. Đếm ở `rules` và ở `recommended`, hai chỗ khớp nhau: một khoá `nats-bridge-delivery-contract`, một khoá `starci-be/nats-bridge-delivery-contract` đặt ở `error`. |
| Luật máy gắn được vào mã nào của luật? | **Hai** mã, tách nhau bằng thông điệp: `origin` giữ `DELIVERY-3`, `digest` giữ `DELIVERY-4`. Không phải bịa ánh xạ nào. |
| Mã nào của luật không có luật máy? | **Bốn trên sáu**: `DELIVERY-1`, `DELIVERY-2`, `DELIVERY-5`, `DELIVERY-6`. |
| Tên luật máy có bị viết lại trong tài liệu không? | Không. Tên được chép nguyên văn ở cả năm tài liệu, kể cả bản tiếng Việt. |
| Luật máy có đọc cây cú pháp không? | **Không một nút nào**, ngoài nút `Program` dùng làm chỗ báo. Toàn bộ phép kiểm chạy trên `sourceCode.getText()`. |
| Luật máy có đọc tên tệp không? | Có, và tên tệp là **cổng duy nhất**. Không khớp thì trả về bộ thăm rỗng. |
| Luật máy có tuỳ chọn không? | Không. Khai `schema: []`, nên nới lỏng chỉ còn cách tắt hẳn — mà tắt hẳn thì nhìn thấy được. |
| Luật máy có bộ tự sửa không? | Không. Không khai `fixable`, không khai `hasSuggestions`. |
| Hằng số có làm sạch được một chuỗi vi phạm không? | **Không** — và đây là chỗ luật máy này khác mọi luật khớp chuỗi khác trong cây: gom giá trị vào hằng số làm nó **nổ**, không làm nó im. Cửa quen thuộc nhất của loại luật này đóng ở đây, nhưng đóng bằng cách báo thừa. |
| Một hình dạng cú pháp khác có làm sạch được không? | **Có**, bằng rất nhiều cách. Đây là toàn bộ nội dung mục "Rủi ro còn mở". |
| Xoá câu lệnh có làm luật im được không? | **Không**. Xoá lời gọi phát sự kiện làm `emitIndex` bằng `-1`, và cả hai thông điệp cùng nổ. |
| Bộ kiểm song sinh có phủ được hai chiều không? | Có, tối thiểu: đúng một trường hợp hợp lệ và đúng một trường hợp không hợp lệ, trường hợp không hợp lệ khẳng định cả hai thông điệp. Không có trường hợp nào phủ **thứ tự sai** — chỉ phủ **thiếu hẳn**. |

## Findings

**F-1 · Một luật máy gánh hai mã luật.** `origin` giữ `DELIVERY-3`, `digest` giữ `DELIVERY-4`. Đây
không phải lỗi, nhưng nó có hệ quả thật: nhật ký dựng in ra **tên luật**, và tên ấy là một chuỗi duy
nhất cho hai điều luật khác nhau. Ai lọc nhật ký theo tên sẽ gộp hai loại hỏng làm một; chỉ câu thông
điệp mới tách được chúng. Tách thành hai luật máy sẽ tốn một tên mới và một lần đổi cấu hình, nhưng
sẽ làm mỗi thất bại chỉ tay được vào đúng một điều luật.

**F-2 · Phạm vi của luật máy là đúng một tệp.** Cổng là
`endsWith("/event/nats/nats-bridge.service.ts")`. Đây không phải một khoảng trừ; đây là **toàn bộ**
phạm vi. Một điều luật nói về một loại hành vi — cây cầu xuyên bản chạy — đang được giữ bằng cách
khẳng định nội dung của một tệp cụ thể. Tệp đổi tên, tệp bị tách, hoặc một cây cầu thứ hai xuất hiện,
thì mô-đun này không còn giữ gì cả, và không có tín hiệu nào báo điều đó.

**F-3 · "Trước" trong luật máy là trước trong văn bản, còn "trước" trong luật là trước lúc chạy.**
Hai khái niệm ấy trùng nhau ở đoạn mã thẳng hàng và tách nhau ngay khi có hàm phụ trợ. Khoảng lệch
này gây **cả** báo thừa (hàm chặn viết dưới) **lẫn** báo sót (phép so viết trên nhưng chạy ở nhánh
khác). Một luật máy sai theo cả hai chiều thì con số nó báo ra không đọc được như một phép đo.

**F-4 · Thiếu hẳn lời gọi phát sự kiện bị báo bằng câu thông điệp nói về thứ tự.** `emitIndex < 0`
làm **cả hai** điều kiện đúng, nên một tệp không phát cục bộ gì cả — tức là một tệp không thể vi phạm
`DELIVERY-3` hay `DELIVERY-4` — nhận hai lỗi, với hai câu chữ không mô tả nguyên nhân. Người đọc nhận
một câu trả lời sai cho một câu hỏi đúng, và cách sửa hiển nhiên nhất là thêm lại một lời gọi phát sự
kiện chỉ để cho cổng im.

**F-5 · Biểu thức chính quy đóng cứng cách viết, không đóng cứng ý nghĩa.** Nó đòi tên biến `parsed`,
đường dẫn `this.instanceService.getId()`, toán tử `===`, và **thứ tự hai vế**. Cho nên
`this.instanceService.getId() === parsed.id` bị báo dù đúng nghĩa hệt nhau, còn `envelope.id === …`
bị báo chỉ vì một cái tên khác. Luật máy đang dạy một **cách viết**, và một luật dạy cách viết sẽ
được thoả bằng cách viết đúng chữ chứ không bằng cách nghĩ đúng.

**F-6 · Chỗ báo là nút `Program`.** Mọi thất bại rơi vào dòng đầu tệp. Cổng biết vị trí ký tự của lời
gọi phát sự kiện có lỗi — nó vừa tính ra chính con số ấy — nhưng không dùng nó. Đây là chi tiết rẻ
nhất trong cả mô-đun để sửa và có tác dụng lớn nhất với người đọc nhật ký.

**F-7 · Tên luật máy hứa nhiều hơn cơ chế của nó.** `nats-bridge-delivery-contract` đọc như một phép
kiểm hợp đồng. Cơ chế là một **dây bẫy có mặt-và-đúng-thứ tự** đặt trên ba chuỗi ký tự trong đúng một
đường dẫn. Cái tên không sai, nhưng nó là loại tên khiến người đọc thôi hỏi tiếp — và câu hỏi tiếp
theo là câu quan trọng nhất trong mô-đun này.

## Decisions

- Giữ đúng một luật máy đang có, không tài liệu hoá luật nào chưa tồn tại. Một luật chưa chỉ tay
  được là một đề xuất, không phải một luật.
- Ánh xạ luật máy vào **hai** mã theo thông điệp, chứ không chọn một mã cho gọn, và ghi việc một tên
  gánh hai mã thành **F-1**.
- Ghi `DELIVERY-1`, `DELIVERY-2`, `DELIVERY-5` và `DELIVERY-6` là **không có luật máy** ở cả bảng ánh
  xạ trong `example.md`, chứ không suy chúng vào một luật gần giống.
- Chép nguyên văn tên luật máy, hai định danh thông điệp, tiền tố `starci-be/` và ba chuỗi mà biểu
  thức chính quy tìm. Chúng là định danh đang được ship; lệnh cấm tên sản phẩm áp vào lời văn và ví
  dụ, không áp vào chúng.
- Coi bảng **Cửa còn mở** là phần bắt buộc của mô-đun này. Không viết "không có" cho gọn.
- Không đề xuất hạ mức nghiêm của luật máy, kể cả khi nó báo thừa. Báo thừa được chữa bằng cách mở
  rộng cái nó nhìn thấy, không bằng cách bớt nói.
- Không đề xuất gỡ luật máy. Nó vẫn bắt được dạng hỏng thường gặp nhất, và một cổng thô còn hơn một
  điều luật không ai giữ — miễn là không ai đọc nó thành nhiều hơn thế.

## Rủi ro còn mở

Mỗi mục nêu cửa, rồi nêu **luật máy phải soi thêm cái gì** mới đóng được nó — hoặc vì sao đóng đắt
hơn để mở.

**R-1 · Phép so có mà không chặn.** `if (parsed.id === this.instanceService.getId()) { }` không
`continue`, không `return`, và cổng im. **Đóng bằng cách nào:** phải chuyển từ tìm chuỗi sang đọc cây
cú pháp — thăm nút `IfStatement`, đối chiếu phần điều kiện với hình dạng phép so, rồi đòi phần thân
chứa `ContinueStatement` hoặc `ReturnStatement`. Việc này **nằm gọn trong một tệp** và không cần
thông tin kiểu, nên rẻ. Đây là **cửa nặng nhất mô-đun** và nên đóng trước tiên: nó để lọt đúng cái
hậu quả mà điều luật sinh ra để chặn, trong khi cổng báo sạch.

**R-2 · Chú thích, chuỗi ký tự và mã chết là bằng chứng ngang với câu lệnh sống.** **Đóng bằng cách
nào:** cùng một cách chữa với **R-1**. Ngay khi phép kiểm chạy trên nút thay vì trên văn bản, chú
thích biến mất khỏi tầm nhìn và chuỗi ký tự trở thành `Literal` chứ không còn là bằng chứng. Đây là
lợi ích lớn nhất của việc chuyển sang cây cú pháp, và nó đóng bốn cửa cùng lúc: **R-2**, phần chuỗi
của **R-8**, và hai nửa của **R-3**.

**R-3 · Đọc dấu vân tay mà không ghi, hoặc ghi mà không đọc.** Cổng chỉ đòi chuỗi `parsed.digest`
xuất hiện trước chỗ phát. **Đóng bằng cách nào:** đòi **hai** lời gọi khác nhau trên cùng khoá — một
lần đọc dùng để rẽ nhánh, một lần ghi — và đòi lần đọc nằm trong một câu điều kiện có `continue`.
Việc này đọc được trong một tệp, nhưng nó buộc luật máy phải biết tên dịch vụ bộ nhớ đệm, tức là gắn
luật vào một API cụ thể. Chi phí trung bình, giá trị cao: nửa quan trọng nhất của `DELIVERY-4` hiện
**không có ai giữ**.

**R-4 · Chỉ lời gọi phát sự kiện đầu tiên được đo.** **Đóng bằng cách nào:** thu thập **mọi** lời gọi
`this.eventEmitter.emit` và so từng cái với vị trí chặn gần nhất phía trên nó, thay vì so một lần với
`indexOf`. Rẻ ngay cả khi vẫn làm bằng văn bản; rẻ hơn nữa nếu đã chuyển sang cây cú pháp. Nên đóng
cùng đợt với **R-1**.

**R-5 · Thứ tự trên trang không phải thứ tự lúc chạy.** **Đóng bằng cách nào:** không đóng được hoàn
toàn bằng một luật máy một-tệp — trả lời "câu lệnh này có chạy trước câu lệnh kia không" là bài toán
luồng điều khiển, không phải bài toán cú pháp. Cách gần đúng và đủ tốt: đòi phép chặn và lời gọi phát
sự kiện **nằm trong cùng một thân hàm**, rồi so vị trí trong thân hàm ấy. Điều đó vừa xoá báo thừa
"hàm phụ trợ viết dưới", vừa xoá báo sót "phép so ở một nhánh khác". Đây là mục đáng làm thứ hai sau
**R-1**.

**R-6 · Cổng là một hậu tố đường dẫn duy nhất; đổi tên tệp là tắt luật.** **Đóng bằng cách nào:**
không đóng được bằng cách siết chuỗi — mọi mẫu đường dẫn đều đổi tên được. Cách đúng là **đổi tiêu
chí nhận diện**: nhận bất kỳ tệp nào vừa gọi `this.eventEmitter.emit` vừa nằm trong một lớp có đăng
ký nhận từ đường truyền, hoặc yêu cầu một dấu hiệu khai báo trong chính tệp cầu. Chi phí cao và có
rủi ro báo thừa. Cách rẻ tạm thời: thêm một luật máy **thứ hai** chỉ để khẳng định rằng tệp ở đường
dẫn ấy **tồn tại** — một cây cầu bị đổi tên khi đó đỏ lên, thay vì im lặng.

**R-7 · Cây cầu thứ hai, hoặc cùng tệp trong ứng dụng thứ hai.** **Đóng bằng cách nào:** cùng chi phí
với **R-6**, cùng một cách chữa. Ghi riêng vì nó là chiều nguy hiểm hơn: **R-6** cần ai đó đổi tên,
còn **R-7** chỉ cần ai đó thêm mới, mà thêm mới thì bình thường hơn nhiều.

**R-8 · `indexOf("parsed.digest")` khớp theo chuỗi con.** `parsed.digestedAt`, `parsed.digestion` và
chuỗi `"parsed.digest"` đều thoả. **Đóng bằng cách nào:** đọc nút `MemberExpression` và đòi
`property.name` bằng đúng `"digest"`. Một dòng, nếu đã chuyển sang cây cú pháp. Không đáng làm riêng
bằng văn bản, vì mọi cách vá bằng biểu thức chính quy đều sinh ra một mẫu khác cần vá tiếp.

**R-9 · Không gì xác nhận `parsed` là phong bì hay `getId()` trả về danh tính bản chạy.** Một đối
tượng giả — kể cả một đối tượng gán `id` bằng **tên chủ đề**, đúng cách viết sai mà điều luật gọi tên
đích danh — vẫn qua sạch. **Đóng bằng cách nào:** cần thông tin kiểu, tức là cần dịch vụ kiểm kiểu —
một chi phí khác hẳn về bậc. Cách rẻ trong tầm một tệp: cấm gán `message.subject` vào một trường tên
`id`, tức một luật máy hẹp giữ đúng một cách viết sai đã biết. Không đóng được cửa, nhưng đóng được
cái bẫy đã sập một lần.

**R-10 · Báo thừa vì cách viết: đảo hai vế và gom vào hằng số.** **Đóng bằng cách nào:** chấp nhận cả
hai thứ tự hai vế, và giải một tên cục bộ về lời gọi sinh ra nó trong cùng phạm vi. Cả hai đều làm
được trên cây cú pháp và không cần thông tin kiểu. **Đây là rủi ro dạng khác các mục trên**: nó không
để lọt mã sai, nó **từ chối mã đúng** — và một cổng từ chối mã đúng dạy người viết chiều theo cổng,
mà chiều theo một cổng là bước đầu tiên của việc thôi đọc nó.

**R-11 · Thiếu lời gọi phát sự kiện bị báo bằng câu chữ về thứ tự.** **Đóng bằng cách nào:** tách
`emitIndex < 0` thành một thông điệp thứ ba nói đúng nguyên nhân, hoặc quyết định rằng một tệp không
phát cục bộ thì không thuộc phạm vi và im lặng. Rẻ, và nên làm cùng lúc với việc đổi chỗ báo ở
**R-12** — hai sửa đổi ấy cùng phục vụ một việc: làm câu thông điệp nói đúng chuyện gì đã xảy ra.

**R-12 · Mọi thất bại báo lên dòng đầu tệp.** **Đóng bằng cách nào:** báo lên nút lời gọi phát sự
kiện không được bảo vệ. Cổng đã có vị trí ký tự ấy trong tay. Rẻ nhất trong danh sách, và là thứ duy
nhất ở đây mà người đọc nhật ký cảm nhận được ngay.

**R-13 · Không có cách nào ngăn một dòng tắt luật.** **Đóng bằng cách nào:** không nên đóng bằng luật
máy. Một cổng không tắt được sẽ bị gỡ khỏi cấu hình thay vì bị tắt tại chỗ, và gỡ khỏi cấu hình thì
khó nhìn thấy hơn nhiều. Chỗ đúng để giữ là bản rà soát: một dòng tắt luật ở tệp này phải kèm lý do
và ngày. Đây là mục duy nhất trong danh sách mà **giá của việc đóng cao hơn giá trị**.

**R-14 · Bộ kiểm song sinh không phủ chiều thứ tự.** Nó có đúng một trường hợp hợp lệ và một trường
hợp không hợp lệ, và trường hợp không hợp lệ là **thiếu hẳn** cả hai câu lệnh. Không có trường hợp
nào chứng minh rằng đặt phép chặn **sau** chỗ phát thì báo. **Đóng bằng cách nào:** thêm hai trường
hợp không hợp lệ, mỗi thông điệp một trường hợp, với câu lệnh viết sau chỗ phát. Rẻ, và nó bảo vệ
đúng nửa cơ chế mà mô-đun này quảng cáo là quan trọng nhất.

**R-15 · Bốn mã luật không có luật máy nào.** `DELIVERY-1` (phong bì mang danh tính và dấu vân tay),
`DELIVERY-2` (khai `useLocal` và `useNats` cho từng sự kiện), `DELIVERY-5` (bản kiểm khẳng định người
nhận và nội dung) và `DELIVERY-6` (chứng minh bằng hai bản chạy thật). **Đóng bằng cách nào:**
`DELIVERY-2` là mã dễ nhất trong cả luật để giao cho máy — bảng cấu hình sự kiện là một đối tượng
viết thẳng, và đòi mỗi mục có đủ hai khoá là một luật máy một-tệp, không cần kiểu, không cần đường
dẫn. Nó nên tồn tại và hiện chưa. `DELIVERY-1` cần đọc phía sinh phong bì, chi phí trung bình.
`DELIVERY-5` và `DELIVERY-6` là phán đoán về ý định của một bản kiểm, và chính văn bản luật đã giao
chúng cho người rà soát.

## Re-audit Triggers

- Tệp nguồn công bố thêm, bớt hoặc đổi tên một luật máy.
- Tệp cầu bị đổi tên, bị tách, hoặc một cây cầu thứ hai xuất hiện — **R-6** và **R-7** khi ấy không
  còn là rủi ro mà là một cổng đã tắt.
- Một mã mới được thêm vào trang luật, hoặc `DELIVERY-2` được đề nghị đưa cho máy giữ.
- Luật máy bị hạ khỏi mức `error` ở bất kỳ nơi nào dùng.
- Một dòng tắt luật xuất hiện trong tệp cầu mà không kèm lý do và ngày.
- Có báo cáo về một hậu quả xảy ra hai lần trong môi trường thật — khi ấy **R-1** hoặc **R-3** không
  còn là nhận định mà là một lỗ hổng đang chảy, và phải xác định được cái nào.
- Luật máy được chuyển từ tìm chuỗi sang đọc cây cú pháp — gần như mọi mục trong danh sách trên đổi
  trạng thái cùng lúc.
- Bộ kiểm song sinh không còn chạy cùng nguồn, hoặc một cửa trong bảng "Cửa còn mở" được đóng mà bảng
  không đổi.
