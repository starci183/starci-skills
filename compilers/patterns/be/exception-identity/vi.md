---
title: Exception identity · Vietnamese
---

# Danh tính của exception

Đầu vào của pattern này là một shape đã được duyệt: một capability, một guard, một hợp đồng hay một
layout mà ai đó đã quyết định rằng ứng dụng sẽ có. Quyết định đó không được mở lại ở đây. Đầu ra là
kiến trúc source — lỗi được khai báo trong file nào, tầng nào giữ nó, class tên là gì, `super()` nhận
literal nào, tham số constructor mang kiểu gì, và có set status hay không. Câu hỏi thiết kế là "chỗ
này có thể hỏng". Câu hỏi ở đây là "cái hỏng đó nằm ở đâu trong source, và nó tên là gì".

## Luật

Danh tính của một lỗi là từ phân biệt nó với mọi lỗi khác mà ứng dụng có thể sinh ra. Chuyện một lỗi
LÀ một thứ có tên và có dữ liệu đi kèm đã được quyết ở nơi khác. Module này quyết cái tên: **một từ,
viết bằng ba bảng chữ, và cả ba nói cùng một điều.**

Tên class, code và type metadata không phải ba quyết định. Chúng là một quyết định được viết ra ba
cách, vì có ba người đọc và không ai đọc được phần của người kia:

- **Tên class** là thứ các gate nhìn thấy. Mọi rule canh exception đều khớp một cái tên kết thúc bằng
  `Exception`, nên một lỗi viết tên khác đi thì không rule nào canh nó.
- **Code** là thứ client nhìn thấy. Nó được đóng lên mọi lỗi GraphQL và đặt vào body của mọi lỗi REST,
  và caller khớp theo nó chứ không khớp theo status, vì một response có thể mang nhiều lỗi khác
  severity.
- **Type metadata** là thứ nơi throw nhìn thấy. Nó là hợp đồng mà call site phải thoả, và là chỗ
  trường thứ hai của lỗi sẽ rơi vào.

Câu hỏi quyết định một khai báo có danh tính hay không: **nếu lỗi này và lỗi khai báo ngay phía trên
nó cùng tới client, có thứ gì phân biệt được chúng mà không cần đọc tiếng Anh không?** Nếu câu trả lời
là message, khai báo đó không có danh tính — nó có một câu văn.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi class extends house exception base đều rơi vào
một tình huống danh tính, và tình huống đó có mã ở dưới. Không có lỗi nào nhỏ tới mức được miễn: một
cú kiểm header sai cấu hình là `IDENTITY-1` đúng như một lần từ chối nghiệp vụ là `IDENTITY-1`, và câu
"lỗi nội bộ, có ai bắt đâu" chính là chỗ luật này bị bỏ qua nhiều nhất.

## Mã tình huống

Mọi tình huống module này cai quản đều mang một mã, `IDENTITY-<n>`. Mã gọi tên TÌNH HUỐNG; bảng tầng
và bảng điểm neo ở dưới nói ai thật sự giữ nó và kiểm được ở đâu. Đó là ba sự thật khác nhau và module
này cố ý giữ chúng tách rời.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `IDENTITY-1` | Đặt tên một class mới extends house base | Class extends `AbstractException` được đặt tên `*Exception` — không bao giờ là `*Error`, một danh từ trần, hay bất cứ hậu tố nào mà các rule exception khác không khớp được |
| `IDENTITY-2` | Chọn code mà client sẽ khớp | Code là tên class viết SCREAMING_SNAKE, truyền vào `super()` dạng literal — không bao giờ là code chọn tay, code copy từ khai báo ngay phía trên, hay code ghép lúc chạy |
| `IDENTITY-3` | Đổi tên một class đã tồn tại | Một lần đổi tên dời cả class lẫn code cùng nhau, có chủ đích, kèm migration — không bao giờ là nửa-đổi-tên im lặng để class và code bất đồng mãi mãi |
| `IDENTITY-4` | Khai báo kiểu payload của lỗi | Tham số metadata của constructor được gõ `<Class>Metadata`, kể cả khi alias đó không thêm trường nào — không bao giờ là tham số gõ thẳng base dùng chung, tham số không kiểu, hay một type mang tên thứ khác |
| `IDENTITY-5` | Chọn HTTP status | `httpStatus` chỉ được set ở nơi status CHÍNH LÀ hợp đồng — không bao giờ được với tay lấy để phân biệt lỗi này với lỗi kia |

`IDENTITY-3` LÀ MỘT TÌNH HUỐNG, KHÔNG PHẢI MỘT QUY TRÌNH ĐỔI CODE. Nó nổ ngay khoảnh khắc một tên
class bị sửa, kể cả trong một refactor trông như dọn dẹp, vì cú sửa đó client nhìn thấy được dù có ai
định thế hay không.

`IDENTITY-5` gọi tên một tình huống mà kết quả đúng thường là *bỏ status đi hoàn toàn*. Một khai báo
không set `httpStatus` là đã thoả nó; một khai báo có set thì phải nói được hợp đồng caller nào đòi.

## Đọc một shape đã duyệt

1. **Đọc cái shape có nói.** Nó nói rằng một đường đi nào đó có thể từ chối: guard chặn, một lần tra
   cứu không thấy gì, một cấu hình còn thiếu, một file upload quá lớn. Mỗi lần từ chối như vậy là một
   class extends `AbstractException`, trong một file, dưới cây errors.
2. **Đọc cái shape không nói, và vì thế không giải quyết được.** Shape không bao giờ nói tên class,
   literal code, tên type metadata hay status. Nó cũng không bao giờ nói client nào, alert rule nào,
   spec nào đang khớp một code dạng literal — nên tự nó không giải quyết được `IDENTITY-3`, vì mã đó
   cần đúng danh sách ấy làm bằng chứng.
3. **Giải từ ngoài vào trong.** Tên class trước, vì code được suy ra từ nó và vì mọi rule khác trong
   module này đều khớp theo hậu tố `Exception`. Rồi tới code, rồi tới type metadata, và status sau
   cùng — status là thứ duy nhất được phép vắng mặt một cách chính đáng.
4. **Hỏi câu hỏi của từng mã, theo thứ tự.** `IDENTITY-1`: tên có kết thúc bằng `Exception` không?
   `IDENTITY-2`: literal truyền vào `super()` có đúng những chữ cái của tên class không? `IDENTITY-3`:
   có đang sửa một tên đã tồn tại không, và ngay lúc này ai đang khớp code cũ? `IDENTITY-4`: tham số
   constructor có annotation `<Class>Metadata` không? `IDENTITY-5`: đã có caller nào cam kết với
   status này chưa, hay status đang được với tay lấy để lỗi trông khác đi?
5. **Khi hai mã cùng khớp, lấy mã ngoài trước.** Một class tên `SomethingError` hỏng `IDENTITY-1`, và
   vì rule giữ `IDENTITY-2` lẫn `IDENTITY-4` cũng khớp theo hậu tố `Exception`, cả hai còn không được
   kiểm — sửa tên xong rồi hỏi lại. Một lần đổi tên đồng thời sửa hậu tố là `IDENTITY-1` *và*
   `IDENTITY-3`; thoả `IDENTITY-1` không miễn `IDENTITY-3`. Một khai báo với tay lấy status để trở
   nên phân biệt được là đang trả lời `IDENTITY-2` bằng công cụ sai, và bị phán theo `IDENTITY-2` chứ
   không phải `IDENTITY-5`.

## `IDENTITY-1` — tên class kết thúc bằng `Exception`

**Tình huống.** Bạn đang đặt tên cho một class extends `AbstractException`. Đây là chỗ ai cũng nghĩ là
chuyện thẩm mỹ, và nó không phải.

**Nó sinh ra gì trong source.** Một khai báo class trong cây errors, tên kết thúc bằng `Exception`.
Hậu tố là thứ duy nhất mọi rule khác nhìn thấy: rule bắt tham số object, rule bắt extends đúng house
base, rule bắt nằm trong thư mục errors — tất cả đều khớp theo hậu tố đó, còn rule ở throw site thì
chỉ nhận diện `Error` và các tên của framework. Cho nên một class tên `SomethingError` nằm đúng thư
mục, extends đúng house base, được throw ở call site thật — và **không rule nào kiểm nó**. Gate im
lặng, và im lặng thì đọc như đồng ý.

**Dấu hiệu nhận biết.** Tên kết thúc bằng `Error`, hoặc là một danh từ trần (`InvalidToken`,
`QuotaExceeded`). Class extends `AbstractException` nhưng lint không hề báo gì về nó — kể cả khi bạn
cố tình viết sai một thứ khác trong cùng file. Grep tên class trong report của lint không ra dòng nào.
Tự hỏi: nếu tôi cố tình phá một rule exception khác ngay trong class này, gate có đỏ lên không? Nếu
không, class đang vô hình.

**Ranh giới.** Không phải `EXCEPTION-3`: đó là cùng một cái bẫy nhìn từ đầu kia. `EXCEPTION-3` bắt
class extends base của framework — trông đúng nhà ở chỗ throw. `IDENTITY-1` bắt class đặt tên ngoài
quy ước — trông đúng nhà ở trong thư mục. Cả hai đều là lỗi qua được mọi cửa bằng cách vô hình với
cửa. Không phải `IDENTITY-2`: `IDENTITY-1` nói về tên class, `IDENTITY-2` nói về việc code phải bám
theo tên đó; sai `IDENTITY-1` thì `IDENTITY-2` cũng không được kiểm, vì rule của nó cũng khớp theo hậu
tố.

**Tình huống nghiệp vụ hay gặp.** Port một lỗi từ thư viện ngoài vào (`ParseError`, giữ nguyên tên
theo quán tính) · lỗi validate ngắn (`SlugTaken`) · lỗi hạ tầng (`S3UploadFailure`) · lỗi timeout
(`UpstreamTimeoutError`) · lỗi sinh bằng codegen từ một schema đã có sẵn tên.

## `IDENTITY-2` — code là tên class, viết SCREAMING_SNAKE

**Tình huống.** Bạn đang viết đối số thứ hai của `super()`. Code này là thứ client khớp, cho nên nó là
hợp đồng ra ngoài. Nó được **suy ra** từ tên class, không được **chọn** cạnh tên class.

**Nó sinh ra gì trong source.** Một string literal tại chỗ khai báo, đúng những chữ cái của tên class,
viết SCREAMING_SNAKE. Việc suy ra có hai hệ quả, và cả hai đều là mục đích. Thứ nhất, không ai phải
tra cứu: người có tên class biết code, người có code tìm được class bằng một lần grep. Một code chọn
tay là **cái tên thứ hai** của cùng một lỗi — và cái tên thứ hai chính là cái nằm trong client, trong
alert rule, trong ticket hỗ trợ, trong khi cái tên thứ nhất là cái duy nhất có trong source. Thứ hai,
duy nhất mà không phải cố: code copy từ exception khai báo ngay phía trên là cách phổ biến nhất để hai
lỗi không liên quan dùng chung một danh tính. Chuyện này đã xảy ra thật: một challenge OTP và một
challenge khoá học cùng báo một code, nên client khớp code không phân biệt được "thiếu bài học" với
"thiếu bước đăng nhập" — đúng là khuyết tật mà `EXCEPTION-1` từ chối exception của framework để tránh,
chỉ khác là lần này nó xảy ra bên trong vốn từ của nhà.

**Dấu hiệu nhận biết.** Code ngắn hơn tên class rõ rệt (`REVIEW_FORBIDDEN` cho
`DocumentNotOwnedException`). Code là một danh từ chung mà nhiều lỗi đều dùng được (`NOT_FOUND`,
`FORBIDDEN`, `INVALID_INPUT`). Code được ghép bằng template string, hằng số, hoặc `${prefix}_NOT_FOUND`.
Hai file cạnh nhau trong cùng thư mục có cùng một code. Tự hỏi: nếu tôi grep chính xác chuỗi code này
trong repo, tôi có tới thẳng class không? Nếu không, code đang là tên thứ hai.

**Ranh giới.** Không phải `IDENTITY-1`: xem trên. Không phải `IDENTITY-3`: `IDENTITY-2` áp lúc **viết
mới**, `IDENTITY-3` áp lúc **sửa cái đã có**; cùng một luật "code bám tên class", nhưng chi phí khác
hẳn nhau — viết mới thì free, sửa thì có client. Không phải `IDENTITY-5`: nếu bạn thấy mình đang chọn
status để hai lỗi khác nhau, tức là bạn đang trả lời `IDENTITY-2` bằng công cụ sai. Chỗ đặt gạch dưới
bên trong một acronym không thuộc luật này: `GRAPHQL_DATA_...` và `GRAPH_QL_DATA_...` cùng gọi tên một
class, không có cách tách nào đúng, và một rule ép một cách sẽ bắn vào code đang đúng. **Chữ cái là
ruling, không phải gạch dưới.**

**Tình huống nghiệp vụ hay gặp.** Copy file lỗi bên cạnh rồi sửa tên class mà quên sửa code · lỗi "not
found" cho một entity mới · code đặt theo tên endpoint thay vì tên lỗi · code ghép theo tenant hoặc
theo provider · code rút gọn cho ngắn dòng.

## `IDENTITY-3` — đổi tên class là đổi hợp đồng trên dây

**Tình huống.** Class đã tồn tại, đã có client, và bạn muốn đổi tên nó cho đúng hơn. Vì code được suy
ra từ tên class, việc đổi tên **không phải một refactor** — nó là một thay đổi client nhìn thấy được.

**Nó sinh ra gì trong source.** Hai cú sửa trong cùng một revision — tên class và literal trong
`super()` dời cùng nhau — kèm một migration cho những ai đang khớp code cũ. Đó là hệ quả trung thực,
và cũng là lý do phải giữ nó. Lựa chọn thay thế là một class mang code bảo lưu một cái tên nó không
còn nữa; chuyện này cũng đã xảy ra thật: một lỗi tra cứu đường dẫn vẫn báo code của lần tra cứu thư
mục ngày xưa, và không người đọc nào của một trong hai cái tên đoán được cái kia. Cho nên đổi tên là
**một quyết định có migration**, không phải một cú dọn dẹp làm tiện tay khi đi ngang. Nếu code cũ bắt
buộc phải ở lại trên dây vì một client đã phát hành, thì **class giữ nguyên tên cũ** cho đến khi
client đó được gỡ. Thứ bị từ chối là nửa-đổi-tên im lặng, để hai cái tên bất đồng mãi mãi.

**Dấu hiệu nhận biết.** Diff có đổi tên class mà không đổi dòng `super(...)`. Diff có đổi code mà
không đổi tên class. Commit message ghi "rename", "cleanup", "chore" cho một file trong thư mục
errors. Có e2e spec assert đúng chuỗi code đó, và spec không nằm trong diff. Tự hỏi: ai đang khớp code
này ngay lúc này — client nào, alert nào, spec nào? Nếu tôi không trả lời được, tôi chưa đủ điều kiện
đổi tên. Có một thứ ở đây đắt vì được tin và rẻ vì được đo: giả định "đổi code nghĩa là phải phát hành
đồng bộ" từng được tin rất lâu; khi đo thật, trên ba front end, tổng cộng năm code được khớp, và không
code nào trong số đó thuộc về một khai báo đã trôi. Đo thì rẻ, tin thì đắt.

**Ranh giới.** Không phải `IDENTITY-2`: xem trên. Không phải `IDENTITY-1`: đổi `SomethingError` thành
`SomethingException` **cũng** là một lần đổi tên có hệ quả trên dây; sửa `IDENTITY-1` không miễn
`IDENTITY-3`.

**Tình huống nghiệp vụ hay gặp.** Đổi tên domain (`Folder` → `Path`) · gộp hai module · sửa lỗi chính
tả trong tên class · đổi tên khi tách service · rename hàng loạt bằng IDE refactor.

## `IDENTITY-4` — type metadata mang tên chính exception của nó

**Tình huống.** Bạn đang khai báo kiểu cho tham số destructure của constructor.

**Nó sinh ra gì trong source.** Một type tên `<Class>Metadata`, extends `AbstractExceptionMetadata` —
**kể cả khi nó không thêm trường nào**, lúc đó là một alias rỗng:
`export type XExceptionMetadata = AbstractExceptionMetadata`. Alias rỗng không phải nghi thức, cùng lý
do mà object rỗng của `EXCEPTION-2` không phải nghi thức: **nó là chỗ trường đầu tiên sẽ rơi vào.**
Một tham số gõ thẳng base nói rằng "lỗi này không mang gì cả" — điều đó ngừng đúng ngay khoảnh khắc ai
đó có một id cần gắn vào. Và ở đúng khoảnh khắc ấy, base đang được **mọi** exception khác dùng chung,
nên trường mới không thể thêm ở đó, và khai báo phải bị đập ra nắn lại trước khi mở rộng được. Đặt tên
type theo exception còn có nghĩa: người đọc cầm tên lỗi tìm được payload của nó **mà không cần mở
file**.

**Dấu hiệu nhận biết.** Tham số gõ thẳng `AbstractExceptionMetadata`. Tham số không có annotation nào
(destructure trần) — nhận mọi object, kể cả object thiếu đúng cái id mà lỗi này sinh ra để mang. Type
tên theo entity chứ không theo exception (`ReviewMetadata` cho `DocumentNotOwnedException`). Một type
metadata được dùng lại cho hai exception khác nhau. Tự hỏi: ngày mai lỗi này cần nói **cái nào** bị từ
chối, tôi thêm trường vào đâu? Nếu câu trả lời là "vào base mà mọi lỗi dùng chung" — sai mã.

**Ranh giới.** Không phải `EXCEPTION-2`: `EXCEPTION-2` bắt constructor nhận **một object**,
`IDENTITY-4` bắt object đó có **tên riêng**; thoả cái trước mà hỏng cái sau là chuyện thường gặp.
Không phải `IDENTITY-1`: rule giữ `IDENTITY-4` cũng khớp theo hậu tố `Exception`, nên một class sai
`IDENTITY-1` thì `IDENTITY-4` cũng không được kiểm.

**Tình huống nghiệp vụ hay gặp.** Lỗi không có payload (thiếu header, thiếu config) · lỗi dùng lại
type của một lỗi anh em · lỗi sinh bằng snippet có sẵn · lỗi wrap một lỗi upstream và chỉ mang
`originalError`.

## `IDENTITY-5` — HTTP status không phải danh tính

**Tình huống.** Bạn đang cân nhắc `httpStatus`.

**Nó sinh ra gì trong source.** Thường là không sinh ra gì cả — khai báo không có `httpStatus`. Base
nhận nó như một tham số **tuỳ chọn**, phần lớn lỗi bỏ qua và rơi về mặc định 500 ở biên. Nó là một
nhượng bộ cho tầng vận chuyển, dành cho các trường hợp mà **status chính là hợp đồng**: một guard trả
401, một upload bị từ chối vì 413, một cấu hình thiếu thật sự là 500. Status **không bao giờ** là cách
phân biệt hai lỗi, vì một status là một **hạng mục** mà hàng trăm lỗi cùng thuộc về. Đây là lý do một
exception có set status vẫn phải thoả đủ mọi mã ở trên, và là lý do câu hỏi của người review luôn là
"client khớp cái gì?" — câu đó đang hỏi về code. Một khai báo với tay lấy status **để trở nên phân
biệt được** là một khai báo đã trả lời sai câu hỏi.

**Dấu hiệu nhận biết.** Hai lỗi cạnh nhau có code chung chung như nhau và được phân biệt bằng 403 với
404. Code là tên của một status (`FORBIDDEN_EXCEPTION`, `BAD_REQUEST_EXCEPTION`). Lý do đưa ra cho
status là "để phía kia biết đây là lỗi khác", không phải "endpoint này cam kết trả status đó". Set
status trên một lỗi chỉ chạy trong background job, nơi không có transport nào đọc nó. Tự hỏi: có
caller nào **đã cam kết** với status này chưa? Nếu không có, bỏ status đi và để mặc định làm việc của
nó.

**Ranh giới.** Không phải `IDENTITY-2`: xem trên. Status trả lời "transport nên đáp thế nào", code trả
lời "đây là lỗi nào"; dùng cái trước để làm việc của cái sau là nhầm tầng. Không phải `EXCEPTION-1`:
đừng quay lại dùng exception của framework chỉ vì nó "mang sẵn status" — status không đổi lại được cái
giá là mất danh tính.

**Tình huống nghiệp vụ hay gặp.** Guard xác thực (401) · guard phân quyền (403) · file quá lớn (413) ·
rate limit (429) · secret chưa cấu hình (500, và đúng là 500) · lỗi domain thường (không set gì).

## Tầng giữ

Tầng nào thật sự giữ từng mã — không phải tầng nào ta muốn nó giữ.

| Mã | Tầng | Ai giữ |
|---|---|---|
| `IDENTITY-1` | `enforced` | `exception-name-ends-in-exception` (export `exceptionNameEndsInException`) — báo mọi `ClassDeclaration` có superclass là `AbstractException` mà tên không thoả `/Exception$/` |
| `IDENTITY-2` | `enforced` | `exception-code-matches-class-name` (export `exceptionCodeMatchesClassName`) — hai message: `notLiteral` cho code được ghép, `mismatch` khi chữ cái của code và chữ cái của tên class khác nhau |
| `IDENTITY-3` | `documented` | Không có gì máy móc giữ. Một lần đổi tên là hai revision của cùng một file; một rule đọc từng file một không nhìn thấy được cái tên trước đó |
| `IDENTITY-4` | `enforced` | `exception-metadata-type-named-for-class` (export `exceptionMetadataTypeNamedForClass`) — hai message: `untyped` cho destructuring trần, `named` khi annotation không phải `<Class>Metadata` |
| `IDENTITY-5` | `documented` | Không có gì máy móc giữ. Việc status được set vì một hợp đồng caller đòi hỏi hay vì tác giả muốn lỗi này trông khác đi là ý định, và ý định không nằm trong AST |

Không mã nào trong module này được giữ ở mức `unrepresentable`. Về nguyên tắc thì có thể: một type
`ExceptionCode` được brand và suy ra từ tên class sẽ làm một code sai thành thứ không viết ra được,
chứ không chỉ bị báo. Đó là một đề xuất, không phải trạng thái của source, và bảng này nói trạng thái
của source.

Ba trên năm được enforced, hai được documented. Khoảng hở đó chính là mục đích của bảng này, không
phải khuyết tật của nó — `IDENTITY-3` và `IDENTITY-5` đã được nêu là do review giữ ngay từ phiên bản
đầu của luật này, với đúng lý do rằng cả hai đều không nhìn thấy được trong một file.

## Điểm neo

Một luật không chỉ tay được vào code thật thì chỉ là một đề xuất. Mỗi mã ở đây đều chỉ vào source,
kèm chỉ dẫn phải đọc gì ở đó.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `IDENTITY-1` | `modules/platform/exceptions/errors/` | 283 class extends `AbstractException` trên khắp cây thư mục và mọi tên khai báo đều kết thúc bằng `Exception`. Tìm `class \w+Error extends AbstractException` không ra gì — chính sự trống rỗng đó là điểm neo, vì nó là thứ rule đã mua được |
| `IDENTITY-2` | `modules/platform/exceptions/errors/api/graphql.ts` | `GraphQLDataNotFoundException` truyền literal `"GRAPHQL_DATA_NOT_FOUND_EXCEPTION"`. Ngoại lệ acronym không phải giả định: cách tách ngây thơ sẽ đọc thành `GRAPH_QL_`, rule so chữ cái, và source thật phụ thuộc vào điều đó |
| `IDENTITY-3` | `modules/api/apollo/server/monolithic/monolithic-apollo-server.module.ts` (`formatError` copy `original.code` sang `extensions.code`), `modules/platform/exceptions/filters/abstract-exception-http.filter.ts` (`code: exception.code` trong body response), và các literal code được assert khắp `tests/e2e/*.e2e-spec.ts` | Chuỗi mắt xích từ tên class ra tới dây, trong ba file. Các assertion e2e trên code dạng literal là nhân chứng máy móc rằng một code là hợp đồng đã có người ghim |
| `IDENTITY-4` | `modules/platform/exceptions/errors/guards/admin-api-key-not-configured.ts` | `export type AdminApiKeyNotConfiguredExceptionMetadata = AbstractExceptionMetadata` — alias rỗng, vẫn khai. 45 khai báo trong cây mang một cái |
| `IDENTITY-5` | `modules/platform/exceptions/errors/abstract.ts` (`readonly httpStatus?: number`) và `modules/platform/exceptions/filters/abstract-exception-http.filter.ts` (`exception.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR`) | Status là tuỳ chọn ở base và rơi về mặc định tại biên. 90 trên 283 khai báo có set một cái, và không cái nào trong số đó được phân biệt với hàng xóm bằng nó |

Mọi mã trong module này đều đã neo. Không mã nào ghi `chưa neo được`.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| class | Khai báo `class X extends AbstractException`, đọc trọn vẹn — không phải đọc tên file |
| code | Đối số thứ hai của lời gọi `super()`, đúng như đã viết |
| metadata type | Annotation kiểu trên tham số đầu tiên của constructor, kể cả khi đi qua một default `= {}` |
| consumers | Client nào, alert rule nào, spec nào đang khớp code này dạng literal |
| status contract | Có caller nào được nêu tên đòi một HTTP status cụ thể không, hay mặc định đã đúng |

## Quy tắc

1. Tên class, code và tên type metadata là một từ viết bằng ba bảng chữ.
2. Tên class kết thúc bằng `Exception`. Không có ngoại lệ về kích thước hay mức độ nội bộ.
3. Code **suy ra** từ tên class, không bao giờ được chọn cạnh nó.
4. Code là một literal tại chỗ khai báo, không bao giờ được ghép.
5. Chỗ đặt gạch dưới trong acronym không thuộc luật; chữ cái mới thuộc luật.
6. Đổi tên class là đổi hợp đồng trên dây. Đổi cả hai, hoặc giữ nguyên cả hai cho tới khi client cũ
   được gỡ.
7. Type metadata mang tên exception của nó, kể cả khi nó không giữ trường nào.
8. HTTP status không bao giờ phân biệt hai lỗi. `httpStatus` chỉ set nơi status là hợp đồng của
   caller; danh tính nằm ở code.
9. Một mã tình huống ứng với đúng một ruling, và không ruling nào phục vụ hai mã.
10. Mọi class extends house base đều ra được phán quyết dưới từng mã. Không khai báo nào nằm ngoài
    phạm vi vì nó nhỏ, nội bộ, hay ít khả năng bị bắt.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp vào.

- **Cách tách acronym.** (`IDENTITY-2`) Mã này không phán xử chỗ đặt gạch dưới bên trong một acronym.
  `GRAPHQL_DATA_NOT_FOUND_EXCEPTION` và `GRAPH_QL_DATA_NOT_FOUND_EXCEPTION` cùng gọi tên một class,
  không có cách tách nào đúng, và một rule ép một cách sẽ bắn vào code đang đúng. Chữ cái là ruling.
- **Client đã phát hành.** (`IDENTITY-3`) Code cũ được phép ở lại trên dây — bằng cách GIỮ NGUYÊN TÊN
  CLASS CŨ cho tới khi client đó được gỡ. Thứ bị từ chối là nửa-đổi-tên, không phải sự trì hoãn.
- **Status là hợp đồng.** (`IDENTITY-5`) `httpStatus` được phép ở nơi status đúng là thứ caller đã
  đồng ý: một guard trả 401, một upload bị từ chối vì 413, một cấu hình sai thật sự là 500. Set ở đó
  không miễn bất cứ mã nào khác.
- **Lỗi hình dạng framework.** Class extends base của framework không thuộc việc của module này; nó bị
  từ chối từ trước bởi `EXCEPTION-3`. Module này chỉ cai quản danh tính bên trong house base.
- **Payload rỗng.** (`IDENTITY-4`) Không có miễn trừ cho trường hợp nhỏ. Một exception chẳng có gì
  riêng để nói vẫn phải khai alias của nó, cùng lý do mà `EXCEPTION-2` giữ object rỗng: đó là chỗ
  trường đầu tiên rơi vào.

## Đầu ra

Một block cho mỗi file mà shape sinh ra.

```text
class:    <declaration as written>
code:     <literal passed to super()>
metadata: <type of the constructor's first parameter>
status:   <httpStatus, or "default">
situation: <IDENTITY-1 | IDENTITY-2 | IDENTITY-3 | IDENTITY-4 | IDENTITY-5>
verdict:  <holds | violates>
reason:   <the consumer that could not tell this failure from its neighbour>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một GraphQL query chỉ dành cho admin, đọc một bản ghi theo id, chỉ tới được khi
admin API key đã được cấu hình — nên nó có thể từ chối ở hai chỗ: guard từ chối khi key chưa được cấu
hình, và lần đọc từ chối khi bản ghi không tồn tại.

Shape này sinh ra hai file khai báo.

```text
class:    class AdminApiKeyNotConfiguredException extends AbstractException
code:     "ADMIN_API_KEY_NOT_CONFIGURED_EXCEPTION"
metadata: AdminApiKeyNotConfiguredExceptionMetadata (= AbstractExceptionMetadata, alias rỗng)
status:   500
situation: IDENTITY-4
verdict:  holds
reason:   hôm nay lỗi này không mang payload nào, và alias rỗng là chỗ trường đầu tiên rơi vào — đây là IDENTITY-4 chứ không phải IDENTITY-5, vì 500 không phải thứ phân biệt nó: code mới là, và status chỉ được set vì một secret chưa cấu hình thật sự là 500
```

```text
class:    class GraphQLDataNotFoundException extends AbstractException
code:     "GRAPHQL_DATA_NOT_FOUND_EXCEPTION"
metadata: GraphQLDataNotFoundExceptionMetadata
status:   default
situation: IDENTITY-2
verdict:  holds
reason:   literal đúng những chữ cái của tên class, nên một client khớp code sẽ tới thẳng class bằng một lần grep — đây là IDENTITY-2 chứ không phải IDENTITY-3, vì class đang được viết mới và không client đã phát hành nào đang khớp một code cũ của nó; chỗ gạch dưới bên trong GRAPHQL không bị phán xử, chữ cái mới bị
```

**Cái shape không nói, và vì thế không giải quyết.** Nó không nêu tên client, alert rule hay e2e spec
nào sẽ khớp hai literal đó, nên `IDENTITY-3` không được giải ở đây — mã đó mở ra vào lần kế tiếp một
trong hai tên class bị sửa, và nó cần đúng danh sách consumer ấy làm bằng chứng trước khi ai đó đủ
điều kiện đổi tên. Nó cũng không nói ý định đằng sau con số 500, và ý định thì không nằm trong AST:
`IDENTITY-5` ở block thứ nhất do review giữ, không có gate nào giữ.

## Phạm vi

Quy tắc này đúng cho mọi code cùng loại trong stack này — bất cứ back end nào đặt tên cho các lỗi của
nó. Nó không gọi tên một feature riêng lẻ nào, không gọi tên sản phẩm, module riêng tư hay repository.
Ví dụ là TypeScript thường, viết theo hình dạng một ứng dụng Nest hay viết. Bảng `Điểm neo` là chỗ duy
nhất trích dẫn đường dẫn tương đối trong repository, vì một luật không chỉ tay được vào code thật thì
chỉ là một đề xuất.
