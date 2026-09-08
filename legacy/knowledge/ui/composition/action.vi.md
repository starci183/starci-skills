# Action composition

File này trả lời đúng một câu hỏi: khi người đọc kích hoạt một thứ gì đó thì chính xác chuyện gì xảy
ra, và ai sở hữu chuyện đó.

Quyết định về action đến trước khi có cây DOM, vì chúng chốt số lượng owner và số lượng hiệu ứng.
Một lần kích hoạt chạm tới hai handler, hay một câu lệnh khoác ngữ nghĩa của anchor, đều là lỗi
composition mà không kiểu styling nào về sau sửa được.

## ACTION-1 — Một lần kích hoạt, một hiệu ứng

Chi phối số thứ được phép phản hồi cho một lần bấm.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một lần kích hoạt thay đổi state của ứng dụng | Đúng một node sở hữu hiệu ứng, và node đó là `Button`, hoặc `TextAction` khi câu lệnh cần đọc như chữ; không node thứ hai nào mang `onPress` cho cùng lần kích hoạt |
| Case 2 | Câu lệnh tham gia vào một form | Receipt gọi tên `Button.type` đã chọn, nên hành vi submit được nêu ra chứ không thừa hưởng từ form bao ngoài |
| Case 3 | Direction muốn cả hàng hoặc cả container cũng bấm được | Receipt gọi tên đúng một owner cho lần kích hoạt đó; không wrapper bấm được nào bọc quanh một câu lệnh công khai đang giữ cùng hiệu ứng |
| Case 4 | Có listener ở cấp tổ tiên hoặc cấp document nằm trên cùng đường đi | Không listener tổ tiên hay listener cấp document nào trên đường đi đó phản hồi cùng lần kích hoạt |

Không phải rule này: bản thân surface có phải là action hay không thuộc STATE-5.

## ACTION-2 — Pending thuộc về kẻ khởi động

Chi phối control nào hiển thị rằng việc đang chạy.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một câu lệnh đã nhận việc và việc chưa xong | Node đã khởi động việc mang `isPending`; nhãn của nó không đổi, trạng thái bận được để lộ, và lần kích hoạt thứ hai bị từ chối |
| Case 2 | Việc do action phục hồi bên trong một vùng rỗng hoặc vùng lỗi khởi động | `EmptyNotice.isActionPending` mang nó, và prop đó phân giải về đúng nút mà vùng đó sở hữu |
| Case 3 | Có những control khác đang hiển thị trong lúc việc chạy | Không node nào khác đổi state vì việc đó, và không khoá toàn trang hay spinner toàn cục nào đứng thay cho pending của kẻ khởi động |
| Case 4 | Direction bị cám dỗ tráo `isDisabled` vào trong khoảng thời gian đó | Receipt gắn `isPending` chứ không phải `isDisabled` cho việc đã nhận; disabled chỉ xuất hiện ở nơi việc chưa thể bắt đầu |
| Case 5 | Owner cần pending lại không công bố prop pending nào | Trong receipt có một gap `GRAMMAR_REQUIRED` gọi tên owner đó, và không có thứ thay thế pending cấp ứng dụng nào trong cây |

## ACTION-3 — Hệ quả chọn ngữ nghĩa

Chi phối phần tử native mà người đọc thao tác.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Hệ quả là đi tới một địa chỉ thật | Node giữ `TextAction` cùng `href` của nó và vẫn là anchor dưới mọi appearance được khoác lên |
| Case 2 | Hệ quả là một thay đổi state | Node là `Button` hoặc `TextAction` và mang handler thật, không mang điểm đến |
| Case 3 | Direction muốn quan sát một lần follow trước khi nó xảy ra | `TextAction.onFollow` chỉ có mặt với vai trò quan sát; node vẫn mang một điểm đến thật |
| Case 4 | Một anchor đang được dùng kèm click handler mà không có điểm đến | Không node nào như vậy tồn tại trong cây; owner của câu lệnh mang hiệu ứng thay cho nó |

Retired: ACTION-4 đã nghỉ, gộp vào COVERAGE-1, và số này không được dùng lại; địa chỉ đó coi như đã tiêu.

## File này không quyết định

Action nào xứng đáng được nhấn mạnh và variant của nó hứa gì thuộc [CTA](cta.vi.md). Surface nào tự
nó là một action, và giá trị điều khiển nào bền vững, thuộc [State](state.vi.md). Người đọc được nói
gì sau khi action kết thúc thuộc [Feedback](feedback.vi.md). Receipt phải liệt kê những gì về các
action này thuộc [Coverage](coverage.vi.md). Mục tiêu sau khi render có tên, có kích thước và có
focus nhìn thấy được không thuộc [Accessibility](../proof/accessibility.vi.md) và
[Focus](../proof/focus.vi.md), còn tuyên bố sinh ra có đúng sự thật không thuộc
[Render truth](../proof/render-truth.vi.md).
