# State composition

File này trả lời đúng một câu hỏi: tính năng này có thể rơi vào những điều kiện riêng biệt nào, và
carrier công khai nào giữ từng điều kiện đó.

State được biên dịch trước khi bất cứ thứ gì render. Direction liệt kê các dữ kiện business và các
bước chuyển giữa chúng trước, rồi mới gán từng cái vào một carrier thật. Hai dữ kiện dùng chung một
carrier sẽ hoá thành một dữ kiện, còn một dữ kiện không có carrier thì hoá thành phỏng đoán, nên
chính bước biên dịch đó mới là rule.

## Năm loại

| Loại | Ví dụ | Bản chất |
| --- | --- | --- |
| Dấu hiệu thoáng qua | hover, focus, pressed | Chỉ tồn tại chừng nào thao tác còn tồn tại |
| Giá trị bền vững | selected, expanded | Sống sót qua blur, qua rerender và qua reflow |
| Dữ kiện vòng đời | không dùng được, đang chạy, chưa giải quyết lần đầu | Đi theo công việc, không đi theo con trỏ |
| Kết cục đã chốt | thành công, lỗi, huỷ | Đòi một kết quả thật từ authority |
| Vắng mặt | nhánh đó không tồn tại | Không đóng góp gì hết |

`PresentationState` công bố `neutral`, `informative`, `affirmative`, `cautionary`, `negative`,
`pending` và `unavailable` cho các owner như surface, rail và static row. Các giá trị đó trung tính
về mặt render: chúng sơn một dữ kiện mà authority đã xác lập, và không bao giờ tự tạo ra dữ kiện.

## STATE-1 — Gọi tên các ý nghĩa trước khi chọn carrier

Chi phối thứ tự đưa ra quyết định về state.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một tính năng có hơn một điều kiện chạm tới được | Mọi dữ kiện business và mọi bước chuyển giữa chúng đã có tên trong receipt trước khi bất kỳ prop carrier nào đứng cạnh chúng |
| Case 2 | Các dữ kiện đã sẵn sàng để gán | Mỗi dữ kiện đã đặt tên phân giải về carrier riêng của nó: `isDisabled`, `isPending` hoặc `isSkeleton` ở nơi owner có công bố chúng, `Tabs.selectedKey`, `SurfaceAccordionCard.isOpen`, hoặc một `PresentationState` trên owner của nó |
| Case 3 | Một cờ chung có thể phủ được vài dữ kiện cùng lúc | Không carrier nào đứng cho quá một dữ kiện, nên disabled, pending và chưa giải quyết không bao giờ chung một cờ |
| Case 4 | Có sẵn một dấu hiệu thoáng qua trông rất tiện | Không có dấu hiệu hover hay focus nào mang giá trị selected hoặc expanded |
| Case 5 | Một giá trị presentation có sẵn trước khi authority lên tiếng | Mọi giá trị `PresentationState` trong cây đều truy về một dữ kiện authority đã chốt; không giá trị nào đi trước nó |

## STATE-2 — Việc đã nhận và nội dung chưa giải quyết có owner khác nhau

Chi phối ranh giới giữa tiến trình và tải nội dung.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một câu lệnh đã nhận việc | `isPending` nằm trên chính câu lệnh khởi động, hoặc trên prop chuyển tiếp công khai như `EmptyNotice.isActionPending` |
| Case 2 | Nội dung chưa giải quyết lần đầu | `isSkeleton` nằm trên owner của nội dung, và owner đó cho ra hình khối trơ, không giá trị nào được đọc lên |
| Case 3 | Một phép đo chưa biết | Không node nào nêu giá trị cho nó, và không có số không nào được render thay cho một phép đo chưa biết |
| Case 4 | Một control ngang hàng không khởi động việc đó | Control đó không mang dấu hiệu tiến trình nào của riêng nó |

Không phải rule này: người đọc được nói gì khi việc kết thúc thuộc FEEDBACK-3.

## STATE-3 — Vắng mặt phải vắng mặt trọn vẹn

Chi phối thứ mà một nhánh để lại khi nó không tồn tại.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Authority nói rằng một nhánh, control, vùng hay slot tuỳ chọn hiện không tồn tại | Nhánh đó không được mount, qua hợp đồng tuỳ chọn công khai, chẳng hạn rail của `ChatWorkspace` bị bỏ hoặc `EmptyNotice.actionLabel` bị bỏ |
| Case 2 | Ẩn nó đi bằng thị giác thì dễ hơn | Không node nào của nhánh đó còn trong cây, dù nhìn thấy hay không, và không thứ vô hình nào còn phản hồi thao tác |
| Case 3 | Nhánh đó từng nằm trong một grid hoặc một hàng flex | Wrapper, track, spacer, divider và khoảng scroll đã đặt trước đều vắng mặt cùng nó |
| Case 4 | Nhánh đó từng chứa thứ gì focus được | Không gì từ nhánh đó focus được và không gì từ nó xuất hiện trong accessibility tree |

Retired: STATE-4 đã nghỉ, gộp vào COVERAGE-1, và số này không được dùng lại; địa chỉ đó coi như đã tiêu.

## STATE-5 — Surface là một action, hoặc là tĩnh

Chi phối việc một surface có tự nó là một thứ tương tác hay không.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Toàn bộ surface dẫn tới một điểm đến | `SurfaceCard.wholeAction` là `{ kind: "link", href, label }`, cho ra đúng một mục tiêu ngữ nghĩa với một tên khả truy cập |
| Case 2 | Toàn bộ surface chạy một câu lệnh | `SurfaceCard.wholeAction` là `{ kind: "button", press, label }` |
| Case 3 | Surface không tương tác | `wholeAction` vắng mặt, và surface không mang click handler hay phản hồi hover nào gợi ra sự tương tác |
| Case 4 | Surface cần một action nhỏ độc lập bên trong, ví dụ menu của một hàng | Mục tiêu toàn surface và action nhỏ nằm trên hai ranh giới rời nhau; không cái nào bọc cái nào |

Không phải rule này: một lần kích hoạt chạm tới bao nhiêu hiệu ứng thuộc ACTION-1.

## STATE-6 — Lựa chọn bền vững giữa các view ngang hàng

Chi phối một giá trị selected mà các view ngang hàng dùng chung.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Các view ngang hàng dùng chung một lựa chọn phải sống lâu hơn hover, press và focus | `Tabs` mang `selectedKey` do ứng dụng sở hữu, cùng `items` có thứ tự và `onSelect` |
| Case 2 | Mỗi view ngang hàng điều khiển một panel | `panelId` gắn mỗi tab với panel của nó, nên quan hệ đó được công bố chứ không ngầm hiểu |
| Case 3 | Direction bị cám dỗ giữ thêm một giá trị selected cục bộ | Đúng một giá trị điều khiển lái phần render; không tồn tại bản sao cục bộ của lựa chọn đó |
| Case 4 | Direction bị cám dỗ bọc thêm role tab của riêng mình quanh tabs công khai | Không node nào ngoài `Tabs` mang ngữ nghĩa tab composite cho cùng lựa chọn đó |

## STATE-7 — Disclosure có điều khiển

Chi phối một phần tóm tắt làm hiện ra một vùng.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một phần tóm tắt làm hiện hoặc ẩn một vùng gắn với nó | `SurfaceAccordionCard` mang `isOpen`, `summaryRender`, `bodyRender` và `onOpenChange` |
| Case 2 | Một danh sách có nhiều disclosure điều khiển độc lập | `items` có điều khiển cùng `onItemOpenChange` gắn mỗi giá trị open vào đúng item của nó |
| Case 3 | Hover sẽ mở nó ra, hoặc có thêm một trigger thứ hai nằm cạnh trigger công khai | Disclosure chỉ đổi qua giá trị điều khiển, từ đúng một trigger; không đường hover nào và không trigger thứ hai nào chạm tới nó |
| Case 4 | Phần thân đang đóng có chứa link hoặc control | Khi đóng, không gì bên trong phần thân focus được hay được đọc lên |

## File này không quyết định

Trang có những vùng nào để chứa các state này thuộc [Layout](layout.vi.md), và nhánh nào sống sót
qua reflow thuộc [Responsive](responsive.vi.md). Control nào mang quyết định, và khi nhiều control
cùng tham gia thì ai giữ pending, thuộc [CTA](cta.vi.md) và [Action](action.vi.md). Người đọc được
nói gì ở mỗi kết cục thuộc [Feedback](feedback.vi.md). Receipt phải liệt kê những gì về các state
này thuộc [Coverage](coverage.vi.md). State sau khi render có được đọc lên, có chạm tới được và có
đúng sự thật không thuộc [Accessibility](../proof/accessibility.vi.md),
[Focus](../proof/focus.vi.md) và [Render truth](../proof/render-truth.vi.md).
