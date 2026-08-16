# vận chuyển

## Định nghĩa

**Cánh cửa** là bất kỳ tập tin nào mà thế giới bên ngoài có thể tiếp cận: bộ phân giải, bộ điều khiển, cổng ổ cắm,
người tiêu dùng môi giới. Luật này giải quyết một câu hỏi về cửa và chỉ một câu hỏi - **khi nào được phép sử dụng cửa
không phải là GraphQL** — và nơi câu trả lời xuất hiện trên đĩa.

Câu hỏi này quan trọng vì câu trả lời gần như luôn là "không phải". Sản phẩm của kho lưu trữ này
bề mặt là lược đồ GraphQL mã đầu tiên; một khách hàng nói chuyện với nó đã có một khách hàng GraphQL, một
lược đồ, các kiểu được tạo và một điểm cuối. Mỗi tuyến REST được thêm vào bên cạnh đó là giao thức thứ hai
để cùng một khách hàng tìm hiểu, vị trí thứ hai để đặt xác thực và một loại hình dạng không được tạo
bao gồm. Chi phí đó đáng được trả chính xác khi GraphQL **không thể** thực hiện công việc — và không bao giờ vì một
Route được viết nhanh hơn.

Sự thất bại mà điều này ngăn chặn không phải là một bộ điều khiển tồi. Đó là giao diện của một cơ sở mã sau hai mươi
quyết định từng trường hợp cụ thể không ai viết ra: hai lớp cửa, không có ranh giới rõ ràng giữa chúng và một
người đọc không thể biết liệu`api/theme`là REST vì một lý do nào đó hoặc do vô tình. Đo vào thời điểm đó
luật này đã được viết ra, mười lăm trong số mười tám cánh cửa có lý do rõ ràng trong hồ sơ và ba cánh cửa thì không -
vì vậy thiết kế hầu như mạch lạc và trông giống như một mớ hỗn độn, đây là điều tồi tệ nhất của cả hai.

Điều giữ luật này là[`sources/be/transport.mjs`](../../../sources/be/transport.mjs).

## Quy tắc

**TRANSPORT-1 · Cửa mặc định là GraphQL.**

Một thao tác lấy các trường và câu trả lời có các trường là một đột biến hoặc một truy vấn. Không có thứ hai
câu hỏi để hỏi. Các quy tắc dưới đây là danh sách đầy đủ các lối thoát hiểm và một cánh cửa không phù hợp với chúng
không cần phải tranh cãi về nó - nó nằm trong lược đồ.

**VẬN TẢI-2 · A`@Controller`chỉ được phép khi GraphQL không thể phân phát và tệp phải hiển thị
đó là trường hợp nào.**

Bốn trường hợp, và không có trường hợp nào khác:

| trường hợp | nó trông như thế nào trong tập tin | tại sao GraphQL không thể |
|---|---|---|
| **một hệ thống bên ngoài đăng lên URL mà bạn đã cung cấp** | tuyến đường hoặc tên tập tin nói`webhook`| cổng thanh toán đăng lên một URL cố định. Nó sẽ không bao giờ gửi tài liệu GraphQL và bạn không được yêu cầu nó |
| **byte, không phải trường** |`FileInterceptor`, `StreamableFile`, `@Res(`, `createReadStream`| tải lên nhiều phần và tải xuống theo luồng. GraphQL mang JSON |
| **máy tự đăng ký** | tuyến đường bắt đầu`pods/`, `internal/`, `agents/`| một nhóm gọi về nhà khi khởi động không có phiên người dùng nào để thực hiện |
| **danh tính không phải là phiên của người dùng** | tuyến đường bắt đầu`api/ops`hoặc sử dụng trình bảo vệ toán tử/mã thông báo dịch vụ | nhà điều hành nền tảng hoặc mã thông báo dịch vụ là một chủ đề khác với người xem sản phẩm và việc không có sự bảo vệ tương tự sẽ cho phép quản trị viên của một học viện vận hành nền tảng |

Một thăm dò sự sống (`health`, `healthz`) là một thứ nằm ngoài bảng này: nó phải trả lời trong khi
ứng dụng đã xuống cấp, có thể là trước khi lớp tính năng hoạt động.

**Bằng chứng được đọc từ tập tin, không phải từ sổ đăng ký.** Danh sách các tuyến đường may mắn sẽ bị loại bỏ đầu tiên
khi ai đó thêm một cái rồi quên, và nó cho phép một cánh cửa được chứng minh bằng một tài liệu chứ không phải bằng
nó làm gì.

**VẬN TẢI-3 · Một cánh cửa sống dưới`features/`, bất kể phương tiện vận chuyển của nó là gì.**`modules/`nắm giữ những khả năng - những thứ mà một cánh cửa gọi là. Một cánh cửa đỗ giữa chúng được đọc như một
khả năng và được nhập như một, và hai lớp cửa kết thúc ở hai cây khác nhau với
không có lý do được nêu ở bất cứ đâu. Giao thông vận tải không bao giờ là thứ quyết định địa chỉ; là một cánh cửa.

Điều này ràng buộc`src/modules/**`chỉ một. Một ứng dụng riêng biệt dưới`apps/*`lắp ráp cửa riêng của mình và
không thuộc sự phân chia này.

## Luật này không nói gì

Nó không nói cửa REST là loại thứ hai và nó không yêu cầu bất kỳ ai loại bỏ cửa có
lý do. Bốn trong số các trường hợp trên là vĩnh viễn: webhooks sẽ không bắt đầu đọc GraphQL và các tệp
sẽ không ngừng là byte. Nó chỉ nói rằng lý do phải có **trong tệp**, nên người đọc tiếp theo
giải quyết câu hỏi bằng cách nhìn thay vì đoán.