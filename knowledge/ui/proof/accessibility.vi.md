# Accessibility proof

File này trả lời đúng một câu hỏi: trong cây đã thật sự render, mọi người đọc có cảm nhận và thao
tác được thứ mà direction đã định không.

Không điều gì ở đây được chốt bằng cách đọc source. Một prop trong source là một ý định; cái tên khả
truy cập tính ra từ node đã render mới là bằng chứng. Mỗi rule dưới đây nêu quan sát nào sẽ bác bỏ
nó, để một kết luận đạt luôn gọi tên được thứ đã thật sự được nhìn.

## A11Y-1 — Tên và quan hệ của field

Chi phối việc danh tính của một field và phần hướng dẫn hiện hành của nó có tới được đầu ra trợ năng
hay không.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Một field render kèm nhãn nhìn thấy được | Tên khả truy cập tính ra bằng đúng nhãn nhìn thấy. Một cái tên chỉ do placeholder cấp, hoặc một field không có tên nào, sẽ bác bỏ nó |
| Case 2 | Field có hint, có lỗi, hoặc có cả hai | Thông điệp được gắn về input đó theo cách máy đọc được, và phần chữ là bản hiện hành. Một thông điệp nhìn thấy được nhưng không gắn với control nào sẽ bác bỏ nó |
| Case 3 | Field đang ở trạng thái bắt buộc, không hợp lệ hoặc bị vô hiệu | Ngữ nghĩa đã render khớp với dữ kiện business hiện tại. Một viền đỏ mà không có ngữ nghĩa không hợp lệ sẽ bác bỏ nó |
| Case 4 | Người đọc gõ và validation chạy lại | Giá trị đã nhập sống sót qua lần đổi state, và phần mô tả là bản mới chứ không phải một thông điệp cũ |

Không phải rule này: lỗi đó ban đầu có được đặt đúng owner hay không là quyết định của composition,
ở FEEDBACK-1.

## A11Y-2 — Câu lệnh chỉ có glyph vẫn phải có tên

Chi phối những câu lệnh mà phần nhìn thấy chỉ là một glyph.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | `IconButton` render một câu lệnh chỉ có glyph | Vai trò button mang một tên khả truy cập bằng đúng `label` của nó. Một tooltip là lời giải thích duy nhất sẽ bác bỏ nó |
| Case 2 | Nút chứa một glyph dẫn đầu mang tính trang trí | Glyph bên trong bị ẩn khỏi đầu ra trợ năng. Cùng một cái tên tính ra hai lần, một trên nút và một trên icon, sẽ bác bỏ nó |
| Case 3 | Một glyph đứng riêng và tự nó mang nghĩa | `Icon.ariaLabel` cho ra vai trò image với tên đó. Một glyph mang nghĩa mà bị ẩn đi sẽ bác bỏ nó |
| Case 4 | Câu lệnh có thể bị vô hiệu | Kích hoạt bằng bàn phím chạm tới nó khi bật, và không sinh ra gì khi bị vô hiệu |

## A11Y-3 — Phép đo phải có danh tính khả truy cập

Chi phối những con số được render thành thanh.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Một phép đo đã giải quyết được render | Progressbar để lộ tên khả truy cập bằng đúng label, giá trị hiện tại, tối thiểu `0` và tối đa `100`, và giá trị đó bằng đúng dữ kiện sản phẩm |
| Case 2 | Giá trị chưa giải quyết | Skeleton render hình khối bị ẩn khỏi trợ năng, không có progressbar và không có label. Một progressbar có tên đọc lên số không sẽ bác bỏ nó |
| Case 3 | `value` bị bỏ trống trong lúc dữ liệu chưa biết | Nhánh không phải skeleton lấy giá trị mặc định, nên đầu ra render đọc lên `0`, và điều đó bác bỏ tuyên bố rằng giá trị chưa biết |
| Case 4 | Một thanh trang trí nằm cạnh phép đo | Nó không mang vai trò progressbar. Hai phép đo được đọc lên cho một dữ kiện sẽ bác bỏ cả vùng |

## A11Y-4 — Cảm nhận được và thao tác được ở mọi state bắt buộc

Chi phối bằng chứng khép lại một tuyên bố về trợ năng.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Một mục tiêu phải thao tác được bằng chạm | Trigger của accordion và các control bên trong rail đo được ít nhất `44px × 44px` trong bản render hiện tại. Mọi mục tiêu khác cần bằng chứng hợp đồng riêng trước khi khẳng định một mức tối thiểu |
| Case 2 | Nhiệm vụ được thực hiện chỉ bằng bàn phím | Mọi control bắt buộc đều chạm tới và thao tác được. Một control bắt buộc không chạm tới được sẽ bác bỏ cả trang |
| Case 3 | Trang được xem ở forced colors, ở mức tương phản giảm, hoặc đã bỏ màu | Mọi khác biệt về state, selection và focus vẫn sống sót. Một khác biệt chỉ dựa vào phần tô sẽ bác bỏ nó |
| Case 4 | Trang được zoom, chữ được phóng, hoặc viewport hẹp lại | Không nội dung bắt buộc nào và không chỉ dấu focus nào bị cắt |
| Case 5 | Một family hoặc ứng dụng sơn đè lên owner công khai | So sánh riêng đầu ra công khai cô lập, delta của family và delta của ứng dụng, để gọi tên được tầng đang hỏng |

Không phải rule này: đáng lẽ phải chọn semantic owner nào là quyết định của composition, ở
HIERARCHY-1 và STATE-1.

## File này không quyết định

Direction đã chọn cấp độ, action hay state nào thuộc [Hierarchy](../composition/hierarchy.vi.md),
[Action](../composition/action.vi.md) và [State](../composition/state.vi.md). Chỉ dấu focus nằm ở
đâu và focus được đi xa tới đâu thuộc [Focus](focus.vi.md). Chuyển động có làm mất ý nghĩa không
thuộc [Motion](motion.vi.md), còn tuyên bố đã render có khớp authority không thuộc
[Render truth](render-truth.vi.md).
