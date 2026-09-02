# Thực thi `architecture.decide`

## Một việc duy nhất

Biến một mục tiêu có ranh giới thành một kiến trúc đã quyết: các ranh giới của nó, quyền sở hữu dữ
liệu, và tech stack, được chứng minh trước hiện trạng quan sát được, ít nhất một phương án bị bác, khả
năng tương thích đã kiểm chứng, và một bản phản biện độc lập. Đây là một lần gọi operator tuyến tính.
Nó không gọi operator khác, không điều phối workflow, không tự dừng giữa chừng, và không trả về chỉ dẫn
điều khiển dạng văn xuôi tự do.

Hai mươi chặng của v7 — khoanh phạm vi, thu thập source và bằng chứng, chụp hiện trạng, bind pattern,
mô hình hệ thống, lập và chất vấn ranh giới, mô hình quyền sở hữu dữ liệu, phân tích mâu thuẫn, đóng
khung quyết định, sinh phương án, chọn một phương án, chất vấn và phản biện lựa chọn đó, hiện thực hoá
thiết kế, kiểm tuân thủ, đóng gói handoff, cùng bốn chặng tech-stack khám phá, mô hình, kiểm tương
thích và publish —
là các bước bên trong trình tự dưới đây, không phải các operator riêng.

## Quan sát trước khi đề xuất

Không được đề xuất bất cứ điều gì trước khi hiện trạng đã được quan sát tại source head đã đóng băng,
và quan sát ấy được mang trong receipt cùng fingerprint riêng của nó.

Thứ tự này không phải phép lịch sự với hệ thống cũ. Một đề xuất viết ra trước khi quan sát thì luôn mô
tả một hệ thống đơn giản hơn hệ thống thật, và mọi phép so sánh về sau thừa hưởng nguyên sự giản lược
đó. Một quan sát lấy ở head khác còn tệ hơn, vì nó trông có vẻ nghiêm ngặt trong khi đang mô tả đoạn mã
không còn tồn tại.

## Chứng minh, đừng giả định

Bốn điều cấm gánh quyết định này, và mỗi điều đều được cưỡng chế chứ không chỉ khuyên:

1. **Một phương án hoặc là thật, hoặc không được tính.** Ít nhất một phương án bị bác thật sự kèm lý do
   đã phát biểu, và mọi phương án đều được đánh giá đúng trên các trục mà mục tiêu gọi tên. Hai lựa
   chọn chấm trên các tiêu chí khác nhau thì chưa hề được so sánh.
2. **Sự tồn tại sẵn không phải là lý do.** Một thành phần có thể được biện minh bằng một ràng buộc đo
   được, bằng bằng chứng quan sát được, hoặc bằng độ khớp với yêu cầu. Không bao giờ bằng việc nó đã ở
   đó.
3. **Tương thích được kiểm, không được khẳng định suông.** Mọi thành phần giữ lại đều mang phán quyết
   đã kiểm chứng kèm bằng chứng, trên phiên bản runtime, đơn vị triển khai, lỗi giao tiếp, quyền sở hữu
   kho dữ liệu, và sao lưu cùng phục hồi. Một phán quyết bỏ sót một trục là một lần kiểm dở dang đội
   nhãn hoàn chỉnh.
4. **Mọi ranh giới đều trả lời câu hỏi dữ liệu.** Một ranh giới hoặc sở hữu ít nhất một kho, hoặc phát
   biểu rằng nó không sở hữu kho nào. Một kho gọi tên đúng một ranh giới sở hữu, và ranh giới đó phải
   ghi vào kho; người ghi thứ hai chỉ tồn tại kèm một lời biện minh tường minh.

## Trình tự

| # | Bước | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- |
| 1 | Kiểm tra input và resume | input, `@dynamic/architecture-decision.json`, `@workspaces/be` (binding head đã đóng băng) | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Quan sát hiện trạng | `@workspaces/be` (quan sát tại head đã đóng băng) | `@dynamic/current-state.json` | `CURRENT_STATE_UNOBSERVED` |
| 3 | Ràng inventory quan sát được và thẩm quyền nghiệp vụ | `@dynamic/current-state.json` (các thành phần inventory cùng bằng chứng), `@worktrees/businesses/<featureId>` (head đã publish) | — | `BUSINESS_AUTHORITY_REQUIRED`, `EVIDENCE_MISSING` |
| 4 | Đóng khung quyết định | input (mục tiêu, các trục đánh đổi, các ràng buộc đã tách) | — | `CONSTRAINT_CONTRADICTION` |
| 5 | Sinh phương án | `@dynamic/current-state.json`, `@knowledge/patterns` | `@dynamic/<decisionId>-alternatives.html` | `NO_VIABLE_ALTERNATIVE` |
| 6 | Chọn tạm thời | `@dynamic/<decisionId>-alternatives.html`, input (chính sách chọn, phê duyệt của chủ sở hữu) | — | `CHOICE_REQUIRED` |
| 7 | Đào sâu phương án đã chọn | `@dynamic/<decisionId>-alternatives.html`, `@dynamic/current-state.json` (inventory), input (các ràng buộc) | `@dynamic/stack-model.json` | `DATA_OWNERSHIP_UNASSIGNED`, `COMPATIBILITY_UNVERIFIED` |
| 8 | Phản biện phương án đã chọn | `@dynamic/stack-model.json` (thiết kế đã đào sâu và các khẳng định của nó) | `@dynamic/independent-critique.json` | `CRITIQUE_UNRESOLVED` |
| 9 | Xác nhận lựa chọn | `@dynamic/independent-critique.json`, `@dynamic/stack-model.json` | — | — |
| 10 | Đóng băng handoff | `@dynamic/stack-model.json` (quyết định đã xác nhận) | — | — |
| 11 | Phát ra và dừng | tất cả những gì ở trên | `@dynamic/architecture-decision.json` | — |

Khâu kiểm tra từ chối binding source đã cũ, thành phần inventory không có bằng chứng, thiếu ý định cố
định hay ràng buộc đo được, chính sách automatic mà vẫn mang phê duyệt, và tiến độ không đổi. Không gì
được đề xuất theo trí nhớ: quan sát được đọc tại head đã đóng băng, còn inventory được nhận như sự
thật về hôm nay và không hơn thế. Mâu thuẫn giữa hai ràng buộc cố định làm lần gọi dừng lại, thay vì
bị lấy trung bình cho qua.

Các phương án là hai tới bốn thiết kế khác nhau thực chất — khác ở quyền sở hữu hay cơ chế, không phải
ở cách diễn đạt — mỗi phương án mang phác thảo ranh giới và quyền sở hữu kho của riêng nó, mỗi phương
án được đánh giá trên mọi trục đã gọi tên, và tất cả được render thành một bản so sánh HTML soi được,
phơi ra ranh giới, quyền sở hữu, luồng dữ liệu và điều khiển, vận hành bình thường, cùng các đường bất
lợi áp dụng được. Việc chọn ở đây là tạm thời và rẻ: với `approval-required` nó bind đúng phương án
chủ sở hữu đã duyệt, với `automatic` nó bind phương án duy nhất còn sống sót, và khi nhiều phương án
vẫn ngang sức thì nó trả về các ứng viên thay vì tự chọn một. Chỉ phương án đã chọn mới được đào sâu,
vì đào sâu tất cả là cách một bản so sánh biến thành bốn thiết kế không ai chọn.

Việc đào sâu phát biểu trách nhiệm, chủ sở hữu, giao diện của từng ranh giới và việc nó có sở hữu dữ
liệu hay không; với mỗi kho, nó gọi tên ranh giới sở hữu, những người ghi, người đọc, người di trú,
phạm vi giao dịch, sao lưu và phục hồi; và nó đánh dấu từng thành phần stack là đang có, thêm mới,
thay thế hay bị gỡ, nêu loại biện minh đứng sau, rồi kiểm tương thích trên cả năm trục.

Bản phản biện tấn công *phương án đã chọn* dưới lỗi cục bộ, retry và tính idempotent, đồng thời, trạng
thái cũ, xoá, phục hồi, phụ thuộc chết và rollback; chỉ tấn công các phương án bị bác là phát biểu lại
quyết định chứ không phản biện. Nó là một lần thực thi mới trên đúng profile của operator này, không
thừa hưởng lượt nào, và chỉ được đưa các artifact cùng những khẳng định trong đó, không bao giờ được
đưa lý lẽ của tác giả. Mỗi đòn tấn công mang một cách xử lý, và khâu xác nhận hoặc giữ nguyên lựa chọn
tạm thời, hoặc trả lựa chọn về cho chủ sở hữu. Handoff ghi các bất biến, rủi ro, hợp đồng bị ảnh
hưởng, các bước di trú và rollback, kỳ vọng chứng minh, cùng những ẩn số; nó gọi tên hợp đồng, không
bao giờ gọi tên file hiện thực, vì chọn file là việc của domain kế tiếp và gọi tên ở đây là lặng lẽ
giành lấy việc đó. Khâu phát ra ghi các artifact dưới `input.project.artifactRootRef`, trả đúng một
output hợp với `output.schema.json`, ràng mọi fingerprint, và không khai bất kỳ chứng minh hiện thực,
chất lượng hay UAT nào.

## Thực thi khi resume

Một lần resume bắt đầu lại từ khâu kiểm tra, chỉ tái dùng những quan sát có fingerprint không đổi, và
tiêu thụ đúng phần delta. Một resume không thêm thay đổi nào về bằng chứng, ràng buộc, inventory hay
phê duyệt sẽ trả về `NO_PROGRESS`. Hệ thống quan sát lại phải đến dưới một fingerprint mới; cùng một
fingerprint không thể cho ra câu trả lời khác.

## Các đòn tấn công bắt buộc

Operator không được quyết khi còn bất kỳ mục nào áp dụng mà chưa giải quyết:

- hiện trạng chưa từng được quan sát, hoặc được quan sát ở head khác;
- không phương án nào bị bác thật sự, hoặc các phương án bị chấm trên tiêu chí khác nhau;
- một thành phần được biện minh bằng sự tồn tại sẵn, hoặc khai tương thích mà không bằng chứng nào
  kiểm;
- một ranh giới bỏ ngỏ câu hỏi dữ liệu, hoặc một kho có chủ sở hữu không bao giờ ghi vào nó;
- có người ghi thứ hai mà không có biện minh;
- kiến trúc đã chọn chưa từng bị tấn công dưới một trong tám đường bất lợi;
- bản phản biện đã nhận lý lẽ của tác giả hoặc thừa hưởng lượt hội thoại;
- handoff gọi tên file hiện thực;
- còn một finding mức lỗi đang mở.
