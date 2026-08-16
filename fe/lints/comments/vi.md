---
id: fe-lints-comments-vi
title: vi.md
slug: /fe/lints/comments/vi
sidebar_label: vi.md
sidebar_position: 1
description: Ba rule của luật comments — bắt gì, phát hiện bằng cách nào, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `comments`

Ba rule dưới đây giữ luật `comments`. Chúng không giữ hết luật, và chỗ chúng **không** với tới mới là
phần đáng đọc kỹ nhất của tài liệu này.

Một điều cần nói ngay: **tên rule chính là danh tính của nó.** Không có mã số riêng nào được đặt thêm.
Cái tên là thứ hiện ra trong log build, là thứ viết trong dòng tắt rule, và là thứ người ta gọi khi
tranh luận về một lỗi. Đặt thêm một mã số nghĩa là một rule có hai tên, và rồi không ai biết thông báo
lỗi vừa rồi đến từ tên nào.

## Bảng tra nhanh

| Rule | Mã luật | Bắt gì |
|---|---|---|
| `require-export-jsdoc` | `COMMENTS-1` | Một khai báo được export mà phía trên không có khối chú thích `/** … */` |
| `no-second-language-in-source` | `COMMENTS-2`, và cài đặt các ngoại lệ của `COMMENTS-3` | Chữ có dấu của ngôn ngữ thứ hai nằm trong chú thích, tên biến, chuỗi, mảnh template hoặc chữ JSX |
| `no-emoji-in-source` | `COMMENTS-4` | Ký tự tượng hình mở rộng, hoặc một cặp ký tự chỉ vùng, ở đúng năm chỗ ấy |
| *(không có rule)* | `COMMENTS-5`, `COMMENTS-6` | Không gì cả — xem `audit.md` |

---

## `require-export-jsdoc`

**Bắt gì.** Một khai báo được export mà ngay trước nó không có khối chú thích nào bắt đầu bằng dấu `*`.
Thông báo lỗi gọi thẳng tên cái được export và nhắc: hãy nói **vai trò** của nó, đừng chép lại chữ ký —
chữ ký đã tự nói rồi.

**Giữ mã nào.** `COMMENTS-1`, và chỉ giữ được **một nửa**. Nửa "phải có khối chú thích" thì máy kiểm
được. Nửa "khối ấy phải nói vai trò chứ không chép chữ ký" thì không: đánh giá một câu có thêm thông tin
so với dòng bên dưới hay không không phải việc mà một lượt duyệt cây cú pháp làm được.

**Cách phát hiện.** Rule vào hai nút `ExportNamedDeclaration` và `ExportDefaultDeclaration`. Nếu nút
không có `declaration` thì thoát ngay. Nếu có, kiểu của nó phải nằm trong đúng **bốn** loại:
`VariableDeclaration`, `TSInterfaceDeclaration`, `FunctionDeclaration`, `TSTypeAliasDeclaration`.
Điều kiện thoả mãn là `getCommentsBefore(node)` tìm thấy một chú thích loại `Block` có `value` bắt đầu
bằng ký tự `*`.

**Vì sao luật này đáng có máy giữ.** Một export là thứ file khác phụ thuộc vào. Nó được đọc nhiều hơn
hẳn số lần được viết, và người đọc phần lớn sẽ không bao giờ mở thân hàm ra xem. Con người quên viết
khối ấy một cách rất đều đặn, còn máy thì đếm được từng chỗ quên trong toàn cây thư mục chỉ trong một
lượt chạy. Đây cũng là rule duy nhất trong ba rule mà một kho mã có lịch sử nên chuẩn bị tinh thần nhận
về một con số lớn ngay lần chạy đầu.

**Cửa còn mở.**

- Tách khai báo ra khỏi export thì rule biến mất: `const a = 1` một dòng, `export { a }` một dòng khác.
  Nút export ấy không có `declaration`, và rule thoát trước mọi phép kiểm.
- Bốn loại, không hơn. `class`, `enum`, `export default () => …`, `export default TênGìĐó`,
  `export default { … }` đều nằm ngoài danh sách. Một component viết dưới dạng arrow mặc định là hình
  dạng export phổ biến nhất của một giao diện, và rule không với tới.
- Khối chú thích **không bao giờ được đọc**. `/** */` rỗng cũng qua. Một khối viết cho dòng `import` phía
  trên, cách bốn dòng trắng, cũng qua — `getCommentsBefore` không quan tâm khối ấy viết cho ai.
- `export const a = 1, b = 2` chỉ cần một khối cho cả hai.

---

## `no-second-language-in-source`

**Bắt gì.** Chữ mang dấu của ngôn ngữ thứ hai xuất hiện ở **năm** chỗ: chú thích (mọi loại), tên định
danh, chuỗi ký tự, mảnh template, và chữ nằm giữa hai thẻ JSX. Rule không chỉ đọc chú thích, và đó là
chủ ý: một câu bị cấm trong chú thích mà lại hợp lệ khi dời xuống một dòng thành tên biến thì luật ấy
không giữ được gì.

**Giữ mã nào.** `COMMENTS-2`. Nó cũng là chỗ cài đặt hai ngoại lệ của `COMMENTS-3`: miễn theo đường dẫn,
và miễn theo dòng có đánh dấu `vn-ok:`.

**Cách phát hiện.** Trước hết là cổng đường dẫn: bảy mẫu đường dẫn được thử trên tên file đã đổi hết dấu
gạch ngược thành gạch chéo. File nào khớp thì rule trả về rỗng, tức là **không tồn tại** trong file đó.
Còn lại, rule gom trước tập dòng có dấu `vn-ok:` — dòng chứa chú thích ấy, cộng thêm đúng một dòng ngay
sau nó — rồi duyệt năm chỗ trên. Phép thử là **một lớp ký tự** gồm các chữ dựng sẵn có dấu. Ba đường
thoát: chuỗi chứa tên gọi bản ngữ của ngôn ngữ, chuỗi chứa chính dấu `vn-ok:`, hoặc dòng bắt đầu của nút
nằm trong tập dòng đã đánh dấu.

**Vì sao luật này đáng có máy giữ.** Không phải vì một câu chú thích lạc lõng gây hỏng gì. Mà vì thứ nó
tạo ra: một kho mã có hai ngôn ngữ là một kho mã có **hai nhóm người đọc**, và nhóm nhỏ hơn sẽ lặng lẽ
bỏ qua những phần nó không đọc được. Việc bỏ qua ấy không ai báo cáo, không ai đo được, và nó tích lại
thành những vùng mã chỉ một nửa đội hiểu. Máy giữ được chỗ này vì nó nhìn được cả năm chỗ chữ có thể trốn
— việc mà mắt người rà tay sẽ bỏ sót ngay từ file thứ ba.

**Cửa còn mở.** Đây là rule có cửa mở rộng nhất trong ba rule, và cần nói thẳng:

- **Nó bắt DẤU, không bắt NGÔN NGỮ.** Cùng câu ấy gõ không dấu — đúng kiểu người ta gõ trong khung chat —
  không chứa chữ nào trong lớp ký tự, và rule im lặng hoàn toàn. Chính ví dụ mà luật dùng để minh hoạ cái
  bẫy này là một câu không dấu, và nó lọt.
- **Chữ ở dạng tổ hợp.** Cùng những chữ ấy chuẩn hoá về dạng tách dấu thì hiện trên màn hình y hệt, nhưng
  được ghép từ chữ cái gốc cộng dấu rời — không cái nào nằm trong lớp ký tự.
- **Mọi hệ chữ khác.** Lớp ký tự phủ đúng một bảng chữ cái. Chữ Hán, Kirin, Ả Rập, Thái, Hàn đều không
  phải "ngôn ngữ thứ hai" dưới mắt rule này.
- **Tên gọi bản ngữ tẩy sạch cả nút.** Đường thoát thử trên **toàn bộ** chuỗi, nên một chú thích mở đầu
  bằng tên gọi ấy rồi viết tiếp bốn dòng thì cả bốn dòng được miễn.
- **Dấu `vn-ok:` miễn cả DÒNG, không phải một giá trị.** Mọi nút trên dòng đã đánh dấu đều được miễn, kể
  cả nút không liên quan; và một template chỉ cần **bắt đầu** trên dòng ấy là được miễn cho toàn bộ thân
  nó, dài bao nhiêu cũng vậy.
- **File test được miễn trọn vẹn.** Danh sách đường dẫn miễn cả `*.test.*` và `*.spec.*` — miễn cả file,
  không phải miễn riêng những chuỗi tái hiện dữ liệu thật bên trong. Rộng hơn hẳn câu ngoại lệ mà luật
  thực sự cho phép.
- **Giặt qua đường dẫn được miễn.** Đưa đoạn chữ vào một module fixture rồi import về: nơi import chỉ còn
  một tên định danh, còn định nghĩa thì nằm ở chỗ rule không nhìn.
- **Tên trong JSX.** Tên component và tên thuộc tính là `JSXIdentifier`, không phải `Identifier`, nên
  không được duyệt.
- **Chuỗi do chương trình dựng ra.** Giá trị ghép từ mã điểm ký tự, hoặc ghép từ hai nửa mà từng nửa
  không chứa chữ có dấu nào, không còn là chuỗi để rule đọc.

---

## `no-emoji-in-source`

**Bắt gì.** Ký tự tượng hình mở rộng, hoặc hai ký tự chỉ vùng đứng liền nhau, ở đúng năm chỗ mà rule
trên duyệt.

**Giữ mã nào.** `COMMENTS-4`.

**Cách phát hiện.** Cùng cổng đường dẫn, cùng năm nút. Phép thử là **hai** biểu thức tách rời chứ không
phải một lớp ký tự gộp: một cho thuộc tính `Extended_Pictographic`, một cho cặp ký tự chỉ vùng. Tách đôi
là có lý do được ghi ngay trong mã nguồn: gộp cả hai vào một lớp ký tự sẽ kích hoạt chính một rule khác
về lớp ký tự dễ gây hiểu nhầm, mà một rule phải tắt một rule khác đi mới tồn tại được thì không ai tin nó.
Rule này **không** có dấu miễn trừ nào tương đương `vn-ok:`.

**Vì sao luật này đáng có máy giữ.** Một ký tự tượng hình hiện khác nhau trên từng nền tảng, sắp xếp
không đoán trước được, làm vỡ một terminal không chờ đợi nó, và mang nghĩa không giống nhau ở hai quốc
gia. Đây đúng là loại lỗi mà mắt người không bắt được: trên máy người viết nó hiện ra rất đẹp. Máy thì
nhìn mã điểm ký tự, không nhìn hình.

**Cửa còn mở.**

- **Chuỗi kiểu phím số.** Một chữ số hoặc dấu `#`, cộng một ký tự chọn biến thể, cộng dấu bao ô vuông —
  hiện ra đúng như một emoji và không khớp biểu thức nào, vì không mảnh nào của nó mang thuộc tính tượng
  hình mở rộng.
- **Hình vẽ không mang thuộc tính ấy.** Ngôi sao dùng làm mức đánh giá, dấu tích ở dạng gầy, mũi tên, dấu
  chấm đầu dòng, ký tự vẽ khung — hiện ra là trang trí, và đều lọt. Luật cấm một loại **hành vi**; rule
  cấm một thuộc tính Unicode, và hai đường biên ấy không trùng nhau.
- **Dữ liệu ngôn ngữ.** `COMMENTS-4` nói rõ là không dùng ký tự tượng hình "trong source **hay dữ liệu
  ngôn ngữ**". Cổng đường dẫn lại miễn đúng dữ liệu ngôn ngữ, nên nửa sau câu ấy không có ai giữ.
- **Mảnh rời.** Một ký tự chỉ vùng đứng một mình, hoặc một dấu chỉnh tông màu da đứng một mình, đều nằm
  dưới cả hai phép thử.
- **Ngược chiều — báo nhầm.** Dấu bản quyền, dấu đăng ký, dấu thương hiệu, dấu cảnh báo, ký hiệu điện
  thoại đều mang thuộc tính tượng hình mở rộng, nên một dòng ghi bản quyền ở chân trang **bị báo lỗi**.
  Đây không phải cửa mở, mà là chi phí phải trả và phải biết trước.

---

## Luật

1. Trích một rule bằng **tên đã publish** của nó. Không đặt thêm mã số.
2. Cả ba rule chạy ở mức `error`; chính plugin tự nêu mức ấy.
3. Hai rule về chữ đọc **cùng năm chỗ**, nên một câu không hợp lệ hoá hợp lệ chỉ nhờ dời từ chú thích
   sang tên biến rồi sang chuỗi.
4. Miễn trừ theo đường dẫn là **đường dẫn**, không bao giờ là một phán đoán về nội dung file.
5. `require-export-jsdoc` **không** có cổng đường dẫn: nó áp cả vào file fixture y như vào một component.
6. Một cửa còn mở thì phải được viết ra. Cửa nguy hiểm là cửa chưa ai viết ra, vì khi ấy luật được tin là
   đang có người giữ trong khi thật ra không.

## Ngoại lệ

- **Dữ liệu ngôn ngữ.** Một từ điển dịch **chính là** ngôn ngữ kia. Miễn theo đường dẫn.
- **Fixture và test.** Một fixture tái hiện chuỗi thật thì phải tái hiện đúng nguyên văn, nếu dịch đi thì
  nó đang kiểm thử một thứ khác. Miễn theo đường dẫn — và như đã ghi ở trên, miễn rộng hơn câu lý do.
- **Chuỗi có chức năng, đã đánh dấu.** Một giá trị mà chương trình đang chạy so khớp hoặc phát ra thì
  được giữ, kèm dấu `vn-ok:` trên dòng của nó. Cái **dấu** mới là ngoại lệ; phần lý do viết sau dấu là
  quy ước giữa người với người, máy không kiểm.
- **Tên gọi bản ngữ.** Một bộ chọn ngôn ngữ buộc phải hiện được tên của ngôn ngữ bằng chính chữ viết của
  nó, nên chuỗi ấy luôn hợp lệ.
