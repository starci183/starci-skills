---
title: Comments · Vietnamese
description: Chữ nghĩa đáp xuống chỗ nào trong source — vị trí nào, file nào, ngôn ngữ nào, và mã nào quyết định.
module: comments
kind: pattern
---

# Chữ nghĩa trong source

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | bộ máy frontend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Pattern này nhận một shape đã được duyệt: một component, một hook, một type, một module
rule, một từ điển locale, một fixture. Quyết định đó đã đóng ở đây. Thứ còn mở là chữ nghĩa đi đâu —
export nào phải mở đầu bằng khối tài liệu, vị trí nào được phép mang ngôn ngữ thứ hai, literal nào
phải đeo dấu, câu nào bị xoá thay vì được viết lại cho hay hơn. Pattern này nhận shape đã duyệt và
đáp nó xuống thành kiến trúc source: file, vị trí bên trong file, ngôn ngữ, cái dấu, và mã chịu trách
nhiệm cho chỗ đó.

## Luật

Comment là thứ code không tự nói được về chính nó. Code đã nói cái gì đang xảy ra; comment nói vì sao
lại làm theo cách đó, bỏ đi thì hỏng chỗ nào, và phương án nào đã bị từ chối. Bất cứ câu nào chỉ đọc
lại dòng bên dưới đều là nhiễu, và nhiễu tập cho người đọc thói quen bỏ qua đúng cái comment có giá
trị.

Hai câu hỏi quyết định tất cả. **Một người lạ chỉ đọc code có tự rút ra được kết luận này không?** Nếu
có, comment đó thừa. **Một người không cùng tiếng mẹ đẻ với người viết có đọc được dòng này không?**
Nếu không, dòng đó chưa được viết xong.

Câu hỏi thứ hai là chỗ module này khắt khe nhất, và ngưỡng cố ý không phải là "tiếng Anh ở đâu tiện thì
dùng". Source chỉ có tiếng Anh, theo chuẩn người lạ, và ngoại lệ có đúng ba, hẹp, và được gọi tên.

**Đây là luật bắt buộc, không phải lời khuyên.** Phạm vi không phải là comment. Phạm vi là mọi vị trí
trong một file mà chữ nghĩa có thể trốn vào: block comment, line comment, tên biến, string literal,
mảnh template, chữ trong JSX, và câu thông báo lỗi. Một luật chỉ với tới comment sẽ để nguyên câu văn
ấy hợp lệ ở một dòng thấp hơn dưới dạng một cái tên — và đó đúng là chỗ nó chui vào ngay khi luật ra
đời.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `COMMENTS-<n>`. Mã gọi tên TÌNH HUỐNG. Các mã được
trích dẫn từ những file luật khác và từ hồ sơ công việc, nên một con số đã phát ra thì không bao giờ
được tái sử dụng cho nghĩa khác và không bao giờ được đánh số lại.

| Mã | Tình huống | Source phải trông ra sao |
|---|---|---|
| `COMMENTS-1` | Một khai báo rời khỏi file | Mọi export mở đầu bằng khối tài liệu gọi tên VAI TRÒ nó đảm nhận. Không có export nào thiếu khối; không có khối nào chép lại chữ ký; không có khối nghi thức trên helper nội bộ |
| `COMMENTS-2` | Chữ nghĩa ở bất kỳ vị trí authoring nào | Comment, JSDoc, tên biến và câu thông báo lỗi bằng tiếng Anh, theo chuẩn người lạ. Không có ngôn ngữ thứ hai ở bất kỳ vị trí authoring nào, kể cả khi nó tụt xuống một dòng thành một cái tên |
| `COMMENTS-3` | Ba ngoại lệ đóng | Nội dung locale, fixture nguyên văn và literal chức năng có đánh dấu thì ở lại; cái dấu mang theo lý do. Không có literal chức năng ngoại ngữ nào không đánh dấu; không có ngoại lệ thứ tư được tranh luận ở từng file |
| `COMMENTS-4` | Một pictograph muốn chui vào source | Ký hiệu giao diện chung lấy từ bộ từ vựng icon; reaction của sản phẩm dùng artwork đã check-in có ghi nguồn, đi qua leaf reaction. Không có pictograph Unicode trong tên biến, comment, thông báo lỗi hay chuỗi không phải nội dung |
| `COMMENTS-5` | Một comment chép lại dòng của nó | Comment bị xoá. Không viết lại thành một bản chép hay hơn |
| `COMMENTS-6` | Một comment buộc phải tranh luận | Comment nêu tên quyết định: đã thử gì, tốn gì, vì sao hình dạng hiển nhiên bị từ chối. Không có lần từ chối nào không được ghi lại, để rồi người đọc kế tiếp hoàn tác nó |

`COMMENTS-3` LÀ ĐIỀU KHOẢN NGOẠI LỆ, KHÔNG PHẢI GIẤY PHÉP. Nó được phát biểu thành một mã để người đọc
có thể trích dẫn nó, bị sửa lại theo nó, và bị chỉ ra là đã hiểu sai. Một ngoại lệ không có tên là
ngoại lệ không ai cãi lại được.

## Đọc một shape đã duyệt

1. **Đọc những gì shape đã nói.** Nó nói khai báo và vị trí: đây là component, đây là hook, file này
   là từ điển locale, literal này được so bằng `===`. Lấy `site`, `file`, `binding` và `runtime role`
   từ shape như dữ kiện cho sẵn.
2. **Đọc những gì shape không nói, và vì thế không giải quyết được.** Một shape đã duyệt không nói
   được rằng một câu văn có mang thêm thông tin so với dòng bên dưới nó hay không, và cũng không nói
   phương án nào đã bị từ chối khi shape này được chọn. Hai dữ kiện đó không nằm trong cây; chúng đến
   từ người viết, và không mã nào giải được chỉ bằng shape. `COMMENTS-5` và `COMMENTS-6` do người đọc
   quyết, không bao giờ do shape quyết.
3. **Giải từ ngoài vào trong.** File trước vị trí, vị trí trước câu chữ. Một đường dẫn nội dung đã
   khoá xong câu hỏi ngôn ngữ cho mọi thứ bên trong nó trước khi ta soi tới bất kỳ literal đơn lẻ nào;
   `binding` đã khoá xong chuyện có bắt buộc khối tài liệu hay không trước khi ta phán về câu chữ của
   khối đó.
4. **Hỏi câu hỏi của từng mã, theo thứ tự.** Thứ này có export không, và nó có mở đầu bằng một khối
   gọi tên vai trò không? Mọi vị trí authoring có phải tiếng Anh theo chuẩn người lạ không? Đây có
   phải một trong ba ngoại lệ không, và cái dấu có mang lý do không? Có pictograph Unicode nào ở vị
   trí authoring không? Câu này có nói được điều gì mà dòng dưới chưa nói không? Câu này có đang tranh
   luận với một quyết định không, và nó có nêu tên quyết định đó không?
5. **Khi hai mã cùng khớp**, chỗ đó không bị chẻ đôi. Mọi vị trí chữ nghĩa quy về đúng một mã. Sự hiện
   diện và ngôn ngữ được quyết trước chất lượng: `COMMENTS-1` hỏi khối có tồn tại không, `COMMENTS-5`
   quyết cái khối đang tồn tại có được giữ không. `COMMENTS-2` hỏi dòng này có đọc được không;
   `COMMENTS-5` hỏi nó có đáng đọc không. `COMMENTS-3` chỉ đè lên `COMMENTS-2` bằng đường dẫn và dấu,
   không bao giờ bằng phán đoán. Nếu bạn thấy mình đang muốn viết dài để bảo vệ một dòng code, chỗ đó
   đã thôi là `COMMENTS-5` và trở thành `COMMENTS-6`.

## `COMMENTS-1` — mọi export mở đầu bằng một khối tài liệu

**Khi nào gặp.** Một thứ được `export` là một thứ file khác phụ thuộc vào. Hợp đồng của nó bị đọc nhiều
hơn hẳn số lần bị viết, và bị đọc bởi những người sẽ không bao giờ mở phần thân ra xem. Khối tài liệu
nói VAI TRÒ — đây là cái gì, dùng để làm gì, người nhận kết quả phải làm gì với nó — chứ không đọc lại
chữ ký, vì chữ ký đã tự nói rồi và nó không bao giờ lạc hậu.

**Source phải thể hiện gì.** Một khối đặt trên khai báo được export, nằm trong chính file chứa khai
báo ấy, gọi tên vai trò. Helper nội bộ trong cùng file không mang khối nào như vậy. Một dòng re-export
không sinh ra gì cả: `export { X }` chỉ nói một binding, còn hợp đồng nằm ở file nơi `X` được khai báo.

**Cách nhận ra.** Có từ khoá `export` trước khai báo. Người gọi nó nằm ở file khác, thường là ở
tầng khác. Bạn đang phải mở phần thân ra mới biết trả về `null` thì nghĩa là gì.

**Ranh giới.** Đây không phải `COMMENTS-5`. Một khối chỉ chép lại chữ ký (`@param name - The name`) LÀ
một restatement; nó rơi vào `COMMENTS-5` và bị xoá, chứ không phải "viết cho hay hơn". `COMMENTS-1`
đòi khối phải tồn tại; `COMMENTS-5` quyết cái khối đang tồn tại có được giữ không. Đây cũng không phải
trường hợp helper nội bộ: bắt buộc mọi helper phải có khối sẽ đẻ ra một file mà nửa số dòng là nghi
thức, và khi ấy không khối nào còn được đọc.

**Tình huống nghiệp vụ hay gặp.** Component export ra ngoài · custom hook · type hoặc interface công
khai · hằng số cấu hình · hàm định dạng dữ liệu · adapter gọi API · guard hoặc validator · barrel file.

## `COMMENTS-2` — source viết bằng tiếng Anh, theo chuẩn người lạ

**Khi nào gặp.** Comment, JSDoc, tên biến và câu thông báo lỗi đều là chữ nghĩa. Chuẩn không phải là
"cả đội hiểu là được" — chuẩn là một người vào làm sau một năm, không cùng tiếng mẹ đẻ với người viết
dòng đó. Vì sao khắt khe đến vậy: một codebase có hai ngôn ngữ thì có hai nhóm người đọc, và nhóm nhỏ
hơn sẽ im lặng ngừng đọc đúng những phần họ không đọc được. Không ai báo cáo việc đó cả.

**Source phải thể hiện gì.** Tiếng Anh ở mọi vị trí authoring của file: comment, JSDoc, tên biến,
string literal, mảnh template, chữ trong JSX, thông báo lỗi. Dời một câu từ comment sang một cái tên
không phải là dịch nó và cũng không miễn trừ nó, nên cái tên ấy cũng là tiếng Anh.

**Cách nhận ra.** Chữ có dấu ở bất kỳ đâu trong file authoring. Một câu văn vừa bị dời từ comment
sang tên biến, tên hàm, hoặc key của object. Một thông báo lỗi hiển thị cho người trực hệ thống, chứ
không phải cho người viết ra nó.

**Ranh giới.** Đây không phải `COMMENTS-3`: nếu chuỗi đó là giá trị chương trình đang chạy thật sự
khớp vào hoặc phát ra thì nó không phải chữ nghĩa — nó là dữ liệu, và nó ở lại kèm dấu. Đây cũng không
phải `COMMENTS-5`: `COMMENTS-2` hỏi dòng này có đọc được không, `COMMENTS-5` hỏi nó có đáng đọc không,
và một comment tiếng Anh chỉ chép lại dòng dưới vẫn bị xoá. Có một khoảng hở phải nói thẳng ở đây:
rule đang cho `Tiếng Việt` đi qua — endonym mà một bộ chọn ngôn ngữ buộc phải hiển thị đúng chữ của
chính nó — trong khi luật chỉ nêu BA ngoại lệ. Chênh lệch đó được ghi nhận như một khoảng hở, chứ
không được lặng lẽ nâng lên thành ngoại lệ thứ tư.

**Tình huống nghiệp vụ hay gặp.** Comment giải thích một quy tắc nghiệp vụ nội địa · tên biến đặt theo
thuật ngữ nghiệp vụ trong nước · message trong `throw` · log · tên key trong object cấu hình · text
trong JSX viết cứng · chuỗi trong template literal.

## `COMMENTS-3` — ba ngoại lệ, và mỗi ngoại lệ tự nói ra ở chỗ nó áp dụng

**Khi nào gặp.** Có đúng BA chỗ mà ngôn ngữ thứ hai không phải là lỗi. **Nội dung locale**: từ điển dịch
CHÍNH LÀ ngôn ngữ kia, bắt nó theo `COMMENTS-2` là làm rỗng sản phẩm. **Fixture của test**: fixture tái
tạo một chuỗi có thật thì phải tái tạo đúng nguyên văn, nếu không nó đang test một thứ khác. **Literal
chức năng**: một giá trị mà chương trình đang chạy khớp vào hoặc phát ra là dữ liệu chứ không phải văn
xuôi; nó ở lại, và được đánh dấu trên chính dòng của nó kèm lý do.

**Source phải thể hiện gì.** Hoặc là một file nằm trên đường dẫn nội dung — từ điển locale, thư mục
resources, fixture, file `.test.*` hay `.spec.*` — hoặc là một literal trong file authoring bình
thường mang một dấu trên chính dòng của nó, và lý do đặt sau cái dấu ấy. Cái dấu chính là toàn bộ ý
nghĩa của ngoại lệ thứ ba: một literal không đánh dấu thì không phân biệt được với một comment ai đó
quên dịch, nên người đọc phải tự đoán, và người đọc tiếp theo đoán khác đi.

**Cách nhận ra.** File nằm trong đường dẫn nội dung. Chuỗi được so sánh bằng `===`, dùng làm key,
hoặc gửi thẳng ra ngoài hệ thống. Hãy tự hỏi: nếu dịch chuỗi này sang tiếng Anh, chương trình có chạy
sai không? Nếu có, nó là literal chức năng. Nếu không, nó là văn xuôi, và nó phải là tiếng Anh.

**Ranh giới.** Đây không phải `COMMENTS-2` bị mở lại bằng lý lẽ: ngoại lệ là ĐƯỜNG DẪN cộng một DẤU,
không phải PHÁN ĐOÁN. Một ngoại lệ dựa trên phán đoán sẽ bị tranh cãi lại ở từng file, mãi mãi, và
phần thắng luôn thuộc về người đang vội. Đây cũng không phải `COMMENTS-4`: file nội dung chỉ được miễn
luật NGÔN NGỮ, còn luật không miễn pictograph trong locale data. Rule như đang viết thì miễn cả file
nội dung một thể, nên một pictograph trong locale data đi lọt qua rule trong khi luật này cấm nó —
chênh lệch ấy là một khoảng hở được ghi nhận, không phải một sự cho phép.

**Tình huống nghiệp vụ hay gặp.** Từ điển `messages/*.json` · thư mục resources · fixture tái tạo
payload thật · mã trạng thái server trả về nguyên văn · tên riêng của một tổ chức trong hợp đồng ·
chuỗi so khớp với hệ thống bên thứ ba.

## `COMMENTS-4` — không có pictograph Unicode trong source

**Khi nào gặp.** Không có trong tên biến, không trong comment, không trong thông báo lỗi, không trong
chuỗi không phải nội dung. Một pictograph render khác nhau trên mọi nền tảng, sắp xếp không lường
trước được, làm vỡ một terminal không chờ đợi nó, và mang nghĩa không giống nhau ở hai quốc gia.

**Source phải thể hiện gì.** Ký hiệu giao diện chung lấy từ bộ từ vựng icon. Reaction của sản phẩm
dùng artwork SVG đã check-in, có ghi nguồn, đi qua leaf chuyên trách reaction. Đường thứ hai đó là
trường hợp hẹp hơn và là trường hợp duy nhất — nó không phải một cửa mở.

**Cách nhận ra.** Một ký tự hình vẽ nằm trong chuỗi log, chuỗi thông báo, hoặc chữ trong JSX.
Một cặp regional-indicator (cờ) — đúng thứ mà phép thử một-pictograph bỏ sót.

**Ranh giới.** Đây không phải `COMMENTS-3`. File nội dung chỉ được miễn luật NGÔN NGỮ. Luật nói
pictograph KHÔNG được miễn, kể cả trong locale data; rule thì miễn cả file nội dung một thể, và chỗ
lệch nhau giữa luật và rule đó là một khoảng hở được ghi nhận.

**Tình huống nghiệp vụ hay gặp.** Log "đã xong" · badge trạng thái · nút reaction · tiêu đề section ·
message commit sinh ra từ code · thông báo lỗi cho người dùng cuối · chuỗi trong CLI.

## `COMMENTS-5` — comment chép lại dòng bên dưới thì xoá, không sửa

**Khi nào gặp.** `// tăng biến đếm` đứng trên một phép tăng: tốn một dòng và không dạy được gì. Nhưng nó
tệ hơn mức vô hại: một người đọc gặp ba comment loại đó sẽ thôi đọc cái thứ tư — đúng cái nói vì sao
biến đếm được reset vào Chủ nhật.

**Source phải thể hiện gì.** Không gì cả. Dòng đó bị bỏ đi. Viết lại một restatement thành một
restatement hay hơn vẫn bảo toàn nguyên chi phí: người đọc vẫn phải đọc nó để phát hiện ra nó không
nói gì. Chi phí nằm ở SỰ TỒN TẠI, không nằm ở chất lượng câu chữ.

**Cách nhận ra.** Xoá comment đi, không thông tin nào mất. Comment dùng đúng những từ có sẵn
trong tên hàm và tên biến ngay dưới nó. Comment mô tả CƠ CHẾ (`gọi API`, `lặp qua mảng`) chứ không mô
tả NGUYÊN NHÂN.

**Ranh giới.** Đây không phải `COMMENTS-1`: `COMMENTS-1` đòi khối phải TỒN TẠI, `COMMENTS-5` quyết cái
khối đang tồn tại có được GIỮ không — một khối tài liệu chép lại chữ ký là restatement và rơi vào đây.
Và đây cũng không phải `COMMENTS-6`: ngay khi bạn muốn viết dài để bảo vệ dòng code bên dưới, nó không
còn là restatement nữa, nó là một lần từ chối, và nó phải được viết ra.

**Tình huống nghiệp vụ hay gặp.** Comment sinh tự động trên getter và setter · `// handle click` trên
`onClick` · `@param` chép lại tên tham số · comment tiêu đề ngăn cách các phần trong một file vốn đã
có cấu trúc rõ · comment mô tả một `map` là "duyệt mảng".

## `COMMENTS-6` — comment phải tranh luận là đang tranh luận với một quyết định, và nêu tên nó

**Khi nào gặp.** Những comment đáng giữ là những comment ghi lại một lần TỪ CHỐI: đã thử gì, cái đó tốn
gì, và vì sao hình dạng hiển nhiên lại sai Ở CHỖ NÀY. Đó chính xác là những thứ mà nếu không ghi,
người đọc tiếp theo sẽ hoàn tác. Không phải vì họ ẩu, mà vì đứng từ phía họ, code đang ở một hình dạng
lạ và không có lý do nào giải thích — và "dọn cho gọn" là phản xạ đúng đắn của một kỹ sư tốt.

**Source phải thể hiện gì.** Một comment đặt tại chính dòng lạ đó, mang theo bốn thứ: hình dạng
hiển nhiên là gì; vì sao nó sai Ở ĐÂY, nói bằng một tình huống hỏng cụ thể chứ không bằng tính từ; cái
giá đã trả để biết điều đó, nếu có; và điều gì sẽ khiến quyết định này hết hiệu lực.

**Cách nhận ra.** Có một cách viết ngắn hơn hoặc rõ hơn mà bạn cố ý không dùng. Có một
workaround, một thứ tự thực thi bắt buộc, hoặc một hằng số trông tuỳ tiện. Đã có người sửa theo cách
hiển nhiên một lần rồi phải quay lại.

**Ranh giới.** Đây không phải `COMMENTS-5`: `COMMENTS-5` xoá thứ không nói gì, `COMMENTS-6` BẮT viết
thứ chỉ có bạn biết. Hai mã này không mâu thuẫn — chúng cùng nói một câu: chỉ chữ nghĩa mang thông tin
mới được ở lại. Đây cũng không phải `COMMENTS-1`: khối tài liệu nói vai trò cho người GỌI, còn comment
`COMMENTS-6` nói lý do cho người SỬA. Một khối ở đầu file không thay được một comment nằm tại đúng
dòng lạ.

**Tình huống nghiệp vụ hay gặp.** Workaround cho lỗi của thư viện bên ngoài · thứ tự effect bắt buộc ·
số ma thuật đến từ giới hạn của hệ thống bên ngoài · một `any` đã được cân nhắc · nơi cố ý không memo
hoá · nơi cố ý gọi tuần tự thay vì song song · một truy vấn viết "kém tối ưu" để tránh một khoá.

## Tầng giữ

Mỗi mã hiện được giữ ở tầng nào. `unrepresentable` nghĩa là một union đóng hoặc một branded type khiến
giá trị sai không viết ra được; `enforced` nghĩa là có một rule trong `@canon-fe` báo
lỗi; `documented` nghĩa là không có gì cơ học giữ nó, chỉ có người đọc giữ.

| Mã | Tầng | Ai giữ | Tầng đó với không tới đâu |
|---|---|---|---|
| `COMMENTS-1` | `enforced` | `starci-fe/require-export-jsdoc` | Chỉ sự hiện diện của một khối. Khối đó có gọi tên vai trò hay chỉ chép lại chữ ký thì rule không đọc, và một `class`, `enum` hay `export default` vô danh được export nằm ngoài các loại khai báo mà rule soi |
| `COMMENTS-2` | `enforced` | `starci-fe/no-second-language-in-source` | Regex literal, vốn không phải node `Literal` chuỗi nên không bao giờ được ghé thăm |
| `COMMENTS-3` | `enforced` | `starci-fe/no-second-language-in-source` (`CONTENT_PATHS`, `isContentFile`, `OK_PRAGMA`) | Cái dấu thì được đọc; LÝ DO đứng sau `vn-ok:` thì không. `// vn-ok:` mà không có gì phía sau vẫn đi lọt |
| `COMMENTS-4` | `enforced` | `starci-fe/no-emoji-in-source` | File nội dung được miễn cả gói, nên một pictograph trong locale data đi lọt qua rule trong khi luật này cấm nó |
| `COMMENTS-5` | `documented` | — | Không gì cả. Quyết định một câu văn có thêm thông tin gì so với câu lệnh bên dưới hay không là phát hiện diễn giải, không phải phân tích cú pháp |
| `COMMENTS-6` | `documented` | — | Không gì cả. Hình dạng đã bị từ chối không nằm trong cây; chỉ người đọc biết phương án kia mới thấy nó đang thiếu |

Ba mã chỉ được giữ một phần và hai mã không được giữ chút nào. Tầng lint sở hữu sự hiện diện, đường
dẫn và lớp ký tự; nó không sở hữu ý nghĩa. Những tầng phải giữ mình không biết tới mối bận tâm này là
những tầng nếu không sẽ làm tròn "một phần" lên thành "enforced": không người review, không báo cáo
gate và không bản tóm tắt nào được phép tuyên bố rằng một file đã tuân thủ chỉ vì các rule đã đi qua.

## Điểm neo

Code thật để đối chiếu từng mã. Một luật không chỉ được vào code thật là một đề xuất, không phải một
luật.

| Mã | Điểm neo | Cần nhìn gì ở đó |
|---|---|---|
| `COMMENTS-1` | `@canon-fe` | Mọi `export const` trong file đều mở đầu bằng một khối gọi tên vai trò — `SECOND_LANGUAGE_LETTER` nói những chữ cái nào và vì sao chúng quan trọng, chứ không nói rằng nó là một regex. So với `hasBlock` bên trong `requireExportJsdoc.create`, vốn là toàn bộ những gì rule thật sự đọc |
| `COMMENTS-2` | `@canon-fe` | Ba ca invalid là cùng một câu văn ở ba vị trí: một comment, một chuỗi, một mảnh template. Bộ ba đó chính là lập luận về tầm với của rule, viết dưới dạng test |
| `COMMENTS-3` | `@canon-fe` | `CONTENT_PATHS` và `isContentFile` cho hai ngoại lệ đường dẫn, `OK_PRAGMA` và tập `marked` bên trong `noSecondLanguageInSource.create` cho ngoại lệ thứ ba. Các ca valid ở tên file `LOCALE` và `FIXTURE` trong test song sinh cho thấy từng ngoại lệ đều được chạy qua |
| `COMMENTS-4` | `@canon-fe` | `hasEmoji`, và khối giải thích vì sao nó là hai phép thử chứ không phải một lớp ký tự. Ca cặp regional-indicator trong test song sinh chính là ca mà một phép thử một-pictograph bỏ sót |
| `COMMENTS-5` | `@canon-fe` | Khối một dòng trên `normalizePath`: nó nói vì sao chọn dấu gạch chéo xuôi, chứ không nói rằng có một phép replace. Bản chép lại của chính khối ấy sẽ hợp lệ ở khắp nơi và không dạy được gì |
| `COMMENTS-6` | `@canon-fe` | Khối phía trên `const marked` bên trong `noSecondLanguageInSource.create`: nó ghi lại phần miễn trừ trước đây kiểm cái gì, vì sao không cách diễn đạt nào thoả được nó, và vì sao chính fixture valid của rule lại đi qua vì một lý do sai. Đó là một lần từ chối mà người đọc nếu không biết sẽ hoàn tác |

Mọi điểm neo trên đều là source lint nằm trong trust tree, tức là phần code repository này thật sự mở
ra được. Không điểm neo nào thuộc cây component kiểm chứng được từ đây; giới hạn ấy được ghi nhận như
một khoảng hở, thay vì che đi bằng một đường dẫn không ai kiểm được.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| site | Đây là vị trí chữ nghĩa nào: block comment, line comment, tên biến, string literal, mảnh template, chữ JSX hay thông báo lỗi |
| file | Đường dẫn, và nó có khớp một đường dẫn nội dung hay không — từ điển locale, fixture, test hay spec |
| binding | Khai báo có được export hay không, và vì thế có bị đọc bởi những người không bao giờ mở phần thân hay không |
| runtime role | Một literal là văn xuôi cho người đọc, hay là giá trị mà chương trình khớp vào hoặc phát ra |
| claim | Comment khẳng định điều gì mà dòng bên dưới chưa nói |
| refusal | Phương án nào đã thử và đã bị từ chối, và nó tốn gì |

## Quy tắc

1. Mọi export mở đầu bằng một khối tài liệu. Helper nội bộ không bắt buộc có khối.
2. Khối tài liệu nói vai trò. Chữ ký đã tự nói chữ ký rồi, theo một cách không bao giờ lạc hậu.
3. Mọi vị trí authoring là tiếng Anh: comment, JSDoc, tên biến, literal, mảnh template, chữ JSX, thông
   báo lỗi.
4. Dời một câu từ comment sang một cái tên không phải là dịch nó, và cũng không miễn trừ nó.
5. Ngoại lệ có đúng ba, đóng, và được gọi tên. Nội dung locale, fixture nguyên văn, literal chức năng
   có đánh dấu.
6. Một literal chức năng bằng ngôn ngữ khác mang lý do trên chính dòng của nó. Không đánh dấu thì nó
   không phân biệt được với văn xuôi ai đó quên dịch.
7. Không pictograph Unicode ở vị trí authoring. Ký hiệu chung lấy từ bộ từ vựng icon; reaction của sản
   phẩm dùng artwork đã check-in có ghi nguồn, qua leaf reaction.
8. Comment chép lại dòng của nó thì xoá, không sửa cho hay hơn.
9. Comment đi tranh luận thì nêu tên quyết định mà nó tranh luận với.
10. Mọi vị trí chữ nghĩa quy về đúng một mã. Không có dòng nào ngắn tới mức nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ đóng và nêu rõ mã nó áp dụng.

- **Nội dung locale không phải authoring** (`COMMENTS-3`). Từ điển dịch CHÍNH LÀ ngôn ngữ kia. Bắt nó
  theo `COMMENTS-2` là làm rỗng sản phẩm.
- **Fixture tái tạo một chuỗi có thật, đúng nguyên văn** (`COMMENTS-3`). Dịch đi rồi thì nó đang test
  một thứ khác.
- **Literal chức năng ở lại, kèm dấu** (`COMMENTS-3`). Một giá trị mà chương trình đang chạy khớp vào
  hoặc phát ra thì không phải văn xuôi. Cái dấu nằm trên chính dòng của nó và mang theo lý do, và cái
  dấu chính là điểm mấu chốt: không có nó thì người đọc phải tự quyết, và người kế tiếp quyết khác đi.
- **Helper nội bộ không bắt buộc khối tài liệu** (`COMMENTS-1`). Bắt buộc mọi helper phải có khối sẽ
  đẻ ra một file mà nửa số dòng là nghi thức và không khối nào còn được đọc.
- **Re-export không có khai báo nào để tài liệu hoá** (`COMMENTS-1`). `export { X }` nói một binding
  chứ không nói một hợp đồng; hợp đồng nằm ở chỗ `X` được khai báo.
- **Ngoại lệ là đường dẫn, không phải phán đoán** (`COMMENTS-3`). Một ngoại lệ dựa trên phán đoán sẽ
  bị tranh cãi lại ở từng file, mãi mãi, và phần thắng luôn thuộc về người đang vội.

## Đầu ra

Mỗi vị trí chữ nghĩa mà shape đã duyệt sinh ra thì một khối.

```text
site: <comment | jsdoc | identifier | literal | template | jsx-text | diagnostic>
file: <path> (<authoring | content>)
code: <COMMENTS-1 | COMMENTS-2 | COMMENTS-3 | COMMENTS-4 | COMMENTS-5 | COMMENTS-6>
tier: <enforced: <rule name> | documented>
verdict: <keep | rewrite | delete | mark | move to the icon vocabulary>
reason: <what a reader learns here that the line does not already say>
```

## Ví dụ đã giải

Shape đã duyệt: một component badge trạng thái được export từ một file authoring, nó ánh xạ một chuỗi
trạng thái nhận nguyên văn từ hệ thống bên thứ ba sang một nhãn, và từ điển locale của nó giữ phần chữ
nhãn đã dịch.

```text
site: jsdoc
file: <authoring file holding the exported component> (authoring)
code: COMMENTS-1
tier: enforced: starci-fe/require-export-jsdoc
verdict: rewrite
reason: the export is read by callers who never open the body, so the block must name the role — this is COMMENTS-1 and not COMMENTS-5 because the fact that decides it is the `export` keyword, not the wording of any sentence
```

```text
site: literal
file: <authoring file holding the exported component> (authoring)
code: COMMENTS-3
tier: enforced: starci-fe/no-second-language-in-source
verdict: mark
reason: the third-party status string is matched with `===`, so translating it would change program behaviour — this is COMMENTS-3 and not COMMENTS-2 because the fact that decides it is the runtime role of the literal, not the language it happens to be in
```

```text
site: literal
file: <locale dictionary path> (content)
code: COMMENTS-3
tier: enforced: starci-fe/no-second-language-in-source
verdict: keep
reason: a translation dictionary IS the other language — this is COMMENTS-3 and not COMMENTS-2 because the fact that decides it is the content path, not a judgement about the string
```

```text
site: jsx-text
file: <authoring file holding the exported component> (authoring)
code: COMMENTS-4
tier: enforced: starci-fe/no-emoji-in-source
verdict: move to the icon vocabulary
reason: a pictograph renders and sorts differently per platform and does not mean the same thing in two countries — this is COMMENTS-4 and not COMMENTS-3 because content files are exempt from the LANGUAGE rule only, and the law exempts no pictograph anywhere
```

Điều shape không nói, và vì thế không giải quyết được: một comment đã có sẵn trong file đó có mang
thêm thông tin gì so với dòng bên dưới nó hay không, và phương án nào đã bị từ chối khi phép ánh xạ
này được viết đúng theo cách đang thấy. `COMMENTS-5` và `COMMENTS-6` không giải được từ shape đã
duyệt. Cả hai đều là `documented` — không rule nào báo chúng, và lần từ chối mà `COMMENTS-6` đòi thì
hoàn toàn không nằm trong cây, nên chỉ người đọc biết phương án kia mới thấy nó đang thiếu. Cũng lưu ý
rằng cái dấu sinh ra cho literal chức năng chỉ được kiểm sự hiện diện: lý do đứng sau `vn-ok:` không
bao giờ được đọc, và `// vn-ok:` không có gì phía sau vẫn đi lọt.

## Phạm vi

Module này phát biểu một quy tắc đúng với mọi front end. Nó không gọi tên sản phẩm nào, thư viện
component nào, khoá registry nào hay repository nào. Mọi ví dụ đều là TSX thông thường. Ở chỗ quy tắc
chạm tới một component riêng tư, module gọi tên VAI TRÒ của component đó — leaf reaction, bộ từ vựng
icon — chứ không bao giờ gọi định danh của nó trong một codebase cụ thể.

MỘT ĐỊNH DANH ĐƯỢC SHIP KHÔNG PHẢI LÀ TÊN SẢN PHẨM THEO NGHĨA NÀY. Một rule được trích dẫn bằng tên
công bố của nó, kèm cả tiền tố plugin, vì đó đúng là chuỗi mà build log in ra và mà một disable comment
mang theo. Một trích dẫn không dán vào ô tìm kiếm được thì không phải trích dẫn. Điều lệnh cấm ở trên
cấm là VĂN XUÔI và VÍ DỤ phải có một sản phẩm mới hiểu được — chứ không bao giờ cấm một định danh mà ai
đó sẽ đọc thấy trong một lần lỗi và phải tra lại.
