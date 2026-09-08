# Coverage composition

File này trả lời đúng một câu hỏi: receipt của direction phải liệt kê ra những gì, để một operator
về sau chạy được đúng direction đó thay vì phải đoán.

Mọi chủ đề composition khác ràng buộc từng quyết định một. Chủ đề này ràng buộc cả cái receipt, gộp
năm rule phạm vi riêng của từng chủ đề vào đây. Đã nghỉ: `ACTION-4`, `STATE-4`, `FEEDBACK-4`, `LAYOUT-5` và `RESPONSIVE-5` đã nghỉ, gộp vào rule này, số của chúng không bao giờ dùng lại.
Phần liệt kê đó đáng giá tới đâu lại được quyết ở chỗ khác: bố cục và gu thẩm mỹ đến từ idiom và
playbook trong `@knowledge/grammars/<family>`, còn rule này chỉ khẳng định rằng receipt đã nói đủ để
bất kỳ ai cũng kiểm được.

## COVERAGE-1 — Receipt phải liệt kê những gì

Chi phối những trường mà một `frontend-direction-decision.json` đã quyết phải mang trước khi được phát ra.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Direction giao bất kỳ action nào | `coverage.actions[]` không rỗng, và mỗi mục gọi tên đường chuột, đường bàn phím, cùng mọi state có tên chạm tới được của action đó, gồm enabled, disabled, pending và đã kết thúc, nên không đường nào và không state nào bị bỏ ngầm |
| Case 2 | Có action nhận việc mà việc không kết thúc ngay | Mọi đường pending trong `coverage.actions[]` đều gọi tên điểm kết thúc của nó, kể cả huỷ; không mục nào khai một đường pending mà thiếu điểm kết thúc |
| Case 3 | Direction khai báo các vùng | `coverage.regions[]` không rỗng và phủ hết mọi mục trong `regionModel`, và mỗi mục gọi tên một idiom trong `@knowledge/grammars/<family>/playbook.md` cùng một composition công khai; không vùng nào phân giải về một cách sắp xếp trần |
| Case 4 | Composition đổi hình dạng khi không gian đổi | `coverage.responsive[]` không rỗng và mỗi nhánh gọi tên đúng một owner, là một container query công khai hoặc một viewport query công khai; không nhánh nào gọi tên thiết bị và không nhánh nào gọi tên hai owner |
| Case 5 | Tính năng có hơn một điều kiện | `coverage.states[]` không rỗng, mỗi mục gọi tên ý nghĩa trước rồi mới tới carrier, và không carrier nào đứng cho hai ý nghĩa |
| Case 7 | Direction được quyết | `coverage.surfaceClass` nêu đúng một trong `console`, `form`, `landing`, `catalog` và `reader`. Năm cái tên ấy là một bộ từ vựng và không mang con số nào: mọi ngưỡng theo dải sống trong chính topic proof sở hữu phép đo, nên tên lớp là cách các topic thống nhất với nhau xem đang nhìn bề mặt loại nào. Một receipt không nêu lớp, hoặc nêu một tên ngoài năm cái, để mọi rule có dải không có ngưỡng và bề mặt không phán quyết được |
| Case 6 | Một family hoặc ứng dụng thêm delta lên trên một owner công khai | Từng tầng được liệt kê riêng, để một hiệu ứng bị nhân đôi, một state selected bị mất, một trigger gọn bị mất hay một thông báo bị lặp đều quy được về đúng tầng gây ra nó |

Không phải rule này: việc đo đạc, chạy mẫu và đếm thông báo là công việc của operator audit; rule
này chỉ cố định điều mà receipt đã hứa.

## File này không quyết định

Trang có những vùng nào và ai sở hữu track thuộc [Layout](layout.vi.md), còn nhánh nào sống sót qua
reflow thuộc [Responsive](responsive.vi.md). Có những điều kiện nào và carrier nào giữ từng cái
thuộc [State](state.vi.md). Một lần kích hoạt làm gì thuộc [Action](action.vi.md), và người đọc được
nói gì ở mỗi kết cục thuộc [Feedback](feedback.vi.md). Những đường đã liệt kê có đứng vững sau khi
render không thuộc [Focus](../proof/focus.vi.md), [Accessibility](../proof/accessibility.vi.md) và
[Render truth](../proof/render-truth.vi.md).
