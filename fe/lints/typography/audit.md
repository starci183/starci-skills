---
id: fe-lints-typography-audit
title: audit.md
slug: /fe/lints/typography/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức thực thi của luật typography — máy giữ được mã nào, và chỗ nào còn hở.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `typography`

Bài phản biện này không hỏi văn bản luật có đúng không. Nó hỏi **máy có giữ được luật không**, và
nếu không thì hở ở đâu.

## Kết luận

Chấp nhận, kèm bốn nhận định phải ghi ra chứ không được làm gọn.

Mô-đun luật công bố **một** luật, đúng bằng con số dự kiến. Đếm từ bảng `rules` xuất ra ở cuối tệp:
đúng một khoá, `no-heading-tag-outside-heading-component`. Luật đó được ghi ở đây, và không luật nào
khác được ghi.

Luật này giữ **hai** mã, bằng hai thông điệp: `tag` giữ `TYPESET-1`, `tooDeep` giữ `TYPESET-2`. Cả
hai ánh xạ đều đọc thẳng ra từ câu chữ của thông điệp; không mã nào bị bịa ra để khớp, và luật không
bị đặt thêm số định danh.

Bảy mã còn lại trong văn bản luật — `TYPESET-3` tới `TYPESET-9` — không có luật nào ở mô-đun này
giữ. Đó là phát hiện lớn nhất của bài này, và nó nằm ở mục "Rủi ro còn mở", không phải ở bảng luật.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Đếm số luật công bố | 1 — trùng dự kiến. Nguồn là bảng `rules` xuất ra cuối mô-đun |
| Luật có ánh xạ được vào mã trong văn bản luật không | Có, và ánh xạ **hai** mã: `TYPESET-1` qua `tag`, `TYPESET-2` qua `tooDeep` |
| Có mã nào bị bịa ra để khớp không | Không. Chỗ không có luật giữ thì ghi thành rủi ro, không ghi thành ánh xạ |
| Luật có được đặt thêm số định danh không | Không. Danh tính là tên công bố |
| Tên luật có tả đúng hành vi thật không | Gần đúng, nhưng thiếu một vế. Xem Findings §2 |
| Luật có ít nhất một cửa mở thật không | Có, mười hai hàng. Không có mục nào ghi "không có" cho gọn |
| Miễn trừ có đóng theo cặp (tệp + giá trị) không | **Không.** Cả hai miễn trừ đều chỉ theo tệp. Xem Findings §3 |
| Phát hiện có phụ thuộc phân giải mô-đun hay kiểu không | Không. Thuần cú pháp, nên nhanh và nên dễ lách bằng cách đổi hình dạng cú pháp |
| Cổng tệp chạy ở đâu | Trong `create`, một lần cho mỗi tệp. Tệp ngoài phạm vi không nhận luật im — nó không nhận luật |
| Hai nhánh thông điệp có phân định được không | Có, bằng đúng một phép so: `Number(tag.slice(1)) > 4` |

## Phát hiện

1. **Một luật, hai mã, và đó là điều đúng đắn.** Việc gộp `TYPESET-1` và `TYPESET-2` vào một luật
   không phải sự lười: cả hai chỉ có thể phát hiện được ở cùng một nút, bằng cùng một phép lấy tên
   thẻ, và tách làm hai luật sẽ khiến một tệp bị quét hai lần cho cùng một tập nút. Cái phải ghi ra
   là **thông điệp** mới là đơn vị mang mã, không phải luật. Ai lọc log theo tên luật sẽ trộn lẫn
   một vấn đề quyền sở hữu với một vấn đề cấu trúc.
2. **Tên luật hứa nhiều hơn thứ nó giữ.** `no-heading-tag-outside-heading-component` nghe như "không
   thẻ tiêu đề nào ngoài chiếc lá". Thực tế nó là "không thẻ tiêu đề nào **viết bằng cú pháp JSX với
   tên viết thường** ngoài chiếc lá, tệp kiểm thử, và mọi thứ ngoài `/src/`". Ba vế bị nuốt trong
   cái tên, và vế đầu là vế nguy nhất: một biến viết hoa giữ chuỗi `"h2"` làm luật biến mất hoàn
   toàn, trong khi tên luật vẫn khẳng định điều ngược lại.
3. **Hai miễn trừ đều là miễn trừ theo tệp, không phải theo cặp.** Kệ này ở các mô-đun khác đòi mỗi
   miễn trừ phải đóng thành cặp — một tệp **và** một giá trị. Ở đây, thư mục chiếc lá được miễn trừ
   cho **mọi** thẻ và mọi tệp con, và mọi tệp kiểm thử được miễn trừ cho mọi thẻ. Đây là dạng miễn
   trừ yếu hơn, và nó phải được đọc như vậy chứ không được ghi cho gọn thành "có miễn trừ".
4. **Cổng chiếc lá dùng `includes`, không dùng phép so đuôi.** Các luật ở mô-đun khác so **đuôi**
   đường dẫn, tức là nhắm vào một tệp. Luật này so **chuỗi con** một đoạn thư mục, tức là nhắm vào
   một cây. Hệ quả: mọi tệp phụ trợ, mọi thư mục con, mọi tệp viết trong tương lai dưới thư mục đó
   đều tự do — và một thư mục thứ hai trùng hình dạng đường dẫn cũng vậy. Rộng hơn ý định, và ý định
   thì viết rõ trong chú thích: "thành phần **duy nhất** sở hữu thẻ và cỡ cùng lúc".
5. **Luật chỉ giữ một trong hai cách một tiêu đề bị dựng tay.** Chính mô-đun luật nói ra điều này:
   luật sinh đôi bắt tiêu đề lắp từ cỡ to cộng độ đậm nặng, và nó sống ở mô-đun luật khác. Cặp này
   phủ được "đúng thẻ, sai dáng" và "đúng dáng, không thẻ" — nhưng khe giữa hai luật là có thật và đo
   được: luật kia đòi cỡ từ `text-xl` trở lên **và** độ đậm từ `font-bold` trở lên. Một
   `<div className="text-lg font-semibold">` dùng làm tiêu đề đi lọt cả hai.
6. **Không có báo thừa nào đáng kể, và điều đó đáng nghi ngờ hơn là đáng mừng.** Luật không đọc
   thuộc tính, không lần theo câu nhập, không hỏi kiểu, nên nó gần như không thể báo nhầm. Cái giá
   trả cho độ chính xác đó nằm nguyên vẹn ở phía bỏ sót. Trường hợp gần với báo thừa nhất là một
   `<h2 className="sr-only">` — và đó không phải báo thừa, vì một tiêu đề ẩn vẫn là một dòng dàn ý
   thật.

## Quyết định

- **Ghi đúng một luật đang tồn tại.** Một luật đáng lẽ nên có mà chưa có thì không được ghi ở đây;
  nó nằm dưới "Rủi ro còn mở". Luật cao nhất của kệ này: thứ không chỉ tay vào được là một đề nghị,
  không phải một luật.
- **Danh tính là tên công bố.** Không đặt số cho luật. Tên đã là chuỗi in ra trong log build và
  chuỗi viết trong dòng tắt luật; đặt thêm số là cho một luật hai tên và mất khả năng biết thông
  điệp đến từ đâu.
- **Ghi cả hai mã cho một luật, và ghi rõ mã đi theo thông điệp.** Không chọn một mã "chính" cho
  gọn, vì hai thông điệp yêu cầu hai hành động khác hẳn nhau: một cái đổi cách gọi, một cái đổi cấu
  trúc trang.
- **Giữ nguyên đường dẫn tệp và hậu tố trong bảng phát hiện và trong ví dụ.** Chúng là dữ kiện chịu
  lực của phép phát hiện; thay bằng tên giả sẽ làm bảng phát hiện vô dụng và ví dụ sai.
- **Không ghi "không có cửa mở".** Luật duy nhất của mô-đun này có mười hai hàng thật trong bảng
  **Open**, và hàng đầu tiên — thẻ động — quan trọng hơn phần còn lại cộng lại.
- **Không ghi luật sinh đôi ở kệ này.** Nó thuộc mô-đun luật khác và được ghi ở kệ của mô-đun đó.
  Chỉ khe giữa hai luật được ghi ở đây, vì khe đó là thứ không kệ nào khác chịu trách nhiệm.

## Rủi ro còn mở

Mỗi mục dưới đây là một cửa còn mở, kèm thứ mà luật sẽ phải soi thêm để đóng nó — hoặc lý do đóng nó
đắt hơn giá trị nó mang lại.

- **Thẻ động qua một biến viết hoa.** `const Tag = "h2"` rồi `<Tag>`. Để đóng: khi tên thẻ là một
  `JSXIdentifier` viết hoa, lần ngược lên phần khai báo trong cùng phạm vi và kiểm xem giá trị khởi
  tạo có phải một chuỗi thẻ tiêu đề, hoặc một template có phần đầu là `h`. Việc lần theo phạm vi là
  việc thật nhưng dùng lại được cho nhiều luật. **Đây là hàng đáng làm nhất trong cả bảng**, vì viết
  hoa là cách **duy nhất** để dùng một thẻ nội tại tính được trong JSX — nghĩa là cách tự nhiên nhất
  để đổi bậc tiêu đề theo biến rơi đúng vào điểm mù của luật.
- **`createElement` và mọi hàm nhận tên thẻ.** Để đóng: duyệt thêm `CallExpression` có tên
  `createElement` và kiểm đối số đầu là một chuỗi thẻ tiêu đề. Rẻ, và phủ được phần lớn mã sinh tự
  động. Phần còn lại — một hàm tự viết nhận tên thẻ — thì cú pháp không đóng được.
- **HTML đổ vào bằng chuỗi.** `dangerouslySetInnerHTML`, nội dung lấy từ hệ thống quản trị nội dung,
  và markup lưu trong dữ liệu. Để đóng: không đóng được bằng lint. Dàn ý sinh ra từ dữ liệu phải
  được kiểm ở tầng khác — lúc dựng nội dung, hoặc bằng một phép kiểm trên trang đã dựng xong.
- **Markdown và MDX.** `## Tiêu đề` thành `h2` lúc build, không tệp nguồn nào có thẻ. Để đóng: cần
  một luật ở tầng đường ống nội dung chứ không phải ở tầng cú pháp JSX. Chi phí là mở một tầng thực
  thi mới, nên phải cân trước.
- **Mọi thứ ngoài `/src/`.** Thư mục định tuyến, thư mục tài liệu, một gói cạnh bên: luật không được
  lắp. Để đóng: bỏ cổng `/src/` cứng trong luật và thay bằng danh sách loại trừ trong cấu hình, để
  phạm vi do kho tiêu thụ quyết. Đây là thay đổi cấu hình chứ không phải thay đổi luật, và nó thuộc
  về kho tiêu thụ.
- **Miễn trừ tệp kiểm thử không có biên.** Mọi tệp `.test.tsx`/`.spec.tsx` ở bất kỳ đâu đều được viết
  thẻ tiêu đề tuỳ ý. Để đóng: buộc miễn trừ thành cặp — tệp kiểm thử **cạnh** chiếc lá tiêu đề. Rẻ,
  và nó khôi phục đúng nguyên tắc mà các miễn trừ ở những mô-đun khác đang tuân theo.
- **Cổng chiếc lá là chuỗi con của một đoạn thư mục.** Mọi tệp dưới thư mục đó, mọi thư mục con, và
  một chiếc lá thứ hai trùng hình dạng đường dẫn đều được tự do. Để đóng: so đúng một đường dẫn tệp,
  hoặc neo từ gốc kho, hoặc kiểm thêm rằng chỉ tồn tại **một** đường dẫn khớp. Neo từ gốc kho làm
  luật phụ thuộc bố cục thư mục của từng kho, nên chi phí thật là luật hết dùng lại được — cần cân
  trước khi đổi.
- **`JSXMemberExpression`.** `<Tags.h2>` giặt sạch cả sáu thẻ bằng một object. Để đóng: nhận thêm
  `JSXMemberExpression` và kiểm phần thuộc tính cuối có nằm trong tập sáu thẻ không. Rẻ và không có
  rủi ro báo nhầm đáng kể.
- **Tiêu đề khai bằng ARIA.** `<div role="heading" aria-level={2}>` tạo ra đúng dòng dàn ý mà luật
  đang bảo vệ. Để đóng: báo mọi `JSXAttribute` `role` có giá trị `"heading"` ở ngoài chiếc lá. Rẻ,
  và nó bịt đúng cái cách mà một người **đã đọc luật** sẽ nghĩ ra để lách máy.
- **Khe giữa luật này và luật sinh đôi.** `text-lg font-semibold` trên một thẻ thường là một tiêu đề
  không có dàn ý mà cả hai luật đều im. Để đóng: hạ ngưỡng của luật sinh đôi xuống, hoặc thêm một
  phép thử ghép cỡ-với-độ-đậm theo thang thật. Chi phí là báo nhầm tăng mạnh, vì `font-semibold` là
  độ đậm hợp lệ của nhiều thứ không phải tiêu đề — nên đây là một **đề nghị thay đổi luật**, không
  phải một lần siết cấu hình.
- **`TYPESET-2` không được giữ ở phía thành phần.** Thông điệp về độ sâu chỉ tồn tại cho thẻ viết
  tay. Một bậc bị đẩy quá bốn qua một biến đã nới kiểu hoặc một phép ép kiểu thì tập đóng thua, và
  không có gì khác đứng canh. Để đóng: một luật đọc `level` trên chỗ gọi thành phần tiêu đề và báo
  khi giá trị không phải một literal nằm trong bốn bậc. Chưa tồn tại, nên chỉ được ghi ở đây.
- **`TYPESET-3` — thứ bậc không đến từ cái hộp.** Không luật nào giữ. Để đóng bằng cú pháp thì cần
  biết một đường viền hay một nền được vẽ ra **để nhấn mạnh** hay vì lý do khác, mà cú pháp không
  phân biệt được. Đây là luật cho người đọc, không phải cho máy.
- **`TYPESET-4` — làm dịu hàng xóm thay vì hô to.** Không luật nào giữ, và không thể giữ: nó nói về
  **quan hệ** giữa một dòng với những dòng quanh nó, thứ chỉ tồn tại trong bản dựng cuối chứ không
  tồn tại trong một tệp.
- **`TYPESET-5` và `TYPESET-8` — dòng phụ xếp dưới tiêu đề, và mốc thời gian là phụ đề.** Không luật
  nào giữ. Một luật cú pháp có thể so hai anh em trực tiếp trong cùng một tệp và báo khi dòng sau to
  hơn hoặc nặng hơn dòng trước — nhưng nó sẽ mù ngay khi hai dòng nằm ở hai tệp, và đó là bố cục phổ
  biến. Giá trị thu được nhỏ hơn chi phí báo nhầm.
- **`TYPESET-6` — không đẩy độ đậm lên tiêu đề.** Không luật nào ở mô-đun này giữ; văn bản luật giao
  cho tập đóng trên thành phần tiêu đề. Để đóng phần còn lại: báo khi một `className` mang
  `font-*` xuất hiện trên chính chỗ gọi thành phần tiêu đề. Rẻ, và đây là ứng viên tốt nhất trong ba
  mã chưa có máy giữ nhưng đóng được bằng cú pháp.
- **`TYPESET-7` — bậc chữ nhỏ luôn đi với tông dịu.** Văn bản luật nói tập kiểu của thành phần chữ
  đã ghép sẵn cỡ với tông. Phần không được giữ là cùng bậc đó viết bằng lớp thô trên một thẻ thường:
  `text-xs` đứng một mình. Để đóng: báo mọi `className` chứa `text-xs` mà không chứa lớp tông dịu.
  Rẻ, và nó khớp đúng cách một mô-đun luật khác đã đọc chuỗi lớp.
- **`TYPESET-9` — thứ bậc tiêu đề nội dung theo quyền sở hữu nội dung.** Không luật nào giữ, và
  không đóng được: "tiêu đề chi phối của một đối tượng quan trọng" là một dữ kiện nghiệp vụ, không
  phải một dữ kiện cú pháp. Ghi lại như một rủi ro thường trực để không ai tưởng lint xanh nghĩa là
  thứ bậc đúng.

## Khi nào cần kiểm lại

- Bảng `rules` xuất ra thêm, bớt hoặc đổi tên một luật.
- Một thông điệp được thêm, bớt hoặc tách ra khỏi luật hiện có — vì mã luật đi theo **thông điệp**,
  không đi theo tên luật.
- Hằng `DEEPEST_LEVEL` đổi giá trị, hoặc thang bậc trong văn bản luật đổi số bậc.
- Một mã `TYPESET-<n>` được thêm, bỏ hoặc viết lại trong văn bản luật.
- Tập `HEADING_TAGS`, cổng `/src/`, mẫu tên tệp kiểm thử, hoặc đoạn đường dẫn chiếc lá bị sửa.
- Luật sinh đôi ở mô-đun luật khác đổi ngưỡng cỡ hoặc ngưỡng độ đậm — khe giữa hai luật đổi theo, và
  mục tương ứng ở đây phải đo lại.
- Một cửa mở ở trên được đóng lại: khi đó bảng **Open** trong `INDEX.md` phải mất đúng hàng đó, và
  bảng **Closed** phải mọc lên đúng hàng ấy.
- Một kho tiêu thụ hạ mức nghiêm của luật này xuống dưới `error`.
