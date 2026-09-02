# Thi hành `backend.implement`

## Một việc duy nhất

Hiện thực đúng một outcome backend bên trong một mutation contract đã đóng băng sẵn, soi theo họ anh em
mà codebase đã publish, và trả về bằng chứng đo được cho thấy contract được lấp đầy chứ không bị nới
rộng. Đây là một lần gọi operator tuyến tính. Nó không gọi operator khác, không route workflow, không
tự tạm dừng bên trong, và không trả về chỉ dẫn điều khiển dạng tự do.

Ranh giới, các quyết định nghiệp vụ và những proof bắt buộc đều đã được quyết trước. Operator này chỉ
trả lời một câu cho mỗi operation: đoạn code hiện có làm đúng điều contract nói hay không, và phép đo
nào cho thấy điều đó.

## Contract đóng băng trước lần ghi đầu tiên

`input.contract` có fingerprint và đã đóng. Những operation, writer, store, ranh giới transaction, kiểu
idempotency và migration mà nó liệt kê là tập đầy đủ mà phần hiện thực được phép chạm tới.

Ba điều cấm gánh chuyện này, và mỗi điều đều được cưỡng chế chứ không phải khuyên nhủ:

1. một operation, writer, store, transaction, migration hay sự kiện nằm ngoài contract là
   `CONTRACT_WIDENED`, trả về cho người sở hữu contract trước mọi lần ghi sản phẩm;
2. một file nằm ngoài `input.scope.mutableFileRefs` là `OWNER_CONFLICT`, kể cả khi chỗ đó chỉ sửa một
   dòng;
3. một quy ước không pattern anh em nào publish thì bị từ chối, ghi lại thành `NEW_CONVENTION_REFUSED`,
   còn khía cạnh hoàn toàn không có pattern nào là `PATTERN_UNBOUND`.

Phát hiện giữa chừng rằng outcome cần một ranh giới rộng hơn là cách kết thúc được trông đợi của
operator này, không phải sự thiếu bản lĩnh. Contract được người sở hữu mở lại, và cùng outcome ấy được
hiện thực lại trên fingerprint mới.

## Backend không bao giờ tự nghĩ ra hành vi nghiệp vụ

Mỗi operation trích dẫn những quyết định đã duyệt mà nó hiện thực. Khi code chạm tới điểm mà câu trả
lời phụ thuộc vào một luật nghiệp vụ chưa ai duyệt, lần gọi dừng lại với `BUSINESS_AUTHORITY_MISSING`
và nêu tên câu hỏi còn mở. Nó không chọn cách hiểu dễ dãi, không bắt chước một tính năng bên cạnh tình
cờ đang làm thế, và không chọn nhánh nào khiến bài test chuyển xanh.

Đây là luật nặng ký nhất trong operator. Một luật nghiệp vụ đoán mò mà vượt qua chính bài test của nó
thì không thể phân biệt với một luật đã duyệt sau khi lên production, nên câu hỏi còn mở thoát ra dưới
dạng một failure có kiểu gửi tới người sở hữu nghiệp vụ, chứ không bao giờ dưới dạng một giá trị mặc
định.

Vì vậy một receipt đã hiện thực không được mang finding `BUSINESS_QUESTION_RAISED`. Nêu câu hỏi rồi vẫn
làm tiếp chính là mâu thuẫn mà phép kiểm tra này sinh ra để bắt.

## Trình tự thi hành

1. **Kiểm tra input và resume.** Áp `input.schema.json` cùng phần kiểm tra ngữ nghĩa. Từ chối binding
   source đã cũ, writer nằm ngoài trần được sửa, migration không có proof chạy lại, operation read-only
   mang migration, event consumer không có idempotency, mã quyết định mà thẩm quyền đã duyệt không
   publish, và resume không đổi gì.
2. **Ràng thẩm quyền.** Ràng thẩm quyền nghiệp vụ đã duyệt cùng các quyết định của nó, contract đã đóng
   băng cùng mọi operation, từng pattern anh em kèm khía cạnh của nó, và source head đã route. Xác minh
   lại head ngay trước lần ghi sản phẩm đầu tiên; khác biệt là `SOURCE_DRIFT`.
3. **Lấp từng operation một.** Với mỗi operation, viết transport, validation, kiểm tra phân quyền, truy
   cập dữ liệu và các đường thất bại vào writer đã khai cùng những file mà thay đổi thật sự cần, soi
   theo pattern đã bind cho từng khía cạnh. Từ chối to và sớm thay vì âm thầm bỏ qua một trường hợp:
   một tổ hợp không được hỗ trợ thì ném đúng exception mà pattern danh tính exception publish, trước
   khi tạo bất kỳ dòng dữ liệu hay phiên thanh toán bên ngoài nào.
4. **Ghi lại mọi mutation.** Mỗi file bị chạm sinh ra một bản ghi thay đổi kèm loại, hash trước, hash
   sau, operation nó phục vụ và nội dung đã đổi. Một file `modified` mà hai hash bằng nhau là ghi nhận
   một mutation chưa từng xảy ra.
5. **Kiểm lại snapshot đã lưu khi đọc.** Khi outcome lưu một workflow, session, giỏ hàng, bản nháp hay
   snapshot khác, hãy cưỡng chế tính dùng được một lần nữa ngay tại chỗ đọc, vì quyền lợi, tư cách
   thành viên, bản ghi được tham chiếu và luật schema đều trôi đi sau lúc tạo. Hoà giải phía máy chủ,
   giữ thứ tự ổn định, ánh xạ lại chỉ số một cách nguyên tử, và chọn một trạng thái kết thúc tường minh
   khi không còn gì hành động được. Ghi lại thành `SNAPSHOT_REVALIDATED`.
6. **Chứng minh từng mặt đã khai.** Mỗi mặt mà operation khai đều nhận đúng một bản ghi đối chiếu, nêu
   tên bằng chứng đã đo nó. Một mặt không có bản ghi là đối chiếu được khẳng định chứ không được chứng
   minh, còn một mặt có phán quyết `widened` hoặc `narrowed` thì chặn receipt lại.
7. **Chạy từng proof đã khai.** Mỗi loại proof đã khai đều chạy lệnh đã ghim và ghi kết quả dưới
   artifact root. Một proof không chạy được là `PROOF_UNAVAILABLE`; nó không bao giờ biến thành lời
   khẳng định rằng hành vi vẫn ổn. Một proof trượt thì chặn receipt chứ không được phân loại lại.
8. **Phát và dừng.** Ghi receipt dưới `input.project.artifactRootRef`, đăng ký mọi kết quả proof vào
   `artifactRefs`, phát đúng một output tuân theo `output.schema.json`, và ràng mọi fingerprint. Không
   tuyên bố bằng chứng chất lượng, thị giác hay UAT; đó là những việc khác với những cổng riêng.

## Đối chiếu là đo được, không phải khẳng định

Một bản ghi đối chiếu thiếu `evidenceRef` chỉ là một câu nói về code, mà một câu nói thì không phản bác
được code. Bằng chứng chính là thứ người đọc sau này dùng để bất đồng với receipt này, nên nó bắt buộc
với mọi mặt, kể cả những mặt đã đạt.

Cùng lý lẽ ấy khiến một proof phải mang cả lệnh lẫn kết quả: lệnh nói cái gì đã chạy, kết quả nói cái
gì trả về. Chỉ một trong hai thì người chưa chạy gì cũng viết ra được.

## Thi hành khi resume

Một resume bắt đầu lại từ khâu kiểm tra, chỉ tái dùng những quan sát có fingerprint không đổi, và tiêu
thụ đúng phần delta. Resume không thêm thay đổi nào về thẩm quyền, contract, pattern hay scope thì trả
`NO_PROGRESS`. Một quyết định nghiệp vụ được duyệt phải đến dưới dạng fingerprint mới của thẩm quyền;
cùng một fingerprint không thể cho ra một đáp án khác.

## Những đòn tấn công bắt buộc

Operator không được báo cáo một lần hiện thực khi còn bất kỳ mục nào áp dụng được mà chưa giải quyết:

- một hành vi trong code phụ thuộc vào luật mà thẩm quyền đã duyệt không phát biểu;
- một operation chạm tới store, sự kiện hay migration mà contract không liệt kê;
- một mặt đã khai không có bản ghi đối chiếu, hoặc có bản ghi mà không có bằng chứng;
- một proof đã khai chưa chạy, hoặc chạy và trượt;
- một bản ghi thay đổi khai `modified` trong khi hash trước và sau bằng nhau;
- xuất hiện một quy ước mà không pattern nào đã bind publish;
- một snapshot đã lưu được trả về mà không kiểm lại tại thời điểm đọc.
