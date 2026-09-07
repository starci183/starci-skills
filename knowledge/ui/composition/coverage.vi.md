# Coverage composition

File này trả lời đúng một câu hỏi: đặc tả thiết kế được chọn phải liệt kê ra những gì, để một operator
về sau chạy được đúng direction đó thay vì phải đoán.

Mọi chủ đề composition khác ràng buộc từng quyết định một. Chủ đề này ràng buộc cả đặc tả, gộp
năm rule phạm vi riêng của từng chủ đề vào đây. Đã nghỉ: `ACTION-4`, `STATE-4`, `FEEDBACK-4`, `LAYOUT-5` và `RESPONSIVE-5` đã nghỉ, gộp vào rule này, số của chúng không bao giờ dùng lại.
Phần liệt kê đó đáng giá tới đâu lại được quyết ở chỗ khác: bố cục và gu thẩm mỹ đến từ idiom và
playbook trong [snapshot family áp dụng](../../grammars/INDEX.vi.md), đối chiếu source hiện tại, còn rule này chỉ khẳng định rằng đặc tả đã nói đủ để
bất kỳ ai cũng kiểm được.

## COVERAGE-1 — Đặc tả phải liệt kê những gì

Chi phối phạm vi được khai trong Markdown hoặc extension có namespace của node thiết kế `.work` đã chọn.
Các nhóm dưới đây mô tả thông tin, không phải key metadata core bổ sung hay schema biên nhận riêng.
Khai các nhóm áp dụng thành assertion rõ ràng của node trước khi kiểm chứng.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Direction giao bất kỳ action nào | danh mục action không rỗng, và mỗi mục gọi tên đường chuột, đường bàn phím, cùng mọi state có tên chạm tới được của action đó, gồm enabled, disabled, pending và đã kết thúc, nên không đường nào và không state nào bị bỏ ngầm |
| Case 2 | Có action nhận việc mà việc không kết thúc ngay | Mọi đường pending trong danh mục action đều gọi tên điểm kết thúc của nó, kể cả huỷ; không mục nào khai một đường pending mà thiếu điểm kết thúc |
| Case 3 | Direction khai báo các vùng | danh mục vùng không rỗng và phủ hết mọi mục trong mô hình vùng đã khai, và mỗi mục gọi tên một idiom trong playbook family được chọn, đã kiểm tra source cài thực tế cùng một composition công khai; không vùng nào phân giải về một cách sắp xếp trần |
| Case 4 | Composition đổi hình dạng khi không gian đổi | danh mục responsive không rỗng và mỗi nhánh gọi tên đúng một owner, là một container query công khai hoặc một viewport query công khai; không nhánh nào gọi tên thiết bị và không nhánh nào gọi tên hai owner |
| Case 5 | Tính năng có hơn một điều kiện | danh mục state không rỗng, mỗi mục gọi tên ý nghĩa trước rồi mới tới carrier, và không carrier nào đứng cho hai ý nghĩa |
| Case 7 | Direction được quyết | lớp bề mặt được chọn nêu đúng một trong `console`, `form`, `landing`, `catalog` và `reader`. Năm cái tên ấy là một bộ từ vựng và không mang con số nào: mọi ngưỡng theo dải sống trong chính topic proof sở hữu phép đo, nên tên lớp là cách các topic thống nhất với nhau xem đang nhìn bề mặt loại nào. Một đặc tả không nêu lớp, hoặc nêu một tên ngoài năm cái, để mọi rule có dải không có ngưỡng và bề mặt không phán quyết được |
| Case 6 | Một family hoặc ứng dụng thêm delta lên trên một owner công khai | Từng tầng được liệt kê riêng, để một hiệu ứng bị nhân đôi, một state selected bị mất, một trigger gọn bị mất hay một thông báo bị lặp đều quy được về đúng tầng gây ra nó |

Không phải rule này: việc đo đạc, chạy mẫu và đếm thông báo là công việc của operator audit; rule
này chỉ cố định điều mà đặc tả đã hứa.

## File này không quyết định

Trang có những vùng nào và ai sở hữu track thuộc [Layout](layout.vi.md), còn nhánh nào sống sót qua
reflow thuộc [Responsive](responsive.vi.md). Có những điều kiện nào và carrier nào giữ từng cái
thuộc [State](state.vi.md). Một lần kích hoạt làm gì thuộc [Action](action.vi.md), và người đọc được
nói gì ở mỗi kết cục thuộc [Feedback](feedback.vi.md). Những đường đã liệt kê có đứng vững sau khi
render không thuộc [Focus](../proof/focus.vi.md), [Accessibility](../proof/accessibility.vi.md) và
[Render truth](../proof/render-truth.vi.md).
