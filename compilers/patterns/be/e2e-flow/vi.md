---
title: E2e-flow · Vietnamese
module: e2e-flow
kind: pattern
stack: be
codes: [E2E-1, E2E-2, E2E-3, E2E-4, E2E-5, E2E-6, E2E-7, E2E-8, E2E-9, E2E-10, E2E-11, E2E-12]
---

# Luồng e2e

Đầu vào của pattern này là một shape đã duyệt: một câu nghiệp vụ mà người ta đã đồng ý là đáng chứng
minh, kèm theo các bước, các actor và ranh giới đi vào đã chốt xong. Pattern không mở lại quyết định
đó. Đầu ra của nó là kiến trúc source — câu ấy trở thành file nào, tầng nào giữ phần wiring, file
được import gì, phải vào bằng cửa nào, đặt tên actor ra sao, và bị cấm với tay tới đâu. Shape nói lời
hứa là gì; pattern này nói code nằm ở đâu.

## Luật

**Một file flow là một câu nghiệp vụ, được kiểm chứng xuyên qua ranh giới production, và chỉ đỏ khi
câu đó không còn đúng — không phải vì một lý do nào khác.**

Luật testing quyết định test NÀO thuộc lane này và phải khẳng định điều gì. Module này quyết định
một file trong lane đó được viết ra sao: flow cần những phần nào, chúng xếp theo thứ tự nào, và những
thói quen nào biến một flow test tốt thành một flow test chậm và chập chờn.

Câu hỏi mà cả mười hai mã dưới đây cùng trả lời chỉ có một:

> Ba giờ sáng nó đỏ. Người mở file ra có biết **bước nào** vỡ và **vì sao** không?

Một file trả lời "không" sẽ bị người ta **chạy lại** thay vì **đọc**. Khi test chỉ được chạy lại mà
không được đọc, nó đã không còn làm bằng chứng. Đó là toàn bộ tiêu chuẩn. Tốc độ, độ phủ và sự thanh
lịch đều nằm sau nó.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi file `*.e2e-spec.ts` đều nằm trong phạm vi của
**cả mười hai mã cùng lúc** — chúng không phải thực đơn để chọn. Một flow không thể đạt `E2E-3` rồi
được miễn `E2E-6`; mười hai mã mô tả mười hai cách độc lập khiến một file thôi làm bằng chứng. Câu
"flow này nhỏ mà" không phải ngoại lệ, mà là chỗ luật bị bỏ qua nhiều nhất.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `E2E-<n>`. Con số là CỐ ĐỊNH. Các mã này được trích
dẫn từ những file luật khác và từ các bản ghi công việc cũ, nên đánh số lại một mã sẽ lặng lẽ làm hỏng
một trích dẫn ai đó đã viết ra.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `E2E-1` | Sắp mở một file trong lane flow | Đòi hỏi: một file cho một câu nghiệp vụ, và tên file **chính là** câu đó. Cấm: file đặt tên theo một nhóm resolver, một endpoint hay một module |
| `E2E-2` | Câu nghiệp vụ có nhiều chặng | Đòi hỏi: mỗi bước nghiệp vụ một `it` có tên, xếp theo thứ tự, chia scope `describe`. Cấm: một `it` ôm trọn cả flow |
| `E2E-3` | Hệ thống cần thời gian để lắng — webhook, queue, projection, socket | Đòi hỏi: poll một predicate dưới một deadline nói rõ nó đã chờ cái gì. Cấm: `sleep` / `delay` / `wait` / `pause` / `setTimeout`, và mọi promise bọc quanh một timer |
| `E2E-4` | Bước có một hệ quả nghiệp vụ | Đòi hỏi: đọc lại hệ quả ở nơi nó sống — row, message, hoặc truy vấn kế tiếp. Cấm: chỉ khẳng định envelope trả về hoặc status code |
| `E2E-5` | Lời hứa có phần giao realtime | Đòi hỏi: một client thật, chờ message KẾ TIẾP khớp một predicate, khẳng định nội dung và người nhận. Cấm: khẳng định SỐ LƯỢNG message, hoặc một recorder khả biến được reset bằng tay giữa các bước |
| `E2E-6` | Có người **không** được nhận, có thứ **không** được mở | Đòi hỏi: ít nhất một bước khẳng định sự vắng mặt — ai KHÔNG được nhận, cái gì KHÔNG được mở. Cấm: một flow chỉ toàn khẳng định thứ ĐÁNG LẼ phải tới |
| `E2E-7` | Trạng thái của một bước có thể là A hoặc B | Đòi hỏi: một assertion vô điều kiện cho mỗi bước; ép điều kiện xảy ra hoặc bỏ case đó đi. Cấm: `if`, ternary, `switch`, hay một `&&` đứng thành câu lệnh bên trong một bước |
| `E2E-8` | Flow cần app, database, broker và socket | Đòi hỏi: một chỗ duy nhất trong hạ tầng test dựng app, database, broker và socket. Cấm: wiring khai lại theo từng file spec |
| `E2E-9` | Có người hành động trong flow | Đòi hỏi: actor có tên, do chính flow dùng nó tạo mới ra. Cấm: một số thứ tự ma thuật, hoặc một actor dùng chung giữa các flow |
| `E2E-10` | Bước khó hiểu và phản xạ đầu tiên là in ra | Đòi hỏi: tên bước và assertion là output duy nhất. Cấm: `console.*` hoặc một logger của framework trong file spec |
| `E2E-11` | Chuỗi vận hành — queue, retry, scheduler, projection, realtime | Đòi hỏi: vào bằng GraphQL, HTTP, socket, broker thật hoặc scheduler thật, và mọi chặng nội bộ đều thật. Cấm: import một bus để đẩy flow đi, hoặc resolve một `*Worker` / `*Handler` rồi gọi thẳng |
| `E2E-12` | Flow chạm tới một phụ thuộc ngoài | Đòi hỏi: chỉ kịch bản hoá kết quả hoặc lỗi của client ngoài. Cấm: mock một orchestrator, bộ cân bằng, bộ định tuyến, đường entitlement hay đường tính tiền nội bộ; import SDK nhà cung cấp trong một file spec |

Mười hai mã. Module dừng ở mười hai: một tình huống mới là một thay đổi luật được ghi vào
`changelog.md`, không phải mã thứ mười ba ai đó thêm vào vì thấy có case chưa được phủ.

## Đọc một shape đã duyệt

1. **Đọc xem shape nói gì.** Nó nói câu nghiệp vụ, các bước theo thứ tự, ranh giới đi vào, nơi mỗi hệ
   quả sống, các danh tính hành động, cái gì không được xảy ra, và seam ngoài. Bảy sự thật đó là đầu
   vào; không quyết định nào bên dưới được đưa ra khi thiếu chúng.
2. **Gọi tên phần shape không nói, và do đó không giải quyết được.** Một shape đã duyệt không chọn cách
   chữ nghĩa của tên file, không chọn helper nào đứng ra poll, không chọn token nào được flow ghi đè,
   cũng không chọn cây fixture nào dựng thế giới lên. Đó là các quyết định kiến trúc thuộc pattern này;
   shape im lặng, và im lặng không phải là giấy phép bỏ qua một mã.
3. **Giải từ ngoài vào trong.** File và câu của nó (`E2E-1`) trước các bước (`E2E-2`); ranh giới đi vào
   (`E2E-11`) và seam được kịch bản hoá (`E2E-12`) trước những gì từng bước khẳng định; thế giới
   (`E2E-8`) và các actor (`E2E-9`) trước những assertion đọc chúng.
4. **Hỏi lần lượt câu hỏi của từng mã.** Cả mười hai đều nằm trong phạm vi của mọi file cùng lúc. Hãy
   hỏi từng câu hỏi cho shape này — một mã mà câu trả lời là "shape này không có tình huống đó" thì
   vẫn đã được trả lời, còn `E2E-6` được trả lời bằng cách viết ra bước phủ định, không bao giờ bằng
   kết luận rằng không có sự vắng mặt nào.
5. **Khi hai mã cùng khớp, hãy chia theo cái đang được khẳng định, không theo cái tiện tay.** Chờ một
   row là `E2E-3`; chờ một message là `E2E-5`. Một hệ quả bền vững đọc từ store là `E2E-4`; một hệ quả
   bay qua socket là `E2E-5`. Vào bằng cửa nào là `E2E-11`; thay cái gì ở đầu kia là `E2E-12`. Cả hai
   mã đều còn hiệu lực — khớp mã này không bao giờ giải phóng mã kia, và một tin nhắn vừa được lưu vừa
   được phát là hai hệ quả ở hai nơi.

## `E2E-1` — một file, một flow, tên file là câu nghiệp vụ

**Tình huống.** Bạn sắp tạo một file trong lane flow. Câu hỏi đầu tiên không phải "test resolver nào"
mà **câu nghiệp vụ nào đang được hứa**.

**Nó sinh ra gì trong source.** Một file `*.e2e-spec.ts` mà tên đọc lên thành một câu có chủ ngữ và
động từ — *một người học mua khoá học rồi bắt đầu học được* — cùng một chuỗi `describe` nói đúng câu
mà tên file đã nói.

**Dấu hiệu nhận biết.** Tên file đọc lên thành một câu có chủ ngữ và động từ. Chuỗi trong `describe`
nói cùng một câu với tên file. Người không viết file vẫn đoán được nó chứng minh gì trước khi mở ra.
Tự hỏi: nếu xoá file này, lời hứa nghiệp vụ nào mất người canh?

**Ranh giới.** Không phải `E2E-2`: `E2E-1` nói file **là** cái gì, `E2E-2` nói bên trong file được
**chia** thế nào — tên đúng mà một `it` ôm hết vẫn sai `E2E-2`. Không phải `E2E-8`: file đặt tên theo
module hạ tầng (`app.e2e-spec.ts`) không phải flow, nó là dấu hiệu wiring đang rò vào lane này.

**Tình huống nghiệp vụ hay gặp.** Mua khoá học · hoàn tiền · nộp bài chấm tự động · phòng chat nhận
tin · mở khoá thành tựu · đăng ký dùng thử · phát thông báo · nhiệm vụ hằng ngày.

## `E2E-2` — flow là chuỗi bước có tên, không phải một case dài

**Tình huống.** Câu nghiệp vụ có nhiều chặng: đặt vào giỏ, thanh toán, mở quyền học.

**Nó sinh ra gì trong source.** Mỗi chặng một `it` riêng, xếp theo thứ tự nghiệp vụ, nằm trong một
`describe`; state dùng chung khai ở scope `describe` và gán trong bước tạo ra nó.

**Dấu hiệu nhận biết.** Mỗi `it` đọc lên là một bước nghiệp vụ, không phải một lời gọi kỹ thuật. Khi
đỏ, runner in ra tên bước, và các bước sau bị bỏ qua thay vì đỏ dây chuyền. Tự hỏi: nếu chỉ nhìn dòng
đỏ mà không mở file, tôi có biết chặng nào vỡ không?

**Ranh giới.** Không phải `E2E-7`: `E2E-2` chia flow thành nhiều bước, `E2E-7` cấm **bên trong một
bước** có nhánh — chia đúng bước không cứu được một bước có `if`. Không phải `E2E-6`: bước phủ định
cũng là một bước có tên, không phải một `expect` nhét thêm vào cuối bước khẳng định.

**Vì sao không có lint.** Đếm số `it` sẽ từ chối một flow thật sự chỉ có một bước. Một rule mà false
positive đầu tiên của nó lại là trường hợp hợp lệ thì dạy tác giả rằng rule sai, chứ không dạy họ rằng
họ sai.

**Tình huống nghiệp vụ hay gặp.** Checkout nhiều chặng · onboarding · thi và chấm · nhập học rồi mở
nội dung · đặt lịch rồi xác nhận · thanh toán rồi phát quyền.

## `E2E-3` — không bao giờ ngủ; poll tới khi trạng thái lắng, kèm deadline

**Tình huống.** Có một chặng bất đồng bộ như webhook, queue, projection hoặc socket nên hệ thống cần
thời gian để hoàn tất.

**Nó sinh ra gì trong source.** Một lần poll có chặn trên trạng thái đang chờ: một predicate cộng một
deadline, mà thông điệp khi hết hạn nêu đúng cái trạng thái đã chờ chứ không phải chữ "timeout".

**Dấu hiệu nhận biết.** Có `await` một hàm tên `sleep`, `delay`, `wait`, `pause`, hoặc một `Promise`
bọc `setTimeout`. Có một con số mili-giây mà không ai giải thích được vì sao là con số đó. Lịch sử file
cho thấy con số đó chỉ tăng, không bao giờ giảm. Tự hỏi: tôi đang chờ trạng thái nào? Nếu trả lời được,
hãy poll đúng trạng thái đó.

**Vì sao ngủ sai theo cả hai hướng cùng lúc.** Ngắn quá thì suite đỏ vì một lý do không phải lỗi; dài
quá thì **mọi lần chạy** đều trả giá cho trường hợp xấu nhất. Cả hai đều được "sửa" bằng cách tăng số
lên, và việc đó không mua được đúng đắn lẫn tốc độ. Bản thân deadline là một assertion: "việc này lắng
trong N giây" là một tuyên bố về hệ thống, nên khi hết hạn, thông điệp phải nói cái đã chờ.

**Ranh giới.** Không phải `E2E-5`: chờ một **row** là `E2E-3`, chờ một **message** là `E2E-5` — cả hai
đều poll, nhưng cái sau còn phải khẳng định nội dung và người nhận. Không phải `E2E-6`: chờ **có** là
`E2E-3`, quan sát **không có** trong một khoảng im lặng là `E2E-6`, và đó là chỗ duy nhất một khoảng
thời gian cố định hợp lệ, vì sự vắng mặt chỉ đo được bằng thời gian.

**Tình huống nghiệp vụ hay gặp.** Webhook thanh toán về · job trong queue chạy xong · projection CDC
bắt kịp · cache bị vô hiệu · scheduler nổ · email vào outbox.

## `E2E-4` — khẳng định hệ quả, và đọc nó ở nơi nó sống

**Tình huống.** Một bước vừa gọi xong. Câu hỏi là: hệ quả nghiệp vụ của bước đó nằm ở đâu?

**Nó sinh ra gì trong source.** Một lần đọc từ chính nơi hệ quả sống — row đọc qua entity manager thật
của datasource chính, message, hoặc truy vấn kế tiếp — và assertion đặt lên lần đọc đó, không đặt lên
envelope của transport.

**Dấu hiệu nhận biết.** Bước chỉ khẳng định `statusCode`, `errors` rỗng, hoặc `data.x` trong envelope
trả về. Không có lần đọc nào từ database, message hay truy vấn kế tiếp. Nếu handler ghi sai bảng mà vẫn
trả `200`, bước này vẫn xanh. Tự hỏi: nếu server trả lời đúng nhưng **không ghi gì**, bước này có đỏ
không?

**Envelope chứng minh điều gì.** Nó chỉ chứng minh server đã trả lời. Đó là một sự kiện của transport,
không phải hệ quả nghiệp vụ.

**Ranh giới.** Không phải `E2E-5`: hệ quả **bền vững** đọc từ store là `E2E-4`, hệ quả **bay qua
socket** là `E2E-5`. Không phải `E2E-12`: đọc lại `mock.calls` của seam ngoài là hợp lệ để chứng minh
hand-off, nhưng nó không thay được lần đọc row khi hệ quả có row.

**Nửa được lint giữ.** Rule chỉ thấy được rằng file **có** đọc state bền vững ở đâu đó. Nó không biết
bạn đọc **đúng** cái hệ quả hay không. Nửa còn lại là việc của người đọc.

**Tình huống nghiệp vụ hay gặp.** Row ghi danh mở ra · số dư sau giao dịch · trạng thái đơn hàng · điểm
kinh nghiệm cộng thêm · bản ghi job hoàn tất · quyền truy cập bị đóng lại sau hoàn tiền.

## `E2E-5` — bước realtime mở client thật, và khẳng định cái gì đã tới, không phải bao nhiêu

**Tình huống.** Nghiệp vụ hứa "người trong phòng nhận được tin". Bước phải mở một client thật và chờ
đúng tin đó.

**Nó sinh ra gì trong source.** Một client socket thật cùng một lần chờ message KẾ TIẾP khớp predicate,
với assertion đặt lên nội dung và người nhận — không có assertion độ dài, không có recorder reset bằng
tay.

**Dấu hiệu nhận biết.** Có `expect(...).toBe(2)` trên độ dài một mảng message. Có một recorder toàn
cục, được reset bằng tay giữa các bước. Thêm một subscriber nữa vào hệ thống là bước này đỏ. Tự hỏi:
nếu payload **sai** nhưng số người nhận **đúng**, bước này có đỏ không?

**Vì sao đếm là sai.** Con số đó mã hoá hôm nay có bao nhiêu listener đang kết nối. Thêm người nghe thứ
ba thì một hệ thống đúng hoá đỏ; gửi sai payload cho đúng số người thì một hệ thống hỏng vẫn xanh. Đếm
là chi tiết cài đặt của fan-out; **nội dung** mới là lời hứa.

**Ranh giới.** Không phải `E2E-6`: `E2E-5` khẳng định cái **đã tới đúng người**, `E2E-6` khẳng định cái
**không tới người khác**, và một flow realtime đủ tiêu chuẩn phải có cả hai. Không phải `E2E-4`: một
tin nhắn được lưu **và** được phát là hai hệ quả ở hai nơi — đọc row là `E2E-4`, nhận socket là
`E2E-5`, và bỏ một trong hai là bỏ nửa lời hứa.

**Tình huống nghiệp vụ hay gặp.** Tin nhắn phòng chat · thông báo đẩy · con trỏ hiện diện · tiến độ job
stream về · trạng thái phiên phỏng vấn · cập nhật bảng xếp hạng trực tiếp.

## `E2E-6` — phủ định là một phần của flow

**Tình huống.** Trước khi khách đăng ký, họ phải **không** nhận được gì. Trước khi thanh toán lắng,
quyền học phải **đóng**.

**Nó sinh ra gì trong source.** Ít nhất một bước có tên chứng minh sự vắng mặt, với một actor thứ hai
đứng ngoài, được quan sát qua một khoảng im lặng ngắn và được nêu rõ.

**Dấu hiệu nhận biết.** File chỉ toàn bước "thì phải nhận được", không có bước nào "thì phải không nhận
được". Không có actor thứ hai đứng ngoài để chứng minh không bị rò. Một hệ thống phát mọi thứ cho mọi
người sẽ qua sạch cả file. Tự hỏi: nếu hệ thống gửi mọi thứ cho mọi người, file này có bắt được không?

**Vì sao đây là hỏng quan trọng nhất.** Vì nó **vô hình trên happy path**. Rò rỉ không làm ai báo lỗi:
người đáng nhận vẫn nhận được. Chỉ có một bước phủ định mới nhìn thấy nó.

**Ranh giới.** Không phải `E2E-5`: xem trên. Không phải `E2E-3`: đây là ngoại lệ duy nhất mà một
**khoảng thời gian cố định** hợp lệ, vì "không có gì xảy ra" chỉ đo được bằng "trong bao lâu". Khoảng
im lặng đó phải ngắn và phải nêu rõ.

**Tình huống nghiệp vụ hay gặp.** Người ngoài phòng không nhận tin · học viên chưa trả tiền không mở
được nội dung · người dùng khác không thấy bản nháp · webhook lạ không phát quyền · người đã rời nhóm
không nhận thông báo nữa.

## `E2E-7` — không rẽ nhánh trong một bước

**Tình huống.** Bước đang xét một trạng thái có thể là A hoặc B, và tác giả viết `if` để "an toàn".

**Nó sinh ra gì trong source.** Mỗi bước đúng một assertion vô điều kiện: điều kiện bị ép xảy ra rồi
khẳng định thẳng, hoặc case đó rời khỏi file này. Không `IfStatement`, `ConditionalExpression`,
`SwitchStatement` hay `LogicalExpression` đứng thành câu lệnh bên trong một bước.

**Dấu hiệu nhận biết.** Có `if`, ternary, `switch`, hoặc `a && expect(...)` đứng thành câu lệnh, bên
trong `it`. Có `expect` nằm trong nhánh mà không phải nhánh nào cũng chạy. Chạy hai lần cho hai kết quả
xanh khác nhau, chứng minh hai thứ khác nhau. Tự hỏi: lần chạy **bỏ qua** nhánh này thì file đang chứng
minh cái gì?

**Vì sao xanh mà rỗng.** Nhánh trong một bước nghĩa là test chấp nhận cả hai đường, nên lần xanh không
còn là bằng chứng nghiệp vụ đã đúng — nó chỉ chứng minh code chạy tới cuối. Cách sửa: nếu điều kiện
**là** một phần của flow, hãy ép nó xảy ra rồi khẳng định vô điều kiện; nếu không, nó không thuộc file
này. Hai kết cục cùng hợp lệ là hai bước, hoặc hai flow.

**Ranh giới.** Không phải `E2E-2`: tách thành nhiều bước là cách hợp lệ để bỏ nhánh, nhét nhánh vào một
bước thì không. Không phải `E2E-3`: predicate của lần poll có chặn **được phép** là một biểu thức điều
kiện — nó là thứ đang được chờ, không phải một assertion có điều kiện.

**Tình huống nghiệp vụ hay gặp.** Trạng thái gateway có thể pending hoặc paid · job có thể đã chạy ·
cache có thể ấm · người dùng có thể đã có row · retry có thể chưa cạn.

## `E2E-8` — một chỗ dựng thế giới lên

**Tình huống.** Flow cần app, database, broker, socket. Wiring đó thuộc về hạ tầng test, không thuộc về
file flow.

**Nó sinh ra gì trong source.** Các entry point trong cây hạ tầng test dựng thế giới lên, được gọi ngay
dòng đầu của spec; bản thân file spec không chứa wiring riêng, và một lần ghi đè theo flow khai lại
đúng một token nó ghi đè.

**Dấu hiệu nhận biết.** File flow mở đầu bằng hai trăm dòng `Test.createTestingModule`. Đổi một provider
hạ tầng phải sửa hai mươi lăm file. Hai file flow dựng thế giới hơi khác nhau, và không ai biết khác chỗ
nào. Tự hỏi: khi wiring đổi, bao nhiêu file phải đổi theo?

**Ranh giới.** Không phải `E2E-12`: hạ tầng chung quyết định cái gì **mặc định** được kịch bản hoá, và
một flow ghi đè bằng cách khai lại đúng token đó — ghi đè là hợp lệ, **sao chép cả thế giới** để ghi đè
một token thì không. Không phải `E2E-9`: thế giới cung cấp **hàm tạo** actor và flow gọi hàm đó; thế
giới không giữ sẵn một actor dùng chung.

**Vì sao không có lint.** Đây là một sự thật về cây fixture của một repository, không phải về một file.
Nó thuộc về một gate nhìn được cả cây, không thuộc về một rule chỉ nhìn thấy một file.

**Tình huống nghiệp vụ hay gặp.** Boot app cho lane flow · reset database giữa các file · dựng kết nối
broker · mở namespace socket · nạp seed tối thiểu.

## `E2E-9` — actor có tên, và do chính flow tạo ra

**Tình huống.** Flow cần một người mua, một người khác không được thấy gì, và một tổ chức.

**Nó sinh ra gì trong source.** Những lời gọi tới hàm tạo actor của thế giới, nhận vào một TÊN và ghi
xuống một row mới cho mỗi flow; không số thứ tự nào được chấp nhận và không actor nào được chia sẻ giữa
các flow.

**Dấu hiệu nhận biết.** Có số thứ tự ma thuật: `accountNumber: 8`, `userId: 3`. Actor được lấy từ seed
dùng chung thay vì được tạo mới. Chạy hai file cùng lúc thì cả hai cùng đỏ một cách khó hiểu. Tự hỏi:
nếu file này chạy **cùng lúc** với một file khác, hai bên có giẫm lên nhau không?

**Vì sao số thứ tự là nợ.** Nó không nói gì cho người đọc, và nó **va nhau lặng lẽ** khi hai flow cùng
chọn một số. Tên thì vừa mô tả vai trò, vừa buộc mỗi flow tự tạo ra actor của mình — nên các flow không
chia state và chạy theo thứ tự nào cũng được.

**Ranh giới.** Không phải `E2E-6`: actor thứ hai (`otherLearner`, người lạ) tồn tại **chính là để** phủ
định kiểm tra được; không có actor có tên thì không có bước phủ định tử tế. Không phải `E2E-8`: xem
trên.

**Tình huống nghiệp vụ hay gặp.** Người mua và người ngoài cuộc · chủ phòng và khách · người chấm và
người nộp · tổ chức và thành viên · người đã rời nhóm.

## `E2E-10` — flow không log gì cả

**Tình huống.** Bước đang khó hiểu, và phản xạ đầu tiên là in ra vài dòng.

**Nó sinh ra gì trong source.** Không sinh ra gì: tên bước và assertion là output duy nhất của một spec.
Không `console.log`, `console.debug` hay logger của framework ở bất cứ đâu trong file spec.

**Dấu hiệu nhận biết.** Có `console.log`, `console.debug`, hoặc một logger của framework trong file
spec. Output của một lần chạy xanh dài hơn danh sách tên bước. Khi đỏ, dòng assertion bị đẩy khỏi màn
hình. Tự hỏi: khi nó đỏ, người đọc **cần** gì? Tên bước và assertion — cả hai runner đã in sẵn.

**Ranh giới.** Không phải `E2E-2`: nếu bạn thấy cần log để biết bước nào đang chạy, thứ thiếu là **tên
bước**, không phải log. Không phải `E2E-4`: nếu bạn thấy cần log để biết state ra sao, thứ thiếu là
**một lần đọc state có assertion**, không phải log.

**Ai đang giữ nó.** Không phải module này. Luật observability đã có `no-console` và
`starci-be/no-framework-logger` phủ mọi call site; thêm một rule nữa ở lane này chỉ nhân đôi mọi báo
cáo.

**Tình huống nghiệp vụ hay gặp.** Debug tạm quên xoá · in payload webhook · in id job · in trạng thái
retry.

## `E2E-11` — chuỗi vận hành vào bằng cửa production, và mọi chặng trong đều thật

**Tình huống.** Flow đang chứng minh fallback, retry, queue, scheduler, projection, vô hiệu cache hoặc
giao realtime.

**Nó sinh ra gì trong source.** Một lần đi vào bằng GraphQL, HTTP, socket, publish vào broker thật, hoặc
để scheduler thật nổ; một worker có thể được import để framework đăng ký nó, và trong file không có chỗ
nào resolve một actor nội bộ ra để đẩy flow đi.

**Dấu hiệu nhận biết.** File import một bus rồi tự `execute` để "đẩy flow đi cho nhanh". File resolve
một `*Worker` / `*Handler` từ container rồi gọi `process` trực tiếp. Retry, ack, khoá và cạnh tranh
consumer **không xuất hiện** ở đâu trong file. Tự hỏi: nếu serialization hoặc ack hỏng, file này có đỏ
không?

**Ranh giới hẹp và quan trọng.** **Import** một worker để framework đăng ký nó là **đúng và bắt buộc**.
**Resolve rồi gọi** một method nội bộ của nó là sai: lời gọi trực tiếp xoá sạch serialization, khoá,
retry, ack và hành vi competing-consumer — đúng những hành vi mà flow vận hành sinh ra để chứng minh.

**Ranh giới.** Không phải `E2E-12`: `E2E-11` nói **đi vào bằng cửa nào**, `E2E-12` nói **thay cái gì ở
đầu kia** — vào đúng cửa rồi mock mất orchestrator ở giữa vẫn hỏng, và ngược lại. Không phải `E2E-4`:
vào đúng cửa mà chỉ đọc envelope thì vẫn thiếu hệ quả.

**Nửa được lint giữ.** `e2e-uses-production-transport` bắt được import bus và lời gọi trực tiếp tới
`*Worker` / `*Handler`. Còn việc flow có thật sự đi vào bằng ranh giới production hay không là phán
đoán của người đọc.

**Tình huống nghiệp vụ hay gặp.** Job mail retry rồi cạn lượt · thành viên GitHub qua ba bước bền vững ·
projection CDC bắt kịp · sự kiện đi xuyên hai instance · scheduler dọn phiên hết hạn · cache bị vô hiệu
sau khi ghi.

## `E2E-12` — ghi đè kết quả ngoài, không bao giờ ghi đè chính sách trong đã chọn ra nó

**Tình huống.** Flow chạm tới một phụ thuộc ngoài: nhà cung cấp mô hình, cổng thanh toán, IdP, SMTP,
sandbox chấm code, bộ chuyển mã.

**Nó sinh ra gì trong source.** Một kịch bản đặt lên đúng seam của client ngoài cụ thể — hàm `invoke` /
`stream` của nó, hoặc lời gọi HTTP của cổng — và không đụng gì bên trong seam đó; không SDK nhà cung cấp
nào được import trong một file spec.

**Dấu hiệu nhận biết.** Có mock đặt lên một service **của mình**: bộ chọn nhà cung cấp, bộ cân bằng, bộ
định tuyến hành động, đường tính tiền. File import thẳng SDK của một nhà cung cấp. Fallback, quy kết,
rollback và idempotency **không còn** cách nào đỏ được. Tự hỏi: nếu **chính sách nội bộ** chọn sai nhà
cung cấp, sai đường hoàn tiền, sai quyền — file này có đỏ không?

**Ranh giới của seam.** Seam nằm ở **client cụ thể của bên ngoài**: hàm `invoke` / `stream` của nó, hoặc
lời gọi HTTP của cổng. Mọi thứ **bên trong** seam đó — xoay khoá, cache sức khoẻ, entitlement, tính
tiền, đối soát, định tuyến hành động, phát quyền — phải thật. Ép client ngoài **throw** là ép một **kết
quả ngoài**, và đó chính là cách chứng minh fallback; ép chính sách nội bộ quyết định gì với lỗi đó thì
không.

**Ranh giới.** Không phải `E2E-11`: xem trên. Không phải `E2E-8`: mặc định kịch bản hoá thuộc về hạ tầng
chung, và ghi đè theo từng flow là hợp lệ.

**Nửa được lint giữ.** Rule chỉ bắt được **import SDK nhà cung cấp** trong file spec. Mock một
orchestrator nội bộ không để lại import nào để bắt.

**Tình huống nghiệp vụ hay gặp.** Fallback giữa nhiều nhà cung cấp mô hình · webhook cổng thanh toán ·
cấp token IdP · SMTP từ chối rồi chấp nhận · sandbox chấm bài timeout · dịch vụ chuyển mã lỗi.

## Tầng giữ

Tầng nào thật sự giữ từng mã. `enforced` nghĩa là có một rule trong `sources/be/e2e-flow.mjs` nổ vào nó,
và rule đó được gọi tên.

| Mã | Tầng | Ai giữ |
|---|---|---|
| `E2E-1` | `documented` | Chỉ người đọc. Không thể so tên file với một câu nghiệp vụ bằng máy |
| `E2E-2` | `documented` | Chỉ người đọc. Đếm `it` sẽ từ chối một flow thật sự chỉ có một bước |
| `E2E-3` | `enforced` | `no-sleep-in-flow` — message `sleep` và `timer` |
| `E2E-4` | `enforced` (một nửa) | `e2e-asserts-persisted-state` — chỉ giữ rằng CÓ một lần đọc state bền vững, không bao giờ giữ rằng ĐÚNG hệ quả đã được đọc |
| `E2E-5` | `documented` | Chỉ người đọc. Cái được khẳng định là ý nghĩa, không phải cú pháp |
| `E2E-6` | `documented` | Chỉ người đọc. Một assertion vắng mặt thì không có hình dạng nào để nổ vào |
| `E2E-7` | `enforced` | `no-branch-in-flow-step` — `IfStatement`, `ConditionalExpression`, `SwitchStatement`, `LogicalExpression` đứng thành câu lệnh |
| `E2E-8` | `documented` | Chỉ người đọc. Đây là sự thật về một cây fixture, không phải về một file |
| `E2E-9` | `documented` | Chỉ người đọc. Ai đang hành động là ý nghĩa |
| `E2E-10` | `documented` | Không phải module này. `no-console` và `starci-be/no-framework-logger` trong luật observability đã phủ mọi call site; thêm một rule ở đây chỉ nhân đôi mọi báo cáo |
| `E2E-11` | `enforced` (một nửa) | `e2e-uses-production-transport` — import bus và lời gọi trực tiếp `*Worker` / `*Handler`. Nửa "đã đi vào bằng ranh giới production" là phán đoán của người đọc |
| `E2E-12` | `enforced` (một nửa) | `no-model-call-in-e2e` — import SDK nhà cung cấp. Mock một orchestrator nội bộ không có import nào để bắt |

**Năm trên mười hai được enforce, bảy chỉ được documented. Đó là con số thật, không phải một lỗ hổng
cần ai đó lấp.** Một rule xứng đáng có chỗ khi nó nổ vào một hình dạng cú pháp. Rule nổ vào một phán
đoán là rule mà tác giả học cách tắt đi, và một rule bị tắt để lại luật tệ hơn cả lúc chưa có gì
enforce.

**Không dòng nào ghi `unrepresentable`, và không dòng nào ghi được.** Tầng đó đóng một tập GIÁ TRỊ bằng
union hoặc brand. Mọi mã ở đây là một tuyên bố về hình dạng của một file test — có những bước nào, chúng
khẳng định gì, ai đã hành động — mà hình dạng của một file không phải một giá trị hệ thống kiểu giữ
được. Chỗ duy nhất kiểu có thể giúp là handle transport mà flow nhận vào, và nó vẫn không ngăn được một
spec resolve một actor nội bộ ra khỏi container.

## Điểm neo

Mỗi mã đều chỉ được vào code thật để đối chiếu. Một luật không chỉ được vào code thật thì là đề xuất,
không phải luật.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `E2E-1` | `src/tests/e2e/course-purchase.e2e-spec.ts` | Tên file và chuỗi `describe` nói cùng một câu; file chứng minh một lần mua, không phải một nhóm resolver |
| `E2E-2` | `src/tests/e2e/background-worker-resilience.e2e-spec.ts` | Mười bốn bước `it` có tên trong một `describe`, mỗi bước gọi tên bước nghiệp vụ nó chứng minh |
| `E2E-3` | `src/tests/helpers/flow-wait.ts` → `until`, `DEFAULT_TIMEOUT_MS`, `WaitOptions.describe` | Deadline cộng predicate đã thay cho `sleep`; trường `describe` tồn tại để lần đỏ nêu tên trạng thái, không phải chữ timeout |
| `E2E-4` | `src/tests/helpers/flow-world.ts` → `FlowWorld.entityManager`, resolve qua `getEntityManagerToken(POSTGRESQL_PRIMARY)` | Flow nhận entity manager THẬT của datasource chính, nên hệ quả được đọc từ đúng row đã ghi |
| `E2E-5` | `src/tests/helpers/flow-wait.ts` → `nextMessage`, dùng trong `src/tests/e2e/community-chat.e2e-spec.ts` | Chờ message khớp kế tiếp trên một socket thật; không có assertion đếm ở bất cứ đâu trên bề mặt helper |
| `E2E-6` | `src/tests/helpers/flow-wait.ts` → `expectNoMessage`, `DEFAULT_SILENCE_MS`; dùng trong `src/tests/e2e/notification-delivery.e2e-spec.ts` | Một bước chứng minh socket của người lạ im lặng trong khi người nhận đúng đã được phục vụ |
| `E2E-7` | `.claude/sources/be/e2e-flow.test.mjs` → `tester.run("no-branch-in-flow-step", …)` | Các fixture hợp lệ và không hợp lệ ghim chính xác hình dạng nào tính là nhánh bên trong một bước |
| `E2E-8` | `src/tests/helpers/flow-world.ts` → `bootFlowWorld`; `src/tests/helpers/create-e2e-app.ts` → `createE2eApp` | Hai entry point dựng thế giới lên, để một spec mở đầu bằng đúng thứ nó đang test |
| `E2E-9` | `src/tests/helpers/flow-world.ts` → `FlowWorld.mintLearner(name)` | Hàm tạo actor nhận một TÊN và ghi một row mới cho mỗi flow; không số thứ tự nào được chấp nhận |
| `E2E-10` | `src/tests/e2e/` (84 file spec) | Không có call site `console` thật nào. Hai lần khớp văn bản duy nhất, ở `coding-submission.e2e-spec.ts:550` và `:646`, là chuỗi source BÊN TRONG một chương trình được nộp, không phải logging |
| `E2E-11` | `src/tests/e2e/background-worker-resilience.e2e-spec.ts`; `src/tests/helpers/nats-cross-instance-world.ts` | Retry, cạn lượt và replay chứng minh qua queue thật; một thế giới dựng kết nối broker thật và `ScheduleModule` thật |
| `E2E-12` | `src/tests/helpers/ai-provider-invoke-script.ts` | Một kịch bản FIFO các kết cục của nhà cung cấp chỉ thay client ngoài, trong khi cache, khoá và đường invoke vẫn thật |

Mười hai mã, mười hai điểm neo. Không dòng nào ghi "chưa neo được".

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| sentence | Một lời hứa nghiệp vụ mà file này chứng minh, viết bằng từ ngữ người ngoài kiểm được |
| steps | Các bước nghiệp vụ theo thứ tự, mỗi bước một `it` |
| entry | Ranh giới production mà flow đi vào: GraphQL, HTTP, socket, broker hoặc scheduler |
| consequence | Nơi hệ quả của mỗi bước SỐNG: row nào, message nào, truy vấn kế tiếp nào |
| actors | Mọi danh tính hành động, có tên, và do chính flow này tạo ra |
| absence | Cái gì KHÔNG được xảy ra, và với ai |
| external seam | Client ngoài cụ thể có kết quả hoặc lỗi được kịch bản hoá, và không gì bên trong nó |

## Quy tắc

1. Một file chứng minh **một** câu nghiệp vụ, và tên file nói đúng câu đó.
2. Các bước có thứ tự vì nghiệp vụ có thứ tự; một bước được phép phụ thuộc vào bước ngay trước nó.
3. Mọi lần chờ bị chặn bởi **kết cục**, không bao giờ bởi **thời lượng**.
4. Mọi assertion đọc hệ quả **ở nơi hệ quả sống**.
5. Assertion realtime nói về **nội dung** và **người nhận**, không bao giờ về số lượng listener đang có.
6. Mỗi flow khẳng định ít nhất một **sự vắng mặt**.
7. Một bước khẳng định đúng **một** kết cục, **vô điều kiện**.
8. Thế giới được dựng ở **một** chỗ; file spec không chứa wiring riêng.
9. Actor **có tên**, và không bao giờ được chia sẻ giữa các flow.
10. Output duy nhất của một spec là **tên bước** và **assertion**.
11. Các chặng nội bộ giữ nguyên thật; chỉ **client ngoài cùng bên ngoài** được kịch bản hoá.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp vào.

- **Bước phụ thuộc bước trước (`E2E-2`).** Một bước flow ĐƯỢC PHÉP phụ thuộc vào bước ngay trước nó. Đây
  là lane duy nhất cho phép, và đó chính là định nghĩa của flow. Nó không cho phép một bước phụ thuộc
  vào bước ở file khác.
- **Flow thật sự chỉ có một bước (`E2E-2`).** Một câu nghiệp vụ chỉ gồm một operation thì một `it`. Đây
  là lý do không có rule nào đếm `it`: false positive đầu tiên sẽ là trường hợp hợp lệ, và một rule mà
  false positive đầu tiên của nó hợp lệ thì dạy tác giả rằng rule sai, chứ không dạy họ rằng họ sai.
- **Đăng ký worker (`E2E-11`).** Import worker để framework đăng ký nó là đúng và bắt buộc. Resolve
  worker đó rồi gọi `process`, `finalize` hay một method nội bộ khác mới là thứ bị từ chối: lời gọi
  trực tiếp xoá sạch serialization, khoá, retry, ack và hành vi competing-consumer — đúng những hành vi
  mà flow vận hành sinh ra để chứng minh.
- **Kịch bản hoá một lỗi bên ngoài (`E2E-12`).** Flow ĐƯỢC PHÉP ép client ngoài ném lỗi, vì lỗi đó là
  một kết quả bên ngoài. Nó không được ép chính sách nội bộ quyết định phải làm gì với lỗi đó.
- **Chờ trên sổ sách của chính mock (`E2E-3`).** Poll bản ghi lời gọi của một seam đã kịch bản hoá —
  "hand-off đã được xếp hàng đúng một lần" — vẫn là poll một trạng thái, và hợp lệ. Chờ một thời lượng
  cố định cho việc đó thì không.
- **Khoảng im lặng cố định (`E2E-6`).** Sự vắng mặt chỉ đo được bằng thời gian, nên một cửa sổ im lặng
  ngắn và được nêu rõ là ngoại lệ duy nhất của `E2E-3`.
- **Hai flow, không phải hai nhánh (`E2E-7`).** Khi hai kết cục đều là kết cục nghiệp vụ hợp lệ, chúng
  là hai bước hoặc hai file. Tách ra là cách sửa; rẽ nhánh thì không.

## Đầu ra

Một khối cho mỗi file spec mà shape đã duyệt sinh ra.

```text
sentence:    <the business promise this file proves>
file:        <name>.e2e-spec.ts
entry:       <graphql | http | socket | broker | scheduler>
steps:       <ordered business steps, one per it>
consequence: <where each outcome is read from>
actors:      <named, minted by this flow>
absence:     <what must not happen, and to whom>
scripted:    <the external client seam, and nothing inside it>
codes:       <E2E-1 … E2E-12, all twelve, with how each is satisfied>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một người học trả tiền một khoá học qua cổng thanh toán, webhook của cổng về và
giao dịch lắng, quyền học mở ra cho đúng người đó, còn một người lạ thì không nhận được thông báo và
cũng không có quyền truy cập.

Hai kết cục nghiệp vụ hợp lệ là hai file, không phải hai nhánh (`E2E-7`), nên shape này giải ra thành
hai file spec.

```text
sentence:    a learner buys a course and can then start learning
file:        course-purchase.e2e-spec.ts
entry:       graphql
steps:       place the order · gateway webhook settles the payment · enrolment opens · a stranger still has no access
consequence: the enrolment row, read through FlowWorld.entityManager on the primary datasource
actors:      buyer and stranger, both minted by name from the world's actor factory
absence:     the stranger's access must not open, and the stranger must receive no notification
scripted:    the payment gateway's own HTTP client, and nothing inside it
codes:       E2E-1 filename is the sentence · E2E-2 four named it steps in business order · E2E-3 the webhook settlement is polled under a deadline naming the awaited state · E2E-4 the enrolment row is read back, not the envelope · E2E-5 no realtime hop in this file, so nothing to open a client for · E2E-6 the stranger step proves absence · E2E-7 the pending-or-paid state is forced, not branched on · E2E-8 the world is booted by bootFlowWorld · E2E-9 buyer and stranger are named, minted here · E2E-10 no logging · E2E-11 entry through GraphQL and the real gateway webhook, no bus import, no worker resolved · E2E-12 only the gateway client is scripted; entitlement and billing stay real
```

*reason:* cửa đi vào là GraphQL và webhook là cửa production thật, và chính sự thật đó loại trừ hình
dạng bị `E2E-11` cấm — không bus nào được import, không `*Worker` nào được resolve để đẩy flow đi.

```text
sentence:    a notification reaches its intended recipient and nobody else
file:        notification-delivery.e2e-spec.ts
entry:       socket
steps:       both actors connect · the event is published · the recipient receives the exact payload · the stranger's socket stays silent
consequence: the delivered message on the recipient's real socket, plus the stored notification row
actors:      recipient and stranger, both minted by name from the world's actor factory
absence:     the stranger's socket must receive nothing across a short, explicitly stated silence window
scripted:    nothing external is touched by this flow
codes:       E2E-1 filename is the sentence · E2E-2 four named it steps · E2E-3 the row is polled under a deadline · E2E-4 the stored notification row is read back · E2E-5 a real client awaits the NEXT matching message and asserts content and recipient, never a count · E2E-6 the silence window proves the stranger received nothing · E2E-7 each step asserts one outcome unconditionally · E2E-8 the world is booted by bootFlowWorld · E2E-9 recipient and stranger named and minted here · E2E-10 no logging · E2E-11 entry through a real socket and the real broker, every internal hop real · E2E-12 no external seam, so nothing is scripted
```

*reason:* hệ quả bay qua socket và được khẳng định bằng nội dung cùng người nhận, và chính sự thật đó
loại trừ việc `E2E-4` đứng một mình — row lưu lại vẫn được đọc, vì một tin nhắn vừa được lưu vừa được
phát là hai hệ quả ở hai nơi.

**Shape không nói gì, và do đó không giải quyết được gì.** Shape đã duyệt nêu lời hứa, các actor và
ranh giới. Nó không nêu cách chữ nghĩa chính xác của tên hai file, không nêu helper nào poll lần lắng
của giao dịch, không nêu khoảng im lặng dài bao nhiêu, không nêu flow khai lại token nào để kịch bản
hoá client của cổng, cũng không nêu entry point fixture nào dựng thế giới. Những thứ đó được quyết ở
đây, bằng các mã này, và việc shape im lặng không giải phóng mã nào — riêng `E2E-6` được trả lời bằng
cách viết ra bước phủ định, không bao giờ bằng kết luận rằng shape đã không yêu cầu.

## Phạm vi

Module này nêu một quy tắc đúng với bất kỳ back end nào có một lane flow. Ví dụ chỉ là TypeScript thông
thường mang hình dạng của một framework test: một `describe`, các bước `it` có thứ tự, một entity
manager, một queue, một socket. Nó không nêu tên sản phẩm, repository hay module riêng tư nào. Ở chỗ mà
luật nguồn gọi một service nội bộ bằng tên riêng của nó, module này gọi VAI TRÒ mà service đó đảm nhận,
vì vai trò thì chuyển được còn cái tên thì không.

MỘT IDENTIFIER ĐÃ SHIP KHÔNG PHẢI LÀ TÊN SẢN PHẨM THEO NGHĨA NÀY. Một rule được trích dẫn bằng tên đã
công bố của nó, kèm cả tiền tố plugin, vì đó đúng là chuỗi mà build log in ra và comment disable mang
theo. Một trích dẫn không dán được vào ô tìm kiếm thì không phải trích dẫn. Điều lệnh cấm ở trên nhắm
tới là VĂN XUÔI và VÍ DỤ cần biết sản phẩm mới hiểu được — không bao giờ là một identifier mà ai đó sẽ
đọc thấy trong một lần đỏ rồi phải đi tra.
