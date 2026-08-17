---
title: Exceptions · Vietnamese
---

# Ngoại lệ

Đầu vào là một shape đã được duyệt: một capability đã chốt các nhánh thất bại, một contract đã nói rõ
cái gì có thể hỏng, một handler đã chốt những lần từ chối của nó. Pattern này không mở lại câu hỏi có
những thất bại nào hay chúng tên là gì — **tên nào**, viết bằng ba bảng chữ nào, là việc của module
`exception-identity` bên cạnh. Nó chỉ hạ shape đã duyệt xuống source: class nào được khai báo, thư mục
nào giữ nó, nó extends base nào, và chỗ throw mang theo cái gì.

## Luật

Mọi thất bại do back end này sinh ra đều là một subclass của `AbstractException`, được khai báo trong
một thư mục, và được throw kèm một object metadata. Ba điều đó cùng diễn đạt một ý: **một thất bại là
một thứ có tên, mang theo dữ liệu — không phải một câu văn.**

`new Error("không tìm thấy bản ghi")` chỉ mang theo một câu tiếng Anh. Không ai ở phía dưới có thể
group, khớp, quyết định khả năng retry, dịch, hay lấy lại id từ câu đó nếu không parse nó. Exception
của framework chỉ khá hơn một chút: nó mang một HTTP status và không mang gì khác, tức là lấy mối
quan tâm về transport đứng thay cho mối quan tâm về nghiệp vụ.

Câu hỏi quyết định: **có ai ở phía dưới — một caller, một pipeline log, một client — muốn xử lý thất
bại này khác với thất bại khai báo ngay cạnh nó không?** Nếu có, nó cần class riêng, và câu trả lời
gần như luôn là có.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi `throw` trong product code đều thuộc một mã dưới
đây, và mọi khai báo `*Exception` cũng vậy. Không có thất bại nào "nội bộ" tới mức được miễn: một lỗi
cấu hình không ai bắt vẫn là `EXCEPTION-1` đúng như một lần từ chối mà client render ra, và câu "cái
này có ai bắt đâu" chính là nơi luật này bị bỏ qua nhiều nhất.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `EXCEPTION-<n>`. Mã gọi tên TÌNH HUỐNG; hai bảng tầng
giữ và điểm neo bên dưới mới nói cái gì thật sự giữ nó và kiểm được nó ở đâu trong source. Đó là ba sự
thật khác nhau, và module này cố ý tách chúng ra.

| Mã | Tình huống | Source phải trông ra sao |
|---|---|---|
| `EXCEPTION-1` | Viết một `throw` trong product code | Thứ được throw là một subclass của `AbstractException`. Không `throw new Error(...)`, và không exception của framework mang status đứng thay cho danh tính |
| `EXCEPTION-2` | Truyền dữ liệu vào chỗ throw | Constructor nhận đúng MỘT object metadata — `{}` khi không có gì để nói. Không tham số vị trí, không nhiều tham số, không `new XException()` trần |
| `EXCEPTION-3` | Khai báo một class lỗi mới | Chính dòng khai báo class extends `AbstractException`. Không phải base của framework — thứ đọc lên vẫn "đúng kiểu nhà" ở mọi chỗ throw |
| `EXCEPTION-4` | Chọn chỗ đặt file khai báo | Trong thư mục exceptions, cùng chỗ với mọi lỗi khác. Không nằm cạnh code throw nó, vô hình cho tới khi production throw nó |
| `EXCEPTION-5` | Quyết định metadata mang gì | Id, trạng thái, giới hạn — thứ mà người đọc thất bại sẽ cần. Không phải một câu đã render làm payload duy nhất |
| `EXCEPTION-6` | Một spec cần dừng vì setup hỏng | Assertion của test runner vẫn là assertion của test runner. Product code không mượn lối ra của lane test, và spec không đặt tên cho lỗi setup của chính nó như một lỗi nghiệp vụ |

`EXCEPTION-2` KHÔNG PHẢI LUẬT STYLE. Object rỗng không phải thủ tục thừa: nó giữ cho mọi `throw` trong
cả cây code có một cách viết duy nhất, để người đọc không bao giờ phải dừng lại kiểm tra xem CÁI
exception này có nhận tham số hay không. Tham số vị trí bị từ chối vì một lý do khác hẳn: hình dạng đó
không lớn lên được, và ngày mà một thất bại cần thêm trường thứ hai, mọi chỗ throw đều phải sửa —
những chỗ sửa sai vẫn compile qua.

`EXCEPTION-3` TỒN TẠI VÌ `EXCEPTION-1` KHÔNG NHÌN THẤY NÓ. Một class extends base của framework vẫn
được throw bằng chính cái tên đúng kiểu nhà của nó, nên một rule đọc chỗ throw sẽ cho nó qua. Hai nửa
này là một luật đọc từ hai đầu, và mỗi nửa đứng một mình đều để lại đúng cái lỗ mà nửa kia bịt.

`EXCEPTION-6` GỌI TÊN MỘT TÌNH HUỐNG MÀ KẾT QUẢ ĐÚNG THƯỜNG LÀ `throw new Error`. Lane test được phép
throw nó, vì ở đó nó nghĩa là "runner không đi tiếp được" chứ không đặt tên cho một thất bại mà sản
phẩm có thể sinh ra. Một flow bị cấm tự làm hỏng setup của chính nó sẽ phải bịa ra một domain exception
cho việc "thiếu fixture" — tức là đưa một thất bại của bài test vào đúng bộ từ vựng mà sản phẩm dùng
cho những thất bại thật.

## Đọc một shape đã duyệt

1. Đọc xem shape nói gì. Nó nói có những thất bại nào và mỗi thất bại nghĩa là gì — rằng một lần tra
   cứu có thể trượt, rằng một hạn mức có thể bị vượt, rằng một chuyển trạng thái có thể bị từ chối.
2. Đọc xem nó **không** nói gì, và vì thế không giải quyết gì. Nó không nói class nào được khai báo,
   class đó extends base nào, file khai báo nằm thư mục nào, hay những trường nào đi cùng chỗ throw.
   Đó là đầu ra của pattern này, và không suy ra được từ lời văn của shape.
3. Giải từ ngoài vào trong. Chốt phần khai báo trước chỗ throw: class, base của nó và thư mục của nó
   là sự thật của một file, còn câu lệnh throw được viết dựa trên chúng. Đọc chỗ throw trước khi đọc
   khai báo thì không chứng minh được gì, vì một class dựa trên base framework vẫn được throw bằng
   chính cái tên đúng kiểu nhà.
4. Hỏi lần lượt câu hỏi của từng mã. Cái gì được throw (`EXCEPTION-1`), nó được truyền theo hình dạng
   nào (`EXCEPTION-2`), khai báo extends gì (`EXCEPTION-3`), khai báo nằm đâu (`EXCEPTION-4`),
   metadata mang gì (`EXCEPTION-5`), và file này có phải lane test không (`EXCEPTION-6`).
5. Khi hai mã cùng khớp, chúng không tranh nhau — đó là hai phán quyết trên hai sự thật khác nhau, và
   cả hai đều được ghi. Một class đúng nhưng truyền tham số vị trí thì thoả `EXCEPTION-1` và vi phạm
   `EXCEPTION-2`. Một class đặt đúng chỗ nhưng extends base framework thì thoả `EXCEPTION-4` và vi
   phạm `EXCEPTION-3`. Một mã tình huống ứng với đúng một phán quyết, và không phán quyết nào phục vụ
   hai mã, nên khớp một mã không bao giờ nuốt mất mã kia.

## `EXCEPTION-1` — throw một class có tên, không phải một câu

**Tình huống.** Bạn đang ở giữa một handler, một service, một guard, và một điều kiện vừa sai. Câu
lệnh tiếp theo bạn viết quyết định mọi người phía sau còn làm được gì với thất bại này.

**Nó sinh ra gì trong source.** Một `throw new <tên>Exception({ ... })` với class là subclass của
`AbstractException`. Không phải `throw new Error("...")` — thứ mang một câu và không mang code, nên
không có gì group, khớp hay retry được nếu không parse tiếng Anh. Cũng không phải exception của
framework — thứ mang một status và không mang danh tính: hai thất bại chẳng liên quan gì nhau tới
client trông y hệt nhau, và thứ duy nhất phân biệt chúng là message, đúng cái phần sẽ bị sửa lại chữ
ở lần refactor sau.

**Dấu hiệu nhận biết.** Trong `throw` có một chuỗi tiếng Anh mô tả chuyện gì vừa xảy ra; client phải
đọc `message` mới biết đã trúng nhánh nào; alert group theo status code nên một alert 400 gom chung
sáu thất bại khác nhau; có người vừa hỏi "lỗi này retry được không" và không ai trả lời được nếu không
mở source ra đọc.

**Ranh giới.** Đây không phải `EXCEPTION-3` — cùng một cái bẫy nhìn từ đầu kia. `EXCEPTION-1` nhìn chỗ
**throw**; `EXCEPTION-3` nhìn chỗ **khai báo**, và một class extends base framework sẽ qua được
`EXCEPTION-1` vì ở chỗ throw nó mang đúng tên nhà. Đây cũng không phải `EXCEPTION-6`: cùng một dòng
`throw new Error`, khác nhau ở file nó nằm — trong product code là vi phạm, trong spec là lối ra được
cấp phép. Và nó không phải `EXCEPTION-2`: mã này hỏi **cái gì** được throw, mã kia hỏi nó mang theo
**gì**; throw đúng class mà truyền sai hình dạng vẫn là vi phạm, chỉ là vi phạm mã khác.

**Tình huống nghiệp vụ hay gặp.** Không tìm thấy bản ghi theo id · số dư không đủ · vượt hạn mức gọi
API · token hết hạn · trạng thái không cho phép chuyển tiếp · một dependency ngoài trả về lỗi · một
biến môi trường bắt buộc không được set · upload sai định dạng.

## `EXCEPTION-2` — đúng một object, kể cả khi rỗng

**Tình huống.** Bạn đã có class đúng. Giờ là câu hỏi truyền gì vào constructor — và đây là chỗ hai
thói quen khác nhau lẻn vào cùng một codebase.

**Nó sinh ra gì trong source.** Đúng một object literal ở mọi chỗ throw — `new XException({})` khi
thất bại không có gì của riêng nó để kể, `new XException({ tier })` khi có. Không phải
`new XException()`, không phải `new XException("id")`, không phải `new XException(a, b)`.

**Dấu hiệu nhận biết.** Trong cùng một file có cả `new XException()` và `new YException({...})`;
constructor nhận `(id: string, status: string)` thay vì một object; một chỗ throw truyền hai tham số
vì "thêm cho đủ thông tin"; ai đó vừa phải grep cả repo để sửa thứ tự tham số sau khi thêm một trường.

**Ranh giới.** Đây không phải `EXCEPTION-5`: mã này nói về **hình dạng** của tham số — phải là một
object; mã kia nói về **nội dung** của object đó. `new XException({})` thoả `EXCEPTION-2` tuyệt đối,
và có thể vẫn đang trốn `EXCEPTION-5` nếu thất bại đó thật ra có id để kể. Nó cũng không phải phán
quyết về constructor của một class framework: hình dạng đó không phải của mình để mà quy định, còn
chuyện có được throw nó hay không là câu hỏi của `EXCEPTION-1`.

**Tình huống nghiệp vụ hay gặp.** Lỗi cấu hình không có id nào để kể (`{}`) · lỗi tra cứu mang đúng
một id · lỗi hạn mức mang giá trị hiện tại và ngưỡng · lỗi chuyển trạng thái mang trạng thái nguồn và
đích · lỗi bọc một exception của thư viện ngoài, mang `originalError`.

## `EXCEPTION-3` — class extends base của nhà, không phải của framework

**Tình huống.** Bạn đang khai báo một class lỗi mới, và trong tầm mắt có một base rất tiện: base của
framework, sẵn status, sẵn serialize, sẵn mọi thứ. Đây là chỗ cái bẫy nguy hiểm nhất của cả module này
nằm.

**Nó sinh ra gì trong source.** Một dòng `extends AbstractException` trên chính dòng khai báo, đọc từ
file khai báo chứ không suy ra từ bất cứ chỗ throw nào. Class đó được throw **bằng chính tên của nó**,
nên ở mọi chỗ throw dòng code đọc lên đúng như một exception của nhà, và rule canh chỗ throw không
thấy gì sai cả. Đó không phải giả thuyết: đúng một class như vậy đã sống trong cây code, được throw từ
bốn call site, trong khi gate vẫn xanh.

**Dấu hiệu nhận biết.** Chỗ throw trông hoàn toàn bình thường, nhưng client nhận về một status "sạch"
mà không có code; class nằm đúng thư mục errors, đặt tên đúng hậu tố, chỉ có dòng `extends` là khác;
filter bắt `AbstractException` mà thất bại này không bao giờ rơi vào đó.

**Ranh giới.** Đây không phải `EXCEPTION-1` — mã đó đọc chỗ throw; hai mã này là một luật đọc từ hai
đầu, và bỏ một đầu là để lại đúng cái lỗ mà đầu kia bịt. Nó cũng không phải `EXCEPTION-4`: mã này hỏi
class **extends gì**, mã kia hỏi nó **nằm đâu**, và một class có thể nằm đúng chỗ mà vẫn extends sai
base — đó chính là ca đã xảy ra thật. Nó không áp lên file của base: class mà mọi class khác extends
thì không thể tự extends chính nó, và ngoại lệ đó cấp theo **tên file**, không cấp theo thư mục, để nó
không lan sang hàng xóm.

**Tình huống nghiệp vụ hay gặp.** Port một lỗi cũ từ code legacy sang · lỗi ở guard cần giữ đúng 401
nên có người tiện tay extends base của framework · lỗi ở tầng upload cần 413 · một class được sinh ra
trong lúc migration và không ai review lại dòng `extends`.

## `EXCEPTION-4` — mọi lỗi khai báo trong một thư mục

**Tình huống.** File khai báo lỗi mới sắp được tạo, và chỗ tiện nhất là ngay cạnh service throw nó.
Đây là quyết định trông vô hại nhất trong cả module.

**Nó sinh ra gì trong source.** Một file khai báo nằm dưới thư mục `exceptions/errors/`, một thư mục
như vậy cho mỗi ứng dụng, để câu hỏi "ứng dụng này có thể throw ra những gì?" có **một** chỗ để nhìn,
và để một reviewer **thấy một failure mode mới đi vào** trong diff. Một exception khai báo cạnh code
throw nó thì vô hình cho tới khi có thứ gì đó throw nó trên production.

**Dấu hiệu nhận biết.** Một `class ...Exception` nằm cuối một file service, sau khi đã đọc hết logic;
có hai lỗi gần trùng nhau ở hai module vì người viết cái thứ hai không biết cái thứ nhất tồn tại;
không ai trả lời được "danh sách lỗi của ứng dụng" mà không grep.

**Ranh giới.** Đây không phải `EXCEPTION-3` — mã đó đọc dòng `extends` chứ không đọc đường dẫn. Và nó
không đòi một đường dẫn cố định: luật đòi **một chỗ cho mỗi ứng dụng**, nên một repository chứa nhiều
app thì mỗi app có thư mục exceptions của mình và vẫn thoả, vì câu hỏi "ứng dụng này có thể throw gì"
vẫn có đúng một câu trả lời.

**Tình huống nghiệp vụ hay gặp.** Lỗi nội bộ của một adapter · lỗi của một job nền · lỗi của một
migration chạy một lần · lỗi khai báo tạm "để refactor sau" · lỗi được sinh ra trong một file test
helper rồi bị import ngược vào product code.

## `EXCEPTION-5` — metadata mang thứ người đọc sẽ cần

**Tình huống.** Class đúng, hình dạng đúng, chỗ đặt đúng. Còn lại một câu hỏi mà không rule nào trả
lời hộ được: **object đó chứa gì.**

**Nó sinh ra gì trong source.** Những trường trên object metadata mà người đọc tiếp theo hành động
được — id của bản ghi không tìm thấy, trạng thái đã làm cho thao tác thành bất khả, cái ngưỡng vừa bị
vượt. Message dành cho **một con người đang đọc log**; metadata dành cho **mọi thứ còn lại**: client
quyết định hiển thị gì, retry policy quyết định có thử lại không, alert group theo code và cần biết
đây là tenant nào. Không phải một câu đã render sẵn.

**Dấu hiệu nhận biết.** Metadata có đúng một trường và trường đó tên là `message`, `detail`, `reason`
hoặc `description`; message đã ghép sẵn id vào bằng template string còn metadata thì rỗng; có người
đang viết regex trên message trong dashboard log; client hiển thị được lỗi nhưng không link được tới
bản ghi gây lỗi.

**Lưu ý về người đọc thật.** Ở trạng thái hiện tại, filter HTTP gửi ra `statusCode`, `code` và
`message` — **không** gửi metadata. Nghĩa là người đọc metadata hôm nay là dòng log và caller
in-process, chưa phải HTTP client. Điều đó không làm luật yếu đi, nhưng nó thay đổi câu "ai sẽ cần
trường này": trước khi thêm một trường vì "client cần", hãy kiểm xem client có nhận được nó không.

**Ranh giới.** Đây không phải `EXCEPTION-2`: hình dạng và nội dung là hai câu hỏi khác nhau, và mã này
là câu hỏi không đo được bằng máy. Nó cũng không phải `exception-identity`: `code` là danh tính, thuộc
module bên cạnh, còn mã này chỉ nói về payload đi kèm danh tính đó.

**Tình huống nghiệp vụ hay gặp.** Id của bản ghi không tìm thấy · trạng thái nguồn và trạng thái đích
của một chuyển tiếp bị từ chối · số dư hiện tại và số tiền yêu cầu · hạn mức và giá trị đã dùng · tên
biến môi trường bị thiếu · `originalError` khi bọc lỗi của thư viện ngoài.

## `EXCEPTION-6` — assertion của test runner không phải lỗi nghiệp vụ

**Tình huống.** Một spec đang chạy và fixture không seed được. Test không thể đi tiếp. Bạn viết
`throw new Error("fixture did not seed")` — và đó là **đúng**.

**Nó sinh ra gì trong source.** Một `throw new Error(...)` nằm lại trong họ file spec và cây test, nơi
nó nghĩa là "runner bỏ cuộc" chứ không đặt tên cho một thất bại mà sản phẩm có thể sinh ra. Một lane
bị cấm tự làm hỏng setup của chính nó sẽ phải bịa ra một domain exception cho việc "thiếu fixture" —
tức là đưa một thất bại **của bài test** vào đúng bộ từ vựng mà sản phẩm dùng cho những thất bại thật,
và thêm vào danh sách lỗi của ứng dụng một dòng mà người dùng không bao giờ chạm tới được. Lối ra này
được cấp phép ở nơi nó áp dụng, và không ở đâu khác.

**Dấu hiệu nhận biết.** Dòng `throw new Error` nằm trong file spec hoặc trong cây test, và mô tả một
điều kiện của môi trường test chứ không của nghiệp vụ; ngược lại, một domain exception được khai báo
mà chỉ có spec throw nó; một helper của test bị import vào product code, mang theo lối ra này.

**Ranh giới.** Đây không phải `EXCEPTION-1`: cùng một dòng code, khác nhau ở file, và ranh giới là
**đường dẫn** — nó được viết hai lần, một lần trong rule, một lần trong config của repository dùng
rule. Nó cũng không phải `EXCEPTION-4`: một exception chỉ để phục vụ test vẫn sẽ nằm trong thư mục
errors nếu ai đó tạo ra nó, và sẽ trông y hệt một lỗi thật — đó chính là thứ mã này ngăn.

**Tình huống nghiệp vụ hay gặp.** Fixture không seed · điều kiện chờ quá deadline · một stub bị gọi
với tham số ngoài kịch bản · script mock hết bước · dependency của môi trường test không sẵn sàng.

## Tầng giữ

Tầng nào thật sự giữ từng mã — không phải tầng mà ta mong nó giữ.

| Mã | Tầng | Ai giữ |
|---|---|---|
| `EXCEPTION-1` | `enforced` | `throw-abstract-exception` (export `throwAbstractException`) — hai message: `bareError` cho `throw new Error`, `framework` cho một tên nằm trong danh sách framework. Bỏ qua lane test và health probe theo đường dẫn |
| `EXCEPTION-2` | `enforced` | `require-exception-object-arg` (export `requireExceptionObjectArg`) — ba message: `zero` khi không có tham số, `notObject` cho một giá trị vị trí, `extra` khi nhiều hơn một. Tên của framework được trả về mà không phán xét, vì hình dạng constructor của chúng không phải của mình để mà quy định |
| `EXCEPTION-3` | `enforced` | `exception-extends-abstract` (export `exceptionExtendsAbstract`) — message `base`, áp lên mọi class `*Exception` có superclass không phải base của nhà. File của chính base được cắt ra theo tên file |
| `EXCEPTION-4` | `enforced` | `exception-in-errors-folder` (export `exceptionInErrorsFolder`) — message `place`, áp lên mọi class `*Exception` có superclass khai báo ngoài một thư mục `exceptions/errors/` |
| `EXCEPTION-5` | `documented` | Không có gì máy móc. Một rule thấy được rằng một object literal đã được truyền; nó không thấy được những id mà người đọc sẽ cần có nằm TRONG đó hay không. `{ message: "not found" }` và `{ orderId }` là cùng một hình dạng AST |
| `EXCEPTION-6` | `documented` | Không có gì máy móc phán lên nó. Một nửa ranh giới được vẽ bằng đường dẫn — `isTestLane` bên trong `throw-abstract-exception`, và đúng những glob đó một lần nữa trong config bên dùng — nhưng bản thân phán quyết là về việc một cú throw có NGHĨA gì, và cái hướng quan trọng nhất (một spec bịa ra domain exception cho một fixture bị thiếu) thì không rule nào nhìn thấy |

Bốn trên sáu được enforce, hai chỉ được ghi lại. Khoảng hở đó chính là lý do bảng này tồn tại, không
phải khiếm khuyết của nó.

Không mã nào ở đây dừng ở `unrepresentable`, và có một mã còn gần hơn cả những gì bảng thừa nhận. Hôm
nay cả 323 khai báo trong cây errors đều gõ kiểu cho tham số constructor và không cái nào cho nó giá
trị mặc định, nên `new XException()`, `new XException("id")` và `new XException(a, b)` đều là lỗi
compile ở mọi call site — compiler đã từ chối sẵn cả ba message của `EXCEPTION-2`. Nhưng đó là tính
chất kiếm được từng khai báo một, không phải bảo đảm mà class base đưa ra: constructor của chính
`AbstractException` là tham số vị trí, nên một subclass sao chép nó vẫn có kiểu, vẫn compile, và chỉ
bị rule bắt. Rule mới là thứ làm luật này phổ quát, nên rule chính là tầng giữ nó.

## Điểm neo

Một luật không chỉ được vào code thật thì chỉ là một đề xuất. Mọi mã ở đây đều chỉ vào source, kèm thứ
phải đọc ở đó.

| Mã | Điểm neo | Đọc gì ở đó |
|---|---|---|
| `EXCEPTION-1` | `src/` như một khối: 648 chỗ `throw new <tên>Exception(` | Tìm `throw new Error(` khắp product code không ra gì, và đoạn text duy nhất về exception framework trong cây là một string literal bên trong một fixture của spec. Chính sự trống rỗng đó là điểm neo, vì đó là thứ luật này mua được |
| `EXCEPTION-2` | `src/features/api/core/graphql/mutations/ai/purchase-ai-subscription/purchase-ai-subscription.handler.ts` | Hai chỗ throw trong cùng một hàm: một chỗ truyền object không có trường nào, chỗ kế tiếp truyền `{ tier }`. Object rỗng viết ra ngay cạnh một object có dữ liệu là cả cái luật gói trong tám dòng. 60 chỗ throw trong `src/` truyền object không trường thay vì không truyền gì |
| `EXCEPTION-3` | `src/modules/platform/exceptions/errors/abstract.ts` | Class duy nhất trong cây được phép extends thứ khác — và đó là lý do rule cắt ra đúng tên file này chứ không cắt cả thư mục. Mọi khai báo còn lại đều extends `AbstractException`, và không base framework nào xuất hiện làm superclass ở bất cứ đâu |
| `EXCEPTION-4` | `src/modules/platform/exceptions/errors/` — 283 file trên 54 thư mục con theo domain | Tập hợp những thất bại ứng dụng có thể sinh ra, đọc được trong một lần liệt kê. Tìm `class \w+Exception extends` ngoài cây đó không ra gì |
| `EXCEPTION-5` | `src/modules/platform/exceptions/errors/courses/challenge-content-fk-constraint.ts` và `src/modules/platform/exceptions/filters/abstract-exception-http.filter.ts` | Khai báo đặt hai id vào metadata; filter gửi ra `{ statusCode, code, message }` và KHÔNG gửi metadata. Nên người đọc metadata hôm nay là dòng log và caller in-process, chưa phải HTTP client — luật là thật, nhưng khán giả của nó hẹp hơn lời văn ngụ ý. 278 trên 323 khai báo mang ít nhất một trường của riêng mình; 45 cái là alias rỗng |
| `EXCEPTION-6` | `eslint.config.mjs`, block cuối, tắt `starci-be/throw-abstract-exception` cho `apps/*/test/**/*.ts` và `src/tests/**/*.ts`; cộng với `src/tests/e2e/search-sync-resilience.e2e-spec.ts` | 27 `throw new Error` trong cây test đối lại con số không trong product code — đúng cái ranh giới luật này tuyên bố, đã đo được. Lưu ý phần cắt ra được viết hai lần, theo đường dẫn, trong lượng file của hai repository: một lần trong rule, một lần trong config |

Mọi mã trong module này đều đã neo. Không mã nào còn để trống.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| throw site | Câu lệnh `throw` đúng như đã viết, và file nó nằm — đường dẫn quyết định lối ra của lane test có áp dụng không |
| declaration | Dòng `class X extends Y`, đọc từ file khai báo chứ không suy ra từ chỗ throw |
| location | Thư mục file khai báo nằm, tính theo ranh giới `exceptions/errors/` |
| payload | Những trường trên object metadata, và người đọc nào cần từng trường |
| reader | Ai hành động trên thất bại này: một nhánh ở client, một retry policy, một nhóm alert, hay một con người đang đọc log |

## Quy tắc

1. Một thất bại là một class, không phải một câu văn.
2. Chỗ throw và chỗ khai báo phải kể cùng một câu chuyện; không cái nào một mình là bằng chứng.
3. Một thư mục trả lời câu hỏi "ứng dụng này có thể throw ra những gì?".
4. Mọi lần throw một exception của nhà đều truyền đúng một object literal.
5. Message dành cho con người; metadata dành cho mọi thứ còn lại.
6. Một mã tình huống ứng với đúng một phán quyết, và không phán quyết nào phục vụ hai mã.
7. Mọi `throw` trong product code và mọi khai báo `*Exception` đều ra được phán quyết dưới từng mã.
   Không thứ gì được coi là ngoài phạm vi chỉ vì nó nội bộ, nhỏ, hay khó có ai bắt.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã nó
áp dụng vào.

- **Lane test.** `EXCEPTION-6` cấp phép `throw new Error` cho họ file spec và cây test, nơi nó nghĩa
  là runner bỏ cuộc. Lối ra được cấp ở nơi nó áp dụng và không ở đâu khác, và một file product import
  một helper từ những lane đó không thừa hưởng quyền này.
- **Health probe.** `EXCEPTION-1` cho phép exception của framework trong controller liveness hoặc
  readiness, vì chính lý do của luật đảo chiều ở đó: framework exception bị từ chối vì mang status mà
  không mang danh tính, còn probe là endpoint duy nhất mà orchestrator chỉ đọc status và không đọc gì
  khác. `throw new Error` vẫn bị từ chối kể cả ở đó — status của probe là hợp đồng, còn một cú crash
  không tên thì không.
- **File của base.** `EXCEPTION-3` không thể áp lên chính class mà mọi class khác extends. Ngoại lệ
  cấp theo tên file chứ không theo thư mục, để nó không lan sang hàng xóm.
- **Hình dạng của chính framework.** `EXCEPTION-2` không quy định constructor của một class framework.
  Viết lại `new ServiceUnavailableException(body)` cho hợp quy ước nhà sẽ đổi luôn thứ framework gửi
  đi. Còn chuyện có được throw nó hay không là câu hỏi của `EXCEPTION-1`, và mã đó đã trả lời.
- **Payload rỗng.** `EXCEPTION-5` không có ngoại lệ nhỏ nào theo chiều ngược lại: `EXCEPTION-2` vẫn
  đòi object kể cả khi thất bại không có gì của riêng nó để kể, vì đó là chỗ trường đầu tiên sẽ rơi
  vào.
- **Một thư mục cho mỗi ứng dụng, không phải một đường dẫn cố định.** `EXCEPTION-4` đòi câu hỏi "ứng
  dụng này có thể throw gì?" có đúng một câu trả lời. Một repository chứa nhiều ứng dụng thoả luật
  bằng một thư mục như vậy cho mỗi ứng dụng; luật khớp theo ranh giới, không theo layout của một
  repository.

## Đầu ra

Một block cho mỗi file mà shape sinh ra.

```text
throw:       <the throw statement as written>
declaration: <class X extends Y, from the declaration file>
location:    <folder of the declaration>
payload:     <fields on the metadata object>
situation:   <EXCEPTION-1 | EXCEPTION-2 | EXCEPTION-3 | EXCEPTION-4 | EXCEPTION-5 | EXCEPTION-6>
verdict:     <holds | violates>
reason:      <the reader that could not act on this failure>
```

## Ví dụ đã giải

Shape đã duyệt: *mua gói AI subscription bị từ chối theo hai cách — tài khoản đã đang giữ một
subscription, và tier được yêu cầu không bán.*

Câu đó nói ra hai nhánh thất bại và nghĩa của từng nhánh. Nó không nói class nào được khai báo, chúng
extends base nào, chúng nằm thư mục nào, hay trường nào đi cùng từng chỗ throw — nên nó không giải
quyết bất cứ điều nào trong số đó. Pattern này giải chúng; `exception-identity` giải phần tên.

File khai báo của nhánh thứ nhất:

```text
throw:       —
declaration: class SubscriptionAlreadyActiveException extends AbstractException
location:    src/modules/platform/exceptions/errors/ai/
payload:     —
situation:   EXCEPTION-3
verdict:     holds
reason:      dòng `extends` được đọc từ file khai báo chứ không suy ra từ chỗ throw — một base
             framework ở đây vẫn sẽ đọc lên đúng kiểu nhà ở mọi chỗ throw
```

```text
throw:       —
declaration: class SubscriptionAlreadyActiveException extends AbstractException
location:    src/modules/platform/exceptions/errors/ai/
payload:     —
situation:   EXCEPTION-4
verdict:     holds
reason:      không phải EXCEPTION-3, vì base đã đúng sẵn; đây là sự thật riêng rằng file nằm trong một
             thư mục trả lời câu hỏi "ứng dụng này có thể throw gì?"
```

File handler, chỗ throw thứ nhất:

```text
throw:       throw new SubscriptionAlreadyActiveException({})
declaration: class SubscriptionAlreadyActiveException extends AbstractException
location:    src/modules/platform/exceptions/errors/ai/
payload:     không có — thất bại này không có gì của riêng nó để kể
situation:   EXCEPTION-2
verdict:     holds
reason:      không phải EXCEPTION-5, vì object rỗng do đúng sự thật chứ không do bỏ sót — người dùng
             đã được request xác định rồi, nên không có id nào bị giấu vào trong một câu văn
```

File handler, chỗ throw thứ hai:

```text
throw:       throw new TierNotPurchasableException({ tier })
declaration: class TierNotPurchasableException extends AbstractException
location:    src/modules/platform/exceptions/errors/ai/
payload:     tier
situation:   EXCEPTION-5
verdict:     holds
reason:      không phải EXCEPTION-2, vì hình dạng tham số chưa bao giờ là câu hỏi; sự thật quyết định
             mã này là cái tier mà caller yêu cầu nằm ở một trường, không bị ghép vào message
```

```text
throw:       throw new TierNotPurchasableException({ tier })
declaration: class TierNotPurchasableException extends AbstractException
location:    src/modules/platform/exceptions/errors/ai/
payload:     tier
situation:   EXCEPTION-1
verdict:     holds
reason:      không phải EXCEPTION-6, vì file này là handler product chứ không phải lane test — đường
             dẫn là thứ phân tách hai bên, và một `throw new Error` ở đây sẽ là vi phạm
```

## Phạm vi

Quy tắc này đúng với mọi back end của stack này có đặt tên cho thất bại của mình. Nó không gọi tên một
tính năng nào, một sản phẩm nào, một module riêng tư nào hay một repository nào; ví dụ là TypeScript
bình thường theo hình dạng một ứng dụng Nest hay viết. Bảng `Điểm neo` là chỗ duy nhất trích đường dẫn
tương đối trong repository, vì một luật không chỉ được vào code thật thì chỉ là một đề xuất.

MỘT IDENTIFIER ĐÃ SHIP KHÔNG PHẢI LÀ TÊN SẢN PHẨM THEO NGHĨA NÀY. Một rule được trích bằng đúng tên đã
công bố của nó, kèm cả prefix plugin, vì đó là chuỗi chính xác mà build log in ra và comment disable
mang theo. Một trích dẫn không paste vào ô tìm kiếm được thì không phải trích dẫn. Thứ mà lệnh cấm ở
trên cấm là LỜI VĂN và VÍ DỤ cần có một sản phẩm mới hiểu được — không bao giờ là một identifier mà ai
đó sẽ đọc thấy trong một thất bại rồi phải đi tra.
