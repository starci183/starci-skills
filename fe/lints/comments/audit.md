---
id: fe-lints-comments-audit
title: audit.md
slug: /fe/lints/comments/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức thực thi — rule giữ được bao nhiêu phần của luật, và cửa nào còn mở.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `comments`

Phản biện này hỏi đúng một câu: **luật `comments` được máy giữ tới đâu, và chỗ nào chỉ còn người giữ?**

Mọi kết luận dưới đây được lấy bằng cách chạy thật ba rule qua trình lint trên các đoạn mã dựng riêng,
không phải bằng cách đọc tên rule rồi suy ra.

## Kết luận

Chấp nhận có điều kiện. Ba rule tồn tại, tên rõ, mức `error`, và cả ba đều với xa hơn tên gọi của
chúng gợi ra — chúng đọc năm chỗ chữ có thể trốn chứ không chỉ đọc chú thích. Đó là thiết kế đúng.

Điều kiện là tài liệu này phải nói thẳng ba việc, và nó nói:

1. Luật có **sáu** mã; rule giữ **bốn**. `COMMENTS-5` và `COMMENTS-6` không có máy nào giữ.
2. `no-second-language-in-source` bắt **dấu**, không bắt **ngôn ngữ**. Cửa này rộng và không cần ai cố ý.
3. `no-emoji-in-source` cấm một **thuộc tính Unicode**, còn luật cấm một **hành vi**; hai đường biên
   không trùng nhau ở cả hai chiều — có thứ lọt, và có thứ bị báo oan.

**Số rule khớp với dự kiến: tệp nguồn publish đúng 3 rule** (`require-export-jsdoc`,
`no-second-language-in-source`, `no-emoji-in-source`), qua object `rules` ở cuối tệp. Không có rule
thứ tư nào bị bỏ sót, và không có rule nào được tài liệu này bịa thêm.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Rule tồn tại đúng số lượng | Đúng 3, đọc từ object `rules` |
| Mỗi rule trỏ được về một mã luật | 3/3, qua các dải chú thích `COMMENTS-n` ngay trên từng rule |
| Mỗi mã luật có rule giữ | 4/6. `COMMENTS-5`, `COMMENTS-6` trống |
| Danh tính rule là tên đã publish | Đúng. Tài liệu không đặt thêm mã số nào |
| Cơ chế phát hiện mô tả được bằng nút cú pháp cụ thể | Được, cho cả ba |
| Mỗi rule có ít nhất một cửa mở đã ghi | Có. Lần lượt 4, 9 và 4 cửa |
| Cửa mở được kiểm bằng chạy thật, không phải bằng suy luận | Có, toàn bộ |
| Ngoại lệ là đường dẫn chứ không phải phán đoán | Đúng, bảy mẫu đường dẫn, không có ngoại lệ theo nội dung |
| Ví dụ trong tài liệu không cần tên sản phẩm mới đọc được | Đúng |

## Phát hiện

1. **`COMMENTS-5` và `COMMENTS-6` hoàn toàn không có rule.** Một chú thích chép lại dòng bên dưới, và
   một chú thích cãi mà không nêu tên quyết định nó cãi, đều vô hình. Đây **không** phải chỗ để bịa ánh
   xạ cho gọn bảng: đo xem một câu có thêm thông tin so với dòng dưới nó hay không không phải việc của
   một lượt duyệt cây cú pháp. Ghi nhận là **cố ý không thực thi**, và trạng thái ấy an toàn hơn một
   rule giả vờ có giữ.

2. **`no-second-language-in-source` mang tên sai so với hành vi.** Nó là
   `no-precomposed-diacritic-letters-in-source`. Cùng một câu, gõ không dấu, lọt sạch. Nặng hơn: **chính
   ví dụ mà luật dùng để minh hoạ cái bẫy này** — một chú thích không dấu đặt trên một hàm — **không kích
   hoạt rule**. Và `patterns/comments.md` minh hoạ ngoại lệ chuỗi có chức năng bằng một chuỗi cũng không
   dấu, nên trong ví dụ ấy dấu `vn-ok:` chỉ có tác dụng với người đọc, không có tác dụng với máy.

3. **Chính mã nguồn đã tự thú một lần về chuyện này.** Khối chú thích trong rule ghi lại rằng trước khi
   phần đánh dấu theo dòng ra đời, một chuỗi mang dấu không cách nào được miễn, và *"fixture hợp lệ của
   chính rule chỉ qua được vì chuỗi của nó không mang dấu nào cả"*. Một bộ kiểm thử qua vì lý do sai là
   dấu hiệu mạnh nhất cho thấy phép thử đang đo nhầm thứ.

4. **Luật và rule mâu thuẫn ở dữ liệu ngôn ngữ.** `COMMENTS-4` viết rõ: không dùng ký tự tượng hình
   "trong source hay dữ liệu ngôn ngữ". Cổng đường dẫn của `no-emoji-in-source` lại miễn đúng dữ liệu
   ngôn ngữ. Nửa sau câu luật ấy không có ai giữ, và đây là mâu thuẫn giữa hai văn bản chứ không phải
   một lựa chọn cài đặt.

5. **Miễn trừ file test rộng hơn lý do biện minh cho nó.** Lý do được nêu là "một fixture tái hiện chuỗi
   thật phải tái hiện nguyên văn". Cài đặt lại miễn **cả file** `*.test.*` và `*.spec.*`, nên mọi chú
   thích, mọi tên biến trong file test đều nằm ngoài tầm — kể cả những thứ chẳng liên quan gì tới chuỗi
   dữ liệu.

6. **`require-export-jsdoc` chỉ đếm sự tồn tại.** `/** */` rỗng làm rule im. Một khối viết cho dòng
   `import` phía trên cũng làm rule im. Nửa quan trọng của `COMMENTS-1` — nói vai trò, đừng chép chữ ký —
   không có máy giữ, và tệ hơn: rule tạo ra một cách "sửa" rất rẻ mà không sửa gì.

7. **`require-export-jsdoc` không có cổng đường dẫn.** Hai rule kia miễn file fixture và file ngôn ngữ;
   rule này thì không. Bất đối xứng ấy có lý (một export trong fixture vẫn là một hợp đồng), nhưng nó
   không được nói ở đâu trong mã, nên rất dễ bị đọc thành thiếu sót.

8. **`no-emoji-in-source` báo nhầm ở dấu bản quyền, dấu đăng ký, dấu thương hiệu, dấu cảnh báo và ký hiệu
   điện thoại** — tất cả đều mang thuộc tính tượng hình mở rộng. Một dòng bản quyền ở chân trang sẽ bị
   bắt. Đây là chi phí đã biết, không phải lỗi, nhưng phải được viết ra để không ai sửa nhầm bằng cách
   nới rule.

## Quyết định

- Giữ đúng **ba** rule, gọi bằng **tên đã publish**, không đặt thêm mã số.
- Ánh xạ `require-export-jsdoc` → `COMMENTS-1`, `no-second-language-in-source` → `COMMENTS-2` (kèm phần
  cài đặt ngoại lệ của `COMMENTS-3`), `no-emoji-in-source` → `COMMENTS-4`.
- Ghi `COMMENTS-5` và `COMMENTS-6` là **không thực thi được bằng máy**, không bịa ánh xạ.
- Coi bảng "Open" trong `INDEX.md` là phần bắt buộc của mô-đun, ngang hàng với bảng rule. Một rule không
  có dòng nào trong bảng ấy phải kèm lập luận vì sao nó kín.
- Mọi khẳng định về hành vi rule trong mô-đun này phải lấy được bằng cách chạy rule, không bằng đọc tên.
- Không đề xuất sửa rule ở tài liệu này. Đây là tài liệu **thực thi**; đề xuất luật đi đường khác.

## Rủi ro còn mở

Mỗi rủi ro kèm câu trả lời cho đúng một câu hỏi: **rule phải soi thêm cái gì thì mới đóng được?**

### `require-export-jsdoc`

- **`export { … }`, `export * from`, `export … from` không bị kiểm.** Để đóng: rule phải theo tên trong
  `ExportSpecifier` ngược về khai báo gốc trong cùng file (và với re-export thì sang file khác), tức là
  cần phân giải phạm vi chứ không chỉ nhìn nút export. Đóng được trong cùng một file với chi phí vừa
  phải; qua nhiều file thì phải có thông tin toàn dự án, và giá đắt hơn nhiều so với thứ thu về.
- **`class`, `enum`, `export default <biểu thức>` nằm ngoài bốn loại.** Để đóng: thêm
  `ClassDeclaration`, `TSEnumDeclaration` và nhánh `ExportDefaultDeclaration` với `declaration` là biểu
  thức. Rẻ, gần như chỉ là mở rộng danh sách. Đây là cửa **nên đóng trước tiên**, vì một component viết
  dưới dạng arrow mặc định là hình dạng export phổ biến nhất của một giao diện.
- **Khối chú thích không bao giờ được đọc.** Để đóng một phần: bắt khối phải có ít nhất một câu, và
  khối phải dính liền export (không có dòng trắng xen giữa). Đóng hẳn thì phải phán đoán khối ấy có nói
  vai trò hay chỉ chép chữ ký — không đóng được bằng máy, và đó là ranh giới thật giữa lint và review.
- **Một khối gánh nhiều khai báo.** Để đóng: kiểm từng `VariableDeclarator` thay vì kiểm cả
  `VariableDeclaration`. Rẻ, nhưng sẽ đòi một khối cho mỗi hằng số trong những cụm hằng số vẫn quen viết
  chung — cần một quyết định về luật trước, không phải một sửa đổi rule.

### `no-second-language-in-source`

- **Chữ không dấu.** Để đóng: phải nhận diện **ngôn ngữ**, không phải nhận diện ký tự — tức một từ điển
  hoặc một mô hình n-gram, chấp nhận báo nhầm trên tên riêng, tên biến viết tắt và mã định danh. Chi phí
  cao và tỷ lệ báo nhầm sẽ khiến người ta tắt rule, mà một rule bị tắt thì bảo vệ đúng con số không.
  Kết luận: **không đóng bằng máy**; đây là việc của người review, và phải được nói ra thay vì được ngầm
  hiểu là đã có rule lo.
- **Chữ ở dạng tổ hợp.** Để đóng: chuẩn hoá chuỗi về dạng dựng sẵn trước khi thử, hoặc thêm dải dấu tổ
  hợp vào phép thử. **Rẻ, đáng đóng, và không kéo theo báo nhầm nào** — đây là cửa dễ đóng nhất trong cả
  mô-đun.
- **Hệ chữ khác.** Để đóng: thêm các dải chữ tương ứng. Rẻ về kỹ thuật, nhưng phải trả lời trước một câu
  hỏi về luật: rule này cấm **một** ngôn ngữ cụ thể, hay cấm **mọi thứ không phải tiếng Anh**? Tên rule
  hứa vế sau, phép thử làm vế trước.
- **Tên gọi bản ngữ tẩy sạch cả nút.** Để đóng: chỉ miễn phần chuỗi trùng đúng tên gọi ấy, rồi thử lại
  phần còn lại. Rẻ và không mất gì.
- **Dấu `vn-ok:` miễn cả dòng, và miễn cả thân template bắt đầu trên dòng ấy.** Để đóng: gắn dấu vào
  **nút** thay vì vào **dòng** — miễn đúng chuỗi đứng gần dấu nhất, và với template thì xét theo dòng
  của từng mảnh chứ không theo dòng bắt đầu của cả template. Vừa phải, và nên làm cùng lúc với việc bắt
  buộc phần lý do sau dấu phải có chữ.
- **File test được miễn trọn vẹn.** Để đóng: thu hẹp ngoại lệ trong file test xuống còn chuỗi ký tự,
  vẫn kiểm chú thích và tên định danh. Rẻ, nhưng sẽ lộ ra một khối lượng vi phạm tồn đọng — cần biết
  trước con số ấy rồi mới bật.
- **Giặt qua đường dẫn được miễn rồi import về.** Không đóng được ở mức một file: rule chỉ thấy một tên
  định danh. Đóng được ở mức dự án bằng cách hỏi "module nào được miễn mà lại được import từ mã sản
  phẩm", nhưng đó là một công cụ khác, không phải một rule lint.
- **Tên trong JSX.** Để đóng: duyệt thêm `JSXIdentifier`. Rẻ; giá trị thu về nhỏ nhưng khác không.
- **Chuỗi do chương trình dựng ra.** Không đóng được. Muốn đóng thì phải chạy chương trình.

### `no-emoji-in-source`

- **Chuỗi kiểu phím số.** Để đóng: thêm một phép thử cho dấu bao ô vuông đứng sau một chữ số hoặc dấu
  thăng, có hoặc không có ký tự chọn biến thể. Rẻ và chính xác.
- **Hình vẽ không mang thuộc tính tượng hình mở rộng** (sao, mũi tên, chấm đầu dòng, ký tự vẽ khung).
  Để đóng: chuyển từ "thuộc tính Unicode" sang một danh sách cấm do người viết ra, và bảo trì nó. Đóng
  được, nhưng đổi bản chất rule từ một phép thử khách quan sang một danh sách phải cãi nhau từng dòng —
  và luật thì đang cấm *hành vi hiển thị khác nhau giữa các nền tảng*, mà ngôi sao thì không có hành vi ấy.
  Nghiêng về **không đóng**, và nói rõ trong tài liệu rằng ranh giới là thuộc tính chứ không phải hình.
- **Dữ liệu ngôn ngữ.** Để đóng: bỏ cổng đường dẫn **chỉ cho rule emoji**, giữ nguyên cho rule ngôn ngữ.
  Rẻ, và nó làm rule khớp lại với câu chữ của `COMMENTS-4`. Đây là mâu thuẫn nên được xử, nhưng phải xử
  ở tầng luật vì hai văn bản đang nói khác nhau.
- **Mảnh rời** (một ký tự chỉ vùng đơn lẻ, một dấu chỉnh tông màu da đơn lẻ). Để đóng: thử cả từng ký tự
  chỉ vùng đơn lẻ và dải dấu chỉnh tông. Rẻ, giá trị thấp, và có nguy cơ báo nhầm ở mã xử lý ngôn ngữ.

### Chung cho cả ba

- **Một dòng tắt rule ở đầu file gỡ bỏ mọi thứ trên đây.** Không đóng được ở tầng rule; chỉ đóng được
  bằng một cổng ở tầng cấu hình, cấm dòng tắt rule không kèm lý do.
- **File nằm ngoài phạm vi lint thì rule không tồn tại.** Điều này quyết định ở cấu hình của từng kho mã,
  không ở đây — nhưng nó là giả định ngầm của mọi câu khẳng định trong mô-đun này.

## Khi nào cần kiểm lại

- Tệp nguồn thêm, bỏ hoặc đổi tên một rule.
- Danh sách bảy mẫu đường dẫn miễn trừ thay đổi.
- Lớp ký tự của rule ngôn ngữ, hoặc hai phép thử của rule emoji, được sửa.
- Một cửa mở trong tài liệu này được đóng, hoặc một cửa mới được tìm ra.
- `patterns/comments.md` thêm mã luật mới, hoặc sửa `COMMENTS-4` ở phần dữ liệu ngôn ngữ.
- Một kho mã bật ba rule này lần đầu và con số báo về khác hẳn dự đoán "hai rule kia thường đã sạch sẵn".
- Xuất hiện một trường hợp lint xanh mà review vẫn bắt được vi phạm — đó là một cửa chưa có tên.
