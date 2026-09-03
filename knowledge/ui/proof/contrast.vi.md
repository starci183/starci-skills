# Contrast proof

File này trả lời đúng một câu hỏi: trên trang đã thật sự render, những khác biệt và phần chữ mà
direction đang dựa vào có sống sót qua phép đo không, ở mọi theme, mọi state, và khi màu bị lấy đi?

Tương phản không bao giờ được xác lập bằng cách đọc token. Một giá trị đã viết ra chỉ là công thức;
bằng chứng là màu chữ đã tính, đo trên nền thật sự được ghép bên dưới nó, sau khi đã cộng độ trong
suốt, lớp phủ và độ mờ của state. Mỗi rule dưới đây gọi tên quan sát nào sẽ bác bỏ nó.

`COLOR-3` và `COLOR-5` là hai địa chỉ còn sống của topic `ui/color.md` đã nghỉ. Các số `COLOR-1`,
`COLOR-2` và `COLOR-4` đã nghỉ cùng topic đó và không được dùng lại.

## COLOR-3 — Action, destination, selection và focus vẫn phân biệt được

Chi phối việc bốn ý nghĩa khác nhau chia chung một vùng có còn là bốn thứ khác nhau không, khi màu bị
loại khỏi bằng chứng.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Một vùng render command và destination cạnh nhau | Command là phần tử `button` (`data-element="button"`) còn destination là thẻ neo (`data-element="a"`) mang `href`, và destination khác với chữ xung quanh ngay lúc nghỉ. Một destination mà khác biệt lúc nghỉ chỉ là một giá trị màu, gạch chân chỉ hiện khi hover, sẽ bác bỏ nó |
| Case 2 | Lựa chọn bền vững được render giữa các mục ngang hàng | Mục được chọn mang `aria-selected="true"` (tabs) hoặc `aria-current` (một text action đang current), và đo được một thay đổi không phải màu trên nó: một hình chữ nhật chỉ dấu chọn có chiều cao khác không, một `font-weight` đã tính thay đổi, hoặc một gạch chân. Một lựa chọn mà thay đổi đo được duy nhất là giá trị màu sẽ bác bỏ nó |
| Case 3 | Focus bàn phím rơi vào cùng vùng đó | `document.activeElement` là control đang được focus, và hình chữ nhật outline đã tính của nó tách biệt với chỉ dấu chọn. Focus và selection dùng chung một fill y hệt, không outline và không thuộc tính state, sẽ bác bỏ cả hai owner cùng lúc |
| Case 4 | Màu bị loại khỏi ảnh chụp, hoặc forced colors đang bật | Mỗi khác biệt trong bốn thứ vẫn giữ được qua role phần tử, thuộc tính state, outline hoặc hình học của chỉ dấu. Một khác biệt chỉ do fill mang sẽ bác bỏ nó |
| Case 5 | Một ranh giới không phải chữ đang mang khác biệt: chỉ dấu, outline, mép field | Tương phản đo được của nó với nền ghép liền kề tối thiểu `3:1`. Một chỉ dấu `2px` đo được `1.8:1` trên thanh của nó sẽ bác bỏ nó, dù trong file thiết kế trông rõ tới đâu |

Không phải rule này: tỉ lệ chữ của nhãn đang được chọn hay được focus, và mọi tỉ lệ dịch chuyển ra
sao giữa các theme, thuộc COLOR-5. Chỉ dấu focus nằm ở đâu và có bị tổ tiên cắt không thuộc
FOCUS-1. Mọi khác biệt có sống sót khi zoom và chảy lại không thuộc A11Y-4. Một destination có đáng
lẽ phải là command hay không được quyết ở composition, dưới ACTION-1.

## COLOR-5 — Theme và tương phản đo được

Chi phối việc chữ và các ranh giới bắt buộc có đạt tỉ lệ ở mọi theme và mọi state mà family render
không, đo trên pixel đã ghép chứ không đo trên token.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Chữ cỡ thường được render | `color` đã tính, đo trên nền đã ghép sau độ trong suốt, lớp phủ và độ mờ của state như `[data-grammar-state="unavailable"]`, tối thiểu `4.5:1`. Một token tự nó trông đủ tối, mà không chụp được nền đã ghép, không chứng minh gì và được ghi là thiếu bằng chứng |
| Case 2 | Chữ cỡ lớn được render, tối thiểu `24px`, hoặc `18.66px` ở độ đậm bold | Cùng phép đo trên nền ghép, tối thiểu `3:1` |
| Case 3 | Một ranh giới không phải chữ nhưng bắt buộc được render: outline focus, chỉ dấu chọn, mép field, mép state | Tương phản đo được với màu ở hai bên tối thiểu `3:1`. Một mép field phân giải thành `transparent` trên canvas của nó thì không có ranh giới nào đo được, và khi ấy danh tính của field phải do thứ khác đã được đo mang thay |
| Case 4 | Theme đổi: light, dark tường minh (`data-grammar-theme="dark"` trên Grammar root), hoặc dark theo hệ thống (`data-grammar-theme="system"` dưới `prefers-color-scheme: dark`) | Mọi cặp được đo lại ở từng theme thật sự render. Một tỉ lệ chụp ở theme này không khép được gì ở theme kia |
| Case 5 | Forced colors đang bật | Mọi cặp phân giải về bảng màu hệ thống (`Canvas`, `CanvasText`, `Highlight`, `GrayText`) và mọi khác biệt vẫn render. Một màu do tác giả đặt mà sống sót vào ảnh chụp forced colors sẽ bác bỏ binding của family |
| Case 6 | State đổi: hover, focus, selected, disabled (`disabled` hoặc `aria-disabled`), pending (`aria-busy` hoặc `data-action-pending="true"`), hoặc một state kết quả (`data-grammar-state`) | Mỗi state được đo riêng, và nguồn token được ghi tách khỏi con số tỉ lệ. Một phép đo duy nhất ở state mặc định không khép được gì cho các state còn lại |
| Case 7 | Một family hoặc ứng dụng sơn đè lên cặp màu | Đầu ra công khai cô lập, delta của family và delta của ứng dụng được đo riêng, để gọi tên được tầng đang hỏng. Ứng dụng được đổi canvas của chính nó, nhưng một cặp hỏng bên trong owner công khai vẫn là finding ở đúng tầng đã sơn nó |

Không phải rule này: khác biệt có tồn tại khi không có màu hay không thuộc COLOR-3. Token tone có
được chọn đúng cho phần chữ không được quyết ở presentation, dưới TONE-1 tới TONE-3. Chữ có được
đọc lên hay không thuộc A11Y-1 tới A11Y-3.

## COLOR-6 — Phán quyết của tương phản

Chi phối việc các tiêu chí trên trở thành đúng một hàng của topic này trong bảng `## Verdict` của receipt.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Lens chạy | `COLOR-3` và `COLOR-5` được xét dựa trên màu đã đo trong mọi theme và mọi state mà coverage khai, không bao giờ dựa vào tên token |
| Case 2 | Tính verdict | Tập chặn cửa là toàn bộ tập: `pass` đòi cả hai đều đạt ở mọi theme, vì một khác biệt sống ở theme này mà chết ở theme kia thì không phải khác biệt |
| Case 3 | Một theme hay một state chưa từng được đo | Verdict của topic là `blocked`, không phải một lần đạt trên những theme đã đo |
| Case 4 | Một lần fail được định tuyến | Một giá trị đo dưới ngưỡng của nó thì về `resolve`; một khác biệt dựa vào màu không ai publish thì về `direction` |

Tập được chấm là `COLOR-3` và `COLOR-5`; rule này là phần số học và bản thân nó không được chấm. Kết
quả của nó là hàng `contrast` trong bảng `## Verdict` của receipt audit.

## File này không quyết định

Một đoạn chữ lấy tone nào và surface nào nằm sau nó thuộc [Tone](../presentation/tone.vi.md) và
[Surface](../presentation/surface.vi.md); một vùng mang những ý nghĩa nào và cái nào là destination
thuộc [Action](../composition/action.vi.md) và [State](../composition/state.vi.md). Tên, quan hệ và
kích thước mục tiêu thuộc [Accessibility](accessibility.vi.md); chỉ dấu nằm ở đâu thuộc
[Focus](focus.vi.md); một state có được đi tới một cách trung thực không thuộc
[Render truth](render-truth.vi.md).
