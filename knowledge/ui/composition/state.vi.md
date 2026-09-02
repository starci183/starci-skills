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

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một tính năng có hơn một điều kiện chạm tới được | Gọi tên mọi dữ kiện business và mọi bước chuyển giữa chúng trước, trước khi chọn bất kỳ prop nào |
| Case 2 | Các dữ kiện đã sẵn sàng để gán | Mỗi cái lấy carrier riêng: `isDisabled`, `isPending` hoặc `isSkeleton` ở nơi owner có công bố chúng, `Tabs.selectedKey`, `SurfaceAccordionCard.isOpen`, hoặc một `PresentationState` trên owner của nó |
| Case 3 | Một cờ chung có thể phủ được vài dữ kiện cùng lúc | Không được. Một cờ đứng thay cho disabled, pending và chưa giải quyết sẽ gộp ba dữ kiện thành một |
| Case 4 | Có sẵn một dấu hiệu thoáng qua trông rất tiện | Hover hay focus không bao giờ được dùng làm sự thật của selected hay expanded |
| Case 5 | Một giá trị presentation có sẵn trước khi authority lên tiếng | Nó phải chờ. Một hàng affirmative trước khi thành công được xác nhận là một tuyên bố không ai đưa ra |

## STATE-2 — Việc đã nhận và nội dung chưa giải quyết có owner khác nhau

Chi phối ranh giới giữa tiến trình và tải nội dung.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một câu lệnh đã nhận việc | `isPending` trên chính câu lệnh khởi động, hoặc prop chuyển tiếp công khai như `EmptyNotice.isActionPending` |
| Case 2 | Nội dung chưa giải quyết lần đầu | `isSkeleton` trên owner của nội dung, cho ra hình khối trơ và không có giá trị nào được đọc lên |
| Case 3 | Một phép đo chưa biết | Nó ở nguyên trạng thái chưa giải quyết. Một số không được render là một phép đo, và nó nói một điều sai |
| Case 4 | Một control ngang hàng không khởi động việc đó | Nó không mang dấu hiệu tiến trình nào cả |

Không phải rule này: người đọc được nói gì khi việc kết thúc thuộc FEEDBACK-3.

## STATE-3 — Vắng mặt phải vắng mặt trọn vẹn

Chi phối thứ mà một nhánh để lại khi nó không tồn tại.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Authority nói rằng một nhánh, control, vùng hay slot tuỳ chọn hiện không tồn tại | Không mount nó, qua hợp đồng tuỳ chọn công khai, chẳng hạn bỏ rail của `ChatWorkspace` hoặc bỏ `EmptyNotice.actionLabel` |
| Case 2 | Ẩn nó đi bằng thị giác thì dễ hơn | Ẩn thị giác không phải vắng mặt, và một control vô hình mà vẫn phản hồi còn tệ hơn một control nhìn thấy được |
| Case 3 | Nhánh đó từng nằm trong một grid hoặc một hàng flex | Wrapper, track, spacer, divider và khoảng scroll đã đặt trước đều đi theo nó |
| Case 4 | Nhánh đó từng chứa thứ gì focus được | Không còn gì focus được và không còn gì trong accessibility tree sống sót sau nó |

## STATE-4 — Phạm vi mà direction cam kết

Chi phối ma trận mà phần audit sẽ được yêu cầu chạy.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một tính năng có nhiều state và nhiều bề rộng | Gọi tên trước ma trận state, bước chuyển, viewport và điều kiện đầu vào hoặc nội dung |
| Case 2 | Có một đường pending tồn tại | Mọi đường pending đều có một điểm kết thúc chạm tới được, kể cả huỷ |
| Case 3 | Hai dữ kiện có vẻ dùng chung một carrier | Giải quyết chồng lấn đó trước khi giao hàng, chứ không phát hiện ra lúc audit |
| Case 4 | Một family hoặc ứng dụng thêm delta | Tách riêng từng tầng, để một state selected bị mất quy được về đúng tầng đã làm mất nó |

## STATE-5 — Surface là một action, hoặc là tĩnh

Chi phối việc một surface có tự nó là một thứ tương tác hay không.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Toàn bộ surface dẫn tới một điểm đến | `SurfaceCard.wholeAction` dạng `{ kind: "link", href, label }`, cho ra một mục tiêu ngữ nghĩa với một tên khả truy cập |
| Case 2 | Toàn bộ surface chạy một câu lệnh | `SurfaceCard.wholeAction` dạng `{ kind: "button", press, label }` |
| Case 3 | Surface không tương tác | Bỏ `wholeAction`, và không thêm click handler hay phản hồi hover để nó có cảm giác tương tác |
| Case 4 | Surface cần một action nhỏ độc lập bên trong, ví dụ menu của một hàng | Tách ranh giới để mục tiêu toàn surface và action nhỏ không chồng lên nhau |

Không phải rule này: một lần kích hoạt chạm tới bao nhiêu hiệu ứng thuộc ACTION-1.

## STATE-6 — Lựa chọn bền vững giữa các view ngang hàng

Chi phối một giá trị selected mà các view ngang hàng dùng chung.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Các view ngang hàng dùng chung một lựa chọn phải sống lâu hơn hover, press và focus | `Tabs` với `selectedKey` do ứng dụng sở hữu, `items` có thứ tự, và `onSelect` |
| Case 2 | Mỗi view ngang hàng điều khiển một panel | `panelId` gắn tab với panel của nó, để quan hệ đó được công bố chứ không phải ngầm hiểu |
| Case 3 | Direction bị cám dỗ giữ thêm một giá trị selected cục bộ | Không làm. Một giá trị điều khiển duy nhất lái phần render, nếu không hai owner sẽ mâu thuẫn |
| Case 4 | Direction bị cám dỗ bọc thêm role tab của riêng mình quanh tabs công khai | Không làm. Ngữ nghĩa composite trùng lặp tạo ra owner thứ hai cho cùng một lựa chọn |

## STATE-7 — Disclosure có điều khiển

Chi phối một phần tóm tắt làm hiện ra một vùng.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một phần tóm tắt làm hiện hoặc ẩn một vùng gắn với nó | `SurfaceAccordionCard` với `isOpen`, `summaryRender`, `bodyRender` và `onOpenChange` |
| Case 2 | Một danh sách có nhiều disclosure điều khiển độc lập | `items` có điều khiển cùng `onItemOpenChange`, để mỗi giá trị open thuộc về đúng item của nó |
| Case 3 | Hover sẽ mở nó ra, hoặc có thêm một trigger thứ hai nằm cạnh trigger công khai | Cả hai đều không. Disclosure chỉ được lái qua giá trị điều khiển, từ một trigger |
| Case 4 | Phần thân đang đóng có chứa link hoặc control | Đóng nghĩa là không gì bên trong focus được và không gì được đọc lên |

## File này không quyết định

Trang có những vùng nào để chứa các state này thuộc [Layout](layout.vi.md), và nhánh nào sống sót
qua reflow thuộc [Responsive](responsive.vi.md). Control nào mang quyết định, và khi nhiều control
cùng tham gia thì ai giữ pending, thuộc [CTA](cta.vi.md) và [Action](action.vi.md). Người đọc được
nói gì ở mỗi kết cục thuộc [Feedback](feedback.vi.md). State sau khi render có được đọc lên, có chạm
tới được và có đúng sự thật không thuộc [Accessibility](../proof/accessibility.vi.md),
[Focus](../proof/focus.vi.md) và [Render truth](../proof/render-truth.vi.md).
