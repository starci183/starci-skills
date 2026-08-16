# dòng chảy e2e

## Định nghĩa

Đây là hình dạng của một tệp luồng: làm thế nào một câu kinh doanh trở thành một bài kiểm tra thất bại khi
thời gian nghỉ kinh doanh và không vào lúc nào khác.`testing.md`giải quyết NHỮNG bài kiểm tra nào thuộc về làn đường này và những gì họ phải khẳng định. Tập tin này giải quyết
một trong số chúng được viết như thế nào - các phần mà một quy trình cần có, thứ tự chúng đi vào và bốn thói quen mà
biến một bài kiểm tra dòng chảy tốt thành một bài kiểm tra chậm.

Câu hỏi mà nó trả lời: **khi nút này chuyển sang màu đỏ lúc 3 giờ sáng, liệu người đọc có biết bước nào không
bị hỏng và tại sao?** Luồng trả lời "không" là luồng được chạy lại thay vì đọc và kiểm tra
được chạy lại thay vì đọc đã không còn là thử nghiệm nữa.

Những gì giữ phần có thể kiểm tra bằng máy là[`sources/be/e2e-flow.mjs`](../../../sources/be/e2e-flow.mjs),
và đó là **năm trong số mười hai quy tắc bên dưới** — E2E-3, một nửa trạng thái bền vững của E2E-4,
E2E-7, một nửa tác nhân nội bộ trực tiếp của E2E-11 và một nửa nhập khẩu nhà cung cấp của E2E-12.
Đó là con số trung thực, không hề chênh lệch.
Phần còn lại xem ý nghĩa của tên, điều gì đang được khẳng định hoặc ai đang hành động và quy tắc kích hoạt
dựa trên phán quyết là một trong những tác giả học cách vô hiệu hóa - điều này khiến luật pháp trở nên tồi tệ hơn khi không có gì
thực thi nó. Mô-đun ghi lại những gì đã được đo và để yên, vì vậy đầu đọc tiếp theo sẽ không
“hoàn thành công việc”.

## Quy tắc

**E2E-1 · Một tệp, một luồng và tệp được đặt tên theo câu.**`course-purchase.e2e-spec.ts`, mô tả "người học mua một khóa học và có thể bắt đầu khóa học đó". Không phải một
nhóm giải quyết, không phải là điểm cuối. Cái tên là lời hứa; tập tin là bằng chứng.

**E2E-2 · Quy trình là một chuỗi các bước CÓ TÊN, không phải một trường hợp dài.**

Mỗi bước là của riêng nó`it`, theo thứ tự, trạng thái chia sẻ thông qua phạm vi mô tả. Một đĩa đơn 300 dòng
trường hợp đưa ra một đường màu đỏ và không biết thao tác nào trong số mười một thao tác đã bị hỏng; mười một bước được đặt tên cung cấp cho
bước và những bước sau đó được bỏ qua thay vì chuyển thành tiếng ồn.

Các bước được sắp xếp theo thứ tự vì công việc kinh doanh được sắp xếp theo thứ tự. Đó là nơi mà bài kiểm tra có thể phụ thuộc vào
trường hợp trước nó, và nó chính xác là dòng chảy.

**E2E-3 · Không bao giờ ngủ. Thăm dò ý kiến ​​cho đến khi tiểu bang ổn định, có thời hạn.**`await sleep(500)`là nguồn tạo vảy lớn nhất trong bộ quy trình và nó không thành công ở cả hai khía cạnh
chỉ đường cùng một lúc: quá ngắn và bộ phần mềm chuyển sang màu đỏ vì một lý do không phải là lỗi; quá dài
và mỗi lần chạy đều phải trả giá cho trường hợp xấu nhất. Cả hai đều được "sửa" bằng cách tăng số lượng, điều này làm cho
suite chậm hơn mà không làm cho nó chính xác.

Thay vào đó hãy thăm dò tiểu bang -`await until(() => enrollmentExists(userId, courseId))`- có thời hạn
điều đó thất bại LỚN và nói những gì nó đang chờ đợi. Thời hạn là một lời khẳng định thực sự: “điều này sẽ
giải quyết trong vòng N giây" là một tuyên bố về hệ thống.

**E2E-4 · Khẳng định hệ quả và đọc nó từ nơi nó tồn tại.**

Hàng từ cơ sở dữ liệu, thông báo tắt ổ cắm, số dư từ truy vấn tiếp theo. Không phải
phong bì phản hồi, điều này chỉ chứng tỏ rằng máy chủ đã trả lời.

**E2E-5 · Một bước thời gian thực sẽ mở ra một khách hàng thực sự và xác nhận những gì đã đến — không bao giờ là bao nhiêu.**`expect(messages.length).toBe(2)`mã hóa số lượng người nghe tình cờ được kết nối. Thêm một
thuê bao thứ ba và hệ thống đúng chuyển sang màu đỏ; phân phối tải trọng sai đến đúng số lượng
người và một cái bị hỏng vẫn xanh.

Chờ tin nhắn TIẾP THEO khớp với một vị từ và xác nhận nội dung của nó cũng như người nhận. Số lượng là
chi tiết triển khai của phân xuất; nội dung là lời hứa.

**E2E-6 · Âm là một phần của dòng chảy.**

Trước khi khách truy cập đăng ký, họ không được nhận gì cả. Trước khi thanh toán được giải quyết, quyền được hưởng
phải đóng cửa. Luồng chỉ xác nhận những gì NÊN đến không thể bắt được hệ thống gửi
mọi thứ đối với mọi người - đó là thất bại quan trọng nhất, bởi vì nó vô hình trước mắt mọi người.
con đường hạnh phúc.

**E2E-7 · Không có nhánh nào trong bài kiểm tra.**`if (state === NeedWater) { ...assert... }`có nghĩa là tập tin xác nhận những điều khác nhau trên các
chạy và đường chạy ở nơi nhánh bị bỏ qua có màu xanh lá cây trong khi tỏ ra ít hơn. Nếu điều kiện là một phần
của dòng chảy, ép buộc nó và khẳng định vô điều kiện. Nếu không, nó không thuộc về nơi này.

**E2E-8 · Một nơi đứng vững trên thế giới.**

Một mô-đun hồng ngoại thử nghiệm khởi động ứng dụng, cơ sở dữ liệu, trình môi giới và ổ cắm, do đó, một tệp luồng
mở ra với những gì nó đang thử nghiệm thay vì với hai trăm đường dây. Khi hệ thống dây điện thay đổi,
một tập tin thay đổi.

**E2E-9 · Các tác nhân được đặt tên và được tạo theo quy trình.**`learner`, `otherLearner`, `company`- không`accountNumber: 8`. Một thứ tự ma thuật nói với người đọc
không có gì và xung đột âm thầm khi hai luồng chọn cùng một luồng. Người trợ giúp kiếm được một diễn viên mới cho mỗi
luồng, do đó các luồng không bao giờ chia sẻ trạng thái và có thể chạy theo bất kỳ thứ tự nào.

**E2E-10 · Luồng không ghi nhật ký gì.**`console.log`bên trong một bài kiểm tra là đầu ra không ai đọc được khi chạy màu xanh lá cây và tiếng ồn sẽ chôn vùi
khẳng định về một màu đỏ. Điều người đọc cần khi thất bại là tên bước và xác nhận, cả hai đều
trong đó người chạy đã in.

**E2E-11 · Chuỗi hoạt động đi vào ranh giới sản xuất của họ và đảm bảo mọi bước nhảy nội bộ đều thực tế.**

Luồng dự phòng, thử lại, xếp hàng, lên lịch, chiếu, vô hiệu hóa bộ đệm hoặc phân phối theo thời gian thực là
chỉ E2E khi thử nghiệm đi vào thông qua GraphQL/HTTP/socket, xuất bản cho nhà môi giới thực sự hoặc cho phép
lịch trình thực sự bị cháy. Nhập một công nhân để Nest có thể đăng ký là đúng; giải quyết chuyện đó
công nhân và gọi điện`process`, `finalize`hoặc một phương pháp nội bộ khác thì không. Cuộc gọi trực tiếp sẽ xóa
tuần tự hóa, khóa, thử lại, xác nhận và hành vi cạnh tranh của người tiêu dùng - chính xác là
hành vi mà luồng hoạt động tồn tại để chứng minh.

**E2E-12 · Ghi đè kết quả bên ngoài, không bao giờ ghi đè chính sách nội bộ chọn kết quả đó.**

AI E2E giữ`AiInvokeService`, bộ cân bằng, xoay khóa, bộ đệm tình trạng, quyền lợi và thanh toán
thực; Jest chỉ viết kịch bản cho khách hàng của nhà cung cấp cụ thể`invoke`/`stream`kết quả hoặc sai sót. Thanh toán
E2E duy trì sự đối chiếu, định tuyến hành động và trợ cấp thực tế; Tập lệnh Jest chỉ có Stripe/PayOS/PayPal/
NOWThanh toán. Ranh giới tương tự áp dụng cho Keycloak, SMTP, GitHub, Judge0 và FFmpeg. Chế giễu một
người điều phối nội bộ làm cho tính năng dự phòng, phân bổ, khôi phục và tính bình thường biến mất trong khi
bài kiểm tra vẫn xanh.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
|`await sleep(ms)`| Lúng túng khi ngắn, chậm khi dài và cả hai đều được “sửa” bằng cách nâng số |`await until(predicate, { timeout })`|
| Một`it`bao trùm toàn bộ dòng chảy | Một đường màu đỏ duy nhất cho mười một thao tác, vì vậy không ai biết thao tác nào bị hỏng | Một người có tên`it`mỗi bước |
| Khẳng định một tin nhắn COUNT | Nó mã hóa số lượng người nghe tồn tại; thuê bao thứ ba chuyển sang hệ thống chính xác | Chờ tin nhắn phù hợp tiếp theo; khẳng định nội dung và người nhận |
| Một máy ghi âm có thể thay đổi được đặt lại bằng tay giữa các bước | Một lần đặt lại bị quên và bước sau sẽ tính một sự kiện trước đó | Một người trợ giúp đang chờ N tin nhắn phù hợp tiếp theo |
|`if`xung quanh một khẳng định | Đường chạy bỏ qua nhánh có màu xanh lá cây trong khi tỏ ra ít hơn | Buộc điều kiện, hoặc bỏ vụ án |
| Một diễn viên ảo thuật thứ tự (`accountNumber: 8`) | Nó không nói gì, và hai luồng âm thầm va chạm vào nó | Một diễn viên được đặt tên được đúc theo mỗi luồng |
|`console.log`trong một bài kiểm tra | Chưa đọc khi xanh, nhiễu khi đỏ | Tên bước và xác nhận |
| Chỉ xác nhận trạng thái phản hồi | Nó chứng tỏ máy chủ đã trả lời và không có gì khác | Đọc lại trạng thái |
| Gọi một giải quyết`*Worker` / `*Handler`| Nó bỏ qua ranh giới của nhà môi giới/CQRS và tất cả ngữ nghĩa phân phối | Đăng ký nó, sau đó kích hoạt hàng đợi/vận chuyển thực sự |
| Chế giễu một dịch vụ điều phối/dự phòng nội bộ | Nó loại bỏ chính sách mà E2E hoạt động nhằm chứng minh | Chỉ mô phỏng kết quả/lỗi SDK bên ngoài |

## Ví dụ

###Hình dạng
```ts
describe("a learner buys a course and can start it", () => {
    let learner: Actor
    let orderId: string

    beforeAll(async () => {
        world = await bootE2eWorld()
        learner = await world.mintLearner()
    })

    it("puts the course in the cart", async () => {
        await world.graphql(learner).addToCart({ courseId: COURSE })
        expect(await world.db.cartSize(learner.id)).toBe(1)
    })

    it("checks out and gets an order", async () => {
        orderId = (await world.graphql(learner).checkout()).orderId
        expect(await world.db.orderState(orderId)).toBe(OrderState.Pending)
    })

    it("opens the enrollment when the provider settles", async () => {
        await world.provider.postWebhook({ orderId, status: "PAID" })
        await until(() => world.db.isEnrolled(learner.id, COURSE))
        expect(await world.db.xpTotal(learner.id)).toBe(startingXp + COURSE_ENROLL_XP)
    })
})
```
### Bẫy ngủ
```
ts
// the deadline is an assertion: this flow claims the webhook settles within ten seconds
await until(() => world.db.isEnrolled(learner.id, COURSE),
    { timeout: 10_000, describe: "the enrollment to open after the PAID webhook" })
```

```ts
// Wrong: red when the broker is busy, slow on every run that is not, and the fix everybody
// reaches for is to make 500 into 2000 -- which buys neither correctness nor speed.
await sleep(500)
expect(await world.db.isEnrolled(learner.id, COURSE)).toBe(true)
```
Chúng khác nhau ở một điều: sự chờ đợi bị giới hạn bởi kết quả hay sự phỏng đoán.

### Cái bẫy quạt ra
```ts
// what arrived, and to whom
const delivered = await world.socket(learner).nextMessage("notification")
expect(delivered.type).toBe("ENROLLMENT_OPENED")
expect(delivered.courseId).toBe(COURSE)
```

```ts
// Wrong: two is how many listeners are connected today. A third subscriber reddens a correct
// system, and delivering the wrong payload to two people keeps this green.
expect(messageRecorder[EVENT].length).toBe(2)
```
Chúng khác nhau ở một điều: khẳng định là về lời hứa hay về hệ thống ống nước.

### Tiêu cực
```ts
it("does not notify a learner who is not watching this course", async () => {
    await world.graphql(learner).markLessonComplete({ lessonId: LESSON })
    await expectNoMessage(world.socket(otherLearner), "notification", { within: 1_000 })
})
```

```ts
// Wrong: the flow only ever asserts what SHOULD arrive, so a system that broadcasts everything
// to everybody passes every case in the file.
it("notifies the learner", async () => { /* ... */ })
```
Chúng khác nhau ở một điều: liệu có thể phát hiện được việc phân phối quá mức hay không.
