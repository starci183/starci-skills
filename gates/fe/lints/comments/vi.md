---
title: Comments · Vietnamese
---

# Chú thích

Đầu vào là mã đã viết xong rồi — một file, một mảnh diff. Đầu ra là một **phán quyết**: file ấy có
nằm trong phạm vi hay không, rule đã publish nào lên tiếng, nó báo cái gì và trên nút nào, ứng với mã
luật nào, và cửa mở nào lẽ ra đã che đúng lỗi ấy. Mô-đun này không chọn gì cả. Nó từ chối, và nó phải
chỉ được ra đúng ký tự mà nó từ chối.

## Luật

Luật là `patterns/comments.md`. Luật nói rằng một chú thích phải nói điều mà mã không tự nói được về
chính nó, rằng mã nguồn là một ngôn ngữ duy nhất theo chuẩn của một người lạ, rằng mọi export mở đầu
bằng một khối tài liệu, và rằng không có ký tự tượng hình Unicode nào nằm trong mã nguồn.

Mô-đun này ghi một thứ hẹp hơn nhưng hữu ích hơn: **máy nhìn được bao nhiêu phần của luật ấy.** Luật
là tiêu chuẩn đặt lên người đọc. Rule là một phép so chuỗi, một loại nút cú pháp và một biểu thức trên
tên file. Hai thứ ấy chưa bao giờ bằng nhau, và khoảng cách giữa chúng chính là nội dung của file này.

Luật nêu **sáu mã. Ba rule được xuất xưởng**, trong gói plugin `@starci/eslint-canon-fe`, dưới tiền tố
`starci-fe/`. Phép tính ấy là điều đầu tiên người đọc cần biết, và nó được nói thẳng ở đây chứ không
được làm nhoè đi.

## Luật máy đã xuất bản

| Rule | Mã | Nó báo cái gì |
|---|---|---|
| `require-export-jsdoc` | `COMMENTS-1` | Một khai báo được export mà ngay trước nó không có khối chú thích nào có phần chữ mở đầu bằng `*`. Báo tại tên được khai báo; thông báo lỗi đòi VAI TRÒ, không đòi chữ ký. |
| `no-second-language-in-source` | `COMMENTS-2`, và nó cài đặt các ngoại lệ của `COMMENTS-3` | Một chú thích, tên định danh, chuỗi ký tự, mảnh template hoặc chữ JSX chứa chữ cái của bảng chữ cái ngôn ngữ thứ hai, trong một file không phải dữ liệu ngôn ngữ hay fixture, trên một dòng không mang dấu miễn trừ kèm lý do. |
| `no-emoji-in-source` | `COMMENTS-4` | Đúng năm chỗ ấy, chứa một ký tự tượng hình mở rộng hoặc một cặp ký tự chỉ vùng, trong một file không phải dữ liệu ngôn ngữ hay fixture. |

**`COMMENTS-5` và `COMMENTS-6` không có rule nào.** Một chú thích chép lại dòng ngay bên dưới, và một
chú thích cãi lại điều gì đó mà không nêu tên quyết định nó cãi, đều vô hình với mọi rule trong mô-đun
này. Hai mã ấy nằm ở trạng thái biết rõ là không ai giữ, chứ không phải được che: đánh giá một câu có
thêm thông tin so với dòng bên dưới hay không không phải việc mà một lượt duyệt cây cú pháp làm được,
và một lượt lint xanh không nói được gì về cả hai.

`COMMENTS-3` chỉ được giữ một nửa. Phần ngoại lệ theo đường dẫn và phần dấu miễn trừ cho chuỗi có chức
năng thì đã cài đặt; phần đòi cái dấu ấy phải mang **một lý do** thì không — bất cứ chữ gì viết sau
dấu cũng thoả, kể cả không viết gì.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, và ghi lại.** Nằm ngoài phạm vi không có nghĩa là file
   ấy qua được; nghĩa là rule trả về tập visitor rỗng và **không tồn tại** trong file đó.
2. **Kiểm cổng đường dẫn.** `isContentFile(context.filename)` được thử trên tên file đã đổi hết dấu
   gạch ngược thành gạch chéo, đối chiếu bảy mẫu đường dẫn. Khớp một mẫu là tắt cả hai rule về chữ.
   `require-export-jsdoc` không có cổng này và áp vào mọi file mà cấu hình có lint.
3. **Đọc các nút, đủ cả năm chỗ** — chú thích, `Identifier`, `Literal` kiểu chuỗi, `TemplateElement`,
   `JSXText` — cộng hai nút export. Một câu không hoá hợp lệ chỉ nhờ dời từ chỗ này sang chỗ kia.
4. **Mỗi phát hiện một khối.**
5. **Viết dòng `hatch` mỗi khi có một cửa mở lẽ ra đã che đúng lỗi ấy**, và ghi `verdict: silent` khi
   luật bị vi phạm mà không rule nào nhìn thấy. Đó là một phát hiện về việc thực thi luật, không phải
   một lượt qua.
6. **Đừng báo thứ không rule nào canh.** Hai trong sáu mã không có máy giữ; một phán quyết nói khác
   đi là nói sai về mô-đun này.

## `require-export-jsdoc` — COMMENTS-1

**Nó báo cái gì.** Một khai báo được export mà ngay trước nó không có khối chú thích nào có phần chữ
mở đầu bằng `*`, báo ngay tại tên được khai báo. Thông báo lỗi đòi VAI TRÒ của cái được export, không
đòi chữ ký của nó.

**Nó phát hiện bằng gì.** Rule vào hai nút `ExportNamedDeclaration` và `ExportDefaultDeclaration`, và
thoát ngay khi nút không có `declaration`. Có rồi thì nó chỉ đi tiếp với đúng bốn loại khai báo:
`VariableDeclaration`, `TSInterfaceDeclaration`, `FunctionDeclaration`, `TSTypeAliasDeclaration`.
Điều kiện thoả mãn là `sourceCode.getCommentsBefore(node)` tìm thấy một chú thích loại `Block` có
`value` bắt đầu bằng ký tự `*`. Tên đem đi báo là `declaration.id.name`, hoặc id của declarator đầu
tiên, hoặc chuỗi dự phòng có sẵn.

**Nó không thấy gì.** **Tách khai báo khỏi export**: `const a = 1` một dòng và `export { a }` một
dòng khác thì nút export không có `declaration`, rule thoát trước mọi phép kiểm; `export * from "./x"`
và `export { a } from "./x"` cũng im hệt như thế. **Bốn loại, không hơn**: `class`, `enum`,
`export default () => …`, `export default TênGìĐó` và `export default { … }` đều nằm ngoài danh sách
— mà một component viết dưới dạng arrow mặc định lại chính là hình dạng export phổ biến nhất của một
giao diện, và rule không với tới. **Khối chú thích không bao giờ được đọc**: `/** */` rỗng cũng thoả,
và một khối viết cho dòng `import` phía trên, cách mấy dòng trắng, cũng thoả, vì `getCommentsBefore`
không quan tâm khối ấy viết cho ai. Đúng cái nửa đáng giá của `COMMENTS-1` — nói vai trò, đừng chép
chữ ký — là nửa không ai giữ. **Một khối gánh nhiều declarator**: `export const a = 1, b = 2` chỉ cần
một khối cho cả hai, và khối ấy không được soi cho bên nào.

**Ranh giới.** Rule này đếm sự tồn tại của một khối. Khối ấy **nói gì** là chuyện của `COMMENTS-5` và
`COMMENTS-6`, hai mã không có rule nào. Rule này không có cổng đường dẫn: nó áp vào một module fixture
y như áp vào một component.

## `no-second-language-in-source` — COMMENTS-2, COMMENTS-3

**Nó báo cái gì.** Một chú thích, tên định danh, chuỗi ký tự, mảnh template hoặc chữ JSX chứa chữ cái
của bảng chữ cái ngôn ngữ thứ hai, trong một file không phải dữ liệu ngôn ngữ hay fixture, trên một
dòng không mang dấu miễn trừ kèm lý do.

**Nó phát hiện bằng gì.** Cổng là `isContentFile(context.filename)`, một danh sách bảy mẫu đường dẫn
thử trên tên file đã đổi dấu gạch ngược thành gạch chéo; khớp thì trả về tập visitor rỗng. Không khớp
thì rule gom trước tập dòng mang chú thích có dấu `vn-ok:` — dòng chứa chú thích ấy, cộng đúng một
dòng ngay sau nó — rồi cài một bộ visitor dùng chung: `Program` (duyệt
`sourceCode.getAllComments()`), `Identifier`, `Literal` khi `typeof value === "string"`,
`TemplateElement` (phần chữ `cooked`), `JSXText`. Phép thử là **một lớp ký tự** gồm các chữ dựng sẵn
có dấu của ngôn ngữ thứ hai. Ba đường thoát: chuỗi chứa tên gọi bản ngữ của ngôn ngữ, chuỗi chứa
chính dấu miễn trừ, hoặc `node.loc.start.line` nằm trong tập dòng đã đánh dấu.

**Nó không thấy gì.** **Nó bắt DẤU, không bắt NGÔN NGỮ** — phép thử là một lớp chữ dựng sẵn, nên cùng
câu ấy gõ không dấu, đúng kiểu người ta vẫn gõ trong khung chat, không chứa chữ nào trong lớp và rule
im hoàn toàn; chính ví dụ mà luật dùng để minh hoạ cái bẫy này là một câu đúng hình dạng ấy, và nó
lọt. **Chữ ở dạng tổ hợp** — cùng những chữ ấy chuẩn hoá về dạng tách dấu thì hiện trên màn hình y
hệt, nhưng được ghép từ chữ cái gốc cộng dấu rời, không cái nào nằm trong lớp. **Mọi hệ chữ khác** —
lớp ký tự phủ đúng một bảng chữ cái, nên chữ Hán, Kirin, Ả Rập, Thái, Hàn đều không phải "ngôn ngữ thứ
hai" dưới mắt rule này. **Tên gọi bản ngữ tẩy sạch cả nút** — đường thoát thử trên **toàn bộ** chuỗi,
nên một chú thích mở đầu bằng tên gọi ấy rồi viết tiếp bốn dòng thì cả bốn dòng được miễn. **Dấu miễn
trừ miễn cả DÒNG, không phải một giá trị** — mọi nút trên dòng đã đánh dấu đều được miễn, kể cả nút
không ai định miễn, và một template chỉ cần **bắt đầu** trên dòng ấy là được miễn cho toàn thân, dài
bao nhiêu cũng vậy. **File test được miễn trọn vẹn** — danh sách đường dẫn miễn cả `*.test.*` và
`*.spec.*`, chứ không miễn riêng những chuỗi tái hiện dữ liệu thật bên trong, rộng hơn hẳn câu ngoại
lệ mà luật thực sự cho phép. **Giặt qua một đường dẫn được miễn** — đưa đoạn chữ vào một module
fixture hay thư mục dữ liệu ngôn ngữ rồi import về; nơi import chỉ còn một `Identifier`, còn định
nghĩa nằm ở chỗ rule không nhìn. **Tên trong JSX** — tên component và tên thuộc tính là
`JSXIdentifier`, không phải `Identifier`, nên không được duyệt. **Chuỗi do chương trình dựng ra** —
giá trị ghép từ mã điểm ký tự, hoặc ghép từ hai nửa mà từng nửa không mang chữ có dấu nào, không còn
là chuỗi để rule đọc.

**Ranh giới.** Đây là nơi phần ngoại lệ theo đường dẫn và dấu miễn trừ của `COMMENTS-3` được cài đặt.
Phần `COMMENTS-3` đòi cái dấu phải mang một lý do thì không được cài ở bất cứ đâu: chữ gì viết sau dấu
cũng thoả, kể cả không viết gì.

## `no-emoji-in-source` — COMMENTS-4

**Nó báo cái gì.** Một ký tự tượng hình mở rộng, hoặc một cặp ký tự chỉ vùng, ở đúng năm chỗ mà rule
về chữ duyệt, trong một file không phải dữ liệu ngôn ngữ hay fixture.

**Nó phát hiện bằng gì.** Cùng cổng đường dẫn ấy và cùng năm visitor ấy. Phép thử là **hai** biểu thức
tách rời chứ không phải một lớp ký tự gộp: `\p{Extended_Pictographic}` với cờ `u`, hoặc hai mã điểm
liền nhau nằm trong khoảng ký tự chỉ vùng. Rule này không có dấu miễn trừ nào, cũng không có đường
thoát theo tên gọi bản ngữ.

**Nó không thấy gì.** **Chuỗi kiểu phím số** — một chữ số hoặc dấu `#`, cộng một ký tự chọn biến thể,
cộng dấu bao ô vuông, hiện ra đúng như một emoji mà không khớp biểu thức nào, vì không mảnh nào của nó
mang thuộc tính tượng hình mở rộng. **Hình vẽ không mang thuộc tính ấy** — ngôi sao dùng làm mức đánh
giá, dấu tích ở dạng gầy, mũi tên, dấu chấm đầu dòng, ký tự vẽ khung, tất cả hiện ra là trang trí và
tất cả đều lọt; luật cấm một loại **hành vi**, rule cấm một thuộc tính Unicode, và hai đường biên ấy
không trùng nhau. **Dữ liệu ngôn ngữ** — `COMMENTS-4` nói rõ là một phản ứng của sản phẩm không bao
giờ là ký tự tượng hình "trong source hay dữ liệu ngôn ngữ", mà cổng đường dẫn lại miễn đúng dữ liệu
ngôn ngữ theo thiết kế, nên nửa sau câu ấy không có ai giữ. **Mảnh rời** — một ký tự chỉ vùng đứng một
mình, hoặc một dấu chỉnh tông màu da đứng một mình, đều nằm dưới cả hai phép thử, và cả hai đều có thể
được ghép lại lúc chạy.

**Ranh giới.** Rule còn chạy theo chiều ngược lại: dấu bản quyền, dấu đăng ký, dấu thương hiệu, dấu
cảnh báo và ký hiệu điện thoại đều mang thuộc tính tượng hình mở rộng, nên một dòng ghi bản quyền ở
chân trang **bị báo lỗi**. Đó là chi phí phải biết trước, không phải một cửa mở.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| chuẩn hoá dấu phân cách | Tên file được đổi hết sang gạch chéo trước mọi phép thử mẫu, nên `…\src\fixtures\a.ts` và `…/src/fixtures/a.ts` được xử lý y hệt nhau |
| cổng đường dẫn | `isContentFile(context.filename)`, bảy mẫu đường dẫn; khớp thì trả về tập visitor rỗng, tức là hai rule về chữ **không tồn tại** trong file đó chứ không phải file ấy qua được |
| năm chỗ | `Program` duyệt `sourceCode.getAllComments()`, `Identifier`, `Literal` khi `typeof value === "string"`, `TemplateElement` trên phần chữ `cooked`, `JSXText` — dùng chung cho cả hai rule về chữ |
| phần chữ đem đi so | Chữ đưa vào mỗi phép kiểm là giá trị **cooked** của nút, nên một chuỗi thoát được so ở dạng đã giải mã |
| chọn nút nào | Visitor canh trên chính nút `Literal` chứ không canh một thuộc tính hay một đối số lời gọi, nên một chuỗi gom vào mảng, vào object hay vào một hằng số vẫn là `Literal` trong cùng file ấy và vẫn bị nhìn thấy |
| tập dòng đánh dấu | Các dòng mang chú thích `vn-ok:`: dòng của chính chú thích ấy, cộng đúng một dòng ngay sau |
| chú thích đứng trước | `sourceCode.getCommentsBefore(node)` cho phép kiểm export — nó đọc sự tồn tại, không bao giờ đọc nội dung |
| hai biểu thức, không phải một lớp | Phép thử emoji bị tách làm `\p{Extended_Pictographic}` và cặp ký tự chỉ vùng là có chủ ý: gộp cả hai vào một lớp ký tự sẽ kích hoạt chính một rule khác về lớp ký tự dễ gây hiểu nhầm, mà một rule phải tắt một rule khác đi mới tồn tại được thì không ai tin nó |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lách được, nhưng không.

| Viết theo kiểu này | Vì sao vẫn bị bắt |
|---|---|
| Emoji hay chữ có dấu viết dưới dạng chuỗi thoát — `"\u{1F600}"`, `"Đã huỷ"` | Phép kiểm đọc `node.value`, giá trị đã được giải mã sẵn. Cả hai đều bị báo |
| Gom chữ vào một cấu trúc dữ liệu — `["🙂"]`, `{ label: "…" }`, một bảng tra trạng thái | Visitor nằm trên `Literal`, không nằm trên một thuộc tính hay một prop JSX. Gom chuỗi lại chỉ đổi chỗ nó ngồi, không đổi loại nút của nó |
| Dời một câu từ chú thích xuống thành tên — `const đơnHàng = …` | `Identifier` là một trong năm chỗ được duyệt. Đây chính là lý do rule không chỉ đọc chú thích |
| Giấu chữ trong template — `` `trạng thái: ${x}` `` | `TemplateElement` được duyệt trên mảnh `cooked` của nó |
| Chữ nằm giữa hai thẻ JSX thay vì trong thuộc tính | `JSXText` được duyệt; còn trường hợp thuộc tính là một `Literal` bình thường |
| Ngoại lệ đường dẫn cư xử khác đi trên một bản checkout Windows | Tên file được chuẩn hoá sang gạch chéo trước mọi phép thử mẫu |
| Đặt dấu miễn trừ ở đâu đó gần dòng vi phạm | Tập được miễn đúng hai dòng: dòng của chính chú thích đánh dấu, và dòng ngay sau nó. Một dấu đặt cách hai dòng thì không với tới |
| Một file ngôn ngữ đặt tên kèm mã vùng — `messages/vi-VN.json` | Mẫu đường dẫn cho dữ liệu ngôn ngữ không phân biệt hoa thường và chấp nhận dấu gạch nối, nên ngoại lệ rơi đúng chỗ nó được định cho |

**Còn mở** — đây là phần mù đã xuất xưởng. Một phán quyết không được phép nói rằng những chỗ này đã
được xét.

| Rule | Cái gì thật sự lọt |
|---|---|
| `require-export-jsdoc` | **Tách khai báo khỏi export.** `const a = 1` rồi `export { a }` thì không có `declaration`, rule thoát trước mọi phép kiểm. `export * from "./x"` và `export { a } from "./x"` cũng im như thế |
| `require-export-jsdoc` | **Bốn loại, không hơn.** `class`, `enum`, `export default () => …`, `export default TênGìĐó` và `export default { … }` đều ngoài danh sách — mà arrow mặc định lại là hình dạng export phổ biến nhất của một giao diện |
| `require-export-jsdoc` | **Khối chú thích không bao giờ được đọc.** `/** */` rỗng cũng thoả, và một khối viết cho dòng import phía trên cách mấy dòng trắng cũng thoả |
| `require-export-jsdoc` | **Một khối gánh nhiều declarator.** `export const a = 1, b = 2` chỉ cần một khối, và khối ấy không được soi cho bên nào |
| `no-second-language-in-source` | **Bắt dấu, không bắt ngôn ngữ.** Cùng câu ấy gõ không dấu thì không có gì nằm trong lớp ký tự. Chính ví dụ minh hoạ của luật cũng lọt |
| `no-second-language-in-source` | **Chữ ở dạng tổ hợp.** Chữ cái gốc cộng dấu rời hiện y hệt trên màn hình và không nằm trong lớp |
| `no-second-language-in-source` | **Mọi hệ chữ khác.** Lớp ký tự phủ đúng một bảng chữ cái |
| `no-second-language-in-source` | **Tên gọi bản ngữ tẩy sạch cả nút.** Đường thoát thử trên toàn bộ chuỗi, không chỉ thử cái tên nằm trong đó |
| `no-second-language-in-source` | **Dấu miễn trừ miễn cả dòng, không phải một giá trị.** Mọi nút trên dòng ấy được miễn, và một template chỉ cần bắt đầu ở đó là được miễn cho toàn thân |
| `no-second-language-in-source` | **File test được miễn trọn vẹn.** `*.test.*` và `*.spec.*` miễn cả file, rộng hơn hẳn câu ngoại lệ mà luật cho phép |
| `no-second-language-in-source` | **Giặt qua một đường dẫn được miễn.** Nơi import chỉ còn một `Identifier`; định nghĩa nằm ở chỗ rule không nhìn |
| `no-second-language-in-source` | **Tên trong JSX.** `JSXIdentifier` không phải `Identifier`, nên không được duyệt |
| `no-second-language-in-source` | **Chuỗi do chương trình dựng ra.** Một giá trị ghép lúc chạy không còn là chuỗi để rule đọc |
| `no-emoji-in-source` | **Chuỗi kiểu phím số.** Không mảnh nào trong bộ chữ số, ký tự chọn biến thể và dấu bao ô vuông mang thuộc tính tượng hình mở rộng |
| `no-emoji-in-source` | **Hình vẽ không mang thuộc tính ấy.** Ngôi sao, dấu tích dạng gầy, mũi tên, dấu chấm đầu dòng, ký tự vẽ khung đều lọt |
| `no-emoji-in-source` | **Dữ liệu ngôn ngữ.** Nửa câu của `COMMENTS-4` nói về dữ liệu ngôn ngữ hoàn toàn không có ai giữ |
| `no-emoji-in-source` | **Mảnh rời.** Một ký tự chỉ vùng hoặc một dấu chỉnh tông màu da đứng một mình đều nằm dưới cả hai phép thử |
| cả ba | **Một dòng chú thích tắt rule, và cấu hình lint.** Bất cứ rule nào ở đây cũng bị tắt cho một file chỉ bằng một dòng chú thích ở đầu file, và hoàn toàn không tồn tại với một file mà cấu hình không lint tới. Ghi một lần ở đây để không rule nào phía trên tự nhận là kín |
| không rule nào | **Toàn bộ những gì `COMMENTS-5` và `COMMENTS-6` cấm** — một chú thích chép lại dòng bên dưới, và một chú thích cãi mà không nêu tên quyết định nó cãi |

## Đầu vào

| Đầu vào | Bằng chứng phải có |
|---|---|
| tên file | `context.filename`, đã chuẩn hoá sang gạch chéo, đối chiếu bảy mẫu đường dẫn nội dung |
| quyết định phạm vi | Mẫu đường dẫn nào đã khớp, hoặc là không mẫu nào khớp |
| chú thích | `sourceCode.getAllComments()`, cả `Line` lẫn `Block`, kèm số dòng để dựng tập dòng đánh dấu |
| các nút | `Identifier`, `Literal` kiểu chuỗi, `TemplateElement`, `JSXText`, và hai nút export |
| chú thích đứng trước | `sourceCode.getCommentsBefore(node)` cho phép kiểm export |

## Quy tắc

1. Trích một rule bằng tên đã publish của nó. Không có định danh thứ hai, vì cái tên mới là thứ log
   build in ra và là thứ một dòng tắt rule phải viết đúng.
2. Cả ba rule chạy ở mức `error`, và chính plugin tự nêu mức ấy.
3. Hai rule về chữ đọc cùng năm chỗ, nên một câu không hoá hợp lệ chỉ nhờ dời từ chú thích sang tên
   biến rồi sang chuỗi.
4. Miễn trừ theo đường dẫn là **đường dẫn**, không bao giờ là một phán đoán về nội dung file.
5. Rule export không có cổng đường dẫn: nó áp vào một module fixture y như áp vào một component.
6. Nằm ngoài phạm vi nghĩa là không visitor nào được cài, không phải là file ấy qua được.
7. Một cửa còn mở thì phải được viết ra. Cửa nguy hiểm là cửa chưa ai viết ra, vì khi ấy luật được
   tin là đang có người giữ trong khi thật ra không.

## Ngoại lệ

- **Dữ liệu ngôn ngữ.** Một từ điển dịch **chính là** ngôn ngữ kia. Miễn theo đường dẫn — và như đã
  ghi ở trên, ngoại lệ này thả luôn cái nửa của `COMMENTS-4` nói về dữ liệu ngôn ngữ.
- **Fixture và test.** Một fixture tái hiện chuỗi thật thì phải tái hiện đúng nguyên văn. Miễn theo
  đường dẫn — và ngoại lệ rộng hơn câu lý do biện minh cho nó: nó thả mọi chú thích, mọi tên và mọi
  thông báo trong một file `*.test.*` hay `*.spec.*`, chứ không chỉ thả những chuỗi fixture bên trong.
- **Chuỗi có chức năng, đã đánh dấu.** Một giá trị mà chương trình đang chạy so khớp hoặc phát ra thì
  được giữ, kèm dấu `vn-ok:` trên dòng của nó. Cái **dấu** mới là ngoại lệ; phần lý do viết sau dấu là
  quy ước giữa người với người, máy không kiểm — nên ngoại lệ này thả cái nửa "phải có lý do" của
  `COMMENTS-3`, và nó thả cả dòng chứ không thả riêng giá trị được đánh dấu.
- **Tên gọi bản ngữ.** Một bộ chọn ngôn ngữ buộc phải hiện được tên của ngôn ngữ bằng chính chữ viết
  của nó, nên chuỗi ấy luôn hợp lệ — và đường thoát ấy thả trọn cái nút mà nó xuất hiện trong đó.

## Đầu ra

Mỗi phát hiện một khối:

```text
file: <path as the linter sees it>
rule: <require-export-jsdoc | no-second-language-in-source | no-emoji-in-source>
law: <COMMENTS-1 | COMMENTS-2 | COMMENTS-3 | COMMENTS-4 | none>
scope: <in | out — the path test that decided it>
verdict: <reports | silent>
reason: <the node type and the text, or the exact escape that applies>
hatch: <the open hatch that would have hidden this, or none>
```

Một file sạch sẽ cho ra mỗi rule một khối với `verdict: silent` và `reason: nothing matched` — đó là
sự vắng mặt của báo lỗi, không bao giờ là bằng chứng đã theo luật. Một file ngoài phạm vi cho ra
`scope: out` kèm mẫu đường dẫn đã khớp và hoàn toàn không có `verdict`, vì không visitor nào được cài.

`verdict: silent` trên một file thật sự vi phạm luật là một đầu ra hợp lệ, và là đầu ra đáng giá nhất.
Nó nghĩa là luật đã bị vi phạm mà không rule nào nhìn thấy, tức là một phát hiện về việc thực thi luật
chứ không phải một lượt qua.

## Ví dụ đã giải

**Đầu vào.** Một file bình thường, `features/attempt/streak-badge.tsx`, mà cổng đường dẫn không
miễn:

```tsx
export const StreakBadge = ({ days }: { days: number }) => (
  <span className="inline-flex items-center gap-1">🔥 {days}</span>
)

const CANCELLED_STATUS = "Đã huỷ"

export const đơnQuáHạn = (items: Item[]) => items.filter((item) => item.dueAt < now)
```

```text
file: src/features/attempt/streak-badge.tsx
rule: require-export-jsdoc
law: COMMENTS-1
scope: in — no content path matched, and this rule has no path gate anyway
verdict: reports
reason: ExportNamedDeclaration over a VariableDeclaration, name StreakBadge, getCommentsBefore found no Block starting with *
hatch: none
```

```text
file: src/features/attempt/streak-badge.tsx
rule: no-emoji-in-source
law: COMMENTS-4
scope: in — no content path matched
verdict: reports
reason: JSXText "🔥 " matches \p{Extended_Pictographic}
hatch: none
```

```text
file: src/features/attempt/streak-badge.tsx
rule: no-second-language-in-source
law: COMMENTS-2
scope: in — no content path matched
verdict: reports
reason: Literal "Đã huỷ", precomposed letters in the class, no endonym, no vn-ok: on the line
hatch: none
```

```text
file: src/features/attempt/streak-badge.tsx
rule: no-second-language-in-source
law: COMMENTS-2
scope: in — no content path matched
verdict: reports
reason: Identifier đơnQuáHạn, precomposed letters in the class
hatch: none
```

Đã sửa — export mở đầu bằng một khối nói vai trò của nó, ký tự tượng hình trở thành một component
icon, chuỗi có chức năng giữ nguyên giá trị nhưng có dấu, và tên định danh được đổi lại:

```tsx
/**
 * The streak counter as the attempt header reads it.
 *
 * The count is days, not sessions: two sessions in one evening must not read as a two-day streak.
 */
export const StreakBadge = ({ days }: { days: number }) => (
  <span className="inline-flex items-center gap-1">
    <Icon name="flame" />
    {days}
  </span>
)

// vn-ok: the server emits this status verbatim and the filter matches on it
const CANCELLED_STATUS = "Đã huỷ"

/**
 * Items whose deadline has already passed.
 *
 * An overdue item cannot be extended: extending it would move a deadline already used elsewhere.
 */
export const overdueItems = (items: Item[]) => items.filter((item) => item.dueAt < now)
```

Hai cửa mở vẫn sống sót qua lần sửa ấy, và sự im lặng ở đây không phải là đã theo luật. Cùng đoạn chữ
ấy gõ không dấu, và cùng cái huy hiệu ấy viết dưới dạng chuỗi kiểu phím số:

```tsx
// han cuoi da qua roi thi khong cho gia han nua
export const StepBadge = () => <span>1️⃣ Chon goi</span>
```

```text
file: src/features/attempt/streak-badge.tsx
rule: no-second-language-in-source
law: COMMENTS-2
scope: in — no content path matched
verdict: silent
reason: the comment is second-language prose, but the test is a class of precomposed letters and undiacriticised text contains none of them
hatch: tone marks, not language — the law's own illustration of this trap is a comment of exactly this shape, and it passes
```

```text
file: src/features/attempt/streak-badge.tsx
rule: no-emoji-in-source
law: COMMENTS-4
scope: in — no content path matched
verdict: silent
reason: the keycap renders as an emoji, but no part of the digit, variation selector and enclosing-keycap mark carries Extended_Pictographic, and it is not a regional-indicator pair
hatch: keycap sequences
```

Và còn một sự im lặng thứ ba không có rule nào để mà im: `export const StepBadge = () => …` vẫn không
mang khối tài liệu nào, `COMMENTS-5` với `COMMENTS-6` thì không ai giữ, và không dòng nào phía trên
nói ra được điều đó.

## Phạm vi

Mô-đun này ghi việc thực thi luật, không ghi luật. Nó gọi tên ba rule bằng tên đã publish của chúng và
những mã luật chúng giữ. Định danh rule, tiền tố plugin và dấu miễn trừ được trích nguyên văn, vì
những chuỗi ấy là thứ thật sự xuất xưởng. Mọi thứ còn lại — mọi ví dụ, mọi đường dẫn, mọi lời giải
thích — là mã nguồn bình thường trong một giao diện bình thường, và không gọi tên sản phẩm, thư viện
hay kho mã nào. Còn chuyện một chú thích có thêm thông tin so với dòng bên dưới hay không, và nó có
nêu tên quyết định nó cãi hay không, thuộc về `COMMENTS-5` và `COMMENTS-6`, hai mã không mô-đun nào
trong cây này giữ.
