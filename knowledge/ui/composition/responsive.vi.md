# Responsive composition

File này trả lời đúng một câu hỏi: khi không gian dành cho một nhiệm vụ thay đổi, cái gì phải sống
sót, và query công khai nào sở hữu thay đổi đó.

Quyết định responsive được đưa ra trước khi có DOM, vì chúng là quyết định về việc vùng nào tái bố
cục, nhánh nào biến mất, và sau đó người đọc vẫn phải làm được gì. Một cái tên thiết bị không bao
giờ là câu trả lời ở đây; câu trả lời luôn là một query có tên trên một owner có tên.

## RESPONSIVE-1 — Cái gì sống sót khi không gian co lại

Chi phối mức sàn mà bố cục hẹp phải giữ.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một nhiệm vụ phải lọt vào không gian nhỏ hơn hẳn | Nhánh hẹp giữ nguyên ý nghĩa bắt buộc, action chính và trạng thái hiện tại trong một luồng đọc được, và phần bổ trợ vẫn chạm tới được từ đó |
| Case 2 | Nội dung sẽ khiến cả trang phải cuộn ngang | Composition tái bố cục; trong nhánh đó không có cắt xén, không có bóp lại và không có tràn inline ở cấp trang |
| Case 3 | Một nhánh bị ẩn đi trong không gian hẹp | Nhánh đó vắng mặt thật sự, và thay chỗ nó là một trigger có state điều khiển được, có đường trả focus và có lối phục hồi |
| Case 4 | Muốn có các vùng song song ở bề rộng lớn hơn | Mọi vùng song song ở bề rộng đó phân giải về một composition công khai vốn đã có sẵn chế độ ấy |
| Case 5 | Hành vi hẹp cần dùng chưa có composition công khai nào | Một gap `GRAMMAR_REQUIRED` gọi tên hành vi còn thiếu, và không breakpoint song song nào được tự dựng thay chỗ nó |

## RESPONSIVE-2 — Gọi tên owner của query, không gọi tên thiết bị

Chi phối việc không gian nào thật sự đang được quan sát.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một cột chính nằm cạnh một rail | Nhánh đó gọi tên container query của `PrimaryRailLayout` ở inline-size `56rem` làm owner, nên một container hẹp vẫn xếp chồng bên trong cửa sổ rộng |
| Case 2 | Các vùng shell tái bố cục | Mỗi ngưỡng của `WorkspaceShell` được gọi tên riêng: container query có tên ở `72rem` và `56rem`, và rule theo viewport ở `69.999rem` |
| Case 3 | Navigation toàn cục đổi giữa dạng đầy đủ và dạng gọn | `NavigationFeatureNav` được gọi tên là owner, quan sát layout viewport quanh mốc `48rem` |
| Case 4 | Rail hội thoại đổi giữa dạng thường trực và drawer | `ChatWorkspace` được gọi tên là owner, quan sát layout viewport qua `matchMedia("(max-width: 47.999rem)")` đi kèm một rule CSS từ `48rem` |
| Case 5 | Direction muốn một breakpoint tablet chung phủ lên các vùng này | Không breakpoint nào ngoài các query sở hữu đã công bố chi phối những vùng đó |

Không phải rule này: trang có những vùng nào để query tác động lên thuộc LAYOUT-1.

## RESPONSIVE-3 — Mỗi nhánh hẹp có đúng một owner

Chi phối việc ai giữ state khi một composition có hai hình dạng.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | `NavigationFeatureNav` để lộ trigger dạng gọn của nó | Ứng dụng sở hữu drawer gọn qua extension point đó và cấp đúng những điểm đến, nhãn, state, đường trả focus và lối phục hồi ấy |
| Case 2 | `ChatWorkspace` đổi rail giữa thường trực và drawer | Composition sở hữu việc đổi; receipt chỉ truyền state điều khiển và callback, và không khai báo listener nào của riêng nó |
| Case 3 | `PrimaryRailLayout` tái bố cục một rail đang hiện diện | CSS công khai sở hữu việc tái bố cục, còn một rail vắng mặt thì vắng mặt trong DOM chứ không bị ẩn |
| Case 4 | Cả hai hình dạng cùng render và một cái chỉ bị ẩn | Mỗi lúc tồn tại đúng một nhánh, và nhánh kia không để lại dấu vết layout hay accessibility nào |

## RESPONSIVE-4 — Áp lực không đến từ bề rộng viewport

Chi phối những cách khác khiến không gian cạn đi.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Người đọc zoom, phóng chữ, hoặc tự đặt text spacing | Composition tái bố cục; không chiều cao chữ cố định và không cắt xén nào gánh áp lực đó |
| Case 2 | Copy dài ra vì đã dịch hoặc vì một state thêm chữ | Receipt gọi tên phần dài ra ngay trong quyết định vừa vặn, chứ không như một ngoại lệ của nó |
| Case 3 | Nội dung vốn hai chiều và không thể chảy lại | Đúng một `HorizontalScrollRegion` có tên sở hữu nó, và trang bao quanh vẫn nằm trong biên inline của mình |
| Case 4 | Bàn phím ảo, xoay màn hình hoặc safe-area làm hụt không gian dùng được | Geometry thường trực vẫn vừa, vẫn nhìn thấy và không che phần nào của nhiệm vụ; việc một layout query vẫn ở chế độ rộng không được nhận là bằng chứng vừa mắt |
| Case 5 | Một state làm surface nở ra, như lỗi, panel mở hay overlay | Hình dạng nở ra được chốt trong cùng mục receipt với hình dạng lúc nghỉ |

Retired: RESPONSIVE-5 đã nghỉ, gộp vào COVERAGE-1, và số này không được dùng lại; địa chỉ đó coi như đã tiêu.

## File này không quyết định

Trang có những vùng nào và ai sở hữu track thuộc [Layout](layout.vi.md). Ý nghĩa có giữ được cấp độ
qua một lần reflow không thuộc [Hierarchy](hierarchy.vi.md), còn một nhóm action có giữ được thứ tự
không thuộc [CTA](cta.vi.md). Receipt phải liệt kê những gì về các nhánh này thuộc
[Coverage](coverage.vi.md). Một nhánh hẹp có vắng mặt thật sự hay không được chốt ở
[State](state.vi.md) và được chứng minh ở [Focus](../proof/focus.vi.md).
