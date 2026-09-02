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

Phần phê bình cuối chạy như một execution mới tinh không thừa kế lượt nào, và không được là execution
đã tạo ra brief hay bất kỳ bản viết nào. Nó nhận mọi artifact đã sản xuất và không nhận lý lẽ của
người sản xuất: artifact phải tự đứng được khi bị đọc.

Nó chấm độ chính xác, sư phạm, giá trị phỏng vấn, ngôn ngữ, và ở những khâu có chạy thì chấm thêm độ
trung thành thị giác, chất lượng code và bằng chứng thực thi. Duyệt đòi mọi điểm áp dụng được đều từ
`85` trở lên và không còn finding lỗi nào mở. Mỗi finding gọi tên đúng một khâu sở hữu, và không
finding nào được gán cho một khâu đã bị tắt.

Một đơn vị qua được lần review của chính tác giả nó thì chưa hề được review. Contract cưỡng chế điều
đó bằng ba lần từ chối riêng biệt: chung execution, thừa kế lượt, và nhận lý lẽ của người sản xuất.

## Trình tự thực thi

1. **Validate input và resume.** Áp `input.schema.json` cùng validate ngữ nghĩa. Từ chối binding
   source cũ, ngôn ngữ không có đích, kiểm tra thực thi mà không có code phía sau, hình mà không có
   prompt, refactor mà không gọi tên đơn vị, brief và phê bình dùng chung một target, và tiến độ
   không đổi.
2. **Bind authority.** Bind các tham chiếu curriculum và style, source head đã route, và cấu hình AI
   runtime kèm fingerprint của nó.
3. **Viết và đóng băng brief.** Một execution người dạy mới tinh. Publish outcome, claim, ví dụ và
   quyết định, rồi lấy fingerprint của brief. Không khâu nào phía sau được nới nó ra.
4. **Viết mọi bản ngôn ngữ đã khai.** Mỗi ngôn ngữ một bản, mỗi bản phủ trọn tập outcome đã publish,
   mỗi bản ghi lại execution của chính nó.
5. **Tạo hình theo các claim của nó.** Lưu prompt, chép kết quả về đích của nó, rồi soi lại. Khâu bị
   tắt thì không tạo ra gì và được ghi nhận là đã tắt.
6. **Hiện thực mọi track đã khai.** Một hành vi chung, viết đúng lối của từng ngôn ngữ, build bằng
   đúng lệnh đã khai và đọc exit code.
7. **Chạy kiểm tra thực thi.** Lấy fingerprint contract, chạy lệnh của từng track, chỉ sửa phần hiện
   thực hoặc harness trong giới hạn số vòng, rồi lấy lại fingerprint contract.
8. **Nhận phê bình độc lập.** Một execution phán mới tinh, được đưa mọi artifact và không được đưa lý
   lẽ nào, trả về điểm, các finding gán cho khâu sở hữu, và đúng một phán quyết.
9. **Phát ra rồi dừng.** Ghi receipt dưới `input.project.artifactRootRef`, phát đúng một output theo
   `output.schema.json`, và ràng mọi fingerprint. Không claim đã publish, không claim kết quả học tập
   ngoài đời, không claim nghiệm thu vượt quá những kiểm tra đã thật sự chạy.

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
- phê bình dùng chung execution với người sản xuất, thừa kế lượt, hoặc được đưa lý lẽ của người sản
  xuất;
- một artifact được xuất xưởng mà phê bình chưa từng nhận;
- một điểm nằm dưới `85`, hoặc một finding lỗi còn mở, trong khi phán quyết ghi là đã duyệt.
