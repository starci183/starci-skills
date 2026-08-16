---
id: be-patterns-e2e-flow-vi
title: vi.md
slug: /be/patterns/e2e-flow/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống E2E-N, nhận diện bằng nghiệp vụ chứ không bằng cảm giác "test thế là đủ".
---

# vi.md

> Version: `2.00` · Module: `e2e-flow`

# e2e flow

Một file flow là **một câu nghiệp vụ**, được chứng minh xuyên qua **ranh giới production**, và nó đỏ
khi câu đó không còn đúng — không đỏ vì bất cứ lý do nào khác.

Câu hỏi mà cả mười hai mã dưới đây cùng trả lời chỉ có một:

> Ba giờ sáng nó đỏ. Người mở file ra có biết **bước nào** vỡ và **vì sao** không?

File trả lời "không" là file người ta **chạy lại** thay vì **đọc**. Một test bị chạy lại thay vì đọc
thì đã thôi làm test.

**Đây là luật bắt buộc.** Mọi file `*.e2e-spec.ts` đều nằm trong phạm vi của **cả mười hai mã cùng
lúc**. Chúng không phải thực đơn để chọn: mười hai mã mô tả mười hai cách độc lập khiến một file
thôi làm bằng chứng. Câu "flow này nhỏ mà" là chỗ luật bị bỏ qua nhiều nhất.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Tầng giữ |
|---|---|---|
| `E2E-1` | Một file chứng minh một câu, và tên file **chính là** câu đó | `documented` |
| `E2E-2` | Câu nghiệp vụ có nhiều bước ⇒ mỗi bước một `it` có tên | `documented` |
| `E2E-3` | Phải chờ hệ thống lắng ⇒ poll trạng thái kèm deadline | `enforced` — `no-sleep-in-flow` |
| `E2E-4` | Có hệ quả nghiệp vụ ⇒ đọc lại đúng chỗ hệ quả đó sống | `enforced` (một nửa) — `e2e-asserts-persisted-state` |
| `E2E-5` | Có realtime ⇒ mở client thật, khẳng định **nội dung** và **người nhận** | `documented` |
| `E2E-6` | Có người **không** được nhận ⇒ phải có bước chứng minh sự vắng mặt | `documented` |
| `E2E-7` | Một bước khẳng định đúng **một** kết cục, không rẽ nhánh | `enforced` — `no-branch-in-flow-step` |
| `E2E-8` | Wiring hạ tầng ⇒ dựng thế giới ở **một** chỗ | `documented` |
| `E2E-9` | Có người hành động ⇒ actor **có tên**, do chính flow tạo ra | `documented` |
| `E2E-10` | Cần biết chuyện gì xảy ra ⇒ tên bước và assertion, không log | `documented` (luật observability giữ) |
| `E2E-11` | Chuỗi vận hành (queue, retry, scheduler, projection, realtime) ⇒ vào bằng cửa production, mọi chặng trong đều thật | `enforced` (một nửa) — `e2e-uses-production-transport` |
| `E2E-12` | Có phụ thuộc ngoài ⇒ chỉ kịch bản hoá **kết quả ngoài**, không đụng chính sách trong | `enforced` (một nửa) — `no-model-call-in-e2e` |

---

## `E2E-1` — một file, một flow, tên file là câu nghiệp vụ

**Tình huống.** Bạn sắp tạo một file trong lane flow. Câu hỏi đầu tiên không phải "test resolver
nào" mà **"câu nghiệp vụ nào đang được hứa"**.

**Dấu hiệu nhận biết**

- Tên file đọc lên thành một câu có chủ ngữ và động từ: *một người học mua khoá học rồi bắt đầu học
  được*.
- Chuỗi trong `describe` nói **cùng một câu** với tên file.
- Người không viết file vẫn đoán được nó chứng minh gì trước khi mở ra.

**Tự hỏi.** Nếu xoá file này, **lời hứa nghiệp vụ** nào mất người canh?

**Ranh giới**

- ↔ `E2E-2`: `E2E-1` nói file **là** cái gì; `E2E-2` nói bên trong file được **chia** thế nào. Tên
  đúng mà một `it` ôm hết vẫn sai `E2E-2`.
- ↔ `E2E-8`: file đặt tên theo module hạ tầng (`app.e2e-spec.ts`) không phải flow — nó là dấu hiệu
  wiring đang rò vào lane này.

**Tình huống nghiệp vụ hay gặp.** Mua khoá học · hoàn tiền · nộp bài chấm tự động · phòng chat nhận
tin · mở khoá thành tựu · đăng ký dùng thử · phát thông báo · nhiệm vụ hằng ngày.

---

## `E2E-2` — flow là chuỗi bước **có tên**, không phải một case dài

**Tình huống.** Câu nghiệp vụ có nhiều chặng: đặt vào giỏ, thanh toán, mở quyền học. Mỗi chặng là
một `it` riêng, xếp theo thứ tự, chia state qua scope của `describe`.

**Dấu hiệu nhận biết**

- Mỗi `it` đọc lên là một **bước nghiệp vụ**, không phải một lời gọi kỹ thuật.
- Khi đỏ, runner in ra tên bước, và các bước sau bị bỏ qua thay vì đỏ dây chuyền.
- State dùng chung khai ở scope `describe`, gán trong bước tạo ra nó.

**Tự hỏi.** Nếu chỉ nhìn dòng đỏ mà không mở file, tôi có biết chặng nào vỡ không?

**Ranh giới**

- ↔ `E2E-7`: `E2E-2` chia flow thành nhiều bước; `E2E-7` cấm **bên trong một bước** có nhánh. Chia
  đúng bước không cứu được một bước có `if`.
- ↔ `E2E-6`: bước phủ định cũng là một bước có tên, không phải một `expect` nhét thêm vào cuối bước
  khẳng định.

**Vì sao không có lint.** Đếm số `it` sẽ từ chối một flow **thật sự chỉ có một bước**. Một rule mà
false positive đầu tiên của nó lại là trường hợp hợp lệ thì dạy tác giả rằng rule sai, chứ không
dạy họ rằng họ sai.

**Tình huống nghiệp vụ hay gặp.** Checkout nhiều chặng · onboarding · thi và chấm · nhập học rồi mở
nội dung · đặt lịch rồi xác nhận · thanh toán rồi phát quyền.

---

## `E2E-3` — không bao giờ ngủ; poll tới khi trạng thái lắng, kèm deadline

**Tình huống.** Có một chặng bất đồng bộ: webhook, queue, projection, socket. Cần chờ.

**Dấu hiệu nhận biết**

- Có `await` một hàm tên `sleep`, `delay`, `wait`, `pause`, hoặc một `Promise` bọc `setTimeout`.
- Có một con số mili-giây mà không ai giải thích được vì sao là con số đó.
- Lịch sử file cho thấy con số đó **chỉ tăng**, không bao giờ giảm.

**Tự hỏi.** Tôi đang chờ **trạng thái nào**? Nếu trả lời được, hãy poll đúng trạng thái đó.

**Vì sao ngủ sai theo cả hai hướng cùng lúc.** Ngắn quá thì suite đỏ vì một lý do không phải lỗi;
dài quá thì **mọi lần chạy** đều trả giá cho trường hợp xấu nhất. Cả hai đều được "sửa" bằng cách
tăng số lên, và việc đó không mua được đúng đắn lẫn tốc độ.

**Deadline là một assertion.** "Việc này lắng trong N giây" là một **tuyên bố về hệ thống**. Nên khi
hết hạn, thông điệp phải nói **cái đã chờ** chứ không phải chữ "timeout".

**Ranh giới**

- ↔ `E2E-5`: chờ một **row** là `E2E-3`; chờ một **message** là `E2E-5`. Cả hai đều poll, nhưng cái
  sau còn phải khẳng định nội dung và người nhận.
- ↔ `E2E-6`: chờ **có** là `E2E-3`; quan sát **không có** trong một khoảng im lặng là `E2E-6`. Đây
  là chỗ duy nhất một khoảng thời gian cố định hợp lệ, vì sự vắng mặt chỉ đo được bằng thời gian.

**Tình huống nghiệp vụ hay gặp.** Webhook thanh toán về · job trong queue chạy xong · projection
CDC bắt kịp · cache bị vô hiệu · scheduler nổ · email vào outbox.

---

## `E2E-4` — khẳng định **hệ quả**, và đọc nó ở nơi nó sống

**Tình huống.** Một bước vừa gọi xong. Câu hỏi là: hệ quả nghiệp vụ của bước đó nằm ở đâu?

**Dấu hiệu nhận biết**

- Bước chỉ khẳng định `statusCode`, `errors` rỗng, hoặc `data.x` trong envelope trả về.
- Không có lần đọc nào từ database, message hay truy vấn kế tiếp.
- Nếu handler ghi sai bảng mà vẫn trả `200`, bước này vẫn xanh.

**Tự hỏi.** Nếu server trả lời đúng nhưng **không ghi gì**, bước này có đỏ không?

**Envelope chứng minh cái gì.** Chỉ chứng minh server đã trả lời. Đó là một sự kiện về transport,
không phải một hệ quả nghiệp vụ.

**Ranh giới**

- ↔ `E2E-5`: hệ quả **bền vững** đọc từ store là `E2E-4`; hệ quả **bay qua socket** là `E2E-5`.
- ↔ `E2E-12`: đọc lại một `mock.calls` của seam ngoài là hợp lệ để chứng minh **hand-off**, nhưng nó
  không thay được lần đọc row khi hệ quả có row.

**Nửa được lint giữ.** Rule chỉ thấy được rằng file **có** đọc state bền vững ở đâu đó. Nó không
biết bạn đọc **đúng** cái hệ quả hay không. Nửa còn lại là việc của người đọc.

**Tình huống nghiệp vụ hay gặp.** Row ghi danh mở ra · số dư sau giao dịch · trạng thái đơn hàng ·
điểm kinh nghiệm cộng thêm · bản ghi job hoàn tất · quyền truy cập bị đóng lại sau hoàn tiền.

---

## `E2E-5` — bước realtime mở client thật, và khẳng định **cái gì** đã tới, không phải **bao nhiêu**

**Tình huống.** Nghiệp vụ hứa "người trong phòng nhận được tin". Bước phải mở một client thật và
chờ đúng tin đó.

**Dấu hiệu nhận biết**

- Có `expect(...).toBe(2)` trên độ dài một mảng message.
- Có một recorder toàn cục, được reset bằng tay giữa các bước.
- Thêm một subscriber nữa vào hệ thống là bước này đỏ.

**Tự hỏi.** Nếu payload **sai** nhưng số người nhận **đúng**, bước này có đỏ không?

**Vì sao đếm là sai.** Con số đó mã hoá **hôm nay có bao nhiêu listener đang kết nối**. Thêm người
nghe thứ ba thì một hệ thống đúng hoá đỏ; gửi sai payload cho đúng số người thì một hệ thống hỏng
vẫn xanh. Đếm là chi tiết cài đặt của fan-out; **nội dung** mới là lời hứa.

**Ranh giới**

- ↔ `E2E-6`: `E2E-5` khẳng định cái **đã tới đúng người**; `E2E-6` khẳng định cái **không tới người
  khác**. Một flow realtime đủ tiêu chuẩn phải có cả hai.
- ↔ `E2E-4`: một tin nhắn được lưu **và** được phát là hai hệ quả ở hai nơi. Đọc row là `E2E-4`,
  nhận socket là `E2E-5`, và bỏ một trong hai là bỏ nửa lời hứa.

**Tình huống nghiệp vụ hay gặp.** Tin nhắn phòng chat · thông báo đẩy · con trỏ hiện diện · tiến độ
job stream về · trạng thái phiên phỏng vấn · cập nhật bảng xếp hạng trực tiếp.

---

## `E2E-6` — phủ định là **một phần** của flow

**Tình huống.** Trước khi khách đăng ký, họ phải **không** nhận được gì. Trước khi thanh toán lắng,
quyền học phải **đóng**.

**Dấu hiệu nhận biết**

- File chỉ toàn bước "thì phải nhận được", không có bước nào "thì phải không nhận được".
- Không có actor thứ hai đứng ngoài để chứng minh không bị rò.
- Một hệ thống phát mọi thứ cho mọi người sẽ **qua sạch** cả file.

**Tự hỏi.** Nếu hệ thống gửi mọi thứ cho mọi người, file này có bắt được không?

**Vì sao đây là hỏng quan trọng nhất.** Vì nó **vô hình từ happy path**. Rò rỉ không làm ai báo lỗi:
người đáng nhận vẫn nhận được. Chỉ có một bước phủ định mới nhìn thấy nó.

**Ranh giới**

- ↔ `E2E-5`: xem trên.
- ↔ `E2E-3`: đây là ngoại lệ duy nhất mà một **khoảng thời gian cố định** hợp lệ, vì "không có gì
  xảy ra" chỉ đo được bằng "trong bao lâu". Khoảng im lặng đó phải ngắn và phải nêu rõ.

**Tình huống nghiệp vụ hay gặp.** Người ngoài phòng không nhận tin · học viên chưa trả tiền không mở
được nội dung · người dùng khác không thấy bản nháp · webhook lạ không phát quyền · người đã rời
nhóm không nhận thông báo nữa.

---

## `E2E-7` — không rẽ nhánh trong một bước

**Tình huống.** Bước đang xét một trạng thái có thể là A hoặc B, và tác giả viết `if` để "an toàn".

**Dấu hiệu nhận biết**

- Có `if`, ternary, `switch`, hoặc `a && expect(...)` đứng thành câu lệnh, bên trong `it`.
- Có `expect` nằm trong nhánh mà không phải nhánh nào cũng chạy.
- Chạy hai lần cho hai kết quả xanh khác nhau, chứng minh hai thứ khác nhau.

**Tự hỏi.** Lần chạy **bỏ qua** nhánh này thì file đang chứng minh cái gì?

**Vì sao xanh mà rỗng.** Nhánh trong một bước nghĩa là test **sẵn sàng cho cả hai đường**, nên lần
xanh không còn là bằng chứng nghiệp vụ đã đúng — nó chỉ chứng minh code chạy tới cuối.

**Cách sửa.** Nếu điều kiện **là** một phần của flow, hãy **ép** nó xảy ra rồi khẳng định vô điều
kiện. Nếu không, nó không thuộc file này. Hai kết cục cùng hợp lệ là **hai bước**, hoặc **hai flow**.

**Ranh giới**

- ↔ `E2E-2`: tách thành nhiều bước là cách hợp lệ để bỏ nhánh; nhét nhánh vào một bước thì không.
- ↔ `E2E-3`: predicate của `until` **được phép** là một biểu thức điều kiện — nó là thứ đang được
  chờ, không phải một assertion có điều kiện.

**Tình huống nghiệp vụ hay gặp.** Trạng thái gateway có thể pending hoặc paid · job có thể đã chạy ·
cache có thể ấm · người dùng có thể đã có row · retry có thể chưa cạn.

---

## `E2E-8` — **một chỗ** dựng thế giới lên

**Tình huống.** Flow cần app, database, broker, socket. Wiring đó thuộc về hạ tầng test, không thuộc
về file flow.

**Dấu hiệu nhận biết**

- File flow mở đầu bằng hai trăm dòng `Test.createTestingModule`.
- Đổi một provider hạ tầng phải sửa hai mươi lăm file.
- Hai file flow dựng thế giới **hơi khác nhau**, và không ai biết khác chỗ nào.

**Tự hỏi.** Khi wiring đổi, **bao nhiêu** file phải đổi theo?

**Ranh giới**

- ↔ `E2E-12`: hạ tầng chung quyết định cái gì **mặc định** được kịch bản hoá; một flow ghi đè bằng
  cách khai lại đúng token đó. Ghi đè là hợp lệ; **sao chép cả thế giới** để ghi đè một token thì
  không.
- ↔ `E2E-9`: thế giới cung cấp **hàm tạo** actor; flow gọi hàm đó. Thế giới không giữ sẵn một actor
  dùng chung.

**Vì sao không có lint.** Đây là một sự thật về **cây fixture của một repository**, không phải về một
file. Nó thuộc về một gate nhìn được cả cây, không thuộc về một rule chỉ nhìn thấy một file.

**Tình huống nghiệp vụ hay gặp.** Boot app cho lane flow · reset database giữa các file · dựng kết
nối broker · mở namespace socket · nạp seed tối thiểu.

---

## `E2E-9` — actor **có tên**, và do chính flow tạo ra

**Tình huống.** Flow cần một người mua, một người khác không được thấy gì, và một tổ chức.

**Dấu hiệu nhận biết**

- Có số thứ tự ma thuật: `accountNumber: 8`, `userId: 3`.
- Actor được lấy từ seed dùng chung thay vì được tạo mới.
- Chạy hai file cùng lúc thì cả hai cùng đỏ một cách khó hiểu.

**Tự hỏi.** Nếu file này chạy **cùng lúc** với một file khác, hai bên có giẫm lên nhau không?

**Vì sao số thứ tự là nợ.** Nó không nói gì cho người đọc, và nó **va nhau lặng lẽ** khi hai flow
cùng chọn một số. Tên thì vừa mô tả vai trò, vừa buộc mỗi flow tự tạo ra actor của mình — nên các
flow không chia state và chạy theo thứ tự nào cũng được.

**Ranh giới**

- ↔ `E2E-6`: actor thứ hai (`otherLearner`, người lạ) tồn tại **chính là để** phủ định kiểm tra được.
  Không có actor có tên thì không có bước phủ định tử tế.
- ↔ `E2E-8`: xem trên.

**Tình huống nghiệp vụ hay gặp.** Người mua và người ngoài cuộc · chủ phòng và khách · người chấm và
người nộp · tổ chức và thành viên · người đã rời nhóm.

---

## `E2E-10` — flow **không log gì cả**

**Tình huống.** Bước đang khó hiểu, và phản xạ đầu tiên là in ra vài dòng.

**Dấu hiệu nhận biết**

- Có `console.log`, `console.debug`, hoặc một logger của framework trong file spec.
- Output của một lần chạy xanh dài hơn danh sách tên bước.
- Khi đỏ, dòng assertion bị đẩy khỏi màn hình.

**Tự hỏi.** Khi nó đỏ, người đọc **cần** gì? Tên bước và assertion — cả hai runner đã in sẵn.

**Ranh giới**

- ↔ `E2E-2`: nếu bạn thấy cần log để biết bước nào đang chạy, thứ thiếu là **tên bước**, không phải
  log.
- ↔ `E2E-4`: nếu bạn thấy cần log để biết state ra sao, thứ thiếu là **một lần đọc state có
  assertion**, không phải log.

**Ai đang giữ nó.** Không phải module này. Luật observability đã có `no-console` và
`starci-be/no-framework-logger` phủ mọi call site; thêm một rule nữa ở lane này chỉ nhân đôi mọi
báo cáo.

**Tình huống nghiệp vụ hay gặp.** Debug tạm quên xoá · in payload webhook · in id job · in trạng thái
retry.

---

## `E2E-11` — chuỗi vận hành vào bằng **cửa production**, và mọi chặng trong đều thật

**Tình huống.** Flow đang chứng minh fallback, retry, queue, scheduler, projection, vô hiệu cache
hoặc giao realtime.

**Dấu hiệu nhận biết**

- File import một bus rồi tự `execute` để "đẩy flow đi cho nhanh".
- File resolve một `*Worker` / `*Handler` từ container rồi gọi `process` trực tiếp.
- Retry, ack, khoá và cạnh tranh consumer **không xuất hiện** ở đâu trong file.

**Tự hỏi.** Nếu serialization hoặc ack hỏng, file này có đỏ không?

**Cửa production là gì.** GraphQL, HTTP, socket, publish vào broker thật, hoặc để scheduler thật nổ.

**Ranh giới hẹp và quan trọng.** **Import** một worker để framework đăng ký nó là **đúng**. **Resolve
rồi gọi** một method nội bộ của nó là sai. Lời gọi trực tiếp xoá sạch serialization, khoá, retry, ack
và hành vi competing-consumer — đúng những hành vi mà flow vận hành sinh ra để chứng minh.

- ↔ `E2E-12`: `E2E-11` nói **đi vào bằng cửa nào**; `E2E-12` nói **thay cái gì ở đầu kia**. Vào đúng
  cửa rồi mock mất orchestrator ở giữa vẫn hỏng, và ngược lại.
- ↔ `E2E-4`: vào đúng cửa mà chỉ đọc envelope thì vẫn thiếu hệ quả.

**Tình huống nghiệp vụ hay gặp.** Job mail retry rồi cạn lượt · thành viên GitHub qua ba bước bền
vững · projection CDC bắt kịp · sự kiện đi xuyên hai instance · scheduler dọn phiên hết hạn · cache
bị vô hiệu sau khi ghi.

---

## `E2E-12` — ghi đè **kết quả ngoài**, không bao giờ ghi đè **chính sách trong** đã chọn ra nó

**Tình huống.** Flow chạm tới một phụ thuộc ngoài: nhà cung cấp mô hình, cổng thanh toán, IdP, SMTP,
sandbox chấm code, bộ chuyển mã.

**Dấu hiệu nhận biết**

- Có mock đặt lên một service **của mình**: bộ chọn nhà cung cấp, bộ cân bằng, bộ định tuyến hành
  động, đường tính tiền.
- File import thẳng SDK của một nhà cung cấp.
- Fallback, quy kết, rollback và idempotency **không còn** cách nào đỏ được.

**Tự hỏi.** Nếu **chính sách nội bộ** chọn sai nhà cung cấp, sai đường hoàn tiền, sai quyền — file
này có đỏ không?

**Ranh giới của seam.** Seam nằm ở **client cụ thể của bên ngoài**: hàm `invoke` / `stream` của nó,
hoặc lời gọi HTTP của cổng. Mọi thứ **bên trong** seam đó — xoay khoá, cache sức khoẻ, entitlement,
tính tiền, đối soát, định tuyến hành động, phát quyền — phải thật.

**Ném lỗi là hợp lệ.** Ép client ngoài **throw** là ép một **kết quả ngoài**, và đó chính là cách
chứng minh fallback. Ép chính sách nội bộ quyết định gì với lỗi đó thì không.

- ↔ `E2E-11`: xem trên.
- ↔ `E2E-8`: mặc định kịch bản hoá thuộc về hạ tầng chung; ghi đè theo từng flow là hợp lệ.

**Nửa được lint giữ.** Rule chỉ bắt được **import SDK nhà cung cấp** trong file spec. Mock một
orchestrator nội bộ không để lại import nào để bắt.

**Tình huống nghiệp vụ hay gặp.** Fallback giữa nhiều nhà cung cấp mô hình · webhook cổng thanh toán
· cấp token IdP · SMTP từ chối rồi chấp nhận · sandbox chấm bài timeout · dịch vụ chuyển mã lỗi.

---

## Luật

1. Một file chứng minh **một** câu nghiệp vụ, và tên file nói đúng câu đó.
2. Mỗi bước nghiệp vụ là một `it` **có tên**, xếp theo thứ tự nghiệp vụ.
3. Mọi lần chờ bị chặn bởi **kết cục**, không bao giờ bởi **thời lượng**.
4. Mọi assertion đọc hệ quả **ở nơi hệ quả sống**.
5. Assertion realtime nói về **nội dung** và **người nhận**, không bao giờ về số lượng.
6. Mỗi flow có ít nhất một bước chứng minh **sự vắng mặt**.
7. Một bước khẳng định đúng **một** kết cục, **vô điều kiện**.
8. Thế giới được dựng ở **một** chỗ; file spec không chứa wiring riêng.
9. Actor **có tên**, do flow tạo, không chia sẻ giữa các flow.
10. Output duy nhất của một spec là **tên bước** và **assertion**.
11. Chuỗi vận hành vào bằng cửa production, và **mọi chặng nội bộ giữ nguyên thật**.
12. Chỉ **client ngoài cùng bên ngoài** được kịch bản hoá.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp
vào.

- **Bước phụ thuộc bước trước (`E2E-2`).** Đây là lane **duy nhất** cho phép, và đó chính là định
  nghĩa của flow. Nó không cho phép một bước phụ thuộc vào bước ở **file khác**.
- **Flow thật sự chỉ có một bước (`E2E-2`).** Một câu nghiệp vụ chỉ gồm một operation thì một `it`.
  Đây là lý do không có rule nào đếm `it`.
- **Đăng ký worker (`E2E-11`).** Import worker để framework đăng ký là **bắt buộc đúng**. Resolve rồi
  gọi `process` / `finalize` mới là thứ bị từ chối.
- **Ép lỗi bên ngoài (`E2E-12`).** Được phép bắt client ngoài ném lỗi, vì lỗi đó là một kết quả bên
  ngoài. Không được ép chính sách nội bộ xử lý lỗi đó theo ý mình.
- **Chờ trên sổ sách của chính seam (`E2E-3`).** Poll `mock.calls` của seam ngoài để chứng minh
  hand-off đã xảy ra **đúng một lần** vẫn là poll một trạng thái, và hợp lệ.
- **Khoảng im lặng cố định (`E2E-6`).** Sự vắng mặt chỉ đo được bằng thời gian, nên một cửa sổ im
  lặng ngắn và được nêu rõ là ngoại lệ duy nhất của `E2E-3`.
- **Hai kết cục hợp lệ (`E2E-7`).** Tách thành hai bước hoặc hai flow. Rẽ nhánh không bao giờ là
  cách sửa.
