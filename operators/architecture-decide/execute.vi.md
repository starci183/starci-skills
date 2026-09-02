# Thực thi `architecture.decide`

## Một việc duy nhất

Biến một mục tiêu có ranh giới thành một kiến trúc đã quyết: các ranh giới của nó, quyền sở hữu dữ
liệu, và tech stack, được chứng minh trước hiện trạng quan sát được, ít nhất một phương án bị bác, khả
năng tương thích đã kiểm chứng, và một bản phản biện độc lập. Đây là một lần gọi operator tuyến tính.
Nó không gọi operator khác, không điều phối workflow, không tự dừng giữa chừng, và không trả về chỉ dẫn
điều khiển dạng văn xuôi tự do.

Hai mươi chặng của v7 — khoanh phạm vi, thu thập source và bằng chứng, chụp hiện trạng, bind pattern,
mô hình hệ thống, lập và chất vấn ranh giới, mô hình quyền sở hữu dữ liệu, phân tích mâu thuẫn, đóng
khung quyết định, sinh phương án, chất vấn lựa chọn, phản biện độc lập, hiện thực hoá thiết kế, kiểm
tuân thủ, đóng gói handoff, cùng bốn chặng tech-stack khám phá, mô hình, kiểm tương thích và publish —
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

## Trình tự thực thi

1. **Kiểm tra input và resume.** Áp `input.schema.json` và kiểm tra ngữ nghĩa. Từ chối binding source
   đã cũ, thành phần inventory không có bằng chứng, thiếu ý định cố định hay ràng buộc đo được, chính
   sách automatic mà vẫn mang phê duyệt, và tiến độ không đổi.
2. **Quan sát hiện trạng.** Đọc source đã route tại head đã đóng băng và ghi lại các ranh giới đang tồn
   tại hôm nay, mỗi cái kèm trách nhiệm và bằng chứng đứng sau. Không quan sát được là
   `CURRENT_STATE_UNOBSERVED`; lần gọi không đi tiếp bằng trí nhớ.
3. **Bind inventory quan sát được.** Nhận runtime, framework, lưu trữ, giao tiếp, build, triển khai và
   quyền sở hữu vận hành như những sự thật về hôm nay, và không hơn thế.
4. **Đóng khung quyết định.** Phát biểu lại mục tiêu thành một đánh đổi liên ranh giới trên các trục đã
   gọi tên, kèm các ràng buộc đã tách. Mâu thuẫn giữa hai ràng buộc cố định làm lần gọi dừng với
   `CONSTRAINT_CONTRADICTION` thay vì bị lấy trung bình cho qua.
5. **Sinh phương án.** Tạo hai đến bốn phương án khác nhau về chất — khác về quyền sở hữu hoặc cơ chế,
   không phải khác câu chữ — và đánh giá từng cái trên mọi trục đã gọi tên. Render chúng thành một bản
   so sánh HTML kiểm tra được, phơi ra ranh giới, quyền sở hữu, luồng dữ liệu và điều khiển, vận hành
   bình thường, cùng các đường bất lợi áp dụng được.
6. **Mô hình ranh giới và quyền sở hữu dữ liệu.** Nêu trách nhiệm, chủ sở hữu, giao diện của từng ranh
   giới và việc nó có sở hữu dữ liệu hay không. Với mỗi kho, gọi tên ranh giới sở hữu, người ghi, người
   đọc, người di trú, phạm vi giao dịch, sao lưu và phục hồi. Một kho vô chủ là
   `DATA_OWNERSHIP_UNASSIGNED`.
7. **Mô hình và kiểm stack.** Đánh dấu mỗi thành phần là đang có, thêm mới, thay thế hay gỡ bỏ; nêu vai
   trò và loại lý do biện minh đứng sau; và kiểm tương thích trên cả năm trục. Một thành phần giữ lại
   mà chưa kiểm chứng là `COMPATIBILITY_UNVERIFIED`.
8. **Phản biện độc lập.** Một người rà soát khác với tác giả quyết định tấn công *phương án đã chọn*
   dưới lỗi bộ phận, thử lại và tính bất biến khi lặp, tương tranh, trạng thái cũ, xoá, phục hồi, phụ
   thuộc ngoài chết, và quay lui. Mỗi đòn tấn công phải kèm cách xử lý, nếu không lần gọi dừng với
   `CRITIQUE_UNRESOLVED`. Chỉ tấn công các phương án đã bị bác là kể lại quyết định chứ không phải kiểm
   nó.
9. **Chọn.** Với `approval-required`, bind đúng phương án chủ sở hữu đã duyệt; nếu chưa có phê duyệt,
   dừng với `APPROVAL_REQUIRED`. Với `automatic`, bind phương án còn sống sót. Khi vẫn còn nhiều phương
   án ngang sức, dừng với `ALTERNATIVE_CHOICE_REQUIRED` và trả về các ứng viên thay vì tự chọn một.
10. **Đóng băng handoff.** Ghi các bất biến, rủi ro, hợp đồng bị ảnh hưởng, các bước di trú và đường
    quay lui, kỳ vọng chứng minh, và các ẩn số. Handoff gọi tên hợp đồng, không bao giờ gọi tên file
    hiện thực: chọn file là việc của domain kế tiếp, và gọi tên chúng ở đây là lặng lẽ giành lấy việc
    ấy.
11. **Phát ra và dừng.** Ghi artifact dưới `input.project.artifactRootRef`, trả về một output đúng
    `output.schema.json`, và ràng mọi fingerprint. Không khẳng định bằng chứng hiện thực, chất lượng
    hay UAT.

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
- bản phản biện do chính vai quyết định viết ra;
- handoff gọi tên file hiện thực;
- còn một finding mức lỗi đang mở.
