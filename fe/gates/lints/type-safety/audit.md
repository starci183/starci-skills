---
id: fe-lints-type-safety-audit
title: audit.md
slug: /gates/lints/type-safety/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện xem một rule có giữ nổi năm mã luật hay không, và những gì còn hở.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `type-safety`

Phản biện này hỏi một câu duy nhất: **máy đang giữ được bao nhiêu phần của luật này, và phần còn lại
đang nằm ở đâu?**

## Kết luận

Chấp nhận, có kèm ba nhận định và một danh sách cửa còn mở dài hơn phần được giữ.

Rule duy nhất ở đây **chính xác**: nó khớp một hình dạng cú pháp, không phán đoán, không cần cấu
hình, và bộ kiểm thử song sinh của nó ghim đúng ranh giới đáng ghim nhất — cast một tầng khác cast
hai tầng. Không có báo oan nào trong phạm vi nó tự nhận, trừ một trường hợp tên tệp đã ghi bên dưới.

Điều phải nói rõ để không ai đọc nhầm: **luật có năm mã, mô-đun này giữ một.** Một mã nữa được giữ
dưới dạng vắng mặt (cổng tệp), hai mã được uỷ thác ra ngoài gói, và một mã không có ai giữ. Con số
"một rule" là đúng với nguồn, và nó cũng đúng là một tuyên bố khiêm tốn hơn nhiều so với những gì
tên của luật gợi ra.

Đếm khớp: bản tóm tắt đầu việc dự đoán khoảng một rule, và tệp nguồn công bố đúng một
(`no-double-cast`). Không có chênh lệch nào để báo.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `value as Target` so với `value as unknown as Target` | Phân định được: toán hạng của vế ngoài có phải cast hay không |
| `value as unknown` so với cặp hai tầng | Phân định được: có vế ngoài hay không |
| Vế trong là `unknown` so với dạng viết tắt | Phân định được, nhưng nửa còn lại thuộc gói khác |
| Vế trong là `unknown` so với một alias trỏ tới `unknown` | **Không phân định được**: rule chỉ nhận nút từ khoá |
| Cặp kề nhau so với cặp có nút chen giữa | **Không phân định được**: một nút chen vào là hết khớp |
| Cast hai tầng so với hai câu lệnh làm cùng việc | **Không phân định được**: hai câu lệnh không có nút nào để bắt |
| Tệp kiểm thử so với tệp sản phẩm | Phân định được bằng bốn hậu tố, không bằng gì khác |
| Tệp trợ giúp kiểm thử so với tệp sản phẩm | **Không phân định được**: cùng bị quản như production |
| Mã nguồn sản phẩm so với công cụ và cấu hình | Phân định được bằng `/src/`, với một lỗi ngược chiều đã ghi |

## Phát hiện

**1 — Hai mã luật được giữ bởi một gói mà mô-đun này không phát hành.** `TYPE-SAFETY-2` (dạng viết
tắt của phép xoá) và `TYPE-SAFETY-3` (một cách viết cho mảng) không công bố rule nào ở đây. Mô-đun
rule nêu đích danh nơi giữ chúng: rule cấm dạng viết tắt và rule về cách viết mảng của bộ plugin
TypeScript. Lập luận vững — chép lại rule của người khác là tạo thêm một bản phải giữ cho khớp, và
bản không ai sửa chính là bản ngừng khớp.

Nhưng hệ quả cần được nói ra: **hai trong năm mã của luật này nằm ngoài bảo đảm của gói.** Một kho
adopt gói này rồi cấu hình bộ plugin TypeScript lỏng tay vẫn qua cổng lint của mình trong khi phá hai
mã đã công bố, và không gói nào phát hiện ra. Ghi lại chứ không sửa: sửa ở đây là tạo ra đúng bản
sao mà mô-đun rule đã từ chối. Chỗ đúng để đóng nó là **kiểm tra cấu hình hiệu dụng** — chứng minh
hai rule được uỷ thác đang bật ở mức lỗi — chứ không phải một rule thứ hai.

**2 — Một mã luật không có ai giữ, ở đây lẫn ở nơi được uỷ thác.** `TYPE-SAFETY-5` nói một phép cast
sống sót qua review phải mang theo lý do của nó ngay trên dòng. Không rule nào đọc comment cạnh một
phép cast. Đây là một mã luật thật, được viết ra để dùng khi review, và hiện hoàn toàn không có máy
nào giữ.

**3 — Cổng tệp là hai lỗi ngược chiều nhau trên cùng một dòng lệnh.** `includes("/src/")` cộng với
bốn hậu tố tên tệp vừa **thiếu tầm** (đổi tên tệp là thoát rule; mọi thứ ngoài `/src/` không được
soi; một checkout nằm dưới thư mục tên `src` thì ngược lại kéo cả công cụ vào phạm vi) vừa **quá
tầm** (tệp dữ liệu mẫu và tệp trợ giúp kiểm thử dựng giá trị sai đúng như tệp kiểm thử nhưng không
được miễn). Đây không phải hai khuyết điểm — là một quyết định duy nhất, và mô-đun rule đã tranh
luận công khai rằng đường dẫn vẫn hơn phán đoán. Phản biện này đồng ý với kết luận ấy và ghi lại cái
giá của nó.

**4 — Không có báo oan trong phạm vi rule tự nhận, trừ một.** Trường hợp duy nhất là tệp dựng dữ
liệu mẫu nằm dưới `/src/` mà tên không mang đuôi kiểm thử. Đó là hệ quả trực tiếp của nhận định 3.

**5 — Rule miễn nhiễm với cửa lách phổ biến nhất của tầng này.** Ở nhiều rule khác, gom giá trị vào
một hằng rồi dùng lại ở nơi khác là cách rule biến mất. Rule này thăm **nút cú pháp** chứ không thăm
một vị trí thuộc tính, nên hằng số, mảng, object literal, tham số lời gọi và thuộc tính của thẻ đều
không rửa được nó. Đáng ghi nhận, và đáng nói ra, vì phản xạ "gom vào hằng cho gọn" đến từ những
rule khác nơi nó **có** tác dụng — và ở đây nó chỉ dời báo cáo đi một dòng.

## Quyết định

- Giữ **đúng một** rule trong tài liệu này: `no-double-cast`. Không đặt số cho nó; danh tính của nó
  là tên đã công bố.
- Không ghi vào tầng này bất kỳ rule nào "đáng lẽ phải có". Chúng nằm ở mục rủi ro còn mở bên dưới.
- Ánh xạ `no-double-cast` vào `TYPE-SAFETY-1`, một mã và chỉ một mã.
- Ghi `TYPE-SAFETY-4` là **được thi hành dưới dạng vắng mặt**, không phải là một rule, để không ai
  đếm nó thành hai.
- Giữ nguyên lập luận uỷ thác của mô-đun rule cho `TYPE-SAFETY-2` và `TYPE-SAFETY-3`, và ghi hệ quả
  của nó thành một rủi ro chứ không phải một lỗi.
- Giữ bảng **Những chỗ còn lọt** dài hơn bảng **Cửa đã đóng**. Đó là hình dạng đúng của tầng này: một luật
  không có rule thì ai cũng biết là không được giữ, còn một rule hở thì bị tin là đã kín.
- Không đề nghị một bản vá tự động. Mọi bản sửa thật đều phải chọn cho giá trị một hình dạng mà nó
  chưa từng có, và máy không chọn được hình dạng ấy.

## Rủi ro còn mở

Mỗi mục ghi: cửa hở là gì, và rule sẽ phải **nhìn thêm cái gì** mới đóng được — hoặc vì sao đóng nó
tốn hơn phần thu được.

- **Cách viết ngoặc nhọn `<Đích><unknown>giá_trị`.** Phải thăm thêm `TSTypeAssertion` và áp đúng phép
  thử ấy cho toán hạng của nó. **Đóng được, rẻ, nên đóng.** Đây là cửa duy nhất trong danh sách này
  vừa xoá y hệt vừa sửa được bằng vài dòng, và nó đến cùng người đang chuyển code sang chứ không phải
  người đang né rule.
- **`as any as`, `as never as`, `as {} as`.** Phải nhận thêm ba loại nút chú thích ở vế trong. Đóng
  được kỹ thuật, nhưng chồng lấn với rule được uỷ thác về dạng viết tắt — và chồng lấn chính là thứ
  mô-đun rule từ chối. Cách đóng đúng là **kiểm tra cấu hình hiệu dụng**: chứng minh rule kia đang bật
  ở mức lỗi trong kho tiêu thụ. Riêng `as never as` và `as {} as` thì **không** rule nào đang giữ, và
  hai cái đó nên được cân nhắc thêm vào đây.
- **Alias trỏ tới từ khoá (`type Loose = unknown`).** Phải giải được tên kiểu, tức là phải có thông
  tin kiểu chứ không chỉ cú pháp. Điều đó biến rule từ một phép thử cú pháp rẻ thành một rule cần
  chương trình đã được phân tích kiểu — chậm hơn nhiều bậc, và cần cấu hình mà một số kho không có.
  **Không đóng.** Ghi lại và soát bằng mắt.
- **Nút chen giữa hai phép cast (`(x as unknown)! as T`).** Phải bóc các nút trong suốt — khẳng định
  không-null, và biểu thức `satisfies` — trước khi kiểm quan hệ cha con. **Đóng được, rẻ, nên đóng**,
  và nó nằm cùng một chỗ sửa với cửa ngoặc nhọn.
- **Phép xoá tách thành hai câu lệnh.** Đây là cửa nguy hiểm nhất và cũng là cửa khó nhất. Muốn đóng,
  rule phải theo được luồng: một biến khai báo `unknown` bị cast xuống một kiểu cụ thể **mà không có
  phép kiểm nào ở giữa** thì mới là vi phạm; có phép kiểm thì không. Đó là phân tích luồng điều
  khiển, không phải khớp nút. Tệ hơn: bản sửa mà rule khuyên có **cùng hình dạng** với cách né, nên
  một phiên bản khớp thô sẽ báo oan đúng vào những người đang làm đúng. **Không đóng bằng lint.** Đây
  là chỗ review đọc bằng mắt, và nên được nêu tên trong tài liệu review.
- **Hàm generic `coerce<T>(value: unknown): T`.** Muốn đóng phải nhận ra một hàm mà thân của nó cast
  tham số `unknown` sang tham số kiểu của chính nó, rồi cấm hình dạng ấy. Khớp được về cú pháp, và
  đáng cân nhắc, vì đây là cửa duy nhất **rửa sạch cả cây một lần và vĩnh viễn**. Cái giá là báo oan
  ở những hàm phân tích chính đáng có cùng chữ ký — thứ mà một cặp đường dẫn miễn trừ giải quyết
  được. **Nên đề xuất thành một rule thứ hai**, không phải thành một nhánh của rule này.
- **Từ khoá nằm trong tham số kiểu (`as Array<unknown> as Array<Đích>`).** Phải đi vào tham số của
  tham chiếu kiểu ở vế trong. Đóng được, nhưng phải quyết trước một câu hỏi luật mà luật chưa trả
  lời: xoá một phần tử của tập hợp có bằng xoá cả giá trị không? **Chưa đóng cho tới khi luật nói.**
- **Xoá mà không có cast nào (`const row: Đích = JSON.parse(text)`).** Không có nút cú pháp nào để
  báo. Chỉ đóng được bằng rule cần thông tin kiểu — loại rule đọc kiểu của biểu thức bên phải và từ
  chối gán dạng viết tắt vào một hình dạng cụ thể. Đó đúng là việc của rule được uỷ thác về dạng viết
  tắt, ở chế độ có kiểu. **Đóng bằng cấu hình của gói kia, không phải bằng gói này.**
- **Mọi thứ ngoài `/src/`.** Muốn đóng thì phải mở rộng phạm vi lint, và đó là quyết định của kho
  tiêu thụ về glob chứ không phải của rule. Nhắc lại nguyên tắc: **rule là luật, glob là nơi luật
  được áp.**
- **Chuỗi `/src/` khớp ở thư mục tổ tiên.** Phải so đường dẫn **tương đối với gốc kho** thay vì tìm
  chuỗi con. Đóng được, rẻ, và nó sửa một lỗi báo oan chứ không chỉ một lỗ — đáng làm cùng lượt với
  hai mục "nên đóng" ở trên.
- **Tên tệp dùng để thoát, và tên tệp gây báo oan.** Cùng một dòng lệnh. Muốn hẹp lại thì rule phải
  hỏi một câu mà cú pháp không trả lời được: *dựng một giá trị sai có phải việc của tệp này không?*
  Mô-đun rule đã cân nhắc và chọn đường dẫn, vì bản dựa trên phán đoán sẽ bị đem ra cãi lại ở từng
  nơi gọi. **Không đóng.** Cái giá được chấp nhận có ý thức, và được ghi ở đây để lần sau không phải
  cãi lại.
- **`TYPE-SAFETY-5` — mệnh đề lý do bên cạnh phép cast.** Một rule có thể đòi mọi `TSAsExpression`
  còn sống phải có comment trên cùng dòng hoặc dòng ngay trước. Máy làm được. Câu hỏi là nó **đo**
  được gì: sự tồn tại của một comment, không phải chất lượng của lý do. Một rule như thế sẽ sinh ra
  `// cast cần thiết` hàng loạt trong một tuần, và khi đó nó biến một cuộc kiểm tra thật thành một
  thủ tục. **Không đóng bằng lint; giữ ở tài liệu review.**
- **Số lượng báo cáo khi mới adopt.** Không phải một lỗ, nhưng là rủi ro vận hành mà mô-đun rule đã
  cảnh báo: một cast hai tầng thường đã gánh việc vào lúc có người để ý, và gỡ nó nghĩa là cho giá
  trị một hình dạng mà nó chưa có. Một kho có lịch sử nên coi mỗi báo cáo là một khoản việc thật, chứ
  không phải một lần sửa nhanh.

## Khi nào cần kiểm lại

- Mô-đun rule thêm, xoá hoặc đổi tên một rule.
- Một trong ba cửa được đánh dấu **nên đóng** (ngoặc nhọn, nút chen giữa, đường dẫn tương đối gốc
  kho) được đóng lại.
- Có đề xuất rule mới cho hàm `coerce` generic, hoặc cho `as never as` / `as {} as`.
- Luật trả lời được câu hỏi xoá-một-phần-tử-của-tập-hợp.
- Bộ plugin TypeScript đổi tên hoặc đổi hành vi của hai rule được uỷ thác.
- Có kho tiêu thụ báo rằng cổng `/src/` khớp nhầm ở thư mục tổ tiên trên máy thật.
- Xuất hiện một tệp dữ liệu mẫu bị báo oan lần thứ hai — một lần là cái giá đã biết, hai lần là một
  đề xuất đổi luật.
