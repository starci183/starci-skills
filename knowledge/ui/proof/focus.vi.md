# Focus proof

File này trả lời đúng một câu hỏi: với người đọc làm việc không dùng con trỏ, focus đang ở đâu, nó
được đi tới đâu, và nó quay về đâu.

Focus chỉ chứng minh được lúc chạy. Một rule `:focus-visible` trong stylesheet không xác lập một chỉ
dấu nhìn thấy được, và một thứ tự DOM đúng không xác lập rằng việc duyệt đã chạm tới mọi điểm dừng.
Mỗi rule dưới đây gọi tên quan sát nào sẽ bác bỏ nó.

## FOCUS-1 — Chỉ dấu nhìn thấy nằm trên đúng mục tiêu

Chi phối việc một thứ đang được focus có trông như đang được focus không.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Focus bàn phím rơi vào một owner công khai tương tác được hoặc cuộn được | Một chỉ dấu xuất hiện trên đúng mục tiêu đó và nhận diện nó rõ ràng. Một phần tử được focus mà không có thay đổi cảm nhận được sẽ bác bỏ nó |
| Case 2 | Chỉ dấu nằm cạnh phần sơn hoặc trên một surface có màu | Nó vẫn phân biệt được ở đó, xét theo computed style hiện tại chứ không phải theo dự định |
| Case 3 | Viewport hẹp lại, trang zoom, hoặc mục tiêu nằm ở mép vùng cuộn | Chỉ dấu không bị overflow của tổ tiên nào cắt mất |
| Case 4 | Ứng dụng hoặc một family sơn đè lên owner công khai | Chỉ dấu vẫn sống sót. Một `outline: none` mà không có thứ thay thế tương đương sẽ bác bỏ nó, và phản hồi hover không thay thế được |
| Case 5 | Focus tới bằng con trỏ chứ không bằng bàn phím | Chỉ dấu chỉ xuất hiện ở nơi treatment công khai chủ đích, nhờ vậy sự hiện diện của nó vẫn còn ý nghĩa |

## FOCUS-2 — Thứ tự tuần tự bằng đúng thứ tự nhiệm vụ

Chi phối đường mà focus đi qua một composite.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Tabs, disclosure, các mục navigation ngang hàng hoặc vùng cuộn tạo ra nhiều điểm dừng | Thứ tự nhìn thấy, thứ tự DOM và thứ tự focus tuần tự khớp với phụ thuộc nhiệm vụ. Một lần đảo thị giác mà bỏ focus lại phía sau sẽ bác bỏ nó |
| Case 2 | Composite có công bố hành vi phím mũi tên | Việc duyệt chạm tới mọi mục ngang hàng đang bật và bỏ qua thứ bị vô hiệu hoặc bị ẩn. Focus mũi tên rơi vào một tab bị vô hiệu sẽ bác bỏ nó |
| Case 3 | Duyệt theo chiều ngược lại | Thứ tự ngược soi gương thứ tự xuôi, và không điểm dừng nào chỉ chạm tới được theo một chiều |
| Case 4 | Các mục ngang hàng tràn khỏi container, hoặc bố cục chảy lại ở bề rộng hẹp hơn | Mọi mục vẫn chạm tới được, và focus vào một mục sẽ kéo nó vào tầm nhìn |
| Case 5 | Ứng dụng đặt thứ tự tab tường minh | Một tab index dương đẩy một action về sau lên trước các field bắt buộc sẽ bác bỏ thứ tự; thứ đáng lẽ phải đổi là thứ tự nguồn |

## FOCUS-3 — Giam giữ đi theo tính modal

Chi phối việc focus được đi xa tới đâu khi một vùng đang mở.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Một vùng modal mở lên trên nhiệm vụ hiện tại | Focus đi vào dialog, ở lại bên trong, chạm tới một đường đóng tường minh và phản hồi Escape. Focus thoát ra trang phía sau sẽ bác bỏ việc giam giữ |
| Case 2 | Modal đóng lại | Focus quay về đúng control đã mở nó. Quay về document body sẽ bác bỏ việc khôi phục |
| Case 3 | Rail hội thoại dạng gọn chính là modal đang xét | `ChatWorkspace` sở hữu vòng đời đó qua `isRailOpen` và `onRailOpenChange`; chuỗi focus lúc chạy phải được quan sát chứ không suy ra từ tên vendor đứng sau |
| Case 4 | Một vùng không modal xuất hiện bên cạnh nhiệm vụ | Focus ra vào tự do. Một vùng không modal mà giam focus sẽ bác bỏ nó |
| Case 5 | Cần một modal dùng lại được khác mà chưa owner công khai nào hợp | Ghi nhận gap. Bộ máy focus cục bộ của ứng dụng là workaround có theo dõi, không bao giờ được trình bày như hợp đồng |

## FOCUS-4 — Bằng chứng focus và thứ bác bỏ nó

Chi phối những gì khép lại một tuyên bố về focus.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Đang khép lại bất kỳ tuyên bố nào về focus | Chụp cùng lúc phần tử active, chỉ dấu nhìn thấy, computed style, thứ tự DOM, hình chữ nhật mục tiêu và cây accessibility. Một ảnh chụp màn hình không kèm vết phần tử active không khép được gì |
| Case 2 | Một nhánh vắng mặt có điều kiện | Nó không đóng góp điểm dừng focus nào. Một control bị ẩn thị giác mà vẫn nằm trong chuỗi sẽ bác bỏ sự vắng mặt đó |
| Case 3 | Một control bị vô hiệu hoặc không dùng được | Focus hành xử đúng như owner công khai chủ đích, và kích hoạt không sinh ra hiệu ứng nào |
| Case 4 | Trang được zoom hoặc chảy lại | Chạy lại mọi đường ở trên tại đó, vì một vòng focus vừa ở bề rộng này có thể bị cắt ở bề rộng khác |
| Case 5 | Một family hoặc ứng dụng thêm delta | Tách đầu ra công khai cô lập, delta của family và delta của ứng dụng, để gọi tên được tầng đang hỏng |

## FOCUS-5 — Con trỏ và bàn phím đi tới cùng một kết quả

Chi phối sự ngang bằng giữa hai phương thức nhập trên mọi owner tương tác.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Một action toàn surface, một tab hoặc một disclosure được chạy thử | Con trỏ và bàn phím cho ra cùng một kết quả sản phẩm. Một action chỉ dùng được bằng con trỏ sẽ bác bỏ sự ngang bằng |
| Case 2 | Một lần kích hoạt được thực hiện bằng một trong hai đường | Nó sinh ra nhiều nhất một hiệu ứng được chấp nhận. Hai callback cho một lần nhấn phím sẽ bác bỏ owner đó |
| Case 3 | Các mục tiêu nằm sát hoặc chồng lên nhau | Hình chữ nhật của chúng không va nhau, và không control độc lập nào nấp sau overlay của một action toàn surface |
| Case 4 | Một action bắt buộc chỉ lộ ra khi hover | Điều đó bác bỏ nó. Một action bắt buộc không bao giờ chỉ có ở hover |
| Case 5 | Các đường được chạy qua trạng thái mặc định, selected, expanded, disabled, pending và vắng mặt | Mỗi trạng thái được chạy bằng cả hai đường, và một lượt bấm chuột trên desktop không khép được gì |

## File này không quyết định

Nhiệm vụ đòi thứ tự đọc nào thuộc [Hierarchy](../composition/hierarchy.vi.md), surface nào tương tác
và giá trị nào bền vững thuộc [State](../composition/state.vi.md), còn một lần kích hoạt chạm tới
hiệu ứng nào thuộc [Action](../composition/action.vi.md). Tên, quan hệ và kích thước mục tiêu thuộc
[Accessibility](accessibility.vi.md); chuyển động và sự tương đương ở chế độ reduced motion thuộc
[Motion](motion.vi.md).
