# Motion proof

File này trả lời đúng một câu hỏi: nếu chuyển động dừng lại, bị cắt ngang, hoặc chưa từng được phép
chạy, người đọc có còn biết mọi điều mà trang đang nói với họ không.

Chuyển động luôn chỉ là phần bổ trợ. Một trang đã render được xét ở khung hình mà không gì đang
chuyển động, và ở khung hình mà animation bị cắt ngang giữa chừng. Mỗi rule dưới đây gọi tên quan
sát nào sẽ bác bỏ nó.

## MOTION-1 — Ý nghĩa tồn tại mà không cần chuyển động

Chi phối việc có ý nghĩa thiết yếu nào chỉ do chuyển động mang hay không.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Việc đã nhận đang chạy | Câu lệnh khởi động vẫn hiện tên, vẫn để lộ trạng thái bận và vẫn từ chối lần kích hoạt thứ hai trong một khung hình tĩnh. Một spinner là dấu hiệu duy nhất cho thấy có việc đang chạy sẽ bác bỏ nó |
| Case 2 | Một state vừa đổi | Có một carrier bền giữ nó: chữ ổn định, native state, một giá trị điều khiển, geometry, hoặc một quan hệ công khai. Một hiệu ứng nhấp nháy là dấu hiệu selected duy nhất sẽ bác bỏ nó |
| Case 3 | Animation bị tắt hoàn toàn | Vẫn đọc ra đúng ý nghĩa đó. Thứ gì biến mất cùng animation thì vốn chưa từng được mang |
| Case 4 | Nội dung đang chạy ra ngoài | Khi đã bị ẩn, nó không để lại điểm dừng focus và không để lại node trợ năng. Một link đang thoát bị ẩn nhưng vẫn focus được sẽ bác bỏ nó |
| Case 5 | Bằng chứng duy nhất là một bản ghi có chuyển động | Không khép được gì. Khung hình tĩnh và kết cục khi bị cắt ngang vẫn chưa biết |

## MOTION-2 — Tuỳ chọn đổi cách dàn dựng, không đổi kết quả

Chi phối những gì mà tuỳ chọn reduced motion được phép thay đổi.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Tuỳ chọn hệ thống hoặc chế độ motion công khai thay đổi | Trigger, nội dung, landmark, thứ tự focus và geometry cuối giống hệt trước và sau. Nội dung thu gọn khác đi ở nhánh reduced sẽ bác bỏ nó |
| Case 2 | Một rail công bố `motion` là `static`, `animated` hoặc `reduced` | Thuộc tính có mặt, nhưng CSS công khai chỉ đổi hành vi cuộn có animation và không hiện thực một transition thu gọn rail. Khẳng định có dàn dựng chỉ dựa vào tên prop sẽ bác bỏ kết luận |
| Case 3 | Thật sự cần dàn dựng thu gọn rail dùng lại được | Chưa đường công khai nào cung cấp, nên ghi nhận năng lực còn thiếu thay vì mặc định là có |
| Case 4 | CSS ứng dụng đang tự animate phần thu gọn đó trong lúc chờ | Đó là workaround có theo dõi, có owner và có điều kiện gỡ bỏ, không phải một hợp đồng mới |
| Case 5 | Một family cấp phần dàn dựng trong phạm vi của nó | Nó cấp kèm một nhánh reduced tương đương, kết thúc ở cùng một trạng thái cuối |

## MOTION-3 — Thời lượng đến từ owner đã công bố nó

Chi phối việc duration, delay và easing được đọc từ đâu.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Một transition chạy trên phần tử công khai, như tooltip, phản hồi toàn card hay animation highlight trang trí | Duration, delay và easing tính được khớp với rule thật sự thắng trong bản render hiện tại, không khớp với một chuỗi trong source hay một biến dự phòng |
| Case 2 | Một family thêm thời lượng của riêng nó | Nó ở trong phạm vi `data-grammar-family` của mình. Thời lượng xuất hiện ở một cây không liên quan sẽ bác bỏ phạm vi đó |
| Case 3 | Ứng dụng đặt duration lên phần anatomy công khai | Đó là với qua một owner mà nó không có. Ứng dụng quyết định khi nào state đổi, không bao giờ quyết định renderer dàn dựng ra sao |
| Case 4 | Một giá trị thời lượng công khai được trích từ source | Phải đo lại trong family đang chọn rồi mới tin, vì family đang chọn có thể đã thay nó |

## MOTION-4 — Bằng chứng chuyển động và thứ bác bỏ nó

Chi phối những gì khép lại một tuyên bố về chuyển động.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Đang khép lại bất kỳ chuyển động nào chạm tới được | Chạy đủ các đường bình thường, reduced, bị cắt ngang, đảo chiều, chuyển nền rồi quay lại, zoom và responsive |
| Case 2 | Đang chụp bằng chứng | Ghi cùng lúc owner, trigger, trạng thái trước và cuối, dấu hiệu thay thế, duration, delay và easing tính được, các sự kiện animation, focus, cây accessibility và kết quả đã kết thúc |
| Case 3 | Chuyển động bị cắt ngang giữa chừng | Nó lắng về một trạng thái hợp lệ. Một trạng thái trung gian kẹt lại, hoặc focus bị mất, sẽ bác bỏ nó |
| Case 4 | Có thứ gì nhấp nháy | Nó ở mức tối đa ba lần mỗi giây. Một dấu hiệu khẩn nhấp bốn lần bác bỏ tính an toàn ngay lập tức |
| Case 5 | Một family hoặc ứng dụng thêm delta | Quy trách nhiệm từng tầng độc lập, và một video mượt không kèm bằng chứng về tuỳ chọn và về lúc bị cắt ngang không khép được gì |

## File này không quyết định

Có những state nào và carrier nào giữ từng cái thuộc [State](../composition/state.vi.md), còn action
nào sở hữu pending thuộc [Action](../composition/action.vi.md). Dấu hiệu lúc nghỉ có phân biệt được
mà không cần màu không thuộc [Accent](../composition/accent.vi.md) và
[Accessibility](accessibility.vi.md). Focus có sống sót qua một lần thoát không thuộc
[Focus](focus.vi.md), còn chuyển động có ngụ ý một kết quả chưa ai xác nhận không thuộc
[Render truth](render-truth.vi.md).
