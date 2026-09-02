# Responsive composition

File này trả lời đúng một câu hỏi: khi không gian dành cho một nhiệm vụ thay đổi, cái gì phải sống
sót, và query công khai nào sở hữu thay đổi đó.

Quyết định responsive được đưa ra trước khi có DOM, vì chúng là quyết định về việc vùng nào tái bố
cục, nhánh nào biến mất, và sau đó người đọc vẫn phải làm được gì. Một cái tên thiết bị không bao
giờ là câu trả lời ở đây; câu trả lời luôn là một query có tên trên một owner có tên.

## RESPONSIVE-1 — Cái gì sống sót khi không gian co lại

Chi phối mức sàn mà bố cục hẹp phải giữ.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một nhiệm vụ phải lọt vào không gian nhỏ hơn hẳn | Một luồng hẹp đọc được vẫn giữ ý nghĩa bắt buộc, action chính và trạng thái hiện tại; phần bổ trợ vẫn chạm tới được |
| Case 2 | Nội dung sẽ khiến cả trang phải cuộn ngang | Composition tái bố cục, thay vì cắt xén, bóp lại hay để trang tràn theo trục inline |
| Case 3 | Một nhánh bị ẩn đi trong không gian hẹp | Nó vắng mặt thật sự, và thay vào đó là một trigger có state điều khiển được, có đường trả focus và có lối phục hồi |
| Case 4 | Muốn có các vùng song song ở bề rộng lớn hơn | Chỉ thêm ở nơi một composition công khai đã cung cấp sẵn chế độ đó |
| Case 5 | Hành vi hẹp cần dùng chưa có composition công khai nào | Direction ghi nhận hành vi dùng lại được đang thiếu, thay vì tự dựng một breakpoint song song |

## RESPONSIVE-2 — Gọi tên owner của query, không gọi tên thiết bị

Chi phối việc không gian nào thật sự đang được quan sát.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một cột chính nằm cạnh một rail | Owner là container query có tên của `PrimaryRailLayout` ở inline-size `56rem`, nên một container hẹp vẫn xếp chồng ngay cả trong cửa sổ rộng |
| Case 2 | Các vùng shell tái bố cục | `WorkspaceShell` trộn container query có tên ở `72rem` và `56rem` với một rule theo viewport ở `69.999rem`; mỗi cái được gọi tên riêng |
| Case 3 | Navigation toàn cục đổi giữa dạng đầy đủ và dạng gọn | `NavigationFeatureNav` quan sát layout viewport quanh mốc `48rem` |
| Case 4 | Rail hội thoại đổi giữa dạng thường trực và drawer | `ChatWorkspace` quan sát layout viewport, qua `matchMedia("(max-width: 47.999rem)")` đi kèm một rule CSS từ `48rem` |
| Case 5 | Direction muốn một breakpoint tablet chung phủ lên các vùng này | Không có thứ đó. Query sở hữu đã quyết rồi, và một breakpoint thứ hai tạo ra owner cạnh tranh |

Không phải rule này: trang có những vùng nào để query tác động lên thuộc LAYOUT-1.

## RESPONSIVE-3 — Mỗi nhánh hẹp có đúng một owner

Chi phối việc ai giữ state khi một composition có hai hình dạng.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | `NavigationFeatureNav` để lộ trigger dạng gọn của nó | Theo hợp đồng, drawer gọn do ứng dụng sở hữu, nên direction phải cấp đúng những điểm đến, nhãn, state, đường trả focus và lối phục hồi đó qua extension point này |
| Case 2 | `ChatWorkspace` đổi rail giữa thường trực và drawer | Composition sở hữu việc đổi; direction truyền state điều khiển và callback, không tự thêm listener nào |
| Case 3 | `PrimaryRailLayout` tái bố cục một rail đang hiện diện | CSS công khai sở hữu việc tái bố cục, còn một rail vắng mặt thì vắng mặt trong DOM chứ không bị ẩn |
| Case 4 | Cả hai hình dạng cùng render và một cái chỉ bị ẩn | Không được. Mỗi lúc chỉ tồn tại một nhánh, và nhánh kia không để lại dấu vết layout hay accessibility nào |

## RESPONSIVE-4 — Áp lực không đến từ bề rộng viewport

Chi phối những cách khác khiến không gian cạn đi.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Người đọc zoom, phóng chữ, hoặc tự đặt text spacing | Composition tái bố cục; cố định chiều cao chữ và cắt xén không phải câu trả lời |
| Case 2 | Copy dài ra vì đã dịch hoặc vì một state thêm chữ | Phần dài ra nằm trong quyết định vừa vặn, không phải ngoại lệ của nó |
| Case 3 | Nội dung vốn hai chiều và không thể chảy lại | Một `HorizontalScrollRegion` có tên sở hữu nó, và trang bao quanh vẫn nằm trong biên inline của mình |
| Case 4 | Bàn phím ảo, xoay màn hình hoặc safe-area làm hụt không gian dùng được | Geometry thường trực vẫn phải vừa, vẫn nhìn thấy và không che nhiệm vụ. Việc một layout query vẫn ở chế độ rộng không chứng minh được là nó vừa mắt |
| Case 5 | Một state làm surface nở ra, như lỗi, panel mở hay overlay | Hình dạng nở ra được quyết cùng lúc với hình dạng lúc nghỉ |

## RESPONSIVE-5 — Những ngưỡng mà direction cam kết

Chi phối những gì phần audit sẽ được yêu cầu lấy mẫu.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một composition có ngưỡng query được gọi tên | Direction gọi tên ngưỡng đó và gọi tên không gian phải thay đổi để chạm tới nó, là container inline-size hay layout viewport |
| Case 2 | Một composition trộn cả owner container lẫn owner viewport | Mỗi owner có cam kết riêng; một mẫu không đứng thay cho mẫu kia |
| Case 3 | Đã biết nội dung dài nhất có tên và các trạng thái gây áp lực | Chúng được gọi tên từ đầu, để audit chạy đúng trường hợp xấu nhất thật sự |
| Case 4 | Một family hoặc ứng dụng thêm delta | Tách riêng từng tầng, để một trigger gọn bị mất quy được về đúng tầng đã làm mất nó |

Không phải rule này: việc chạy mẫu và ghi lại geometry là công việc của operator audit.

## File này không quyết định

Trang có những vùng nào và ai sở hữu track thuộc [Layout](layout.vi.md). Ý nghĩa có giữ được cấp độ
qua một lần reflow không thuộc [Hierarchy](hierarchy.vi.md), còn một nhóm action có giữ được thứ tự
không thuộc [CTA](cta.vi.md). Một nhánh hẹp có vắng mặt thật sự hay không được chốt ở
[State](state.vi.md) và được chứng minh ở [Focus](../proof/focus.vi.md).
