# thử nghiệm

## Định nghĩa

Có hai loại bài kiểm tra ở đây và chúng trả lời các câu hỏi khác nhau. Câu trả lời **e2e** *thực hiện
hoạt động kinh doanh?* — một dòng, bắt đầu đến kết thúc, cách tiền và nhà nước thực sự di chuyển qua
hệ thống. **thông số đơn vị** trả lời *quyết định này có đúng không?* — một nhánh, một quy tắc, một
tính toán, không có gì thực sự đằng sau nó.

Do đó, e2e có mục đích dài. "Người đọc thêm khóa học vào giỏ hàng, thanh toán, thanh toán
nhà cung cấp gọi lại, đăng ký mở, XP hạ cánh" là MỘT bài kiểm tra, vì câu đó là
lời hứa mà doanh nghiệp đưa ra. Chia thành năm bài kiểm tra, nó không còn là một lời hứa nữa mà trở thành năm
mô tả về năm điểm cuối, không có mô tả nào cho biết liệu thiết bị có hoạt động hay không.

Câu hỏi quyết định bài kiểm tra thuộc về làn đường nào: **điều này có thể ngừng sản xuất mà không có
bài kiểm tra có nhận thấy không?** Nếu câu trả lời là có, bài kiểm tra không bao gồm nội dung mà nó có vẻ đề cập —
và đối với một luồng, điều đó thường có nghĩa là nó xác nhận phản hồi thay vì hậu quả.

Những gì giữ một nửa có thể kiểm tra bằng máy là[`sources/be/testing.mjs`](../../../sources/be/testing.mjs).
Hầu hết luật này không thể kiểm tra được bằng máy, đó là lý do nó được viết cẩn thận.

## Quy tắc

**KIỂM TRA-1 · e2e là một luồng kinh doanh và tên của nó là luồng.**`course-enroll`, `courses-checkout`, `rewards-redeem`là những dòng chảy.`jobs-queries`,
`rewards-queries`, `coding-queries`thì không - họ là một nhóm người giải quyết mặc trang phục của bài kiểm tra,
và không có tệp nào trong hình dạng đó có thể cho biết liệu mọi thứ có hoạt động hay không, chỉ có một số điểm cuối đã phản hồi.

Bài kiểm tra là tên của tập tin. Nếu cái tên trung thực là một cụm danh từ chỉ một phần của
API chứ không phải là một câu về doanh nghiệp, tập tin có hình dạng sai.

**KIỂM TRA-2 · Khẳng định là hậu quả, không bao giờ là phong bì.**`status === 200`Và`__typename`chứng minh máy chủ còn sống. Họ không chứng minh một hàng đã di chuyển, một
số dư đã thay đổi, quyền được hưởng được mở hoặc một sự kiện đã xảy ra. Đọc lại trạng thái - từ
cơ sở dữ liệu, từ truy vấn tiếp theo, từ sự kiện mà luồng phát ra - và xác nhận ĐÓ.

Một luồng mà quá trình kiểm tra chỉ đọc phản hồi của chính nó là một luồng có thể âm thầm ngừng tồn tại.

**KIỂM TRA-3 · Thử nghiệm di chuyển theo cách dòng chảy di chuyển.**

Bất kể phương thức vận chuyển nào được sử dụng trong sản xuất thì thử nghiệm sẽ sử dụng. Một bước không đồng bộ - một công việc, một
webhook, một mã hóa — được thăm dò cho đến khi trạng thái ổn định thay vì được xác nhận trên dòng sau
gọi, bởi vì việc xác nhận ngay lập tức kiểm tra tốc độ của bộ lập lịch và không có gì khác. Một bước thời gian thực
mở một máy khách THỰC SỰ và chờ tin nhắn. Một bản ghi được đọc lại từ cơ sở dữ liệu.

Bus CQRS, trình xử lý, trình phân giải và phương thức worker là các phần bên trong của ứng dụng, không phải là phương thức vận chuyển.
Đang gọi`commandBus.execute(...)`, `handler.execute(...)`, `resolver.execute(...)`hoặc`worker.process(...)`bắt đầu sau khi định tuyến, xác thực, xác thực và tuần tự hóa
đã thành công nên dòng chảy có thể vẫn xanh trong khi cánh cửa sản xuất của nó bị phá vỡ. Họ thuộc về
làn đường tích hợp hoặc đơn vị. Một e2e nhập thông qua GraphQL, HTTP, ổ cắm thực, thông báo của người môi giới
hoặc ranh giới của bộ lập lịch mà hoạt động sản xuất đi qua.

Không có giải thưởng cho bài kiểm tra chỉ nói một giao thức. Một luồng nửa HTTP và một nửa
socket, chỉ được thử nghiệm qua HTTP, đã được thử nghiệm một nửa - và nửa chưa được kiểm tra là nửa cứng.

**KIỂM TRA-4 · Con đường hạnh phúc là chủ đề; một con đường không vui kiếm được e2e bằng cách kéo một điểm quan trọng
chảy đằng sau nó.**

Con đường hạnh phúc LÀ công việc kinh doanh, vì vậy đó chính là mục đích của e2e. Một con đường bất hạnh chỉ thuộc về nơi đây khi
thất bại chứng tỏ một điều gì đó cũng phải đúng: thanh toán thành công và ngân hàng sau đó cũng thất bại,
vì vậy phải thực hiện HOÀN TIỀN; một khoản phí đã đến hai lần, vì vậy sự bình thường phải được giữ nguyên; hai nhà văn chạy đua, vì vậy
sự ràng buộc phải bắt được nó.

Một đường dẫn không hài lòng chỉ trả về lỗi xác thực là một quyết định chứ không phải một luồng. Nó thuộc về một
thông số đơn vị, trong đó chi phí tính bằng mili giây thay vì cơ sở dữ liệu.

**TESTING-5 · Thông số kỹ thuật đơn vị bao gồm các nhánh quyết định.**

Mỗi nhánh có thể thay đổi kết quả đều có một trường hợp: ranh giới, tập trống, tập đã hoàn thành,
điều không được phép. Bảo hiểm ở đây có nghĩa là các QUYẾT ĐỊNH được bảo hiểm, không phải các dòng đã được thực thi -
một tập tin có thể chạy mọi dòng mà vẫn không bao giờ lấy nhánh quan trọng.

**TESTING-6 · Thông số kỹ thuật chỉ xác nhận cuộc gọi sẽ kiểm tra quá trình triển khai.**`expect(service.charge).toHaveBeenCalledWith(...)`không có khẳng định nào về kết quả, trình bày lại
nguồn riêng của người xử lý. Viết lại trình xử lý một cách chính xác và thông số kỹ thuật chuyển sang màu đỏ; phá vỡ quy tắc kinh doanh
trong khi vẫn giữ hình dạng cuộc gọi và nó vẫn có màu xanh. Điều đó ngược lại và đó chính xác là lý do
bộ có thể lớn và chứng tỏ ít.

Khẳng định điều gì đã quay lại hoặc điều gì đã thay đổi. Xác nhận cuộc gọi chỉ hợp lệ dưới dạng xác nhận THỨ HAI,
trong đó bản thân cuộc gọi là hiệu ứng có thể quan sát được - một email được gửi, một sự kiện được xuất bản.

**KIỂM TRA-7 · Các làn đường được phân tách bằng hậu tố chứ không phải theo lối đi.**`*.spec.ts`, `*.int-spec.ts`, `*.e2e-spec.ts`, `*.harness-spec.ts`. Đây là điều cho phép mọi làn đường
sống gần mã mà nó thực hiện trong khi đơn vị chạy nhanh vẫn ở tốc độ nhanh và điều đó có nghĩa là làn đường của bài kiểm tra đang
hiển thị trong tên tệp của nó thay vì được suy ra từ nơi ai đó đã lưu trữ nó.

**KIỂM TRA-8 · Làn đường không có hồ sơ không phải là làn đường vượt.**

Một bộ được định cấu hình để vượt qua khi không tìm thấy gì báo cáo màu xanh lục mãi mãi và màu xanh lá cây là màu xanh lá cây mà mọi người đều có.
đọc. Làn đường có các bài kiểm tra hoặc làn đường đó bị loại bỏ - làn đường trống được định cấu hình, có kịch bản là yêu cầu của
bảo hiểm mà không có gì ủng hộ.

**KIỂM TRA-9 · Một e2e không bao giờ gọi một mô hình. Dây nịt là làn đường duy nhất làm được điều đó.**

Một cuộc gọi mẫu sẽ tốn tiền, mất vài giây và mỗi lần trả lời sẽ khác nhau. Cả ba thuộc tính
nghiêm trọng trong thử nghiệm luồng: bộ phần mềm trở nên tốn kém khi chạy, đủ chậm để mọi người ngừng chạy
nó và không ổn định theo cách huấn luyện mọi người chạy lại thay vì đọc.

Vì vậy, một luồng đi qua một mô hình sẽ giữ cho việc vận chuyển sản xuất và điều phối nội bộ trở nên thực tế,
sau đó chỉ thay thế kết quả SDK của nhà cung cấp bên ngoài bằng một bản cố định xác định. Nó khẳng định rằng
yêu cầu đã được ghi lại, hạn ngạch đã được chi tiêu, quyền được kiểm tra, câu trả lời vẫn được duy trì
và quay trở lại. Đó là những phần bị gãy. Liệu câu mà mô hình tạo ra có tốt hay không
là một câu hỏi khác, được hỏi ở một làn đường khác.

**STUB TRẢ LẠI JSON THỰC TẾ, THEO HÌNH THỨC MỤC ĐÍCH PHÂN TÍCH.** Đây là phần dễ dàng
mắc sai lầm và phải trả giá đắt nếu mắc sai lầm. Câu trả lời sơ khai`"stubbed"`bỏ qua trình phân tích cú pháp JSON nghiêm ngặt
hoàn toàn — và bộ phân tích cú pháp là phần có nhiều khả năng bị hỏng nhất, bởi vì đó là nơi đầu ra của mô hình
đáp ứng một lược đồ. Một luồng mà phần sơ khai trả về một điểm đánh dấu chứng tỏ hệ thống ống nước và ẩn một đường nối
thực sự thất bại trong sản xuất.

Vì vậy, tải trọng đóng hộp mang các trường thực, với các giá trị mà một câu trả lời thực có thể có: điểm số trong
phạm vi, các mảng không trống, các thành viên enum mà lược đồ khai báo. Nó là một vật cố định của
OUTPUT của mô hình, không phải là phần giữ chỗ thay thế cho một mô hình.

**Sơ khai nhà cung cấp bên ngoài là mặc định, không bao giờ là thứ mà tác giả luồng ghi nhớ.** Thế giới
khởi động với kết quả SDK bị lỗi trong khi`AiInvokeService`, định tuyến, hạn ngạch và tính bền vững vẫn có thật;
việc tiếp cận nhà cung cấp cần có sự từ chối có chủ ý. Một quy tắc phụ thuộc vào việc được ghi nhớ là một quy tắc
đó là một buổi chiều mất tập trung vì bị hỏng, và sự đổ vỡ xuất hiện như một sự chậm chạp, tốn kém,
dãy màu đỏ ngắt quãng mà không ai có thể giải thích được.

Phần ghi đè là ranh giới giữa hai làn đường và nó chạy theo hướng khác trong dây nịt: ở đó,
một cuộc gọi giả không chứng tỏ được gì cả, vì vậy **nếu nó gọi, nó thực sự gọi**.

**KIỂM TRA-10 · Dây nịt gọi trực tiếp cho nhà cung cấp và xử lý một hoặc hai trường hợp.**

Dây nịt tồn tại để hỏi *câu trả lời của mô hình có được chấp nhận không?* — vì vậy nó nói chuyện với chính nhà cung cấp
khách hàng và không có gì khác, và nó biến cuộc gọi trở thành hiện thực. Một cuộc gọi giả ở đây chẳng chứng tỏ được điều gì cả:
toàn bộ chủ đề về làn đường chính là những gì người mẫu thực sự đã nói.

Mỗi lớp giữa dây nịt và nhà cung cấp là một lớp có thể làm cho dây nịt đi qua trong khi
quá trình sản xuất không thành công: chuyển hướng cấp độ, ghi đè định tuyến, trình bao bọc nội bộ chọn mô hình. Mỗi
một có nghĩa là thứ được thử nghiệm không phải là thứ được vận chuyển.

Dây nịt chất lượng kiểu mẫu sở hữu một mục tiêu nhà cung cấp rõ ràng. Nó nhập SDK của nhà cung cấp đã được phê duyệt,
cung cấp khóa API máy chủ do nhà cung cấp cấp từ một biến môi trường khai thác rõ ràng, đặt tên cho
mô hình và điểm cuối chính xác, đồng thời gọi trực tiếp SDK đó. Nó có thể sử dụng lại trình tạo lời nhắc sản xuất
và trình phân tích cú pháp sản xuất; nó không được cung cấp, ghi đè, bọc hoặc mạo danh`AiInvokeService`, và nó
không được định tuyến qua cấp, danh mục, chuỗi dự phòng, nhóm khóa hoặc trình trợ giúp cuộc gọi mô hình nội bộ.

Thông tin xác thực của người tiêu dùng hoặc CLI không phải là thông tin xác thực API của nhà cung cấp. Mã thông báo OAuth của Mã Claude,
Mã thông báo phiên ChatGPT/Codex, hồ sơ CLI và tệp mã thông báo bị cấm khai thác bởi các cơ quan có thẩm quyền. A
Thẩm phán LLM riêng biệt, khi được sử dụng, sẽ khai báo bộ dữ liệu nhà cung cấp/mô hình/điểm cuối/khóa rõ ràng của chính nó. cũng không
SUT cũng như không Judge âm thầm kế thừa hoặc quay trở lại bộ dữ liệu khác.

Quyền sở hữu làn đường vẫn không đối xứng: e2e giữ cho việc vận chuyển sản xuất và điều phối nội bộ trở nên thực tế
trong khi chỉ thay thế kết quả của nhà cung cấp bên ngoài; dây nịt chất lượng kiểu mẫu gọi cho nhà cung cấp trực tiếp
nhưng chỉ chứng minh chất lượng của dấu nhắc/mô hình/trình phân tích cú pháp. Nó không thay thế phạm vi bảo hiểm dòng chảy. Giữ một hoặc hai sống
các trường hợp chất lượng theo khả năng và số lần thử bị ràng buộc đối với các lỗi của nhà cung cấp tạm thời.

Và nó vẫn nhỏ. Một hoặc hai trường hợp cho mỗi khả năng, được chọn vì chúng là những trường hợp sẽ
hiển thị hồi quy - không phải ma trận. Khai thác được tính phí cho mỗi cuộc gọi phát triển trường hợp trên mỗi cạnh là
khai thác ai đó cuối cùng ngừng chạy và một eval không ai chạy có giá trị nhỏ hơn không có eval,
bởi vì kết quả màu xanh lá cây cuối cùng của nó vẫn còn trên bảng.

**KIỂM TRA-11 · Hạt giống demo đại diện cho một thế giới sản phẩm sống động chứ không phải một tài khoản trống.**

Hạt giống cục bộ tồn tại để người đọc có thể kiểm tra trạng thái sản phẩm thực thông qua đường dẫn đọc sản phẩm. Nó
do đó gieo mầm một nhóm xác định với nhiều tiến bộ khác nhau: tiếp tục công việc, hoạt động liên tục,
tiền kiếm được, tổng hợp dân số và kết quả xã hội liên quan đến một số tác nhân. Trạng thái trống
vẫn xứng đáng có lịch thi đấu, nhưng một thế giới hoàn toàn trống rỗng không thể tiết lộ liệu danh sách, số lượng, thứ hạng,
tiến trình hoặc sự tham gia của nhiều người dùng là chính xác.

Hạt giống ghi các bản ghi nguồn và vô hiệu hóa các phép chiếu dẫn xuất để các trình xử lý thông thường xây dựng lại chúng.
Nó bình thường và chấp nhận tài khoản đang được kiểm tra; nó không bao giờ ghim JSON chỉ có ảnh chụp màn hình hoặc
giả định một danh tính được mã hóa cứng là người hiện đang đăng nhập.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Một e2e được đặt tên cho nhóm trình phân giải (`*-queries`) | Không có tệp nào trong hình dạng đó đại diện cho một luồng, vì vậy việc chuyển chỉ cho biết các điểm cuối đã trả lời | Đặt tên cho câu kinh doanh và biến nó thành một dòng |
| Chỉ khẳng định`status` / `__typename`trong một e2e | Nó chứng tỏ máy chủ vẫn hoạt động và không có gì khác; dòng chảy có thể ngừng âm thầm tồn tại | Đọc lại trạng thái và khẳng định hệ quả |
| Xác nhận kết quả không đồng bộ trên dòng sau lệnh gọi | Nó kiểm tra tốc độ của bộ lập lịch và không ổn định khi xây dựng | Thăm dò ý kiến ​​cho đến khi trạng thái ổn định, với thời gian chờ có giới hạn |
| Chỉ kiểm tra luồng thời gian thực qua HTTP | Nửa chưa thử là nửa khó | Mở một khách hàng thực sự và chờ tin nhắn |
| Đang gọi`CommandBus`, `QueryBus`, một trình xử lý, trình phân giải hoặc phương thức worker từ e2e | Nó đi vào sau quá trình định tuyến, bảo vệ, xác thực và tuần tự hóa sản xuất, vì vậy các đường nối đó có thể bị đứt trong khi luồng vẫn xanh | Nhập thông qua GraphQL, HTTP, ranh giới ổ cắm thực, nhà môi giới hoặc bộ lập lịch |
| Một e2e cho một lỗi xác thực đơn giản | Tốn một cơ sở dữ liệu để chứng minh chi nhánh | Đặt nó trong thông số đơn vị |
| Một thông số đơn vị có mọi khẳng định là`toHaveBeenCalled*`| Nó trình bày lại nguồn: các bản viết lại đúng sẽ chuyển sang màu đỏ, các quy tắc bị hỏng vẫn có màu xanh | Khẳng định giá trị trả về hoặc trạng thái đã thay đổi |
| Tách một luồng thành một bài kiểm tra cho mỗi điểm cuối | Lời hứa biến mất; năm mô tả điểm cuối không cộng lại thành một quy trình làm việc | Một tập tin, một luồng, bắt đầu kết thúc |
| Một làn đường được định cấu hình không có thông số kỹ thuật trong đó | Nó báo màu xanh mãi mãi và màu xanh lá cây là nội dung được đọc | Điền vào nó hoặc xóa nó |
| Gọi một mô hình từ e2e | Nó tốn tiền, mất vài giây và mỗi lần trả lời đều khác nhau - vì vậy bộ phần mềm này đồng thời trở nên đắt tiền, chậm và không ổn định | Giữ sự điều phối nội bộ thực tế, bỏ qua kết quả của nhà cung cấp bên ngoài, sau đó xác nhận hạn ngạch, tính kiên trì và phản hồi |
| Một sơ khai trả về một chuỗi đánh dấu (`"stubbed"`, `"ok"`) | Nó bỏ qua trình phân tích cú pháp JSON nghiêm ngặt, đây là đường nối có nhiều khả năng bị đứt nhất, do đó luồng chứng minh hệ thống ống nước và che giấu lỗi | Trả về JSON thực tế theo hình dạng mà trình phân tích cú pháp mong đợi |
| Dựa vào từng luồng tác giả để ghi nhớ sơ khai | Một quy tắc cần phải ghi nhớ là một buổi chiều mất tập trung vì bị vi phạm | Sơ khai theo mặc định trên thế giới; làm cho việc liên hệ với nhà cung cấp trở thành một lựa chọn không tham gia có chủ ý |
| Dây nịt tiếp cận nhà cung cấp thông qua một cấp hoặc lớp định tuyến | Thứ được thử nghiệm không phải là thứ được vận chuyển và dây nịt có thể vượt qua trong khi quá trình sản xuất không thành công | Gọi trực tiếp cho khách hàng của nhà cung cấp |
| Một dây nịt cung cấp hoặc ghi đè`AiInvokeService`với bộ chuyển đổi nhà cung cấp trực tiếp | Nó cải trang cuộc gọi của nhà cung cấp thành cổng sản xuất và có thể phát minh ra siêu dữ liệu về nhà cung cấp, mã thông báo và chi phí | Sử dụng lại lời nhắc/trình phân tích cú pháp sản xuất xung quanh lệnh gọi SDK của nhà cung cấp trực tiếp |
| Khai thác được xác thực bởi Claude Code OAuth, phiên ChatGPT/Codex, hồ sơ CLI hoặc tệp mã thông báo | Thông tin xác thực của người tiêu dùng không phải là thông tin xác thực API máy chủ do nhà cung cấp cấp và không chứng minh quyền được triển khai | Đọc một khóa API của nhà cung cấp rõ ràng từ môi trường thời gian chạy khai thác |
| Dây nịt phát triển vỏ trên mỗi cạnh | Nó được tính phí cho mỗi cuộc gọi, vì vậy nó trở thành thứ mà mọi người ngừng chạy - và màu xanh cũ còn tệ hơn là không có màu xanh lục | Một hoặc hai trường hợp cho mỗi khả năng, được chọn để hiển thị hồi quy |
| Một hạt giống demo chứa một người học hoàn toàn bằng không | Nó ẩn các nhánh đông dân cư và mọi mối quan hệ liên quan đến một tác nhân khác | Tạo một nhóm bình thường với dữ liệu nguồn đa dạng, sau đó để các mô hình đọc sản xuất lấy được màn hình |

## Ví dụ

### Trường hợp thông thường — một luồng cho biết doanh nghiệp đang hoạt động
```ts
// e2e: one sentence about the business, end to end. The assertion is the consequence.
it("a paid checkout opens the enrollment and lands the XP", async () => {
    await addToCart(courseId)
    const { orderId } = await checkout()
    await postProviderWebhook({ orderId, status: "PAID" })

    // the webhook is asynchronous - wait for the state to settle rather than for a timer
    await until(async () => (await countEnrollments(userId, courseId)) === 1)

    const enrollment = await entityManager.findOneOrFail(EnrollmentEntity, {
        where: { user: { id: userId }, course: { id: courseId } },
    })
    expect(enrollment.isEnrolled).toBe(true)
    expect(await xpTotal(userId)).toBe(startingXp + COURSE_ENROLL_XP)
})
```

```ts
// Wrong: three endpoint checks. Every one passes while nothing is persisted.
it("addToCart returns 200", async () => expect((await addToCart(courseId)).status).toBe(200))
it("checkout returns 200", async () => expect((await checkout()).status).toBe(200))
it("webhook returns 200", async () => expect((await postProviderWebhook({})).status).toBe(200))
```
Họ khác nhau ở một điều: liệu sự thất bại thầm lặng trong việc kiên trì có bị phát hiện hay không.

### Con đường bất hạnh đã giành được vị trí của nó
```ts
// e2e: the payment succeeded and the bank then failed, so the refund must run and the
// entitlement must close again. This is critical, so it is a flow.
it("a settlement failure after capture refunds and closes the entitlement", async () => {
    const { orderId } = await checkoutAndCapture()
    await postProviderWebhook({ orderId, status: "SETTLEMENT_FAILED" })

    await until(async () => (await refundState(orderId)) === "REFUNDED")

    expect(await walletBalance(userId)).toBe(startingBalance)
    expect(await isEnrolled(userId, courseId)).toBe(false)
})
```

```ts
// Wrong lane: a missing field is a decision, not a flow, and it does not need a database.
it("checkout rejects an empty cart", async () => {
    const response = await checkout()
    expect(response.errors[0].message).toContain("empty")
})
```
Chúng khác nhau ở một điều: liệu thất bại có tạo ra điều gì khác mà điều đó cũng phải đúng hay không.

### Bẫy vận chuyển
```ts
// e2e: the flow ends on a socket, so the test opens one and waits for the message.
const socket = await connectSocket(token)
const delivered = firstMessage(socket, "notification")

await markLessonComplete(lessonId)

expect((await delivered).type).toBe("STREAK_EXTENDED")
```

```ts
// Wrong: the same flow tested over HTTP alone. The half that is hard - delivery - is untested,
// and the test passes while nothing ever reaches a reader.
await markLessonComplete(lessonId)
expect((await getNotifications()).length).toBe(1)
```
Chúng khác nhau ở một điểm: liệu một nửa luồng phân phối có được thực hiện hay không.

### Bẫy xác nhận cuộc gọi
```ts
// unit: it asserts the DECISION - what the handler concluded from what it was given.
it("charges the discounted price when a coupon applies", async () => {
    const result = await handler.execute(command({ coupon: "HALF" }))
    expect(result.chargedAmount).toBe(5000)
})
```

```ts
// Wrong: it restates the source. Rename the collaborator's method and this goes red; change
// the discount to the wrong number and it stays green.
it("charges the discounted price when a coupon applies", async () => {
    await handler.execute(command({ coupon: "HALF" }))
    expect(payments.charge).toHaveBeenCalledWith(expect.anything())
})
```
Chúng khác nhau ở một điều: liệu có bị bắt nhầm số hay không.

### Bẫy làn đường — một dòng chảy qua mô hình
```ts
// e2e: the model is stubbed with realistic JSON, so the flow still runs the strict parser -- and
// the test asserts what can actually break: the entitlement check, the quota spend, the persistence.
aiInvoke.run.mockResolvedValue({
    text: JSON.stringify({
        answer: "A closure keeps access to its enclosing scope after that scope returns.",
        citations: [{ contentId: CONTENT, quote: "lexical scope" }],
        confidence: 0.82,
    }),
})

await ask(CONTENT, "what is a closure?")

const session = await entityManager.findOneOrFail(ContentAiSessionEntity, { where: { contentId: CONTENT } })
expect(session.turns).toHaveLength(1)
expect(session.turns[0].citations).toHaveLength(1)
expect(await remainingQuota(learner.id)).toBe(startingQuota - 1)
```

```ts
// Wrong: a marker. The parser never runs, so the seam where a model's output meets a schema --
// the piece most likely to break -- is the one piece this flow does not touch.
aiInvoke.run.mockResolvedValue({ text: "stubbed" })
```
Chúng khác nhau ở một điều: liệu trình phân tích cú pháp có được thực hiện hay không.
```
ts
// Wrong lane entirely: a real model call inside a flow test. It costs money, adds seconds, and the
// assertion has to be loose enough to survive a different wording - so it stops catching anything.
const response = await ask(CONTENT, "what is a closure?")
expect(response.answer.toLowerCase()).toContain("closure")
```
Chúng khác nhau ở một điều: liệu bài kiểm thử có thể thất bại vì một lý do không phải là lỗi hay không.

### Bẫy dây nịt — kiểm tra lớp bọc thay vì mô hình
```ts
// harness: the provider's own client and an explicit provider-issued API key, one case chosen
// because a regression would show here. gradingPrompt and scoreFrom are production seams.
const anthropic = new Anthropic({ apiKey: requiredEnv("HARNESS_ANTHROPIC_API_KEY") })
const message = await anthropic.messages.create({
    model: HARNESS_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: gradingPrompt(submission) }],
})
expect(scoreFrom(message)).toBeGreaterThanOrEqual(PASSING)
```

```ts
// Wrong: a live provider hidden behind a fake production gateway. The adapter can invent provider,
// token and cost metadata, and the harness is green without proving the production contract.
const aiInvoke = createHarnessInvoke(() => ({ model: "claude-sonnet-5" }))
const text = await aiInvoke.run({ messages: gradingPrompt(submission) })
expect(scoreFrom(text)).toBeGreaterThanOrEqual(PASSING)
```
Chúng khác nhau ở một điểm: dây nịt có gọi mục tiêu của nhà cung cấp đã khai báo hay mạo danh
cửa ngõ sản xuất.

### Che quyết định chứ không phải dòng
```ts
// unit: every branch that changes the outcome has a case.
it.each([
    ["no attempts", 0, "FIRST_TRY"],
    ["at the cap", MAX_ATTEMPTS, "EXHAUSTED"],
    ["past the cap", MAX_ATTEMPTS + 1, "EXHAUSTED"],
])("resolves %s to %s", async (_name, attempts, expected) => {
    expect(await handler.execute(command({ attempts }))).toBe(expected)
})
```

```ts
// Wrong: one case in the middle of the range. Every line runs, the boundary is never taken,
// and an off-by-one at the cap ships.
it("resolves the attempt state", async () => {
    expect(await handler.execute(command({ attempts: 2 }))).toBe("FIRST_TRY")
})
```
Chúng khác nhau ở một điều: ranh giới có được thực hiện hay không.

### Bẫy hạt giống — vẽ ảnh chụp màn hình thay vì xây dựng thế giới của nó
```ts
await seedDemoWorld({
    currentLearner: { resumedLessons, activeDays, earnedCurrency, gradedWork },
    learners: variedLearners,
    challengePassers,
})
await invalidateDerivedProjections(currentLearner.id)
```

```ts
// Wrong: the screen looks populated, but no production join or projection can prove it.
await writeDashboardProjection(currentLearner.id, screenshotShapedJson)
```
Chúng khác nhau ở một điểm: giao diện người dùng đang đọc thế giới thực hay kết quả được vẽ.
