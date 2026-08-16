---
id: fe-lints-icon-audit
title: audit.md
slug: /fe/lints/icon/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức thực thi của luật biểu tượng — luật nào giữ được mã nào, và chỗ nào còn hở.
---

# audit.md

> Phiên bản: `2.00` · Mô-đun: `icon`

Bài phản biện này không hỏi luật văn bản có đúng không. Nó hỏi **máy có giữ được luật không**, và
nếu không thì hở ở đâu.

## Kết luận

Chấp nhận, kèm ba nhận định phải ghi ra chứ không được làm gọn.

Mô-đun luật công bố **năm** luật, đúng bằng con số dự kiến. Cả năm đều được ghi ở đây. Bốn trong năm
ánh xạ được vào một mã trong văn bản luật; luật thứ năm ánh xạ vào một mã mà văn bản luật dùng để nói
chuyện khác. Không luật nào bị bịa thêm mã, và không mã nào được bịa ra để khớp với một luật.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Đếm số luật công bố | 5 — trùng dự kiến. Nguồn là bảng `rules` xuất ra cuối mô-đun |
| Mỗi luật có ánh xạ được vào một mã không | 4/5. `rank-artwork-is-a-closed-set` đề `ICON-11`, nhưng `ICON-11` trong luật nói về cỡ hình trong ô hình |
| Có mã nào bị bịa ra để khớp không | Không. Chỗ không khớp được ghi thành phát hiện |
| Có luật nào được đặt thêm số định danh không | Không. Danh tính là tên công bố |
| Mỗi luật có ít nhất một cửa mở thật không | Có, cả năm. Không luật nào được ghi "không có" cho gọn |
| Miễn trừ có đóng theo cặp (tệp + giá trị) không | Có, cả ba miễn trừ nhập/tranh giải. Miễn trừ tệp kiểm thử thì **không** — nó chỉ theo tên tệp |
| Phát hiện có phụ thuộc phân giải mô-đun hay kiểu không | Không. Thuần cú pháp, nên nhanh và nên dễ lách bằng cách đổi hình dạng cú pháp |
| Tên luật có tả đúng hành vi thật không | 4/5. `no-off-scale-glyph-size` không hề biết cái nó đo có phải hình hay không |

## Phát hiện

1. **Một luật trỏ vào mã mà văn bản luật không có.** Mô-đun đề `ICON-11` cho
   `rank-artwork-is-a-closed-set`, và hai luật nhập cùng bỏ qua một nhánh miễn trừ dưới nhãn đó.
   Trong văn bản luật, `ICON-11` nói mọi ô hình đều mang hình vai trò dẫn dắt ở cỡ năm. Toàn bộ lập
   luận về tranh giải — thêm một gói, thêm một tệp, bốn định danh — chỉ sống trong chú thích của mô-đun
   luật. Hệ quả: một người đọc thông điệp lỗi, tra mã, rồi đọc một câu chẳng liên quan. Đây là phát
   hiện, không phải chỗ để ghi bừa một ánh xạ.
2. **Một luật hẹp hơn mã nó giữ.** `no-off-scale-glyph-size` đứng dưới `ICON-1`, vốn chốt ba vai trò
   ở ba cỡ. Luật không kiểm vai trò, và cũng không kiểm xem thứ đang được đo có phải hình không.
   Phần "vai trò nào đi với cỡ nào" — tức `ICON-2`, `ICON-3`, `ICON-4` — không có máy nào giữ.
3. **Một bộ từ vựng được xuất ra mà không luật nào đọc.** Tập định danh phản ứng được khai báo và
   `export`, nhưng không luật nào tham chiếu tới nó. `ICON-13` vì thế có văn bản, có kiểu, có hằng —
   và không có thực thi.
4. **Chú thích mức nghiêm đã cũ.** Đoạn giải thích `recommended` nói "cả hai luật đều chính xác",
   trong khi bảng `rules` có năm. Câu chữ còn đúng về tinh thần, nhưng con số thì không.
5. **Một câu nhập sai từ tệp thường bị báo hai lần.** Luật nhà cung cấp không bỏ qua tệp thường, nên
   nó chồng lên luật chỗ gọi. Đây là chủ ý và có ích — hai thông điệp nói hai chuyện khác nhau —
   nhưng nó phải được ghi ra, nếu không người đọc log sẽ tưởng cấu hình bị lặp.
6. **`import type` bị báo.** Một câu nhập chỉ lấy kiểu không đóng gói gì ra, nhưng vẫn là
   `ImportDeclaration` nên vẫn nổ. Đây là báo thừa chứ không phải escape, và nó rẻ hơn nhiều so với
   rủi ro ngược lại.

## Quyết định

- **Ghi đúng năm luật đang tồn tại.** Một luật đáng lẽ nên có mà chưa có thì không được ghi ở đây;
  nó nằm dưới "Rủi ro còn mở". Luật cao nhất của kệ này: thứ không chỉ tay vào được là một đề nghị,
  không phải một luật.
- **Danh tính là tên công bố.** Không đặt số cho luật. Tên đã là chuỗi in ra trong log build và chuỗi
  viết trong dòng tắt luật; đặt thêm số là cho một luật hai tên và mất khả năng biết thông điệp đến
  từ đâu.
- **Giữ nguyên chính tả mọi định danh**, kể cả khi nó mang tên một sản phẩm. Lệnh cấm tên sản phẩm áp
  vào **câu chữ** và **ví dụ**, không áp vào chuỗi mà bản build in ra.
- **Giữ tên gói và đường dẫn tệp trong bảng phát hiện và trong ví dụ.** Chúng là dữ liệu chịu lực của
  phép phát hiện; thay bằng tên giả sẽ làm bảng phát hiện vô dụng và ví dụ sai.
- **Không luật nào được ghi "không có cửa mở".** Cả năm đều có ít nhất một hàng thật.

## Rủi ro còn mở

Mỗi mục dưới đây là một cửa còn mở, kèm thứ mà luật sẽ phải soi thêm để đóng nó — hoặc lý do đóng nó
đắt hơn giá trị nó mang lại.

- **Nhập không phải `ImportDeclaration`.** `require()`, `import()` động và `export … from` đều lọt.
  Để đóng: duyệt thêm `ImportExpression`, `ExportNamedDeclaration`/`ExportAllDeclaration` có `source`,
  và `CallExpression` tên `require`. Rẻ, và nên làm — ba nút, cùng một phép thử chuỗi đã có.
- **Mọi thứ ngoài `/src/`.** Đây là cửa rộng nhất trên kệ: một tệp ở thư mục gói khác nhập tự do rồi
  xuất lại dưới cái tên trung tính, và cả hai luật nhập đều không được lắp. Để đóng: bỏ cổng `/src/`
  và thay bằng danh sách loại trừ trong cấu hình, để phạm vi do kho tiêu thụ quyết chứ không do một
  chuỗi cứng trong luật. Đây là thay đổi cấu hình chứ không phải thay đổi luật, và nó thuộc về kho
  tiêu thụ.
- **Cổng đường dẫn là phép so đuôi.** Bất kỳ thư mục nào kết thúc bằng `leaves/Icon/index.tsx`,
  `leaves/RankMark/index.tsx` hay `composites/LabelledProgressRow/index.tsx` đều nhận nguyên quyền của
  bản gốc. Để đóng: neo đường dẫn từ gốc kho, hoặc kiểm thêm rằng chỉ tồn tại **một** tệp khớp. Việc
  neo từ gốc kho làm luật phụ thuộc bố cục thư mục của từng kho, nên chi phí thật nằm ở chỗ luật hết
  dùng lại được — cần cân trước khi đổi.
- **Cỡ nguyên lệch thang.** `size-9` và `size-3` đi lọt. Để đóng: liệt kê tập cỡ hợp lệ và báo mọi
  `size-` khác. Chi phí là báo nhầm, vì luật không phân biệt được hình với ảnh đại diện hay ô vuông —
  và nó **đã** báo nhầm ở dạng ngoặc vuông rồi.
- **Luật cỡ không có ngữ cảnh hình.** Nó đo một tiện ích, không đo một hình. Để đóng: chỉ soi những
  thuộc tính lớp nằm trên thẻ mà luật nhận ra là hình, hoặc chỉ soi bên trong chiếc lá. Cách đó bỏ
  sót đúng chỗ mà cỡ lệch hay xuất hiện nhất — tại chỗ gọi — nên đổi lại là **thu hẹp** thực thi, và
  không nên làm chỉ để hết báo nhầm.
- **Chuỗi lớp trong object, mảng và hàm nối lớp.** Cách gọn gàng nhất để cất chuỗi lớp là cách mù
  nhất. Để đóng: rút chuỗi tĩnh ra từ `Property`, từ phần tử mảng, và từ đối số chuỗi của lời gọi
  hàm. Rẻ và có giá trị cao, vì đây là kiểu giặt literal phổ biến nhất và nó **không phải phá hoại**
  — nó là người đang dọn dẹp.
- **Template có biểu thức.** Cỡ nội suy và định danh tranh giải ghép chuỗi đều lọt. Để đóng với luật
  tranh giải: kiểm cả `TemplateLiteral` có phần đầu mang tiền tố bộ sưu tập, và báo vì một định danh
  ghép động không thể chứng minh là thuộc tập đóng. Đây là hàng đáng làm nhất trong bảng, vì ghép
  chuỗi đúng là cách tự nhiên nhất để viết một bản đồ hạng-sang-tranh.
- **Chỉ một tiền tố bộ sưu tập được nhận ra.** Một tấm huy chương từ bộ sưu tập khác trong cùng
  catalog lọt cả trong lẫn ngoài chiếc lá. Để đóng: so bằng danh sách trắng bốn định danh cho mọi
  chuỗi có dạng `<bộ-sưu-tập>:<tên>`, thay vì lọc trước bằng một tiền tố.
- **Miễn trừ theo tên tệp kiểm thử không có biên.** Mọi tệp `.test.tsx` ở bất kỳ đâu đều được gọi tên
  bất kỳ định danh nào. Để đóng: buộc miễn trừ thành cặp — tệp kiểm thử **cạnh** chiếc lá xếp hạng.
  Rẻ, và nó khôi phục đúng nguyên tắc mà mọi miễn trừ khác trên kệ đang tuân theo.
- **Luật ô số liệu chỉ giữ một tệp.** Luật văn bản nói chung cho mọi ô dữ kiện gọn; máy giữ đúng một
  ô. Ô thứ mười viết tuần sau nằm ngoài theo mặc định. Để đóng: cần một dấu hiệu nhận ra "ô dữ kiện
  gọn" mà không cần liệt kê tên tệp — hiện chưa có dấu hiệu nào như vậy, nên chi phí là mở một khái
  niệm mới trong luật chứ không phải viết thêm mã.
- **Tên thẻ phải đúng chữ.** Bí danh lúc nhập, gọi qua thuộc tính của object, và thành phần tự vẽ hình
  bên trong đều lọt. Để đóng: lần theo phần nhập để biết tên cục bộ nào trỏ về chiếc lá, và duyệt cả
  `JSXMemberExpression`. Phần lần theo phần nhập là việc thật, nhưng nó dùng lại được cho nhiều luật.
- **Gói hình không mang dấu hiệu tên.** Các gói pictogram, emoji và mark thường không chứa sáu chuỗi
  nhận dạng nào. Để đóng: không có cách đóng bằng cú pháp — danh sách phải được nuôi. Ghi lại như một
  rủi ro thường trực, và nhớ rằng bài học mở đầu mô-đun luật chính là câu này: một luật gọi tên một
  nhà cung cấp thì bảo vệ đúng nhà cung cấp đó.
- **`ICON-13` không có luật nào giữ.** Tập định danh phản ứng được xuất ra và không ai đọc. Để đóng:
  một luật báo khi có emoji Unicode hoặc đường dẫn ảnh được truyền vào chỗ đáng lẽ nhận một định danh
  phản ứng. Chưa tồn tại, nên không được ghi ở kệ này ngoài mục này.
- **`ICON-5`, `ICON-8`, `ICON-9`, `ICON-12` không có luật nào giữ.** Màu kế thừa, không co, tính đồng
  bộ của bảng ý nghĩa, và việc hình phải phân biệt được các mục ngang hàng — cả bốn đều là luật đã
  công bố mà không có máy nào giữ. Ba cái đầu đóng được bằng cú pháp; cái cuối cần biết ngữ cảnh
  quanh một hàng, mà lint không có.

## Khi nào cần kiểm lại

- Bảng `rules` xuất ra thêm, bớt hoặc đổi tên một luật.
- Một mã `ICON-<n>` được thêm, bỏ hoặc viết lại trong văn bản luật — đặc biệt là `ICON-11`, vốn đang
  bị hai nơi dùng cho hai chuyện.
- Một tệp mới được thêm vào danh sách miễn trừ, hoặc một miễn trừ mất vế giá trị và chỉ còn vế tệp.
- Danh sách tiền tố gói hoặc mẫu tên gói được nới ra.
- Một cửa mở ở trên được đóng lại: khi đó bảng **Open** trong `INDEX.md` phải mất đúng hàng đó, và
  bảng **Closed** phải mọc lên đúng hàng ấy.
- Một kho tiêu thụ hạ mức nghiêm của bất kỳ luật nào xuống dưới `error`.
