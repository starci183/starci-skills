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

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Nội dung business chỉ có một nhiệm vụ và không có phần bổ trợ | Receipt liệt kê đúng một vùng chủ đạo, và mọi vùng khác nó liệt kê đều mang một vai trò nhiệm vụ có tên |
| Case 2 | Nhiệm vụ chính có phần bổ trợ mà người đọc tra cứu song song | Phần bổ trợ là một rail, và receipt gọi tên vai trò nhiệm vụ đã xứng đáng có nó |
| Case 3 | Nội dung trang được route cần khung chrome bao quanh | `WorkspaceShell` sở hữu các vùng shell, và đúng một phần tử được gọi tên là landmark chính |
| Case 4 | Các điểm đến cần được gom nhóm để duyệt | `Sidebar` sở hữu việc gom nhóm; receipt chỉ cấp điểm đến và nhãn vào đó |
| Case 5 | Một cuộc hội thoại cần composer luôn nằm yên tại chỗ | `ChatWorkspace` sở hữu cặp hội thoại và composer |
| Case 6 | Cách sắp xếp cần dùng chưa có composition công khai nào | Một gap `GRAMMAR_REQUIRED` gọi tên composition còn thiếu, và không có cách sắp xếp thay thế nào xuất hiện trong cây |

Không phải rule này: vùng nào trong số các vùng mang anchor mạnh nhất thuộc HIERARCHY-2.

## LAYOUT-2 — Owner của mọi vùng là một composition công khai

Chi phối phần code nào quyết định track của một vùng, chứ không phải nội dung nào nằm trong đó.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một cột chính nằm cạnh một cột bổ trợ | `PrimaryRailLayout` sở hữu cả hai track; receipt chỉ gọi tên `railWidth` và `align`, và không công thức track nào đứng cạnh vùng đó |
| Case 2 | Các vùng shell và landmark chính cần được gọi tên | `WorkspaceShell` sở hữu các slot, và receipt cấp `primaryLabel` |
| Case 3 | Một surface hội thoại cần chiều cao có biên | `ChatWorkspace` sở hữu biên đó, và host cấp chiều cao mà nó yêu cầu |
| Case 4 | Direction bị cám dỗ dùng grid của vendor hoặc tự tính bề rộng con | Mọi vùng phân giải về một composition công khai hoặc về một gap đã ghi nhận; không grid vendor và không phép tính bề rộng nào sở hữu một vùng |
| Case 5 | Một family muốn một vùng trông khác đi | Delta của family chỉ thay renderer bằng props tương thích; vai trò của vùng và số lượng owner của nó không đổi |

Không phải rule này: khoảng cách giữa các object bên trong một vùng là quyết định của presentation.

## LAYOUT-3 — Mỗi vùng một owner, mỗi trục scroll một owner

Chi phối số thứ được phép nhận cùng một vùng hoặc cùng một trục tràn.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Nhiều vùng cùng tồn tại trên một trang | Mỗi vùng nhìn thấy được phân giải về đúng một composition owner và đúng một track chủ đích |
| Case 2 | Nội dung rộng hơn cột của nó về bản chất, ví dụ một bảng | Đúng một `HorizontalScrollRegion` có tên sở hữu trục inline, và không tồn tại scroll ngang ở cấp trang |
| Case 3 | Dòng chảy dọc cần bị chặn biên bên trong một vùng | `VerticalScrollRegion isScrollable`, hoặc đúng composition có tên đó, sở hữu trục dọc ấy |
| Case 4 | Hội thoại phải scroll trong khi composer đứng yên | `ChatWorkspace` sở hữu scroll hội thoại, và composer là anh em của nó nằm ngoài scroller |
| Case 5 | Có đề xuất lồng thêm một scroller | Mỗi scroller lồng nhau mang một trục có tên khác hoặc một nhiệm vụ có tên khác so với tổ tiên của nó |

Không phải rule này: chuyện một vùng scroll có thật sự chạm tới và duyệt được bằng bàn phím sau khi
render thuộc FOCUS-2.

## LAYOUT-4 — Vùng rời khỏi dòng chảy bình thường

Chi phối các vùng sticky, fixed, drawer, floating, bị đảo thứ tự thị giác, và vùng vắng mặt có điều
kiện.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Cột bổ trợ cần nằm trong tầm mắt khi cột chính cuộn | `Rail mode="sticky"` mang biên đã công bố của nó, và dưới ngưỡng hẹp vùng đó trở lại dòng chảy bình thường |
| Case 2 | Một overlay cần geometry fixed có biên | `WorkspaceShell.floatingLayer` chỉ cấp geometry; nếu còn cần giam focus và cách đóng, receipt gọi tên một modal owner hoặc ghi nhận gap |
| Case 3 | Không gian hẹp không chứa nổi rail hội thoại theo dạng inline | `ChatWorkspace` sở hữu drawer, và receipt cấp `isRailOpen` cùng `onRailOpenChange` |
| Case 4 | Một vùng vắng mặt ở trạng thái hiện tại | Không wrapper, track, divider, đường kẻ, spacer hay khoảng scroll đã đặt trước nào của vùng đó sống sót qua sự vắng mặt |
| Case 5 | Direction muốn thứ tự thị giác khác đi ở một bề rộng | Thứ tự DOM, thứ tự đọc, thứ tự focus và thứ tự hành động trùng khít thứ tự nhiệm vụ ở mọi bề rộng; composition khác đi, thứ tự thì không |

Không phải rule này: chuyện phần projection có thật sự chừa đủ chỗ cho nội dung bên dưới ở một
viewport cụ thể là việc operator audit quan sát, không chốt ở đây.

Retired: LAYOUT-5 đã nghỉ, gộp vào COVERAGE-1, và số này không được dùng lại; địa chỉ đó coi như đã tiêu.

## File này không quyết định

Nội dung bên trong một vùng mang cấp độ nào thuộc [Hierarchy](hierarchy.vi.md). Một vùng tái bố cục
ra sao khi không gian đổi thuộc [Responsive](responsive.vi.md). Action nào trong vùng là chủ đạo
thuộc [CTA](cta.vi.md) và [Accent](accent.vi.md). Receipt phải liệt kê những gì về các vùng này
thuộc [Coverage](coverage.vi.md). Chuyện kết quả render có khớp với direction này không là việc của
operator audit, trong [Focus](../proof/focus.vi.md),
[Accessibility](../proof/accessibility.vi.md), [Motion](../proof/motion.vi.md) và
[Render truth](../proof/render-truth.vi.md).
