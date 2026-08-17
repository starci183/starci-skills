---
title: Testing · Vietnamese
module: testing
kind: pattern
stack: be
codes: [TESTING-1, TESTING-2, TESTING-3, TESTING-4, TESTING-5, TESTING-6, TESTING-7, TESTING-8, TESTING-9, TESTING-10, TESTING-11]
---

# Kiểm thử

Đầu vào là một shape đã được duyệt: một flow đã chốt, một handler đã chốt xong các nhánh, một
capability đã chọn xong provider, một thế giới demo đã được đồng ý. Pattern này không mở lại bất kỳ
quyết định nào trong số đó. Nó hạ chúng xuống source: file nào giữ test, file đó khai lane nào, vào
bằng cửa nào, được phép assert cái gì, và mang tên gì.

## Luật

Một test được mua bằng **câu hỏi nó trả lời**. Một **e2e** trả lời *nghiệp vụ có chạy không?* — một
flow, từ đầu tới cuối, đúng theo cách state và tiền thật sự dịch chuyển. Một **unit spec** trả lời
*quyết định này có ra đúng không?* — một nhánh, không có gì thật đứng sau. Một **harness** trả lời
*câu trả lời của model có chấp nhận được không?* — lane duy nhất trả tiền cho provider.

Câu hỏi phân lane không phải là test chạm tới đâu, mà là thứ nó có thể bỏ sót: **cái này có thể vỡ
trên production mà test không hề hay biết không?** Nếu có, test đang **không** phủ cái mà nó trông như
đang phủ — và với một flow, gần như lúc nào lý do cũng là một: nó assert cái response thay vì assert
cái hệ quả.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi file test trong repository đều thuộc đúng một
lane và mang đúng một nghĩa vụ về hình dạng. Không có kích thước nào nhỏ đến mức được miễn mã: một
bảng ba nhánh là `TESTING-5` đúng cùng lý do mà một flow checkout-tới-entitlement là `TESTING-2`. "Nó
chỉ là một spec nhỏ thôi" chính là chỗ luật này bị bỏ qua nhiều nhất.

Phần lớn luật này **không** máy kiểm được, và đó đúng là lý do nó được viết kỹ đến vậy. Năm trên mười
một mã có lint rule đứng sau; sáu mã còn lại chỉ có người đọc, và bảng tầng bên dưới nói rõ mã nào
thuộc loại nào thay vì để ai đó tưởng cả mười một mã đều được máy giữ như nhau.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `TESTING-<n>`. Các số là CỐ ĐỊNH: chúng được trích dẫn
từ các luật anh em và từ record của các task cũ, nên một lần đánh số lại sẽ âm thầm làm hỏng một trích
dẫn ai đó đã đặt.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `TESTING-1` | Đang đặt tên cho một file của một flow nghiệp vụ | Một e2e là một flow nghiệp vụ, và tên file chính là flow đó. Cấm một file mang tên một nhóm resolver (`*-queries`), hoặc một flow bị chẻ thành mỗi endpoint một test |
| `TESTING-2` | Flow đã chạy xong và phải chứng minh nó đã xảy ra | Assertion là hệ quả: một hàng, một số dư, một quyền, một event đã phát ra. Cấm chỉ assert `status`, `__typename` hay hình dạng của phong bì response |
| `TESTING-3` | Flow có cửa vào production và có bước bất đồng bộ | Test vào bằng đúng transport mà production vào, và poll bước async tới khi nó ổn định. Cấm gọi `CommandBus`, `QueryBus`, một handler, resolver hay method của worker; cấm assert kết quả async ngay dòng kế tiếp; cấm kiểm một flow realtime chỉ bằng HTTP |
| `TESTING-4` | Một nhánh thất bại đang đi tìm lane | Happy path là chủ thể; một nhánh hỏng chỉ giành được e2e khi nó kéo theo một flow trọng yếu. Cấm một e2e mà toàn bộ chủ thể là một lỗi validation |
| `TESTING-5` | Một handler có nhiều đường ra | Một unit spec phủ mọi nhánh có thể đổi kết quả, kể cả biên. Cấm coi dòng đã chạy là quyết định đã phủ |
| `TESTING-6` | Spec đã chạy handler và đang chọn kiểm cái gì | Spec assert thứ trả về hoặc thứ đã đổi. Cấm một spec mà mọi assertion đều là `toHaveBeenCalled*` |
| `TESTING-7` | Một file test đang được đặt cạnh code nó kiểm | Lane khai bằng hậu tố tên file: `*.spec.ts`, `*.int-spec.ts`, `*.e2e-spec.ts`, `*.harness-spec.ts`. Cấm suy ra lane từ thư mục ai đó đã xếp file vào |
| `TESTING-8` | Một lane đã cấu hình, đã có script, đã nằm trong CI | Lane đã cấu hình thì phải có test, hoặc bị xoá đi. Cấm một lane có script mà xanh chỉ vì không tìm thấy gì |
| `TESTING-9` | Một flow đi qua model | Flow đi qua model giữ thật transport, orchestration, quota và persistence, và chỉ thay kết quả của provider bên ngoài — bằng JSON thật dạng, theo mặc định. Cấm gọi model thật trong e2e; cấm stub trả về một chuỗi đánh dấu; cấm một stub mà từng tác giả flow phải tự nhớ cài |
| `TESTING-10` | Chủ thể chính là câu trả lời của model | Harness import đúng một SDK provider đã duyệt, cấp một API key server do provider cấp, khai tên model và endpoint, và gọi thật — một hai case mỗi capability. Cấm chạm provider qua một tier, catalog, chuỗi fallback, key pool hay wrapper nhà; cấm cung cấp hay ghi đè AI gateway production; cấm xác thực bằng credential tiêu dùng hoặc của CLI; cấm mọc thêm một case cho mỗi edge |
| `TESTING-11` | Cần một thế giới local để soi trạng thái sản phẩm thật | Seed demo ghi bản ghi nguồn cho một tập người dùng đa dạng và vô hiệu hoá các projection dẫn xuất để read path production dựng lại chúng. Cấm seed đúng một tài khoản toàn số không; cấm ghim JSON hình dạng ảnh chụp màn hình; cấm giả định một identity cứng chính là người đang đăng nhập |

Mười một mã, và dừng ở mười một. Một tình huống mới thật sự chưa có mã là một lần đổi luật được ghi
lại đàng hoàng, không phải một con số thứ mười hai thêm vào cho tiện.

## Đọc một shape đã duyệt

1. Đọc thứ shape đã nêu: flow nghiệp vụ, quyết định, capability hay thế giới demo đã được duyệt. Đó
   là đầu vào, và ở đây nó không được đem ra thương lượng lại.
2. Đọc thứ shape **không** nêu. Một shape gọi tên một flow không nói nó vào bằng cửa nào, hệ quả nào
   chứng minh nó, hay nhánh nào xứng đáng có spec riêng. Thứ shape không nêu thì nó không giải; cứ để
   mở, đừng bịa ra.
3. Giải từ ngoài vào trong: câu hỏi test trả lời trước, rồi tới lane mà câu hỏi đó hàm ý, rồi tới hậu
   tố khai lane, rồi tới cửa vào, rồi mới tới assertion.
4. Hỏi lần lượt câu hỏi của từng mã. `TESTING-1`: tên trung thực của file này có phải một câu về
   nghiệp vụ không? `TESTING-2`: nếu tầng lưu trữ im lặng ngừng ghi, file này có đỏ không?
   `TESTING-3`: guard, pipe và serializer của production có nằm bên trong phạm vi test này không?
   `TESTING-4`: khi bước này hỏng, có *thứ hai* nào bắt buộc phải xảy ra không?
   `TESTING-5`: nhánh nào có thể đổi kết quả, và mỗi nhánh đó đã có case riêng chưa?
   `TESTING-6`: nếu tôi thay một giá trị nghiệp vụ bằng giá trị sai, file này có đỏ không?
   `TESTING-7`: chỉ nhìn tên file, tôi có biết nó chạy trong lần chạy nào không?
   `TESTING-8`: nếu lane này còn đúng không file nào, có ai biết không?
   `TESTING-9`: tôi đang chứng minh quota, entitlement, parser và persistence — hay chất lượng câu chữ
   của model? `TESTING-10`: thứ đang được kiểm có đúng là thứ sẽ ship không?
   `TESTING-11`: nếu tôi xoá projection đi và để handler thật dựng lại, màn hình có còn đúng như thế
   không?
5. Khi hai mã cùng khớp, thường chúng không tranh nhau — chúng giữ hai phần khác nhau của cùng một
   file, và cả hai đều áp. Một cái tên đúng không cứu được một assertion phong bì: `TESTING-1` và
   `TESTING-2` hỏng độc lập với nhau. Một cửa vào đúng không cứu được một chỗ nhìn sai: `TESTING-3`
   nói vào cửa nào và chờ ra sao, `TESTING-2` nói tới nơi rồi thì nhìn vào đâu. Khi hai mã mô tả cùng
   một bệnh ở hai lane — `TESTING-6` là spec chỉ assert lời gọi, `TESTING-2` là flow chỉ assert lời
   đáp — thì lane quyết định trích mã nào. Còn khi hai mã chỉ ngược chiều nhau thì sự bất đối xứng đó
   là cố ý: trong e2e, gọi model thật là sai; trong harness, giả lập mới là sai.

## `TESTING-1` — một file e2e là một câu chuyện nghiệp vụ

**Tình huống.** Bạn sắp đặt tên cho một file flow. Tên đó quyết định file sẽ chứa gì trong hai năm
tới, vì người sau sẽ thêm test vào file mà tên nó cho phép.

**Nó sinh ra gì trong source.** Mỗi flow nghiệp vụ một file `*.e2e-spec.ts`, nằm trong thư mục e2e,
tên file là chính flow đó viết thành một câu nghiệp vụ.

**Dấu hiệu nhận biết.** Tên trung thực của file là một *câu* về nghiệp vụ: "mua khoá học", "hoàn
tiền", "đổi thưởng". Nếu tên trung thực lại là một danh ngữ chỉ một phần của API — `*-queries`,
`*-mutations`, `*-resolvers` — thì file đang sai hình dạng, không phải sai tên. File chạy xanh mà
không ai dám nói "nghiệp vụ chạy được" là dấu hiệu chắc chắn nhất.

**Ranh giới.** Không phải `TESTING-4`: mã này nói file **là** cái gì, còn `TESTING-4` nói file được
phép chứa **nhánh nào**, và một file tên đúng vẫn có thể chứa sai nhánh. Không phải `TESTING-7`: mã đó
chỉ nói hậu tố, và hậu tố đúng không cứu được một cái tên sai hình dạng. Không phải `TESTING-2`: tên
đúng mà assert phong bì thì vẫn hỏng — hai mã này hỏng độc lập với nhau.

**Tình huống nghiệp vụ hay gặp.** Mua khoá học; hoàn tiền sau khi capture; trả góp tới hạn; đổi
thưởng; nộp bài chấm điểm; liên kết tài khoản ngoài; mở khoá thành tựu; gia hạn gói.

## `TESTING-2` — assert hệ quả, không assert phong bì

**Tình huống.** Flow đã chạy xong. Bây giờ phải chứng minh **cái gì đó đã thay đổi trong thế giới**,
chứ không phải server còn sống.

**Nó sinh ra gì trong source.** Một lần đọc lại ngay trong file flow, qua `entityManager`,
`dataSource`, `getRepository` hay `queryRunner`, gọi tên đúng hàng, số dư, quyền hay event mà flow đã
tạo ra.

**Dấu hiệu nhận biết.** Assertion cuối cùng nhìn vào `status`, `__typename`, `errors === undefined`,
hoặc đọc lại chính cái response vừa trả về. File không hề chạm tới `entityManager`, `dataSource`,
`getRepository` hay `queryRunner`. Nếu ai đó xoá dòng `await repository.save(...)` trong handler, file
này vẫn xanh.

**Ranh giới.** Không phải `TESTING-3`: mã đó nói **vào bằng cửa nào và chờ ra sao**, mã này nói **nhìn
vào đâu khi đã tới nơi** — vào đúng cửa mà nhìn nhầm chỗ thì vẫn là vi phạm `TESTING-2`. Không phải
`TESTING-6`: cùng một bệnh ở hai lane — `TESTING-6` là spec chỉ assert lời gọi, `TESTING-2` là flow
chỉ assert lời đáp.

**Tình huống nghiệp vụ hay gặp.** Ghi danh mở ra sau webhook thanh toán; số dư ví trở về sau hoàn
tiền; quota bị trừ sau một lượt hỏi; streak tăng sau khi hoàn thành bài; projection được dựng lại sau
khi CDC chạy; thông báo được đẩy tới đúng người nhận.

## `TESTING-3` — test đi đúng đường mà flow đi

**Tình huống.** Trên production flow vào bằng GraphQL, HTTP, socket, message broker hoặc scheduler.
Test phải vào bằng đúng cửa đó.

**Nó sinh ra gì trong source.** Một flow đi qua helper world dùng chung — một HTTP client thật trên
đúng transport của production — và với mỗi bước async là một lần chờ dựng từ deadline cộng predicate,
chứ không phải một `sleep`.

**Dấu hiệu nhận biết.** Test gọi `commandBus.execute(...)`, `handler.execute(...)`,
`resolver.execute(...)` hay `worker.process(...)`; tất cả đều **bắt đầu sau** routing, guard,
validation và serialization. Sau một bước bất đồng bộ, dòng ngay kế tiếp đã assert luôn. Flow một nửa
HTTP một nửa socket, nhưng test chỉ nói HTTP.

**Ranh giới.** Không phải `TESTING-2`: xem trên. Không phải lane integration:
`commandBus.execute(...)` **không** phải cái xấu — nó là công dân hợp lệ của lane `*.int-spec.ts`. Vi
phạm là dùng nó **trong lane e2e**.

**Tình huống nghiệp vụ hay gặp.** Webhook của cổng thanh toán; job nền chấm bài; encode media; đẩy
notification qua socket; message qua broker giữa hai instance; cron gia hạn gói.

## `TESTING-4` — happy path là chủ thể

**Tình huống.** Bạn có một nhánh thất bại và đang phân vân đưa nó vào lane nào.

**Nó sinh ra gì trong source.** Hoặc một file e2e riêng, mang tên câu chuyện của chính nó, khi thất
bại kéo theo một flow trọng yếu; hoặc một case bên trong một unit spec khi nó không kéo theo gì.

**Dấu hiệu nhận biết.** Thất bại này **kéo theo** một việc khác bắt buộc phải đúng: đã capture rồi
settle hỏng ⇒ phải refund; charge tới hai lần ⇒ idempotency phải giữ; hai writer đua ⇒ constraint phải
bắt. Dấu hiệu ngược lại: thất bại này chỉ trả về một thông điệp validation, và không có gì chạy sau
đó.

**Ranh giới.** Không phải `TESTING-5`: một lỗi validation là một **quyết định**, và nó thuộc
`TESTING-5`, nơi nó tốn vài mili giây thay vì một database. Không phải `TESTING-1`: nhánh thất bại đủ
tiêu chuẩn vẫn phải nằm trong một file mang tên câu chuyện của chính nó, không nhét ké vào flow happy
path.

**Tình huống nghiệp vụ hay gặp.** Settle hỏng sau capture ⇒ hoàn tiền và đóng quyền; webhook lặp ⇒
idempotency; hai người cùng nhận suất cuối ⇒ unique constraint; huỷ giữa chừng ⇒ dọn giữ chỗ; trả góp
quá hạn ⇒ chuyển trạng thái và thu hồi quyền.

## `TESTING-5` — phủ nhánh quyết định, không phủ dòng

**Tình huống.** Một handler có nhiều đường ra. Bạn đang viết spec cho nó.

**Nó sinh ra gì trong source.** Một `*.spec.ts` nằm cạnh handler, chứa một bảng nhánh — thường là
`it.each` — mỗi hàng một case đổi kết quả, chứ không phải một case nằm giữa dải.

**Dấu hiệu nhận biết.** Có biên: `0`, `cap`, `cap + 1`. Có tập rỗng. Có "đã làm rồi". Có "không được
phép". Spec hiện tại chọn **một** giá trị nằm giữa dải và tuyên bố đã phủ. Báo cáo coverage xanh trong
khi một off-by-one ở biên vẫn ship được.

**Ranh giới.** Không phải `TESTING-4`: `TESTING-5` là nơi mọi nhánh thất bại không kéo theo gì khác đi
về. Không phải `TESTING-6`: `TESTING-5` nói **bao nhiêu case**, `TESTING-6` nói **case đó assert cái
gì** — đủ case mà toàn assert lời gọi thì vẫn không chứng minh được gì.

**Tình huống nghiệp vụ hay gặp.** Số lần thử ở đúng ngưỡng; giỏ hàng rỗng; coupon hết hạn đúng vào
giây cuối; quota còn đúng một lượt; người dùng đã ghi danh rồi; vai trò không đủ quyền; điểm rơi đúng
mốc đậu.

## `TESTING-6` — spec chỉ assert lời gọi là spec chép lại source

**Tình huống.** Spec chạy handler rồi kiểm tra rằng một collaborator đã được gọi, và dừng ở đó.

**Nó sinh ra gì trong source.** Ít nhất một assertion mỗi file về giá trị trả về hoặc trạng thái đã
đổi; một call assertion được phép đứng cạnh nó, nhưng không bao giờ đứng một mình.

**Dấu hiệu nhận biết.** Mọi assertion trong file đều là `toHaveBeenCalled`, `toHaveBeenCalledWith`,
`toHaveBeenCalledTimes` hoặc họ hàng của chúng. Đổi tên method của collaborator ⇒ file đỏ. Đổi con số
nghiệp vụ thành sai ⇒ file vẫn xanh. Spec đọc lên nghe **giống hệt** phần thân của handler.

**Ranh giới.** Không phải `TESTING-2`: cùng một bệnh, khác lane. Không phải ngoại lệ hợp lệ: khi
**bản thân lời gọi là hệ quả quan sát được** — mail đã gửi, event đã publish — thì call assertion là
**assertion thứ hai**, đứng cạnh một assertion về kết quả.

**Tình huống nghiệp vụ hay gặp.** Handler tính giá sau coupon; service trừ quota; worker chuyển trạng
thái đơn; mapper dựng payload; policy quyết cho phép hay từ chối.

## `TESTING-7` — lane nằm ở hậu tố, không nằm ở thư mục

**Tình huống.** Bạn đặt một file test cạnh code nó kiểm, và cần lane chạy nhanh vẫn nhanh.

**Nó sinh ra gì trong source.** Một tên file mang một trong bốn hậu tố — `*.spec.ts`, `*.int-spec.ts`,
`*.e2e-spec.ts`, `*.harness-spec.ts` — và các config lane chỉ phân biệt bằng đúng hậu tố đó.

**Dấu hiệu nhận biết.** Bốn hậu tố: `*.spec.ts`, `*.int-spec.ts`, `*.e2e-spec.ts`,
`*.harness-spec.ts`. Config lane loại trừ nhau bằng **hậu tố**, không bằng đường dẫn. Nếu phải mở file
ra mới biết nó thuộc lane nào thì tên file đang không làm việc của nó.

**Ranh giới.** Không phải `TESTING-8`: `TESTING-7` nói lane được **khai** thế nào, `TESTING-8` nói một
lane đã khai thì phải **có thật** thế nào. Không phải `TESTING-1`: hậu tố đúng không sửa được phần tên
phía trước.

**Tình huống nghiệp vụ hay gặp.** Spec unit nằm cạnh handler; int-spec cần container thật; e2e và
harness ở chung thư mục nhưng khác lane chạy; lane nhanh chạy trong pre-commit.

## `TESTING-8` — lane rỗng không phải lane xanh

**Tình huống.** Một lane đã được cấu hình, đã có script, đã nằm trong CI — và không có file nào khớp.

**Nó sinh ra gì trong source.** Hoặc những file mà `testRegex` của lane thật sự khớp, hoặc một lần xoá
hẳn script và config của lane đó.

**Dấu hiệu nhận biết.** Script mang cờ cho phép "không có test cũng coi là qua". Báo cáo CI hiện màu
xanh cho một lane mà không ai nhớ lần cuối nó chạy cái gì. Xoá hết test trong lane đó đi, không có gì
đỏ lên.

**Ranh giới.** Không phải `TESTING-7`: xem trên. Và cờ "qua khi rỗng" **không** tự nó là vi phạm. Vi
phạm là cờ đó cộng với một lane thật sự rỗng, vì lúc ấy màu xanh là một tuyên bố về độ phủ mà không có
gì đứng sau.

**Tình huống nghiệp vụ hay gặp.** Lane integration mới dựng chưa kịp có file; lane bị đổi glob nên
không match gì nữa; lane bị đổi thư mục sau một lần refactor; lane còn lại sau khi xoá một domain.

## `TESTING-9` — e2e không bao giờ gọi model

**Tình huống.** Một flow đi qua model: hỏi đáp có trích dẫn, chấm bài, sinh CV, tóm tắt.

**Nó sinh ra gì trong source.** Một stub provider mặc định do helper world cài sẵn, trả về JSON đúng
dạng mà parser strict của production parse được thật, và là một jest mock mà flow có thể lập trình lại
theo từng bước — còn mọi thứ khác trong flow vẫn giữ thật.

**Dấu hiệu nhận biết.** Test gọi thật tới provider ⇒ tốn tiền, chậm vài giây, và **trả lời khác nhau
mỗi lần**; cả ba tính chất đều chí mạng trong một suite flow. Assertion phải nới lỏng dần cho sống sót
qua các cách diễn đạt khác nhau, tới lúc nó không còn bắt được gì. Stub trả về `"stubbed"`, `"ok"`,
`"test"` ⇒ parser strict-JSON **không hề chạy**, mà parser chính là chỗ dễ vỡ nhất: đó là nơi output
của model gặp schema. Stub do **từng tác giả flow tự nhớ cài** ⇒ luật phụ thuộc trí nhớ.

**Ranh giới.** Không phải `TESTING-10`: hai lane chạy **ngược chiều nhau**. Trong e2e, gọi thật là
sai; trong harness, giả lập là sai, vì chủ thể của harness đúng là câu trả lời thật của model. Và
không phải một lối thoát khỏi `TESTING-2`: sau khi stub, phần còn lại vẫn phải assert hệ quả.

**Tình huống nghiệp vụ hay gặp.** Hỏi đáp theo nội dung có trích dẫn; chấm bài tự luận; sinh CV; tóm
tắt tiến độ; gợi ý lộ trình; phân loại nội dung.

## `TESTING-10` — harness gọi thẳng provider, và giữ mình nhỏ

**Tình huống.** Bạn cần biết câu trả lời của model **có chấp nhận được không**. Đó là câu hỏi duy nhất
lane này trả lời.

**Nó sinh ra gì trong source.** Một `*.harness-spec.ts` import đúng một SDK provider đã duyệt, đọc một
credential bắt buộc chỉ nằm trong process cho mỗi authority — không fallback qua file, OAuth, key pool
hay biến anh em — khai tên model và endpoint, và chứa một hai case mỗi capability.

**Dấu hiệu nhận biết.** Mỗi lớp nằm giữa harness và provider là một lớp có thể làm harness xanh trong
khi production hỏng: một tier, một routing override, một wrapper nhà tự chọn model. Harness "giả"
gateway production bằng một adapter gọi thật ⇒ nó có thể **bịa ra** metadata về provider, token và chi
phí. Credential là OAuth của một CLI, session của một ứng dụng chat, hay một file profile ⇒ đó không
phải API key do provider cấp cho server, và nó không chứng minh được quyền đã deploy. Harness mọc thêm
một case cho mỗi edge ⇒ tính tiền theo lượt gọi ⇒ tới lúc không ai chạy nữa, và một màu xanh cũ vẫn
còn treo trên bảng.

**Ranh giới.** Không phải `TESTING-9`: xem trên. Bất đối xứng là cố ý và phải giữ nguyên — e2e giữ
thật mọi thứ **trừ** kết quả provider; harness gọi thật provider nhưng **chỉ** chứng minh chất lượng
prompt, model và parser. Và harness **không** thay thế độ phủ flow: nó không biết gì về quota,
entitlement hay persistence.

**Tình huống nghiệp vụ hay gặp.** Chấm bài; chấm phỏng vấn thử; chấm CV; kiểm chất lượng câu trả lời
có trích dẫn; so sánh hai prompt trước khi đổi.

## `TESTING-11` — seed demo dựng một thế giới, không dựng một ảnh chụp

**Tình huống.** Cần một môi trường local để người đọc **soi trạng thái sản phẩm thật qua đúng read
path của production**.

**Nó sinh ra gì trong source.** Một script seed ghi các hàng nguồn cho một tập người dùng đa dạng, vô
hiệu hoá các projection dẫn xuất để read path production dựng lại chúng, và nhận tài khoản đang được
soi làm tham số.

**Dấu hiệu nhận biết.** Seed tạo đúng một tài khoản trắng, mọi số đều bằng không ⇒ không có gì chứng
minh được list, đếm, xếp hạng, tiến độ hay join giữa nhiều người dùng là đúng. Seed ghi thẳng JSON
hình dạng đúng cái màn hình cần ⇒ màn hình trông đầy đủ, nhưng **không** join hay projection nào của
production chứng minh nó. Seed giả định một identity cứng chính là người đang đăng nhập. Chạy lần hai
thì nhân đôi dữ liệu.

**Ranh giới.** Không phải `TESTING-2`: cùng một tinh thần "đọc lại từ nơi state thật sống", nhưng
`TESTING-11` áp cho môi trường demo chứ không phải cho một assertion. Và trạng thái rỗng **vẫn** đáng
được seed; cái bị từ chối là một thế giới mà mọi thứ đều rỗng.

**Tình huống nghiệp vụ hay gặp.** Dashboard có tiến độ dở dang; chuỗi ngày hoạt động liên tiếp; số dư
thưởng đã kiếm được; bảng xếp hạng nhiều người; feed hoạt động có nhiều tác nhân; hồ sơ công khai có
người theo dõi.

## Tầng giữ

Tầng nào thật sự giữ từng mã. `unrepresentable` nghĩa là một union đóng hay branded type khiến giá trị
sai không viết ra được; `enforced` nghĩa là một lint rule trong `sources/be/testing.mjs` bắt được nó;
`documented` nghĩa là không có gì máy móc giữ nó, chỉ có người đọc.

| Mã | Tầng | Cái gì giữ nó |
|---|---|---|
| `TESTING-1` | `documented` | — |
| `TESTING-2` | `enforced` | `e2e-asserts-persisted-state` (export `e2eAssertsPersistedState`) |
| `TESTING-3` | `enforced` | `e2e-uses-production-transport` (export `e2eUsesProductionTransport`) |
| `TESTING-4` | `documented` | — |
| `TESTING-5` | `documented` | — |
| `TESTING-6` | `enforced` | `no-call-only-spec` (export `noCallOnlySpec`) |
| `TESTING-7` | `documented` | — |
| `TESTING-8` | `documented` | — |
| `TESTING-9` | `enforced` | `no-model-call-in-e2e` (export `noModelCallInE2e`) |
| `TESTING-10` | `enforced` | `harness-calls-provider-directly` (export `harnessCallsProviderDirectly`) |
| `TESTING-11` | `documented` | — |

**Năm mã enforced, sáu mã documented, không mã nào unrepresentable.** Khoảng trống đó chính là điểm
của bảng này. Lane của một test là thuộc tính của cả một file, không phải của một giá trị, nên không
union đóng nào làm cho hình dạng sai trở nên không viết được — một spec vẫn là TypeScript hợp lệ dù nó
assert hệ quả hay assert phong bì. Mọi mã ở hàng `documented` đều là một rủi ro còn mở, và được ghi
lại đúng như vậy, kèm theo điều mà một rule sẽ phải nhìn thấy được thì mới giữ nổi nó.

Các hàng enforced được bật ở mức `error` với burn-down đã làm xong; con số plugin đo được trên
repository tham chiếu nằm trong khối `recommended` của chính file rule, không nằm ở đây, vì một phép
đo thì cũ đi còn một điều luật thì không.

## Điểm neo

Code thật để đối chiếu từng điều luật. Một điều luật không chỉ được vào đâu thì mới chỉ là một đề
xuất.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `TESTING-1` | `src/tests/e2e/course-purchase.e2e-spec.ts` · `src/tests/e2e/rewards-queries.e2e-spec.ts` | Tên thứ nhất là một câu nghiệp vụ; tên thứ hai là một nhóm resolver khoác áo test, đúng cái hình dạng mã này từ chối. Cả hai đều đang sống |
| `TESTING-2` | `sources/be/testing.mjs` → `STATE_READERS` · bất kỳ file nào dưới `src/tests/e2e/` đọc qua `entityManager` | Những identifier mà rule chấp nhận là bằng chứng state đã được đọc lại, và một flow thật sự đọc nó |
| `TESTING-3` | `src/tests/helpers/flow-world.ts` · `src/tests/helpers/flow-wait.ts` | World vào bằng GraphQL qua một HTTP client thật; các helper chờ thay `sleep` bằng deadline cộng predicate |
| `TESTING-4` | `src/tests/e2e/course-refund.e2e-spec.ts` · `src/tests/e2e/community-concurrency.e2e-spec.ts` | Hai nhánh hỏng giành được một flow: một lần đảo chiều bắt buộc phải chạy, và một cuộc đua mà constraint phải bắt |
| `TESTING-5` | `src/features/api/processors/ai/score-uploaded-cv/enqueue-score-uploaded-cv.service.spec.ts` | Một bảng nhánh chạy bằng `it.each`, mỗi hàng một case đổi kết quả chứ không phải một case nằm giữa dải |
| `TESTING-6` | `sources/be/testing.mjs` → `CALL_MATCHERS`, `matcherOf` | Chín matcher được tính là call assertion, và cú leo member-chain khiến `.not` và `.resolves` vẫn lọt qua |
| `TESTING-7` | `jest.config.ts` → `testPathIgnorePatterns` · `src/tests/e2e/jest-e2e.json` → `testRegex` · `src/tests/harness/jest-harness.json` → `testRegex` | Ba config chỉ phân biệt bằng hậu tố, và đó chính là thứ cho phép các lane ở chung thư mục mà lần chạy nhanh không nhặt phải |
| `TESTING-8` | `package.json` → `test:int`, `test:ci` | Cả hai đều mang `--passWithNoTests`. Cờ đó đúng là chế độ hỏng mà mã này gọi tên, nên nó là điểm neo để người đọc đối chiếu số file của lane |
| `TESTING-9` | `src/tests/helpers/flow-world.ts` → stub `AiInvokeService` mặc định | Stub do world cài, trả về JSON đúng dạng chứ không phải một chuỗi đánh dấu, và là một jest mock mà flow lập trình lại được theo từng bước |
| `TESTING-10` | `src/tests/helpers/harness-credentials.ts` · `src/tests/harness/` | Mỗi authority một credential bắt buộc chỉ nằm trong process, không fallback qua file, OAuth, key pool hay biến anh em, và judge có biến riêng |
| `TESTING-11` | `scripts/seed-dashboard-test-data.mjs` · `scripts/seed-profile-test-data.mjs` | Seed ghi các hàng nguồn rồi vô hiệu hoá projection dẫn xuất, và nhận tài khoản đang soi làm tham số thay vì ghim cứng một identity |

Mọi mã đều đã có neo. Không mã nào còn "chưa neo được".

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| question | Nghiệp vụ có chạy không · quyết định này có ra đúng không · câu trả lời của model có chấp nhận được không |
| lane | Hậu tố tên file mà câu trả lời đó hàm ý |
| entry | Transport mà production dùng cho flow này |
| consequence | Hàng, số dư, quyền hay event chứng minh flow đã xảy ra |
| branches | Mọi lớp đầu vào có thể đổi kết quả, kể cả biên |
| externals | Cái gì rời khỏi process, và vì thế cái gì bị stub hay được gọi thật |

## Quy tắc

1. Một file e2e là một flow nghiệp vụ, và tên file chính là flow đó.
2. Một assertion gọi tên hệ quả, không phải phong bì.
3. Một e2e vào bằng đúng cửa production vào và chờ trạng thái, không bao giờ chờ đồng hồ.
4. Lane khai bằng hậu tố, và không bằng bất cứ thứ gì khác.
5. Một lane đã cấu hình thì hoặc có test, hoặc không tồn tại.
6. Chỉ lane harness trả tiền cho provider; chỉ lane harness gọi thẳng provider.
7. Stub của một model trả về payload mà parser production parse được thật.
8. Mọi file test đều quy về đúng một mã. Không lane nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp vào.

- **Call assertion làm assertion thứ hai.** `TESTING-6` cho phép `toHaveBeenCalledWith` khi bản thân
  lời gọi là hệ quả quan sát được — mail đã gửi, event đã publish — và trong file còn một assertion
  khác về kết quả. Rule chỉ nổ khi cả file không còn gì khác.
- **Flow không có hệ quả bền vững.** `TESTING-2` được thoả bằng một disable có ghi chú **nêu tên thứ
  flow quan sát thay thế**. Một flow không nêu được thì không được miễn; nó là test chưa xong.
- **Nhánh hỏng vào lane flow.** `TESTING-4` nhận một nhánh hỏng khi thất bại kích hoạt một việc khác
  cũng bắt buộc phải đúng: một lần đảo chiều, một guard idempotency, một constraint dưới một cuộc đua.
- **Opt-out khỏi stub provider có chủ đích.** `TESTING-9` stub theo mặc định; chạm tới provider từ một
  flow là một lần opt-out tường minh và đã được review, không phải thứ tác giả flow lặng lẽ sắp xếp.
- **Bộ bốn của judge.** `TESTING-10` cho phép một model sống thứ hai làm judge, với điều kiện nó khai
  provider, model, endpoint và key của riêng nó. Không bên nào thừa kế bộ bốn của bên kia.
- **Fixture trạng thái rỗng.** `TESTING-11` vẫn muốn trạng thái rỗng được seed. Cái nó từ chối là một
  thế giới mà mọi trạng thái đều rỗng.
- **`commandBus.execute(...)` ngoài lane e2e.** Đó là công dân hợp lệ của lane integration; vi phạm
  `TESTING-3` chỉ xảy ra bên trong `*.e2e-spec.ts`.

## Đầu ra

Mỗi file mà shape đã duyệt sinh ra là một khối.

```text
file: <path>
lane: <unit | integration | e2e | harness>
situation: <TESTING-1 … TESTING-11>
entry: <graphql | http | socket | broker | scheduler | in-process>
consequence: <the row, balance, entitlement or event asserted>
reason: <the business fact that excludes the adjacent code>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một học viên mua khoá học bằng thẻ; cổng thanh toán xác nhận qua webhook của nó,
và lần mua đó mở ra một enrollment — còn mức giá học viên bị tính được suy ra từ một coupon có thể
không có, còn hạn, hoặc đã hết hạn.

```text
file: src/tests/e2e/course-purchase.e2e-spec.ts
lane: e2e
situation: TESTING-2
entry: graphql
consequence: the enrollment row that exists only after the gateway webhook settles
reason: the flow leaves a persisted consequence and the file reads it back through entityManager, so it is not TESTING-1 — the filename is already a business sentence and fails or passes independently of this
```

```text
file: src/tests/e2e/course-purchase.e2e-spec.ts
lane: e2e
situation: TESTING-3
entry: http
consequence: the enrollment row, polled until the async webhook step settles
reason: the webhook is a real production door and the settle is asynchronous, so the flow waits on a deadline plus a predicate; it is not the integration lane, where commandBus.execute(...) would be a legitimate entry
```

```text
file: src/features/api/.../compute-course-price.service.spec.ts
lane: unit
situation: TESTING-5
entry: in-process
consequence: the computed price per coupon class, including the expiry boundary
reason: the expired-coupon failure returns a validation outcome and drags nothing else behind it, which is exactly the fact that excludes TESTING-4
```

**Shape không nêu gì, và vì thế không giải gì.** Nó không nói một lần settle hỏng sau capture có bắt
buộc kéo theo hoàn tiền hay không, nên nó không quyết được nhánh hỏng đó có giành được một file flow
riêng theo `TESTING-4` hay không. Nó không nhắc tới model ở đâu cả, nên cả `TESTING-9` lẫn `TESTING-10`
đều không được nó giải. Nó không mô tả môi trường demo, nên `TESTING-11` vẫn để mở. Những chỗ đó còn
mở cho tới khi có một shape nêu chúng ra.

## Phạm vi

Luật này đúng cho mọi test back end trong stack này — mọi back end chạy flow qua một transport và chạy
quyết định bên trong handler. Nó không gọi tên một tính năng, một sản phẩm, một repository hay một
khoá học nào. Các hậu tố lane và id của rule là những danh từ riêng duy nhất, vì chúng là danh tính
thực thi và một rule bị đổi tên thì không trích dẫn được trong config.
