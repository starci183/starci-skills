# Action composition

File này trả lời đúng một câu hỏi: khi người đọc kích hoạt một thứ gì đó thì chính xác chuyện gì xảy
ra, và ai sở hữu chuyện đó.

Quyết định về action đến trước khi có cây DOM, vì chúng chốt số lượng owner và số lượng hiệu ứng.
Một lần kích hoạt chạm tới hai handler, hay một câu lệnh khoác ngữ nghĩa của anchor, đều là lỗi
composition mà không kiểu styling nào về sau sửa được.

## ACTION-1 — Một lần kích hoạt, một hiệu ứng

Chi phối số thứ được phép phản hồi cho một lần bấm.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một lần kích hoạt thay đổi state của ứng dụng | `Button` cho câu lệnh thường, hoặc `TextAction` khi câu lệnh cần đọc như chữ. Một owner `onPress` duy nhất |
| Case 2 | Câu lệnh tham gia vào một form | `Button.type` được chọn có chủ đích, để hành vi submit là cố ý chứ không phải thừa hưởng |
| Case 3 | Direction muốn cả hàng hoặc cả container cũng bấm được | Chọn một owner. Một wrapper bấm được bao quanh câu lệnh công khai tạo ra owner thứ hai và hiệu ứng thứ hai |
| Case 4 | Có listener ở cấp tổ tiên hoặc cấp document nằm trên cùng đường đi | Nó không được trở thành owner thứ hai của cùng lần kích hoạt |

Không phải rule này: bản thân surface có phải là action hay không thuộc STATE-5.

## ACTION-2 — Pending thuộc về kẻ khởi động

Chi phối control nào hiển thị rằng việc đang chạy.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một câu lệnh đã nhận việc và việc chưa xong | `isPending` trên chính câu lệnh đó, giữ nhãn, để lộ trạng thái bận, và từ chối lần kích hoạt thứ hai |
| Case 2 | Việc do action phục hồi bên trong một vùng rỗng hoặc vùng lỗi khởi động | `EmptyNotice.isActionPending`, prop này chuyển tiếp xuống nút mà vùng đó sở hữu |
| Case 3 | Có những control khác đang hiển thị trong lúc việc chạy | Chúng giữ state của riêng mình. Khoá cả trang hay spinner toàn cục không thay thế được |
| Case 4 | Direction bị cám dỗ tráo `isDisabled` vào trong khoảng thời gian đó | Không làm. Disabled nói rằng việc chưa thể bắt đầu; pending nói rằng việc đã bắt đầu rồi |
| Case 5 | Owner cần pending lại không công bố prop pending nào | Ghi nhận gap trước khi viết bất kỳ workaround nào trong ứng dụng |

## ACTION-3 — Hệ quả chọn ngữ nghĩa

Chi phối phần tử native mà người đọc thao tác.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Hệ quả là đi tới một địa chỉ thật | `TextAction` giữ `href` của nó, và vẫn là anchor dù khoác appearance nào |
| Case 2 | Hệ quả là một thay đổi state | `Button` hoặc `TextAction`, với handler thật |
| Case 3 | Direction muốn quan sát một lần follow trước khi nó xảy ra | `TextAction.onFollow` chỉ quan sát; nó không biến một điểm đến thiếu hoặc bịa thành hợp đồng của một câu lệnh |
| Case 4 | Một anchor đang được dùng kèm click handler mà không có điểm đến | Thay bằng owner của câu lệnh. Giả kiểu này bằng kiểu kia không bao giờ là câu trả lời |

## ACTION-4 — Những đường đi mà direction cam kết

Chi phối những gì phần audit sẽ được yêu cầu chạy.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Có bất kỳ action nào được giao | Cả đường chuột lẫn đường bàn phím đều nằm trong phạm vi của nó |
| Case 2 | Action có các trạng thái bị chặn hoặc tạm thời | Gọi tên mọi trạng thái enabled, disabled, pending và đã kết thúc mà chạm tới được |
| Case 3 | Action là một điểm đến | Kết quả điều hướng thật nằm trong phạm vi, không chỉ loại phần tử |
| Case 4 | Một family hoặc ứng dụng thêm delta lên owner công khai | Tách riêng từng tầng, để một hiệu ứng bị nhân đôi quy được về đúng tầng gây ra nó |

Không phải rule này: việc đếm callback và truy vết kết quả điều hướng là công việc của operator
audit.

## File này không quyết định

Action nào xứng đáng được nhấn mạnh và variant của nó hứa gì thuộc [CTA](cta.vi.md). Surface nào tự
nó là một action, và giá trị điều khiển nào bền vững, thuộc [State](state.vi.md). Người đọc được nói
gì sau khi action kết thúc thuộc [Feedback](feedback.vi.md). Mục tiêu sau khi render có tên, có kích
thước và có focus nhìn thấy được không thuộc [Accessibility](../proof/accessibility.vi.md) và
[Focus](../proof/focus.vi.md), còn tuyên bố sinh ra có đúng sự thật không thuộc
[Render truth](../proof/render-truth.vi.md).
