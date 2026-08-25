---
title: CQRS · Vietnamese
---

# CQRS

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | bộ máy backend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Pattern này nhận một shape đã được duyệt: một thao tác backend đã được đồng ý phơi ra, một
capability đã được chốt, một hợp đồng đã ngã ngũ. Kết quả là kiến trúc source — thư mục nào thuộc về
thao tác đó, mỗi mảnh rơi vào file nào, file ấy được import gì, phải export gì, và tên nó là gì.
Pattern này không mở lại quyết định rằng thao tác nên tồn tại; nó hạ quyết định ấy xuống thành file.

## Luật

Mọi thao tác backend này phơi ra đều là một message có handler. Mutation dispatch một command, query
dispatch một query, còn việc phụ phải sống lâu hơn request thì là một event. Resolver không làm việc
và service cũng không làm việc — cả hai chỉ chuyển request tới handler, còn handler là chỗ công việc
thật sự nằm.

Cái shape này không phải trang trí. Đặt công việc phía sau một message nghĩa là cùng một thao tác ấy
với tới được từ resolver, từ controller, từ một lệnh CLI, từ một job hay từ một bài test **mà không
cái nào cần biết tới cái nào**, và nghĩa là chỗ duy nhất để đọc xem một thao tác thật sự làm gì là
một file mang đúng tên thao tác đó.

Câu hỏi phân định một đoạn code có thuộc về đây không: **việc này có thể bị gọi từ nhiều hơn một cửa
không?** Nếu có — và gần như luôn có, vì CLI và bộ test đã là hai cửa — thì đó là một message có
handler, không phải một method trên service.

**Đây là luật bắt buộc, không phải lời khuyên.** Mỗi thao tác mang đúng một mã tình huống bên dưới,
và không thao tác nào nhỏ đến mức được miễn: một lệnh đọc một dòng vẫn là `CQRS-1` đúng cùng lý do mà
một lệnh tất toán thanh toán là `CQRS-1`. Câu "có mỗi cái getter thôi mà" là chỗ luật này bị bỏ qua
nhiều nhất.

## Mã tình huống

Mọi tình huống module này cai quản đều mang một mã, `CQRS-<n>`. Các con số là cố định và được trích
dẫn từ những file luật khác cũng như từ các bản ghi công việc; một mã giữ nguyên số và nguyên nghĩa
suốt thời gian nó còn tồn tại.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `CQRS-1` | Một thao tác đứng thành một thư mục, mọi file trong đó mang tên thao tác | Đòi hỏi: một thao tác, một thư mục; mọi file trong đó tên `<operation>.<role>.ts`. Cấm: một file trong thư mục không mang tên thao tác; một thao tác bị xé qua nhiều thư mục |
| `CQRS-2` | Message chỉ bê request context và không tính toán gì | Đòi hỏi: một command hoặc query giữ đúng một field `params` chở request, người dùng và locale. Cấm: method, getter, giá trị mặc định hay bất kỳ phép tính nào trên message; nhiều field trong constructor |
| `CQRS-3` | Handler cắm vào template method của base | Đòi hỏi: handler cài `process` protected của base template. Cấm: khai báo `execute` trên class handler; một handler đứng một mình mà không có `process` |
| `CQRS-4` | Service nằm cạnh handler chỉ dispatch | Đòi hỏi: một service cạnh handler, dispatch rồi trả về, đúng một dòng. Cấm: luật nghiệp vụ, truy cập repository, validation hay điều phối trong service ấy |
| `CQRS-5` | Handler không làm được việc thì nói rõ vì sao | Đòi hỏi: handler không làm được việc thì ném domain exception nêu đúng lý do. Cấm: trả `null` để báo thất bại; trả một shape thành công có chứa field lỗi |
| `CQRS-6` | Việc kiểu gì cũng phải xảy ra, dù người gọi còn đó hay không | Đòi hỏi: event chỉ dành cho việc phải xảy ra dù người gọi còn đó hay không. Cấm: một event mà câu trả lời của chính người gọi phụ thuộc vào lúc nó xong |
| `CQRS-7` | Quyết định nằm ở handler thì test cũng nằm cạnh handler | Đòi hỏi: `<operation>.handler.spec.ts` cùng thư mục với handler. Cấm: handler không có spec; spec bị dời sang một cây test riêng |

`CQRS-1` VÀ `CQRS-7` NÓI VỀ CÙNG MỘT THƯ MỤC, KHÔNG PHẢI CÙNG MỘT SỰ VIỆC. `CQRS-1` nói cái gì **được
phép** nằm trong thư mục; `CQRS-7` nói cái gì **bắt buộc** phải nằm. Một thư mục có thể đạt cái này mà
trượt cái kia, và đó là lý do chúng là hai mã chứ không phải một.

## Đọc một shape đã duyệt

1. Đọc xem shape nói gì. Nó nói rằng một thao tác tồn tại, nó tên gì, và nó trả lời cái gì. Từ đó ra
   được tên verb-object của thao tác và loại message của nó.
2. Đọc xem shape **không** nói gì. Nó không nói mỗi mảnh rơi vào file nào, handler kế thừa base nào,
   thất bại được diễn đạt ở đâu, hay spec nằm chỗ nào. Shape không giải quyết những thứ đó; pattern
   này mới giải quyết.
3. Giải từ ngoài vào trong. Chốt thư mục trước rồi mới tới các file bên trong: thư mục thao tác được
   quyết theo `CQRS-1`, xong rồi từng file bên trong mới nhận mã của nó.
4. Hỏi lần lượt câu hỏi của từng mã. Mọi file có mang tên thao tác không (`CQRS-1`)? Message có tính
   toán gì không (`CQRS-2`)? Handler cài `process` hay khai báo `execute` (`CQRS-3`)? Service có đúng
   một dòng dispatch không (`CQRS-4`)? Mỗi nhánh từ chối có ném domain exception có tên không
   (`CQRS-5`)? Người gọi có chờ việc này không (`CQRS-6`)? Spec song sinh có nằm trong thư mục này
   không (`CQRS-7`)?
5. Khi hai mã cùng khớp, chúng đang khớp về hai file khác nhau hoặc hai sự việc khác nhau. `CQRS-1`
   và `CQRS-7` nói về cùng thư mục nhưng khác sự việc: đặt file theo `CQRS-1`, rồi bắt buộc phải có
   theo `CQRS-7`. `CQRS-1` với `CQRS-4` tách ra đúng kiểu ấy — `CQRS-1` nói file nào được phép nằm
   trong thư mục, `CQRS-4` nói file service ấy được phép chứa gì, nên một service đúng chỗ vẫn có thể
   sai nội dung. `CQRS-2` và `CQRS-4` cùng cấm nghiệp vụ, nhưng ở hai file khác nhau và vì hai lý do
   khác nhau. Mỗi thao tác giải ra đúng một mã cho mỗi tình huống; không thao tác nào nằm ngoài phạm
   vi.

## `CQRS-1` — một thao tác, một thư mục

**Khi nào gặp.** Bạn đang thêm một thao tác mới, hoặc đang tìm chỗ đặt một file vừa nảy ra trong lúc
làm. Thư mục của thao tác chứa message, handler, service, cửa, wiring và spec — và mọi file trong đó
đều mang tên thao tác.

**Source phải thể hiện gì.** Một thư mục mang tên thao tác, và bên trong mọi file đều tên
`<operation>.<role>.ts`: `.command.ts`, `.handler.ts`, `.service.ts`, `.resolver.ts`, `.module.ts`,
`.module-definition.ts`. Không file nào trong thư mục mang tên thứ khác ngoài thao tác, và thao tác
không bị xé qua nhiều thư mục.

**Cách nhận ra.** Biết tên thao tác là đoán ra được **mọi** tên file trong thư mục. Grep một
tên thao tác ra nguyên cả thao tác, không phải một lát cắt của nó. Trong thư mục xuất hiện một file
mang cái tên chung chung (`utils`, `helpers`, `mapper`) — đó là dấu hiệu có thứ dùng lại được vừa bị
sinh ra ở chỗ không ai đi tìm. Tự hỏi: file này có mang tên thao tác không? Nếu không, nó là thứ dùng
chung, và nó phải nằm ở nơi người khác tìm ra được.

**Ranh giới.** Không phải `CQRS-4`: `CQRS-1` nói file nào **được phép** nằm trong thư mục, `CQRS-4`
nói file service ấy **được phép chứa gì** — một service đúng chỗ vẫn có thể sai nội dung. Không phải
`CQRS-7`: `CQRS-1` nói cái gì được nằm trong thư mục, `CQRS-7` nói cái gì **bắt buộc** phải nằm; một
thư mục có thể sạch theo `CQRS-1` mà vẫn thiếu spec.

**Tình huống nghiệp vụ hay gặp.** Thêm một mutation mới · tách một mutation quá tải làm hai · một hàm
tính giá bị viết ngay trong thư mục thao tác rồi thao tác thứ hai chép lại nó · một enum dùng chung
bị nhét vào thư mục của thao tác đầu tiên cần tới nó.

## `CQRS-2` — message chỉ bê request context

**Khi nào gặp.** Command hoặc query mang đúng một field `params`, và field đó chở request, người dùng
đã xác thực, và locale. Không method, không default, không logic.

**Source phải thể hiện gì.** Một class trần trong `<operation>.command.ts` (hoặc
`<operation>.query.ts`) mà constructor nhận đúng một `readonly params` và không khai báo gì khác.

**Cách nhận ra.** Constructor của message có đúng một tham số, tên `params`. Không có getter
nào tính ra một giá trị mới từ request. Không có giá trị mặc định nào được điền ở đây. Tự hỏi: nếu
hai chỗ khác nhau cùng dispatch message này, chúng có thể hiểu message theo hai nghĩa khác nhau
không? Nếu message tự tính thứ gì đó thì câu trả lời là có.

**Ranh giới.** Không phải `CQRS-4`: cả hai đều là chỗ không được chứa nghiệp vụ, nhưng lý do khác
nhau. Nghiệp vụ trong service thì **không cửa nào khác gọi tới được**; nghiệp vụ trong message thì
**không ai đọc tới**, vì message là chỗ người ta liếc qua chứ không phải chỗ người ta đi tìm quyết
định. Không phải `CQRS-6`: event cũng là message, nhưng nó chở payload của việc phải làm, không chở
request context của một người gọi đang chờ.

**Tình huống nghiệp vụ hay gặp.** Message tự chuẩn hoá email · message tự điền `page = 1` · message
tự tính `totalAmount` từ danh sách item · message tách một chuỗi id thành mảng · message có
`isAdmin()` đọc từ user.

## `CQRS-3` — handler cắm vào `process`, không bao giờ `execute`

**Khi nào gặp.** Base handler là một **template method**: `execute` là cửa công khai và nó gọi
`process` mà handler tự cài. Cái seam đó tồn tại để một mối quan tâm cắt ngang — đo thời gian, ghi
log, mở transaction, retry — được thêm **một lần** ở base thay vì một trăm lần ở từng handler.

**Source phải thể hiện gì.** Một class handler trong `<operation>.handler.ts` kế thừa base và khai
báo `protected override async process(...)`. `execute` vẫn là method cụ thể của base và không được
khai báo trên handler.

**Cách nhận ra.** Handler khai báo `protected override async process(...)`. Nếu handler khai
báo `execute`, nó đã **tự bước ra khỏi template**: vẫn compile, vẫn chạy, và là đúng file mà thay
đổi cắt ngang lần sau sẽ bỏ sót trong im lặng. Tự hỏi: nếu tuần sau ai đó thêm transaction vào base,
file này có nhận được không?

**Ranh giới.** Không phải `CQRS-4`: service **cũng** có method tên `execute`, và đó là đúng — service
không kế thừa template nào cả. `execute` sai chỗ là `execute` trên **handler**. Cũng không phải ngoại
lệ handler trừu tượng trung gian: một handler kế thừa một handler trừu tượng khác có thể **thừa
hưởng** `process`, không khai báo gì cả mà vẫn đúng.

**Tình huống nghiệp vụ hay gặp.** Copy một handler cũ viết từ trước khi có base · một họ query gợi ý
dùng chung một cách tìm · thêm log thời gian chạy cho toàn bộ handler và phát hiện ba file không hề
xuất hiện trong log.

## `CQRS-4` — service chỉ dispatch, và chỉ có thế

**Khi nào gặp.** Service nằm cạnh handler tồn tại để **cửa không phải import bus**. Nó dài một dòng,
và nó dài một dòng có chủ đích.

**Source phải thể hiện gì.** Một service trong `<operation>.service.ts` mà toàn bộ thân method là
một lời gọi `commandBus.execute(new …Command(params))` rồi trả về. Nó không import repository, không
import entity manager, không import service nghiệp vụ nào.

**Cách nhận ra.** Thân method là một lời gọi `commandBus.execute(new …Command(params))`.
Service không import repository, không import entity manager, không import service nghiệp vụ nào. Nếu
thấy một câu `if` mang tính nghiệp vụ ở đây: luật đó vừa rơi vào chỗ **không có message**, nên CLI
cũng làm cùng việc ấy sẽ không với tới được và sẽ mọc ra bản sao của riêng nó. Tự hỏi: nếu ngày mai
một job chạy nền cần đúng thao tác này, nó có gọi được không? Nếu phải dựng cả cửa lên mới gọi được,
luật đang nằm sai chỗ.

**Ranh giới.** Không phải `CQRS-2`: xem trên — cùng một điều cấm, khác file và khác lý do. Không phải
`CQRS-5`: một service tự ném exception nghiệp vụ vẫn sai — không phải vì ném là sai, mà vì **quyết
định** ném nằm ngoài handler. Đúng chỗ thì cùng exception ấy được ném từ `process`.

**Tình huống nghiệp vụ hay gặp.** Kiểm tra đã sở hữu khoá học trước khi thêm vào giỏ · kiểm tra quyền
ngay trong service · map DTO ngay trong service · service gọi hai bus liên tiếp để "ghép" hai thao
tác.

## `CQRS-5` — handler sở hữu thất bại, và thất bại là một domain exception

**Khi nào gặp.** Handler không làm được việc thì **ném đúng cái exception nói vì sao**. Nó không trả
`null`, và nó không trả một shape thành công có chứa chuỗi lỗi.

**Source phải thể hiện gì.** Bên trong `<operation>.handler.ts`, mỗi nhánh thất bại ném một domain
exception có tên, chở theo định danh đã gây ra thất bại đó; không nhánh nào trả `null` để nói
"không".

**Cách nhận ra.** Mỗi nhánh từ chối có một tên riêng, và cái tên ấy chở theo dữ liệu người gọi
sẽ cần. Không có `return null` nào mang nghĩa "không được". Không có `{ ok: false, error }` nào — mỗi
người gọi sẽ tự giải mã nó một kiểu. Tự hỏi: người gọi có đủ thông tin để phân biệt "không tồn tại",
"đã bị xoá" và "không có quyền đọc" không? Nếu cả ba về tới nơi dưới dạng cùng một `null` thì lý do
đã chết trên đường về.

**Ranh giới.** Không phải `CQRS-4`: xem trên — cùng một exception, khác chỗ ném, khác kết luận. Không
phải `CQRS-6`: một việc phụ thất bại **không** biến thao tác chính thành thất bại. Mail không gửi
được là chuyện của handler event; nó không được nhấn chìm câu trả lời người gọi đang chờ.

**Tình huống nghiệp vụ hay gặp.** Trả `null` khi không tìm thấy bản ghi · nuốt lỗi rồi trả mảng rỗng ·
trả `{ success: false, message }` cho tầng trên tự đoán · ném `Error` trần thay vì exception có danh
tính.

## `CQRS-6` — event là cho việc kiểu gì cũng phải xảy ra

**Khi nào gặp.** Dispatch event khi việc phải xảy ra **dù người gọi còn đó hay không** — một email,
một projection, một lần đồng bộ. Còn thứ mà câu trả lời của người gọi phụ thuộc vào thì ở lại trong
command.

**Source phải thể hiện gì.** Một class event chở payload, và một handler đẩy việc vào hàng đợi —
không có gì trên đường request `await` kết quả của nó. Event không trả về giá trị.

**Cách nhận ra.** Không ai `await` kết quả của event để trả lời request. Event không trả về giá
trị, và không ai cần nó trả về giá trị. Nếu resolver sau khi publish event lại đi **hỏi lại**
database xem dòng đã có chưa: đó là một command bị viết thành event. Tự hỏi: người gọi có cần biết
việc này xong chưa mới trả lời được không? Nếu có, đó là command.

**Ranh giới.** Không phải `CQRS-2`: cả hai đều là message, khác nhau ở **ai chờ** — command có người
chờ kết quả, event thì không. Không phải `CQRS-5`: xem trên.

**Tình huống nghiệp vụ hay gặp.** Gửi mail xác nhận · cập nhật projection đọc · đồng bộ sang kho dữ
liệu thứ hai · phát thông báo · ghi audit log · thêm người dùng vào một nhóm bên ngoài.

## `CQRS-7` — handler có spec song sinh nằm cạnh

**Khi nào gặp.** `<operation>.handler.spec.ts`, cùng thư mục. Handler là chỗ các quyết định nằm, nên
đó cũng là chỗ unit test nằm.

**Source phải thể hiện gì.** Một file `<operation>.handler.spec.ts` nằm cạnh
`<operation>.handler.ts`, không phải trong một cây test song song.

**Cách nhận ra.** Mở thư mục thao tác là thấy ngay spec. Người sửa handler nhìn thấy spec **mà
không cần đi tìm**; spec nằm trong một cây test riêng thì chỉ người đi tìm test mới thấy. Tự hỏi:
người sửa file này ngày mai có bị spec đập vào mắt không, hay phải nhớ ra là có nó?

**Ranh giới.** Không phải `CQRS-1`: xem trên. `CQRS-1` là "được phép nằm", `CQRS-7` là "bắt buộc phải
nằm".

**Tình huống nghiệp vụ hay gặp.** Handler mới chưa có spec · spec bị chuyển sang cây test tập trung
cho "gọn" · spec đặt tên khác tên thao tác nên grep không ra · một nhánh từ chối mới được thêm vào
handler mà spec không đổi.

## Tầng giữ

Mỗi mã hiện được giữ ở tầng nào. `unrepresentable` nghĩa là giá trị sai không viết ra được;
`enforced` nghĩa là một rule có tên trong `@canon-be` báo cáo nó; `documented` nghĩa là
không có gì máy móc giữ nó, chỉ người đọc giữ.

| Mã | Tầng | Ai giữ |
|---|---|---|
| `CQRS-1` | `documented` | Không có gì đối chiếu danh sách file trong thư mục với tên thao tác. Người đọc, hoặc một gate đi bộ qua cây thư mục, là kiểm tra duy nhất. |
| `CQRS-2` | `enforced` | `message-carries-params-only` — báo mọi method trên message, và mọi constructor không phải đúng một `params`. |
| `CQRS-3` | `enforced` | `handler-overrides-process` — báo một `execute` được khai báo, và báo một handler đứng một mình mà không có `process`. Nửa sau còn thêm mức `unrepresentable`: base khai `process` là abstract, nên một lớp con cụ thể bỏ sót nó thì không compile. Ghi đè `execute` thì vẫn viết ra được hoàn toàn, và đó đúng là lý do rule này tồn tại. |
| `CQRS-4` | `documented` | Mỏng hay không là một phán đoán. Một rule đoán mò "nhiều logic quá" sẽ bắn vào những service đúng đủ nhiều lần để bị tắt đi. |
| `CQRS-5` | `documented` | Trả về `null` là kết quả hợp lệ của nhiều thao tác; chỉ nghiệp vụ mới nói được `null` nào nghĩa là thất bại. |
| `CQRS-6` | `documented` | Người gọi có chờ event hay không là một sự thật về phía người gọi, không phải về chỗ publish mà một rule nhìn thấy. |
| `CQRS-7` | `enforced` | `handler-has-twin-spec` — mặc định tắt vì nó nhận danh sách file trong thư mục như một option; repository nào nối danh sách ấy từ gate của chính nó thì bật được. Chưa nối thì trên thực tế mã này là `documented`. |

Bốn mã đọc ra `documented`, và đó là trạng thái thành thật chứ không phải một lỗ hổng cần che đi. Ba
mã được enforce đúng là ba thứ mà một parser nhìn thấy được: hình dạng tên file, hình dạng class, và
một tên file anh em. Công việc nằm ở đâu, service mỏng đến mức nào, một `null` nghĩa là gì và người
gọi có chờ hay không đều là phán đoán, và một rule đoán mò những thứ ấy sẽ dạy tất cả mọi người thói
quen tắt nó đi.

## Điểm neo

Một luật không chỉ được vào code thật thì mới chỉ là một đề xuất. Mỗi mã nêu tên một file trong
repository tham chiếu và nêu phải nhìn cái gì ở đó.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `CQRS-1` | `features/api/core/graphql/mutations/courses/add-to-cart/` | Mọi file đều mang tên thao tác: `.command.ts`, `.handler.ts`, `.service.ts`, `.resolver.ts`, `.module.ts`, `.module-definition.ts`. |
| `CQRS-2` | `features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.command.ts` | Một class trần mà constructor nhận đúng một `readonly params`, và không khai báo gì khác. |
| `CQRS-3` | `modules/platform/cqrs/icqrs-handler.ts` | `execute` là method cụ thể và nó gọi `process`; `process` là `protected abstract`. Đây là cái seam mà handler không được bước ra khỏi. |
| `CQRS-4` | `features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.service.ts` | Toàn bộ thân method là một `commandBus.execute(new …Command(params))`; service không import repository nào. |
| `CQRS-5` | `features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.handler.ts` | Mỗi nhánh thất bại ném một domain exception có tên, chở theo định danh gây ra nó; không nhánh nào trả `null` để nói "không". |
| `CQRS-6` | `modules/platform/cqrs/event-bus/send-mail/` | Một class event chở payload, và một handler đẩy vào hàng đợi — không có gì trên đường request chờ kết quả của nó. |
| `CQRS-7` | `features/api/core/graphql/mutations/courses/course-enroll/course-enroll.handler.spec.ts` | Spec nằm cạnh `course-enroll.handler.ts`, không nằm trong một cây test song song. |

Mã nào cũng có neo. Neo là đường dẫn trong repository tham chiếu và chỉ tồn tại để kiểm chứng; các ví
dụ ở đây không nêu tên sản phẩm nào và repository nào.

## Đầu vào

| Đầu vào | Bằng chứng phải có |
|---|---|
| operation | Tên verb-object mà thư mục mang |
| doors | Mọi người gọi có thể với tới việc này: resolver, controller, CLI, job, test |
| message | Command, query hay event, và vì sao là cái đó |
| handler | Class cài `process`, và base mà nó kế thừa |
| failures | Từng cách việc này có thể từ chối, và domain exception gọi tên nó |
| side effects | Việc kiểu gì cũng phải xảy ra, tách khỏi việc mà người gọi phải chờ |
| spec | Tên file spec song sinh và những quyết định nó phủ |

## Quy tắc

1. Công việc nằm trong handler. Cửa và service chỉ bê request đi; chúng không quyết định gì cả.
2. Một thao tác, một thư mục; thư mục là toàn bộ thao tác.
3. Message chở request context và không tính toán gì.
4. Handler cài `process`; `execute` là của base.
5. Thất bại là một domain exception được ném ra, không phải một giá trị trả về đã mã hoá.
6. Event chỉ dành cho việc mà người gọi không cần biết lúc nào xong.
7. Handler nào cũng có spec song sinh cùng thư mục.
8. Mỗi thao tác giải ra đúng một mã cho mỗi tình huống. Không thao tác nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ đều khép kín và nêu rõ mã nó áp
vào.

- **Handler trừu tượng trung gian.** Theo `CQRS-3`, một họ thao tác làm cùng một việc với tham số
  khác nhau được phép cài `process` một lần ở một handler trừu tượng rồi cho kế thừa. Lớp con không
  khai báo `execute` lẫn `process` là đúng, vì nó thừa hưởng công việc; rule chỉ soi lớp đứng một
  mình, bởi vì báo cáo bất kể lớp cha đã được đo là sai nhiều hơn đúng rất nhiều.
- **`.command.ts` có decorator là một cửa, không phải message.** Theo `CQRS-2`, một framework CLI
  dùng đúng hậu tố tên file ấy cho một class có decorator và có method `run`. Đó là một cửa và nó
  thuộc tinh thần của `CQRS-4`, không thuộc hình dạng message. Một message CQRS là class trần.
- **Type transport trong thư mục thao tác.** Theo `CQRS-1`, request/response chỉ phục vụ cửa của
  chính thao tác này được phép nằm trong một thư mục con mang tên vai trò của chúng. Chúng là một
  phần của thao tác, không phải thứ vừa được phát minh trong đó. Đây là một mâu thuẫn đã được ghi
  nhận với cách đọc chặt nhất của luật, không phải một lần nới lỏng trong im lặng.
- **Nợ khi mới bật rule.** Một rule của module này ra mắt ở mức `warn` kèm số vi phạm bên cạnh trong
  lúc nợ còn lớn hơn không, được đốt về không, rồi mới lật sang `error` ở mức không. Ra mắt ở `error`
  khi còn nợ thì chặn mọi commit chạm vào file vi phạm, và đó là cách một rule đúng bị gỡ bỏ.
- **Chỉ đo report của chính module này.** Khi đếm số vi phạm của một rule, chỉ đếm report của chính
  rule đó. Comment disable nội tuyến trỏ tới những rule mà một config đo tối giản không bao giờ nạp
  cũng bị báo là lỗi, và đếm cả chúng thì mọi phép đo đều phồng lên cùng một chiều.

## Đầu ra

```text
operation: <verb-object folder name>
doors: <resolver | controller | cli | job | test>
message: <command | query | event>
situation: <CQRS-1 | CQRS-2 | CQRS-3 | CQRS-4 | CQRS-5 | CQRS-6 | CQRS-7>
placement: <file the code must live in>
reason: <the second door that could not reach this work otherwise>
```

Mỗi file mà shape sinh ra là một block.

## Ví dụ đã giải

Shape đã duyệt: một học viên được thêm một khoá học vào giỏ, và thao tác từ chối khi học viên đã sở
hữu khoá học đó rồi.

Shape nói rằng thao tác tồn tại, nói tên verb-object của nó, và nói một nhánh từ chối. Nó không nói
có những file nào, handler kế thừa base nào, nhánh từ chối là giá trị trả về hay một cú ném, hay test
nằm ở đâu — shape không giải quyết những thứ đó, pattern này mới giải quyết.

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-1
placement: add-to-cart/add-to-cart.command.ts
reason: this is placement in the operation folder, not the contents of the service file — CQRS-4 governs contents, and a service in the right place can still hold the wrong contents
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-2
placement: add-to-cart/add-to-cart.command.ts
reason: the class is a plain class with one readonly params, so it is a message and not the decorated .command.ts door the CQRS-2 exception carves out
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-3
placement: add-to-cart/add-to-cart.handler.ts
reason: the class is standalone and declares process itself, so the intermediate-abstract-handler exception does not apply and execute stays on the base
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-4
placement: add-to-cart/add-to-cart.service.ts
reason: the body is one commandBus.execute call and imports no repository, which is what separates it from CQRS-2 — the prohibition is the same, the file and the reason are not
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-5
placement: add-to-cart/add-to-cart.handler.ts
reason: the caller waits on this refusal, so it is a thrown domain exception in the handler and not the CQRS-6 event path whose failure must not drown the caller's answer
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: event
situation: CQRS-6
placement: add-to-cart/add-to-cart.handler.ts
reason: nothing on the request path awaits the notification, so the caller's answer does not depend on it and it is not a command
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-7
placement: add-to-cart/add-to-cart.handler.spec.ts
reason: CQRS-1 only permits this file in the folder; CQRS-7 requires it, which is why a folder clean under CQRS-1 can still be missing its spec
```

## Phạm vi

Luật này đúng với mọi thao tác backend dispatch bằng message trong stack này. Nó không nêu tên một
tính năng đơn lẻ nào. Ví dụ của nó là TypeScript thường trong một ứng dụng hình dáng Nest, và không
nêu tên sản phẩm, công ty hay repository nào. Bảng Điểm neo là chỗ duy nhất mang đường dẫn repository,
và nó mang những đường dẫn ấy để kiểm chứng, không phải để minh hoạ.
