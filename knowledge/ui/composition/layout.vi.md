# Layout composition

File này trả lời đúng một câu hỏi: trước khi có bất kỳ cây DOM nào, trang này có những vùng nhiệm vụ
nào mà người đọc nhìn thấy, và ai sở hữu từng vùng đó.

Layout là quyết định composition đầu tiên. Nó chốt xem người đọc thấy bao nhiêu vùng, composition
công khai nào sở hữu track và scroll của từng vùng, và chuyện gì xảy ra với một vùng khi nó rời khỏi
dòng chảy bình thường hoặc biến mất hẳn. Mọi thứ đo được sau khi trang render đều thuộc về operator
audit, không thuộc file này.

## Từ vựng owner

| Owner | Nghĩa |
| --- | --- |
| Tên một composition | `@starci/grammar/common` đã sở hữu track và geometry của vùng đó |
| `App` | Direction cấp nội dung, state và label vào một slot công khai |
| `—` | Chưa có composition công khai nào phủ được vùng này; direction ghi nhận gap |

Với ra một grid của vendor ở chỗ owner là tên một composition chính là `APP_REIMPLEMENTATION`. Với ra
một grid ở chỗ owner là `—` thì đó là `COMMON_CAPABILITY_MISSING`, và câu trả lời là bổ sung
composition dùng lại được, chứ không phải tự dựng grid trong ứng dụng.

## LAYOUT-1 — Trang có những vùng nào

Chi phối số vùng nhiệm vụ mà người đọc nhìn thấy và lý do tồn tại của từng vùng.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Nội dung business chỉ có một nhiệm vụ và không có phần bổ trợ | Đúng một vùng chủ đạo. Track thứ hai chỉ thêm khi có một vai trò nhiệm vụ được gọi tên, không bao giờ thêm để lấp chỗ trống |
| Case 2 | Nhiệm vụ chính có phần bổ trợ mà người đọc tra cứu song song | Phần bổ trợ là một rail, và direction phải gọi tên vai trò nhiệm vụ đã xứng đáng có nó |
| Case 3 | Nội dung trang được route cần khung chrome bao quanh | `WorkspaceShell` sở hữu các vùng shell và quyết định phần tử nào là landmark chính |
| Case 4 | Các điểm đến cần được gom nhóm để duyệt | `Sidebar` sở hữu việc gom nhóm; direction cấp điểm đến và nhãn |
| Case 5 | Một cuộc hội thoại cần composer luôn nằm yên tại chỗ | `ChatWorkspace` sở hữu cặp hội thoại và composer |
| Case 6 | Cách sắp xếp cần dùng chưa có composition công khai nào | Direction dừng lại và ghi nhận composition dùng lại được đang thiếu |

Không phải rule này: vùng nào trong số các vùng mang anchor mạnh nhất thuộc HIERARCHY-2.

## LAYOUT-2 — Owner của mọi vùng là một composition công khai

Chi phối phần code nào quyết định track của một vùng, chứ không phải nội dung nào nằm trong đó.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một cột chính nằm cạnh một cột bổ trợ | `PrimaryRailLayout` sở hữu cả hai track; direction chọn `railWidth` và `align` và không tự viết công thức track |
| Case 2 | Các vùng shell và landmark chính cần được gọi tên | `WorkspaceShell` sở hữu các slot; direction cấp `primaryLabel` |
| Case 3 | Một surface hội thoại cần chiều cao có biên | `ChatWorkspace` sở hữu phần này, và host cấp chiều cao mà nó yêu cầu |
| Case 4 | Direction bị cám dỗ dùng grid của vendor hoặc tự tính bề rộng con | Không làm. Vùng đó hoặc dùng composition công khai, hoặc ghi nhận gap |
| Case 5 | Một family muốn một vùng trông khác đi | Family được thay renderer theo cách tương thích; nó không được đổi vai trò hay đổi số lượng owner |

Không phải rule này: khoảng cách giữa các object bên trong một vùng là quyết định của presentation.

## LAYOUT-3 — Mỗi vùng một owner, mỗi trục scroll một owner

Chi phối số thứ được phép nhận cùng một vùng hoặc cùng một trục tràn.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Nhiều vùng cùng tồn tại trên một trang | Mỗi vùng nhìn thấy được có đúng một composition owner và đúng một track chủ đích |
| Case 2 | Nội dung rộng hơn cột của nó về bản chất, ví dụ một bảng | Một `HorizontalScrollRegion` có tên sở hữu trục inline, và bản thân trang không scroll ngang |
| Case 3 | Dòng chảy dọc cần bị chặn biên bên trong một vùng | `VerticalScrollRegion isScrollable` hoặc đúng composition đó sở hữu nó |
| Case 4 | Hội thoại phải scroll trong khi composer đứng yên | `ChatWorkspace` sở hữu scroll hội thoại và composer là anh em của nó, nằm ngoài scroller |
| Case 5 | Có đề xuất lồng thêm một scroller | Chỉ chấp nhận khi hai owner mang hai trục có tên khác nhau hoặc hai nhiệm vụ có tên khác nhau |

Không phải rule này: chuyện một vùng scroll có thật sự chạm tới và duyệt được bằng bàn phím sau khi
render thuộc FOCUS-2.

## LAYOUT-4 — Vùng rời khỏi dòng chảy bình thường

Chi phối các vùng sticky, fixed, drawer, floating, bị đảo thứ tự thị giác, và vùng vắng mặt có điều
kiện.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Cột bổ trợ cần nằm trong tầm mắt khi cột chính cuộn | `Rail mode="sticky"` cùng biên đã công bố của nó; dưới ngưỡng hẹp nó trở lại dòng chảy bình thường |
| Case 2 | Một overlay cần geometry fixed có biên | `WorkspaceShell.floatingLayer` chỉ cấp geometry. Nếu overlay còn cần giam focus và cách đóng, direction phải gọi tên một modal owner hoặc ghi nhận gap |
| Case 3 | Không gian hẹp không chứa nổi rail hội thoại theo dạng inline | `ChatWorkspace` sở hữu drawer; direction cấp `isRailOpen` và `onRailOpenChange` |
| Case 4 | Một vùng vắng mặt ở trạng thái hiện tại | Sự vắng mặt không để lại wrapper, track, divider, đường kẻ, spacer hay khoảng scroll đã đặt trước |
| Case 5 | Direction muốn thứ tự thị giác khác đi ở một bề rộng | Thứ tự DOM, thứ tự đọc, thứ tự focus và thứ tự hành động vẫn theo thứ tự nhiệm vụ; thay đổi nằm ở composition, không nằm ở thứ tự thị giác |

Không phải rule này: chuyện phần projection có thật sự chừa đủ chỗ cho nội dung bên dưới ở một
viewport cụ thể là việc operator audit quan sát, không chốt ở đây.

## LAYOUT-5 — Phạm vi mà direction cam kết

Chi phối những state và bề rộng mà composition hứa sẽ giữ được, để phần audit có một ma trận cố định
thay vì phải đoán.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Hình dạng một vùng phụ thuộc vào lượng nội dung đổ về | Gọi tên các trạng thái rỗng, thưa, dày và có wrap là nằm trong phạm vi |
| Case 2 | Trang có vùng sticky, fixed hoặc drawer | Gọi tên các bề rộng chuyển tiếp và khoảng chừa cuối mà projection phải giữ |
| Case 3 | Đã khai báo một owner của scroll | Gọi tên khả năng chạm tới đầu, giữa, cuối và việc khôi phục vị trí scroll là nằm trong phạm vi |
| Case 4 | Một family hoặc ứng dụng thêm delta lên trên composition | Tách riêng từng tầng, để mỗi lỗi đều quy được về đúng tầng gây ra nó |

Không phải rule này: việc đo đạc là công việc của operator audit. Rule này chỉ cố định xem cái gì
phải được đo.

## File này không quyết định

Nội dung bên trong một vùng mang cấp độ nào thuộc [Hierarchy](hierarchy.vi.md). Một vùng tái bố cục
ra sao khi không gian đổi thuộc [Responsive](responsive.vi.md). Action nào trong vùng là chủ đạo
thuộc [CTA](cta.vi.md) và [Accent](accent.vi.md). Chuyện kết quả render có khớp với direction này
không là việc của operator audit, trong [Focus](../proof/focus.vi.md),
[Accessibility](../proof/accessibility.vi.md), [Motion](../proof/motion.vi.md) và
[Render truth](../proof/render-truth.vi.md).
