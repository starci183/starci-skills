# Thực thi `content.generate`

## Một việc duy nhất

Dựng đúng một đơn vị nội dung giáo dục và để một lần phê bình độc lập phán nó. Đây là một lần gọi
operator tuyến tính. Nó không gọi operator khác, không điều phối workflow, không tự dừng giữa chừng,
và không phát ra chỉ dẫn điều khiển dạng văn xuôi tự do.

Ở hình dạng v7, việc này bị chia cho `brainstorm`, `write`, `code`, `image`, `e2e` và `review`. Nay
chúng là các bước bên trong một trình tự thực thi duy nhất, chạy đúng một lượt theo thứ tự. Không có
DAG và không có operator con: thứ tự quan trọng được giữ lại dưới dạng một trình tự, còn những ranh
giới quan trọng được giữ lại dưới dạng bất biến của contract.

## Brief đi trước và ràng buộc mọi thứ sau nó

Brief của người dạy được viết trước tiên, từ bằng chứng curriculum và source, trong đúng một execution
mới tinh không thừa kế lượt nào. Nó publish learner input, các outcome quan sát được, những claim mà
hình ảnh được phép mã hoá, các ví dụ, và các quyết định thêm, sửa, bỏ rõ ràng.

Mọi thứ sau đó đều bị đo theo nó. Một bản viết chỉ được khai phủ những outcome mà brief đã publish,
một hình chỉ được mã hoá claim mà brief đã publish, và mọi bản ngôn ngữ đã khai đều phải phủ trọn tập
outcome đã publish trước khi đơn vị được xuất xưởng. Đó là ý nghĩa của câu "brief ràng buộc phần viết"
khi nó nằm trong một contract được kiểm tra chứ không phải trong một lời dặn.

## Code sinh ra phải chạy được thật

Mỗi track hiện thực được build bằng đúng lệnh đã khai, và exit code được đọc rồi ghi lại. Exit code
khác không thì không được xuất xưởng: bài học sẽ nói với người học rằng đoạn code này chạy được, dựa
trên bằng chứng của không ai cả.

Kiểm tra thực thi chạy đúng lệnh của từng track bên trong một vòng lặp chạy - đọc - sửa có chặn trên.
Vòng lặp được phép sửa phần hiện thực. Nó không bao giờ được dịch chuyển cái contract dùng để đo nó,
nên fingerprint của contract được lấy trước lần chạy đầu và so lại sau lần chạy cuối. Một test bị xoá,
bị skip, bị nới lỏng hay bị đặc cách để cho xanh chính là lỗi mà phép so sánh này sinh ra để bắt.

## Hình được tạo theo một ý đồ đã nêu

Hình được suy ra từ các claim của brief, prompt nêu ý đồ đó được lưu lại, và kết quả được soi về độ dễ
đọc, thứ bậc thị giác và độ trung thành với claim. Một claim brief chưa publish thì không được xuất
hiện, và một hình trượt chính bài soi claim của nó thì không được xuất xưởng. Hình không phải thứ
trang trí dán vào lúc cuối; nó là một trong các claim, được vẽ ra.

## Phê bình phải độc lập

Phần phê bình cuối là một lần thực thi mới trên đúng profile của operator này, không thừa hưởng lượt
nào, và không bao giờ là execution đã tạo ra brief hay bất kỳ bản viết nào. Nó được đưa các artifact
đã sản xuất cùng những khẳng định trong đó, và không nhận lý lẽ của người sản xuất: artifact phải tự
đứng được khi bị đọc.

Nó chấm độ chính xác, sư phạm, giá trị phỏng vấn, ngôn ngữ, và ở những khâu có chạy thì chấm thêm độ
trung thành thị giác, chất lượng code và bằng chứng thực thi. Duyệt đòi mọi điểm áp dụng được đều từ
`85` trở lên và không còn finding lỗi nào mở. Mỗi finding gọi tên đúng một khâu sở hữu, và không
finding nào được gán cho một khâu đã bị tắt.

Một đơn vị qua được lần review của chính tác giả nó thì chưa hề được review. Contract cưỡng chế điều
đó bằng ba lần từ chối riêng biệt: chung execution, thừa kế lượt, và nhận lý lẽ của người sản xuất.

## Trình tự

| # | Bước | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- |
| 1 | Kiểm tra input và resume | input, receipt trước đó, binding source đã đóng băng | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng thẩm quyền | tham chiếu chương trình học và style, source head đã route, cấu hình AI runtime | — | — |
| 3 | Viết và đóng băng brief | chương trình học và bằng chứng nguồn | `briefTargetRef` | `BRIEF_UNBOUND` |
| 4 | Viết mọi bản đã khai | brief đã đóng băng, đích của từng ngôn ngữ | `<language>.articleRef` | `OUTCOME_UNCOVERED` |
| 5 | Sinh hình theo các claim của nó | các claim trong brief, ý đồ hình đã nêu | `imageTargetRef` | `IMAGE_UNAVAILABLE` |
| 6 | Hiện thực mọi track đã khai | brief đã đóng băng, lệnh build chính xác của từng track | `<track>.sourceRef` | `CODE_BUILD_FAILED` |
| 7 | Chạy phần kiểm thực thi | contract thực thi, lệnh đã khai của từng track | — | `E2E_FAILED`, `CONTRACT_WEAKENED` |
| 8 | Nhận bản phê bình độc lập | mọi artifact đã sản xuất và những khẳng định trong đó | `reviewTargetRef` | `REVIEW_REVISION_REQUIRED`, `REVIEW_ROUNDS_EXHAUSTED` |
| 9 | Phát ra và dừng | tất cả những gì ở trên | — | — |

Khâu kiểm tra từ chối binding source đã cũ, một ngôn ngữ không có đích, một phần kiểm thực thi không
có code đứng sau, một hình thiếu prompt của nó, một lần refactor không có unit, brief và đích phê bình
trùng nhau, và tiến độ không đổi.

Brief là một execution mới tinh không thừa kế lượt nào: nó publish outcome, claim, ví dụ và các
disposition, rồi được lấy fingerprint để không gì phía sau mở rộng thêm được. Mỗi bản viết phủ trọn bộ
outcome đã publish và ghi lại execution của chính nó. Bước hình lưu lại prompt nêu ý đồ cùng với kết
quả, chép kết quả sang đích của nó rồi soi lại; một khâu bị tắt thì không sinh ra gì và được ghi là đã
tắt. Mỗi track dựng cùng một hành vi chung, viết đúng lối của từng ngôn ngữ, với mã thoát được đọc chứ
không được đoán.

Phần kiểm thực thi lấy fingerprint của contract trước lần chạy đầu và lấy lại sau lần chạy cuối, và
bên trong vòng chạy-đọc-sửa có chặn số vòng, nó chỉ được sửa phần hiện thực hoặc harness. Bản phê bình
là một lần thực thi mới trên đúng profile của operator này, không thừa hưởng lượt nào, được đưa mọi
artifact đã sản xuất cùng những khẳng định trong đó, không bao giờ được đưa lý lẽ của người sản xuất;
nó trả về điểm số, các finding gán cho khâu sở hữu, và một phán quyết. Khâu phát ra ghi receipt dưới
`input.project.artifactRootRef`, trả đúng một output hợp với `output.schema.json`, ràng mọi
fingerprint, và không khẳng định việc publish, không khẳng định kết quả học tập ngoài thực tế, cũng
không khẳng định sự chấp nhận nào vượt quá các lần kiểm đã thật sự chạy.

## Thực thi khi resume

Một lần resume bắt đầu lại từ validate, chỉ tái dùng những quan sát có fingerprint không đổi, và tiêu
thụ đúng phần delta. Resume không thêm thay đổi nào về curriculum, source, finding hay phạm vi thì trả
về `NO_PROGRESS`. Brief đã sửa phải đến dưới một fingerprint mới; cùng một fingerprint không thể cho
ra câu trả lời khác.

## Các đòn tấn công bắt buộc

Đơn vị không được báo cáo là đã dựng xong khi còn bất kỳ mục nào áp dụng được mà chưa giải quyết:

- một bản viết khai một outcome mà brief chưa bao giờ publish;
- một bản ngôn ngữ đã khai để hở một outcome đã publish;
- một hình mã hoá claim brief chưa publish, hoặc trượt chính bài soi của nó;
- một track chưa từng được build, hoặc build ra exit code khác không;
- một track đã khai chưa bao giờ bị kiểm tra thực thi đụng tới, hoặc một lần chạy ra exit code khác
  không;
- fingerprint contract thực thi bị dịch chuyển trong vòng lặp sửa;
- phê bình đã nhận lý lẽ của tác giả hoặc thừa hưởng lượt hội thoại;
- một artifact được xuất xưởng mà phê bình chưa từng nhận;
- một điểm nằm dưới `85`, hoặc một finding lỗi còn mở, trong khi phán quyết ghi là đã duyệt.
