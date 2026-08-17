---
title: Comments · Vietnamese
---

# Chú thích trong source

Đầu vào của pattern này là một shape đã được duyệt: một ranh giới module, một capability, một contract,
một enum, một export mà ai đó đã quyết định là phải có. Pattern không mở lại quyết định ấy. Đầu ra của
nó là kiến trúc source — khai báo nào mở đầu bằng doc block, doc block ấy phải nói gì, dòng nào mang
theo một lý do, prose nào viết bằng tiếng Anh, chuỗi nào là dữ liệu phải giữ nguyên và mang một marker
nói vì sao nó ở lại.

## Luật

Một comment trả lời đúng một câu mà code không tự trả lời được: **tại sao**. Code làm gì thì bản thân
code đã nói, bằng một ngôn ngữ được thiết kế để diễn đạt điều đó chính xác. Viết lại điều đó bằng tiếng
Anh là tạo ra bản mô tả thứ hai cho cùng một sự việc, và bản thứ hai không có compiler nào đứng sau —
nên nó trôi ngay lần đầu tiên code đổi mà không ai sửa câu văn nằm cạnh.

Câu tự hỏi quyết định một comment có đáng tồn tại không: **người đọc có tự suy ra được điều này từ đoạn
code đang nằm trước mắt họ không?** Có thì xoá. Không — một ràng buộc sống ngoài file này, một quyết
định trông tuỳ tiện mà không tuỳ tiện, một bug mà hình dạng này ngăn được — thì viết xuống, vì thông tin
ấy sắp mất.

Hai hệ quả đi ra từ cùng một luật mà người đọc thường không nối vào với nhau. Một export phải mở đầu
bằng doc block, vì bề mặt mà file khác phụ thuộc vào được đọc ở dòng import bởi một người sẽ không bao
giờ mở file ra, và tên cùng chữ ký chỉ nói nó NHẬN VÀO gì, không bao giờ nói nó để làm gì. Và một member
enum phải nói hậu quả của việc chọn nó, vì member được chọn ở một call site nằm xa cái switch đã cho nó
ý nghĩa.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi export, mọi member enum, mọi comment và mọi ký tự
non-ASCII trong cây source đều rơi vào đúng một mã dưới đây. Không có khai báo nào nhỏ đến mức được
miễn: một arrow function một dòng vẫn trả lời `COMMENT-1`, đúng cùng lý do với một service class. Câu
"có mỗi một helper thôi mà" là chỗ luật này bị bỏ qua nhiều nhất, và helper chính là thứ có thêm ba
người gọi trước khi có ai đọc lại nó.

Ba trong năm mã có một lint rule đứng sau, và một trong ba cái đó chỉ nhìn được nửa phần mà mã của nó
đòi. Bảng tầng giữ bên dưới nói rõ cái nào là cái nào, thay vì để người đọc tưởng cả năm mã được canh
đều nhau.

Thứ giữ luật này là `@starci/eslint-canon-be`.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `COMMENT-<n>`. Các con số là CỐ ĐỊNH: chúng được trích
dẫn từ các luật anh em và từ các bản ghi task cũ, nên đánh số lại là âm thầm làm hỏng một trích dẫn ai
đó đã viết ra rồi.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `COMMENT-1` | Một thứ rời khỏi file và file khác import nó | Mọi export CÓ BỀ MẶT — class, interface, type alias, enum, function, một const gắn với một function — mở đầu bằng doc block nói nó DÙNG ĐỂ LÀM GÌ và khi nào nên chọn nó. Không bao giờ có export không doc mà file khác import; không bao giờ có doc block chỉ chép lại cái tên đã khai báo |
| `COMMENT-2` | Một member enum được chọn ở call site, xa chỗ quyết định ý nghĩa của nó | Mọi member của enum được export có doc riêng, và doc ấy nói HẬU QUẢ của việc chọn member đó. Không bao giờ có member không doc; không bao giờ có doc chép lại chính tên member ("trạng thái pending") |
| `COMMENT-3` | Có một lý do sống NGOÀI dòng code | Comment mang một lý do sống NGOÀI dòng nằm dưới nó — một điểm quái của nhà cung cấp, một ràng buộc schema, một thứ tự trông tuỳ tiện, một bug mà hình dạng này ngăn được. Không bao giờ có câu văn mô tả lại bằng tiếng Anh chính câu lệnh nằm dưới |
| `COMMENT-4` | Người đọc tiếp theo không cùng tiếng mẹ đẻ với người viết | Prose trong source là tiếng Anh, không mang chữ cái tiếng Việt, không emoji, không ký hiệu trang trí đứng thay một từ. Không bao giờ có comment bằng ngôn ngữ thứ hai; không bao giờ dùng emoji hay dấu tích làm nghĩa; không bao giờ có banner vẽ bằng ký hiệu trang trí |
| `COMMENT-5` | Chuỗi mà chương trình SO KHỚP hoặc PHÁT RA | Văn bản chương trình so khớp hoặc phát ra được giữ đúng như chương trình cần, và dòng đó mang marker `vn-ok: <reason>` nói vì sao nó ở lại. Không bao giờ dịch một literal mà hành vi phụ thuộc vào; không bao giờ để `vn-ok` trống lý do; không bao giờ dùng marker để lách prose vào |

Năm mã, và dừng ở năm. Một tình huống thật sự không có mã là một thay đổi luật được ghi vào changelog,
không phải một số thứ sáu thêm vào cho tiện.

`COMMENT-1` và `COMMENT-2` là cùng một câu nói về hai bề mặt khác nhau, và chúng vẫn là hai mã vì chúng
hỏng theo hai kiểu và được giữ bằng hai cách. Một export không doc bị rule bắt trọn; doc của một member
enum thì rule chỉ thấy được là nó TỒN TẠI, và không bao giờ thấy được nó có nói hậu quả hay không. Gộp
hai mã lại là giấu đi đúng cái bất đối xứng ấy.

`COMMENT-4` KHÔNG phải "chỉ được dùng ASCII", và đây là chỗ dễ đọc nhầm nhất của module. Nó từ chối ba
lớp ký tự vì ba lý do riêng — chữ cái tiếng Việt, emoji, ký hiệu trang trí — và để yên dấu câu kiểu
chữ. Một em dash, một middle dot và một khung kẻ trong banner comment không thuộc bất kỳ lớp nào trong
ba lớp luật từ chối, và một rule cấm chúng là một luật nghiêm hơn đang được bịa ra chứ không phải luật
này đang được ghi lại.

## Đọc một shape đã duyệt

1. **Đọc xem shape nói gì.** Nó nêu ra các khai báo đang tồn tại: symbol nào rời khỏi file, cái nào có
   bề mặt, enum nào được export và mang những member nào, dòng nào phụ thuộc vào một dữ kiện nằm ngoài
   file.
2. **Đọc xem shape KHÔNG nói gì, và vì thế không giải được gì.** Một shape đã duyệt không bao giờ nói ra
   câu văn sẽ nằm trong doc block, không nói hậu quả của việc chọn một member, và không nói lý do khiến
   một dòng phải viết như vậy. Những thứ đó được cấp ở đây, từ đầu vào `reason` và `consequence`, nếu
   không thì pattern không giải được.
3. **Giải từ ngoài vào trong.** Lấy khai báo trước member: chốt `COMMENT-1` cho cả enum, rồi mới
   `COMMENT-2` cho từng member. Chốt lane của file trước khi xét một dòng, vì lane quyết định `COMMENT-4`
   có áp vào đó hay không.
4. **Hỏi câu hỏi của từng mã theo thứ tự.** Thứ này có rời khỏi file với một bề mặt không (`COMMENT-1`)?
   Nó có phải member của một enum được export không (`COMMENT-2`)? Dòng này có cần một dữ kiện nằm ngoài
   chính nó không (`COMMENT-3`)? Đây có phải prose, và nó viết bằng gì (`COMMENT-4`)? Chương trình có so
   khớp hoặc phát ra literal này không (`COMMENT-5`)?
5. **Khi hai mã cùng khớp, chúng đang hỏi hai câu khác nhau và cả hai đều hiệu lực.** Một doc block chép
   lại cái tên đã khai báo thoả hình dạng của `COMMENT-1` và vi phạm `COMMENT-3`; viết một lần sao cho
   cả hai đều được trả lời. Một câu tiếng Việt giải thích một race vi phạm `COMMENT-4` chứ không vi phạm
   `COMMENT-3`. Thứ phân định giữa `COMMENT-4` và `COMMENT-5` không bao giờ là bảng chữ cái — mà là việc
   chương trình có phụ thuộc vào literal đó hay không.

## `COMMENT-1` — mọi export mở đầu bằng một doc block

**Tình huống.** Một class, interface, type, enum, function, hoặc một `const` gắn với một function — tức
là một thứ CÓ BỀ MẶT — được export ra. Đây chính là phần file khác phụ thuộc vào, và người quyết định có
dùng nó hay không thường không mở file này ra. Họ chỉ nhìn thấy cái tên ở dòng import và chữ ký khi
hover.

**Nó sinh ra gì trong source.** Một doc block nằm ngay trên khai báo được export, nói symbol ấy DÙNG ĐỂ
LÀM GÌ và khi nào nên chọn nó thay vì thứ nằm ngay bên cạnh. Tên cùng chữ ký cho biết nó NHẬN VÀO gì;
chúng không bao giờ nói được nó để làm gì.

**Dấu hiệu nhận biết.** Có từ khoá `export` trước một khai báo có bề mặt. Có ít nhất một file khác import
nó — hoặc sẽ có, ngay khi ai đó cần. Có một thứ nằm cạnh trông giống hệt, và người đọc phải chọn giữa
hai thứ đó. Tự hỏi: người đọc ở dòng import có biết vì sao họ nên gọi thứ này không? Nếu không thì đang
thiếu doc.

**Ranh giới.** Đây KHÔNG phải trường hợp hằng số dữ liệu: `export const MAX_ATTEMPTS = 3` không thuộc mã
này, vì cái tên đã là mô tả đầy đủ và bắt viết một câu bên cạnh chỉ đẻ ra câu chép lại tên — mà chép lại
tên là `COMMENT-3` vi phạm. Nó KHÔNG phải trường hợp re-export: `export { X } from "./x"` không khai báo
gì cả nên không có chỗ để gắn doc, và doc thuộc về nơi khai báo. Và nó KHÔNG phải `COMMENT-3`: một doc
block chỉ chép lại cái tên không làm mã này thoả — nó qua được cổng lint và vi phạm luật, đây là kiểu vi
phạm phổ biến nhất của cả module.

**Tình huống nghiệp vụ hay gặp.** Decorator inject đúng connection · service class trong tầng dùng chung
· interface làm payload giữa hai module · type alias mô tả một shape trả về · guard · pipe · factory
dựng client cho một hệ thống ngoài · util được ba nơi gọi.

## `COMMENT-2` — mỗi member enum nói hậu quả của việc chọn nó

**Tình huống.** Một enum được export ra. Member của nó được CHỌN Ở CALL SITE, còn ý nghĩa của member thì
nằm ở một `switch` hoặc một bảng tra Ở FILE KHÁC. Người viết call site không mở file kia ra.

**Nó sinh ra gì trong source.** Một doc block trên từng member, trả lời: chọn cái này thì hệ thống làm
gì? `Pending` viết thành "trạng thái pending" là một dòng không dạy được gì cả. "Chưa có khoản thanh
toán nào settle, nên chưa cấp quyền gì và giỏ hàng vẫn sửa được" mới là dữ kiện người viết tiếp theo cần
và không tự suy ra được.

**Dấu hiệu nhận biết.** Enum có `export`. Có ít nhất một chỗ `switch` trên nó, hoặc một bảng map từ
member sang hành vi. Đọc riêng tên member thì không đoán được hệ thống sẽ làm gì. Tự hỏi: nếu tôi chọn
member này ở một call site, cái gì thay đổi ở phía sau? Câu trả lời đó CHÍNH LÀ nội dung doc.

**Ranh giới.** Đây KHÔNG phải `COMMENT-1`: `COMMENT-1` là doc của CẢ ENUM — enum này để làm gì; mã này
là doc của TỪNG MEMBER — chọn member này thì sao. Một enum có doc ở trên mà member trống rỗng vẫn vi
phạm. Và nó KHÔNG phải `COMMENT-3`: doc chép lại tên member (`/** Trạng thái settled. */`) là `COMMENT-3`
vi phạm, dù cổng lint xanh.

**Tình huống nghiệp vụ hay gặp.** Trạng thái thanh toán · phân loại lỗi để quyết định retry hay disable
· trạng thái key trong pool · loại quyền · mức độ nghiêm trọng của log · loại sự kiện phát ra ngoài · lý
do từ chối · giai đoạn của một phiên chấm.

## `COMMENT-3` — comment nói tại sao, code nói cái gì

**Tình huống.** Có một lý do NẰM NGOÀI dòng code khiến dòng đó phải viết như vậy: một hệ thống ngoài gửi
webhook hai lần, một ràng buộc từ schema, một thứ tự trông tuỳ tiện mà không tuỳ tiện, một bug mà hình
dạng này ngăn được, một race giữa hai replica.

**Nó sinh ra gì trong source.** Một câu văn phía trên dòng, mang theo dữ kiện bên ngoài ấy — và không có
gì mô tả lại câu lệnh nằm dưới. Comment chép lại dòng bên dưới TỆ HƠN không có comment: nó nhân đôi chi
phí bảo trì và trở thành phần sẽ âm thầm sai, vì không có gì hỏng khi một câu văn thôi đúng.

**Dấu hiệu nhận biết.** Xoá câu comment đi thì code vẫn compile, vẫn chạy, nhưng không còn giải thích
được. Câu comment nói về một thứ không xuất hiện trong dòng bên dưới: một hệ thống khác, một lần chạy
khác, một trường hợp biên, một lần đã hỏng trong quá khứ. Dấu hiệu vi phạm thì ngược lại: đọc câu comment
rồi đọc dòng code, thấy cùng một thông tin hai lần. Tự hỏi: câu này có nói điều gì mà dòng code bên dưới
không nói không?

**Ranh giới.** Đây KHÔNG phải `COMMENT-1` theo nghĩa được cổng của `COMMENT-1` làm cho thoả: doc block
của một export cũng phải thoả mã này — doc "Inject the primary entity manager" đứng trên
`InjectPrimaryEntityManager` là chép lại tên, có doc mà vẫn sai. Và nó KHÔNG phải `COMMENT-4`: mã này hỏi
comment NÓI GÌ, `COMMENT-4` hỏi comment VIẾT BẰNG GÌ. Một câu tiếng Việt giải thích một race vi phạm
`COMMENT-4` chứ không vi phạm mã này.

**Tình huống nghiệp vụ hay gặp.** Webhook gửi trùng · `RETURNING id` để biết txn nào thắng race · thứ tự
gọi bắt buộc vì một bên ghi cache · một `try/catch` nuốt lỗi có chủ ý vì lần chạy sau tự lành · một index
bắt buộc phải có vì query này quét toàn bảng · một giá trị hằng số lấy từ giới hạn của bên thứ ba.

## `COMMENT-4` — prose trong source là tiếng Anh, không emoji, không trang trí

**Tình huống.** Không phải vì tiếng Anh hay hơn. Một codebase có HAI ngôn ngữ là một codebase có ít nhất
một người đọc mà một nửa phần lập luận không đọc được — và đúng nửa đó là nửa giải thích những chỗ bất
ngờ. Chỗ hiển nhiên thì ai cũng đọc được từ code; chỗ cần comment mới là chỗ mất.

**Nó sinh ra gì trong source.** Prose tiếng Anh trong mọi comment, log message, tên biến và message của
exception nội bộ. Emoji và ký hiệu trang trí bị từ chối vì lý do khác: chúng mang SẮC THÁI chứ không mang
THÔNG TIN, và sắc thái là thứ mỗi người đọc ra một kiểu. Một dấu tích trong comment không nói được nó
nghĩa là "đã kiểm", "đã xong", hay "đúng".

Đây KHÔNG phải "chỉ được dùng ASCII" — chỗ dễ đọc nhầm nhất của module. Luật từ chối BA lớp ký tự, mỗi
lớp một lý do: (1) chữ cái tiếng Việt, vì người đọc không cùng tiếng mẹ đẻ mất nửa lập luận; (2) emoji,
vì mang sắc thái thay vì thông tin; (3) ký hiệu trang trí đứng thay một từ — dấu tích, dấu nhân, mũi tên
dùng làm trang trí — cùng lý do với emoji. Dấu câu kiểu chữ (em dash, middle dot, ellipsis, khung kẻ
trong banner comment) không thuộc ba lớp trên và ĐƯỢC GIỮ. Bản đầu tiên của rule cấm mọi codepoint ngoài
ASCII; đo trên một back end thật thì báo 857 chỗ — và TẤT CẢ đều là em dash, khung kẻ hoặc middle dot. Đó
không phải luật này đang được ghi lại, đó là một luật nghiêm hơn đang được bịa ra, và bịa luật là thứ duy
nhất canon không được làm.

**Dấu hiệu nhận biết.** Một comment giải thích lý do, viết bằng tiếng Việt. Một emoji trong log message
hoặc trong banner. Một dấu tích, dấu nhân hay ngôi sao đứng thay cho một từ. Tự hỏi: một người không đọc
được tiếng Việt mở file này ra, họ mất phần nào của lập luận?

**Ranh giới.** Đây KHÔNG phải `COMMENT-5`, và đó là ranh giới quan trọng nhất của cả module: mã này nói
về PROSE, `COMMENT-5` nói về DỮ LIỆU tình cờ có hình dạng văn xuôi. Một câu tiếng Việt chương trình SO
KHỚP hoặc PHÁT RA không phải comment, và dịch nó là làm hỏng chương trình. Nó KHÔNG phải lane fixture:
trong spec hoặc trong cây test, CHUỖI là dữ liệu còn comment vẫn là prose — một spec đưa cho hệ thống
đúng câu mà người dùng thật sẽ gõ là đang đưa dữ liệu, và dịch nó ra tiếng Anh là đi test một hệ thống
không ai dùng. Đo trước khi viết ngoại lệ này: 92 finding trong một back end thì 89 là chuỗi fixture, 3
là comment; bắt đánh dấu cả 92 nghĩa là đặt marker lên từng dòng của từng hội thoại fixture, tức là dạy
người đọc thôi nhìn thấy marker. Và nó KHÔNG phải lane locale: file nằm dưới `messages/`, `locales/` hay
`i18n/` là toàn bộ product copy, đi soi chúng là đi soi sản phẩm. Nó cũng không phải trường hợp endonym:
`Tiếng Việt` viết ra như TÊN của một locale là một nhãn, không phải prose bằng tiếng Việt, và được miễn.

**Tình huống nghiệp vụ hay gặp.** Comment giải thích một quyết định trong service · banner phân đoạn
trong một file dài · TODO còn lại từ một phiên trước · log message · tên biến · message của một exception
nội bộ.

## `COMMENT-5` — chuỗi chương trình phụ thuộc không phải comment

**Tình huống.** Một chuỗi tiếng Việt nằm trong source, nhưng nó KHÔNG phải lời của lập trình viên nói với
lập trình viên. Nó là DỮ LIỆU: một message trả về cho client theo locale, một chuỗi hệ thống ngoài gửi
sang mà mình đem ra so sánh, một pattern khớp vào nội dung người dùng thật đã viết, một nhãn mà một model
bắt buộc phải phát ra đúng như thế, một fixture mô phỏng đúng câu người dùng sẽ gõ.

**Nó sinh ra gì trong source.** Chính literal ấy, giữ nguyên, kèm marker `vn-ok: <reason>` trên dòng nói
vì sao nó ở lại — để đợt rà soát sau không "sửa" nó thành bug. Dịch những thứ này làm hỏng chương trình,
và hỏng theo kiểu tệ nhất: IM LẶNG. Một regex dịch sai không ném lỗi, nó chỉ không bao giờ khớp nữa. Một
nhánh so sánh dịch sai không đỏ, nó chỉ không bao giờ đúng nữa.

**Dấu hiệu nhận biết.** Chuỗi nằm ở vế phải của một phép so sánh, trong một regex, trong một map theo
locale, hoặc trong một prompt template mà model phải phát lại đúng nguyên văn. Có một hệ thống BÊN NGOÀI
quyết định nội dung chuỗi đó, không phải mình. Đổi chuỗi thì HÀNH VI đổi, chứ không phải chỉ chữ hiển thị
đổi. Tự hỏi: chuỗi này có phải của mình để đổi không? Nếu không thì nó là dữ liệu.

**Ranh giới.** Đây KHÔNG phải `COMMENT-4`: prose thì dịch, dữ liệu thì giữ và đánh dấu. Nó KHÔNG phải
marker rỗng: một `vn-ok` KHÔNG CÓ lý do không phải ngoại lệ — marker tồn tại để đợt rà soát sau đọc được
vì sao dòng đó ở lại, không có lý do thì nó chỉ là một cách tắt cổng. Và nó KHÔNG phải giấy phép giữ một
comment: dùng `vn-ok` để giữ một COMMENT tiếng Việt là biến ngoại lệ thành lỗ hổng. Ngoại lệ này dành cho
CHUỖI, không dành cho lời giải thích.

**Tình huống nghiệp vụ hay gặp.** Message thành công theo locale trả cho client · so sánh với message của
cổng thanh toán · regex bắt heading trong bài viết thật · nhãn cố định model phải phát ra · nội dung mẫu
trong prompt template · fixture hội thoại trong spec · nội dung email theo locale.

## Tầng giữ

Tầng nào thật sự giữ từng mã. `unrepresentable` nghĩa là một union đóng hoặc một branded type làm cho giá
trị sai không viết ra được; `enforced` nghĩa là một lint rule trong `@starci/eslint-canon-be` bắt được;
`documented` nghĩa là không có gì cơ học giữ nó, chỉ có người đọc giữ.

| Mã | Tầng | Thứ giữ nó |
|---|---|---|
| `COMMENT-1` | `enforced` | `require-export-jsdoc` (export `requireExportJsdoc`). Thấy được sự VẮNG MẶT của doc block. Không thấy được doc có nói export ấy để làm gì hay không |
| `COMMENT-2` | `enforced` | `require-enum-member-jsdoc` (export `requireEnumMemberJsdoc`). Thấy được member có doc. Nửa hậu quả do người đọc, và chính message của rule nói ra điều đó |
| `COMMENT-3` | `documented` | — |
| `COMMENT-4` | `enforced` | `no-non-ascii-source` (export `noNonAsciiSource`). Một rule cho ba lớp ký tự, nên không thể làm nó thoả bằng cách đổi bảng chữ cái |
| `COMMENT-5` | `documented` | — |

**Ba enforced, hai documented, không có cái nào unrepresentable.** Cột `unrepresentable` trống là chuyện
cấu trúc chứ không phải thiếu sót: một comment không phải một giá trị. Không union đóng nào và không
branded type nào làm cho một câu sai trở thành không viết được, vì hệ kiểu không bao giờ đọc câu văn.
`/** The pending state. */` type-check được ở mọi vị trí mà một doc đúng type-check được. Đó chính là
toàn bộ lý do module này tồn tại dưới dạng văn xuôi.

Hai trong ba dòng enforced hẹp hơn mã mà chúng giữ, và cái hẹp ấy là chủ ý chứ không phải chuyện đáng
xấu hổ:

- `require-export-jsdoc` cố ý bỏ qua hằng số dữ liệu. `export const MAX_ATTEMPTS = 3` đã được chính cái
  tên mô tả đầy đủ, và đòi một câu văn ở đó chỉ đẻ ra những câu chép lại tên — thứ mà `COMMENT-3` cấm.
  Chỉ khai báo có bề mặt mới được thăm, và một const chỉ được thăm khi nó gắn với một function.
- `require-enum-member-jsdoc` giữ nửa TỒN TẠI của `COMMENT-2` và không giữ chút nào nửa hậu quả. Một
  member ghi doc là "the settled state" qua được cổng và trượt luật.

Cả hai dòng `documented` và cả hai khoảng hở enforcement vẫn là rủi ro còn mở, kèm theo điều mà một rule
sẽ phải THẤY được thì mới giữ nổi chúng — và, với hai trong số đó, vì sao không rule nào thấy được.

## Điểm neo

Code thật để đối chiếu từng luật. Một luật không chỉ tay vào được thì chỉ là một đề xuất.

| Mã | Điểm neo | Cần nhìn gì |
|---|---|---|
| `COMMENT-1` | `modules/databases/postgresql/primary/primary.decorators.ts` → `InjectPrimaryPostgreSQLEntityManager` | Một arrow function một dòng được export mà doc block dài ba dòng, vì toàn bộ rủi ro vô hình trong chữ ký: sai connection thì kiểu vẫn y hệt và đọc nhầm dữ liệu. Đây là điểm neo cho "không khai báo nào nhỏ đến mức được miễn" |
| `COMMENT-1` | `modules/databases/postgresql/primary/constants/connection.ts` | Mặt bên kia của cùng một rule: một hằng số dữ liệu thuần, không doc block, không finding. Đọc nó cạnh cái decorator để thấy chỗ vạch ngoại lệ của rule |
| `COMMENT-2` | `modules/ai/balancer/enums/ai-error-kind.ts` → `AiErrorKind` | Bốn member, bốn hậu quả — disable cứng key, cooldown ngắn, cooldown nhẹ, không phạt. Không cái nào trong bốn suy ra được từ tên member, và mỗi cái được chọn ở một call site xa cái switch hành động trên nó |
| `COMMENT-2` | `modules/ai/balancer/enums/key-status.ts` | Một enum thứ hai trong cùng thư mục, để cặp này cho thấy hình dạng đứng vững trên cả một họ chứ không phải trong một file may mắn |
| `COMMENT-3` | `modules/bussiness/streak/streak-freeze-cron.service.ts` (khối insert-and-spend) | Ví dụ sống rõ nhất về một lý do nằm ngoài dòng: vì sao `RETURNING id` được đọc, vì sao không có dòng nào bị ảnh hưởng nghĩa là phải xoá dòng tạm chứ không phải retry, và vì sao một replica đang đua mới là trường hợp đang được phòng. Xoá những câu ấy đi thì code vẫn compile và thôi giải thích được |
| `COMMENT-4` | `eslint.config.mjs` (khối rule nối plugin back end) | Chỗ mã này được bật cho cả cây, ở mức `error`. Cũng là điểm neo cho một drift đã ghi nhận: config tiêu thụ vẫn nối ba rule cũ mà canon đã thay bằng một |
| `COMMENT-4` | `tests/harness/ai-tutor.harness-spec.ts` | Lane fixture, hiện ra rõ: một chỉ dẫn tiếng Việt chính là toàn bộ mục đích của fixture, còn prose của file vẫn là tiếng Anh. Đây là ranh giới giữa "prose bằng ngôn ngữ thứ hai" và "dữ liệu tình cờ là văn xuôi" |
| `COMMENT-5` | `features/api/core/graphql/queries/contents/content/content.handler.ts` (regex bắt heading, có đánh dấu `vn-ok`) | Một pattern KHỚP vào nội dung người dùng thật đã viết. Dịch literal đi thì nhánh thôi khớp bất cứ gì, một cách im lặng — không test nào đỏ vì một regex đơn giản là không bao giờ chạy |
| `COMMENT-5` | `features/api/core/graphql/mutations/**/*.resolver.ts` (message thành công theo locale) | Mặt PHÁT RA của cùng một mã, lặp trên toàn bộ bề mặt mutation với một mệnh đề lý do trên từng dòng. Đọc nó như bài kiểm tra khối lượng: marker chỉ sống nổi qua hàng trăm lần viết vì mỗi lần nó đều mang theo một lý do |

Mọi mã đều đã neo. Không mã nào còn chưa neo được.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| declaration | Đang khai báo cái gì, và nó có bề mặt mà file khác phụ thuộc vào hay không |
| export | Nó có rời khỏi file không, và nó có phải re-export không có gì để gắn doc hay không |
| reason | Dữ kiện nằm ngoài dòng: một điểm quái của nhà cung cấp, một ràng buộc schema, một race, một thứ tự |
| consequence | Với một member enum: CHỌN nó thì gây ra gì ở phía sau, chứ không phải nó tên là gì |
| audience | Một người đọc không cùng tiếng mẹ đẻ với người viết và sẽ không mở file này ra |
| dependence | Chương trình có SO KHỚP hoặc PHÁT RA literal đó không, đây là thứ phân định prose với dữ liệu |
| lane | File là file locale, lane fixture, hay source thường |

## Quy tắc

1. Mọi export có bề mặt mở đầu bằng một doc block.
2. Mọi member của enum được export có doc riêng, và doc ấy nói một hậu quả.
3. Comment nói tại sao; code nói cái gì. Câu chép lại dòng bên dưới thì xoá.
4. Prose trong source không mang chữ cái tiếng Việt, không emoji, không ký hiệu trang trí đứng thay một
   từ. Dấu câu kiểu chữ được giữ.
5. Một literal chương trình phụ thuộc vào thì không bao giờ bị dịch, và không bao giờ bị bỏ trống dấu:
   nó giữ nguyên hình dạng và mang `vn-ok: <reason>`.
6. Marker `vn-ok` phải mang một lý do; marker trống không phải một ngoại lệ.
7. Một doc block chép lại cái tên đã khai báo là `COMMENT-3` vi phạm khoác hình dạng `COMMENT-1`, dù cổng
   lint xanh.
8. Mọi export, mọi member và mọi comment đều rơi vào đúng một mã. Không có gì nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã nó áp
vào.

- **Hằng số dữ liệu không có bề mặt.** `COMMENT-1` không đụng tới `export const MAX_ATTEMPTS = 3`. Tên
  đã là mô tả, và bắt viết thêm một câu bên cạnh chỉ đẻ ra câu chép lại tên.
- **Re-export không có gì để document.** `export { X } from "./x"` không khai báo gì cả, nên không có
  node nào để một doc block mô tả. Doc thuộc về nơi khai báo. Áp vào `COMMENT-1`.
- **Dấu câu kiểu chữ được giữ.** `COMMENT-4` từ chối chữ cái tiếng Việt, emoji và ký hiệu trang trí. Em
  dash, middle dot, ellipsis và khung kẻ trong banner không thuộc ba lớp đó, và codebase đã dùng chúng
  có chủ ý suốt đời nó.
- **Tên của chính ngôn ngữ là một nhãn.** `Tiếng Việt` viết ra như TÊN của một locale là một định danh,
  không phải prose bằng ngôn ngữ ấy, và được miễn `COMMENT-4`.
- **File locale là product copy.** File dưới `messages/`, `locales/` hay `i18n/` là `COMMENT-5` toàn phần
  theo cấu tạo; đi soi chúng là đi soi sản phẩm, nên `COMMENT-4` không áp vào đó chút nào.
- **Trong lane fixture, chuỗi là dữ liệu còn comment vẫn là prose.** Trong spec hoặc dưới cây test,
  `COMMENT-4` chỉ soi dòng comment. Một spec đưa cho hệ thống đúng câu mà người dùng thật sẽ gõ là đang
  đưa dữ liệu, và dịch nó là đi test một hệ thống không ai dùng. Comment bằng ngôn ngữ thứ hai ở đó vẫn
  bị từ chối y như mọi nơi khác.

## Đầu ra

Một block cho mỗi file mà shape sinh ra.

```text
declaration: <the exported symbol, member, or the line the comment sits above>
path: <folder/file>
situation: <COMMENT-1 … COMMENT-5>
reason: <the fact that lives outside the line, or the consequence of choosing this member>
lane: <source | fixture | locale>
marker: <none | vn-ok: reason>
```

## Ví dụ đã giải

Shape đã duyệt: capability balancer sở hữu một enum error-kind được export, mà các member của nó quyết
định một key nhà cung cấp bị phạt ra sao khi hỏng, và resolver báo lỗi ấy trả về một message theo locale
mà client hiển thị nguyên văn.

Bản thân khai báo enum:

```text
declaration: AiErrorKind
path: src/modules/ai/balancer/enums/ai-error-kind.ts
situation: COMMENT-1
reason: names which failures the balancer distinguishes, so a caller knows whether to classify at all
lane: source
marker: none
```

`reason` — dữ kiện loại `COMMENT-2` ra là ở đây đang xét bề mặt của chính enum, không phải một member của
nó; `COMMENT-2` nói về hậu quả của việc chọn một member, mà ở đây chưa có gì được chọn. Dữ kiện loại
ngoại lệ hằng số dữ liệu ra là một enum có bề mặt mà file khác phụ thuộc vào.

Một member của enum ấy:

```text
declaration: AiErrorKind.QuotaExhausted
path: src/modules/ai/balancer/enums/ai-error-kind.ts
situation: COMMENT-2
reason: choosing it hard-disables the key rather than cooling it down, so the key never returns on its own
lane: source
marker: none
```

`reason` — dữ kiện loại `COMMENT-1` ra là enum đã có doc block riêng ở phía trên; dòng này là một member,
và doc của member được đo bằng hậu quả ở phía sau. Dữ kiện loại `COMMENT-3` ra là câu văn nói việc chọn
nó gây ra gì, chứ không chép lại tên member.

Message theo locale trên resolver:

```text
declaration: the vi success message returned by the mutation
path: src/features/api/core/graphql/mutations/**/*.resolver.ts
situation: COMMENT-5
reason: the client displays this string verbatim, so translating it changes what the user is shown
lane: source
marker: vn-ok: locale payload returned to the client
```

`reason` — dữ kiện loại `COMMENT-4` ra là chương trình PHÁT RA literal này; nó là dữ liệu có hình dạng
văn xuôi, không phải lời lập trình viên nói với lập trình viên. Dữ kiện loại marker rỗng ra là `vn-ok`
mang theo lý do ngay trên cùng dòng.

Điều shape đã duyệt không nói ra, và vì thế không giải được: nó không nói câu văn sẽ nằm trong doc block
của enum, không nói mỗi member gây ra hậu quả gì ở phía sau, và không nói message của resolver có bị đem
đi so sánh với cái gì không hay chỉ được phát ra. Những thứ đó đến từ đầu vào `reason`, `consequence` và
`dependence`. Thiếu chúng thì pattern không giải được, và không được gán mã bằng cách đoán.

## Phạm vi

Quy tắc này đúng cho mọi đoạn code back end thuộc loại này trong stack này — mọi back end mà code sống
lâu hơn trí nhớ của người viết ra nó. Nó không gọi tên một feature nào. Ví dụ là TypeScript thường trong
một ứng dụng hình dạng NestJS: chúng không gọi tên sản phẩm, repository hay khoá học nào. Các rule id là
danh từ riêng duy nhất trong bản thân luật, vì một rule id là một định danh enforcement và một rule bị
đổi tên thì không trích dẫn được trong config. Đường dẫn repository chỉ xuất hiện ở phần điểm neo và
không xuất hiện ở đâu khác — một điểm neo bắt buộc phải là đường dẫn thật, và đó chính là thứ làm nó
thành điểm neo.
